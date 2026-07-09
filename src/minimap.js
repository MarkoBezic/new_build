import * as THREE from 'three';
import { CLEARING_R, WORLD_R, LANDMARKS, OCEAN, SPAWN, BIOMES } from './world.config.js';
import { progress } from './progress.js';
import { toast } from './hud.js';

// ── Fog of war — landmarks appear on the map only after you visit them ──────
const DISCOVERABLES = [
  { id: 'pond',  x: LANDMARKS.pond.x, z: LANDMARKS.pond.z, r: 60,           hint: 'The pond' },
  { id: 'cave',  x: LANDMARKS.cave.x, z: LANDMARKS.cave.z, r: 60,           hint: 'The cave' },
  { id: 'icy',   x: BIOMES.icy.x,     z: BIOMES.icy.z,     r: BIOMES.icy.r,   hint: 'Icy Peaks' },
  { id: 'ruins', x: BIOMES.ruins.x,   z: BIOMES.ruins.z,   r: BIOMES.ruins.r, hint: 'Ancient Ruins' },
];

// ── Canvas & scale ────────────────────────────────────────────────────────
const W  = 280, H = 280;
const CX = W / 2, CY = H / 2;
const S  = 130 / WORLD_R;

function px(x) { return CX + x * S; }
function py(z) { return CY + z * S; }

function coastPts(coastVal) {
  const R    = WORLD_R;
  const disc = 2 * R * R - coastVal * coastVal;
  if (disc < 0) return null;
  const root = Math.sqrt(disc);
  const xW = (-coastVal - root) / 2;
  const xS = (-coastVal + root) / 2;
  return { xW, zW: xW + coastVal, xS, zS: xS + coastVal };
}

