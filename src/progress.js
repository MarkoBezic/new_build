import { save, load } from './persistence.js';

// Personal progression — collected shards, journal tablets, unlocked trails,
// discovered map locations, the Warden's Crown. Persisted per device.
const KEY = 'progress';

const state = Object.assign(
  { shards: [], tablets: [], trails: ['none'], trail: 'none', crown: false, found: [] },
  load(KEY, {}),
);

function persist() { save(KEY, state); }

export const progress = {
  has:   (list, id) => state[list].includes(id),
  add(list, id) {
    if (state[list].includes(id)) return false;
    state[list].push(id);
    persist();
    return true;
  },
  count: (list) => state[list].length,
  get:   (k) => state[k],
  set(k, v) { state[k] = v; persist(); },
};
