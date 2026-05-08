# Electrical Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add automatic matrix-wiring generation, ESP32-S3 GPIO assignment, a firmware-ready pinmap (JSON download), and a printable wire diagram (SVG download) on top of the existing CAD AI-tooling foundation.

**Architecture:** All matrix data is **derived** from `keys[]` plus a small `electrical` block in `cad-state.json`. Pure JS modules under `shared/cad/electrical/` compute the matrix, validate it, and render the SVG. The MCP server exposes two new tools (`getMatrix`, `validateMatrix`); the browser gets two new export buttons.

**Tech Stack:** Plain JS modules (no replicad needed for any electrical code — geometry-only). Existing Vitest + cad-mcp + Vite test/build infra.

---

## Spec reference

Implements `docs/superpowers/specs/2026-05-08-electrical-layer-design.md`. Read it before starting.

## Conventions

- Test runner: **Vitest**, scoped to `cad-mcp/` (config already includes `../shared/**/test/*.test.js`).
- Every code task is TDD: write a failing test → run it (see fail) → implement → run it (see pass) → commit.
- **Never push or open PRs without explicit user request** (per repo `CLAUDE.md`). Per-task commits ARE authorized for this multi-task plan.
- All paths are repo-relative unless stated. Run commands from `C:\Users\eric_\Documents\Claude\Projects\nanun-keyboard` unless noted.

---

## File structure (decisions locked in)

**New files:**

- `shared/cad/electrical/esp32s3.js` — `SAFE_PINS` array + board metadata
- `shared/cad/electrical/matrix.js` — `computeMatrix(keys, electrical) → { dims, pinmap, keyMatrix, unused }`
- `shared/cad/electrical/validateMatrix.js` — `validateMatrix(keys, electrical) → issues[]`
- `shared/cad/electrical/wireSvg.js` — `renderWireSVG(keys, plate, matrix) → string`
- `shared/cad/electrical/test/matrix.test.js`
- `shared/cad/electrical/test/validateMatrix.test.js`
- `shared/cad/electrical/test/wireSvg.test.js`
- `cad-mcp/src/electrical.js` — thin wrapper exposing the two tools to MCP
- `src/cad/exportClient.js` — already exists; will be extended

**Modified files:**

- `shared/cad/schema.js` — add `electrical.*` to DEFAULT_STATE, PARAM_PATHS, SPECS; extend `validateParam` to support `enum` and `auto-or-pins` types
- `cad-mcp/test/schema.test.js` — extend with new param tests
- `cad-mcp/src/server.js` — register `getMatrix` and `validateMatrix` tools
- `cad-mcp/test/server.test.js` — extend with tests for the new tools
- `src/cad/exportClient.js` — add `downloadPinmap()` and `downloadWireSvg()`
- `src/components/App.jsx` — add two new export buttons in the existing export bar

---

## Task 1: Extend schema for `electrical.*`

**Files:**
- Modify: `shared/cad/schema.js`
- Modify: `cad-mcp/test/schema.test.js`

- [ ] **Step 1: Add failing tests**

Append to `cad-mcp/test/schema.test.js`, inside the existing `describe("schema", () => { ... })` block, just before the closing `});`:

```js
  it("DEFAULT_STATE includes electrical block", () => {
    expect(DEFAULT_STATE.electrical).toEqual({
      board: "esp32-s3-devkitc-1",
      diodeDirection: "col2row",
      rowGpios: "auto",
      colGpios: "auto",
    });
  });

  it("PARAM_PATHS includes the four electrical paths", () => {
    expect(PARAM_PATHS).toEqual(expect.arrayContaining([
      "electrical.board",
      "electrical.diodeDirection",
      "electrical.rowGpios",
      "electrical.colGpios",
    ]));
  });

  it("validateParam accepts known board enum", () => {
    expect(validateParam("electrical.board", "esp32-s3-devkitc-1")).toEqual({ ok: true });
  });

  it("validateParam rejects unknown board enum", () => {
    const r = validateParam("electrical.board", "esp32-s3-mystery");
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/board/i);
  });

  it("validateParam accepts diodeDirection enum values", () => {
    expect(validateParam("electrical.diodeDirection", "col2row").ok).toBe(true);
    expect(validateParam("electrical.diodeDirection", "row2col").ok).toBe(true);
  });

  it("validateParam rejects unknown diodeDirection", () => {
    expect(validateParam("electrical.diodeDirection", "diagonal").ok).toBe(false);
  });

  it("validateParam accepts 'auto' for rowGpios/colGpios", () => {
    expect(validateParam("electrical.rowGpios", "auto").ok).toBe(true);
    expect(validateParam("electrical.colGpios", "auto").ok).toBe(true);
  });

  it("validateParam accepts integer arrays for rowGpios/colGpios", () => {
    expect(validateParam("electrical.rowGpios", [4, 5, 6]).ok).toBe(true);
    expect(validateParam("electrical.colGpios", [9, 10, 11, 12]).ok).toBe(true);
  });

  it("validateParam rejects non-integer array entries", () => {
    const r = validateParam("electrical.rowGpios", [4, "five", 6]);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/integer/i);
  });

  it("validateParam rejects unsupported value type for auto-or-pins", () => {
    const r = validateParam("electrical.rowGpios", 42);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/auto/i);
  });
```

- [ ] **Step 2: Run tests, verify FAIL**

Run: `cd cad-mcp && npm test`
Expected: 10 new schema tests fail (plate-related tests still pass = 6 + 5 + 4 + 5 + 4 + 5 + 2 = 31, with 10 new failing = 31 passing + 10 failing).

- [ ] **Step 3: Update `shared/cad/schema.js`**

Replace the entire file contents with:

