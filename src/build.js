import * as THREE from 'three';
import { addStructure } from './collision.js';

// Structure builder — the authoring layer every solid building shares.
//
// Each call emits BOTH the visual mesh and its collision box, so what you see
// and what you walk into can never drift apart (the bug class that produced
// invisible walls in the castle dungeon). Coordinates are local to `origin`.
//
//   solid()    wall you bump into        deck()   floor you stand on
//   stair()    stepped ramp you climb    mesh()   decoration, no collision
//   basement() volume where the terrain heightmap releases the player,
//              which is what allows rooms to exist underground
//
// Call register(radius) once at the end to hand everything to collision.js.

export function makeBuilder(scene, origin) {
  const OX = origin.x, OZ = origin.z;
  const group = new THREE.Group();
  scene.add(group);

  const walls = [], floors = [], ramps = [], basements = [];

  function mesh(x0, x1, z0, z1, y0, y1, mat, shadow = false) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), mat);
    m.position.set(OX + (x0 + x1) / 2, (y0 + y1) / 2, OZ + (z0 + z1) / 2);
    if (shadow) m.castShadow = true;
    m.receiveShadow = true;
    // Structure geometry never moves — bake its matrix once so it isn't
    // recomposed every frame. With hundreds of boxes per building this is the
    // difference between smooth and hitching.
    m.matrixAutoUpdate = false;
    m.updateMatrix();
    group.add(m);
    return m;
  }

  function solid(x0, x1, z0, z1, y0, y1, mat, shadow = false) {
    walls.push({ x0: OX + x0, x1: OX + x1, z0: OZ + z0, z1: OZ + z1, y0, y1 });
    return mesh(x0, x1, z0, z1, y0, y1, mat, shadow);
  }

  function deck(x0, x1, z0, z1, top, mat, thick = 0.4) {
    floors.push({ x0: OX + x0, x1: OX + x1, z0: OZ + z0, z1: OZ + z1, top });
    return mesh(x0, x1, z0, z1, top - thick, top, mat);
  }

  // Steps rise along `axis` from h0 at the low-coordinate end to h1 at the high
  function stair(x0, x1, z0, z1, axis, h0, h1, mat, steps = 12) {
    ramps.push({ x0: OX + x0, x1: OX + x1, z0: OZ + z0, z1: OZ + z1, axis, h0, h1 });
    for (let i = 0; i < steps; i++) {
      const t0 = i / steps, t1 = (i + 1) / steps;
      const hi = h0 + (h1 - h0) * t1;
      const lo = Math.min(h0 + (h1 - h0) * t0, hi) - 0.35;
      if (axis === 'x') mesh(x0 + (x1 - x0) * t0, x0 + (x1 - x0) * t1, z0, z1, lo, hi, mat);
      else              mesh(x0, x1, z0 + (z1 - z0) * t0, z0 + (z1 - z0) * t1, lo, hi, mat);
    }
  }

  function basement(x0, x1, z0, z1, top) {
    basements.push({ x0: OX + x0, x1: OX + x1, z0: OZ + z0, z1: OZ + z1, top });
  }

  const register = r => addStructure({ x: OX, z: OZ, r, walls, floors, ramps, basements });

  return { group, mesh, solid, deck, stair, basement, register, walls, floors, ramps };
}
