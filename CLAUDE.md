# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

nanun.me Keyboard Studio — a browser-based mechanical keyboard design tool with 2D SVG layout editing, 3D Three.js preview with multi-part Cherry MX switch model, per-key LED lighting, and multi-format export (SVG, DXF, KLE JSON, KiCad CSV). React + Vite, no backend.

## Commands

```bash
npm run dev      # Start Vite dev server (hot reload)
npm run build    # Production build to dist/
npm run preview  # Preview production build locally
```

No test runner or linter is configured.

## Git Policy

Never commit, push, or create PRs without explicit user consent. Always ask before any git operation that modifies history or remote state.

## Architecture

### Core Data

- **Key object**: `{ id, x, y, w, h, label }` — positions in keyboard units (1u = 19.05mm). All layout state is an array of these.
- **Layout DSL** (`layouts/dsl.js`): `R(y, "Esc:1.25 Space:6.25")` defines a row. `gen(rows)` converts to key objects. Gaps use `_:N` syntax. Heights: `Ent:1.25:2`.
- **opts3d** in App.jsx: single state object controlling all 3D settings — switches, capProfile, caseStyle, slope, LED settings, colors, layer visibility, explode factors, camera mode.

### Vertical Stack (3D coordinate system)

The 3D keyboard uses this Y-axis stack from bottom to top:
```
Y=0      PCB bottom (pcbThick = 1.6mm)
Y=1.6    PCB top / switch pins through here
Y=6.6    Plate bottom (plateBottom = pcbTop + 5mm switch housing)
Y=8.1    Plate top (plateTop = plateBottom + pt)
Y=13.6+  Keycap bottom (plateTop + KEYCAP_OFFSET)
```

The `kbGroup` has `scale.z = -1` to flip the Z axis so the 2D layout Y maps correctly to 3D world Z (front=near camera, back=far). All meshes inside kbGroup use negated Z: `pz = -(k.y + kh/2) * UNIT`.

### Theme System

`C` in constants.js is a mutable object (not frozen). `setTheme("light"|"dark")` swaps all values. Light is default. Both themes share `#DB1A1A` red accent. Components read `C` at render time so theme changes work, but static references (like `inputStyle`) use a Proxy for live updates.

### Keycap Profiles (Row-Sculpted)

`CAP_PROFILES` in constants.js stores per-row height and tilt data for Cherry, SA, DSA, and OEM. Each has a `rows` map: `{ 1: { height, tilt }, 2: ..., 3: ..., 4: ... }`. `getKeyRow(keyY, layoutMinY)` in utils.js maps a key's Y position to row 1-4. The `createKeycapGeo()` function in ThreePreview.jsx builds a beveled ExtrudeGeometry with taper and row tilt.

### Switch Model

`models/switchParts.js` builds a multi-part Cherry MX switch from engineering drawings. `createSwitchAssembly(facing, stemColor, topColor, bottomColor)` returns `{ parts: Map, assemblyGroup }`. Parts: bottomHousing (hollow with light channel), topHousing (transparent per Cherry spec with light pipe), stem (square base + cross), spring (helix TubeGeometry). Each part has an `explodeY` offset for the exploded view animation.

### LED System

Per-key emissive meshes (no PointLights — lightweight). SMD LED box on PCB + glow plane + light pipe in switch top housing. `lightPresets.js` exports 12 animation functions: `(time, keyIndex, total, kx, ky, maxX) => [r, g, b]`. Animation runs in the render loop, reading `st.current.opts3d` for speed/brightness.

### Case + Slope

The case has two parts: top shell (ExtrudeGeometry with rounded rect + inner cutout) and bottom case (BoxGeometry with vertex-modified slope). Slope raises the back wall — no rotation. For tilt, a separate tiltGroup rotates the kbGroup around the front-bottom edge. A fill wedge in scene space uses the same angle.

### Color Presets

`colorPresets.js` exports preset arrays for case (10), keycaps (10 colorways with base/accent/mod), stems (10), housings (6 with top/bottom), plate (8), and PCB (8). Each has a name and hex values. Custom colors via HTML color picker.

### Key Components

- **App.jsx**: Root state, keyboard shortcuts, toolbar, bottom panel. Owns `keys`, `opts3d`, `plateSettings`, theme state.
- **ThreePreview.jsx**: All 3D rendering. Two useEffects: scene setup (once) and mesh rebuild (on state change). Camera orbit/pan in the animation loop. Key press animation: keycap + stem move down, spring compresses.
- **LayersPanel.jsx**: Floating, draggable panel for layer visibility, explode, colors, LED controls. Replaces old bottom-panel 3D controls.
- **LayoutEditor.jsx**: SVG-based 2D editor. ISO Enter rendered as L-shaped SVG path with arc corners.
- **ViewGizmo.jsx**: SVG orientation widget. Projects 3D axes based on camera theta/phi.

### ISO Enter

Detected by `isISOEnter()`: `w >= 1.25 && w <= 1.5 && h >= 2 && label matches Enter variants`. The 3D L-shape is built with ExtrudeGeometry using `ofsX = -(k.w/2 + 0.25) * UNIT` for the wider top part. Z position uses `-(k.y) * UNIT` (top edge, not center) since the shape extends downward.

## Conventions

- All styling is inline. The `C` theme object and component-local styles — no CSS files except the reset in index.html.
- Fonts: Plus Jakarta Sans (primary), JetBrains Mono (mono). Loaded via Google Fonts in App.jsx.
- Three.js scene is imperative via refs (`st.current`). The render loop reads from `st.current.opts3d` to avoid re-creating the scene on every state change.
- Materials use `side: THREE.DoubleSide` because `kbGroup.scale.z = -1` inverts face normals.
- Export functions are pure (keys + settings in, string out). `download()` handles browser file save.