```js
export const DEFAULT_STATE = {
  schemaVersion: 1,
  plate: { thickness: 1.5, margin: 5, cornerRadius: 2, cutoutSize: 14.0 },
  parts: ["plate"],
  electrical: {
    board: "esp32-s3-devkitc-1",
    diodeDirection: "col2row",
    rowGpios: "auto",
    colGpios: "auto",
  },
};

const SPECS = {
  "plate.thickness":   { type: "number", min: 0.5, max: 6 },
  "plate.margin":      { type: "number", min: 0,   max: 30 },
  "plate.cornerRadius":{ type: "number", min: 0,   max: 10 },
  "plate.cutoutSize":  { type: "number", min: 12,  max: 16 },
  "electrical.board":           { type: "enum", values: ["esp32-s3-devkitc-1"] },
  "electrical.diodeDirection":  { type: "enum", values: ["col2row", "row2col"] },
  "electrical.rowGpios":        { type: "auto-or-pins" },
  "electrical.colGpios":        { type: "auto-or-pins" },
};

export const PARAM_PATHS = Object.keys(SPECS);

export function validateParam(path, value) {
  const spec = SPECS[path];
  if (!spec) return { ok: false, error: `unknown param path: ${path}` };

  switch (spec.type) {
    case "number":
      if (typeof value !== "number" || Number.isNaN(value)) {
        return { ok: false, error: `expected number, got ${typeof value}` };
      }
      if (value < spec.min) return { ok: false, error: `below min ${spec.min}` };
      if (value > spec.max) return { ok: false, error: `above max ${spec.max}` };
      return { ok: true };

    case "enum":
      if (!spec.values.includes(value)) {
        return { ok: false, error: `invalid ${path}: ${value} (allowed: ${spec.values.join(", ")})` };
      }
      return { ok: true };

    case "auto-or-pins":
      if (value === "auto") return { ok: true };
      if (!Array.isArray(value)) {
        return { ok: false, error: `expected 'auto' or integer array, got ${typeof value}` };
      }
      if (!value.every((v) => Number.isInteger(v))) {
        return { ok: false, error: `array must contain only integers` };
      }
      return { ok: true };
  }
  return { ok: false, error: `unsupported spec type for ${path}` };
}

export function getAtPath(obj, path) {
  return path.split(".").reduce((o, k) => (o == null ? o : o[k]), obj);
}

export function setAtPath(obj, path, value) {
  const keys = path.split(".");
  const last = keys.pop();
  let cur = obj;
  for (const k of keys) {
    if (cur[k] == null || typeof cur[k] !== "object") cur[k] = {};
    cur = cur[k];
  }
  cur[last] = value;
  return obj;
}
```

- [ ] **Step 4: Run tests, verify PASS**

Run: `cd cad-mcp && npm test`
Expected: All 41 tests pass (31 prior + 10 new schema).

- [ ] **Step 5: Commit**

```bash
git add shared/cad/schema.js cad-mcp/test/schema.test.js
git commit -m "feat(cad): schema for electrical block (board, diode dir, GPIO arrays)"
```

---

## Task 2: ESP32-S3 board metadata

**Files:**
- Create: `shared/cad/electrical/esp32s3.js`

This module is plain data — no tests of its own, but Task 3 will exercise it.

- [ ] **Step 1: Create `shared/cad/electrical/esp32s3.js`**

```js
// ESP32-S3 DevKitC-1 GPIO safety data.
// Avoids: strapping pins (0, 3, 45, 46), USB D+/D- (19, 20),
// SPI flash pins (26-32), octal-flash candidates (33-37).
// All other GPIO are treated as safe for matrix use.

export const ESP32S3 = {
  id: "esp32-s3-devkitc-1",
  name: "ESP32-S3 DevKitC-1",
  // Pin order is the auto-assignment order (rows first, then cols).
  SAFE_PINS: [
    1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18,
    21, 38, 39, 40, 41, 42, 47, 48,
  ],
};

export const BOARDS = {
  [ESP32S3.id]: ESP32S3,
};
```

- [ ] **Step 2: Commit**

```bash
git add shared/cad/electrical/esp32s3.js
git commit -m "feat(electrical): ESP32-S3 DevKitC-1 safe-pin list"
```

---

## Task 3: `computeMatrix`

**Files:**
- Create: `shared/cad/electrical/matrix.js`
- Create: `shared/cad/electrical/test/matrix.test.js`

- [ ] **Step 1: Write failing tests in `shared/cad/electrical/test/matrix.test.js`**

