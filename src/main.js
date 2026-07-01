import * as THREE from 'three';
import { buildWorld }      from './world.js';
import { buildBuilding }   from './building.js';
import { buildSite }       from './site.js';
import { buildLandmarks }  from './landmarks.js';
import { createPlayer, isMobile, setBoats, isOnBoat } from './player.js';
import { createFishing } from './fishing.js';
import { createSecrets } from './secrets.js';
import { createEmotes, EMOTES } from './emotes.js';
import { createBulletin } from './bulletin.js';
import { createBoat, createDecorativeBoats } from './boat.js';
import { createMinimap } from './minimap.js';
import { ATMOSPHERE, SPAWN } from './world.config.js';
import { EntityManager } from './entities.js';
import { createGeese } from './geese.js';
import { createNPC }     from './npc.js';
import { createPortals } from './portal.js';
import { buildBeachVolleyballCourt } from './beach_volleyball.js';
import { createMultiplayer } from './multiplayer.js';
import { showAvatarPicker } from './avatar-select.js';
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

// ── Day / Night palette (pre-allocated — reused every frame) ─────────────────
const _C_NIGHT_SKY = new THREE.Color(0x020510);
const _C_DAWN_SKY  = new THREE.Color(0xB83010);
const _C_DAY_SKY   = new THREE.Color(ATMOSPHERE.skyColor);
const _C_NIGHT_FOG = new THREE.Color(0x020510);
const _C_DAY_FOG   = new THREE.Color(ATMOSPHERE.fogColor);
const _C_DAWN_SUN  = new THREE.Color(0xFF6020);
const _C_DAY_SUN   = new THREE.Color(0xFFF8E0);
let _dayTime = 180;  // seconds into the cycle — start near dawn (t ≈ 0.15)

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

// ── Spawn ground marker ─────────────────────────────────────────────────────
const _spawnMat = (color, opacity, ring) => new THREE.MeshBasicMaterial({
  color, transparent: true, opacity, depthWrite: false,
  side: ring ? THREE.DoubleSide : THREE.FrontSide,
  polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
});
const spawnDisc = new THREE.Mesh(new THREE.CircleGeometry(8, 48),  _spawnMat(0x8FD158, 0.38, false));
const spawnRing = new THREE.Mesh(new THREE.RingGeometry(9, 10.5, 48), _spawnMat(0xC2F075, 0.70, true));
spawnDisc.rotation.x = spawnRing.rotation.x = -Math.PI / 2;
spawnDisc.position.set(SPAWN.x, 0.01, SPAWN.z);
spawnRing.position.set(SPAWN.x, 0.01, SPAWN.z);
scene.add(spawnDisc, spawnRing);

// ── Compass labels around spawn circle ─────────────────────────────────────
function makeCompassSprite(letter) {
  const isN = letter === 'N';
  const size = isN ? 96 : 72;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const cx = c.getContext('2d');
  cx.font = `bold ${isN ? 60 : 44}px Arial, sans-serif`;
  cx.fillStyle = isN ? '#D4FF90' : '#9ED462';
  cx.textAlign = 'center';
  cx.textBaseline = 'middle';
  cx.fillText(letter, size / 2, size / 2);
  const tex = new THREE.CanvasTexture(c);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sp.scale.set(isN ? 2.2 : 1.5, isN ? 2.2 : 1.5, 1);
  return sp;
}
const _CR = 13;  // just outside the 10.5 outer ring
[['N', 0, -_CR], ['S', 0, _CR], ['E', _CR, 0], ['W', -_CR, 0]].forEach(([letter, dx, dz]) => {
  const sp = makeCompassSprite(letter);
  sp.position.set(SPAWN.x + dx, 1.0, SPAWN.z + dz);
  scene.add(sp);
});

const geese      = createGeese(scene, carObstacles);
setBoats([createBoat(scene), ...createDecorativeBoats(scene)]);

