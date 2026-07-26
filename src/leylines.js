import * as THREE from 'three';
import { terrainHeight } from './terrain.js';
import { toast, ceremony } from './hud.js';
import { save, load } from './persistence.js';
import { islandHeight, inIsland } from './zones.js';

// ── The Ley Network ──────────────────────────────────────────────────────────
// The secret the tablets already promised. "The Standing Words" (tablet t8)
// reads: *These stones are letters in a language of distance. Read them by
// walking between them.* So: walk between all five stones of the circle in one
// visit and the network wakes — after which every ley stone on the island will
// carry you to any other, including the one at the bottom of the Deep Road.
//
// Nothing signposts this. It is found by reading the story and being curious,
// which is what makes it worth finding.

const HUB = { x: 480, z: -220, r: 6.5 };

// `need` gates a destination on a flag earned elsewhere in the world
const SITES = [
  { id: 'words',  x: 480,  z: -220, name: 'The Standing Words' },
  { id: 'ruins',  x: 638,  z: 178,  name: 'Ancient Ruins' },
  { id: 'peaks',  x: 322,  z: -614, name: 'Icy Peaks' },
  { id: 'hamlet', x: -382, z: -168, name: 'The Hamlet' },
  { id: 'ember',  x: -706, z: 872,  name: 'Ember Isle' },
  { id: 'deep',   x: -82,  z: -592, y: -30, name: 'The Deep Road', need: 'deep:road' },
];

export function createLeylines(scene, { interact, audio, playerPosition, teleport }) {
  let awake = !!load('ley:awake', false);
  const touched = new Set();

  const stoneMat = new THREE.MeshStandardMaterial({
    color: 0x6E6A5E, emissive: 0x86E8C8, emissiveIntensity: 0, flatShading: true,
  });
  const runeMat = new THREE.MeshBasicMaterial({ color: 0x86E8C8, transparent: true, opacity: 0 });

  // ── A ley stone at each site ───────────────────────────────────────────────
  const marks = [];
  for (const s of SITES) {
    const gy = s.y ?? (inIsland(s.x, s.z) ? islandHeight(s.x, s.z) : terrainHeight(s.x, s.z));
    const g = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(1.1, 3.4, 0.7), stoneMat);
    shaft.position.y = 1.7;
    shaft.castShadow = true;
    g.add(shaft);
    const rune = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.11, 6, 14), runeMat);
    rune.position.set(0, 2.1, 0.4);
    g.add(rune);
    g.position.set(s.x, gy, s.z);
    scene.add(g);
    marks.push({ site: s, rune, y: gy });

    interact.register({
      x: s.x, z: s.z, r: 3.6,
      label: () => awake ? `✦ Step into the ${s.name} ley stone` : '✦ A cold, silent stone',
      when: () => s.id !== 'deep' || !!load('deep:road', false),
      cb: () => {
        if (!awake) {
          audio.sfx.plink();
          toast('The stone is cold and says nothing. Something has to wake them first.', 3800);
          return;
        }
        openPanel(s);
      },
    });
  }

  // ── Waking the network: walk between all five stones of the circle ─────────
  const circle = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    circle.push({ x: HUB.x + Math.cos(a) * HUB.r, z: HUB.z + Math.sin(a) * HUB.r });
  }

  function wake() {
    awake = true;
    save('ley:awake', true);
    audio.sfx.fanfare();
    audio.sfx.bell();
    ceremony('✦ The ley network wakes\nThe stones answer each other across the island.\nStep into any standing stone to travel.', 7500);
  }

  // ── Travel panel ───────────────────────────────────────────────────────────
  const panel = document.createElement('div');
  Object.assign(panel.style, {
    position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
    background: 'rgba(8,16,14,0.95)', color: '#DFF6EC', borderRadius: '14px',
    padding: '18px 24px', zIndex: '46', font: '14px/1.9 Georgia, serif',
    display: 'none', border: '1px solid rgba(134,232,200,0.45)', minWidth: '300px',
    boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
  });
  document.body.appendChild(panel);
  let open = false, here = null;

  function destinations() {
    return SITES.filter(s => s !== here && (!s.need || load(s.need, false)));
  }

  function render() {
    const list = destinations();
    panel.innerHTML = `<div style="color:#86E8C8;font-size:16px;margin-bottom:8px">✦ ${here.name}</div>`;
    list.forEach((s, i) => {
      const b = document.createElement('button');
      b.textContent = `${i + 1}.  ${s.name}`;
      Object.assign(b.style, {
        display: 'block', width: '100%', textAlign: 'left', margin: '3px 0',
        background: 'rgba(255,255,255,0.06)', color: '#DFF6EC', border: 'none',
        borderRadius: '8px', padding: '7px 13px', font: 'inherit', cursor: 'pointer',
      });
      b.addEventListener('click', () => go(i));
      panel.appendChild(b);
    });
    const foot = document.createElement('div');
    foot.style.cssText = 'margin-top:9px;color:#8AA79E;font-size:12px';
    foot.textContent = 'Press a number (or tap) to travel · E to step back out';
    panel.appendChild(foot);
  }

  function openPanel(site) {
    here = site;
    open = true;
    render();
    panel.style.display = 'block';
    audio.sfx.bell();
  }
  function close() { open = false; panel.style.display = 'none'; }

  function go(i) {
    const s = destinations()[i];
    if (!s) return;
    close();
    audio.sfx.whoosh();
    const gy = s.y ?? (inIsland(s.x, s.z) ? islandHeight(s.x, s.z) : terrainHeight(s.x, s.z));
    teleport(s.x, s.z + 2.6, s.y != null ? gy : undefined);
    toast(`✦ ${s.name}`, 2600);
  }

  function onKey(e) {
    if (!open) return false;
    const m = e.code.match(/^Digit([1-9])$/);
    if (m) { go(parseInt(m[1]) - 1); return true; }
    if (e.code === 'KeyE' || e.code === 'Escape') { close(); return true; }
    return true;   // swallow the rest while the stone holds you
  }

  // ── Per-frame ──────────────────────────────────────────────────────────────
  let pollT = 0;
  function update(dt, nowSec) {
    runeMat.opacity = awake ? 0.55 + Math.sin(nowSec * 1.8) * 0.25 : 0;
    stoneMat.emissiveIntensity = awake ? 0.35 + Math.sin(nowSec * 1.8) * 0.15 : 0;

    if (awake || open) return;
    pollT -= dt;
    if (pollT > 0) return;
    pollT = 0.25;
    // "Read them by walking between them" — pass close to each of the five
    for (let i = 0; i < circle.length; i++) {
      if (Math.hypot(playerPosition.x - circle[i].x, playerPosition.z - circle[i].z) < 3.2) {
        if (!touched.has(i)) {
          touched.add(i);
          audio.sfx.chime(touched.size * 2);
          if (touched.size < 5) toast(`✦ A letter answers under your hand… (${touched.size}/5)`, 2200);
        }
      }
    }
    if (touched.size >= 5) wake();
    // Wandering away from the circle forgets the partial reading
    if (Math.hypot(playerPosition.x - HUB.x, playerPosition.z - HUB.z) > 26) touched.clear();
  }

  return { update, onKey, isOpen: () => open };
}
