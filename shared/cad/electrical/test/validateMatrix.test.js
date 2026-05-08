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
