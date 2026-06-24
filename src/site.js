import * as THREE from 'three';
import { BW, BD } from './building.js';

// ════════════════════════════════════════════════════════════════════════════
//  CONSTANTS
// ════════════════════════════════════════════════════════════════════════════
const STALL_W = 3.5;
const STALL_D = 6.0;

// Matches ref image: red trucks, blue/grey sedans, yellow cab, white, dark
const CAR_COLORS = [
  0xC02020, 0xB81818,  // reds  (pickup trucks in image)
  0x1840A8, 0x2050C0,  // blues
  0x585862, 0x707078,  // greys
  0xD4A018,            // yellow
  0xEEEEEE,            // white/silver
  0x8A3010,            // orange-red truck
  0x182818,            // dark green
  0x282830,            // near-black
];

// ════════════════════════════════════════════════════════════════════════════
//  MATERIALS
// ════════════════════════════════════════════════════════════════════════════
const ASPHALT   = new THREE.MeshLambertMaterial({ color: 0x505058 });
const LINE_MAT  = new THREE.MeshBasicMaterial ({ color: 0xECECEC });
const SIDEWALK  = new THREE.MeshLambertMaterial({ color: 0xA8A09A });
const TRUNK_MAT = new THREE.MeshLambertMaterial({ color: 0x5A3618 });

const LEAF_COLORS = [0x2A6820, 0x387828, 0x1E5418, 0x4A9030];

// ════════════════════════════════════════════════════════════════════════════
//  HELPERS
// ════════════════════════════════════════════════════════════════════════════
/** Flat PlaneGeometry lying on the XZ ground plane. */
function flat(scene, w, d, mat, cx, y, cz) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
  m.rotation.x = -Math.PI / 2;
  m.position.set(cx, y, cz);
  m.receiveShadow = true;
  scene.add(m);
}

/** BoxGeometry added to parent (scene or Group). */
function box(parent, w, h, d, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow    = true;
  m.receiveShadow = true;
  parent.add(m);
}

// ════════════════════════════════════════════════════════════════════════════
//  ASPHALT PADS
// ════════════════════════════════════════════════════════════════════════════
function buildAsphalt(scene) {
  // North main lot  (56 × 43, z: -16 → -59)
  flat(scene, 56, 43, ASPHALT, 0,   0.02, -37.5);
  // South secondary lot  (46 × 31, z: +16 → +47)
  flat(scene, 46, 31, ASPHALT, 0,   0.02,  31.5);
  // East side lot (drive aisle + stall pad: x 21→37, z −18→+18)
  flat(scene, 16, 36, ASPHALT,  29, 0.02,  0);
  // West side lot
  flat(scene, 16, 36, ASPHALT, -29, 0.02,  0);
}

// ════════════════════════════════════════════════════════════════════════════
//  PARKING STALL LINES
// ════════════════════════════════════════════════════════════════════════════
/**
 * Draw the white lines for one row of parking.
 * zFront / zBack  = world-Z of the two long edges (stop lines).
 * startX          = x of the first stall divider.
 * count           = number of stalls.
 */
function parkingRow(scene, zFront, zBack, startX, count) {
  const rowW  = count * STALL_W;
  const cx    = startX + rowW / 2;
  const midZ  = (zFront + zBack) / 2;

  // Stop lines (E-W)
  flat(scene, rowW + 0.14, 0.13, LINE_MAT, cx, 0.05, zFront);
  flat(scene, rowW + 0.14, 0.13, LINE_MAT, cx, 0.05, zBack);

  // Stall dividers (N-S, one per gap)
  for (let i = 0; i <= count; i++) {
    flat(scene, 0.13, STALL_D, LINE_MAT, startX + i * STALL_W, 0.05, midZ);
  }
}

/**
 * Draw stall lines for one side row (cars perpendicular to building face).
 * xFront / xBack = world-X of the aisle edge and far edge of the stalls.
 * startZ         = world-Z of the first stall edge.
 * count          = number of stalls.
 */
