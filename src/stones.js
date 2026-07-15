import * as THREE from 'three';
import { save, load } from './persistence.js';
import { toast } from './hud.js';
import { LANDMARKS } from './world.config.js';

// Physical stone skipping at the pond. The E interact throws a real stone
// toward the water — shallow, fast contacts skip with a ripple and a plink,
// steep or slow ones sink. Skip count is toasted and the personal best is
// persisted per device.

const POND    = LANDMARKS.pond;          // { x: -160, z: 20 }
const WATER_Y = 0.14;                    // pond water surface (landmarks.js)
const HALF_X  = 17, HALF_Z = 10;         // water plane is 36 × 22
const GRAV    = -14;

export function createStones(scene, { interact, audio, playerPosition }) {
  const stoneGeo = new THREE.SphereGeometry(0.09, 6, 5);
  const stoneMat = new THREE.MeshLambertMaterial({ color: 0x8A8578 });
  const ringGeo  = new THREE.RingGeometry(0.12, 0.16, 20);
  const live  = [];   // { mesh, vx, vy, vz, skips, done }
  const rings = [];   // { mesh, life }
  let best = load('stoneBest', 0);

  const inPond = (x, z) => Math.abs(x - POND.x) < HALF_X && Math.abs(z - POND.z) < HALF_Z;

  function throwStone() {
    // Aim from the player toward a point past the middle of the pond
    const tx = POND.x + (Math.random() - 0.5) * 10;
    const tz = POND.z + (Math.random() - 0.5) * 6;
    let dx = tx - playerPosition.x, dz = tz - playerPosition.z;
    const len = Math.hypot(dx, dz) || 1;
    dx /= len; dz /= len;
    const speed = 11 + Math.random() * 3;
    const m = new THREE.Mesh(stoneGeo, stoneMat);
    m.scale.y = 0.55;
    m.position.set(playerPosition.x + dx * 1.2, 0.95, playerPosition.z + dz * 1.2);
    scene.add(m);
    live.push({ mesh: m, vx: dx * speed, vy: 0.2 + Math.random() * 0.6, vz: dz * speed, skips: 0, done: 0 });
  }

  interact.register({
    x: -145, z: 24, r: 6,
    label: '🪨 Skip a stone across the pond',
    cb: throwStone,
  });

  function ripple(x, z) {
    const r = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({
      color: 0xBFE8FF, transparent: true, opacity: 0.8,
      depthWrite: false, side: THREE.DoubleSide,
    }));
    r.rotation.x = -Math.PI / 2;
    r.position.set(x, WATER_Y + 0.02, z);
    scene.add(r);
    rings.push({ mesh: r, life: 0.8 });
  }

  function finish(s, msg, dur = 2400) {
    toast(msg, dur);
    s.done = 0.1;
  }

  function settle(s) {
    if (s.skips > best) {
      best = s.skips;
      save('stoneBest', best);
      return '  🏆 New personal best!';
    }
    return best > 0 ? `  (best: ${best})` : '';
  }

  function update(dt) {
    for (let i = live.length - 1; i >= 0; i--) {
      const s = live[i];
      if (s.done > 0) {
        s.done -= dt;
        if (s.done <= 0) { scene.remove(s.mesh); live.splice(i, 1); }
        continue;
      }
      s.vy += GRAV * dt;
      s.mesh.position.x += s.vx * dt;
      s.mesh.position.y += s.vy * dt;
      s.mesh.position.z += s.vz * dt;
      s.mesh.rotation.x += dt * 9;
      const { x, y, z } = s.mesh.position;

      if (inPond(x, z) && y <= WATER_Y + 0.05 && s.vy < 0) {
        const hSpeed = Math.hypot(s.vx, s.vz);
        if (hSpeed > 4.5 && -s.vy < 6.5) {
          // Shallow and fast — skip!
          s.skips++;
          s.vy = Math.abs(s.vy) * 0.55 + 0.6;
          s.vx *= 0.80; s.vz *= 0.80;
          s.mesh.position.y = WATER_Y + 0.05;
          ripple(x, z);
          audio.sfx.plink();
        } else {
          // Too steep or out of pace — under it goes
          ripple(x, z);
          audio.sfx.splash();
          s.mesh.visible = false;
          if (s.skips > 0) {
            finish(s, `🪨 ${s.skips} skip${s.skips === 1 ? '' : 's'}!${settle(s)}`);
          } else {
            finish(s, '🪨 Plop. Straight down.', 1800);
          }
        }
      } else if (!inPond(x, z) && y <= 0.15) {
        // Cleared the far bank — every skip counted, plus bragging rights
        s.mesh.position.y = 0.05;
        if (s.skips > 0) {
          finish(s, `🪨 ${s.skips} skip${s.skips === 1 ? '' : 's'} — clean across the pond!${settle(s)}`, 3000);
        } else {
          finish(s, '🪨 Thud. The pond was the other way.', 1800);
        }
        s.done = 1.2;   // let it rest on the grass a moment
      }
    }

    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i];
      r.life -= dt;
      const sc = 1 + (0.8 - r.life) * 6;
      r.mesh.scale.set(sc, sc, 1);
      r.mesh.material.opacity = Math.max(0, r.life);
      if (r.life <= 0) {
        r.mesh.material.dispose();
        scene.remove(r.mesh);
        rings.splice(i, 1);
      }
    }
  }

  return { update };
}
