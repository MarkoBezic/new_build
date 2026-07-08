import * as THREE from 'three';
import { CLEARING_R, WORLD_R, LANDMARKS, OCEAN } from './world.config.js';
import { terrainHeight, fbm, icyMask, ruinsMask, smoothstep } from './terrain.js';

export { CLEARING_R };

// Four leaf-green tints for visual variety
const LEAF_PALETTE = [0x2A6820, 0x387828, 0x1C5016, 0x4A9030];

// ─────────────────────────────────────────────────────────────────────────────
//  Public entry point
// ─────────────────────────────────────────────────────────────────────────────
export function buildWorld() {
  const group = new THREE.Group();
  buildGround(group);
  buildBeach(group);
  // Outer forest — sparse enough to walk through
  scatterTrees(group, { count: 2400, rMin: CLEARING_R + 5, rMax: WORLD_R, minGap: 4.0, bias: 0.5 });
  // Inner belt around the OpenText clearing — deliberately thin so the
  // approach to the building is easy to navigate
  scatterTrees(group, { count: 260, rMin: CLEARING_R + 5, rMax: 140, minGap: 5.5, bias: 1.0 });
  return group;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Ground — noise-displaced, vertex-coloured, flat-shaded low-poly terrain.
//  Heights come from terrainHeight() so rendering matches collision exactly.
//  Vertex colours paint the biomes: forest floor, high-ground rock, snow in
//  the Icy Peaks, worn stone on the Ruins plateau.
// ─────────────────────────────────────────────────────────────────────────────
function buildGround(scene) {
  const SIZE = WORLD_R * 2.4, SEG = 260;
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
  geo.rotateX(-Math.PI / 2);

  const pos    = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const c      = new THREE.Color();
  const floorDark  = new THREE.Color(0x263D18);
  const floorLight = new THREE.Color(0x39571F);
  const rock       = new THREE.Color(0x6E6B60);
  const snow       = new THREE.Color(0xEDF4F8);
  const stone      = new THREE.Color(0x9A8F76);

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = terrainHeight(x, z);
    pos.setY(i, h);

    // Base forest floor with large-scale mottling
    c.copy(floorDark).lerp(floorLight, fbm(x * 0.02 + 7, z * 0.02 - 3, 3));
    // Rockier as the hills climb
    c.lerp(rock, smoothstep(9, 24, h) * 0.7);
    // Biome tints
    const icy = icyMask(x, z);
    if (icy > 0)   c.lerp(snow,  Math.min(1, icy * 1.6));
    const ru = ruinsMask(x, z);
    if (ru > 0)    c.lerp(stone, Math.min(1, ru * 1.3));

    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const floor = new THREE.Mesh(
    geo,
    new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }),
  );
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
//  Beach strip (SW quadrant, between the two parallel coast diagonals)
// ─────────────────────────────────────────────────────────────────────────────
function coastIntersections(coastVal) {
  const R    = WORLD_R;
  const root = Math.sqrt(2 * R * R - coastVal * coastVal);
  const xW = (-coastVal - root) / 2;
  const xS = (-coastVal + root) / 2;
  return { xW, zW: xW + coastVal, xS, zS: xS + coastVal };
}

