# CAD AI-Tooling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the CAD tab driveable by both a human (existing UI controls) and an AI agent (Claude Code) through a shared, file-backed state and a small MCP tool surface.

**Architecture:** A new Node MCP server (`cad-mcp/`) and the existing Vite app both read/write a single `cad-state.json` at the repo root. A shared module (`shared/cad/`) holds the parametric part definitions and state schema so the same code runs in Node and in the browser. The browser auto-syncs via a small Vite plugin that watches the JSON file and exposes a POST endpoint for UI writes.

**Tech Stack:** Node MCP server (`@modelcontextprotocol/sdk`), `replicad` + `replicad-opencascadejs` (already in the app), Vite 6 + React 18 (existing), Vitest for the new Node package only.

---

## Spec reference

Implements `docs/superpowers/specs/2026-05-07-cad-ai-tooling-design.md`. Read it before starting.

## Conventions

- Test runner is **Vitest**, scoped to `cad-mcp/` only. The browser app stays test-free for this iteration.
- Every code task is TDD: write a failing test, run it (see it fail), implement, run it (see it pass), commit.
- Commit messages: short, imperative, subject only. Co-author trailer is fine but not required.
- **Never push or open PRs without explicit user request** (per repo `CLAUDE.md`).
- Run commands from the repo root unless stated.

---

## File structure (decisions locked in)

**New files:**

- `cad-mcp/package.json` — Node MCP server package
- `cad-mcp/vitest.config.js`
- `cad-mcp/src/server.js` — MCP stdio entrypoint, registers tools
- `cad-mcp/src/state.js` — read/write `cad-state.json` atomically
- `cad-mcp/src/occt.js` — Node OCCT lazy loader
- `cad-mcp/src/measure.js` — bounding box, volume, key/cutout positions
- `cad-mcp/src/validate.js` — manifold + topology checks
- `cad-mcp/src/exportPart.js` — STEP / STL writer with path validation
- `cad-mcp/test/state.test.js`
- `cad-mcp/test/measure.test.js`
- `cad-mcp/test/validate.test.js`
- `cad-mcp/test/exportPart.test.js`
- `cad-mcp/test/fixtures/oneKey.js` — minimal `keys[]` fixture used in tests
- `shared/cad/schema.js` — DEFAULT_STATE, PARAM_SCHEMA, validateParam(path, value)
- `shared/cad/parts/plate.js` — `buildPlate(keys, plateParams)` → replicad Solid (moved from `src/cad/buildPlate.js`)
- `shared/cad/test/plate.test.js`
- `vite-plugin-cad-state.js` — file watcher + POST endpoint
- `src/cad/syncState.js` — `useCadState()` hook
- `.mcp.json` — registers `nanun-cad` server for Claude Code
- `README-cad-mcp.md` — short doc on talking to the CAD via Claude Code

**Modified files:**

- `src/cad/buildPlate.js` — becomes a one-line re-export of `shared/cad/parts/plate.js`
- `src/components/CadView.jsx` — reads `state.plate` from `useCadState()` instead of `props.plateSettings`
- `src/components/App.jsx` — plate controls (lines ~408–424) write through `setParam("plate.<field>", value)` instead of `setPlateSettings`; remove local `plateSettings` state and derive from `useCadState()`
- `vite.config.js` — add `cadStatePlugin()` to plugins
- `package.json` (root) — add `dev:mcp` script and `npm i` workspace pointer if needed
- `.gitignore` — add `cad-state.json`

---

## Task 1: Scaffold cad-mcp package

**Files:**
- Create: `cad-mcp/package.json`
- Create: `cad-mcp/vitest.config.js`
- Modify: `package.json` (root, add `dev:mcp` script)

- [ ] **Step 1: Create `cad-mcp/package.json`**

```json
{
  "name": "nanun-cad-mcp",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "src/server.js",
  "bin": {
    "nanun-cad-mcp": "src/server.js"
  },
  "scripts": {
    "start": "node src/server.js",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "replicad": "^0.23.1",
    "replicad-opencascadejs": "^0.23.0"
  },
  "devDependencies": {
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: Create `cad-mcp/vitest.config.js`**

```js
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.js"],
    testTimeout: 30000, // OCCT WASM init can take a few seconds
  },
});
```

- [ ] **Step 3: Modify root `package.json` scripts**

Replace the `scripts` block in the root `package.json` with:

```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "preview": "vite preview",
  "dev:mcp": "node cad-mcp/src/server.js",
  "test:mcp": "npm --prefix cad-mcp test"
}
```

- [ ] **Step 4: Install dependencies**

Run: `cd cad-mcp && npm install`
Expected: `node_modules/` populated, no errors.

- [ ] **Step 5: Verify vitest runs**

Run: `cd cad-mcp && npm test`
Expected: "No test files found" (success exit code 0).

- [ ] **Step 6: Commit**

```bash
git add cad-mcp/package.json cad-mcp/vitest.config.js cad-mcp/package-lock.json package.json
git commit -m "feat(cad-mcp): scaffold node mcp server package"
```

---

## Task 2: Shared state schema

**Files:**
- Create: `shared/cad/schema.js`
- Create: `cad-mcp/test/schema.test.js`

- [ ] **Step 1: Write failing tests in `cad-mcp/test/schema.test.js`**

```js
import { describe, it, expect } from "vitest";
import { DEFAULT_STATE, validateParam, PARAM_PATHS } from "../../shared/cad/schema.js";

describe("schema", () => {
  it("DEFAULT_STATE matches spec shape", () => {
    expect(DEFAULT_STATE).toEqual({
      schemaVersion: 1,
      plate: { thickness: 1.5, margin: 5, cornerRadius: 2, cutoutSize: 14.0 },
      parts: ["plate"],
    });
  });

  it("PARAM_PATHS lists every settable path", () => {
    expect(PARAM_PATHS).toEqual([
      "plate.thickness",
      "plate.margin",
      "plate.cornerRadius",
      "plate.cutoutSize",
    ]);
  });

  it("validateParam accepts in-range values", () => {
    expect(validateParam("plate.thickness", 1.5)).toEqual({ ok: true });
    expect(validateParam("plate.thickness", 0.5)).toEqual({ ok: true });
    expect(validateParam("plate.thickness", 6)).toEqual({ ok: true });
  });

  it("validateParam rejects out-of-range values", () => {
    const r = validateParam("plate.thickness", 0);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/min/);
  });

  it("validateParam rejects wrong types", () => {
    const r = validateParam("plate.thickness", "thick");
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/number/);
  });

  it("validateParam rejects unknown paths", () => {
    const r = validateParam("plate.unknown", 1);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/unknown/i);
  });
});
```

- [ ] **Step 2: Run tests, verify FAIL**

Run: `cd cad-mcp && npm test`
Expected: All tests fail with "Cannot find module …/shared/cad/schema.js".

- [ ] **Step 3: Implement `shared/cad/schema.js`**

```js
export const DEFAULT_STATE = {
  schemaVersion: 1,
  plate: { thickness: 1.5, margin: 5, cornerRadius: 2, cutoutSize: 14.0 },
  parts: ["plate"],
};

