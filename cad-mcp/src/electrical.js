import { computeMatrix } from "../../shared/cad/electrical/matrix.js";
import { validateMatrix as validateMatrixShared } from "../../shared/cad/electrical/validateMatrix.js";

export function getMatrix(keys, state) {
  return computeMatrix(keys, state.electrical);
}

export function validateMatrix(keys, state) {
  return validateMatrixShared(keys, state.electrical);
}
