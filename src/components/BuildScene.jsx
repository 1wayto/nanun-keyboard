import { useEffect, useRef } from "react";
import * as THREE from "three";
import { C } from "../constants";
import { buildAllLayers, LAYER_DEFS } from "../build/layers";

// BuildScene renders the 5 stacked printable layers in a Three.js scene.
// Imperative refs keep the renderer/camera/scene alive across React renders;
// `keys` and `buildOpts` drive a mesh rebuild without tearing down the scene.
export default function BuildScene({ keys, buildOpts }) {
  const mountRef = useRef(null);
  const st = useRef({});

  // Scene init — runs once on mount.
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(C.scene3d);

    const camera = new THREE.PerspectiveCamera(35, 1, 1, 4000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";

    const ambient = new THREE.AmbientLight(0xffffff, 0.55);
    const key = new THREE.DirectionalLight(0xffffff, 0.9);
    key.position.set(150, 300, 200);
    const fill = new THREE.DirectionalLight(0xffffff, 0.35);
    fill.position.set(-200, 150, -100);
    scene.add(ambient, key, fill);

    const layerGroup = new THREE.Group();
    scene.add(layerGroup);

    const orbit = { theta: Math.PI / 4, phi: Math.PI / 3.2, radius: 360, target: new THREE.Vector3(0, 10, 0) };
    function applyCamera() {
      const { theta, phi, radius, target } = orbit;
      camera.position.set(
        target.x + radius * Math.sin(phi) * Math.cos(theta),
        target.y + radius * Math.cos(phi),
        target.z + radius * Math.sin(phi) * Math.sin(theta),
      );
      camera.lookAt(target);
    }

    // Mouse orbit
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
      orbit.radius = Math.max(80, Math.min(2000, orbit.radius * (1 + e.deltaY * 0.001)));
      applyCamera();
    };
    renderer.domElement.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    renderer.domElement.addEventListener("wheel", onWheel, { passive: false });

    function resize() {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    const ro = new ResizeObserver(resize);
    ro.observe(mount);
    resize();

    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      renderer.render(scene, camera);
    };
    tick();

    st.current = { scene, camera, renderer, layerGroup, orbit, applyCamera };
    applyCamera();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.domElement.removeEventListener("mousedown", onDown);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      renderer.domElement.removeEventListener("wheel", onWheel);
      mount.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, []);

  // Rebuild layers when keys, bed width, or other geometry-affecting opts change.
  useEffect(() => {
    const s = st.current;
    if (!s.layerGroup) return;
    while (s.layerGroup.children.length) {
      const m = s.layerGroup.children.pop();
      m.traverse?.((c) => {
        c.geometry?.dispose?.();
        c.material?.dispose?.();
      });
      m.geometry?.dispose?.();
      m.material?.dispose?.();
    }
    const { layers, footprint } = buildAllLayers(keys, { bedWidth: buildOpts.bedWidth });
    layers.forEach((mesh) => s.layerGroup.add(mesh));
    s.layers = layers;
    const r = Math.max(footprint.w, footprint.h, 80) * 1.8;
    s.orbit.radius = r;
    s.orbit.target.set(0, 8, 0);
    s.applyCamera();
  }, [keys, buildOpts.bedWidth]);

  // Apply visibility + exploded view on opt change. No geometry rebuild.
  useEffect(() => {
    const s = st.current;
    if (!s.layers) return;
    const explode = buildOpts.explode || 0;
    let yCursor = 0;
    s.layers.forEach((mesh, i) => {
      const def = LAYER_DEFS[i];
      const baseY = yCursor;
      yCursor += def.thickness;
      const offset = i * explode;
      mesh.position.y = baseY + offset;
      mesh.visible = buildOpts.visible[def.id] !== false;
    });
  }, [buildOpts]);

  return <div ref={mountRef} style={{ position: "absolute", inset: 0 }} />;
}
