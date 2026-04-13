import { UNIT } from "../constants";

export function exportKiCadCSV(keys) {
  let c =
    "# nanun.me KiCad Switch Positions\n# Units: mm\nRef,PosX,PosY,Rot,Side\n";
  keys.forEach((k, i) => {
    c += `SW${i + 1},${((k.x + k.w / 2) * UNIT).toFixed(3)},${((k.y + (k.h || 1) / 2) * UNIT).toFixed(3)},0,top\n`;
  });
  return c;
}
