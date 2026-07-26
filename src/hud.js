import * as THREE from 'three';

// ── Notification lanes ───────────────────────────────────────────────────────
// Three deliberately distinct channels so the world doesn't say everything at
// the same volume:
//   toast()    — the standard lane: meaningful events, capped so they can't pile up
//   ceremony() — the rare lane: the handful of once-ever moments, big and central
//   floatUp()  — the ambient lane: a tiny "+n" that rises off a HUD chip, no toast
let _toastBox = null;
let _toastLive = 0;
const TOAST_CAP = 3;   // never stack more than this — older ones expire first

export function toast(msg, ms = 3200) {
  if (!_toastBox) {
    _toastBox = document.createElement('div');
    Object.assign(_toastBox.style, {
      position: 'fixed', top: '84px', left: '50%', transform: 'translateX(-50%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
      pointerEvents: 'none', zIndex: '25',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    });
    document.body.appendChild(_toastBox);
  }
  // Cap the stack — drop the oldest so a busy moment can't bury the screen
  while (_toastLive >= TOAST_CAP && _toastBox.firstChild) {
    _toastBox.firstChild.remove();
    _toastLive--;
  }
  const el = document.createElement('div');
  el.textContent = msg;
  Object.assign(el.style, {
    color: '#fff', fontSize: '14px', background: 'rgba(20,16,8,0.78)',
    padding: '8px 18px', borderRadius: '10px',
    border: '1px solid rgba(255,215,130,0.35)',
    textShadow: '0 1px 3px rgba(0,0,0,0.8)',
    transition: 'opacity 0.5s ease', opacity: '1',
    whiteSpace: 'pre-line', textAlign: 'center', maxWidth: '80vw',
  });
  _toastBox.appendChild(el);
  _toastLive++;
  setTimeout(() => { el.style.opacity = '0'; }, ms - 500);
  setTimeout(() => { el.remove(); _toastLive--; }, ms);
}

// A once-in-a-while moment: larger, centred, gently announced. Reserve it for
// the genuinely rare — a crown, a network waking, a first dive.
export function ceremony(msg, ms = 5200) {
  const el = document.createElement('div');
  el.textContent = msg;
  Object.assign(el.style, {
    position: 'fixed', top: '38%', left: '50%', transform: 'translate(-50%,-50%) scale(0.85)',
    color: '#FFF0C8', font: '600 22px/1.4 Georgia, serif',
    background: 'radial-gradient(ellipse at center, rgba(40,28,8,0.82), rgba(20,14,4,0.5))',
    padding: '20px 40px', borderRadius: '16px', textAlign: 'center', whiteSpace: 'pre-line',
    border: '1px solid rgba(255,210,120,0.5)', maxWidth: '70vw',
    textShadow: '0 2px 10px rgba(0,0,0,0.9)', pointerEvents: 'none', zIndex: '47',
    opacity: '0', transition: 'opacity 0.6s ease, transform 0.6s ease',
  });
  document.body.appendChild(el);
  requestAnimationFrame(() => {
    el.style.opacity = '1';
    el.style.transform = 'translate(-50%,-50%) scale(1)';
  });
  setTimeout(() => { el.style.opacity = '0'; }, ms - 600);
  setTimeout(() => el.remove(), ms);
}

// A small "+n" that floats up from a HUD element and fades — the ambient lane
// for currency and micro-rewards that would otherwise spam the toast channel.
export function floatUp(anchorEl, text, color = '#FFE0D0') {
  if (!anchorEl) return;
  const r = anchorEl.getBoundingClientRect();
  const el = document.createElement('div');
  el.textContent = text;
  Object.assign(el.style, {
    position: 'fixed', left: `${r.left + r.width / 2}px`, top: `${r.top}px`,
    transform: 'translate(-50%,0)', color, font: 'bold 14px system-ui, sans-serif',
    textShadow: '0 1px 3px rgba(0,0,0,0.9)', pointerEvents: 'none', zIndex: '26',
    transition: 'transform 0.9s ease-out, opacity 0.9s ease-out', opacity: '1',
  });
  document.body.appendChild(el);
  requestAnimationFrame(() => {
    el.style.transform = 'translate(-50%,-28px)';
    el.style.opacity = '0';
  });
  setTimeout(() => el.remove(), 950);
}

