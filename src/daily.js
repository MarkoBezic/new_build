// Date-seeded deterministic randomness — every player computes the same
// "daily" world state locally, so shared daily content needs no server.
// Day boundaries follow the world's Toronto clock (same as the sun).

// Assembled from formatToParts so the key is identical on every engine —
// locale-formatted strings (e.g. en-CA) differ between browsers and Node,
// which would give players different daily seeds.
const _dayFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
});

export function dayKey(date = new Date()) {
  const p = {};
  for (const { type, value } of _dayFmt.formatToParts(date)) p[type] = value;
  return `${p.year}-${p.month}-${p.day}`;        // YYYY-MM-DD
}

export function yesterdayKey(date = new Date()) {
  return dayKey(new Date(date.getTime() - 86_400_000));
}

// FNV-1a string hash → 32-bit seed
export function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// mulberry32 — tiny seeded PRNG, returns a () => [0,1) function
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Seeded RNG for one named daily system, e.g. dailyRng('treasure')
export function dailyRng(tag, date = new Date()) {
  return mulberry32(hashStr(dayKey(date) + ':' + tag));
}
