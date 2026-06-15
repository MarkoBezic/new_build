import * as THREE from 'three';

// ════════════════════════════════════════════════════════════════════════════
//  PARAMETERS
// ════════════════════════════════════════════════════════════════════════════
export const BW      = 42;
export const BD      = 28;
export const FLOORS  = 6;
export const FLOOR_H = 4;
export const FASCIA  = 1.3;
export const GLASS_H = FLOOR_H - FASCIA;   // 2.7
export const BH      = FLOORS * FLOOR_H;   // 24
export const PARA_H  = 2.4;
export const CW      = 0.28;               // curtain-wall depth

const MULL    = 0.38;
const NS_BAYS = 9;    // N/S face — full BW = 42
const EW_BAYS = 6;    // E/W face — full BD = 28

// ════════════════════════════════════════════════════════════════════════════
//  MATERIALS
// ════════════════════════════════════════════════════════════════════════════
export const MATS = {
  concrete : new THREE.MeshLambertMaterial({ color: 0xBFB5A2 }),
  glass    : new THREE.MeshPhongMaterial({
               color: 0x1B2D3E, specular: new THREE.Color(0x3A6888),
               shininess: 85, transparent: true, opacity: 0.88,
             }),
  mullion  : new THREE.MeshLambertMaterial({ color: 0x1C1C24 }),
  parapet  : new THREE.MeshLambertMaterial({ color: 0xD0C8B8 }),
  roof     : new THREE.MeshLambertMaterial({ color: 0x9E9A90 }),
  plinth   : new THREE.MeshLambertMaterial({ color: 0xADA49A }),
  entry    : new THREE.MeshLambertMaterial({ color: 0x141418 }),
};

// ════════════════════════════════════════════════════════════════════════════
//  GEOMETRY HELPER
// ════════════════════════════════════════════════════════════════════════════
function box(parent, w, h, d, mat, cx, cy, cz) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(cx, cy, cz);
  m.castShadow    = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

// ════════════════════════════════════════════════════════════════════════════
//  CURTAIN WALL — flat face  (used for S, E, W + internally for N wings)
// ════════════════════════════════════════════════════════════════════════════
function applyFace(scene, orient, coord, outSign, span, numBays) {
  const isNS   = orient === 'NS';
  const panelW = (span - MULL * (numBays + 1)) / numBays;
  const step   = MULL + panelW;
  const wallOff = coord + outSign * CW * 0.5;
  const ft      = CW + 0.10;

  for (let f = 0; f < FLOORS; f++) {
    const base   = f * FLOOR_H;
    const fascY  = base + FASCIA * 0.5;
    const glassY = base + FASCIA + GLASS_H * 0.5;
    const mullY  = base + FLOOR_H * 0.5;

    if (isNS) box(scene, span, FASCIA, ft, MATS.concrete, 0, fascY, coord + outSign * ft * 0.5);
    else       box(scene, ft, FASCIA, span, MATS.concrete, coord + outSign * ft * 0.5, fascY, 0);

    for (let i = 0; i <= numBays; i++) {
      const off  = -span * 0.5 + MULL * 0.5 + i * step;
      const gOff = off + MULL * 0.5 + panelW * 0.5;
      if (isNS) {
        box(scene, MULL, FLOOR_H, CW + 0.06, MATS.mullion, off,  mullY, wallOff);
        if (i < numBays) box(scene, panelW, GLASS_H, CW, MATS.glass, gOff, glassY, wallOff);
      } else {
        box(scene, CW + 0.06, FLOOR_H, MULL, MATS.mullion, wallOff, mullY, off);
        if (i < numBays) box(scene, CW, GLASS_H, panelW, MATS.glass, wallOff, glassY, gOff);
      }
    }
  }

  const pt = CW + 0.12;
  if (isNS) box(scene, span, PARA_H, pt, MATS.parapet, 0,                    BH + PARA_H * 0.5, coord + outSign * pt * 0.5);
  else       box(scene, pt, PARA_H, span, MATS.parapet, coord + outSign * pt * 0.5, BH + PARA_H * 0.5, 0);
}

// ════════════════════════════════════════════════════════════════════════════
//  NORTH FACE — bow-curved centre + flat wings
//  Middle 50 % of BW bows outward 3 units; 25 % flat on each side.
// ════════════════════════════════════════════════════════════════════════════

