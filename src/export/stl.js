// STL exporter wrapper. Wraps the THREE.js STLExporter shipped under
// three/examples/jsm/exporters. Each printable part (one mesh) becomes
// one STL file. Binary STL is roughly 4× smaller than ASCII for typical
// part sizes, so we default to binary and the bundle is shipped unzipped.
//
// IMPORTANT: STLExporter assumes a Mesh's world transform applies (it
// reads positionAttribute and applies matrixWorld unless the mesh sits at
// the scene root). For our use case meshes live inside transformed parents
// (layer Group at world-Y, sub-slabs at intra-group Y). We bake a fresh
// BufferGeometry for each export with the mesh's matrixWorld applied so
// the exported STL is self-contained at world origin.

import * as THREE from "three";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { collectPrintableParts } from "../build/layers";

const exporter = new STLExporter();

// Bake a copy of the mesh whose geometry has world-transform pre-applied
// and whose position/rotation/scale are reset. The original mesh is left
// untouched so the live scene keeps animating.
function bakeFlatMesh(srcMesh) {
  const baked = new THREE.Mesh(srcMesh.geometry.clone(), srcMesh.material);
  srcMesh.updateWorldMatrix(true, false);
  baked.geometry.applyMatrix4(srcMesh.matrixWorld);
  return baked;
}

function moduleSuffix(moduleCount, moduleIndex) {
  if (moduleCount <= 1) return "";
  // 2-module = L/R; 3+ = M1/M2/...
  if (moduleCount === 2) return moduleIndex === 0 ? "_left" : "_right";
  return `_m${moduleIndex + 1}`;
}

function fileNameFor(part, moduleCount) {
  // 01_topcase, 02_switchplate, 03_electrical_pockets, etc.
  const layerOrder = part.layerIndex + 1;
  const layerSlug = part.layerId
    .replace(/([A-Z])/g, "_$1")
    .toLowerCase()
    .replace(/^_/, "");
  const subSlug = part.subId ? `_${part.subId}` : "";
  const suffix = moduleSuffix(moduleCount, part.moduleIndex);
  return `${String(layerOrder).padStart(2, "0")}_${layerSlug}${subSlug}${suffix}.stl`;
}

// Export every printable part in `layers` to a list of `{ name, data }`.
// `data` is an ArrayBuffer (binary STL).
export function exportPartsToSTL(layers) {
  const parts = collectPrintableParts(layers);
  // Module count per layer for filename suffixing.
  const moduleCountByLayerId = new Map();
  layers.forEach((g) => moduleCountByLayerId.set(g.userData.layerId, g.userData.moduleCount));

  return parts.map((part) => {
    const baked = bakeFlatMesh(part.mesh);
    const arrayBuffer = exporter.parse(baked, { binary: true });
    baked.geometry.dispose();
    const name = fileNameFor(part, moduleCountByLayerId.get(part.layerId) || 1);
    return { name, data: arrayBuffer };
  });
}
