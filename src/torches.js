import * as THREE from 'three';

// ── Torch placement ───────────────────────────────────────────────────────────
// gy = ground Y at that location (0 = grass/forest, 0.15 = beach sand)
// Beach strip: z−x is between 1020 and 1100
const POSITIONS = [
  // Flanking spawn (SPAWN is at z = −165)
  { x:  11, z: -153, gy: 0    },
  { x: -11, z: -153, gy: 0    },

  // Building entrance (north face z ≈ −22), pairs either side of the door
  { x:  11, z:  -27, gy: 0    },
  { x: -11, z:  -27, gy: 0    },

  // Path to beach — four waypoints along the diagonal toward (−480, 572),
  // alternating left/right of the line for an organic, lit-lane feel
  { x:  -92, z: 117, gy: 0    },   // 20 % — right of path
  { x: -196, z: 226, gy: 0    },   // 40 % — left of path
  { x: -284, z: 346, gy: 0    },   // 60 % — right of path
  { x: -388, z: 455, gy: 0    },   // 80 % — left of path

  // Beach approach (forest side, z−x ≈ 950)
  { x: -420, z: 528, gy: 0    },

  // Campfire area (beach strip, z−x ≈ 1043−1070)
  { x: -453, z: 563, gy: 0.15 },
  { x: -477, z: 593, gy: 0.15 },

  // Near beach portal / volleyball court (beach strip, z−x ≈ 1050)
  { x: -480, z: 570, gy: 0.15 },
];

// ── Torch mesh ────────────────────────────────────────────────────────────────
const POLE_H     = 1.85;
const POLE_MAT   = new THREE.MeshLambertMaterial({ color: 0x9B7A2E });  // bamboo
const HEAD_MAT   = new THREE.MeshLambertMaterial({ color: 0x3A2008 });  // dark bowl
const OUTER_MAT  = new THREE.MeshLambertMaterial({
  color: 0xFF6600,
  emissive: new THREE.Color(0xFF3300),
  emissiveIntensity: 0.5,
});
const INNER_MAT  = new THREE.MeshLambertMaterial({
  color: 0xFFDD00,
  emissive: new THREE.Color(0xFFAA00),
  emissiveIntensity: 0.8,
});

const _poleGeo  = new THREE.CylinderGeometry(0.033, 0.055, POLE_H, 7);
const _headGeo  = new THREE.CylinderGeometry(0.13, 0.085, 0.22, 8);
const _outerGeo = new THREE.ConeGeometry(0.072, 0.28, 6);
const _innerGeo = new THREE.ConeGeometry(0.038, 0.17, 6);

function buildTorch(scene, x, gy, z) {
  const g = new THREE.Group();

  // Pole
  const pole = new THREE.Mesh(_poleGeo, POLE_MAT);
  pole.position.y = gy + POLE_H / 2;
  pole.castShadow = true;
  g.add(pole);

  // Bowl / head
  const head = new THREE.Mesh(_headGeo, HEAD_MAT);
  head.position.y = gy + POLE_H + 0.11;
  head.castShadow = true;
  g.add(head);

  // Outer flame
  const flameOuter = new THREE.Mesh(_outerGeo, OUTER_MAT.clone());
  flameOuter.position.y = gy + POLE_H + 0.22 + 0.14;
  g.add(flameOuter);

  // Inner flame
  const flameInner = new THREE.Mesh(_innerGeo, INNER_MAT.clone());
  flameInner.position.y = gy + POLE_H + 0.22 + 0.085;
  g.add(flameInner);

  // Point light — no shadow casting (performance)
  const light = new THREE.PointLight(0xFF7722, 0, 16);
  light.position.y = gy + POLE_H + 0.40;
  g.add(light);

  g.position.set(x, 0, z);
  scene.add(g);

  return { flameOuter, flameInner, light };
}

// ── Public API ────────────────────────────────────────────────────────────────
export function createTorches(scene) {
  const torches = POSITIONS.map(({ x, z, gy }) => buildTorch(scene, x, gy, z));

  function update(nowSec, dayFactor) {
    const nightFactor = 1 - dayFactor;

    torches.forEach((t, i) => {
      // Each torch gets a different phase offset so they don't all flicker in sync
      const off = i * 0.91;
      const flicker = 0.80
        + Math.sin((nowSec + off) * 6.5)  * 0.11
        + Math.sin((nowSec + off) * 13.7) * 0.09;

      // Light: off during full day, gradually brightens as night falls
      t.light.intensity = nightFactor * 1.6 * flicker;

      // Flames: always slightly present, grow brighter and more active at night
      const fs = (0.25 + nightFactor * 0.75) * flicker;
      t.flameOuter.scale.y = fs;
      t.flameOuter.scale.x = t.flameOuter.scale.z =
        0.85 + Math.sin((nowSec + off) * 9.3)  * 0.15;
      t.flameInner.scale.y = fs * 0.88;
      t.flameInner.scale.x = t.flameInner.scale.z =
        0.90 + Math.sin((nowSec + off) * 11.8) * 0.10;
    });
  }

  return { update };
}
