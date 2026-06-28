import * as THREE from 'three';

// ── Boat dock position: on the beach (z−x=1095), near portal B (−480, 575)
export const BOAT_X = -500;
export const BOAT_Z =  595;  // z−x = 1095, 5 units inside shore

const HULL_MAT = new THREE.MeshLambertMaterial({ color: 0x8C5E20 });
const TRIM_MAT = new THREE.MeshLambertMaterial({ color: 0x5A3A10 });

function box(parent, w, h, d, mat, cx, cy, cz) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(cx, cy, cz);
  m.castShadow = true; m.receiveShadow = true;
  parent.add(m);
}

function buildMesh() {
  const g = new THREE.Group();

  // Hull
  box(g, 1.4, 0.40, 3.2, HULL_MAT, 0, 0.20, 0);

  // Side gunwales
  box(g, 0.07, 0.12, 3.2, TRIM_MAT,  0.665, 0.46, 0);
  box(g, 0.07, 0.12, 3.2, TRIM_MAT, -0.665, 0.46, 0);

  // Bow and stern rails
  box(g, 1.54, 0.12, 0.07, TRIM_MAT, 0, 0.46,  1.565);
  box(g, 1.54, 0.12, 0.07, TRIM_MAT, 0, 0.46, -1.565);

  // Centre thwart (seat)
  box(g, 1.26, 0.05, 0.26, TRIM_MAT, 0, 0.425, 0);

  g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  return g;
}

export function createBoat(scene) {
  const mesh = buildMesh();
  // Bow points toward sea direction (−x, +z) so W key sails outward
  const initialYaw = Math.PI * 0.75;
  mesh.rotation.y = initialYaw;
  mesh.position.set(BOAT_X, 0.15, BOAT_Z);
  scene.add(mesh);

  return { x: BOAT_X, z: BOAT_Z, yaw: initialYaw, mesh };
}
