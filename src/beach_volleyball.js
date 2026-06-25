import * as THREE from 'three';

// Standard beach volleyball: 16 × 8 m playing area
const COURT_L   = 16;
const COURT_W   = 8;
const NET_H     = 2.43;
const POST_H    = 2.55;
const POST_OUT  = 1.0;    // posts 1 m outside each sideline

// 2 court-lengths (32 m) along the shoreline (1,0,1)/√2 from portal B (-480, 0, 575)
const STEP  = COURT_L * Math.SQRT2;   // component per axis ≈ 22.6
const CX    = -480 + STEP;
const CZ    =  575 + STEP;
const ROT_Y = -Math.PI / 4;           // long axis parallel to the shore

const SAND_COLOR   = 0xEDD9A3;   // light cream sand inside the boards
const BOARD_COLOR  = 0xF2F2F2;   // white retaining boards
const POST_COLOR   = 0x2C5FC4;   // blue posts (matches reference image)
const NET_DARK     = 0x2A2A2A;
const NET_WHITE    = 0xEEEEEE;

const BW = 0.15;   // board thickness (m)
const BH = 0.22;   // board height (m)

// ── helpers ──────────────────────────────────────────────────────────────────

function flatPlane(parent, w, d, color, y) {
  const mat = new THREE.MeshLambertMaterial({ color });
  mat.polygonOffset      = true;
  mat.polygonOffsetFactor = -2;
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

function cyl(parent, r, h, color, x, y, z) {
  const m = new THREE.Mesh(
    new THREE.CylinderGeometry(r, r, h, 12),
    new THREE.MeshLambertMaterial({ color }),
  );
  m.position.set(x, y, z);
  m.castShadow    = true;
  m.receiveShadow = false;
  parent.add(m);
}

// ── export ────────────────────────────────────────────────────────────────────

export function buildBeachVolleyballCourt() {
  const g = new THREE.Group();
  g.position.set(CX, 0, CZ);
  g.rotation.y = ROT_Y;

  const GY = 0.155;           // ground y (beach is at 0.15; polygonOffset brings this above it)
  const BY = GY + BH / 2;    // board centre y

  const HL = COURT_L / 2;    // 8
  const HW = COURT_W / 2;    // 4

  // ── Sand surface (inside the boards) ────────────────────────────────────
  flatPlane(g, COURT_L, COURT_W, SAND_COLOR, GY);

  // ── Retaining boards ─────────────────────────────────────────────────────
  // Long sides (run the court length, sit just outside the sidelines)
  box(g, COURT_L,             BH, BW, BOARD_COLOR,  0,           BY,  HW + BW / 2);
  box(g, COURT_L,             BH, BW, BOARD_COLOR,  0,           BY, -(HW + BW / 2));
  // Short ends (span full outer width so corners are filled)
  box(g, BW, BH, COURT_W + 2 * BW, BOARD_COLOR,  HL + BW / 2, BY, 0);
  box(g, BW, BH, COURT_W + 2 * BW, BOARD_COLOR, -(HL + BW / 2), BY, 0);

  // ── Centre line (sand-tone tape / rope) ──────────────────────────────────
  box(g, 0.04, 0.01, COURT_W, 0xC8A84A, 0, GY + 0.006, 0, false);

  // ── Net posts — blue cylinders outside the boards ────────────────────────
  const POZ = HW + POST_OUT;   // ±5
  cyl(g, 0.05, POST_H, POST_COLOR, 0, GY + POST_H / 2,  POZ);
  cyl(g, 0.05, POST_H, POST_COLOR, 0, GY + POST_H / 2, -POZ);

  // ── Net — dark mesh body + white top band ────────────────────────────────
  const NET_SPAN = 2 * POZ;    // 10 m
  const NET_BAND = 0.08;
  const NET_BODY = NET_H - NET_BAND;   // 2.35 m
  box(g, 0.02, NET_BODY, NET_SPAN, NET_DARK,  0, NET_BODY / 2,          0, false);
  box(g, 0.04, NET_BAND, NET_SPAN, NET_WHITE, 0, NET_H - NET_BAND / 2,  0, false);

  return g;
}