const SPECS = {
  "plate.thickness":   { type: "number", min: 0.5, max: 6 },
  "plate.margin":      { type: "number", min: 0,   max: 30 },
  "plate.cornerRadius":{ type: "number", min: 0,   max: 10 },
  "plate.cutoutSize":  { type: "number", min: 12,  max: 16 },
};

export const PARAM_PATHS = Object.keys(SPECS);

export function validateParam(path, value) {
  const spec = SPECS[path];
  if (!spec) return { ok: false, error: `unknown param path: ${path}` };
  if (spec.type === "number") {
    if (typeof value !== "number" || Number.isNaN(value)) {
      return { ok: false, error: `expected number, got ${typeof value}` };
    }
    if (value < spec.min) return { ok: false, error: `below min ${spec.min}` };
    if (value > spec.max) return { ok: false, error: `above max ${spec.max}` };
  }
  return { ok: true };
}

// Helper used by state.js — read/write nested paths like "plate.thickness".
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
Expected: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add shared/cad/schema.js cad-mcp/test/schema.test.js
git commit -m "feat(cad): shared state schema and param validation"
```

---

## Task 3: State persistence

**Files:**
- Create: `cad-mcp/src/state.js`
- Create: `cad-mcp/test/state.test.js`

- [ ] **Step 1: Write failing tests in `cad-mcp/test/state.test.js`**

```js
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createStateStore } from "../src/state.js";
import { DEFAULT_STATE } from "../../shared/cad/schema.js";

let dir;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "cad-state-")); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

