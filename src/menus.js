import { createMenuState } from './menu-state.js';

let pausePlayer = () => {}, resumePlayer = () => {}, onStage = () => {};
export const menus = createMenuState((stage, active) => {
  document.body.dataset.stage = stage;
  document.body.dataset.panel = active || '';
  onStage(stage);
  if (stage !== 'playing') pausePlayer();
  const overlay = document.getElementById('overlay');
  overlay.style.display = stage === 'pause' ? 'flex' : 'none';
  if (stage === 'pause') overlay.querySelector('.click-hint')?.focus();
});
export function configureMenus({ pause, resume, onChange = () => {} }) {
  onStage = onChange;
  onStage(menus.stage);
  pausePlayer = pause;
  resumePlayer = resume;
}
export function resumeGame() { resumePlayer(); }
export function registerPanel(id, panel, show, onKey) {
  panel.classList.add('game-panel');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-label', id === 'help' ? 'Controls' : id[0].toUpperCase() + id.slice(1));
  panel.tabIndex = -1;
  menus.register(id, {
    show(open, data) {
      show(open, data);
      if (open) {
        // Journal content is regenerated when its tab changes.
        if (!panel.querySelector('[data-close-panel]')) {
          const close = document.createElement('button');
          close.type = 'button'; close.className = 'panel-close';
          close.dataset.closePanel = ''; close.textContent = 'Back to menu';
          close.addEventListener('click', () => menus.pause());
          panel.prepend(close);
        }
        panel.focus();
      }
    }, onKey,
  });
}

window.addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target?.tagName);
  if (menus.stage === 'entry') {
    return;
  }
  if (typing && e.code !== 'Escape' && e.code !== 'Tab') return;
  const shortcut = { KeyM: 'map', KeyJ: 'journal', KeyK: 'journal', Slash: 'help' }[e.code];
  if (e.code === 'Escape') {
    // Chat owns its Escape key while editing.
    if (typing && menus.stage === 'playing') return;
    e.preventDefault(); e.stopImmediatePropagation(); menus.pause();
  } else if (shortcut && !e.repeat) {
    e.preventDefault(); e.stopImmediatePropagation();
    menus.toggle(shortcut, e.code === 'KeyK' ? 2 : undefined);
  } else if (menus.stage !== 'playing') {
    if (e.code === 'Tab') {
      const root = menus.active ? document.querySelector(`.game-panel[aria-label="${menus.active === 'help' ? 'Controls' : menus.active[0].toUpperCase() + menus.active.slice(1)}"]`) : document.getElementById('overlay');
      const focusable = [...root.querySelectorAll('button, input, select, [tabindex="0"]')].filter(el => !el.disabled && el.getClientRects().length);
      const first = focusable[0], last = focusable.at(-1);
      if (e.shiftKey && (document.activeElement === first || document.activeElement === root)) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || document.activeElement === root)) { e.preventDefault(); first?.focus(); }
    } else if (menus.key(e)) e.preventDefault();
    // Native button/slider keyboard behavior remains available; world shortcuts do not.
    e.stopPropagation();
  }
}, true);

// Entry controls keep their native key behavior without triggering world actions.
document.addEventListener('keydown', e => { if (menus.stage === 'entry') e.stopPropagation(); });
