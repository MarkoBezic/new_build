import * as THREE from 'three';
import { buildWorld }     from './world.js';
import { buildBuilding }  from './building.js';
import { buildSite }      from './site.js';
import { createPlayer }   from './player.js';
import { createMinimap }  from './minimap.js';

// ─────────────────────────────────────────────────────────────────────────────
//  Renderer
// ─────────────────────────────────────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled   = true;
renderer.shadowMap.type      = THREE.PCFSoftShadowMap;
renderer.toneMapping         = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.body.appendChild(renderer.domElement);

// ─────────────────────────────────────────────────────────────────────────────
//  Scene + atmosphere
// ─────────────────────────────────────────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8ABFDE);             // pale blue sky
scene.fog        = new THREE.FogExp2(0x5A7A48, 0.022);   // dense green forest fog

// ─────────────────────────────────────────────────────────────────────────────
//  Camera — spawn deep in the forest, facing the clearing
// ─────────────────────────────────────────────────────────────────────────────
const camera = new THREE.PerspectiveCamera(78, window.innerWidth / window.innerHeight, 0.1, 400);
camera.position.set(0, 1.75, -165);   // north side of forest, facing main entrance
camera.lookAt(0, 1.75, 0);

// ─────────────────────────────────────────────────────────────────────────────
//  Lighting
// ─────────────────────────────────────────────────────────────────────────────

// Sky / ground hemisphere — gives the underside of canopies a warm earth bounce
const hemi = new THREE.HemisphereLight(0xB8D8F0, 0x304820, 0.75);
scene.add(hemi);

// Primary sun — high noon, slightly NW
const sun = new THREE.DirectionalLight(0xFFF8E0, 2.0);
sun.position.set(70, 120, 80);
sun.castShadow              = true;
sun.shadow.mapSize.width    = 4096;
sun.shadow.mapSize.height   = 4096;
sun.shadow.camera.left      = -95;
sun.shadow.camera.right     =  95;
sun.shadow.camera.top       =  95;
sun.shadow.camera.bottom    = -95;
sun.shadow.camera.near      =  1;
sun.shadow.camera.far       =  380;
sun.shadow.bias             = -0.0004;
sun.target.position.set(0, 0, 0);
scene.add(sun);
scene.add(sun.target);

// Soft fill from opposite side — prevents jet-black shadows
const fill = new THREE.DirectionalLight(0xCCDDFF, 0.4);
fill.position.set(-60, 50, -60);
scene.add(fill);

// ─────────────────────────────────────────────────────────────────────────────
//  World geometry
// ─────────────────────────────────────────────────────────────────────────────
buildWorld(scene);

// ── Building ─────────────────────────────────────────────────────────────────
buildBuilding(scene);

// ── Site (parking, cars, trees, sidewalks) ───────────────────────────────────
buildSite(scene);

// ─────────────────────────────────────────────────────────────────────────────
//  FPS player
// ─────────────────────────────────────────────────────────────────────────────
const { controls, update: updatePlayer } = createPlayer(camera, renderer.domElement);
const minimap = createMinimap(camera);

const overlay   = document.getElementById('overlay');
const crosshair = document.getElementById('crosshair');

overlay.addEventListener('click', () => controls.lock());

controls.addEventListener('lock', () => {
  overlay.style.display   = 'none';
  crosshair.style.display = 'block';
});
controls.addEventListener('unlock', () => {
  overlay.style.display   = 'flex';
  crosshair.style.display = 'none';
});

// ─────────────────────────────────────────────────────────────────────────────
//  Render loop
// ─────────────────────────────────────────────────────────────────────────────
let prevTime = performance.now();

function animate() {
  requestAnimationFrame(animate);

  const now = performance.now();
  const dt  = Math.min((now - prevTime) / 1000, 0.05); // cap at 50 ms
  prevTime  = now;

  updatePlayer(dt);
  minimap.update();
  renderer.render(scene, camera);
}

animate();

// ─────────────────────────────────────────────────────────────────────────────
//  Resize
// ─────────────────────────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
