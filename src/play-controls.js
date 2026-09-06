// Pointer capture is optional: embedded browsers may reject it.
// Keep gameplay usable with right-button drag look when that happens.
let desktopPlaying = false;
export const isDesktopPlaying = () => desktopPlaying;

export function createPlayControls(canvas, doc = document, win = window) {
  const listeners = new Map();
  let active = false, pending = false, fallback = false, dragging = false;
  let attempt = 0;
  function setActive(value) {
    pending = false;
    dragging = false;
    if (active === value) return;
    active = value;
    desktopPlaying = value;
    for (const fn of listeners.get(value ? 'lock' : 'unlock') || []) fn();
  }
  function startFallback(id) {
    if (!pending || id !== attempt) return;
    fallback = true;
    setActive(true);
  }
  const controls = {
    get isLocked() { return active; },
    get dragLook() { return fallback; },
    get canLook() { return active && (doc.pointerLockElement === canvas || dragging); },
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(fn);
    },
    lock() {
      if (active || pending) return;
      if (fallback) { setActive(true); return; }
      pending = true;
      const id = ++attempt;
      if (!canvas.requestPointerLock) { startFallback(id); return; }
      try {
        const result = canvas.requestPointerLock();
        result?.catch(() => startFallback(id));
      } catch { startFallback(id); }
    },
    unlock() {
      ++attempt;
      setActive(false);
      if (doc.pointerLockElement === canvas) doc.exitPointerLock();
    },
  };
  doc.addEventListener('pointerlockchange', () => {
    if (doc.pointerLockElement === canvas) {
      if (!pending && !active) { doc.exitPointerLock(); return; }
      fallback = false;
      setActive(true);
    } else if (!fallback) setActive(false);
  });
  doc.addEventListener('pointerlockerror', () => startFallback(attempt));
  canvas.addEventListener('mousedown', e => {
    if (active && fallback && e.button === 2) { dragging = true; e.preventDefault(); }
  });
  doc.addEventListener('mouseup', e => { if (e.button === 2) dragging = false; });
  canvas.addEventListener('contextmenu', e => { if (active) e.preventDefault(); });
  win.addEventListener('keydown', e => { if (e.code === 'Escape') controls.unlock(); });
  win.addEventListener('blur', () => controls.unlock());
  return controls;
}
