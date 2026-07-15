import * as THREE from 'three';
import { terrainHeight } from './terrain.js';
import { BIOMES } from './world.config.js';
import { toast } from './hud.js';
import { setGliderUnlocked } from './player.js';

// The Warden's Glider — a traversal unlock resting on a cairn at the Icy
// Peaks summit. A warm light beam marks it from across the map. Taking it
// (E) lets you hold Space in the air to soar; mobile auto-deploys mid-fall.
// Unlock persists per device via progress.

export function createGlider(scene, { progress, interact, audio }) {
  // Summit hunt — highest terrain sample inside the biome
  const { x: CX, z: CZ, r: R } = BIOMES.icy;
  let sx = CX, sz = CZ, sh = -1;
  for (let gx = -R; gx <= R; gx += 5) {
    for (let gz = -R; gz <= R; gz += 5) {
      if (gx * gx + gz * gz > R * R * 0.8) continue;
      const h = terrainHeight(CX + gx, CZ + gz);
      if (h > sh) { sh = h; sx = CX + gx; sz = CZ + gz; }
    }
  }

  const group = new THREE.Group();

  // Cairn
  const stoneMat = new THREE.MeshLambertMaterial({ color: 0x8B929E, flatShading: true });
  [[0.5, 0.35, 0], [-0.4, 0.3, 0.3], [0.1, 0.28, -0.45], [0, 0.75, 0]].forEach(([px, py, pz], i) => {
    const s = new THREE.Mesh(new THREE.DodecahedronGeometry(0.45 - i * 0.06, 0), stoneMat);
    s.position.set(px, py, pz);
    group.add(s);
  });

  // Resting wing — same silhouette as the wearable one in player.js
  const wingMat = new THREE.MeshLambertMaterial({ color: 0xE8593A, side: THREE.DoubleSide });
  const wing = new THREE.Group();
  const half = new THREE.BoxGeometry(1.55, 0.04, 0.55);
  const L = new THREE.Mesh(half, wingMat);
  L.position.x = -0.74; L.rotation.set(0, 0.32, 0.18);
  const Rw = new THREE.Mesh(half, wingMat);
  Rw.position.x = 0.74; Rw.rotation.set(0, -0.32, -0.18);
  wing.add(L, Rw);
  wing.position.y = 1.6;
  group.add(wing);

  // Sky beam — warm orange to stand apart from the icy shard beams
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.35, 46, 6, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xFFB56B, transparent: true, opacity: 0.14,
      side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
    }),
  );
  beam.position.y = 24;
  group.add(beam);

  group.position.set(sx, sh, sz);
  scene.add(group);

  const unlocked = () => !!progress.get('glider');
  if (unlocked()) {
    setGliderUnlocked(true);
    wing.visible = beam.visible = false;
  }

  interact.register({
    x: sx, z: sz, r: 5,
    label: "🪂 Take the Warden's Glider",
    when: () => !unlocked(),
    cb: () => {
      progress.set('glider', true);
      setGliderUnlocked(true);
      wing.visible = beam.visible = false;
      audio.sfx.fanfare();
      toast("🪂 The Warden's Glider is yours — hold SPACE in the air to soar!", 6500);
    },
  });

  function update(nowSec) {
    if (wing.visible) {
      wing.position.y = 1.6 + Math.sin(nowSec * 1.6) * 0.12;
      wing.rotation.y = nowSec * 0.5;
    }
  }

  return { update, summit: { x: sx, z: sz } };
}