// ── Beach campfire — gathering point that glows at night ─────────────────────
let campfireLight, _campfireFlame, _campfireInner;
{
  const CX = -465, CZ = 578;  // beach sand, z−x = 1043
  const cg = new THREE.Group();

  const stoneMat = new THREE.MeshLambertMaterial({ color: 0x888888 });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.18, 5, 4), stoneMat);
    s.position.set(Math.cos(a) * 0.52, 0.09, Math.sin(a) * 0.52);
    s.scale.set(1, 0.65, 0.85);
    cg.add(s);
  }

  const logMat = new THREE.MeshLambertMaterial({ color: 0x5C3A1A });
  for (const ry of [0, Math.PI / 3]) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.075, 1.0, 6), logMat);
    log.rotation.set(0, ry, Math.PI / 2);
    log.position.y = 0.20;
    cg.add(log);
  }

  _campfireFlame = new THREE.Mesh(
    new THREE.ConeGeometry(0.18, 0.55, 7),
    new THREE.MeshLambertMaterial({ color: 0xFF5500, emissive: 0xFF3300, emissiveIntensity: 0.6 }),
  );
  _campfireFlame.position.y = 0.43;
  cg.add(_campfireFlame);

  _campfireInner = new THREE.Mesh(
    new THREE.ConeGeometry(0.10, 0.38, 7),
    new THREE.MeshLambertMaterial({ color: 0xFFDD00, emissive: 0xFFAA00, emissiveIntensity: 0.8 }),
  );
  _campfireInner.position.y = 0.47;
  cg.add(_campfireInner);

  cg.position.set(CX, 0.15, CZ);
  scene.add(cg);

  campfireLight = new THREE.PointLight(0xFF6600, 1.5, 22);
  campfireLight.position.set(CX, 0.15 + 0.9, CZ);
  scene.add(campfireLight);
}

const { update: npcUpdate, root: npcRoot } = createNPC(scene);
let multiplayer = { update() {}, getRemotes() { return []; } };  // replaced after avatar selection

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
const { controls, update: updatePlayer, startMobile, setColor, playerPosition, getState, teleport, getAvatar } = createPlayer(scene, camera, renderer.domElement);
const portals    = createPortals(scene, playerPosition, teleport);
const minimap    = createMinimap(camera, () => multiplayer.getRemotes());
const fishing    = createFishing(scene);
const secrets    = createSecrets(scene);
const emotes     = createEmotes(getAvatar);
let _playerName  = 'Anonymous';
const bulletin   = createBulletin(scene, () => _playerName);

// Emote broadcast wired after multiplayer initialises in avatar picker callback
emotes.setOnBroadcast((id) => {
  const def = EMOTES.find(e => e.id === id);
  if (multiplayer.broadcastEmote && def) multiplayer.broadcastEmote(id, def.duration);
});

// Mobile fishing button — tap to cast / reel while on a boat
fishing.getMobileBtn().addEventListener('touchend', e => {
  e.preventDefault();
  fishing.handleAction(playerPosition, getState().ry, isOnBoat());
});

const overlay   = document.getElementById('overlay');
const crosshair = document.getElementById('crosshair');
const ucEl      = document.getElementById('user-count');
const ucNum     = document.getElementById('uc-num');
let _prevCount  = -1;
let _ucVisible  = false;

// C key — toggle user counter; F key — fishing (while pointer locked)
window.addEventListener('keydown', e => {
  if (!avatarReady || !document.pointerLockElement) return;
  if (e.code === 'KeyC') {
    _ucVisible = !_ucVisible;
    ucEl.style.display = _ucVisible ? 'block' : 'none';
  }
  fishing.onKey(e, playerPosition, getState().ry, isOnBoat());
  emotes.onKey(e);
  bulletin.onKey(e);  // E to open when near board
});
// E key also closes the bulletin overlay when pointer lock is released
window.addEventListener('keydown', e => {
  if (!avatarReady || document.pointerLockElement) return;
  if (e.code === 'KeyE' || e.code === 'Escape') bulletin.onKey({ code: 'KeyE' });
});
// Auto-hide when leaving pointer lock so it doesn't linger on the overlay
controls.addEventListener('unlock', () => {
  if (_ucVisible) { _ucVisible = false; ucEl.style.display = 'none'; }
});

// Set up pointer-lock and overlay-click listeners now, guarded by a flag so
// they don't fire during avatar selection. onConfirm just sets the flag and
// attempts an immediate lock (direct user-gesture chain from "Enter World").
let avatarReady = false;

