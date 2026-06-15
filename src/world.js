import * as THREE from 'three';

export const CLEARING_R = 62;   // radius of the open meadow (building + parking fit inside)
const WORLD_R           = 460;  // forest extends to this radius (doubled)

// Four leaf-green tints for visual variety
const LEAF_PALETTE = [0x2A6820, 0x387828, 0x1C5016, 0x4A9030];

// ─────────────────────────────────────────────────────────────────────────────
//  Public entry point
// ─────────────────────────────────────────────────────────────────────────────
export function buildWorld(scene) {
  buildGround(scene);
  buildForest(scene);
  buildInnerForest(scene);
}

// ─────────────────────────────────────────────────────────────────────────────
//  Ground planes
// ─────────────────────────────────────────────────────────────────────────────
function buildGround(scene) {
  // Dark forest floor stretching to the world edge
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD_R * 2.4, WORLD_R * 2.4),
    new THREE.MeshLambertMaterial({ color: 0x263D18 }),
  );
  floor.rotation.x    = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // Bright clearing disc on top
  const clearing = new THREE.Mesh(
    new THREE.CircleGeometry(CLEARING_R, 80),
    new THREE.MeshLambertMaterial({ color: 0x4D9240 }),
  );
  clearing.rotation.x    = -Math.PI / 2;
  clearing.position.y    = 0.01;
  clearing.receiveShadow = true;
  scene.add(clearing);

  // Soft transition ring just inside the tree line
  const edgeRing = new THREE.Mesh(
    new THREE.RingGeometry(CLEARING_R - 6, CLEARING_R + 6, 80),
    new THREE.MeshLambertMaterial({ color: 0x3A6830, side: THREE.DoubleSide }),
  );
  edgeRing.rotation.x = -Math.PI / 2;
  edgeRing.position.y = 0.02;
  scene.add(edgeRing);
}

// ─────────────────────────────────────────────────────────────────────────────
//  Procedural forest — InstancedMesh for near-zero draw-call cost
// ─────────────────────────────────────────────────────────────────────────────
// Exclusion zones — keep trees clear of landmark clearings
const POND_X = -160, POND_Z =  20, POND_EXCL = 33;
const CAVE_X =  160, CAVE_Z = -20, CAVE_EXCL = 36;

function buildForest(scene) {
  const TREE_TARGET = 2000;
  const MIN_GAP     = 3.0;   // minimum centre-to-centre distance between trees

  // ── 1. Generate positions ────────────────────────────────────────────────
  const trees = [];
  let attempts = 0;

  while (trees.length < TREE_TARGET && attempts < TREE_TARGET * 18) {
    attempts++;

    const angle = Math.random() * Math.PI * 2;
    // Bias: more trees near the clearing edge (creates a denser treeline)
    const t = Math.pow(Math.random(), 0.5);
    const r = CLEARING_R + 5 + t * (WORLD_R - CLEARING_R - 5);

    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;

    // Reject if inside landmark clearings
    const pdx = x - POND_X, pdz = z - POND_Z;
    if (pdx * pdx + pdz * pdz < POND_EXCL * POND_EXCL) continue;
    const cdx = x - CAVE_X, cdz = z - CAVE_Z;
    if (cdx * cdx + cdz * cdz < CAVE_EXCL * CAVE_EXCL) continue;

    // Reject if too close to another tree
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
      lean:    (Math.random() - 0.5) * 0.06,   // subtle rotation
      color:   LEAF_PALETTE[Math.floor(Math.random() * LEAF_PALETTE.length)],
    });
  }

  const N = trees.length;

  // ── 2. Trunk InstancedMesh ───────────────────────────────────────────────
  const trunkIM = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshLambertMaterial({ color: 0x5A3618 }),
    N,
  );
  trunkIM.castShadow    = true;
  trunkIM.receiveShadow = true;

  // ── 3. Canopy InstancedMesh (per-instance colour via setColorAt) ─────────
  const canopyIM = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshLambertMaterial(),
    N,
  );
  canopyIM.castShadow    = true;
  canopyIM.receiveShadow = true;

  // ── 4. Fill instance matrices ────────────────────────────────────────────
  const dummy = new THREE.Object3D();
  const col   = new THREE.Color();

  for (let i = 0; i < N; i++) {
    const t = trees[i];

    // Trunk
    dummy.position.set(t.x, t.trunkH * 0.5, t.z);
    dummy.scale.set(1.1, t.trunkH, 1.1);
    dummy.rotation.set(t.lean, Math.random() * Math.PI * 2, t.lean);
    dummy.updateMatrix();
    trunkIM.setMatrixAt(i, dummy.matrix);

    // Canopy (sits on top of trunk, slightly overlapping)
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
//  Dense inner-belt forest — fills the ring just outside the clearing,
//  between the parking lot and the distant landmarks.
//  The pow(0.5) bias in buildForest actually pushes most trees to the outer
//  edge, leaving the inner ~73 units very sparse; this pass corrects that.
// ─────────────────────────────────────────────────────────────────────────────
function buildInnerForest(scene) {
  const TREE_TARGET = 1000;
  const INNER_R     = CLEARING_R + 5;   // 67 — just past the treeline
  const OUTER_R     = 140;              // roughly halfway to landmarks
  const MIN_GAP     = 2.2;             // tighter packing for a denser feel

  const trees = [];
  let attempts = 0;

  while (trees.length < TREE_TARGET && attempts < TREE_TARGET * 22) {
    attempts++;

    const angle = Math.random() * Math.PI * 2;
    const t     = Math.random();   // uniform spread across the inner belt
    const r     = INNER_R + t * (OUTER_R - INNER_R);
    const x     = Math.cos(angle) * r;
    const z     = Math.sin(angle) * r;

    // Exclude landmark clearings
    const pdx = x - POND_X, pdz = z - POND_Z;
    if (pdx * pdx + pdz * pdz < POND_EXCL * POND_EXCL) continue;
    const cdx = x - CAVE_X, cdz = z - CAVE_Z;
    if (cdx * cdx + cdz * cdz < CAVE_EXCL * CAVE_EXCL) continue;

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
  trunkIM.castShadow    = true;
  trunkIM.receiveShadow = true;

  const canopyIM = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshLambertMaterial(),
    N,
  );
  canopyIM.castShadow    = true;
  canopyIM.receiveShadow = true;

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