```js
import { describe, it, expect } from "vitest";
import { computeMatrix } from "../matrix.js";
import { DEFAULT_STATE } from "../../schema.js";

const electrical = DEFAULT_STATE.electrical;

const oneKey = [{ id: "k0", x: 0, y: 0, w: 1, h: 1, label: "A" }];

const twoByThree = [
  { id: "a", x: 0, y: 0, w: 1, h: 1, label: "A" },
  { id: "b", x: 1, y: 0, w: 1, h: 1, label: "B" },
  { id: "c", x: 2, y: 0, w: 1, h: 1, label: "C" },
  { id: "d", x: 0, y: 1, w: 1, h: 1, label: "D" },
  { id: "e", x: 1, y: 1, w: 1, h: 1, label: "E" },
  { id: "f", x: 2, y: 1, w: 1, h: 1, label: "F" },
];

const ragged = [
  { id: "a", x: 0, y: 0, w: 1, h: 1, label: "A" },
  { id: "b", x: 1, y: 0, w: 1, h: 1, label: "B" },
  { id: "c", x: 0, y: 1, w: 1, h: 1, label: "C" },
];

describe("computeMatrix", () => {
  it("one-key layout has 1×1 matrix and 2 GPIOs", () => {
    const m = computeMatrix(oneKey, electrical);
    expect(m.dims).toEqual({ rows: 1, cols: 1 });
    expect(m.pinmap.rows).toHaveLength(1);
    expect(m.pinmap.cols).toHaveLength(1);
    expect(m.keyMatrix.k0).toEqual({
      row: 0, col: 0,
      gpioRow: m.pinmap.rows[0],
      gpioCol: m.pinmap.cols[0],
    });
  });

  it("2x3 grid: rows by Y, cols by X within row", () => {
    const m = computeMatrix(twoByThree, electrical);
    expect(m.dims).toEqual({ rows: 2, cols: 3 });
    expect(m.keyMatrix.a).toMatchObject({ row: 0, col: 0 });
    expect(m.keyMatrix.b).toMatchObject({ row: 0, col: 1 });
    expect(m.keyMatrix.c).toMatchObject({ row: 0, col: 2 });
    expect(m.keyMatrix.d).toMatchObject({ row: 1, col: 0 });
    expect(m.keyMatrix.f).toMatchObject({ row: 1, col: 2 });
  });

  it("ragged layout: cols = max keys per row", () => {
    const m = computeMatrix(ragged, electrical);
    expect(m.dims).toEqual({ rows: 2, cols: 2 });
    // c is alone in row 1, so its col is 0 (its only key)
    expect(m.keyMatrix.c).toMatchObject({ row: 1, col: 0 });
  });

  it("auto pin assignment: rows first, then cols, in safe-pin order", () => {
    const m = computeMatrix(twoByThree, electrical);
    expect(m.pinmap.rows).toEqual([1, 2]);
    expect(m.pinmap.cols).toEqual([4, 5, 6]);
  });

  it("explicit rowGpios array overrides auto", () => {
    const m = computeMatrix(twoByThree, { ...electrical, rowGpios: [10, 11] });
    expect(m.pinmap.rows).toEqual([10, 11]);
    // cols still auto, picked from safe pins NOT used by rows
    expect(m.pinmap.cols).toEqual([1, 2, 4]);
  });

  it("explicit colGpios array overrides auto", () => {
    const m = computeMatrix(twoByThree, { ...electrical, colGpios: [40, 41, 42] });
    expect(m.pinmap.cols).toEqual([40, 41, 42]);
    expect(m.pinmap.rows).toEqual([1, 2]);
  });

  it("explicit pins on both sides", () => {
    const m = computeMatrix(twoByThree, {
      ...electrical, rowGpios: [10, 11], colGpios: [40, 41, 42],
    });
    expect(m.pinmap.rows).toEqual([10, 11]);
    expect(m.pinmap.cols).toEqual([40, 41, 42]);
  });

  it("returns the unused safe pins", () => {
    const m = computeMatrix(oneKey, electrical);
    // 1 row pin + 1 col pin = 2 used, the rest of SAFE_PINS is unused
    expect(m.unused).not.toContain(m.pinmap.rows[0]);
    expect(m.unused).not.toContain(m.pinmap.cols[0]);
    expect(m.unused.length).toBe(25 - 2);
  });

  it("throws on unknown board", () => {
    expect(() => computeMatrix(oneKey, { ...electrical, board: "zzz" }))
      .toThrow(/unknown board/);
  });

  it("returns empty matrix for empty layout", () => {
    const m = computeMatrix([], electrical);
    expect(m.dims).toEqual({ rows: 0, cols: 0 });
    expect(m.keyMatrix).toEqual({});
  });

  it("groups by floor(y) so 0.25-staggered rows still combine", () => {
    const staggered = [
      { id: "a", x: 0,    y: 0.25, w: 1, h: 1, label: "A" },
      { id: "b", x: 1.5,  y: 0,    w: 1, h: 1, label: "B" },
    ];
    const m = computeMatrix(staggered, electrical);
    expect(m.dims).toEqual({ rows: 1, cols: 2 });
  });
});
```

- [ ] **Step 2: Run tests, verify FAIL**

Run: `cd cad-mcp && npm test`
Expected: All 11 matrix tests fail (module missing).

- [ ] **Step 3: Implement `shared/cad/electrical/matrix.js`**

```js
import { BOARDS } from "./esp32s3.js";

export function computeMatrix(keys, electrical) {
  const board = BOARDS[electrical.board];
  if (!board) throw new Error(`unknown board: ${electrical.board}`);

  if (!keys.length) {
    return { dims: { rows: 0, cols: 0 }, pinmap: { rows: [], cols: [] }, keyMatrix: {}, unused: [...board.SAFE_PINS] };
  }

  // Group by floor(y) → matrix row index
  const rowsByY = new Map();
  for (const k of keys) {
    const ry = Math.floor(k.y);
    if (!rowsByY.has(ry)) rowsByY.set(ry, []);
    rowsByY.get(ry).push(k);
  }
  const sortedYs = [...rowsByY.keys()].sort((a, b) => a - b);

  // Assign keyMatrix: row = order of sortedYs, col = sorted x within row
  const keyMatrix = {};
  let maxCols = 0;
  sortedYs.forEach((y, rowIdx) => {
    const ks = rowsByY.get(y).slice().sort((a, b) => a.x - b.x);
    if (ks.length > maxCols) maxCols = ks.length;
    ks.forEach((k, colIdx) => {
      keyMatrix[k.id] = { row: rowIdx, col: colIdx };
    });
  });
  const dims = { rows: sortedYs.length, cols: maxCols };

  // Pin assignment
  const safe = board.SAFE_PINS;
  const rowPins = pickPins(electrical.rowGpios, dims.rows, safe, []);
  const colPins = pickPins(electrical.colGpios, dims.cols, safe, rowPins);

  // Fill in gpio refs on keyMatrix
  for (const k of keys) {
    const m = keyMatrix[k.id];
    m.gpioRow = rowPins[m.row];
    m.gpioCol = colPins[m.col];
  }

  const used = new Set([...rowPins, ...colPins]);
  const unused = safe.filter((p) => !used.has(p));

  return { dims, pinmap: { rows: rowPins, cols: colPins }, keyMatrix, unused };
}

function pickPins(spec, count, safe, alreadyTaken) {
  if (Array.isArray(spec)) {
    return spec.slice(0, count);
  }
  // "auto" — take from safe minus alreadyTaken
  const taken = new Set(alreadyTaken);
  const out = [];
  for (const p of safe) {
    if (taken.has(p)) continue;
    out.push(p);
    if (out.length === count) break;
  }
  return out;
}
```

- [ ] **Step 4: Run tests, verify PASS**

Run: `cd cad-mcp && npm test`
Expected: All 52 tests pass (41 prior + 11 matrix).

