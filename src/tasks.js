import { dailyRng, dayKey, yesterdayKey } from './daily.js';
import { save, load } from './persistence.js';
import { toast } from './hud.js';
import { bus } from './bus.js';
import { biomeAt } from './biomes.js';

// Daily tasks — three per day, picked by the shared date seed so everyone
// has the same board. Progress and streak persist per device. K toggles the
// task panel; a chip under the shard counter shows n/3 at a glance.

const POOL = [
  { id: 'skip3',   label: 'Skip a stone 3+ times in one throw', ev: 'stone-skips', ok: n => n >= 3 },
  { id: 'fish2',   label: 'Catch two fish',                     ev: 'fish', need: 2 },
  { id: 'rare',    label: 'Catch a rare (or better) fish',      ev: 'fish', ok: c => c.rarity === 'rare' || c.rarity === 'legendary' },
  { id: 'snowhit', label: 'Hit someone with a snowball',        ev: 'snowball-hit' },
  { id: 'warp',    label: 'Travel through a warp portal',       ev: 'warp' },
  { id: 'fire',    label: 'Feed the beach campfire',            ev: 'campfire' },
  { id: 'icy',     label: 'Visit the Icy Peaks',                poll: p => biomeAt(p.x, p.z) === 'Icy Peaks' },
  { id: 'ruins',   label: 'Visit the Ancient Ruins',            poll: p => biomeAt(p.x, p.z) === 'Ancient Ruins' },
  { id: 'shore',   label: 'Walk the Sunset Shore',              poll: p => biomeAt(p.x, p.z) === 'Sunset Shore' },
  { id: 'summit',  label: 'Climb above 40 m',                   poll: p => p.y > 40 },
  { id: 'plinko',  label: 'Drop a Shellfall chip',              ev: 'plinko' },
];

export function createTasks({ playerPosition }) {
  const today = dayKey();

  // Seeded pick of three distinct tasks
  const rng  = dailyRng('tasks');
  const idxs = POOL.map((_, i) => i);
  for (let i = idxs.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [idxs[i], idxs[j]] = [idxs[j], idxs[i]];
  }
  const picks = idxs.slice(0, 3).map(i => POOL[i]);

  // Per-day progress; streak survives across days
  let state = load('tasks:state', {});
  if (state.day !== today) state = { day: today, prog: {}, done: [], allDone: false };
  const streakRec = load('tasks:streak', { last: '', streak: 0 });

  function persist() { save('tasks:state', state); }

  function completedCount() { return picks.filter(t => state.done.includes(t.id)).length; }

  function complete(task) {
    if (state.done.includes(task.id)) return;
    state.done.push(task.id);
    const n = completedCount();
    if (n === picks.length && !state.allDone) {
      state.allDone = true;
      streakRec.streak = streakRec.last === yesterdayKey() ? streakRec.streak + 1 : 1;
      streakRec.last   = today;
      save('tasks:streak', streakRec);
      bus.emit('tasks-done');
      toast(`📋 All daily tasks complete! Streak: ${streakRec.streak} day${streakRec.streak === 1 ? '' : 's'} 🎉`, 5500);
    } else {
      toast(`📋 Task complete: ${task.label} (${n}/${picks.length})`, 3200);
    }
    persist();
  }

  function record(task, data) {
    if (state.done.includes(task.id)) return;
    if (task.ok && !task.ok(data)) return;
    if (task.need) {
      state.prog[task.id] = (state.prog[task.id] ?? 0) + 1;
      persist();
      if (state.prog[task.id] < task.need) return;
    }
    complete(task);
  }

  for (const t of picks) {
    if (t.ev) bus.on(t.ev, data => record(t, data));
  }

  // One-line summary for the notice board
  function summaryLine() {
    return picks.map(t => `${state.done.includes(t.id) ? '✅' : '⬜'} ${t.label}`).join('  ·  ');
  }

  // Structured view for the unified journal's Daily tab
  function getPicks() {
    return picks.map(t => ({
      label: t.label,
      done: state.done.includes(t.id),
      prog: t.need ? `${state.prog[t.id] ?? 0}/${t.need}` : null,
    }));
  }
  const getStreak = () => streakRec.streak;

  // ── Poll-based tasks (visit places, altitude) ───────────────────────────────
  let pollTimer = 0;
  function update(dt) {
    pollTimer -= dt;
    if (pollTimer > 0) return;
    pollTimer = 0.5;
    for (const t of picks) {
      if (t.poll && !state.done.includes(t.id) && t.poll(playerPosition)) complete(t);
    }
  }

  return { update, summaryLine, getPicks, getStreak };
}
