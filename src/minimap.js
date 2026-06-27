import * as THREE from 'three';
import { CLEARING_R, WORLD_R, LANDMARKS, OCEAN, SPAWN } from './world.config.js';

// ── Canvas & scale ────────────────────────────────────────────────────────
const W  = 280, H = 280;
const CX = W / 2, CY = H / 2;
const S  = 130 / WORLD_R;   // world radius fits with ~10 px margin on each side

export const MAP_SIZE   = W;    // used by main.js to position the HUD mesh
export const MAP_MARGIN = 14;   // px gap from top-left of screen

// World (x, z) → canvas pixel
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
function bakeMap() {
  const off = document.createElement('canvas');
  off.width  = W;
  off.height = H;
  const c = off.getContext('2d');

  const R_canvas = WORLD_R * S;

  // Background
  c.fillStyle = '#070B05';
  c.fillRect(0, 0, W, H);

  // Forest — filled world circle
  c.fillStyle = '#1A3510';
  c.beginPath();
  c.arc(CX, CY, R_canvas, 0, Math.PI * 2);
  c.fill();

  // Ocean — SW wedge
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

  // Clearing disc
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

  // Pond
  const ppx = px(LANDMARKS.pond.x), ppy = py(LANDMARKS.pond.z);
  const PR = Math.max(4, 18 * S);
  c.fillStyle = '#2E7D3A';
  c.beginPath(); c.ellipse(ppx, ppy, PR * 1.3, PR * 0.8, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#1A5276';
  c.beginPath(); c.ellipse(ppx, ppy, PR, PR * 0.6, 0, 0, Math.PI * 2); c.fill();

  // Cave
  const cpx = px(LANDMARKS.cave.x), cpy = py(LANDMARKS.cave.z);
  const CR = Math.max(4, 18 * S);
  c.fillStyle = '#5A5248';
  c.beginPath(); c.arc(cpx, cpy, CR, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#111008';
  c.beginPath(); c.arc(cpx, cpy, Math.max(2, CR * 0.45), 0, Math.PI * 2); c.fill();

  // Parking lots
  c.fillStyle = '#1E1E22';
  c.fillRect(px(-28), py(-59), Math.max(4, 56 * S), Math.max(2, 43 * S));
  c.fillRect(px(-23), py(16),  Math.max(4, 46 * S), Math.max(2, 31 * S));
  c.fillRect(px(21),  py(-18), Math.max(2, 16 * S), Math.max(2, 36 * S));
  c.fillRect(px(-37), py(-18), Math.max(2, 16 * S), Math.max(2, 36 * S));

  // Building footprint
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
  c.textAlign    = 'center';
  c.textBaseline = 'middle';
  c.fillStyle = 'rgba(255,250,240,0.85)';
  c.font      = 'bold 7px system-ui,sans-serif';
  c.fillText('OT', CX, CY + 1);

  c.fillStyle = 'rgba(160,220,255,0.80)';
  c.font      = '7px system-ui,sans-serif';
  c.fillText(LANDMARKS.pond.label, ppx, ppy + PR + 5);

  c.fillStyle = 'rgba(210,200,185,0.80)';
  c.font      = '7px system-ui,sans-serif';
  c.fillText(LANDMARKS.cave.label, cpx, cpy + CR + 5);

  if (outer) {
    const cx_ocean = px((outer.xW + outer.xS) / 2 * 0.85);
    const cy_ocean = py((outer.zW + outer.zS) / 2 * 0.85);
    c.fillStyle = 'rgba(180,220,255,0.60)';
    c.font      = 'bold 8px system-ui,sans-serif';
    c.fillText('OCEAN', cx_ocean, cy_ocean);
  }

  // Map title
  c.fillStyle    = 'rgba(255,255,255,0.38)';
  c.font         = 'bold 8px system-ui,sans-serif';
  c.textAlign    = 'left';
  c.textBaseline = 'top';
  c.fillText('WORLD MAP', 8, 8);

  // Compass rose
  const rosX = W - 18, rosY = H - 18, rosR = 10;
  c.strokeStyle    = 'rgba(255,255,255,0.35)';
  c.lineWidth      = 1;
  c.beginPath(); c.moveTo(rosX, rosY - rosR); c.lineTo(rosX, rosY + rosR); c.stroke();
  c.beginPath(); c.moveTo(rosX - rosR, rosY); c.lineTo(rosX + rosR, rosY); c.stroke();
  c.fillStyle    = '#D4FF90';
  c.font         = 'bold 11px system-ui,sans-serif';
  c.textAlign    = 'center';
  c.textBaseline = 'alphabetic';
  c.fillText('N', rosX, rosY - rosR - 3);

  return off;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Public factory
// ─────────────────────────────────────────────────────────────────────────────
export function createMinimap(camera, getRemotes = () => []) {
  // ── Offscreen canvas — never inserted into the DOM ───────────────────────
  const offCanvas = document.createElement('canvas');
  offCanvas.width  = W;
  offCanvas.height = H;
  const ctx = offCanvas.getContext('2d');

  // CanvasTexture backed by the offscreen canvas; updated each frame
  const texture = new THREE.CanvasTexture(offCanvas);

  // Screen-space plane rendered by the HUD camera in main.js
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(W, H),
    new THREE.MeshBasicMaterial({
      map:        texture,
      transparent: true,
      depthTest:  false,
      depthWrite: false,
    })
  );
  mesh.renderOrder = 999;
  mesh.visible     = false;

  const staticMap = bakeMap();

  // ── M-key toggle ────────────────────────────────────────────────────────────
  let visible = false;
  window.addEventListener('keydown', e => {
    if (e.code === 'KeyM') {
      visible = !visible;
      mesh.visible = visible;
    }
  });
  // Auto-hide on pointer-lock release (ESC / pause)
  document.addEventListener('pointerlockchange', () => {
    if (!document.pointerLockElement && visible) {
      visible = false;
      mesh.visible = false;
    }
  });

  const _dir = new THREE.Vector3();

  // ── Per-frame update ─────────────────────────────────────────────────────
  function update() {
    if (!visible) return;

    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(staticMap, 0, 0);

    // ── Player arrow ────────────────────────────────────────────────────────
    camera.getWorldDirection(_dir);
    const heading = Math.atan2(_dir.x, -_dir.z);
    const margin  = 10;
    let mx = Math.max(margin, Math.min(W - margin, px(camera.position.x)));
    let my = Math.max(margin, Math.min(H - margin, py(camera.position.z)));

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

    // ── Remote players ───────────────────────────────────────────────────────
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

    // ── Border stroke (replaces CSS border/border-radius) ───────────────────
    const br = 8;
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.moveTo(br + 0.75, 0.75);
    ctx.lineTo(W - br - 0.75, 0.75);
    ctx.quadraticCurveTo(W - 0.75, 0.75, W - 0.75, br + 0.75);
    ctx.lineTo(W - 0.75, H - br - 0.75);
    ctx.quadraticCurveTo(W - 0.75, H - 0.75, W - br - 0.75, H - 0.75);
    ctx.lineTo(br + 0.75, H - 0.75);
    ctx.quadraticCurveTo(0.75, H - 0.75, 0.75, H - br - 0.75);
    ctx.lineTo(0.75, br + 0.75);
    ctx.quadraticCurveTo(0.75, 0.75, br + 0.75, 0.75);
    ctx.closePath();
    ctx.stroke();

    // Tell Three.js the canvas contents have changed
    texture.needsUpdate = true;
  }

  return { update, mesh };
}
