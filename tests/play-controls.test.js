import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlayControls } from '../src/play-controls.js';
const event = (name, props = {}) => Object.assign(new Event(name), props);
function setup(request) {
  const canvas = new EventTarget(), doc = new EventTarget(), win = new EventTarget();
  canvas.requestPointerLock = request;
  doc.exitPointerLock = () => { doc.pointerLockElement = null; doc.dispatchEvent(new Event('pointerlockchange')); };
  return { canvas, doc, win, controls: createPlayControls(canvas, doc, win) };
}
test('rejected capture starts fallback exactly once and can pause/resume', async () => {
  const { controls, doc } = setup(() => Promise.reject(new Error('unsupported')));
  let starts = 0;
  controls.addEventListener('lock', () => starts++);
  controls.lock();
  doc.dispatchEvent(new Event('pointerlockerror'));
  await Promise.resolve();
  assert.equal(starts, 1);
  assert.equal(controls.isLocked, true);
  assert.equal(controls.dragLook, true);
  controls.unlock();
  assert.equal(controls.isLocked, false);
  controls.lock();
  assert.equal(starts, 2);
});
test('fallback mouse look requires holding the right button', () => {
  const { controls, canvas, doc } = setup(undefined);
  controls.lock();
  assert.equal(controls.canLook, false);
  canvas.dispatchEvent(event('mousedown', { button: 2 }));
  assert.equal(controls.canLook, true);
  doc.dispatchEvent(event('mouseup', { button: 2 }));
  assert.equal(controls.canLook, false);
});
test('native capture still uses free mouse look and unlocks normally', () => {
  const { controls, canvas, doc } = setup(() => {});
  controls.lock();
  assert.equal(controls.isLocked, false);
  doc.pointerLockElement = canvas;
  doc.dispatchEvent(new Event('pointerlockchange'));
  assert.equal(controls.isLocked, true);
  assert.equal(controls.dragLook, false);
  assert.equal(controls.canLook, true);
  controls.unlock();
  assert.equal(controls.isLocked, false);
});
test('a late rejection cannot restart gameplay after Escape', async () => {
  let reject;
  const { controls, win } = setup(() => new Promise((_, no) => { reject = no; }));
  controls.lock();
  win.dispatchEvent(event('keydown', { code: 'Escape' }));
  reject(new Error('late failure'));
  await Promise.resolve();
  assert.equal(controls.isLocked, false);
});
test('losing focus pauses fallback and clears drag look', () => {
  const { controls, canvas, win } = setup(() => { throw new Error('denied'); });
  controls.lock();
  canvas.dispatchEvent(event('mousedown', { button: 2 }));
  win.dispatchEvent(new Event('blur'));
  assert.equal(controls.isLocked, false);
  assert.equal(controls.canLook, false);
});