- [ ] **Step 5: Commit**

```bash
git add shared/cad/electrical/matrix.js shared/cad/electrical/test/matrix.test.js
git commit -m "feat(electrical): computeMatrix — physical-row matrix + auto GPIO assignment"
```

---

## Task 4: `validateMatrix`

**Files:**
- Create: `shared/cad/electrical/validateMatrix.js`
- Create: `shared/cad/electrical/test/validateMatrix.test.js`

- [ ] **Step 1: Write failing tests in `shared/cad/electrical/test/validateMatrix.test.js`**

```js
import { describe, it, expect } from "vitest";
import { validateMatrix } from "../validateMatrix.js";
import { DEFAULT_STATE } from "../../schema.js";

const electrical = DEFAULT_STATE.electrical;
const oneKey = [{ id: "k0", x: 0, y: 0, w: 1, h: 1, label: "A" }];

function makeGrid(rows, cols) {
  const ks = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      ks.push({ id: `r${r}c${c}`, x: c, y: r, w: 1, h: 1, label: "" });
    }
  }
  return ks;
}

describe("validateMatrix", () => {
  it("returns [] for a clean one-key layout", () => {
    expect(validateMatrix(oneKey, electrical)).toEqual([]);
  });

  it("flags unknown_board", () => {
    const issues = validateMatrix(oneKey, { ...electrical, board: "wat" });
    expect(issues.some((i) => i.code === "unknown_board")).toBe(true);
  });

  it("flags pin_overflow when matrix needs more pins than safe set has", () => {
    // safe set is 25 pins. A 13-row × 13-col grid needs 26.
    const big = makeGrid(13, 13);
    const issues = validateMatrix(big, electrical);
    expect(issues.some((i) => i.code === "pin_overflow")).toBe(true);
  });

  it("flags unsafe_gpio for explicit array containing a strapping pin", () => {
    const issues = validateMatrix(oneKey, { ...electrical, rowGpios: [0] });
    expect(issues.some((i) => i.code === "unsafe_gpio")).toBe(true);
  });

  it("flags gpio_collision when a pin is in both arrays", () => {
    const issues = validateMatrix(oneKey, {
      ...electrical, rowGpios: [4], colGpios: [4],
    });
    expect(issues.some((i) => i.code === "gpio_collision")).toBe(true);
  });

  it("flags gpio_too_few when explicit array is shorter than dimension", () => {
    const grid = makeGrid(3, 3);
    const issues = validateMatrix(grid, { ...electrical, rowGpios: [4, 5] });
    expect(issues.some((i) => i.code === "gpio_too_few")).toBe(true);
  });

  it("does not flag gpio_too_few when array is longer than dimension", () => {
    const issues = validateMatrix(oneKey, { ...electrical, rowGpios: [4, 5, 6] });
    expect(issues.some((i) => i.code === "gpio_too_few")).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests, verify FAIL**

Run: `cd cad-mcp && npm test`
Expected: 7 validateMatrix tests fail (module missing).

- [ ] **Step 3: Implement `shared/cad/electrical/validateMatrix.js`**

```js
import { BOARDS } from "./esp32s3.js";

export function validateMatrix(keys, electrical) {
  const issues = [];
  const board = BOARDS[electrical.board];
  if (!board) {
    issues.push({ severity: "error", code: "unknown_board", msg: `unknown board: ${electrical.board}` });
    return issues;
  }
  const safeSet = new Set(board.SAFE_PINS);

  // Check explicit arrays for unsafe pins
  for (const which of ["rowGpios", "colGpios"]) {
    const v = electrical[which];
    if (Array.isArray(v)) {
      for (const pin of v) {
        if (!safeSet.has(pin)) {
          issues.push({
            severity: "error",
            code: "unsafe_gpio",
            msg: `${which} includes unsafe pin ${pin} (not in safe set for ${board.id})`,
          });
        }
      }
    }
  }

  // Collision check (intersection of explicit arrays only — auto avoids by construction)
  if (Array.isArray(electrical.rowGpios) && Array.isArray(electrical.colGpios)) {
    const rowSet = new Set(electrical.rowGpios);
    const collisions = electrical.colGpios.filter((p) => rowSet.has(p));
    for (const p of collisions) {
      issues.push({
        severity: "error",
        code: "gpio_collision",
        msg: `pin ${p} appears in both rowGpios and colGpios`,
      });
    }
  }

  // Compute dims to drive the remaining checks
  if (!keys.length) return issues;
  const rowsByY = new Map();
  for (const k of keys) {
    const ry = Math.floor(k.y);
    if (!rowsByY.has(ry)) rowsByY.set(ry, []);
    rowsByY.get(ry).push(k);
  }
  const dimRows = rowsByY.size;
  const dimCols = Math.max(...[...rowsByY.values()].map((r) => r.length));

  // Length checks for explicit arrays
  if (Array.isArray(electrical.rowGpios) && electrical.rowGpios.length < dimRows) {
    issues.push({
      severity: "error", code: "gpio_too_few",
      msg: `rowGpios has ${electrical.rowGpios.length} pins; layout needs ${dimRows}`,
    });
  }
  if (Array.isArray(electrical.colGpios) && electrical.colGpios.length < dimCols) {
    issues.push({
      severity: "error", code: "gpio_too_few",
      msg: `colGpios has ${electrical.colGpios.length} pins; layout needs ${dimCols}`,
    });
  }

  // Overflow against the safe set, considering the auto path
  const explicitRowCount = Array.isArray(electrical.rowGpios) ? electrical.rowGpios.length : 0;
  const explicitColCount = Array.isArray(electrical.colGpios) ? electrical.colGpios.length : 0;
  const need = (Array.isArray(electrical.rowGpios) ? 0 : dimRows)
             + (Array.isArray(electrical.colGpios) ? 0 : dimCols);
  // Pins that auto would have to draw from = safe minus the explicit arrays
  const explicitSet = new Set([
    ...(Array.isArray(electrical.rowGpios) ? electrical.rowGpios : []),
    ...(Array.isArray(electrical.colGpios) ? electrical.colGpios : []),
  ]);
  const availableForAuto = board.SAFE_PINS.filter((p) => !explicitSet.has(p)).length;
  if (need > availableForAuto) {
    issues.push({
      severity: "error", code: "pin_overflow",
      msg: `layout needs ${dimRows} rows + ${dimCols} cols; safe pins available: ${availableForAuto}`,
    });
  }

  return issues;
}
```

- [ ] **Step 4: Run tests, verify PASS**

Run: `cd cad-mcp && npm test`
Expected: All 59 tests pass (52 prior + 7 validateMatrix).

- [ ] **Step 5: Commit**

```bash
git add shared/cad/electrical/validateMatrix.js shared/cad/electrical/test/validateMatrix.test.js
git commit -m "feat(electrical): validateMatrix — overflow, unsafe, collision, too-few"
```

---

## Task 5: MCP tools `getMatrix` + `validateMatrix`

**Files:**
- Create: `cad-mcp/src/electrical.js`
- Modify: `cad-mcp/src/server.js`
- Modify: `cad-mcp/test/server.test.js`

- [ ] **Step 1: Add failing tests**

Append to `cad-mcp/test/server.test.js`, inside the existing `describe("MCP server", () => { ... })` block, just before the closing `});`:

```js
  it("registers nine tools (added getMatrix + validateMatrix)", async () => {
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual([
      "exportPart",
      "getLayout",
      "getMatrix",
      "getState",
      "listParts",
      "measure",
      "setParam",
      "validate",
      "validateMatrix",
    ]);
  });

  it("getMatrix returns the matrix for the seeded layout", async () => {
    const r = await client.callTool({ name: "getMatrix", arguments: {} });
    const json = JSON.parse(r.content[0].text);
    expect(json.dims.rows).toBe(1);
    expect(json.dims.cols).toBe(1);
    expect(json.keyMatrix.k0).toMatchObject({ row: 0, col: 0 });
  });

  it("validateMatrix returns [] for the seeded layout", async () => {
    const r = await client.callTool({ name: "validateMatrix", arguments: {} });
    const json = JSON.parse(r.content[0].text);
    expect(json).toEqual([]);
  });
