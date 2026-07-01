// Emote system — local animation + Ably broadcast so other players see them.
//
// Desktop: keys 1–4 trigger emotes while pointer-locked.
// Mobile:  a small radial button row appears in the bottom-centre.
//
// Emote state broadcast format (added to multiplayer 'move' messages as
// optional `emote` field): { id, startedAt }
// Remote avatars play the emote via applyRemoteEmote() called from multiplayer.js.

export const EMOTES = [
  { id: 'wave',  label: '👋', name: 'Wave',  duration: 1.8 },
  { id: 'cheer', label: '🎉', name: 'Cheer', duration: 2.2 },
  { id: 'point', label: '👉', name: 'Point', duration: 1.5 },
  { id: 'sit',   label: '🪑', name: 'Sit',   duration: 0 },   // 0 = hold until another key
];

// ── Animation helpers ─────────────────────────────────────────────────────────
// Each emote receives the avatar Group and elapsed time (0→duration).
// These animate the avatar mesh children by index:
//   children[0] = body (CapsuleGeometry)
//   children[1] = head (SphereGeometry)
//   children[2..3] = eyes
//   children[4+] = name label sprite (optional)

function easeInOut(t) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }

function animWave(avatar, t, dur) {
  // Rock body side-to-side and tilt head
  const phase = (t / dur) * Math.PI * 4;
  avatar.rotation.z = Math.sin(phase) * 0.18 * Math.sin(t / dur * Math.PI);
  if (avatar.children[1]) avatar.children[1].rotation.z = Math.sin(phase * 1.3) * 0.12;
}

function animCheer(avatar, t, dur) {
  // Bounce up slightly, arms up (body scale pulse)
  const phase = (t / dur) * Math.PI * 6;
  const lift  = Math.abs(Math.sin(phase)) * 0.15 * Math.sin(t / dur * Math.PI);
  avatar.position.y += lift;
  avatar.scale.y = 1 + Math.abs(Math.sin(phase)) * 0.08;
}

function animPoint(avatar, t, dur) {
  // Lean forward and tilt head
  const p = easeInOut(Math.min(t / (dur * 0.3), 1));
  avatar.rotation.x = p * 0.25;
  if (avatar.children[1]) avatar.children[1].rotation.x = -p * 0.15;
}

function animSit(avatar) {
  // Crouch: compress y and lower position
  avatar.scale.y = 0.6;
  avatar.position.y = -0.3;
}

const ANIM_FNS = {
  wave:  animWave,
  cheer: animCheer,
  point: animPoint,
  sit:   animSit,
};

function resetAvatar(avatar) {
  avatar.rotation.set(0, avatar.rotation.y, 0);  // preserve yaw
  avatar.scale.set(1, 1, 1);
  avatar.position.y = 0;
  if (avatar.children[1]) {
    avatar.children[1].rotation.set(0, 0, 0);
  }
}

// ── Mobile UI ─────────────────────────────────────────────────────────────────
function buildMobileBar() {
  const bar = document.createElement('div');
  Object.assign(bar.style, {
    position: 'fixed', bottom: '90px', left: '50%',
    transform: 'translateX(-50%)',
    display: 'none', gap: '10px', zIndex: '30',
    flexDirection: 'row',
  });
  bar.style.display = 'none';  // shown via showMobileBar()

  const btns = EMOTES.map(e => {
    const b = document.createElement('button');
    b.textContent = e.label;
    b.title = e.name;
    Object.assign(b.style, {
      width: '48px', height: '48px', borderRadius: '50%',
      fontSize: '22px', border: 'none',
      background: 'rgba(0,0,0,0.50)', color: '#fff',
      cursor: 'pointer',
    });
    bar.appendChild(b);
    return b;
  });

  document.body.appendChild(bar);
  return { bar, btns };
}

// ── Main export ───────────────────────────────────────────────────────────────
export function createEmotes(getAvatar) {
  // getAvatar() → the local player's THREE.Group avatar mesh
  let activeEmote  = null;  // { id, dur, elapsed }
  let onBroadcast  = null;  // callback(emoteId) — set by caller to send over Ably

  const { bar, btns } = buildMobileBar();

  function trigger(emoteId) {
    const def = EMOTES.find(e => e.id === emoteId);
    if (!def) return;

    // Toggle sit off
    if (activeEmote?.id === 'sit' && emoteId === 'sit') {
      activeEmote = null;
      resetAvatar(getAvatar());
      return;
    }

    resetAvatar(getAvatar());
    activeEmote = { id: emoteId, dur: def.duration, elapsed: 0 };
    if (onBroadcast) onBroadcast(emoteId);
  }

  function setOnBroadcast(fn) { onBroadcast = fn; }

  function onKey(e) {
    const idx = ['Digit1','Digit2','Digit3','Digit4'].indexOf(e.code);
    if (idx !== -1) trigger(EMOTES[idx].id);
  }

  function update(dt) {
    if (!activeEmote) return;
    const avatar = getAvatar();
    if (!avatar) return;

    activeEmote.elapsed += dt;
    const { id, dur, elapsed } = activeEmote;
    const fn = ANIM_FNS[id];

    if (fn) {
      resetAvatar(avatar);
      if (dur === 0) {
        fn(avatar, elapsed, 1);   // hold-pose emotes
      } else {
        fn(avatar, elapsed, dur);
        if (elapsed >= dur) {
          resetAvatar(avatar);
          activeEmote = null;
        }
      }
    }
  }

  function showMobileBar(show) {
    bar.style.display = show ? 'flex' : 'none';
  }

  // Wire mobile buttons
  btns.forEach((btn, i) => {
    btn.addEventListener('touchend', e => {
      e.preventDefault();
      trigger(EMOTES[i].id);
    });
  });

  // Animate a remote avatar with an emote (called from multiplayer)
  function applyRemoteEmote(avatar, emoteId, elapsed) {
    const def = EMOTES.find(e => e.id === emoteId);
    if (!def) return;
    const fn = ANIM_FNS[emoteId];
    if (!fn) return;
    resetAvatar(avatar);
    fn(avatar, elapsed, def.duration || 1);
  }

  return { onKey, update, showMobileBar, trigger, setOnBroadcast, applyRemoteEmote };
}
