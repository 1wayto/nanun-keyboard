// Bundle every printable part into a single ZIP plus a README pointing
// the user at the next steps. BOM and KMK firmware land in Phase E; for
// now the README explicitly notes what's missing so the print pack isn't
// mistaken for a complete kit.

import JSZip from "jszip";
import { exportPartsToSTL } from "./stl";
import { PRINT_BEDS } from "../build/moduleSplit";

function bedLabelFor(bedWidth) {
  const match = PRINT_BEDS.find((b) => b.w === bedWidth);
  return match ? match.label : `${bedWidth}mm`;
}

function readmeMarkdown({ keyCount, layoutW, layoutH, bedWidth, partCount, fileNames }) {
  const lines = [
    "# nanun.me Keyboard — Print Pack",
    "",
    "This pack contains the 3D-printable parts for one keyboard built on the",
    "ESP32 + coil-spring-contact ecosystem (see keyboard-ecosystem-spec.md).",
    "",
    "## Layout",
    "",
    `- Keys: **${keyCount}**`,
    `- Footprint: **${layoutW.toFixed(0)} × ${layoutH.toFixed(0)} mm**`,
    `- Print bed: **${bedLabelFor(bedWidth)}**`,
    `- Printable parts: **${partCount}** (${fileNames.length} STL files)`,
    "",
    "## Print settings (PETG, spec §6.1)",
    "",
    "- Nozzle: 230–245 °C",
    "- Bed: 75–85 °C",
    "- Walls: 4 perimeters on snap-fit features",
    "- Layer height: 0.2 mm",
    "- Cooling: 30–50%",
    "",
    "## Files",
    "",
    ...fileNames.map((n) => `- \`${n}\``),
    "",
    "## What's NOT in this pack yet",
    "",
    "- Bill of materials (wire length, diode count, ESP32 spec) — Phase E",
    "- KMK firmware config (`kb.py`, `keymap.py`) — Phase E",
    "- Assembly instructions — Phase E",
    "- ESP32 web-flash button — Phase F",
    "",
    "Until those land, refer to the spec document for assembly steps.",
    "",
  ];
  return lines.join("\n");
}

export async function buildPrintPackZip({ keys, layers, footprint, bedWidth }) {
  const stlFiles = exportPartsToSTL(layers);
  const zip = new JSZip();

  stlFiles.forEach(({ name, data }) => {
    zip.file(`stl/${name}`, data);
  });

  zip.file(
    "README.md",
    readmeMarkdown({
      keyCount: keys.length,
      layoutW: footprint.w,
      layoutH: footprint.h,
      bedWidth,
      partCount: stlFiles.length,
      fileNames: stlFiles.map((f) => f.name),
    }),
  );

  return zip.generateAsync({ type: "blob" });
}

export function defaultPackName(keys) {
  const stamp = new Date().toISOString().slice(0, 10);
  return `nanun-printpack-${keys.length}keys-${stamp}.zip`;
}
