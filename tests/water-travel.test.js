import test from 'node:test';
import assert from 'node:assert/strict';
import { createWaterTravel } from '../src/water-travel.js';

test('diving releases boat ownership so swimming coordinates are not overwritten', () => {
  const travel = createWaterTravel();
  const boat = { x: -560, z: 780 };
  Object.assign(travel, { boat, onBoat: true, hasCastOff: true });
  travel.setSwimming(true);
  assert.equal(travel.swimming, true);
  assert.equal(travel.onBoat, false);
  assert.equal(travel.hasCastOff, false);
  assert.ok(travel.boardCooldown > 0);
  const diver = { x: -545, z: 810 };
  // This is the boat synchronization condition used by both player controllers.
  if (travel.onBoat && travel.boat) Object.assign(diver, travel.boat);
  assert.deepEqual(diver, { x: -545, z: 810 });
  assert.deepEqual(boat, { x: -560, z: 780 });
});
test('surfacing after exploring returns to the retained boat, including repeated dives', () => {
  const travel = createWaterTravel();
  travel.boat = { x: -560, z: 780 };
  travel.onBoat = true;
  for (let i = 0; i < 2; i++) {
    travel.setSwimming(true);
    assert.deepEqual(travel.surfacePosition({ x: -530, z: 865 }), { x: -560, z: 780 });
    travel.setSwimming(false);
    assert.equal(travel.swimming, false);
    assert.equal(travel.onBoat, true);
  }
});
test('a swimmer without a boat surfaces at their own position', () => {
  const travel = createWaterTravel();
  travel.setSwimming(true);
  assert.deepEqual(travel.surfacePosition({ x: 2, z: 3 }), { x: 2, z: 3 });
  travel.setSwimming(false);
  assert.equal(travel.onBoat, false);
});
