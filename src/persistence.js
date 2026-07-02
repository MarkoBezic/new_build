// Persistence layer — DISABLED for now.
//
// localStorage only persists per-device/per-browser, not shared across all
// users, so the feature is parked until a real shared backend (e.g. Firestore)
// is added. The save/load/append API below still works within a single
// session via an in-memory store, but nothing survives a page reload.
//
// To re-enable device-local persistence, restore the localStorage backend
// commented out below. To make state shared across ALL users, replace it
// with server-side read/write calls instead — callers need zero changes.

// const NS = 'world3d:';
//
// const _backend = {
//   get(key) {
//     try {
//       const raw = localStorage.getItem(NS + key);
//       return raw === null ? undefined : JSON.parse(raw);
//     } catch { return undefined; }
//   },
//   set(key, value) {
//     try { localStorage.setItem(NS + key, JSON.stringify(value)); } catch {}
//   },
//   remove(key) {
//     try { localStorage.removeItem(NS + key); } catch {}
//   },
// };

// In-memory stand-in — same shape as the real backend, session-only.
const _mem = new Map();
const _backend = {
  get(key)        { return _mem.get(key); },
  set(key, value) { _mem.set(key, value); },
  remove(key)     { _mem.delete(key); },
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
