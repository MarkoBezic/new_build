import * as THREE from 'three';

// Boat rests at the beach-stop line (z−x = 1099 ≈ 75% beached for a 3.4 m hull)
export const BOAT_X = -502;
export const BOAT_Z =  597;   // z−x = 1099

// ── Materials — dark hull + prominent light birch rails (Minecraft-style) ────
const HULL_MAT  = new THREE.MeshLambertMaterial({ color: 0x6B3E12 }); // dark oak
const PLANK_MAT = new THREE.MeshLambertMaterial({ color: 0x8C5E20 }); // wall planks
const RAIL_MAT  = new THREE.MeshLambertMaterial({ color: 0xD8C890 }); // light birch rail

function box(parent, w, h, d, mat, cx, cy, cz) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(cx, cy, cz);
  m.castShadow = true; m.receiveShadow = true;
  parent.add(m);
}

function buildMesh() {
  const g = new THREE.Group();

  const BW = 1.6;   // boat width
  const BL = 3.4;   // hull length
  const WT = 0.08;  // wall thickness
  const BH = 0.38;  // wall height  (hull floor is at 0, top of walls at 0.38)
  const GW = 0.22;  // gunwale width (overhangs hull outward)
  const GH = 0.10;  // gunwale height

  // ── Hull floor ──────────────────────────────────────────────────────────────
  box(g, BW, 0.08, BL, HULL_MAT, 0, 0.04, 0);

  // ── Side walls ─────────────────────────────────────────────────────────────
  box(g, WT, BH, BL, PLANK_MAT, -(BW/2 - WT/2), BH/2, 0);  // port
  box(g, WT, BH, BL, PLANK_MAT,  (BW/2 - WT/2), BH/2, 0);  // starboard

  // ── Bow and stern end walls ────────────────────────────────────────────────
  box(g, BW, BH, WT, PLANK_MAT, 0, BH/2, -(BL/2 - WT/2));
  box(g, BW, BH, WT, PLANK_MAT, 0, BH/2,  (BL/2 - WT/2));

  // ── Gunwales — the most prominent visual element; wide birch rails ─────────
  const gy = BH + GH / 2;
  const RL = BL + GW * 2;  // rail length (overhangs both ends)
  const RW = BW + GW * 2;  // rail cap width (overhangs both sides)
  box(g, GW, GH, RL, RAIL_MAT,  (BW/2 + GW/2), gy, 0);   // starboard rail
  box(g, GW, GH, RL, RAIL_MAT, -(BW/2 + GW/2), gy, 0);   // port rail
  box(g, RW, GH, GW, RAIL_MAT, 0, gy, -(BL/2 + GW/2));   // bow cap
  box(g, RW, GH, GW, RAIL_MAT, 0, gy,  (BL/2 + GW/2));   // stern cap

  // ── Thwart (seat plank) ────────────────────────────────────────────────────
  box(g, BW - WT * 2 - 0.06, 0.06, 0.28, PLANK_MAT, 0, BH + 0.03, 0);

  return g;
}

export function createBoat(scene) {
  const mesh = buildMesh();
  // Bow faces sea direction (−x, +z) — pressing W sails out, S returns to shore
  const initialYaw = Math.PI * 0.75;
  mesh.rotation.y = initialYaw;
  mesh.position.set(BOAT_X, 0.15, BOAT_Z);
  scene.add(mesh);
  return { x: BOAT_X, z: BOAT_Z, yaw: initialYaw, mesh };
}
