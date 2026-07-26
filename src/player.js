import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { groundY as zoneGroundY, BEACH_STOP, SHORE, ISLAND, inIsland, skyFloorY, updraftAt } from './zones.js';
import { resolveMove, structureFloorY, terrainSuppressed, cameraBlock } from './collision.js';
import { settings } from './settings.js';
import { buildHumanoid, animateAvatar, makeNameLabel } from './humanoid.js';

const WALK_SPEED   = 8;
const SPRINT_SPEED = 18;
const BOAT_SPEED   = 4.5;
const BOAT_OPEN_SPEED = 10;   // wind at your back on the open sea
const GRAVITY      = -28;
const JUMP_VEL     = 10;
const EYE_HEIGHT   = 1.75;
const CAM_DIST     = 5;
const MOUSE_S      = 0.002;
const PITCH_MIN    = -Math.PI / 2 + 0.05;
const PITCH_MAX    =  Math.PI / 2 - 0.05;
const BOARD_RADIUS = 2.5;
const BOAT_FLOAT_Y = 0.15;  // boat sits at beach/water surface
const BOAT_DECK_Y  = 0.28;  // player stands on the floor boards (FLOAT_Y + 0.13 board top)
const GLIDE_FALL   = -3.4;  // capped sink rate while gliding
const GLIDE_SPEED  = 15;    // forward push along the look direction

// Touch primary input = mobile (consistent with CSS `pointer: coarse`)
export const isMobile = window.matchMedia('(pointer: coarse)').matches;

// ── Boat state (shared across whichever player is active) ────────────────────
let _boats         = [];
let _activeBoat    = null;
let _onBoat        = false;
let _hasCastOff    = false;   // true once the active boat has entered open water
let _boardCooldown = 0;       // grace period after disembarking before re-board
const BOARD_COOLDOWN = 1.2;
export function setBoats(arr) { _boats = arr; }
export function isOnBoat()    { return _onBoat; }

// ── Swimming (see diving.js) ─────────────────────────────────────────────────
// Diving replaces gravity with buoyancy and lets the look direction drive
// movement in three dimensions, so the sea becomes a space rather than a lid.
let _swimming = false;
export function isSwimming()      { return _swimming; }
export function setSwimming(v)    { _swimming = !!v; }
const SWIM_SPEED = 7.5, SWIM_FAST = 11.5, SWIM_RISE = 4.5, SWIM_SINK = -0.75;
export const SEABED = -24;        // hard floor of the open sea

// Walkable if on the land side of the shore, or anywhere on Ember Isle —
// and anywhere at all while swimming
function canWalk(x, z) { return _swimming || (z - x) <= SHORE || inIsland(x, z); }

// Open sea = past the shore band and clear of the island — boats run fast here
function boatSpeed(b) {
  const open = (b.z - b.x) > 1150 &&
    Math.hypot(b.x - ISLAND.x, b.z - ISLAND.z) > ISLAND.r + 30;
  return open ? BOAT_OPEN_SPEED : BOAT_SPEED;
}

// ── Glider state (unlocked at the Icy Peaks summit, see glider.js) ────────────
let _gliderUnlocked = false;
let _gliding        = false;
export function setGliderUnlocked(v) { _gliderUnlocked = v; }
export function isGliding()          { return _gliding; }

// Wearable delta wing — attached to the avatar, shown only while gliding
function makeWing() {
  const wing = new THREE.Group();
  const mat  = new THREE.MeshLambertMaterial({ color: 0xE8593A, side: THREE.DoubleSide });
  const half = new THREE.BoxGeometry(1.55, 0.04, 0.55);
  const L = new THREE.Mesh(half, mat);
  L.position.x = -0.74; L.rotation.set(0, 0.32, 0.18);
  const R = new THREE.Mesh(half, mat);
  R.position.x = 0.74; R.rotation.set(0, -0.32, -0.18);
  const spar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.03, 0.9, 5),
    new THREE.MeshLambertMaterial({ color: 0x5C3A1A }),
  );
  spar.rotation.z = Math.PI / 2;
  wing.add(L, R, spar);
  wing.position.y = 2.05;
  wing.visible = false;
  return wing;
}

// Walk-off landing spot: step inland from the boat to z−x ≈ 1092, safely on
// the sand and OUTSIDE the auto-board radius — otherwise the player is
// re-boarded the very next frame and gets stuck at the waterline.
function shoreExit(boat) {
  const shift = Math.max(2.5, (boat.z - boat.x - 1092) / 2);
  return { tx: boat.x + shift, tz: boat.z - shift };
}

