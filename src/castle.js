import * as THREE from 'three';
import { addStructure } from './collision.js';
import { toast } from './hud.js';
import { save, load } from './persistence.js';
import { grantHat, wearHat } from './hats.js';
import { bus } from './bus.js';

// ── Northkeep Castle ─────────────────────────────────────────────────────────
// A full curtain-wall castle on a moated motte in the north forest: gatehouse
// with a working drawbridge, walkable battlements with corner platforms, and
// a four-storey keep — cellar & dungeon, great hall, throne room & library,
// royal chambers & balcony, roof deck. Richly dressed, mysteriously empty.
//
// Every solid piece is authored once through helpers that emit BOTH the
// visual mesh and its collision box, so physics always matches what you see.
//
// Layout (local coords, +z = south toward spawn):
//   curtain wall centreline at ±35, wall-walk at 13.2, moat ring outside
//   keep 28×20 at centre-north: hall floor 8.4, throne 13.2, chambers 17.6,
//   roof 21.8; cellar sits at yard level (6) beneath the raised hall.

export const CASTLE = { x: -120, z: -520, yard: 6 };
const CX = CASTLE.x, CZ = CASTLE.z;

const WALK = 13.2;          // wall-walk height
const F_HALL = 8.4, F_THRONE = 13.2, F_BED = 17.6, F_ROOF = 21.8;

export const LETTERS = [
  { id: 'l1', x: CX + 2,  z: CZ - 4,  title: 'The Feast Unfinished',
    text: 'Set for forty, touched by none. The King rose mid-toast, they say, when the light in the east wood woke. "The Wardens kept their word," he said, and set down his cup. — steward’s note' },
  { id: 'l2', x: CX + 8,  z: CZ + 5,  title: 'The Order of Flames',
    text: 'When the court would open the deep vault, the flames were woken in the old order: WIND first, that carries; then EMBER, that warms; then TIDE, that keeps; and STONE last, that remembers. Mind the order — the braziers forget nothing.' },
  { id: 'l3', x: CX - 6,  z: CZ - 8,  title: "The Queen's Last Letter",
    text: 'We do not flee, we follow. The beacon under the hollow hill has woken and the Wardens walk again. Keep the fires lit for whoever finds this place — let them know we left rich, and glad, and together.' },
  { id: 'l4', x: CX - 10, z: CZ - 6,  title: "The Steward's Ledger",
    text: 'Cellar: forty barrels laid down, dungeon empty these nine years (the last prisoner was a goose, and it was pardoned). The vault is sealed behind the throne. If you can read the flames, what is in it is yours.' },
];

// Brazier order for the vault: wind → ember → tide → stone
const BRAZIERS = [
  { id: 0, label: 'Wind',  color: 0xBFE8FF, dx: -9, dz: 3 },
  { id: 1, label: 'Ember', color: 0xFF8A3D, dx: 9,  dz: -9 },
  { id: 2, label: 'Tide',  color: 0x3D7BE8, dx: 9,  dz: 3 },
  { id: 3, label: 'Stone', color: 0xB0A898, dx: -9, dz: -9 },
];

