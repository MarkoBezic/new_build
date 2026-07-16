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
    refreshUI();
  }

  function record(task, data) {
    if (state.done.includes(task.id)) return;
    if (task.ok && !task.ok(data)) return;
    if (task.need) {
      state.prog[task.id] = (state.prog[task.id] ?? 0) + 1;
      persist();
      if (state.prog[task.id] < task.need) { refreshUI(); return; }
    }
    complete(task);
  }

  for (const t of picks) {
    if (t.ev) bus.on(t.ev, data => record(t, data));
  }

  // ── Chip under the shard counter ────────────────────────────────────────────
  const chip = document.createElement('div');
  Object.assign(chip.style, {
    position: 'fixed', top: '42px', right: '14px', zIndex: '15',
    color: '#FFE9B8', font: '13px/1.6 system-ui, sans-serif',
    background: 'rgba(0,0,0,0.4)', padding: '4px 12px', borderRadius: '10px',
    pointerEvents: 'none', textShadow: '0 1px 3px rgba(0,0,0,0.8)',
  });
  document.body.appendChild(chip);

  // ── K panel ─────────────────────────────────────────────────────────────────
  const panel = document.createElement('div');
  Object.assign(panel.style, {
    position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
    background: 'rgba(14,11,6,0.94)', color: '#F0E4C8',
    borderRadius: '14px', padding: '18px 26px', zIndex: '45',
    font: '14px/1.9 system-ui, sans-serif', display: 'none',
    border: '1px solid rgba(255,215,90,0.35)', minWidth: '300px',
    boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
  });
  document.body.appendChild(panel);
  let open = false;

  function refreshUI() {
    chip.textContent = `📋 ${completedCount()} / ${picks.length}`;
    const rows = picks.map(t => {
      const done = state.done.includes(t.id);
      const prog = t.need && !done ? ` (${state.prog[t.id] ?? 0}/${t.need})` : '';
      return `<div style="color:${done ? '#8FD158' : '#D8CDB4'}">${done ? '✅' : '⬜'} ${t.label}${prog}</div>`;
    }).join('');
    panel.innerHTML =
      `<div style="font-weight:bold;color:#FFD75A;margin-bottom:8px">📋 Daily Tasks — ${today}</div>` +
      rows +
      `<div style="margin-top:10px;color:#B8A888;font-size:12px">Streak: ${streakRec.streak} · resets at midnight (Toronto) · K to close</div>`;
  }
  refreshUI();

  window.addEventListener('keydown', e => {
    if (e.code !== 'KeyK') return;
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    open = !open;
    panel.style.display = open ? 'block' : 'none';
  });

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
