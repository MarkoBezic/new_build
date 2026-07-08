// Single source of truth for world-level layout, atmosphere, and spawn.
// Add a landmark here and it automatically gets a tree-exclusion zone.

// ── World geometry ────────────────────────────────────────────────────────────
export const CLEARING_R = 62;    // radius of the open meadow
export const WORLD_R    = 920;   // forest outer radius (doubled)

// ── Biome zones ───────────────────────────────────────────────────────────────
export const BIOMES = {
  icy:   { x: 350, z: -650, r: 220, label: 'Icy Peaks' },
  ruins: { x: 650, z:  150, r: 180, label: 'Ancient Ruins' },
};

// ── Landmark registry ─────────────────────────────────────────────────────────
// exclR: tree-exclusion radius around the landmark clearing
export const LANDMARKS = {
  pond:  { x: -160, z:  20, exclR: 33, label: 'POND' },
  cave:  { x:  160, z: -20, exclR: 36, label: 'CAVE' },
  // Biomes get their own themed vegetation — keep generic forest out
  icy:   { x: BIOMES.icy.x,   z: BIOMES.icy.z,   exclR: BIOMES.icy.r + 15,   label: '' },
  ruins: { x: BIOMES.ruins.x, z: BIOMES.ruins.z, exclR: BIOMES.ruins.r + 15, label: '' },
  // Keep the warp-gate plaza and spawn circle clear of trees
  gate:  { x: 0, z: -130, exclR: 28, label: '' },
  spawn: { x: 0, z: -165, exclR: 24, label: '' },
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
  coast:      1100,   // z−x=coast defines the shoreline; must be > WORLD_R so both
  beachWidth:   80,   // endpoints stay inside the SW quadrant (x<0, z>0)
  waterColor:  0x1A73A8,
  beachColor:  0xD4BC7A,
};

// ── Player spawn ──────────────────────────────────────────────────────────────
export const SPAWN = { x: 0, y: 1.75, z: -165 };
