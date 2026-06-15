import * as THREE from 'three';
import { POND_CENTER, CAVE_CENTER } from './landmarks.js';

// ── Canvas & scale ────────────────────────────────────────────────────────
const W  = 280, H = 280;
const CX = W / 2, CY = H / 2;
const S  = 0.65;   // px per world unit — shows ±215 units from centre

// World (x, z) → canvas pixel
function px(x) { return CX + x * S; }
function py(z) { return CY + z * S; }

// ─────────────────────────────────────────────────────────────────────────────
//  Pre-render the static world map once to an offscreen canvas
// ─────────────────────────────────────────────────────────────────────────────
function bakeMap() {
  const off = document.createElement('canvas');
  off.width  = W;
  off.height = H;
  const c = off.getContext('2d');

  // Forest background
  c.fillStyle = '#1A3510';
  c.fillRect(0, 0, W, H);

  // Subtle grid every 50 world units
  c.strokeStyle = 'rgba(255,255,255,0.035)';
  c.lineWidth   = 1;
  for (let u = -200; u <= 200; u += 50) {
    c.beginPath(); c.moveTo(px(u), 0);   c.lineTo(px(u), H); c.stroke();
    c.beginPath(); c.moveTo(0, py(u));   c.lineTo(W, py(u)); c.stroke();
  }

  // Clearing disc (bright grass)
  c.fillStyle = '#4D9240';
  c.beginPath();
  c.arc(CX, CY, 62 * S, 0, Math.PI * 2);
  c.fill();

  // Treeline transition ring (slightly darker)
  c.strokeStyle = '#2D5820';
  c.lineWidth   = 4;
  c.beginPath();
  c.arc(CX, CY, (62 + 5) * S, 0, Math.PI * 2);
  c.stroke();

  // ── Pond (west) ──────────────────────────────────────────────────────────
  const ppx = px(POND_CENTER.x), ppy = py(POND_CENTER.z);
  // Shore ring
  c.fillStyle = '#2E7D3A';
  c.beginPath();
  c.ellipse(ppx, ppy, 22 * S, 14 * S, 0, 0, Math.PI * 2);
  c.fill();
  // Water body
  c.fillStyle = '#1A5276';
  c.beginPath();
  c.ellipse(ppx, ppy, 18 * S, 11 * S, 0, 0, Math.PI * 2);
  c.fill();
  // Highlight shimmer
  c.strokeStyle = 'rgba(90,180,220,0.4)';
  c.lineWidth   = 1.5;
  c.beginPath();
  c.ellipse(ppx, ppy, 13 * S, 7 * S, 0, 0, Math.PI * 2);
  c.stroke();

  // ── Rock formation + cave (east) ─────────────────────────────────────────
  const cpx = px(CAVE_CENTER.x), cpy = py(CAVE_CENTER.z);
  // Rocky ground
  c.fillStyle = '#484038';
  c.beginPath();
  c.ellipse(cpx, cpy, 22 * S, 22 * S, 0, 0, Math.PI * 2);
  c.fill();
  // Cliff mass
  c.fillStyle = '#6A6258';
  c.fillRect(cpx - 4 * S, cpy - 14 * S, 20 * S, 28 * S);
  // Cave opening (dark mouth faces west)
  c.fillStyle = '#111008';
  c.fillRect(cpx - 8 * S, cpy - 6 * S, 10 * S, 12 * S);

  // ── Parking lots ─────────────────────────────────────────────────────────
  c.fillStyle = '#1E1E22';
  // North lot
  c.fillRect(px(-28), py(-52), 56 * S, 36 * S);
  // South lot
  c.fillRect(px(-23), py(16),  46 * S, 26 * S);

  // Parking lot lane marks (faint white dashes)
  c.strokeStyle = 'rgba(255,255,255,0.08)';
  c.lineWidth   = 0.8;
  for (let lz = -52 + 18; lz < -16; lz += 18) {
    c.beginPath(); c.moveTo(px(-28), py(lz)); c.lineTo(px(28), py(lz)); c.stroke();
  }
  c.beginPath(); c.moveTo(px(-23), py(16 + 13)); c.lineTo(px(23), py(16 + 13)); c.stroke();

  // ── Building footprint ───────────────────────────────────────────────────
  c.fillStyle   = '#9A9088';
  c.strokeStyle = '#C8C0B0';
  c.lineWidth   = 1.2;
  c.fillRect(px(-21), py(-14), 42 * S, 28 * S);
  c.strokeRect(px(-21), py(-14), 42 * S, 28 * S);

  // ── Labels ───────────────────────────────────────────────────────────────
  c.textAlign    = 'center';
  c.textBaseline = 'middle';

  // Building
  c.fillStyle = 'rgba(255,250,240,0.9)';
  c.font      = 'bold 8px system-ui,sans-serif';
  c.fillText('OT', CX, CY + 1);

  // Pond label
  c.fillStyle = 'rgba(160,220,255,0.85)';
  c.font      = '8px system-ui,sans-serif';
  c.fillText('POND', ppx, ppy + 16 * S + 5);

  // Cave label
  c.fillStyle = 'rgba(210,200,185,0.85)';
  c.font      = '8px system-ui,sans-serif';
  c.fillText('CAVE', cpx + 5 * S, cpy + 24 * S + 3);

  // ── Map title ─────────────────────────────────────────────────────────────
  c.fillStyle    = 'rgba(255,255,255,0.38)';
  c.font         = 'bold 8px system-ui,sans-serif';
  c.textAlign    = 'left';
  c.textBaseline = 'top';
  c.fillText('WORLD MAP', 8, 8);

  // ── Compass rose ──────────────────────────────────────────────────────────
  const rosX = W - 18, rosY = H - 18, rosR = 10;
  c.strokeStyle    = 'rgba(255,255,255,0.35)';
  c.lineWidth      = 1;
  c.beginPath(); c.moveTo(rosX, rosY - rosR); c.lineTo(rosX, rosY + rosR); c.stroke();
  c.beginPath(); c.moveTo(rosX - rosR, rosY); c.lineTo(rosX + rosR, rosY); c.stroke();
  c.fillStyle    = 'rgba(255,255,255,0.6)';
  c.font         = 'bold 9px system-ui,sans-serif';
  c.textAlign    = 'center';
  c.textBaseline = 'alphabetic';
  c.fillText('N', rosX, rosY - rosR - 2);

  return off;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Public factory
// ─────────────────────────────────────────────────────────────────────────────
export function createMinimap(camera) {
  // ── Live canvas (displayed on screen) ──────────────────────────────────────
  const canvas = document.createElement('canvas');
  canvas.width  = W;
  canvas.height = H;
  Object.assign(canvas.style, {
    position:     'fixed',
    top:          '14px',
    left:         '14px',
    borderRadius: '8px',
    border:       '1.5px solid rgba(255,255,255,0.22)',
    boxShadow:    '0 3px 16px rgba(0,0,0,0.65)',
    display:      'none',
    zIndex:       '15',
    pointerEvents:'none',
  });
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  // Bake the static map once
  const staticMap = bakeMap();

  // ── M-key toggle ────────────────────────────────────────────────────────
  let visible = false;
  window.addEventListener('keydown', e => {
    if (e.code === 'KeyM') {
      visible = !visible;
      canvas.style.display = visible ? 'block' : 'none';
    }
  });

  const _dir = new THREE.Vector3();

  // ── Per-frame update ─────────────────────────────────────────────────────
  function update() {
    if (!visible) return;

    // Blit the pre-baked world map
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(staticMap, 0, 0);

    // ── Player arrow ────────────────────────────────────────────────────────
    const wx = camera.position.x;
    const wz = camera.position.z;
    camera.getWorldDirection(_dir);
    const heading = Math.atan2(_dir.x, -_dir.z);   // 0 = north (−Z), cw positive

    // Map the player's world position onto the canvas
    let mx = px(wx);
    let my = py(wz);

    // Clamp to inner area so arrow stays inside the map border
    const margin = 10;
    mx = Math.max(margin, Math.min(W - margin, mx));
    my = Math.max(margin, Math.min(H - margin, my));

    ctx.save();
    ctx.translate(mx, my);
    ctx.rotate(heading);

    // Chevron arrow (bright red, easy to spot)
    ctx.fillStyle   = '#FF3030';
    ctx.strokeStyle = 'rgba(255,180,180,0.75)';
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
