// Persistence layer — localStorage today, Firestore-ready tomorrow.
//
// To upgrade to Firestore:
//   1. npm install firebase
//   2. Replace the _backend object below with Firestore read/write calls
//   3. All callers (fishing, bulletin, secrets, etc.) need zero changes
//
// Keys are namespaced under 'world3d:' to avoid clashing with other page data.

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
