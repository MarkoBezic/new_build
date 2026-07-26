import * as THREE from 'three';
import { makeBuilder } from './build.js';
import { toast, makeMobileButton, ceremony } from './hud.js';
import { save, load } from './persistence.js';
import { bus } from './bus.js';
import { isOnBoat, isSwimming, setSwimming, SEABED } from './player.js';

// ── The Sunken Ruins ─────────────────────────────────────────────────────────
// The ocean was a lid on the world: something to sail across and fish from,
// with nothing underneath. Z (or the 🤿 button) from a boat in deep water
// slips you into the sea, and the seabed opens into a drowned Warden city —
// a colonnaded avenue, a light-shaft hall, and dark side chambers.
//
// Breath is the tension the island has never had, but nothing here kills you:
// run out and you simply kick for the surface, gasping. Air pockets trapped
// under the vaults refill it and let you press deeper.

const CITY = { x: -560, z: 780 };     // z − x ≈ 1340 — well into open water
const BED  = -24;                     // seabed floor
const BREATH_MAX = 62;                // seconds of air
const DEEP = 1160;                    // z − x beyond which the water is diveable

export function createDiving(scene, { audio, playerPosition, teleport, getState, isMobile, shells }) {
  // Underwater murk — applied after the day/night pass each frame so it wins
  const _MURK = new THREE.Color(0x14384A);
  const B = makeBuilder(scene, CITY);
  const { mesh, solid, deck, basement } = B;

  const M = {
    stone: new THREE.MeshLambertMaterial({ color: 0x5C6E70, flatShading: true }),
    pale:  new THREE.MeshLambertMaterial({ color: 0x7C8E88, flatShading: true }),
    silt:  new THREE.MeshLambertMaterial({ color: 0x3E4A50, flatShading: true }),
    weed:  new THREE.MeshLambertMaterial({ color: 0x2E5A46 }),
    gold:  new THREE.MeshStandardMaterial({
      color: 0xC8A020, emissive: 0x6A4A08, emissiveIntensity: 0.5, roughness: 0.4, metalness: 0.5,
    }),
    glow:  new THREE.MeshLambertMaterial({ color: 0x9FE8D8, emissive: 0x4FC8A8, emissiveIntensity: 1.1 }),
    air:   new THREE.MeshPhongMaterial({
      color: 0xBFF0FF, transparent: true, opacity: 0.32, shininess: 180, side: THREE.DoubleSide,
    }),
  };

  // The sea floor releases the surface heightmap so the city can sit at −24
  basement(-150, 150, -150, 150, -1);
  deck(-120, 120, -120, 120, BED, M.silt, 0.8);

  // ── The avenue — two colonnades leading to the hall ───────────────────────
  for (const side of [-1, 1]) {
    for (let i = 0; i < 7; i++) {
      const z = -46 + i * 13;
      const h = 9 + (i % 3) * 2;
      const broken = i === 2 || i === 5;
      solid(side * 9 - 1.2, side * 9 + 1.2, z - 1.2, z + 1.2, BED, BED + (broken ? h * 0.45 : h), M.pale, true);
      if (!broken) mesh(side * 9 - 1.9, side * 9 + 1.9, z - 1.9, z + 1.9, BED + h, BED + h + 0.7, M.pale);
      else {                                  // a fallen drum beside its stump
        const drum = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 4, 8), M.pale);
        drum.rotation.z = Math.PI / 2;
        drum.position.set(CITY.x + side * 12, BED + 1.3, CITY.z + z + 2);
        B.group.add(drum);
      }
    }
  }
  mesh(-8, 8, -50, 46, BED + 0.02, BED + 0.1, M.stone);       // the paved street

  // ── The Drowned Hall — a light shaft falls through its broken roof ────────
  const HALL = [-26, 26, 46, 92];
  for (const [x0, x1, z0, z1] of [
    [-27, -25, 46, 92], [25, 27, 46, 92], [-27, 27, 90, 92],
    [-27, -9, 46, 48], [9, 27, 46, 48],                        // doorway at the avenue end
  ]) solid(x0, x1, z0, z1, BED, BED + 16, M.stone, true);
  for (const px of [-16, 0, 16]) for (const pz of [58, 72, 86]) {
    solid(px - 1.4, px + 1.4, pz - 1.4, pz + 1.4, BED, BED + 16, M.pale, true);
  }
  // roof, with a hole the light comes through
  for (const [x0, x1, z0, z1] of [[-27, 27, 46, 62], [-27, -6, 62, 78], [8, 27, 62, 78], [-27, 27, 78, 92]]) {
    mesh(x0, x1, z0, z1, BED + 16, BED + 17, M.stone, true);
  }
  {
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(6, 9, 24, 10, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xBFF0E8, transparent: true, opacity: 0.11,
        blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false, fog: false,
      }),
    );
    shaft.position.set(CITY.x + 1, BED + 13, CITY.z + 70);
    B.group.add(shaft);
  }
  // the altar and its hoard
  mesh(-4, 4, 82, 88, BED, BED + 1.2, M.pale);
  for (const [gx, gz, s] of [[-1.5, 84, 0.8], [1, 85.5, 1.0], [2.5, 83.5, 0.6]]) {
    const p = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), M.gold);
    p.position.set(CITY.x + gx, BED + 1.2 + s * 0.5, CITY.z + gz);
    B.group.add(p);
  }

  // ── Air pockets: domes of trapped air under the vaults ───────────────────
  const POCKETS = [{ x: 0, z: 70, y: BED + 14 }, { x: -34, z: 24, y: BED + 9 }, { x: 36, z: -30, y: BED + 9 }];
  for (const p of POCKETS) {
    const dome = new THREE.Mesh(new THREE.SphereGeometry(4.2, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.air);
    dome.position.set(CITY.x + p.x, p.y - 1.6, CITY.z + p.z);
    B.group.add(dome);
    if (p.z !== 70) {                       // the two side vaults that shelter them
      for (const [x0, x1, z0, z1] of [[p.x - 8, p.x - 6, p.z - 8, p.z + 8], [p.x + 6, p.x + 8, p.z - 8, p.z + 8],
                                      [p.x - 8, p.x + 8, p.z - 8, p.z - 6], [p.x - 8, p.x + 8, p.z + 6, p.z + 8]]) {
        solid(x0, x1, z0, z1, BED, p.y, M.stone, true);
      }
      mesh(p.x - 8, p.x + 8, p.z - 8, p.z + 8, p.y, p.y + 1, M.stone);
    }
  }

  // ── Kelp and scattered stone, so the floor is not a plain ────────────────
  for (let i = 0; i < 90; i++) {
    const a = Math.random() * Math.PI * 2, r = 14 + Math.random() * 95;
    const kx = Math.cos(a) * r, kz = Math.sin(a) * r;
    const h = 3 + Math.random() * 7;
    const k = new THREE.Mesh(new THREE.BoxGeometry(0.3, h, 0.3), M.weed);
    k.position.set(CITY.x + kx, BED + h / 2, CITY.z + kz);
    k.rotation.y = Math.random() * 3;
    B.group.add(k);
  }
  for (let i = 0; i < 40; i++) {
    const a = Math.random() * Math.PI * 2, r = 10 + Math.random() * 100;
    const s = 0.6 + Math.random() * 1.8;
    const b = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), M.stone);
    b.position.set(CITY.x + Math.cos(a) * r, BED + s * 0.4, CITY.z + Math.sin(a) * r);
    b.rotation.set(Math.random(), Math.random(), Math.random());
    B.group.add(b);
  }
  for (const [lx, lz] of [[-9, -20], [9, 6], [-9, 32], [0, 64], [-16, 86]]) {
    mesh(lx - 0.3, lx + 0.3, lz - 0.3, lz + 0.3, BED + 2, BED + 3.4, M.glow);
  }

  B.register(190);

  // ── Breath ────────────────────────────────────────────────────────────────
  let breath = BREATH_MAX;
  const bar = document.createElement('div');
  Object.assign(bar.style, {
    position: 'fixed', bottom: '104px', left: '50%', transform: 'translateX(-50%)',
    width: '190px', height: '9px', background: 'rgba(0,0,0,0.5)', borderRadius: '6px',
    border: '1px solid rgba(160,230,255,0.5)', zIndex: '22', display: 'none', overflow: 'hidden',
  });
  const fill = document.createElement('div');
  Object.assign(fill.style, { height: '100%', width: '100%', background: '#7FD8F0', transition: 'width 0.2s linear' });
  bar.appendChild(fill);
  document.body.appendChild(bar);

  const inAir = () => POCKETS.some(p =>
    Math.hypot(playerPosition.x - (CITY.x + p.x), playerPosition.z - (CITY.z + p.z)) < 4 &&
    playerPosition.y > p.y - 3.4);

  // ── Diving in and out ─────────────────────────────────────────────────────
  function dive() {
    if (isSwimming()) { surface(); return; }
    if (!isOnBoat()) { toast('You need to be out on a boat in deep water to dive.', 3200); return; }
    const { x, z } = getState();
    if (z - x < DEEP) { toast('The water here is too shallow to dive. Sail further out.', 3600); return; }
    setSwimming(true);
    breath = BREATH_MAX;
    audio.sfx.splash();
    teleport(x + 2.2, z + 2.2, -1.2);
    toast('🤿 You slip over the side.\nLook where you want to swim · SPACE to rise · Z to surface', 7000);
  }

  function surface() {
    if (!isSwimming()) return;
    setSwimming(false);
    const { x, z } = getState();
    audio.sfx.splash();
    teleport(x, z, 0.3);
    breath = BREATH_MAX;
    toast('You break the surface and haul yourself up.', 2600);
  }

  window.addEventListener('keydown', e => {
    if (e.code !== 'KeyZ') return;
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    dive();
  });
  const btn = isMobile
    ? makeMobileButton('🤿', { bottom: '278px', left: '20px' }, dive, 'rgba(80,200,255,0.35)')
    : null;

  // ── Treasure ──────────────────────────────────────────────────────────────
  let looted = !!load('dive:loot', false);
  function tryLoot() {
    if (looted) return;
    if (Math.hypot(playerPosition.x - (CITY.x + 1), playerPosition.z - (CITY.z + 85)) > 5) return;
    looted = true;
    save('dive:loot', true);
    shells.add(70, 'the drowned altar');
    audio.sfx.fanfare();
    bus.emit('sunken');
    toast('The altar hoard is yours — the sea kept it well.', 6000);
  }

  let found = !!load('dive:found', false);

  function update(dt) {
    if (btn) btn.style.display = (isOnBoat() || isSwimming()) ? 'block' : 'none';
    if (!isSwimming()) { bar.style.display = 'none'; return; }

    bar.style.display = 'block';
    if (scene.fog) {                                  // drown the light
      scene.fog.color.copy(_MURK);
      scene.fog.density = 0.028;
    }
    if (playerPosition.y > -1.2 || inAir()) breath = Math.min(BREATH_MAX, breath + dt * 14);
    else breath -= dt;
    fill.style.width = `${Math.max(0, breath / BREATH_MAX) * 100}%`;
    fill.style.background = breath < 14 ? '#F07A6A' : '#7FD8F0';
    if (breath <= 0) {
      toast('Your chest burns — you kick for the surface.', 4000);
      surface();
      return;
    }
    tryLoot();
    if (!found && Math.hypot(playerPosition.x - CITY.x, playerPosition.z - CITY.z) < 70 && playerPosition.y < -12) {
      found = true;
      save('dive:found', true);
      audio.sfx.bell();
      ceremony('⛲ A city, drowned and waiting\nColumns rise out of the gloom beneath you.');
    }
  }

  return { update, CITY };
}
