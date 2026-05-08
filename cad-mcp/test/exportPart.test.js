import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, parse } from "node:path";
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
  it("writes an STL file inside repo root", async () => {
    const out = join(dir, "out.stl");
    const r = await exportPart({ partId: "plate", format: "stl", path: out }, oneKeyLayout, DEFAULT_STATE, repoRoot);
    expect(r.path).toBe(out);
    expect(existsSync(out)).toBe(true);
    expect(statSync(out).size).toBeGreaterThan(100);
  });

  it("writes a STEP file inside repo root", async () => {
    const out = join(dir, "out.step");
    await exportPart({ partId: "plate", format: "step", path: out }, oneKeyLayout, DEFAULT_STATE, repoRoot);
    expect(existsSync(out)).toBe(true);
    expect(statSync(out).size).toBeGreaterThan(100);
  });

  it("rejects paths outside repo root", async () => {
    // Derive an absolute path definitively outside any temp-dir repoRoot.
    // parse(repoRoot).root gives "C:\" on Windows, "/" on POSIX.
    const outside = join(parse(repoRoot).root, "evil.stl");
    await expect(
      exportPart({ partId: "plate", format: "stl", path: outside }, oneKeyLayout, DEFAULT_STATE, repoRoot)
    ).rejects.toThrow(/outside repo root/);
  });

  it("rejects unknown formats", async () => {
    await expect(
      exportPart({ partId: "plate", format: "obj", path: join(dir, "x.obj") }, oneKeyLayout, DEFAULT_STATE, repoRoot)
    ).rejects.toThrow(/format/);
  });

  it("creates intermediate directories", async () => {
    const out = join(dir, "deep", "nested", "out.stl");
    await exportPart({ partId: "plate", format: "stl", path: out }, oneKeyLayout, DEFAULT_STATE, repoRoot);
    expect(existsSync(out)).toBe(true);
  });
});
