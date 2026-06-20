import * as THREE from 'three';
import { CLEARING_R, WORLD_R, LANDMARKS, OCEAN } from './world.config.js';

export { CLEARING_R };

// Four leaf-green tints for visual variety
const LEAF_PALETTE = [0x2A6820, 0x387828, 0x1C5016, 0x4A9030];

// ─────────────────────────────────────────────────────────────────────────────
//  Public entry point
// ─────────────────────────────────────────────────────────────────────────────
export function buildWorld() {
  const group = new THREE.Group();
  buildGround(group);
  buildOcean(group);
  buildBeach(group);
  buildForest(group);
  buildInnerForest(group);
  return group;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Ground planes
// ─────────────────────────────────────────────────────────────────────────────
function buildGround(scene) {
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD_R * 2.4, WORLD_R * 2.4),
    new THREE.MeshLambertMaterial({ color: 0x263D18 }),
  );
  floor.rotation.x    = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const clearing = new THREE.Mesh(
    new THREE.CircleGeometry(CLEARING_R, 80),
    new THREE.MeshLambertMaterial({ color: 0x4D9240 }),
  );
  clearing.rotation.x    = -Math.PI / 2;
  clearing.position.y    = 0.01;
  clearing.receiveShadow = true;
  scene.add(clearing);

  const edgeRing = new THREE.Mesh(
    new THREE.RingGeometry(CLEARING_R - 6, CLEARING_R + 6, 80),
    new THREE.MeshLambertMaterial({ color: 0x3A6830, side: THREE.DoubleSide }),
  );
  edgeRing.rotation.x = -Math.PI / 2;
  edgeRing.position.y = 0.02;
  scene.add(edgeRing);
}

// ─────────────────────────────────────────────────────────────────────────────
//  Ocean & beach  (south-west corner of the map)
//
//  The shoreline is the diagonal z − x = OCEAN.coast.
//  Everything "south-west" of that line (z − x > coast) is ocean.
//  A sandy beach strip of width OCEAN.beachWidth runs parallel on the
//  forest side of the shore.
//
//  Geometry is built as ShapeGeometry (2D shape rotated flat onto XZ).
//  In the shape's 2D space: shape-X = world-X, shape-Y = world-Z.
// ─────────────────────────────────────────────────────────────────────────────

// Returns the two points where the line (z − x = coastVal) meets the world circle.
function coastIntersections(coastVal) {
  const R    = WORLD_R;
  const root = Math.sqrt(2 * R * R - coastVal * coastVal);
  const xW = (-coastVal - root) / 2;   // western end  (x ≈ −920, z ≈ −20)
  const xS = (-coastVal + root) / 2;   // southern end (x ≈ +20,  z ≈ +920)
  return { xW, zW: xW + coastVal, xS, zS: xS + coastVal };
}