// Flat NS wing at an x-offset (Group keeps the coordinate maths simple)
function applyFlatNWing(scene, xCenter, span, numBays) {
  const g = new THREE.Group();
  g.position.set(xCenter, 0, 0);
  scene.add(g);

  const Z0     = -BD / 2;          // world z of the north face plane
  const ft     = CW + 0.10;
  const panelW = (span - MULL * (numBays + 1)) / numBays;
  const step   = MULL + panelW;

  for (let f = 0; f < FLOORS; f++) {
    const base = f * FLOOR_H;
    box(g, span, FASCIA, ft, MATS.concrete, 0, base + FASCIA * 0.5, Z0 - ft * 0.5);
    for (let i = 0; i <= numBays; i++) {
      const off  = -span * 0.5 + MULL * 0.5 + i * step;
      const gOff = off + MULL * 0.5 + panelW * 0.5;
      box(g, MULL,   FLOOR_H, CW + 0.06, MATS.mullion, off,  base + FLOOR_H * 0.5,       Z0 - CW * 0.5);
      if (i < numBays)
        box(g, panelW, GLASS_H, CW, MATS.glass,   gOff, base + FASCIA + GLASS_H * 0.5, Z0 - CW * 0.5);
    }
  }
  const pt = CW + 0.12;
  box(g, span, PARA_H, pt, MATS.parapet, 0, BH + PARA_H * 0.5, Z0 - pt * 0.5);
}

// One angled panel of the curved bow; Group's local +Z = outward panel normal
function applyBowPanel(scene, cx, cz, rotY, chord) {
  const g = new THREE.Group();
  g.position.set(cx, 0, cz);
  g.rotation.y = rotY;
  scene.add(g);

  const ft     = CW + 0.10;
  const panelW = chord - MULL * 2;

  for (let f = 0; f < FLOORS; f++) {
    const base = f * FLOOR_H;
    box(g, chord,  FASCIA,  ft,       MATS.concrete, 0,                 base + FASCIA * 0.5,             ft  * 0.5);
    box(g, MULL,   FLOOR_H, CW + 0.06, MATS.mullion, -chord * 0.5 + MULL * 0.5, base + FLOOR_H * 0.5, CW * 0.5);
    box(g, MULL,   FLOOR_H, CW + 0.06, MATS.mullion,  chord * 0.5 - MULL * 0.5, base + FLOOR_H * 0.5, CW * 0.5);
    box(g, panelW, GLASS_H, CW,        MATS.glass,    0,                 base + FASCIA + GLASS_H * 0.5,  CW  * 0.5);
  }
  const pt = CW + 0.12;
  box(g, chord, PARA_H, pt, MATS.parapet, 0, BH + PARA_H * 0.5, pt * 0.5);
}

