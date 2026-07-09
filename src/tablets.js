import * as THREE from 'three';
import { terrainHeight } from './terrain.js';
import { toast } from './hud.js';

// The Warden tablets — environmental storytelling in nine fragments.
// Reading a tablet (E) adds it to the journal (J). The final fragment points
// to the cave; completing the journal wakes the Warden's Beacon there and
// grants the crown.

const TABLETS = [
  { id: 't1', x:    8, z: -172, title: 'The Long Walk',
    text: 'We were the Wardens, and we walked out of the north when the sky was young. This ring of grass is where we first set down our burdens. Rest here, traveller — everyone does.' },
  { id: 't2', x: -142, z:   26, title: 'The Patient Water',
    text: 'The pond asked for nothing and kept our reflections anyway. We taught the grey birds to guard it. They have forgotten us, but not the guarding.' },
  { id: 't3', x:  140, z:  -18, title: 'The Hollow Hill',
    text: 'Deep in this hill we grew the singing stones. Listen — they still hum the note we left them. We sealed something bright beneath. It waits for a patient hand.' },
  { id: 't4', x:    0, z:  -32, title: 'The Glass Hall',
    text: 'A prophecy: one day a great hall of glass will rise in our meadow, and people will gather in it to speak of open text and other magics. We did not understand the prophecy either.' },
  { id: 't5', x: -468, z:  572, title: 'The Sea That Keeps',
    text: 'The sea took three of our boats and gave back none. What the water keeps, it keeps. If you sail, sail lightly — and mind what glitters in the stacks offshore.' },
  { id: 't6', x:  398, z: -595, title: 'The White Silence',
    text: 'Winter never leaves the peaks; it only sleeps lighter in summer. We built nothing here but cairns, and the mountains outlived every one of our names anyway.' },
  { id: 't7', x:  618, z:  152, title: 'The Broken Ring',
    text: 'Eleven pillars for eleven Wardens. When the last of us left, the colonnade began to kneel. Stone is only patient — it is not eternal.' },
  { id: 't8', x:  483, z: -216, title: 'The Standing Words',
    text: 'These stones are letters in a language of distance. Read them by walking between them. The portals are doors we left open behind us — we always meant to come back.' },
  { id: 't9', x:  652, z:  144, title: 'The Last Fragment',
    text: 'You who have gathered all our words: our beacon sleeps beneath the hollow hill in the east forest. Go to the cave. Wake it. Wear what we left, and be the Warden now.' },
];

