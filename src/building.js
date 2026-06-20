import * as THREE from 'three';

// ════════════════════════════════════════════════════════════════════════════
//  PARAMETERS
// ════════════════════════════════════════════════════════════════════════════
export const BW      = 42;
export const BD      = 42;
export const FLOORS  = 6;
export const FLOOR_H = 4;
export const FASCIA  = 1.3;
export const GLASS_H = FLOOR_H - FASCIA;   // 2.7
export const BH      = FLOORS * FLOOR_H;   // 24
export const PARA_H  = 2.4;
export const CW      = 0.28;               // curtain-wall depth

const MULL = 0.38;
const BOW  = 3.0;   // how far each bow protrudes outward

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
//  FLAT WING HELPERS
//  The bow on each face is flanked by two flat curtain-wall wings.
// ════════════════════════════════════════════════════════════════════════════

// Wing on an NS face — spans along X, group offset at xCenter.
// faceZ   : world Z of the face plane (−BD/2 north, +BD/2 south)
// outSign : −1 (north) or +1 (south)
function applyFlatNSWing(scene, xCenter, span, numBays, faceZ, outSign) {
  const g = new THREE.Group();
  g.position.set(xCenter, 0, 0);
  scene.add(g);

  const ft     = CW + 0.10;
  const panelW = (span - MULL * (numBays + 1)) / numBays;
  const step   = MULL + panelW;

  for (let f = 0; f < FLOORS; f++) {
    const base = f * FLOOR_H;
    box(g, span, FASCIA, ft, MATS.concrete, 0, base + FASCIA * 0.5, faceZ + outSign * ft * 0.5);
    for (let i = 0; i <= numBays; i++) {
      const off  = -span * 0.5 + MULL * 0.5 + i * step;
      const gOff = off + MULL * 0.5 + panelW * 0.5;
      box(g, MULL,   FLOOR_H, CW + 0.06, MATS.mullion, off,  base + FLOOR_H * 0.5,             faceZ + outSign * CW * 0.5);
      if (i < numBays)
        box(g, panelW, GLASS_H, CW,        MATS.glass,   gOff, base + FASCIA + GLASS_H * 0.5, faceZ + outSign * CW * 0.5);
    }
  }
  const pt = CW + 0.12;
  box(g, span, PARA_H, pt, MATS.parapet, 0, BH + PARA_H * 0.5, faceZ + outSign * pt * 0.5);
}

// Wing on an EW face — spans along Z, group offset at zCenter.
// faceX   : world X of the face plane (+BW/2 east, −BW/2 west)
// outSign : +1 (east) or −1 (west)
function applyFlatEWWing(scene, zCenter, span, numBays, faceX, outSign) {
  const g = new THREE.Group();
  g.position.set(0, 0, zCenter);
  scene.add(g);

  const ft     = CW + 0.10;
  const panelW = (span - MULL * (numBays + 1)) / numBays;
  const step   = MULL + panelW;

  for (let f = 0; f < FLOORS; f++) {
    const base = f * FLOOR_H;
    box(g, ft, FASCIA, span, MATS.concrete, faceX + outSign * ft * 0.5, base + FASCIA * 0.5, 0);
    for (let i = 0; i <= numBays; i++) {
      const off  = -span * 0.5 + MULL * 0.5 + i * step;
      const gOff = off + MULL * 0.5 + panelW * 0.5;
      box(g, CW + 0.06, FLOOR_H, MULL,   MATS.mullion, faceX + outSign * CW * 0.5, base + FLOOR_H * 0.5,             off);
      if (i < numBays)
        box(g, CW,        GLASS_H, panelW, MATS.glass,   faceX + outSign * CW * 0.5, base + FASCIA + GLASS_H * 0.5, gOff);
    }
  }
  const pt = CW + 0.12;
  box(g, pt, PARA_H, span, MATS.parapet, faceX + outSign * pt * 0.5, BH + PARA_H * 0.5, 0);
}

// ════════════════════════════════════════════════════════════════════════════
//  BOW PANEL — one angled facet of the curved section.
//  The group's local +Z points outward (away from the building).
// ════════════════════════════════════════════════════════════════════════════
function applyBowPanel(scene, cx, cz, rotY, chord) {
  const g = new THREE.Group();
  g.position.set(cx, 0, cz);
  g.rotation.y = rotY;
  scene.add(g);

  const ft     = CW + 0.10;
  const panelW = chord - MULL * 2;

  for (let f = 0; f < FLOORS; f++) {
    const base = f * FLOOR_H;
    box(g, chord,  FASCIA,  ft,        MATS.concrete, 0,                          base + FASCIA * 0.5,            ft  * 0.5);
    box(g, MULL,   FLOOR_H, CW + 0.06, MATS.mullion, -chord * 0.5 + MULL * 0.5, base + FLOOR_H * 0.5,            CW  * 0.5);
    box(g, MULL,   FLOOR_H, CW + 0.06, MATS.mullion,  chord * 0.5 - MULL * 0.5, base + FLOOR_H * 0.5,            CW  * 0.5);
    box(g, panelW, GLASS_H, CW,        MATS.glass,    0,                          base + FASCIA + GLASS_H * 0.5, CW  * 0.5);
  }
  const pt = CW + 0.12;
  box(g, chord, PARA_H, pt, MATS.parapet, 0, BH + PARA_H * 0.5, pt * 0.5);
}

