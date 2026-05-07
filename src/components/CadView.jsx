import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { C, FONT_PRIMARY, FONT_MONO } from "../constants";
import { initCad } from "../cad/init";
import { buildPlate } from "../cad/buildPlate";
import { solidToGeometry } from "../cad/tessellate";

// CAD tab — replicad-driven parametric view.
// Phase 1: switch plate only. Future parts (top case, bottom case, cover,
// electrical) plug into the same scene as additional layers.
export default function CadView({ keys, plateSettings }) {
  const mountRef = useRef(null);
  const st = useRef({});
  const [status, setStatus] = useState("init"); // init | ready | error
  const [errMsg, setErrMsg] = useState("");

  // Scene init — once on mount.
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(C.scene3d || 0x1a1a1a);

    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 4000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);
    Object.assign(renderer.domElement.style, { display: "block", width: "100%", height: "100%" });

    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const key = new THREE.DirectionalLight(0xffffff, 0.9);
    key.position.set(150, 300, 200);
    const fill = new THREE.DirectionalLight(0xffffff, 0.35);
    fill.position.set(-200, 150, -100);
    scene.add(key, fill);

    const partGroup = new THREE.Group();
    scene.add(partGroup);

    // Bird's-eye orbit, similar feel to BuildScene.
    const orbit = { theta: Math.PI / 4, phi: Math.PI / 3.2, radius: 360, target: new THREE.Vector3(0, 0, 0) };
    const applyCamera = () => {
      const { theta, phi, radius, target } = orbit;
      camera.position.set(
        target.x + radius * Math.sin(phi) * Math.cos(theta),
        target.y + radius * Math.cos(phi),
        target.z + radius * Math.sin(phi) * Math.sin(theta),
      );
      camera.up.set(0, 0, 1);
      camera.lookAt(target);
    };

    let drag = null;
    const onDown = (e) => {
      drag = { x: e.clientX, y: e.clientY, theta: orbit.theta, phi: orbit.phi };
    };
    const onMove = (e) => {
      if (!drag) return;
      orbit.theta = drag.theta - (e.clientX - drag.x) * 0.005;
      orbit.phi = Math.max(0.05, Math.min(Math.PI - 0.05, drag.phi - (e.clientY - drag.y) * 0.005));
      applyCamera();
    };
    const onUp = () => { drag = null; };
    const onWheel = (e) => {
      e.preventDefault();
      orbit.radius = Math.max(80, Math.min(1500, orbit.radius * (1 + e.deltaY * 0.001)));
      applyCamera();
    };
    renderer.domElement.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    renderer.domElement.addEventListener("wheel", onWheel, { passive: false });

    const resize = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    };
    resize();
    window.addEventListener("resize", resize);

    let raf = 0;
    const loop = () => { renderer.render(scene, camera); raf = requestAnimationFrame(loop); };
    applyCamera();
    loop();

    st.current = { scene, camera, renderer, partGroup, applyCamera, orbit };

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      renderer.domElement.removeEventListener("mousedown", onDown);
      renderer.domElement.removeEventListener("wheel", onWheel);
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  // OCCT init.
  useEffect(() => {
    let alive = true;
    initCad()
      .then(() => { if (alive) setStatus("ready"); })
      .catch((e) => { if (alive) { setStatus("error"); setErrMsg(String(e?.message || e)); } });
    return () => { alive = false; };
  }, []);

  // Rebuild the plate solid whenever inputs change. Tessellation + WASM CAD
  // ops can take 100-500ms on real layouts — fine for now; worker move comes later.
  useEffect(() => {
    if (status !== "ready") return;
    const { partGroup } = st.current;
    if (!partGroup) return;

    let cancelled = false;
    (async () => {
      try {
        const solid = buildPlate(keys, plateSettings);
        if (cancelled) return;
        const geometry = solidToGeometry(solid);

        // Clear existing children.
        while (partGroup.children.length) {
          const m = partGroup.children.pop();
          m.geometry?.dispose();
          m.material?.dispose();
        }

        const material = new THREE.MeshStandardMaterial({
          color: 0xc8c8d0,
          roughness: 0.55,
          metalness: 0.15,
          side: THREE.DoubleSide,
        });
        const mesh = new THREE.Mesh(geometry, material);
        partGroup.add(mesh);

        // Edge overlay.
        const edges = new THREE.EdgesGeometry(geometry, 30);
        const lines = new THREE.LineSegments(
          edges,
          new THREE.LineBasicMaterial({ color: 0x202028 }),
        );
        partGroup.add(lines);
      } catch (e) {
        if (!cancelled) {
          setStatus("error");
          setErrMsg(String(e?.message || e));
        }
      }
    })();
    return () => { cancelled = true; };
  }, [status, keys, plateSettings.thickness, plateSettings.margin, plateSettings.cornerRadius]);

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <div ref={mountRef} style={{ width: "100%", height: "100%" }} />
      {status !== "ready" && (
        <div
          style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: `${C.bg}cc`, pointerEvents: "none",
            fontFamily: FONT_PRIMARY,
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
              {status === "error" ? "CAD failed to load" : "Loading CAD kernel…"}
            </div>
            <div style={{ marginTop: 6, fontSize: 11, color: C.textDim, fontFamily: FONT_MONO }}>
              {status === "error" ? errMsg : "OpenCascade WASM"}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
