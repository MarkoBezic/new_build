import * as THREE from 'three';
import { addStructure } from './collision.js';
import { toast } from './hud.js';
import { save, load } from './persistence.js';
import { grantHat, wearHat } from './hats.js';
import { bus } from './bus.js';

// ── Northkeep Castle ─────────────────────────────────────────────────────────
// A full curtain-wall castle on a moated motte. This revision is built for
// third-person play: every keep storey has 7–8 m of clear height, the keep
// footprint is 36×26, doorways are wide and tall, the wall-walk is ~6 m
// broad, all four corner towers are enterable (walk-through rooms at rampart
// level, interior stairs to their roofs), and an exterior spiral staircase
// climbs the north-east tower to a cantilevered glide-launch pad at 36 m.
//
// Every solid piece is authored through helpers that emit BOTH the visual
// mesh and its collision box, so physics always matches what you see.
//
// Local coords: +z = south (toward spawn). Yard level y = 6.

export const CASTLE = { x: -120, z: -520, yard: 6 };
const CX = CASTLE.x, CZ = CASTLE.z;

const WALK = 13.2;                       // wall-walk height
const F_HALL = 10, F_THRONE = 18, F_BED = 26, F_ROOF = 33.5;
const W_IN = 30.5, W_OUT = 36.25;        // curtain wall faces (walk ~5.75 wide)
const T0 = 30, T1 = 40;                  // tower footprint band
const T_ROOF = 23.4;                     // tower roof deck
const PAD_Y = 36.2;                      // spiral launch pad

export const LETTERS = [
  { id: 'l1', x: CX + 2,  z: CZ - 6,  title: 'The Feast Unfinished',
    text: 'Set for forty, touched by none. The King rose mid-toast, they say, when the light in the east wood woke. "The Wardens kept their word," he said, and set down his cup. — steward’s note' },
  { id: 'l2', x: CX + 8,  z: CZ + 7,  title: 'The Order of Flames',
    text: 'When the court would open the deep vault, the flames were woken in the old order: WIND first, that carries; then EMBER, that warms; then TIDE, that keeps; and STONE last, that remembers. Mind the order — the braziers forget nothing.' },
  { id: 'l3', x: CX - 8,  z: CZ - 12, title: "The Queen's Last Letter",
    text: 'We do not flee, we follow. The beacon under the hollow hill has woken and the Wardens walk again. Keep the fires lit for whoever finds this place — let them know we left rich, and glad, and together.' },
  { id: 'l4', x: CX - 10, z: CZ - 8,  title: "The Steward's Ledger",
    text: 'Cellar: forty barrels laid down, dungeon empty these nine years (the last prisoner was a goose, and it was pardoned). The vault is sealed behind the throne. If you can read the flames, what is in it is yours.' },
];

// Brazier order for the vault: wind → ember → tide → stone
const BRAZIERS = [
  { id: 0, label: 'Wind',  color: 0xBFE8FF, dx: -12.5, dz: 0 },
  { id: 1, label: 'Ember', color: 0xFF8A3D, dx: 14,    dz: -12 },
  { id: 2, label: 'Tide',  color: 0x3D7BE8, dx: 14,    dz: 0 },
  { id: 3, label: 'Stone', color: 0xB0A898, dx: -12.5, dz: -12 },
];