function sideStallLines(scene, xFront, xBack, startZ, count) {
  const totalD = count * STALL_W;
  const midZ   = startZ + totalD / 2;
  const midX   = (xFront + xBack) / 2;
  const depth  = Math.abs(xBack - xFront);

  // Stop lines run N–S (along Z)
  flat(scene, 0.13, totalD + 0.14, LINE_MAT, xFront, 0.05, midZ);
  flat(scene, 0.13, totalD + 0.14, LINE_MAT, xBack,  0.05, midZ);

  // Stall dividers run E–W (along X)
  for (let i = 0; i <= count; i++)
    flat(scene, depth, 0.13, LINE_MAT, midX, 0.05, startZ + i * STALL_W);
}

function buildLines(scene) {
  const SX_N = -28;  // start-X for north lot (16 stalls × 3.5 = 56, centred)
  const SX_S = -21;  // start-X for south lot (12 stalls × 3.5 = 42, centred)

  // North — 3 rows (innermost row removed; outer row added)
  parkingRow(scene, -30, -36, SX_N, 16);   // Row B  (nose → forest)
  parkingRow(scene, -43, -49, SX_N, 16);   // Row C  (nose → building)
  parkingRow(scene, -53, -59, SX_N, 16);   // Row D  (nose → forest, expansion)

  // South — 2 rows (innermost row removed; outer row added)
  parkingRow(scene, 29, 35, SX_S, 12);    // Row E
  parkingRow(scene, 41, 47, SX_S, 12);    // Row F  (expansion)

  // East & West side rows — 10 stalls × 3.5 = 35 units, centred on Z
  const SIDE_N  = 10;
  const SZ_SIDE = -(SIDE_N * STALL_W) / 2;   // −17.5
  sideStallLines(scene,  31,  37, SZ_SIDE, SIDE_N);   // East
  sideStallLines(scene, -31, -37, SZ_SIDE, SIDE_N);   // West
}

// ════════════════════════════════════════════════════════════════════════════
//  BLOCKY CARS
// ════════════════════════════════════════════════════════════════════════════
function sedan(color) {
  const g   = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color });
  const drk = new THREE.MeshLambertMaterial({ color: 0x0C0C10 });
  const win = new THREE.MeshLambertMaterial({ color: 0x14202C });

  // Body
  box(g, 2.0, 0.9, 4.2, mat, 0, 0.45, 0);
  // Cab (rear-biased)
  box(g, 1.72, 0.82, 2.1, mat, 0, 1.36, 0.15);
  // Windows
  box(g, 1.32, 0.52, 0.06, win, 0,         1.48, -0.9);    // windshield
  box(g, 1.32, 0.52, 0.06, win, 0,         1.48,  1.19);   // rear glass
  box(g, 0.06, 0.52, 1.9,  win, -0.86+.03, 1.48,  0.15);  // driver
  box(g, 0.06, 0.52, 1.9,  win,  0.86-.03, 1.48,  0.15);  // passenger
  // Wheels
  for (const [x, z] of [[-0.92,-1.35],[0.92,-1.35],[-0.92,1.35],[0.92,1.35]])
    box(g, 0.22, 0.55, 0.55, drk, x, 0.28, z);
  // Bumpers
  box(g, 1.88, 0.28, 0.12, drk, 0, 0.28, -2.16);
  box(g, 1.88, 0.28, 0.12, drk, 0, 0.28,  2.16);

  g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  return g;
}

function pickup(color) {
  const g   = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color });
  const drk = new THREE.MeshLambertMaterial({ color: 0x0C0C10 });
  const win = new THREE.MeshLambertMaterial({ color: 0x14202C });

  // Long body (bed + cab combined)
  box(g, 2.3, 1.05, 4.8, mat, 0, 0.53, 0);
  // Tall cab on front half
  box(g, 2.1, 1.15, 2.1, mat, 0, 1.65, -1.15);
  // Cab windows
  box(g, 1.6, 0.68, 0.06, win, 0,        1.85, -2.2+.03);   // windshield
  box(g, 0.06, 0.68, 1.9,  win, -1.05+.03, 1.85, -1.15);
  box(g, 0.06, 0.68, 1.9,  win,  1.05-.03, 1.85, -1.15);
  // Bed wall (low back panel)
  box(g, 2.1, 0.5, 0.08, mat, 0, 1.0, 2.36);
  // Wheels (slightly larger)
  for (const [x, z] of [[-1.08,-1.65],[1.08,-1.65],[-1.08,1.65],[1.08,1.65]])
    box(g, 0.26, 0.68, 0.68, drk, x, 0.34, z);
  // Bumpers
  box(g, 2.2, 0.32, 0.14, drk, 0, 0.35, -2.46);
  box(g, 2.2, 0.32, 0.14, drk, 0, 0.35,  2.46);

  g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  return g;
}

