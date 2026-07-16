import { OCEAN, BIOMES } from './world.config.js';
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

// ── Ember Isle — volcanic island far offshore, reachable only by boat ─────────
export const ISLAND = { x: -700, z: 900, r: 58 };

export function inIsland(x, z) {
  return Math.hypot(x - ISLAND.x, z - ISLAND.z) < ISLAND.r;
}

// Cone rising from a sandy rim to a crater bowl at the top
export function islandHeight(x, z) {
  const d = Math.hypot(x - ISLAND.x, z - ISLAND.z);
  if (d >= ISLAND.r) return 0;
  const t = 1 - d / ISLAND.r;
  let h = 0.15 + Math.pow(t, 1.7) * 24;
  const crater = 1 - Math.min(1, d / 10);
  h -= crater * crater * 9;
  return h;
}

// ── Sky islands — float above the Icy Peaks, reached by riding updrafts ──────
export const SKY_ISLANDS = [
  { x: 330, z: -600, top: 64, r: 14 },
  { x: 296, z: -540, top: 80, r: 12 },
  { x: 256, z: -478, top: 96, r: 15 },
];
export const UPDRAFTS = [
  { x: 345, z: -628, r: 10, top: 72 },
  { x: 314, z: -570, r: 9,  top: 88 },
  { x: 276, z: -508, r: 9,  top: 104 },
];

// Solid ground on a sky island only counts when you're already up there —
// otherwise players walking beneath would snap to its surface.
export function skyFloorY(x, z, y) {
  for (const s of SKY_ISLANDS) {
    if (y > s.top - 2.5 && Math.hypot(x - s.x, z - s.z) < s.r) return s.top;
  }
  return -Infinity;
}

export function updraftAt(x, z, y) {
  for (const u of UPDRAFTS) {
    if (y < u.top && Math.hypot(x - u.x, z - u.z) < u.r) return u;
  }
  return null;
}

// ── Ancient Ruins central platform — plaza deck and altar tiers are solid ────
// Heights mirror the meshes in biomes.js buildRuins(): plaza cylinder top at
// +1.6, altar slabs at +3.0 and +4.2 over the plateau base. Edges are ramped
// (rubble skirt / worn steps) so the climb is a walk-up, not a teleport pop.
const RUINS_DECK = 1.6, RUINS_T1 = 3.0, RUINS_T2 = 4.2, RUINS_BEVEL = 0.45;

function ruinsPlatformY(x, z) {
  const dx = x - BIOMES.ruins.x, dz = z - BIOMES.ruins.z;
  const d = Math.hypot(dx, dz);
  if (d > 23) return -Infinity;
  const base = terrainHeight(BIOMES.ruins.x, BIOMES.ruins.z);
  const cheb = Math.max(Math.abs(dx), Math.abs(dz));   // altar slabs are square
  if (cheb <= 2.3 + RUINS_BEVEL) {
    const t = Math.min(1, (2.3 + RUINS_BEVEL - cheb) / RUINS_BEVEL);
    return base + RUINS_T1 + (RUINS_T2 - RUINS_T1) * t;
  }
  if (cheb <= 3.5 + RUINS_BEVEL) {
    const t = Math.min(1, (3.5 + RUINS_BEVEL - cheb) / RUINS_BEVEL);
    return base + RUINS_DECK + (RUINS_T1 - RUINS_DECK) * t;
  }
  if (d <= 21) return base + RUINS_DECK;
  const t = (23 - d) / 2;   // rubble skirt up onto the plaza rim
  return terrainHeight(x, z) * (1 - t) + (base + RUINS_DECK) * t;
}

// Returns the walkable surface height at (x, z)
export function groundY(x, z) {
  if (inIsland(x, z))           return islandHeight(x, z);
  const rp = ruinsPlatformY(x, z);
  if (rp > -Infinity)           return rp;
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