export function createTablets(scene, { progress, audio, interact, cosmetics }) {
  const stoneMat = new THREE.MeshLambertMaterial({ color: 0x8E8672, flatShading: true });
  const glyphMat = new THREE.MeshStandardMaterial({
    color: 0x4A4436, emissive: 0x86E8C8, emissiveIntensity: 0.7, roughness: 0.6,
  });

  for (const t of TABLETS) {
    const y = terrainHeight(t.x, t.z);
    const g = new THREE.Group();
    const slab = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.0, 0.28), stoneMat);
    slab.position.y = 1.0;
    slab.castShadow = true;
    g.add(slab);
    // Glyph strip — glows faintly so tablets read as "important" at night
    const strip = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.4, 0.06), glyphMat);
    strip.position.set(0, 1.05, 0.15);
    g.add(strip);
    g.position.set(t.x, y, t.z);
    g.rotation.y = Math.random() * Math.PI * 2;
    scene.add(g);

    interact.register({
      x: t.x, z: t.z, r: 3.2,
      label: () => progressLabel(t),
      cb: () => read(t),
    });
  }

  function progressLabel(t) {
    return progress.has('tablets', t.id) ? `Re-read "${t.title}"` : 'Read the stone tablet';
  }

  // ── Reading panel ───────────────────────────────────────────────────────────
  const panel = document.createElement('div');
  Object.assign(panel.style, {
    position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
    maxWidth: '440px', width: '86vw', display: 'none', zIndex: '45',
    background: 'rgba(16,13,8,0.94)', color: '#EDE3C8', borderRadius: '14px',
    border: '1px solid rgba(134,232,200,0.35)', padding: '22px 26px',
    fontFamily: 'Georgia, serif', lineHeight: '1.65', pointerEvents: 'none',
  });
  document.body.appendChild(panel);
  let panelTimer = 0;

  function read(t) {
    audio.sfx.grind();
    panel.innerHTML =
      `<div style="color:#86E8C8;font-size:15px;letter-spacing:0.1em;margin-bottom:8px">◈ ${t.title}</div>` +
      `<div style="font-size:14px">${t.text}</div>`;
    panel.style.display = 'block';
    panelTimer = 9;
    if (progress.add('tablets', t.id)) {
      const n = progress.count('tablets');
      toast(`📖 Journal updated — ${n} / ${TABLETS.length} fragments`, 2600);
      if (n === TABLETS.length) completeJournal();
    }
  }

  // ── Payoff: the Warden's Beacon wakes in the cave ──────────────────────────
  function spawnBeacon() {
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(2.6, 3.4, 150, 8, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0x86E8C8, transparent: true, opacity: 0.2, side: THREE.DoubleSide,
        depthWrite: false, blending: THREE.AdditiveBlending,
      }));
    beam.position.set(150, 75, -20);
    scene.add(beam);
    const heart = new THREE.Mesh(
      new THREE.OctahedronGeometry(1.4, 0),
      new THREE.MeshStandardMaterial({
        color: 0x0A140F, emissive: 0x86E8C8, emissiveIntensity: 2.5, flatShading: true,
      }));
    heart.position.set(150, 6, -20);
    scene.add(heart);
    const light = new THREE.PointLight(0x86E8C8, 3.2, 40);
    light.position.set(150, 8, -20);
    scene.add(light);
    return heart;
  }

  let beaconHeart = progress.count('tablets') === TABLETS.length ? spawnBeacon() : null;
  if (beaconHeart) cosmetics.unlockCrown();   // restore on load

  function completeJournal() {
    audio.sfx.fanfare();
    audio.sfx.bell();
    beaconHeart = spawnBeacon();
    toast('◈ The Warden’s Beacon wakes beneath the hollow hill…', 6000);
    cosmetics.unlockCrown();
  }

  // ── Journal UI (J key + 📖 button) ─────────────────────────────────────────
  const journal = document.createElement('div');
  Object.assign(journal.style, {
    position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
    maxWidth: '480px', width: '88vw', maxHeight: '70vh', overflowY: 'auto',
    display: 'none', zIndex: '45', background: 'rgba(16,13,8,0.95)',
    color: '#EDE3C8', borderRadius: '14px', padding: '20px 26px',
    border: '1px solid rgba(212,168,90,0.4)', fontFamily: 'Georgia, serif',
  });
  document.body.appendChild(journal);
  let journalOpen = false;

  function renderJournal() {
    let html = `<div style="color:#D4A85A;font-size:17px;margin-bottom:12px">📖 The Warden Fragments — ${progress.count('tablets')} / ${TABLETS.length}</div>`;
    for (const t of TABLETS) {
      if (progress.has('tablets', t.id)) {
        html += `<div style="margin-bottom:12px"><span style="color:#86E8C8">◈ ${t.title}</span><br><span style="font-size:13px;line-height:1.6">${t.text}</span></div>`;
      } else {
        html += `<div style="margin-bottom:12px;opacity:0.45">◈ ??? <span style="font-size:12px">— an unread stone waits somewhere…</span></div>`;
      }
    }
    html += `<div style="font-size:11px;opacity:0.5;margin-top:8px">Press J to close</div>`;
    journal.innerHTML = html;
  }

  function toggleJournal(force) {
    journalOpen = force ?? !journalOpen;
    if (journalOpen) renderJournal();
    journal.style.display = journalOpen ? 'block' : 'none';
  }

  window.addEventListener('keydown', e => {
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (e.code === 'KeyJ') toggleJournal();
    if (e.code === 'Escape') toggleJournal(false);
  });

  const btn = document.createElement('button');
  btn.textContent = '📖';
  Object.assign(btn.style, {
    position: 'fixed', bottom: '20px', right: '72px',
    width: '44px', height: '44px', borderRadius: '50%',
    fontSize: '19px', border: 'none', background: 'rgba(0,0,0,0.50)',
    cursor: 'pointer', zIndex: '40', boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
  });
  btn.addEventListener('click', () => toggleJournal());
  document.body.appendChild(btn);

  function update(dt, nowSec) {
    if (panelTimer > 0) {
      panelTimer -= dt;
      if (panelTimer <= 0) panel.style.display = 'none';
    }
    if (beaconHeart) {
      beaconHeart.rotation.y = nowSec * 0.9;
      beaconHeart.position.y = 6 + Math.sin(nowSec * 1.4) * 0.5;
    }
  }

  return { update };
}
