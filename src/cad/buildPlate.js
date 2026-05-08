// The plate builder lives in `shared/cad/parts/plate.js` so that both the
// browser app and the Node MCP server use the same geometry definition.
// This module adapts the browser's existing call shape to the shared API.
import { buildPlate as buildPlateShared } from "../../shared/cad/parts/plate.js";

export function buildPlate(keys, opts = {}) {
  return buildPlateShared(keys, {
    thickness:    opts.thickness    ?? 1.5,
    margin:       opts.margin       ?? 5,
    cornerRadius: opts.cornerRadius ?? 2,
    cutoutSize:   opts.cutoutSize   ?? 14,
  });
}