describe("state store", () => {
  it("readState seeds DEFAULT_STATE if file is missing", () => {
    const store = createStateStore(join(dir, "cad-state.json"));
    expect(store.read()).toEqual(DEFAULT_STATE);
    expect(existsSync(join(dir, "cad-state.json"))).toBe(true);
  });

  it("writeState persists to disk atomically", () => {
    const file = join(dir, "cad-state.json");
    const store = createStateStore(file);
    store.read();
    store.write({ ...DEFAULT_STATE, plate: { ...DEFAULT_STATE.plate, thickness: 2.0 } });
    const onDisk = JSON.parse(readFileSync(file, "utf8"));
    expect(onDisk.plate.thickness).toBe(2.0);
  });

  it("setParam updates one path and persists", () => {
    const file = join(dir, "cad-state.json");
    const store = createStateStore(file);
    store.read();
    const result = store.setParam("plate.thickness", 1.8);
    expect(result.ok).toBe(true);
    expect(store.read().plate.thickness).toBe(1.8);
  });

  it("setParam rejects invalid values without touching disk", () => {
    const file = join(dir, "cad-state.json");
    const store = createStateStore(file);
    store.read();
    const before = readFileSync(file, "utf8");
    const result = store.setParam("plate.thickness", -1);
    expect(result.ok).toBe(false);
    expect(readFileSync(file, "utf8")).toBe(before);
  });

  it("read picks up external file edits", () => {
    const file = join(dir, "cad-state.json");
    const store = createStateStore(file);
    store.read();
    const edited = { ...DEFAULT_STATE, plate: { ...DEFAULT_STATE.plate, thickness: 3 } };
    writeFileSync(file, JSON.stringify(edited));
    expect(store.read().plate.thickness).toBe(3);
  });
});
```

- [ ] **Step 2: Run tests, verify FAIL**

Run: `cd cad-mcp && npm test`
Expected: All five tests fail with "Cannot find module …/state.js".

- [ ] **Step 3: Implement `cad-mcp/src/state.js`**

```js
import { existsSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { dirname, join } from "node:path";
import { DEFAULT_STATE, validateParam, setAtPath } from "../../shared/cad/schema.js";

export function createStateStore(filePath) {
  function read() {
    if (!existsSync(filePath)) {
      writeAtomic(filePath, DEFAULT_STATE);
      return structuredClone(DEFAULT_STATE);
    }
    const raw = readFileSync(filePath, "utf8");
    try {
      return JSON.parse(raw);
    } catch (e) {
      throw new Error(`cad-state.json is not valid JSON: ${e.message}`);
    }
  }

  function write(state) {
    writeAtomic(filePath, state);
  }

  function setParam(path, value) {
    const v = validateParam(path, value);
    if (!v.ok) return v;
    const next = read();
    setAtPath(next, path, value);
    write(next);
    return { ok: true, state: next };
  }

  return { read, write, setParam, filePath };
}

function writeAtomic(filePath, obj) {
  const tmp = join(dirname(filePath), `.${Math.random().toString(36).slice(2)}.tmp`);
  writeFileSync(tmp, JSON.stringify(obj, null, 2));
  renameSync(tmp, filePath);
}
```

- [ ] **Step 4: Run tests, verify PASS**

Run: `cd cad-mcp && npm test`
Expected: All 11 tests pass (6 schema + 5 state).

- [ ] **Step 5: Commit**

```bash
git add cad-mcp/src/state.js cad-mcp/test/state.test.js
git commit -m "feat(cad-mcp): file-backed state store with atomic writes"
```

---

## Task 4: Move plate builder to shared/

**Files:**
- Create: `shared/cad/parts/plate.js`
- Modify: `src/cad/buildPlate.js` (becomes re-export)
- Create: `cad-mcp/test/fixtures/oneKey.js`
- Create: `shared/cad/test/plate.test.js` (run via cad-mcp's vitest)
- Modify: `cad-mcp/vitest.config.js` (include shared tests)

- [ ] **Step 1: Update vitest config to include shared tests**

Replace `cad-mcp/vitest.config.js` with:

```js
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.js", "../shared/**/test/*.test.js"],
    testTimeout: 30000,
  },
});
```

- [ ] **Step 2: Create `cad-mcp/test/fixtures/oneKey.js`**

```js
// Single 1u key at origin — the smallest layout that produces a valid plate.
export const oneKeyLayout = [
  { id: "k0", x: 0, y: 0, w: 1, h: 1, label: "A" },
];
```

- [ ] **Step 3: Write failing test in `shared/cad/test/plate.test.js`**

```js
import { describe, it, expect, beforeAll } from "vitest";
import { initOCCT } from "../../../cad-mcp/src/occt.js";
import { buildPlate } from "../parts/plate.js";
import { oneKeyLayout } from "../../../cad-mcp/test/fixtures/oneKey.js";

beforeAll(async () => { await initOCCT(); });

describe("buildPlate", () => {
  it("produces a Solid for a one-key layout", () => {
    const solid = buildPlate(oneKeyLayout, { thickness: 1.5, margin: 5, cornerRadius: 2, cutoutSize: 14 });
    expect(solid).toBeDefined();
    const mesh = solid.mesh({ tolerance: 0.1, angularTolerance: 30 });
    expect(mesh.vertices.length).toBeGreaterThan(0);
    expect(mesh.triangles.length).toBeGreaterThan(0);
  });

  it("respects cutoutSize parameter", () => {
    const small = buildPlate(oneKeyLayout, { thickness: 1.5, margin: 5, cornerRadius: 2, cutoutSize: 13 });
    const large = buildPlate(oneKeyLayout, { thickness: 1.5, margin: 5, cornerRadius: 2, cutoutSize: 15 });
    // Larger cutout removes more material — bounding box stays the same but volume drops.
    const vSmall = small.boundingBox.bounds;
    const vLarge = large.boundingBox.bounds;
    expect(vSmall).toEqual(vLarge); // outer dimensions unchanged
  });
});
```

(`initOCCT` doesn't exist yet — this test fails on import. Task 5 implements it. Order matters: Task 5 must run before this test passes.)

- [ ] **Step 4: Implement `shared/cad/parts/plate.js`**

```js
import { drawRoundedRectangle, drawRectangle } from "replicad";

const UNIT = 19.05;

// Build the switch plate as a parametric replicad Solid.
// Layout +Y maps to CAD -Y so the back of the keyboard ends up at +Y.
export function buildPlate(keys, params) {
  const margin       = params.margin       ?? 5;
  const thickness    = params.thickness    ?? 1.5;
  const cornerRadius = params.cornerRadius ?? 2;
  const cutoutSize   = params.cutoutSize   ?? 14;

  const b = layoutBounds(keys, margin);
  const w = b.maxX - b.minX;
  const h = b.maxY - b.minY;
  const midX = (b.minX + b.maxX) / 2;
  const midY = (b.minY + b.maxY) / 2;

  let outline =
    cornerRadius > 0
      ? drawRoundedRectangle(w, h, cornerRadius)
      : drawRectangle(w, h);

  for (const k of keys) {
    const kw = k.w || 1;
    const kh = k.h || 1;
    const isISO = isISOEnter(k);
    const lx = isISO ? (k.x - 0.25) * UNIT : k.x * UNIT;
    const cx = lx + (kw * UNIT) / 2;
    const cy = k.y * UNIT + (kh * UNIT) / 2;
    const px = cx - midX;
    const py = -(cy - midY);
    outline = outline.cut(drawRectangle(cutoutSize, cutoutSize).translate([px, py]));
  }

  return outline.sketchOnPlane().extrude(thickness);
}

// Mirrored from src/utils.js — kept here so this module has no app-side imports.
function isISOEnter(k) {
  const w = k.w || 1, h = k.h || 1;
  return w >= 1.25 && w <= 1.5 && h >= 2 && /^(Enter|Ent|↵|Return)$/i.test(k.label || "");
}

function layoutBounds(keys, margin) {
  if (!keys.length) return { minX: 0, minY: 0, maxX: UNIT, maxY: UNIT };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const k of keys) {
    const kw = k.w || 1, kh = k.h || 1;
    const isISO = isISOEnter(k);
    const lx = isISO ? (k.x - 0.25) * UNIT : k.x * UNIT;
    minX = Math.min(minX, lx);
    minY = Math.min(minY, k.y * UNIT);
    maxX = Math.max(maxX, lx + kw * UNIT);
    maxY = Math.max(maxY, k.y * UNIT + kh * UNIT);
  }
  return { minX: minX - margin, minY: minY - margin, maxX: maxX + margin, maxY: maxY + margin };
}
```

- [ ] **Step 5: Replace `src/cad/buildPlate.js` with a re-export**

Replace the entire contents of `src/cad/buildPlate.js` with:

```js
// The plate builder lives in `shared/cad/parts/plate.js` so that both the
// browser app and the Node MCP server use the same geometry definition.
// This module adapts the browser's existing call shape to the shared API.
import { buildPlate as buildPlateShared } from "../../shared/cad/parts/plate.js";

export function buildPlate(keys, opts = {}) {
  return buildPlateShared(keys, {
    thickness:    opts.thickness    ?? 1.5,
    margin:       opts.margin       ?? 5,
    cornerRadius: opts.cornerRadius ?? 2,
    cutoutSize:   opts.cutoutSize   ?? 14,
  });
}
```

- [ ] **Step 6: Defer running tests**

Tests for this task depend on Task 5 (`initOCCT`). Don't run yet.

- [ ] **Step 7: Commit**

```bash
git add shared/cad/parts/plate.js shared/cad/test/plate.test.js cad-mcp/test/fixtures/oneKey.js cad-mcp/vitest.config.js src/cad/buildPlate.js
git commit -m "refactor(cad): move plate builder to shared/ for node + browser reuse"
```

---

## Task 5: Node OCCT init

**Files:**
- Create: `cad-mcp/src/occt.js`

- [ ] **Step 1: Implement `cad-mcp/src/occt.js`**

```js
// Loads OpenCascade WASM in Node and registers it with replicad.
// Lazy + memoized: first call kicks off the ~12MB WASM compile, subsequent
// calls reuse the same promise.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";
import { setOC } from "replicad";

let initPromise = null;

export function initOCCT() {
  if (!initPromise) initPromise = doInit();
  return initPromise;
}

async function doInit() {
  // Resolve the WASM file path relative to the package install location.
  const here = dirname(fileURLToPath(import.meta.url));
  const wasmPath = join(here, "..", "node_modules", "replicad-opencascadejs", "src", "replicad_single.wasm");

  // The Emscripten loader expects either `locateFile` or a synchronous
  // `wasmBinary`. We pre-read the bytes to avoid filesystem race conditions.
  const wasmBinary = readFileSync(wasmPath);

  const opencascade = (await import("replicad-opencascadejs/src/replicad_single.js")).default;
  const OC = await opencascade({ wasmBinary });
  setOC(OC);
  return OC;
}
```

- [ ] **Step 2: Run plate tests from Task 4**

Run: `cd cad-mcp && npm test`
Expected: All 13 tests pass (schema 6 + state 5 + plate 2).

If `replicad-opencascadejs/src/replicad_single.js` is not resolvable from `cad-mcp/`, install the dep there: `cd cad-mcp && npm install replicad replicad-opencascadejs`. (Already in `package.json` from Task 1; only needed if the lockfile didn't pick them up.)

- [ ] **Step 3: Commit**

```bash
git add cad-mcp/src/occt.js
git commit -m "feat(cad-mcp): node OCCT lazy loader"
```

---

## Task 6: Measure module

**Files:**
- Create: `cad-mcp/src/measure.js`
- Create: `cad-mcp/test/measure.test.js`

- [ ] **Step 1: Write failing tests in `cad-mcp/test/measure.test.js`**

```js
import { describe, it, expect, beforeAll } from "vitest";
import { initOCCT } from "../src/occt.js";
import { measure } from "../src/measure.js";
import { buildPlate } from "../../shared/cad/parts/plate.js";
import { DEFAULT_STATE } from "../../shared/cad/schema.js";
import { oneKeyLayout } from "./fixtures/oneKey.js";

beforeAll(async () => { await initOCCT(); });

const plate = () => buildPlate(oneKeyLayout, DEFAULT_STATE.plate);

describe("measure", () => {
  it("boundingBox returns axis-aligned extents", () => {
    const r = measure({ kind: "boundingBox", part: "plate" }, oneKeyLayout, DEFAULT_STATE);
    expect(r).toMatchObject({
      kind: "boundingBox",
      min: { x: expect.any(Number), y: expect.any(Number), z: expect.any(Number) },
      max: { x: expect.any(Number), y: expect.any(Number), z: expect.any(Number) },
    });
    // 1u plate with 5mm margin = 19.05 + 10 = 29.05mm wide.
    expect(r.max.x - r.min.x).toBeCloseTo(29.05, 1);
    expect(r.max.z - r.min.z).toBeCloseTo(1.5, 2);
  });

  it("partVolume returns mm^3", () => {
    const r = measure({ kind: "partVolume", part: "plate" }, oneKeyLayout, DEFAULT_STATE);
    expect(r.kind).toBe("partVolume");
    // 29.05 x 29.05 x 1.5 minus 14x14x1.5 cutout ≈ 1265 - 294 ≈ 971.
    expect(r.volume).toBeGreaterThan(900);
    expect(r.volume).toBeLessThan(1100);
  });

  it("keyPositions returns one entry per key with center coords", () => {
    const r = measure({ kind: "keyPositions" }, oneKeyLayout, DEFAULT_STATE);
    expect(r.kind).toBe("keyPositions");
    expect(r.positions).toHaveLength(1);
    expect(r.positions[0]).toMatchObject({ id: "k0", center: expect.any(Object) });
  });

  it("cutoutPositions returns plate-relative cutout centers", () => {
    const r = measure({ kind: "cutoutPositions", part: "plate" }, oneKeyLayout, DEFAULT_STATE);
    expect(r.kind).toBe("cutoutPositions");
    expect(r.positions).toHaveLength(1);
    expect(r.positions[0].size).toBe(14);
  });

  it("rejects unknown kinds", () => {
    expect(() => measure({ kind: "weight" }, oneKeyLayout, DEFAULT_STATE)).toThrow(/unknown/);
  });
});
```

- [ ] **Step 2: Run tests, verify FAIL**

Run: `cd cad-mcp && npm test`
Expected: 5 measure tests fail.

- [ ] **Step 3: Implement `cad-mcp/src/measure.js`**

```js
import { buildPlate } from "../../shared/cad/parts/plate.js";

const UNIT = 19.05;

export function measure(query, keys, state) {
  const { kind } = query;
  switch (kind) {
    case "boundingBox":      return boundingBox(query, keys, state);
    case "partVolume":       return partVolume(query, keys, state);
    case "keyPositions":     return keyPositions(keys);
    case "cutoutPositions":  return cutoutPositions(keys, state);
    default: throw new Error(`unknown measure kind: ${kind}`);
  }
}

function getPart(part, keys, state) {
  if (part !== "plate") throw new Error(`unknown part: ${part}`);
  return buildPlate(keys, state.plate);
}

function boundingBox(query, keys, state) {
  const solid = getPart(query.part || "plate", keys, state);
  const bb = solid.boundingBox;
  const [minX, minY, minZ] = bb.bounds[0];
  const [maxX, maxY, maxZ] = bb.bounds[1];
  return {
    kind: "boundingBox",
    min: { x: minX, y: minY, z: minZ },
    max: { x: maxX, y: maxY, z: maxZ },
  };
}

function partVolume(query, keys, state) {
  const solid = getPart(query.part || "plate", keys, state);
  return { kind: "partVolume", volume: solid.volume };
}

function keyPositions(keys) {
  const positions = keys.map((k) => {
    const kw = k.w || 1, kh = k.h || 1;
    const cx = (k.x + kw / 2) * UNIT;
    const cy = (k.y + kh / 2) * UNIT;
    return { id: k.id, label: k.label, center: { x: cx, y: cy }, w: kw, h: kh };
  });
  return { kind: "keyPositions", positions };
}

function cutoutPositions(keys, state) {
  const cutoutSize = state.plate.cutoutSize;
  const positions = keys.map((k) => {
    const kw = k.w || 1, kh = k.h || 1;
    const cx = (k.x + kw / 2) * UNIT;
    const cy = (k.y + kh / 2) * UNIT;
    return { id: k.id, center: { x: cx, y: cy }, size: cutoutSize };
  });
  return { kind: "cutoutPositions", positions };
}
```

- [ ] **Step 4: Run tests, verify PASS**

Run: `cd cad-mcp && npm test`
Expected: All 18 tests pass.

- [ ] **Step 5: Commit**

```bash
git add cad-mcp/src/measure.js cad-mcp/test/measure.test.js
git commit -m "feat(cad-mcp): measure module — bbox, volume, key/cutout positions"
```

---

## Task 7: Validate module

**Files:**
- Create: `cad-mcp/src/validate.js`
- Create: `cad-mcp/test/validate.test.js`

- [ ] **Step 1: Write failing tests in `cad-mcp/test/validate.test.js`**

```js
import { describe, it, expect, beforeAll } from "vitest";
import { initOCCT } from "../src/occt.js";
import { validate } from "../src/validate.js";
import { DEFAULT_STATE } from "../../shared/cad/schema.js";
import { oneKeyLayout } from "./fixtures/oneKey.js";

beforeAll(async () => { await initOCCT(); });

describe("validate", () => {
  it("returns [] for a clean one-key plate", () => {
    const issues = validate(oneKeyLayout, DEFAULT_STATE);
    expect(issues).toEqual([]);
  });

  it("flags overlapping cutouts (two keys at the same position)", () => {
    const overlapping = [
      { id: "a", x: 0, y: 0, w: 1, h: 1, label: "A" },
      { id: "b", x: 0.3, y: 0, w: 1, h: 1, label: "B" }, // overlaps a
    ];
    const issues = validate(overlapping, DEFAULT_STATE);
    expect(issues.some((i) => i.code === "overlapping_cutouts")).toBe(true);
  });

  it("flags an empty layout", () => {
    const issues = validate([], DEFAULT_STATE);
    expect(issues.some((i) => i.code === "empty_layout")).toBe(true);
  });

  it("flags cutouts that punch through margin (key too close to edge)", () => {
    const tightMargin = { ...DEFAULT_STATE, plate: { ...DEFAULT_STATE.plate, margin: 1, cutoutSize: 14 } };
    // 1u (19.05) with margin 1 = 21.05 wide. 14mm cutout centered = 7mm gap = OK.
    // But raise cutoutSize to 16 with the same margin and gap is 6mm — still OK.
    // Make it pathological: margin 0 + cutout 16: gap = (19.05 - 16)/2 + 0 ≈ 1.5mm — still solid.
    // For this test we use margin -2 (negative shrinks plate) so cutout exceeds outline.
    const broken = { ...DEFAULT_STATE, plate: { ...DEFAULT_STATE.plate, margin: -10 } };
    const issues = validate(oneKeyLayout, broken);
    expect(issues.some((i) => i.code === "cutout_outside_plate" || i.code === "invalid_dimensions")).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests, verify FAIL**

Run: `cd cad-mcp && npm test`
Expected: 4 validate tests fail.

- [ ] **Step 3: Implement `cad-mcp/src/validate.js`**

```js
import { buildPlate } from "../../shared/cad/parts/plate.js";

const UNIT = 19.05;

export function validate(keys, state) {
  const issues = [];

  if (!keys.length) {
    issues.push({ severity: "error", code: "empty_layout", msg: "layout has zero keys" });
    return issues;
  }

  // Geometric prechecks before building the solid (cheaper).
  issues.push(...checkOverlappingCutouts(keys, state));
  issues.push(...checkPlateDimensions(keys, state));

  // If precheck found dimension errors, skip the solid build (it would crash).
  if (issues.some((i) => i.code === "invalid_dimensions")) return issues;

  // Build the solid; failures are converted to issues.
  let solid;
  try {
    solid = buildPlate(keys, state.plate);
  } catch (e) {
    issues.push({ severity: "error", code: "build_failed", msg: String(e.message || e) });
    return issues;
  }

  // Volume sanity: a valid plate must have positive volume.
  if (!(solid.volume > 0)) {
    issues.push({ severity: "error", code: "cutout_outside_plate", msg: "cutouts removed all material" });
  }

  return issues;
}

function checkOverlappingCutouts(keys, state) {
  const cs = state.plate.cutoutSize;
  const out = [];
  const rects = keys.map((k) => {
    const kw = k.w || 1, kh = k.h || 1;
    const cx = (k.x + kw / 2) * UNIT;
    const cy = (k.y + kh / 2) * UNIT;
    return { id: k.id, x0: cx - cs / 2, x1: cx + cs / 2, y0: cy - cs / 2, y1: cy + cs / 2 };
  });
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i], b = rects[j];
      if (a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0) {
        out.push({
          severity: "error",
          code: "overlapping_cutouts",
          msg: `cutouts for ${a.id} and ${b.id} overlap`,
        });
      }
    }
  }
  return out;
}

function checkPlateDimensions(keys, state) {
  const margin = state.plate.margin;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const k of keys) {
    const kw = k.w || 1, kh = k.h || 1;
    minX = Math.min(minX, k.x * UNIT);
    minY = Math.min(minY, k.y * UNIT);
    maxX = Math.max(maxX, (k.x + kw) * UNIT);
    maxY = Math.max(maxY, (k.y + kh) * UNIT);
  }
  const w = maxX - minX + 2 * margin;
  const h = maxY - minY + 2 * margin;
  if (w <= 0 || h <= 0) {
    return [{ severity: "error", code: "invalid_dimensions", msg: `plate dimensions are non-positive: ${w} x ${h}` }];
  }
  return [];
}
```

- [ ] **Step 4: Run tests, verify PASS**

Run: `cd cad-mcp && npm test`
Expected: All 22 tests pass.

- [ ] **Step 5: Commit**

```bash
git add cad-mcp/src/validate.js cad-mcp/test/validate.test.js
git commit -m "feat(cad-mcp): validate — overlapping cutouts, dimensions, build errors"
```

---

## Task 8: Export module

**Files:**
- Create: `cad-mcp/src/exportPart.js`
- Create: `cad-mcp/test/exportPart.test.js`

- [ ] **Step 1: Write failing tests in `cad-mcp/test/exportPart.test.js`**

```js
import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initOCCT } from "../src/occt.js";
import { exportPart } from "../src/exportPart.js";
import { DEFAULT_STATE } from "../../shared/cad/schema.js";
import { oneKeyLayout } from "./fixtures/oneKey.js";

beforeAll(async () => { await initOCCT(); });

let dir, repoRoot;
beforeEach(() => {
  repoRoot = mkdtempSync(join(tmpdir(), "cad-export-"));
  dir = repoRoot;
});
afterEach(() => { rmSync(repoRoot, { recursive: true, force: true }); });

describe("exportPart", () => {
  it("writes an STL file inside repo root", () => {
    const out = join(dir, "out.stl");
    const r = exportPart({ partId: "plate", format: "stl", path: out }, oneKeyLayout, DEFAULT_STATE, repoRoot);
    expect(r.path).toBe(out);
    expect(existsSync(out)).toBe(true);
    expect(statSync(out).size).toBeGreaterThan(100);
  });

  it("writes a STEP file inside repo root", () => {
    const out = join(dir, "out.step");
    const r = exportPart({ partId: "plate", format: "step", path: out }, oneKeyLayout, DEFAULT_STATE, repoRoot);
    expect(existsSync(out)).toBe(true);
    expect(statSync(out).size).toBeGreaterThan(100);
  });

  it("rejects paths outside repo root", () => {
    expect(() =>
      exportPart({ partId: "plate", format: "stl", path: "/etc/evil.stl" }, oneKeyLayout, DEFAULT_STATE, repoRoot)
    ).toThrow(/outside repo root/);
  });

  it("rejects unknown formats", () => {
    expect(() =>
      exportPart({ partId: "plate", format: "obj", path: join(dir, "x.obj") }, oneKeyLayout, DEFAULT_STATE, repoRoot)
    ).toThrow(/format/);
  });
});
```

- [ ] **Step 2: Run tests, verify FAIL**

Run: `cd cad-mcp && npm test`
Expected: 4 export tests fail.

- [ ] **Step 3: Implement `cad-mcp/src/exportPart.js`**

```js
import { writeFileSync } from "node:fs";
import { resolve, relative, isAbsolute } from "node:path";
import { buildPlate } from "../../shared/cad/parts/plate.js";

const FORMATS = new Set(["stl", "step"]);

export function exportPart({ partId, format, path }, keys, state, repoRoot) {
  if (!FORMATS.has(format)) throw new Error(`unknown format: ${format} (allowed: stl, step)`);
  if (partId !== "plate") throw new Error(`unknown partId: ${partId}`);

  const abs = isAbsolute(path) ? path : resolve(repoRoot, path);
  const rel = relative(repoRoot, abs);
  if (rel.startsWith("..") || isAbsolute(rel)) {
    throw new Error(`path is outside repo root: ${path}`);
  }

  const solid = buildPlate(keys, state.plate);
  const blob = format === "stl" ? solid.blobSTL() : solid.blobSTEP();
  // replicad returns a Blob; convert to Buffer for Node fs.
  const arrayBuffer = blob.arrayBuffer ? blob.arrayBuffer() : Promise.resolve(blob);
  return writeBlobAndReturn(abs, blob, format);
}

function writeBlobAndReturn(abs, blob, format) {
  // replicad's Node-side blob exposes .text() / .arrayBuffer() asynchronously.
  // For the synchronous test API we use a tiny adapter.
  const buf = blobToBufferSync(blob);
  writeFileSync(abs, buf);
  return { path: abs, bytes: buf.length, format };
}

function blobToBufferSync(blob) {
  if (Buffer.isBuffer(blob)) return blob;
  if (blob instanceof Uint8Array) return Buffer.from(blob);
  if (typeof blob === "string") return Buffer.from(blob, "utf8");
  // replicad Blob in Node exposes ._buffer or similar; use a fallback through arrayBuffer if available.
  if (blob && typeof blob.arrayBuffer === "function") {
    const ab = blob.arrayBuffer();
    if (ab && typeof ab.then !== "function") return Buffer.from(ab);
  }
  throw new Error("could not coerce replicad export blob to Buffer");
}
```

- [ ] **Step 4: Run tests, verify PASS**

Run: `cd cad-mcp && npm test`
Expected: All 26 tests pass. If the blob coercion fails on a particular replicad version, inspect what `solid.blobSTL()` actually returns and adapt `blobToBufferSync` accordingly. Replicad in Node typically returns a `Uint8Array` for STL and a `string` for STEP.

- [ ] **Step 5: Commit**

```bash
git add cad-mcp/src/exportPart.js cad-mcp/test/exportPart.test.js
git commit -m "feat(cad-mcp): exportPart — STEP/STL writer with repo-root path guard"
```

---

## Task 9: MCP server — register tools

**Files:**
- Create: `cad-mcp/src/server.js`
- Create: `cad-mcp/test/server.test.js`

- [ ] **Step 1: Write failing test in `cad-mcp/test/server.test.js`**

The MCP SDK supports in-process testing via the `Client` and an in-memory transport. We test that the seven expected tools are registered and that a couple of them return well-shaped responses.

```js
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../src/server.js";
import { oneKeyLayout } from "./fixtures/oneKey.js";

let client, server, dir;

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "cad-server-"));
  const stateFile = join(dir, "cad-state.json");
  // Seed layout via env so server reads it instead of calling into the React app.
  process.env.CAD_LAYOUT_JSON = JSON.stringify(oneKeyLayout);

  const built = createServer({ stateFile, repoRoot: dir });
  server = built.server;

  const [a, b] = InMemoryTransport.createLinkedPair();
  client = new Client({ name: "test", version: "0" });
  await server.connect(a);
  await client.connect(b);
});

afterAll(async () => {
  await client?.close();
  await server?.close();
  delete process.env.CAD_LAYOUT_JSON;
  rmSync(dir, { recursive: true, force: true });
});

describe("MCP server", () => {
  it("registers all seven tools", async () => {
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual([
      "exportPart",
      "getLayout",
      "getState",
      "listParts",
      "measure",
      "setParam",
      "validate",
    ]);
  });

  it("getState returns DEFAULT_STATE on first call", async () => {
    const r = await client.callTool({ name: "getState", arguments: {} });
    const json = JSON.parse(r.content[0].text);
    expect(json.plate.thickness).toBe(1.5);
  });

  it("setParam updates state and persists", async () => {
    const r = await client.callTool({
      name: "setParam",
      arguments: { path: "plate.thickness", value: 2.0 },
    });
    const json = JSON.parse(r.content[0].text);
    expect(json.ok).toBe(true);
    const state = await client.callTool({ name: "getState", arguments: {} });
    expect(JSON.parse(state.content[0].text).plate.thickness).toBe(2.0);
  });

  it("getLayout returns the seeded layout", async () => {
    const r = await client.callTool({ name: "getLayout", arguments: {} });
    const json = JSON.parse(r.content[0].text);
    expect(json.count).toBe(1);
    expect(json.keys[0].id).toBe("k0");
  });
});
```

- [ ] **Step 2: Run tests, verify FAIL**

Run: `cd cad-mcp && npm test`
Expected: 4 server tests fail (server.js missing).

- [ ] **Step 3: Implement `cad-mcp/src/server.js`**

```js
#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { resolve } from "node:path";
import { createStateStore } from "./state.js";
import { measure } from "./measure.js";
import { validate } from "./validate.js";
import { exportPart } from "./exportPart.js";
import { initOCCT } from "./occt.js";
import { PARAM_PATHS } from "../../shared/cad/schema.js";

export function createServer({ stateFile, repoRoot }) {
  const store = createStateStore(stateFile);

  function getLayoutFromEnv() {
    const raw = process.env.CAD_LAYOUT_JSON;
    if (!raw) return [];
    try { return JSON.parse(raw); } catch { return []; }
  }

  const server = new Server(
    { name: "nanun-cad", version: "0.1.0" },
    { capabilities: { tools: {} } },
  );

  const TOOLS = [
    { name: "getState", description: "Return the full CAD design state.",
      inputSchema: { type: "object", properties: {} } },
    { name: "setParam", description: `Set a CAD parameter. Allowed paths: ${PARAM_PATHS.join(", ")}.`,
      inputSchema: { type: "object", required: ["path", "value"],
        properties: { path: { type: "string" }, value: {} } } },
    { name: "getLayout", description: "Read-only keyboard layout (count, bounds, keys).",
      inputSchema: { type: "object", properties: {} } },
    { name: "measure", description: "Geometric measurement. kind: boundingBox | partVolume | keyPositions | cutoutPositions.",
      inputSchema: { type: "object", required: ["query"],
        properties: { query: { type: "object" } } } },
    { name: "validate", description: "Run geometric validation; returns [] when clean.",
      inputSchema: { type: "object", properties: {} } },
    { name: "exportPart", description: "Write a part to disk. format: step | stl. path is repo-relative.",
      inputSchema: { type: "object", required: ["partId", "format", "path"],
        properties: { partId: { type: "string" }, format: { type: "string" }, path: { type: "string" } } } },
    { name: "listParts", description: "List registered and active part types.",
      inputSchema: { type: "object", properties: {} } },
  ];

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args = {} } = req.params;
    let result;
    switch (name) {
      case "getState":
        result = store.read();
        break;
      case "setParam":
        result = store.setParam(args.path, args.value);
        break;
      case "getLayout": {
        const keys = getLayoutFromEnv();
        const xs = keys.map((k) => k.x);
        const ys = keys.map((k) => k.y);
        result = {
          count: keys.length,
          bounds: keys.length
            ? { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) }
            : null,
          keys,
        };
        break;
      }
      case "measure":
        await initOCCT();
        result = measure(args.query, getLayoutFromEnv(), store.read());
        break;
      case "validate":
        await initOCCT();
        result = validate(getLayoutFromEnv(), store.read());
        break;
      case "exportPart":
        await initOCCT();
        result = exportPart(
          { partId: args.partId, format: args.format, path: args.path },
          getLayoutFromEnv(),
          store.read(),
          repoRoot,
        );
        break;
      case "listParts":
        result = { registered: ["plate"], active: store.read().parts };
        break;
      default:
        throw new Error(`unknown tool: ${name}`);
    }
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });

  return { server, store };
}

// CLI entrypoint when invoked directly (e.g., from .mcp.json).
const isMain = import.meta.url === `file://${process.argv[1]}` || import.meta.url.endsWith(process.argv[1]);
if (isMain) {
  const repoRoot = resolve(process.cwd());
  const stateFile = resolve(repoRoot, "cad-state.json");
  const { server } = createServer({ stateFile, repoRoot });
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Keep process alive until stdin closes.
}
```

- [ ] **Step 4: Run tests, verify PASS**

Run: `cd cad-mcp && npm test`
Expected: All 30 tests pass (22 from prior + 4 new server + InMemoryTransport import path may need adjustment if SDK version names it differently; if so, follow the SDK's documented in-memory transport pattern).

- [ ] **Step 5: Commit**

```bash
git add cad-mcp/src/server.js cad-mcp/test/server.test.js
git commit -m "feat(cad-mcp): MCP stdio server registering 7 tools"
```

---

## Task 10: Register MCP server in repo

**Files:**
- Create: `.mcp.json`
- Modify: `.gitignore`

- [ ] **Step 1: Create `.mcp.json`**

```json
{
  "mcpServers": {
    "nanun-cad": {
      "command": "node",
      "args": ["cad-mcp/src/server.js"]
    }
  }
}
```

- [ ] **Step 2: Add `cad-state.json` to `.gitignore`**

Append a single line `cad-state.json` to the existing `.gitignore`. Final content:

```
node_modules/
dist/
.vite/
*.local
.DS_Store
Thumbs.db
reference_images/*
.claude/
cad-state.json
```

- [ ] **Step 3: Smoke check**

Run: `node cad-mcp/src/server.js < /dev/null`
Expected: Server prints nothing (it speaks JSON-RPC over stdio); exits cleanly when stdin closes.

On Windows PowerShell, the equivalent is: `echo $null | node cad-mcp/src/server.js` — same expectation.

- [ ] **Step 4: Commit**

```bash
git add .mcp.json .gitignore
git commit -m "chore(cad): register nanun-cad MCP server, ignore cad-state.json"
```

---

## Task 11: Vite plugin for state sync

**Files:**
- Create: `vite-plugin-cad-state.js` (repo root)
- Modify: `vite.config.js`

- [ ] **Step 1: Create `vite-plugin-cad-state.js`**

```js
// Vite plugin that syncs the browser CAD tab to cad-state.json:
//   • Watches the file and triggers an HMR custom event on change.
//   • Adds a POST /__cad_state endpoint so the browser can write updates.
//   • Adds a GET  /__cad_state endpoint for the browser's initial fetch.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createStateStore } from "./cad-mcp/src/state.js";

export default function cadStatePlugin({ filePath = "cad-state.json" } = {}) {
  let absPath, store;

  return {
    name: "cad-state",

    configResolved(cfg) {
      absPath = resolve(cfg.root, filePath);
      store = createStateStore(absPath);
      // Force initial seed.
      store.read();
    },

    configureServer(server) {
      server.watcher.add(absPath);
      server.watcher.on("change", (changed) => {
        if (resolve(changed) !== absPath) return;
        server.ws.send({ type: "custom", event: "cad-state:changed" });
      });

      server.middlewares.use("/__cad_state", (req, res) => {
        if (req.method === "GET") {
          res.setHeader("Content-Type", "application/json");
          res.end(readFileSync(absPath, "utf8"));
          return;
        }
        if (req.method === "POST") {
          let body = "";
          req.on("data", (c) => (body += c));
          req.on("end", () => {
            try {
              const payload = JSON.parse(body); // { path, value }
              const r = store.setParam(payload.path, payload.value);
              res.setHeader("Content-Type", "application/json");
              res.statusCode = r.ok ? 200 : 400;
              res.end(JSON.stringify(r));
            } catch (e) {
              res.statusCode = 400;
              res.end(JSON.stringify({ ok: false, error: String(e.message || e) }));
            }
          });
          return;
        }
        res.statusCode = 405;
        res.end();
      });
    },
  };
}
```

- [ ] **Step 2: Wire the plugin into `vite.config.js`**

Replace the `vite.config.js` contents with:

```js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import cadStatePlugin from "./vite-plugin-cad-state.js";

export default defineConfig({
  plugins: [react(), cadStatePlugin()],
  base: "/",
  optimizeDeps: {
    exclude: ["replicad-opencascadejs"],
  },
});
```

- [ ] **Step 3: Smoke check**

Run: `npm run dev`
Open: `http://localhost:5173/__cad_state` (or whichever port Vite picks)
Expected: JSON body matching `DEFAULT_STATE`. Stop the server.

- [ ] **Step 4: Commit**

```bash
git add vite-plugin-cad-state.js vite.config.js
git commit -m "feat(cad): vite plugin syncs cad-state.json with browser via HMR + POST"
```

---

## Task 12: Browser sync hook

**Files:**
- Create: `src/cad/syncState.js`

- [ ] **Step 1: Implement `src/cad/syncState.js`**

```js
import { useEffect, useState, useCallback } from "react";

// Reads CAD state from the dev-server endpoint and listens for HMR pushes.
// In production builds the HMR channel is absent, so we fall back to polling.
export function useCadState() {
  const [state, setState] = useState(null);

  useEffect(() => {
    let cancelled = false;
    let pollTimer = null;

    async function refresh() {
      try {
        const r = await fetch("/__cad_state");
        if (!r.ok) return;
        const j = await r.json();
        if (!cancelled) setState(j);
      } catch { /* ignore — endpoint may be missing in prod build */ }
    }

    refresh();

    // Vite HMR channel for dev-time pushes.
    if (import.meta.hot) {
      const handler = () => refresh();
      import.meta.hot.on("cad-state:changed", handler);
      return () => {
        cancelled = true;
        import.meta.hot.off("cad-state:changed", handler);
      };
    }

    // Production fallback — light polling.
    pollTimer = setInterval(refresh, 1500);
    return () => {
      cancelled = true;
      if (pollTimer) clearInterval(pollTimer);
    };
  }, []);

  const setParam = useCallback(async (path, value) => {
    const r = await fetch("/__cad_state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, value }),
    });
    const j = await r.json();
    // The HMR push will refresh state shortly, but for snappier UI we set it now.
    if (j.ok && j.state) setState(j.state);
    return j;
  }, []);

  return { state, setParam };
}
```

- [ ] **Step 2: Smoke check (manual)**

Run: `npm run dev`
Open the CAD tab, then in the browser console:

```js
fetch("/__cad_state", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path: "plate.thickness", value: 2 }) }).then(r => r.json()).then(console.log)
```

Expected: `{ ok: true, state: { … plate: { thickness: 2 …} } }`. Inspect `cad-state.json` on disk — `plate.thickness` should be `2`.

- [ ] **Step 3: Commit**

```bash
git add src/cad/syncState.js
git commit -m "feat(cad): useCadState hook reads from sync endpoint, listens for HMR"
```

---

## Task 13: Wire CadView and plate controls to synced state

**Files:**
- Modify: `src/components/CadView.jsx`
- Modify: `src/components/App.jsx`

- [ ] **Step 1: Modify `CadView.jsx` to read from `useCadState()`**

In `src/components/CadView.jsx`:

1. Add the import at the top: `import { useCadState } from "../cad/syncState";`
2. Change the function signature from `export default function CadView({ keys, plateSettings })` to `export default function CadView({ keys })`.
3. Inside the component, just under `const [errMsg, setErrMsg] = useState("");`, add:

```jsx
  const { state: cadState } = useCadState();
  const plateSettings = cadState?.plate ?? { thickness: 1.5, margin: 5, cornerRadius: 2, cutoutSize: 14 };
