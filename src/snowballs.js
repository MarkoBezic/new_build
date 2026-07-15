import * as THREE from 'three';
import { groundY } from './zones.js';
import { toast } from './hud.js';
import { bus } from './bus.js';
import { isMobile } from './player.js';

// Snowballs — anywhere in the Icy Peaks, G (or the mobile ❄️ button) scoops
// and throws a snowball along the camera's look direction. Impacts burst
// into a white puff; direct hits on other players (or the resident NPCs)
// get called out. Throws are broadcast over the existing Ably channel so
// everyone sees the same snowball fly.

const GRAV = -20, SPEED = 22, COOLDOWN = 0.45, MAX_LIFE = 5;

export function createSnowballs(scene, { camera, playerPosition, biomeAt, audio, getTargets, onBroadcast }) {
  const geo = new THREE.SphereGeometry(0.11, 6, 5);
  const mat = new THREE.MeshLambertMaterial({ color: 0xF4F8FF });
  const live  = [];   // { mesh, vx, vy, vz, life, mine }
  const puffs = [];   // { p, life }
  let cool = 0;
  const _dir = new THREE.Vector3();

  const puffGeo = new THREE.BufferGeometry();
  {
    const pos = new Float32Array(10 * 3);
    for (let i = 0; i < 10; i++) {
      pos[i * 3]     = (Math.random() - 0.5) * 0.5;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 0.5;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 0.5;
    }
    puffGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  }

  const canThrow = () => biomeAt(playerPosition.x, playerPosition.z) === 'Icy Peaks';

  function spawn(x, y, z, vx, vy, vz, mine) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    scene.add(m);
    live.push({ mesh: m, vx, vy, vz, life: MAX_LIFE, mine });
  }

  function throwBall() {
    if (cool > 0 || !canThrow()) return;
    cool = COOLDOWN;
    camera.getWorldDirection(_dir);
    const x = playerPosition.x + _dir.x * 1.1;
    const y = playerPosition.y + 0.4;
    const z = playerPosition.z + _dir.z * 1.1;
    const vx = _dir.x * SPEED, vy = _dir.y * SPEED + 3.5, vz = _dir.z * SPEED;
    spawn(x, y, z, vx, vy, vz, true);
    audio.sfx.whiff();
    if (onBroadcast) onBroadcast({ x, y, z, vx, vy, vz });
  }

  function spawnRemote(d) {
    spawn(d.x, d.y, d.z, d.vx, d.vy, d.vz, false);
  }

  function puff(x, y, z) {
    const p = new THREE.Points(puffGeo, new THREE.PointsMaterial({
      color: 0xFFFFFF, size: 0.14, transparent: true, opacity: 0.95, depthWrite: false,
    }));
    p.position.set(x, y, z);
    scene.add(p);
    puffs.push({ p, life: 0.5 });
  }

  function onKey(e) {
    if (e.code === 'KeyG') throwBall();
  }

  // Mobile ❄️ button — only visible inside the biome
  let btn = null;
  if (isMobile) {
    btn = document.createElement('button');
    btn.textContent = '❄️';
    Object.assign(btn.style, {
      position: 'fixed', bottom: '214px', right: '20px',
      width: '56px', height: '56px', borderRadius: '50%',
      fontSize: '24px', border: 'none', display: 'none',
      background: 'rgba(159,232,255,0.35)', color: '#fff', zIndex: '30',
    });
    btn.addEventListener('touchend', e => { e.preventDefault(); throwBall(); });
    document.body.appendChild(btn);
  }

  function update(dt) {
    cool = Math.max(0, cool - dt);
    if (btn) btn.style.display = canThrow() ? 'block' : 'none';

    for (let i = live.length - 1; i >= 0; i--) {
      const s = live[i];
      s.vy += GRAV * dt;
      s.mesh.position.x += s.vx * dt;
      s.mesh.position.y += s.vy * dt;
      s.mesh.position.z += s.vz * dt;
      s.life -= dt;
      const { x, y, z } = s.mesh.position;

      // Direct hits only score for the local thrower — remote splats stay visual
      let hitName = null;
      if (s.mine && getTargets) {
        for (const t of getTargets()) {
          if (Math.hypot(x - t.x, z - t.z) < 0.9 &&
              Math.abs(y - (groundY(t.x, t.z) + 1.2)) < 1.8) {
            hitName = t.name || 'someone';
            break;
          }
        }
      }

      const g = groundY(x, z);
      if (hitName || y <= g + 0.12 || s.life <= 0) {
        puff(x, Math.max(y, g + 0.15), z);
        audio.sfx.splat();
        if (hitName) { toast(`❄️ Direct hit on ${hitName}!`, 2000); bus.emit('snowball-hit'); }
        scene.remove(s.mesh);
        live.splice(i, 1);
      }
    }

    for (let i = puffs.length - 1; i >= 0; i--) {
      const pf = puffs[i];
      pf.life -= dt;
      const sc = 1 + (0.5 - pf.life) * 5;
      pf.p.scale.set(sc, sc, sc);
      pf.p.material.opacity = Math.max(0, pf.life * 1.9);
      if (pf.life <= 0) {
        pf.p.material.dispose();
        scene.remove(pf.p);
        puffs.splice(i, 1);
      }
    }
  }

  return { update, onKey, spawnRemote };
}