function buildOcean(scene) {
  const { coast, waterColor } = OCEAN;
  const R = WORLD_R;
  const { xW, zW, xS, zS } = coastIntersections(coast);

  // Angles of the two coastline endpoints on the world circle
  const tW = Math.atan2(zW, xW);   // ≈ 181° (barely south of due-west)
  const tS = Math.atan2(zS, xS);   // ≈  89° (barely east of due-south)

  // Polygon:
  //   west endpoint → south endpoint  (straight coastline)
  //   south → west arc through SW corner (world circle boundary)
  const shape = new THREE.Shape();
  shape.moveTo(xW, zW);
  shape.lineTo(xS, zS);

  // Arc from tS (≈89°) counter-clockwise to tW (≈181°), passing through SW (135°)
  const STEPS = 32;
  for (let i = 1; i <= STEPS; i++) {
    const t = tS + (tW - tS) * i / STEPS;
    shape.lineTo(R * Math.cos(t), R * Math.sin(t));
  }

  const mesh = new THREE.Mesh(
    new THREE.ShapeGeometry(shape),
    new THREE.MeshLambertMaterial({ color: waterColor }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.003;
  mesh.receiveShadow = true;
  scene.add(mesh);
}

function buildBeach(scene) {
  const { coast, beachWidth, beachColor } = OCEAN;
  const outer = coastIntersections(coast);
  const inner = coastIntersections(coast - beachWidth);

  // Parallelogram between the two parallel coast lines
  const shape = new THREE.Shape();
  shape.moveTo(outer.xW, outer.zW);
  shape.lineTo(outer.xS, outer.zS);
  shape.lineTo(inner.xS, inner.zS);
  shape.lineTo(inner.xW, inner.zW);

  const mesh = new THREE.Mesh(
    new THREE.ShapeGeometry(shape),
    new THREE.MeshLambertMaterial({ color: beachColor }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.005;
  mesh.receiveShadow = true;
  scene.add(mesh);
}

// ─────────────────────────────────────────────────────────────────────────────
//  Procedural forest — InstancedMesh for near-zero draw-call cost
// ─────────────────────────────────────────────────────────────────────────────
function buildForest(scene) {
  const TREE_TARGET  = 3000;
  const MIN_GAP      = 3.0;
  const BEACH_CUTOFF = OCEAN.coast - OCEAN.beachWidth;

  const trees = [];
  let attempts = 0;

  while (trees.length < TREE_TARGET && attempts < TREE_TARGET * 18) {
    attempts++;

    const angle = Math.random() * Math.PI * 2;
    const t = Math.pow(Math.random(), 0.5);
    const r = CLEARING_R + 5 + t * (WORLD_R - CLEARING_R - 5);

    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;

    // Reject if on beach or in ocean
    if (z - x > BEACH_CUTOFF) continue;

    // Reject if inside any landmark clearing
    let inLandmark = false;
    for (const lm of Object.values(LANDMARKS)) {
      const dx = x - lm.x, dz = z - lm.z;
      if (dx * dx + dz * dz < lm.exclR * lm.exclR) { inLandmark = true; break; }
    }
    if (inLandmark) continue;

    let tooClose = false;
    for (let i = 0; i < trees.length; i++) {
      const dx = trees[i].x - x, dz = trees[i].z - z;
      if (dx * dx + dz * dz < MIN_GAP * MIN_GAP) { tooClose = true; break; }
    }
    if (tooClose) continue;

    trees.push({
      x, z,
      trunkH:  4.0 + Math.random() * 5.0,
      canopyW: 4.5 + Math.random() * 4.0,
      canopyH: 3.5 + Math.random() * 3.0,
      lean:    (Math.random() - 0.5) * 0.06,
      color:   LEAF_PALETTE[Math.floor(Math.random() * LEAF_PALETTE.length)],
    });
  }

  const N = trees.length;

  const trunkIM = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshLambertMaterial({ color: 0x5A3618 }),
    N,
  );
  trunkIM.castShadow = trunkIM.receiveShadow = true;

  const canopyIM = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshLambertMaterial(),
    N,
  );
  canopyIM.castShadow = canopyIM.receiveShadow = true;

  const dummy = new THREE.Object3D();
  const col   = new THREE.Color();

  for (let i = 0; i < N; i++) {
    const t = trees[i];

    dummy.position.set(t.x, t.trunkH * 0.5, t.z);
    dummy.scale.set(1.1, t.trunkH, 1.1);
    dummy.rotation.set(t.lean, Math.random() * Math.PI * 2, t.lean);
    dummy.updateMatrix();
    trunkIM.setMatrixAt(i, dummy.matrix);

    dummy.position.set(t.x, t.trunkH + t.canopyH * 0.38, t.z);
    dummy.scale.set(t.canopyW, t.canopyH, t.canopyW);
    dummy.rotation.set(0, Math.random() * Math.PI * 2, 0);
    dummy.updateMatrix();
    canopyIM.setMatrixAt(i, dummy.matrix);
    canopyIM.setColorAt(i, col.set(t.color));
  }

  trunkIM.instanceMatrix.needsUpdate  = true;
  canopyIM.instanceMatrix.needsUpdate = true;
  canopyIM.instanceColor.needsUpdate  = true;

  scene.add(trunkIM);
  scene.add(canopyIM);
}

// ─────────────────────────────────────────────────────────────────────────────
//  Dense inner-belt forest — fills the ring just outside the clearing
// ─────────────────────────────────────────────────────────────────────────────
function buildInnerForest(scene) {
  const TREE_TARGET  = 1000;
  const INNER_R      = CLEARING_R + 5;
  const OUTER_R      = 140;
  const MIN_GAP      = 2.2;
  const BEACH_CUTOFF = OCEAN.coast - OCEAN.beachWidth;

  const trees = [];
  let attempts = 0;

  while (trees.length < TREE_TARGET && attempts < TREE_TARGET * 22) {
    attempts++;

    const angle = Math.random() * Math.PI * 2;
    const t     = Math.random();
    const r     = INNER_R + t * (OUTER_R - INNER_R);
    const x     = Math.cos(angle) * r;
    const z     = Math.sin(angle) * r;

    if (z - x > BEACH_CUTOFF) continue;

    let inLandmark = false;
    for (const lm of Object.values(LANDMARKS)) {
      const dx = x - lm.x, dz = z - lm.z;
      if (dx * dx + dz * dz < lm.exclR * lm.exclR) { inLandmark = true; break; }
    }
    if (inLandmark) continue;

    let tooClose = false;
    for (let i = 0; i < trees.length; i++) {
      const dx = trees[i].x - x, dz = trees[i].z - z;
      if (dx * dx + dz * dz < MIN_GAP * MIN_GAP) { tooClose = true; break; }
    }
    if (tooClose) continue;

    trees.push({
      x, z,
      trunkH:  3.5 + Math.random() * 5.0,
      canopyW: 4.0 + Math.random() * 4.0,
      canopyH: 3.0 + Math.random() * 3.5,
      lean:    (Math.random() - 0.5) * 0.06,
      color:   LEAF_PALETTE[Math.floor(Math.random() * LEAF_PALETTE.length)],
    });
  }

  const N = trees.length;

  const trunkIM = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshLambertMaterial({ color: 0x5A3618 }),
    N,
  );
  trunkIM.castShadow = trunkIM.receiveShadow = true;

  const canopyIM = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshLambertMaterial(),
    N,
  );
  canopyIM.castShadow = canopyIM.receiveShadow = true;

  const dummy = new THREE.Object3D();
  const col   = new THREE.Color();

  for (let i = 0; i < N; i++) {
    const t = trees[i];

    dummy.position.set(t.x, t.trunkH * 0.5, t.z);
    dummy.scale.set(1.1, t.trunkH, 1.1);
    dummy.rotation.set(t.lean, Math.random() * Math.PI * 2, t.lean);
    dummy.updateMatrix();
    trunkIM.setMatrixAt(i, dummy.matrix);

    dummy.position.set(t.x, t.trunkH + t.canopyH * 0.38, t.z);
    dummy.scale.set(t.canopyW, t.canopyH, t.canopyW);
    dummy.rotation.set(0, Math.random() * Math.PI * 2, 0);
    dummy.updateMatrix();
    canopyIM.setMatrixAt(i, dummy.matrix);
    canopyIM.setColorAt(i, col.set(t.color));
  }

  trunkIM.instanceMatrix.needsUpdate  = true;
  canopyIM.instanceMatrix.needsUpdate = true;
  canopyIM.instanceColor.needsUpdate  = true;

  scene.add(trunkIM);
  scene.add(canopyIM);
}
