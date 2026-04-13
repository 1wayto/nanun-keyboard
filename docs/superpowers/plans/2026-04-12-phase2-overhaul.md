# Phase 2: 3D Engine Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix critical bugs (3D orientation, ISO Enter position, DS variable order, slope), add row-sculpted keycap profiles with OEM, implement case-shape slope, LED brightness/speed controls, ISO/perspective camera toggle, and focus-frame reset view.

**Architecture:** CAP_PROFILES in constants.js gains per-row height/tilt arrays. `createKeycapGeo()` accepts a `rowHeight` + `tiltAngle` instead of using a single profile height. A new `getKeyRow()` utility maps key Y positions to rows R1-R4. The slope is implemented as a wedge-shaped case (higher back wall) instead of group rotation. ThreePreview gains an `isOrtho` state for ISO/perspective toggle. `resetView` becomes `focusView` which auto-frames based on keyboard bounding box.

**Tech Stack:** React 18, Three.js (PerspectiveCamera + OrthographicCamera), Vite

---

## File Map

| Action | File | Change |
|--------|------|--------|
| Modify | `src/constants.js` | Restructure CAP_PROFILES with per-row heights/tilts, add OEM profile |
| Modify | `src/utils.js` | Add `getKeyRow(keyY, layoutMinY)` function |
| Modify | `src/components/ThreePreview.jsx` | Fix DS variable order, fix ISO Enter position, row-sculpted keycaps, case-shape slope, ISO/perspective toggle, focus-frame reset, LED brightness/speed |
| Modify | `src/components/App.jsx` | Add LED brightness/speed sliders, ISO/perspective toggle button, OEM to CAP chips |
| Modify | `src/components/ViewGizmo.jsx` | No changes needed |
| Modify | `src/lightPresets.js` | Accept speed/brightness params |

---

### Task 1: Fix Critical Bugs (DS variable order, ISO Enter 3D position)

**Files:**
- Modify: `src/components/ThreePreview.jsx`

There are two bugs that can cause runtime errors or wrong rendering:

1. **DS variable used before defined:** `DS` (THREE.DoubleSide) is used in the case section (line 403) but defined on line 420 (after the plate section). Move the `const DS = THREE.DoubleSide;` to BEFORE the case section.

2. **ISO Enter 3D position offset:** The ISO Enter keycap center is at `kpx = (k.x + k.w/2) * UNIT` but the L-shape extends 0.25u to the LEFT of k.x. The visual center of the L-shape is NOT at kpx. The shape is built relative to kpx using `ofsX = -0.25 * UNIT + KEY_GAP/2`, so the shape geometry is correctly asymmetric — but this means the bounding box center is offset. The keycap mesh position should remain at kpx (the switch center, which is where the stem is). The shape built around kpx is correct. The actual bug is that `isISOEnter()` now requires `w >= 1.25` but the 3D L-shape code uses hardcoded `1.5 * UNIT` for the top width and `1.25 * UNIT` for the bottom width. This is correct for ISO Enter. If users see the Enter at the wrong position, it's because the layout DSL data has the Enter key starting at the wrong X. Verify the ISO Enter shape renders at the right position by checking `I60` preset: the Enter at row 1 should start at x=13.75 (after Tab:1.5 + 11 letter keys + 2 bracket keys + _:0.25 gap).

- [ ] **Step 1: Move DS definition before case section**

In ThreePreview.jsx, find `const DS = THREE.DoubleSide;` (currently after the plate section, around line 420). Move it to right after `const pt = plateSettings.thickness;` (line 361), so it's available for the case materials.

```js
    const pt = plateSettings.thickness;
    const DS = THREE.DoubleSide;
```

Remove the original `const DS = THREE.DoubleSide;` from line 420.

- [ ] **Step 2: Build and verify**

Run: `npx vite build`
Expected: Build succeeds. With case style enabled, no runtime error.

---

### Task 2: Restructure CAP_PROFILES with Per-Row Heights and Add OEM

**Files:**
- Modify: `src/constants.js`
- Modify: `src/utils.js`

Replace the single `height` field in CAP_PROFILES with a `rows` object containing per-row heights and tilt angles. Add OEM profile.

- [ ] **Step 1: Add getKeyRow utility**

In `src/utils.js`, add after the existing exports:

```js
/**
 * Determine which keycap row (R1-R4) a key belongs to based on its Y position.
 * R1 = top rows (Esc, F-keys, numbers), R2 = QWERTY, R3 = home, R4 = bottom + space.
 * For layouts with an F-key row (y=0, main starts y=1.5), F-keys get R1.
 * layoutMinY is the minimum Y across all keys in the layout.
 */
export function getKeyRow(keyY, layoutMinY) {
  const relY = keyY - layoutMinY;
  if (relY < 0.5) return 1;       // F-key row or first row
  if (relY < 1.5) return 1;       // Number row
  if (relY < 2.5) return 2;       // QWERTY row
  if (relY < 3.5) return 3;       // Home row
  return 4;                        // Bottom row + spacebar
}
```

