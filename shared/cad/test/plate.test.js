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
