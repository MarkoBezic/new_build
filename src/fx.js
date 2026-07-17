import * as THREE from 'three';

// Shared visual-effect builders. Every "go here" light pillar in the game —
// shard beacons, the glider cairn, treasure chests, race rings, the cave and
// tablet beacons, the Shellfall jackpot — is this one mesh with different
// numbers. New systems should use it rather than rolling their own.

export function makeBeam(color, { rTop = 0.3, rBottom = rTop, h = 40, opacity = 0.15 } = {}) {
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(rTop, rBottom, h, 6, 1, true),
    new THREE.MeshBasicMaterial({
      color, transparent: true, opacity,
      side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
    }),
  );
  beam.position.y = h / 2;   // sits on the ground when added at y = 0
  return beam;
}