export function createCastle(scene, { interact, audio, shells, progress }) {
  const group = new THREE.Group();
  scene.add(group);

  // ── Materials ───────────────────────────────────────────────────────────────
  const M = {
    stone:  new THREE.MeshLambertMaterial({ color: 0xB8B4A8, flatShading: true }),
    dark:   new THREE.MeshLambertMaterial({ color: 0x8A8578, flatShading: true }),
    floor:  new THREE.MeshLambertMaterial({ color: 0xA09884, flatShading: true }),
    wood:   new THREE.MeshLambertMaterial({ color: 0x6B4A22, flatShading: true }),
    plank:  new THREE.MeshLambertMaterial({ color: 0x8A6A40, flatShading: true }),
    red:    new THREE.MeshLambertMaterial({ color: 0x9A1F2E }),
    gold:   new THREE.MeshStandardMaterial({ color: 0xC8A020, emissive: 0x6A4A08, emissiveIntensity: 0.35, roughness: 0.35, metalness: 0.5 }),
    roof:   new THREE.MeshLambertMaterial({ color: 0x3A5A8A, flatShading: true }),
    iron:   new THREE.MeshLambertMaterial({ color: 0x3A3A40 }),
    flame:  new THREE.MeshLambertMaterial({ color: 0xFFD060, emissive: 0xFF9020, emissiveIntensity: 1.2 }),
    water:  new THREE.MeshPhongMaterial({ color: 0x27536B, specular: 0x88BBDD, shininess: 140, transparent: true, opacity: 0.9 }),
  };

  // ── Authoring helpers: one call = mesh + collision ─────────────────────────
  const walls = [], floors = [], ramps = [];

  function mesh(x0, x1, z0, z1, y0, y1, mat, shadow = false) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), mat);
    m.position.set(CX + (x0 + x1) / 2, (y0 + y1) / 2, CZ + (z0 + z1) / 2);
    if (shadow) m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
    return m;
  }
  // Solid wall: visual + collision
  function solid(x0, x1, z0, z1, y0, y1, mat = M.stone, shadow = false) {
    walls.push({ x0: CX + x0, x1: CX + x1, z0: CZ + z0, z1: CZ + z1, y0, y1 });
    return mesh(x0, x1, z0, z1, y0, y1, mat, shadow);
  }
  // Walkable deck: slab visual + floor collision
  function deck(x0, x1, z0, z1, top, mat = M.floor, thick = 0.35) {
    floors.push({ x0: CX + x0, x1: CX + x1, z0: CZ + z0, z1: CZ + z1, top });
    return mesh(x0, x1, z0, z1, top - thick, top, mat);
  }
  // Stairs: ramp collision + stepped visual
  function stair(x0, x1, z0, z1, axis, h0, h1, mat = M.dark) {
    ramps.push({ x0: CX + x0, x1: CX + x1, z0: CZ + z0, z1: CZ + z1, axis, h0, h1 });
    const N = 8;
    for (let i = 0; i < N; i++) {
      const t0 = i / N, t1 = (i + 1) / N;
      const h = h0 + (h1 - h0) * t1;
      if (axis === 'x') mesh(x0 + (x1 - x0) * t0, x0 + (x1 - x0) * t1, z0, z1, Math.min(h0, h) - 0.3, h, mat);
      else              mesh(x0, x1, z0 + (z1 - z0) * t0, z0 + (z1 - z0) * t1, Math.min(h0, h) - 0.3, h, mat);
    }
  }

  // ═══ Moat water (square sheet under the plateau — visible only in the ditch)
  {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(97, 97), M.water);
    w.rotation.x = -Math.PI / 2;
    w.position.set(CX, 4.35, CZ);
    group.add(w);
  }

  // ═══ Curtain walls (solid to WALK, walk deck on top, outer parapet)
  const W_IN = 33.75, W_OUT = 36.25;
  // north / south (south has the gate opening at |x| < 2.6)
  solid(-W_OUT, W_OUT, -W_OUT, -W_IN, 4, WALK, M.stone, true);
  solid(-W_OUT, -2.6, W_IN, W_OUT, 4, WALK, M.stone, true);
  solid(2.6, W_OUT, W_IN, W_OUT, 4, WALK, M.stone, true);
  solid(-2.6, 2.6, W_IN, W_OUT, 9.5, WALK, M.stone);          // gate lintel
  solid(-W_OUT, -W_IN, -W_OUT, W_OUT, 4, WALK, M.stone, true); // west
  solid(W_IN, W_OUT, -W_OUT, W_OUT, 4, WALK, M.stone, true);   // east
  // wall-walk decks
  deck(-W_OUT, W_OUT, -W_OUT, -W_IN, WALK);
  deck(-W_OUT, W_OUT, W_IN, W_OUT, WALK);
  deck(-W_OUT, -W_IN, -W_IN, W_IN, WALK);
  deck(W_IN, W_OUT, -W_IN, W_IN, WALK);
  // outer parapets (crenellated visually by gaps between merlon boxes)
  function parapet(x0, x1, z0, z1, along) {
    solid(x0, x1, z0, z1, WALK, WALK + 0.75, M.dark);           // continuous chest wall
    const len = along === 'x' ? x1 - x0 : z1 - z0;
    for (let d = 1; d < len - 1.2; d += 2.4) {
      if (along === 'x') mesh(x0 + d, x0 + d + 1.2, z0, z1, WALK + 0.75, WALK + 1.5, M.dark);
      else               mesh(x0, x1, z0 + d, z0 + d + 1.2, WALK + 0.75, WALK + 1.5, M.dark);
    }
  }
  parapet(-W_OUT, W_OUT, -W_OUT, -W_OUT + 0.5, 'x');
  parapet(-W_OUT, W_OUT, W_OUT - 0.5, W_OUT, 'x');
  parapet(-W_OUT, -W_OUT + 0.5, -W_OUT, W_OUT, 'z');
  parapet(W_OUT - 0.5, W_OUT, -W_OUT, W_OUT, 'z');

  // ═══ Corner towers — guard room below, open battle platform at walk height,
  //     decorative turret cap on the outer corner
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const u = v => sx * v, w = v => sz * v;   // mirrored helpers
    const lo = (a, b) => Math.min(a, b), hi = (a, b) => Math.max(a, b);
    const S = (x0, x1, z0, z1, y0, y1, mat, sh) =>
      solid(lo(u(x0), u(x1)), hi(u(x0), u(x1)), lo(w(z0), w(z1)), hi(w(z0), w(z1)), y0, y1, mat, sh);
    // tower shell 30..40 with a yard-level door on the inner-x face
    S(30, 40, 30, 31, 4, WALK, M.dark, true);                   // inner-z face
    S(30, 40, 39, 40, 4, WALK, M.dark, true);                   // outer-z face
    S(39, 40, 31, 39, 4, WALK, M.dark, true);                   // outer-x face
    S(30, 31, 35.5, 39, 4, WALK, M.dark, true);                 // inner-x face (part)
    S(30, 31, 31, 33, 4, WALK, M.dark, true);
    S(30, 31, 33, 35.5, 8.6, WALK, M.dark);                     // door lintel
    // guard-room decor: rack + crates + brazier
    mesh(lo(u(36), u(39)) + 0.4, hi(u(36), u(39)) - 0.4, lo(w(32), w(33.2)), hi(w(32), w(33.2)), 6, 8.4, M.wood);
    mesh(lo(u(31.5), u(33)), hi(u(31.5), u(33)), lo(w(36.5), w(38)), hi(w(36.5), w(38)), 6, 7.1, M.plank);
    // battle platform + parapet ring
    deck(lo(u(30), u(40)), hi(u(30), u(40)), lo(w(30), w(40)), hi(w(30), w(40)), WALK, M.dark);
    S(30, 40, 39.5, 40, WALK, WALK + 1.4, M.dark);
    S(39.5, 40, 30, 39.5, WALK, WALK + 1.4, M.dark);
    // turret cap (visual landmark; solid so you can't stand inside it)
    S(35, 40, 35, 40, WALK, WALK + 4.6, M.stone, true);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(3.6, 4.2, 4), M.roof);
    cap.position.set(CX + u(37.5), WALK + 4.6 + 2.1, CZ + w(37.5));
    cap.rotation.y = Math.PI / 4;
    cap.castShadow = true;
    group.add(cap);
  }

  // Grand yard stair to the wall-walk (along the inside of the south wall)
  stair(-22, -5, 31, 33.6, 'x', WALK, CASTLE.yard);
  solid(-22, -5, 30.6, 31, 6, WALK, M.dark);   // stair side rail

  // ═══ Gatehouse — flanking turrets, portcullis, drawbridge over the moat
  solid(-8, -2.6, 32, 39, 4, WALK, M.stone, true);
  solid(2.6, 8, 32, 39, 4, WALK, M.stone, true);
  deck(-8, 8, 32, 39, WALK, M.dark);                            // gate roof joins the walk
  solid(-8, 8, 38.4, 39, WALK, WALK + 1.4, M.dark);             // gate-front parapet
  for (const gx of [-5.3, 5.3]) {                               // turret caps
    const cap = new THREE.Mesh(new THREE.ConeGeometry(2.6, 3.4, 4), M.roof);
    cap.position.set(CX + gx, WALK + 1.4 + 1.7, CZ + 35.5);
    cap.rotation.y = Math.PI / 4;
    group.add(cap);
  }
  // portcullis — raised, teeth showing under the lintel
  for (let bx = -2.2; bx <= 2.2; bx += 0.55) {
    mesh(bx - 0.06, bx + 0.06, 36.4, 36.55, 8.4, 10.2, M.iron);
  }

  // Drawbridge: pivots at the gate lip; collision floor exists only when down
  const bridge = new THREE.Group();
  const bDeck = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.3, 9.6), M.plank);
  bDeck.position.set(0, -0.15, 4.8);
  bDeck.castShadow = true;
  bridge.add(bDeck);
  for (const rx of [-2.05, 2.05]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.7, 9.6), M.wood);
    rail.position.set(rx, 0.35, 4.8);
    bridge.add(rail);
  }
  bridge.position.set(CX, 6.05, CZ + 39);
  group.add(bridge);
  const bridgeFloor = { x0: CX - 2.2, x1: CX + 2.2, z0: CZ + 39, z1: CZ + 48.6, top: 6.05 };
  const gateBlock   = { x0: CX - 2.6, x1: CX + 2.6, z0: CZ + 38.6, z1: CZ + 39.4, y0: 4, y1: 12.5 };
  floors.push(bridgeFloor);
  let bridgeDown = true, bridgeAnim = 1;   // 1 = fully down

  function setBridge(down) {
    if (down === bridgeDown) return;
    bridgeDown = down;
    audio.sfx.grind();
    if (down) { floors.push(bridgeFloor); const i = walls.indexOf(gateBlock); if (i >= 0) walls.splice(i, 1); }
    else      { const i = floors.indexOf(bridgeFloor); if (i >= 0) floors.splice(i, 1); walls.push(gateBlock); }
    toast(down ? '🏰 The drawbridge rumbles down.' : '🏰 The drawbridge groans shut.', 2500);
  }
  for (const [lx, lz] of [[4.2, 36.5], [3.4, 51]]) {   // levers inside gate + far bank
    const lever = mesh(lx - 0.15, lx + 0.15, lz - 0.15, lz + 0.15, 6, 7.2, M.iron);
    lever.castShadow = false;
    interact.register({
      x: CX + lx, z: CZ + lz, r: 3.2,
      label: () => bridgeDown ? '🏰 Raise the drawbridge' : '🏰 Lower the drawbridge',
      cb: () => setBridge(!bridgeDown),
    });
  }

  // ═══ The Keep — 28×20 footprint (x −14..14, z −12..8), door to the south
  const K = { x0: -14, x1: 14, z0: -12, z1: 8 };
  // exterior shell (thickness 1) with grand door + cellar door + balcony door
  solid(K.x0, K.x1, K.z0, K.z0 + 1, 4, F_ROOF, M.stone, true);            // north
  solid(K.x0, -2.5, K.z1 - 1, K.z1, 4, F_ROOF, M.stone, true);            // south L
  solid(2.5, K.x1, K.z1 - 1, K.z1, 4, F_ROOF, M.stone, true);             // south R
  solid(-2.5, 2.5, K.z1 - 1, K.z1, 11, F_BED, M.stone);                   // above hall door / below balcony door
  solid(-2.5, 2.5, K.z1 - 1, K.z1, F_BED + 2.2, F_ROOF, M.stone);         // above balcony door
  solid(-2.5, 2.5, K.z1 - 1, K.z1, 4, 6, M.stone);                        // below hall door (cellar seal)
  solid(K.x0, K.x0 + 1, K.z0, -8, 4, F_ROOF, M.stone, true);              // west (N part)
  solid(K.x0, K.x0 + 1, -5.5, K.z1, 4, F_ROOF, M.stone, true);            // west (S part)
  solid(K.x0, K.x0 + 1, -8, -5.5, 8, F_ROOF, M.stone);                    // cellar door lintel
  solid(K.x1 - 1, K.x1, K.z0, K.z1, 4, F_ROOF, M.stone, true);            // east
  // storey slabs (with stairwell holes)
  deck(K.x0, 10.6, K.z0, K.z1, F_HALL);           // hall floor (hole x 10.6..13 z −4..6)
  deck(10.6, K.x1, K.z0, -4, F_HALL);
  deck(10.6, K.x1, 6, K.z1, F_HALL);
  deck(K.x0, K.x1, K.z0, -4, F_THRONE);           // throne floor (hole x −13..−10.6 z −4..6)
  deck(-10.6, K.x1, -4, 6, F_THRONE);
  deck(K.x0, K.x1, 6, K.z1, F_THRONE);
  deck(K.x0, K.x1, -2, K.z1, F_BED);              // chamber floor (hole x 10.6..13 z −10..−2)
  deck(K.x0, 10.6, K.z0, -2, F_BED);
  deck(K.x0, K.x1, K.z0, -10, F_BED);
  deck(K.x0, 10.6, K.z0, K.z1, F_ROOF, M.dark);   // roof deck (hole over last stair)
  deck(10.6, K.x1, -2, K.z1, F_ROOF, M.dark);
  // roof parapet
  solid(K.x0, K.x1, K.z0, K.z0 + 0.5, F_ROOF, F_ROOF + 1.2, M.dark);
  solid(K.x0, K.x1, K.z1 - 0.5, K.z1, F_ROOF, F_ROOF + 1.2, M.dark);
  solid(K.x0, K.x0 + 0.5, K.z0, K.z1, F_ROOF, F_ROOF + 1.2, M.dark);
  solid(K.x1 - 0.5, K.x1, K.z0, K.z1, F_ROOF, F_ROOF + 1.2, M.dark);
  // front steps up to the raised hall door
  stair(-2.5, 2.5, 8, 11.6, 'z', F_HALL, CASTLE.yard);
  // staircases: hall→throne (east), throne→chambers (west), chambers→roof (east)
  stair(10.8, 13, -4, 6, 'z', F_HALL, F_THRONE);
  stair(-13, -10.8, -4, 6, 'z', F_THRONE, F_BED);
  stair(10.8, 13, -10, -2, 'z', F_BED, F_ROOF);
  for (const [rx0, rx1, rz0, rz1] of [[10.4, 10.8, -4, 6], [-10.8, -10.4, -4, 6], [10.4, 10.8, -10, -2]]) {
    solid(rx0, rx1, rz0, rz1, F_HALL, F_ROOF, M.stone);   // stairwell guard walls
  }

  // interior partitions: kitchen (ground west), library (throne S), solar (bed S)
  solid(-6.3, -5.7, K.z0, -1.5, F_HALL, F_THRONE, M.stone);
  solid(-6.3, -5.7, 1.5, K.z1, F_HALL, F_THRONE, M.stone);
  solid(-6.3, -5.7, -1.5, 1.5, F_HALL + 2.6, F_THRONE, M.stone);   // kitchen door
  solid(K.x0, -2, 1.7, 2.3, F_THRONE, F_BED, M.stone);
  solid(2.6, K.x1, 1.7, 2.3, F_THRONE, F_BED, M.stone);            // library door gap −2..2.6
  solid(K.x0, -2, -5.8, -5.2, F_BED, F_ROOF, M.stone);
  solid(2.6, K.x1, -5.8, -5.2, F_BED, F_ROOF, M.stone);            // solar door
  // cellar partition: wine cellar / dungeon with barred wall
  solid(-1.2, -0.6, K.z0, -8.5, CASTLE.yard, F_HALL, M.stone);
  solid(-1.2, -0.6, -3.5, K.z1, CASTLE.yard, F_HALL, M.stone);
  for (let bz = -8.2; bz < -3.8; bz += 0.6) {
    mesh(-1.0, -0.8, bz - 0.07, bz + 0.07, 6, 8.2, M.iron);        // dungeon bars
  }

  // Balcony off the royal chamber — the centre column of the south wall spans
  // 11..F_ROOF, so re-cut it: solid below the door, lintel above it
  deck(-4, 4, 8, 11, F_BED, M.dark);                               // balcony slab
  solid(-4, 4, 10.6, 11, F_BED, F_BED + 1.1, M.dark);              // balcony rail
  solid(-4, -3.6, 8, 11, F_BED, F_BED + 1.1, M.dark);
  solid(3.6, 4, 8, 11, F_BED, F_BED + 1.1, M.dark);

  // ═══ Furnishings ═══════════════════════════════════════════════════════════
  // Great hall: banquet table, benches, carpet, hearth, chandeliers, banners
  mesh(-2.2, 2.2, -8, 4, F_HALL + 0.75, F_HALL + 0.95, M.wood, true);          // table top
  for (const tz of [-7, -2, 3]) mesh(-1.6, 1.6, tz - 0.2, tz + 0.2, F_HALL, F_HALL + 0.78, M.wood);
  for (const bx of [-3.2, 3.2]) mesh(bx - 0.4, bx + 0.4, -8, 4, F_HALL + 0.35, F_HALL + 0.5, M.plank);
  mesh(-1.5, 1.5, 4.5, 7.9, F_HALL + 0.01, F_HALL + 0.03, M.red);              // carpet to door
  mesh(4, 9, K.z0 + 1, K.z0 + 2.2, F_HALL, F_HALL + 2.6, M.dark);              // hearth
  mesh(5, 8, K.z0 + 1.4, K.z0 + 2, F_HALL + 0.3, F_HALL + 1.1, M.flame);
  for (const cz of [-6, 0]) {                                                   // chandeliers
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.09, 6, 14), M.wood);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(CX + 2, F_THRONE - 1.4, CZ + cz);
    group.add(ring);
    for (let a = 0; a < 6; a++) {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.3, 5), M.flame);
      c.position.set(CX + 2 + Math.cos(a * 1.05) * 1.3, F_THRONE - 1.2, CZ + cz + Math.sin(a * 1.05) * 1.3);
      group.add(c);
    }
  }
  // kitchen: hearth, prep table, barrels
  mesh(K.x0 + 1, K.x0 + 2.2, -4, 0, F_HALL, F_HALL + 2.4, M.dark);
  mesh(K.x0 + 1.3, K.x0 + 2, -3, -1, F_HALL + 0.3, F_HALL + 1.0, M.flame);
  mesh(-11, -8, 4, 5.4, F_HALL + 0.7, F_HALL + 0.9, M.plank);
  for (const [bx, bz] of [[-12.6, 6.5], [-11.4, 6.9], [-12.2, 5.4]]) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.3, 8), M.wood);
    b.position.set(CX + bx, F_HALL + 0.65, CZ + bz);
    group.add(b);
  }
  // cellar: barrels + torch glow
  for (const [bx, bz] of [[-9, -10], [-7.6, -10.3], [-8.4, -8.8], [4, -10], [6, -9.6]]) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 1.4, 8), M.wood);
    b.position.set(CX + bx, CASTLE.yard + 0.7, CZ + bz);
    group.add(b);
  }
  // throne room: dais, throne, carpet, banners
  mesh(-3, 3, K.z0 + 1, K.z0 + 4, F_THRONE + 0.01, F_THRONE + 0.4, M.dark);    // dais
  mesh(-0.9, 0.9, K.z0 + 1.6, K.z0 + 2.4, F_THRONE + 0.4, F_THRONE + 2.6, M.gold, true);
  mesh(-0.7, 0.7, K.z0 + 2.4, K.z0 + 3.1, F_THRONE + 0.4, F_THRONE + 1.0, M.gold);
  mesh(-1.2, 1.2, K.z0 + 4, 1.6, F_THRONE + 0.01, F_THRONE + 0.03, M.red);     // carpet
  // library: shelves
  for (const sx of [-12, -8, 0, 6, 10]) {
    mesh(sx, sx + 2.4, 6.6, 7.4, F_THRONE, F_THRONE + 3, M.wood);
  }
  mesh(6, 8.5, 3.4, 4.6, F_THRONE + 0.8, F_THRONE + 1.0, M.plank);             // lectern table
  // royal chamber: bed with canopy, rug; solar: seats + low table
  mesh(-8, -3.5, K.z0 + 1.5, K.z0 + 5, F_BED + 0.5, F_BED + 1.1, M.red);       // bed
  mesh(-8, -3.5, K.z0 + 1.2, K.z0 + 1.5, F_BED, F_BED + 2.8, M.wood);
  mesh(-8, -3.5, K.z0 + 1.2, K.z0 + 5, F_BED + 2.8, F_BED + 3.0, M.red);
  mesh(2, 7, -4.4, -0.4, F_BED + 0.01, F_BED + 0.03, M.red);                   // rug
  mesh(-2, 2, -1.5, 1.5, F_BED + 0.4, F_BED + 0.6, M.plank);                   // solar table
  // roof: flag
  {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 5, 6), M.iron);
    pole.position.set(CX, F_ROOF + 2.5, CZ - 2);
    group.add(pole);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.2), new THREE.MeshLambertMaterial({ color: 0x2A4A9A, side: THREE.DoubleSide }));
    flag.position.set(CX + 1.3, F_ROOF + 4.3, CZ - 2);
    group.add(flag);
  }
  // yard: well, banners on keep front, cobble path
  {
    const wellW = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.2, 1, 10), M.dark);
    wellW.position.set(CX + 12, CASTLE.yard + 0.5, CZ + 18);
    group.add(wellW);
    const wellR = new THREE.Mesh(new THREE.ConeGeometry(1.5, 1, 8), M.roof);
    wellR.position.set(CX + 12, CASTLE.yard + 2.6, CZ + 18);
    group.add(wellR);
    mesh(-1.5, 1.5, 11.6, 31, CASTLE.yard + 0.01, CASTLE.yard + 0.03, M.dark); // path
    for (const bx of [-4, 4]) {
      const ban = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 3), new THREE.MeshLambertMaterial({ color: 0x2A4A9A, side: THREE.DoubleSide }));
      ban.position.set(CX + bx, F_HALL + 3.4, CZ + K.z1 + 0.06);
      group.add(ban);
    }
  }

  // ═══ Vault quest — braziers in the old order open the wall behind the throne
  const vaultDone = () => !!load('castle:vault', false);
  // vault annex behind the keep's north wall
  solid(-4.5, 4.5, -18.5, -17.8, F_THRONE, F_BED, M.stone, true);
  solid(-4.5, -3.8, -17.8, K.z0, F_THRONE, F_BED, M.stone, true);
  solid(3.8, 4.5, -17.8, K.z0, F_THRONE, F_BED, M.stone, true);
  deck(-4.5, 4.5, -18.5, K.z0, F_THRONE, M.dark);
  mesh(-4.5, 4.5, -18.5, K.z0 + 0.2, F_BED, F_BED + 0.3, M.stone);   // vault ceiling
  // gold hoard
  for (const [gx, gz, s] of [[-2.5, -16, 0.9], [0, -17, 1.2], [2.4, -15.8, 0.8], [1.2, -14.6, 0.6]]) {
    const pile = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), M.gold);
    pile.position.set(CX + gx, F_THRONE + s * 0.5, CZ + gz);
    group.add(pile);
  }
  // the sliding vault wall (mesh + collision entry we can remove)
  const vaultWallBox = { x0: CX - 2, x1: CX + 2, z0: CZ + K.z0 - 0.1, z1: CZ + K.z0 + 1, y0: F_THRONE, y1: F_BED };
  const vaultWallMesh = mesh(-2, 2, K.z0 - 0.1, K.z0 + 1, F_THRONE, F_BED, M.dark, false);
  if (!vaultDone()) walls.push(vaultWallBox);
  else vaultWallMesh.visible = false;

  const brazierState = [];
  let seqIdx = vaultDone() ? 4 : 0;
  for (const b of BRAZIERS) {
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.35, 0.5, 8), M.iron);
    bowl.position.set(CX + b.dx, F_THRONE + 1.1, CZ + b.dz);
    group.add(bowl);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 1.1, 6), M.iron);
    stem.position.set(CX + b.dx, F_THRONE + 0.55, CZ + b.dz);
    group.add(stem);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.8, 7),
      new THREE.MeshLambertMaterial({ color: b.color, emissive: b.color, emissiveIntensity: 1.4 }));
    flame.position.set(CX + b.dx, F_THRONE + 1.75, CZ + b.dz);
    flame.visible = vaultDone();
    group.add(flame);
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0),
      new THREE.MeshLambertMaterial({ color: b.color, emissive: b.color, emissiveIntensity: 0.6 }));
    gem.position.set(CX + b.dx, F_THRONE + 0.28, CZ + b.dz);
    group.add(gem);
    brazierState.push({ def: b, flame });

    interact.register({
      x: CX + b.dx, z: CZ + b.dz, r: 2.6,
      label: () => `🔥 Light the ${b.label} brazier`,
      when: () => !vaultDone() && playerAbove(F_THRONE - 1) && !flame.visible,
      cb: () => {
        if (b.id === seqIdx) {
          flame.visible = true;
          audio.sfx.chime(seqIdx * 3);
          seqIdx++;
          if (seqIdx === 4) openVault();
        } else {
          seqIdx = 0;
          for (const s of brazierState) s.flame.visible = false;
          audio.sfx.grind();
          toast('The flames gutter out. The order matters — the library remembers it.', 3500);
        }
      },
    });
  }

  function openVault() {
    save('castle:vault', true);
    const i = walls.indexOf(vaultWallBox);
    if (i >= 0) walls.splice(i, 1);
    vaultWallMesh.visible = false;
    audio.sfx.fanfare();
    audio.sfx.bell();
    bus.emit('castle-vault');
    toast('◆ Stone grinds aside behind the throne — the royal vault stands open!', 6000);
  }

  interact.register({
    x: CX, z: CZ - 16, r: 3,
    label: '👑 Open the royal coffer',
    when: () => vaultDone() && !load('castle:loot', false) && playerAbove(F_THRONE - 1),
    cb: () => {
      save('castle:loot', true);
      shells.add(60, 'the royal vault');
      grantHat('crownnorth');
      wearHat('crownnorth');
      audio.sfx.fanfare();
      toast('👑 The Crown of the North is yours — worn by kings, kept for you.', 6500);
    },
  });

  // ═══ Royal letters — join the journal's Story tab via progress('letters')
  for (const L of LETTERS) {
    const desk = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.65), M.plank);
    const ly = L.id === 'l3' ? F_BED + 0.9 : L.id === 'l2' ? F_THRONE + 1.05 : L.id === 'l4' ? CASTLE.yard + 0.8 : F_HALL + 0.98;
    desk.position.set(L.x, ly, L.z);
    desk.material = new THREE.MeshLambertMaterial({ color: 0xEDE3C8 });
    group.add(desk);
    interact.register({
      x: L.x, z: L.z, r: 2.8,
      label: () => progress.has('letters', L.id) ? `Re-read "${L.title}"` : '📜 Read the royal letter',
      cb: () => {
        audio.sfx.plink();
        toast(`📜 ${L.title}\n${L.text}`, 11000);
        if (progress.add('letters', L.id)) {
          toast(`Letter added to your journal — ${progress.count('letters')} / ${LETTERS.length}`, 2600);
        }
      },
    });
  }

  // ═══ Lights — five, gated by distance so the castle costs nothing from afar
  const lights = [];
  function addLight(color, intensity, dist, x, y, z) {
    const l = new THREE.PointLight(color, intensity, dist);
    l.position.set(CX + x, y, CZ + z);
    l.visible = false;
    scene.add(l);
    lights.push(l);
    return l;
  }
  const hearthL = addLight(0xFF7A20, 1.8, 24, 6.5, F_HALL + 1.6, K.z0 + 2.5);
  addLight(0xFFB050, 1.5, 22, 0, F_THRONE + 3, -6);
  addLight(0xFFC080, 1.1, 16, -6, F_BED + 2, -8);
  addLight(0xFF8030, 1.3, 26, 12, CASTLE.yard + 2.4, 18);
  addLight(0xFFD75A, 1.4, 14, 0, F_THRONE + 2, -16);

  function playerAbove(y) { return _lastPlayerY > y; }
  let _lastPlayerY = 0;

  // ═══ Register all collision with the shared engine ═════════════════════════
  addStructure({ x: CX, z: CZ, r: 95, walls, floors, ramps });

  // ═══ Per-frame ═════════════════════════════════════════════════════════════
  function update(dt, nowSec, playerPos) {
    _lastPlayerY = playerPos.y;
    // drawbridge animation
    const target = bridgeDown ? 1 : 0;
    if (bridgeAnim !== target) {
      bridgeAnim += (target - bridgeAnim) * Math.min(1, dt * 2.2);
      if (Math.abs(bridgeAnim - target) < 0.01) bridgeAnim = target;
      bridge.rotation.x = -(1 - bridgeAnim) * 1.45;
    }
    const near = Math.hypot(playerPos.x - CX, playerPos.z - CZ) < 140;
    for (const l of lights) l.visible = near;
    if (near) hearthL.intensity = 1.6 + Math.sin(nowSec * 7.1) * 0.25 + Math.sin(nowSec * 13.7) * 0.12;
  }

  return { update, CASTLE };
}
