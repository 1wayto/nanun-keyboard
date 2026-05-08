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
