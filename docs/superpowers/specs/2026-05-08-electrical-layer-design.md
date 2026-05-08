# Electrical Layer Design

**Date:** 2026-05-08
**Status:** Approved
**Scope:** Add automatic matrix-wiring generation, ESP32-S3 GPIO assignment, a firmware-ready pinmap (JSON), and a printable wire diagram (SVG) on top of the existing CAD AI-tooling foundation. Soldered switches only; no hotswap.

## Goals

1. Given any keyboard layout, generate a usable matrix and ESP32-S3 pinmap automatically with no manual wiring decisions required.
2. Produce a printable SVG wire diagram that a person can use as a soldering reference.
3. Expose the matrix and validation through MCP tools so the AI can inspect and override.
4. Reuse the existing single-source-of-truth state model (`cad-state.json` + Vite plugin sync + browser hook).

## Non-goals

- ESP32 holder CAD pocket (separate future spec, depends on case spec).
- KiCad schematic / PCB export (separate future spec; large).
- Multiple board profiles (only ESP32-S3 DevKitC-1 in this MVP).
- In-app rendering of the wire diagram in a new tab — download-only.
- Per-key matrix overrides beyond explicit `rowGpios` / `colGpios` arrays.

## Architecture

The electrical layer is **derived state** — given the layout (`keys[]`) plus a small `electrical` block in `cad-state.json`, the matrix and pinmap are recomputed on demand. Nothing matrix-specific is stored in `cad-state.json` except the user-/AI-controllable knobs.

```
keys[] + cad-state.electrical (knobs)
                │
                ▼
        computeMatrix()  ──► { dims, pinmap, keyMatrix, unused }
                                │
                  ┌─────────────┼─────────────┐
                  ▼             ▼             ▼
          renderWireSVG    getMatrix MCP    Pinmap JSON
                  │           tool             │
                  ▼                            ▼
        browser download ─────────────► browser download
```

This avoids storing redundant data, and means changing a key automatically refreshes the wiring with no extra step.

## State additions (`cad-state.json`)

```jsonc
{
  // ...existing schemaVersion, plate, parts...
  "electrical": {
    "board": "esp32-s3-devkitc-1",   // only option for now
    "diodeDirection": "col2row",     // anode at switch, cathode on column
    "rowGpios": "auto",              // "auto" or explicit array, e.g. [4, 5, 6]
    "colGpios": "auto"               // "auto" or explicit array
  }
}
```

Schema additions in `shared/cad/schema.js`:

- `electrical.board`: enum, only `"esp32-s3-devkitc-1"` for MVP.
- `electrical.diodeDirection`: enum, `"col2row" | "row2col"`. Default `"col2row"` (standard for QMK/ZMK).
- `electrical.rowGpios`: `"auto"` literal OR array of integers from the safe-pin set.
- `electrical.colGpios`: same as rowGpios.

`validateParam` rejects unknown enum values, non-integer pins, and pins outside the safe set when an explicit array is supplied.

## Computation

`computeMatrix(keys, electrical)` is a pure function returning:

```js
{
  dims: { rows: 5, cols: 14 },
  pinmap: {
    rows: [4, 5, 6, 7, 8],
    cols: [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 21, 38, 39, 40]
  },
  keyMatrix: {
    "k0": { row: 0, col: 0, gpioRow: 4, gpioCol: 9 },
    // ...
  },
  unused: [1, 2, 41, 42, 47, 48]   // remaining safe pins
}
```

### Row assignment (physical-row strategy)

1. Group keys by `floor(k.y)`. Each unique floored Y is a matrix row.
2. Sort rows ascending by floored Y. The smallest Y is row 0.
3. Within each row, sort keys ascending by `k.x`. The leftmost gets column 0.
4. Matrix column count = max(keys per row).
5. Keys in shorter rows simply leave the extra columns un-pressed at those positions (standard handwired pattern).

This makes the matrix mirror the visual layout one-to-one — easy to debug while soldering.

### GPIO selection (auto)

For ESP32-S3 DevKitC-1, the safe-pin list (avoiding strapping pins 0/3/45/46, USB pins 19/20, SPI flash 26–32, octal-flash candidates 33–37) is:

```js
[1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 21, 38, 39, 40, 41, 42, 47, 48]
```

Auto-mode pulls **rows first** in list order, then **columns** in list order from the remaining pins. So a 5×14 layout uses pins `[1, 2, 4, 5, 6]` for rows and `[7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 21, 38]` for columns.

If the user (or AI) sets an explicit array, that array is used verbatim and validated against the safe-pin set.

### Diode placement (logical, not physical)

For the SVG diagram, each diode sits below its switch:
- DO-35 through-hole footprint, two pads 7.5mm apart on the X axis
- Diode body horizontal, ~3.5×1.8mm
- Cathode (band) faces the column trace
- Center of diode footprint = `(keyCenterX, keyCenterY + 7.5mm)`

