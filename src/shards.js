import * as THREE from 'three';
import { groundY } from './zones.js';
import { toast, makeChip } from './hud.js';
import { makeBeam } from './fx.js';

// Resonant shards — the collect-a-thon layer. 29 shards in five regional
// sets. Each shard is a bright pulsing crystal with a vertical light beam so
// it can be spotted through the trees. Walking into one collects it (chime +
// counter). Completing a set unlocks a cosmetic trail AND permanently ignites
// a light-pillar beacon in that region — world-state you can see from afar.

const SETS = {
  forest: { label: 'Forest',       color: 0x6FE86F, beacon: { x: 0,    z: -165 } },
  beach:  { label: 'Shore',        color: 0xFFB347, beacon: { x: -465, z: 578 } },
  cave:   { label: 'Cave',         color: 0xA85CF0, beacon: { x: 146,  z: -20 } },
  icy:    { label: 'Icy Peaks',    color: 0x9FE8FF, beacon: { x: 343,  z: -646 } },
  ruins:  { label: 'Ruins',        color: 0xFFD75A, beacon: { x: 650,  z: 150 } },
  volcano:{ label: 'Ember Isle',   color: 0xFF6A3D, beacon: { x: -700, z: 900 } },
};

// x, z, set — spread so hunting a set walks you past POIs and landmarks
const SHARDS = [
  // Forest (12) — clearing fringe, pond, spawn path, deep woods
  { x:   45, z: -195, s: 'forest' }, { x: -150, z:  -60, s: 'forest' },
  { x: -178, z:   38, s: 'forest' }, { x:   80, z:  110, s: 'forest' },
  { x:  -60, z: -348, s: 'forest' }, { x:  152, z: -398, s: 'forest' },
  { x: -222, z: -178, s: 'forest' }, { x: -318, z: -418, s: 'forest' },
  { x:  242, z:  322, s: 'forest' }, { x: -418, z:  102, s: 'forest' },
  { x:  478, z: -222, s: 'forest' }, { x:  -88, z:  228, s: 'forest' },
  // Shore (4) — along the sand
  { x: -510, z: 555, s: 'beach' }, { x: -430, z: 640, s: 'beach' },
  { x: -590, z: 480, s: 'beach' }, { x: -350, z: 700, s: 'beach' },
  // Cave (3) — around and inside the mouth
  { x: 138, z: -34, s: 'cave' }, { x: 142, z:  -6, s: 'cave' },
  { x: 156, z: -20, s: 'cave' },
  // Icy Peaks (5)
  { x: 302, z: -562, s: 'icy' }, { x: 398, z: -602, s: 'icy' },
  { x: 350, z: -720, s: 'icy' }, { x: 262, z: -678, s: 'icy' },
  { x: 430, z: -690, s: 'icy' },
  // Ruins (5)
  { x: 610, z: 118, s: 'ruins' }, { x: 688, z: 176, s: 'ruins' },
  { x: 650, z:  95, s: 'ruins' }, { x: 598, z: 196, s: 'ruins' },
  { x: 712, z: 122, s: 'ruins' },
  // Ember Isle (5) — a boat voyage away
  { x: -700, z: 868, s: 'volcano' }, { x: -668, z: 902, s: 'volcano' },
  { x: -732, z: 908, s: 'volcano' }, { x: -698, z: 934, s: 'volcano' },
  { x: -712, z: 884, s: 'volcano' },
];

const COLLECT_R = 2.4;

export function createShards(scene, { progress, audio, cosmetics }) {
  const shardGeo = new THREE.OctahedronGeometry(0.42, 0);
  const beamGeo  = new THREE.CylinderGeometry(0.22, 0.22, 34, 6, 1, true);
  const live = [];

  const setMats = {}, beamMats = {};
  for (const [id, def] of Object.entries(SETS)) {
    setMats[id] = new THREE.MeshStandardMaterial({
      color: 0x0A0A14, emissive: def.color, emissiveIntensity: 2.2,
      roughness: 0.2, flatShading: true,
    });
    beamMats[id] = new THREE.MeshBasicMaterial({
      color: def.color, transparent: true, opacity: 0.13,
      side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
    });
  }

  SHARDS.forEach((def, i) => {
    const id = `${def.s}-${i}`;
    if (progress.has('shards', id)) return;
    const g = new THREE.Group();
    const crystal = new THREE.Mesh(shardGeo, setMats[def.s]);
    crystal.scale.set(1, 1.7, 1);
    crystal.position.y = 1.1;
    g.add(crystal);
    const beam = new THREE.Mesh(beamGeo, beamMats[def.s]);
    beam.position.y = 17;
    g.add(beam);
    g.position.set(def.x, groundY(def.x, def.z), def.z);
    scene.add(g);
    live.push({ id, set: def.s, group: g, crystal, phase: i * 0.7 });
  });

  // ── Permanent set-completion beacons ────────────────────────────────────────
  function igniteBeacon(setId) {
    const def = SETS[setId];
    const m = makeBeam(def.color, { rTop: 1.6, rBottom: 2.2, h: 130, opacity: 0.16 });
    m.position.set(def.beacon.x, groundY(def.beacon.x, def.beacon.z) + 63, def.beacon.z);
    scene.add(m);
  }

  const setTotal = {}, setDone = {};
  for (const d of SHARDS) setTotal[d.s] = (setTotal[d.s] ?? 0) + 1;
  for (const id of Object.keys(SETS)) {
    setDone[id] = SHARDS.filter((d, i) => d.s === id && progress.has('shards', `${d.s}-${i}`)).length;
    if (setDone[id] === setTotal[id]) igniteBeacon(id);   // restore on load
  }

  // ── HUD counter chip ────────────────────────────────────────────────────────
  const chip = makeChip(12);
  const refreshChip = () => { chip.textContent = `✦ ${progress.count('shards')} / ${SHARDS.length}`; };
  refreshChip();

  function update(dt, playerPos, nowSec) {
    for (let i = live.length - 1; i >= 0; i--) {
      const s = live[i];
      const d = Math.hypot(playerPos.x - s.group.position.x, playerPos.z - s.group.position.z);
      // Spin/bob only when close enough to actually see it
      if (d < 260) {
        s.crystal.rotation.y = nowSec * 1.2 + s.phase;
        s.crystal.position.y = 1.1 + Math.sin(nowSec * 2 + s.phase) * 0.18;
      }
      if (d < COLLECT_R) {
        scene.remove(s.group);
        live.splice(i, 1);
        progress.add('shards', s.id);
        setDone[s.set]++;
        refreshChip();
        audio.sfx.chime(setDone[s.set]);   // rising pitch through the set
        const def = SETS[s.set];
        if (setDone[s.set] === setTotal[s.set]) {
          igniteBeacon(s.set);
          audio.sfx.fanfare();
          toast(`✦ ${def.label} set complete! A beacon ignites…`, 4500);
          cosmetics.unlockTrail(s.set);
        } else {
          toast(`✦ ${def.label} shard — ${setDone[s.set]} / ${setTotal[s.set]}`, 2200);
        }
      }
    }
  }

  return { update };
}