function floorY(x, z) {
  if (_onBoat) return BOAT_DECK_Y;
  return zoneGroundY(x, z);
}

// ── Camera helpers (shared by desktop & mobile third-person) ─────────────────
// Boom length after pulling in short of the first wall/slab on the way out
function clampedCamDist(lx, ly, lz, yaw, pitch) {
  const ix = lx + Math.sin(yaw) * Math.cos(pitch) * CAM_DIST;
  const iy = ly + Math.sin(pitch) * CAM_DIST;
  const iz = lz + Math.cos(yaw) * Math.cos(pitch) * CAM_DIST;
  const t = cameraBlock(lx, ly, lz, ix, iy, iz);
  return t >= 1 ? CAM_DIST : Math.max(0.6, CAM_DIST * t - 0.3);
}
// On open ground the camera must not sink into a hillside behind the player
// (underground the heightmap is suppressed, so dungeon cameras are exempt)
function guardCameraAboveTerrain(camera) {
  if (_swimming) return;
  const cx = camera.position.x, cz = camera.position.z;
  if (terrainSuppressed(cx, cz, camera.position.y)) return;
  const g = zoneGroundY(cx, cz) + 0.35;
  if (camera.position.y < g) camera.position.y = g;
}

export function createPlayer(scene, camera, canvas) {
  return isMobile
    ? createMobilePlayer(scene, camera, canvas)
    : createDesktopPlayer(scene, camera, canvas);
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
  let airTime  = 0;
  let thirdPerson = true;
  const keys = new Set();

  // Player avatar — visible in 3rd-person (default), hidden in 1st-person
  const avatar = buildHumanoid(0x888888);
  avatar.position.set(camera.position.x, playerY, camera.position.z);
  avatar.visible = true;
  scene.add(avatar);
  const wing = makeWing();
  avatar.add(wing);

  // Logical player world position — updated every frame for NPC / geese / minimap
  const playerPosition = new THREE.Vector3(camera.position.x, camera.position.y, camera.position.z);

  // ── Boat hint ────────────────────────────────────────────────────────────────
  const boatHint = document.createElement('div');
  boatHint.textContent = 'Press E to leave boat';
  Object.assign(boatHint.style, {
    position: 'fixed', bottom: '80px', left: '50%', transform: 'translateX(-50%)',
    color: '#fff', background: 'rgba(0,0,0,0.55)', padding: '5px 16px',
    borderRadius: '8px', fontSize: '13px', display: 'none',
    pointerEvents: 'none', zIndex: '20',
  });
  document.body.appendChild(boatHint);

  // ── Mouse look ──────────────────────────────────────────────────────────────
  document.addEventListener('mousemove', e => {
    if (!document.pointerLockElement) return;
    const sens = settings.get('sensitivity');
    const inv  = settings.get('invertY') ? -1 : 1;
    yaw   -= e.movementX * MOUSE_S * sens;
    pitch -= e.movementY * MOUSE_S * sens * inv;
    pitch  = Math.max(PITCH_MIN, Math.min(PITCH_MAX, pitch));
  });

  // ── Keys ────────────────────────────────────────────────────────────────────
  window.addEventListener('keydown', e => {
    const inText = document.activeElement?.tagName === 'TEXTAREA' ||
                   document.activeElement?.tagName === 'INPUT';
    if (inText) return;

    keys.add(e.code);

    if (e.code === 'Space' && grounded && !_onBoat) { vy = JUMP_VEL; grounded = false; }

    if (e.code === 'KeyV' && document.pointerLockElement) {
      thirdPerson = !thirdPerson;
      avatar.visible = thirdPerson;
      if (thirdPerson) {
        playerY = Math.max(floorY(avatar.position.x, avatar.position.z), camera.position.y - EYE_HEIGHT);
        avatar.position.set(camera.position.x, playerY, camera.position.z);
      } else {
        // Return to 1st-person: move camera to avatar's eye level
        camera.position.x = avatar.position.x;
        camera.position.z = avatar.position.z;
      }
    }

    // Disembark boat
    if (e.code === 'KeyE' && _onBoat && _activeBoat) {
      _onBoat = false; _hasCastOff = false;
      _boardCooldown = BOARD_COOLDOWN;
      boatHint.style.display = 'none';
      let tx, tz;
      const di = Math.hypot(_activeBoat.x - ISLAND.x, _activeBoat.z - ISLAND.z);
      if (di < ISLAND.r + 12) {
        // Step ashore onto Ember Isle — and pull the boat to the rim so it
        // stays boardable from the wading shelf, never stranded offshore
        const ux = (_activeBoat.x - ISLAND.x) / di, uz = (_activeBoat.z - ISLAND.z) / di;
        _activeBoat.x = ISLAND.x + ux * (ISLAND.r + 1.5);
        _activeBoat.z = ISLAND.z + uz * (ISLAND.r + 1.5);
        _activeBoat.mesh.position.set(_activeBoat.x, BOAT_FLOAT_Y, _activeBoat.z);
        tx = ISLAND.x + ux * (ISLAND.r - 2.5);
        tz = ISLAND.z + uz * (ISLAND.r - 2.5);
      } else {
        // Place player on beach side of shore from current boat position
        const K = _activeBoat.z - _activeBoat.x;
        const shift = Math.max(0, K - 1092) / 2;  // move toward beach until z−x≈1092
        tx = _activeBoat.x + shift; tz = _activeBoat.z - shift;
      }
      if (thirdPerson) { avatar.position.x = tx; avatar.position.z = tz; }
      else             { camera.position.x = tx; camera.position.z = tz; }
      playerY = floorY(tx, tz);
      vy = 0;
      _activeBoat = null;
    }

    if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Tab'].includes(e.code))
      e.preventDefault();
  });
  window.addEventListener('keyup', e => keys.delete(e.code));
  controls.addEventListener('unlock', () => { keys.clear(); boatHint.style.display = 'none'; });

  // ── Per-frame update ────────────────────────────────────────────────────────
  function update(dt) {
    if (!document.pointerLockElement) return;
    _boardCooldown = Math.max(0, _boardCooldown - dt);

    const speed = _onBoat ? boatSpeed(_activeBoat)
                : (keys.has('ShiftLeft') || keys.has('ShiftRight') ? SPRINT_SPEED : WALK_SPEED);
    let mx = 0, mz = 0;
    // Swimming drives its own 3-D movement below; running this too would
    // move the diver twice per frame
    if (!_swimming) {
      if (keys.has('KeyW') || keys.has('ArrowUp'))    mz -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown'))  mz += 1;
      if (keys.has('KeyA') || keys.has('ArrowLeft'))  mx -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) mx += 1;
    }

    const len = Math.hypot(mx, mz);
    if (len > 0) {
      const n    = 1 / len;
      const fwdX = -Math.sin(yaw), fwdZ = -Math.cos(yaw);
      const rgtX =  Math.cos(yaw), rgtZ = -Math.sin(yaw);
      const dx = (fwdX * (-mz) + rgtX * mx) * n * speed * dt;
      const dz = (fwdZ * (-mz) + rgtZ * mx) * n * speed * dt;
      if (_onBoat) {
        _activeBoat.x += dx; _activeBoat.z += dz;
        if (_activeBoat.z - _activeBoat.x >= SHORE) _hasCastOff = true;
        // Stop boat when beached; auto-disembark so player walks off freely
        const boatDiag = _activeBoat.z - _activeBoat.x;
        if (boatDiag < BEACH_STOP) {
          const excess = BEACH_STOP - boatDiag;
          _activeBoat.x -= excess / 2; _activeBoat.z += excess / 2;
          const { tx, tz } = shoreExit(_activeBoat);
          _onBoat = false; _hasCastOff = false;
          _activeBoat = null;
          _boardCooldown = BOARD_COOLDOWN;
          boatHint.style.display = 'none';
          if (thirdPerson) { avatar.position.x = tx; avatar.position.z = tz; }
          else             { camera.position.x = tx; camera.position.z = tz; }
          playerY = floorY(tx, tz); vy = 0;
        }
        // Beach on Ember Isle — nose the boat to the rim and step ashore
        if (_activeBoat) {
          const di = Math.hypot(_activeBoat.x - ISLAND.x, _activeBoat.z - ISLAND.z);
          if (di < ISLAND.r + 1) {
            const ux = (_activeBoat.x - ISLAND.x) / di, uz = (_activeBoat.z - ISLAND.z) / di;
            _activeBoat.x = ISLAND.x + ux * (ISLAND.r + 1.5);
            _activeBoat.z = ISLAND.z + uz * (ISLAND.r + 1.5);
            _activeBoat.mesh.position.set(_activeBoat.x, BOAT_FLOAT_Y, _activeBoat.z);
            const tx = ISLAND.x + ux * (ISLAND.r - 2.5);
            const tz = ISLAND.z + uz * (ISLAND.r - 2.5);
            _onBoat = false; _hasCastOff = false; _activeBoat = null;
            _boardCooldown = BOARD_COOLDOWN;
            boatHint.style.display = 'none';
            if (thirdPerson) { avatar.position.x = tx; avatar.position.z = tz; }
            else             { camera.position.x = tx; camera.position.z = tz; }
            playerY = floorY(tx, tz); vy = 0;
          }
        }
      } else {
        const cx = thirdPerson ? avatar.position.x : camera.position.x;
        const cz = thirdPerson ? avatar.position.z : camera.position.z;
        const nx = cx + dx, nz = cz + dz;
        if (canWalk(nx, nz)) {  // block walking into water (island shores allowed)
          const rm = resolveMove(cx, cz, nx, nz, playerY);   // solid walls slide
          if (thirdPerson) { avatar.position.x = rm.x; avatar.position.z = rm.z; }
          else             { camera.position.x = rm.x; camera.position.z = rm.z; }
        }
      }
    }

    // Auto-disembark once the boat has entered open water and drifts back to
    // shore — the player simply walks off onto the sand and keeps going
    if (_onBoat && _activeBoat && _hasCastOff && (_activeBoat.z - _activeBoat.x < SHORE)) {
      const { tx, tz } = shoreExit(_activeBoat);
      _onBoat = false; _hasCastOff = false; _activeBoat = null;
      _boardCooldown = BOARD_COOLDOWN;
      boatHint.style.display = 'none';
      if (thirdPerson) { avatar.position.x = tx; avatar.position.z = tz; }
      else             { camera.position.x = tx; camera.position.z = tz; }
      playerY = floorY(tx, tz); vy = 0;
    }

    // Gravity / floor / glide / swim
    if (_swimming) {
      // Swim where you look: W drives along the full 3-D view vector, Space
      // kicks for the surface, Shift is a faster stroke. Buoyancy makes an
      // idle diver drift gently upward-ish rather than plummet.
      const sp = keys.has('ShiftLeft') || keys.has('ShiftRight') ? SWIM_FAST : SWIM_SPEED;
      const cp = Math.cos(pitch);
      const fwd = { x: -Math.sin(yaw) * cp, y: Math.sin(pitch), z: -Math.cos(yaw) * cp };
      const rgt = { x: Math.cos(yaw), z: -Math.sin(yaw) };
      let sx = 0, sy = 0, sz = 0;
      if (keys.has('KeyW') || keys.has('ArrowUp'))    { sx += fwd.x; sy += fwd.y; sz += fwd.z; }
      if (keys.has('KeyS') || keys.has('ArrowDown'))  { sx -= fwd.x; sy -= fwd.y; sz -= fwd.z; }
      if (keys.has('KeyA') || keys.has('ArrowLeft'))  { sx -= rgt.x; sz -= rgt.z; }
      if (keys.has('KeyD') || keys.has('ArrowRight')) { sx += rgt.x; sz += rgt.z; }
      const sl = Math.hypot(sx, sy, sz);
      const cx0 = thirdPerson ? avatar.position.x : camera.position.x;
      const cz0 = thirdPerson ? avatar.position.z : camera.position.z;
      if (sl > 0) {
        const rm = resolveMove(cx0, cz0, cx0 + (sx / sl) * sp * dt, cz0 + (sz / sl) * sp * dt, playerY);
        if (thirdPerson) { avatar.position.x = rm.x; avatar.position.z = rm.z; }
        else             { camera.position.x = rm.x; camera.position.z = rm.z; }
        playerY += (sy / sl) * sp * dt;
      }
      if (keys.has('Space')) playerY += SWIM_RISE * dt;
      else if (sl === 0)     playerY += SWIM_SINK * dt;
      const px2 = thirdPerson ? avatar.position.x : camera.position.x;
      const pz2 = thirdPerson ? avatar.position.z : camera.position.z;
      const bed = Math.max(SEABED, structureFloorY(px2, pz2, playerY));
      if (playerY < bed) playerY = bed;
      if (playerY > 0) playerY = 0;                 // the surface is a ceiling
      vy = 0; grounded = false; airTime = 0; _gliding = false;
      wing.visible = false;
    } else if (_onBoat) {
      playerY = BOAT_DECK_Y; vy = 0; grounded = true; airTime = 0; _gliding = false;
    } else {
      vy += GRAVITY * dt;
      // Hold Space while falling to deploy the Warden's Glider.
      // Updraft columns beneath the sky islands lift a deployed glider.
      const gpx = thirdPerson ? avatar.position.x : camera.position.x;
      const gpz = thirdPerson ? avatar.position.z : camera.position.z;
      const draft = _gliderUnlocked ? updraftAt(gpx, gpz, playerY) : null;
      _gliding = _gliderUnlocked && airTime > 0.22 && keys.has('Space') && (vy < 0 || !!draft);
      if (_gliding) {
        vy = draft ? Math.min(vy + 55 * dt, 7) : Math.max(vy, GLIDE_FALL);
        const nx = gpx - Math.sin(yaw) * GLIDE_SPEED * dt;
        const nz = gpz - Math.cos(yaw) * GLIDE_SPEED * dt;
        if (canWalk(nx, nz)) {
          const rm = resolveMove(gpx, gpz, nx, nz, playerY);
          if (thirdPerson) { avatar.position.x = rm.x; avatar.position.z = rm.z; }
          else             { camera.position.x = rm.x; camera.position.z = rm.z; }
        }
      }
      playerY += vy * dt;
      const px = thirdPerson ? avatar.position.x : camera.position.x;
      const pz = thirdPerson ? avatar.position.z : camera.position.z;
      const terrainG = terrainSuppressed(px, pz, playerY) ? -Infinity : floorY(px, pz);
      const ground = Math.max(terrainG, skyFloorY(px, pz, playerY), structureFloorY(px, pz, playerY));
      if (playerY <= ground) { playerY = ground; vy = 0; grounded = true; airTime = 0; _gliding = false; }
      else airTime += dt;
    }
    wing.visible = _gliding;

    // Sync boat mesh and avatar to boat position
    if (_onBoat && _activeBoat) {
      // Steer boat to face the player's look direction
      let diff = yaw - _activeBoat.yaw;
      while (diff >  Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      _activeBoat.yaw += diff * Math.min(1.2 * dt, 1.0);
      _activeBoat.mesh.rotation.y = _activeBoat.yaw;
      _activeBoat.mesh.position.set(_activeBoat.x, BOAT_FLOAT_Y, _activeBoat.z);
      if (thirdPerson) { avatar.position.x = _activeBoat.x; avatar.position.z = _activeBoat.z; }
      else             { camera.position.x = _activeBoat.x; camera.position.z = _activeBoat.z; }
    }

    // Walk animation
    animateAvatar(avatar, dt, !_onBoat && len > 0);

    if (thirdPerson) {
      // ── 3rd-person ──────────────────────────────────────────────────────────
      avatar.position.y = playerY;
      avatar.rotation.y = yaw;

      const lx = avatar.position.x;
      const ly = playerY + 1.2;   // look-at height on avatar
      const lz = avatar.position.z;

      // Orbit camera behind and above avatar — pulled in short of any wall or
      // slab between it and the avatar, so interiors never swallow the view
      const camDist = clampedCamDist(lx, ly, lz, yaw, pitch);
      camera.position.x = lx + Math.sin(yaw) * Math.cos(pitch) * camDist;
      camera.position.y = ly + Math.sin(pitch) * camDist;
      camera.position.z = lz + Math.cos(yaw) * Math.cos(pitch) * camDist;
      if (!_swimming && camera.position.y < 0.1) camera.position.y = 0.1;   // the diving camera must go under
      guardCameraAboveTerrain(camera);
      camera.lookAt(lx, ly, lz);

      playerPosition.set(lx, ly, lz);
    } else {
      // ── 1st-person ──────────────────────────────────────────────────────────
      camera.position.y = playerY + EYE_HEIGHT;
      _euler.set(pitch, yaw, 0, 'YXZ');
      camera.quaternion.setFromEuler(_euler);

      playerPosition.copy(camera.position);
    }

    // Auto-board: walk into any boat to board the nearest one (never while
    // swimming, or a diver would be yanked aboard the instant they slipped in)
    if (!_onBoat && !_swimming && _boardCooldown <= 0 && _boats.length) {
      const curX = thirdPerson ? avatar.position.x : camera.position.x;
      const curZ = thirdPerson ? avatar.position.z : camera.position.z;
      let nearest = null, bestDist = BOARD_RADIUS;
      for (const b of _boats) {
        const d = Math.hypot(curX - b.x, curZ - b.z);
        if (d < bestDist) { bestDist = d; nearest = b; }
      }
      if (nearest) {
        _activeBoat = nearest;
        _onBoat = true; _hasCastOff = false;
        playerY = BOAT_DECK_Y;
        vy = 0;
        boatHint.style.display = 'block';
      }
    }
  }

  let nameSprite = null;

  function setColor(color, name) {
    if (avatar.userData.bodyMat) avatar.userData.bodyMat.color.setHex(color);
    if (nameSprite) {
      avatar.remove(nameSprite);
      nameSprite.material.map.dispose();
      nameSprite.material.dispose();
      nameSprite = null;
    }
    nameSprite = makeNameLabel(name);
    if (nameSprite) avatar.add(nameSprite);
  }

  function getState() {
    const pos = thirdPerson ? avatar.position : camera.position;
    return { x: pos.x, z: pos.z, ry: yaw };
  }

  // `y` is optional — underground destinations (ley stones, well ropes) must
  // set it explicitly, since floorY only knows the surface heightmap
  function teleport(x, z, y) {
    playerY = y ?? floorY(x, z);
    if (thirdPerson) {
      avatar.position.set(x, playerY, z);
    } else {
      camera.position.set(x, playerY + EYE_HEIGHT, z);
    }
    vy = 0;
  }

  return { controls, update, startMobile: () => {}, setColor, playerPosition, getState, teleport, getAvatar: () => avatar };
}

