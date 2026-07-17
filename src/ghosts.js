import { buildHumanoid, animateAvatar, makeNameLabel } from './humanoid.js';
import { groundY } from './zones.js';

// Client-side "ghost player" simulation — a handful of named avatars that
// roam, idle, jump and emote so the world feels inhabited even when no real
// players are online. They also appear on the minimap via getRemotes().
// Every ghost is tagged "(NPC)" in its name label and on the minimap so
// real players are never mistaken for automated ones.

const ROSTER = [
  { name: 'Nova', color: 0xE06A9A },
  { name: 'Rook', color: 0x5AC8FA },
  { name: 'Juno', color: 0xF2C14E },
  { name: 'Miro', color: 0x7ED07E },
];

// Flat, interesting places to wander between
const REGIONS = [
  { x0: -50,  x1:  50,  z0: -55,  z1:  55 },   // main clearing
  { x0: -20,  x1:  20,  z0: -175, z1: -60 },   // spawn approach path
  { x0: -180, x1: -140, z0:   5,  z1:  38 },   // pond
  { x0: -500, x1: -440, z0: 560,  z1: 615 },   // beach / volleyball
];

const GRAVITY = -28, JUMP_VEL = 9;
const EMOTE_IDS = ['wave', 'cheer', 'point'];

const rnd = (a, b) => a + Math.random() * (b - a);

function pickTarget(regionIdx) {
  const r = REGIONS[regionIdx];
  return { x: rnd(r.x0, r.x1), z: rnd(r.z0, r.z1) };
}

export function createGhosts(scene, { applyEmote } = {}) {
  const ghosts = ROSTER.map((def, i) => {
    const mesh = buildHumanoid(def.color);
    mesh.add(makeNameLabel(def.name, ' (NPC)'));
    const region = i % REGIONS.length;
    const start  = pickTarget(region);
    mesh.position.set(start.x, groundY(start.x, start.z), start.z);
    scene.add(mesh);
    return {
      ...def, mesh, region,
      target: pickTarget(region),
      speed:  rnd(2.4, 4.6),
      wait:   rnd(0, 3),
      vy: 0, emote: null,
    };
  });

  function update(dt) {
    for (const g of ghosts) {
      const m = g.mesh;
      let moving = false;

      if (g.wait > 0) {
        g.wait -= dt;
        // Occasionally emote while idling
        if (!g.emote && Math.random() < dt * 0.15) {
          g.emote = { id: EMOTE_IDS[Math.floor(Math.random() * EMOTE_IDS.length)], t: 0, dur: 2.0 };
        }
      } else {
        const dx = g.target.x - m.position.x, dz = g.target.z - m.position.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 1.2) {
          g.wait = rnd(1.5, 6);
          if (Math.random() < 0.22) g.region = Math.floor(Math.random() * REGIONS.length);
          g.target = pickTarget(g.region);
          g.speed  = rnd(2.4, 4.6);
        } else {
          moving = true;
          const want = Math.atan2(dx, dz);
          let diff = want - m.rotation.y;
          while (diff >  Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          m.rotation.y += diff * Math.min(6 * dt, 1);
          m.position.x += Math.sin(m.rotation.y) * g.speed * dt;
          m.position.z += Math.cos(m.rotation.y) * g.speed * dt;
          // Playful random hop
          if (g.vy === 0 && Math.random() < dt * 0.08) g.vy = JUMP_VEL;
        }
      }

      // Vertical physics against the shared ground function
      const ground = groundY(m.position.x, m.position.z);
      if (g.vy !== 0 || m.position.y > ground) {
        g.vy += GRAVITY * dt;
        m.position.y += g.vy * dt;
        if (m.position.y <= ground) { m.position.y = ground; g.vy = 0; }
      } else {
        m.position.y = ground;
      }

      animateAvatar(m, dt, moving);

      if (g.emote && applyEmote) {
        g.emote.t += dt;
        applyEmote(m, g.emote.id, g.emote.t);
        if (g.emote.t >= g.emote.dur) g.emote = null;
      }
    }
  }

  // Reused output — getRemotes is called every frame (minimap, snowball
  // targets); rebuilding four fresh objects per call was pure GC churn.
  const _out = ghosts.map(g => ({ x: 0, z: 0, color: g.color, name: `${g.name} (NPC)` }));
  function getRemotes() {
    for (let i = 0; i < ghosts.length; i++) {
      _out[i].x = ghosts[i].mesh.position.x;
      _out[i].z = ghosts[i].mesh.position.z;
    }
    return _out;
  }

  return { update, getRemotes };
}
