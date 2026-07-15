import { toast } from './hud.js';

// Photo mode — P (or the mobile 📷 button) saves a clean PNG of the world.
// The WebGL canvas never contains the DOM HUD, so the shot is UI-free by
// nature. Capture must happen right after composer.render() while the frame
// buffer is still fresh; main calls afterRender() there.

export function createPhoto(renderer, { audio, isMobile }) {
  let pending = false;

  function snap() { pending = true; }

  window.addEventListener('keydown', e => {
    if (e.code !== 'KeyP') return;
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    snap();
  });

  if (isMobile) {
    const btn = document.createElement('button');
    btn.textContent = '📷';
    Object.assign(btn.style, {
      position: 'fixed', bottom: '150px', left: '20px',
      width: '52px', height: '52px', borderRadius: '50%',
      fontSize: '22px', border: 'none',
      background: 'rgba(0,0,0,0.45)', color: '#fff', zIndex: '30',
    });
    btn.addEventListener('touchend', e => { e.preventDefault(); snap(); });
    document.body.appendChild(btn);
  }

  function afterRender() {
    if (!pending) return;
    pending = false;
    audio.sfx.shutter();
    const d = new Date();
    const p2 = n => String(n).padStart(2, '0');
    const name = `island-${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}` +
                 `-${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}.png`;
    renderer.domElement.toBlob(blob => {
      if (!blob) { toast('📷 Capture failed', 2000); return; }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      toast('📷 Photo saved!', 2200);
    });
  }

  return { afterRender };
}
