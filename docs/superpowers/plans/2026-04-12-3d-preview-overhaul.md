# 3D Preview Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Overhaul the 3D keyboard preview with accurate keycap/switch geometry, interactive key press, LED lighting system, improved case with slope, full camera controls with gizmo, and CSS/layout fixes.

**Architecture:** ThreePreview.jsx becomes the core 3D engine with raycasting for click interaction, per-key animation state, and a per-key LED point light array driven by preset animations. New ViewGizmo component renders an SVG orientation widget overlaid on the canvas. Camera state is lifted to a ref shared between ThreePreview and ViewGizmo. A new `lightPresets.js` module defines the color/timing data for 10+ LED animation patterns. App.jsx gains new state: `slope` (number 0-15), `ledMode` (string), `ledFacing` ("north"|"south"), wired to new bottom-panel controls.

**Tech Stack:** React 18, Three.js (BufferGeometry, Raycaster, PointLight), Vite

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `index.html` | Add CSS reset (margin/padding/box-sizing) |
| Modify | `src/constants.js` | Add `SWITCH_DIMS`, `LED_PRESETS_LIST` name array |
| Create | `src/lightPresets.js` | 10+ LED animation functions (rainbow, breathe, wave, reactive, etc.) |
| Modify | `src/components/ThreePreview.jsx` | Major rewrite: ISO enter fix, keycap Z, switch detail, case+slope, raycasting key press, per-key LEDs, MMB pan, reset view |
| Create | `src/components/ViewGizmo.jsx` | SVG orientation widget (Top/Front/Right/etc clickable faces) |
| Modify | `src/components/App.jsx` | New state (slope, ledMode, ledFacing), new UI controls, CSS reset style tag, reset-view button |
| Modify | `src/components/ui.jsx` | Add `Slider` component for slope control |

---

### Task 1: CSS Reset + 3D View Fullscreen

**Files:**
- Modify: `index.html`
- Modify: `src/components/App.jsx:87-93`

The white border is browser default `margin: 8px` on `<body>`. Fix by adding a reset to `index.html` and ensuring the 3D view stretches to fill remaining flex space.

- [ ] **Step 1: Add CSS reset to index.html**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>nanun.me - Keyboard Studio</title>
    <style>
      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
      html, body, #root { width: 100%; height: 100%; overflow: hidden; }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/index.jsx"></script>
  </body>
