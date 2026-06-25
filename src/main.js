import * as THREE from 'three';
import { buildWorld }      from './world.js';
import { buildBuilding }   from './building.js';
import { buildSite }       from './site.js';
import { buildLandmarks }  from './landmarks.js';
import { createPlayer, isMobile } from './player.js';
import { createMinimap }   from './minimap.js';
import { ATMOSPHERE, SPAWN } from './world.config.js';
import { EntityManager } from './entities.js';
import { createGeese } from './geese.js';
import { createNPC }     from './npc.js';
import { createPortals } from './portal.js';
import { buildBeachVolleyballCourt } from './beach_volleyball.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass }     from 'three/addons/postprocessing/RenderPass.js';
import { OutlinePass }    from 'three/addons/postprocessing/OutlinePass.js';
import { OutputPass }     from 'three/addons/postprocessing/OutputPass.js';

// ─────────────────────────────────────────────────────────────────────────────
//  Renderer
// ─────────────────────────────────────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ antialias: !isMobile });
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
scene.background = new THREE.Color(ATMOSPHERE.skyColor);
scene.fog        = new THREE.FogExp2(ATMOSPHERE.fogColor, ATMOSPHERE.fogDensity);

// ─────────────────────────────────────────────────────────────────────────────
//  Camera — spawn deep in the forest, facing the clearing
// ─────────────────────────────────────────────────────────────────────────────
const camera = new THREE.PerspectiveCamera(78, window.innerWidth / window.innerHeight, 0.1, ATMOSPHERE.drawDistance);
camera.position.set(SPAWN.x, SPAWN.y, SPAWN.z);
camera.lookAt(0, SPAWN.y, 0);

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
sun.shadow.mapSize.width    = isMobile ? 1024 : 4096;
sun.shadow.mapSize.height   = isMobile ? 1024 : 4096;
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

// Lobby fill — warms the NPC inside the building
const lobbyLight = new THREE.PointLight(0xFFF8F0, 2.5, 22);
lobbyLight.position.set(0, 5, -8);
scene.add(lobbyLight);

// ─────────────────────────────────────────────────────────────────────────────
//  World geometry
// ─────────────────────────────────────────────────────────────────────────────
const entities = new EntityManager(scene);
entities.add('world',    buildWorld());
entities.add('building', buildBuilding());
const { group: siteGroup, carObstacles } = buildSite();
entities.add('site',     siteGroup);
entities.add('landmarks', buildLandmarks());
entities.add('beachCourt', buildBeachVolleyballCourt());

const geese   = createGeese(scene, carObstacles);
const { update: npcUpdate, root: npcRoot } = createNPC(scene);
const portals = createPortals(scene, camera);

// ─────────────────────────────────────────────────────────────────────────────
//  Post-processing (composer needs scene + camera + npcRoot)
// ─────────────────────────────────────────────────────────────────────────────
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

// OutlinePass — desktop only, outlines only the NPC group
if (!isMobile) {
  const outlinePass = new OutlinePass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    scene, camera
  );
  outlinePass.visibleEdgeColor.set(0x111111);
  outlinePass.hiddenEdgeColor.set(0x111111);
  outlinePass.edgeStrength  = 4.0;
  outlinePass.edgeThickness = 1.5;
  outlinePass.edgeGlow      = 0.0;
  outlinePass.selectedObjects = [npcRoot];
  composer.addPass(outlinePass);
}
composer.addPass(new OutputPass());

// ─────────────────────────────────────────────────────────────────────────────
//  FPS player
// ─────────────────────────────────────────────────────────────────────────────
const { controls, update: updatePlayer, startMobile } = createPlayer(camera, renderer.domElement);
const minimap = createMinimap(camera);

const overlay   = document.getElementById('overlay');
const crosshair = document.getElementById('crosshair');

if (isMobile) {
  // No pointer lock on mobile — tap overlay to begin
  overlay.addEventListener('click', () => {
    overlay.style.display = 'none';
    startMobile();
  });
} else {
  overlay.addEventListener('click', () => controls.lock());
  controls.addEventListener('lock', () => {
    overlay.style.display   = 'none';
    crosshair.style.display = 'block';
  });
  controls.addEventListener('unlock', () => {
    overlay.style.display   = 'flex';
    crosshair.style.display = 'none';
  });
}

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
  geese.update(dt, camera.position);
  npcUpdate(dt, camera.position);
  portals.update(dt);
  minimap.update();
  composer.render();
}

animate();

// ─────────────────────────────────────────────────────────────────────────────
//  Resize
// ─────────────────────────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  composer.setSize(w, h);
});
