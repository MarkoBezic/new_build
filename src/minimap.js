import * as THREE from 'three';
import { CLEARING_R, WORLD_R, LANDMARKS, OCEAN } from './world.config.js';

// ── Canvas & scale ────────────────────────────────────────────────────────
const W  = 280, H = 280;
const CX = W / 2, CY = H / 2;
const S  = 130 / WORLD_R;   // world radius fits with ~10 px margin on each side

// World (x, z) → canvas pixel
function px(x) { return CX + x * S; }
function py(z) { return CY + z * S; }

// Returns the two world-boundary points where the diagonal z−x=coastVal crosses
// the world circle (radius WORLD_R).
function coastPts(coastVal) {
  const R    = WORLD_R;
  const disc = 2 * R * R - coastVal * coastVal;
  if (disc < 0) return null;
  const root = Math.sqrt(disc);
  const xW = (-coastVal - root) / 2;   // western end
  const xS = (-coastVal + root) / 2;   // southern end
  return { xW, zW: xW + coastVal, xS, zS: xS + coastVal };
}

// ─────────────────────────────────────────────────────────────────────────────
//  Pre-render the static world map once to an offscreen canvas
// ─────────────────────────────────────────────────────────────────────────────
function bakeMap() {
  const off = document.createElement('canvas');
  off.width  = W;
  off.height = H;
  const c = off.getContext('2d');

  const R_canvas = WORLD_R * S;   // ≈ 130 px

  // ── Background outside world circle ──────────────────────────────────────
  c.fillStyle = '#070B05';
  c.fillRect(0, 0, W, H);

  // ── Forest — filled world circle ──────────────────────────────────────────
  c.fillStyle = '#1A3510';
  c.beginPath();
  c.arc(CX, CY, R_canvas, 0, Math.PI * 2);
  c.fill();

  // ── Ocean — SW wedge (polygon + world-boundary arc) ───────────────────────
  // after rotation.x=-π/2 shape-Y → world -Z, so the actual SW quadrant in
  // world space (x<0, z>0) appears in the bottom-left of the canvas.
  const outer = coastPts(OCEAN.coast);
  if (outer) {
    // Angles of the coastline endpoints on the world circle (canvas = atan2(z,x))
    const tS = Math.atan2(outer.zS, outer.xS);   // south point: ≈ 103°
    const tW = Math.atan2(outer.zW, outer.xW);   // west  point: ≈ 167°

    // Filled ocean wedge: straight shoreline then arc SW along world boundary
    c.fillStyle = '#1A73A8';
    c.beginPath();
    c.moveTo(px(outer.xW), py(outer.zW));
    c.lineTo(px(outer.xS), py(outer.zS));
    c.arc(CX, CY, R_canvas, tS, tW, false);   // clockwise 103°→135°→167°
    c.closePath();
    c.fill();
  }

  // ── Beach — sandy parallelogram strip landward of the shore ───────────────
  const inner = coastPts(OCEAN.coast - OCEAN.beachWidth);
  if (outer && inner) {
    c.fillStyle = '#D4BC7A';
    c.beginPath();
    c.moveTo(px(outer.xW), py(outer.zW));
    c.lineTo(px(outer.xS), py(outer.zS));
    c.lineTo(px(inner.xS), py(inner.zS));
    c.lineTo(px(inner.xW), py(inner.zW));
    c.closePath();
    c.fill();
  }

  // ── Subtle grid (clipped to world circle) ─────────────────────────────────
  c.save();
  c.beginPath();
  c.arc(CX, CY, R_canvas, 0, Math.PI * 2);
  c.clip();
  c.strokeStyle = 'rgba(255,255,255,0.03)';
  c.lineWidth   = 1;
  for (let u = -800; u <= 800; u += 200) {
    c.beginPath(); c.moveTo(px(u), py(-WORLD_R)); c.lineTo(px(u), py(WORLD_R)); c.stroke();
    c.beginPath(); c.moveTo(px(-WORLD_R), py(u)); c.lineTo(px(WORLD_R), py(u)); c.stroke();
  }
  c.restore();

  // ── Clearing disc ─────────────────────────────────────────────────────────
  c.fillStyle = '#4D9240';
  c.beginPath();
  c.arc(CX, CY, Math.max(4, CLEARING_R * S), 0, Math.PI * 2);
  c.fill();

  // Treeline edge ring
  c.strokeStyle = '#2D5820';
  c.lineWidth   = 1.5;
  c.beginPath();
  c.arc(CX, CY, Math.max(5, (CLEARING_R + 5) * S), 0, Math.PI * 2);
  c.stroke();

  // ── Pond (west) ───────────────────────────────────────────────────────────
  const ppx = px(LANDMARKS.pond.x), ppy = py(LANDMARKS.pond.z);
  const PR = Math.max(4, 18 * S);   // enforce minimum legible radius
  c.fillStyle = '#2E7D3A';
  c.beginPath();
  c.ellipse(ppx, ppy, PR * 1.3, PR * 0.8, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#1A5276';
  c.beginPath();
  c.ellipse(ppx, ppy, PR, PR * 0.6, 0, 0, Math.PI * 2);
  c.fill();

  // ── Cave (east) ───────────────────────────────────────────────────────────
  const cpx = px(LANDMARKS.cave.x), cpy = py(LANDMARKS.cave.z);
  const CR = Math.max(4, 18 * S);
  c.fillStyle = '#5A5248';
  c.beginPath();
  c.arc(cpx, cpy, CR, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#111008';
  c.beginPath();
  c.arc(cpx, cpy, Math.max(2, CR * 0.45), 0, Math.PI * 2);
  c.fill();

  // ── Parking lots ──────────────────────────────────────────────────────────
  c.fillStyle = '#1E1E22';
  c.fillRect(px(-28), py(-52), Math.max(4, 56 * S), Math.max(2, 36 * S));   // north lot
  c.fillRect(px(-23), py(16),  Math.max(4, 46 * S), Math.max(2, 26 * S));   // south lot

  // ── Building footprint ────────────────────────────────────────────────────
  c.fillStyle   = '#9A9088';
  c.strokeStyle = '#C8C0B0';
  c.lineWidth   = 1;
  const BPX = Math.max(4, 42 * S);
  c.fillRect(px(-21), py(-21), BPX, BPX);
  c.strokeRect(px(-21), py(-21), BPX, BPX);

  // ── World boundary ring ───────────────────────────────────────────────────
  c.strokeStyle = 'rgba(255,255,255,0.20)';
  c.lineWidth   = 1;
  c.beginPath();
  c.arc(CX, CY, R_canvas, 0, Math.PI * 2);
  c.stroke();

  // ── Labels ────────────────────────────────────────────────────────────────
  c.textAlign    = 'center';
  c.textBaseline = 'middle';

  // Building
  c.fillStyle = 'rgba(255,250,240,0.85)';
  c.font      = 'bold 7px system-ui,sans-serif';
  c.fillText('OT', CX, CY + 1);

  // Pond label
  c.fillStyle = 'rgba(160,220,255,0.80)';
  c.font      = '7px system-ui,sans-serif';
  c.fillText(LANDMARKS.pond.label, ppx, ppy + PR + 5);

  // Cave label
  c.fillStyle = 'rgba(210,200,185,0.80)';
  c.font      = '7px system-ui,sans-serif';
  c.fillText(LANDMARKS.cave.label, cpx, cpy + CR + 5);

  // Ocean label (inside the blue wedge, near its centre of mass)
  if (outer) {
    const cx_ocean = px((outer.xW + outer.xS) / 2 * 0.85);
    const cy_ocean = py((outer.zW + outer.zS) / 2 * 0.85);
    c.fillStyle = 'rgba(180,220,255,0.60)';
    c.font      = 'bold 8px system-ui,sans-serif';
    c.fillText('OCEAN', cx_ocean, cy_ocean);
  }

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
