import * as THREE from 'three';
import { makeBuilder } from './build.js';
import { toast } from './hud.js';
import { save, load } from './persistence.js';
import { CASTLE } from './castle.js';

// ── The Deep Halls ───────────────────────────────────────────────────────────
// A second dungeon level beneath the Undercroft, four times its floor plan
// (136 × 124 against 68 × 62), reached by knocking on the Deep Door and
// taking a switchback stair 24 m further down.
//
// At its heart the Underhall: a vast pillared chamber with a twenty-metre
// ceiling — twice the height of the Undercroft above it. Six chambers open
// off it through tunnels, three of them plainly still lived in: a working
// forge, a sleeping hall with the table still set, and an archive with a
// book left open beside a burnt-down candle.
//
// Everything sits inside one Group that is hidden unless the player is
// actually underground near the castle, so the level costs nothing on the
// surface.

const F       = -30;    // deep floor
const C_HALL  = -10;    // Underhall ceiling — 20 m of air
const C_ROOM  = -20;    // chambers and tunnels — 10 m, same as the Undercroft
const SHAFT_T = -1.5;   // stairwell ceiling, just under the Undercroft floor

// Chambers: [x0, x1, z0, z1]
const HALL    = [-28, 28, -26, 26];
const GROTTO  = [-68, -8, -62, -34];
const GALLERY = [4, 56, -62, -34];
const FORGE   = [40, 68, -20, 6];
const ARCHIVE = [38, 68, 18, 50];
const REST    = [-4, 34, 34, 62];
const SUMP    = [-68, -14, 34, 62];

