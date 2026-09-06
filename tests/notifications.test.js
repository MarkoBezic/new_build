import test from 'node:test';
import assert from 'node:assert/strict';
import { toast } from '../src/hud.js';

test('expired toasts cannot corrupt the cap after a burst evicts them', t => {
  const callbacks = [];
  const element = () => ({
    style: {}, children: [], parent: null,
    get childElementCount() { return this.children.length; },
    get firstChild() { return this.children[0]; },
    appendChild(child) { child.parent = this; this.children.push(child); },
    remove() {
      if (!this.parent) return;
      this.parent.children = this.parent.children.filter(c => c !== this);
      this.parent = null;
    },
  });
  const body = element();
  const previousDocument = globalThis.document;
  globalThis.document = { body, createElement: element };
  t.after(() => {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  });
  t.mock.method(globalThis, 'setTimeout', callback => { callbacks.push(callback); });
  for (let i = 0; i < 6; i++) toast(`first burst ${i}`);
  const lane = body.firstChild;
  assert.equal(lane.childElementCount, 3);
  // The three evicted messages finish their timers while newer ones remain.
  callbacks.slice(0, 6).forEach(callback => callback());
  for (let i = 0; i < 5; i++) toast(`second burst ${i}`);
  assert.equal(lane.childElementCount, 3);
  assert.deepEqual(lane.children.map(c => c.textContent), ['second burst 2', 'second burst 3', 'second burst 4']);
});
