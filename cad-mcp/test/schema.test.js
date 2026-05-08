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