// ─────────────────────────────────────────────────────────────────────────────
//  Pre-render the static world map once to an offscreen canvas
// ─────────────────────────────────────────────────────────────────────────────
function bakeMap(found) {
  const off = document.createElement('canvas');
  off.width  = W;
  off.height = H;
  const c = off.getContext('2d');

  const R_canvas = WORLD_R * S;

  c.fillStyle = '#070B05';
  c.fillRect(0, 0, W, H);

  // Forest
  c.fillStyle = '#1A3510';
  c.beginPath();
  c.arc(CX, CY, R_canvas, 0, Math.PI * 2);
  c.fill();

  // Ocean wedge
  const outer = coastPts(OCEAN.coast);
  if (outer) {
    const tS = Math.atan2(outer.zS, outer.xS);
    const tW = Math.atan2(outer.zW, outer.xW);
    c.fillStyle = '#1A73A8';
    c.beginPath();
    c.moveTo(px(outer.xW), py(outer.zW));
    c.lineTo(px(outer.xS), py(outer.zS));
    c.arc(CX, CY, R_canvas, tS, tW, false);
    c.closePath();
    c.fill();
  }

  // Beach strip
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

  // Subtle grid
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

  // Clearing
  c.fillStyle = '#4D9240';
  c.beginPath();
  c.arc(CX, CY, Math.max(4, CLEARING_R * S), 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#2D5820';
  c.lineWidth   = 1.5;
  c.beginPath();
  c.arc(CX, CY, Math.max(5, (CLEARING_R + 5) * S), 0, Math.PI * 2);
  c.stroke();

  // Spawn point
  const spx = px(SPAWN.x), spy = py(SPAWN.z);
  c.strokeStyle = 'rgba(190,255,130,0.50)';
  c.lineWidth   = 2.5;
  c.beginPath(); c.arc(spx, spy, 9, 0, Math.PI * 2); c.stroke();
  c.fillStyle = '#8FD158';
  c.beginPath(); c.arc(spx, spy, 5, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#D4FF90';
  c.beginPath(); c.arc(spx, spy, 2, 0, Math.PI * 2); c.fill();
  c.fillStyle    = 'rgba(210,255,155,0.80)';
  c.font         = '6.5px system-ui,sans-serif';
  c.textAlign    = 'center';
  c.textBaseline = 'top';
  c.fillText('START', spx, spy + 11);

  // Pond — only once discovered
  const ppx = px(LANDMARKS.pond.x), ppy = py(LANDMARKS.pond.z);
  const PR = Math.max(4, 18 * S);
  if (found.has('pond')) {
    c.fillStyle = '#2E7D3A';
    c.beginPath(); c.ellipse(ppx, ppy, PR * 1.3, PR * 0.8, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#1A5276';
    c.beginPath(); c.ellipse(ppx, ppy, PR, PR * 0.6, 0, 0, Math.PI * 2); c.fill();
  }

  // Cave — only once discovered
  const cpx = px(LANDMARKS.cave.x), cpy = py(LANDMARKS.cave.z);
  const CR = Math.max(4, 18 * S);
  if (found.has('cave')) {
    c.fillStyle = '#5A5248';
    c.beginPath(); c.arc(cpx, cpy, CR, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#111008';
    c.beginPath(); c.arc(cpx, cpy, Math.max(2, CR * 0.45), 0, Math.PI * 2); c.fill();
  }

  // Biomes — only once discovered
  if (found.has('icy')) {
    const ix = px(BIOMES.icy.x), iy = py(BIOMES.icy.z), ir = BIOMES.icy.r * S;
    c.fillStyle = 'rgba(228,240,248,0.85)';
    c.beginPath(); c.arc(ix, iy, ir, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#8B929E';
    for (const [dx, dy] of [[-0.3, 0.1], [0.15, -0.2], [0.05, 0.35]]) {
      c.beginPath();
      c.moveTo(ix + dx * ir - 4, iy + dy * ir + 3);
      c.lineTo(ix + dx * ir, iy + dy * ir - 4);
      c.lineTo(ix + dx * ir + 4, iy + dy * ir + 3);
      c.closePath(); c.fill();
    }
  }
  if (found.has('ruins')) {
    const rx = px(BIOMES.ruins.x), ry = py(BIOMES.ruins.z), rr = BIOMES.ruins.r * S;
    c.fillStyle = 'rgba(154,143,118,0.85)';
    c.beginPath(); c.arc(rx, ry, rr, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#5C523E';
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      c.fillRect(rx + Math.cos(a) * rr * 0.55 - 1, ry + Math.sin(a) * rr * 0.55 - 2, 2, 4);
    }
  }

  // Undiscovered landmarks show as faint question marks
  c.fillStyle    = 'rgba(255,255,255,0.30)';
  c.font         = 'bold 11px system-ui,sans-serif';
  c.textAlign    = 'center'; c.textBaseline = 'middle';
  for (const d of DISCOVERABLES) {
    if (!found.has(d.id)) c.fillText('?', px(d.x), py(d.z));
  }

  // Parking lots
  c.fillStyle = '#1E1E22';
  c.fillRect(px(-28), py(-59), Math.max(4, 56 * S), Math.max(2, 43 * S));
  c.fillRect(px(-23), py(16),  Math.max(4, 46 * S), Math.max(2, 31 * S));
  c.fillRect(px(21),  py(-18), Math.max(2, 16 * S), Math.max(2, 36 * S));
  c.fillRect(px(-37), py(-18), Math.max(2, 16 * S), Math.max(2, 36 * S));

  // Building
  c.fillStyle   = '#9A9088';
  c.strokeStyle = '#C8C0B0';
  c.lineWidth   = 1;
  const BPX = Math.max(4, 42 * S);
  c.fillRect(px(-21), py(-21), BPX, BPX);
  c.strokeRect(px(-21), py(-21), BPX, BPX);

  // World boundary ring
  c.strokeStyle = 'rgba(255,255,255,0.20)';
  c.lineWidth   = 1;
  c.beginPath(); c.arc(CX, CY, R_canvas, 0, Math.PI * 2); c.stroke();

  // Labels
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillStyle = 'rgba(255,250,240,0.85)';
  c.font      = 'bold 7px system-ui,sans-serif';
  c.fillText('OT', CX, CY + 1);
  c.font = '7px system-ui,sans-serif';
  if (found.has('pond')) {
    c.fillStyle = 'rgba(160,220,255,0.80)';
    c.fillText(LANDMARKS.pond.label, ppx, ppy + PR + 5);
  }
  if (found.has('cave')) {
    c.fillStyle = 'rgba(210,200,185,0.80)';
    c.fillText(LANDMARKS.cave.label, cpx, cpy + CR + 5);
  }
  if (found.has('icy')) {
    c.fillStyle = 'rgba(228,240,248,0.85)';
    c.fillText('ICY PEAKS', px(BIOMES.icy.x), py(BIOMES.icy.z) + BIOMES.icy.r * S + 5);
  }
  if (found.has('ruins')) {
    c.fillStyle = 'rgba(220,205,170,0.85)';
    c.fillText('RUINS', px(BIOMES.ruins.x), py(BIOMES.ruins.z) + BIOMES.ruins.r * S + 5);
  }
  if (outer) {
    c.fillStyle = 'rgba(180,220,255,0.60)';
    c.font      = 'bold 8px system-ui,sans-serif';
    c.fillText('OCEAN', px((outer.xW + outer.xS) / 2 * 0.85), py((outer.zW + outer.zS) / 2 * 0.85));
  }

  // Map title
  c.fillStyle = 'rgba(255,255,255,0.38)';
  c.font      = 'bold 8px system-ui,sans-serif';
  c.textAlign = 'left'; c.textBaseline = 'top';
  c.fillText('WORLD MAP', 8, 8);

  // Compass rose
  const rosX = W - 18, rosY = H - 18, rosR = 10;
  c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 1;
  c.beginPath(); c.moveTo(rosX, rosY - rosR); c.lineTo(rosX, rosY + rosR); c.stroke();
  c.beginPath(); c.moveTo(rosX - rosR, rosY); c.lineTo(rosX + rosR, rosY); c.stroke();
  c.fillStyle = '#D4FF90';
  c.font      = 'bold 11px system-ui,sans-serif';
  c.textAlign = 'center'; c.textBaseline = 'alphabetic';
  c.fillText('N', rosX, rosY - rosR - 3);

  return off;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Public factory
// ─────────────────────────────────────────────────────────────────────────────
export function createMinimap(camera, getRemotes = () => []) {
  // DOM canvas — toggled visible/hidden with M key only (never mutated per-frame)
  const canvas = document.createElement('canvas');
  canvas.width  = W;
  canvas.height = H;
  Object.assign(canvas.style, {
    position:     'fixed',
    top:          '14px',
    left:         '14px',
    width:        `${W}px`,
    height:       `${H}px`,
    borderRadius: '8px',
    border:       '1.5px solid rgba(255,255,255,0.22)',
    display:      'none',
    zIndex:       '15',
    pointerEvents:'none',
  });
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  const found = new Set(progress.get('found'));
  let staticMap = bakeMap(found);
  let scanTimer = 0;

  // ── M-key toggle — display is only touched here, never inside animate() ───
  let visible = false;
  window.addEventListener('keydown', e => {
    if (e.code === 'KeyM') {
      visible = !visible;
      canvas.style.display = visible ? 'block' : 'none';
    }
  });
  document.addEventListener('pointerlockchange', () => {
    if (!document.pointerLockElement && visible) {
      visible = false;
      canvas.style.display = 'none';
    }
  });

  const _dir = new THREE.Vector3();

  // ── Per-frame update ─────────────────────────────────────────────────────
  function update() {
    // Discovery scan — cheap, throttled, runs even while the map is hidden
    if (--scanTimer <= 0) {
      scanTimer = 30;   // every ~0.5 s
      for (const d of DISCOVERABLES) {
        if (found.has(d.id)) continue;
        if (Math.hypot(camera.position.x - d.x, camera.position.z - d.z) < d.r) {
          found.add(d.id);
          progress.add('found', d.id);
          staticMap = bakeMap(found);
          toast(`📍 ${d.hint} added to your map`, 2600);
        }
      }
    }

    if (!visible) return;

    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(staticMap, 0, 0);

    // Player arrow
    camera.getWorldDirection(_dir);
    const heading = Math.atan2(_dir.x, -_dir.z);
    const margin  = 10;
    const mx = Math.max(margin, Math.min(W - margin, px(camera.position.x)));
    const my = Math.max(margin, Math.min(H - margin, py(camera.position.z)));

    ctx.save();
    ctx.translate(mx, my);
    ctx.rotate(heading);
    ctx.fillStyle   = '#FF3030';
    ctx.strokeStyle = 'rgba(255,180,180,0.75)';
    ctx.lineWidth   = 0.8;
    ctx.beginPath();
    ctx.moveTo( 0, -8);
    ctx.lineTo(-4,  5);
    ctx.lineTo( 0,  2);
    ctx.lineTo( 4,  5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Remote players
    for (const r of getRemotes()) {
      const rmx = Math.max(margin, Math.min(W - margin, px(r.x)));
      const rmy = Math.max(margin, Math.min(H - margin, py(r.z)));
      const css = '#' + (r.color >>> 0).toString(16).padStart(6, '0');

      ctx.beginPath();
      ctx.arc(rmx, rmy, 5, 0, Math.PI * 2);
      ctx.fillStyle = css;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      const label = (r.name || '').slice(0, 14);
      if (label) {
        ctx.font = 'bold 8px system-ui,sans-serif';
        const tw  = ctx.measureText(label).width;
        const pad = 3;
        const bx  = rmx - tw / 2 - pad;
        const by  = rmy + 8;
        ctx.fillStyle = 'rgba(0,0,0,0.72)';
        ctx.fillRect(bx, by, tw + pad * 2, 12);
        ctx.fillStyle    = '#fff';
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(label, rmx, by + 2);
      }
    }
  }

  return { update };
}
