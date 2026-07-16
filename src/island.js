import * as THREE from 'three';
import { ISLAND, islandHeight } from './zones.js';
import { toast } from './hud.js';

// Ember Isle — the volcanic island offshore. The visible mesh samples the
// same islandHeight() the player walks on, so feet and ground always agree.
// A lava pool glows in the crater under a rising smoke column, charred palms
// and obsidian dot the slopes, and a scorched tablet tells of the Wardens'
// fourth boat.

export function createIsland(scene, { interact, audio }) {
  const group = new THREE.Group();

  // ── Terrain skin — displaced plane, vertex-tinted by height ────────────────
  const SEG = 44, SIZE = ISLAND.r * 2 + 8;
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const cSand = new THREE.Color(0xC8B080), cRock = new THREE.Color(0x4A4245);
  const cAsh  = new THREE.Color(0x2A2426), col = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const wx = pos.getX(i) + ISLAND.x, wz = pos.getZ(i) + ISLAND.z;
    const h = islandHeight(wx, wz);
    pos.setY(i, h - 0.05);   // hair below walk height so feet never sink visually
    const t = Math.min(1, h / 20);
    col.copy(cSand).lerp(cRock, Math.min(1, t * 1.8)).lerp(cAsh, Math.max(0, t - 0.55) * 2);
    colors[i * 3] = col.r; colors[i * 3 + 1] = col.g; colors[i * 3 + 2] = col.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const skin = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  skin.position.set(ISLAND.x, 0, ISLAND.z);
  skin.receiveShadow = true;
  scene.add(skin);

  // ── Lava pool in the crater ─────────────────────────────────────────────────
  const craterY = islandHeight(ISLAND.x, ISLAND.z) + 0.3;
  const lava = new THREE.Mesh(
    new THREE.CircleGeometry(7.5, 24),
    new THREE.MeshStandardMaterial({
      color: 0xFF4400, emissive: 0xFF3300, emissiveIntensity: 1.6, roughness: 0.6,
    }),
  );
  lava.rotation.x = -Math.PI / 2;
  lava.position.set(ISLAND.x, craterY, ISLAND.z);
  scene.add(lava);
  const lavaLight = new THREE.PointLight(0xFF5510, 2.2, 45);
  lavaLight.position.set(ISLAND.x, craterY + 3, ISLAND.z);
  scene.add(lavaLight);

  // ── Smoke column ────────────────────────────────────────────────────────────
  const SMOKE = 34;
  const sPos = new Float32Array(SMOKE * 3);
  const sLife = new Float32Array(SMOKE);
  for (let i = 0; i < SMOKE; i++) sLife[i] = Math.random() * 8;
  const sGeo = new THREE.BufferGeometry();
  sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
  const smoke = new THREE.Points(sGeo, new THREE.PointsMaterial({
    color: 0x555055, size: 2.6, transparent: true, opacity: 0.35,
    depthWrite: false, sizeAttenuation: true,
  }));
  smoke.position.set(ISLAND.x, craterY, ISLAND.z);
  smoke.frustumCulled = false;
  scene.add(smoke);

  // ── Charred palms + obsidian ────────────────────────────────────────────────
  const charMat = new THREE.MeshLambertMaterial({ color: 0x1E1A18, flatShading: true });
  const obsMat  = new THREE.MeshLambertMaterial({ color: 0x201C28, flatShading: true });
  [[-38, 18, 0.3], [30, -30, -0.2], [-20, -42, 0.4], [42, 12, 0.1], [8, 46, -0.3]].forEach(([dx, dz, lean]) => {
    const x = ISLAND.x + dx, z = ISLAND.z + dz;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.20, 4.2, 6), charMat);
    trunk.position.set(x, islandHeight(x, z) + 2.0, z);
    trunk.rotation.z = lean;
    group.add(trunk);
    for (let f = 0; f < 3; f++) {
      const frond = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.05, 0.2), charMat);
      frond.position.set(x + Math.sin(lean) * -2, islandHeight(x, z) + 4.1, z);
      frond.rotation.set(0.5 - f * 0.5, f * 2.1, 0.3);
      group.add(frond);
    }
  });
  [[-30, -8, 1.4], [22, 26, 1.0], [-8, 34, 1.8], [36, -18, 1.2], [-44, 30, 0.9]].forEach(([dx, dz, s]) => {
    const x = ISLAND.x + dx, z = ISLAND.z + dz;
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), obsMat);
    rock.position.set(x, islandHeight(x, z) + s * 0.4, z);
    rock.rotation.set(Math.random(), Math.random(), 0);
    group.add(rock);
  });
  scene.add(group);

  // ── The Fourth Boat — scorched lore tablet on the rim ───────────────────────
  const plaque = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.2, 0.15), obsMat);
  const px = ISLAND.x - 6, pz = ISLAND.z - 46;
  plaque.position.set(px, islandHeight(px, pz) + 0.6, pz);
  plaque.rotation.y = 0.4;
  scene.add(plaque);
  interact.register({
    x: px, z: pz, r: 5,
    label: '🔥 Read the scorched tablet',
    cb: () => {
      audio.sfx.bell();
      toast('The Fourth Boat — "The sea did not take us. It carried us here, to the fire that sleeps in water. We stayed, and were warm. Warden-luck to you who follow."', 8500);
    },
  });

  function update(dt, nowSec) {
    lava.material.emissiveIntensity = 1.4 + Math.sin(nowSec * 1.7) * 0.35;
    lavaLight.intensity = 2.0 + Math.sin(nowSec * 2.3) * 0.5;
    for (let i = 0; i < SMOKE; i++) {
      sLife[i] += dt;
      if (sLife[i] > 8) sLife[i] = 0;
      const t = sLife[i] / 8;
      sPos[i * 3]     = Math.sin(i * 2.1 + nowSec * 0.4) * (1 + t * 6);
      sPos[i * 3 + 1] = t * 34;
      sPos[i * 3 + 2] = Math.cos(i * 1.7 + nowSec * 0.3) * (1 + t * 6);
    }
    sGeo.attributes.position.needsUpdate = true;
  }

  return { update };
}