```

4. Update the rebuild `useEffect` dependency list at the bottom from `[status, keys, plateSettings.thickness, plateSettings.margin, plateSettings.cornerRadius]` to:

```jsx
}, [status, keys, plateSettings.thickness, plateSettings.margin, plateSettings.cornerRadius, plateSettings.cutoutSize]);
```

5. Pass the synced `plateSettings` into the existing `buildPlate(keys, plateSettings)` call (no signature change needed — the call already takes both).

- [ ] **Step 2: Modify `App.jsx` plate controls to use `setParam`**

In `src/components/App.jsx`:

1. Add the import at the top: `import { useCadState } from "../cad/syncState";`
2. Inside the component, add near the other state declarations:

```jsx
  const { state: cadState, setParam: setCadParam } = useCadState();
```

3. Replace the existing local `plateSettings` state line:

```jsx
  const [plateSettings, setPlateSettings] = useState({ thickness: 1.5, margin: 5, cornerRadius: 2 });
```

with:

```jsx
  const plateSettings = cadState?.plate ?? { thickness: 1.5, margin: 5, cornerRadius: 2, cutoutSize: 14 };
```

4. Replace the plate control input handler at line ~419 from:

```jsx
onChange={(e) => setPlateSettings((p) => ({ ...p, [k]: parseFloat(e.target.value) || mn }))}
```

to:

```jsx
onChange={(e) => setCadParam(`plate.${k}`, parseFloat(e.target.value) || mn)}
```

5. Pass `keys` only (drop `plateSettings`) to CadView at line ~315:

```jsx
{view === "cad" && <CadView keys={keys} />}
```

(The export buttons at ~434-435 still use `plateSettings` — they keep reading the derived value, no change needed there.)

- [ ] **Step 3: Smoke check**

Run: `npm run dev`. Open the CAD tab. Change "Thickness" in the plate controls. Expected: the 3D plate updates within ~1 second; `cad-state.json` on disk shows the new value.

In a separate Claude Code window from this repo, run a quick MCP smoke (or via the in-window MCP client once the next session has the server registered): `setParam("plate.thickness", 3)` — the open browser tab should update without refresh.

- [ ] **Step 4: Commit**

```bash
git add src/components/CadView.jsx src/components/App.jsx
git commit -m "refactor(cad): CadView + plate controls bind to useCadState()"
```

---

## Task 14: README

**Files:**
- Create: `README-cad-mcp.md`

- [ ] **Step 1: Create `README-cad-mcp.md`**

```markdown
# Talking to the CAD via Claude Code

