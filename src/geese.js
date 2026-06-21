import * as THREE from 'three';

// ─── Shared materials ─────────────────────────────────────────────────────────
const M_BODY  = new THREE.MeshLambertMaterial({ color: 0x7A6248 });
const M_BELLY = new THREE.MeshLambertMaterial({ color: 0xC8B07A });
const M_DARK  = new THREE.MeshLambertMaterial({ color: 0x0C0C0A });
const M_WHITE = new THREE.MeshLambertMaterial({ color: 0xDDDACC });
const M_BEAK  = new THREE.MeshLambertMaterial({ color: 0x1E1C18 });
const M_WING  = new THREE.MeshLambertMaterial({ color: 0x584030 });
const M_LEG   = new THREE.MeshLambertMaterial({ color: 0x282420 });

// ─── Roam zones [x0, x1, z0, z1] ─────────────────────────────────────────────
const ZONES = [
  [-26, 26, -52, -20],   // north parking lot
  [-18, 18,  25,  42],   // south parking lot
  [-12, 12, -54, -62],   // open clearing rim between north lot and forest
];

function inBuilding(x, z) {
  return Math.abs(x) < 22 && Math.abs(z) < 22;
}

function inAnyZone(x, z) {
  for (const [x0, x1, z0, z1] of ZONES) {
    if (x >= x0 && x <= x1 && z >= z0 && z <= z1) return true;
  }
  return false;
}

function randInZone(zi) {
  const [x0, x1, z0, z1] = ZONES[zi];
  return { x: rnd(x0, x1), z: rnd(z0, z1) };
}

function rnd(a, b) { return a + Math.random() * (b - a); }

// ─── Goose mesh ───────────────────────────────────────────────────────────────
function buildGoose() {
  const root = new THREE.Group();

  // Body — oval (squashed sphere)
  const bodyMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 9, 7), M_BODY);
  bodyMesh.scale.set(0.26, 0.20, 0.40);
  bodyMesh.position.set(0, 0.28, 0);
  root.add(bodyMesh);

  // Belly — lighter underside
  const bellyMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 5), M_BELLY);
  bellyMesh.scale.set(0.21, 0.13, 0.31);
  bellyMesh.position.set(0, 0.20, 0.06);
  root.add(bellyMesh);

  // Tail — dark stubby cone at back (+Z = back when rotation.y=0)
  const tailMesh = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.17, 6), M_DARK);
  tailMesh.rotation.x = -(Math.PI / 2 - 0.45);
  tailMesh.position.set(0, 0.30, 0.36);
  root.add(tailMesh);

  // Wings (mirrored each side)
  for (const sx of [-1, 1]) {
    const wingMesh = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.055, 0.37), M_WING);
    wingMesh.position.set(sx * 0.24, 0.28, 0.02);
    wingMesh.rotation.z = sx * 0.17;
    root.add(wingMesh);
    // Dark primary tips
    const tipMesh = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.044, 0.13), M_DARK);
    tipMesh.position.set(sx * 0.33, 0.27, -0.04);
    root.add(tipMesh);
  }

  // Neck pivot — front-top of body (-Z = front)
  const neckGroup = new THREE.Group();
  neckGroup.position.set(0, 0.38, -0.22);
  root.add(neckGroup);

  const neckMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.060, 0.080, 0.32, 7), M_DARK);
  neckMesh.position.set(0, 0.16, 0);
  neckGroup.add(neckMesh);

  // Head pivot — top of neck
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.32, 0);
  neckGroup.add(headGroup);

  const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.115, 8, 6), M_DARK);
  headGroup.add(headMesh);

  // White cheek/chin patch
  const chinMesh = new THREE.Mesh(new THREE.SphereGeometry(0.082, 8, 5), M_WHITE);
  chinMesh.scale.set(1.15, 0.62, 0.78);
  chinMesh.position.set(0, -0.032, 0.076);
  headGroup.add(chinMesh);

  // Beak — flat dark box
  const beakMesh = new THREE.Mesh(new THREE.BoxGeometry(0.054, 0.037, 0.095), M_BEAK);
  beakMesh.position.set(0, 0.010, -0.145);
  headGroup.add(beakMesh);

  // Legs
  const leftLeg  = new THREE.Group();
  const rightLeg = new THREE.Group();
  leftLeg.position.set(-0.09,  0.18, 0.08);
  rightLeg.position.set( 0.09, 0.18, 0.08);
  root.add(leftLeg);
  root.add(rightLeg);

  for (const [lg, sx] of [[leftLeg, -1], [rightLeg, 1]]) {
    const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.020, 0.016, 0.18, 5), M_LEG);
    shin.position.set(0, -0.09, 0);
    lg.add(shin);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.020, 0.075), M_LEG);
    foot.position.set(sx * 0.008, -0.170, 0.012);
    lg.add(foot);
    const toe = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.016, 0.065), M_LEG);
    toe.position.set(0, -0.173, -0.042);
    lg.add(toe);
  }

  root.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });

  return { root, neckGroup, headGroup, leftLeg, rightLeg };
}

