import * as THREE from 'three';

// ── Landmark world positions (used by world.js for tree exclusion & minimap) ──
export const POND_CENTER = { x: -160, z:  20 };   // west
export const CAVE_CENTER = { x:  160, z: -20 };   // east

// ════════════════════════════════════════════════════════════════════════════
//  HELPER
// ════════════════════════════════════════════════════════════════════════════
function box(parent, w, h, d, mat, cx, cy, cz) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(cx, cy, cz);
  m.castShadow    = true;
  m.receiveShadow = true;
  parent.add(m);
}

function disc(scene, r, color, x, y, z, segs = 32) {
  const m = new THREE.Mesh(
    new THREE.CircleGeometry(r, segs),
    new THREE.MeshLambertMaterial({ color }),
  );
  m.rotation.x    = -Math.PI / 2;
  m.position.set(x, y, z);
  m.receiveShadow = true;
  scene.add(m);
}

// ════════════════════════════════════════════════════════════════════════════
//  POND  (west, x ≈ −160)
// ════════════════════════════════════════════════════════════════════════════
function buildPond(scene) {
  const px = POND_CENTER.x, pz = POND_CENTER.z;

  // Grassy clearing around water
  disc(scene, 32, 0x52A040, px, 0.008, pz);

  // Water surface
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(36, 22),
    new THREE.MeshPhongMaterial({
      color: 0x1A5276, specular: new THREE.Color(0x5DADE2),
      shininess: 160, transparent: true, opacity: 0.86,
    }),
  );
  water.rotation.x    = -Math.PI / 2;
  water.position.set(px, 0.14, pz);
  water.receiveShadow = true;
  scene.add(water);

  // Shore rocks
  const rock = new THREE.MeshLambertMaterial({ color: 0x7A7568 });
  [
    [-19, -2, 3.5, 1.6, 2.5],
    [-16,  6, 2.5, 1.0, 2.0],
    [ 18,  4, 3.0, 1.3, 2.2],
    [ 15, -6, 2.5, 0.9, 2.0],
    [  1,-12, 4.0, 1.5, 2.2],
    [ -6, 12, 3.2, 1.0, 2.5],
    [  9, 11, 2.5, 1.2, 1.6],
    [-12, -9, 2.2, 0.9, 1.8],
    [ -3, -13, 3.0, 1.1, 2.0],
  ].forEach(([rx, rz, rw, rh, rd]) =>
    box(scene, rw, rh, rd, rock, px + rx, rh * 0.5, pz + rz),
  );

  // Reeds (blocky Minecraft style)
  const reed = new THREE.MeshLambertMaterial({ color: 0x2D5016 });
  [[-14, 9], [-12, 11], [11, -10], [13, -12], [-4, -11], [6, 11], [-8, -10], [10, 8]].forEach(
    ([rx, rz]) => {
      const h = 1.5 + Math.random() * 1.8;
      box(scene, 0.28, h, 0.28, reed, px + rx, h * 0.5, pz + rz);
    },
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  ROCK FORMATION + CAVE  (east, x ≈ +160)
//  Cave entrance faces west (−X), toward the clearing.
// ════════════════════════════════════════════════════════════════════════════
function buildRockCave(scene) {
  const cx = CAVE_CENTER.x, cz = CAVE_CENTER.z;

  const rock  = new THREE.MeshLambertMaterial({ color: 0x6A6258 });
  const dark  = new THREE.MeshLambertMaterial({ color: 0x484038 });
  const void_ = new THREE.MeshLambertMaterial({ color: 0x060606 });

  // Rocky ground clearing
  disc(scene, 34, 0x3C3830, cx, 0.009, cz, 24);

  // ── Cliff mass ──────────────────────────────────────────────────────────
  box(scene, 16, 14, 28, rock, cx + 6,  7,  cz);    // central cliff
  box(scene, 10, 10, 20, dark, cx + 4, 16,  cz);    // upper tier
  box(scene,  8,  6, 14, rock, cx + 2, 24,  cz);    // peak cap

  // ── Cave entrance walls + lintel ────────────────────────────────────────
  box(scene,  6,  9,  6, dark, cx - 1, 4.5, cz - 9);   // south pillar
  box(scene,  6,  9,  6, dark, cx - 1, 4.5, cz + 9);   // north pillar
  box(scene,  6,  5, 20, dark, cx - 1, 11.5, cz);       // lintel slab
  // Cave void (near-black, creates illusion of depth)
  box(scene, 14,  8, 12, void_, cx + 5, 4,   cz);

  // ── Side boulder stacks ─────────────────────────────────────────────────
  box(scene,  7,  7,  8, dark, cx + 2, 3.5, cz - 15);
  box(scene,  5,  4,  5, rock, cx + 4, 7,   cz - 13);
  box(scene,  8,  6,  7, dark, cx + 2, 3,   cz + 15);
  box(scene,  5,  4,  5, rock, cx + 3, 7,   cz + 13);

  // ── Foreground scattered rocks ──────────────────────────────────────────
  box(scene, 5, 2.5, 4, rock, cx -  8, 1.25, cz +  3);
  box(scene, 4, 3.0, 3, dark, cx - 10, 1.5,  cz -  5);
  box(scene, 6, 2.0, 5, rock, cx -  7, 1.0,  cz + 10);
  box(scene, 3, 2.0, 3, rock, cx -  9, 1.0,  cz - 12);
  box(scene, 4, 2.5, 4, dark, cx -  5, 1.25, cz - 15);
}

// ════════════════════════════════════════════════════════════════════════════
//  PUBLIC ENTRY
// ════════════════════════════════════════════════════════════════════════════
export function buildLandmarks(scene) {
  buildPond(scene);
  buildRockCave(scene);
}
