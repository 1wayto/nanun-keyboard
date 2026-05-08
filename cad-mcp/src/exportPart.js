import { writeFileSync } from "node:fs";
import { resolve, relative, isAbsolute } from "node:path";
import { buildPlate } from "../../shared/cad/parts/plate.js";

const FORMATS = new Set(["stl", "step"]);

/**
 * Build and export a CAD part to a file on disk.
 *
 * @param {{ partId: string, format: string, path: string }} params
 * @param {object[]} keys  - layout key objects
 * @param {object}   state - full cad state (state.plate is used for plate params)
 * @param {string}   repoRoot - absolute path to the repo root; output path must be inside it
 * @returns {Promise<{ path: string, bytes: number, format: string }>}
 */
export async function exportPart({ partId, format, path }, keys, state, repoRoot) {
  if (!FORMATS.has(format)) throw new Error(`unknown format: ${format} (allowed: stl, step)`);
  if (partId !== "plate") throw new Error(`unknown partId: ${partId}`);

  const abs = isAbsolute(path) ? path : resolve(repoRoot, path);
  const rel = relative(repoRoot, abs);
  if (rel.startsWith("..") || isAbsolute(rel)) {
    throw new Error(`path is outside repo root: ${path}`);
  }

  const solid = buildPlate(keys, state.plate);
  const blob = format === "stl" ? solid.blobSTL() : solid.blobSTEP();

  // Node's Blob.arrayBuffer() returns a Promise — must await.
  const ab = await blob.arrayBuffer();
  const buf = Buffer.from(ab);
  writeFileSync(abs, buf);
  return { path: abs, bytes: buf.length, format };
}
