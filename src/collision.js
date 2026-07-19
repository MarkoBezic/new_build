// Structure collision — the engine upgrade that lets buildings be solid.
//
// The world's base physics is a 2D heightmap (zones.groundY). That cannot
// express walls you bump into or rooms stacked above rooms. This module adds
// both, as data registered per structure:
//
//   walls:  { x0,x1,z0,z1,y0,y1 }        solid boxes — movement slides along them
//   floors: { x0,x1,z0,z1,top }          walkable surfaces (count only when the
//                                        player's feet are near/above `top`)
//   ramps:  { x0,x1,z0,z1,axis,h0,h1 }   stairs — height lerps along `axis`
//
// Each structure has a broadphase circle; players outside it pay zero cost.
// Any future building (castle, lighthouse, manor…) registers here and gets
// solid physics for free.

const STEP = 0.55;          // max ledge the player can step up without stairs
const BODY_R = 0.35;        // player capsule radius for wall tests
const structures = [];

export function addStructure({ x, z, r, walls = [], floors = [], ramps = [] }) {
  const s = { x, z, r, walls, floors, ramps };
  structures.push(s);
  return s;
}

function nearStructures(x, z, out) {
  out.length = 0;
  for (const s of structures) {
    const dx = x - s.x, dz = z - s.z;
    if (dx * dx + dz * dz < s.r * s.r) out.push(s);
  }
  return out;
}
const _near = [];

// Does a solid wall overlap the player capsule at (x, z) with feet at feetY?
// Body occupies feetY+0.15 … feetY+1.6 so floors underfoot never collide.
function hitsWall(s, x, z, feetY) {
  const lo = feetY + 0.15, hi = feetY + 1.6;
  for (const w of s.walls) {
    if (w.y1 < lo || w.y0 > hi) continue;
    if (x > w.x0 - BODY_R && x < w.x1 + BODY_R &&
        z > w.z0 - BODY_R && z < w.z1 + BODY_R) return true;
  }
  return false;
}

// Resolve a movement attempt (px,pz)→(nx,nz). Blocked axes are dropped
// individually, so pressing diagonally into a wall slides along it.
export function resolveMove(px, pz, nx, nz, feetY) {
  nearStructures(nx, nz, _near);
  if (_near.length === 0) return { x: nx, z: nz };
  let x = px, z = pz;
  let ok = true;
  for (const s of _near) if (hitsWall(s, nx, pz, feetY)) { ok = false; break; }
  if (ok) x = nx;
  ok = true;
  for (const s of _near) if (hitsWall(s, x, nz, feetY)) { ok = false; break; }
  if (ok) z = nz;
  return { x, z };
}

// Highest structure floor under (x, z) that the player can stand on given
// their current feet height — floors far above the head are ignored, so
// storeys stack. Returns -Infinity when no structure floor applies.
export function structureFloorY(x, z, feetY) {
  nearStructures(x, z, _near);
  let best = -Infinity;
  const reach = feetY + STEP;
  for (const s of _near) {
    for (const f of s.floors) {
      if (f.top <= reach && f.top > best &&
          x >= f.x0 && x <= f.x1 && z >= f.z0 && z <= f.z1) best = f.top;
    }
    for (const rp of s.ramps) {
      if (x < rp.x0 || x > rp.x1 || z < rp.z0 || z > rp.z1) continue;
      const t = rp.axis === 'x'
        ? (x - rp.x0) / (rp.x1 - rp.x0)
        : (z - rp.z0) / (rp.z1 - rp.z0);
      const h = rp.h0 + (rp.h1 - rp.h0) * t;
      if (h <= reach + 0.25 && h > best) best = h;
    }
  }
  return best;
}
