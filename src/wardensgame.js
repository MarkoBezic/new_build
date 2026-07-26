import * as THREE from 'three';
import { terrainHeight } from './terrain.js';
import { toast } from './hud.js';
import { bus } from './bus.js';

// ── The Warden's Game ────────────────────────────────────────────────────────
// Hide and seek across the whole island, on the multiplayer channel that is
// already running. Ring the bell by the spawn ring to start: the ringer
// becomes the Warden and counts while everyone else scatters, then hunts.
//
// Authority model: the Warden's client owns the game and broadcasts the whole
// state once a second. Everyone else simply renders what it says, so there is
// no consensus problem and no server. If the Warden leaves, the state stops
// arriving and the game quietly times out.

const BELL   = { x: -9, z: -150 };
const HIDE   = 45;     // seconds to scatter
const HUNT   = 210;    // seconds to find everyone
const CATCH  = 4.5;    // metres — how close the Warden must get
const BEAT   = 1;      // seconds between state broadcasts

const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export function createWardensGame(scene, { interact, audio, playerPosition, mp }) {
  // ── The bell ───────────────────────────────────────────────────────────────
  {
    const g = new THREE.Group();
    const wood = new THREE.MeshLambertMaterial({ color: 0x6B4A22, flatShading: true });
    const brass = new THREE.MeshStandardMaterial({
      color: 0xC8A020, emissive: 0x5A3A08, emissiveIntensity: 0.3, roughness: 0.35, metalness: 0.6,
    });
    for (const px of [-0.7, 0.7]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.6, 0.18), wood);
      post.position.set(px, 1.3, 0);
      g.add(post);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.18, 0.18), wood);
    beam.position.y = 2.6;
    g.add(beam);
    const bell = new THREE.Mesh(
      new THREE.CylinderGeometry(0.26, 0.46, 0.6, 10, 1, true), brass,
    );
    bell.position.y = 2.15;
    g.add(bell);
    g.position.set(BELL.x, terrainHeight(BELL.x, BELL.z), BELL.z);
    scene.add(g);
  }

  // ── HUD ────────────────────────────────────────────────────────────────────
  const hud = document.createElement('div');
  Object.assign(hud.style, {
    position: 'fixed', top: '140px', left: '50%', transform: 'translateX(-50%)',
    color: '#FFE9B8', font: 'bold 15px/1.5 system-ui, sans-serif',
    background: 'rgba(24,10,30,0.72)', padding: '7px 22px', borderRadius: '11px',
    border: '1px solid rgba(200,140,255,0.45)', zIndex: '20', textAlign: 'center',
    pointerEvents: 'none', display: 'none', textShadow: '0 1px 3px rgba(0,0,0,0.85)',
    whiteSpace: 'pre-line',
  });
  document.body.appendChild(hud);

  // ── State ──────────────────────────────────────────────────────────────────
  // phase: 'off' | 'hide' | 'hunt' | 'over'
  let st = { phase: 'off', warden: '', until: 0, found: [], players: 0 };
  let beat = 0, lastWarn = 0;
  const meId = () => mp()?.getId?.() ?? '';
  const isWarden = () => st.warden && st.warden === meId();
  const amFound = () => st.found.includes(meId());

  function broadcast() {
    mp()?.publishGame?.({ phase: st.phase, warden: st.warden, until: st.until, found: st.found, players: st.players });
  }

  function receive(data, fromId) {
    // Only the acting Warden may drive the game
    if (data.warden !== fromId) return;
    if (st.phase !== 'off' && st.warden !== data.warden && data.phase !== 'over') return;
    // State arrives once a second, so announce only genuine transitions
    const wasFound = amFound();
    const wasPhase = st.phase;
    st = { ...data, found: [...(data.found ?? [])] };
    if (st.phase === 'hide' && wasPhase !== 'hide' && !isWarden()) {
      audio.sfx.bell();
      toast(`🔔 The Warden’s Bell! Scatter and hide — you have ${HIDE} seconds.`, 6000);
    }
    if (!wasFound && amFound()) {
      audio.sfx.bell();
      toast('👁 The Warden found you!', 4000);
    }
    if (st.phase === 'over' && wasPhase !== 'over') endBanner();
  }

  function start() {
    const others = mp()?.getRemotes?.() ?? [];
    if (!meId()) { toast('The bell needs other islanders — multiplayer is not connected.', 4000); return; }
    if (!others.length) { toast('🔔 You ring the bell. Nobody answers — no one else is on the island.', 5000); return; }
    st = { phase: 'hide', warden: meId(), until: Date.now() + HIDE * 1000, found: [], players: others.length };
    audio.sfx.bell();
    toast(`🔔 You are the Warden. Count to ${HIDE} — no peeking.\n${others.length === 1 ? 'One islander is' : `${others.length} islanders are`} hiding.`, 7000);
    broadcast();
  }

  interact.register({
    x: BELL.x, z: BELL.z, r: 3.4,
    label: () => st.phase === 'off' ? "🔔 Ring the Warden's Bell (hide and seek)" : '🔔 A game is already afoot',
    when: () => st.phase === 'off',
    cb: start,
  });

  function endBanner() {
    const wardenWon = st.found.length >= st.players;
    toast(wardenWon
      ? '👁 The Warden found everyone. The island keeps no secrets tonight.'
      : '🌿 Time! The hidden ones win — the island kept them.', 7000);
    bus.emit('warden-game');
  }

  function finish() {
    st.phase = 'over';
    st.until = Date.now() + 8000;
    audio.sfx.fanfare();
    broadcast();
    endBanner();
  }

  // ── Per-frame ──────────────────────────────────────────────────────────────
  function update(dt) {
    if (st.phase === 'off') { hud.style.display = 'none'; return; }
    const left = Math.max(0, (st.until - Date.now()) / 1000);

    if (st.phase === 'over') {
      hud.style.display = 'none';
      if (left <= 0) st = { phase: 'off', warden: '', until: 0, found: [], players: 0 };
      return;
    }

    // The Warden drives every transition; hiders only display
    if (isWarden()) {
      beat -= dt;
      if (st.phase === 'hide' && left <= 0) {
        st.phase = 'hunt';
        st.until = Date.now() + HUNT * 1000;
        audio.sfx.chime(7);
        toast('👁 Go. Find them.', 4000);
        beat = 0;
      } else if (st.phase === 'hunt') {
        // Catch anyone we get close enough to
        for (const r of mp()?.getRemotes?.() ?? []) {
          if (st.found.includes(r.id)) continue;
          if (Math.hypot(playerPosition.x - r.x, playerPosition.z - r.z) < CATCH) {
            st.found.push(r.id);
            audio.sfx.bell();
            toast(`👁 Found ${r.name || 'someone'}! (${st.found.length}/${st.players})`, 3500);
            beat = 0;
          }
        }
        if (st.found.length >= st.players || left <= 0) { finish(); return; }
      }
      if (beat <= 0) { beat = BEAT; broadcast(); }
    } else if (left <= 0 && st.phase === 'hunt') {
      // The Warden went quiet — let the game lapse rather than hang
      st = { phase: 'off', warden: '', until: 0, found: [], players: 0 };
      return;
    }

    // ── Display ──
    hud.style.display = 'block';
    if (st.phase === 'hide') {
      hud.textContent = isWarden()
        ? `👁 You are the Warden — count to ${Math.ceil(left)}`
        : `🌿 Hide! The Warden comes in ${Math.ceil(left)}`;
      return;
    }
    if (isWarden()) {
      // Warm/cold on the nearest islander still hidden
      let best = Infinity;
      for (const r of mp()?.getRemotes?.() ?? []) {
        if (st.found.includes(r.id)) continue;
        best = Math.min(best, Math.hypot(playerPosition.x - r.x, playerPosition.z - r.z));
      }
      const heat = best < 12 ? '🔥 Burning' : best < 30 ? '🌡 Warm' : best < 70 ? '❄️ Cool' : '🧊 Freezing';
      hud.textContent = `👁 Hunting — ${fmt(left)}  ·  ${st.found.length}/${st.players} found\n${best < Infinity ? heat : 'nobody left to find'}`;
    } else if (amFound()) {
      hud.textContent = `👁 Found! — the hunt ends in ${fmt(left)}`;
    } else {
      // Hiders feel the Warden approaching without being told where they are
      const w = (mp()?.getRemotes?.() ?? []).find(r => r.id === st.warden);
      const d = w ? Math.hypot(playerPosition.x - w.x, playerPosition.z - w.z) : Infinity;
      if (d < 18 && performance.now() - lastWarn > 4000) {
        lastWarn = performance.now();
        audio.sfx.plink();
      }
      hud.textContent = `🌿 Hidden — ${fmt(left)}${d < 18 ? '\n…footsteps, close by' : ''}`;
    }
  }

  return { update, receive };
}
