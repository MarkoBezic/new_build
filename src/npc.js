import * as THREE from 'three';

// ── Material factory — MeshPhysicalMaterial for smooth matte clay ─────────────
function mat(color, roughness = 0.88, opts = {}) {
  return new THREE.MeshPhysicalMaterial({ color, roughness, metalness: 0, ...opts });
}

const SKIN    = mat(0xD4956A, 0.85, { sheen: 0.12, sheenColor: new THREE.Color(0xE8B09A), sheenRoughness: 0.85 });
const SCLERA  = mat(0xF4EFE6, 0.45);
const IRIS    = mat(0x8B6B3D, 0.22);
const PUPIL   = mat(0x060404, 0.10);
const HAIR    = mat(0x3A2210, 0.92);
const SHIRT   = mat(0x1E1E1E, 0.95, { sheen: 0.08, sheenColor: new THREE.Color(0x333333), sheenRoughness: 0.92 });
const PANTS   = mat(0x4B5E28, 0.90);
const BOOT    = mat(0xCC2200, 0.72, { polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 });
const SOLE    = mat(0x1A1A1A, 0.85, { polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 });
const EYEBROW = mat(0x2A1A0A, 0.92);

// ── Geometry helpers ──────────────────────────────────────────────────────────
function b(p, w, h, d, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  p.add(m);
  return m;
}

function s(p, r, mat, x, y, z, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), mat);
  m.scale.set(sx, sy, sz);
  m.position.set(x, y, z);
  p.add(m);
  return m;
}

function c(p, r, h, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, h, 5, 10), mat);
  m.position.set(x, y, z);
  p.add(m);
  return m;
}

// ── Character mesh ────────────────────────────────────────────────────────────
// Vertical stack (bottom → top):
//   sole   0.00 – 0.02
//   shoe   0.02 – 0.12
//   legs   0.12 – 0.59  (centre 0.33)
//   torso  0.59 – 1.07  (centre 0.83)
//   neck   1.07 – 1.20  (centre 1.13)
//   head   centre 1.52  (r 0.30 × sy 1.10 → top ≈ 1.85)
function buildCharacter() {
  const root = new THREE.Group();

  // ── Boots (mid-calf red) ──────────────────────────────────────────────────
  for (const sx of [-1, 1]) {
    b(root, 0.185, 0.260, 0.295, BOOT, sx * 0.095,  0.140,  0.006);  // shaft
    b(root, 0.195, 0.024, 0.330, SOLE, sx * 0.095,  0.012,  0.006);  // rubber sole
    b(root, 0.195, 0.060, 0.050, SOLE, sx * 0.095,  0.040, -0.158);  // toe cap
  }

  // ── Legs ──────────────────────────────────────────────────────────────────
  c(root, 0.082, 0.36, PANTS, -0.095, 0.33, 0);
  c(root, 0.082, 0.36, PANTS,  0.095, 0.33, 0);
  b(root, 0.120, 0.090, 0.165, PANTS, 0, 0.577, 0);  // crotch bridge

  // ── Torso ─────────────────────────────────────────────────────────────────
  b(root, 0.46, 0.48, 0.26, SHIRT, 0, 0.83, 0);
  b(root, 0.105, 0.085, 0.026, SHIRT, -0.120, 0.930, -0.131);  // chest pocket

  // ── Arms — rolled sleeves expose forearms ─────────────────────────────────
  const leftArm = new THREE.Group();
  leftArm.position.set(-0.285, 1.06, 0);
  root.add(leftArm);
  c(leftArm, 0.062, 0.21, SHIRT, 0, -0.120, 0);           // upper sleeve
  b(leftArm, 0.145, 0.030, 0.145, SHIRT, 0, -0.268, 0);   // rolled cuff
  c(leftArm, 0.052, 0.10, SKIN,  0, -0.380, 0);            // forearm
  s(leftArm, 0.066, SKIN, 0, -0.492, 0);                   // hand
  s(root, 0.076, SHIRT, -0.285, 1.065, 0);                 // shoulder cap

  const rightArm = new THREE.Group();                       // animated for wave
  rightArm.position.set(0.285, 1.06, 0);
  root.add(rightArm);
  c(rightArm, 0.062, 0.21, SHIRT, 0, -0.120, 0);          // upper sleeve
  b(rightArm, 0.145, 0.030, 0.145, SHIRT, 0, -0.268, 0);  // rolled cuff
  c(rightArm, 0.052, 0.10, SKIN,  0, -0.380, 0);           // forearm
  s(rightArm, 0.066, SKIN, 0, -0.492, 0);                  // hand
  s(root, 0.076, SHIRT, 0.285, 1.065, 0);                  // shoulder cap

  // ── Neck ──────────────────────────────────────────────────────────────────
  c(root, 0.052, 0.06, SKIN, 0, 1.140, 0);

  // ── Head ──────────────────────────────────────────────────────────────────
  s(root, 0.30, SKIN, 0, 1.52, 0, 1.0, 1.10, 0.92);

  // ── Ears ──────────────────────────────────────────────────────────────────
  s(root, 0.055, SKIN, -0.296, 1.520,  0.018, 0.74, 1.06, 0.50);
  s(root, 0.055, SKIN,  0.296, 1.520,  0.018, 0.74, 1.06, 0.50);

  // ── Nose + nostrils ───────────────────────────────────────────────────────
  s(root, 0.052, SKIN,  0.000, 1.474, -0.265, 0.82, 0.68, 1.12);
  s(root, 0.026, SKIN, -0.032, 1.458, -0.274, 1.15, 0.72, 0.90);
  s(root, 0.026, SKIN,  0.032, 1.458, -0.274, 1.15, 0.72, 0.90);

  // ── Eyes — sclera + iris + pupil ──────────────────────────────────────────
  for (const ex of [-0.105, 0.105]) {
    s(root, 0.055, SCLERA, ex, 1.575, -0.252, 1.0, 0.88, 0.78);  // white
    s(root, 0.040, IRIS,   ex, 1.575, -0.268, 1.0, 0.88, 0.65);  // iris
    s(root, 0.024, PUPIL,  ex, 1.575, -0.278, 1.0, 0.88, 0.60);  // pupil
  }

  // ── Eyebrows ──────────────────────────────────────────────────────────────
  b(root, 0.092, 0.020, 0.018, EYEBROW, -0.105, 1.658, -0.256);
  b(root, 0.092, 0.020, 0.018, EYEBROW,  0.105, 1.658, -0.256);

  // ── Hair — side-swept, parted left ────────────────────────────────────────
  s(root, 0.298, HAIR, -0.030, 1.710,  0.010, 1.07, 0.60, 0.94);  // top mass
  s(root, 0.178, HAIR, -0.250, 1.540,  0.055, 1.00, 0.85, 0.90);  // left main
  s(root, 0.132, HAIR, -0.270, 1.625,  0.020, 0.92, 0.75, 0.85);  // left upper
  s(root, 0.100, HAIR, -0.280, 1.700, -0.020, 0.85, 0.65, 0.80);  // left top
  s(root, 0.140, HAIR,  0.242, 1.540,  0.055, 0.95, 0.82, 0.88);  // right main
  s(root, 0.110, HAIR,  0.260, 1.625,  0.020, 0.88, 0.70, 0.82);  // right upper
  s(root, 0.215, HAIR,  0.000, 1.500,  0.150, 1.02, 0.90, 0.78);  // back
  s(root, 0.155, HAIR,  0.000, 1.618,  0.120, 0.98, 0.76, 0.72);  // back upper
  s(root, 0.108, HAIR,  0.082, 1.782, -0.100, 1.10, 0.58, 0.82);  // front swoop
  s(root, 0.086, HAIR, -0.058, 1.800, -0.060, 0.95, 0.55, 0.78);  // front fill
  s(root, 0.072, HAIR, -0.278, 1.440,  0.020, 0.70, 1.22, 0.60);  // sideburn L
  s(root, 0.072, HAIR,  0.278, 1.440,  0.020, 0.70, 1.22, 0.60);  // sideburn R


  root.traverse(m => {
    if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; }
  });

  return { root, rightArm };
}

