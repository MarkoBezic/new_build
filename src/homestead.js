import * as THREE from 'three';
import { addStructure } from './collision.js';
import { terrainHeight } from './terrain.js';
import { toast, makeMobileButton } from './hud.js';
import { save, load } from './persistence.js';
import { initCloud } from './cloud.js';

// ── The Hamlet — player homesteads ───────────────────────────────────────────
// Twelve claimable plots in a flattened west-forest meadow. Claim one, then
// build from a snap-grid kit priced in shells: walls, windows, doorways,
// floors, roofs, stairs, fences and furniture. Every piece is solid via the
// structure-collision engine, so player houses have real walls and storeys.
//
// Persistence tiers (designed as one):
//   · your plot   → localStorage (always)
//   · live share  → Ably 'home' broadcasts while you're online (always)
//   · everyone    → Firebase, the moment VITE_FIREBASE_CONFIG exists (cloud.js)
//
// Build controls (shown on entering build mode):
//   desktop  1-9/0 select piece · R rotate · click place · X remove · E done
//   mobile   dedicated buttons

const HAMLET = { x: -400, z: -150, ground: 4 };
const PLOTS = [];
for (let i = 0; i < 6; i++) {
  PLOTS.push({ id: `p${i}`,     x: HAMLET.x - 36 + i * 14.4, z: HAMLET.z - 17, post: 1 });
  PLOTS.push({ id: `p${i + 6}`, x: HAMLET.x - 36 + i * 14.4, z: HAMLET.z + 17, post: -1 });
}
const PLOT_HALF = 6.5;       // buildable ±extent from plot centre
const PIECE_CAP = 250;
const WALL_H = 3;

// ── The kit ──────────────────────────────────────────────────────────────────
// size = [w,h,d] before rotation; collide → boxes registered with collision.js
const KIT = [
  { k: 'wall',    label: 'Timber Wall', price: 2, size: [2, WALL_H, 0.3] },
  { k: 'stone',   label: 'Stone Wall',  price: 2, size: [2, WALL_H, 0.3] },
  { k: 'window',  label: 'Window Wall', price: 3, size: [2, WALL_H, 0.3] },
  { k: 'door',    label: 'Doorway',     price: 3, size: [2, WALL_H, 0.3], door: true },
  { k: 'floor',   label: 'Floor / Deck', price: 2, size: [2, 0.25, 2], flat: true },
  { k: 'roof',    label: 'Roof Panel',  price: 3, size: [2, 0.2, 3.4], ramp: true },
  { k: 'stairs',  label: 'Stairs',      price: 4, size: [1.2, 0.2, 3.2], ramp: true },
  { k: 'fence',   label: 'Fence',       price: 1, size: [2, 1, 0.15] },
  { k: 'torch',   label: 'Torch Post',  price: 2, size: [0.15, 1.6, 0.15], decor: true },
  { k: 'planter', label: 'Planter',     price: 2, size: [1.4, 0.5, 0.5] },
  { k: 'table',   label: 'Table',       price: 3, size: [1.6, 0.8, 1] },
  { k: 'bed',     label: 'Bed',         price: 6, size: [1.2, 0.6, 2.2] },
];

