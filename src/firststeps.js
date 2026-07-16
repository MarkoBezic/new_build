import { toast } from './hud.js';
import { save, load } from './persistence.js';
import { progress } from './progress.js';
import { biomeAt } from './biomes.js';

// First Steps — a gentle four-goal opening that teaches one system each:
// the notice board (dailies), the tablets (story), the shards (collecting)
// and the shore (the wider world). Poll-based, so returning players who have
// already done these blow through them instantly. Finishing pays 20 shells.

export function createFirstSteps({ playerPosition, audio, shells }) {
  const GOALS = [
    { label: 'Find the notice board at the spawn ring',
      check: p => Math.hypot(p.x - 10, p.z + 152) < 7 },
    { label: 'Read a Warden tablet (walk close, press E)',
      check: () => progress.count('tablets') >= 1 },
    { label: 'Collect 3 resonant shards (follow the light beams)',
      check: () => progress.count('shards') >= 3 },
    { label: 'Reach the Sunset Shore (try the warp gate north of spawn)',
      check: p => biomeAt(p.x, p.z) === 'Sunset Shore' },
  ];

  let idx = load('firststeps:idx', 0);

  const line = document.createElement('div');
  Object.assign(line.style, {
    position: 'fixed', top: '96px', left: '50%', transform: 'translateX(-50%)',
    color: '#B8E890', font: '13px/1.6 system-ui, sans-serif',
    background: 'rgba(10,20,6,0.55)', padding: '4px 14px', borderRadius: '9px',
    border: '1px solid rgba(143,209,88,0.35)', pointerEvents: 'none',
    zIndex: '14', textShadow: '0 1px 3px rgba(0,0,0,0.8)',
  });
  document.body.appendChild(line);

  function show() {
    if (idx >= GOALS.length) { line.style.display = 'none'; return; }
    line.textContent = `🧭 First steps ${idx + 1}/${GOALS.length}: ${GOALS[idx].label}`;
  }
  show();

  let pollT = 0;
  function update(dt) {
    if (idx >= GOALS.length) return;
    pollT -= dt;
    if (pollT > 0) return;
    pollT = 0.5;
    if (!GOALS[idx].check(playerPosition)) return;
    idx++;
    save('firststeps:idx', idx);
    if (idx >= GOALS.length) {
      audio.sfx.fanfare();
      shells.add(20, 'first steps complete');
      toast('🧭 First steps complete — the island is yours to explore.\nPress ? for controls, M for the map, J for your journal.', 7000);
    } else {
      audio.sfx.chime(idx * 3);
    }
    show();
  }

  return { update };
}
