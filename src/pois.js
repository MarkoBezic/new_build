import * as THREE from 'three';
import { terrainHeight } from './terrain.js';
import { toast } from './hud.js';

// Micro-POIs — small hand-placed vignettes that fill the space between
// landmarks so no walk is empty. Positioned along shard-hunting routes.
// A few respond to the universal interact verb.

const M = {
  wood:  new THREE.MeshLambertMaterial({ color: 0x5A3A1A, flatShading: true }),
  plank: new THREE.MeshLambertMaterial({ color: 0x7A5030, flatShading: true }),
  stone: new THREE.MeshLambertMaterial({ color: 0x7A7568, flatShading: true }),
  dark:  new THREE.MeshLambertMaterial({ color: 0x484038, flatShading: true }),
  cloth: new THREE.MeshLambertMaterial({ color: 0x8A4A2A, flatShading: true }),
  straw: new THREE.MeshLambertMaterial({ color: 0xC8A84B, flatShading: true }),
  snow:  new THREE.MeshLambertMaterial({ color: 0xF4F8FF, flatShading: true }),
};

const WISHES = [
  'The well accepts your wish. Results may vary.',
  'Somewhere, a goose honks approvingly.',
  'The coin never hits bottom. Interesting.',
  'You feel slightly luckier. Probably.',
];