For an MVP with `diodeDirection: "col2row"`:
- Anode → switch pin → row trace
- Cathode → column trace
- Visually: row trace runs through the top of each switch, column trace through the diode cathode below

## MCP tools (added)

| Tool | Purpose |
|---|---|
| `getMatrix()` | Returns `{ dims, pinmap, keyMatrix, unused }` for the current layout + electrical state |
| `validateMatrix()` | Returns array of issues; empty array if clean |

`setParam` already supports new paths (`electrical.board`, `electrical.diodeDirection`, `electrical.rowGpios`, `electrical.colGpios`) via the schema.

### `validateMatrix` issue codes

| Code | Severity | Meaning |
|---|---|---|
| `pin_overflow` | error | Layout requires more rows+cols than the safe-pin list permits |
| `unsafe_gpio` | error | Explicit `rowGpios` / `colGpios` includes a pin not in the safe set |
| `gpio_collision` | error | A pin appears in both `rowGpios` and `colGpios` |
| `gpio_too_few` | error | Explicit array shorter than the matrix dimension requires |
| `unknown_board` | error | `electrical.board` value not recognized |

The existing browser validation bar (`validateGeometric`) does not include matrix checks (it's plate-only). A separate `validateMatrix()` is exposed as an MCP tool; the browser can also call it client-side via the same shared module.

## Wire diagram (SVG)

`renderWireSVG(keys, plateSettings, matrix)` returns an SVG string showing:

1. Each key cutout drawn as a light-grey rounded square (same coordinates as the existing `exportSVG` in `src/export/svg.js`)
2. A diode footprint below each switch — two pads + cathode-band rectangle, oriented per `diodeDirection`
3. **Row traces** in red, drawn as horizontal lines connecting all switches in the same matrix row at the row-pin Y coordinate
4. **Column traces** in blue, drawn as vertical lines connecting all diode cathodes in the same matrix column
5. Each row trace labeled with its GPIO at the left margin (`R0: GPIO4`)
6. Each column trace labeled with its GPIO at the top margin (`C0: GPIO9`)
7. An ESP32-S3 outline in the bottom-right corner with assigned pins listed alongside

Output unit: mm. Width/height matches the plate bounding box plus a 30mm margin for labels.

The SVG is intentionally vector + flat-file — opens in any browser, prints from any tool, no special viewer needed.

## File layout

```
shared/cad/electrical/
  matrix.js              ← computeMatrix(keys, electrical) → result object
  validateMatrix.js      ← validateMatrix(keys, electrical) → issues[]
  esp32s3.js             ← SAFE_PINS list + board metadata
  wireSvg.js             ← renderWireSVG(keys, plate, matrix) → string
  test/
    matrix.test.js
    validateMatrix.test.js
    wireSvg.test.js

cad-mcp/src/
  electrical.js          ← thin wrapper exposing getMatrix + validateMatrix
  server.js              ← register the two new tools
shared/cad/schema.js     ← add electrical.* to PARAM_PATHS + DEFAULT_STATE

src/cad/
  exportClient.js        ← add downloadPinmap() + downloadWireSvg()
src/components/App.jsx   ← two new export buttons: "Pinmap" (JSON), "Wire" (SVG)
```

## What's deferred

| Item | Reason |
|---|---|
| ESP32 holder CAD pocket | Needs a case spec to live in |
| KiCad PCB / schematic | Large; own spec |
| Multiple board profiles (Pico, NodeMCU-32S, etc.) | Only S3 in MVP |
| In-app inline render of wire diagram | Download-only for MVP |
| Per-key matrix overrides (manual `keyMatrix` editing) | `rowGpios`/`colGpios` arrays cover the escape hatch |
| Hotswap footprints | User explicitly excluded; soldered only |

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Safe-pin list wrong for an S3 variant | List is data in `esp32s3.js`; amend on report. Each pin choice is auditable from the SVG. |
| Layout has more rows or cols than safe pins permit | `validateMatrix` returns `pin_overflow`; surface via existing red-chip UI |
| User picks `rowGpios` with strapping pin | `validateMatrix` returns `unsafe_gpio` |
| SVG too dense for large layouts | SVG is vector → user zooms. Add stacked-row mode in a future pass if needed. |
| Auto pin order changes between MVP and v2 | Pin order is deterministic + documented; if we change it later, existing wired keyboards keep their explicit `rowGpios`/`colGpios` overrides. |

## Open decisions deferred to plan

- Exact SVG layout (label margins, font size, trace stroke width).
- Whether `validateMatrix` runs automatically on every state change or on demand only (lean toward on-demand in MVP, run via "Validate" button or AI tool).
- Whether `renderWireSVG` runs in browser (preferred for fast download) or via the Vite plugin endpoint.

## Next step

Move to `writing-plans` to produce a step-by-step implementation plan.
