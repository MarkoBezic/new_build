import * as THREE from 'three';
import { dailyRng, dayKey, yesterdayKey } from './daily.js';
import { save, load } from './persistence.js';
import { terrainHeight } from './terrain.js';
import { toast } from './hud.js';

// Daily treasure hunt — one golden chest spawns somewhere on the island each
// day, at the same spot for every player (date-seeded). A notice board at
// spawn gives the day's riddle. Opening the chest keeps a daily streak.

const SPOTS = [
  { x: -160, z:   34, hint: 'Where grey sentries guard the patient water.' },
  { x:  146, z:  -20, hint: "In the hollow hill's throat, where the stones hum." },
  { x:  650, z:  150, hint: 'Among the eleven kneeling pillars.' },
  { x: -465, z:  572, hint: 'Beside the fire that remembers how to burn.' },
  { x: -450, z:  610, hint: 'Where the ball never lands quietly.' },
  { x:    0, z: -160, hint: 'Where every journey admits it began.' },
  { x:    2, z: -128, hint: 'At the doors the Wardens left open.' },
  { x:  483, z: -212, hint: 'Between the standing words of a language of distance.' },
  { x: -440, z:  616, hint: 'In the belly of the boat the sea gave back.' },
  { x:  242, z:  318, hint: 'Where the forest whispers loudest.' },
  { x:  350, z: -700, hint: 'High in the white silence, past the last cairn.' },
];

export function createTreasure(scene, { interact, audio, summit, getTasksNote } = {}) {
  const today = dayKey();
  const rng   = dailyRng('treasure');
  const spots = summit ? [...SPOTS, { x: summit.x, z: summit.z, hint: 'Where the world runs out of up.' }] : SPOTS;
  const spot  = spots[Math.floor(rng() * spots.length)];
  const gy    = terrainHeight(spot.x, spot.z);

  let opened  = load('treasure:state', {}).openedDay === today;

  // ── Chest ───────────────────────────────────────────────────────────────────
  const chest = new THREE.Group();
  const woodMat = new THREE.MeshLambertMaterial({ color: 0x6B4A22 });
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xC89020, emissive: 0xB07010, emissiveIntensity: 0.5,
    roughness: 0.35, metalness: 0.4,
  });
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.42, 0.52), woodMat);
  base.position.y = 0.21;
  chest.add(base);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.20, 0.56), woodMat);
  lid.geometry.translate(0, 0.10, 0.28);            // hinge along the back edge
  lid.position.set(0, 0.42, -0.28);
  chest.add(lid);
  for (const bx of [-0.28, 0.28]) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.46, 0.56), goldMat);
    band.position.set(bx, 0.23, 0);
    chest.add(band);
  }
  // Golden beam — same idiom as shards, so players already read it as "go here"
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.30, 0.30, 40, 6, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xFFD75A, transparent: true, opacity: 0.15,
      side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
    }),
  );
  beam.position.y = 20;
  chest.add(beam);
  chest.position.set(spot.x, gy, spot.z);
  scene.add(chest);
  if (opened) { lid.rotation.x = -1.9; beam.visible = false; }

  let lidAnim = 0;

  function open() {
    if (opened) return;
    opened = true;
    lidAnim = 1;
    beam.visible = false;
    const s = load('treasure:streak', { last: '', streak: 0, total: 0 });
    s.streak = s.last === yesterdayKey() ? s.streak + 1 : 1;
    s.last   = today;
    s.total += 1;
    save('treasure:streak', s);
    save('treasure:state', { openedDay: today });
    audio.sfx.fanfare();
    toast(`🏆 Daily treasure found! Streak: ${s.streak} day${s.streak === 1 ? '' : 's'} (${s.total} total)`, 5500);
  }

  interact.register({
    x: spot.x, z: spot.z, r: 4,
    label: '🏆 Open the treasure chest',
    when: () => !opened,
    cb: open,
  });

  // ── Notice board at spawn — today's riddle (and the daily tasks) ────────────
  const board = new THREE.Group();
  const postMat = new THREE.MeshLambertMaterial({ color: 0x5A3A1A });
  for (const px of [-0.55, 0.55]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.9, 0.12), postMat);
    post.position.set(px, 0.95, 0);
    board.add(post);
  }
  const panel = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 0.95, 0.07),
    new THREE.MeshLambertMaterial({ color: 0x7A5030 }),
  );
  panel.position.y = 1.35;
  board.add(panel);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.06, 0.4), postMat);
  roof.position.y = 1.92;
  roof.rotation.x = 0.15;
  board.add(roof);
  board.position.set(10, 0, -152);
  board.rotation.y = -Math.PI / 3;   // face the spawn circle
  scene.add(board);

  interact.register({
    x: 10, z: -152, r: 5,
    label: '📜 Read the notice board',
    cb: () => {
      audio.sfx.plink();
      const clue = opened
        ? `Today's treasure: found ✓`
        : `Today's treasure: “${spot.hint}”`;
      const note = getTasksNote ? `\n📋 ${getTasksNote()}` : '';
      toast(`${clue}${note}`, 7000);
    },
  });

  function update(dt, nowSec) {
    if (lidAnim > 0) {
      lidAnim = Math.max(0, lidAnim - dt * 2);
      lid.rotation.x = -1.9 * (1 - lidAnim);
    }
    if (!opened) beam.material.opacity = 0.12 + Math.sin(nowSec * 2.2) * 0.05;
  }

  return { update };
}