export function createHomestead(scene, { interact, audio, shells, playerPosition, getState, getName, isMobile, onBroadcast }) {
  // Stable local identity; replaced by the Firebase anonymous uid when cloud is on
  let uid = load('home:uid', null);
  if (!uid) { uid = Math.random().toString(36).slice(2, 12); save('home:uid', uid); }

  // ── Materials + shared geometry per kind ────────────────────────────────────
  const MAT = {
    wall:   new THREE.MeshLambertMaterial({ color: 0x9A7648, flatShading: true }),
    stone:  new THREE.MeshLambertMaterial({ color: 0xB0AA9A, flatShading: true }),
    window: new THREE.MeshLambertMaterial({ color: 0x9A7648, flatShading: true }),
    glass:  new THREE.MeshLambertMaterial({ color: 0xBFE8FF, transparent: true, opacity: 0.45 }),
    door:   new THREE.MeshLambertMaterial({ color: 0x8A6A40, flatShading: true }),
    floor:  new THREE.MeshLambertMaterial({ color: 0x8A6A40, flatShading: true }),
    roof:   new THREE.MeshLambertMaterial({ color: 0x7A4030, flatShading: true }),
    fence:  new THREE.MeshLambertMaterial({ color: 0x9A7648 }),
    iron:   new THREE.MeshLambertMaterial({ color: 0x3A3A40 }),
    flame:  new THREE.MeshLambertMaterial({ color: 0xFFD060, emissive: 0xFF9020, emissiveIntensity: 1.2 }),
    green:  new THREE.MeshLambertMaterial({ color: 0x5A8A3A }),
    red:    new THREE.MeshLambertMaterial({ color: 0x9A1F2E }),
  };

  function buildPieceMesh(k) {
    const g = new THREE.Group();
    const box = (w, h, d, mat, x = 0, y = 0, z = 0) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      g.add(m);
      return m;
    };
    switch (k) {
      case 'wall':  box(2, WALL_H, 0.3, MAT.wall, 0, WALL_H / 2, 0); break;
      case 'stone': box(2, WALL_H, 0.3, MAT.stone, 0, WALL_H / 2, 0); break;
      case 'window':
        box(2, 1.0, 0.3, MAT.window, 0, 0.5, 0);
        box(2, 0.7, 0.3, MAT.window, 0, WALL_H - 0.35, 0);
        box(0.25, 1.3, 0.3, MAT.window, -0.875, 1.65, 0);
        box(0.25, 1.3, 0.3, MAT.window, 0.875, 1.65, 0);
        box(1.5, 1.3, 0.12, MAT.glass, 0, 1.65, 0);
        break;
      case 'door':
        box(0.35, WALL_H, 0.3, MAT.door, -0.825, WALL_H / 2, 0);
        box(0.35, WALL_H, 0.3, MAT.door, 0.825, WALL_H / 2, 0);
        box(1.3, 0.6, 0.3, MAT.door, 0, WALL_H - 0.3, 0);
        break;
      case 'floor': box(2, 0.25, 2, MAT.floor, 0, -0.125, 0); break;
      case 'roof': {
        const p = box(2, 0.2, 3.4, MAT.roof, 0, 0, 0);
        p.rotation.x = -Math.atan2(WALL_H, 3);   // rises WALL_H over its 3-unit run
        p.position.y = WALL_H / 2;
        break;
      }
      case 'stairs': {
        for (let i = 0; i < 6; i++) {
          box(1.2, 0.5, 0.55, MAT.floor, 0, 0.25 + i * 0.5, -1.35 + i * 0.54);
        }
        break;
      }
      case 'fence':
        box(2, 0.12, 0.12, MAT.fence, 0, 0.9, 0);
        box(2, 0.12, 0.12, MAT.fence, 0, 0.5, 0);
        for (const px of [-0.9, 0, 0.9]) box(0.12, 1, 0.12, MAT.fence, px, 0.5, 0);
        break;
      case 'torch':
        box(0.12, 1.5, 0.12, MAT.iron, 0, 0.75, 0);
        box(0.22, 0.3, 0.22, MAT.flame, 0, 1.62, 0);
        break;
      case 'planter':
        box(1.4, 0.4, 0.5, MAT.door, 0, 0.2, 0);
        box(1.2, 0.25, 0.35, MAT.green, 0, 0.5, 0);
        break;
      case 'table':
        box(1.6, 0.12, 1, MAT.floor, 0, 0.74, 0);
        for (const [px, pz] of [[-0.65, -0.38], [0.65, -0.38], [-0.65, 0.38], [0.65, 0.38]])
          box(0.12, 0.7, 0.12, MAT.door, px, 0.35, pz);
        break;
      case 'bed':
        box(1.2, 0.3, 2.2, MAT.door, 0, 0.3, 0);
        box(1.1, 0.22, 2.0, MAT.red, 0, 0.55, 0);
        box(1.2, 0.9, 0.15, MAT.door, 0, 0.55, -1.05);
        break;
    }
    return g;
  }

  // ── Plot state ──────────────────────────────────────────────────────────────
  // plots.get(id) → { owner, name, pieces, group, structure }
  const plots = new Map();
  const cache = load('home:cache', {});
  let mine = load('home:mine', null);         // { plot, pieces } for this device
  let cloud = { enabled: false };

  // Signposts + claim interacts
  const postMat = new THREE.MeshLambertMaterial({ color: 0x6B4A22 });
  for (const p of PLOTS) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.4, 0.18), postMat);
    const pz = p.z + p.post * (PLOT_HALF + 1);
    post.position.set(p.x, terrainHeight(p.x, pz) + 0.7, pz);
    scene.add(post);
    const sign = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.55, 0.08), MAT.floor);
    sign.position.set(p.x, terrainHeight(p.x, pz) + 1.35, pz);
    scene.add(sign);

    interact.register({
      x: p.x, z: pz, r: 3.5,
      label: () => plotLabel(p),
      cb: () => plotAction(p),
    });
  }

  function ownerOf(id) { return plots.get(id)?.owner ?? null; }

  function plotLabel(p) {
    const o = ownerOf(p.id);
    if (mine?.plot === p.id) return building ? '🏠 Finish building (E)' : '🏠 Edit your homestead';
    if (o === uid) return '🏠 Edit your homestead';
    if (o) return `🏘 ${plots.get(p.id).name || 'Someone'}'s homestead`;
    return '🏠 Claim this homestead (free)';
  }

  function plotAction(p) {
    const o = ownerOf(p.id);
    if (mine?.plot === p.id || o === uid) { toggleBuild(p); return; }
    if (o) { toast('This plot belongs to another islander.', 2200); return; }
    if (mine?.plot) { toast('You already keep a homestead — one plot per islander.', 2600); return; }
    mine = { plot: p.id, pieces: [] };
    persistMine();
    applyPlot(p.id, { owner: uid, name: myName(), pieces: [] });
    audio.sfx.fanfare();
    toast('🏠 This plot is yours! Interact again to start building.', 4500);
  }

  const myName = () => (getName && getName()) || 'An islander';

  // ── Rendering + collision for any plot's pieces ─────────────────────────────
  function applyPlot(id, data) {
    const meta = PLOTS.find(q => q.id === id);
    if (!meta) return;   // never trust remote plot ids
    let P = plots.get(id);
    if (!P) {
      P = { group: new THREE.Group(), structure: addStructure({
        x: meta.x, z: meta.z,
        r: PLOT_HALF + 6, walls: [], floors: [], ramps: [] }) };
      scene.add(P.group);
      plots.set(id, P);
    }
    P.owner = data?.owner ?? null;
    P.name  = data?.name ?? '';
    P.pieces = data?.pieces ?? [];
    // rebuild meshes
    P.group.clear();
    // rebuild collision in place (engine reads these arrays live)
    P.structure.walls.length = 0;
    P.structure.floors.length = 0;
    P.structure.ramps.length = 0;
    for (const pc of P.pieces) addPieceTo(P, pc);
  }

  function addPieceTo(P, pc) {
    const def = KIT.find(d => d.k === pc.k);
    if (!def) return;
    const m = buildPieceMesh(pc.k);
    m.position.set(pc.x, pc.y, pc.z);
    m.rotation.y = pc.r * Math.PI / 2;
    P.group.add(m);

    // collision box: rotate footprint for odd rotations
    const [w, h, d] = def.size;
    const rw = pc.r % 2 ? d : w, rd = pc.r % 2 ? w : d;
    if (def.decor) return;
    if (def.flat) {
      P.structure.floors.push({ x0: pc.x - rw / 2, x1: pc.x + rw / 2, z0: pc.z - rd / 2, z1: pc.z + rd / 2, top: pc.y });
    } else if (def.ramp) {
      // rises along its local −z→+z run, mapped by rotation
      const run = def.size[2], rise = pc.k === 'stairs' ? WALL_H : WALL_H;
      const r = pc.r % 4;
      const rx0 = pc.x - rw / 2, rx1 = pc.x + rw / 2, rz0 = pc.z - rd / 2, rz1 = pc.z + rd / 2;
      if (r === 0)      P.structure.ramps.push({ x0: rx0, x1: rx1, z0: rz0, z1: rz1, axis: 'z', h0: pc.y + rise, h1: pc.y });
      else if (r === 2) P.structure.ramps.push({ x0: rx0, x1: rx1, z0: rz0, z1: rz1, axis: 'z', h0: pc.y, h1: pc.y + rise });
      else if (r === 1) P.structure.ramps.push({ x0: rx0, x1: rx1, z0: rz0, z1: rz1, axis: 'x', h0: pc.y, h1: pc.y + rise });
      else              P.structure.ramps.push({ x0: rx0, x1: rx1, z0: rz0, z1: rz1, axis: 'x', h0: pc.y + rise, h1: pc.y });
    } else if (def.door) {
      // lintel only — walk through beneath
      P.structure.walls.push({ x0: pc.x - rw / 2, x1: pc.x + rw / 2, z0: pc.z - rd / 2, z1: pc.z + rd / 2, y0: pc.y + WALL_H - 0.6, y1: pc.y + WALL_H });
    } else {
      P.structure.walls.push({ x0: pc.x - rw / 2, x1: pc.x + rw / 2, z0: pc.z - rd / 2, z1: pc.z + rd / 2, y0: pc.y, y1: pc.y + h });
    }
  }

  // restore cached plots (mine last so it wins)
  for (const [id, data] of Object.entries(cache)) if (id !== mine?.plot) applyPlot(id, data);
  if (mine?.plot) applyPlot(mine.plot, { owner: uid, name: myName(), pieces: mine.pieces });

  function persistMine() {
    save('home:mine', mine);
    if (!mine) return;
    const doc = { owner: uid, name: myName(), updated: Date.now(), pieces: mine.pieces };
    if (cloud.enabled) cloud.savePlot(mine.plot, doc);
    else if (onBroadcast) onBroadcast({ plot: mine.plot, doc });
  }

  // Ably live-share receive (ignored once cloud is authoritative)
  function receive(data) {
    if (cloud.enabled || !data?.plot || data.plot === mine?.plot) return;
    cache[data.plot] = data.doc;
    save('home:cache', cache);
    applyPlot(data.plot, data.doc);
  }

  // ── Cloud bring-up ──────────────────────────────────────────────────────────
  initCloud().then(c => {
    cloud = c;
    if (!c.enabled) return;
    const localUid = uid;
    uid = c.uid;   // cloud identity wins
    // migrate my local plot to my cloud identity (first writer wins server-side)
    if (mine?.plot) {
      cloud.savePlot(mine.plot, { owner: uid, name: myName(), updated: Date.now(), pieces: mine.pieces });
    }
    cloud.watchPlots((id, data) => {
      if (data === null) { if (mine?.plot !== id) applyPlot(id, null); return; }
      if (mine?.plot === id && data.owner !== uid) {
        // someone else holds this plot in the cloud — our claim lost the race
        toast('⚠️ That plot was already claimed in the shared world — your pieces are kept; claim another plot to rebuild.', 7000);
        mine = null;
        save('home:mine', mine);
      }
      cache[id] = data;
      save('home:cache', cache);
      applyPlot(id, data);
    });
  });

  // ── Build mode ──────────────────────────────────────────────────────────────
  let building = false, curPlot = null, kitIdx = 0, rot = 0;
  const ghost = new THREE.Group();
  ghost.visible = false;
  scene.add(ghost);
  let ghostMesh = null, ghostOK = false;
  const okMat  = new THREE.MeshLambertMaterial({ color: 0x6FE86F, transparent: true, opacity: 0.5 });
  const badMat = new THREE.MeshLambertMaterial({ color: 0xE84040, transparent: true, opacity: 0.5 });

  function setGhostKind() {
    if (ghostMesh) ghost.remove(ghostMesh);
    ghostMesh = buildPieceMesh(KIT[kitIdx].k);
    ghost.add(ghostMesh);
  }

  function toggleBuild(p) {
    building = !building;
    curPlot = building ? p : null;
    ghost.visible = building;
    if (building) {
      setGhostKind();
      toast(isMobile
        ? '🔨 Build mode — use the side buttons; ✕ leaves build mode'
        : '🔨 Build mode — 1-9/0 pick a piece · R rotate · CLICK place · X remove · E done\nPieces cost shells; removing refunds.', 7000);
    } else {
      toast('🏠 Homestead saved.', 1800);
    }
    if (mobileBtns) for (const b of mobileBtns) b.style.display = building ? 'block' : 'none';
  }

  // snap the ghost to the grid cell ~3 units ahead of the player
  const _fwd = { x: 0, z: 0 };
  function ghostTarget() {
    const ry = getState().ry;
    _fwd.x = playerPosition.x - Math.sin(ry) * 3;
    _fwd.z = playerPosition.z - Math.cos(ry) * 3;
    const gx = Math.round(_fwd.x);
    const gz = Math.round(_fwd.z);
    // base height: the highest surface at the cell the player could stand on
    const feet = playerPosition.y - 1.2;
    let base = terrainHeight(gx, gz);
    const P = curPlot ? plots.get(curPlot.id) : null;
    if (P) {
      for (const f of P.structure.floors) {
        if (gx >= f.x0 && gx <= f.x1 && gz >= f.z0 && gz <= f.z1 && f.top <= feet + 1.4 && f.top > base) base = f.top;
      }
    }
    return { gx, gz, gy: base };
  }

  function inPlot(p, x, z) {
    return Math.abs(x - p.x) <= PLOT_HALF && Math.abs(z - p.z) <= PLOT_HALF;
  }

  function place() {
    if (!building || !ghostOK || !mine) return;
    const def = KIT[kitIdx];
    if (!shells.spend(def.price)) { audio.sfx.grind(); toast(`Need ${def.price} 🐚 for a ${def.label}.`, 2200); return; }
    const { gx, gz, gy } = ghostTarget();
    mine.pieces.push({ k: def.k, x: gx, y: +gy.toFixed(2), z: gz, r: rot });
    persistMine();
    applyPlot(mine.plot, { owner: uid, name: myName(), pieces: mine.pieces });
    audio.sfx.plink();
  }

  function removeAt() {
    if (!building || !mine?.pieces.length) return;
    const { gx, gz } = ghostTarget();
    // remove the top-most piece occupying the target cell
    let bi = -1, by = -Infinity;
    mine.pieces.forEach((pc, i) => {
      if (Math.abs(pc.x - gx) <= 1 && Math.abs(pc.z - gz) <= 1 && pc.y >= by) { by = pc.y; bi = i; }
    });
    if (bi < 0) { toast('Nothing there to remove.', 1500); return; }
    const [pc] = mine.pieces.splice(bi, 1);
    shells.add(KIT.find(d => d.k === pc.k).price, 'piece refunded');
    persistMine();
    applyPlot(mine.plot, { owner: uid, name: myName(), pieces: mine.pieces });
  }

  // ── Input ───────────────────────────────────────────────────────────────────
  function onKey(e) {
    if (!building) return false;
    const m = e.code.match(/^Digit(\d)$/);
    if (m) {
      const n = parseInt(m[1]);
      kitIdx = (n === 0 ? 9 : n - 1) % KIT.length;
      setGhostKind();
      const def = KIT[kitIdx];
      toast(`${def.label} — ${def.price} 🐚`, 1400);
      return true;
    }
    if (e.code === 'KeyR') { rot = (rot + 1) % 4; return true; }
    if (e.code === 'KeyX') { removeAt(); return true; }
    if (e.code === 'KeyE') return false;   // let the interact system close build mode
    return true;   // swallow everything else (emotes etc.) while building
  }

  window.addEventListener('mousedown', e => {
    if (!building || !document.pointerLockElement || e.button !== 0) return;
    place();
  });

  let mobileBtns = null;
  if (isMobile) {
    mobileBtns = [
      makeMobileButton('🧱', { bottom: '278px', right: '20px' }, () => {
        kitIdx = (kitIdx + 1) % KIT.length;
        setGhostKind();
        toast(`${KIT[kitIdx].label} — ${KIT[kitIdx].price} 🐚`, 1400);
      }),
      makeMobileButton('🔄', { bottom: '342px', right: '20px' }, () => { rot = (rot + 1) % 4; }),
      makeMobileButton('✔️', { bottom: '406px', right: '20px' }, place, 'rgba(111,232,111,0.35)'),
      makeMobileButton('🗑', { bottom: '470px', right: '20px' }, removeAt, 'rgba(232,64,64,0.35)'),
      makeMobileButton('✕', { bottom: '534px', right: '20px' }, () => { if (curPlot) toggleBuild(curPlot); }),
    ];
  }

  // ── Per-frame ───────────────────────────────────────────────────────────────
  function update() {
    // hide distant plots entirely (12 plots × up to 250 pieces is real geometry)
    const nearHamlet = Math.hypot(playerPosition.x - HAMLET.x, playerPosition.z - HAMLET.z) < 260;
    for (const P of plots.values()) P.group.visible = nearHamlet;

    if (!building || !curPlot) return;
    // leave build mode when wandering off the plot
    if (!inPlot(curPlot, playerPosition.x, playerPosition.z) &&
        Math.abs(playerPosition.x - curPlot.x) + Math.abs(playerPosition.z - curPlot.z) > PLOT_HALF * 2 + 8) {
      toggleBuild(curPlot);
      return;
    }
    const { gx, gz, gy } = ghostTarget();
    ghost.position.set(gx, gy, gz);
    ghost.rotation.y = rot * Math.PI / 2;
    ghostOK = mine && inPlot(curPlot, gx, gz) && mine.pieces.length < PIECE_CAP;
    const mat = ghostOK ? okMat : badMat;
    ghost.traverse(o => { if (o.isMesh) o.material = mat; });
  }

  return { update, onKey, receive, isBuilding: () => building };
}
