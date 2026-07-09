import * as THREE from 'three';
import { BIOMES, LANDMARKS } from './world.config.js';
import { buildHumanoid } from './humanoid.js';

// Night-exclusive life — the real-time clock guarantees some players always
// arrive after dark, so night gets its own rewards: fireflies at the pond,
// an aurora over the Icy Peaks (visible from across the map), and a Warden
// spirit who sits by the beach campfire from dusk till dawn.

const SPIRIT_LINES = [
  'You can see me? Then the fire remembers how to burn properly after all.',
  'I was the eleventh Warden. The colonnade kneels because I am not under it.',
  'The shards sing louder at night. That is not your imagination.',
  'We left the portals open. Not carelessness — hope.',
  'The geese were our sentries. Proud creatures. Never tell them the war is over.',
  'When you have gathered all our words, go to the hollow hill. I will know.',
];

export function createNight(scene, { interact, onSpiritSpeak } = {}) {
  // ── Fireflies at the pond ───────────────────────────────────────────────────
  const pond = LANDMARKS.pond;
  const FN = 44;
  const base = new Float32Array(FN * 3);
  const fpos = new Float32Array(FN * 3);
  for (let i = 0; i < FN; i++) {
    base[i * 3]     = pond.x + (Math.random() - 0.5) * 42;
    base[i * 3 + 1] = 0.6 + Math.random() * 2.6;
    base[i * 3 + 2] = pond.z + (Math.random() - 0.5) * 30;
  }
  const fGeo = new THREE.BufferGeometry();
  fGeo.setAttribute('position', new THREE.BufferAttribute(fpos, 3));
  const fMat = new THREE.PointsMaterial({
    color: 0xD8FF6A, size: 0.22, transparent: true, opacity: 0,
    depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const fireflies = new THREE.Points(fGeo, fMat);
  fireflies.visible = false;
  scene.add(fireflies);

  // ── Aurora curtains over the Icy Peaks ─────────────────────────────────────
  const auroraUniforms = { uTime: { value: 0 }, uNight: { value: 0 } };
  const auroraMat = new THREE.ShaderMaterial({
    uniforms: auroraUniforms,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      uniform float uTime;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec3 p = position;
        p.z += sin(p.x * 0.013 + uTime * 0.5) * 26.0 * uv.y;
        p.y += sin(p.x * 0.021 + uTime * 0.8) * 9.0;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      uniform float uTime;
      uniform float uNight;
      varying vec2 vUv;
      void main() {
        vec3 green  = vec3(0.15, 0.95, 0.55);
        vec3 purple = vec3(0.55, 0.25, 0.95);
        vec3 col = mix(green, purple, vUv.x * 0.7 + 0.3 * sin(uTime * 0.3 + vUv.x * 5.0));
        float band = sin(vUv.x * 9.0 + uTime * 0.6) * 0.5 + 0.5;
        float a = (1.0 - vUv.y) * vUv.y * 4.0 * (0.35 + band * 0.4) * uNight * 0.5;
        gl_FragColor = vec4(col, a);
      }
    `,
  });
  for (const [dy, dz, w] of [[150, 0, 620], [185, -90, 520]]) {
    const curtain = new THREE.Mesh(new THREE.PlaneGeometry(w, 70, 48, 1), auroraMat);
    curtain.position.set(BIOMES.icy.x, dy, BIOMES.icy.z + dz);
    scene.add(curtain);
  }

  // ── The Warden spirit at the campfire ──────────────────────────────────────
  const SPIRIT = { x: -462, z: 574 };
  const spirit = buildHumanoid(0xBFE8FF);
  const ghostMat = new THREE.MeshLambertMaterial({
    color: 0xBFE8FF, transparent: true, opacity: 0.45,
    emissive: 0x6FB8D8, emissiveIntensity: 0.5, depthWrite: false,
  });
  spirit.traverse(o => { if (o.isMesh) { o.material = ghostMat; o.castShadow = false; } });
  spirit.position.set(SPIRIT.x, 0.15, SPIRIT.z);
  spirit.rotation.y = Math.PI * 0.75;   // face the fire
  spirit.visible = false;
  scene.add(spirit);

  let lineIdx = 0;
  if (interact) {
    interact.register({
      x: SPIRIT.x, z: SPIRIT.z, r: 4,
      label: 'Speak with the spirit',
      when: () => spirit.visible,
      cb: () => {
        const line = SPIRIT_LINES[lineIdx % SPIRIT_LINES.length];
        lineIdx++;
        if (onSpiritSpeak) onSpiritSpeak(spirit, line);
      },
    });
  }

  // night: 0 (day) → 1 (deep night); playerPos gates the firefly simulation
  function update(dt, nowSec, playerPos, night) {
    auroraUniforms.uTime.value  = nowSec;
    auroraUniforms.uNight.value = night;

    const nearPond = Math.hypot(playerPos.x - pond.x, playerPos.z - pond.z) < 170;
    fireflies.visible = night > 0.15 && nearPond;
    if (fireflies.visible) {
      const p = fGeo.attributes.position;
      for (let i = 0; i < FN; i++) {
        p.array[i * 3]     = base[i * 3]     + Math.sin(nowSec * 0.7 + i * 1.7) * 2.2;
        p.array[i * 3 + 1] = base[i * 3 + 1] + Math.sin(nowSec * 1.1 + i * 2.3) * 0.8;
        p.array[i * 3 + 2] = base[i * 3 + 2] + Math.cos(nowSec * 0.6 + i * 1.1) * 2.2;
      }
      p.needsUpdate = true;
      fMat.opacity = night * (0.65 + Math.sin(nowSec * 3) * 0.25);
    }

    spirit.visible = night > 0.3;
    if (spirit.visible) spirit.position.y = 0.15 + Math.sin(nowSec * 1.2) * 0.08;
  }

  return { update };
}
