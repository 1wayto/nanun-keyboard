import { initCad } from "./init";
import { buildPlate } from "./buildPlate";
import { computeMatrix } from "../../shared/cad/electrical/matrix";
import { renderWireSVG } from "../../shared/cad/electrical/wireSvg";

// Browser-side STEP/STL export. Builds the plate solid using the same shared
// part definition the AI uses, then downloads the resulting blob.
export async function downloadPlate(keys, plateSettings, format) {
  if (format !== "stl" && format !== "step") {
    throw new Error(`unknown format: ${format}`);
  }
  await initCad();
  const solid = buildPlate(keys, plateSettings);
  const blob = format === "stl" ? solid.blobSTL() : solid.blobSTEP();
  triggerDownload(blob, `plate.${format}`);
}

export function downloadPinmap(keys, cadState) {
  const matrix = computeMatrix(keys, cadState.electrical);
  const json = JSON.stringify(matrix, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  triggerDownload(blob, "pinmap.json");
}

export function downloadWireSvg(keys, cadState) {
  const matrix = computeMatrix(keys, cadState.electrical);
  const svg = renderWireSVG(keys, cadState.plate, matrix);
  const blob = new Blob([svg], { type: "image/svg+xml" });
  triggerDownload(blob, "wire.svg");
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
