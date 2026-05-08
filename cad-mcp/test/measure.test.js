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