</html>
```

- [ ] **Step 2: Remove duplicate box-sizing from App.jsx inline style tag**

In App.jsx line 93, the `<style>` tag already sets `*{box-sizing:border-box}`. Remove that one rule since index.html now handles it. Keep the scrollbar/selection/animation styles.

- [ ] **Step 3: Set the root div to use 100vh and overflow hidden**

In App.jsx line 88, change `minHeight: "100vh"` to `height: "100vh"` and add `overflow: "hidden"` so the app doesn't scroll, and the flex layout fills exactly the viewport.

- [ ] **Step 4: Build and verify**

Run: `npx vite build`
Expected: Build succeeds, no white border, 3D view fills between toolbar and bottom panel.

---

### Task 2: Fix ISO Enter Keycap Shape

**Files:**
- Modify: `src/components/ThreePreview.jsx:351-377`

The current ISO Enter is a flat-extruded L-shape (constant cross-section). It should be tapered like other keycaps — wider base, narrower top. Build the ISO Enter as two joined frustums (top row section + bottom row section) using BufferGeometry, or use the same "extrude + modify top vertices" approach but with an L-shaped base.

- [ ] **Step 1: Replace ISO Enter keycap geometry**

Replace the ISO Enter block (currently lines 351-377) with a tapered L-shape. The approach: create the L-shaped base as a `THREE.Shape`, extrude it to `profile.height`, then scale the top-face vertices inward by the profile's inset values — same technique as `createKeycapGeo` but applied to an ExtrudeGeometry.

```js
if (isISO) {
  // L-shaped base outline (bottom of keycap)
  const bShape = new THREE.Shape();
  const topW = 1.5 * UNIT - KEY_GAP, botW = 1.25 * UNIT - KEY_GAP;
  const rowH = UNIT - KEY_GAP / 2;
  const ofsX = -0.25 * UNIT + KEY_GAP / 2;
  bShape.moveTo(ofsX, 0);
  bShape.lineTo(ofsX + topW, 0);
  bShape.lineTo(ofsX + topW, rowH * 2);
  bShape.lineTo(ofsX + topW - botW, rowH * 2);
  bShape.lineTo(ofsX + topW - botW, rowH);
  bShape.lineTo(ofsX, rowH);
  bShape.closePath();

  const capGeo = new THREE.ExtrudeGeometry(bShape, {
    depth: profile.height,
    bevelEnabled: true,
    bevelSize: 0.5,
    bevelThickness: 0.5,
    bevelSegments: 2,
  });
  // Rotate so extrude goes along Y (up)
  capGeo.rotateX(-Math.PI / 2);
  capGeo.translate(0, profile.height, 0);

  // Taper: scale all top vertices inward
  const pos = capGeo.attributes.position;
  const inX = profile.insetX, inY = profile.insetY;
  // Find Y extent to identify top vs bottom
  let maxY = -Infinity, minY = Infinity;
  for (let i = 0; i < pos.count; i++) {
    maxY = Math.max(maxY, pos.getY(i));
    minY = Math.min(minY, pos.getY(i));
  }
  const midY = (maxY + minY) / 2;
  // Find X and Z extents for proper scaling
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    if (pos.getY(i) > midY) {
      minX = Math.min(minX, pos.getX(i));
      maxX = Math.max(maxX, pos.getX(i));
      minZ = Math.min(minZ, pos.getZ(i));
      maxZ = Math.max(maxZ, pos.getZ(i));
    }
  }
  const rangeX = maxX - minX, rangeZ = maxZ - minZ;
  const centerX = (maxX + minX) / 2, centerZ = (maxZ + minZ) / 2;
  if (rangeX > 0 && rangeZ > 0) {
    const scaleX = (rangeX - inX * 2) / rangeX;
    const scaleZ = (rangeZ - inY * 2) / rangeZ;
    for (let i = 0; i < pos.count; i++) {
      if (pos.getY(i) > midY) {
        pos.setX(i, centerX + (pos.getX(i) - centerX) * scaleX);
        pos.setZ(i, centerZ + (pos.getZ(i) - centerZ) * scaleZ);
      }
    }
  }
  pos.needsUpdate = true;
  capGeo.computeVertexNormals();

  const cap = new THREE.Mesh(capGeo, isA ? capAcct : capBase);
  cap.position.set(kpx, pt + KEYCAP_OFFSET, pz);
  cap.castShadow = true;
  add(cap);
}
```

- [ ] **Step 2: Build and verify**

Run: `npx vite build`
Expected: ISO Enter keycap now has tapered sides matching other keycaps.

---

### Task 3: Fix Keycap Z Positioning

**Files:**
- Modify: `src/components/ThreePreview.jsx`

Keycaps are sitting too low — their bottom currently rests at the plate top surface. Real keycaps sit on the switch stem, which places the keycap bottom approximately 2.8mm above the plate (Cherry profile measurement: from-plate height 10.8mm minus keycap height 8.0mm = 2.8mm offset). Define a `KEYCAP_OFFSET` constant and apply it.

- [ ] **Step 1: Add keycap offset constant and apply to all keycap positions**

At the top of ThreePreview.jsx (after imports), add:

```js
// Distance from plate top surface to keycap bottom (switch stem height)
const KEYCAP_OFFSET = 2.8;
```

Then update the regular keycap position (around line 382):
```js
// Old: cap.position.set(kpx, pt + profile.height / 2, pz);
cap.position.set(kpx, pt + KEYCAP_OFFSET + profile.height / 2, pz);
```

Update the dish position (around line 391):
```js
// Old: dish.position.set(kpx, pt + profile.height + 0.08, pz);
dish.position.set(kpx, pt + KEYCAP_OFFSET + profile.height + 0.08, pz);
```

Update the ISO Enter position similarly:
```js
cap.position.set(kpx, pt + KEYCAP_OFFSET, pz);
```

- [ ] **Step 2: Build and verify**

Run: `npx vite build`
Expected: Keycaps float visibly above the plate at a realistic height.

---

### Task 4: Camera Controls — MMB Pan, Scroll Zoom, Reset Button

**Files:**
- Modify: `src/components/ThreePreview.jsx:157-191` (orbit controls section)
- Modify: `src/components/App.jsx` (add reset-view button, pass callback)

Currently only left-click orbits and scroll zooms. Add: middle-mouse-button drag to pan, expose a `resetView` callback via a ref.

- [ ] **Step 1: Add MMB pan and expose reset ref**

Change the ThreePreview component signature to accept an `onReady` prop:

```js
export default function ThreePreview({ keys, plateSettings, opts3d, onReady }) {
```

In the orbit controls section, track which button is pressed. Replace the drag handler with button-aware logic:

```js
let dragBtn = -1, px = 0, py = 0;
const cv = ren.domElement;

const oD = (e) => {
  if (e.touches) { dragBtn = 0; const p = e.touches[0]; px = p.clientX; py = p.clientY; return; }
  dragBtn = e.button; // 0=left(orbit), 1=middle(pan), 2=right(unused)
  px = e.clientX; py = e.clientY;
  if (e.button === 1) e.preventDefault(); // prevent autoscroll
};

const oM = (e) => {
  if (dragBtn < 0) return;
  const p = e.touches ? e.touches[0] : e;
  const dx = p.clientX - px, dy = p.clientY - py;
  px = p.clientX; py = p.clientY;

  if (dragBtn === 0) {
    // Left click: orbit
    st.current.theta -= dx * 0.007;
    st.current.phi = Math.max(0.15, Math.min(1.5, st.current.phi - dy * 0.007));
  } else if (dragBtn === 1) {
    // Middle click: pan
    const panSpeed = st.current.radius * 0.003;
    const right = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    cam.getWorldDirection(right);
    right.cross(up).normalize();
    st.current.centerX -= right.x * dx * panSpeed;
    st.current.centerZ -= right.z * dx * panSpeed;
    st.current.centerX += up.x * dy * panSpeed; // negligible
    st.current.centerZ += up.z * dy * panSpeed; // negligible
    // also handle vertical pan via a centerY
  }
};

const oU = () => { dragBtn = -1; };
```

Also add `contextmenu` prevention so right-click doesn't open a menu:

```js
cv.addEventListener("contextmenu", (e) => e.preventDefault());
```

- [ ] **Step 2: Expose resetView function via onReady callback**

After `st.current` is initialized, define a resetView function and call onReady:

```js
const resetView = () => {
  st.current.theta = Math.PI / 4;
  st.current.phi = Math.PI / 3.5;
  // radius and center will be recalculated on next key rebuild
};
if (onReady) onReady({ resetView });
```

- [ ] **Step 3: Add reset button in App.jsx**

Add a ref to store the 3D controls, and a reset button in the toolbar (visible when view === "3d"):

```jsx
const previewRef = useRef(null);

// In the toolbar, after "KLE Import" button:
{view === "3d" && (
  <BtnSmall onClick={() => previewRef.current?.resetView()}>Reset View</BtnSmall>
)}

// On ThreePreview:
<ThreePreview keys={keys} plateSettings={plateSettings} opts3d={opts3d}
  onReady={(ctrl) => { previewRef.current = ctrl; }} />
```

- [ ] **Step 4: Build and verify**

Run: `npx vite build`
Expected: MMB drag pans, reset button snaps camera back to default angle.

---

### Task 5: View Gizmo (Blender-style Orientation Widget)

**Files:**
- Create: `src/components/ViewGizmo.jsx`
- Modify: `src/components/ThreePreview.jsx` (pass camera state out)
- Modify: `src/components/App.jsx` (render ViewGizmo overlaid on canvas)

An SVG-based orientation widget in the top-right corner of the 3D viewport. Shows colored axis lines and labeled clickable faces (Top, Front, Right, etc.). Clicking a face snaps the camera to that orthographic view angle.

- [ ] **Step 1: Create ViewGizmo component**

Create `src/components/ViewGizmo.jsx`:

The gizmo renders a small SVG (80x80px) showing a 3D axis indicator that rotates to match the current camera orientation. Each axis has a circle at its tip — clicking it snaps the camera. The gizmo receives `theta`, `phi`, and an `onSnap(theta, phi)` callback.

Snap presets:
- **Top**: phi=0.01, theta=0
- **Front**: phi=PI/2, theta=0
- **Right**: phi=PI/2, theta=-PI/2
- **Back**: phi=PI/2, theta=PI
- **Left**: phi=PI/2, theta=PI/2
- **Bottom**: phi=PI-0.01, theta=0

The SVG projects the 3 axis unit vectors using the current theta/phi, draws lines from center, and draws clickable circles at the endpoints with labels (X=red, Y=green, Z=blue).

- [ ] **Step 2: Wire gizmo into App.jsx**

Add camera angle state to App.jsx that ThreePreview reports on each frame:

```jsx
const [camAngles, setCamAngles] = useState({ theta: Math.PI/4, phi: Math.PI/3.5 });

// Pass to ThreePreview
<ThreePreview ... onCameraMove={setCamAngles} />

// Overlay gizmo on canvas
<div style={{ position: "absolute", top: 8, right: 8 }}>
  <ViewGizmo theta={camAngles.theta} phi={camAngles.phi}
    onSnap={(t, p) => previewRef.current?.snapCamera(t, p)} />
</div>
```

- [ ] **Step 3: Add onCameraMove and snapCamera to ThreePreview**

In the animation loop, report angles back:
```js
if (onCameraMove) onCameraMove({ theta: st.current.theta, phi: st.current.phi });
```

Add `snapCamera` to the controls exposed via `onReady`:
```js
const snapCamera = (theta, phi) => {
  st.current.theta = theta;
  st.current.phi = phi;
};
if (onReady) onReady({ resetView, snapCamera });
```

- [ ] **Step 4: Build and verify**

Run: `npx vite build`
Expected: Orientation gizmo appears in the top-right of the 3D view, rotates with camera, clicks snap to preset views.

---

### Task 6: Detailed MX Switch Housing

**Files:**
- Modify: `src/components/ThreePreview.jsx:316-345` (switch rendering section)
- Modify: `src/constants.js` (add SWITCH_DIMS)

Replace the simple box switch with a more detailed model: two-part housing (top clear/dark, bottom black), center post with stem, side clip tabs, and LED cutout placeholder.

- [ ] **Step 1: Add SWITCH_DIMS to constants.js**

```js
export const SWITCH_DIMS = {
  bodyW: 14, bodyD: 14,
  clipW: 15.6,          // width at clip tabs
  belowPlate: 5,        // mm below plate
  abovePlate: 6.6,      // mm above plate
  stemCrossW: 1.17,     // stem cross bar width
  stemCrossL: 4.0,      // stem cross bar length
  stemProtrusion: 3.6,  // mm stem extends above housing
  stemCylRadius: 2.75,  // stem cylinder radius
};
```

- [ ] **Step 2: Replace switch rendering with detailed model**

New switch model per key:

```js
if (opts3d.switches) {
  const S = SWITCH_DIMS;
  // Bottom housing (black)
  const bottomG = new THREE.BoxGeometry(S.bodyW, S.belowPlate, S.bodyD);
  const bottom = new THREE.Mesh(bottomG, swHousing);
  bottom.position.set(kpx, -S.belowPlate / 2, pz);
  add(bottom);

  // Top housing (slightly translucent look)
  const topH = S.abovePlate;
  const topG = new THREE.BoxGeometry(S.bodyW, topH, S.bodyD);
  const top = new THREE.Mesh(topG, swHousingTop);
  top.position.set(kpx, pt + topH / 2, pz);
  add(top);

  // Clip tabs (wider bumps on sides)
  const clipG = new THREE.BoxGeometry(S.clipW, 1.5, 2);
  const clipMat = swHousing;
  const clip1 = new THREE.Mesh(clipG, clipMat);
  clip1.position.set(kpx, pt - 0.75, pz - S.bodyD / 2 + 1);
  add(clip1);
  const clip2 = new THREE.Mesh(clipG, clipMat);
  clip2.position.set(kpx, pt - 0.75, pz + S.bodyD / 2 - 1);
  add(clip2);

  // Stem cylinder (center post)
  const cylG = new THREE.CylinderGeometry(S.stemCylRadius, S.stemCylRadius, 2, 16);
  const cyl = new THREE.Mesh(cylG, swHousingTop);
  cyl.position.set(kpx, pt + topH + 1, pz);
  add(cyl);

  // Stem cross
  const stemY = pt + topH + 2 + S.stemProtrusion / 2;
  const svG = new THREE.BoxGeometry(S.stemCrossW, S.stemProtrusion, S.stemCrossL);
  const shG = new THREE.BoxGeometry(S.stemCrossL, S.stemProtrusion, S.stemCrossW);
  const sv = new THREE.Mesh(svG, swStem);
  sv.position.set(kpx, stemY, pz);
  add(sv);
  const sh = new THREE.Mesh(shG, swStem);
  sh.position.set(kpx, stemY, pz);
  add(sh);
}
```

- [ ] **Step 3: Build and verify**

Run: `npx vite build`
Expected: Switch now has visible clip tabs, two-tone housing, stem post.

---

### Task 7: Case Improvements + Slope Slider

**Files:**
- Modify: `src/components/ThreePreview.jsx:258-286` (case section)
- Modify: `src/components/App.jsx:17,329-348` (state + UI)
- Modify: `src/components/ui.jsx` (add Slider component)

The current case is two overlapping boxes. Replace with an extruded shape that has proper walls, a bottom plate, and rounded edges. Add a `slope` parameter (0-15 degrees) that tilts the entire keyboard assembly by rotating it around the front edge.

- [ ] **Step 1: Add Slider component to ui.jsx**

```jsx
export const Slider = ({ label, value, min, max, step, onChange }) => (
  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: C.textMuted, fontWeight: 500 }}>
    <span>{label}</span>
    <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))}
      style={{ width: 60, accentColor: C.accent }} />
    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9, minWidth: 20 }}>{value}°</span>
  </label>
);
```

- [ ] **Step 2: Add slope state to App.jsx**

Add to opts3d initial state:
```js
const [opts3d, setOpts3d] = useState({ switches: false, capProfile: "cherry", caseStyle: "none", slope: 6 });
```

Add slope slider in the 3D Display section:
```jsx
<Slider label="Slope" value={opts3d.slope} min={0} max={15} step={1}
  onChange={(v) => setOpts3d((o) => ({ ...o, slope: v }))} />
