import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

// Run the real player controllers with lightweight DOM event targets, without WebGL.
const element = () => Object.assign(new EventTarget(), { style: {}, appendChild() {} });
globalThis.window = Object.assign(new EventTarget(), { innerWidth: 390, matchMedia: () => ({ matches: false }) });
globalThis.document = Object.assign(new EventTarget(), {
  body: { appendChild() {} }, activeElement: null,
  documentElement: { classList: { add() {}, toggle() {} } },
  createElement: element,
});
const desktop = await import('../src/player.js');
const event = (type, props) => Object.assign(new Event(type, { cancelable: true }), props);
function setup(api) {
  const camera = new THREE.PerspectiveCamera(78, 1, 0.1, 1400);
  camera.position.set(-560, 2, 780);
  const boat = { x: -560, z: 780, yaw: 0, mesh: new THREE.Group() };
  const canvas = element();
  api.setBoats([boat]);
  const player = api.createPlayer(new THREE.Scene(), camera, canvas);
  player.controls.lock(); // exercise the supported mouse-capture fallback
  player.teleport(boat.x, boat.z, 0.28);
  player.update(1 / 60);
  assert.equal(api.isOnBoat(), true, 'player boards the test boat');
  api.setSwimming(true);
  player.teleport(boat.x + 2.2, boat.z + 2.2, -8);
  player.update(1 / 60);
  return { player, boat, canvas };
}
function step(player, frames = 60) { for (let i = 0; i < frames; i++) player.update(1 / 60); }
function key(code, down) { window.dispatchEvent(event(down ? 'keydown' : 'keyup', { code, repeat: false })); }

test('desktop diver moves forward, sideways, down and up without moving the boat', () => {
  const { player, boat } = setup(desktop);
  const before = player.getState();
  key('KeyW', true); step(player); key('KeyW', false);
  assert.ok(player.getState().z < before.z - 6, 'forward stroke persists across frames');
  const x = player.getState().x;
  key('KeyD', true); step(player); key('KeyD', false);
  assert.ok(player.getState().x > x + 6, 'strafe moves independently of the boat');
  const y = player.playerPosition.y;
  key('KeyQ', true); step(player); key('KeyQ', false);
  assert.ok(player.playerPosition.y < y - 4, 'Q descends');
  key('Space', true); step(player); key('Space', false);
  assert.ok(Math.abs(player.playerPosition.y - y) < 0.05, 'Space rises');
  assert.deepEqual({ x: boat.x, z: boat.z }, { x: -560, z: 780 });
  const destination = desktop.getSurfacePosition(player.getState());
  desktop.setSwimming(false); player.teleport(destination.x, destination.z, 0.3); step(player);
  assert.equal(desktop.isOnBoat(), true);
  assert.equal(player.getState().x, boat.x);
  assert.equal(player.getState().z, boat.z);
  player.controls.unlock();
});

test('touch diver uses the joystick to explore and returns to the original boat', async () => {
  window.matchMedia = () => ({ matches: true });
  const mobile = await import('../src/player.js?touch-test');
  const { player, boat, canvas } = setup(mobile);
  const start = player.getState();
  canvas.dispatchEvent(event('touchstart', { changedTouches: [{ identifier: 1, clientX: 80, clientY: 500 }] }));
  canvas.dispatchEvent(event('touchmove', { changedTouches: [{ identifier: 1, clientX: 110, clientY: 460 }] }));
  step(player);
  assert.ok(player.getState().x > start.x + 3, 'joystick strafes underwater');
  assert.ok(player.getState().z < start.z - 4, 'joystick swims forward underwater');
  canvas.dispatchEvent(event('touchend', { changedTouches: [{ identifier: 1 }] }));
  const destination = mobile.getSurfacePosition(player.getState());
  mobile.setSwimming(false); player.teleport(destination.x, destination.z, 0.3); step(player);
  assert.equal(mobile.isOnBoat(), true);
  assert.equal(player.getState().x, boat.x);
  assert.equal(player.getState().z, boat.z);
});
