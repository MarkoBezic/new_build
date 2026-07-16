import * as THREE from 'three';
import { toast } from './hud.js';
import { buildHumanoid } from './humanoid.js';
import { HATS, setHatMesh, ownedHats, grantHat, wearHat, wornHat } from './hats.js';

// Moss's Shell Shop — a driftwood shack on Sunset Shore where seashells buy
// hats. E opens the stall; number keys (or tapping a row) buy/equip; 0 goes
// bare-headed; E again closes. Works identically in and out of pointer lock.

const SHACK = { x: -482, z: 555, ry: Math.PI * 0.72 };
const STOCK = ['straw', 'flower', 'wizard', 'pirate', 'halo'];

export function createShop(scene, { interact, audio, shells }) {
  // ── Shack ───────────────────────────────────────────────────────────────────
  const g = new THREE.Group();
  const wood  = new THREE.MeshLambertMaterial({ color: 0x8A6A40, flatShading: true });
  const plank = new THREE.MeshLambertMaterial({ color: 0xA8845A, flatShading: true });
  for (const [px, pz] of [[-1.4, -0.8], [1.4, -0.8], [-1.4, 0.8], [1.4, 0.8]]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 2.6, 6), wood);
    post.position.set(px, 1.3, pz);
    g.add(post);
  }
  const counter = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.9, 0.5), plank);
  counter.position.set(0, 0.45, 0.85);
  g.add(counter);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.08, 2.4), plank);
  roof.position.y = 2.65;
  roof.rotation.z = 0.06;
  g.add(roof);
  // Hat display shelf behind the counter
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.06, 0.4), plank);
  shelf.position.set(0, 1.7, -0.7);
  g.add(shelf);
  STOCK.forEach((id, i) => {
    const hat = HATS[id].build();
    hat.scale.setScalar(0.9);
    hat.position.set(-1.2 + i * 0.6, 1.78, -0.7);
    g.add(hat);
  });
  // Moss, the shopkeeper
  const moss = buildHumanoid(0xC88A4A);
  setHatMesh(moss, 'straw');
  moss.position.set(0.4, 0, -0.2);
  moss.rotation.y = Math.PI;   // face the counter
  g.add(moss);
  g.position.set(SHACK.x, 0.15, SHACK.z);
  g.rotation.y = SHACK.ry;
  scene.add(g);

  // ── Shop panel ──────────────────────────────────────────────────────────────
  const panel = document.createElement('div');
  Object.assign(panel.style, {
    position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
    background: 'rgba(14,11,6,0.94)', color: '#F0E4C8',
    borderRadius: '14px', padding: '18px 24px', zIndex: '45',
    font: '14px/1.9 system-ui, sans-serif', display: 'none',
    border: '1px solid rgba(255,190,130,0.4)', minWidth: '320px',
    boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
  });
  document.body.appendChild(panel);
  let open = false;

  function rowFor(id, idx) {
    const def   = HATS[id];
    const owned = ownedHats().includes(id);
    const worn  = wornHat() === id;
    const status = worn ? '· wearing ✓' : owned ? '· owned — equip' : `— ${def.price} 🐚`;
    const b = document.createElement('button');
    b.textContent = `${idx}. ${def.label}  ${status}`;
    Object.assign(b.style, {
      display: 'block', width: '100%', textAlign: 'left', margin: '2px 0',
      background: worn ? 'rgba(143,209,88,0.18)' : 'rgba(255,255,255,0.06)',
      color: worn ? '#B8E890' : '#F0E4C8', border: 'none', borderRadius: '8px',
      padding: '6px 12px', font: 'inherit', cursor: 'pointer',
    });
    b.addEventListener('click', () => pick(idx));
    return b;
  }

  function refresh() {
    panel.innerHTML =
      `<div style="font-weight:bold;color:#FFC88A;margin-bottom:6px">🐚 Moss's Shell Shop — you have ${shells.get()} shells</div>`;
    STOCK.forEach((id, i) => panel.appendChild(rowFor(id, i + 1)));
    if (ownedHats().includes('cloud')) panel.appendChild(rowFor('cloud', STOCK.length + 1));
    const foot = document.createElement('div');
    foot.style.cssText = 'margin-top:8px;color:#B8A888;font-size:12px';
    foot.textContent = 'Press a number (or tap) to buy / wear · 0 = bare head · E to close';
    panel.appendChild(foot);
  }

  function pick(n) {
    if (n === 0) { wearHat(null); audio.sfx.plink(); refresh(); return; }
    const list = ownedHats().includes('cloud') ? [...STOCK, 'cloud'] : STOCK;
    const id = list[n - 1];
    if (!id) return;
    const def = HATS[id];
    if (ownedHats().includes(id)) {
      wearHat(wornHat() === id ? null : id);
      audio.sfx.plink();
    } else if (def.price != null && shells.spend(def.price)) {
      grantHat(id);
      wearHat(id);
      audio.sfx.fanfare();
      toast(`🐚 ${def.label} is yours — worn with pride!`, 3000);
    } else {
      audio.sfx.grind();
      toast(`Not enough shells — ${def.label} costs ${def.price} 🐚`, 2500);
    }
    refresh();
  }

  function toggle() {
    open = !open;
    if (open) refresh();
    panel.style.display = open ? 'block' : 'none';
    audio.sfx.plink();
  }

  interact.register({
    x: SHACK.x, z: SHACK.z, r: 5,
    label: () => open ? '🐚 Close the shop' : "🐚 Browse Moss's Shell Shop",
    cb: toggle,
  });

  // Number keys while the shop is open (main routes keys here first)
  function onKey(e) {
    if (!open) return false;
    const m = e.code.match(/^Digit(\d)$/);
    if (m) { pick(parseInt(m[1])); return true; }
    return false;
  }

  // Close if the player wanders off mid-browse
  function update(playerPosition) {
    if (open && Math.hypot(playerPosition.x - SHACK.x, playerPosition.z - SHACK.z) > 8) {
      open = false;
      panel.style.display = 'none';
    }
  }

  return { onKey, update, isOpen: () => open };
}
