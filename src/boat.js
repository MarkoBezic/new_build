import * as THREE from 'three';
import { BOAT_SPAWNS } from './zones.js';

// Convenience exports kept for any external code that references the primary boat position
export const BOAT_X = BOAT_SPAWNS[0].x;
export const BOAT_Z = BOAT_SPAWNS[0].z;

// ─────────────────────────────────────────────────────────────────────────────
//  Lofted low-poly rowboat — a real hull, not a box.
//
//  Three parametric curves define the boat from bow (t=0) to stern (t=1):
//    halfW(t) — plan-view beam (pointed bow, full midships, flared transom)
//    sheer(t) — gunwale height (the classic sweep: high bow, low waist)
//    keel(t)  — bottom rocker (rises at bow and stern)
//  Stations are lofted into a vertex-coloured skin: dark keel → warm strakes
//  → painted accent band, Scandinavian style. Curved birch rails ride the
//  sheer line. An inner "rig" group bobs and rolls gently at anchor without
//  fighting player steering (which drives the outer group).
// ─────────────────────────────────────────────────────────────────────────────

const L = 3.7;                       // hull length
const STATIONS = 10, COLS = 7;       // loft resolution (7 points per section)

const halfW = t => 0.80 * Math.sin(Math.PI * (0.03 + 0.72 * t));
const sheer = t => 0.46 + 0.22 * Math.pow(1 - t, 2.4) + 0.10 * Math.pow(t, 2.0);
const keel  = t => 0.04 + 0.20 * Math.pow(1 - t, 2.8) + 0.09 * Math.pow(t, 2.6);
const zAt   = t => -L / 2 + t * L;   // bow points −Z (player forward)

// Cross-section: keel → bilge → strake → gunwale, as (widthFrac, heightFrac)
const SECTION = [[0, 0], [0.60, 0.16], [0.94, 0.52], [1, 1]];

// Strake colours per column (port gunwale → keel → starboard gunwale)
const C_KEEL   = new THREE.Color(0x4A2E10);
const C_MID    = new THREE.Color(0x7A5024);
const C_LIGHT  = new THREE.Color(0x9C6E32);

const RAIL_MAT = new THREE.MeshLambertMaterial({ color: 0xD8C890, flatShading: true }); // birch
const WOOD_MAT = new THREE.MeshLambertMaterial({ color: 0x8C5E20, flatShading: true });
const DARK_MAT = new THREE.MeshLambertMaterial({ color: 0x5A3A16, flatShading: true });
const ROPE_MAT = new THREE.MeshLambertMaterial({ color: 0xC9B98A });

// Painted accent band per boat — weathered reds and sea tones
const PAINTS = [0xB5443A, 0x3A8E8A, 0x3A5E9E, 0xC98A3B];

function sectionPoint(t, ci) {
  // ci 0..6 across the hull; 3 is the keel centreline, 0/6 the gunwales
  const side = ci < 3 ? -1 : ci > 3 ? 1 : 0;
  const s = SECTION[Math.abs(ci - 3)];
  const w = halfW(t), k = keel(t), h = sheer(t);
  return [side * w * s[0], k + (h - k) * s[1], zAt(t)];
}

