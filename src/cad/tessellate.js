import * as THREE from "three";

// Convert a replicad Solid/Compound into a Three.js BufferGeometry.
// replicad's mesh() returns interleaved triangles with vertices/normals/triangles
// arrays — fed straight into a BufferGeometry.
export function solidToGeometry(solid, meshOpts = {}) {
  const { tolerance = 0.05, angularTolerance = 30 } = meshOpts;
  const mesh = solid.mesh({ tolerance, angularTolerance });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(mesh.vertices, 3),
  );
  if (mesh.normals) {
    geometry.setAttribute(
      "normal",
      new THREE.Float32BufferAttribute(mesh.normals, 3),
    );
  }
  geometry.setIndex(Array.from(mesh.triangles));
  if (!mesh.normals) geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