// ── State machine ─────────────────────────────────────────────────────────────
const IDLE        = 0;
const TURNING     = 1;
const WAVING      = 2;
const GREETING    = 3;   // arm down, holds eye contact
const LEAVING     = 4;
const DONE        = 5;
const POINT_TURN  = 6;   // rotate to face the portal
const POINT_RAISE = 7;   // raise arm into pointing pose
const POINT_HOLD  = 8;   // hold pointing for 3 s
const POINT_LOWER = 9;   // lower arm back to resting

const TRIGGER_DIST   = 14;
const RESET_DIST     = 18;  // hysteresis: reset when player moves this far away
const TURN_SPEED     = 2.2;

// Wave arc: rotation.z = 2.79 puts the hand at ear height (y≈1.52) outside the
// head sphere; 2.00 puts the hand just above horizontal. Capping at 2.79 keeps
// the arm clear of the head at all times.
const WAVE_HIGH    = 2.79;
const WAVE_LOW     = 2.00;
const WAVE_CENTER  = (WAVE_HIGH + WAVE_LOW) / 2;   // 2.395
const WAVE_AMPL    = (WAVE_HIGH - WAVE_LOW) / 2;   // 0.395
const WAVE_FREQ    = 3.28;                          // rad/s (1.8 × 1.35 × 1.35)

const WAVE_RAISE   = 0.55;
const WAVE_HOLD    = 5.0;    // original 3.0 + 2.0 extra seconds
const WAVE_LOWER   = 0.55;
const WAVE_DURATION = WAVE_RAISE + WAVE_HOLD + WAVE_LOWER;

const GREET_DURATION = 1.0;

