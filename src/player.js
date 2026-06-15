import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

const WALK_SPEED   = 8;
const SPRINT_SPEED = 18;
const GRAVITY      = -28;
const JUMP_VEL     = 10;
const EYE_HEIGHT   = 1.75;

export function createPlayer(camera, canvas) {
  const controls = new PointerLockControls(camera, canvas);

  let vy       = 0;
  let grounded = true;
  const keys   = new Set();

  window.addEventListener('keydown', e => {
    keys.add(e.code);

    if (e.code === 'Space' && grounded) {
      vy       = JUMP_VEL;
      grounded = false;
    }

    // Prevent default scroll on navigation keys
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      e.preventDefault();
    }
  });

  window.addEventListener('keyup', e => keys.delete(e.code));

  /**
   * Call once per frame. dt = seconds since last frame.
   */
  function update(dt) {
    if (!controls.isLocked) return;

    // ── Horizontal movement ──────────────────────────────────────────
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

    // ── Gravity + ground ─────────────────────────────────────────────
    vy += GRAVITY * dt;
    camera.position.y += vy * dt;

    if (camera.position.y <= EYE_HEIGHT) {
      camera.position.y = EYE_HEIGHT;
      vy       = 0;
      grounded = true;
    }
  }

  return { controls, update };
}
