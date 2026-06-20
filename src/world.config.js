// Single source of truth for world-level layout, atmosphere, and spawn.
// Add a landmark here and it automatically gets a tree-exclusion zone.

// ── World geometry ────────────────────────────────────────────────────────────
export const CLEARING_R = 62;    // radius of the open meadow
export const WORLD_R    = 920;   // forest outer radius (doubled)

// ── Landmark registry ─────────────────────────────────────────────────────────
// exclR: tree-exclusion radius around the landmark clearing
export const LANDMARKS = {
  pond: { x: -160, z:  20, exclR: 33, label: 'POND' },
  cave: { x:  160, z: -20, exclR: 36, label: 'CAVE' },
};

// ── Atmosphere ────────────────────────────────────────────────────────────────
export const ATMOSPHERE = {
  skyColor:     0x8ABFDE,
  fogColor:     0x5A7A48,
  fogDensity:   0.006,    // reduced — bigger world needs more visibility
  drawDistance: 1400,
};

// ── Ocean (south-west corner, where z − x > coast) ────────────────────────────
// coast: the z−x value that defines the shoreline
// beachWidth: width of the sandy strip on the forest side of the shore
export const OCEAN = {
  coast:      900,
  beachWidth:  80,
  waterColor:  0x1A73A8,
  beachColor:  0xD4BC7A,
};

// ── Player spawn ──────────────────────────────────────────────────────────────
export const SPAWN = { x: 0, y: 1.75, z: -165 };
