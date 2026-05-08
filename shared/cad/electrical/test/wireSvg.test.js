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