if (isMobile) {
  overlay.addEventListener('click', () => {
    if (!avatarReady) return;
    overlay.style.display = 'none';
    startMobile();
  });
} else {
  controls.addEventListener('lock', () => {
    overlay.style.display   = 'none';
    crosshair.style.display = 'block';
  });
  controls.addEventListener('unlock', () => {
    overlay.style.display   = 'flex';
    crosshair.style.display = 'none';
  });
  overlay.addEventListener('click', () => {
    if (!avatarReady) return;
    renderer.domElement.requestPointerLock();
  });
}

showAvatarPicker(overlay, (color, name) => {
  setColor(color, name);
  _playerName = name || 'Anonymous';
  avatarReady = true;                // set before anything that could throw
  try {
    multiplayer = createMultiplayer(scene, getState, color, name, {
      onRemoteEmote: (mesh, id, elapsed) => emotes.applyRemoteEmote(mesh, id, elapsed),
    });
  } catch (e) { console.warn('Multiplayer unavailable:', e); }
  if (!isMobile) renderer.domElement.requestPointerLock();
});

// ─────────────────────────────────────────────────────────────────────────────
//  Day / Night cycle — 20-minute full cycle
// ─────────────────────────────────────────────────────────────────────────────
function updateDayNight(dt, nowSec) {
  const DAY_DUR = 1200;
  _dayTime = (_dayTime + dt) % DAY_DUR;
  const t = _dayTime / DAY_DUR;

  // sunElev: 1 at noon, -1 at midnight; positive = above horizon
  const sunElev   = Math.sin(t * Math.PI * 2);
  const dayFactor = Math.max(0, sunElev);

  // Move sun along an arc east→west
  const az = t * Math.PI * 2;
  sun.position.set(Math.sin(az) * 120, sunElev * 140, Math.cos(az) * 60);

  if (sunElev > 0) {
    // Warm orange at low angle, white at noon
    sun.color.copy(_C_DAWN_SUN).lerp(_C_DAY_SUN, Math.pow(dayFactor, 0.5));
    sun.intensity  = dayFactor * 2.2;
    sun.castShadow = true;
  } else {
    sun.intensity  = 0;
    sun.castShadow = false;
  }

  hemi.intensity = 0.05 + dayFactor * 0.70;
  fill.intensity = 0.03 + dayFactor * 0.37;

  // Sky: night → day with dawn/dusk orange glow near the horizon
  const dawnGlow = sunElev > -0.2 ? Math.max(0, 1 - Math.abs(sunElev) * 5) : 0;
  scene.background.copy(_C_NIGHT_SKY).lerp(_C_DAY_SKY, dayFactor);
  if (dawnGlow > 0.01) scene.background.lerp(_C_DAWN_SKY, dawnGlow * 0.4);

  // Fog
  scene.fog.color.copy(_C_NIGHT_FOG).lerp(_C_DAY_FOG, dayFactor);

  // Campfire — always flickers, blazes at night
  const flicker = 0.85 + Math.sin(nowSec * 7.3) * 0.09 + Math.sin(nowSec * 13.1) * 0.06;
  campfireLight.intensity = (0.6 + (1 - dayFactor) * 2.8) * flicker;
  _campfireFlame.scale.y = 0.85 + Math.sin(nowSec * 6.1) * 0.15;
  _campfireFlame.scale.x = _campfireFlame.scale.z = 0.9 + Math.sin(nowSec * 9.7) * 0.10;
  _campfireInner.scale.y = 0.90 + Math.sin(nowSec * 11.3) * 0.10;
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

  updateDayNight(dt, now / 1000);
  updatePlayer(dt);
  fishing.update(dt, playerPosition, getState().ry, isOnBoat());
  fishing.showMobileBtn(isOnBoat());
  secrets.update(dt, playerPosition, isOnBoat());
  emotes.update(dt);
  emotes.showMobileBar(true);
  bulletin.update(dt, playerPosition);
  bulletin.showMobileBtn();
  geese.update(dt, playerPosition);
  npcUpdate(dt, playerPosition);
  portals.update(dt);
  multiplayer.update(dt);
  // Update counter text only when visible and only when the value changes
  if (_ucVisible) {
    const count = multiplayer.getRemotes().length + 1;
    if (count !== _prevCount) { _prevCount = count; ucNum.textContent = count; }
  }

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