// ─────────────────────────────────────────────────────────────────────────────
//  MOBILE  (virtual joystick + touch-look, 3rd-person)
// ─────────────────────────────────────────────────────────────────────────────
function createMobilePlayer(scene, camera, canvas) {
  const _euler = new THREE.Euler(0, 0, 0, 'YXZ');
  _euler.setFromQuaternion(camera.quaternion, 'YXZ');
  let yaw   = _euler.y;
  let pitch = 0.35;   // slight downward angle from behind for a cinematic view

  let playerX = camera.position.x;
  let playerZ = camera.position.z;
  let playerY = 0;
  let vy = 0;
  let airTime = 0;

  // ── Avatar mesh ──────────────────────────────────────────────────────────────
  const avatar = buildHumanoid(0x888888);
  avatar.position.set(playerX, playerY, playerZ);
  scene.add(avatar);
  const wing = makeWing();
  avatar.add(wing);

  const playerPosition = new THREE.Vector3(playerX, EYE_HEIGHT, playerZ);

  // ── Joystick state ──────────────────────────────────────────────────────────
  const JOY_R = 52;
  const DEAD  = 0.06;
  let joyId = null;
  let joyCX = 0, joyCY = 0;
  let joyDX = 0, joyDY = 0;

  // ── Look state ──────────────────────────────────────────────────────────────
  let lookId = null, lookPX = 0, lookPY = 0;
  const LOOK_S = 0.0045;

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
        const sens = settings.get('sensitivity');
        const inv  = settings.get('invertY') ? -1 : 1;
        yaw   -= (t.clientX - lookPX) * LOOK_S * sens;
        pitch -= (t.clientY - lookPY) * LOOK_S * sens * inv;
        pitch  = Math.max(PITCH_MIN, Math.min(PITCH_MAX, pitch));
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
    _boardCooldown = Math.max(0, _boardCooldown - dt);

    // Swimming: the joystick drives the full 3-D view vector, so looking
    // down and pushing forward takes you down
    if (_swimming) {
      const moving = joyId !== null && Math.hypot(joyDX, joyDY) > DEAD;
      const cp = Math.cos(pitch);
      if (moving) {
        const fwd = { x: -Math.sin(yaw) * cp, y: Math.sin(pitch), z: -Math.cos(yaw) * cp };
        const rgt = { x: Math.cos(yaw), z: -Math.sin(yaw) };
        const sx = -joyDY * fwd.x + joyDX * rgt.x;
        const sy = -joyDY * fwd.y;
        const sz = -joyDY * fwd.z + joyDX * rgt.z;
        const sl = Math.hypot(sx, sy, sz) || 1;
        const rm = resolveMove(playerX, playerZ,
          playerX + (sx / sl) * SWIM_SPEED * dt, playerZ + (sz / sl) * SWIM_SPEED * dt, playerY);
        playerX = rm.x; playerZ = rm.z;
        playerY += (sy / sl) * SWIM_SPEED * dt;
      } else {
        playerY += SWIM_SINK * dt;
      }
      const bed = Math.max(SEABED, structureFloorY(playerX, playerZ, playerY));
      if (playerY < bed) playerY = bed;
      if (playerY > 0) playerY = 0;
      vy = 0; airTime = 0; _gliding = false;
      avatar.position.set(playerX, playerY, playerZ);
      avatar.rotation.y = yaw;
      const lx0 = playerX, ly0 = playerY + 1.2, lz0 = playerZ;
      const swimCamD = clampedCamDist(lx0, ly0, lz0, yaw, pitch);
      camera.position.x = lx0 + Math.sin(yaw) * Math.cos(pitch) * swimCamD;
      camera.position.y = ly0 + Math.sin(pitch) * swimCamD;
      camera.position.z = lz0 + Math.cos(yaw) * Math.cos(pitch) * swimCamD;
      camera.lookAt(lx0, ly0, lz0);
      playerPosition.set(lx0, ly0, lz0);
      animateAvatar(avatar, dt, moving);
      return;
    }

    // Movement in yaw direction
    if (joyId !== null && Math.hypot(joyDX, joyDY) > DEAD) {
      const fwdX = -Math.sin(yaw), fwdZ = -Math.cos(yaw);
      const rgtX =  Math.cos(yaw), rgtZ = -Math.sin(yaw);
      const mSpeed = _onBoat ? boatSpeed(_activeBoat) : WALK_SPEED;
      const dx = (-joyDY * fwdX + joyDX * rgtX) * mSpeed * dt;
      const dz = (-joyDY * fwdZ + joyDX * rgtZ) * mSpeed * dt;
      if (_onBoat) {
        _activeBoat.x += dx; _activeBoat.z += dz;
        if (_activeBoat.z - _activeBoat.x >= SHORE) _hasCastOff = true;
        const boatDiag = _activeBoat.z - _activeBoat.x;
        if (boatDiag < BEACH_STOP) {
          const excess = BEACH_STOP - boatDiag;
          _activeBoat.x -= excess / 2; _activeBoat.z += excess / 2;
          const { tx, tz } = shoreExit(_activeBoat);
          playerX = tx; playerZ = tz;
          _onBoat = false; _hasCastOff = false;
          _activeBoat = null;
          _boardCooldown = BOARD_COOLDOWN;
          playerY = floorY(playerX, playerZ); vy = 0;
        }
        // Beach on Ember Isle — nose the boat to the rim and step ashore
        if (_activeBoat) {
          const di = Math.hypot(_activeBoat.x - ISLAND.x, _activeBoat.z - ISLAND.z);
          if (di < ISLAND.r + 1) {
            const ux = (_activeBoat.x - ISLAND.x) / di, uz = (_activeBoat.z - ISLAND.z) / di;
            _activeBoat.x = ISLAND.x + ux * (ISLAND.r + 1.5);
            _activeBoat.z = ISLAND.z + uz * (ISLAND.r + 1.5);
            _activeBoat.mesh.position.set(_activeBoat.x, BOAT_FLOAT_Y, _activeBoat.z);
            playerX = ISLAND.x + ux * (ISLAND.r - 2.5);
            playerZ = ISLAND.z + uz * (ISLAND.r - 2.5);
            _onBoat = false; _hasCastOff = false; _activeBoat = null;
            _boardCooldown = BOARD_COOLDOWN;
            playerY = floorY(playerX, playerZ); vy = 0;
          }
        }
      } else {
        const nx = playerX + dx, nz = playerZ + dz;
        if (canWalk(nx, nz)) {
          const rm = resolveMove(playerX, playerZ, nx, nz, playerY);
          playerX = rm.x; playerZ = rm.z;
        }
      }
    }

    // Auto-disembark once the boat has entered open water and drifts back to shore
    if (_onBoat && _activeBoat && _hasCastOff && (_activeBoat.z - _activeBoat.x < SHORE)) {
      const { tx, tz } = shoreExit(_activeBoat);
      playerX = tx; playerZ = tz;
      _onBoat = false; _hasCastOff = false; _activeBoat = null;
      _boardCooldown = BOARD_COOLDOWN;
      playerY = floorY(playerX, playerZ); vy = 0;
    }

    // Gravity / floor / glide (mobile auto-deploys after a beat of freefall)
    if (_onBoat) {
      playerY = BOAT_DECK_Y; vy = 0; airTime = 0; _gliding = false;
    } else {
      vy += GRAVITY * dt;
      const draft = _gliderUnlocked ? updraftAt(playerX, playerZ, playerY) : null;
      _gliding = _gliderUnlocked && airTime > 0.3 && (vy < 0 || !!draft);
      if (_gliding) {
        vy = draft ? Math.min(vy + 55 * dt, 7) : Math.max(vy, GLIDE_FALL);
        const nx = playerX - Math.sin(yaw) * GLIDE_SPEED * dt;
        const nz = playerZ - Math.cos(yaw) * GLIDE_SPEED * dt;
        if (canWalk(nx, nz)) {
          const rm = resolveMove(playerX, playerZ, nx, nz, playerY);
          playerX = rm.x; playerZ = rm.z;
        }
      }
      playerY += vy * dt;
      const terrainG = terrainSuppressed(playerX, playerZ, playerY) ? -Infinity : floorY(playerX, playerZ);
      const ground = Math.max(terrainG, skyFloorY(playerX, playerZ, playerY), structureFloorY(playerX, playerZ, playerY));
      if (playerY <= ground) { playerY = ground; vy = 0; airTime = 0; _gliding = false; }
      else airTime += dt;
    }
    wing.visible = _gliding;

    // Sync boat mesh and player position
    if (_onBoat && _activeBoat) {
      let diff = yaw - _activeBoat.yaw;
      while (diff >  Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      _activeBoat.yaw += diff * Math.min(1.2 * dt, 1.0);
      _activeBoat.mesh.rotation.y = _activeBoat.yaw;
      _activeBoat.mesh.position.set(_activeBoat.x, BOAT_FLOAT_Y, _activeBoat.z);
      playerX = _activeBoat.x; playerZ = _activeBoat.z;
    }

    // Walk animation
    animateAvatar(avatar, dt, !_onBoat && joyId !== null && Math.hypot(joyDX, joyDY) > DEAD);

    // Update avatar
    avatar.position.set(playerX, playerY, playerZ);
    avatar.rotation.y = yaw;

    // 3rd-person camera orbit (same formula as desktop, same wall pull-in)
    const lx = playerX;
    const ly = playerY + 1.2;
    const lz = playerZ;
    const camDist = clampedCamDist(lx, ly, lz, yaw, pitch);
    camera.position.x = lx + Math.sin(yaw) * Math.cos(pitch) * camDist;
    camera.position.y = ly + Math.sin(pitch) * camDist;
    camera.position.z = lz + Math.cos(yaw) * Math.cos(pitch) * camDist;
    if (!_swimming && camera.position.y < 0.1) camera.position.y = 0.1;   // the diving camera must go under
    guardCameraAboveTerrain(camera);
    camera.lookAt(lx, ly, lz);

    playerPosition.set(lx, ly, lz);

    // Auto-board: walk into any boat to board the nearest one
    if (!_onBoat && !_swimming && _boardCooldown <= 0 && _boats.length) {
      let nearest = null, bestDist = BOARD_RADIUS;
      for (const b of _boats) {
        const d = Math.hypot(playerX - b.x, playerZ - b.z);
        if (d < bestDist) { bestDist = d; nearest = b; }
      }
      if (nearest) { _activeBoat = nearest; _onBoat = true; _hasCastOff = false; playerY = BOAT_DECK_Y; vy = 0; }
    }
  }

  let nameSprite = null;

  function setColor(color, name) {
    if (avatar.userData.bodyMat) avatar.userData.bodyMat.color.setHex(color);
    if (nameSprite) {
      avatar.remove(nameSprite);
      nameSprite.material.map.dispose();
      nameSprite.material.dispose();
      nameSprite = null;
    }
    nameSprite = makeNameLabel(name);
    if (nameSprite) avatar.add(nameSprite);
  }

  function getState() {
    return { x: playerX, z: playerZ, ry: yaw };
  }

  function teleport(x, z, y) {
    playerX = x;
    playerZ = z;
    playerY = y ?? floorY(x, z);
    vy = 0;
  }

  const controls = { isLocked: true, lock() {}, unlock() {}, addEventListener() {} };

  return { controls, update, startMobile, setColor, playerPosition, getState, teleport, getAvatar: () => avatar };
}