function buildHull(accent) {
  const pos = [], col = [], idx = [];
  const cAccent = new THREE.Color(accent);
  const colColors = [cAccent, C_LIGHT, C_MID, C_KEEL, C_MID, C_LIGHT, cAccent];

  for (let si = 0; si < STATIONS; si++) {
    const t = si / (STATIONS - 1);
    for (let ci = 0; ci < COLS; ci++) {
      pos.push(...sectionPoint(t, ci));
      const c = colColors[ci];
      col.push(c.r, c.g, c.b);
    }
  }
  for (let si = 0; si < STATIONS - 1; si++) {
    for (let ci = 0; ci < COLS - 1; ci++) {
      const a = si * COLS + ci, b = a + 1, c = a + COLS, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  // Transom — fan closing the stern
  const tc = pos.length / 3;
  pos.push(0, (keel(1) + sheer(1)) / 2, zAt(1) + 0.02);
  col.push(C_MID.r, C_MID.g, C_MID.b);
  const s0 = (STATIONS - 1) * COLS;
  for (let ci = 0; ci < COLS - 1; ci++) idx.push(s0 + ci, s0 + ci + 1, tc);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color',    new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();

  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({
    vertexColors: true, flatShading: true, side: THREE.DoubleSide,
  }));
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}

function railCurvePoints(side) {
  const pts = [];
  for (let si = 0; si < STATIONS; si++) {
    const t = si / (STATIONS - 1);
    pts.push(new THREE.Vector3(side * halfW(t), sheer(t) + 0.02, zAt(t)));
  }
  return pts;
}

function box(parent, w, h, d, mat, x, y, z, ry = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.rotation.y = ry;
  m.castShadow = m.receiveShadow = true;
  parent.add(m);
  return m;
}

function buildMesh(index) {
  const outer = new THREE.Group();     // positioned/steered by player.js
  const rig   = new THREE.Group();     // bobbed/rolled by updateBoats()
  outer.add(rig);
  outer.userData.rig = rig;
  rig.userData.phase = index * 1.7;

  const accent = PAINTS[index % PAINTS.length];
  rig.add(buildHull(accent));

  // ── Gunwale rails — curved birch tubes riding the sheer line ──────────────
  for (const side of [-1, 1]) {
    const curve = new THREE.CatmullRomCurve3(railCurvePoints(side));
    const rail = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.05, 5), RAIL_MAT);
    rail.castShadow = true;
    rig.add(rail);
  }
  // Transom cap rail
  box(rig, halfW(1) * 2 + 0.1, 0.07, 0.12, RAIL_MAT, 0, sheer(1) + 0.02, zAt(1));

  // ── Bow stem — raked post where the strakes meet ───────────────────────────
  const stem = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, keel(0) - 0.02, zAt(0) + 0.02),
    new THREE.Vector3(0, (keel(0) + sheer(0)) / 2, zAt(0) - 0.06),
    new THREE.Vector3(0, sheer(0) + 0.09, zAt(0) - 0.12),
  ]), 8, 0.05, 5), RAIL_MAT);
  stem.castShadow = true;
  rig.add(stem);

  // ── Interior — floor boards, thwarts, foredeck ─────────────────────────────
  // Boards span only the flat middle of the rocker (t ≈ 0.35–0.85) and stay
  // narrower than the hull bottom, so nothing pokes through the curved skin.
  for (let i = -1; i <= 1; i++) {
    box(rig, 0.22, 0.04, 1.85, DARK_MAT, i * 0.26, 0.115, 0.37);
  }
  box(rig, halfW(0.50) * 1.78, 0.06, 0.30, WOOD_MAT, 0, 0.36, zAt(0.50));  // mid thwart
  box(rig, halfW(0.82) * 1.70, 0.06, 0.28, WOOD_MAT, 0, 0.38, zAt(0.82));  // stern thwart
  // Foredeck triangle
  const fd = new THREE.Mesh(new THREE.BufferGeometry(), WOOD_MAT);
  const fy = sheer(0.09);
  fd.geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    0, fy, zAt(0.02),
    -halfW(0.24) * 0.96, fy, zAt(0.24),
    halfW(0.24) * 0.96, fy, zAt(0.24),
  ], 3));
  fd.geometry.computeVertexNormals();
  fd.material = new THREE.MeshLambertMaterial({ color: 0x8C5E20, flatShading: true, side: THREE.DoubleSide });
  rig.add(fd);

  // ── Oarlocks + stowed oars ─────────────────────────────────────────────────
  for (const side of [-1, 1]) {
    const lock = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.016, 5, 8), DARK_MAT);
    lock.position.set(side * (halfW(0.52) + 0.02), sheer(0.52) + 0.07, zAt(0.52));
    rig.add(lock);
  }
  for (const side of [-1, 1]) {
    const oar = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 1.9, 6), WOOD_MAT);
    shaft.rotation.x = Math.PI / 2;
    oar.add(shaft);
    const blade = box(oar, 0.13, 0.025, 0.48, RAIL_MAT, 0, 0, 1.05);
    blade.castShadow = true;
    oar.position.set(side * 0.30, 0.30, 0.1);
    oar.rotation.y = side * 0.10;
    oar.rotation.z = side * 0.06;
    rig.add(oar);
  }

  // ── Rope coil at the bow ───────────────────────────────────────────────────
  for (let i = 0; i < 3; i++) {
    const loop = new THREE.Mesh(new THREE.TorusGeometry(0.11 - i * 0.015, 0.025, 5, 10), ROPE_MAT);
    loop.rotation.x = Math.PI / 2;
    loop.position.set(0.12, sheer(0.09) + 0.03 + i * 0.035, zAt(0.13));
    rig.add(loop);
  }

  // ── Stern lantern — primary boat only; warm glow reads at night ──────────
  if (index === 0) {
    const post = box(rig, 0.05, 0.5, 0.05, DARK_MAT, -0.28, sheer(1) + 0.22, zAt(0.97));
    void post;
    box(rig, 0.14, 0.16, 0.14, DARK_MAT, -0.28, sheer(1) + 0.50, zAt(0.97));
    const glow = new THREE.Mesh(
      new THREE.BoxGeometry(0.09, 0.10, 0.09),
      new THREE.MeshStandardMaterial({
        color: 0x3A2408, emissive: 0xFFB347, emissiveIntensity: 1.6,
      }));
    glow.position.set(-0.28, sheer(1) + 0.50, zAt(0.97));
    rig.add(glow);
  }

  return outer;
}

// ── Idle bob & roll — animates the inner rig only, so player.js steering of
//    the outer group is never overridden ──────────────────────────────────────
const _rigs = [];
export function updateBoats(nowSec) {
  for (const rig of _rigs) {
    const p = rig.userData.phase;
    rig.position.y = Math.sin(nowSec * 0.9 + p) * 0.022;
    rig.rotation.z = Math.sin(nowSec * 0.7 + p) * 0.018;
    rig.rotation.x = Math.sin(nowSec * 0.53 + p * 1.3) * 0.012;
  }
}

// All boats are created from BOAT_SPAWNS in zones.js.
// createBoat → primary rideable boat (index 0)
// createDecorativeBoats → remaining boats (indices 1–n)
export function createBoat(scene) {
  const { x, z, yaw } = BOAT_SPAWNS[0];
  const mesh = buildMesh(0);
  mesh.rotation.y = yaw;
  mesh.position.set(x, 0.15, z);
  scene.add(mesh);
  _rigs.push(mesh.userData.rig);
  return { x, z, yaw, mesh };
}

export function createDecorativeBoats(scene) {
  return BOAT_SPAWNS.slice(1).map(({ x, z, yaw }, i) => {
    const mesh = buildMesh(i + 1);
    mesh.rotation.y = yaw;
    mesh.position.set(x, 0.15, z);
    scene.add(mesh);
    _rigs.push(mesh.userData.rig);
    return { x, z, yaw, mesh };
  });
}
