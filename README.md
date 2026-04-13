# nanun.me Keyboard Studio

An open-source, browser-based mechanical keyboard design tool. Create custom layouts, visualize them in 3D with accurate Cherry MX switch models, customize colors, and export for manufacturing.

**[Live Demo](https://nanun.me)** | **[Report Bug](https://github.com/1wayto/nanun-keyboard/issues)**

## Features

### Layout Editor
- 14 built-in presets: ANSI & ISO in 40%, 60%, 65%, 75%, TKL, and Full sizes
- Macropad presets (2x4, 3x3 numpad)
- Drag-and-drop key positioning with 0.25u grid snapping
- KLE JSON import/export for community layout sharing
- Per-key label, width, and height editing

### 3D Preview
- Realistic keyboard visualization with orbit, pan, and zoom controls
- **Keycap profiles**: Cherry, SA, DSA, OEM — each with accurate per-row height sculpting
- **Multi-part Cherry MX switch model**: bottom housing (hollow), transparent top housing with light pipe, stem (square base + cross), coil spring — based on official engineering drawings
- **Exploded view**: global layer explode + per-switch part explode for tech animations
- **Click-to-press**: click any keycap to see the stem push down and spring compress
- **LED lighting**: 12 animation presets (Rainbow, Breathe, Fire, Reactive, etc.) with brightness/speed controls, north/south facing
- **Case styles**: Tray, High, Low with adjustable typing angle (slope)
- **PCB layer**: green circuit board with accurate vertical stack positioning
- **ISO/Perspective camera toggle** with Blender-style orientation gizmo

### Layers Panel
- Floating, draggable panel for controlling all 3D layers
- Toggle visibility: Keycaps, Switches, Plate, PCB, Case, LEDs
- Color customization with 10+ presets per component + custom color picker
- Keycap colorways, switch stem colors, housing colors, plate materials, PCB colors, case colors

### Theming
- Light/dark mode toggle
- Light theme: warm whites (#FFF6F6) with teal text and red accent
- Dark theme: deep blue-gray (#1a2028) with matching red accent

### Export
- **SVG**: Plate outline with switch cutouts for laser cutting
- **DXF**: CAD-ready plate design with layers
- **KLE JSON**: Standard keyboard layout format
- **KiCad CSV**: Switch positions for PCB design

## Quick Start

```bash
git clone https://github.com/1wayto/nanun-keyboard/nanun-keyboard.git
cd nanun-keyboard
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Tech Stack

- **React 18** — UI components with hooks
- **Three.js** — 3D rendering engine
- **Vite** — Build tool and dev server

No backend, no database, no external APIs. Everything runs in the browser.

## Project Structure

```
src/
  constants.js          # Dimensions, themes, keycap profiles
  utils.js              # Key utilities (snap, isISOEnter, getBounds, getKeyRow)
  colorPresets.js       # Color presets for all components
  lightPresets.js       # 12 LED animation functions
  layouts/              # Layout DSL and 14 preset definitions
  export/               # SVG, DXF, KLE, KiCad exporters
  models/
    switchParts.js      # Multi-part Cherry MX switch geometry
  components/
    App.jsx             # Root component and state management
    ThreePreview.jsx    # 3D rendering engine
    LayoutEditor.jsx    # 2D SVG layout editor
    LayersPanel.jsx     # Floating layer controls
    ViewGizmo.jsx       # Orientation widget
    HowToModal.jsx      # Guided walkthrough
    ui.jsx              # Shared UI atoms
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Delete / Backspace | Delete selected key |
| Arrow keys | Move selected key by 0.25u |
| Shift + Arrow keys | Move selected key by 1u |
| Escape | Deselect |

## 3D Controls

| Input | Action |
|-------|--------|
| Left-click drag | Orbit camera |
| Middle-click drag | Pan camera |
| Scroll wheel | Zoom |
| Click keycap | Press animation |
| Gizmo axis click | Snap to view (Top, Front, Right) |

## Building for Production

```bash
npm run build
```

Output is in `dist/`. Deploy to any static hosting (Netlify, Vercel, GitHub Pages, etc.).

## Acknowledgments & Inspirations

- **[Keyboard Layout Editor (KLE)](http://www.keyboard-layout-editor.com/)** — the standard for keyboard layout design and the JSON format we import/export
- **[Cherry GmbH](https://www.cherrymx.de/)** — MX switch engineering drawings used for the multi-part 3D switch model
- **[Signature Plastics](https://pimpmykeyboard.com/)** — SA and DSA keycap profile specifications
- **[GMK](https://uniqey.net/gmk-keycaps)** — Cherry profile keycap measurements and colorway inspirations
- **[Three.js](https://threejs.org/)** — 3D rendering engine powering the preview
- **[Vite](https://vitejs.dev/)** — lightning-fast build tooling
- **[GeekHack](https://geekhack.org/)** & **[Deskthority](https://deskthority.net/)** — community resources for keycap profile dimensions and keyboard design standards
- **[KiCad](https://www.kicad.org/)** — PCB design tool (CSV switch position export)
- **[ai03 Plate Generator](https://kbplate.ai03.com/)** — inspiration for plate SVG/DXF export with switch cutouts

## Author

**Eric Lee** — [hello@1wayto.com](mailto:hello@1wayto.com)

## License

MIT
