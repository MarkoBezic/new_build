import * as THREE from 'three';
import { toast } from './hud.js';
import { bus } from './bus.js';
import { save, load } from './persistence.js';
import { dayKey, mulberry32 } from './daily.js';
import { makeBeam } from './fx.js';

// Shellfall — the island's own peg-drop attraction, on the boardwalk beside
// Moss's shop. A chip costs 5 shells (first drop each day is free); where you
// stand sets where it drops. Physics runs on a seeded PRNG and the seed is
// broadcast over Ably, so every bystander watches the exact same bounce path.
// Centre slot pays the 50-shell jackpot with a celebration seen map-wide.

const POS = { x: -498, y: 0.15, z: 542, ry: Math.PI * 0.75 };
const PAYOUTS = [0, 2, 5, 10, 50, 10, 5, 2, 0];
const HALF_W = 2.2, TOP_Y = 4.6, SLOT_Y = 0.55, ROWS = 7;
const CHIP_R = 0.10, PEG_R = 0.05, COST = 5;

export function createPlinko(scene, { interact, audio, shells, playerPosition, onBroadcast }) {
  const board = new THREE.Group();
  board.position.set(POS.x, POS.y, POS.z);
  board.rotation.y = POS.ry;
  scene.add(board);

  const wood  = new THREE.MeshLambertMaterial({ color: 0x8A6A40, flatShading: true });
  const plank = new THREE.MeshLambertMaterial({ color: 0xA8845A, flatShading: true });
  const pegMat = new THREE.MeshLambertMaterial({ color: 0xE8E0C8 });

  // Backboard, frame and legs
  const back = new THREE.Mesh(new THREE.BoxGeometry(HALF_W * 2 + 0.5, TOP_Y + 0.6, 0.12), plank);
  back.position.set(0, (TOP_Y + 0.6) / 2 + 0.3, -0.14);
  board.add(back);
  for (const sx of [-1, 1]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.16, TOP_Y + 0.6, 0.3), wood);
    rail.position.set(sx * (HALF_W + 0.17), (TOP_Y + 0.6) / 2 + 0.3, 0);
    board.add(rail);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.6, 6), wood);
    leg.position.set(sx * (HALF_W + 0.17), 0.3, 0);
    board.add(leg);
  }

  // Pegs — offset rows
  const pegGeo = new THREE.CylinderGeometry(PEG_R, PEG_R, 0.2, 6);
  const pegs = [];
  for (let r = 0; r < ROWS; r++) {
    const y = 1.35 + r * 0.44;
    const off = (r % 2) * 0.22;
    for (let px = -HALF_W + 0.25 + off; px <= HALF_W - 0.2; px += 0.44) {
      const m = new THREE.Mesh(pegGeo, pegMat);
      m.rotation.x = Math.PI / 2;
      m.position.set(px, y, 0.02);
      board.add(m);
      pegs.push({ x: px, y });
    }
  }

  // Slot dividers + payout labels on one canvas strip
  const slotW = (HALF_W * 2) / PAYOUTS.length;
  for (let i = 0; i <= PAYOUTS.length; i++) {
    const d = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.75, 0.24), wood);
    d.position.set(-HALF_W + i * slotW, 0.85, 0.02);
    board.add(d);
  }
  {
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 48;
    const cx = cv.getContext('2d');
    cx.fillStyle = '#3A2C18';
    cx.fillRect(0, 0, 512, 48);
    cx.font = 'bold 26px Arial';
    cx.textAlign = 'center'; cx.textBaseline = 'middle';
    PAYOUTS.forEach((p, i) => {
      cx.fillStyle = p >= 50 ? '#FFD75A' : p > 0 ? '#E8D8B0' : '#776650';
      cx.fillText(String(p), (i + 0.5) * (512 / PAYOUTS.length), 24);
    });
    const strip = new THREE.Mesh(
      new THREE.PlaneGeometry(HALF_W * 2, 0.42),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv) }),
    );
    strip.position.set(0, 0.28, 0.06);
    board.add(strip);
  }
  {
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 96;
    const cx = cv.getContext('2d');
    cx.font = 'bold 58px Georgia';
    cx.textAlign = 'center'; cx.textBaseline = 'middle';
    cx.fillStyle = '#FFD75A';
    cx.fillText('🐚 SHELLFALL 🐚', 256, 48);
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(3.4, 0.64),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true }),
    );
    sign.position.set(0, TOP_Y + 1.1, 0.05);
    board.add(sign);
  }

  // Jackpot celebration pillar
  const pillar = makeBeam(0xFFD75A, { rTop: 0.5, rBottom: 0.7, h: 60, opacity: 0 });
  board.add(pillar);
  let pillarT = 0;

  // ── Chips ───────────────────────────────────────────────────────────────────
  const chipGeo = new THREE.CylinderGeometry(CHIP_R, CHIP_R, 0.05, 12);
  const live = [];   // { mesh, x, y, vx, vy, rng, mine, name, settled, doneT, lastPlink }

  function spawnChip(dropX, seed, mine, name) {
    const mesh = new THREE.Mesh(chipGeo, new THREE.MeshLambertMaterial({
      color: new THREE.Color().setHSL((seed % 360) / 360, 0.7, 0.55),
    }));
    mesh.rotation.x = Math.PI / 2;
    board.add(mesh);
    live.push({
      mesh, x: Math.max(-HALF_W + 0.2, Math.min(HALF_W - 0.2, dropX)), y: TOP_Y,
      vx: 0, vy: 0, rng: mulberry32(seed >>> 0), mine, name,
      settled: false, doneT: 0, lastPlink: 0,
    });
  }

  function resolve(c) {
    const slot = Math.max(0, Math.min(PAYOUTS.length - 1,
      Math.floor((c.x + HALF_W) / slotW)));
    const pay = PAYOUTS[slot];
    const jackpot = pay >= 50;
    if (jackpot) {
      pillarT = 8;
      const stats = load('plinko:stats', { jackpots: 0 });
      if (c.mine) { stats.jackpots++; save('plinko:stats', stats); }
      audio.sfx.fanfare();
      if (!c.mine) toast(`✨ ${c.name || 'Someone'} hit the Shellfall jackpot!`, 4000);
    }
    if (c.mine) {
      if (pay > 0) { shells.add(pay, jackpot ? 'SHELLFALL JACKPOT!' : 'Shellfall'); }
      else { toast('🪙 The chip finds nothing. The sea keeps its shells.', 2200); }
    }
  }

  // ── Drop interaction ────────────────────────────────────────────────────────
  const freeToday = () => load('plinko:freeday', '') !== dayKey();

  interact.register({
    x: POS.x, z: POS.z, r: 5.5,
    label: () => freeToday() ? '🪙 Drop a Shellfall chip (free today!)' : `🪙 Drop a Shellfall chip (${COST} 🐚)`,
    cb: () => {
      if (freeToday()) save('plinko:freeday', dayKey());
      else if (!shells.spend(COST)) {
        audio.sfx.grind();
        toast(`You need ${COST} 🐚 for a chip — the beach shells respawn daily.`, 2800);
        return;
      }
      // Where you stand sets the drop point — step sideways to aim
      const dx = playerPosition.x - POS.x, dz = playerPosition.z - POS.z;
      const rightX = Math.cos(POS.ry), rightZ = -Math.sin(POS.ry);
      const dropX = Math.max(-2.0, Math.min(2.0, dx * rightX + dz * rightZ));
      const seed = (Math.random() * 0xFFFFFFFF) >>> 0;
      spawnChip(dropX, seed, true, null);
      audio.sfx.plink();
      bus.emit('plinko');
      if (onBroadcast) onBroadcast({ x: dropX, seed });
    },
  });

  function spawnRemote(data, name) {
    spawnChip(data.x, data.seed, false, name);
  }

  // ── Seeded 2D physics in board space ────────────────────────────────────────
  function update(dt, nowSec) {
    if (pillarT > 0) {
      pillarT -= dt;
      pillar.material.opacity = Math.min(0.3, pillarT * 0.15);
    }

    for (let i = live.length - 1; i >= 0; i--) {
      const c = live[i];
      if (c.settled) {
        c.doneT -= dt;
        if (c.doneT <= 0) {
          board.remove(c.mesh);
          c.mesh.material.dispose();
          live.splice(i, 1);
        }
        continue;
      }
      c.vy = Math.max(c.vy - 7 * dt, -3.2);
      c.x += c.vx * dt;
      c.y += c.vy * dt;

      // Peg bounces — deterministic jitter from the chip's own seeded RNG
      for (const p of pegs) {
        const ddx = c.x - p.x, ddy = c.y - p.y;
        const d2 = ddx * ddx + ddy * ddy;
        const min = CHIP_R + PEG_R;
        if (d2 < min * min && d2 > 0) {
          const d = Math.sqrt(d2);
          c.x = p.x + (ddx / d) * min;
          c.y = p.y + (ddy / d) * min;
          c.vy = Math.abs(c.vy) * -0.35;
          c.vx = c.vx * 0.4 + (c.rng() - 0.5) * 1.6 + (ddx / d) * 0.7;
          if (nowSec - c.lastPlink > 0.09) {
            c.lastPlink = nowSec;
            audio.sfx.plink();
          }
        }
      }

      // Side walls
      if (c.x < -HALF_W + CHIP_R) { c.x = -HALF_W + CHIP_R; c.vx = Math.abs(c.vx) * 0.5; }
      if (c.x >  HALF_W - CHIP_R) { c.x =  HALF_W - CHIP_R; c.vx = -Math.abs(c.vx) * 0.5; }

      // Slot region — funnel into the nearest slot centre and settle
      if (c.y < 1.0) {
        const slot = Math.max(0, Math.min(PAYOUTS.length - 1, Math.floor((c.x + HALF_W) / slotW)));
        const cx = -HALF_W + (slot + 0.5) * slotW;
        c.x += (cx - c.x) * Math.min(1, dt * 10);
        c.vx = 0;
      }
      if (c.y <= SLOT_Y) {
        c.y = SLOT_Y;
        c.settled = true;
        c.doneT = 2.2;
        resolve(c);
      }
      c.mesh.position.set(c.x, c.y, 0.05);
    }
  }

  return { update, spawnRemote };
}
