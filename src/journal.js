import { load } from './persistence.js';
import { progress } from './progress.js';
import { TABLETS } from './tablets.js';
import { LETTERS } from './castle.js';
import { CATCHES } from './fishing.js';
import { HATS, ownedHats } from './hats.js';
import { TRAILS } from './cosmetics.js';

// The Warden's Journal (J) — one tabbed book for everything the player is:
// Story (tablet fragments) · Collections (fish / hats / trails, silhouettes
// for the undiscovered) · Daily (tasks, treasure, streaks) · Records.
// Digits 1–4 switch tabs while open; tabs are tappable on mobile.

const TABS = ['📖 Story', '🐟 Collections', '📋 Daily', '🏆 Records'];

export function createJournal({ tasks, treasure }) {
  const panel = document.createElement('div');
  Object.assign(panel.style, {
    position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
    maxWidth: '520px', width: '90vw', maxHeight: '72vh', overflowY: 'auto',
    display: 'none', zIndex: '46', background: 'rgba(16,13,8,0.96)',
    color: '#EDE3C8', borderRadius: '14px', padding: '18px 24px',
    border: '1px solid rgba(212,168,90,0.4)', fontFamily: 'Georgia, serif',
    boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
  });
  document.body.appendChild(panel);
  let open = false, tab = 0;

  const dim = s => `<span style="opacity:0.45">${s}</span>`;
  const head = s => `<div style="color:#D4A85A;font-size:16px;margin:10px 0 6px">${s}</div>`;

  function storyTab() {
    let h = head(`The Warden Fragments — ${progress.count('tablets')} / ${TABLETS.length}`);
    for (const t of TABLETS) {
      h += progress.has('tablets', t.id)
        ? `<div style="margin-bottom:11px"><span style="color:#86E8C8">◈ ${t.title}</span><br><span style="font-size:13px;line-height:1.6">${t.text}</span></div>`
        : `<div style="margin-bottom:11px">${dim('◈ ??? — an unread stone waits somewhere…')}</div>`;
    }
    if (progress.get('crown')) h += `<div style="color:#FFD75A">👑 You wear the Warden's Crown.</div>`;
    h += head(`Royal Letters of Northkeep — ${progress.count('letters')} / ${LETTERS.length}`);
    for (const l of LETTERS) {
      h += progress.has('letters', l.id)
        ? `<div style="margin-bottom:11px"><span style="color:#E8C23A">✒ ${l.title}</span><br><span style="font-size:13px;line-height:1.6">${l.text}</span></div>`
        : `<div style="margin-bottom:11px">${dim('✒ ??? — an unread letter waits in the castle…')}</div>`;
    }
    return h;
  }

  function collectionsTab() {
    const species = load('fishing:species', []);
    let h = head(`Fish — ${species.length} / ${CATCHES.length}`);
    h += `<div style="font-size:13px;line-height:2">`;
    for (const c of CATCHES) {
      h += species.includes(c.name)
        ? `🐟 ${c.name} <span style="opacity:0.6;font-size:11px">(${c.rarity})</span><br>`
        : `${dim(`🐟 ？？？ — ${c.cond ? 'bites only under certain skies…' : c.rarity}`)}<br>`;
    }
    h += `</div>`;
    const hats = ownedHats();
    h += head(`Hats — ${hats.length} / ${Object.keys(HATS).length}`);
    h += `<div style="font-size:13px;line-height:2">` + Object.entries(HATS).map(([id, d]) =>
      hats.includes(id) ? `🎩 ${d.label}` : dim(`🎩 ？？？${d.price ? ` — ${d.price} 🐚 at Moss's` : ' — found somewhere high or hidden'}`),
    ).join('<br>') + `</div>`;
    const trails = progress.get('trails') ?? [];
    h += head(`Trails — ${trails.length - 1} / ${Object.keys(TRAILS).length - 1}`);
    h += `<div style="font-size:13px;line-height:2">` + Object.entries(TRAILS)
      .filter(([id]) => id !== 'none')
      .map(([id, d]) => trails.includes(id) ? `✨ ${d.label}` : dim(`✨ ？？？ — complete a shard set`))
      .join('<br>') + `</div>`;
    return h;
  }

  function dailyTab() {
    const t = treasure.getStatus();
    let h = head('Daily tasks');
    h += `<div style="font-size:13px;line-height:2">` + tasks.getPicks().map(p =>
      `${p.done ? '✅' : '⬜'} ${p.label}${p.prog && !p.done ? ` (${p.prog})` : ''}`,
    ).join('<br>') + `</div>`;
    h += `<div style="font-size:12px;opacity:0.7;margin-top:4px">Task streak: ${tasks.getStreak()} days</div>`;
    h += head('Daily treasure');
    h += `<div style="font-size:13px">${t.opened ? 'Found today ✓' : `“${t.hint}”`}</div>`;
    h += `<div style="font-size:12px;opacity:0.7;margin-top:4px">Treasure streak: ${t.streak} days · ${t.total} chests lifetime</div>`;
    return h;
  }

  function recordsTab() {
    const log = load('fishing:log', []);
    const big = log.reduce((a, c) => (c.kg > (a?.kg ?? 0) ? c : a), null);
    const race = load('race:best', null);
    const rampart = load('race:rampart', null);
    const plinko = load('plinko:stats', { jackpots: 0 });
    const fmt = s => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;
    const rows = [
      ['🐚 Shells', load('shells:count', 0)],
      ['✦ Shards', `${progress.count('shards')} / 34`],
      ['🪨 Best stone skip', `${load('stoneBest', 0)} skips`],
      ['🏁 Meadow Circuit best', race ? fmt(race.time) : '—'],
      ['🏰 Rampart Run best', rampart ? fmt(rampart.time) : '—'],
      ['🎣 Biggest catch', big ? `${big.name}, ${big.kg} kg` : '—'],
      ['🎣 Fish caught', log.length >= 50 ? '50+' : log.length],
      ['🪙 Shellfall jackpots', plinko.jackpots],
      ['🗺 Places charted', `${(load('map:found', []) || []).length}`],
    ];
    return head('Records') + `<div style="font-size:13px;line-height:2.1">` +
      rows.map(([k, v]) => `${k}: <span style="color:#FFE9B8">${v}</span>`).join('<br>') + `</div>`;
  }

  function render() {
    const tabsHtml = TABS.map((t, i) =>
      `<button data-tab="${i}" style="border:none;border-radius:8px;padding:4px 10px;margin-right:6px;cursor:pointer;font:13px Georgia;
        background:${i === tab ? 'rgba(212,168,90,0.35)' : 'rgba(255,255,255,0.07)'};
        color:${i === tab ? '#FFD75A' : '#C8BDA0'}">${i + 1}. ${t}</button>`).join('');
    const body = [storyTab, collectionsTab, dailyTab, recordsTab][tab]();
    panel.innerHTML =
      `<div style="margin-bottom:6px">${tabsHtml}</div>` + body +
      `<div style="font-size:11px;opacity:0.5;margin-top:10px">1–4 to switch tabs · J to close</div>`;
    panel.querySelectorAll('button[data-tab]').forEach(b =>
      b.addEventListener('click', () => { tab = parseInt(b.dataset.tab); render(); }));
  }

  function toggle(force, toTab) {
    open = force ?? !open;
    if (toTab != null) tab = toTab;
    if (open) render();
    panel.style.display = open ? 'block' : 'none';
  }

  window.addEventListener('keydown', e => {
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (e.code === 'KeyJ') toggle();
    if (e.code === 'Escape' && open) toggle(false);
  });

  // Digits switch tabs while open (main routes keys here first, like the
  // shop). J itself is NOT handled here — the window listener above owns it,
  // and handling it in both places would double-toggle on one press.
  function onKey(e) {
    const m = e.code.match(/^Digit([1-4])$/);
    if (m) { tab = parseInt(m[1]) - 1; render(); return true; }
    return false;
  }

  const btn = document.createElement('button');
  btn.textContent = '📖';
  Object.assign(btn.style, {
    position: 'fixed', bottom: '20px', right: '72px',
    width: '44px', height: '44px', borderRadius: '50%',
    fontSize: '19px', border: 'none', background: 'rgba(0,0,0,0.50)',
    cursor: 'pointer', zIndex: '40', boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
  });
  btn.addEventListener('click', () => toggle());
  document.body.appendChild(btn);

  return { onKey, isOpen: () => open };
}
