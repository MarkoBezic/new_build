import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

const WALK_SPEED   = 8;
const SPRINT_SPEED = 18;
const GRAVITY      = -28;
const JUMP_VEL     = 10;
const EYE_HEIGHT   = 1.75;
const CAM_DIST     = 5;
const MOUSE_S      = 0.002;
const PITCH_MIN    = -Math.PI / 2 + 0.05;
const PITCH_MAX    =  Math.PI / 2 - 0.05;

// Touch primary input = mobile (consistent with CSS `pointer: coarse`)
export const isMobile = window.matchMedia('(pointer: coarse)').matches;

export function createPlayer(scene, camera, canvas) {
  return isMobile
    ? createMobilePlayer(scene, camera, canvas)
    : createDesktopPlayer(scene, camera, canvas);
}

function makeAvatarMesh(color) {
  const g = new THREE.Group();
  const R = 0.22, L = 0.85;
  const bodyH = L + 2 * R;

  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(R, L, 4, 8),
    new THREE.MeshLambertMaterial({ color }),
  );
  body.position.y = bodyH / 2;
  g.add(body);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 10, 8),
    new THREE.MeshLambertMaterial({ color: 0xD4956A }),
  );
  head.position.y = bodyH + 0.22;
  g.add(head);

  return g;
}

// ─────────────────────────────────────────────────────────────────────────────
//  DESKTOP  — 1st / 3rd person toggle via V key
// ─────────────────────────────────────────────────────────────────────────────
function createDesktopPlayer(scene, camera, canvas) {
  // PointerLockControls handles pointer-lock API only; we drive the camera.
  const controls = new PointerLockControls(camera, canvas);
  controls.enabled = false;

  // Read initial facing from the camera's existing orientation (set via lookAt in main.js)
  const _euler = new THREE.Euler(0, 0, 0, 'YXZ');
  _euler.setFromQuaternion(camera.quaternion, 'YXZ');
  let yaw   = _euler.y;
  let pitch = _euler.x;

  let playerY  = camera.position.y - EYE_HEIGHT;  // feet height (0 = ground)
  let vy       = 0;
  let grounded = true;
  let thirdPerson = false;
  const keys = new Set();

  // Player avatar — hidden in 1st-person, visible in 3rd-person
  const avatar = makeAvatarMesh(0x888888);
  avatar.position.set(camera.position.x, playerY, camera.position.z);
  avatar.visible = false;
  scene.add(avatar);

  // Logical player world position — updated every frame for NPC / geese / minimap
  const playerPosition = new THREE.Vector3(camera.position.x, camera.position.y, camera.position.z);

  // ── Mouse look ──────────────────────────────────────────────────────────────
  document.addEventListener('mousemove', e => {
    if (!controls.isLocked) return;
    yaw   -= e.movementX * MOUSE_S;
    pitch -= e.movementY * MOUSE_S;
    pitch  = Math.max(PITCH_MIN, Math.min(PITCH_MAX, pitch));
  });

  // ── Keys ────────────────────────────────────────────────────────────────────
  window.addEventListener('keydown', e => {
    keys.add(e.code);

    if (e.code === 'Space' && grounded) { vy = JUMP_VEL; grounded = false; }

    if (e.code === 'KeyV' && controls.isLocked) {
      thirdPerson = !thirdPerson;
      avatar.visible = thirdPerson;
      if (thirdPerson) {
        playerY = Math.max(0, camera.position.y - EYE_HEIGHT);
        avatar.position.set(camera.position.x, playerY, camera.position.z);
      } else {
        // Return to 1st-person: move camera to avatar's eye level
        camera.position.x = avatar.position.x;
        camera.position.z = avatar.position.z;
      }
    }

    if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Tab'].includes(e.code))
      e.preventDefault();
  });
  window.addEventListener('keyup', e => keys.delete(e.code));
  controls.addEventListener('unlock', () => keys.clear());

  // ── Per-frame update ────────────────────────────────────────────────────────
  function update(dt) {
    if (!controls.isLocked) return;

    const speed = keys.has('ShiftLeft') || keys.has('ShiftRight') ? SPRINT_SPEED : WALK_SPEED;
    let mx = 0, mz = 0;
    if (keys.has('KeyW') || keys.has('ArrowUp'))    mz -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown'))  mz += 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft'))  mx -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) mx += 1;

    const len = Math.hypot(mx, mz);
    if (len > 0) {
      const n    = 1 / len;
      const fwdX = -Math.sin(yaw), fwdZ = -Math.cos(yaw);
      const rgtX =  Math.cos(yaw), rgtZ = -Math.sin(yaw);
      const dx = (fwdX * (-mz) + rgtX * mx) * n * speed * dt;
      const dz = (fwdZ * (-mz) + rgtZ * mx) * n * speed * dt;
      if (thirdPerson) { avatar.position.x += dx; avatar.position.z += dz; }
      else             { camera.position.x += dx; camera.position.z += dz; }
    }

    // Gravity
    vy += GRAVITY * dt;
    playerY += vy * dt;
    if (playerY <= 0) { playerY = 0; vy = 0; grounded = true; }

    if (thirdPerson) {
      // ── 3rd-person ──────────────────────────────────────────────────────────
      avatar.position.y = playerY;
      avatar.rotation.y = yaw;

      const lx = avatar.position.x;
      const ly = playerY + 1.2;   // look-at height on avatar
      const lz = avatar.position.z;

      // Orbit camera behind and above avatar based on yaw + pitch
      camera.position.x = lx + Math.sin(yaw) * Math.cos(pitch) * CAM_DIST;
      camera.position.y = ly + Math.sin(pitch) * CAM_DIST;
      camera.position.z = lz + Math.cos(yaw) * Math.cos(pitch) * CAM_DIST;
      camera.lookAt(lx, ly, lz);

      playerPosition.set(lx, ly, lz);
    } else {
      // ── 1st-person ──────────────────────────────────────────────────────────
      camera.position.y = playerY + EYE_HEIGHT;
      _euler.set(pitch, yaw, 0, 'YXZ');
      camera.quaternion.setFromEuler(_euler);

      playerPosition.copy(camera.position);
    }
  }

  function setColor(color) {
    if (avatar.children[0]) avatar.children[0].material.color.setHex(color);
  }

  return { controls, update, startMobile: () => {}, setColor, playerPosition };
}