```

The first existing test in `server.test.js` checks for **seven** tools. Update that test's `expect(names).toEqual([...])` to include the new two and become the same nine-element list. Concretely: replace the existing `it("registers all seven tools", ...)` block with the new nine-element block above (or update the array, then the new dedicated nine-tools test becomes a duplicate — pick one, not both).

**Concrete edit:** delete the existing `it("registers all seven tools", ...)` block entirely and rely on the new `it("registers nine tools (added getMatrix + validateMatrix)", ...)` block.

- [ ] **Step 2: Run tests, verify FAIL**

Run: `cd cad-mcp && npm test`
Expected: 3 new server tests fail (electrical module missing). The deleted "all seven tools" test is gone.

- [ ] **Step 3: Create `cad-mcp/src/electrical.js`**

```js
import { computeMatrix } from "../../shared/cad/electrical/matrix.js";
import { validateMatrix as validateMatrixShared } from "../../shared/cad/electrical/validateMatrix.js";

export function getMatrix(keys, state) {
  return computeMatrix(keys, state.electrical);
}

export function validateMatrix(keys, state) {
  return validateMatrixShared(keys, state.electrical);
}
```

- [ ] **Step 4: Update `cad-mcp/src/server.js`**

In the `TOOLS` array (currently has 7 entries), append two new tool definitions:

```js
    { name: "getMatrix", description: "Compute the row/column matrix and ESP32 GPIO pinmap for the current layout.",
      inputSchema: { type: "object", properties: {} } },
    { name: "validateMatrix", description: "Run matrix validation; returns [] when clean. Codes: unknown_board, pin_overflow, unsafe_gpio, gpio_collision, gpio_too_few.",
      inputSchema: { type: "object", properties: {} } },
```

In the `switch (name)` block of the `CallToolRequestSchema` handler, add two new cases just before the `default:` clause:

```js
      case "getMatrix":
        result = getMatrix(getLayoutFromEnv(), store.read());
        break;
      case "validateMatrix":
        result = validateMatrix(getLayoutFromEnv(), store.read());
        break;
```

At the top of `cad-mcp/src/server.js`, add the import alongside the existing `import { exportPart } from "./exportPart.js";`:

```js
import { getMatrix, validateMatrix } from "./electrical.js";
```

Be careful not to alias-collide with the existing `validate` import. They have different names (`validate` vs `validateMatrix`), so no rename needed — just leave both as-is.

- [ ] **Step 5: Run tests, verify PASS**

Run: `cd cad-mcp && npm test`
Expected: All 62 tests pass (59 prior + 3 new server tests).

- [ ] **Step 6: Commit**

```bash
git add cad-mcp/src/electrical.js cad-mcp/src/server.js cad-mcp/test/server.test.js
git commit -m "feat(cad-mcp): MCP tools getMatrix + validateMatrix"
```

---

## Task 6: SVG wire diagram

**Files:**
- Create: `shared/cad/electrical/wireSvg.js`
- Create: `shared/cad/electrical/test/wireSvg.test.js`

- [ ] **Step 1: Write failing tests in `shared/cad/electrical/test/wireSvg.test.js`**

```js
import { describe, it, expect } from "vitest";
import { renderWireSVG } from "../wireSvg.js";
import { computeMatrix } from "../matrix.js";
import { DEFAULT_STATE } from "../../schema.js";

const electrical = DEFAULT_STATE.electrical;
const plate = DEFAULT_STATE.plate;
const oneKey = [{ id: "k0", x: 0, y: 0, w: 1, h: 1, label: "A" }];
const twoByThree = [
  { id: "a", x: 0, y: 0, w: 1, h: 1, label: "A" },
  { id: "b", x: 1, y: 0, w: 1, h: 1, label: "B" },
  { id: "c", x: 2, y: 0, w: 1, h: 1, label: "C" },
  { id: "d", x: 0, y: 1, w: 1, h: 1, label: "D" },
  { id: "e", x: 1, y: 1, w: 1, h: 1, label: "E" },
  { id: "f", x: 2, y: 1, w: 1, h: 1, label: "F" },
];