export function createDeepHalls(scene, { interact, audio, shells, playerPosition }) {
  const B = makeBuilder(scene, CASTLE);
  const { mesh, solid, deck, stair, basement } = B;

  const M = {
    rock:   new THREE.MeshLambertMaterial({ color: 0x6E6A62, flatShading: true }),
    dark:   new THREE.MeshLambertMaterial({ color: 0x4E4A44, flatShading: true }),
    floor:  new THREE.MeshLambertMaterial({ color: 0x5A564E, flatShading: true }),
    pillar: new THREE.MeshLambertMaterial({ color: 0x8A8478, flatShading: true }),
    wood:   new THREE.MeshLambertMaterial({ color: 0x6B4A22, flatShading: true }),
    plank:  new THREE.MeshLambertMaterial({ color: 0x8A6A40, flatShading: true }),
    cloth:  new THREE.MeshLambertMaterial({ color: 0x8A3A34 }),
    cloth2: new THREE.MeshLambertMaterial({ color: 0x35566A }),
    iron:   new THREE.MeshLambertMaterial({ color: 0x3A3A40 }),
    paper:  new THREE.MeshLambertMaterial({ color: 0xE8DCC0 }),
    ember:  new THREE.MeshLambertMaterial({ color: 0xFF7A20, emissive: 0xFF5A08, emissiveIntensity: 1.5 }),
    flame:  new THREE.MeshLambertMaterial({ color: 0xFFD060, emissive: 0xFF9020, emissiveIntensity: 1.4 }),
    fungus: new THREE.MeshLambertMaterial({ color: 0x8FE8C8, emissive: 0x3FB88F, emissiveIntensity: 1.1 }),
    water:  new THREE.MeshPhongMaterial({
      color: 0x1B3A4A, specular: 0x6FA8C8, shininess: 120, transparent: true, opacity: 0.85,
    }),
  };

  // Terrain release: inside these volumes the surface heightmap stops
  // claiming the player, which is what lets these rooms exist underground.
  // `top` sits just above each area's floor so the surface is untouched.
  basement(-57, -31, -19, 19, -1.2);      // entry passage + stairwell
  basement(-70, 70, -84, 64, -8);         // the Deep Halls + the Deep Road

  // ── One continuous floor slab: nobody can ever fall into the void ─────────
  deck(-68, 68, -62, 62, F, M.floor, 0.6);

  // Ceilings are per-room; the solid rock between chambers needs none
  const roof = ([x0, x1, z0, z1], y = C_ROOM) => mesh(x0, x1, z0, z1, y - 0.6, y, M.rock, true);

  // Four walls around a chamber, with `gaps` punched for doorways:
  //   gap = { side: 'n'|'s'|'e'|'w', a, b }  (a→b along the wall's free axis)
  function room([x0, x1, z0, z1], gaps = [], top = C_ROOM, mat = M.rock) {
    const T = 0.7;
    const spans = (lo, hi, cuts) => {
      const out = [];
      let cur = lo;
      for (const c of cuts.sort((p, q) => p.a - q.a)) {
        if (c.a > cur) out.push([cur, c.a]);
        cur = Math.max(cur, c.b);
      }
      if (cur < hi) out.push([cur, hi]);
      return out;
    };
    for (const [side, lo, hi] of [['n', x0, x1], ['s', x0, x1], ['w', z0, z1], ['e', z0, z1]]) {
      const cuts = gaps.filter(g => g.side === side).map(g => ({ a: g.a, b: g.b }));
      for (const [a, b] of spans(lo, hi, cuts)) {
        if (side === 'n')      solid(a, b, z0 - T, z0, F, top, mat, true);
        else if (side === 's') solid(a, b, z1, z1 + T, F, top, mat, true);
        else if (side === 'w') solid(x0 - T, x0, a, b, F, top, mat, true);
        else                   solid(x1, x1 + T, a, b, F, top, mat, true);
      }
    }
  }

  // A tunnel between two chambers: floor is the shared slab, so just walls+roof
  function tunnel(x0, x1, z0, z1) {
    const T = 0.7;
    if (x1 - x0 > z1 - z0) {          // runs east-west
      solid(x0, x1, z0 - T, z0, F, C_ROOM, M.rock);
      solid(x0, x1, z1, z1 + T, F, C_ROOM, M.rock);
    } else {                          // runs north-south
      solid(x0 - T, x0, z0, z1, F, C_ROOM, M.rock);
      solid(x1, x1 + T, z0, z1, F, C_ROOM, M.rock);
    }
    roof([x0, x1, z0, z1]);
  }

  // ═══ Entry: passage beyond the Deep Door, then a switchback descent ═══════
  // Passage runs west from the door plane (x −32) at Undercroft floor level
  deck(-42, -32, 12.5, 15.5, -6, M.floor);
  solid(-42, -32, 11.8, 12.5, -6, SHAFT_T, M.rock);
  solid(-42, -32, 15.5, 16.2, -6, SHAFT_T, M.rock);
  mesh(-42, -32, 12.5, 15.5, SHAFT_T, SHAFT_T + 0.6, M.rock);

  // Stairwell — an open shaft, both flights visible from the bottom
  const SH = { x0: -56, x1: -42, z0: -18, z1: 18 };
  deck(-50, -42, 12, 16.2, -6, M.floor);                      // top landing
  stair(-50, -44, -12, 14, 'z', -18, -6, M.dark, 14);         // flight 1, descending north
  deck(-54, -44, -16.5, -12, -18, M.dark);                    // turn landing
  stair(-54, -50, -12, 14, 'z', -18, F, M.dark, 14);          // flight 2, descending south
  deck(-56, -50, 14, 18, F, M.dark);                          // arrival landing
  solid(-50.4, -50, -12, 14, F, -6, M.rock);                  // spine between flights
  // shaft shell
  solid(SH.x0 - 0.7, SH.x0, SH.z0, SH.z1, F, SHAFT_T, M.rock);
  solid(SH.x0, SH.x1, SH.z0 - 0.7, SH.z0, F, SHAFT_T, M.rock);
  solid(SH.x0, SH.x1, SH.z1, SH.z1 + 0.7, F, SHAFT_T, M.rock);
  // East wall of the shaft, pierced twice at different heights: the exit
  // tunnel low (below −20) and the entry passage high (−6 up to the ceiling)
  solid(SH.x1, SH.x1 + 0.7, SH.z0, 10, F, SHAFT_T, M.rock);
  solid(SH.x1, SH.x1 + 0.7, 10, 12.5, C_ROOM, SHAFT_T, M.rock);   // over the tunnel
  solid(SH.x1, SH.x1 + 0.7, 12.5, 15, C_ROOM, -6, M.rock);        // between both openings
  solid(SH.x1, SH.x1 + 0.7, 15, 15.5, F, -6, M.rock);             // under the passage
  solid(SH.x1, SH.x1 + 0.7, 15.5, SH.z1, F, SHAFT_T, M.rock);
  mesh(SH.x0, SH.x1, SH.z0, SH.z1, SHAFT_T, SHAFT_T + 0.6, M.rock);
  // Starts at the shaft's east wall, not inside it — running it further west
  // walled off the stairwell floor and left only a one-metre squeeze
  tunnel(-41.3, -28, 10, 15);                                 // shaft → Underhall

  // ═══ The Underhall — vast, twenty metres to the ceiling ══════════════════
  room(HALL, [
    { side: 'w', a: 10,  b: 15 },    // from the stair
    { side: 'e', a: -10, b: -4 },    // to the Forge
    { side: 'e', a: 20,  b: 26 },    // to the Archive
    { side: 'n', a: -24, b: -18 },   // to the Fungal Grotto
    { side: 'n', a: 14,  b: 20 },    // to the Collapsed Gallery
    { side: 's', a: -26, b: -20 },   // to the Sump
    { side: 's', a: 10,  b: 16 },    // to the Warden's Rest
  ], C_HALL, M.pillar);
  roof(HALL, C_HALL);
  // The hall's wall is 20 m tall but its doorways are only 10 — cap each
  // opening so they read as arches rather than full-height slots
  for (const [ax, bx, z0, z1] of [[-24, -18, -26.7, -26], [14, 20, -26.7, -26],
                                  [-26, -20, 26, 26.7], [10, 16, 26, 26.7]]) {
    solid(ax, bx, z0, z1, C_ROOM, C_HALL, M.pillar);
  }
  for (const [az, bz, x0, x1] of [[10, 15, -28.7, -28], [-10, -4, 28, 28.7], [20, 26, 28, 28.7]]) {
    solid(x0, x1, az, bz, C_ROOM, C_HALL, M.pillar);
  }

  // Twelve great pillars in four ranks
  for (const px of [-21, -7, 7, 21]) {
    for (const pz of [-16, 0, 16]) {
      solid(px - 1.3, px + 1.3, pz - 1.3, pz + 1.3, F, C_HALL, M.pillar, true);
      mesh(px - 1.9, px + 1.9, pz - 1.9, pz + 1.9, F, F + 0.8, M.pillar);        // plinth
      mesh(px - 1.9, px + 1.9, pz - 1.9, pz + 1.9, C_HALL - 0.9, C_HALL, M.pillar); // capital
    }
  }
  // A ring of braziers picks out the centre of the floor
  for (const [bx, bz] of [[-14, -8], [14, -8], [-14, 8], [14, 8]]) {
    mesh(bx - 0.5, bx + 0.5, bz - 0.5, bz + 0.5, F, F + 1.1, M.iron);
    mesh(bx - 0.7, bx + 0.7, bz - 0.7, bz + 0.7, F + 1.1, F + 1.5, M.ember);
  }

  // ═══ Tunnels + chambers ═════════════════════════════════════════════════
  tunnel(-24, -18, -34, -26);  room(GROTTO,  [{ side: 's', a: -24, b: -18 }], C_ROOM, M.dark);
  tunnel(14, 20, -34, -26);    room(GALLERY, [{ side: 's', a: 14, b: 20 },
                                              { side: 'n', a: 34, b: 42 }]);  // the Deep Road
  tunnel(28, 40, -10, -4);     room(FORGE,   [{ side: 'w', a: -10, b: -4 }]);
  tunnel(28, 38, 20, 26);      room(ARCHIVE, [{ side: 'w', a: 20,  b: 26 }]);
  tunnel(10, 16, 26, 34);      room(REST,    [{ side: 'n', a: 10,  b: 16 }]);
  tunnel(-26, -20, 26, 34);    room(SUMP,    [{ side: 'n', a: -26, b: -20 }]);
  for (const r of [GROTTO, GALLERY, FORGE, ARCHIVE, REST, SUMP]) roof(r);

  // ── The Fungal Grotto — glowing caps, still pools, uneven rock ────────────
  for (let i = 0; i < 26; i++) {
    const gx = -64 + Math.random() * 54, gz = -58 + Math.random() * 22;
    const s = 0.5 + Math.random() * 1.1;
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.13, s * 0.18, s * 1.3, 5), M.dark);
    stalk.position.set(CASTLE.x + gx, F + s * 0.65, CASTLE.z + gz);
    B.group.add(stalk);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(s * 0.5, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), M.fungus);
    cap.position.set(CASTLE.x + gx, F + s * 1.3, CASTLE.z + gz);
    B.group.add(cap);
  }
  for (const [px, pz, r] of [[-52, -46, 5], [-24, -52, 4], [-38, -40, 3.2]]) {
    const pool = new THREE.Mesh(new THREE.CircleGeometry(r, 16), M.water);
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(CASTLE.x + px, F + 0.08, CASTLE.z + pz);
    B.group.add(pool);
  }
  for (let i = 0; i < 14; i++) {
    const rx = -64 + Math.random() * 54, rz = -58 + Math.random() * 24;
    const s = 0.8 + Math.random() * 1.8;
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), M.rock);
    rock.position.set(CASTLE.x + rx, F + s * 0.4, CASTLE.z + rz);
    rock.rotation.set(Math.random(), Math.random(), Math.random());
    B.group.add(rock);
  }

  // ── The Collapsed Gallery — broken pillars, rubble, a cave-in ────────────
  for (const [px, h] of [[10, 6], [22, 3], [34, 8], [46, 2.5]]) {
    solid(px - 1.2, px + 1.2, -50, -47.6, F, F + h, M.pillar, true);
  }
  for (let i = 0; i < 22; i++) {
    const rx = 6 + Math.random() * 48, rz = -60 + Math.random() * 24;
    const s = 0.7 + Math.random() * 2.2;
    const rub = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), M.pillar);
    rub.position.set(CASTLE.x + rx, F + s * 0.35, CASTLE.z + rz);
    rub.rotation.set(Math.random(), Math.random(), Math.random());
    B.group.add(rub);
  }
  // The cave-in — heaving the middle aside opens the Deep Road, the tunnel
  // the Deepwardens used before the roof came down
  solid(20, 34, -62, -58, F, C_ROOM, M.rock);
  solid(42, 56, -62, -58, F, C_ROOM, M.rock);
  const roadBox = {
    x0: CASTLE.x + 34, x1: CASTLE.x + 42,
    z0: CASTLE.z - 62, z1: CASTLE.z - 58, y0: F, y1: C_ROOM,
  };
  const roadMesh = mesh(34, 42, -62, -58, F, C_ROOM, M.rock, true);
  let roadOpen = !!load('deep:road', false);
  if (roadOpen) roadMesh.visible = false;
  else B.walls.push(roadBox);
  mesh(20, 33, -58.4, -56, F, F + 7, M.pillar);        // spill of fallen stone

  // Beyond it: a short tunnel to the ley chamber at the road's head
  deck(30, 46, -82, -60, F, M.floor, 0.6);
  tunnel(34, 42, -70, -58);
  room([30, 46, -80, -70], [{ side: 's', a: 34, b: 42 }]);
  roof([30, 46, -80, -70]);
  for (const [tx, tz] of [[32, -74], [44, -74]]) {
    mesh(tx - 0.1, tx + 0.1, tz - 0.1, tz + 0.1, F + 1.7, F + 2.7, M.iron);
    mesh(tx - 0.17, tx + 0.17, tz - 0.17, tz + 0.17, F + 2.7, F + 3.15, M.flame);
  }

  interact.register({
    x: CASTLE.x + 38, z: CASTLE.z - 60, r: 4,
    label: '⛏ Heave the fallen stone aside',
    when: () => playerPosition.y < -14 && !roadOpen,
    cb: () => {
      roadOpen = true;
      save('deep:road', true);
      const i = B.walls.indexOf(roadBox);
      if (i >= 0) B.walls.splice(i, 1);
      roadMesh.visible = false;
      audio.sfx.grind();
      audio.sfx.fanfare();
      toast('The rubble gives. Behind it a worked tunnel runs on into the dark —\nthe Deep Road, and a standing stone at the head of it.', 8000);
    },
  });

  // ── The Forge — banked coals, work left half-finished ───────────────────
  mesh(62, 67, -14, -8, F, F + 2.4, M.dark);                       // hearth
  mesh(63, 66, -13.2, -8.8, F + 2.4, F + 3, M.ember);              // coals
  mesh(64, 65.4, -14, -8, F + 3, F + 9, M.dark);                   // flue
  mesh(56, 58.6, -6, -3.4, F, F + 0.9, M.dark);                    // anvil block
  mesh(55.4, 59.2, -6.4, -3, F + 0.9, F + 1.25, M.iron);           // anvil
  mesh(56.4, 58.2, -5.2, -4.2, F + 1.25, F + 1.35, M.iron);        // half-made blade
  mesh(60, 63, -2, 1, F, F + 1.1, M.wood);                         // quench trough
  mesh(60.2, 62.8, -1.8, 0.8, F + 1.05, F + 1.1, M.water);
  mesh(50, 54, -18, -17.4, F + 1.6, F + 3.4, M.wood);              // tool rack
  for (const tx of [50.6, 51.6, 52.6, 53.4]) {
    mesh(tx - 0.09, tx + 0.09, -17.8, -17.6, F + 1.9, F + 3.1, M.iron);
  }
  mesh(52, 53.2, -2, -0.8, F, F + 0.55, M.wood);                   // stool
  for (const [ix, iz] of [[47, 3], [48.2, 3.4], [47.6, 2.2]]) {    // ingot stack
    mesh(ix - 0.5, ix + 0.5, iz - 0.3, iz + 0.3, F, F + 0.25, M.iron);
  }

  // ── The Warden's Rest — bunks, a table still set, embers in the grate ───
  for (let i = 0; i < 4; i++) {
    const bz = 38 + i * 5.5;
    mesh(28, 32.4, bz, bz + 2.2, F + 0.5, F + 0.8, M.wood);        // bunk frame
    mesh(28.2, 32.2, bz + 0.15, bz + 2.05, F + 0.8, F + 1.05, i % 2 ? M.cloth : M.cloth2);
    mesh(28, 28.6, bz, bz + 2.2, F, F + 1.6, M.wood);              // headboard
  }
  mesh(8, 20, 44, 48, F + 0.85, F + 1.05, M.plank, true);          // long table
  for (const tz of [45, 47]) for (const tx of [9.2, 18.8]) {
    mesh(tx - 0.2, tx + 0.2, tz - 0.2, tz + 0.2, F, F + 0.85, M.wood);
  }
  mesh(8, 20, 42.4, 43.6, F + 0.42, F + 0.58, M.plank);            // bench
  mesh(9.6, 21.6, 48.4, 49.6, F + 0.42, F + 0.58, M.plank);        // bench pushed out
  for (const [cx2, cz2] of [[10.5, 45.4], [13, 46.6], [16, 45.2], [18.4, 46.8]]) {
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.19, 0.2, 8), M.paper);
    bowl.position.set(CASTLE.x + cx2, F + 1.15, CASTLE.z + cz2);
    B.group.add(bowl);
  }
  mesh(-2, 3, 58, 60, F, F + 2.6, M.dark);                         // hearth
  mesh(-1.2, 2.2, 58.4, 59.6, F + 0.2, F + 0.9, M.ember);          // embers
  mesh(-3, 6, 52, 56, F + 0.01, F + 0.04, M.cloth);                // rug
  mesh(22, 26, 56, 56.6, F + 1.4, F + 3.2, M.wood);                // shelf
  for (const bx of [22.6, 23.6, 24.6]) {                           // pots on it
    mesh(bx - 0.22, bx + 0.22, 56.1, 56.5, F + 3.2, F + 3.7, M.paper);
  }
  mesh(5.4, 6.2, 39, 39.8, F, F + 0.45, M.wood);                   // a pair of boots
  mesh(6.4, 7.2, 39.1, 39.9, F, F + 0.45, M.wood);
  for (let i = 0; i < 5; i++) {                                    // washing on a line
    mesh(-1 + i * 2.2, 0.6 + i * 2.2, 36.4, 36.5, F + 2.2, F + 3.1, i % 2 ? M.cloth2 : M.paper);
  }

  // ── The Archive — a book left open, a candle burnt to the stub ───────────
  for (const sz of [22, 30, 38]) {
    mesh(62, 67, sz, sz + 5, F, F + 5, M.wood);                    // shelf stacks
    for (let i = 0; i < 7; i++) {                                  // scroll ends
      const r = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.7, 6), M.paper);
      r.rotation.z = Math.PI / 2;
      r.position.set(CASTLE.x + 61.8, F + 1 + (i % 4) * 1.1, CASTLE.z + sz + 0.6 + (i % 5) * 0.75);
      B.group.add(r);
    }
  }
  mesh(46, 51, 28, 31, F + 0.9, F + 1.05, M.plank, true);          // reading desk
  for (const [dx2, dz2] of [[46.4, 28.4], [50.4, 28.4], [46.4, 30.4], [50.4, 30.4]]) {
    mesh(dx2 - 0.15, dx2 + 0.15, dz2 - 0.15, dz2 + 0.15, F, F + 0.9, M.wood);
  }
  mesh(47.4, 49.6, 28.9, 29.9, F + 1.05, F + 1.12, M.paper);       // the open book
  mesh(48.4, 48.55, 28.9, 29.9, F + 1.12, F + 1.2, M.paper);       // its spine
  mesh(50.2, 50.5, 30.2, 30.5, F + 1.05, F + 1.5, M.paper);        // candle stub
  mesh(50.25, 50.45, 30.25, 30.45, F + 1.5, F + 1.75, M.flame);
  mesh(45.6, 46.8, 32, 33.2, F, F + 0.55, M.wood);                 // chair, pushed back
  for (const [px, pz] of [[44, 26], [52, 33], [47, 35], [55, 24]]) {  // dropped pages
    mesh(px - 0.4, px + 0.4, pz - 0.55, pz + 0.55, F + 0.01, F + 0.03, M.paper);
  }
  mesh(58, 58.4, 20, 24, F, F + 4.6, M.wood);                      // ladder rails
  mesh(59.4, 59.8, 20, 24, F, F + 4.6, M.wood);
  for (let i = 0; i < 6; i++) mesh(58.4, 59.4, 20.4 + i * 0.6, 20.6 + i * 0.6, F + 0.7 * i, F + 0.7 * i + 0.14, M.wood);

  // ── The Sump — black water between pillars ───────────────────────────────
  mesh(-66, -16, 36, 60, F + 0.42, F + 0.5, M.water);
  for (const px of [-58, -44, -30, -20]) for (const pz of [42, 54]) {
    solid(px - 1, px + 1, pz - 1, pz + 1, F, C_ROOM, M.pillar, true);
  }
  for (let i = 0; i < 10; i++) {
    const rx = -64 + Math.random() * 46, rz = 37 + Math.random() * 22;
    const s = 0.6 + Math.random() * 1.2;
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), M.dark);
    rock.position.set(CASTLE.x + rx, F + s * 0.3, CASTLE.z + rz);
    B.group.add(rock);
  }

  // ── Torches along the routes so the halls read as tended ─────────────────
  for (const [tx, tz] of [
    [-46, 16], [-46, -10], [-30, 12], [-26, -6], [-26, 20], [26, -6], [26, 20],
    [0, -24], [0, 24], [-20, -30], [16, -30], [12, 30], [-24, 30], [34, -7], [34, 23],
    [-10, -40], [30, -46], [46, -12], [54, 26], [16, 50], [-30, 40],
  ]) {
    mesh(tx - 0.1, tx + 0.1, tz - 0.1, tz + 0.1, F + 1.7, F + 2.7, M.iron);
    mesh(tx - 0.17, tx + 0.17, tz - 0.17, tz + 0.17, F + 2.7, F + 3.15, M.flame);
  }

  // ═══ Lore + a cache ══════════════════════════════════════════════════════
  const say = (x, z, label, text, ms = 9000) => interact.register({
    x: CASTLE.x + x, z: CASTLE.z + z, r: 3.4,
    label, when: () => playerPosition.y < -14,
    cb: () => { audio.sfx.bell(); toast(text, ms); },
  });

  say(-27, 12.6, '📜 Read the wall-scratching',
    'Scratched beside the stair — "They went up to be Wardens. We stayed down to be the reason there was anything to ward. Mind the pillars; mind the water; feed the fire."');
  say(20, 46, '🍲 Look over the table',
    "Four bowls, four spoons, a loaf gone hard as stone. The benches are pushed back as if everyone stood up at once — and never quite got round to sitting down again.");
  say(56, -5, '🔨 Examine the anvil',
    'A blade half-drawn, quenched cold mid-work. The tongs are still laid across the horn. Whoever was hammering meant to come straight back.');
  say(48, 32, '📖 Read the open book',
    'The Deepwardens\' ledger, left open at an unfinished line: "Day nine hundred and forty. The upper house is quiet again. We keep the halls. We keep the—"');

  interact.register({
    x: CASTLE.x + 24, z: CASTLE.z + 58, r: 3,
    label: '🎁 Open the strongbox',
    when: () => playerPosition.y < -14 && !load('deep:loot', false),
    cb: () => {
      save('deep:loot', true);
      shells.add(45, 'the Deepwardens’ strongbox');
      audio.sfx.fanfare();
      toast('Inside: shells, carefully counted, and a note — "shares for whoever comes after."', 6000);
    },
  });
  mesh(23, 25.4, 57, 59, F, F + 1, M.wood);   // the strongbox itself

  // ═══ Lights — only alive when the player is actually down here ═══════════
  const lights = [];
  const addLight = (color, intensity, dist, x, y, z) => {
    const l = new THREE.PointLight(color, intensity, dist);
    l.position.set(CASTLE.x + x, y, CASTLE.z + z);
    l.visible = false;
    scene.add(l);
    lights.push(l);
  };
  addLight(0xFFA040, 1.7, 60, -14, F + 9, 0);      // Underhall west
  addLight(0xFFA040, 1.7, 60, 14, F + 9, 0);       // Underhall east
  addLight(0xFF7A20, 2.0, 34, 63, F + 4, -11);     // Forge
  addLight(0xFFB868, 1.5, 34, 6, F + 5, 52);       // Warden's Rest
  addLight(0xFFC890, 1.3, 30, 49, F + 4, 30);      // Archive
  addLight(0x5FE8C0, 1.3, 44, -34, F + 6, -46);    // Fungal Grotto
  addLight(0x6A90B8, 0.9, 40, -40, F + 6, 48);     // Sump

  B.register(150);

  function update() {
    const deep = playerPosition.y < 2 &&
      Math.hypot(playerPosition.x - CASTLE.x, playerPosition.z - CASTLE.z) < 170;
    B.group.visible = deep;
    const lit = deep && playerPosition.y < -12;
    for (const l of lights) if (l.visible !== lit) l.visible = lit;
  }

  return { update };
}
