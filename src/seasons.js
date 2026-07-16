import * as THREE from 'three';
import { LANDMARKS } from './world.config.js';

// Real-calendar seasons, matching the world's Toronto clock. Each season
// drifts its own particles around the player — spring petals, autumn
// leaves, winter snow (plus a frozen pond) — and summer stays clear.
// Like the solar day/night, the world simply lives on the real calendar.

export function currentSeason(date = new Date()) {
  const m = date.getMonth();   // 0–11
  if (m === 11 || m <= 1) return 'winter';
  if (m <= 4)  return 'spring';
  if (m <= 7)  return 'summer';
  return 'autumn';
}

const STYLE = {
  spring: { color: 0xF0B8D0, size: 0.16, fall: 1.1, sway: 1.6, opacity: 0.8 },
  autumn: { color: 0xD88A3A, size: 0.22, fall: 1.6, sway: 2.2, opacity: 0.9 },
  winter: { color: 0xF4F8FF, size: 0.14, fall: 2.2, sway: 0.8, opacity: 0.85 },
};

const N = 130;

export function createSeasons(scene, { playerPosition }) {
  const season = currentSeason();
  const style  = STYLE[season];

  // ── Frozen pond in winter ───────────────────────────────────────────────────
  if (season === 'winter') {
    const ice = new THREE.Mesh(
      new THREE.PlaneGeometry(36, 22),
      new THREE.MeshPhongMaterial({
        color: 0xC8E4F0, specular: 0xFFFFFF, shininess: 220,
        transparent: true, opacity: 0.92,
      }),
    );
    ice.rotation.x = -Math.PI / 2;
    ice.position.set(LANDMARKS.pond.x, 0.16, LANDMARKS.pond.z);
    scene.add(ice);
  }

  if (!style) return { update() {}, season };   // summer — clear skies

  // ── Drifting seasonal particles around the player ──────────────────────────
  const pos = new Float32Array(N * 3);
  const phase = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    pos[i * 3]     = (Math.random() - 0.5) * 55;
    pos[i * 3 + 1] = Math.random() * 22;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 55;
    phase[i] = Math.random() * Math.PI * 2;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({
    color: style.color, size: style.size, transparent: true,
    opacity: style.opacity, depthWrite: false, sizeAttenuation: true,
  }));
  pts.frustumCulled = false;
  scene.add(pts);

  let t = 0;
  function update(dt) {
    t += dt;
    pts.position.set(playerPosition.x, 0, playerPosition.z);
    for (let i = 0; i < N; i++) {
      pos[i * 3 + 1] -= style.fall * dt;
      pos[i * 3]     += Math.sin(t * 1.3 + phase[i]) * style.sway * dt;
      if (pos[i * 3 + 1] < 0) {
        pos[i * 3]     = (Math.random() - 0.5) * 55;
        pos[i * 3 + 1] = 20 + Math.random() * 4;
        pos[i * 3 + 2] = (Math.random() - 0.5) * 55;
      }
    }
    geo.attributes.position.needsUpdate = true;
  }

  return { update, season };
}
