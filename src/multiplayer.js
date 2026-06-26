import * as THREE from 'three';
import * as Ably from 'ably';

const SEND_INTERVAL = 0.05;   // seconds — broadcast at ~20 fps
const CHANNEL_NAME  = 'world';

function makeNameLabel(name) {
  if (!name) return null;
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 64;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.beginPath();
  const r = 10, w = 256, h = 64;
  ctx.moveTo(r,0); ctx.lineTo(w-r,0); ctx.quadraticCurveTo(w,0,w,r);
  ctx.lineTo(w,h-r); ctx.quadraticCurveTo(w,h,w-r,h);
  ctx.lineTo(r,h);   ctx.quadraticCurveTo(0,h,0,h-r);
  ctx.lineTo(0,r);   ctx.quadraticCurveTo(0,0,r,0);
  ctx.closePath(); ctx.fill();

  ctx.font = 'bold 28px Arial, sans-serif';
  ctx.fillStyle = 'white';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(name.slice(0, 16), 128, 34);

  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(1.4, 0.35, 1);
  sprite.position.y = 2.1;
  return sprite;
}

function makeAvatar(color, name) {
  const g    = new THREE.Group();
  const R    = 0.22;
  const L    = 0.85;
  const BODY = L + 2 * R;   // 1.29

  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(R, L, 4, 8),
    new THREE.MeshLambertMaterial({ color }),
  );
  body.position.y = BODY / 2;
  g.add(body);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 10, 8),
    new THREE.MeshLambertMaterial({ color: 0xD4956A }),
  );
  head.position.y = BODY + 0.22;
  g.add(head);

  const label = makeNameLabel(name);
  if (label) g.add(label);

  return g;
}

export function createMultiplayer(scene, camera, myColor, myName) {
  const key = import.meta.env.VITE_ABLY_KEY;
  if (!key || key === 'your_ably_api_key_here') {
    console.warn('Multiplayer disabled — VITE_ABLY_KEY not set');
    return { update() {} };
  }

  const myId = Math.random().toString(36).slice(2, 10);
  const remotes = new Map();   // clientId → { mesh, tx, tz, try }
  let   sendTimer = 0;

  const client  = new Ably.Realtime({
    key:      key,
    clientId: myId,
  });
  const channel = client.channels.get(CHANNEL_NAME);

  // ── Presence: join / leave ────────────────────────────────────────────────
  channel.presence.subscribe('enter', (member) => {
    if (member.clientId === myId) return;
    spawnRemote(member.clientId, member.data?.color ?? 0xAAAAAA, member.data?.name ?? '', 0, 0, 0);
  });

  channel.presence.subscribe('leave', (member) => {
    removeRemote(member.clientId);
  });

  // Enter the presence set and snapshot existing occupants
  channel.presence.enter({ color: myColor, name: myName }).then(() => {
    channel.presence.get((err, members) => {
      if (err || !members) return;
      for (const m of members) {
        if (m.clientId !== myId) {
          spawnRemote(m.clientId, m.data?.color ?? 0xAAAAAA, m.data?.name ?? '', 0, 0, 0);
        }
      }
    });
  });

  // ── Position updates ──────────────────────────────────────────────────────
  channel.subscribe('move', (msg) => {
    if (msg.clientId === myId) return;
    const { x, z, ry } = msg.data;
    const r = remotes.get(msg.clientId);
    if (r) {
      r.tx = x; r.tz = z; r.try = ry;
    } else {
      // Move arrived before presence enter — spawn avatar immediately
      spawnRemote(msg.clientId, 0xAAAAAA, '', x, z, ry);
    }
  });

  // ── Helpers ───────────────────────────────────────────────────────────────
  function spawnRemote(id, color, name, x, z, ry) {
    if (remotes.has(id)) return;
    const mesh = makeAvatar(color, name);
    mesh.position.set(x, 0, z);
    mesh.rotation.y = ry;
    scene.add(mesh);
    remotes.set(id, { mesh, tx: x, tz: z, try: ry });
  }

  function removeRemote(id) {
    const r = remotes.get(id);
    if (!r) return;
    scene.remove(r.mesh);
    remotes.delete(id);
  }

  // ── Per-frame update ──────────────────────────────────────────────────────
  function update(dt) {
    // Throttled broadcast of own position
    sendTimer += dt;
    if (sendTimer >= SEND_INTERVAL) {
      sendTimer = 0;
      channel.publish('move', {
        x:  camera.position.x,
        z:  camera.position.z,
        ry: camera.rotation.y,
      });
    }

    // Smoothly interpolate remote avatars toward their latest known position
    for (const r of remotes.values()) {
      r.mesh.position.x = THREE.MathUtils.lerp(r.mesh.position.x, r.tx, 0.2);
      r.mesh.position.z = THREE.MathUtils.lerp(r.mesh.position.z, r.tz, 0.2);

      let diff = r.try - r.mesh.rotation.y;
      while (diff >  Math.PI) diff -= 2 * Math.PI;
      while (diff < -Math.PI) diff += 2 * Math.PI;
      r.mesh.rotation.y += diff * 0.2;
    }
  }

  return { update };
}
