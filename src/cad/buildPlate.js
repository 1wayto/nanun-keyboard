import { drawRoundedRectangle, drawRectangle } from "replicad";
import { UNIT, CUTOUT } from "../constants";
import { getBounds, isISOEnter } from "../utils";

// Build the switch plate as a parametric replicad solid.
// Coordinate system: plate lies on XY, centered at origin, extruded +Z.
// Layout +Y (toward user / "front") maps to CAD -Y so the back of the
// keyboard ends up at +Y in the CAD scene.
export function buildPlate(keys, opts = {}) {
  const margin = opts.margin ?? 5;
  const thickness = opts.thickness ?? 1.5;
  const cornerRadius = opts.cornerRadius ?? 2;

  const b = getBounds(keys, margin);
  const w = b.maxX - b.minX;
  const h = b.maxY - b.minY;
  const midX = (b.minX + b.maxX) / 2;
  const midY = (b.minY + b.maxY) / 2;

  let outline =
    cornerRadius > 0
      ? drawRoundedRectangle(w, h, cornerRadius)
      : drawRectangle(w, h);

  for (const k of keys) {
    const kw = k.w || 1;
    const kh = k.h || 1;
    // Layout-mm center of the key footprint.
    const lx = isISOEnter(k) ? (k.x - 0.25) * UNIT : k.x * UNIT;
    const cx = lx + (kw * UNIT) / 2;
    const cy = k.y * UNIT + (kh * UNIT) / 2;
    const px = cx - midX;
    const py = -(cy - midY);
    outline = outline.cut(drawRectangle(CUTOUT, CUTOUT).translate([px, py]));
  }

  return outline.sketchOnPlane().extrude(thickness);
}
