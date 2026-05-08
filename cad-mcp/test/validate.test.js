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
