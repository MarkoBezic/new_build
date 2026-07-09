import * as THREE from 'three';
import { toast } from './hud.js';

// Cosmetic progression — no power, pure identity. Particle trails unlock per
// completed shard set; the Warden's Crown unlocks when the journal is full.
// B cycles between unlocked trails.

export const TRAILS = {
  none:   { label: 'No trail',      color: null },
  forest: { label: 'Emerald Trail', color: 0x6FE86F },
  beach:  { label: 'Sunset Trail',  color: 0xFFB347 },
  cave:   { label: 'Violet Trail',  color: 0xA85CF0 },
  icy:    { label: 'Frost Trail',   color: 0x9FE8FF },
  ruins:  { label: 'Gold Trail',    color: 0xFFD75A },
};

function makeDotTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d').createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  const cx = c.getContext('2d');
  cx.fillStyle = g;
  cx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export function createCosmetics(scene, getAvatar, progress) {
  // ── Trail particle pool ─────────────────────────────────────────────────────
  const POOL = 26, LIFE = 0.9;
  const tex = makeDotTexture();
  const pool = [];
  for (let i = 0; i < POOL; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex, transparent: true, opacity: 0, depthWrite: false,
      blending: THREE.AdditiveBlending, color: 0xffffff,
    }));
    sp.visible = false;
    scene.add(sp);
    pool.push({ sp, life: 0 });
  }

  let next = 0, emitTimer = 0;
  const lastPos = new THREE.Vector3(Infinity, 0, Infinity);

  // ── Warden's Crown ──────────────────────────────────────────────────────────
  let crownMesh = null;
  function applyCrown() {
    if (crownMesh || !progress.get('crown')) return;
    const gold = new THREE.MeshStandardMaterial({
      color: 0xE8B93C, emissive: 0x7A5A10, emissiveIntensity: 0.5,
      metalness: 0.7, roughness: 0.3,
    });
    crownMesh = new THREE.Group();
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.17, 0.09, 10, 1, true), gold);
    crownMesh.add(band);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.11, 4), gold);
      spike.position.set(Math.cos(a) * 0.15, 0.09, Math.sin(a) * 0.15);
      crownMesh.add(spike);
    }
    crownMesh.position.y = 1.68;   // atop the humanoid head (r 0.20 at y 1.49)
    getAvatar().add(crownMesh);
  }
  applyCrown();

  function unlockTrail(id) {
    if (progress.has('trails', id)) return;
    progress.add('trails', id);
    progress.set('trail', id);   // auto-equip the newest unlock
    toast(`🎨 Unlocked: ${TRAILS[id].label} — press B to switch`);
  }

  function unlockCrown() {
    if (progress.get('crown')) return;
    progress.set('crown', true);
    applyCrown();
    toast(`👑 The Warden's Crown is yours`);
  }

  // B — cycle equipped trail among unlocks
  window.addEventListener('keydown', e => {
    if (e.code !== 'KeyB') return;
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    const owned = progress.get('trails');
    if (owned.length < 2) return;
    const i = owned.indexOf(progress.get('trail'));
    const nextId = owned[(i + 1) % owned.length];
    progress.set('trail', nextId);
    toast(`Trail: ${TRAILS[nextId].label}`, 1800);
  });

  function update(dt) {
    const trail = TRAILS[progress.get('trail')];
    const avatar = getAvatar();

    // Emit while moving and a trail is equipped
    if (trail?.color != null && avatar.visible) {
      emitTimer -= dt;
      const moved = lastPos.distanceToSquared(avatar.position) > 0.02;
      if (moved && emitTimer <= 0) {
        emitTimer = 0.055;
        const p = pool[next]; next = (next + 1) % POOL;
        p.life = LIFE;
        p.sp.visible = true;
        p.sp.material.color.setHex(trail.color);
        p.sp.position.set(
          avatar.position.x + (Math.random() - 0.5) * 0.25,
          avatar.position.y + 0.35,
          avatar.position.z + (Math.random() - 0.5) * 0.25,
        );
      }
      lastPos.copy(avatar.position);
    }

    for (const p of pool) {
      if (p.life <= 0) continue;
      p.life -= dt;
      const k = Math.max(0, p.life / LIFE);
      p.sp.material.opacity = k * 0.75;
      p.sp.scale.setScalar(0.25 + (1 - k) * 0.55);
      p.sp.position.y += dt * 0.35;
      if (p.life <= 0) p.sp.visible = false;
    }
  }

  return { update, unlockTrail, unlockCrown };
}
