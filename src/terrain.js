// Procedural terrain height field — value-noise fBm with a flat gameplay core.
// Everything that needs ground height (world mesh, trees, player collision,
// biome structures, portals) samples terrainHeight() so they always agree.
import { BIOMES } from './world.config.js';

// ── Deterministic hash noise ──────────────────────────────────────────────────
function hash(ix, iz) {
  let h = (ix * 374761393 + iz * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function noise2(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
  const a = hash(ix, iz),     b = hash(ix + 1, iz);
  const c = hash(ix, iz + 1), d = hash(ix + 1, iz + 1);
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;   // [0,1]
}

export function fbm(x, z, oct = 4) {
  let v = 0, amp = 0.5, f = 1, norm = 0;
  for (let i = 0; i < oct; i++) {
    v += noise2(x * f, z * f) * amp;
    norm += amp; amp *= 0.5; f *= 2.03;
  }
  return v / norm;   // [0,1]
}

export function smoothstep(a, b, t) {
  t = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

// ── Biome masks (0..1) — also used for ground vertex tinting ─────────────────
export function icyMask(x, z) {
  const d = Math.hypot(x - BIOMES.icy.x, z - BIOMES.icy.z);
  return 1 - smoothstep(BIOMES.icy.r * 0.35, BIOMES.icy.r, d);
}

export function ruinsMask(x, z) {
  const d = Math.hypot(x - BIOMES.ruins.x, z - BIOMES.ruins.z);
  return 1 - smoothstep(BIOMES.ruins.r * 0.55, BIOMES.ruins.r, d);
}

// ── Walkable terrain height at (x, z) ─────────────────────────────────────────
// Flat inside the gameplay core (building, clearing, pond, cave, volleyball)
// and across the beach/ocean band; rolling hills beyond; ridged peaks in the
// Icy Peaks biome; the Ancient Ruins plateau is levelled for its structures.
export function terrainHeight(x, z) {
  const r = Math.hypot(x, z);
  const coreMask  = smoothstep(175, 300, r);          // 0 in gameplay core
  const beachMask = 1 - smoothstep(830, 960, z - x);  // 0 approaching beach/water
  const m = coreMask * beachMask;
  if (m <= 0) return 0;

  // Rolling hills
  let h = Math.pow(fbm(x * 0.006, z * 0.006, 4), 1.5) * 22 * m;

  // Icy Peaks — dramatic ridged mountains
  const icy = icyMask(x, z);
  if (icy > 0) {
    const ridge = 1 - Math.abs(2 * fbm(x * 0.012 + 40, z * 0.012 - 17, 4) - 1);
    h += ridge * ridge * 30 * icy * beachMask;
  }

  // Ancient Ruins — flatten the plateau so columns sit level
  h *= 1 - ruinsMask(x, z) * 0.9;

  // Northkeep Castle — a raised square plateau (motte) with a carved moat
  // ring. Square (Chebyshev) bands so the ditch parallels the curtain walls.
  {
    const cheb = Math.max(Math.abs(x + 120), Math.abs(z + 520));
    if (cheb < 62) {
      const MOAT_IN = 37.5, MOAT_OUT = 46, YARD = 6;
      let target = YARD;
      if (cheb > MOAT_IN && cheb < MOAT_OUT) {
        const t = (cheb - MOAT_IN) / (MOAT_OUT - MOAT_IN);
        target = YARD - Math.sin(Math.min(1, t * 1.15) * Math.PI) * 2.8;   // ditch floor ≈ 3.2
      }
      const m = 1 - smoothstep(46, 62, cheb);
      h = h * (1 - m) + target * m;
    }
  }

  return h;
}
