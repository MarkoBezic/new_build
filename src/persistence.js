// Persistence layer — device-local via localStorage.
//
// localStorage persists per-device/per-browser. That is the right scope for
// PERSONAL progression (collected shards, journal entries, unlocked
// cosmetics, discovered map locations). Shared world state would need a real
// backend (e.g. Firestore) — swap the backend below; callers need zero changes.

const NS = 'world3d:';

const _backend = {
  get(key) {
    try {
      const raw = localStorage.getItem(NS + key);
      return raw === null ? undefined : JSON.parse(raw);
    } catch { return undefined; }
  },
  set(key, value) {
    try { localStorage.setItem(NS + key, JSON.stringify(value)); } catch {}
  },
  remove(key) {
    try { localStorage.removeItem(NS + key); } catch {}
  },
};

// Save any JSON-serialisable value under a namespaced key.
export function save(key, value) {
  _backend.set(key, value);
}

// Load a value; returns defaultValue if nothing is stored yet.
export function load(key, defaultValue = null) {
  const v = _backend.get(key);
  return v === undefined ? defaultValue : v;
}

// Remove a stored value.
export function remove(key) {
  _backend.remove(key);
}

// Append an item to a stored array (creates the array if absent).
// Optionally caps the array to maxLen most-recent entries.
export function append(key, item, maxLen = Infinity) {
  const arr = load(key, []);
  arr.push(item);
  save(key, maxLen < Infinity ? arr.slice(-maxLen) : arr);
}
