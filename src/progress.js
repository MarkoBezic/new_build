import { save, load } from './persistence.js';

// Personal progression — collected shards, journal tablets, unlocked trails,
// discovered map locations, the Warden's Crown. Persisted per device.
const KEY = 'progress';

const state = Object.assign(
  { shards: [], tablets: [], trails: ['none'], trail: 'none', crown: false, found: [] },
  load(KEY, {}),
);

function persist() { save(KEY, state); }

// Lazily create any list the first time it's used, so new collections
// (letters, and whatever comes next) need no edit here.
function list(name) {
  let l = state[name];
  if (!Array.isArray(l)) l = state[name] = [];
  return l;
}

export const progress = {
  has:   (name, id) => list(name).includes(id),
  add(name, id) {
    const l = list(name);
    if (l.includes(id)) return false;
    l.push(id);
    persist();
    return true;
  },
  count: (name) => list(name).length,
  get:   (k) => state[k],
  set(k, v) { state[k] = v; persist(); },
};
