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

  const eyeGeo = new THREE.SphereGeometry(0.035, 6, 6);
  const eyeMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  [-0.08, 0.08].forEach(ex => {
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.position.set(ex, BODY + 0.26, -0.19);
    g.add(eye);
  });

  const label = makeNameLabel(name);
  if (label) g.add(label);

  return g;
}

export function createMultiplayer(scene, getState, myColor, myName) {
  const key = import.meta.env.VITE_ABLY_KEY;
  if (!key || key === 'your_ably_api_key_here') {
    console.warn('Multiplayer disabled — VITE_ABLY_KEY not set');
    return { update() {}, getRemotes() { return []; } };
  }

  const myId = Math.random().toString(36).slice(2, 10);
  const remotes = new Map();   // clientId → { mesh, color, name, tx, tz, try }
  let   sendTimer = SEND_INTERVAL;  // broadcast position on the very first frame

  const client  = new Ably.Realtime({
    key:      key,
    clientId: myId,
  });
  const channel = client.channels.get(CHANNEL_NAME);

  // ── Presence: join / leave ────────────────────────────────────────────────
  // 'present' fires for members already in the channel when we attach;
  // 'enter'   fires for members who join after us.
  // Both call the same handler so we never miss anyone regardless of timing.
  function handleMemberJoin(member) {
    if (member.clientId === myId) return;
    const color = member.data?.color ?? 0xAAAAAA;
    const name  = member.data?.name  ?? '';
    const r = remotes.get(member.clientId);
    if (r) {
      // A move message arrived before presence — avatar exists but may be grey/unnamed.
      // Update colour and rebuild the name label with the real presence data.
      if (r.mesh.children[0]) r.mesh.children[0].material.color.setHex(color);
      r.color = color;
      r.name  = name;
      // Remove any existing label (children beyond body + head), then re-add.
      while (r.mesh.children.length > 2) {
        const old = r.mesh.children[2];
        if (old.material?.map) old.material.map.dispose();
        if (old.material) old.material.dispose();
        r.mesh.remove(old);
      }
      const label = makeNameLabel(name);
      if (label) r.mesh.add(label);
    } else {
      spawnRemote(member.clientId, color, name, 0, 0, 0);
    }
    // Force-broadcast our own position immediately so the new joiner sees us.
    sendTimer = SEND_INTERVAL;
  }

  channel.presence.subscribe('present', handleMemberJoin);
  channel.presence.subscribe('enter',   handleMemberJoin);
  channel.presence.subscribe('leave',   member => removeRemote(member.clientId));

  // Enter then snapshot — 'present' fires for members already in the channel
  // during attach; get() is a safety net in case any were missed due to timing.
  channel.presence.enter({ color: myColor, name: myName }).then(() => {
    channel.presence.get().then(members => {
      if (!members) return;
      for (const m of members) {
        if (m.clientId !== myId) handleMemberJoin(m);
      }
    }).catch(() => {});
  });

  // ── Position updates ──────────────────────────────────────────────────────
  channel.subscribe('move', (msg) => {
    if (msg.clientId === myId) return;
    const { x, z, ry } = msg.data;
    const r = remotes.get(msg.clientId);
    if (r) {
      r.tx = x; r.tz = z; r.try = ry;
    } else {
      // Move arrived before presence enter — spawn with grey placeholder.
      // handleMemberJoin will update colour/name when presence catches up.
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
    remotes.set(id, { mesh, color, name, tx: x, tz: z, try: ry });
  }

  function removeRemote(id) {
    const r = remotes.get(id);
    if (!r) return;
    scene.remove(r.mesh);
    remotes.delete(id);
  }

  function getRemotes() {
    const out = [];
    for (const r of remotes.values()) {
      out.push({ x: r.mesh.position.x, z: r.mesh.position.z, color: r.color, name: r.name });
    }
    return out;
  }

  // ── Per-frame update ──────────────────────────────────────────────────────
  function update(dt) {
    // Throttled broadcast of own position
    sendTimer += dt;
    if (sendTimer >= SEND_INTERVAL) {
      sendTimer = 0;
      const { x, z, ry } = getState();
      channel.publish('move', { x, z, ry });
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

  return { update, getRemotes };
}
