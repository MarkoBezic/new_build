import * as THREE from 'three';

// ── Materials ─────────────────────────────────────────────────────────────────
const SKIN  = new THREE.MeshLambertMaterial({ color: 0xD4956A });
const HAIR  = new THREE.MeshLambertMaterial({ color: 0x3A2210 });
const BEARD = new THREE.MeshLambertMaterial({ color: 0xBF4020 });
const SHIRT = new THREE.MeshLambertMaterial({ color: 0x252525 });
const PANTS = new THREE.MeshLambertMaterial({ color: 0x4B5E28 });
const SHOE  = new THREE.MeshLambertMaterial({ color: 0x0E0E0E });
const SOLE  = new THREE.MeshLambertMaterial({ color: 0xEEEEEE });
const EYE   = new THREE.MeshLambertMaterial({ color: 0x1E1008 });

function b(p, w, h, d, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  p.add(m);
  return m;
}

function s(p, r, mat, x, y, z, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), mat);
  m.scale.set(sx, sy, sz);
  m.position.set(x, y, z);
  p.add(m);
  return m;
}

// ── Character mesh ────────────────────────────────────────────────────────────
// Clay / chibi proportions: head ≈ 1/3 of total height (~1.85 units).
// Front of character faces −Z (Three.js default).
//
// Vertical stack (bottom → top):
//   sole   0.00 – 0.02
//   shoe   0.02 – 0.07
//   legs   0.07 – 0.59   (centre 0.33)
//   torso  0.59 – 1.07   (centre 0.83)
//   neck   1.07 – 1.19   (centre 1.13)
//   head   centre 1.52   (r 0.30 × sy 1.10 → top ≈ 1.85)
function buildCharacter() {
  const root = new THREE.Group();

  // ── Shoes ─────────────────────────────────────────────────────────────────
  for (const sx of [-1, 1]) {
    b(root, 0.175, 0.068, 0.30, SHOE, sx * 0.095, 0.044, 0.010);   // upper
    b(root, 0.175, 0.022, 0.30, SOLE, sx * 0.095, 0.011, 0.010);   // white sole
    b(root, 0.080, 0.048, 0.04, SOLE, sx * 0.095, 0.044, -0.140);  // white toe cap
  }

  // ── Legs (pants) ──────────────────────────────────────────────────────────
  b(root, 0.165, 0.52, 0.185, PANTS, -0.095, 0.33, 0);
  b(root, 0.165, 0.52, 0.185, PANTS,  0.095, 0.33, 0);

  // ── Torso ─────────────────────────────────────────────────────────────────
  b(root, 0.46, 0.48, 0.26, SHIRT, 0, 0.83, 0);
  // Chest pocket (character's left breast)
  b(root, 0.105, 0.085, 0.026, SHIRT, -0.12, 0.93, -0.13);
  // Shirt collar — two small angled tabs at neckline
  b(root, 0.08, 0.06, 0.028, SHIRT, -0.04, 1.10, -0.115);
  b(root, 0.08, 0.06, 0.028, SHIRT,  0.04, 1.10, -0.115);

  // ── Arms (pivot at shoulder top) ──────────────────────────────────────────
  const leftArm = new THREE.Group();
  leftArm.position.set(-0.285, 1.06, 0);
  root.add(leftArm);
  b(leftArm, 0.135, 0.44, 0.135, SHIRT, 0, -0.22, 0);
  s(leftArm, 0.066, SKIN, 0, -0.47, 0);

  const rightArm = new THREE.Group();   // animated for wave
  rightArm.position.set(0.285, 1.06, 0);
  root.add(rightArm);
  b(rightArm, 0.135, 0.44, 0.135, SHIRT, 0, -0.22, 0);
  s(rightArm, 0.066, SKIN, 0, -0.47, 0);

  // ── Neck ──────────────────────────────────────────────────────────────────
  b(root, 0.115, 0.13, 0.115, SKIN, 0, 1.13, 0);

  // ── Head — deliberately oversized for clay/chibi look ────────────────────
  s(root, 0.30, SKIN, 0, 1.52, 0, 1.0, 1.10, 0.91);

  // ── Hair — side-swept (parted left, more volume on left side) ────────────
  s(root, 0.29, HAIR,  -0.03, 1.70,  0.01, 1.06, 0.62, 0.94);  // flat top mass
  s(root, 0.16, HAIR,  -0.24, 1.53,  0.06, 1.0,  0.82, 0.96);  // left side (fuller)
  s(root, 0.13, HAIR,   0.24, 1.53,  0.06, 0.90, 0.78, 0.92);  // right side (thinner)
  s(root, 0.20, HAIR,   0,    1.49,  0.15, 1.02, 0.88, 0.76);  // back
  s(root, 0.10, HAIR,   0.07, 1.77, -0.10, 1.15, 0.60, 0.82);  // front swoop detail

  // ── Beard — full auburn, covering lower two-thirds of face ────────────────
  s(root, 0.195, BEARD,  0,     1.34, -0.16, 1.20, 0.92, 0.88);  // chin mass
  s(root, 0.145, BEARD, -0.18,  1.43, -0.15, 1.0,  0.88, 0.86);  // left cheek
  s(root, 0.145, BEARD,  0.18,  1.43, -0.15, 1.0,  0.88, 0.86);  // right cheek
  s(root, 0.090, BEARD,  0,     1.53, -0.235, 1.28, 0.60, 0.70); // moustache
  // Under-chin fill to close the bottom of the beard
  s(root, 0.12,  BEARD,  0,     1.29, -0.06, 1.15, 0.70, 1.0);

  // ── Eyes ──────────────────────────────────────────────────────────────────
  s(root, 0.038, EYE, -0.10, 1.57, -0.255);
  s(root, 0.038, EYE,  0.10, 1.57, -0.255);

  // ── Eyebrows (thick, dark) ────────────────────────────────────────────────
  b(root, 0.085, 0.022, 0.016, HAIR, -0.10, 1.655, -0.258);
  b(root, 0.085, 0.022, 0.016, HAIR,  0.10, 1.655, -0.258);

  root.traverse(m => {
    if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; }
  });

  return { root, rightArm };
}

