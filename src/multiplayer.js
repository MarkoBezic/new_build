import * as THREE from 'three';
import * as Ably from 'ably';
import { buildHumanoid, animateAvatar, makeNameLabel } from './humanoid.js';
import { setHatMesh } from './hats.js';

const SEND_INTERVAL = 0.05;   // seconds — broadcast at ~20 fps
const CHANNEL_NAME  = 'world';

function makeAvatar(color, name, hat) {
  const g = buildHumanoid(color);
  const label = makeNameLabel(name);
  if (label) { g.add(label); g.userData.nameLabel = label; }
  if (hat) setHatMesh(g, hat);
  return g;
}

export function createMultiplayer(scene, getState, myColor, myName, { onRemoteEmote, onBallState, onChat, onSnow, onFire, onPlinko, onHome, hat } = {}) {
  const key = import.meta.env.VITE_ABLY_KEY;
  if (!key || key === 'your_ably_api_key_here') {
    console.warn('Multiplayer disabled — VITE_ABLY_KEY not set');
    return { update() {}, getRemotes() { return []; }, broadcastEmote() {}, publishBall() {}, sendChat() {}, publishSnow() {}, publishFire() {}, updateHat() {}, publishPlinko() {}, publishHome() {} };
  }
  let myHat = hat ?? null;

  const myId = Math.random().toString(36).slice(2, 10);
  const remotes = new Map();   // clientId → { mesh, color, name, tx, tz, try }
  let   sendTimer = SEND_INTERVAL;  // broadcast position on the very first frame

  const client   = new Ably.Realtime({ key, clientId: myId });
  const channel  = client.channels.get(CHANNEL_NAME);
  const vChannel = client.channels.get('volleyball');

  // ── Presence: join / leave ────────────────────────────────────────────────
  // 'present' fires for members already in the channel when we attach;
  // 'enter'   fires for members who join after us.
  // Both call the same handler so we never miss anyone regardless of timing.
  function handleMemberJoin(member) {
    if (member.clientId === myId) return;
    const color = member.data?.color ?? 0xAAAAAA;
    const name  = member.data?.name  ?? '';
    const rHat  = member.data?.hat   ?? null;
    const r = remotes.get(member.clientId);
    if (r) {
      // A move message arrived before presence — avatar exists but may be grey/unnamed.
      if (r.mesh.userData.bodyMat) r.mesh.userData.bodyMat.color.setHex(color);
      r.color = color;
      r.name  = name;
      setHatMesh(r.mesh, rHat);
      // Replace name label
      if (r.mesh.userData.nameLabel) {
        const old = r.mesh.userData.nameLabel;
        if (old.material?.map) old.material.map.dispose();
        if (old.material) old.material.dispose();
        r.mesh.remove(old);
        r.mesh.userData.nameLabel = null;
      }
      const label = makeNameLabel(name);
      if (label) { r.mesh.add(label); r.mesh.userData.nameLabel = label; }
    } else {
      spawnRemote(member.clientId, color, name, 0, 0, 0, rHat);
    }
    // Force-broadcast our own position immediately so the new joiner sees us.
    sendTimer = SEND_INTERVAL;
  }

  channel.presence.subscribe('present', handleMemberJoin);
  channel.presence.subscribe('enter',   handleMemberJoin);
  channel.presence.subscribe('update',  handleMemberJoin);   // hat changes
  channel.presence.subscribe('leave',   member => removeRemote(member.clientId));

  // Enter then snapshot — 'present' fires for members already in the channel
  // during attach; get() is a safety net in case any were missed due to timing.
  channel.presence.enter({ color: myColor, name: myName, hat: myHat }).then(() => {
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
  // Emote messages — { id, duration }
  channel.subscribe('emote', msg => {
    if (msg.clientId === myId) return;
    const r = remotes.get(msg.clientId);
    if (r) r.emote = { id: msg.data.id, duration: msg.data.duration, elapsed: 0 };
  });

  function broadcastEmote(id, duration) {
    channel.publish('emote', { id, duration });
  }

  // Chat messages — { text, name }. Name travels in the message so late
  // joiners (or a presence race) still see who spoke.
  channel.subscribe('chat', msg => {
    if (msg.clientId === myId) return;
    const text = String(msg.data?.text ?? '').slice(0, 140);
    if (!text) return;
    const r    = remotes.get(msg.clientId);
    const name = r?.name || msg.data?.name || 'Visitor';
    if (onChat) onChat(name, text, r?.mesh ?? null);
  });

  function sendChat(text) {
    channel.publish('chat', { text, name: myName });
  }

  // Volleyball ball-state sync
  vChannel.subscribe('ball', msg => {
    if (msg.clientId === myId) return;
    if (onBallState) onBallState(msg.data);
  });
  function publishBall(state) { vChannel.publish('ball', state); }

  // Snowball throws — { x, y, z, vx, vy, vz }
  channel.subscribe('snow', msg => {
    if (msg.clientId === myId) return;
    if (onSnow) onSnow(msg.data);
  });
  function publishSnow(data) { channel.publish('snow', data); }

  // Campfire feeds — for the two-player ritual
  channel.subscribe('fire', msg => {
    if (msg.clientId === myId) return;
    if (onFire) onFire(msg.clientId);
  });
  function publishFire() { channel.publish('fire', {}); }

  // Shellfall drops — { x, seed }; the seed replays the exact bounce path
  channel.subscribe('plinko', msg => {
    if (msg.clientId === myId) return;
    if (onPlinko) onPlinko(msg.data, remotes.get(msg.clientId)?.name || 'Someone');
  });
  function publishPlinko(data) { channel.publish('plinko', data); }

  // Homestead live-share — { plot, doc } full plot state on change
  channel.subscribe('home', msg => {
    if (msg.clientId === myId) return;
    if (onHome) onHome(msg.data);
  });
  function publishHome(data) { channel.publish('home', data); }

  // Hat change — presence.update re-announces us with the new hat id
  function updateHat(id) {
    myHat = id;
    channel.presence.update({ color: myColor, name: myName, hat: myHat }).catch(() => {});
  }

  function spawnRemote(id, color, name, x, z, ry, hat = null) {
    if (remotes.has(id)) return;
    const mesh = makeAvatar(color, name, hat);
    mesh.position.set(x, 0, z);
    mesh.rotation.y = ry;
    scene.add(mesh);
    remotes.set(id, { mesh, color, name, tx: x, tz: z, try: ry, emote: null });
  }

  function removeRemote(id) {
    const r = remotes.get(id);
    if (!r) return;
    scene.remove(r.mesh);
    remotes.delete(id);
  }

  // Reused output — called every frame by the minimap; per-remote objects are
  // mutated in place instead of reallocated.
  const _out = [];
  function getRemotes() {
    if (_out.length !== remotes.size) _out.length = 0;
    let i = 0;
    for (const r of remotes.values()) {
      const o = _out[i] ?? (_out[i] = { x: 0, z: 0, color: 0, name: '' });
      o.x = r.mesh.position.x;
      o.z = r.mesh.position.z;
      o.color = r.color;
      o.name = r.name;
      i++;
    }
    return _out;
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
      const prevX = r.mesh.position.x, prevZ = r.mesh.position.z;
      r.mesh.position.x = THREE.MathUtils.lerp(r.mesh.position.x, r.tx, 0.2);
      r.mesh.position.z = THREE.MathUtils.lerp(r.mesh.position.z, r.tz, 0.2);

      let diff = r.try - r.mesh.rotation.y;
      while (diff >  Math.PI) diff -= 2 * Math.PI;
      while (diff < -Math.PI) diff += 2 * Math.PI;
      r.mesh.rotation.y += diff * 0.2;

      // Walk animation — moving if position changed meaningfully this frame
      const moved = Math.hypot(r.mesh.position.x - prevX, r.mesh.position.z - prevZ) > 0.001;
      animateAvatar(r.mesh, dt, moved);

      // Remote emote animation
      if (r.emote && onRemoteEmote) {
        r.emote.elapsed += dt;
        onRemoteEmote(r.mesh, r.emote.id, r.emote.elapsed);
        if (r.emote.duration > 0 && r.emote.elapsed >= r.emote.duration) r.emote = null;
      }
    }
  }

  return { update, getRemotes, broadcastEmote, publishBall, sendChat, publishSnow, publishFire, updateHat, publishPlinko, publishHome };
}