// ─── State constants ──────────────────────────────────────────────────────────
const WALK  = 0;
const GRAZE = 1;
const IDLE  = 2;
const TURN  = 3;

// ─── Spawn a goose ────────────────────────────────────────────────────────────
function spawnGoose(scene, x, z, flockId) {
  const mesh = buildGoose();
  mesh.root.position.set(x, 0, z);
  mesh.root.rotation.y = rnd(0, Math.PI * 2);
  scene.add(mesh.root);

  return {
    mesh,
    flockId,
    state:   Math.random() < 0.35 ? GRAZE : WALK,
    timer:   rnd(3, 9),
    phase:   rnd(0, Math.PI * 2),
    speed:   rnd(0.75, 1.20),
    targetY: mesh.root.rotation.y,
  };
}

// ─── Per-frame update for one goose ──────────────────────────────────────────
function updateGoose(g, dt, flock) {
  const { mesh } = g;
  const pos = mesh.root.position;

  // State timer & transitions
  g.timer -= dt;
  if (g.timer <= 0) {
    const r = Math.random();
    switch (g.state) {
      case WALK:
        if      (r < 0.40) { g.state = GRAZE; g.timer = rnd(2.5, 7.5); }
        else if (r < 0.60) { g.state = IDLE;  g.timer = rnd(1.5, 4.0); }
        else {
          g.state   = TURN;
          g.timer   = rnd(0.35, 0.70);
          g.targetY = mesh.root.rotation.y + rnd(-Math.PI * 0.85, Math.PI * 0.85);
        }
        break;
      case GRAZE:
      case IDLE:
        g.state   = WALK;
        g.timer   = rnd(4, 13);
        g.targetY = mesh.root.rotation.y + rnd(-0.7, 0.7);
        break;
      case TURN:
        g.state = WALK;
        g.timer = rnd(4, 11);
        break;
    }
  }

  // Flock cohesion — while walking, gently drift toward group-mates
  if (g.state === WALK && flock) {
    let sumX = 0, sumZ = 0, n = 0;
    for (const other of flock) {
      if (other === g) continue;
      const dx = other.mesh.root.position.x - pos.x;
      const dz = other.mesh.root.position.z - pos.z;
      if (dx * dx + dz * dz < 144) { sumX += dx; sumZ += dz; n++; }
    }
    if (n > 0) {
      const desiredY = Math.atan2(-sumX / n, -sumZ / n);
      let diff = desiredY - mesh.root.rotation.y;
      while (diff >  Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      g.targetY += diff * 0.06 * dt;
    }
  }

  // Boundary check — look-ahead 2 units; steer back if heading out
  if (g.state === WALK || g.state === TURN) {
    const ry = mesh.root.rotation.y;
    const nx = pos.x - Math.sin(ry) * 2.0;
    const nz = pos.z - Math.cos(ry) * 2.0;

    if (!inAnyZone(nx, nz) || inBuilding(nx, nz)) {
      // Steer toward nearest zone center
      let bestZone = ZONES[0], bestD = Infinity;
      for (const zone of ZONES) {
        const cx = (zone[0] + zone[1]) * 0.5;
        const cz = (zone[2] + zone[3]) * 0.5;
        const d  = Math.hypot(pos.x - cx, pos.z - cz);
        if (d < bestD) { bestD = d; bestZone = zone; }
      }
      const cx = (bestZone[0] + bestZone[1]) * 0.5;
      const cz = (bestZone[2] + bestZone[3]) * 0.5;
      g.targetY = Math.atan2(-(cx - pos.x), -(cz - pos.z));
      if (g.state !== TURN) { g.state = TURN; g.timer = rnd(0.3, 0.6); }
    }
  }

  // Smooth rotation toward targetY
  {
    let diff = g.targetY - mesh.root.rotation.y;
    while (diff >  Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const rate = g.state === TURN ? 3.5 : 1.2;
    mesh.root.rotation.y += diff * Math.min(rate * dt, 1.0);
  }

  // State-specific movement & animation
  if (g.state === WALK) {
    pos.x -= Math.sin(mesh.root.rotation.y) * g.speed * dt;
    pos.z -= Math.cos(mesh.root.rotation.y) * g.speed * dt;
    g.phase += dt * 3.8;

    const swing = Math.sin(g.phase) * 0.38;
    mesh.leftLeg.rotation.x  =  swing;
    mesh.rightLeg.rotation.x = -swing;

    // Head pumps forward-back while walking
    const pump = Math.sin(g.phase * 2) * 0.022;
    mesh.neckGroup.position.y = 0.38 + pump;
    mesh.neckGroup.position.z = -0.22 + pump * 0.4;
    mesh.neckGroup.rotation.x = -0.12;
    mesh.headGroup.rotation.x =  0.08;
  }

  if (g.state === GRAZE) {
    g.phase += dt * 0.85;
    const t = (1 - Math.cos(g.phase)) * 0.5; // 0→1, smooth dip
    mesh.neckGroup.rotation.x = t * 0.95;
    mesh.headGroup.rotation.x = t * 0.40;
    mesh.neckGroup.position.y = 0.38;
    mesh.neckGroup.position.z = -0.22;
    mesh.leftLeg.rotation.x   = 0;
    mesh.rightLeg.rotation.x  = 0;
  }

  if (g.state === IDLE) {
    g.phase += dt * 0.5;
    mesh.headGroup.rotation.y = Math.sin(g.phase) * 0.45;
    // Ease neck/head back upright
    mesh.neckGroup.rotation.x *= 0.92;
    mesh.headGroup.rotation.x *= 0.92;
    mesh.neckGroup.position.y += (0.38 - mesh.neckGroup.position.y) * 0.1;
    mesh.neckGroup.position.z += (-0.22 - mesh.neckGroup.position.z) * 0.1;
    mesh.leftLeg.rotation.x   = 0;
    mesh.rightLeg.rotation.x  = 0;
  }

  if (g.state === TURN) {
    // Stand still while pivoting
    mesh.neckGroup.rotation.x *= 0.95;
    mesh.neckGroup.position.y += (0.38 - mesh.neckGroup.position.y) * 0.1;
    mesh.neckGroup.position.z += (-0.22 - mesh.neckGroup.position.z) * 0.1;
    mesh.leftLeg.rotation.x   = 0;
    mesh.rightLeg.rotation.x  = 0;
  }

  if (g.state !== IDLE) {
    mesh.headGroup.rotation.y *= 0.9;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────
export function createGeese(scene) {
  // [flock size, zone index]  — zone 0=north lot, 1=south lot, 2=clearing edge
  const flockDefs = [
    [5, 0], // north lot — main flock
    [4, 0], // north lot — second flock
    [1, 0], // north lot — lone wanderer
    [3, 0], // north lot — trio
    [3, 1], // south lot — flock
    [2, 1], // south lot — pair
    [3, 2], // clearing edge — visible from spawn path
    [1, 2], // clearing edge — lone
  ]; // 5+4+1+3+3+2+3+1 = 22 geese

  const flocks = [];

  for (let fi = 0; fi < flockDefs.length; fi++) {
    const [size, zi] = flockDefs[fi];
    const center = randInZone(zi);
    const flock  = [];

    for (let i = 0; i < size; i++) {
      let x, z, tries = 0;
      do {
        x = center.x + rnd(-4.5, 4.5);
        z = center.z + rnd(-4.5, 4.5);
        tries++;
      } while (!inAnyZone(x, z) && tries < 20);

      if (!inAnyZone(x, z)) continue;
      flock.push(spawnGoose(scene, x, z, fi));
    }

    if (flock.length > 0) flocks.push(flock);
  }

  return {
    update(dt) {
      for (const flock of flocks) {
        const companions = flock.length > 1 ? flock : null;
        for (const g of flock) updateGoose(g, dt, companions);
      }
    },
  };
}