- [ ] **Step 2: Restructure CAP_PROFILES in constants.js**

Replace the existing CAP_PROFILES with:

```js
export const CAP_PROFILES = {
  cherry: {
    label: "Cherry",
    dishType: "cylindrical",
    dishDepth: 0.5,
    insetX: 3.33,
    insetY: 3.83,
    rows: {
      1: { height: 9.4, tilt: -3 },    // Number row — tallest
      2: { height: 7.9, tilt: -1 },    // QWERTY
      3: { height: 6.6, tilt: 0 },     // Home — lowest
      4: { height: 7.1, tilt: 2 },     // Bottom
    },
  },
  sa: {
    label: "SA",
    dishType: "spherical",
    dishDepth: 1.0,
    insetX: 2.73,
    insetY: 2.73,
    rows: {
      1: { height: 14.5, tilt: -8 },
      2: { height: 13.0, tilt: -5 },
      3: { height: 11.7, tilt: 0 },
      4: { height: 12.3, tilt: 5 },
    },
  },
  dsa: {
    label: "DSA",
    dishType: "spherical",
    dishDepth: 0.75,
    insetX: 2.73,
    insetY: 2.73,
    rows: {
      1: { height: 7.6, tilt: 0 },
      2: { height: 7.6, tilt: 0 },
      3: { height: 7.6, tilt: 0 },
      4: { height: 7.6, tilt: 0 },
    },
  },
  oem: {
    label: "OEM",
    dishType: "cylindrical",
    dishDepth: 0.7,
    insetX: 3.33,
    insetY: 2.33,
    rows: {
      1: { height: 11.2, tilt: -4 },
      2: { height: 9.6, tilt: -1 },
      3: { height: 8.8, tilt: 0 },
      4: { height: 8.2, tilt: 4 },
    },
  },
};
```

- [ ] **Step 3: Build and verify**

Run: `npx vite build`
Expected: Build succeeds (ThreePreview will break until Task 3 updates it to use the new structure).

---

### Task 3: Update ThreePreview to Use Row-Sculpted Keycaps

**Files:**
- Modify: `src/components/ThreePreview.jsx`

Update `createKeycapGeo()` to accept a per-row height and tilt angle. In the keys.forEach loop, compute each key's row and look up the height/tilt from the profile.

- [ ] **Step 1: Update createKeycapGeo to accept height and tilt**

Change the function signature and body:

```js
function createKeycapGeo(wUnits, hUnits, profile, rowHeight, tiltDeg) {
  const baseW = wUnits * UNIT - KEY_GAP;
  const baseD = hUnits * UNIT - KEY_GAP;
  const topW = Math.max(baseW - profile.insetX * 2, 4);
  const topD = Math.max(baseD - profile.insetY * 2, 4);
  const height = rowHeight;

  const geo = new THREE.BoxGeometry(baseW, height, baseD, 1, 1, 1);
  const pos = geo.attributes.position;
  const ratioX = topW / baseW;
  const ratioZ = topD / baseD;

  for (let i = 0; i < pos.count; i++) {
    if (pos.getY(i) > 0) {
      pos.setX(i, pos.getX(i) * ratioX);
      pos.setZ(i, pos.getZ(i) * ratioZ);
    }
  }

  // Apply row tilt (rotate top surface around Z axis)
  if (tiltDeg !== 0) {
    const tiltRad = (tiltDeg * Math.PI) / 180;
    for (let i = 0; i < pos.count; i++) {
      if (pos.getY(i) > 0) {
        const z = pos.getZ(i);
        const y = pos.getY(i);
        // Tilt: rotate top vertices around center in YZ plane
        pos.setY(i, y + z * Math.sin(tiltRad) * 0.3);
      }
    }
  }

  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return { geo, topW, topD, height };
}
```

- [ ] **Step 2: Import getKeyRow and compute per-key row**

Add `getKeyRow` to the import from utils:
```js
import { isISOEnter, getBounds, getKeyRow } from "../utils";
```

In the rebuild useEffect, after computing `minKY`, store it:
```js
const layoutMinY = minKY;
```

In the keys.forEach loop, before the keycap section, compute the row:
```js
const keyRow = getKeyRow(k.y, layoutMinY);
const rowData = profile.rows ? profile.rows[keyRow] || profile.rows[3] : { height: 8, tilt: 0 };
const rowHeight = rowData.height;
const rowTilt = rowData.tilt;
```

- [ ] **Step 3: Update regular keycap creation to use row data**

