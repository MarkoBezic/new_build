import * as THREE from 'three';
import { SKY_ISLANDS, UPDRAFTS } from './zones.js';
import { terrainHeight } from './terrain.js';
import { toast } from './hud.js';
import { grantHat, wearHat, ownedHats } from './hats.js';

// Sky islands — three floating rocks stepping up from the Icy Peaks, linked
// by sparkling updraft columns that lift a deployed glider. The highest one
// holds a plinth with the Cloud Wisp hat, proof you walked the sky.

export function createSkyIslands(scene, { interact, audio, playerPosition }) {
  const rockMat  = new THREE.MeshLambertMaterial({ color: 0x6A7280, flatShading: true });
  const grassMat = new THREE.MeshLambertMaterial({ color: 0x9CC49A, flatShading: true });
  const iceMat   = new THREE.MeshStandardMaterial({
    color: 0x9FE8FF, emissive: 0x4090B0, emissiveIntensity: 0.4, roughness: 0.3, flatShading: true,
  });

  for (const s of SKY_ISLANDS) {
    const g = new THREE.Group();
    // Hanging rock cone under the surface disc
    const under = new THREE.Mesh(new THREE.ConeGeometry(s.r, s.r * 1.3, 9), rockMat);
    under.rotation.x = Math.PI;
    under.position.y = -s.r * 0.65;
    g.add(under);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(s.r, s.r * 0.96, 0.8, 12), grassMat);
    top.position.y = -0.4;
    g.add(top);
    // A few ice crystals catching the light
    for (let i = 0; i < 4; i++) {
      const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.5 + Math.random() * 0.5, 0), iceMat);
      const a = Math.random() * Math.PI * 2, d = Math.random() * s.r * 0.6;
      c.position.set(Math.cos(a) * d, 0.4, Math.sin(a) * d);
      c.scale.y = 1.8;
      g.add(c);
    }
    g.position.set(s.x, s.top, s.z);
    scene.add(g);
  }

  // ── Updraft columns — rising sparkles from ground to lift ceiling ──────────
  const drafts = UPDRAFTS.map(u => {
    const N = 26;
    const base = terrainHeight(u.x, u.z);
    const pos = new Float32Array(N * 3);
    const spd = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      pos[i * 3]     = (Math.random() - 0.5) * u.r * 1.4;
      pos[i * 3 + 1] = base + Math.random() * (u.top - base);
      pos[i * 3 + 2] = (Math.random() - 0.5) * u.r * 1.4;
      spd[i] = 6 + Math.random() * 5;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({
      color: 0xDFF6FF, size: 0.35, transparent: true, opacity: 0.55,
      depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    pts.position.set(u.x, 0, u.z);
    pts.frustumCulled = false;
    scene.add(pts);
    return { u, geo, pos, spd, base, n: N };
  });

  // ── Cloud Wisp plinth on the highest island ─────────────────────────────────
  const peak = SKY_ISLANDS[SKY_ISLANDS.length - 1];
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.65, 1.1, 8), rockMat);
  plinth.position.set(peak.x, peak.top + 0.55, peak.z);
  scene.add(plinth);
  const wispDisplay = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6),
    new THREE.MeshLambertMaterial({ color: 0xF4F8FF, transparent: true, opacity: 0.85 }));
  wispDisplay.position.set(peak.x, peak.top + 1.5, peak.z);
  wispDisplay.visible = !ownedHats().includes('cloud');
  scene.add(wispDisplay);

  interact.register({
    x: peak.x, z: peak.z, r: 4,
    label: '☁️ Take the Cloud Wisp',
    when: () => playerPosition.y > peak.top - 4 && !ownedHats().includes('cloud'),
    cb: () => {
      grantHat('cloud');
      wearHat('cloud');
      wispDisplay.visible = false;
      audio.sfx.fanfare();
      toast('☁️ The Cloud Wisp settles on your head — proof you walked the sky.', 6000);
    },
  });

  function update(dt, nowSec) {
    // Sparkle columns are invisible from across the map — skip when far
    if (Math.hypot(playerPosition.x - 300, playerPosition.z + 540) > 420) return;
    wispDisplay.position.y = peak.top + 1.5 + Math.sin(nowSec * 1.4) * 0.1;
    for (const d of drafts) {
      for (let i = 0; i < d.n; i++) {
        d.pos[i * 3 + 1] += d.spd[i] * dt;
        if (d.pos[i * 3 + 1] > d.u.top) d.pos[i * 3 + 1] = d.base;
      }
      d.geo.attributes.position.needsUpdate = true;
    }
  }

  return { update };
}