// Pointing toward the portal at (0, 0, 16) — NPC at (0, 0, -8) must face +Z
// root.rotation.y = π puts local -Z in world +Z direction.
// rightArm.rotation.x = π/2 swings the arm from hanging-down into local -Z,
// which is world +Z when the body is rotated π. ≈ horizontal forward point.
const PORTAL_ANGLE   = Math.PI;
const POINT_ARM_X    = Math.PI / 2;
const POINT_HOLD_DUR = 3.0;
const POINT_RAISE_T  = 0.5;
const POINT_LOWER_T  = 0.5;

// Capture the exact angle at end of wave hold so the lower phase starts cleanly.
const WAVE_END_ANGLE = WAVE_CENTER + WAVE_AMPL * Math.sin(WAVE_HOLD * WAVE_FREQ);

// Smooth-step ease: zero first- and second-derivative at t=0 and t=1
function ease(t) { return t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t); }

function angleDiff(from, to) {
  let d = to - from;
  while (d >  Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

export function createNPC(scene) {
  const { root, rightArm } = buildCharacter();

  root.position.set(0, 0.025, -8);  // sole clears ground plane (z-fight fix)
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

    // Reset when player leaves — next approach starts the full sequence again
    if (state !== IDLE && dist > RESET_DIST) {
      state               = IDLE;
      timer               = 0;
      rightArm.rotation.z = 0;
      rightArm.rotation.x = 0;
      root.rotation.y     = Math.PI;
    }

    if (state === IDLE) {
      if (dist < TRIGGER_DIST && playerPos.z > -20) {
        faceAngle  = Math.atan2(-dx, -dz);
        leaveAngle = faceAngle - (75 * Math.PI / 180);
        state = TURNING;
        timer = 0;
      }

    } else if (state === TURNING) {
      const diff = angleDiff(root.rotation.y, faceAngle);
      if (Math.abs(diff) < 0.04) {
        root.rotation.y = faceAngle;
        state = WAVING;
        timer = 0;
      } else {
        root.rotation.y += Math.sign(diff) * Math.min(Math.abs(diff), TURN_SPEED * dt);
      }

    } else if (state === WAVING) {
      timer += dt;

      if (timer < WAVE_RAISE) {
        // Phase 1 — raise arm to centre of wave arc (ear↔above-horizontal)
        rightArm.rotation.z = WAVE_CENTER * ease(timer / WAVE_RAISE);

      } else if (timer < WAVE_RAISE + WAVE_HOLD) {
        // Phase 2 — slow wave between ear height and just above horizontal
        const wt = timer - WAVE_RAISE;
        rightArm.rotation.z = WAVE_CENTER + WAVE_AMPL * Math.sin(wt * WAVE_FREQ);

      } else if (timer < WAVE_DURATION) {
        // Phase 3 — lower arm, starting from wherever the wave ended
        const t = (timer - WAVE_RAISE - WAVE_HOLD) / WAVE_LOWER;
        rightArm.rotation.z = THREE.MathUtils.lerp(WAVE_END_ANGLE, 0, ease(t));

      } else {
        rightArm.rotation.z = 0;
        state = GREETING;
        timer = 0;
      }

    } else if (state === GREETING) {
      // Hold — facing player with arm at side for GREET_DURATION seconds
      timer += dt;
      if (timer >= GREET_DURATION) {
        state = POINT_TURN;
        timer = 0;
      }

    } else if (state === POINT_TURN) {
      // Rotate to face the portal (+Z world = rotation.y π)
      const diff = angleDiff(root.rotation.y, PORTAL_ANGLE);
      if (Math.abs(diff) < 0.04) {
        root.rotation.y = PORTAL_ANGLE;
        state = POINT_RAISE;
        timer = 0;
      } else {
        root.rotation.y += Math.sign(diff) * Math.min(Math.abs(diff), TURN_SPEED * dt);
      }

    } else if (state === POINT_RAISE) {
      // Smoothly raise the right arm into a forward horizontal point
      timer += dt;
      const t = Math.min(timer / POINT_RAISE_T, 1);
      rightArm.rotation.x = POINT_ARM_X * ease(t);
      rightArm.rotation.z = 0;
      if (t >= 1) {
        rightArm.rotation.x = POINT_ARM_X;
        state = POINT_HOLD;
        timer = 0;
      }

    } else if (state === POINT_HOLD) {
      // Hold the pointing pose for 3 seconds
      timer += dt;
      if (timer >= POINT_HOLD_DUR) {
        state = POINT_LOWER;
        timer = 0;
      }

    } else if (state === POINT_LOWER) {
      // Lower arm back to resting, then turn away
      timer += dt;
      const t = Math.min(timer / POINT_LOWER_T, 1);
      rightArm.rotation.x = POINT_ARM_X * (1 - ease(t));
      if (t >= 1) {
        rightArm.rotation.x = 0;
        state = LEAVING;
        timer = 0;
      }

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

  return { update, root };
}