/**
 * Populate one row with randomly coloured/typed cars.
 * zCenter  = world-Z centre of the stall row.
 * startX   = x of the first stall left edge.
 * count    = number of stalls.
 * rotY     = 0 → faces north, Math.PI → faces south.
 * fill     = fraction of stalls occupied (0–1).
 */
function carRow(scene, zCenter, startX, count, rotY, obstacles, fill = 0.72) {
  for (let i = 0; i < count; i++) {
    if (Math.random() > fill) continue;
    const x     = startX + STALL_W * (i + 0.5);
    const color = CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)];
    const isTruck = Math.random() < 0.28;
    const car   = isTruck ? pickup(color) : sedan(color);
    car.position.set(x, 0, zCenter);
    car.rotation.y = rotY + (Math.random() - 0.5) * 0.04; // tiny jitter
    scene.add(car);
    // Record axis-aligned bounding box for goose avoidance (with small buffer)
    obstacles.push({ x, z: zCenter, hw: isTruck ? 1.45 : 1.30, hd: isTruck ? 2.70 : 2.40 });
  }
}

/**
 * Populate one side row with cars facing along the X axis (perpendicular to building).
 * xCenter = world-X centre of the stall depth.
 * startZ  = world-Z of the first stall edge.
 * rotY    = −π/2 nose→west (east lot), +π/2 nose→east (west lot).
 */
function sideCarRow(scene, xCenter, startZ, count, rotY, obstacles, fill = 0.72) {
  for (let i = 0; i < count; i++) {
    if (Math.random() > fill) continue;
    const z     = startZ + STALL_W * (i + 0.5);
    const color = CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)];
    const isTruck = Math.random() < 0.28;
    const car   = isTruck ? pickup(color) : sedan(color);
    car.position.set(xCenter, 0, z);
    car.rotation.y = rotY + (Math.random() - 0.5) * 0.04;
    scene.add(car);
    // Car is rotated 90°: length now along X (hw), width along Z (hd)
    obstacles.push({ x: xCenter, z, hw: isTruck ? 2.70 : 2.40, hd: isTruck ? 1.45 : 1.30 });
  }
}

function buildCars(scene, obstacles) {
  // Row B: nose → north (forest side), rotY = 0
  carRow(scene, -33, -28, 16, 0,       obstacles);
  // Row C: nose → south, rotY = Math.PI
  carRow(scene, -46, -28, 16, Math.PI, obstacles);
  // Row D: nose → north (expansion), rotY = 0
  carRow(scene, -56, -28, 16, 0,       obstacles);
  // Row E south: nose → south, rotY = Math.PI
  carRow(scene,  32, -21, 12, Math.PI, obstacles);
  // Row F south: nose → north (expansion), rotY = 0
  carRow(scene,  44, -21, 12, 0,       obstacles);

  // East side: nose → west (toward building), rotY = −π/2
  const SZ_SIDE = -(10 * STALL_W) / 2;   // −17.5
  sideCarRow(scene,  34, SZ_SIDE, 10, -Math.PI / 2, obstacles);
  // West side: nose → east (toward building), rotY = +π/2
  sideCarRow(scene, -34, SZ_SIDE, 10,  Math.PI / 2, obstacles);
}

