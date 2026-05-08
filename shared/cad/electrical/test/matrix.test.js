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