describe("renderWireSVG", () => {
  it("returns a string starting with <svg", () => {
    const m = computeMatrix(oneKey, electrical);
    const s = renderWireSVG(oneKey, plate, m);
    expect(typeof s).toBe("string");
    expect(s.startsWith("<svg")).toBe(true);
    expect(s.endsWith("</svg>")).toBe(true);
  });

  it("contains one key rectangle per key", () => {
    const m = computeMatrix(twoByThree, electrical);
    const s = renderWireSVG(twoByThree, plate, m);
    const keyRects = (s.match(/data-key=/g) || []).length;
    expect(keyRects).toBe(6);
  });

  it("contains row labels for each matrix row with GPIO numbers", () => {
    const m = computeMatrix(twoByThree, electrical);
    const s = renderWireSVG(twoByThree, plate, m);
    expect(s).toMatch(/R0:\s?GPIO1/);
    expect(s).toMatch(/R1:\s?GPIO2/);
  });

  it("contains column labels for each matrix col with GPIO numbers", () => {
    const m = computeMatrix(twoByThree, electrical);
    const s = renderWireSVG(twoByThree, plate, m);
    expect(s).toMatch(/C0:\s?GPIO4/);
    expect(s).toMatch(/C2:\s?GPIO6/);
  });

  it("contains diode footprints (one per key)", () => {
    const m = computeMatrix(twoByThree, electrical);
    const s = renderWireSVG(twoByThree, plate, m);
    const diodes = (s.match(/data-diode=/g) || []).length;
    expect(diodes).toBe(6);
  });

  it("contains row trace and column trace classes", () => {
    const m = computeMatrix(twoByThree, electrical);
    const s = renderWireSVG(twoByThree, plate, m);
    expect(s).toMatch(/class="row-trace"/);
    expect(s).toMatch(/class="col-trace"/);
  });

  it("does not crash on empty layout", () => {
    const m = computeMatrix([], electrical);
    const s = renderWireSVG([], plate, m);
    expect(s.startsWith("<svg")).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests, verify FAIL**

Run: `cd cad-mcp && npm test`
Expected: 7 wireSvg tests fail.

- [ ] **Step 3: Implement `shared/cad/electrical/wireSvg.js`**

```js
const UNIT = 19.05;
const DIODE_W = 3.5;     // mm
const DIODE_H = 1.8;     // mm
const DIODE_PAD_PITCH = 7.5; // mm — through-hole DO-35 typical
const LABEL_MARGIN = 25; // mm room for row/col labels around the plate
const TRACE_W = 0.4;     // mm stroke

export function renderWireSVG(keys, plate, matrix) {
  const margin = plate.margin ?? 5;
  const cutout = plate.cutoutSize ?? 14;
  const cornerR = plate.cornerRadius ?? 2;

  // Plate bounding box (mirrors layoutBounds in shared/cad/parts/plate.js)
  const b = layoutBounds(keys, margin);
  const plateW = b.maxX - b.minX;
  const plateH = b.maxY - b.minY;

  const viewW = plateW + LABEL_MARGIN * 2;
  const viewH = plateH + LABEL_MARGIN * 2;

  // SVG-space origin: top-left of viewBox. Convert layout-mm to SVG-mm:
  //   svgX = (lx - b.minX) + LABEL_MARGIN
  //   svgY = (ly - b.minY) + LABEL_MARGIN
  const sx = (lx) => (lx - b.minX) + LABEL_MARGIN;
  const sy = (ly) => (ly - b.minY) + LABEL_MARGIN;

  const out = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewW.toFixed(2)} ${viewH.toFixed(2)}" width="${viewW.toFixed(0)}mm" height="${viewH.toFixed(0)}mm">`);
  out.push(styleBlock());

  // Plate outline
  out.push(`<rect class="plate" x="${sx(b.minX).toFixed(2)}" y="${sy(b.minY).toFixed(2)}" width="${plateW.toFixed(2)}" height="${plateH.toFixed(2)}" rx="${cornerR}" ry="${cornerR}" />`);

  // Per-key cutout + diode
  for (const k of keys) {
    const kw = k.w || 1;
    const kh = k.h || 1;
    const cxMm = (k.x + kw / 2) * UNIT;
    const cyMm = (k.y + kh / 2) * UNIT;
    const x0 = sx(cxMm - cutout / 2);
    const y0 = sy(cyMm - cutout / 2);
    out.push(`<rect data-key="${escapeAttr(k.id)}" class="key" x="${x0.toFixed(2)}" y="${y0.toFixed(2)}" width="${cutout}" height="${cutout}" />`);

    // Diode below the switch
    const dxc = sx(cxMm);
    const dyc = sy(cyMm + DIODE_PAD_PITCH);
    out.push(diodeShape(dxc, dyc, k.id));
  }

  // Row traces — horizontal lines at the row's Y
  if (matrix.dims.rows > 0) {
    const keysByRow = new Map();
    for (const k of keys) {
      const m = matrix.keyMatrix[k.id];
      if (!m) continue;
      if (!keysByRow.has(m.row)) keysByRow.set(m.row, []);
      keysByRow.get(m.row).push(k);
    }
    for (const [rowIdx, rowKeys] of keysByRow.entries()) {
      const ys = rowKeys.map((k) => (k.y + (k.h || 1) / 2) * UNIT);
      const yTrace = ys.reduce((a, b) => a + b, 0) / ys.length;
      const xs = rowKeys.map((k) => (k.x + (k.w || 1) / 2) * UNIT);
      const x1 = sx(Math.min(...xs) - cutout / 2);
      const x2 = sx(Math.max(...xs) + cutout / 2);
      const y = sy(yTrace);
      out.push(`<line class="row-trace" x1="${x1.toFixed(2)}" y1="${y.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y.toFixed(2)}" />`);
      const gpio = matrix.pinmap.rows[rowIdx];
      out.push(`<text class="row-label" x="${(LABEL_MARGIN - 2).toFixed(2)}" y="${y.toFixed(2)}" text-anchor="end" dominant-baseline="middle">R${rowIdx}: GPIO${gpio}</text>`);
    }
  }

  // Column traces — vertical lines through diode cathodes
  if (matrix.dims.cols > 0) {
    const keysByCol = new Map();
    for (const k of keys) {
      const m = matrix.keyMatrix[k.id];
      if (!m) continue;
      if (!keysByCol.has(m.col)) keysByCol.set(m.col, []);
      keysByCol.get(m.col).push(k);
    }
    for (const [colIdx, colKeys] of keysByCol.entries()) {
      const xs = colKeys.map((k) => (k.x + (k.w || 1) / 2) * UNIT);
      const xTrace = xs.reduce((a, b) => a + b, 0) / xs.length;
      const ys = colKeys.map((k) => (k.y + (k.h || 1) / 2) * UNIT + DIODE_PAD_PITCH);
      const y1 = sy(Math.min(...ys) - DIODE_H);
      const y2 = sy(Math.max(...ys) + DIODE_H);
      const x = sx(xTrace);
      out.push(`<line class="col-trace" x1="${x.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x.toFixed(2)}" y2="${y2.toFixed(2)}" />`);
      const gpio = matrix.pinmap.cols[colIdx];
      out.push(`<text class="col-label" x="${x.toFixed(2)}" y="${(LABEL_MARGIN - 2).toFixed(2)}" text-anchor="middle" dominant-baseline="alphabetic">C${colIdx}: GPIO${gpio}</text>`);
    }
  }

  out.push(`</svg>`);
  return out.join("\n");
}

function diodeShape(cx, cy, keyId) {
  const halfW = DIODE_W / 2;
  const halfH = DIODE_H / 2;
  const padR = 0.5;
  const pad1X = cx - DIODE_PAD_PITCH / 2;
  const pad2X = cx + DIODE_PAD_PITCH / 2;
  return [
    `<g data-diode="${escapeAttr(keyId)}">`,
    `  <circle class="diode-pad" cx="${pad1X.toFixed(2)}" cy="${cy.toFixed(2)}" r="${padR}" />`,
    `  <circle class="diode-pad" cx="${pad2X.toFixed(2)}" cy="${cy.toFixed(2)}" r="${padR}" />`,
    `  <line class="diode-lead" x1="${pad1X.toFixed(2)}" y1="${cy.toFixed(2)}" x2="${(cx - halfW).toFixed(2)}" y2="${cy.toFixed(2)}" />`,
    `  <line class="diode-lead" x1="${(cx + halfW).toFixed(2)}" y1="${cy.toFixed(2)}" x2="${pad2X.toFixed(2)}" y2="${cy.toFixed(2)}" />`,
    `  <rect class="diode-body" x="${(cx - halfW).toFixed(2)}" y="${(cy - halfH).toFixed(2)}" width="${DIODE_W}" height="${DIODE_H}" />`,
    `  <line class="diode-cathode" x1="${(cx + halfW * 0.6).toFixed(2)}" y1="${(cy - halfH).toFixed(2)}" x2="${(cx + halfW * 0.6).toFixed(2)}" y2="${(cy + halfH).toFixed(2)}" />`,
    `</g>`,
  ].join("\n");
}

function styleBlock() {
  return `<style>
    .plate { fill: #f5f5f7; stroke: #888; stroke-width: 0.3; }
    .key { fill: #ddd; stroke: #555; stroke-width: 0.25; }
    .row-trace { stroke: #DB1A1A; stroke-width: ${TRACE_W}; fill: none; }
    .col-trace { stroke: #1a4adb; stroke-width: ${TRACE_W}; fill: none; }
    .diode-pad { fill: #c8a000; }
    .diode-lead { stroke: #888; stroke-width: 0.2; }
    .diode-body { fill: #2a2a2a; stroke: #000; stroke-width: 0.1; }
    .diode-cathode { stroke: #fff; stroke-width: 0.4; }
    .row-label, .col-label { font: bold 3px sans-serif; fill: #222; }
  </style>`;
}

function escapeAttr(s) {
  return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function layoutBounds(keys, margin) {
  if (!keys.length) return { minX: 0, minY: 0, maxX: UNIT, maxY: UNIT };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const k of keys) {
    const kw = k.w || 1, kh = k.h || 1;
    minX = Math.min(minX, k.x * UNIT);
    minY = Math.min(minY, k.y * UNIT);
    maxX = Math.max(maxX, (k.x + kw) * UNIT);
    maxY = Math.max(maxY, (k.y + kh) * UNIT);
  }
  return { minX: minX - margin, minY: minY - margin, maxX: maxX + margin, maxY: maxY + margin };
}
```

- [ ] **Step 4: Run tests, verify PASS**

Run: `cd cad-mcp && npm test`
Expected: All 69 tests pass (62 prior + 7 wireSvg).

- [ ] **Step 5: Commit**

```bash
git add shared/cad/electrical/wireSvg.js shared/cad/electrical/test/wireSvg.test.js
git commit -m "feat(electrical): renderWireSVG — printable wire diagram"
```

---

## Task 7: Browser export buttons

**Files:**
- Modify: `src/cad/exportClient.js`
- Modify: `src/components/App.jsx`

- [ ] **Step 1: Extend `src/cad/exportClient.js`**

Append the following to the existing `exportClient.js` (after `downloadPlate`):

```js
import { computeMatrix } from "../../shared/cad/electrical/matrix";
import { renderWireSVG } from "../../shared/cad/electrical/wireSvg";

export function downloadPinmap(keys, cadState) {
  const matrix = computeMatrix(keys, cadState.electrical);
  const json = JSON.stringify(matrix, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  triggerDownload(blob, "pinmap.json");
}

export function downloadWireSvg(keys, cadState) {
  const matrix = computeMatrix(keys, cadState.electrical);
  const svg = renderWireSVG(keys, cadState.plate, matrix);
  const blob = new Blob([svg], { type: "image/svg+xml" });
  triggerDownload(blob, "wire.svg");
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
```

The existing `downloadPlate` uses inline anchor-trigger code. Refactor it to use the new shared `triggerDownload` helper. Final shape of `downloadPlate`:

```js
export async function downloadPlate(keys, plateSettings, format) {
  if (format !== "stl" && format !== "step") {
    throw new Error(`unknown format: ${format}`);
  }
  await initCad();
  const solid = buildPlate(keys, plateSettings);
  const blob = format === "stl" ? solid.blobSTL() : solid.blobSTEP();
  triggerDownload(blob, `plate.${format}`);
}
```

- [ ] **Step 2: Modify `src/components/App.jsx` — add the two buttons + import**

In the imports section (top of file), update the existing `exportClient` import:

```jsx
import { downloadPlate, downloadPinmap, downloadWireSvg } from "../cad/exportClient";
```

In the export bar (currently has SVG, DXF, STEP, STL, JSON, CSV buttons), add two new entries between the STL button and the JSON button:

```jsx
              <ExportBtn label="Pinmap" sub="JSON" onClick={() => downloadPinmap(keys, cadState)} />
              <ExportBtn label="Wire" sub="SVG" onClick={() => downloadWireSvg(keys, cadState)} />
```

These need `cadState` to be in scope. App.jsx already destructures `state: cadState` from `useCadState()` — verify the variable is named `cadState` and reachable from where the export buttons render. If it's not in scope, you'll need to pull it down from where it's defined to where the export bar renders (it should be — the destructure is near the top of the component).

- [ ] **Step 3: Smoke test**

Run: `npm run dev -- --port 5192` in the background. Wait for "ready in" in the output. Then:

```
curl -s http://localhost:5192/__cad_state | head -3
```

Expected: JSON containing `electrical`. If `electrical` is missing, the existing `cad-state.json` from prior development is stale — delete it and re-run dev so `state.read()` re-seeds with the new DEFAULT_STATE. Concretely:

```
rm cad-state.json
```

then re-fetch GET — `electrical` should now appear.

You can't browser-test the buttons from a non-interactive subagent. Defer that to the user's manual smoke. Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add src/cad/exportClient.js src/components/App.jsx
git commit -m "feat(cad): UI — Pinmap (JSON) and Wire (SVG) export buttons"
```

---

## Task 8: End-to-end smoke verification

- [ ] **Step 1: All tests still pass**

Run: `cd cad-mcp && npm test`
Expected: 69 passing.

- [ ] **Step 2: Stale state cleanup**

If `cad-state.json` still exists from prior development, delete it so the new schema seeds cleanly:

```
rm cad-state.json
```

- [ ] **Step 3: Start dev server**

Run: `npm run dev` (foreground or background; use a free port).

Open the CAD tab, confirm it renders.

- [ ] **Step 4: Verify Pinmap button**

Click "Pinmap" in the export bar. Browser downloads `pinmap.json`. Open it — should be a JSON object with `dims`, `pinmap.rows`, `pinmap.cols`, `keyMatrix`, `unused`.

- [ ] **Step 5: Verify Wire button**

Click "Wire". Browser downloads `wire.svg`. Open it in a browser — should show the plate outline, key squares, diode footprints, red row traces, blue column traces, GPIO labels at the margins.

- [ ] **Step 6: Verify the AI path (manual MCP smoke)**

In a fresh Claude Code session in this repo, ask:
> "Use the nanun-cad tools to compute the matrix for the current layout. How many rows and columns? What are the row GPIOs?"

Expected: AI calls `getMatrix`, reports dims and pin assignments.

Then:
> "Set rowGpios to [10, 11, 12, 13, 14] and validate. Any issues?"

Expected: AI calls `setParam` then `validateMatrix`, reports `[]` (clean) or specific issues. The `wire.svg` re-download should reflect the new GPIOs.

- [ ] **Step 7: Cleanup**

Stop the dev server. Don't commit anything in this task — verification only.

---

## Self-review notes

(Author check — fix inline before handoff.)

- **Spec coverage:**
  - Schema additions ✓ (Task 1)
  - ESP32-S3 SAFE_PINS ✓ (Task 2)
  - computeMatrix with physical-row strategy + auto pin selection ✓ (Task 3)
  - validateMatrix with all 5 issue codes (`unknown_board`, `pin_overflow`, `unsafe_gpio`, `gpio_collision`, `gpio_too_few`) ✓ (Task 4)
  - MCP tools `getMatrix` + `validateMatrix` ✓ (Task 5)
  - SVG wire diagram ✓ (Task 6)
  - Browser download buttons ✓ (Task 7)
  - E2E smoke ✓ (Task 8)
  - "Diode placement (logical)" — covered via `wireSvg.js` `diodeShape()` (Task 6)
  - "Diode direction col2row" — schema accepts `row2col` too, but `wireSvg` MVP renders col2row layout only. The state value is read but not yet branched on in rendering. This is acceptable for the MVP — the spec defers full row2col rendering as polish — but worth noting.

- **Placeholder scan:** No TBDs. The diode-direction MVP scope is explicit, not vague.

- **Type consistency:**
  - `computeMatrix` signature: `(keys, electrical)` everywhere
  - `validateMatrix` signature: `(keys, electrical)` everywhere
  - `renderWireSVG` signature: `(keys, plate, matrix)` everywhere
  - MCP wrappers in `cad-mcp/src/electrical.js` take `(keys, state)` and pass `state.electrical` through
  - Issue object shape `{ severity, code, msg }` consistent with existing `validate.js` / `validateGeometric.js`
  - `keyMatrix[k.id]` shape: `{ row, col, gpioRow, gpioCol }` consistent across matrix, validateMatrix, wireSvg

- **Scope:** Single coherent plan. ~10 file additions + 5 file modifications. Manageable.