// ════════════════════════════════════════════════════════════════════════════
//  SITE TREES  (clearing interior, around parking lots)
// ════════════════════════════════════════════════════════════════════════════
function siteTree(scene, x, z, trunkH, canopyW, canopyH) {
  const leafMat = new THREE.MeshLambertMaterial({
    color: LEAF_COLORS[Math.floor(Math.random() * LEAF_COLORS.length)],
  });
  box(scene, 0.85, trunkH, 0.85, TRUNK_MAT, x, trunkH * 0.5, z);
  box(scene, canopyW, canopyH, canopyW, leafMat, x, trunkH + canopyH * 0.38, z);
}

function rnd(lo, hi) { return lo + Math.random() * (hi - lo); }

function buildSiteTrees(scene) {
  // Each loop uses a randomised step (avg ≈ 2× the old fixed step) so roughly
  // half the original tree count survives with naturally irregular spacing.

  // ── North end of lot ──────────────────────────────────────────────────────
  for (let x = -26; x <= 26; x += rnd(9, 17))
    siteTree(scene, x + rnd(-1.5, 1.5), -59 + rnd(-1, 1), rnd(4.5, 7), rnd(4, 6), rnd(3.5, 5));

  // ── East side of north lot ────────────────────────────────────────────────
  for (let z = -59; z <= -25; z += rnd(10, 17))
    siteTree(scene, 39 + rnd(0, 1.5), z + rnd(-2, 2), rnd(5, 8), rnd(4, 6.5), rnd(3.5, 5));

  // ── West side of north lot ────────────────────────────────────────────────
  for (let z = -59; z <= -25; z += rnd(10, 17))
    siteTree(scene, -39 - rnd(0, 1.5), z + rnd(-2, 2), rnd(5, 8), rnd(4, 6.5), rnd(3.5, 5));

  // ── East flank of building (outside side lot at x=37) ─────────────────────
  for (let z = -20; z <= 20; z += rnd(12, 20))
    siteTree(scene, 39 + rnd(0, 2), z + rnd(-1, 1), rnd(5.5, 8), rnd(4.5, 7), rnd(4, 5.5));

  // ── West flank ────────────────────────────────────────────────────────────
  for (let z = -20; z <= 20; z += rnd(12, 20))
    siteTree(scene, -39 - rnd(0, 2), z + rnd(-1, 1), rnd(5.5, 8), rnd(4.5, 7), rnd(4, 5.5));

  // ── South lot perimeter ───────────────────────────────────────────────────
  for (let x = -21; x <= 21; x += rnd(9, 16))
    siteTree(scene, x + rnd(-1.5, 1.5), 47 + rnd(-1, 1), rnd(4.5, 7), rnd(4, 6), rnd(3.5, 5));
  for (let z = 25; z <= 47; z += rnd(10, 18)) {
    siteTree(scene,  24 + rnd(0, 1.5), z + rnd(-1.5, 1.5), rnd(5, 7), rnd(4, 5.5), rnd(3.5, 5));
    siteTree(scene, -24 - rnd(0, 1.5), z + rnd(-1.5, 1.5), rnd(5, 7), rnd(4, 5.5), rnd(3.5, 5));
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  SIDEWALKS
// ════════════════════════════════════════════════════════════════════════════
function buildSidewalks(scene) {
  const PAD = 2.0;
  // Narrow concrete strips around building perimeter, between plinth and asphalt
  flat(scene, BW + 6, PAD, SIDEWALK,  0,           0.04, -BD / 2 - 1.6 - PAD / 2);
  flat(scene, BW + 6, PAD, SIDEWALK,  0,           0.04,  BD / 2 + 1.6 + PAD / 2);
  flat(scene, PAD,    BD,  SIDEWALK,  BW/2+1.6+PAD/2, 0.04, 0);
  flat(scene, PAD,    BD,  SIDEWALK, -BW/2-1.6-PAD/2, 0.04, 0);
}

// ════════════════════════════════════════════════════════════════════════════
//  PUBLIC ENTRY
// ════════════════════════════════════════════════════════════════════════════
export function buildSite() {
  const group = new THREE.Group();
  const carObstacles = [];
  buildAsphalt(group);
  buildLines(group);
  buildCars(group, carObstacles);
  buildSiteTrees(group);
  buildSidewalks(group);
  return { group, carObstacles };
}
