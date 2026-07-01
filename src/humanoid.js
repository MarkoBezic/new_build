import * as THREE from 'three';

// ── Build a humanoid group with head, torso, arms and legs ───────────────────
// Limb pivots are stored in g.userData.limbs for animation.
// The body material is in g.userData.bodyMat for colour changes.
export function buildHumanoid(color) {
  const g = new THREE.Group();

  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const skinMat = new THREE.MeshLambertMaterial({ color: 0xD4956A });
  const legMat  = new THREE.MeshLambertMaterial({ color: 0x2B4070 });
  const eyeMat  = new THREE.MeshLambertMaterial({ color: 0x111111 });

  // Head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.20, 10, 8), skinMat);
  head.position.y = 1.49;
  head.castShadow = true;
  g.add(head);

  // Eyes face forward (−Z)
  const eyeGeo = new THREE.SphereGeometry(0.032, 6, 4);
  for (const ex of [-0.07, 0.07]) {
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.position.set(ex, 1.53, -0.18);
    g.add(eye);
  }

  // Torso
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.52, 0.20), bodyMat);
  torso.position.y = 0.98;
  torso.castShadow = true;
  g.add(torso);

  // Arms — pivot at shoulder so rotation swings the whole arm
  function makeArm(side) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.26, 1.20, 0);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.46, 0.11), bodyMat);
    mesh.position.y = -0.23;
    mesh.castShadow = true;
    pivot.add(mesh);
    g.add(pivot);
    return pivot;
  }

  // Legs — pivot at hip
  function makeLeg(side) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.10, 0.72, 0);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.50, 0.13), legMat);
    mesh.position.y = -0.25;
    mesh.castShadow = true;
    pivot.add(mesh);
    g.add(pivot);
    return pivot;
  }

  const leftArm  = makeArm(-1);
  const rightArm = makeArm( 1);
  const leftLeg  = makeLeg(-1);
  const rightLeg = makeLeg( 1);

  g.userData.limbs     = { leftArm, rightArm, leftLeg, rightLeg };
  g.userData.bodyMat   = bodyMat;
  g.userData.walkPhase = 0;

  return g;
}

// ── Animate limbs each frame ──────────────────────────────────────────────────
// isMoving — true while the character is walking
export function animateAvatar(avatar, dt, isMoving) {
  const { limbs } = avatar.userData;
  if (!limbs) return;

  if (isMoving) {
    avatar.userData.walkPhase += dt * 7.5;
  }

  const swing = Math.sin(avatar.userData.walkPhase) * 0.52;

  if (isMoving) {
    limbs.leftLeg.rotation.x  =  swing;
    limbs.rightLeg.rotation.x = -swing;
    limbs.leftArm.rotation.x  = -swing * 0.65;   // arms opposite to legs
    limbs.rightArm.rotation.x =  swing * 0.65;
  } else {
    // Ease back to neutral
    limbs.leftLeg.rotation.x  *= 0.82;
    limbs.rightLeg.rotation.x *= 0.82;
    limbs.leftArm.rotation.x  *= 0.82;
    limbs.rightArm.rotation.x *= 0.82;
  }
}