The `nanun-cad` MCP server lets a Claude Code session in this repo read, mutate, measure, validate, and export the parametric CAD design.

## How it works

1. `cad-state.json` (repo root, gitignored) holds the design parameters.
2. The Vite dev server watches the file and pushes updates to the open browser CAD tab.
3. The `nanun-cad` MCP server (registered in `.mcp.json`) exposes seven tools to Claude.
4. Both the human (UI controls) and the AI (MCP tools) write to the same file.

## Run it

```bash
npm install
cd cad-mcp && npm install && cd ..
npm run dev          # starts Vite (browser CAD tab)
```

Claude Code auto-discovers `.mcp.json` when launched in this repo, so no extra step is needed. In a Claude Code session, ask "what's the current plate thickness?" and the AI will call `getState`.

## Tools

| Tool | Use it for |
|------|------------|
| `getState` | Read the full design |
| `setParam("plate.thickness", 1.5)` | Mutate one parameter |
| `getLayout` | Read-only key positions |
| `measure({ kind: "boundingBox", part: "plate" })` | Numeric dimensions |
| `validate` | Geometry checks (overlap, manifold, dimensions) |
| `exportPart({ partId: "plate", format: "step", path: "out/plate.step" })` | Write a CAD file |
| `listParts` | Catalog of registered + active parts |

