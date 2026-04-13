import { UNIT, CUTOUT } from "../constants";
import { getBounds } from "../utils";

export function exportDXF(keys, s) {
  const { margin, cornerRadius } = s;
  const b = getBounds(keys, margin);
  const r = Math.min(cornerRadius, (b.maxX - b.minX) / 2, (b.maxY - b.minY) / 2);
  let d =
    "0\nSECTION\n2\nHEADER\n0\nENDSEC\n0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLAYER\n0\nLAYER\n2\nOUTLINE\n70\n0\n62\n7\n6\nCONTINUOUS\n0\nLAYER\n2\nCUTOUTS\n70\n0\n62\n1\n6\nCONTINUOUS\n0\nENDTAB\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n";
  const pts =
    r > 0.1
      ? [
          [b.minX + r, b.minY],
          [b.maxX - r, b.minY],
          [b.maxX, b.minY + r],
          [b.maxX, b.maxY - r],
          [b.maxX - r, b.maxY],
          [b.minX + r, b.maxY],
          [b.minX, b.maxY - r],
          [b.minX, b.minY + r],
        ]
      : [
          [b.minX, b.minY],
          [b.maxX, b.minY],
          [b.maxX, b.maxY],
          [b.minX, b.maxY],
        ];
  d += `0\nLWPOLYLINE\n8\nOUTLINE\n90\n${pts.length}\n70\n1\n`;
  pts.forEach(([x, y]) => {
    d += `10\n${x.toFixed(4)}\n20\n${y.toFixed(4)}\n`;
  });
  keys.forEach((k) => {
    const cx = (k.x + k.w / 2) * UNIT,
      cy = (k.y + (k.h || 1) / 2) * UNIT,
      hl = CUTOUT / 2;
    d += `0\nLWPOLYLINE\n8\nCUTOUTS\n90\n4\n70\n1\n10\n${(cx - hl).toFixed(4)}\n20\n${(cy - hl).toFixed(4)}\n10\n${(cx + hl).toFixed(4)}\n20\n${(cy - hl).toFixed(4)}\n10\n${(cx + hl).toFixed(4)}\n20\n${(cy + hl).toFixed(4)}\n10\n${(cx - hl).toFixed(4)}\n20\n${(cy + hl).toFixed(4)}\n`;
  });
  d += "0\nENDSEC\n0\nEOF\n";
  return d;
}
