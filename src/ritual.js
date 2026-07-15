import * as THREE from 'three';
import { toast } from './hud.js';
import { bus } from './bus.js';

// Campfire ritual — when two or more different players feed the beach
// campfire within the same minute, the fire erupts: a golden ember column
// rises for two minutes and the flames blaze map-visibly. Feeds arrive via
// the existing Ably channel; solo feeding still stokes the fire normally.

const FIRE   = { x: -465, y: 1.0, z: 578 };
const WINDOW = 60;    // seconds two feeds must fall within
const DURATION = 120; // seconds the ritual blaze lasts

const EMBERS = 70;

export function createRitual(scene, { audio }) {
  const feeds = new Map();   // feeder id → time of last feed (seconds)
  let ritualT = 0;

  // ── Ember column ────────────────────────────────────────────────────────────
  const pos  = new Float32Array(EMBERS * 3);
  const life = new Float32Array(EMBERS);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xFFC050, size: 0.16, transparent: true, opacity: 0.9,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const points = new THREE.Points(geo, mat);
  points.position.set(FIRE.x, FIRE.y, FIRE.z);
  points.visible = false;
  points.frustumCulled = false;
  scene.add(points);

  function resetEmber(i) {
    const a = Math.random() * Math.PI * 2, r = Math.random() * 0.5;
    pos[i * 3]     = Math.cos(a) * r;
    pos[i * 3 + 1] = Math.random() * 0.4;
    pos[i * 3 + 2] = Math.sin(a) * r;
    life[i] = 1.5 + Math.random() * 2.5;
  }
  for (let i = 0; i < EMBERS; i++) resetEmber(i);

  function onFeed(id, nowSec) {
    feeds.set(id, nowSec);
    for (const [k, t] of feeds) if (nowSec - t > WINDOW) feeds.delete(k);
    if (feeds.size >= 2 && ritualT <= 0) {
      ritualT = DURATION;
      points.visible = true;
      audio.sfx.fanfare();
      toast("🔥 The Wardens' fire roars to life — the ritual is complete!", 5500);
      bus.emit('ritual');
    }
  }

  function update(dt, nowSec) {
    if (ritualT <= 0) return;
    ritualT -= dt;
    if (ritualT <= 0) { points.visible = false; return; }

    for (let i = 0; i < EMBERS; i++) {
      life[i] -= dt;
      if (life[i] <= 0) { resetEmber(i); continue; }
      pos[i * 3 + 1] += (2.2 + (i % 5) * 0.4) * dt;
      pos[i * 3]     += Math.sin(nowSec * 3 + i) * 0.35 * dt;
      pos[i * 3 + 2] += Math.cos(nowSec * 2.6 + i) * 0.35 * dt;
    }
    geo.attributes.position.needsUpdate = true;
    mat.opacity = Math.min(0.9, ritualT * 0.5);   // fade out at the end
  }

  // Extra stoke for the campfire flame/light while the ritual burns
  function getBoost() { return ritualT > 0 ? 2.2 : 0; }

  return { onFeed, update, getBoost };
}
