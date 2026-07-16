import * as THREE from 'three';
import { BIOMES, CLEARING_R } from './world.config.js';
import { ZONE } from './zones.js';
import { terrainHeight } from './terrain.js';
import { save, load } from './persistence.js';
import { toast } from './hud.js';
import { bus } from './bus.js';

// ─────────────────────────────────────────────────────────────────────────────
//  Biome name lookup — used by the HUD zone indicator
// ─────────────────────────────────────────────────────────────────────────────
export function biomeAt(x, z) {
  if (ZONE.water.test(x, z))    return 'Open Water';
  if (ZONE.beach.test(x, z))    return 'Sunset Shore';
  if (ZONE.building.test(x, z)) return 'OpenText Campus';
  if (Math.hypot(x - BIOMES.icy.x,   z - BIOMES.icy.z)   < BIOMES.icy.r)   return 'Icy Peaks';
  if (Math.hypot(x - BIOMES.ruins.x, z - BIOMES.ruins.z) < BIOMES.ruins.r) return 'Ancient Ruins';
  if (Math.hypot(x, z) < CLEARING_R + 15) return 'Starting Valley';
  return 'Whispering Forest';
}

// ─────────────────────────────────────────────────────────────────────────────
//  Icy Peaks — snow-capped mountain cones, frosted pines, falling snow
// ─────────────────────────────────────────────────────────────────────────────
function buildIcyPeaks(scene) {
  const { x: CX, z: CZ, r: R } = BIOMES.icy;
  const rockMat = new THREE.MeshLambertMaterial({ color: 0x8B929E, flatShading: true });
  const snowMat = new THREE.MeshLambertMaterial({ color: 0xF4F8FF, flatShading: true });

  // Ring of large mountains around the biome rim
  for (let i = 0; i < 10; i++) {
    const a  = (i / 10) * Math.PI * 2 + Math.random() * 0.4;
    const rr = R * (0.68 + Math.random() * 0.28);
    const x  = CX + Math.cos(a) * rr, z = CZ + Math.sin(a) * rr;
    const w  = 26 + Math.random() * 22, h = 55 + Math.random() * 45;
    const y  = terrainHeight(x, z) - 4;

    const body = new THREE.Mesh(new THREE.ConeGeometry(w, h, 7), rockMat);
    body.position.set(x, y + h / 2, z);
    body.rotation.y = Math.random() * Math.PI;
    body.castShadow = true;
    scene.add(body);

    const cap = new THREE.Mesh(new THREE.ConeGeometry(w * 0.42, h * 0.36, 7), snowMat);
    cap.position.set(x, y + h - h * 0.36 / 2 + 0.5, z);
    cap.rotation.y = body.rotation.y;
    scene.add(cap);
  }

  // Frosted pines — instanced snowy cones on short trunks
  const N = 130;
  const trunkIM = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.3, 0.42, 1, 5),
    new THREE.MeshLambertMaterial({ color: 0x4A3B30, flatShading: true }), N);
  const pineIM = new THREE.InstancedMesh(
    new THREE.ConeGeometry(1, 1, 6),
    new THREE.MeshLambertMaterial({ color: 0xD8E8E4, flatShading: true }), N);
  trunkIM.castShadow = pineIM.castShadow = true;

  const dummy = new THREE.Object3D();
  for (let i = 0; i < N; i++) {
    const a = Math.random() * Math.PI * 2;
    const rr = Math.sqrt(Math.random()) * R * 0.9;
    const x = CX + Math.cos(a) * rr, z = CZ + Math.sin(a) * rr;
    const g = terrainHeight(x, z) - 0.2;
    const th = 1.2 + Math.random() * 1.6, cw = 1.6 + Math.random() * 1.6, ch = 4 + Math.random() * 4;

    dummy.rotation.set(0, 0, 0);
    dummy.position.set(x, g + th * 0.5, z);
    dummy.scale.set(1, th, 1);
    dummy.updateMatrix();
    trunkIM.setMatrixAt(i, dummy.matrix);

    dummy.position.set(x, g + th + ch * 0.42, z);
    dummy.scale.set(cw, ch, cw);
    dummy.updateMatrix();
    pineIM.setMatrixAt(i, dummy.matrix);
  }
  trunkIM.instanceMatrix.needsUpdate = pineIM.instanceMatrix.needsUpdate = true;
  scene.add(trunkIM, pineIM);

  // Falling snow — recycled particle box over the biome
  const SN = 900, BOX = 380, TOP = 85;
  const sp = new Float32Array(SN * 3);
  for (let i = 0; i < SN; i++) {
    sp[i * 3]     = CX + (Math.random() - 0.5) * BOX;
    sp[i * 3 + 1] = Math.random() * TOP;
    sp[i * 3 + 2] = CZ + (Math.random() - 0.5) * BOX;
  }
  const snowGeo = new THREE.BufferGeometry();
  snowGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const snow = new THREE.Points(snowGeo, new THREE.PointsMaterial({
    color: 0xFFFFFF, size: 0.35, transparent: true, opacity: 0.9, depthWrite: false,
  }));
  snow.visible = false;
  scene.add(snow);

  return { snow, snowGeo, CX, CZ, TOP, SN };
}