// ── State machine ─────────────────────────────────────────────────────────────
const IDLE    = 0;
const TURNING = 1;   // rotating to face player
const WAVING  = 2;   // arm wave
const LEAVING = 3;   // rotating 75° away
const DONE    = 4;

const TRIGGER_DIST  = 14;   // units — greet when player is this close
const WAVE_DURATION = 3.2;  // seconds
const TURN_SPEED    = 2.2;  // rad / s

function angleDiff(from, to) {
  let d = to - from;
  while (d >  Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

export function createNPC(scene) {
  const { root, rightArm } = buildCharacter();

  // Placed in the lobby, initially facing into the building (south = +Z)
  root.position.set(0, 0, -8);
  root.rotation.y = Math.PI;
  scene.add(root);

  let state      = IDLE;
  let timer      = 0;
  let faceAngle  = Math.PI;
  let leaveAngle = Math.PI;

  function update(dt, playerPos) {
    const dx   = playerPos.x - root.position.x;
    const dz   = playerPos.z - root.position.z;
    const dist = Math.hypot(dx, dz);

    // ── IDLE: wait for player to enter the building ──────────────────────────
    if (state === IDLE) {
      // z > −20 confirms the player is through the north entrance
      if (dist < TRIGGER_DIST && playerPos.z > -20) {
        faceAngle  = Math.atan2(-dx, -dz);
        // Turn 75° to character's own right after waving
        leaveAngle = faceAngle - (75 * Math.PI / 180);
        state = TURNING;
        timer = 0;
      }

    // ── TURNING: rotate smoothly to face player ───────────────────────────────
    } else if (state === TURNING) {
      const diff = angleDiff(root.rotation.y, faceAngle);
      if (Math.abs(diff) < 0.04) {
        root.rotation.y = faceAngle;
        state = WAVING;
        timer = 0;
      } else {
        root.rotation.y += Math.sign(diff) * Math.min(Math.abs(diff), TURN_SPEED * dt);
      }

    // ── WAVING: arm raises then oscillates, fades down at the end ────────────
    } else if (state === WAVING) {
      timer += dt;
      const rampUp   = Math.min(timer / 0.45, 1.0);
      const rampDown = Math.max(0, 1.0 - Math.max(timer - (WAVE_DURATION - 0.5), 0) / 0.5);
      const envelope = rampUp * rampDown;
      // rotation.z negative = clockwise from front = arm lifts outward to the right
      rightArm.rotation.z = -(Math.PI * 0.50 + 0.22 * Math.sin(timer * 5.0)) * envelope;

      if (timer >= WAVE_DURATION) {
        rightArm.rotation.z = 0;
        state = LEAVING;
        timer = 0;
      }

    // ── LEAVING: rotate 75° away and stop ────────────────────────────────────
    } else if (state === LEAVING) {
      const diff = angleDiff(root.rotation.y, leaveAngle);
      if (Math.abs(diff) < 0.04) {
        root.rotation.y = leaveAngle;
        state = DONE;
      } else {
        root.rotation.y += Math.sign(diff) * Math.min(Math.abs(diff), TURN_SPEED * dt);
      }
    }
  }

  return { update };
}