Replace the regular keycap block:
```js
const { geo: capGeo, topW, topD, height: capHeight } = createKeycapGeo(k.w, kh, profile, rowHeight, rowTilt);
const cap = new THREE.Mesh(capGeo, isA ? capAcct : capBase);
cap.position.set(kpx, pt + KEYCAP_OFFSET + capHeight / 2, pz);
```

Update the dish position:
```js
dish.position.set(kpx, pt + KEYCAP_OFFSET + capHeight + 0.08, pz);
```

Update the ISO Enter to use rowHeight:
```js
// In the ExtrudeGeometry options, replace profile.height with rowHeight:
const capGeo = new THREE.ExtrudeGeometry(isoShape, {
  depth: rowHeight,
  ...
});
capGeo.translate(0, rowHeight, 0);
```

And update keyMeshMap originalY to use the correct height.

- [ ] **Step 4: Add OEM to the CAP chips in App.jsx**

Find the CAP chips array `["cherry", "sa", "dsa", "none"]` and change to `["cherry", "sa", "dsa", "oem", "none"]`.

- [ ] **Step 5: Build and verify**

Run: `npx vite build`
Expected: Build succeeds. Each row has visibly different keycap heights. Cherry R1 (number row) is tallest, R3 (home) is shortest.

---

### Task 4: Case-Shape Slope (Wedge Case Instead of Rotation)

**Files:**
- Modify: `src/components/ThreePreview.jsx`

Replace the pivot-group rotation slope with a wedge-shaped case. The case back wall is taller than the front wall by `tan(slopeAngle) * caseDepth`. The plate and keys stay flat (no rotation) — the visual slope comes purely from the case shape. Remove the rotation-based slope code.

- [ ] **Step 1: Remove the pivot-group slope code**

Delete the entire "Apply slope" section at the end of the rebuild useEffect (lines 608-625).

- [ ] **Step 2: Build the case as a wedge**

In the case section, after computing `caseH`, add slope-based height difference:

```js
const slopeRad = (opts3d.slope || 0) * Math.PI / 180;
const caseDepth = ch + wall * 2;
const backExtraH = Math.tan(slopeRad) * caseDepth;
// Back height = caseH + backExtraH, front height = caseH
```

Replace the ExtrudeGeometry approach with a BufferGeometry wedge:

Build the case as 6 faces manually:
- Front face: height = caseH
- Back face: height = caseH + backExtraH
- Left/right faces: trapezoidal (taller at back)
- Top face: angled (the typing surface)
- Bottom face: flat (sits on desk)

Use a simpler approach: build a regular box case but add an angled top insert:

```js
if (opts3d.caseStyle !== "none") {
  // ... existing bounds/wall/height calculations ...
  const slopeRad = (opts3d.slope || 0) * Math.PI / 180;
  const backExtra = Math.tan(slopeRad) * (ch + wall * 2);
  
  // Bottom shell (flat, uniform height)
  // ... existing case shell code stays the same for the base ...
  
  // If slope > 0, add a wedge block behind the case to raise the back
  if (backExtra > 0.5) {
    const wedgeShape = new THREE.Shape();
    const ww = cw / 2 + wall;
    wedgeShape.moveTo(-ww, 0);
    wedgeShape.lineTo(ww, 0);
    wedgeShape.lineTo(ww, backExtra);
    wedgeShape.lineTo(-ww, backExtra);
    wedgeShape.closePath();
    const wedgeGeo = new THREE.ExtrudeGeometry(wedgeShape, {
      depth: ch + wall * 2,
      bevelEnabled: false,
    });
    wedgeGeo.rotateX(-Math.PI / 2);
    const wedge = new THREE.Mesh(wedgeGeo, caseMat);
    wedge.position.set(cx, -botThick, -cy);
    wedge.castShadow = true;
    add(wedge);
  }
}
```

Note: this is a simplified approach. The keyboard plate, switches, and keycaps remain flat — the case just has a higher back wall, which gives the visual impression of slope. A future improvement could tilt the internals too.

- [ ] **Step 3: Build and verify**

Run: `npx vite build`
Expected: Slope slider makes the case back wall taller. No sinking below ground. Keyboard stays above ground plane.

---

### Task 5: LED Brightness and Speed Controls

**Files:**
- Modify: `src/components/App.jsx`
- Modify: `src/lightPresets.js`
- Modify: `src/components/ThreePreview.jsx`

Add brightness (0-100%) and speed (0.1x-3x) sliders to the LED controls.

- [ ] **Step 1: Add brightness and speed to opts3d**

In App.jsx, extend the opts3d initial state:
```js
{ ..., ledBrightness: 80, ledSpeed: 1.0 }
```

Add sliders in the LED-enabled section:
```jsx
<Slider label="Bright" value={opts3d.ledBrightness} min={10} max={100} step={5} unit="%"
  onChange={(v) => setOpts3d(o => ({...o, ledBrightness: v}))} />
<Slider label="Speed" value={opts3d.ledSpeed} min={0.1} max={3.0} step={0.1} unit="x"
  onChange={(v) => setOpts3d(o => ({...o, ledSpeed: v}))} />
```

