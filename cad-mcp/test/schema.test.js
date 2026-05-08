import { describe, it, expect } from "vitest";
import { DEFAULT_STATE, validateParam, PARAM_PATHS } from "../../shared/cad/schema.js";

describe("schema", () => {
  it("DEFAULT_STATE matches spec shape", () => {
    expect(DEFAULT_STATE).toEqual({
      schemaVersion: 1,
      plate: { thickness: 1.5, margin: 5, cornerRadius: 2, cutoutSize: 14.0 },
      parts: ["plate"],
      electrical: {
        board: "esp32-s3-devkitc-1",
        diodeDirection: "col2row",
        rowGpios: "auto",
        colGpios: "auto",
      },
    });
  });

  it("PARAM_PATHS lists every settable path", () => {
    expect(PARAM_PATHS).toEqual([
      "plate.thickness",
      "plate.margin",
      "plate.cornerRadius",
      "plate.cutoutSize",
      "electrical.board",
      "electrical.diodeDirection",
      "electrical.rowGpios",
      "electrical.colGpios",
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
});
