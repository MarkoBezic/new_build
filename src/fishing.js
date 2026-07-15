import * as THREE from 'three';
import { append, save, load } from './persistence.js';
import { bus } from './bus.js';

// ── Catch table ───────────────────────────────────────────────────────────────
// `cond` gates a species on world state (night, rain) — those fish only bite
// under the right sky, giving fishing a reason to happen at different times.
const CATCHES = [
  { name: 'Tiny Minnow',    weight: [0.05, 0.18], rarity: 'common',    color: 0xA0C8E0, w: 35 },
  { name: 'Bass',           weight: [0.4,  1.8],  rarity: 'common',    color: 0x7B9B6A, w: 28 },
  { name: 'Catfish',        weight: [0.8,  3.2],  rarity: 'uncommon',  color: 0x5A4A3A, w: 16 },
  { name: 'Rainbow Trout',  weight: [0.5,  2.5],  rarity: 'uncommon',  color: 0xE08080, w: 13 },
  { name: 'Pike',           weight: [1.0,  5.0],  rarity: 'rare',      color: 0x6A8A50, w: 5 },
  { name: 'Old Boot',       weight: [0.3,  0.3],  rarity: 'common',    color: 0x443322, w: 2 },
  { name: 'Golden Carp',    weight: [1.5,  4.0],  rarity: 'legendary', color: 0xFFCC00, w: 1 },
  { name: 'Moonfish',       weight: [0.6,  2.0],  rarity: 'rare',      color: 0xB8D8FF, w: 8,
    cond: c => c.night > 0.5 },
  { name: 'Stormfin',       weight: [1.2,  4.5],  rarity: 'rare',      color: 0x4A6A8A, w: 10,
    cond: c => c.rain > 0.3 },
  { name: 'Aurora Koi',     weight: [0.8,  2.2],  rarity: 'legendary', color: 0x9FF0C8, w: 2,
    cond: c => c.night > 0.5 },
];
const SPECIES_TOTAL = CATCHES.length;

// World state fed each frame from main — decides which species can bite
let _cond = { night: 0, rain: 0 };

function pickCatch() {
  const avail = CATCHES.filter(c => !c.cond || c.cond(_cond));
  const total = avail.reduce((a, c) => a + c.w, 0);
  let r = Math.random() * total;
  for (const c of avail) {
    r -= c.w;
    if (r <= 0) {
      const kg = c.weight[0] + Math.random() * (c.weight[1] - c.weight[0]);
      return { ...c, kg: +kg.toFixed(2) };
    }
  }
  return { ...avail[0], kg: 0.1 };
}

// ── Fishing line (Two.js-style LineSegments) ──────────────────────────────────
function makeLine(scene) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([0,0,0, 0,0,0], 3));
  const mat = new THREE.LineBasicMaterial({ color: 0xCCCCCC, linewidth: 1 });
  const line = new THREE.Line(geo, mat);
  line.frustumCulled = false;
  line.visible = false;
  scene.add(line);
  return line;
}

// ── Bobber ────────────────────────────────────────────────────────────────────
function makeBobber(scene) {
  const g = new THREE.Group();
  const top = new THREE.Mesh(
    new THREE.SphereGeometry(0.10, 7, 5),
    new THREE.MeshLambertMaterial({ color: 0xFF2222 }),
  );
  top.position.y = 0.05;
  const bot = new THREE.Mesh(
    new THREE.SphereGeometry(0.10, 7, 5),
    new THREE.MeshLambertMaterial({ color: 0xEEEEEE }),
  );
  bot.position.y = -0.05;
  g.add(top, bot);
  g.visible = false;
  scene.add(g);
  return g;
}

// ── HUD overlay ───────────────────────────────────────────────────────────────
function makeHUD() {
  const el = document.createElement('div');
  Object.assign(el.style, {
    position: 'fixed', bottom: '120px', left: '50%',
    transform: 'translateX(-50%)',
    color: '#fff', background: 'rgba(0,0,0,0.60)',
    padding: '6px 18px', borderRadius: '10px',
    fontSize: '14px', fontFamily: 'Arial, sans-serif',
    display: 'none', pointerEvents: 'none', zIndex: '25',
    textAlign: 'center', whiteSpace: 'nowrap',
  });
  document.body.appendChild(el);
  return el;
}

// ── Toast notification ────────────────────────────────────────────────────────
let _toastTimer = 0;
const _toast = (() => {
  const el = document.createElement('div');
  Object.assign(el.style, {
    position: 'fixed', top: '80px', left: '50%',
    transform: 'translateX(-50%)',
    color: '#fff', background: 'rgba(0,0,0,0.72)',
    padding: '8px 22px', borderRadius: '12px',
    fontSize: '15px', fontFamily: 'Arial, sans-serif',
    display: 'none', pointerEvents: 'none', zIndex: '25',
    textAlign: 'center',
  });
  document.body.appendChild(el);
  return el;
})();

function showToast(msg, durationSec = 4) {
  _toast.textContent = msg;
  _toast.style.display = 'block';
  _toastTimer = durationSec;
}

// ── State machine ─────────────────────────────────────────────────────────────
const STATE = { IDLE: 0, CAST: 1, WAITING: 2, BITE: 3 };

