import { OCEAN } from './world.config.js';
import { terrainHeight } from './terrain.js';

// ── Surface heights ────────────────────────────────────────────────────────────
export const GROUND_Y = {
  default:  0,
  beach:    0.15,
  building: 0.25,
};

// ── Shore diagonals (z − x convention) ───────────────────────────────────────
export const SHORE       = OCEAN.coast;                     // 1100 — z−x where water begins
export const BEACH_INNER = OCEAN.coast - OCEAN.beachWidth;  // 1020 — z−x where beach begins
export const BEACH_STOP  = SHORE - 1;                       // 1099 — boat beach threshold (~75% beached)

// ── Named zones ───────────────────────────────────────────────────────────────
export const ZONE = {
  building: {
    test:    (x, z) => Math.abs(x) < 22.5 && Math.abs(z) < 22.5,
    groundY: GROUND_Y.building,
  },
  beach: {
    test:    (x, z) => { const d = z - x; return d > BEACH_INNER && d < SHORE; },
    groundY: GROUND_Y.beach,
  },
  water: {
    test:    (x, z) => (z - x) >= SHORE,
    groundY: null,  // not walkable without a boat
  },
};

// Returns the walkable surface height at (x, z)
export function groundY(x, z) {
  if (ZONE.building.test(x, z)) return GROUND_Y.building;
  if (ZONE.beach.test(x, z))    return GROUND_Y.beach;
  return terrainHeight(x, z);   // 0 in the flat core, hills beyond
}

// ── Geese roam regions ────────────────────────────────────────────────────────
export const GEESE_REGIONS = [
  { name: 'north-parking',    x0: -26,  x1:  26,  z0: -59, z1: -27, groundY: GROUND_Y.default },
  { name: 'south-parking',    x0: -18,  x1:  18,  z0:  27, z1:  47, groundY: GROUND_Y.default },
  { name: 'approach',         x0: -22,  x1:  22,  z0: -65, z1: -38, groundY: GROUND_Y.default },
  { name: 'beach-portal',     x0: -505, x1: -458, z0: 553, z1: 594, groundY: GROUND_Y.beach   },
  { name: 'beach-volleyball', x0: -480, x1: -434, z0: 577, z1: 622, groundY: GROUND_Y.beach   },
];

// ── Boat spawn positions — idle boats float just offshore (z − x = 1103),
//    still within boarding reach (2.5) of the walkable shoreline ─────────────
export const BOAT_SPAWNS = [
  { x: -504, z: 599, yaw: Math.PI * 0.75 },  // primary rideable boat
  { x: -485, z: 618, yaw: Math.PI * 0.68 },
  { x: -561, z: 542, yaw: Math.PI * 0.81 },
  { x: -598, z: 505, yaw: Math.PI * 0.72 },
];
