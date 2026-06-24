import * as THREE from 'three';

// ── Materials ─────────────────────────────────────────────────────────────────
const SKIN  = new THREE.MeshLambertMaterial({ color: 0xD4956A });
const HAIR  = new THREE.MeshLambertMaterial({ color: 0x2C1A0C });
const BEARD = new THREE.MeshLambertMaterial({ color: 0xB03A18 });
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
// Total height ≈ 1.75 world units.  Front of character faces −Z (Three.js default).
function buildCharacter() {
  const root = new THREE.Group();

  // ── Shoes ─────────────────────────────────────────────────────────────────
  for (const sx of [-1, 1]) {
    b(root, 0.16,  0.062, 0.27, SHOE, sx * 0.09, 0.038, 0.005);
    b(root, 0.16,  0.024, 0.27, SOLE, sx * 0.09, 0.012, 0.005);
  }

  // ── Legs ──────────────────────────────────────────────────────────────────
  b(root, 0.155, 0.58, 0.175, PANTS, -0.09, 0.39, 0);
  b(root, 0.155, 0.58, 0.175, PANTS,  0.09, 0.39, 0);

  // ── Torso ─────────────────────────────────────────────────────────────────
  b(root, 0.43, 0.56, 0.24, SHIRT, 0, 0.98, 0);
  b(root, 0.10, 0.08, 0.025, SHIRT, -0.115, 1.07, -0.12);  // chest pocket

  // ── Left arm (stationary) ─────────────────────────────────────────────────
  const leftArm = new THREE.Group();
  leftArm.position.set(-0.265, 1.09, 0);
  root.add(leftArm);
  b(leftArm, 0.125, 0.46, 0.125, SHIRT, 0, -0.23, 0);
  s(leftArm, 0.062, SKIN, 0, -0.50, 0);

  // ── Right arm (animated for wave, pivot at shoulder) ──────────────────────
  const rightArm = new THREE.Group();
  rightArm.position.set(0.265, 1.09, 0);
  root.add(rightArm);
  b(rightArm, 0.125, 0.46, 0.125, SHIRT, 0, -0.23, 0);
  s(rightArm, 0.062, SKIN, 0, -0.50, 0);

  // ── Neck ──────────────────────────────────────────────────────────────────
  b(root, 0.105, 0.12, 0.105, SKIN, 0, 1.33, 0);

  // ── Head ──────────────────────────────────────────────────────────────────
  s(root, 0.190, SKIN, 0, 1.525, 0, 1.0, 1.1, 0.94);

  // ── Hair ──────────────────────────────────────────────────────────────────
  s(root, 0.185, HAIR,  0,     1.565,  0.01, 1.02, 0.70, 0.96);  // top
  s(root, 0.115, HAIR, -0.15,  1.530,  0.05, 1.0,  0.86, 1.0);   // left
  s(root, 0.115, HAIR,  0.15,  1.530,  0.05, 1.0,  0.86, 1.0);   // right
  s(root, 0.135, HAIR,  0,     1.510,  0.12, 1.02, 0.90, 0.80);  // back

  // ── Beard ─────────────────────────────────────────────────────────────────
  s(root, 0.125, BEARD,  0,     1.435, -0.095, 1.12, 0.84, 0.90); // chin
  s(root, 0.078, BEARD, -0.11,  1.470, -0.095, 1.0,  0.86, 0.88); // left cheek
  s(root, 0.078, BEARD,  0.11,  1.470, -0.095, 1.0,  0.86, 0.88); // right cheek
  s(root, 0.058, BEARD,  0,     1.528, -0.148, 1.1,  0.65, 0.75); // moustache

  // ── Eyes ──────────────────────────────────────────────────────────────────
  s(root, 0.032, EYE, -0.068, 1.560, -0.176);
  s(root, 0.032, EYE,  0.068, 1.560, -0.176);

  // ── Eyebrows ──────────────────────────────────────────────────────────────
  b(root, 0.068, 0.016, 0.012, HAIR, -0.068, 1.615, -0.178);
  b(root, 0.068, 0.016, 0.012, HAIR,  0.068, 1.615, -0.178);

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