export function createFishing(scene) {
  const line   = makeLine(scene);
  const bobber = makeBobber(scene);
  const hud    = makeHUD();

  let state       = STATE.IDLE;
  let waitTimer   = 0;   // time until bite
  let biteTimer   = 0;   // window to reel in
  let bobberBob   = 0;   // sin phase for idle bobbing
  let catchData   = null;

  // Rod tip offset from player position (above and slightly in front)
  const TIP_OFFSET = new THREE.Vector3(0.5, 1.6, -1.2);

  function getRodTip(playerPos, yaw) {
    const cos = Math.cos(yaw), sin = Math.sin(yaw);
    return new THREE.Vector3(
      playerPos.x + TIP_OFFSET.x * cos - TIP_OFFSET.z * sin,
      playerPos.y + TIP_OFFSET.y,
      playerPos.z + TIP_OFFSET.x * sin + TIP_OFFSET.z * cos,
    );
  }

  function cast(playerPos, yaw) {
    if (state !== STATE.IDLE) return;
    // Drop bobber ~8 m ahead in look direction at water surface
    const dist = 7 + Math.random() * 4;
    const bx = playerPos.x - Math.sin(yaw) * dist;
    const bz = playerPos.z - Math.cos(yaw) * dist;
    bobber.position.set(bx, 0.22, bz);
    bobber.visible = true;
    line.visible   = true;
    waitTimer = 4 + Math.random() * 14; // 4–18 s wait
    state = STATE.WAITING;
    hud.textContent = 'Fishing… (F to reel in)';
    hud.style.display = 'block';
    showToast('Line cast!', 2);
  }

  function reel() {
    if (state === STATE.BITE) {
      // Success — record catch, track the species collection
      const { name, kg, rarity } = catchData;
      const label = rarity === 'legendary' ? '★ LEGENDARY ★ ' : '';
      const species = load('fishing:species', []);
      let suffix = '';
      if (!species.includes(name)) {
        species.push(name);
        save('fishing:species', species);
        suffix = `  ✨ New species! (${species.length}/${SPECIES_TOTAL})`;
      }
      showToast(`${label}Caught a ${name}! (${kg} kg)${suffix}`, 5);
      append('fishing:log', { name, kg, rarity, ts: Date.now() }, 50);
      bus.emit('fish', catchData);
    } else if (state === STATE.WAITING) {
      showToast('Nothing yet… you reeled in early.', 3);
    }
    reset();
  }

  function reset() {
    state = STATE.IDLE;
    bobber.visible = false;
    line.visible   = false;
    hud.style.display = 'none';
    catchData = null;
  }

  function update(dt, playerPos, yaw, onBoat) {
    // Dismiss toast
    if (_toastTimer > 0) {
      _toastTimer -= dt;
      if (_toastTimer <= 0) _toast.style.display = 'none';
    }

    if (state === STATE.IDLE) return;

    // Update line from rod tip to bobber
    const tip = getRodTip(playerPos, yaw);
    const pos = line.geometry.attributes.position;
    pos.setXYZ(0, tip.x, tip.y, tip.z);
    pos.setXYZ(1, bobber.position.x, bobber.position.y + 0.1, bobber.position.z);
    pos.needsUpdate = true;

    if (state === STATE.WAITING) {
      waitTimer -= dt;
      bobberBob += dt * 1.2;
      bobber.position.y = 0.22 + Math.sin(bobberBob) * 0.04;

      if (waitTimer <= 0) {
        // Bite!
        state = STATE.BITE;
        biteTimer = 3.5;
        catchData = pickCatch();
        hud.textContent = '⚡ BITE! Press F to reel in!';
        showToast('⚡ Something is biting!', 3.5);
      }
    } else if (state === STATE.BITE) {
      biteTimer -= dt;
      // Urgent bobbing
      bobberBob += dt * 5;
      bobber.position.y = 0.22 + Math.sin(bobberBob) * 0.12 - 0.05;

      if (biteTimer <= 0) {
        showToast('It got away…', 3);
        reset();
      }
    }
  }

  function handleAction(playerPos, yaw, onBoat) {
    if (!onBoat) return;
    if (state === STATE.IDLE) cast(playerPos, yaw);
    else reel();
  }

  // Desktop key handler
  function onKey(e, playerPos, yaw, onBoat) {
    if (e.code !== 'KeyF') return;
    handleAction(playerPos, yaw, onBoat);
  }

  // Mobile cast/reel button
  const mobileBtn = (() => {
    const btn = document.createElement('button');
    btn.textContent = '🎣';
    Object.assign(btn.style, {
      position: 'fixed', bottom: '20px', right: '20px',
      width: '60px', height: '60px', borderRadius: '50%',
      fontSize: '26px', border: 'none',
      background: 'rgba(0,0,0,0.45)', color: '#fff',
      display: 'none', zIndex: '30', cursor: 'pointer',
    });
    document.body.appendChild(btn);
    return btn;
  })();

  function showMobileBtn(onBoat) {
    mobileBtn.style.display = onBoat ? 'block' : 'none';
  }

  return {
    update, onKey, handleAction, showMobileBtn, getMobileBtn: () => mobileBtn,
    setConditions: c => { _cond = c; },
  };
}

// Returns the catch log from localStorage for display elsewhere
export function getCatchLog() {
  return load('fishing:log', []);
}
