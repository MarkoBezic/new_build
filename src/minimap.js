import * as THREE from 'three';

// ── Map dimensions & scale ────────────────────────────────────────────────
const W  = 180, H = 180;
const CX = W / 2, CY = H / 2;   // canvas centre = world origin (0, 0)
const PX_PER_UNIT = 1.2;          // 1 world unit → 1.2 px  (shows ±75 units)

// World (x, z) → canvas (cx, cy).  +z = south = canvas-down.
function wm(x, z) {
  return [CX + x * PX_PER_UNIT, CY + z * PX_PER_UNIT];
}

// ── Landmark data (mirrors world.js / site.js constants) ─────────────────
const CLEARING_R = 62;

// Parking lots [left-x, top-z, width, depth]  (matches site.js flat() calls)
const LOTS = [
  [-28, -52, 56, 36],   // north lot
  [-23,  16, 46, 26],   // south lot
];

// Building footprint centred at world (0,0): 42 × 28
const BW = 42, BD = 28;

export function createMinimap(camera) {
  // ── Canvas setup ─────────────────────────────────────────────────────────
  const canvas = document.createElement('canvas');
  canvas.width  = W;
  canvas.height = H;
  Object.assign(canvas.style, {
    position:     'fixed',
    top:          '14px',
    left:         '14px',
    borderRadius: '50%',
    border:       '2px solid rgba(255,255,255,0.28)',
    boxShadow:    '0 2px 12px rgba(0,0,0,0.55)',
    display:      'none',
    zIndex:       '15',
    pointerEvents:'none',
  });
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  // ── M-key toggle ─────────────────────────────────────────────────────────
  let visible = false;
  window.addEventListener('keydown', e => {
    if (e.code === 'KeyM') {
      visible = !visible;
      canvas.style.display = visible ? 'block' : 'none';
    }
  });

  // ── Reusable vector for getWorldDirection ─────────────────────────────────
  const _dir = new THREE.Vector3();

  // ── Per-frame draw ────────────────────────────────────────────────────────
  function update() {
    if (!visible) return;

    ctx.clearRect(0, 0, W, H);

    // — Clip everything to a circle —
    ctx.save();
    ctx.beginPath();
    ctx.arc(CX, CY, CX, 0, Math.PI * 2);
    ctx.clip();

    // Forest floor
    ctx.fillStyle = '#1A3510';
    ctx.fillRect(0, 0, W, H);

    // Clearing disc
    ctx.fillStyle = '#4D9240';
    ctx.beginPath();
    ctx.arc(CX, CY, CLEARING_R * PX_PER_UNIT, 0, Math.PI * 2);
    ctx.fill();

    // Parking lots
    ctx.fillStyle = '#222226';
    for (const [lx, lz, lw, ld] of LOTS) {
      const [px, py] = wm(lx, lz);
      ctx.fillRect(px, py, lw * PX_PER_UNIT, ld * PX_PER_UNIT);
    }

    // Building footprint
    ctx.fillStyle = '#9A9088';
    const [bx, by] = wm(-BW / 2, -BD / 2);
    ctx.fillRect(bx, by, BW * PX_PER_UNIT, BD * PX_PER_UNIT);

    // Building label
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = 'bold 8px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('OT', CX, CY + 1);

    ctx.restore();   // end circle clip

    // — Compass "N" —
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = 'bold 9px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('N', CX, 5);

    // — Circle border —
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(CX, CY, CX - 1, 0, Math.PI * 2);
    ctx.stroke();

    // — Player arrow —
    const wx = camera.position.x;
    const wz = camera.position.z;
    camera.getWorldDirection(_dir);
    // heading: 0 = north (−Z), increases clockwise
    const heading = Math.atan2(_dir.x, -_dir.z);

    let [mx, my] = wm(wx, wz);

    // Clamp dot to inside the circle so the arrow always stays on the minimap
    const dx = mx - CX, dy = my - CY;
    const dist = Math.hypot(dx, dy);
    const maxR = CX - 9;
    if (dist > maxR) {
      mx = CX + (dx / dist) * maxR;
      my = CY + (dy / dist) * maxR;
    }

    ctx.save();
    ctx.translate(mx, my);
    ctx.rotate(heading);

    // Chevron arrow
    ctx.fillStyle   = '#FF3333';
    ctx.strokeStyle = 'rgba(255,180,180,0.7)';
    ctx.lineWidth   = 0.8;
    ctx.beginPath();
    ctx.moveTo( 0, -8);   // tip
    ctx.lineTo(-4,  5);
    ctx.lineTo( 0,  2);   // notch
    ctx.lineTo( 4,  5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  return { update };
}
