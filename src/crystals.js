import * as THREE from 'three';
import { LANDMARKS, OCEAN } from './world.config.js';
import { terrainHeight } from './terrain.js';

// Glowing crystal shards scattered through the forest, with a deliberate
// cluster at the cave mouth. Two instanced meshes (cyan / violet) share
// pulsing emissive materials; a few point lights mark the big clusters.
export function createCrystals(scene) {
  const cyanMat = new THREE.MeshStandardMaterial({
    color: 0x08131A, emissive: 0x35D6F0, emissiveIntensity: 1.6,
    roughness: 0.25, metalness: 0.1, flatShading: true,
  });
  const violetMat = new THREE.MeshStandardMaterial({
    color: 0x120A1C, emissive: 0xA85CF0, emissiveIntensity: 1.4,
    roughness: 0.25, metalness: 0.1, flatShading: true,
  });

  // ── Pick spots: random forest scatter + cave-mouth cluster ─────────────────
  const spots = [];
  let attempts = 0;
  while (spots.length < 110 && attempts < 2200) {
    attempts++;
    const a = Math.random() * Math.PI * 2;
    const r = 90 + Math.random() * 540;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (z - x > OCEAN.coast - OCEAN.beachWidth - 30) continue;       // beach/sea
    const icy = LANDMARKS.icy, ru = LANDMARKS.ruins;
    if (Math.hypot(x - icy.x, z - icy.z) < icy.exclR) continue;      // biomes get
    if (Math.hypot(x - ru.x,  z - ru.z)  < ru.exclR)  continue;      // their own
    spots.push({ x, z });
  }
  const cave = LANDMARKS.cave;
  for (let i = 0; i < 9; i++) {
    const a = Math.PI + (Math.random() - 0.5) * 1.6;   // fan west of the cave
    const r = 16 + Math.random() * 14;
    spots.push({ x: cave.x + Math.cos(a) * r, z: cave.z + Math.sin(a) * r });
  }

  // ── Instance shards — 1–3 per spot, tilted, half-buried ────────────────────
  const shards = [];
  for (const s of spots) {
    const n = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      shards.push({
        x: s.x + (Math.random() - 0.5) * 2.4,
        z: s.z + (Math.random() - 0.5) * 2.4,
        w: 0.35 + Math.random() * 0.85,
        h: 1.0  + Math.random() * 2.4,
        cyan: Math.random() < 0.62,
      });
    }
  }

  const geo = new THREE.OctahedronGeometry(1, 0);
  const nCyan   = shards.filter(s => s.cyan).length;
  const cyanIM   = new THREE.InstancedMesh(geo, cyanMat,   nCyan);
  const violetIM = new THREE.InstancedMesh(geo, violetMat, shards.length - nCyan);

  const dummy = new THREE.Object3D();
  let ic = 0, iv = 0;
  for (const s of shards) {
    dummy.position.set(s.x, terrainHeight(s.x, s.z) + s.h * 0.32, s.z);
    dummy.scale.set(s.w, s.h, s.w);
    dummy.rotation.set((Math.random() - 0.5) * 0.5, Math.random() * Math.PI,
                       (Math.random() - 0.5) * 0.5);
    dummy.updateMatrix();
    if (s.cyan) cyanIM.setMatrixAt(ic++, dummy.matrix);
    else        violetIM.setMatrixAt(iv++, dummy.matrix);
  }
  cyanIM.instanceMatrix.needsUpdate = violetIM.instanceMatrix.needsUpdate = true;
  scene.add(cyanIM, violetIM);

  // Point lights only at the cave cluster + two random clusters (lights are dear)
  const lightSpots = [{ x: cave.x - 22, z: cave.z }, spots[0], spots[1]];
  for (const s of lightSpots) {
    if (!s) continue;
    const l = new THREE.PointLight(0x55D8F0, 1.8, 16);
    l.position.set(s.x, terrainHeight(s.x, s.z) + 1.6, s.z);
    scene.add(l);
  }

  function update(nowSec) {
    cyanMat.emissiveIntensity   = 1.6 + Math.sin(nowSec * 1.7) * 0.5;
    violetMat.emissiveIntensity = 1.4 + Math.sin(nowSec * 2.1 + 1.9) * 0.45;
  }

  return { update };
}
