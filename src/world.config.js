// Single source of truth for world-level layout, atmosphere, and spawn.
// Add a landmark here and it automatically gets a tree-exclusion zone.

// ── World geometry ────────────────────────────────────────────────────────────
export const CLEARING_R = 62;    // radius of the open meadow
export const WORLD_R    = 460;   // forest outer radius

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
  fogDensity:   0.011,
  drawDistance: 750,
};

// ── Player spawn ──────────────────────────────────────────────────────────────
export const SPAWN = { x: 0, y: 1.75, z: -165 };
