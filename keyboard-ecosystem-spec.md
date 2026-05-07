# ESP32 Keyboard Ecosystem — Design Specification

**Status:** Concept / Pre-prototype
**Version:** 0.2
**Target validation:** 2×3 test build before scaling

---

## 1. Project Vision

An end-to-end open-source ecosystem for ESP32-based mechanical keyboards built around a single web tool. Users design a layout, generate all printable parts and firmware in-browser, print the case on a consumer 3D printer, and assemble with minimal soldering. Web-based firmware flashing closes the loop.

**Core differentiators vs. existing ecosystems (QMK/VIA/TMK):**
- ESP32-S3 firmware target (KMK), not AVR
- No PCB required — case/plate/matrix integrated into 3D-printed parts
- Solderless or near-solderless switch contacts via printed pockets + coiled wire
- Layout builder generates all artifacts: STLs, firmware config, BOM
- Web-flash via ESP Web Tools (Web Serial API)

---

## 2. Architecture Overview — Five-Layer Stack

The keyboard is constructed from five stacked, printed layers. Each layer has a single, clear job. Layers are sandwiched and bonded; once assembled with the metal matrix, the structure is monolithic.

| # | Layer | Purpose |
|---|---|---|
| 01 | Top case | Aesthetic shell, switch cutouts |
| 02 | Switch plate | MX switch retention (1.5mm equivalent) |
| 03 | Electrical layer | Sockets, diodes, wire channels — all the action |
| 04 | Access cover | Removable; exposes solder joints from below |
| 05 | Bottom case | ESP32 module bay, TFT display mount |

**Assembly principle:** the soldered metal matrix (continuous wires + diode legs + solder joints) becomes the structural skeleton. The plastic frame is essentially a permanent soldering jig. This means the frame can use thin walls and low infill — it's holding a self-supporting metal lattice in place, not bearing load.

---

## 3. Switch Cell Design

Each switch position is a self-contained cell. The matrix is built by tiling cells across the layout. Cells are identical; only the layout and wire routing change.

### 3.1 Coil Spring Contact (Solderless)

Replaces hot-swap sockets entirely. At each pin position, the wire is wound into a multi-turn coil inside a printed pocket.

**Geometry:**
- Wire wraps 2–4 turns around the pin's intended path
- Coil's relaxed inner diameter is *smaller* than the switch pin (1.5mm)
- Pocket inner diameter slightly larger than the coil's outer diameter
- Switch pin insertion forces coil to expand radially
- Plastic pocket walls constrain expansion → grip force redirected back to pin

