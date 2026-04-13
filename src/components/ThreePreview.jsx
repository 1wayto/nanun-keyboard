import { useEffect, useRef } from "react";
import * as THREE from "three";
import { C, UNIT, CUTOUT, KEY_GAP, CAP_PROFILES, ACCENT_LABELS, SWITCH_DIMS } from "../constants";
import { isISOEnter, getBounds, getKeyRow } from "../utils";
import { LED_PRESETS } from "../lightPresets";
import { createSwitchAssembly } from "../models/switchParts";
import { KEYCAP_COLORWAYS, HOUSING_COLORS } from "../colorPresets";

// Keycap bottom sits on top of switch housing
const KEYCAP_OFFSET = 5.5;

/* ── Plate geometry (extruded outline with switch cutout holes) ── */
function buildPlate(keys, s) {
  const b = getBounds(keys, s.margin);
  const r = Math.min(s.cornerRadius, (b.maxX - b.minX) / 2, (b.maxY - b.minY) / 2);
  const sh = new THREE.Shape();
  sh.moveTo(b.minX + r, b.minY);
  sh.lineTo(b.maxX - r, b.minY);
  sh.quadraticCurveTo(b.maxX, b.minY, b.maxX, b.minY + r);
  sh.lineTo(b.maxX, b.maxY - r);
  sh.quadraticCurveTo(b.maxX, b.maxY, b.maxX - r, b.maxY);
  sh.lineTo(b.minX + r, b.maxY);
  sh.quadraticCurveTo(b.minX, b.maxY, b.minX, b.maxY - r);
  sh.lineTo(b.minX, b.minY + r);
  sh.quadraticCurveTo(b.minX, b.minY, b.minX + r, b.minY);

  keys.forEach((k) => {
    const cx = (k.x + k.w / 2) * UNIT,
      cy = (k.y + (k.h || 1) / 2) * UNIT,
      hl = CUTOUT / 2;
    const hole = new THREE.Path();
    hole.moveTo(cx - hl, cy - hl);
    hole.lineTo(cx + hl, cy - hl);
    hole.lineTo(cx + hl, cy + hl);
    hole.lineTo(cx - hl, cy + hl);
    hole.lineTo(cx - hl, cy - hl);
    sh.holes.push(hole);
  });
  return new THREE.ExtrudeGeometry(sh, { depth: s.thickness, bevelEnabled: false });
}

/* ── Tapered keycap geometry with bevel (rounded edges) ── */
function createKeycapGeo(wUnits, hUnits, profile, rowHeight, tiltDeg) {
  const baseW = wUnits * UNIT - KEY_GAP;
  const baseD = hUnits * UNIT - KEY_GAP;
  const topW = Math.max(baseW - profile.insetX * 2, 4);
  const topD = Math.max(baseD - profile.insetY * 2, 4);
  const bevel = 0.4;
  const cr = Math.min(1.2, baseW / 4, baseD / 4); // corner radius

  // Build rounded rectangle shape for the base
  const shape = new THREE.Shape();
  const hw = baseW / 2, hd = baseD / 2;
  shape.moveTo(-hw + cr, -hd);
  shape.lineTo(hw - cr, -hd);
  shape.quadraticCurveTo(hw, -hd, hw, -hd + cr);
  shape.lineTo(hw, hd - cr);
  shape.quadraticCurveTo(hw, hd, hw - cr, hd);
  shape.lineTo(-hw + cr, hd);
  shape.quadraticCurveTo(-hw, hd, -hw, hd - cr);
  shape.lineTo(-hw, -hd + cr);
  shape.quadraticCurveTo(-hw, -hd, -hw + cr, -hd);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: rowHeight - bevel * 2,
    bevelEnabled: true,
    bevelSize: bevel,
    bevelThickness: bevel,
    bevelSegments: 2,
  });
  // Rotate so extrusion goes along Y (up), shape is in XZ
  geo.rotateX(-Math.PI / 2);

  // Taper: scale top vertices inward
  const pos = geo.attributes.position;
  let minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    minY = Math.min(minY, pos.getY(i));
    maxY = Math.max(maxY, pos.getY(i));
  }
  const midY = (minY + maxY) / 2;
  const ratioX = topW / baseW;
  const ratioZ = topD / baseD;
  for (let i = 0; i < pos.count; i++) {
    if (pos.getY(i) > midY) {
      pos.setX(i, pos.getX(i) * ratioX);
      pos.setZ(i, pos.getZ(i) * ratioZ);
    }
  }

  // Apply row tilt
  if (tiltDeg && tiltDeg !== 0) {
    const tiltRad = (tiltDeg * Math.PI) / 180;
    for (let i = 0; i < pos.count; i++) {
      if (pos.getY(i) > midY) {
        const z = pos.getZ(i);
        pos.setY(i, pos.getY(i) + z * Math.sin(tiltRad) * 0.3);
      }
    }
  }

  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return { geo, topW, topD, height: rowHeight };
}

