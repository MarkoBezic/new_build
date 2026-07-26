import * as THREE from 'three';
import { save, load } from './persistence.js';
import { toast } from './hud.js';
import { bus } from './bus.js';
import { buildHumanoid } from './humanoid.js';
import { groundY } from './zones.js';
import { terrainHeight } from './terrain.js';
import { makeBeam } from './fx.js';
import { COURSES } from './route.js';

// Checkpoint races — record your run at 10 Hz, replay it as a translucent
// ghost to race against. No backend, feels multiplayer. Parameterised so any
// number of courses share this one system (see route.js): the Meadow Circuit
// runs on terrain, the Rampart Run threads the castle battlements.
//
// Wayfinding is the difference between a race and a guessing game, so every
// checkpoint carries a name, a fog-immune beacon visible across the island,
// and a screen waypoint that shows direction and live distance — on-screen as
// a ring, off-screen as an arrow pinned to the screen edge.

const RING_R  = 6;
const SAMPLE  = 0.1;     // ghost recording interval (s)
const TIMEOUT = 300;
const WP_M    = 64;      // screen margin for the edge arrow

const fmt = s => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;

export function createRace(scene, { interact, audio, playerPosition, camera, config = COURSES.meadow }) {
  const { key, label, start: START, course: COURSE } = config;
  // Ring/flag/ghost heights: terrain by default, or a caller-supplied surface
  // (the battlements sit at a fixed y the heightmap knows nothing about).
  const heightAt = config.heightAt || ((x, z) => terrainHeight(x, z));
  const gy = config.heightAt || ((x, z) => groundY(x, z));
  // ── Start flag — checkered canvas on a pole ────────────────────────────────
  {
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.08, 3.2, 6),
      new THREE.MeshLambertMaterial({ color: 0xCCCCCC }),
    );
    pole.position.set(START.x, heightAt(START.x, START.z) + 1.6, START.z);
    scene.add(pole);
    const cv = document.createElement('canvas');
    cv.width = cv.height = 32;
    const cx = cv.getContext('2d');
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      cx.fillStyle = (x + y) % 2 ? '#111' : '#EEE';
      cx.fillRect(x * 8, y * 8, 8, 8);
    }
    const flag = new THREE.Mesh(
      new THREE.PlaneGeometry(1.1, 0.7),
      new THREE.MeshLambertMaterial({ map: new THREE.CanvasTexture(cv), side: THREE.DoubleSide }),
    );
    flag.position.set(START.x + 0.6, heightAt(START.x, START.z) + 2.8, START.z);
    scene.add(flag);
  }

  // ── Checkpoint rings + beacons ─────────────────────────────────────────────
  // The active checkpoint gets a wide column that ignores fog plus a slim
  // core that ignores depth, so it stays a landmark from anywhere on the
  // island and shows through the forest between you and it.
  const ringMat  = new THREE.MeshBasicMaterial({
    color: 0xFFD75A, transparent: true, opacity: 0.9,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  });
  const dimMat = ringMat.clone(); dimMat.opacity = 0.16;
  const rings = COURSE.map(cp => {
    const g = new THREE.Group();
    const torus = new THREE.Mesh(new THREE.TorusGeometry(3, 0.26, 8, 32), dimMat);
    torus.position.y = 3;
    g.add(torus);
    const beam = makeBeam(0xFFD75A, { rTop: 1.0, rBottom: 1.4, h: 58, opacity: 0.20, fog: false });
    beam.visible = false;
    g.add(beam);
    const core = makeBeam(0xFFF6D0, {
      rTop: 0.22, h: 58, opacity: 0.34, fog: false, depthTest: false,
    });
    core.renderOrder = 10;
    core.visible = false;
    g.add(core);
    g.position.set(cp.x, heightAt(cp.x, cp.z), cp.z);
    g.visible = false;
    scene.add(g);
    return { group: g, torus, beam, core };
  });

  // ── Waypoint marker — projects the next checkpoint onto the screen ─────────
  const wp = document.createElement('div');
  Object.assign(wp.style, {
    position: 'fixed', left: '0', top: '0', zIndex: '21',
    transform: 'translate(-50%,-50%)', pointerEvents: 'none', display: 'none',
    textAlign: 'center', font: 'bold 13px/1.35 system-ui, sans-serif',
    color: '#FFE9B8', textShadow: '0 1px 4px rgba(0,0,0,0.95)', whiteSpace: 'nowrap',
  });
  const wpArrow = document.createElement('div');
  Object.assign(wpArrow.style, {
    width: '0', height: '0', margin: '0 auto',
    borderLeft: '15px solid #FFD75A',
    borderTop: '10px solid transparent', borderBottom: '10px solid transparent',
    filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.9))',
  });
  const wpPin = document.createElement('div');
  Object.assign(wpPin.style, {
    width: '20px', height: '20px', margin: '0 auto', borderRadius: '50%',
    border: '2.5px solid #FFD75A',
    boxShadow: '0 0 10px rgba(255,215,90,0.85), inset 0 0 7px rgba(255,215,90,0.5)',
  });
  const wpLabel = document.createElement('div');
  wpLabel.style.marginTop = '4px';
  wp.append(wpArrow, wpPin, wpLabel);
  document.body.appendChild(wp);

  const _v = new THREE.Vector3();

  // Place the waypoint for checkpoint `cp`: a ring when it is on screen, an
  // arrow clamped to the screen edge (pointing at it) when it is not.
  function updateWaypoint(cp) {
    if (!camera) return;
    const W = window.innerWidth, H = window.innerHeight;
    _v.set(cp.x, heightAt(cp.x, cp.z) + 3, cp.z);
    _v.applyMatrix4(camera.matrixWorldInverse);
    const inFront = _v.z < 0;                 // camera looks down −z
    _v.applyMatrix4(camera.projectionMatrix); // perspective divide → NDC
    let sx = (_v.x * 0.5 + 0.5) * W;
    let sy = (-_v.y * 0.5 + 0.5) * H;
    if (!inFront) { sx = W - sx; sy = H - sy; }   // NDC mirrors behind the camera

    let dx = sx - W / 2, dy = sy - H / 2;
    const off = !inFront || sx < WP_M || sx > W - WP_M || sy < WP_M || sy > H - WP_M;
    if (off) {
      // Push the direction out to the margin box and clamp there
      const sc = Math.min(
        (W / 2 - WP_M) / Math.max(1e-3, Math.abs(dx)),
        (H / 2 - WP_M) / Math.max(1e-3, Math.abs(dy)),
      );
      dx *= sc; dy *= sc;
      sx = W / 2 + dx; sy = H / 2 + dy;
      wpArrow.style.display = 'block';
      wpArrow.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`;
      wpPin.style.display = 'none';
    } else {
      wpArrow.style.display = 'none';
      wpPin.style.display = 'block';
    }
    wp.style.left = `${sx}px`;
    wp.style.top  = `${sy}px`;
    const dist = Math.round(Math.hypot(playerPosition.x - cp.x, playerPosition.z - cp.z));
    wpLabel.innerHTML = `${cp.name ?? 'Checkpoint'}<br>${dist} m`;
    wp.style.display = 'block';
  }

  // ── Ghost avatar ────────────────────────────────────────────────────────────
  const ghostMat = new THREE.MeshLambertMaterial({
    color: 0xBFE8FF, transparent: true, opacity: 0.38, depthWrite: false,
  });
  let ghost = null;
  function spawnGhost() {
    ghost = buildHumanoid(0xBFE8FF);
    ghost.traverse(o => { if (o.isMesh) o.material = ghostMat; });
    ghost.position.set(START.x, gy(START.x, START.z), START.z);
    scene.add(ghost);
  }
  function removeGhost() {
    if (ghost) { scene.remove(ghost); ghost = null; }
  }

  // ── Race HUD ────────────────────────────────────────────────────────────────
  const hud = document.createElement('div');
  Object.assign(hud.style, {
    position: 'fixed', top: '110px', left: '50%', transform: 'translateX(-50%)',
    color: '#FFE9B8', font: 'bold 16px/1.5 system-ui, sans-serif',
    background: 'rgba(20,14,4,0.65)', padding: '6px 20px', borderRadius: '10px',
    border: '1px solid rgba(255,215,90,0.4)', zIndex: '20',
    pointerEvents: 'none', display: 'none', textShadow: '0 1px 3px rgba(0,0,0,0.8)',
  });
  document.body.appendChild(hud);

  // ── State ───────────────────────────────────────────────────────────────────
  let state = 'idle';    // idle | count | run
  let t = 0, countT = 0, cpIdx = 0;
  let rec = [], recT = 0;
  let best = load(key, null);

  function setActiveRing(i) {
    rings.forEach((r, j) => {
      const on = j === i;
      r.group.visible = true;
      r.torus.material = on ? ringMat : dimMat;
      r.beam.visible = on;
      r.core.visible = on;
    });
  }

  function start() {
    state = 'count'; countT = 3; t = 0; cpIdx = 0; rec = []; recT = 0;
    setActiveRing(0);
    removeGhost();
    if (best?.replay?.length) spawnGhost();
    hud.style.display = 'block';
    audio.sfx.plink();
  }

  function reset() {
    state = 'idle';
    hud.style.display = 'none';
    wp.style.display = 'none';
    rings.forEach(r => { r.group.visible = false; });
    removeGhost();
  }

  function finish() {
    const isBest = !best || t < best.time;
    audio.sfx.fanfare();
    toast(isBest
      ? `🏁 ${fmt(t)} — NEW BEST! Your ghost will race you next time.`
      : `🏁 ${fmt(t)}  (best: ${fmt(best.time)})`, 5500);
    bus.emit('race', t);
    if (isBest) {
      best = { time: +t.toFixed(2), replay: rec };
      save(key, best);
    }
    reset();
  }

  interact.register({
    x: START.x, z: START.z, r: 5,
    label: () => state === 'idle'
      ? `🏁 Race the ${label}${best ? ` (best ${fmt(best.time)})` : ''}`
      : '🏁 Restart the race',
    cb: start,
  });

  function update(dt, nowSec) {
    // Idle ring spin looks alive even when only the flag shows
    for (const r of rings) if (r.group.visible) r.torus.rotation.y = nowSec * 0.8;

    if (state === 'idle') return;

    // Pulse the active beacon so it reads as "go here" at any distance
    const pulse = 0.75 + Math.sin(nowSec * 2.4) * 0.25;
    const act = rings[Math.min(cpIdx, rings.length - 1)];
    if (act?.beam.visible) {
      act.beam.material.opacity = 0.20 * pulse;
      act.core.material.opacity = 0.34 * pulse;
      const s = 1 + Math.sin(nowSec * 2.4) * 0.06;
      act.torus.scale.set(s, s, s);
    }

    if (state === 'count') {
      const prev = Math.ceil(countT);
      countT -= dt;
      hud.textContent = countT > 0 ? `Ready… ${Math.ceil(countT)}` : 'GO!';
      if (countT > 0 && Math.ceil(countT) !== prev) audio.sfx.plink();
      updateWaypoint(COURSE[0]);        // show the first leg during the countdown
      if (countT <= 0) { state = 'run'; audio.sfx.chime(7); }
      return;
    }

    // ── Running ──
    t += dt;
    recT += dt;
    if (recT >= SAMPLE) {
      recT -= SAMPLE;
      rec.push(+playerPosition.x.toFixed(1), +playerPosition.z.toFixed(1));
    }

    // Ghost playback along the best run
    if (ghost && best?.replay?.length >= 4) {
      const rp   = best.replay;
      const last = rp.length / 2 - 1;
      const gi   = Math.min(last, t / SAMPLE);
      const i0   = Math.floor(gi), i1 = Math.min(last, i0 + 1), f = gi - i0;
      const gx = rp[i0 * 2]     + (rp[i1 * 2]     - rp[i0 * 2])     * f;
      const gz = rp[i0 * 2 + 1] + (rp[i1 * 2 + 1] - rp[i0 * 2 + 1]) * f;
      const dx = gx - ghost.position.x, dz = gz - ghost.position.z;
      if (Math.hypot(dx, dz) > 0.02) ghost.rotation.y = Math.atan2(dx, dz);
      ghost.position.set(gx, gy(gx, gz), gz);
    }

    const cp = COURSE[cpIdx];
    hud.textContent =
      `⏱ ${fmt(t)} · ${cpIdx + 1}/${COURSE.length} → ${cp.name ?? 'Checkpoint'}`;
    updateWaypoint(cp);

    if (Math.hypot(playerPosition.x - cp.x, playerPosition.z - cp.z) < RING_R) {
      cpIdx++;
      audio.sfx.chime(cpIdx * 2);
      if (cpIdx >= COURSE.length) finish();
      else setActiveRing(cpIdx);
    }

    if (t > TIMEOUT) { toast('🏁 Race abandoned — the rings sleep again.', 3000); reset(); }
  }

  return { update };
}