// ════════════════════════════════════════════════════════════════════════════
//  CURVED FACE BUILDERS
// ════════════════════════════════════════════════════════════════════════════

// NS face — middle 50 % of BW bows outward by BOW units.
// north: faceZ = −BD/2, outSign = −1
// south: faceZ = +BD/2, outSign = +1
function buildCurvedNSFace(scene, faceZ, outSign) {
  const FLAT_HALF = BW * 0.25;   // 10.5 — each flat wing
  const CURVE_X   = BW * 0.25;   // ±10.5 — where curve meets wing

  const R  = (CURVE_X * CURVE_X + BOW * BOW) / (2 * BOW);   // ≈ 19.875
  const ZC = faceZ - outSign * (R - BOW);                    // arc centre

  applyFlatNSWing(scene, -(BW / 2 - FLAT_HALF / 2), FLAT_HALF, 2, faceZ, outSign);
  applyFlatNSWing(scene,  (BW / 2 - FLAT_HALF / 2), FLAT_HALF, 2, faceZ, outSign);

  const N      = 5;
  const tMax   = Math.asin(CURVE_X / R);
  const dTheta = (2 * tMax) / N;
  const chord  = 2 * R * Math.sin(dTheta / 2);

  for (let i = 0; i < N; i++) {
    const theta = -tMax + dTheta * (i + 0.5);
    const cx    = R * Math.sin(theta);
    const cz    = ZC + outSign * R * Math.cos(theta);
    const rotY  = Math.atan2(Math.sin(theta), outSign * Math.cos(theta));
    applyBowPanel(scene, cx, cz, rotY, chord);
  }
}

// EW face — middle 50 % of BD bows outward by BOW units.
// east: faceX = +BW/2, outSign = +1
// west: faceX = −BW/2, outSign = −1
function buildCurvedEWFace(scene, faceX, outSign) {
  const FLAT_HALF = BD * 0.25;   // 7 — each flat wing
  const CURVE_Z   = BD * 0.25;   // ±7 — where curve meets wing

  const R  = (CURVE_Z * CURVE_Z + BOW * BOW) / (2 * BOW);   // ≈ 9.667
  const XC = faceX - outSign * (R - BOW);                    // arc centre

  applyFlatEWWing(scene, -(BD / 2 - FLAT_HALF / 2), FLAT_HALF, 2, faceX, outSign);
  applyFlatEWWing(scene,  (BD / 2 - FLAT_HALF / 2), FLAT_HALF, 2, faceX, outSign);

  const N      = 5;
  const tMax   = Math.asin(CURVE_Z / R);
  const dTheta = (2 * tMax) / N;
  const chord  = 2 * R * Math.sin(dTheta / 2);

  for (let i = 0; i < N; i++) {
    const theta = -tMax + dTheta * (i + 0.5);
    const cz    = R * Math.sin(theta);
    const cx    = XC + outSign * R * Math.cos(theta);
    const rotY  = Math.atan2(outSign * Math.cos(theta), Math.sin(theta));
    applyBowPanel(scene, cx, cz, rotY, chord);
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  LOBBY ENTRANCE  (ground-floor centre of north face)
// ════════════════════════════════════════════════════════════════════════════
function buildEntrance(scene) {
  const EW = 10;
  const Z0 = -BD / 2 - CW - 0.14;

  box(scene, EW + 1.6, FLOOR_H,       0.72, MATS.entry,  0,             FLOOR_H * 0.5,        Z0 - 0.36);
  box(scene, EW - 1,   FLOOR_H - 0.4, 0.42, MATS.glass,  0,             (FLOOR_H - 0.4) * 0.5, Z0 - 0.21);
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
  const ZN = -BD / 2 - CW - 0.22;
  const XE =  BW / 2 + CW + 0.22;

  signPlane(scene, 11, 2.0, makeSignTex('Open Text'), -15.5, BH + PARA_H * 0.5, ZN, Math.PI);
  signPlane(scene, 9,  1.4, makeSignTex('OPEN TEXT'),  0,    FLOOR_H + 3.2,     ZN, Math.PI);
  signPlane(scene, 9,  1.5, makeSignTex('OpenText'),   XE,   9, 7, -Math.PI / 2);
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
export function buildBuilding() {
  const group = new THREE.Group();

  box(group, BW, BH, BD, MATS.concrete, 0, BH * 0.5, 0);

  buildCurvedNSFace(group, -BD / 2, -1);   // North — bow faces outward (−Z)
  buildCurvedNSFace(group, +BD / 2, +1);   // South — bow faces outward (+Z)
  buildCurvedEWFace(group, +BW / 2, +1);   // East  — bow faces outward (+X)
  buildCurvedEWFace(group, -BW / 2, -1);   // West  — bow faces outward (−X)

  buildEntrance(group);
  buildSignage(group);
  buildRoof(group);
  buildPlinth(group);
  return group;
}
