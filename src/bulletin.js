import * as THREE from 'three';
import { append, load } from './persistence.js';

// North interior wall of the building, centred, at eye height
const BOARD_X = 0, BOARD_Z = -20, BOARD_Y = 2.05;
const INTERACT_RADIUS = 3.5;

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── Physical board mesh ───────────────────────────────────────────────────────
function buildMesh(scene) {
  const g       = new THREE.Group();
  const corkMat = new THREE.MeshLambertMaterial({ color: 0xC9A46A });
  const framMat = new THREE.MeshLambertMaterial({ color: 0x6B3A1F });

  // Cork backing
  g.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(3.0, 1.8, 0.06), corkMat)));

  // Outer frame
  const FT = 0.12;
  for (const s of [1, -1]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(3.0 + FT * 2, FT, 0.10), framMat);
    h.position.set(0, s * (0.9 + FT / 2), 0);
    g.add(h);
    const v = new THREE.Mesh(new THREE.BoxGeometry(FT, 1.8 + FT * 2, 0.10), framMat);
    v.position.set(s * (1.5 + FT / 2), 0, 0);
    g.add(v);
  }

  // Decorative pinned notes (static, just for looks)
  const noteMat   = new THREE.MeshLambertMaterial({ color: 0xFFFDE8 });
  const yellowMat = new THREE.MeshLambertMaterial({ color: 0xFFEE88 });
  [
    { x: -0.75, y:  0.42, rz:  0.05, mat: noteMat   },
    { x:  0.50, y:  0.18, rz: -0.07, mat: yellowMat },
    { x:  0.05, y: -0.48, rz:  0.03, mat: noteMat   },
  ].forEach(({ x, y, rz, mat }) => {
    const n = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.45, 0.005), mat);
    n.position.set(x, y, 0.04);
    n.rotation.z = rz;
    g.add(n);
  });

  g.position.set(BOARD_X, BOARD_Y, BOARD_Z + 0.18);
  g.rotation.y = 0;  // faces +Z (toward building interior)
  g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  scene.add(g);
}

// ── Proximity hint ────────────────────────────────────────────────────────────
function makeHint() {
  const el = document.createElement('div');
  Object.assign(el.style, {
    position: 'fixed', bottom: '80px', left: '50%',
    transform: 'translateX(-50%)',
    color: '#fff', background: 'rgba(0,0,0,0.55)',
    padding: '5px 16px', borderRadius: '8px',
    fontSize: '13px', display: 'none',
    pointerEvents: 'none', zIndex: '20',
  });
  el.textContent = 'Press E to read the bulletin board';
  document.body.appendChild(el);
  return el;
}