function buildBeach(scene) {
  const { coast, beachWidth, beachColor } = OCEAN;
  const outer = coastIntersections(coast);
  const inner = coastIntersections(coast - beachWidth);

  // Parallelogram strip between the two parallel coast lines; negate z for SW placement
  const shape = new THREE.Shape();
  shape.moveTo(outer.xW, -outer.zW);
  shape.lineTo(outer.xS, -outer.zS);
  shape.lineTo(inner.xS, -inner.zS);
  shape.lineTo(inner.xW, -inner.zW);

  const mesh = new THREE.Mesh(
    new THREE.ShapeGeometry(shape),
    new THREE.MeshLambertMaterial({ color: beachColor, side: THREE.DoubleSide }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.15;
  mesh.receiveShadow = true;
  scene.add(mesh);
}

// ─────────────────────────────────────────────────────────────────────────────
//  Stylised low-poly forest — cone canopies on cylinder trunks, instanced.
//  Trees follow the terrain height. A spatial hash keeps placement O(n).
// ─────────────────────────────────────────────────────────────────────────────
function scatterTrees(scene, { count, rMin, rMax, minGap, bias }) {
  const BEACH_CUTOFF = OCEAN.coast - OCEAN.beachWidth;
  const trees = [];
  const grid  = new Map();   // "cx,cz" → [{x,z}]
  const cell  = minGap;
  const keyOf = (x, z) => `${Math.floor(x / cell)},${Math.floor(z / cell)}`;

  function tooClose(x, z) {
    const cx = Math.floor(x / cell), cz = Math.floor(z / cell);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      const bucket = grid.get(`${cx + i},${cz + j}`);
      if (!bucket) continue;
      for (const t of bucket) {
        const dx = t.x - x, dz = t.z - z;
        if (dx * dx + dz * dz < minGap * minGap) return true;
      }
    }
    return false;
  }

  let attempts = 0;
  while (trees.length < count && attempts < count * 20) {
    attempts++;
    const angle = Math.random() * Math.PI * 2;
    const r = rMin + Math.pow(Math.random(), bias) * (rMax - rMin);
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;

    if (z - x > BEACH_CUTOFF) continue;                 // beach / ocean

    let inLandmark = false;
    for (const lm of Object.values(LANDMARKS)) {
      const dx = x - lm.x, dz = z - lm.z;
      if (dx * dx + dz * dz < lm.exclR * lm.exclR) { inLandmark = true; break; }
    }
    if (inLandmark || tooClose(x, z)) continue;

    const t = {
      x, z,
      ground:  terrainHeight(x, z),
      trunkH:  3.5 + Math.random() * 4.5,
      canopyW: 4.0 + Math.random() * 3.5,
      canopyH: 5.0 + Math.random() * 4.0,
      tilt:    (Math.random() - 0.5) * 0.07,
      second:  Math.random() < 0.55,   // extra upper cone for fuller pines
      color:   LEAF_PALETTE[Math.floor(Math.random() * LEAF_PALETTE.length)],
    };
    trees.push(t);
    const k = keyOf(x, z);
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(t);
  }

  const N = trees.length;
  let canopyCount = 0;
  for (const t of trees) canopyCount += t.second ? 2 : 1;

  const trunkIM = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.45, 0.62, 1, 6),
    new THREE.MeshLambertMaterial({ color: 0x5A3618, flatShading: true }),
    N,
  );
  trunkIM.castShadow = trunkIM.receiveShadow = true;

  const canopyIM = new THREE.InstancedMesh(
    new THREE.ConeGeometry(1, 1, 7),
    new THREE.MeshLambertMaterial({ flatShading: true }),
    canopyCount,
  );
  canopyIM.castShadow = canopyIM.receiveShadow = true;

  const dummy = new THREE.Object3D();
  const col   = new THREE.Color();
  let ci = 0;

  for (let i = 0; i < N; i++) {
    const t = trees[i];
    const baseY = t.ground - 0.25;   // sink slightly so slopes never show gaps

    dummy.rotation.set(t.tilt, Math.random() * Math.PI * 2, t.tilt);
    dummy.position.set(t.x, baseY + t.trunkH * 0.5, t.z);
    dummy.scale.set(1, t.trunkH, 1);
    dummy.updateMatrix();
    trunkIM.setMatrixAt(i, dummy.matrix);

    col.set(t.color);
    dummy.rotation.set(0, Math.random() * Math.PI * 2, 0);
    dummy.position.set(t.x, baseY + t.trunkH + t.canopyH * 0.42, t.z);
    dummy.scale.set(t.canopyW * 0.55, t.canopyH, t.canopyW * 0.55);
    dummy.updateMatrix();
    canopyIM.setMatrixAt(ci, dummy.matrix);
    canopyIM.setColorAt(ci, col);
    ci++;

    if (t.second) {
      dummy.position.y = baseY + t.trunkH + t.canopyH * 0.85;
      dummy.scale.set(t.canopyW * 0.36, t.canopyH * 0.72, t.canopyW * 0.36);
      dummy.updateMatrix();
      canopyIM.setMatrixAt(ci, dummy.matrix);
      canopyIM.setColorAt(ci, col.multiplyScalar(1.12));
      ci++;
    }
  }

  trunkIM.instanceMatrix.needsUpdate  = true;
  canopyIM.instanceMatrix.needsUpdate = true;
  canopyIM.instanceColor.needsUpdate  = true;

  scene.add(trunkIM);
  scene.add(canopyIM);
}
