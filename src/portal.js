import * as THREE from 'three';

// ── Portal dimensions ─────────────────────────────────────────────────────────
const HALF_W    = 0.95;   // half-width of the oval arch
const HALF_H    = 1.45;   // half-height — arch top at y = 2 × HALF_H = 2.9
const TRIGGER_R = 1.8;    // units — teleport when player gets this close
const COOLDOWN  = 2.2;    // seconds before re-trigger allowed

// ── Shared sky-blue materials (both portals pulse together) ───────────────────
const frameMat = new THREE.MeshPhysicalMaterial({
  color:             0x29B6F6,
  emissive:          0x0277BD,
  emissiveIntensity: 2.2,
  roughness:         0.12,
  metalness:         0.0,
});

const surfaceMat = new THREE.MeshPhysicalMaterial({
  color:             0x87CEEB,
  emissive:          0x4FC3F7,
  emissiveIntensity: 0.85,
  transparent:       true,
  opacity:           0.55,
  side:              THREE.DoubleSide,
  depthWrite:        false,
});

// ── Build one oval portal at world position (x, 0, z), rotated rotY ──────────
function makePortal(scene, x, z, rotY) {
  const group = new THREE.Group();

  // Frame — TubeGeometry along a closed oval CatmullRom curve
  const N   = 80;
  const pts = [];
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2;
    pts.push(new THREE.Vector3(
      HALF_W * Math.cos(a),
      HALF_H + HALF_H * Math.sin(a),  // bottom at y=0, top at y=2*HALF_H
      0
    ));
  }
  const path     = new THREE.CatmullRomCurve3(pts, true);
  const frameGeo = new THREE.TubeGeometry(path, 80, 0.065, 8, true);
  group.add(new THREE.Mesh(frameGeo, frameMat));

  // Surface — filled oval plane
  const shape = new THREE.Shape();
  shape.ellipse(0, HALF_H, HALF_W, HALF_H, 0, Math.PI * 2, false, 0);
  const surfGeo = new THREE.ShapeGeometry(shape, 40);
  const surf    = new THREE.Mesh(surfGeo, surfaceMat);
  surf.position.z = 0.01;    // prevent z-fighting with frame
  group.add(surf);

  // Point light for local blue ambient glow
  const glow = new THREE.PointLight(0x87CEEB, 2.2, 11);
  glow.position.set(0, HALF_H, 0.6);
  group.add(glow);

  group.position.set(x, 0, z);
  group.rotation.y = rotY;
  scene.add(group);
  return group;
}

// ── Public factory ────────────────────────────────────────────────────────────
export function createPortals(scene, playerPosition, teleport) {
  // Portal A — lobby back wall (building south interior, z≈+16)
  makePortal(scene, 0, 16, 0);
  const DEST_BEACH = { x: -480, z: 572 };

  // Portal B — beach strip (SW quadrant)
  makePortal(scene, -480, 575, Math.PI * 0.85);
  const DEST_LOBBY = { x: 0, z: 11 };

  let cooldown = 0;
  let time     = 0;

  function update(dt) {
    time     += dt;
    cooldown  = Math.max(0, cooldown - dt);

    surfaceMat.emissiveIntensity = 0.65 + 0.40 * Math.sin(time * 2.6);

    if (cooldown > 0) return;

    // Use avatar/player position (not camera) so 3rd-person works correctly
    const px = playerPosition.x;
    const pz = playerPosition.z;

    if (Math.hypot(px, pz - 16) < TRIGGER_R) {
      teleport(DEST_BEACH.x, DEST_BEACH.z);
      cooldown = COOLDOWN;
    } else if (Math.hypot(px + 480, pz - 575) < TRIGGER_R) {
      teleport(DEST_LOBBY.x, DEST_LOBBY.z);
      cooldown = COOLDOWN;
    }
  }

  return { update };
}
