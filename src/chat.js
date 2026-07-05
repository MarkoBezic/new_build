// Chat system — global text chat over Ably plus in-world speech bubbles.
//
// Desktop: press T or Enter (while pointer-locked) to open the input,
//          Enter to send, Esc to cancel.
// Mobile:  💬 button (bottom-left) opens the input.
//
// Messages appear in a fading log (bottom-left) and as a speech bubble
// above the sender's avatar. All text is set via textContent / canvas
// fillText, so nothing is ever interpreted as HTML.

import * as THREE from 'three';

const MAX_LEN      = 140;    // max characters per message
const SEND_COOLDOWN = 500;   // ms between sends — light flood guard
const LOG_MAX      = 6;      // visible log entries
const LOG_FADE_MS  = 12000;  // entry lifetime before fading out

// ── Speech bubble sprite ──────────────────────────────────────────────────────
function wrapLines(ctx, text, maxWidth, maxLines) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
      if (lines.length === maxLines - 1) break;
    } else {
      line = test;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (lines.length === maxLines && words.join(' ') !== lines.join(' '))
    lines[maxLines - 1] += '…';
  return lines;
}

function makeBubbleSprite(text) {
  const W = 512, PAD = 14, LINE_H = 38;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.font = 'bold 28px Arial, sans-serif';
  const lines = wrapLines(ctx, text, W - PAD * 2, 4);
  const H = lines.length * LINE_H + PAD * 2;
  canvas.width = W; canvas.height = H;

  // Rounded rect background (canvas resize resets ctx state)
  const c = canvas.getContext('2d');
  c.fillStyle = 'rgba(0,0,0,0.68)';
  const r = 16;
  c.beginPath();
  c.moveTo(r, 0); c.lineTo(W - r, 0); c.quadraticCurveTo(W, 0, W, r);
  c.lineTo(W, H - r); c.quadraticCurveTo(W, H, W - r, H);
  c.lineTo(r, H);     c.quadraticCurveTo(0, H, 0, H - r);
  c.lineTo(0, r);     c.quadraticCurveTo(0, 0, r, 0);
  c.closePath(); c.fill();

  c.font = 'bold 28px Arial, sans-serif';
  c.fillStyle = '#FFF';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  lines.forEach((ln, i) => c.fillText(ln, W / 2, PAD + LINE_H * i + LINE_H / 2));

  const tex = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  const worldW = 2.4, worldH = worldW * H / W;
  sprite.scale.set(worldW, worldH, 1);
  sprite.position.y = 2.45 + worldH / 2;  // above the 2.1-high name label
  return sprite;
}

function removeBubble(mesh) {
  const b = mesh.userData.chatBubble;
  if (!b) return;
  clearTimeout(b.timer);
  mesh.remove(b.sprite);
  b.sprite.material.map?.dispose();
  b.sprite.material.dispose();
  mesh.userData.chatBubble = null;
}

// ── Main export ───────────────────────────────────────────────────────────────
export function createChat({ onSend }) {
  let lastSend = 0;

  // Message log — bottom-left, entries fade out on their own
  const log = document.createElement('div');
  Object.assign(log.style, {
    position: 'fixed', bottom: '64px', left: '16px',
    display: 'flex', flexDirection: 'column', gap: '4px',
    maxWidth: 'min(340px, 70vw)', zIndex: '30',
    fontFamily: 'Arial, sans-serif', fontSize: '13px',
    pointerEvents: 'none',
  });
  document.body.appendChild(log);

  function addMessage(name, text, isSelf = false) {
    const row = document.createElement('div');
    Object.assign(row.style, {
      background: 'rgba(0,0,0,0.55)', color: '#EEE',
      borderRadius: '8px', padding: '4px 10px',
      transition: 'opacity 1.5s', wordBreak: 'break-word',
    });
    const who = document.createElement('span');
    who.textContent = name + ': ';
    who.style.fontWeight = 'bold';
    who.style.color = isSelf ? '#9ED462' : '#FFD580';
    const body = document.createElement('span');
    body.textContent = text;
    row.appendChild(who);
    row.appendChild(body);
    log.appendChild(row);
    while (log.children.length > LOG_MAX) log.firstChild.remove();
    setTimeout(() => { row.style.opacity = '0'; }, LOG_FADE_MS);
    setTimeout(() => { row.remove(); }, LOG_FADE_MS + 1600);
  }

  // Input row — hidden until opened
  const inputWrap = document.createElement('div');
  Object.assign(inputWrap.style, {
    position: 'fixed', bottom: '20px', left: '16px',
    display: 'none', zIndex: '35',
  });
  const input = document.createElement('input');
  input.type = 'text';
  input.maxLength = MAX_LEN;
  input.placeholder = 'Say something… (Enter to send, Esc to cancel)';
  Object.assign(input.style, {
    width: 'min(300px, 66vw)', padding: '8px 12px',
    borderRadius: '10px', border: '1px solid rgba(255,255,255,0.25)',
    background: 'rgba(0,0,0,0.70)', color: '#FFF',
    fontFamily: 'Arial, sans-serif', fontSize: '14px', outline: 'none',
  });
  inputWrap.appendChild(input);
  document.body.appendChild(inputWrap);

  function open() {
    inputWrap.style.display = 'block';
    input.value = '';
    input.focus();
  }
  function close() {
    inputWrap.style.display = 'none';
    input.blur();
  }
  function isOpen() { return inputWrap.style.display !== 'none'; }

  input.addEventListener('keydown', e => {
    e.stopPropagation();  // keep chat keystrokes away from game key handlers
    if (e.code === 'Enter' || e.code === 'NumpadEnter') {
      const text = input.value.trim().slice(0, MAX_LEN);
      const now = performance.now();
      if (text && now - lastSend >= SEND_COOLDOWN) {
        lastSend = now;
        onSend(text);
      }
      close();
    } else if (e.code === 'Escape') {
      close();
    }
  });

  // Mobile chat button
  const btn = document.createElement('button');
  btn.textContent = '💬';
  Object.assign(btn.style, {
    position: 'fixed', bottom: '20px', left: '20px',
    width: '44px', height: '44px', borderRadius: '50%',
    fontSize: '20px', border: 'none',
    background: 'rgba(0,0,0,0.50)', color: '#fff',
    cursor: 'pointer', zIndex: '30', display: 'none',
  });
  btn.addEventListener('touchend', e => {
    e.preventDefault();
    if (isOpen()) close(); else open();
  });
  document.body.appendChild(btn);

  function showMobileButton(show) {
    btn.style.display = show ? 'block' : 'none';
    if (show) inputWrap.style.left = '76px';  // clear the 💬 button
  }

  // Speech bubble above an avatar (local or remote)
  function showBubble(mesh, text) {
    if (!mesh) return;
    removeBubble(mesh);
    const sprite = makeBubbleSprite(text);
    mesh.add(sprite);
    const timer = setTimeout(() => removeBubble(mesh), 4000 + text.length * 45);
    mesh.userData.chatBubble = { sprite, timer };
  }

  return { open, close, isOpen, addMessage, showBubble, showMobileButton };
}
