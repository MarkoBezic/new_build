// Race courses — the single source of truth for every circuit in the world.
//
// race.js reads checkpoints and waypoint names from here, trail.js lays the
// physical marker posts along the same legs, and world.js clears trees from
// the corridor so the track reads as a worn path. Because all three consume
// one definition, the visible route can never drift from the real one.
//
// Adding a course: define it here, then create a race with it (and set
// `trail: true` if it runs across open ground that needs marking).

export const COURSES = {
  meadow: {
    key:   'race:best',
    label: 'Meadow Circuit',
    trail: true,                       // lay posts + clear a corridor
    start: { x: 8, z: -136 },
    course: [
      { x: -150, z:   12, name: 'The Pond' },
      { x:   30, z:  130, name: 'South Meadow' },
      { x:  152, z:  -18, name: 'Cave Mouth' },
      { x:    8, z: -136, name: 'The Finish Flag' },
    ],
  },
  sky: {
    // Launch from the highest sky island (where the Cloud Wisp sits) and ride
    // the glider down a descending line of hoops out of the peaks. Verified
    // against the glider's ~4.4:1 glide ratio: 260 m of travel for 72 m of
    // descent uses 82 % of the budget, with ≥14 m of terrain clearance.
    key:      'race:sky',
    label:    'Sky Circuit',
    aerial:   true,
    heightAt: () => 96,                // the top sky island's deck
    start: { x: 256, z: -478 },
    // Altitudes track the glider's real sink (leg × 0.227) set a couple of
    // metres low, so a clean line threads the upper half of each hoop and a
    // sloppy one can still drop into it — being high is recoverable, low is not
    course: [
      { x: 228, z: -442, y: 84, name: 'First Hoop' },
      { x: 196, z: -404, y: 72, name: 'Second Hoop' },
      { x: 162, z: -364, y: 60, name: 'Third Hoop' },
      { x: 126, z: -322, y: 47, name: 'Fourth Hoop' },
      { x:  88, z: -280, y: 34, name: 'The Last Gate' },
    ],
  },
  rampart: {
    // The battlements are already a physical loop, so no trail is needed.
    key:      'race:rampart',
    label:    'Rampart Run',
    heightAt: () => 13.2,              // wall-walk height
    start: { x: -120, z: -484 },
    course: [
      { x: -156, z: -520, name: 'West Tower' },
      { x: -120, z: -556, name: 'North Wall-Walk' },
      { x:  -84, z: -520, name: 'East Tower' },
      { x: -120, z: -484, name: 'The Gatehouse' },
    ],
  },
};

// Legs of a course as [from, to] pairs: start → cp1 → … → last checkpoint.
export function legs(def) {
  const pts = [def.start, ...def.course];
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) out.push([pts[i], pts[i + 1]]);
  return out;
}

function segDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const len2 = dx * dx + dz * dz;
  let t = len2 > 0 ? ((px - ax) * dx + (pz - az) * dz) / len2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}

// Shortest distance from (x, z) to a course's path — used to clear the
// tree corridor and to keep scenery off the track.
export function routeDistance(x, z, def) {
  let best = Infinity;
  for (const [a, b] of legs(def)) {
    const d = segDist(x, z, a.x, a.z, b.x, b.z);
    if (d < best) best = d;
  }
  return best;
}