```

- [ ] **Step 3: Apply slope rotation to the entire keyboard group in ThreePreview**

Instead of adding meshes directly to the scene, add them to a `THREE.Group`, then rotate the group:

```js
const kbGroup = new THREE.Group();
const add = (m) => { kbGroup.add(m); st.current.meshes.push(m); };

// ... all plate/case/switch/keycap geometry added to kbGroup ...

// Apply slope — rotate around front edge (max Z = closest to viewer)
const frontZ = -minKY * UNIT;
kbGroup.position.z = -frontZ;
kbGroup.rotation.x = -(opts3d.slope || 0) * Math.PI / 180;
kbGroup.position.z += frontZ;

scene.add(kbGroup);
st.current.meshes.push(kbGroup); // so it gets cleaned up
```

- [ ] **Step 4: Build improved case geometry**

Replace the two-box case with a proper extruded shape:

```js
if (opts3d.caseStyle !== "none") {
  const bds = getBounds(keys, plateSettings.margin);
  const cw = bds.maxX - bds.minX, ch = bds.maxY - bds.minY;
  const cx = (bds.minX + bds.maxX) / 2, cy = (bds.minY + bds.maxY) / 2;
  const wall = 2.5;
  const botThick = 2;
  const capH = showCaps ? profile.height + KEYCAP_OFFSET : 0;
  const caseH = opts3d.caseStyle === "high" ? pt + capH + 4
    : opts3d.caseStyle === "low" ? pt + 3
    : pt + capH + 2; // tray

  const caseR = 2; // corner radius

  // Outer shell shape
  const outerShape = new THREE.Shape();
  outerShape.moveTo(-cw/2 - wall + caseR, -ch/2 - wall);
  outerShape.lineTo(cw/2 + wall - caseR, -ch/2 - wall);
  outerShape.quadraticCurveTo(cw/2 + wall, -ch/2 - wall, cw/2 + wall, -ch/2 - wall + caseR);
  outerShape.lineTo(cw/2 + wall, ch/2 + wall - caseR);
  outerShape.quadraticCurveTo(cw/2 + wall, ch/2 + wall, cw/2 + wall - caseR, ch/2 + wall);
  outerShape.lineTo(-cw/2 - wall + caseR, ch/2 + wall);
  outerShape.quadraticCurveTo(-cw/2 - wall, ch/2 + wall, -cw/2 - wall, ch/2 + wall - caseR);
  outerShape.lineTo(-cw/2 - wall, -ch/2 - wall + caseR);
  outerShape.quadraticCurveTo(-cw/2 - wall, -ch/2 - wall, -cw/2 - wall + caseR, -ch/2 - wall);

  // Inner cutout (hollow)
  const innerHole = new THREE.Path();
  innerHole.moveTo(-cw/2 + 0.5, -ch/2 + 0.5);
  innerHole.lineTo(cw/2 - 0.5, -ch/2 + 0.5);
  innerHole.lineTo(cw/2 - 0.5, ch/2 - 0.5);
  innerHole.lineTo(-cw/2 + 0.5, ch/2 - 0.5);
  innerHole.lineTo(-cw/2 + 0.5, -ch/2 + 0.5);
  outerShape.holes.push(innerHole);

  const caseGeo = new THREE.ExtrudeGeometry(outerShape, {
    depth: caseH, bevelEnabled: true, bevelSize: 0.8, bevelThickness: 0.8, bevelSegments: 3
  });
  caseGeo.rotateX(-Math.PI / 2);
  const caseMesh = new THREE.Mesh(caseGeo,
    new THREE.MeshStandardMaterial({ color: 0x222225, metalness: 0.5, roughness: 0.35 }));
  caseMesh.position.set(cx, -botThick, -cy);
  caseMesh.castShadow = true; caseMesh.receiveShadow = true;
  add(caseMesh);

  // Bottom plate (solid floor)
  const floorG = new THREE.BoxGeometry(cw + wall * 2 - 1, botThick, ch + wall * 2 - 1);
  const floor = new THREE.Mesh(floorG,
    new THREE.MeshStandardMaterial({ color: 0x1a1a1e, metalness: 0.4, roughness: 0.5 }));
  floor.position.set(cx, -botThick / 2, -cy);
  add(floor);
}
```

- [ ] **Step 5: Build and verify**

Run: `npx vite build`
Expected: Case has rounded edges, visible wall thickness, bottom plate. Slope slider tilts entire keyboard.

---

### Task 8: Key Press Animation (Click-to-Press)

**Files:**
- Modify: `src/components/ThreePreview.jsx`

Add raycasting so that clicking a keycap in the 3D view depresses it (moves down ~4mm, the key travel distance). Hold to keep pressed, release to spring back. Animate the transition smoothly.

- [ ] **Step 1: Add raycaster and pressed-key tracking**

In the scene-setup useEffect, after creating the renderer:

```js
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
st.current.raycaster = raycaster;
st.current.pressedKeys = new Map(); // keyId -> { targetY, originalY, meshes[] }
```

Store references to keycap meshes by key ID during the rebuild:

```js
// In the keycap creation, after creating cap mesh:
if (!st.current.keyMeshMap) st.current.keyMeshMap = new Map();
const keyMeshes = [cap];
if (dish) keyMeshes.push(dish);
st.current.keyMeshMap.set(k.id, { meshes: keyMeshes, originalY: cap.position.y });
cap.userData.keyId = k.id;
```

- [ ] **Step 2: Add mousedown/mouseup handlers for key press**

```js
const onKeyDown3D = (e) => {
  if (e.button !== 0 || dragBtn >= 0) return; // only left click, not during drag
  const rect = cv.getBoundingClientRect();
  mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse, cam);
  const hits = raycaster.intersectObjects(scene.children, true);
  for (const hit of hits) {
    const keyId = hit.object.userData.keyId;
    if (keyId !== undefined) {
      const entry = st.current.keyMeshMap.get(keyId);
      if (entry) {
        st.current.pressedKeys.set(keyId, entry);
      }
      break;
    }
  }
};

