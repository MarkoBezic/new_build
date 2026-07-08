import * as THREE from 'three';
import { terrainHeight } from './terrain.js';

// ── Portal dimensions ─────────────────────────────────────────────────────────
const HALF_W    = 0.95;   // half-width of the oval arch
const HALF_H    = 1.45;   // half-height — arch top at y = 2 × HALF_H = 2.9
const TRIGGER_R = 1.8;    // units — teleport when player gets this close
const COOLDOWN  = 2.2;    // seconds before re-trigger allowed
const FADE_OUT  = 0.40;   // seconds of fade-to-black before the warp
const FADE_IN   = 0.55;   // seconds of fade back in after arrival

// ── Warp network ──────────────────────────────────────────────────────────────
// Two gates stand at the valley plaza (north of the clearing, by the spawn
// path); each biome has a return gate. The old lobby ⇄ beach pair remains.
const DEFS = [
  { x:    0, z:   16, rotY: 0,               c: 0x29B6F6, e: 0x0277BD, label: 'Sunset Shore',    dest: { x: -480, z: 572 } },
  { x: -480, z:  575, rotY: Math.PI * 0.85,  c: 0x29B6F6, e: 0x0277BD, label: 'OpenText Lobby',  dest: { x: 0,    z: 11 } },
  { x:   17, z: -128, rotY: 0,               c: 0x9FE8FF, e: 0x2E9BC0, label: 'Icy Peaks',       dest: { x: 338,  z: -636 } },
  { x:  343, z: -646, rotY: Math.PI * 0.5,   c: 0x9FE8FF, e: 0x2E9BC0, label: 'Starting Valley', dest: { x: 24,   z: -128 } },
  { x:  -17, z: -128, rotY: 0,               c: 0xFFC46B, e: 0xB86A10, label: 'Ancient Ruins',   dest: { x: 648,  z: 196 } },
  { x:  650, z:  204, rotY: 0,               c: 0xFFC46B, e: 0xB86A10, label: 'Starting Valley', dest: { x: -24,  z: -128 } },
];

function makeLabelSprite(text, colorHex) {
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 96;
  const cx = cv.getContext('2d');
  cx.font = 'bold 46px Arial, sans-serif';
  cx.textAlign = 'center'; cx.textBaseline = 'middle';
  cx.shadowColor = 'rgba(0,0,0,0.9)'; cx.shadowBlur = 12;
  cx.fillStyle = `#${colorHex.toString(16).padStart(6, '0')}`;
  cx.fillText(`⟶ ${text}`, 256, 48);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false,
  }));
  sp.scale.set(4.6, 0.86, 1);
  sp.position.y = HALF_H * 2 + 0.75;
  return sp;
}

// ── Build one oval portal; returns its group + pulsing surface material ──────
function makePortal(scene, def) {
  const group = new THREE.Group();

  const frameMat = new THREE.MeshPhysicalMaterial({
    color: def.c, emissive: def.e, emissiveIntensity: 2.2, roughness: 0.12, metalness: 0,
  });
  const surfaceMat = new THREE.MeshPhysicalMaterial({
    color: def.c, emissive: def.c, emissiveIntensity: 0.85,
    transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false,
  });

  // Frame — TubeGeometry along a closed oval curve
  const N = 80, pts = [];
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2;
    pts.push(new THREE.Vector3(HALF_W * Math.cos(a), HALF_H + HALF_H * Math.sin(a), 0));
  }
  const path = new THREE.CatmullRomCurve3(pts, true);
  group.add(new THREE.Mesh(new THREE.TubeGeometry(path, 80, 0.065, 8, true), frameMat));

  // Surface — filled oval plane
  const shape = new THREE.Shape();
  shape.ellipse(0, HALF_H, HALF_W, HALF_H, 0, Math.PI * 2, false, 0);
  const surf = new THREE.Mesh(new THREE.ShapeGeometry(shape, 40), surfaceMat);
  surf.position.z = 0.01;
  group.add(surf);

  const glow = new THREE.PointLight(def.c, 2.2, 11);
  glow.position.set(0, HALF_H, 0.6);
  group.add(glow);

  group.add(makeLabelSprite(def.label, def.c));

  group.position.set(def.x, terrainHeight(def.x, def.z), def.z);
  group.rotation.y = def.rotY;
  scene.add(group);
  return surfaceMat;
}

// ── Public factory ────────────────────────────────────────────────────────────
export function createPortals(scene, playerPosition, teleport) {
  const surfMats = DEFS.map(def => makePortal(scene, def));
  const fadeEl   = document.getElementById('fade');

  let cooldown = 0;
  let time     = 0;
  // Warp fade state: null | { t, dest }
  let warp = null;

  function update(dt) {
    time     += dt;
    cooldown  = Math.max(0, cooldown - dt);

    const pulse = 0.65 + 0.40 * Math.sin(time * 2.6);
    for (const m of surfMats) m.emissiveIntensity = pulse;

    // Fade sequence: black out → teleport → fade back in
    if (warp) {
      warp.t += dt;
      if (warp.dest) {
        const k = Math.min(1, warp.t / FADE_OUT);
        if (fadeEl) fadeEl.style.opacity = k;
        if (k >= 1) {
          teleport(warp.dest.x, warp.dest.z);
          warp = { t: 0, dest: null };
        }
      } else {
        const k = Math.min(1, warp.t / FADE_IN);
        if (fadeEl) fadeEl.style.opacity = 1 - k;
        if (k >= 1) warp = null;
      }
      return;
    }

    if (cooldown > 0) return;

    const px = playerPosition.x, pz = playerPosition.z;
    for (const def of DEFS) {
      if (Math.hypot(px - def.x, pz - def.z) < TRIGGER_R) {
        cooldown = COOLDOWN + FADE_OUT + FADE_IN;
        if (fadeEl) warp = { t: 0, dest: def.dest };
        else        teleport(def.dest.x, def.dest.z);   // fallback: instant warp
        break;
      }
    }
  }

  // Nearest portal for the HUD contextual hint
  function getNearest(px, pz) {
    let best = null;
    for (const def of DEFS) {
      const d = Math.hypot(px - def.x, pz - def.z);
      if (!best || d < best.dist) best = { dist: d, label: def.label };
    }
    return best;
  }

  return { update, getNearest };
}