**Why this works:**
- Distributed multi-point contact around pin circumference (vs. 2-point U-bend)
- Self-centering geometry
- Plastic constraint prevents long-term spring fatigue (the wire can't deform outward)
- Wire is matrix line and spring contact in one piece — no separate components

**Dimensions (starting point, validate on prototype):**
- Wire: 22 AWG solid tinned copper (Ø~0.65mm)
- Switch pin: Cherry MX style, Ø1.5mm round
- Coil ID (relaxed): 1.0–1.2mm
- Coil OD: ~2.8mm
- Pocket ID: ~3.0mm
- Pocket depth: 5–6mm (3 turns of coil at ~1.5mm pitch)
- Lead-in chamfer: 0.5mm at 45° for pin self-alignment

### 3.2 Diode Integration

One 1N4148 per switch. Diode leads do triple duty:
- Anode lead bends into the coil at one switch pin (replaces a separate jumper wire)
- Cathode lead extends to the column wire (one solder joint per switch)
- Diode body sits in its own printed pocket adjacent to the switch

**Per-switch component count:**
- 1× 1N4148 diode (with full-length leads, do not pre-trim)
- 0× separate jumper wires
- 0× hot-swap sockets
- 1× solder joint (cathode → column wire)

### 3.3 Cell Pocket Layout (top-down)

Per cell, the printed frame contains:
- 2× pin pockets (Cherry MX 5mm pitch, holds coiled wires)
- 1× diode pocket (rectangular, 1N4148-sized, oriented consistently)
- Wire channels entering from cell edges (row direction, column direction)
- Cell footprint: 19.05mm × 19.05mm (standard 1u key spacing)

---

## 4. Matrix Wiring System

### 4.1 Continuous Wire Routing

Two categories of conductors:

**Long continuous matrix wires:**
- One per row, one per column
- Tinned solid-core 22 AWG copper
- Coiled in-place at each switch position, straight runs between
- Tail extends to I/O section for ESP32 GPIO connection

**Diode leads:**
- Anode bent into coil at second switch pin
- Cathode extends to perpendicular matrix wire (only solder joint per cell)

### 4.2 Wire Length Estimation

For a 60% layout (5 rows × 14 columns):
- Row wires: ~5 × 290mm = 1.45m
- Column wires: ~14 × 100mm = 1.40m
- **Total matrix wire: ~3m + slack** (recommend 5m purchase per board)

### 4.3 Channel Layer Separation

Rows and columns must cross without electrical contact:
- Two Z-layer channel system: rows on lower channel layer, columns on upper (or vice versa)
- At crossings, one wire passes under a printed bridge
- Matrix layer can be over-provisioned with extra channels to give assemblers flexibility

### 4.4 Solder Joint Count

- Traditional build: ~240 solder joints (sockets + diodes for 60 keys)
- This design: ~60 solder joints (one per cell, cathode → column)
- **75% reduction in soldering work**

---

## 5. Module Splitting (Print-Time Only)

### 5.1 Why Modular

Most consumer printers have ≤220mm beds (Adventurer 5M, Ender 3, etc.). Keyboards above 60% (≥290mm) won't fit. **Splitting is mandatory** for TKL/full layouts; recommended even for 60%.

### 5.2 Module Standard

Base printable module = ~30% width (~145mm). Any keyboard composes from:
- 30% half (base module: ~6 cols × 5 rows)
- Function row strip (1 row × N cols)
- Navigation cluster (TKL/full)
- Numpad block (full)
- Spacebar bridge (center)

Examples:
- 60% = 2× 30% halves
- TKL = 2× 30% halves + nav cluster + function strip
- Full = above + numpad block

### 5.3 Staggered Seam Pattern

Each layer's split position is offset from layers above and below. **No vertical line through the assembly is broken in more than one layer at a time.** Adjacent intact layers carry load across each split. This eliminates the need for mechanical fasteners at seams.

**Auto-routing rule:** minimum 30–50mm offset between adjacent-layer split positions.

### 5.4 Split Joint Construction

- **Mechanical:** dovetail joints or alignment pins — printed, no hardware
- **Adhesive:** two-part epoxy between layers (CA glue acceptable for fast assembly)
- **Electrical continuity:** matrix wires run continuously across module boundaries during assembly. **No connectors at splits** — the module split is invisible in the final product.
- **Reinforcement bonus:** wire channels run perpendicular to split direction in the matrix layer, so column wires + solder joints physically span every seam.

### 5.5 User Workflow

1. Print all modules (sized to user's print bed)
2. Dry-fit modules via dovetails
3. Run continuous wires through channels spanning modules
4. Solder cathode-to-column joints (60 joints total for 60%)
5. Epoxy modules at seams
6. Snap on top case

---

## 6. Material Specifications

### 6.1 Filament: PETG

**Mandatory** for all structural layers. PLA is too brittle and softens at solder-iron-adjacent temperatures.

| Property | PETG | Why it matters |
|---|---|---|
| Glass transition | ~80°C | Solder safety margin |
| Toughness | High | Snap-fits, clamps work without cracking |
| Layer adhesion | Strong | Multi-layer structural integrity |
| Print difficulty | Easy | No enclosure required |

**Print settings (Adventurer 5M baseline):**
- Nozzle: 230–245°C
- Bed: 75–85°C
- Speed: 30–50 mm/s outer walls (override default high speeds)
- Cooling: 30–50%
- Walls: 4 perimeters on snap-fit features
- Layer height: 0.2mm

**Brand recommendations:** Overture, Prusament, eSun, Polymaker PolyLite

**Storage:** vacuum-bag with desiccant when not in use; PETG strings worse when damp.

### 6.2 Wire

- **22 AWG solid-core tinned copper** (hookup wire, not stranded)
- Thinner (28 AWG) won't spring back; thicker (18 AWG) won't bend cleanly by hand

### 6.3 Diodes

- **1N4148 through-hole**, full leads (do not order pre-cut)
- Standard convention: cathode (band) toward column line in COL2ROW scan

### 6.4 Adhesives

- **Epoxy (5-min or 30-min, two-part)** for layer-to-layer and module-to-module bonds
- CA glue acceptable for fast assembly but more brittle
- **Note:** solvent welding (acetone) does NOT work on PETG (only ABS)

---

## 7. Layout Builder Integration

### 7.1 Required Outputs

The layout builder must generate, from a single layout JSON source of truth:

1. **Layout JSON** (source of truth)
   - Switch positions: x, y, rotation per key
   - Switch type / footprint
   - Stabilizer positions for ≥2u keys
   - Module assignments (which keys belong to which printable module)

2. **STL files (per layer, per module):**
   - Top case
   - Switch plate
   - Electrical layer (sockets + diodes + matrix channels)
   - Access cover
   - Bottom case
   - Quantity scales with module count (e.g., 60% split = 2 modules × 5 layers = 10 STLs)

3. **Firmware artifacts:**
   - KMK config matching the physical wiring
   - Pin assignments for ESP32-S3 GPIOs
   - Matrix scan parameters
   - Default keymap (user-editable)

4. **Bill of materials:**
   - Wire length (rows + columns + tails)
   - Diode count
   - Screw count (if any)
   - Filament estimate (per module, total)
   - ESP32 + TFT module spec

5. **Assembly instructions:**
   - Module-to-module assembly order
   - Wire routing per row/column
   - Solder joint locations

### 7.2 Auto-Configuration Required

**Print-time concerns (geometry generation):**
- Module split positions per user's print bed dimension
- Staggered seam offset between layers
- Wire channel routing (over-provisioned grid pattern, not matrix-specific)
- Pocket placement at each switch position

**Assembly-time concerns (firmware/data):**
- Matrix assignment (key → row/column)
- ESP32-S3 GPIO pin mapping
  - Whitelist of safe pins (avoid 0, 3, 19/20 USB, 26-32 flash, strapping pins with caveats)
  - Auto-assign in physical proximity to I/O section
- KMK config generation
- Default keymap

### 7.3 UX Recommendations

- **Live 3D preview** (Three.js) of all layers with toggle visibility, exploded view
- **Smart defaults** with "advanced" panel for tuning
- **Wire routing visualization** overlaid on the layout
- **Component placement preview** (ESP32, screen, diodes shown in position)
- **Manual override** for matrix and GPIO assignments
- **Versioning** — save cladding parameters with the layout

---

## 8. Generation Pipeline (Browser-Side)

### 8.1 Stack

- **Three.js** for live preview (already in use)
- **three-bvh-csg** for boolean operations (pocket cutouts, channel subtractions)
- **Three.js STLExporter** for export
- **JSZip** for bundling all output files for download
- Optional upgrade: **Manifold** (WASM) for faster CSG on complex geometry

### 8.2 Architecture

- Layout JSON drives everything
- Per-layer **generator functions**: `layoutJSON → Three.js mesh`
- Compose generators into the full stack
- Same Three.js scene used for preview AND export (single source of truth)
- Build a small library of **parametric cell generators** (`socketCell()`, `diodePocket()`, `wireChannel()`) and compose them

### 8.3 Web Flash Integration

**ESP Web Tools** for firmware delivery:
- Hosted JS library + manifest.json pointing to firmware .bin files
- Works in Chrome/Edge/Opera (Web Serial API)
- User plugs ESP32 via USB, clicks button, picks port, flashes
- Optional WiFi provisioning via Improv WiFi protocol post-flash

```html
<script type="module" src="https://unpkg.com/esp-web-tools@10/dist/web/install-button.js?module"></script>
<esp-web-install-button manifest="manifest.json"></esp-web-install-button>
```

---

## 9. Prototype Plan: 2×3 Test Build

Before scaling to a full keyboard, validate the concept on a 2-row × 3-column test build. This is small enough for fast iteration cycles (~30 min print) while exercising every component of the system.

### 9.1 Validation Targets

- Coil spring contact geometry — does the pin actually grip after insertion?
- Pocket dimensions — what tolerance is needed for reliable insertion?
- Solder access from below — is the access cover hole pattern sufficient?
- PETG heat tolerance during soldering — any frame deformation?
- Continuous wire routing — does it work in practice or are there snags?
- Switch retention — does the keyboard hold a switch when a keycap is pulled?
- Long-term reliability — leave it for a week, type on it, check for flakiness

### 9.2 Open Questions (decide on prototype)

- Optimal coil turn count: 2 vs. 3 vs. 4 turns
- Wire pre-bending vs. in-pocket forming via pocket geometry
- Diode lead spring force vs. matrix wire spring force (asymmetry handling)
- Whether bridges (for row/column crossings) need separate part or can be integrated
- Print orientation for snap-fit features (flex along layer lines, not across)

---

## 10. Future Considerations (Post-Prototype)

- Module marketplace: users share/sell custom module designs
- Themed module sets (typography, colors, layouts)
- Split keyboard variants (true split, not just print-split)
- Per-key RGB integration via matrix-aligned LED strips
- Programmatic STL generation server-side (CadQuery/Build123D) for advanced users
- ASA filament option for high-temperature environments (not typical for keyboards)

---

## Appendix A: BOM Summary (60% layout, single board)

| Item | Qty | Notes |
|---|---|---|
| PETG filament | ~400g | Across all 5 layers |
| 22 AWG tinned solid-core wire | 5m | Buy with slack |
| 1N4148 diode | 61 | One per switch + 1 spare |
| MX-style switches | 61 | User choice |
| Keycaps | 61 | User choice |
| ESP32-S3 dev board | 1 | DevKit with USB-C |
| ST7789 TFT display | 1 | Optional, fits in bottom case bay |
| Two-part epoxy | 1 tube | For module/layer bonding |
| Solder | as needed | ~60 joints total |

## Appendix B: Glossary

- **Coil contact** — multi-turn wire wound inside a printed pocket, replaces a hot-swap socket
- **Cell** — the per-switch module containing pockets and channels
- **Module** — a print-bed-sized chunk of the keyboard (e.g., 30% half)
- **Staggered seam** — split lines offset between layers for monolithic finished part
- **Electrical layer** — the layer containing all matrix wiring and components
- **Access cover** — removable bottom layer exposing solder joints

---

*End of specification — rev 0.2*
