import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';

// Physical atmosphere (three's Sky addon — Rayleigh/Mie scattering, no image
// assets) plus a procedural starfield that fades in after dusk. Both follow
// the camera so the sky never clips the far plane at the world's edge.
export function createSky(scene) {
  const sky = new Sky();
  sky.scale.setScalar(1250);   // stays inside the camera's 1400 far plane
  const u = sky.material.uniforms;
  u.turbidity.value       = 6;
  u.rayleigh.value        = 1.8;
  u.mieCoefficient.value  = 0.004;
  u.mieDirectionalG.value = 0.82;
  scene.add(sky);

  // ── Stars — random points on the upper sky dome ────────────────────────────
  const N = 1500, R = 1150;
  const pts = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const t = Math.random() * Math.PI * 2;
    const y = 0.08 + Math.random() * 0.92;           // keep above the horizon
    const rr = Math.sqrt(1 - y * y) * R;
    pts[i * 3]     = Math.cos(t) * rr;
    pts[i * 3 + 1] = y * R;
    pts[i * 3 + 2] = Math.sin(t) * rr;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(pts, 3));
  const starMat = new THREE.PointsMaterial({
    color: 0xEAF2FF, size: 2.0, sizeAttenuation: false,
    transparent: true, opacity: 0, depthWrite: false, fog: false,
    blending: THREE.AdditiveBlending,
  });
  const stars = new THREE.Points(starGeo, starMat);
  stars.visible = false;
  scene.add(stars);

  // ── Constellations — star pictures that resolve in deep night ─────────────
  // Each is a list of [azimuth°, altitude°] vertices, drawn in order.
  const CONSTELLATIONS = [
    // The Warden — a stick figure with raised arm
    [[20, 52], [22, 46], [18, 40], [22, 46], [26, 42], [30, 47], [22, 46], [21, 34], [17, 27], [21, 34], [25, 27]],
    // The Goose — a long neck and wing
    [[135, 38], [140, 44], [147, 46], [153, 42], [147, 46], [150, 54]],
    // The Gate — an open ring, one star missing
    [[265, 45], [272, 52], [281, 52], [288, 45], [285, 36], [269, 36]],
  ];
  const toVec = ([az, alt]) => {
    const a = az * Math.PI / 180, e = alt * Math.PI / 180, r = 1120;
    return new THREE.Vector3(Math.sin(a) * Math.cos(e) * r, Math.sin(e) * r, Math.cos(a) * Math.cos(e) * r);
  };
  const cGroup = new THREE.Group();
  const lineMat = new THREE.LineBasicMaterial({
    color: 0x9FC8E8, transparent: true, opacity: 0, depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const brightMat = new THREE.PointsMaterial({
    color: 0xFFFFFF, size: 3.4, sizeAttenuation: false,
    transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  for (const c of CONSTELLATIONS) {
    const vecs = c.map(toVec);
    cGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(vecs), lineMat));
    const pGeo = new THREE.BufferGeometry().setFromPoints(vecs);
    cGroup.add(new THREE.Points(pGeo, brightMat));
  }
  cGroup.visible = false;
  scene.add(cGroup);

  // sunDir: normalized direction toward the sun; sunElev: −1..1 solar elevation
  function update(sunDir, sunElev, nowSec, camera) {
    u.sunPosition.value.copy(sunDir);
    sky.position.set(camera.position.x, 0, camera.position.z);
    stars.position.set(camera.position.x, 0, camera.position.z);

    const night = Math.min(1, Math.max(0, (-sunElev - 0.03) * 5));
    starMat.opacity = night * 0.85;
    stars.visible   = night > 0.02;
    stars.rotation.y = nowSec * 0.004;   // slow celestial drift

    // Constellations only resolve in deep night, drifting with the stars
    cGroup.position.copy(stars.position);
    cGroup.rotation.y = stars.rotation.y;
    const deep = Math.max(0, (night - 0.55) / 0.45);
    brightMat.opacity = deep * 0.95;
    lineMat.opacity   = deep * 0.28;
    cGroup.visible    = deep > 0.02;
  }

  return { update };
}