// ── Overlay UI ────────────────────────────────────────────────────────────────
function makeUI(getPlayerName) {
  const el = document.createElement('div');
  Object.assign(el.style, {
    position: 'fixed', top: '50%', left: '50%',
    transform: 'translate(-50%,-50%)',
    width: '430px', maxWidth: '90vw',
    background: 'rgba(16,10,4,0.95)', color: '#F0E4C8',
    borderRadius: '14px', padding: '24px 24px 20px',
    fontFamily: 'Arial, sans-serif',
    display: 'none', zIndex: '50',
    border: '2px solid rgba(180,140,60,0.45)',
  });

  el.innerHTML = `
    <h2 style="margin:0 0 14px;font-size:17px;color:#D4A85A;text-align:center;">📌 Bulletin Board</h2>
    <div id="_bb_msgs" style="min-height:100px;max-height:190px;overflow-y:auto;
      border:1px solid rgba(180,140,60,0.25);border-radius:8px;padding:10px;
      margin-bottom:14px;font-size:13px;line-height:1.65;"></div>
    <textarea id="_bb_input" maxlength="120"
      placeholder="Leave a message… (120 chars max)"
      style="width:100%;box-sizing:border-box;padding:8px;border-radius:6px;border:none;
        background:rgba(255,255,255,0.10);color:#F0E4C8;resize:none;
        font-size:13px;font-family:Arial,sans-serif;" rows="3"></textarea>
    <div style="display:flex;gap:10px;margin-top:10px;">
      <button id="_bb_post" style="flex:1;padding:8px;border-radius:6px;border:none;
        background:#8B5E3C;color:#fff;cursor:pointer;font-size:13px;">Post</button>
      <button id="_bb_close" style="padding:8px 16px;border-radius:6px;border:none;
        background:rgba(255,255,255,0.13);color:#fff;cursor:pointer;font-size:13px;">Close</button>
    </div>`;

  document.body.appendChild(el);

  const msgsEl  = el.querySelector('#_bb_msgs');
  const inputEl = el.querySelector('#_bb_input');

  function refresh() {
    const msgs = load('bulletin:messages', []);
    if (!msgs.length) {
      msgsEl.innerHTML = '<em style="color:#888">No messages yet — be the first!</em>';
      return;
    }
    msgsEl.innerHTML = msgs.slice().reverse().map(m => {
      const d    = new Date(m.ts);
      const date = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      return `<div style="margin-bottom:8px;padding-bottom:8px;
                border-bottom:1px solid rgba(180,140,60,0.18)">
        <span style="color:#D4A85A;font-weight:bold">${escHtml(m.name || 'Anonymous')}</span>
        <span style="color:#666;font-size:11px;margin-left:8px">${date}</span><br>
        ${escHtml(m.text)}
      </div>`;
    }).join('');
  }

  el.querySelector('#_bb_post').addEventListener('click', () => {
    const text = inputEl.value.trim().slice(0, 120);
    if (!text) return;
    append('bulletin:messages', { name: getPlayerName(), text, ts: Date.now() }, 20);
    inputEl.value = '';
    refresh();
  });

  let _onOpen = null, _onClose = null;

  function open() {
    refresh();
    el.style.display = 'block';
    setTimeout(() => inputEl.focus(), 50);  // focus textarea after display kicks in
    if (_onOpen) _onOpen();
  }

  function close() {
    el.style.display = 'none';
    if (_onClose) _onClose();
  }

  el.querySelector('#_bb_close').addEventListener('click', close);

  return {
    open, close,
    isOpen() { return el.style.display !== 'none'; },
    setCallbacks(onOpen, onClose) { _onOpen = onOpen; _onClose = onClose; },
  };
}

// ── Public API ────────────────────────────────────────────────────────────────
export function createBulletin(scene, getPlayerName) {
  buildMesh(scene);
  const hint     = makeHint();
  const ui       = makeUI(getPlayerName);
  let   isNear   = false;

  function update(dt, playerPos) {
    const dist = Math.hypot(playerPos.x - BOARD_X, playerPos.z - BOARD_Z);
    isNear = dist < INTERACT_RADIUS;
    hint.style.display = (isNear && !ui.isOpen()) ? 'block' : 'none';
  }

  function onKey(e) {
    if (e.code !== 'KeyE') return;
    const tag = document.activeElement?.tagName;
    if (tag === 'TEXTAREA' || tag === 'INPUT') return;
    if (ui.isOpen()) { ui.close(); return; }
    if (isNear)       ui.open();
  }

  // Mobile tap button
  const mobileBtn = (() => {
    const b = document.createElement('button');
    b.textContent = '📌';
    Object.assign(b.style, {
      position: 'fixed', bottom: '90px', left: '20px',
      width: '56px', height: '56px', borderRadius: '50%',
      fontSize: '24px', border: 'none',
      background: 'rgba(0,0,0,0.45)', color: '#fff',
      display: 'none', zIndex: '30', cursor: 'pointer',
    });
    b.addEventListener('touchend', e => { e.preventDefault(); if (isNear) ui.open(); });
    document.body.appendChild(b);
    return b;
  })();

  function showMobileBtn() {
    mobileBtn.style.display = isNear ? 'block' : 'none';
  }

  return { update, onKey, showMobileBtn };
}