// ─────────────────────────────────────────────────────────────────────────────
//  Ancient Ruins — weathered colonnade, arch gate, altar with orbiting wisps
// ─────────────────────────────────────────────────────────────────────────────
function buildRuins(scene) {
  const { x: CX, z: CZ } = BIOMES.ruins;
  const baseY = terrainHeight(CX, CZ);
  const stone = new THREE.MeshLambertMaterial({ color: 0xB5AB93, flatShading: true });
  const moss  = new THREE.MeshLambertMaterial({ color: 0x74815B, flatShading: true });

  const add = (mesh, x, y, z) => {
    mesh.position.set(x, y, z);
    mesh.castShadow = mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
  };

  // Cracked central plaza
  add(new THREE.Mesh(new THREE.CylinderGeometry(21, 23, 1.6, 24), stone), CX, baseY + 0.8, CZ);

  // Ring of columns — some intact with capitals, some broken stumps
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2;
    const x = CX + Math.cos(a) * 42, z = CZ + Math.sin(a) * 42;
    const y = terrainHeight(x, z);
    const intact = Math.random() < 0.55;
    const h = intact ? 10 + Math.random() * 4 : 2.5 + Math.random() * 3;
    const mat = Math.random() < 0.3 ? moss : stone;
    add(new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.85, h, 9), mat), x, y + h / 2, z);
    if (intact) add(new THREE.Mesh(new THREE.BoxGeometry(4.6, 1.1, 4.6), stone), x, y + h + 0.55, z);
  }

  // Fallen columns
  for (const [dx, dz, ry] of [[14, 20, 0.6], [-24, -10, 2.2], [8, -30, 1.4]]) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.7, 9, 9), moss);
    c.rotation.set(0, ry, Math.PI / 2);
    add(c, CX + dx, terrainHeight(CX + dx, CZ + dz) + 1.7, CZ + dz);
  }

  // Arch gate on the west approach
  const gx = CX - 58, gz = CZ;
  const gy = terrainHeight(gx, gz);
  add(new THREE.Mesh(new THREE.BoxGeometry(2.4, 13, 2.4), stone), gx, gy + 6.5, gz - 5);
  add(new THREE.Mesh(new THREE.BoxGeometry(2.4, 13, 2.4), stone), gx, gy + 6.5, gz + 5);
  add(new THREE.Mesh(new THREE.BoxGeometry(3.0, 2.2, 14.5), stone), gx, gy + 14.1, gz);

  // Altar — stacked slabs with a floating glowing rune stone
  add(new THREE.Mesh(new THREE.BoxGeometry(7, 1.4, 7),   stone), CX, baseY + 2.3, CZ);
  add(new THREE.Mesh(new THREE.BoxGeometry(4.6, 1.2, 4.6), moss), CX, baseY + 3.6, CZ);
  const rune = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.1, 0),
    new THREE.MeshStandardMaterial({
      color: 0x241505, emissive: 0xFFB347, emissiveIntensity: 1.8,
      roughness: 0.3, flatShading: true,
    }));
  rune.position.set(CX, baseY + 6.4, CZ);
  scene.add(rune);
  const runeLight = new THREE.PointLight(0xFFB347, 2.2, 26);
  runeLight.position.set(CX, baseY + 7, CZ);
  scene.add(runeLight);

  // Spirit wisps orbiting the altar
  const wisps = [];
  const wispMat = new THREE.MeshBasicMaterial({ color: 0xFFD27F });
  for (let i = 0; i < 3; i++) {
    const w = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 0), wispMat);
    scene.add(w);
    wisps.push({ mesh: w, phase: i * 2.1, r: 5 + i * 2.2, speed: 0.5 + i * 0.17 });
  }

  return { rune, wisps, CX, CZ, baseY };
}

// ─────────────────────────────────────────────────────────────────────────────
//  Public factory
// ─────────────────────────────────────────────────────────────────────────────
export function createBiomes(scene) {
  const icy   = buildIcyPeaks(scene);
  const ruins = buildRuins(scene);
  let runeTouched = load('rune:touched', false);

  function update(dt, playerPos, nowSec) {
    // Snow — only simulated when the player is near the Icy Peaks
    const nearIcy = Math.hypot(playerPos.x - icy.CX, playerPos.z - icy.CZ) < BIOMES.icy.r + 140;
    icy.snow.visible = nearIcy;
    if (nearIcy) {
      const p = icy.snowGeo.attributes.position;
      for (let i = 0; i < icy.SN; i++) {
        let y = p.getY(i) - (3.2 + (i % 3)) * dt;
        if (y < 0) y = icy.TOP;
        p.setY(i, y);
      }
      p.needsUpdate = true;
    }

    // Ruins — rune spin/bob and wisp orbits
    ruins.rune.rotation.y = nowSec * 0.8;
    ruins.rune.position.y = ruins.baseY + 6.4 + Math.sin(nowSec * 1.3) * 0.35;

    // First touch of the floating rune — reachable by climbing the altar
    if (!runeTouched) {
      const dxr = playerPos.x - ruins.CX;
      const dyr = playerPos.y - (ruins.baseY + 6.4);
      const dzr = playerPos.z - ruins.CZ;
      if (dxr * dxr + dyr * dyr + dzr * dzr < 2.2 * 2.2) {
        runeTouched = true;
        save('rune:touched', true);
        bus.emit('rune-touched');
        toast("✨ You touched the Warden's rune — it thrums with old memory.", 5000);
      }
    }
    for (const w of ruins.wisps) {
      const a = nowSec * w.speed + w.phase;
      w.mesh.position.set(
        ruins.CX + Math.cos(a) * w.r,
        ruins.baseY + 4.5 + Math.sin(nowSec * 1.1 + w.phase) * 1.6,
        ruins.CZ + Math.sin(a) * w.r,
      );
    }
  }

  return { update };
}
