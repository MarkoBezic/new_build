import { save, load } from './persistence.js';

// ── Settings & accessibility ─────────────────────────────────────────────────
// One panel (⚙, or hidden behind the ? button) for the adjustments a 3-D world
// with gliding, diving and an FOV kick is obliged to offer — especially
// reduced motion, without which motion-sensitive players simply can't stay.
// Values persist and are read live by the player, audio and HUD each frame.

const KEY = 'settings';
const DEFAULTS = {
  sensitivity: 1,      // 0.4 … 2.0 multiplier on look speed
  invertY:     false,
  volMaster:   0.5,    // 0 … 1
  volAmbience: 1,      // 0 … 1 (scales the ambient beds)
  volEffects:  1,      // 0 … 1 (scales one-shot sfx)
  fov:         78,     // 68 … 92
  reducedMotion: false,// kills the FOV kick + camera-shake-ish effects
  bigText:     false,  // bumps journal / letter / reading text
};

const state = { ...DEFAULTS, ...load(KEY, {}) };
const listeners = [];

export const settings = {
  get: k => state[k],
  set(k, v) { state[k] = v; save(KEY, state); listeners.forEach(fn => fn(k, v)); },
  onChange(fn) { listeners.push(fn); },
};

if (state.bigText) document.documentElement.classList.add('big-text');

export function createSettingsPanel() {
  const panel = document.createElement('div');
  Object.assign(panel.style, {
    position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
    background: 'rgba(14,12,10,0.96)', color: '#F0E4C8', borderRadius: '14px',
    padding: '20px 26px', zIndex: '47', font: '14px system-ui, sans-serif',
    display: 'none', border: '1px solid rgba(180,140,60,0.4)', width: 'min(360px, 90vw)',
    boxShadow: '0 8px 40px rgba(0,0,0,0.6)', maxHeight: '82vh', overflowY: 'auto',
  });
  panel.innerHTML = `<div style="font-weight:bold;font-size:16px;color:#D4A85A;margin-bottom:12px">⚙️  Settings</div>`;
  document.body.appendChild(panel);

  const row = (label, control) => {
    const r = document.createElement('div');
    Object.assign(r.style, { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', margin: '10px 0' });
    const l = document.createElement('label');
    l.textContent = label;
    l.style.color = '#D8CDB4';
    r.append(l, control);
    panel.appendChild(r);
    return r;
  };
  const slider = (key, min, max, step, fmt) => {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;align-items:center;gap:8px';
    const s = document.createElement('input');
    s.type = 'range'; s.min = min; s.max = max; s.step = step; s.value = state[key];
    s.style.width = '130px';
    const val = document.createElement('span');
    val.style.cssText = 'color:#FFD580;font:12px monospace;min-width:38px;text-align:right';
    val.textContent = fmt(state[key]);
    s.addEventListener('input', () => { const v = parseFloat(s.value); settings.set(key, v); val.textContent = fmt(v); });
    wrap.append(s, val);
    return wrap;
  };
  const toggle = key => {
    const b = document.createElement('button');
    const paint = () => {
      b.textContent = state[key] ? 'On' : 'Off';
      b.style.cssText = `border:none;border-radius:8px;padding:5px 16px;cursor:pointer;font:13px system-ui;` +
        `background:${state[key] ? 'rgba(143,209,88,0.35)' : 'rgba(255,255,255,0.1)'};color:${state[key] ? '#B8E890' : '#C8BDA0'}`;
    };
    paint();
    b.addEventListener('click', () => { settings.set(key, !state[key]); paint(); });
    return b;
  };

  const heading = t => {
    const h = document.createElement('div');
    h.textContent = t;
    h.style.cssText = 'color:#B89A5A;font-size:11px;font-weight:bold;letter-spacing:0.08em;text-transform:uppercase;margin:14px 0 2px';
    panel.appendChild(h);
  };

  heading('Camera & look');
  row('Look sensitivity', slider('sensitivity', 0.4, 2, 0.05, v => `${v.toFixed(2)}×`));
  row('Invert vertical', toggle('invertY'));
  row('Field of view', slider('fov', 68, 92, 1, v => `${v|0}°`));

  heading('Sound');
  row('Master volume', slider('volMaster', 0, 1, 0.05, v => `${Math.round(v*100)}%`));
  row('Ambience', slider('volAmbience', 0, 1, 0.05, v => `${Math.round(v*100)}%`));
  row('Effects', slider('volEffects', 0, 1, 0.05, v => `${Math.round(v*100)}%`));

  heading('Accessibility');
  row('Reduced motion', toggle('reducedMotion'));
  row('Larger text', toggle('bigText'));

  const foot = document.createElement('div');
  foot.style.cssText = 'margin-top:14px;color:#8A806A;font-size:12px;text-align:center';
  foot.textContent = 'Esc to close';
  panel.appendChild(foot);

  let open = false;
  const setOpen = v => { open = v; panel.style.display = v ? 'block' : 'none'; };
  window.addEventListener('keydown', e => {
    if (e.code === 'Escape' && open) setOpen(false);
  });

  // Big-text toggles a document class; the reading panels opt in via CSS
  settings.onChange((k, v) => {
    if (k === 'bigText') document.documentElement.classList.toggle('big-text', v);
  });

  return { toggle: () => setOpen(!open), isOpen: () => open };
}
