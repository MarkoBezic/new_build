import * as THREE from 'three';
import { terrainHeight } from './terrain.js';
import { legs } from './route.js';

// Course trail — bunting-topped marker posts staked along a race route at a
// steady interval, so the circuit is a readable feature of the landscape
// whether or not anyone is racing. Each pennant points along its leg, giving
// the line a direction you can follow at a glance.
//
// Two InstancedMeshes (posts, pennants) = two draw calls for the whole trail.

const SPACING = 22;        // metres between markers
const POND    = { x0: -179, x1: -141, z0: 8, z1: 32 };   // pond water + margin

const inPond = (x, z) => x > POND.x0 && x < POND.x1 && z > POND.z0 && z < POND.z1;

export function createTrail(scene, def) {
  // ── Sample marker positions along every leg ────────────────────────────────
  const marks = [];
  for (const [a, b] of legs(def)) {
    const dx = b.x - a.x, dz = b.z - a.z;
    const len = Math.hypot(dx, dz);
    if (len < 1) continue;
    const ux = dx / len, uz = dz / len;
    // Rotation putting the pennant's +X axis along the leg direction
    const ry = Math.atan2(-uz, ux);
    // Start one interval in and stop short of the checkpoint — the ring and
    // its beacon mark the corner, so posts there would only clutter it
    for (let d = SPACING; d < len - 8; d += SPACING) {
      const x = a.x + ux * d, z = a.z + uz * d;
      if (inPond(x, z)) continue;
      marks.push({ x, z, ry });
    }
  }
  if (!marks.length) return { count: 0 };

  // ── Posts ──────────────────────────────────────────────────────────────────
  const postIM = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.07, 0.095, 1.9, 5),
    new THREE.MeshLambertMaterial({ color: 0x7A5A32, flatShading: true }),
    marks.length,
  );
  postIM.castShadow = true;

  // ── Pennants — a triangle streaming from the top of each post ─────────────
  const pen = new THREE.BufferGeometry();
  pen.setAttribute('position', new THREE.Float32BufferAttribute([
    0, 0.17, 0,
    0, -0.17, 0,
    0.66, 0, 0,
  ], 3));
  pen.computeVertexNormals();
  const pennantIM = new THREE.InstancedMesh(
    pen,
    new THREE.MeshLambertMaterial({
      color: 0xFFD75A, emissive: 0xC08A10, emissiveIntensity: 0.45,
      side: THREE.DoubleSide,
    }),
    marks.length,
  );

  const dummy = new THREE.Object3D();
  marks.forEach((m, i) => {
    const gy = terrainHeight(m.x, m.z);
    dummy.position.set(m.x, gy + 0.95, m.z);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    postIM.setMatrixAt(i, dummy.matrix);

    dummy.position.set(m.x, gy + 1.72, m.z);
    dummy.rotation.set(0, m.ry, 0);
    dummy.updateMatrix();
    pennantIM.setMatrixAt(i, dummy.matrix);
  });
  postIM.instanceMatrix.needsUpdate = true;
  pennantIM.instanceMatrix.needsUpdate = true;
  scene.add(postIM, pennantIM);

  return { count: marks.length };
}
