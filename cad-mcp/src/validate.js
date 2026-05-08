import { buildPlate } from "../../shared/cad/parts/plate.js";
import { validateGeometric } from "../../shared/cad/validateGeometric.js";
import { measureVolume } from "./replicad.js";

export function validate(keys, state) {
  const issues = validateGeometric(keys, state);

  // Stop early on layout/dimension errors — buildPlate would crash on them.
  if (issues.some((i) => i.code === "empty_layout" || i.code === "invalid_dimensions")) {
    return issues;
  }

  let solid;
  try {
    solid = buildPlate(keys, state.plate);
  } catch (e) {
    issues.push({ severity: "error", code: "build_failed", msg: String(e.message || e) });
    return issues;
  }

  if (!(measureVolume(solid) > 0)) {
    issues.push({ severity: "error", code: "cutout_outside_plate", msg: "cutouts removed all material" });
  }

  return issues;
}