- [ ] **Step 2: Apply brightness and speed in ThreePreview LED animation**

In the animation loop's LED section, modify the elapsed time by speed, and multiply colors by brightness:

```js
const brightness = (currentOpts.ledBrightness || 80) / 100;
const speed = currentOpts.ledSpeed || 1.0;
const elapsed = performance.now() / 1000 * speed;
// ... after getting [r, g, b] from preset ...
r *= brightness; g *= brightness; b *= brightness;
```

Also increase the base LED point light intensity and distance for visibility:
```js
// When creating LEDs:
const ledLight = new THREE.PointLight(0xffffff, 2.0, 40);  // was 0.8, 25
```

- [ ] **Step 3: Build and verify**

Run: `npx vite build`
Expected: Brightness slider dims/brightens LEDs. Speed slider makes animations faster/slower.

---

### Task 6: ISO/Perspective Camera Toggle + Focus-Frame Reset

**Files:**
- Modify: `src/components/ThreePreview.jsx`
- Modify: `src/components/App.jsx`

Add a Perspective/ISO toggle in the toolbar. ISO uses an OrthographicCamera. The "Reset View" button becomes "Focus" — it auto-frames the keyboard to fill the viewport based on bounding box size.

- [ ] **Step 1: Add camera mode state to App.jsx**

Add to opts3d: `cameraMode: "perspective"`. Add toggle button in toolbar:

```jsx
{view === "3d" && (
  <>
    <BtnSmall onClick={() => setOpts3d(o => ({...o, cameraMode: o.cameraMode === "perspective" ? "iso" : "perspective"}))}>
      {opts3d.cameraMode === "perspective" ? "Persp" : "ISO"}
    </BtnSmall>
    <BtnSmall onClick={() => previewRef.current?.focusView()}>Focus</BtnSmall>
  </>
)}
```

Remove the old "Reset View" button.

- [ ] **Step 2: Add OrthographicCamera support in ThreePreview**

In the scene setup useEffect, create both cameras:

```js
const perspCam = new THREE.PerspectiveCamera(35, w / h, 0.1, 2000);
const orthoSize = 200;
const aspect = w / h;
const orthoCam = new THREE.OrthographicCamera(
  -orthoSize * aspect, orthoSize * aspect, orthoSize, -orthoSize, 0.1, 2000
);
st.current.perspCam = perspCam;
st.current.orthoCam = orthoCam;
st.current.cam = perspCam; // default
```

In the animation loop, switch cameras based on stored mode:
```js
const activeCam = st.current.cameraMode === "iso" ? st.current.orthoCam : st.current.perspCam;
// Update both cameras' positions
activeCam.position.set(...);
activeCam.lookAt(...);
// For ortho, update the frustum size based on radius
if (st.current.cameraMode === "iso") {
  const aspect = el.clientWidth / el.clientHeight;
  const size = st.current.radius * 0.5;
  activeCam.left = -size * aspect;
  activeCam.right = size * aspect;
  activeCam.top = size;
  activeCam.bottom = -size;
  activeCam.updateProjectionMatrix();
}
ren.render(scene, activeCam);
```

Store opts3d.cameraMode in st.current:
```js
st.current.cameraMode = opts3d.cameraMode;
```

- [ ] **Step 3: Implement focusView**

Replace `resetView` with `focusView` in the onReady callback:

```js
const focusView = () => {
  st.current.theta = Math.PI / 4;
  st.current.phi = Math.PI / 3.5;
  // radius is already auto-calculated from span in rebuild useEffect
  // Just reset angles — the radius will be correct from the last rebuild
};
if (onReady) onReady({ focusView, snapCamera });
```

- [ ] **Step 4: Update resize handler for both cameras**

```js
const onR = () => {
  const ww = el.clientWidth, hh = el.clientHeight;
  perspCam.aspect = ww / hh;
  perspCam.updateProjectionMatrix();
  ren.setSize(ww, hh);
};
```

- [ ] **Step 5: Build and verify**

Run: `npx vite build`
Expected: Toggle between Perspective and ISO views. Focus button re-centers the view.

---

## Execution Notes

- **Task 1** is a critical bugfix — do first.
- **Tasks 2-3** must be done in order (constants first, then ThreePreview).
- **Tasks 4-6** are independent of each other but depend on Tasks 1-3.
- All tasks modify ThreePreview.jsx — execute sequentially to avoid conflicts.
- The `DS` variable bug (Task 1) will cause the case to not render at all if enabled. Fix it first.
- The `profile.height` field is removed in Task 2. Task 3 MUST update all references to use `rowData.height` instead.