const onKeyUp3D = () => {
  st.current.pressedKeys.clear();
};

cv.addEventListener("mousedown", onKeyDown3D);
cv.addEventListener("mouseup", onKeyUp3D);
cv.addEventListener("mouseleave", onKeyUp3D);
```

- [ ] **Step 3: Animate pressed keys in the render loop**

In the animation loop, after camera update:

```js
const TRAVEL = 4; // mm key travel
const SPEED = 0.25; // lerp speed
const { pressedKeys, keyMeshMap } = st.current;
if (keyMeshMap) {
  keyMeshMap.forEach((entry, keyId) => {
    const isPressed = pressedKeys.has(keyId);
    const targetY = isPressed ? entry.originalY - TRAVEL : entry.originalY;
    entry.meshes.forEach((m) => {
      m.position.y += (targetY - m.position.y) * SPEED;
    });
  });
}
```

- [ ] **Step 4: Prevent orbit when clicking a keycap**

Modify the mousedown handler to check if a keycap was hit BEFORE starting an orbit drag. If a keycap was clicked, don't set `dragBtn`:

```js
const oD = (e) => {
  // ... existing logic
  // Check for keycap hit first
  if (e.button === 0 && !e.touches) {
    const rect = cv.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, cam);
    const hits = raycaster.intersectObjects(scene.children, true);
    if (hits.some(h => h.object.userData.keyId !== undefined)) {
      onKeyDown3D(e);
      return; // don't start orbit
    }
  }
  dragBtn = e.button;
  // ...
};
```

- [ ] **Step 5: Build and verify**

Run: `npx vite build`
Expected: Clicking a keycap in 3D view depresses it smoothly. Releasing springs it back. Dragging empty space still orbits.

---

### Task 9: Per-Key LED Lights (North/South Facing)

**Files:**
- Modify: `src/components/ThreePreview.jsx`
- Modify: `src/components/App.jsx:17,329-348`
- Modify: `src/constants.js`

Add a small LED point light per key, positioned either north (behind the switch, toward top of keyboard) or south (in front, toward bottom). The LED position relative to the switch center is ±4.7mm in the Z axis. Add controls in App.jsx for LED on/off and north/south facing.

- [ ] **Step 1: Add LED state to App.jsx**

Extend opts3d:
```js
const [opts3d, setOpts3d] = useState({
  switches: false, capProfile: "cherry", caseStyle: "none", slope: 6,
  ledEnabled: false, ledFacing: "south", ledMode: "static",
});
```

Add LED controls in the 3D Display section:
```jsx
<Toggle label="LEDs" checked={opts3d.ledEnabled} onChange={() => setOpts3d(p => ({...p, ledEnabled: !p.ledEnabled}))} />
{opts3d.ledEnabled && (
  <>
    <div style={{display:"flex",gap:3,alignItems:"center"}}>
      <span style={{fontSize:9,color:C.textDim,fontWeight:600}}>FACING</span>
      <Chip label="N" active={opts3d.ledFacing==="north"} onClick={() => setOpts3d(o => ({...o, ledFacing:"north"}))} />
      <Chip label="S" active={opts3d.ledFacing==="south"} onClick={() => setOpts3d(o => ({...o, ledFacing:"south"}))} />
    </div>
  </>
)}
```

- [ ] **Step 2: Add per-key LED point lights in ThreePreview**

During the key rendering loop, after the keycap:

```js
if (opts3d.ledEnabled) {
  const ledOffsetZ = opts3d.ledFacing === "north" ? 4.7 : -4.7;
  const ledLight = new THREE.PointLight(0xffffff, 0.8, 25);
  ledLight.position.set(kpx, pt + 1, pz + ledOffsetZ);
  ledLight.userData.keyId = k.id;
  ledLight.userData.isLed = true;
  add(ledLight);

  // Small visible LED sphere
  const ledGeo = new THREE.SphereGeometry(0.8, 8, 8);
  const ledMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const ledMesh = new THREE.Mesh(ledGeo, ledMat);
  ledMesh.position.copy(ledLight.position);
  ledMesh.userData.isLed = true;
  ledMesh.userData.keyId = k.id;
  add(ledMesh);
}
```

Store LED references in `st.current.leds` for animation:

```js
if (!st.current.leds) st.current.leds = [];
st.current.leds.push({ light: ledLight, mesh: ledMesh, keyId: k.id, keyIndex: i });
```

- [ ] **Step 3: Build and verify**

Run: `npx vite build`
Expected: Toggling LEDs shows small glowing spheres under/around each keycap, illuminating from north or south side.

---

### Task 10: LED Light Show Presets

**Files:**
- Create: `src/lightPresets.js`
- Modify: `src/components/ThreePreview.jsx` (animation loop)
- Modify: `src/components/App.jsx` (preset selector)

Define 10+ LED animation presets. Each preset is a function `(time, keyIndex, totalKeys, keyX, keyY) => { r, g, b }` returning an RGB color (0-1 range). The ThreePreview animation loop calls the active preset each frame and updates per-key LED colors.

- [ ] **Step 1: Create lightPresets.js**

```js
// Each preset: (t, i, total, kx, ky) => [r, g, b]  (0-1 range)
// t = elapsed seconds, i = key index, total = key count, kx/ky = key grid position

