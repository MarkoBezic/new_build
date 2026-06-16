import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

const WALK_SPEED = 8;
const SPRINT_SPEED = 18;
const GRAVITY    = -28;
const JUMP_VEL   = 10;
const EYE_HEIGHT = 1.75;

// Touch primary input = mobile (consistent with CSS `pointer: coarse`)
export const isMobile = window.matchMedia('(pointer: coarse)').matches;

export function createPlayer(camera, canvas) {
  return isMobile
    ? createMobilePlayer(camera, canvas)
    : createDesktopPlayer(camera, canvas);
}

// ─────────────────────────────────────────────────────────────────────────────
//  DESKTOP  (PointerLockControls, unchanged behaviour)
// ─────────────────────────────────────────────────────────────────────────────
function createDesktopPlayer(camera, canvas) {
  const controls = new PointerLockControls(camera, canvas);

  let vy = 0, grounded = true;
  const keys = new Set();

  window.addEventListener('keydown', e => {
    keys.add(e.code);
    if (e.code === 'Space' && grounded) { vy = JUMP_VEL; grounded = false; }
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code))
      e.preventDefault();
  });
  window.addEventListener('keyup', e => keys.delete(e.code));

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
      controls.moveRight(   (mx / len) * speed * dt);
      controls.moveForward(-(mz / len) * speed * dt);
    }

    vy += GRAVITY * dt;
    camera.position.y += vy * dt;
    if (camera.position.y <= EYE_HEIGHT) {
      camera.position.y = EYE_HEIGHT; vy = 0; grounded = true;
    }
  }

  return { controls, update, startMobile: () => {} };
}

// ─────────────────────────────────────────────────────────────────────────────
//  MOBILE  (virtual joystick + touch-look + jump/map buttons)
// ─────────────────────────────────────────────────────────────────────────────
function createMobilePlayer(camera, canvas) {
  // YXZ order: Y=yaw, X=pitch, Z=roll. Must be set before any rotation changes.
  camera.rotation.order = 'YXZ';
  // Explicitly zero pitch so the lookAt quaternion can't leave a stale X value.
  camera.rotation.x = 0;

  let vy = 0, grounded = true;

  // ── Joystick state ──────────────────────────────────────────────────────────
  const JOY_R = 52;          // base radius px
  const DEAD  = 0.06;        // normalised dead-zone
  let joyId = null;
  let joyCX = 0, joyCY = 0; // world position where finger landed
  let joyDX = 0, joyDY = 0; // normalised [-1,1]

  // ── Look state ──────────────────────────────────────────────────────────────
  let lookId = null, lookPX = 0, lookPY = 0;
  const LOOK_S = 0.0045; // rad / px

  // ── Helper vectors ──────────────────────────────────────────────────────────
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

  // ── Touch handlers ────────────────────────────────────────────────────────────
  canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      const leftSide = t.clientX < window.innerWidth * 0.45;

      if (leftSide && joyId === null) {
        // Spawn joystick where the finger lands
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
        // Clamp to ±75° — well clear of the ±90° gimbal-lock point that causes flipping
        camera.rotation.x  = Math.max(-Math.PI * 0.417, Math.min(Math.PI * 0.417, camera.rotation.x));
        lookPX = t.clientX; lookPY = t.clientY;
      }
    }
  }, { passive: false });

  function endTouch(e) {
    for (const t of e.changedTouches) {
      if (t.identifier === joyId) {
        joyId = null; joyDX = 0; joyDY = 0;
        joyBase.style.display = 'none';
      } else if (t.identifier === lookId) {
        lookId = null;
      }
    }
  }
  canvas.addEventListener('touchend',    endTouch, { passive: false });
  canvas.addEventListener('touchcancel', endTouch, { passive: false });

  // ── Per-frame update ──────────────────────────────────────────────────────────
  function update(dt) {
    // Movement (joystick)
    if (joyId !== null && Math.hypot(joyDX, joyDY) > DEAD) {
      camera.getWorldDirection(fwdV);
      fwdV.y = 0; fwdV.normalize();
      rgtV.crossVectors(fwdV, upV).normalize();
      camera.position.addScaledVector(fwdV,  -joyDY * WALK_SPEED * dt);
      camera.position.addScaledVector(rgtV,   joyDX * WALK_SPEED * dt);
    }

    // Gravity
    vy += GRAVITY * dt;
    camera.position.y += vy * dt;
    if (camera.position.y <= EYE_HEIGHT) {
      camera.position.y = EYE_HEIGHT; vy = 0; grounded = true;
    }
  }

  // Stub controls object — main.js only uses .lock/.unlock on desktop path
  const controls = { isLocked: true, lock() {}, unlock() {}, addEventListener() {} };

  return { controls, update, startMobile };
}