/* ── Concave dish geometry (top surface scoop) ── */
function createDishGeo(topW, topD, profile) {
  const dw = Math.max(topW - 1.5, 3);
  const dd = Math.max(topD - 1.5, 3);
  const segs = 8;
  const geo = new THREE.PlaneGeometry(dw, dd, segs, segs);
  const pos = geo.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    const nx = pos.getX(i) / (dw / 2); // -1 to 1
    const ny = pos.getY(i) / (dd / 2);
    let depth;
    if (profile.dishType === "cylindrical") {
      // Cherry: curved front-to-back only
      depth = profile.dishDepth * Math.max(0, 1 - ny * ny);
    } else {
      // SA/DSA: curved in both axes (spherical)
      depth = profile.dishDepth * Math.max(0, 1 - (nx * nx + ny * ny));
    }
    pos.setZ(i, -depth);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

export default function ThreePreview({ keys, plateSettings, opts3d, onReady, onCameraMove }) {
  const mountRef = useRef(null);
  const st = useRef({});

  // Scene setup (once)
  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1e1e22);
    scene.fog = new THREE.FogExp2(0x1e1e22, 0.001);
    const w = el.clientWidth,
      h = el.clientHeight;
    const perspCam = new THREE.PerspectiveCamera(35, w / h, 0.1, 2000);
    const aspect = w / h;
    const orthoSize = 150;
    const orthoCam = new THREE.OrthographicCamera(
      -orthoSize * aspect, orthoSize * aspect, orthoSize, -orthoSize, 0.1, 2000
    );
    const ren = new THREE.WebGLRenderer({ antialias: true });
    ren.setSize(w, h);
    ren.setPixelRatio(Math.min(devicePixelRatio, 2));
    ren.shadowMap.enabled = true;
    ren.shadowMap.type = THREE.PCFSoftShadowMap;
    ren.toneMapping = THREE.ACESFilmicToneMapping;
    ren.toneMappingExposure = 1.3;
    el.appendChild(ren.domElement);

    // ── Lighting ──
    // Ambient fill
    scene.add(new THREE.AmbientLight(0xffeedd, 0.55));

    // Main key light (sun) — top-right-front
    const sun = new THREE.DirectionalLight(0xfff5e6, 1.2);
    sun.position.set(100, 200, 120);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 10;
    sun.shadow.camera.far = 600;
    sun.shadow.camera.left = -300;
    sun.shadow.camera.right = 300;
    sun.shadow.camera.top = 300;
    sun.shadow.camera.bottom = -300;
    scene.add(sun);

    // Fill light — left side, warm
    const fill1 = new THREE.DirectionalLight(0xffe8cc, 0.4);
    fill1.position.set(-120, 80, 60);
    scene.add(fill1);

    // Fill light — right-back, cool
    const fill2 = new THREE.DirectionalLight(0xccddff, 0.25);
    fill2.position.set(80, 60, -100);
    scene.add(fill2);

    // Rim/accent light — from behind, warm accent
    const rim = new THREE.PointLight(0xe2a049, 0.3, 500);
    rim.position.set(0, 80, -120);
    scene.add(rim);

    // Top fill
    const topFill = new THREE.PointLight(0xffffff, 0.2, 400);
    topFill.position.set(0, 150, 0);
    scene.add(topFill);

    // Ground
    const gnd = new THREE.Mesh(
      new THREE.PlaneGeometry(1200, 1200),
      new THREE.MeshStandardMaterial({ color: 0x222228, roughness: 0.92 }),
    );
    gnd.rotation.x = -Math.PI / 2;
    gnd.position.y = 0;
    gnd.receiveShadow = true;
    scene.add(gnd);

    st.current = { scene, cam: perspCam, perspCam, orthoCam, ren, el, meshes: [], theta: Math.PI / 4, phi: Math.PI / 3.5, radius: 140, cameraMode: "perspective",
      raycaster: new THREE.Raycaster(),
      mouse: new THREE.Vector2(),
      pressedKeys: new Set(),
      keyMeshMap: new Map(),
    };

    // ── Expose controls via onReady ──
    const focusView = () => {
      st.current.theta = Math.PI / 4;
      st.current.phi = Math.PI / 3.5;
    };
    const snapCamera = (theta, phi) => {
      st.current.theta = theta;
      st.current.phi = phi;
    };
    if (onReady) onReady({ focusView, snapCamera });

    // ── Orbit controls ──
    let dragBtn = -1,
      px = 0,
      py = 0,
      pinchDist = 0,
      touchCount = 0;
    const cv = ren.domElement;
    cv.addEventListener("contextmenu", (e) => e.preventDefault());
    const getTouchDist = (t) => {
      const dx = t[0].clientX - t[1].clientX;
      const dy = t[0].clientY - t[1].clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };
    const getTouchCenter = (t) => ({
      clientX: (t[0].clientX + t[1].clientX) / 2,
      clientY: (t[0].clientY + t[1].clientY) / 2,
    });
    const oD = (e) => {
      if (e.touches) {
        touchCount = e.touches.length;
        if (e.touches.length === 2) {
          dragBtn = 1; // two-finger = pan + pinch zoom
          pinchDist = getTouchDist(e.touches);
          const c = getTouchCenter(e.touches);
          px = c.clientX;
          py = c.clientY;
        } else {
          dragBtn = 0;
          const p = e.touches[0];
          px = p.clientX;
          py = p.clientY;
        }
        return;
      }
      if (e.button === 1) e.preventDefault();

      // Check if clicking a keycap (don't orbit if so)
      if (e.button === 0) {
        const rect = cv.getBoundingClientRect();
        st.current.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        st.current.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        const activeCam2 = st.current.cameraMode === "iso" ? st.current.orthoCam : st.current.perspCam;
        st.current.raycaster.setFromCamera(st.current.mouse, activeCam2);
        const hits = st.current.raycaster.intersectObjects(scene.children, true);
        const keyHit = hits.find(h => h.object.userData.keyId !== undefined);
        if (keyHit) {
          st.current.pressedKeys.add(keyHit.object.userData.keyId);
          return; // don't start orbit
        }
      }

      dragBtn = e.button;
      px = e.clientX;
      py = e.clientY;
    };
    const oM = (e) => {
      if (dragBtn < 0) return;

      // Touch: handle pinch zoom + two-finger pan
      if (e.touches) {
        if (e.touches.length === 2) {
          // Pinch zoom
          const newDist = getTouchDist(e.touches);
          const delta = pinchDist - newDist;
          st.current.radius = Math.max(30, Math.min(800, st.current.radius + delta * 0.5));
          pinchDist = newDist;
          // Two-finger pan
          const c = getTouchCenter(e.touches);
          const dx = c.clientX - px;
          const dy = c.clientY - py;
          px = c.clientX;
          py = c.clientY;
          const theta = st.current.theta;
          const rightX = Math.sin(theta);
          const rightZ = -Math.cos(theta);
          const panScale = st.current.radius * 0.002;
          st.current.centerX -= dx * rightX * panScale;
          st.current.centerZ -= dx * rightZ * panScale;
          st.current.centerX += dy * Math.cos(theta) * panScale * Math.cos(st.current.phi);
          st.current.centerZ += dy * Math.sin(theta) * panScale * Math.cos(st.current.phi);
          return;
        }
        if (e.touches.length >= 2) return; // ignore 3+ fingers
      }

      const p = e.touches ? e.touches[0] : e;
      const dx = p.clientX - px;
      const dy = p.clientY - py;
      px = p.clientX;
      py = p.clientY;

      if (dragBtn === 0) {
        // Left click / single touch: orbit
        st.current.theta -= dx * 0.007;
        st.current.phi = Math.max(0.05, Math.min(Math.PI - 0.05, st.current.phi - dy * 0.007));
      } else if (dragBtn === 1) {
        // Middle click: pan
        const theta = st.current.theta;
        const rightX = Math.sin(theta);
        const rightZ = -Math.cos(theta);
        const panScale = st.current.radius * 0.002;
        st.current.centerX -= dx * rightX * panScale;
        st.current.centerZ -= dx * rightZ * panScale;
        st.current.centerX += dy * Math.cos(theta) * panScale * Math.cos(st.current.phi);
        st.current.centerZ += dy * Math.sin(theta) * panScale * Math.cos(st.current.phi);
      }
    };
    const oU = () => {
      dragBtn = -1;
      touchCount = 0;
      st.current.pressedKeys.clear();
    };
    const oW = (e) => {
      e.preventDefault();
      st.current.radius = Math.max(30, Math.min(800, st.current.radius + e.deltaY * 0.18));
    };
    cv.addEventListener("mousedown", oD);
    cv.addEventListener("mousemove", oM);
    cv.addEventListener("mouseup", oU);
    cv.addEventListener("mouseleave", oU);
    cv.addEventListener("wheel", oW, { passive: false });
    cv.addEventListener("touchstart", oD, { passive: true });
    cv.addEventListener("touchmove", oM, { passive: false });
    cv.addEventListener("touchend", oU);

    let anim;
    const loop = () => {
      anim = requestAnimationFrame(loop);
      const activeCam = st.current.cameraMode === "iso" ? st.current.orthoCam : st.current.perspCam;
      const { theta, phi, radius, centerX: cx2, centerZ: cz2 } = st.current;
      if (cx2 !== undefined) {
        activeCam.position.set(
          cx2 + radius * Math.sin(phi) * Math.cos(theta),
          radius * Math.cos(phi),
          cz2 + radius * Math.sin(phi) * Math.sin(theta),
        );
        activeCam.lookAt(cx2, 0, cz2);
      }
      if (st.current.cameraMode === "iso") {
        const asp = el.clientWidth / el.clientHeight;
        const sz = st.current.radius * 0.45;
        activeCam.left = -sz * asp;
        activeCam.right = sz * asp;
        activeCam.top = sz;
        activeCam.bottom = -sz;
        activeCam.updateProjectionMatrix();
      }
      if (onCameraMove) onCameraMove({ theta: st.current.theta, phi: st.current.phi });

      // Key press animation — keycap + switch stem/spring
      const TRAVEL = 4; // mm key travel
      const LERP_SPEED = 0.2;
      const { pressedKeys, keyMeshMap, switchParts } = st.current;
      if (keyMeshMap) {
        keyMeshMap.forEach((entry, keyId) => {
          const isPressed = pressedKeys.has(keyId);
          const targetY = isPressed ? entry.originalY - TRAVEL : entry.originalY;
          entry.meshes.forEach((m) => {
            m.position.y += (targetY - m.position.y) * LERP_SPEED;
          });

          // Animate switch stem (moves down with keycap) and spring (compresses)
          if (switchParts) {
            const sw = switchParts.get(keyId);
            if (sw) {
              const stemTargetY = isPressed ? sw.stemOrigY - TRAVEL : sw.stemOrigY;
              if (sw.stem) sw.stem.position.y += (stemTargetY - sw.stem.position.y) * LERP_SPEED;
              // Spring compresses: scale Y shrinks when pressed
              if (sw.spring) {
                const springScaleTarget = isPressed ? 0.4 : 1.0;
                sw.spring.scale.y += (springScaleTarget - sw.spring.scale.y) * LERP_SPEED;
                // Spring also moves down slightly to stay centered
                const springTargetY = isPressed ? sw.springOrigY - TRAVEL * 0.3 : sw.springOrigY;
                sw.spring.position.y += (springTargetY - sw.spring.position.y) * LERP_SPEED;
              }
            }
          }
        });
      }

      // LED animation
      const { leds, opts3d: currentOpts } = st.current;
      if (leds && leds.length > 0 && currentOpts?.ledEnabled) {
        const preset = LED_PRESETS[currentOpts.ledMode] || LED_PRESETS.static;
        const speed = currentOpts.ledSpeed || 1.0;
        const brightness = (currentOpts.ledBrightness || 80) / 100;
        const elapsed = performance.now() / 1000 * speed;
        const maxX = Math.max(...(st.current.ledKeyPositions || [1]));
        leds.forEach(({ mesh, glow, keyId, keyIndex }) => {
          const kx = st.current.ledKeyXY?.[keyId]?.x || 0;
          const ky = st.current.ledKeyXY?.[keyId]?.y || 0;
          let [r, g, b] = preset.fn(elapsed, keyIndex, leds.length, kx, ky, maxX);

          // Reactive boost
          if (currentOpts.ledMode === "reactive" && st.current.pressedKeys?.has(keyId)) {
            r = 1; g = 1; b = 1;
          }

          r *= brightness;
          g *= brightness;
          b *= brightness;

          // Update emissive LED mesh
          mesh.material.color.setRGB(r, g, b);
          mesh.material.emissive.setRGB(r, g, b);
          mesh.material.emissiveIntensity = Math.max(r, g, b) * 3;
          if (glow) {
            glow.material.color.setRGB(r, g, b);
            glow.material.opacity = Math.max(r, g, b) * 0.25;
          }
          // Light up the switch top housing light pipe
          if (switchParts) {
            const sw = switchParts.get(keyId);
            if (sw?.lightPipe?.material) {
              sw.lightPipe.material.emissive.setRGB(r, g, b);
              sw.lightPipe.material.emissiveIntensity = Math.max(r, g, b) * 2;
              sw.lightPipe.material.opacity = 0.3 + Math.max(r, g, b) * 0.4;
            }
          }
        });
      }

      ren.render(scene, activeCam);
    };
    loop();
    const onR = () => {
      const ww = el.clientWidth,
        hh = el.clientHeight;
      perspCam.aspect = ww / hh;
      perspCam.updateProjectionMatrix();
      ren.setSize(ww, hh);
    };
    window.addEventListener("resize", onR);
    return () => {
      cancelAnimationFrame(anim);
      window.removeEventListener("resize", onR);
      ren.dispose();
      if (el.contains(cv)) el.removeChild(cv);
    };
  }, []);

  // Rebuild meshes when keys/settings change
  useEffect(() => {
    const { scene, meshes } = st.current;
    if (!scene) return;
    // Update scene colors from theme
    const sceneColor = C.scene3d || C.bg;
    scene.background = new THREE.Color(sceneColor);
    scene.fog = new THREE.FogExp2(new THREE.Color(sceneColor), 0.001);
    // Update ground plane
    scene.children.forEach((child) => {
      if (child.geometry?.type === "PlaneGeometry" && child.material?.color) {
        child.material.color.set(sceneColor);
      }
    });

    meshes?.forEach((m) => {
      scene.remove(m);
      m.geometry?.dispose();
      if (Array.isArray(m.material)) m.material.forEach((mt) => mt.dispose());
      else m.material?.dispose();
    });
    st.current.meshes = [];
    st.current.keyMeshMap = new Map();
    st.current.switchParts = new Map();
    st.current.leds = [];
    st.current.opts3d = opts3d;
    st.current.switchExplode = opts3d.switchExplode || 0;
    st.current.cameraMode = opts3d.cameraMode || "perspective";
    if (!keys.length) return;

    const profile = CAP_PROFILES[opts3d.capProfile] || CAP_PROFILES.cherry;
    const showCaps = opts3d.capProfile !== "none";

    // Camera framing
    const minKX = Math.min(...keys.map((k) => (isISOEnter(k) ? k.x - 0.25 : k.x)));
    const maxKX = Math.max(...keys.map((k) => k.x + k.w));
    const minKY = Math.min(...keys.map((k) => k.y));
    const maxKY = Math.max(...keys.map((k) => k.y + (k.h || 1)));
    const layoutMinY = minKY;
    const centerX = ((minKX + maxKX) / 2) * UNIT;
    const centerZ = ((minKY + maxKY) / 2) * UNIT;  // positive (group scale.z=-1 flips)
    const span = Math.max((maxKX - minKX) * UNIT, (maxKY - minKY) * UNIT);
    st.current.radius = span * 0.95 + 40;
    st.current.centerX = centerX;
    st.current.centerZ = centerZ;

    const kbGroup = new THREE.Group();
    kbGroup.scale.z = -1;  // flip Z so layout Y maps to +world Z (front=near, back=far)
    scene.add(kbGroup);
    st.current.meshes.push(kbGroup);

    const add = (m) => {
      kbGroup.add(m);
      st.current.meshes.push(m);
    };

    const pt = plateSettings.thickness;
    const pcbThick = 1.6; // standard PCB thickness
    const switchBelow = 5;  // switch housing below plate
    // Vertical stack: PCB(0→1.6) → switch bottom(1.6→6.6) → plate(6.6→6.6+pt)
    const pcbTop = pcbThick;
    const plateBottom = pcbTop + switchBelow; // 6.6mm — where plate sits
    const plateTop = plateBottom + pt; // top surface of plate — keycaps sit above this
    const DS = THREE.DoubleSide;
    // Lift everything above ground when case is present
    const hasCase = opts3d.caseStyle !== "none";
    const slopeRad = (opts3d.slope || 0) * Math.PI / 180;
    const botThick = 3;
    const groundOffset = hasCase ? botThick : 0;
    kbGroup.position.y = groundOffset;

    // ── Case ──
    if (hasCase) {
      const bds = getBounds(keys, plateSettings.margin);
      const cw = bds.maxX - bds.minX, ch = bds.maxY - bds.minY;
      const cx = (bds.minX + bds.maxX) / 2, cy = (bds.minY + bds.maxY) / 2;
      const wall = 2.5;
      // Case wall height — measured from plate level
      // Keycap tops at: KEYCAP_OFFSET + tallest row (~14.5 SA) = ~21mm above plate
      // High: walls above keycaps. Tray: walls at keycap top. Low: walls below keycap top.
      const caseH = opts3d.caseStyle === "high" ? KEYCAP_OFFSET + 16
        : opts3d.caseStyle === "low" ? KEYCAP_OFFSET + 4
        : KEYCAP_OFFSET + 10; // tray
      const caseR = 2;
      const caseColor = opts3d.caseColor || "#8a8a90";
      const caseMat = new THREE.MeshStandardMaterial({ color: caseColor, metalness: 0.5, roughness: 0.35, side: DS });

      // Top case shell (walls around the plate/keycaps)
      const outerShape = new THREE.Shape();
      const hw = cw / 2 + wall, hh = ch / 2 + wall;
      outerShape.moveTo(-hw + caseR, -hh);
      outerShape.lineTo(hw - caseR, -hh);
      outerShape.quadraticCurveTo(hw, -hh, hw, -hh + caseR);
      outerShape.lineTo(hw, hh - caseR);
      outerShape.quadraticCurveTo(hw, hh, hw - caseR, hh);
      outerShape.lineTo(-hw + caseR, hh);
      outerShape.quadraticCurveTo(-hw, hh, -hw, hh - caseR);
      outerShape.lineTo(-hw, -hh + caseR);
      outerShape.quadraticCurveTo(-hw, -hh, -hw + caseR, -hh);

      const iw = cw / 2 - 0.5, ih = ch / 2 - 0.5;
      const innerHole = new THREE.Path();
      innerHole.moveTo(-iw, -ih);
      innerHole.lineTo(iw, -ih);
      innerHole.lineTo(iw, ih);
      innerHole.lineTo(-iw, ih);
      innerHole.closePath();
      outerShape.holes.push(innerHole);

      const caseGeo = new THREE.ExtrudeGeometry(outerShape, {
        depth: caseH, bevelEnabled: true, bevelSize: 0.8, bevelThickness: 0.8, bevelSegments: 3
      });
      caseGeo.rotateX(-Math.PI / 2);
      const caseMesh = new THREE.Mesh(caseGeo, caseMat);
      caseMesh.position.set(cx, 0, -cy); // case starts from PCB level (y=0)
      caseMesh.castShadow = true;
      caseMesh.receiveShadow = true;
      add(caseMesh);

      // Bottom case — in SCENE space, flat bottom, top matches tilted case bottom
      // Compute exact world Y of tilted case bottom at front and back edges
      const slopeDepth = ch + wall * 2;
      const frontWorldZ = maxKY * UNIT;
      // Tilted case bottom edge world Y positions:
      //   Front (pivot point): Y = groundOffset (case shell at -botThick + groundOffset = 0, but wall starts at groundOffset - botThick)
      //   Back: front Y + sin(slope) * depth
      const frontTopY = groundOffset - botThick;  // = 0 at front
      const backTopY = frontTopY + Math.sin(slopeRad) * slopeDepth;
      const maxTopY = Math.max(frontTopY, backTopY);

      const bottomW = cw + wall * 2;
      const bottomD = slopeDepth;

      // Build with position at origin, then set vertex Y to absolute world positions
      // Bottom = 0 (ground), top = computed per-vertex
      const bottomGeo = new THREE.BoxGeometry(bottomW, 1, bottomD, 1, 1, 1);
      const bPos = bottomGeo.attributes.position;
      for (let i = 0; i < bPos.count; i++) {
        const z = bPos.getZ(i);
        // t: 0=front(+Z), 1=back(-Z)
        const t = (-z / (bottomD / 2) + 1) / 2;
        const topAtZ = frontTopY + t * (backTopY - frontTopY);

        if (bPos.getY(i) > 0) {
          // Top vertex Y and Z: match the tilted case bottom arc
          bPos.setY(i, topAtZ);
          // Z shifts inward at the back due to rotation arc: back edge moves toward front
          const zShift = t * (slopeDepth - Math.cos(slopeRad) * slopeDepth);
          bPos.setZ(i, bPos.getZ(i) + zShift);
        } else {
          bPos.setY(i, 0);
        }
      }
      bPos.needsUpdate = true;
      bottomGeo.computeVertexNormals();

      const bottomCase = new THREE.Mesh(bottomGeo, caseMat);
      // Position: X=case center, Y=0 (vertices are already in world Y), Z=keyboard center
      bottomCase.position.set(cx, 0, centerZ);
      bottomCase.castShadow = true;
      bottomCase.receiveShadow = true;
      scene.add(bottomCase);
      st.current.meshes.push(bottomCase);

      // Tray groove — horizontal channel across the case bottom (tray mount style)
      if (opts3d.caseStyle === "tray") {
        const grooveMat = new THREE.MeshStandardMaterial({ color: 0x151518, metalness: 0.3, roughness: 0.6, side: DS });
        // Center groove
        const grooveW = cw * 0.6;
        const grooveH = 1.2;
        const grooveD = 3;
        const grooveGeo = new THREE.BoxGeometry(grooveW, grooveH, grooveD);
        const groove = new THREE.Mesh(grooveGeo, grooveMat);
        groove.position.set(cx, -botThick + grooveH / 2 + 0.1, -cy);
        add(groove);
        // Side grooves (two shorter channels near front and back)
        const sideGrooveW = cw * 0.3;
        const sgGeo = new THREE.BoxGeometry(sideGrooveW, grooveH, grooveD * 0.7);
        const sg1 = new THREE.Mesh(sgGeo, grooveMat);
        sg1.position.set(cx, -botThick + grooveH / 2 + 0.1, -cy + ch * 0.3);
        add(sg1);
        const sg2 = new THREE.Mesh(sgGeo, grooveMat);
        sg2.position.set(cx, -botThick + grooveH / 2 + 0.1, -cy - ch * 0.3);
        add(sg2);
      }

    }

    // Layer explode offsets (keycaps highest, case lowest)
    const le = opts3d.layerExplode || 0;
    const explodeKeycap = le * 40;
    const explodeSwitch = le * 25;
    const explodePlate = le * 15;
    const explodePCB = le * 5;
    // Case stays at 0 (ground reference)

    // ── PCB (green circuit board) ──
    if (opts3d.showPCB !== false) {
      const pcbBds = getBounds(keys, plateSettings.margin);
      const pcbW = pcbBds.maxX - pcbBds.minX + 2;
      const pcbD = pcbBds.maxY - pcbBds.minY + 2;
      const pcbCx = (pcbBds.minX + pcbBds.maxX) / 2;
      const pcbCy = (pcbBds.minY + pcbBds.maxY) / 2;
      const pcbGeo = new THREE.BoxGeometry(pcbW, pcbThick, pcbD);
      const pcbMat = new THREE.MeshStandardMaterial({ color: opts3d.pcbColor || "#1a5c2a", metalness: 0.1, roughness: 0.7, side: DS });
      const pcb = new THREE.Mesh(pcbGeo, pcbMat);
      pcb.position.set(pcbCx, pcbThick / 2 + explodePCB, -pcbCy);
      add(pcb);
    }

    // ── Plate ──
    if (opts3d.showPlate !== false) {
      const pGeo = buildPlate(keys, plateSettings);
      const pMat = new THREE.MeshStandardMaterial({ color: opts3d.plateColor || "#888890", metalness: 0.7, roughness: 0.25, side: DS });
      const plate = new THREE.Mesh(pGeo, pMat);
      plate.rotation.x = -Math.PI / 2;
      plate.position.y = plateBottom + explodePlate;
      plate.castShadow = true;
      plate.receiveShadow = true;
      add(plate);
    }

    // ── Shared materials (using color presets) ──
    const cw_ = KEYCAP_COLORWAYS.find((c) => c.name === (opts3d.keycapColorway || "Minimal White")) || KEYCAP_COLORWAYS[0];
    const capBase = new THREE.MeshStandardMaterial({ color: cw_.base, metalness: 0.0, roughness: 0.7, side: DS });
    const capAcct = new THREE.MeshStandardMaterial({ color: cw_.accent, metalness: 0.0, roughness: 0.65, side: DS });
    const capMod = new THREE.MeshStandardMaterial({ color: cw_.mod, metalness: 0.0, roughness: 0.7, side: DS });
    // Dish: slightly lighter than base
    const capTopBase = new THREE.MeshStandardMaterial({ color: cw_.base, metalness: 0.05, roughness: 0.55, side: DS, emissive: cw_.base, emissiveIntensity: 0.05 });
    const capTopAcct = new THREE.MeshStandardMaterial({ color: cw_.accent, metalness: 0.05, roughness: 0.5, side: DS, emissive: cw_.accent, emissiveIntensity: 0.05 });


    keys.forEach((k) => {
      const kpx = (k.x + k.w / 2) * UNIT;
      const pz = -(k.y + (k.h || 1) / 2) * UNIT;
      const isA = ACCENT_LABELS.has(k.label);
      const isISO = isISOEnter(k);

      const keyRow = getKeyRow(k.y, layoutMinY);
      const rowData = profile.rows ? profile.rows[keyRow] || profile.rows[3] : { height: 8, tilt: 0 };
      const rowHeight = rowData.height;
      const rowTilt = rowData.tilt;

      // ── Switch ──
      if (opts3d.switches) {
        // Get housing colors from preset
        const hc = HOUSING_COLORS.find((c) => c.name === (opts3d.housingColor || "Black")) || HOUSING_COLORS[0];
        const { parts, assemblyGroup } = createSwitchAssembly(
          opts3d.ledFacing || "south",
          opts3d.stemColor || "#d4a04a",
          hc.top, hc.bottom
        );
        assemblyGroup.position.set(kpx, plateBottom + explodeSwitch, pz);

        // Apply explode factor
        const explodeFactor = opts3d.switchExplode || 0;
        if (explodeFactor > 0) {
          parts.forEach((part) => {
            part.group.position.y += part.explodeY * explodeFactor;
          });
        }

        // Tag for raycasting
        assemblyGroup.traverse((child) => {
          if (child.isMesh) child.userData.keyId = k.id;
        });

        // Store stem, spring, and light pipe refs for animation
        const stemPart = parts.get("stem");
        const springPart = parts.get("spring");
        const topHousingPart = parts.get("topHousing");
        // Find the light pipe mesh inside the top housing
        let lightPipe = null;
        topHousingPart?.group.traverse((child) => {
          if (child.userData?.isLightPipe) lightPipe = child;
        });
        if (!st.current.switchParts) st.current.switchParts = new Map();
        st.current.switchParts.set(k.id, {
          stem: stemPart?.group,
          spring: springPart?.group,
          stemOrigY: stemPart?.group.position.y || 0,
          springOrigY: springPart?.group.position.y || 0,
          lightPipe,
        });

        add(assemblyGroup);
      }

      // ── Keycap ──
      if (showCaps) {
        const kh = k.h || 1;

        if (isISO) {
          // L-shaped ISO Enter keycap with taper
          const isoShape = new THREE.Shape();
          const halfGap = KEY_GAP / 2;
          const topW = 1.5 * UNIT - KEY_GAP;
          const botW = 1.25 * UNIT - KEY_GAP;
          const rowH = UNIT - halfGap;
          // ofsX: left edge of the wide top part, relative to kpx (center of 1.25u key)
          const ofsX = -(k.w / 2 + 0.25) * UNIT + halfGap;
          const rightX = ofsX + topW;
          const innerX = rightX - botW;
          isoShape.moveTo(ofsX, halfGap);
          isoShape.lineTo(rightX, halfGap);
          isoShape.lineTo(rightX, rowH * 2);
          isoShape.lineTo(innerX, rowH * 2);
          isoShape.lineTo(innerX, rowH + halfGap);
          isoShape.lineTo(ofsX, rowH + halfGap);
          isoShape.closePath();
          const bevelISO = 0.4;
          const capGeo = new THREE.ExtrudeGeometry(isoShape, {
            depth: rowHeight - bevelISO * 2,
            bevelEnabled: true,
            bevelSize: bevelISO,
            bevelThickness: bevelISO,
            bevelSegments: 2,
          });
          capGeo.rotateX(-Math.PI / 2);
          // After rotation: geometry Y goes from ~0 to ~rowHeight
          // Don't center — position directly using the geometry's actual bounds

          // Taper top vertices inward
          const pos = capGeo.attributes.position;
          let minY = Infinity, maxY = -Infinity;
          for (let i = 0; i < pos.count; i++) {
            const y = pos.getY(i);
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
          const midY = (minY + maxY) / 2;

          // Find center and range of top vertices
          let txMin = Infinity, txMax = -Infinity, tzMin = Infinity, tzMax = -Infinity;
          for (let i = 0; i < pos.count; i++) {
            if (pos.getY(i) > midY) {
              const x = pos.getX(i), z = pos.getZ(i);
              if (x < txMin) txMin = x;
              if (x > txMax) txMax = x;
              if (z < tzMin) tzMin = z;
              if (z > tzMax) tzMax = z;
            }
          }
          const rangeX = txMax - txMin;
          const rangeZ = tzMax - tzMin;
          const centerX = (txMin + txMax) / 2;
          const centerZ = (tzMin + tzMax) / 2;
          const scaleX = rangeX > 0 ? (rangeX - profile.insetX * 2) / rangeX : 1;
          const scaleZ = rangeZ > 0 ? (rangeZ - profile.insetY * 2) / rangeZ : 1;

          for (let i = 0; i < pos.count; i++) {
            if (pos.getY(i) > midY) {
              pos.setX(i, centerX + (pos.getX(i) - centerX) * scaleX);
              pos.setZ(i, centerZ + (pos.getZ(i) - centerZ) * scaleZ);
            }
          }
          pos.needsUpdate = true;
          capGeo.computeVertexNormals();

          const cap = new THREE.Mesh(capGeo, isA ? capAcct : capBase);
          // Y: geometry centered vertically, so position like regular keys
          // Z: shape starts at top of key and extends down, so use top edge
          const isoPz = -(k.y) * UNIT;
          const isoShellCavityH = rowHeight - 1.2 * 3;
          cap.position.set(kpx, plateTop + KEYCAP_OFFSET + explodeKeycap + rowHeight / 2 - isoShellCavityH, isoPz);
          cap.castShadow = true;
          cap.userData.keyId = k.id;
          add(cap);
          st.current.keyMeshMap.set(k.id, { meshes: [cap], originalY: cap.position.y });
        } else {
          // Regular key — tapered frustum
          const { geo: capGeo, topW, topD, height: capHeight } = createKeycapGeo(k.w, kh, profile, rowHeight, rowTilt);
          const cap = new THREE.Mesh(capGeo, isA ? capAcct : capBase);
          const shellCavityH = capHeight - 1.2 * 3;
          cap.position.set(kpx, plateTop + KEYCAP_OFFSET + explodeKeycap + capHeight / 2 - shellCavityH, pz);
          cap.castShadow = true;
          cap.userData.keyId = k.id;
          add(cap);

          const keyMeshes = [cap];

          // Keycap interior — hollow shell with stem socket reaching deep inside
          const capBottomY = plateTop + KEYCAP_OFFSET + explodeKeycap;
          const wallT = 1.2; // keycap wall thickness
          const baseW = k.w * UNIT - KEY_GAP;
          const baseD = kh * UNIT - KEY_GAP;
          const innerMat = new THREE.MeshStandardMaterial({ color: 0x0e0e12, metalness: 0, roughness: 0.9, side: DS, transparent: true, opacity: 0.4 });

          // Hollow cavity (dark interior — fully inside the keycap shell)
          const innerLift = 3; // lift all internals up so nothing sticks below keycap
          const cavityH = capHeight - wallT * 3;
          const cavityW = Math.max(baseW - wallT * 2 - profile.insetX, 4);
          const cavityD = Math.max(baseD - wallT * 2 - profile.insetY, 4);
          const cavity = new THREE.Mesh(new THREE.BoxGeometry(cavityW, cavityH, cavityD), innerMat);
          cavity.position.set(kpx, capBottomY + innerLift + cavityH / 2, pz);
          cavity.userData.keyId = k.id;
          add(cavity);
          keyMeshes.push(cavity);

          // Stem socket — reaches deep into keycap (most of the cavity height)
          const socketDepth = Math.min(cavityH * 0.8, 5);

          // Cross mount (where switch stem inserts)
          const crossV = new THREE.Mesh(new THREE.BoxGeometry(1.32, socketDepth, 4.1), innerMat);
          crossV.position.set(kpx, capBottomY + innerLift + socketDepth / 2 + cavityH - socketDepth, pz);
          crossV.userData.keyId = k.id;
          add(crossV);
          keyMeshes.push(crossV);

          const crossH = new THREE.Mesh(new THREE.BoxGeometry(4.1, socketDepth, 1.32), innerMat);
          crossH.position.set(kpx, capBottomY + innerLift + socketDepth / 2 + cavityH - socketDepth, pz);
          crossH.userData.keyId = k.id;
          add(crossH);
          keyMeshes.push(crossH);

          // Socket cylinder (outer ring, shorter than the cross mount)
          const ringH = socketDepth * 0.5;
          const socketRing = new THREE.Mesh(
            new THREE.CylinderGeometry(2.8, 2.8, ringH, 12),
            innerMat
          );
          socketRing.position.set(kpx, capBottomY + innerLift + cavityH - socketDepth + ringH / 2, pz);
          socketRing.userData.keyId = k.id;
          add(socketRing);
          keyMeshes.push(socketRing);

          // Inner reinforcement ribs (cross pattern inside cavity)
          const ribMat = new THREE.MeshStandardMaterial({ color: 0x151518, metalness: 0, roughness: 0.85, side: DS });
          const ribH = cavityH * 0.5;
          const ribThick = 0.6;
          const ribInset = profile.insetX * 1.5;
          const ribX = new THREE.Mesh(new THREE.BoxGeometry(Math.max(cavityW - ribInset, 3), ribH, ribThick), ribMat);
          ribX.position.set(kpx, capBottomY + innerLift + ribH / 2, pz);
          ribX.userData.keyId = k.id;
          add(ribX);
          keyMeshes.push(ribX);
          const ribZ = new THREE.Mesh(new THREE.BoxGeometry(ribThick, ribH, Math.max(cavityD - ribInset, 3)), ribMat);
          ribZ.position.set(kpx, capBottomY + innerLift + ribH / 2, pz);
          ribZ.userData.keyId = k.id;
          add(ribZ);
          keyMeshes.push(ribZ);

          // Dish (concave top surface)
          if (topW > 4 && topD > 4) {
            const dishGeo = createDishGeo(topW, topD, profile);
            const dish = new THREE.Mesh(dishGeo, isA ? capTopAcct : capTopBase);
            dish.rotation.x = -Math.PI / 2;
            dish.position.set(kpx, plateTop + KEYCAP_OFFSET + explodeKeycap + capHeight + 0.08 - shellCavityH, pz);
            dish.userData.keyId = k.id;
            add(dish);
            keyMeshes.push(dish);
          }
          st.current.keyMeshMap.set(k.id, { meshes: keyMeshes, originalY: cap.position.y });
        }
      }

      // ── LED (lightweight: emissive mesh only, no PointLight) ──
      if (opts3d.ledEnabled) {
        const ledOffsetZ = opts3d.ledFacing === "north" ? 4.7 : -4.7;

        // SMD LED on PCB — small glowing rectangle
        const ledGeo = new THREE.BoxGeometry(2, 0.5, 2);
        const ledMat = new THREE.MeshStandardMaterial({
          color: 0xffffff,
          emissive: 0xffffff,
          emissiveIntensity: 2,
          side: DS,
        });
        const ledMesh = new THREE.Mesh(ledGeo, ledMat);
        ledMesh.position.set(kpx, pcbTop + 0.5, pz + ledOffsetZ);
        add(ledMesh);

        // Light glow — a slightly larger transparent plane above the LED for diffusion
        const glowGeo = new THREE.PlaneGeometry(6, 6);
        const glowMat = new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.15,
          side: DS,
        });
        const glow = new THREE.Mesh(glowGeo, glowMat);
        glow.rotation.x = -Math.PI / 2;
        glow.position.set(kpx, pcbTop + 1.5, pz + ledOffsetZ);
        add(glow);

        st.current.leds.push({ mesh: ledMesh, glow, keyId: k.id, keyIndex: keys.indexOf(k) });
      }
    });

    // Store key positions for LED animation
    const ledKeyXY = {};
    keys.forEach(k => { ledKeyXY[k.id] = { x: k.x, y: k.y }; });
    st.current.ledKeyXY = ledKeyXY;
    st.current.ledKeyPositions = keys.map(k => k.x + k.w);

    // Tilt the kbGroup to sit on the angled bottom case top surface
    if (slopeRad > 0 && hasCase) {
      // The bottom case top at the front is at y = botThick (world space)
      // kbGroup is at y = groundOffset = botThick, so kbGroup bottom is at world y = botThick - botThick = 0...
      // Wait: kbGroup.position.y = groundOffset (botThick=3). The case shell inside kbGroup starts at y=-botThick.
      // So case shell bottom in world = groundOffset + (-botThick) = 0. Good.
      // The bottom case top at front = botThick (world). At back = botThick + backExtra.
      // The kbGroup needs to tilt so its bottom matches this slope.
      // Pivot at front edge, tilt by slopeRad.

      const frontWorldZ = maxKY * UNIT; // front edge in world Z (after scale.z flip)

      const tiltGroup = new THREE.Group();
      scene.remove(kbGroup);
      tiltGroup.add(kbGroup);

      // Put the front-bottom of kbGroup at tiltGroup origin
      kbGroup.position.y = 0;  // reset — tiltGroup position handles world Y
      kbGroup.position.z = -frontWorldZ;

      tiltGroup.rotation.x = slopeRad;
      tiltGroup.position.y = groundOffset; // front-bottom at groundOffset (meets bottom case top)
      tiltGroup.position.z = frontWorldZ;

      scene.add(tiltGroup);
      st.current.meshes.push(tiltGroup);
    }

  }, [keys, plateSettings, opts3d]);

  return <div ref={mountRef} style={{ width: "100%", height: "100%", minHeight: 400 }} />;
}
