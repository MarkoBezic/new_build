import * as THREE from 'three';
import { toast } from './hud.js';
import { save, load } from './persistence.js';
import { groundY, SHORE } from './zones.js';

// Pip the gosling — scatter crumbs for the geese near the north flock five
// times (20 s between feedings) and a gosling imprints on you, following you
// everywhere forever: waddling on land, paddling in water, peeping softly.

const NEED = 5, COOLDOWN = 20;
const CRUMBS = { x: 0, z: -43 };   // north-parking geese region

export function createGosling(scene, { interact, audio, playerPosition }) {
  let fed    = load('gosling:fed', 0);
  let hasPip = load('gosling:owned', false);
  let cool   = 0;

  // ── Pip mesh — a palm-sized fluffball ───────────────────────────────────────
  const pip = new THREE.Group();
  const fluff = new THREE.MeshLambertMaterial({ color: 0xE0CC70 });
  const dark  = new THREE.MeshLambertMaterial({ color: 0x2A2620 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), fluff);
  body.position.y = 0.14;
  body.scale.set(1, 0.9, 1.25);
  pip.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), fluff);
  head.position.set(0, 0.30, 0.12);
  pip.add(head);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.07, 5), dark);
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 0.29, 0.21);
  pip.add(beak);
  for (const ex of [-0.045, 0.045]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.016, 5, 4), dark);
    eye.position.set(ex, 0.33, 0.18);
    pip.add(eye);
  }
  pip.visible = false;
  scene.add(pip);

  let px = 0, pz = 0, bob = 0, peepT = 9;

  function place() {
    px = playerPosition.x + 1.5;
    pz = playerPosition.z + 1.5;
    pip.visible = true;
  }

  function unlock() {
    hasPip = true;
    save('gosling:owned', true);
    place();
    audio.sfx.fanfare();
    toast('🐥 A gosling waddles out of the flock and imprints on you!\nPip will follow you anywhere.', 6000);
  }
  if (hasPip) place();

  interact.register({
    x: CRUMBS.x, z: CRUMBS.z, r: 10,
    label: () => `🐥 Scatter crumbs for the geese (${fed}/${NEED})`,
    when: () => !hasPip,
    cb: () => {
      if (cool > 0) { toast('The geese are still eating…', 1600); return; }
      cool = COOLDOWN;
      fed++;
      save('gosling:fed', fed);
      audio.sfx.plink();
      if (fed >= NEED) unlock();
      else toast(`The geese eye you with growing trust. (${fed}/${NEED})`, 2600);
    },
  });

  function update(dt) {
    cool = Math.max(0, cool - dt);
    if (!pip.visible) return;

    const dx = playerPosition.x - px, dz = playerPosition.z - pz;
    const d = Math.hypot(dx, dz);
    if (d > 30) {
      // Fell too far behind (portals, gliding) — flutter to catch up
      px = playerPosition.x - 1.5;
      pz = playerPosition.z;
    } else if (d > 1.8) {
      const sp = Math.min(10, (d - 1.5) * 2.4);
      px += (dx / d) * sp * dt;
      pz += (dz / d) * sp * dt;
      bob += dt * 11;
      pip.rotation.y = Math.atan2(dx, dz);
    }
    // Paddle at the water surface when following a boat, waddle on land
    const swimming = (pz - px) >= SHORE;
    const gy = swimming ? 0.10 : groundY(px, pz);
    pip.position.set(px, gy + Math.abs(Math.sin(bob)) * 0.05, pz);

    peepT -= dt;
    if (peepT <= 0) {
      peepT = 9 + Math.random() * 18;
      audio.sfx.peep();
    }
  }

  return { update };
}
