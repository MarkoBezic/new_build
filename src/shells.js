import * as THREE from 'three';
import { save, load } from './persistence.js';
import { toast } from './hud.js';
import { bus } from './bus.js';
import { dailyRng, dayKey } from './daily.js';

// Seashells — the island's soft currency. Every activity drops a few
// (fishing, skipping, racing, rituals, treasure) and eight physical shells
// wash up along the beach each day at date-seeded spots. Spent at Moss's
// hat shop. Purely cosmetic economy, all localStorage.

const RARITY_SHELLS = { common: 2, uncommon: 3, rare: 5, legendary: 12 };
const BEACH_SHELLS = 8, SHELL_VALUE = 3;

export function createShells(scene, { audio, playerPosition }) {
  let count = load('shells:count', 0);

  // ── HUD chip under the tasks chip ───────────────────────────────────────────
  const chip = document.createElement('div');
  Object.assign(chip.style, {
    position: 'fixed', top: '72px', right: '14px', zIndex: '15',
    color: '#FFE0D0', font: '13px/1.6 system-ui, sans-serif',
    background: 'rgba(0,0,0,0.4)', padding: '4px 12px', borderRadius: '10px',
    pointerEvents: 'none', textShadow: '0 1px 3px rgba(0,0,0,0.8)',
  });
  document.body.appendChild(chip);
  const refresh = () => { chip.textContent = `🐚 ${count}`; };
  refresh();

  function add(n, reason) {
    if (n <= 0) return;
    count += n;
    save('shells:count', count);
    refresh();
    toast(`🐚 +${n}${reason ? ` — ${reason}` : ''}`, 2000);
  }

  function spend(n) {
    if (count < n) return false;
    count -= n;
    save('shells:count', count);
    refresh();
    return true;
  }

  // ── Earnings from play (via the event bus) ──────────────────────────────────
  bus.on('fish',        c => add(RARITY_SHELLS[c?.rarity] ?? 2, 'good catch'));
  bus.on('stone-skips', n => { if (n > 0) add(n, `${n}-skip throw`); });
  bus.on('snowball-hit',() => add(1, 'direct hit'));
  bus.on('race',        () => add(5, 'circuit finished'));
  bus.on('ritual',      () => add(8, 'the ritual'));
  bus.on('treasure',    () => add(15, 'daily treasure'));
  bus.on('tasks-done',  () => add(10, 'all daily tasks'));
  let fireCool = 0;
  bus.on('campfire', () => {
    if (fireCool <= 0) { fireCool = 60; add(1, 'tending the fire'); }
  });

  // ── Daily beach shells — seeded spots along the sand ────────────────────────
  const today = dayKey();
  let dayState = load('shells:day', {});
  if (dayState.day !== today) dayState = { day: today, taken: [] };

  const rng = dailyRng('beach-shells');
  const shellGeo = new THREE.DodecahedronGeometry(0.16, 0);
  const shellMat = new THREE.MeshStandardMaterial({
    color: 0xF0D8C0, emissive: 0xA07050, emissiveIntensity: 0.25, roughness: 0.5,
  });
  const live = [];
  for (let i = 0; i < BEACH_SHELLS; i++) {
    // Beach band runs diagonally: pick x, then z on the sand strip (z−x ≈ 1030…1090)
    const x = -620 + rng() * 280;
    const z = x + 1030 + rng() * 60;
    if (dayState.taken.includes(i)) continue;
    const m = new THREE.Mesh(shellGeo, shellMat);
    m.scale.y = 0.55;
    m.position.set(x, 0.28, z);
    scene.add(m);
    live.push({ i, m, phase: i * 0.9 });
  }

  function update(dt, nowSec) {
    fireCool = Math.max(0, fireCool - dt);
    for (let k = live.length - 1; k >= 0; k--) {
      const s = live[k];
      s.m.rotation.y = nowSec + s.phase;
      s.m.position.y = 0.28 + Math.sin(nowSec * 2 + s.phase) * 0.06;
      if (Math.hypot(playerPosition.x - s.m.position.x, playerPosition.z - s.m.position.z) < 2) {
        scene.remove(s.m);
        live.splice(k, 1);
        dayState.taken.push(s.i);
        save('shells:day', dayState);
        audio.sfx.plink();
        add(SHELL_VALUE, 'beach shell');
      }
    }
  }

  return { update, add, spend, get: () => count };
}
