import test from 'node:test';
import assert from 'node:assert/strict';
import { createMenuState } from '../src/menu-state.js';
import { clusterMarkers } from '../src/map-clusters.js';

test('entry ignores menu shortcuts until the player enters', () => {
  const state = createMenuState();
  state.register('map', { show() { assert.fail('entry opened a menu'); } });
  state.open('map'); state.pause();
  assert.equal(state.stage, 'entry');
});
test('switching map to journal closes the previous panel; pause closes all panels', () => {
  const visible = new Set();
  const state = createMenuState();
  for (const id of ['map', 'journal']) state.register(id, { show: open => open ? visible.add(id) : visible.delete(id) });
  state.play(); state.open('map'); state.open('journal');
  assert.deepEqual([...visible], ['journal']);
  state.pause();
  assert.equal(visible.size, 0);
  assert.equal(state.stage, 'pause');
  state.play(); assert.equal(state.active, null);
});
test('Daily shortcut changes journal tab without creating a second panel', () => {
  const state = createMenuState(); let current;
  state.register('journal', { show: (open, tab) => { if (open) current = tab; } });
  state.play(); state.open('journal', 4); state.toggle('journal', 2);
  assert.equal(current, 2); assert.equal(state.active, 'journal');
  state.toggle('journal'); assert.equal(state.stage, 'pause');
});
test('only the active panel receives its keyboard actions', () => {
  const state = createMenuState(); let calls = 0;
  state.register('journal', { show() {}, onKey() { calls++; return true; } });
  state.play(); state.key({}); assert.equal(calls, 0);
  state.open('journal'); assert.equal(state.key({}), true);
  state.pause(); state.key({}); assert.equal(calls, 1);
});
test('nearby map markers share a group without losing any discovered places', () => {
  const points = [{ id: 'spawn', x: 100, y: 100 }, { id: 'board', x: 103, y: 110 }, { id: 'castle', x: 30, y: 30 }];
  const groups = clusterMarkers(points);
  assert.equal(groups.length, 2);
  assert.deepEqual(groups[0].points.map(p => p.id), ['spawn', 'board']);
  assert.equal(groups.flatMap(g => g.points).length, points.length);
  assert.deepEqual(clusterMarkers([]), []);
});
