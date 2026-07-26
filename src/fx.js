import * as THREE from 'three';

// Shared visual-effect builders. Every "go here" light pillar in the game —
// shard beacons, the glider cairn, treasure chests, race rings, the cave and
// tablet beacons, the Shellfall jackpot — is this one mesh with different
// numbers. New systems should use it rather than rolling their own.

// `fog: false` keeps a beam at full strength across the map (objective
// markers must not be swallowed by distance haze); `depthTest: false` lets
// it show through terrain and trees.
export function makeBeam(color, {
  rTop = 0.3, rBottom = rTop, h = 40, opacity = 0.15,
  fog = true, depthTest = true,
} = {}) {
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(rTop, rBottom, h, 6, 1, true),
    new THREE.MeshBasicMaterial({
      color, transparent: true, opacity, fog, depthTest,
      side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
    }),
  );
  beam.position.y = h / 2;   // sits on the ground when added at y = 0
  return beam;
}
