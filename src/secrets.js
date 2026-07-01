import * as THREE from 'three';
import { save, load } from './persistence.js';

// ── Secret locations ──────────────────────────────────────────────────────────
// Each secret is a small hidden area reachable only by boat (z−x > 1100).
// Discovered state is persisted per-device so the minimap stays marked.
export const SECRET_LOCATIONS = [
  {
    id:    'sea-cave',
    label: 'Sea Cave',
    // Rocky outcrop ~80 m offshore from the main beach
    x: -560, z: 700,   // z−x = 1260 — well into water
    description: 'A hidden cave carved into a sea stack. Something glitters inside.',
    radius: 12,         // discovery radius — must sail within this
  },
  {
    id:    'shipwreck',
    label: 'Shipwreck',
    x: -440, z: 620,   // z−x = 1060 — just offshore, near volleyball side
    description: 'The remains of an old wooden vessel, half-submerged.',
    radius: 10,
  },
];

// ── Materials ─────────────────────────────────────────────────────────────────
const ROCK_MAT  = new THREE.MeshLambertMaterial({ color: 0x6A6055 });
const DARK_MAT  = new THREE.MeshLambertMaterial({ color: 0x2A2520 });
const MOSS_MAT  = new THREE.MeshLambertMaterial({ color: 0x3D5A2A });
const WOOD_MAT  = new THREE.MeshLambertMaterial({ color: 0x5A3A1A });
const PLANK_MAT = new THREE.MeshLambertMaterial({ color: 0x7A5030 });

function box(parent, w, h, d, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  parent.add(m);
  return m;
}

// ── Sea Cave geometry ─────────────────────────────────────────────────────────
function buildSeaCave(scene, cx, cz) {
  const g = new THREE.Group();

  // Main sea stack — tall rocky column
  box(g, 8, 14, 9, ROCK_MAT,  0, 7,  0);
  box(g, 5, 10, 6, DARK_MAT, -1, 5,  0);   // shadowed face

  // Arch / cave mouth (two side pillars + overhang)
  box(g, 2, 8, 3, ROCK_MAT, -3.5, 4, 4);   // left pillar
  box(g, 2, 8, 3, ROCK_MAT,  3.5, 4, 4);   // right pillar
  box(g, 9, 2, 3, ROCK_MAT,  0,   8.5, 4); // lintel

  // Smaller surrounding rocks
  box(g, 4, 5, 4, ROCK_MAT,  7, 2.5, 1);
  box(g, 3, 3, 3, ROCK_MAT, -7, 1.5, 2);
  box(g, 5, 4, 3, ROCK_MAT,  2, 2,   7);

  // Moss patches on top
  box(g, 7, 0.4, 8, MOSS_MAT, 0, 14.2, 0);
  box(g, 3, 0.3, 3, MOSS_MAT, 3, 10.3, -2);

  // Glittering chest inside (just a colourful box)
  const chestMat = new THREE.MeshLambertMaterial({ color: 0xFFD700, emissive: 0xAA8800, emissiveIntensity: 0.4 });
  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7, 0.6), chestMat);
  chest.position.set(0, 0.35, 2);
  chest.castShadow = true;
  g.add(chest);

  // Point light inside cave to make it glow warmly
  const caveLight = new THREE.PointLight(0xFFAA44, 2.0, 10);
  caveLight.position.set(0, 1.5, 3);
  g.add(caveLight);

  g.position.set(cx, 0.1, cz);
  scene.add(g);
}

// ── Shipwreck geometry ────────────────────────────────────────────────────────
function buildShipwreck(scene, cx, cz) {
  const g = new THREE.Group();

  // Hull — tilted (rotation.z = 0.35 rad ≈ 20°)
  const hull = new THREE.Group();
  hull.rotation.z = 0.35;

  box(hull, 3.5, 0.3, 10, WOOD_MAT, 0, 0,   0);   // keel
  box(hull, 0.3, 2.5, 10, WOOD_MAT, -1.6, 1.25, 0); // port side
  box(hull, 0.3, 1.5, 10, PLANK_MAT, 1.6, 0.75, 0); // starboard (half submerged)

  // Broken mast
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 6, 7), WOOD_MAT);
  mast.position.set(0, 3.5, -1);
  mast.rotation.z = -0.5;
  mast.castShadow = true;
  hull.add(mast);

  // Scattered planks
  for (let i = 0; i < 4; i++) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 1.2 + i * 0.3), PLANK_MAT);
    plank.position.set((i - 1.5) * 1.2, -0.3, 4 + i * 0.8);
    plank.rotation.y = (Math.random() - 0.5) * 0.6;
    plank.castShadow = true;
    hull.add(plank);
  }

  g.add(hull);

  // Surrounding rocks
  box(g, 3, 2, 3, ROCK_MAT, -5, 1, 3);
  box(g, 2, 1.5, 2, ROCK_MAT,  4, 0.75, -4);

  g.position.set(cx, -0.6, cz);  // partially submerged
  scene.add(g);
}

// ── Discovery HUD ─────────────────────────────────────────────────────────────
function makeDiscoveryBanner() {
  const el = document.createElement('div');
  Object.assign(el.style, {
    position: 'fixed', top: '50%', left: '50%',
    transform: 'translate(-50%, -50%)',
    color: '#FFD700', background: 'rgba(0,0,0,0.78)',
    padding: '18px 36px', borderRadius: '14px',
    fontSize: '20px', fontFamily: 'Arial, sans-serif',
    display: 'none', pointerEvents: 'none', zIndex: '40',
    textAlign: 'center', lineHeight: '1.5',
    border: '2px solid rgba(255,215,0,0.5)',
  });
  document.body.appendChild(el);
  return el;
}

// ── Public API ────────────────────────────────────────────────────────────────
export function createSecrets(scene) {
  // Build geometry
  buildSeaCave(scene, SECRET_LOCATIONS[0].x, SECRET_LOCATIONS[0].z);
  buildShipwreck(scene, SECRET_LOCATIONS[1].x, SECRET_LOCATIONS[1].z);

  const discovered = load('secrets:discovered', {});
  const banner = makeDiscoveryBanner();
  let bannerTimer = 0;

  function update(dt, playerPos, onBoat) {
    // Dismiss banner
    if (bannerTimer > 0) {
      bannerTimer -= dt;
      if (bannerTimer <= 0) banner.style.display = 'none';
    }

    if (!onBoat) return;  // secrets only reachable by boat

    for (const loc of SECRET_LOCATIONS) {
      if (discovered[loc.id]) continue;
      const dist = Math.hypot(playerPos.x - loc.x, playerPos.z - loc.z);
      if (dist < loc.radius) {
        // First discovery
        discovered[loc.id] = { ts: Date.now() };
        save('secrets:discovered', discovered);
        banner.innerHTML = `✦ Discovery: <strong>${loc.label}</strong> ✦<br><span style="font-size:14px;color:#ccc">${loc.description}</span>`;
        banner.style.display = 'block';
        bannerTimer = 6;
      }
    }
  }

  // Returns map of { secretId → true } for minimap or UI use
  function getDiscovered() { return { ...discovered }; }

  return { update, getDiscovered };
}
