import * as THREE from 'three';
import { save, load } from './persistence.js';

// Hats — cosmetic identity worn on the avatar's head, visible to everyone
// (the worn hat id travels in Ably presence data). Most are bought with
// seashells at Moss's shop; a few are found in the world.

const M = (color, opts = {}) => new THREE.MeshLambertMaterial({ color, ...opts });

export const HATS = {
  straw: {
    label: 'Straw Hat', price: 30,
    build() {
      const g = new THREE.Group();
      const mat = M(0xD8B860);
      const crown = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.16, 10), mat);
      crown.position.y = 0.06;
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.025, 12), mat);
      g.add(crown, brim);
      return g;
    },
  },
  flower: {
    label: 'Flower Crown', price: 45,
    build() {
      const g = new THREE.Group();
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.20, 0.035, 6, 14), M(0x5A8A3A));
      ring.rotation.x = Math.PI / 2;
      g.add(ring);
      const petals = [0xE87AA0, 0xF0F0E0, 0xE8C050, 0xB080D8, 0xE87AA0];
      petals.forEach((c, i) => {
        const a = (i / petals.length) * Math.PI * 2;
        const f = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 5), M(c));
        f.position.set(Math.cos(a) * 0.20, 0.02, Math.sin(a) * 0.20);
        g.add(f);
      });
      return g;
    },
  },
  wizard: {
    label: 'Wizard Hat', price: 60,
    build() {
      const g = new THREE.Group();
      const mat = M(0x4A3A8A);
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.42, 9), mat);
      cone.position.y = 0.18;
      cone.rotation.z = 0.12;
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.03, 12), mat);
      const star = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.045, 0),
        M(0xF0D060, { emissive: 0xB09020, emissiveIntensity: 0.5 }),
      );
      star.position.set(0.10, 0.20, -0.10);
      g.add(cone, brim, star);
      return g;
    },
  },
  pirate: {
    label: 'Pirate Hat', price: 80,
    build() {
      const g = new THREE.Group();
      const dark = M(0x1A1A20);
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), dark);
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.32, 0.04, 12), dark);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.175, 0.175, 0.05, 12), M(0xE8E0C8));
      band.position.y = 0.04;
      brim.scale.z = 0.72;   // fore-aft pinch
      g.add(dome, brim, band);
      return g;
    },
  },
  halo: {
    label: 'Golden Halo', price: 150,
    build() {
      const halo = new THREE.Mesh(
        new THREE.TorusGeometry(0.16, 0.025, 8, 20),
        new THREE.MeshStandardMaterial({
          color: 0xFFD75A, emissive: 0xC89020, emissiveIntensity: 1.4,
          roughness: 0.3, metalness: 0.6,
        }),
      );
      halo.rotation.x = Math.PI / 2;
      halo.position.y = 0.16;
      return halo;
    },
  },
  cloud: {
    label: 'Cloud Wisp', price: null,   // found on the highest sky island
    build() {
      const g = new THREE.Group();
      const mat = new THREE.MeshLambertMaterial({ color: 0xF4F8FF, transparent: true, opacity: 0.85 });
      [[0, 0.06, 0, 0.10], [0.09, 0.03, 0.03, 0.07], [-0.08, 0.02, -0.04, 0.08],
       [0.02, 0.05, 0.09, 0.06], [-0.03, 0.07, 0.08, 0.05]].forEach(([x, y, z, r]) => {
        const puff = new THREE.Mesh(new THREE.SphereGeometry(r, 7, 5), mat);
        puff.position.set(x, y + 0.08, z);
        g.add(puff);
      });
      return g;
    },
  },
};

// ── Attach / replace the hat mesh on any humanoid group ─────────────────────
export function setHatMesh(avatar, hatId) {
  if (!avatar) return;
  const old = avatar.children.find(c => c.userData.isHat);
  if (old) avatar.remove(old);
  if (!hatId || !HATS[hatId]) return;
  const hat = HATS[hatId].build();
  hat.userData.isHat = true;
  hat.position.y = 1.65;
  avatar.add(hat);
}

// ── Ownership + worn state (per device) ──────────────────────────────────────
let _getAvatar = null, _onChange = null;

export function initHats({ getAvatar, onChange }) {
  _getAvatar = getAvatar;
  _onChange  = onChange;
  const worn = wornHat();
  if (worn) setHatMesh(_getAvatar(), worn);
}

export const ownedHats = () => load('hats:owned', []);
export const wornHat   = () => load('hats:worn', null);

export function grantHat(id) {
  const owned = ownedHats();
  if (owned.includes(id)) return false;
  owned.push(id);
  save('hats:owned', owned);
  return true;
}

export function wearHat(id) {   // null → bare head
  save('hats:worn', id);
  if (_getAvatar) setHatMesh(_getAvatar(), id);
  if (_onChange) _onChange(id);
}