export function createPOIs(scene, { interact, audio } = {}) {
  const dynamics = [];   // { update(dt, nowSec, night) }

  const g = (x, z) => terrainHeight(x, z);
  function add(mesh, x, y, z, ry = 0) {
    mesh.position.set(x, y, z);
    mesh.rotation.y = ry;
    mesh.castShadow = mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
  }
  const box = (w, h, d, mat, x, y, z, ry) => add(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat), x, y, z, ry);
  const cyl = (r1, r2, h, mat, x, y, z, seg = 7) => add(new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), mat), x, y, z);

  // 1 ── Glowing mushroom ring (60, -240)
  {
    const X = 60, Z = -240, y = g(X, Z);
    const capMat = new THREE.MeshStandardMaterial({
      color: 0xC85A78, emissive: 0xE87AA0, emissiveIntensity: 0, flatShading: true,
    });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2, r = 3.2;
      const mx = X + Math.cos(a) * r, mz = Z + Math.sin(a) * r;
      cyl(0.09, 0.13, 0.5, M.straw, mx, y + 0.25, mz, 6);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), capMat);
      add(cap, mx, y + 0.48, mz);
    }
    dynamics.push({ update: (dt, t, night) => { capMat.emissiveIntensity = night * (0.9 + Math.sin(t * 2.2) * 0.3); } });
  }

  // 2 ── Abandoned campsite (-222, -178)
  {
    const X = -222, Z = -178, y = g(X, Z);
    box(2.6, 0.1, 2.2, M.cloth, X, y + 1.15, Z, 0.4).rotation.z =  0.62;   // tent panels
    box(2.6, 0.1, 2.2, M.cloth, X + 1.4, y + 1.15, Z, 0.4).rotation.z = -0.62;
    cyl(0.5, 0.6, 0.3, M.dark, X - 2.6, y + 0.15, Z + 1.8);               // cold firepit
    const log = box(0.4, 0.4, 2.0, M.wood, X - 1.2, y + 0.2, Z + 3.0, 0.9);
    log.rotation.x = 0.05;
  }

  // 3 ── Wrecked rowboat, inexplicably far inland (242, 322)
  {
    const X = 242, Z = 322, y = g(X, Z);
    const hull = box(1.6, 0.7, 4.2, M.plank, X, y + 0.25, Z, 0.7);
    hull.rotation.z = 0.35;
    box(1.3, 0.1, 0.3, M.wood, X, y + 0.62, Z + 0.6, 0.7);
  }

  // 4 ── Lone grave beneath a tree (-318, -418)
  {
    const X = -318, Z = -418, y = g(X, Z);
    const stone = box(0.9, 1.2, 0.22, M.stone, X, y + 0.6, Z, 0.15);
    stone.rotation.z = 0.07;
    box(1.2, 0.15, 2.0, M.dark, X, y + 0.07, Z + 1.1);
    const flower = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 4),
      new THREE.MeshLambertMaterial({ color: 0xE8D84A }));
    add(flower, X + 0.3, y + 0.32, Z + 0.8);
    cyl(0.02, 0.02, 0.3, M.straw, X + 0.3, y + 0.15, Z + 0.8, 4);
  }

  // 5 ── Stone cairn (152, -398)
  {
    const X = 152, Z = -398, y = g(X, Z);
    let h = 0;
    for (const s of [1.0, 0.78, 0.58, 0.4, 0.24]) {
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(s * 0.55, 0), M.stone);
      add(rock, X + (Math.random() - 0.5) * 0.1, y + h + s * 0.35, Z);
      h += s * 0.55;
    }
  }

  // 6 ── Wayside shrine (-418, 102)
  {
    const X = -418, Z = 102, y = g(X, Z);
    cyl(0.14, 0.16, 2.4, M.wood, X - 1.0, y + 1.2, Z, 6);
    cyl(0.14, 0.16, 2.4, M.wood, X + 1.0, y + 1.2, Z, 6);
    box(2.9, 0.22, 0.5, M.wood, X, y + 2.5, Z);
    box(3.3, 0.14, 0.7, M.cloth, X, y + 2.72, Z);
    cyl(0.5, 0.6, 0.5, M.stone, X, y + 0.25, Z + 0.4, 8);   // offering bowl
  }

  // 7 ── Old wishing well (90, 180) — interactive
  {
    const X = 90, Z = 180, y = g(X, Z);
    cyl(1.3, 1.4, 1.0, M.stone, X, y + 0.5, Z, 10);
    cyl(0.09, 0.09, 2.0, M.wood, X - 1.1, y + 2.0, Z, 5);
    cyl(0.09, 0.09, 2.0, M.wood, X + 1.1, y + 2.0, Z, 5);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.9, 1.0, 4), M.plank);
    add(roof, X, y + 3.4, Z, Math.PI / 4);
    if (interact) interact.register({
      x: X, z: Z, r: 3, label: 'Toss a coin in the well',
      cb: () => {
        audio?.sfx.plink();
        setTimeout(() => audio?.sfx.splash(), 700);
        toast(WISHES[Math.floor(Math.random() * WISHES.length)], 2800);
      },
    });
  }

  // 8 ── Standing stones (480, -220) — interactive
  {
    const X = 480, Z = -220;
    const humMat = new THREE.MeshStandardMaterial({
      color: 0x6E6A5E, emissive: 0x86E8C8, emissiveIntensity: 0, flatShading: true,
    });
    let flash = 0;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const sx = X + Math.cos(a) * 6.5, sz = Z + Math.sin(a) * 6.5;
      const s = box(1.4, 4.6 + (i % 2), 0.9, humMat, sx, g(sx, sz) + 2.3, sz, a);
      s.rotation.z = (Math.random() - 0.5) * 0.12;
    }
    if (interact) interact.register({
      x: X, z: Z, r: 9, label: 'Touch the standing stones',
      cb: () => { audio?.sfx.bell(); flash = 1; },
    });
    dynamics.push({ update: (dt, t, night) => {
      flash = Math.max(0, flash - dt * 0.5);
      humMat.emissiveIntensity = flash * 1.6 + night * 0.12;
    } });
  }

  // 9 ── Scarecrow in an overgrown plot (-120, 340)
  {
    const X = -120, Z = 340, y = g(X, Z);
    cyl(0.09, 0.09, 2.2, M.wood, X, y + 1.1, Z, 5);
    box(1.6, 0.09, 0.09, M.wood, X, y + 1.7, Z);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 7, 5), M.straw);
    add(head, X, y + 2.15, Z);
    box(0.7, 0.8, 0.3, M.cloth, X, y + 1.5, Z);
    for (const [fx, fz] of [[1.5, 0.8], [-1.2, 1.4], [0.6, -1.2], [-0.8, -0.9]]) {
      cyl(0.05, 0.05, 0.9, M.straw, X + fx, y + 0.45, Z + fz, 4);
    }
  }

  // 10 ── Fisherman's dock at the pond (-142, 24)
  {
    const X = -142, Z = 24, y = 0;
    box(1.4, 0.12, 5.0, M.plank, X - 1, y + 0.35, Z, Math.PI / 2 + 0.3);
    cyl(0.1, 0.1, 0.8, M.wood, X - 3.2, y + 0.3, Z + 0.6, 5);
    cyl(0.1, 0.1, 0.8, M.wood, X - 3.0, y + 0.3, Z - 0.8, 5);
    const rod = cyl(0.03, 0.03, 2.2, M.wood, X - 3.0, y + 0.9, Z, 4);
    rod.rotation.z = 0.7;
  }

  // 11 ── Hunter's watchtower (350, 450)
  {
    const X = 350, Z = 450, y = g(X, Z);
    for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      cyl(0.12, 0.15, 5.0, M.wood, X + lx * 1.2, y + 2.5, Z + lz * 1.2, 5);
    }
    box(3.2, 0.18, 3.2, M.plank, X, y + 5.0, Z);
    box(3.2, 0.8, 0.12, M.plank, X, y + 5.5, Z - 1.55);
    box(0.12, 0.8, 3.2, M.plank, X - 1.55, y + 5.5, Z);
  }

  // 12 ── Hollow fallen giant (-60, -350)
  {
    const X = -60, Z = -350, y = g(X, Z);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.7, 9, 9, 1, true), M.wood);
    trunk.rotation.z = Math.PI / 2;
    trunk.rotation.y = 0.4;
    add(trunk, X, y + 1.5, Z);
    const stump = cyl(1.7, 1.9, 1.2, M.dark, X + 6, y + 0.6, Z + 2.5, 9);
    stump.rotation.y = 0.4;
  }

  // 13 ── Crystal-cracked boulder on the ruins road (520, 380)
  {
    const X = 520, Z = 380, y = g(X, Z);
    add(new THREE.Mesh(new THREE.DodecahedronGeometry(2.2, 0), M.stone), X, y + 1.4, Z);
    const shard = new THREE.Mesh(new THREE.OctahedronGeometry(0.5, 0),
      new THREE.MeshStandardMaterial({ color: 0x120A1C, emissive: 0xA85CF0, emissiveIntensity: 1.4, flatShading: true }));
    shard.scale.y = 2;
    add(shard, X + 0.8, y + 2.9, Z + 0.4, 0.5);
  }

  // 14 ── Snowman (300, -560) — interactive
  {
    const X = 300, Z = -560, y = g(X, Z);
    const body = new THREE.Group();
    for (const [r, h] of [[0.85, 0.7], [0.6, 1.75], [0.4, 2.5]]) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(r, 9, 7), M.snow);
      b.position.y = h;
      body.add(b);
    }
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.4, 5),
      new THREE.MeshLambertMaterial({ color: 0xE8762A }));
    nose.position.set(0, 2.52, -0.5);
    nose.rotation.x = -Math.PI / 2;
    body.add(nose);
    body.position.set(X, y, Z);
    scene.add(body);
    let wobble = 0;
    if (interact) interact.register({
      x: X, z: Z, r: 3, label: 'Boop the snowman',
      cb: () => { audio?.sfx.plink(); wobble = 1; toast('The snowman says nothing. Classic snowman.', 2200); },
    });
    dynamics.push({ update: (dt, t) => {
      wobble = Math.max(0, wobble - dt * 1.2);
      body.rotation.z = Math.sin(t * 14) * wobble * 0.12;
    } });
  }

  // 15 ── Steaming hot spring (400, -600)
  {
    const X = 400, Z = -600, y = g(X, Z);
    cyl(3.4, 3.8, 0.5, M.stone, X, y + 0.25, Z, 12);
    const pool = new THREE.Mesh(new THREE.CircleGeometry(3.0, 12),
      new THREE.MeshPhongMaterial({ color: 0x3A9AA8, shininess: 140, transparent: true, opacity: 0.85 }));
    pool.rotation.x = -Math.PI / 2;
    add(pool, X, y + 0.52, Z);
    const SN = 26;
    const sp = new Float32Array(SN * 3);
    const steamGeo = new THREE.BufferGeometry();
    steamGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    const steam = new THREE.Points(steamGeo, new THREE.PointsMaterial({
      color: 0xE8F4F8, size: 0.6, transparent: true, opacity: 0.35, depthWrite: false,
    }));
    scene.add(steam);
    dynamics.push({ update: (dt, t) => {
      for (let i = 0; i < SN; i++) {
        const ph = t * 0.5 + i * 0.61;
        const rise = (ph % 1);
        sp[i * 3]     = X + Math.sin(i * 2.4 + t * 0.4) * (0.5 + rise * 1.2);
        sp[i * 3 + 1] = y + 0.6 + rise * 4.5;
        sp[i * 3 + 2] = Z + Math.cos(i * 1.9 + t * 0.3) * (0.5 + rise * 1.2);
      }
      steamGeo.attributes.position.needsUpdate = true;
    } });
  }

  // 16 ── Sunken statue head on the ruins approach (600, 60)
  {
    const X = 600, Z = 60, y = g(X, Z);
    const head = new THREE.Mesh(new THREE.SphereGeometry(1.6, 8, 6), M.stone);
    head.scale.y = 1.25;
    head.rotation.z = 0.5;
    add(head, X, y + 0.9, Z, 0.8);
    const noseM = box(0.4, 0.7, 0.5, M.stone, X - 0.9, y + 1.3, Z - 0.9, 0.8);
    noseM.rotation.z = 0.5;
  }

  // Campfire smoke column — a horizon weenie for the shore, day and night
  {
    const FX = -465, FZ = 578;
    const SN = 30;
    const sp = new Float32Array(SN * 3);
    const smokeGeo = new THREE.BufferGeometry();
    smokeGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    const smoke = new THREE.Points(smokeGeo, new THREE.PointsMaterial({
      color: 0xB0AAA2, size: 1.6, transparent: true, opacity: 0.28, depthWrite: false,
    }));
    scene.add(smoke);
    dynamics.push({ update: (dt, t) => {
      for (let i = 0; i < SN; i++) {
        const rise = ((t * 0.12 + i / SN) % 1);
        sp[i * 3]     = FX + Math.sin(i * 1.7 + t * 0.5) * (0.4 + rise * 3.5);
        sp[i * 3 + 1] = 1.0 + rise * 34;
        sp[i * 3 + 2] = FZ + Math.cos(i * 2.1 + t * 0.4) * (0.4 + rise * 3.5);
      }
      smokeGeo.attributes.position.needsUpdate = true;
    } });
  }

  function update(dt, nowSec, night) {
    for (const d of dynamics) d.update(dt, nowSec, night);
  }

  return { update };
}