export function createCastle(scene, { interact, audio, shells, progress }) {
  const group = new THREE.Group();
  scene.add(group);

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
    glass:  new THREE.MeshLambertMaterial({ color: 0x30405A, emissive: 0xFFC860, emissiveIntensity: 0.25 }),
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
  function solid(x0, x1, z0, z1, y0, y1, mat = M.stone, shadow = false) {
    walls.push({ x0: CX + x0, x1: CX + x1, z0: CZ + z0, z1: CZ + z1, y0, y1 });
    return mesh(x0, x1, z0, z1, y0, y1, mat, shadow);
  }
  function deck(x0, x1, z0, z1, top, mat = M.floor, thick = 0.35) {
    floors.push({ x0: CX + x0, x1: CX + x1, z0: CZ + z0, z1: CZ + z1, top });
    return mesh(x0, x1, z0, z1, top - thick, top, mat);
  }
  function stair(x0, x1, z0, z1, axis, h0, h1, mat = M.dark) {
    ramps.push({ x0: CX + x0, x1: CX + x1, z0: CZ + z0, z1: CZ + z1, axis, h0, h1 });
    const N = 10;
    for (let i = 0; i < N; i++) {
      const t0 = i / N, t1 = (i + 1) / N;
      const h = h0 + (h1 - h0) * t1;
      const lo = Math.min(h0 + (h1 - h0) * t0, h) - 0.3;
      if (axis === 'x') mesh(x0 + (x1 - x0) * t0, x0 + (x1 - x0) * t1, z0, z1, lo, h, mat);
      else              mesh(x0, x1, z0 + (z1 - z0) * t0, z0 + (z1 - z0) * t1, lo, h, mat);
    }
  }
  // Decorative window inset (visual only — glass glows warm at night)
  function windowPane(x0, x1, z0, z1, y0, y1) {
    mesh(x0, x1, z0, z1, y0, y1, M.glass);
  }

  // ═══ Moat water sheet (visible only in the carved ditch)
  {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(97, 97), M.water);
    w.rotation.x = -Math.PI / 2;
    w.position.set(CX, 4.35, CZ);
    group.add(w);
  }

  // ═══ Curtain walls — solid to WALK, broad walk decks, crenellated parapets
  solid(-W_OUT, W_OUT, -W_OUT, -W_IN, 4, WALK, M.stone, true);            // north
  solid(-W_OUT, -2.6, W_IN, W_OUT, 4, WALK, M.stone, true);               // south L
  solid(2.6, W_OUT, W_IN, W_OUT, 4, WALK, M.stone, true);                 // south R
  solid(-2.6, 2.6, W_IN, W_OUT, 9.5, WALK, M.stone);                      // gate lintel
  solid(-W_OUT, -W_IN, -W_OUT, W_OUT, 4, WALK, M.stone, true);            // west
  solid(W_IN, W_OUT, -W_OUT, W_OUT, 4, WALK, M.stone, true);              // east
  deck(-W_OUT, W_OUT, -W_OUT, -W_IN, WALK);
  deck(-W_OUT, W_OUT, W_IN, W_OUT, WALK);
  deck(-W_OUT, -W_IN, -W_IN, W_IN, WALK);
  deck(W_IN, W_OUT, -W_IN, W_IN, WALK);

  function parapet(x0, x1, z0, z1, along) {
    solid(x0, x1, z0, z1, WALK, WALK + 0.75, M.dark);
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

  // Grand yard stair to the wall-walk + landing bridging to the deck
  stair(-22, -5, 27, 29.6, 'x', WALK, CASTLE.yard);
  deck(-22, -5, 29.4, W_IN + 0.1, WALK, M.dark);
  solid(-22, -5, 26.6, 27, 6, WALK, M.dark);            // stair side rail

  // ═══ Corner towers — enterable: guard room (yard), walk-through room (WALK),
  //     interior stair to the roof, parapeted roof deck
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    // mirrored rect: local tower coords u,v ∈ [30,40] → world via sx/sz
    const R = (u0, u1, v0, v1) => [
      Math.min(sx * u0, sx * u1), Math.max(sx * u0, sx * u1),
      Math.min(sz * v0, sz * v1), Math.max(sz * v0, sz * v1),
    ];
    const S = (u0, u1, v0, v1, y0, y1, mat = M.dark, sh = false) => {
      const [a, b, c, d] = R(u0, u1, v0, v1);
      return solid(a, b, c, d, y0, y1, mat, sh);
    };
    const D = (u0, u1, v0, v1, top, mat = M.dark) => {
      const [a, b, c, d] = R(u0, u1, v0, v1);
      return deck(a, b, c, d, top, mat);
    };

    // inner-u face (u 30..31): walk door v 31..35, yard door v 36.5..39
    S(30, 31, 30, 31, 4, T_ROOF, M.dark, true);
    S(30, 31, 31, 35, 4, WALK, M.dark, true);
    S(30, 31, 31, 35, 16.4, T_ROOF, M.dark);
    S(30, 31, 35, 36.5, 4, T_ROOF, M.dark, true);
    S(30, 31, 36.5, 39, 8.8, T_ROOF, M.dark);
    S(30, 31, 39, 40, 4, T_ROOF, M.dark, true);
    // inner-v face (v 30..31): walk door u 31..35
    S(31, 35, 30, 31, 4, WALK, M.dark, true);
    S(31, 35, 30, 31, 16.4, T_ROOF, M.dark);
    S(35, 40, 30, 31, 4, T_ROOF, M.dark, true);
    // outer faces solid
    S(39, 40, 31, 40, 4, T_ROOF, M.dark, true);
    S(31, 39, 39, 40, 4, T_ROOF, M.dark, true);
    // window insets (visual) on outer faces at room + walk levels
    for (const wy of [8.5, 17.5]) {
      const [a, b, c, d] = R(39.9, 40.25, 33.5, 36.5);
      mesh(a, b, c, d, wy, wy + 2, M.glass);
      const [e, f, g, h2] = R(33.5, 36.5, 39.9, 40.25);
      mesh(e, f, g, h2, wy, wy + 2, M.glass);
    }

    // mid deck (walk-through room floor / guard-room ceiling)
    D(30, 40, 30, 40, WALK);
    // interior stair to the roof along the outer-v band + roof deck with hole
    {
      const [a, b, c, d] = R(31, 39, 37, 39);
      ramps.push({
        x0: CX + a, x1: CX + b, z0: CZ + c, z1: CZ + d, axis: 'x',
        h0: sx > 0 ? WALK : T_ROOF, h1: sx > 0 ? T_ROOF : WALK,
      });
      const N = 10;
      for (let i = 0; i < N; i++) {
        const t0 = i / N, t1 = (i + 1) / N;
        const hh0 = (sx > 0 ? WALK : T_ROOF) + ((sx > 0 ? T_ROOF : WALK) - (sx > 0 ? WALK : T_ROOF)) * t1;
        mesh(a + (b - a) * t0, a + (b - a) * t1, c, d, hh0 - 0.35, hh0, M.dark);
      }
    }
    D(30, 40, 30, 37, T_ROOF);
    D(30, 31, 37, 40, T_ROOF);
    D(39, 40, 37, 40, T_ROOF);
    // roof parapet — the NE (spiral) tower leaves a gap in its outer-u rim
    // where the spiral stair begins, or the stair would be unreachable
    const spiralTower = sx === 1 && sz === -1;
    S(30, 40, 39.5, 40, T_ROOF, T_ROOF + 1.4, M.dark);
    S(30, 40, 30, 30.5, T_ROOF, T_ROOF + 1.4, M.dark);
    S(30, 30.5, 30.5, 39.5, T_ROOF, T_ROOF + 1.4, M.dark);
    if (spiralTower) S(39.5, 40, 33, 39.5, T_ROOF, T_ROOF + 1.4, M.dark);
    else             S(39.5, 40, 30.5, 39.5, T_ROOF, T_ROOF + 1.4, M.dark);
    // guard-room dressing
    {
      const [a, b, c, d] = R(36, 39, 32, 33.2);
      mesh(a + 0.2, b - 0.2, c, d, 6, 8.4, M.wood);
      const [e, f, g, h2] = R(31.5, 33, 36.5, 38);
      mesh(e, f, g, h2, 6, 7.1, M.plank);
    }
  }

  // ═══ Spiral staircase — wraps the NE tower (x 30..40, z −40..−30) from its
  //     roof up to a cantilevered glide-launch pad. Four ramps, one per face.
  {
    const RAIL = (x0, x1, z0, z1, y0, y1) => solid(x0, x1, z0, z1, y0, y1, M.dark);
    stair(40, 41.8, -40, -30, 'z', 26.6, T_ROOF, M.stone);     // east face, climbing north
    RAIL(41.8, 42.1, -40, -30, T_ROOF, 27.6);
    stair(30, 41.8, -41.8, -40, 'x', 29.8, 26.6, M.stone);     // north face, climbing west
    RAIL(30, 42.1, -42.1, -41.8, 26.6, 30.8);
    stair(28.2, 30, -41.8, -30, 'z', 29.8, 33.0, M.stone);     // west face, climbing south
    RAIL(27.9, 28.2, -41.8, -30, 29.8, 34);
    stair(28.2, 40, -30, -28.2, 'x', 33.0, PAD_Y, M.stone);    // south face, climbing east
    RAIL(28.2, 40, -28.2, -27.9, 33, 37.2);
    // launch pad — open on its outer (east) edge: jump, spread your wings
    deck(40, 46, -33, -27, PAD_Y, M.dark);
    RAIL(40, 46, -33.3, -33, PAD_Y, PAD_Y + 1);
    RAIL(40, 46, -27, -26.7, PAD_Y, PAD_Y + 1);
    // support pillar down to the moat rock
    mesh(42.6, 43.6, -30.5, -29.5, 3, PAD_Y - 0.3, M.stone, true);
    // wind-tattered banner marks the jump
    const ban = new THREE.Mesh(new THREE.PlaneGeometry(1, 2.2),
      new THREE.MeshLambertMaterial({ color: 0x2A4A9A, side: THREE.DoubleSide }));
    ban.position.set(CX + 45.7, PAD_Y + 1.6, CZ - 33.1);
    group.add(ban);
    interact.register({
      x: CX + 44, z: CZ - 30, r: 3.5,
      label: '🪂 The wind howls past the edge…',
      when: () => _lastPlayerY > PAD_Y - 2,
      cb: () => toast('Hold SPACE as you leap — the island is yours from up here.', 3500),
    });
  }

  // ═══ Gatehouse — flanking turrets, portcullis, drawbridge over the moat
  solid(-8, -2.6, 32, 39, 4, WALK, M.stone, true);
  solid(2.6, 8, 32, 39, 4, WALK, M.stone, true);
  deck(-8, 8, 32, 39, WALK, M.dark);
  solid(-8, 8, 38.4, 39, WALK, WALK + 1.4, M.dark);
  for (const gx of [-5.3, 5.3]) {
    const cap = new THREE.Mesh(new THREE.ConeGeometry(2.6, 3.4, 4), M.roof);
    cap.position.set(CX + gx, WALK + 1.4 + 1.7, CZ + 35.5);
    cap.rotation.y = Math.PI / 4;
    group.add(cap);
  }
  for (let bx = -2.2; bx <= 2.2; bx += 0.55) {
    mesh(bx - 0.06, bx + 0.06, 36.4, 36.55, 8.4, 10.2, M.iron);
  }

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
  let bridgeDown = true, bridgeAnim = 1;

  function setBridge(down) {
    if (down === bridgeDown) return;
    bridgeDown = down;
    audio.sfx.grind();
    if (down) { floors.push(bridgeFloor); const i = walls.indexOf(gateBlock); if (i >= 0) walls.splice(i, 1); }
    else      { const i = floors.indexOf(bridgeFloor); if (i >= 0) floors.splice(i, 1); walls.push(gateBlock); }
    toast(down ? '🏰 The drawbridge rumbles down.' : '🏰 The drawbridge groans shut.', 2500);
  }
  for (const [lx, lz] of [[4.2, 36.5], [3.4, 51]]) {
    mesh(lx - 0.15, lx + 0.15, lz - 0.15, lz + 0.15, 6, 7.2, M.iron);
    interact.register({
      x: CX + lx, z: CZ + lz, r: 3.2,
      label: () => bridgeDown ? '🏰 Raise the drawbridge' : '🏰 Lower the drawbridge',
      cb: () => setBridge(!bridgeDown),
    });
  }

  // ═══ The Keep — 36×26 (x −18..18, z −15..11), grand storeys, tall doors
  const K = { x0: -18, x1: 18, z0: -15, z1: 11 };
  // north wall with the vault gap behind the throne
  solid(K.x0, -2.5, K.z0, K.z0 + 1, 4, F_ROOF, M.stone, true);
  solid(2.5, K.x1, K.z0, K.z0 + 1, 4, F_ROOF, M.stone, true);
  solid(-2.5, 2.5, K.z0, K.z0 + 1, 4, F_THRONE, M.stone);
  solid(-2.5, 2.5, K.z0, K.z0 + 1, 22, F_ROOF, M.stone);
  // south wall: grand door (y 10..14) + balcony door (y 26..29.5)
  solid(K.x0, -3, K.z1 - 1, K.z1, 4, F_ROOF, M.stone, true);
  solid(3, K.x1, K.z1 - 1, K.z1, 4, F_ROOF, M.stone, true);
  // riser under the grand door stops 0.4 below the sill: climbers on the
  // steps arrive with feet a touch below floor height, and the collision
  // capsule's radius would otherwise clip this wall and jam the doorway
  solid(-3, 3, K.z1 - 1, K.z1, 4, F_HALL - 0.4, M.stone);
  solid(-3, 3, K.z1 - 1, K.z1, 14, F_BED, M.stone);
  solid(-3, 3, K.z1 - 1, K.z1, 29.5, F_ROOF, M.stone);
  // west wall with the cellar door (z −9..−6, y 6..8.8)
  solid(K.x0, K.x0 + 1, K.z0, -9, 4, F_ROOF, M.stone, true);
  solid(K.x0, K.x0 + 1, -6, K.z1, 4, F_ROOF, M.stone, true);
  solid(K.x0, K.x0 + 1, -9, -6, 8.8, F_ROOF, M.stone);
  // east wall — notched to 0.4 below the roof where the exterior stair's
  // arrival bridge crosses it, so the capsule clears with real margin
  solid(K.x1 - 1, K.x1, K.z0, -6, 4, F_ROOF, M.stone, true);
  solid(K.x1 - 1, K.x1, -3, K.z1, 4, F_ROOF, M.stone, true);
  solid(K.x1 - 1, K.x1, -6, -3, 4, F_ROOF - 0.4, M.stone);
  // window insets on the outer faces at each storey (visual, warm at night)
  for (const wy of [F_HALL + 2.5, F_THRONE + 2.5, F_BED + 2.5]) {
    for (const wx of [-12, -5, 5, 12]) windowPane(wx - 1.2, wx + 1.2, K.z1 - 0.15, K.z1 + 0.15, wy, wy + 3.4);
    for (const wz of [-10, -2, 5]) {
      windowPane(K.x0 - 0.15, K.x0 + 0.15, wz - 1.2, wz + 1.2, wy, wy + 3.4);
      windowPane(K.x1 - 0.15, K.x1 + 0.15, wz - 1.2, wz + 1.2, wy, wy + 3.4);
    }
  }

  // storey slabs (holes over the stairwells). The hall slab extends THROUGH
  // the south doorway band (to K.z1) — without a floor in the door band,
  // players fell at the threshold and wedged inside the riser wall.
  deck(K.x0 + 1, K.x1 - 1, K.z0 + 1, K.z1, F_HALL);                        // hall floor / cellar ceiling
  deck(K.x0 + 1, 14.2, K.z0 + 1, K.z1 - 1, F_THRONE);                      // throne floor
  deck(14.2, K.x1 - 1, K.z0 + 1, -6, F_THRONE);
  deck(14.2, K.x1 - 1, 6, K.z1 - 1, F_THRONE);
  deck(-14.2, K.x1 - 1, K.z0 + 1, K.z1 - 1, F_BED);                        // chamber floor
  deck(K.x0 + 1, -14.2, K.z0 + 1, -12, F_BED);
  deck(K.x0 + 1, -14.2, 0, K.z1 - 1, F_BED);
  deck(K.x0 + 1, 14.2, K.z0 + 1, K.z1 - 1, F_ROOF, M.dark);                // roof deck
  deck(14.2, K.x1 - 1, -5.5, K.z1 - 1, F_ROOF, M.dark);
  // roof parapet — the east rim leaves a gap where the exterior stair arrives
  solid(K.x0, K.x1, K.z0, K.z0 + 0.5, F_ROOF, F_ROOF + 1.2, M.dark);
  solid(K.x0, K.x1, K.z1 - 0.5, K.z1, F_ROOF, F_ROOF + 1.2, M.dark);
  solid(K.x0, K.x0 + 0.5, K.z0, K.z1, F_ROOF, F_ROOF + 1.2, M.dark);
  solid(K.x1 - 0.5, K.x1, K.z0, -6, F_ROOF, F_ROOF + 1.2, M.dark);
  solid(K.x1 - 0.5, K.x1, -3, K.z1, F_ROOF, F_ROOF + 1.2, M.dark);

  // stairs: front steps, hall→throne (E), throne→chambers (W, kept clear of
  // the library partition), chambers→roof (E, entry at the bedroom's north
  // end so no partition crosses the run)
  stair(-3, 3, 11, 17, 'z', F_HALL, CASTLE.yard);
  stair(14.5, 17, -6, 6, 'z', F_THRONE, F_HALL);
  stair(-17, -14.5, -12, 0, 'z', F_BED, F_THRONE);
  deck(14.5, 17, -14, -12.7, F_BED);                       // flat boarding pad —
  stair(14.5, 17, -12.7, -5.5, 'z', F_BED, F_ROOF);        // entered flush from the west
  solid(14.2, 14.5, -6, 6, F_HALL, F_BED, M.stone);        // stairwell guards
  solid(-14.5, -14.2, -12, 0, F_THRONE, F_ROOF, M.stone);
  solid(14.2, 14.5, -12.7, -5.5, F_BED, F_ROOF, M.stone);

  // Exterior switchback staircase — courtyard to the keep roof up the east
  // face: two lanes side by side (inner z-runs at different heights, outer
  // return lane), landings at each turn, balustrade on the outside, and an
  // arrival bridge over the east wall through a gap in the roof parapet.
  stair(18, 19.9, -6, 10, 'z', 15.5, CASTLE.yard);         // flight 1 (inner, up northward)
  deck(18, 21.8, -7, -6, 15.5, M.dark);                    // north landing
  stair(19.9, 21.8, -6, 10, 'z', 15.5, 25);                // flight 2 (outer, up southward)
  deck(18, 21.8, 10, 13, 25, M.dark);                      // south landing
  stair(18, 19.9, -6, 10, 'z', F_ROOF, 25);                // flight 3 (inner, up northward)
  deck(17, 19.9, -6, -3, F_ROOF, M.dark);                  // arrival bridge — wide overlap
                                                           // with the solid roof strip
  solid(21.8, 22.1, -7, 13, 6, F_ROOF + 1, M.dark);        // outer balustrade
  solid(18, 22.1, -7.3, -7, 6, F_ROOF + 1, M.dark);        // north end wall
  solid(18, 22.1, 13, 13.3, 16, F_ROOF + 1, M.dark);       // south end (open below: entry)
  mesh(20.6, 21.6, -6.5, -5.5, 3, 15.2, M.stone, true);    // support piers
  mesh(20.6, 21.6, 11.5, 12.5, 3, 24.7, M.stone, true);

  // interior partitions (4-wide, 3.6-tall doorways)
  solid(-9.3, -8.7, K.z0 + 1, -3, F_HALL, F_THRONE, M.stone);              // kitchen wall
  solid(-9.3, -8.7, 1, K.z1 - 1, F_HALL, F_THRONE, M.stone);
  solid(-9.3, -8.7, -3, 1, F_HALL + 3.6, F_THRONE, M.stone);
  solid(K.x0 + 1, -2, 3.7, 4.3, F_THRONE, F_BED, M.stone);                 // library wall
  solid(2, K.x1 - 1, 3.7, 4.3, F_THRONE, F_BED, M.stone);
  solid(-2, 2, 3.7, 4.3, F_THRONE + 3.6, F_BED, M.stone);
  solid(K.x0 + 1, -2, -3.3, -2.7, F_BED, F_ROOF, M.stone);                 // solar wall
  solid(2, K.x1 - 1, -3.3, -2.7, F_BED, F_ROOF, M.stone);
  solid(-2, 2, -3.3, -2.7, F_BED + 3.6, F_ROOF, M.stone);
  // cellar partition + dungeon bars
  solid(-1.2, -0.6, K.z0 + 1, -8.5, CASTLE.yard, F_HALL, M.stone);
  solid(-1.2, -0.6, -3.5, K.z1 - 1, CASTLE.yard, F_HALL, M.stone);
  for (let bz = -8.2; bz < -3.8; bz += 0.6) {
    mesh(-1.0, -0.8, bz - 0.07, bz + 0.07, 6, 8.6, M.iron);
  }

  // balcony off the solar (south face) — deck reaches back through the
  // doorway band so the threshold has a floor
  deck(-4, 4, 10.5, 14.5, F_BED, M.dark);
  solid(-4, 4, 14.1, 14.5, F_BED, F_BED + 1.1, M.dark);
  solid(-4, -3.6, 11, 14.5, F_BED, F_BED + 1.1, M.dark);
  solid(3.6, 4, 11, 14.5, F_BED, F_BED + 1.1, M.dark);

  // ═══ Furnishings ═══════════════════════════════════════════════════════════
  // Great hall (x −9..17): banquet table, benches, carpet, hearth, chandeliers
  mesh(-1, 7, -9, 5, F_HALL + 0.85, F_HALL + 1.05, M.wood, true);
  for (const tz of [-8, -2, 4]) mesh(0, 6, tz - 0.2, tz + 0.2, F_HALL, F_HALL + 0.88, M.wood);
  for (const bx of [-2.4, 8.4]) mesh(bx - 0.5, bx + 0.5, -9, 5, F_HALL + 0.4, F_HALL + 0.58, M.plank);
  mesh(-1.8, 1.8, 5.5, 9.9, F_HALL + 0.01, F_HALL + 0.03, M.red);
  mesh(4, 10, K.z0 + 1, K.z0 + 2.4, F_HALL, F_HALL + 3.2, M.dark);         // hearth
  mesh(5, 9, K.z0 + 1.5, K.z0 + 2.1, F_HALL + 0.3, F_HALL + 1.4, M.flame);
  for (const cz of [-7, 1]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.1, 6, 16), M.wood);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(CX + 4, F_THRONE - 2.6, CZ + cz);
    group.add(ring);
    for (let a = 0; a < 8; a++) {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.32, 5), M.flame);
      c.position.set(CX + 4 + Math.cos(a * 0.785) * 1.6, F_THRONE - 2.4, CZ + cz + Math.sin(a * 0.785) * 1.6);
      group.add(c);
    }
  }
  // kitchen (x −17..−9)
  mesh(K.x0 + 1, K.x0 + 2.4, -6, -2, F_HALL, F_HALL + 2.8, M.dark);
  mesh(K.x0 + 1.4, K.x0 + 2.1, -5, -3, F_HALL + 0.3, F_HALL + 1.2, M.flame);
  mesh(-14, -11, 5, 6.6, F_HALL + 0.8, F_HALL + 1.0, M.plank);
  for (const [bx, bz] of [[-16, 8], [-14.8, 8.6], [-15.6, 7]]) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.3, 8), M.wood);
    b.position.set(CX + bx, F_HALL + 0.65, CZ + bz);
    group.add(b);
  }
  // cellar
  for (const [bx, bz] of [[-14, -11], [-12.6, -11.4], [-13.4, -9.8], [4, -11], [6, -10.6], [10, 6]]) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 1.4, 8), M.wood);
    b.position.set(CX + bx, CASTLE.yard + 0.7, CZ + bz);
    group.add(b);
  }
  // throne room (z −15..4): dais, throne, carpet
  mesh(-4, 4, K.z0 + 1, K.z0 + 5, F_THRONE + 0.01, F_THRONE + 0.5, M.dark);
  mesh(-1.1, 1.1, K.z0 + 1.8, K.z0 + 2.8, F_THRONE + 0.5, F_THRONE + 3.4, M.gold, true);
  mesh(-0.9, 0.9, K.z0 + 2.8, K.z0 + 3.7, F_THRONE + 0.5, F_THRONE + 1.3, M.gold);
  mesh(-1.4, 1.4, K.z0 + 5, 3.6, F_THRONE + 0.01, F_THRONE + 0.03, M.red);
  // library (z 4..11)
  for (const sx of [-15, -10, -4, 3, 9]) {
    mesh(sx, sx + 2.8, 9.4, 10.4, F_THRONE, F_THRONE + 3.6, M.wood);
  }
  mesh(7, 9.5, 6.4, 7.6, F_THRONE + 0.9, F_THRONE + 1.1, M.plank);          // lectern
  // royal chamber (z −15..−3): canopy bed, rug; solar (z −3..11): table
  mesh(-11, -5, K.z0 + 2, K.z0 + 6, F_BED + 0.5, F_BED + 1.15, M.red);
  mesh(-11, -5, K.z0 + 1.6, K.z0 + 2, F_BED, F_BED + 3.2, M.wood);
  mesh(-11, -5, K.z0 + 1.6, K.z0 + 6, F_BED + 3.2, F_BED + 3.4, M.red);
  mesh(2, 9, -12, -6, F_BED + 0.01, F_BED + 0.03, M.red);
  mesh(-2.2, 2.2, 3, 5.4, F_BED + 0.45, F_BED + 0.65, M.plank);
  // roof: flag
  {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 5.5, 6), M.iron);
    pole.position.set(CX, F_ROOF + 2.7, CZ - 3);
    group.add(pole);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.3), new THREE.MeshLambertMaterial({ color: 0x2A4A9A, side: THREE.DoubleSide }));
    flag.position.set(CX + 1.4, F_ROOF + 4.7, CZ - 3);
    group.add(flag);
  }
  // yard: well, banners, cobble path
  {
    const wellW = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.2, 1, 10), M.dark);
    wellW.position.set(CX + 14, CASTLE.yard + 0.5, CZ + 21);
    group.add(wellW);
    const wellR = new THREE.Mesh(new THREE.ConeGeometry(1.5, 1, 8), M.roof);
    wellR.position.set(CX + 14, CASTLE.yard + 2.6, CZ + 21);
    group.add(wellR);
    mesh(-1.5, 1.5, 17, 30.5, CASTLE.yard + 0.01, CASTLE.yard + 0.03, M.dark);
    for (const bx of [-5.5, 5.5]) {
      const ban = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 3.6), new THREE.MeshLambertMaterial({ color: 0x2A4A9A, side: THREE.DoubleSide }));
      ban.position.set(CX + bx, F_HALL + 4.2, CZ + K.z1 + 0.06);
      group.add(ban);
    }
  }

  // ═══ Vault — annex behind the throne, opened by the brazier order
  const vaultDone = () => !!load('castle:vault', false);
  solid(-5, 5, -22, -21.3, F_THRONE, F_BED, M.stone, true);
  solid(-5, -4.3, -21.3, K.z0, F_THRONE, F_BED, M.stone, true);
  solid(4.3, 5, -21.3, K.z0, F_THRONE, F_BED, M.stone, true);
  deck(-5, 5, -22, K.z0 + 1, F_THRONE, M.dark);   // through the vault doorway band
  mesh(-5, 5, -22, K.z0 + 0.2, F_BED - 0.3, F_BED, M.stone);               // vault ceiling
  for (const [gx, gz, s] of [[-2.5, -19, 0.9], [0, -20, 1.2], [2.4, -18.8, 0.8], [1.2, -17.4, 0.6]]) {
    const pile = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), M.gold);
    pile.position.set(CX + gx, F_THRONE + s * 0.5, CZ + gz);
    group.add(pile);
  }
  const vaultWallBox = { x0: CX - 2.5, x1: CX + 2.5, z0: CZ + K.z0 - 0.1, z1: CZ + K.z0 + 1, y0: F_THRONE, y1: F_THRONE + 4 };
  const vaultWallMesh = mesh(-2.5, 2.5, K.z0 - 0.1, K.z0 + 1, F_THRONE, F_THRONE + 4, M.dark);
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
      x: CX + b.dx, z: CZ + b.dz, r: 2.8,
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
    x: CX, z: CZ - 19, r: 3,
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

  // ═══ Royal letters
  for (const L of LETTERS) {
    const ly = L.id === 'l3' ? F_BED + 0.9 : L.id === 'l2' ? F_THRONE + 1.15 : L.id === 'l4' ? CASTLE.yard + 0.8 : F_HALL + 1.08;
    const desk = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.65),
      new THREE.MeshLambertMaterial({ color: 0xEDE3C8 }));
    desk.position.set(L.x, ly, L.z);
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

  // ═══ Lights — gated by distance; the castle costs nothing from afar
  const lights = [];
  function addLight(color, intensity, dist, x, y, z) {
    const l = new THREE.PointLight(color, intensity, dist);
    l.position.set(CX + x, y, CZ + z);
    l.visible = false;
    scene.add(l);
    lights.push(l);
    return l;
  }
  const hearthL = addLight(0xFF7A20, 1.9, 30, 7, F_HALL + 2, K.z0 + 3);
  addLight(0xFFB050, 1.6, 28, 0, F_THRONE + 4, -6);
  addLight(0xFFC080, 1.2, 22, -6, F_BED + 3, -9);
  addLight(0xFF8030, 1.3, 26, 14, CASTLE.yard + 2.4, 21);
  addLight(0xFFD75A, 1.5, 16, 0, F_THRONE + 2.5, -18.5);

  function playerAbove(y) { return _lastPlayerY > y; }
  let _lastPlayerY = 0;

  // ═══ Register with the shared collision engine
  addStructure({ x: CX, z: CZ, r: 100, walls, floors, ramps });

  function update(dt, nowSec, playerPos) {
    _lastPlayerY = playerPos.y;
    const target = bridgeDown ? 1 : 0;
    if (bridgeAnim !== target) {
      bridgeAnim += (target - bridgeAnim) * Math.min(1, dt * 2.2);
      if (Math.abs(bridgeAnim - target) < 0.01) bridgeAnim = target;
      bridge.rotation.x = -(1 - bridgeAnim) * 1.45;
    }
    const near = Math.hypot(playerPos.x - CX, playerPos.z - CZ) < 150;
    for (const l of lights) l.visible = near;
    if (near) hearthL.intensity = 1.7 + Math.sin(nowSec * 7.1) * 0.25 + Math.sin(nowSec * 13.7) * 0.12;
  }

  return { update, CASTLE };
}
