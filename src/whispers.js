import { toast } from './hud.js';
import { save, load } from './persistence.js';
import { isOnBoat, isGliding, isSwimming } from './player.js';
import { biomeAt } from './biomes.js';

// ── Diegetic first-time hints ────────────────────────────────────────────────
// One quiet line the first time — ever — you meet a system, tied to the moment
// it becomes relevant. Each fires once and is remembered forever, so this
// teaches without the nagging of a persistent tutorial banner. No banner, no
// checklist in your face; the opt-in "Beginnings" journal tab is for players
// who want the list.

const WHISPERS = [
  { id: 'boat',  when: () => isOnBoat(),
    text: 'You’re aboard. Press F to fish — and Z, out in deep water, to dive beneath the waves.' },
  { id: 'glide', when: () => isGliding(),
    text: 'The wind has you. Look where you want to go — the glider follows your gaze.' },
  { id: 'swim',  when: () => isSwimming(),
    text: 'Hold your breath and explore. SPACE kicks for the surface; Z climbs back out.' },
  { id: 'icy',   when: p => biomeAt(p.x, p.z) === 'Icy Peaks',
    text: 'The Icy Peaks. Press G to throw a snowball — and the glider waits at the summit.' },
  { id: 'castle',when: p => Math.max(Math.abs(p.x + 120), Math.abs(p.z + 520)) < 46,
    text: 'Northkeep. Its gate, its towers, and stairs that wind down into the dark below.' },
  { id: 'hamlet',when: p => Math.hypot(p.x + 400, p.z + 150) < 55,
    text: 'The Hamlet. Claim a plot at any signpost and build a home the whole island can visit.' },
  { id: 'ruins', when: p => biomeAt(p.x, p.z) === 'Ancient Ruins',
    text: 'The Ancient Ruins. Read the standing words nearby — the stones remember a language of distance.' },
  { id: 'deep',  when: p => p.y < -14,
    text: 'You’ve gone deep. The world keeps going down here — mind the water, feed the fires.' },
];

export function createWhispers({ playerPosition }) {
  const seen = new Set(load('whispers:seen', []));
  let cool = 4;   // a beat of grace after spawn before the first whisper
  let pollT = 0;

  function update(dt) {
    cool -= dt;
    if (cool > 0) return;
    pollT -= dt;
    if (pollT > 0) return;
    pollT = 0.5;
    for (const w of WHISPERS) {
      if (seen.has(w.id)) continue;
      if (w.when(playerPosition)) {
        seen.add(w.id);
        save('whispers:seen', [...seen]);
        toast(w.text, 6500);
        cool = 8;               // never two whispers back to back
        break;
      }
    }
  }

  return { update };
}
