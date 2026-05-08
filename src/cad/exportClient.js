import { initCad } from "./init";
import { buildPlate } from "./buildPlate";

// Browser-side STEP/STL export. Builds the plate solid using the same shared
// part definition the AI uses, then downloads the resulting blob.
export async function downloadPlate(keys, plateSettings, format) {
  if (format !== "stl" && format !== "step") {
    throw new Error(`unknown format: ${format}`);
  }
  await initCad();
  const solid = buildPlate(keys, plateSettings);
  const blob = format === "stl" ? solid.blobSTL() : solid.blobSTEP();

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `plate.${format}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
