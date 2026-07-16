import * as THREE from 'three';
import { toast } from './hud.js';
import { save, load } from './persistence.js';
import { grantHat, wearHat } from './hats.js';
import { bus } from './bus.js';

// The Singing Stones — five crystal-tipped stones stand in an arc at the
// mouth of the hollow hill. Every so often they hum their five-note phrase,
// glowing one by one. Strike them (E) in that order to wake the Echo
// Crystal: 40 shells, the Echo Circlet hat, and a violet beacon in the cave.
// The tablets promised "a patient hand" — this is what they meant.

const SEQ   = [1, 3, 0, 4, 2];
const NOTES = [261.6, 293.7, 329.6, 392.0, 440.0];   // C D E G A
const HINT_GAP = 22;      // seconds between hint playbacks
const STEP_T   = 0.75;    // seconds between hint notes

export function createCave(scene, { interact, audio, shells }) {
  let solved = !!load('cave:solved', false);

  // ── The five stones, arced before the cave mouth (entrance faces west) ─────
  const rockMat = new THREE.MeshLambertMaterial({ color: 0x5A544C, flatShading: true });
  const stones = [];
  for (let i = 0; i < 5; i++) {
    const a = (-0.55 + i * 0.275) * Math.PI;   // arc on the west side
    const x = 143 + Math.cos(a) * 9;
    const z = -20 + Math.sin(a) * 11;
    const g = new THREE.Group();
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.55, 0), rockMat);
    rock.position.y = 0.35;
    rock.scale.y = 1.3;
    g.add(rock);
    const gemMat = new THREE.MeshStandardMaterial({
      color: 0x6A5A9A, emissive: 0x9A7CE8, emissiveIntensity: 0.15, roughness: 0.3,
    });
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), gemMat);
    gem.position.y = 1.0;
    gem.scale.y = 1.9;
    g.add(gem);
    g.position.set(x, 0, z);
    scene.add(g);
    stones.push({ gem, gemMat, glow: 0, x, z });

    interact.register({
      x, z, r: 2.4,
      label: '🎵 Strike the singing stone',
      cb: () => strike(i),
    });
  }

  // ── Echo beacon inside the cave — lit once solved ───────────────────────────
  const beacon = new THREE.Mesh(
    new THREE.CylinderGeometry(0.8, 1.1, 60, 8, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xA88CF0, transparent: true, opacity: 0.16,
      side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
    }),
  );
  beacon.position.set(160, 30, -20);
  beacon.visible = solved;
  scene.add(beacon);
  const echoLight = new THREE.PointLight(0x9A7CE8, solved ? 1.6 : 0, 26);
  echoLight.position.set(157, 3, -20);
  scene.add(echoLight);

  // ── Puzzle state ────────────────────────────────────────────────────────────
  let played = [];               // sliding window of the player's last strikes
  let hintT = 6, hintStep = -1, hintStepT = 0;

  function strike(i) {
    audio.sfx.note(NOTES[i]);
    stones[i].glow = 1;
    if (solved) return;
    played.push(i);
    if (played.length > SEQ.length) played.shift();
    if (played.length === SEQ.length && played.every((v, k) => v === SEQ[k])) solve();
  }

  function solve() {
    solved = true;
    save('cave:solved', true);
    beacon.visible = true;
    echoLight.intensity = 1.6;
    audio.sfx.fanfare();
    shells.add(40, 'the singing stones');
    grantHat('echo');
    wearHat('echo');
    bus.emit('cave-solved');
    toast('🎵 The hollow hill answers — the Echo Crystal wakes!\nThe Echo Circlet is yours.', 6500);
  }

  function update(dt, nowSec, playerPosition) {
    // Glow decay + idle shimmer
    for (const s of stones) {
      s.glow = Math.max(0, s.glow - dt * 1.4);
      const idle = solved ? 0.5 + Math.sin(nowSec * 2 + s.x) * 0.2 : 0.15;
      s.gemMat.emissiveIntensity = idle + s.glow * 2.2;
      s.gem.rotation.y = nowSec * 0.6;
    }

    if (solved) return;

    // Hint playback when a player is near — the stones sing their phrase
    const near = Math.hypot(playerPosition.x - 148, playerPosition.z + 20) < 26;
    if (hintStep >= 0) {
      hintStepT -= dt;
      if (hintStepT <= 0) {
        const i = SEQ[hintStep];
        audio.sfx.note(NOTES[i], 0.09);
        stones[i].glow = 0.8;
        hintStep++;
        hintStepT = STEP_T;
        if (hintStep >= SEQ.length) hintStep = -1;
      }
    } else if (near) {
      hintT -= dt;
      if (hintT <= 0) {
        hintT = HINT_GAP;
        hintStep = 0;
        hintStepT = 0.2;
      }
    }
  }

  return { update };
}
