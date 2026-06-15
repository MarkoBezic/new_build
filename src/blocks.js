import * as THREE from 'three';

export const BLOCK_SIZE = 1; // 1 unit = 1 Minecraft block

// ---------------------------------------------------------------------------
// Material library — add new types here as the build grows
// ---------------------------------------------------------------------------
export const MATERIALS = {
  // Structural concrete
  concrete_light: new THREE.MeshLambertMaterial({ color: 0xC2BAA8 }), // off-white facade panels
  concrete_mid:   new THREE.MeshLambertMaterial({ color: 0x8E8E88 }), // mid-grey horizontal bands
  concrete_dark:  new THREE.MeshLambertMaterial({ color: 0x4E4E52 }), // dark charcoal trim/sills

  // Glass curtain wall — two tints for variation
  glass_dark:  new THREE.MeshPhongMaterial({
    color:       0x1A2B3C,
    specular:    new THREE.Color(0x3A6080),
    shininess:   90,
    transparent: true,
    opacity:     0.88,
  }),
  glass_tint: new THREE.MeshPhongMaterial({
    color:       0x223344,
    specular:    new THREE.Color(0x4477AA),
    shininess:   110,
    transparent: true,
    opacity:     0.82,
  }),

  // Dark structural pillars / mullions
  pillar: new THREE.MeshLambertMaterial({ color: 0x28282C }),

  // Roof parapet / top edge
  roof: new THREE.MeshLambertMaterial({ color: 0xD8D0C0 }),

  // Signage face
  sign: new THREE.MeshLambertMaterial({ color: 0xC8B880 }),

  // Ground / environment
  grass:   new THREE.MeshLambertMaterial({ color: 0x4A8C3F }),
  asphalt: new THREE.MeshLambertMaterial({ color: 0x222226 }),
  white:   new THREE.MeshBasicMaterial({ color: 0xF2F2F2 }),
  yellow:  new THREE.MeshBasicMaterial({ color: 0xF0C020 }),
};

// Shared unit cube geometry (all blocks are the same shape)
const CUBE_GEO = new THREE.BoxGeometry(BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);

// ---------------------------------------------------------------------------
// Core helper
// ---------------------------------------------------------------------------

/**
 * Create a single Minecraft-style block.
 *
 * @param {number} x  Grid column  (integer, X axis)
 * @param {number} y  Grid layer   (integer, 0 = ground surface)
 * @param {number} z  Grid row     (integer, Z axis)
 * @param {string} type  Key from MATERIALS (defaults to 'concrete_light')
 * @returns {THREE.Mesh}
 *
 * Convention: block bottom face sits at world-Y = y * BLOCK_SIZE,
 * so y=0 blocks rest on the ground plane.
 */
export function createBlock(x, y, z, type = 'concrete_light') {
  const mat = MATERIALS[type] ?? MATERIALS.concrete_light;
  const mesh = new THREE.Mesh(CUBE_GEO, mat);
  mesh.position.set(
    x * BLOCK_SIZE,
    y * BLOCK_SIZE + BLOCK_SIZE * 0.5,
    z * BLOCK_SIZE,
  );
  mesh.castShadow    = true;
  mesh.receiveShadow = true;
  mesh.userData.blockType = type;
  return mesh;
}