function buildNorthCurved(scene) {
  const FLAT_HALF = BW * 0.25;   // 10.5  — each flat wing
  const CURVE_X   = BW * 0.25;   // ±10.5 — where curve meets flat
  const BOW       = 3.0;          // units bow forward at centre

  // Circular arc: radius and z-centre derived from half-span and bow
  const R  = (CURVE_X * CURVE_X + BOW * BOW) / (2 * BOW);   // ≈ 19.875
  const ZC = -BD / 2 + R - BOW;                              // ≈  2.875  (inside building)

  // Flat left wing  (x: −21 → −10.5,  centre x = −15.75)
  applyFlatNWing(scene, -(BW / 2 - FLAT_HALF / 2), FLAT_HALF, 2);
  // Flat right wing (x: +10.5 → +21,  centre x = +15.75)
  applyFlatNWing(scene,  (BW / 2 - FLAT_HALF / 2), FLAT_HALF, 2);

  // 5 bow panels spanning −CURVE_X → +CURVE_X
  const N      = 5;
  const tMax   = Math.asin(CURVE_X / R);
  const dTheta = (2 * tMax) / N;
  const chord  = 2 * R * Math.sin(dTheta / 2);

  for (let i = 0; i < N; i++) {
    const theta = -tMax + dTheta * (i + 0.5);
    const cx    = R * Math.sin(theta);
    const cz    = ZC - R * Math.cos(theta);
    const rotY  = Math.PI - theta;          // local +Z = outward at this arc angle
    applyBowPanel(scene, cx, cz, rotY, chord);
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  LOBBY ENTRANCE  (ground-floor centre of north face)
// ════════════════════════════════════════════════════════════════════════════
function buildEntrance(scene) {
  const EW = 10;
  const Z0 = -BD / 2 - CW - 0.14;

  box(scene, EW + 1.6, FLOOR_H,      0.72, MATS.entry,  0, FLOOR_H * 0.5,       Z0 - 0.36);
  box(scene, EW - 1,   FLOOR_H - 0.4, 0.42, MATS.glass,  0, (FLOOR_H - 0.4) * 0.5, Z0 - 0.21);
  box(scene, 0.24, FLOOR_H, 0.44, MATS.mullion, -(EW / 2 - 0.12), FLOOR_H * 0.5, Z0 - 0.22);
  box(scene, 0.24, FLOOR_H, 0.44, MATS.mullion,  (EW / 2 - 0.12), FLOOR_H * 0.5, Z0 - 0.22);
  box(scene, 0.18, FLOOR_H, 0.44, MATS.mullion,  0,                FLOOR_H * 0.5, Z0 - 0.22);

  const CANOPY = 4.5;
  box(scene, EW + 5.5, 0.42, CANOPY, MATS.concrete, 0, FLOOR_H + 0.21, Z0 - CANOPY * 0.5);
  box(scene, EW + 5.1, 0.08, CANOPY - 0.08, MATS.mullion, 0, FLOOR_H, Z0 - CANOPY * 0.5);

  const COL_X = EW / 2 + 1.6;
  box(scene, 0.32, FLOOR_H, 0.32, MATS.mullion, -COL_X, FLOOR_H * 0.5, Z0 - CANOPY + 0.32);
  box(scene, 0.32, FLOOR_H, 0.32, MATS.mullion,  COL_X, FLOOR_H * 0.5, Z0 - CANOPY + 0.32);

  box(scene, EW + 7, 0.22, 4.5, MATS.plinth, 0, 0.11,  Z0 - 2.25);
  box(scene, EW + 5, 0.15, 1.1, MATS.plinth, 0, 0.37,  Z0 - 0.55);
}

// ════════════════════════════════════════════════════════════════════════════
//  SIGNAGE
// ════════════════════════════════════════════════════════════════════════════
function makeSignTex(text, bg = '#BDB5A2', fg = '#1E1C16') {
  const W = 1024, H = 200;
  const cv  = document.createElement('canvas');
  cv.width  = W;  cv.height = H;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = bg;  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = fg;
  ctx.font          = `bold ${Math.round(H * 0.62)}px Georgia,"Times New Roman",serif`;
  ctx.textAlign     = 'center';
  ctx.textBaseline  = 'middle';
  ctx.fillText(text, W / 2, H / 2);
  return new THREE.CanvasTexture(cv);
}

function signPlane(scene, w, h, tex, cx, cy, cz, rotY) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshLambertMaterial({ map: tex }),
  );
  m.position.set(cx, cy, cz);
  m.rotation.y = rotY;
  scene.add(m);
}

function buildSignage(scene) {
  // Camera at x=0 looking south → viewer LEFT = world −X (negative x values)
  const ZN = -BD / 2 - CW - 0.22;
  const XE =  BW / 2 + CW + 0.22;

  // Large "Open Text" — top parapet strip, left side
  // width=11 + cx=-15.5 → right edge at world x=-21 (building edge), left edge at x=-10 (O clear)
  signPlane(scene, 11, 2.0, makeSignTex('Open Text'), -15.5, BH + PARA_H * 0.5, ZN, Math.PI);

  // Smaller "OPEN TEXT" centred above entrance canopy
  signPlane(scene, 9, 1.4, makeSignTex('OPEN TEXT'), 0, FLOOR_H + 3.2, ZN, Math.PI);

  // East-face "OpenText"
  signPlane(scene, 9, 1.5, makeSignTex('OpenText'), XE, 9, 7, -Math.PI / 2);
}

// ════════════════════════════════════════════════════════════════════════════
//  ROOF + PLINTH
// ════════════════════════════════════════════════════════════════════════════
function buildRoof(scene) {
  box(scene, BW + 1, 0.5, BD + 1, MATS.roof, 0, BH + PARA_H + 0.25, 0);
}

function buildPlinth(scene) {
  box(scene, BW + 3, 0.25, BD + 3, MATS.plinth, 0, 0.125, 0);
}

// ════════════════════════════════════════════════════════════════════════════
//  PUBLIC ENTRY
// ════════════════════════════════════════════════════════════════════════════
export function buildBuilding(scene) {
  // Solid concrete core
  box(scene, BW, BH, BD, MATS.concrete, 0, BH * 0.5, 0);

  buildNorthCurved(scene);                             // North — curved bow centre + flat wings
  applyFace(scene, 'NS',  BD / 2, +1, BW, NS_BAYS);   // South — full straight face
  applyFace(scene, 'EW',  BW / 2, +1, BD, EW_BAYS);   // East  — full straight face
  applyFace(scene, 'EW', -BW / 2, -1, BD, EW_BAYS);   // West  — full straight face

  buildEntrance(scene);
  buildSignage(scene);
  buildRoof(scene);
  buildPlinth(scene);
}