## Adding a new part

1. Create `shared/cad/parts/<name>.js` exporting `build<Name>(keys, params) → replicad Solid`.
2. Add its parameter paths to `shared/cad/schema.js` (PARAM_SCHEMA + DEFAULT_STATE).
3. Wire `getPart()` in `cad-mcp/src/measure.js`, `validate.js`, `exportPart.js` to dispatch to the new builder.
4. Add the part name to `listParts` registered list in `cad-mcp/src/server.js`.

That's it — the AI gets the new part automatically through the existing tool surface.
```

- [ ] **Step 2: Commit**

```bash
git add README-cad-mcp.md
git commit -m "docs(cad-mcp): how to talk to the CAD via Claude Code"
```

---

## Task 15: End-to-end smoke verification

- [ ] **Step 1: Run all tests**

Run: `cd cad-mcp && npm test`
Expected: 30 tests pass.

- [ ] **Step 2: Start dev server**

Run: `npm run dev`
Open the CAD tab, confirm the plate renders.

- [ ] **Step 3: Verify the human path**

Change "Thickness" in the plate controls.
Expected: 3D plate re-renders within ~1 second; `cad-state.json` updates.

- [ ] **Step 4: Verify the AI path (manual MCP smoke)**

In a fresh Claude Code session in this repo, ask: "Use the nanun-cad tools to set plate thickness to 2.5 mm and tell me the resulting bounding box."

Expected: AI calls `setParam` then `measure({ kind: "boundingBox", part: "plate" })`, the open browser tab re-renders, and the measurement matches the new thickness in Z.

- [ ] **Step 5: Verify validation and export**

Ask the AI to: "Run validate, then export the plate as STEP to `out/plate.step`."
Expected: `validate` returns `[]`, `exportPart` writes a file > 100 bytes.

- [ ] **Step 6: Stop the dev server, clean up**

Stop Vite. Don't commit anything in this task — it's verification only.

---

## Self-review notes

(Author check — fix any issues found inline before handoff.)

- **Spec coverage:** Architecture ✓ (Tasks 9, 11, 12), state shape ✓ (Tasks 2, 3), all seven tools ✓ (Task 9 + per-feature 3, 6, 7, 8), validation checks ✓ (Task 7 covers manifold-as-positive-volume, single-component-as-build-success, overlap, dimensions; the explicit "single connected component" check is approximated via the build_failed and cutout_outside_plate codes — adequate for MVP, can be tightened later), parameter validation ✓ (Tasks 2, 3), code layout ✓ (file structure section), sync mechanism ✓ (Tasks 11, 12), README ✓ (Task 14), gitignore ✓ (Task 10). The only spec item not implemented as a literal check is "every layout key has a corresponding cutout in the plate" — by construction `buildPlate` emits one cutout per key, so this is invariant rather than checked. Acceptable.
- **Placeholder scan:** No TBDs. Two acceptable hedges: (a) Task 8 notes the blob coercion may need adapting per replicad version with concrete fallback guidance; (b) Task 9 notes the InMemoryTransport import path may shift between SDK minor versions. Both are concrete enough for an engineer to resolve in <5 minutes without further design.
- **Type consistency:** `setParam` everywhere returns `{ ok, error?, state? }`. Tools always return JSON-stringified content. `validate` always returns an array. `measure` switches on `kind` consistently. `useCadState()` returns `{ state, setParam }` everywhere it's used.
- **Scope:** Single coherent plan; no decomposition needed.