// ── HUD counter chip (top-right stack) — shared by shards/tasks/shells ──────
export function makeChip(top, color = '#DFF6FF') {
  const chip = document.createElement('div');
  Object.assign(chip.style, {
    position: 'fixed', top: `${top}px`, right: '14px', zIndex: '15',
    color, font: '13px/1.6 system-ui, sans-serif',
    background: 'rgba(0,0,0,0.4)', padding: '4px 12px', borderRadius: '10px',
    pointerEvents: 'none', textShadow: '0 1px 3px rgba(0,0,0,0.8)',
  });
  document.body.appendChild(chip);
  return chip;
}

// ── Round mobile action button — shared by interact/fishing/snow/photo/map ──
export function makeMobileButton(emoji, pos, onTap, background = 'rgba(0,0,0,0.45)') {
  const btn = document.createElement('button');
  btn.textContent = emoji;
  Object.assign(btn.style, {
    position: 'fixed', width: '54px', height: '54px', borderRadius: '50%',
    fontSize: '24px', border: 'none', display: 'none',
    background, color: '#fff', zIndex: '30', ...pos,
  });
  btn.addEventListener('touchend', e => { e.preventDefault(); onTap(); });
  document.body.appendChild(btn);
  return btn;
}

// HUD overlay — compass strip (top centre), current biome name, a biome
// banner that flashes on zone change, and a contextual hint line.
export function createHUD({ camera, playerPosition, biomeAt, getNearestPortal, getInteractPrompt, getContextKeys, isMobile }) {
  const mk = (styles) => {
    const el = document.createElement('div');
    Object.assign(el.style, {
      position: 'fixed', pointerEvents: 'none', zIndex: '15',
      fontFamily: 'system-ui, -apple-system, sans-serif', ...styles,
    });
    document.body.appendChild(el);
    return el;
  };

  // ── Compass canvas ──────────────────────────────────────────────────────────
  const compass = document.createElement('canvas');
  compass.width = 320; compass.height = 38;
  Object.assign(compass.style, {
    position: 'fixed', top: '10px', left: '50%', transform: 'translateX(-50%)',
    pointerEvents: 'none', zIndex: '15', width: '320px', height: '38px',
  });
  document.body.appendChild(compass);
  const ctx = compass.getContext('2d');

  // ── Zone label + banner + hint ─────────────────────────────────────────────
  const zoneEl = mk({
    top: '50px', left: '50%', transform: 'translateX(-50%)',
    color: 'rgba(255,255,255,0.75)', fontSize: '12px', letterSpacing: '0.18em',
    textTransform: 'uppercase', textShadow: '0 1px 4px rgba(0,0,0,0.7)',
  });
  const bannerEl = mk({
    top: '18%', left: '50%', transform: 'translateX(-50%)',
    color: '#fff', fontSize: 'clamp(1.4rem, 3.4vw, 2.4rem)', fontWeight: '700',
    letterSpacing: '0.14em', textTransform: 'uppercase',
    textShadow: '0 2px 14px rgba(0,0,0,0.85)', opacity: '0',
    transition: 'opacity 0.6s ease', whiteSpace: 'nowrap',
  });
  const hintEl = mk({
    bottom: '34px', left: '50%', transform: 'translateX(-50%)',
    color: 'rgba(255,255,255,0.85)', fontSize: '13px',
    background: 'rgba(0,0,0,0.45)', padding: '6px 16px', borderRadius: '10px',
    textShadow: '0 1px 3px rgba(0,0,0,0.8)', transition: 'opacity 0.4s ease',
    whiteSpace: 'nowrap',
  });
  // Contextual key strip — shows only the few keys that matter right where you
  // are (on a boat, in the peaks, near the court), so nobody memorises the map.
  // Desktop only; mobile surfaces its actions as situational buttons instead.
  const keysEl = isMobile ? null : mk({
    bottom: '12px', left: '50%', transform: 'translateX(-50%)',
    color: 'rgba(255,255,255,0.62)', fontSize: '12px',
    padding: '3px 12px', textShadow: '0 1px 3px rgba(0,0,0,0.85)',
    transition: 'opacity 0.4s ease', whiteSpace: 'nowrap', opacity: '0',
  });
  let _lastKeys = '';

  const TIPS = isMobile
    ? ['Drag left side to move, right side to look', 'Walk into a glowing portal to warp',
       '✦ Collect resonant shards — look for the light beams', 'Tap 💬 to chat']
    : ['Press V to toggle 1st / 3rd person view', 'Hold Shift to sprint — Space to jump',
       'Walk into a glowing portal to warp',
       '✦ Collect resonant shards — look for the light beams',
       'Stone tablets hold the Warden story — press J for your journal',
       'Return at night… some things only wake after dark',
       'Press T to chat with other players'];

  const CARDINALS = [['N', 0], ['E', 90], ['S', 180], ['W', 270]];
  const _dir = new THREE.Vector3();
  let zoneTimer = 0, lastZone = '', bannerTimer = 0;
  let tipTimer = 0, tipIdx = 0, tipLife = 75;   // rotate tips for the first 75 s

  function drawCompass(bearingDeg) {
    const W = compass.width, H = compass.height, PX_PER_DEG = W / 120; // ±60° view
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.roundRect(0, 4, W, 26, 13);
    ctx.fill();

    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    // Fixed world-bearing marks every 15°, scrolled by the camera heading
    const first = Math.ceil((bearingDeg - 60) / 15) * 15;
    for (let m = first; m <= bearingDeg + 60; m += 15) {
      const deg = ((m % 360) + 360) % 360;
      const x = W / 2 + (m - bearingDeg) * PX_PER_DEG;
      if (deg % 90 === 0) {
        const letter = CARDINALS.find(c => c[1] === deg)[0];
        ctx.fillStyle = letter === 'N' ? '#FF8A80' : 'rgba(255,255,255,0.95)';
        ctx.font = 'bold 15px system-ui, sans-serif';
        ctx.fillText(letter, x, 17);
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.fillRect(x - 0.5, 11, 1, 12);
      }
    }
    // Centre needle
    ctx.fillStyle = '#FFD580';
    ctx.beginPath();
    ctx.moveTo(W / 2 - 5, 34); ctx.lineTo(W / 2 + 5, 34); ctx.lineTo(W / 2, 27);
    ctx.fill();
  }

  let _lastBearing = -999;

  function update(dt) {
    // Compass — redrawn only when the heading actually moves (canvas redraws
    // at 60 fps for a still camera were pure waste)
    camera.getWorldDirection(_dir);
    const bearing = ((Math.atan2(_dir.x, -_dir.z) * 180 / Math.PI) % 360 + 360) % 360;
    if (Math.abs(bearing - _lastBearing) > 0.3) {
      _lastBearing = bearing;
      drawCompass(bearing);
    }

    // Zone label + banner (throttled)
    zoneTimer -= dt;
    if (zoneTimer <= 0) {
      zoneTimer = 0.3;
      const zone = biomeAt(playerPosition.x, playerPosition.z);
      if (zone !== lastZone) {
        lastZone = zone;
        zoneEl.textContent = zone;
        bannerEl.textContent = zone;
        bannerEl.style.opacity = '1';
        bannerTimer = 2.2;
      }
    }
    if (bannerTimer > 0) {
      bannerTimer -= dt;
      if (bannerTimer <= 0) bannerEl.style.opacity = '0';
    }

    // Contextual hint — interact prompt wins, then portals, then starter tips
    const prompt = getInteractPrompt ? getInteractPrompt() : null;
    const near = getNearestPortal(playerPosition.x, playerPosition.z);
    if (prompt) {
      hintEl.textContent = isMobile ? `✦ ${prompt}` : `[E] ${prompt}`;
      hintEl.style.opacity = '1';
    } else if (near && near.dist < 10) {
      hintEl.textContent = `Run into the portal to warp → ${near.label}`;
      hintEl.style.opacity = '1';
    } else if (tipLife > 0) {
      tipLife -= dt; tipTimer -= dt;
      if (tipTimer <= 0) {
        tipTimer = 7;
        hintEl.textContent = TIPS[tipIdx % TIPS.length];
        tipIdx++;
      }
      hintEl.style.opacity = '1';
    } else {
      hintEl.style.opacity = '0';
    }

    // Contextual key strip
    if (keysEl) {
      const keys = getContextKeys ? getContextKeys() : '';
      if (keys !== _lastKeys) {
        _lastKeys = keys;
        if (keys) keysEl.innerHTML = keys;
        keysEl.style.opacity = keys ? '1' : '0';
      }
    }
  }

  return { update };
}