function hsl2rgb(h, s, l) {
  h = ((h % 1) + 1) % 1;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => { const k = (n + h * 12) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
  return [f(0), f(8), f(4)];
}

export const LED_PRESETS = {
  static:    { label: "Static White",   fn: () => [1, 1, 1] },
  warm:      { label: "Warm White",     fn: () => [1, 0.85, 0.65] },
  red:       { label: "Static Red",     fn: () => [1, 0.1, 0.05] },
  cyan:      { label: "Static Cyan",    fn: () => [0, 0.9, 1] },
  breathe:   { label: "Breathe",        fn: (t) => { const v = (Math.sin(t * 2) + 1) / 2; return [v, v, v]; } },
  rainbow:   { label: "Rainbow Wave",   fn: (t, i, n) => hsl2rgb(t * 0.1 + i / n, 1, 0.5) },
  ripple:    { label: "Ripple",         fn: (t, i, n, kx, ky) => { const d = Math.sqrt(kx*kx+ky*ky); const v = (Math.sin(t*4 - d*0.8)+1)/2; return hsl2rgb(0.55, 1, v*0.5); } },
  rain:      { label: "Rain",           fn: (t, i) => { const v = (Math.sin(t * 6 + i * 7.3) + 1) / 2; return [v * 0.2, v * 0.5, v]; } },
  fire:      { label: "Fire",           fn: (t, i) => { const v = (Math.sin(t*3+i*2.1)+1)/2; return [1, v*0.6, v*0.1]; } },
  aurora:    { label: "Aurora",         fn: (t, i, n) => hsl2rgb(0.45 + Math.sin(t*0.5+i/n*3)*0.15, 0.8, 0.3+Math.sin(t*2+i)*0.2) },
  gradient:  { label: "Gradient",       fn: (t, i, n, kx, ky, maxX) => hsl2rgb(kx / (maxX || 15), 1, 0.5) },
  reactive:  { label: "Reactive",       fn: () => [0.05, 0.05, 0.05] }, // base dim, brightens on press
};

export const LED_PRESET_NAMES = Object.keys(LED_PRESETS);
```

- [ ] **Step 2: Add preset selector in App.jsx**

```jsx
{opts3d.ledEnabled && (
  <div style={{display:"flex",gap:3,alignItems:"center",flexWrap:"wrap"}}>
    <span style={{fontSize:9,color:C.textDim,fontWeight:600}}>MODE</span>
    {LED_PRESET_NAMES.map(name => (
      <Chip key={name} label={LED_PRESETS[name].label} active={opts3d.ledMode===name}
        onClick={() => setOpts3d(o => ({...o, ledMode: name}))} />
    ))}
  </div>
)}
```

Import at top of App.jsx:
```js
import { LED_PRESETS, LED_PRESET_NAMES } from "../lightPresets";
```

- [ ] **Step 3: Animate LEDs in ThreePreview render loop**

In the animation loop, after camera update and key press animation:

```js
// LED animation
const { leds } = st.current;
if (leds && leds.length > 0 && opts3d.ledEnabled) {
  const preset = LED_PRESETS[opts3d.ledMode] || LED_PRESETS.static;
  const elapsed = performance.now() / 1000;
  const maxX = Math.max(...keys.map(k => k.x + k.w));
  leds.forEach(({ light, mesh, keyId, keyIndex }) => {
    const k = keys.find(k => k.id === keyId);
    const kx = k ? k.x : 0, ky = k ? k.y : 0;
    let [r, g, b] = preset.fn(elapsed, keyIndex, leds.length, kx, ky, maxX);

    // Reactive boost: if key is pressed, brighten
    if (opts3d.ledMode === "reactive" && st.current.pressedKeys?.has(keyId)) {
      r = 1; g = 1; b = 1;
    }

    light.color.setRGB(r, g, b);
    light.intensity = Math.max(r, g, b) * 1.2;
    if (mesh.material) {
      mesh.material.color.setRGB(r, g, b);
      mesh.material.emissive?.setRGB(r * 0.5, g * 0.5, b * 0.5);
    }
  });
}
```

Note: `opts3d` in the render loop closure needs to be kept up-to-date. Store it in `st.current.opts3d = opts3d` in the rebuild useEffect, and read from `st.current.opts3d` in the loop.

- [ ] **Step 4: Build and verify**

Run: `npx vite build`
Expected: LED preset selector shows in bottom panel. Switching presets changes the per-key lighting pattern. Rainbow animates smoothly.

---

## Execution Notes

- **Tasks 1-3** are quick fixes (CSS, geometry, positioning) — do them first.
- **Task 4-5** (camera controls + gizmo) are independent of Tasks 6-10.
- **Tasks 6-7** (switch detail + case) are geometry-only, no new systems.
- **Tasks 8-10** (key press + LED) build on each other — do in order.
- ThreePreview.jsx touches nearly every task. Tasks should be applied sequentially to avoid merge conflicts.
- The `opts3d` state object grows across tasks (slope, ledEnabled, ledFacing, ledMode). Each task adds its fields.
- The animation loop (`loop()`) in the scene-setup useEffect runs the whole time. State that changes per-frame (pressed keys, LED colors) is read from `st.current`, not from React state (avoids re-renders).