// ─────────────────────────────────────────────────────────────────────────────
//  MOBILE  (virtual joystick + touch-look, 1st-person)
// ─────────────────────────────────────────────────────────────────────────────
function createMobilePlayer(scene, camera, canvas) {
  camera.rotation.setFromQuaternion(camera.quaternion, 'YXZ');

  let vy = 0, grounded = true;

  // ── Joystick state ──────────────────────────────────────────────────────────
  const JOY_R = 52;
  const DEAD  = 0.06;
  let joyId = null;
  let joyCX = 0, joyCY = 0;
  let joyDX = 0, joyDY = 0;

  // ── Look state ──────────────────────────────────────────────────────────────
  let lookId = null, lookPX = 0, lookPY = 0;
  const LOOK_S = 0.0045;

  const fwdV  = new THREE.Vector3();
  const rgtV  = new THREE.Vector3();
  const upV   = new THREE.Vector3(0, 1, 0);

  // ── Joystick DOM ─────────────────────────────────────────────────────────────
  const joyBase = document.createElement('div');
  Object.assign(joyBase.style, {
    position: 'fixed', zIndex: '30', pointerEvents: 'none',
    width: `${JOY_R * 2}px`, height: `${JOY_R * 2}px`,
    borderRadius: '50%',
    border: '2px solid rgba(255,255,255,0.28)',
    background: 'rgba(255,255,255,0.07)',
    display: 'none',
    transform: 'translate(-50%,-50%)',
  });
  const joyKnob = document.createElement('div');
  Object.assign(joyKnob.style, {
    position: 'absolute', top: '50%', left: '50%',
    transform: 'translate(-50%,-50%)',
    width: `${JOY_R * 0.75}px`, height: `${JOY_R * 0.75}px`,
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.32)',
  });
  joyBase.appendChild(joyKnob);
  document.body.appendChild(joyBase);

  function startMobile() {}

  canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      const leftSide = t.clientX < window.innerWidth * 0.45;
      if (leftSide && joyId === null) {
        joyId = t.identifier;
        joyCX = t.clientX; joyCY = t.clientY;
        joyDX = 0; joyDY = 0;
        joyBase.style.left    = `${joyCX}px`;
        joyBase.style.top     = `${joyCY}px`;
        joyBase.style.display = 'block';
        joyKnob.style.transform = 'translate(-50%,-50%)';
      } else if (!leftSide && lookId === null) {
        lookId = t.identifier;
        lookPX = t.clientX; lookPY = t.clientY;
      }
    }
  }, { passive: false });

  canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier === joyId) {
        const dx = t.clientX - joyCX;
        const dy = t.clientY - joyCY;
        const len = Math.hypot(dx, dy);
        const cl  = Math.min(len, JOY_R);
        joyDX = (len > 0 ? dx / len : 0) * (cl / JOY_R);
        joyDY = (len > 0 ? dy / len : 0) * (cl / JOY_R);
        joyKnob.style.transform =
          `translate(calc(-50% + ${joyDX * JOY_R}px), calc(-50% + ${joyDY * JOY_R}px))`;
      } else if (t.identifier === lookId) {
        camera.rotation.y -= (t.clientX - lookPX) * LOOK_S;
        camera.rotation.x -= (t.clientY - lookPY) * LOOK_S;
        camera.rotation.x  = Math.max(-Math.PI * 0.417, Math.min(Math.PI * 0.417, camera.rotation.x));
        lookPX = t.clientX; lookPY = t.clientY;
      }
    }
  }, { passive: false });

  function endTouch(e) {
    for (const t of e.changedTouches) {
      if (t.identifier === joyId) { joyId = null; joyDX = 0; joyDY = 0; joyBase.style.display = 'none'; }
      else if (t.identifier === lookId) { lookId = null; }
    }
  }
  canvas.addEventListener('touchend',    endTouch, { passive: false });
  canvas.addEventListener('touchcancel', endTouch, { passive: false });

  function update(dt) {
    if (joyId !== null && Math.hypot(joyDX, joyDY) > DEAD) {
      camera.getWorldDirection(fwdV);
      fwdV.y = 0; fwdV.normalize();
      rgtV.crossVectors(fwdV, upV).normalize();
      camera.position.addScaledVector(fwdV,  -joyDY * WALK_SPEED * dt);
      camera.position.addScaledVector(rgtV,   joyDX * WALK_SPEED * dt);
    }
    vy += GRAVITY * dt;
    camera.position.y += vy * dt;
    if (camera.position.y <= EYE_HEIGHT) {
      camera.position.y = EYE_HEIGHT; vy = 0; grounded = true;
    }
  }

  const controls = { isLocked: true, lock() {}, unlock() {}, addEventListener() {} };
  const playerPosition = camera.position;
  function setColor() {}

  return { controls, update, startMobile, setColor, playerPosition };
}
