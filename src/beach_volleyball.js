import * as THREE from 'three';

// Official beach volleyball: 16 × 8 m playing area
const COURT_L  = 16;
const COURT_W  = 8;
const NET_H    = 2.43;   // net top (men's)
const POST_H   = 2.55;   // posts extend above net
const POST_OUT = 1.0;    // posts 1 m outside each sideline

// Portal B is at world (-480, 0, 575) on the diagonal beach strip (z−x=1055).
// The shoreline runs along (1,0,1)/√2, so 2 court-lengths (32 m) in that
// direction gives each axis component: 32 / √2 = 16√2.
const STEP = COURT_L * Math.SQRT2;   // 32/√2 per axis ≈ 22.6
const CX   = -480 + STEP;            // ≈ -457.4
const CZ   =  575 + STEP;            // ≈  597.6
const ROT_Y = -Math.PI / 4;          // long axis parallel to shoreline

function flatPlane(parent, w, d, color, y) {
  const mat = new THREE.MeshLambertMaterial({ color });
  mat.polygonOffset      = true;
  mat.polygonOffsetFactor = -1;
  mat.polygonOffsetUnits  = -4;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
  m.rotation.x    = -Math.PI / 2;
  m.position.y    = y;
  m.receiveShadow = true;
  parent.add(m);
}

function box(parent, w, h, d, color, x, y, z, cast = true) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color }),
  );
  m.position.set(x, y, z);
  m.castShadow    = cast;
  m.receiveShadow = true;
  parent.add(m);
}

export function buildBeachVolleyballCourt() {
  const g = new THREE.Group();
  g.position.set(CX, 0, CZ);
  g.rotation.y = ROT_Y;

  // Sand base with free zone (beach is at y=0.15; polygonOffset floats this on top)
  flatPlane(g, COURT_L + 6, COURT_W + 6, 0xDCC87A, 0.155);

  // White boundary and center lines
  const LY = 0.16;
  const LW = 0.05;
  box(g, COURT_L, 0.01, LW, 0xFFFFFF,  0,            LY,  COURT_W / 2);  // far sideline
  box(g, COURT_L, 0.01, LW, 0xFFFFFF,  0,            LY, -COURT_W / 2);  // near sideline
  box(g, LW, 0.01, COURT_W, 0xFFFFFF, -COURT_L / 2,  LY,  0);            // left end line
  box(g, LW, 0.01, COURT_W, 0xFFFFFF,  COURT_L / 2,  LY,  0);            // right end line
  box(g, LW, 0.01, COURT_W, 0xFFFFFF,  0,            LY,  0);             // center line

  // Net posts (1 m outside each sideline, on the center x=0)
  const POZ = COURT_W / 2 + POST_OUT;   // ±5 m
  box(g, 0.10, POST_H, 0.10, 0xC0C0C0, 0, POST_H / 2,  POZ);
  box(g, 0.10, POST_H, 0.10, 0xC0C0C0, 0, POST_H / 2, -POZ);

  // Net: dark mesh body + white top band
  const NET_SPAN = 2 * POZ;          // 10 m between posts
  const NET_BAND = 0.08;
  const NET_BODY = NET_H - NET_BAND;  // 2.35 m
  box(g, 0.02, NET_BODY, NET_SPAN, 0x2A2A2A, 0, NET_BODY / 2,          0, false);
  box(g, 0.04, NET_BAND, NET_SPAN, 0xEEEEEE, 0, NET_H - NET_BAND / 2,  0, false);

  return g;
}
