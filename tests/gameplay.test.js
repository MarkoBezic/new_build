import test from 'node:test';
import assert from 'node:assert/strict';
import { createJumpInput } from '../src/jump-input.js';

test('a late ledge jump works inside the grace period, but not after it', () => {
  const jump = createJumpInput();
  jump.update(0.016, true);
  jump.update(0.06, false);
  jump.press();
  assert.equal(jump.consume(), true);
  jump.update(0.016, true);
  jump.update(0.11, false);
  jump.press();
  assert.equal(jump.consume(), false);
});

test('pressing just before landing queues one jump', () => {
  const jump = createJumpInput();
  jump.press();
  jump.update(0.05, false);
  assert.equal(jump.consume(), false);
  jump.update(0.016, true);
  assert.equal(jump.consume(), true);
  assert.equal(jump.consume(), false);
});

test('an old airborne press does not cause an unexpected landing jump', () => {
  const jump = createJumpInput();
  jump.press();
  jump.update(0.16, false);
  jump.update(0.016, true);
  assert.equal(jump.consume(), false);
});

test('jumping spends the ledge grace period so a second press cannot double jump', () => {
  const jump = createJumpInput();
  jump.update(0.016, true);
  jump.press();
  assert.equal(jump.consume(), true);
  jump.press();
  jump.update(0.016, false);
  assert.equal(jump.consume(), false);
});

test('pausing or teleporting clears queued jumps', () => {
  const jump = createJumpInput();
  jump.update(0.016, true);
  jump.press();
  jump.reset();
  jump.update(0.016, true);
  assert.equal(jump.consume(), false);
});
