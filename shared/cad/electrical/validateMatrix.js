import { BOARDS } from "./esp32s3.js";

export function validateMatrix(keys, electrical) {
  const issues = [];
  const board = BOARDS[electrical.board];
  if (!board) {
    issues.push({ severity: "error", code: "unknown_board", msg: `unknown board: ${electrical.board}` });
    return issues;
  }
  const safeSet = new Set(board.SAFE_PINS);

  for (const which of ["rowGpios", "colGpios"]) {
    const v = electrical[which];
    if (Array.isArray(v)) {
      for (const pin of v) {
        if (!safeSet.has(pin)) {
          issues.push({
            severity: "error",
            code: "unsafe_gpio",
            msg: `${which} includes unsafe pin ${pin} (not in safe set for ${board.id})`,
          });
        }
      }
    }
  }

  if (Array.isArray(electrical.rowGpios) && Array.isArray(electrical.colGpios)) {
    const rowSet = new Set(electrical.rowGpios);
    const collisions = electrical.colGpios.filter((p) => rowSet.has(p));
    for (const p of collisions) {
      issues.push({
        severity: "error",
        code: "gpio_collision",
        msg: `pin ${p} appears in both rowGpios and colGpios`,
      });
    }
  }

  if (!keys.length) return issues;
  const rowsByY = new Map();
  for (const k of keys) {
    const ry = Math.floor(k.y);
    if (!rowsByY.has(ry)) rowsByY.set(ry, []);
    rowsByY.get(ry).push(k);
  }
  const dimRows = rowsByY.size;
  const dimCols = Math.max(...[...rowsByY.values()].map((r) => r.length));

  if (Array.isArray(electrical.rowGpios) && electrical.rowGpios.length < dimRows) {
    issues.push({
      severity: "error", code: "gpio_too_few",
      msg: `rowGpios has ${electrical.rowGpios.length} pins; layout needs ${dimRows}`,
    });
  }
  if (Array.isArray(electrical.colGpios) && electrical.colGpios.length < dimCols) {
    issues.push({
      severity: "error", code: "gpio_too_few",
      msg: `colGpios has ${electrical.colGpios.length} pins; layout needs ${dimCols}`,
    });
  }

  const need = (Array.isArray(electrical.rowGpios) ? 0 : dimRows)
             + (Array.isArray(electrical.colGpios) ? 0 : dimCols);
  const explicitSet = new Set([
    ...(Array.isArray(electrical.rowGpios) ? electrical.rowGpios : []),
    ...(Array.isArray(electrical.colGpios) ? electrical.colGpios : []),
  ]);
  const availableForAuto = board.SAFE_PINS.filter((p) => !explicitSet.has(p)).length;
  if (need > availableForAuto) {
    issues.push({
      severity: "error", code: "pin_overflow",
      msg: `layout needs ${dimRows} rows + ${dimCols} cols; safe pins available: ${availableForAuto}`,
    });
  }

  return issues;
}
