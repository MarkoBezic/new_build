// Universal interact verb — one registry, one key (E), one prompt.
// Any module can register a spot: { x, z, r, label, cb, when? }.
// `when()` (optional) gates availability (e.g. spirit only at night).
// The nearest available spot within range becomes the current prompt;
// E (or the mobile ✦ button) triggers it. Boat boarding/exit keeps priority —
// prompts are suppressed while on a boat.
import { isOnBoat } from './player.js';
import { makeMobileButton } from './hud.js';

export function createInteract(playerPosition, { isMobile } = {}) {
  const spots = [];
  let current = null;
  let cooldown = 0;

  function register(spot) {
    spots.push(spot);
    return spot;
  }

  // ── Mobile button ──────────────────────────────────────────────────────────
  const btn = isMobile
    ? makeMobileButton('✦', { bottom: '150px', right: '20px' }, () => trigger(), 'rgba(80,200,255,0.35)')
    : null;

  function trigger() {
    if (!current || cooldown > 0) return;
    cooldown = 0.6;
    current.cb();
  }

  window.addEventListener('keydown', e => {
    if (e.code !== 'KeyE' || isOnBoat()) return;
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    trigger();
  });

  function update(dt) {
    cooldown = Math.max(0, cooldown - dt);
    current = null;
    if (isOnBoat()) { if (btn) btn.style.display = 'none'; return; }

    let bestD = Infinity;
    for (const s of spots) {
      if (s.when && !s.when()) continue;
      const d = Math.hypot(playerPosition.x - s.x, playerPosition.z - s.z);
      if (d < s.r && d < bestD) { bestD = d; current = s; }
    }
    if (btn) btn.style.display = current ? 'block' : 'none';
  }

  // For the HUD hint line — null when nothing is in range.
  // Labels may be functions so prompts can reflect state (e.g. re-read).
  function getPrompt() {
    if (!current) return null;
    return typeof current.label === 'function' ? current.label() : current.label;
  }

  return { register, update, getPrompt };
}
