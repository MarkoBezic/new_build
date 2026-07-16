import * as THREE from 'three';
import { buildWorld }      from './world.js';
import { buildBuilding }   from './building.js';
import { buildSite }       from './site.js';
import { buildLandmarks }  from './landmarks.js';
import { createPlayer, isMobile, setBoats, isOnBoat, isGliding } from './player.js';
import { createFishing } from './fishing.js';
import { createSecrets } from './secrets.js';
import { createEmotes, EMOTES } from './emotes.js';
import { createVolleyball } from './volleyball.js';
import { createTorches } from './torches.js';
import { createBoat, createDecorativeBoats, updateBoats, setSailColor } from './boat.js';
import { createMinimap } from './minimap.js';
import { ATMOSPHERE, SPAWN } from './world.config.js';
import { EntityManager } from './entities.js';
import { createGeese } from './geese.js';
import { createNPC }     from './npc.js';
import { createPortals } from './portal.js';
import { buildBeachVolleyballCourt } from './beach_volleyball.js';
import { createMultiplayer } from './multiplayer.js';
import { createChat } from './chat.js';
import { showAvatarPicker } from './avatar-select.js';
import { createSky }      from './sky.js';
import { createWater }    from './water.js';
import { createCrystals } from './crystals.js';
import { createBiomes, biomeAt } from './biomes.js';
import { createGhosts }   from './ghosts.js';
import { createHUD, toast } from './hud.js';
import { createAudio }    from './audio.js';
import { progress }       from './progress.js';
import { createInteract } from './interact.js';
import { createCosmetics } from './cosmetics.js';
import { createShards }   from './shards.js';
import { createTablets }  from './tablets.js';
import { createNight }    from './night.js';
import { createEvents }   from './events.js';
import { createPOIs }     from './pois.js';
import { createGlider }   from './glider.js';
import { createStones }   from './stones.js';
import { createSnowballs } from './snowballs.js';
import { createWeather }  from './weather.js';
import { createTreasure } from './treasure.js';
import { createTasks }    from './tasks.js';
import { createPhoto }    from './photo.js';
import { createRitual }   from './ritual.js';
import { createRace }     from './race.js';
import { createGosling }  from './gosling.js';
import { createShells }   from './shells.js';
import { createShop }     from './shop.js';
import { createIsland }   from './island.js';
import { createSkyIslands } from './skyislands.js';
import { initHats, wornHat } from './hats.js';
import { initGoods }      from './goods.js';
import { createCave }     from './cave.js';
import { createSeasons }  from './seasons.js';
import { bus }            from './bus.js';
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
const _C_NIGHT_FOG = new THREE.Color(0x444A56);
const _C_DAY_FOG   = new THREE.Color(ATMOSPHERE.fogColor);
const _C_DAWN_SUN  = new THREE.Color(0xFF6020);
const _C_DAY_SUN   = new THREE.Color(0xFFF8E0);

// Current sun direction + day/night state — shared across systems
const _sunDir     = new THREE.Vector3(0.3, 0.8, 0.2);
let   _dayFactor  = 1;
let   _night      = 0;   // 0 day → 1 deep night
let   _hourEST    = 12;  // fractional local hour, for scheduled events
let   _fireFeed   = 0;   // campfire "feed" interaction boost, decays

const audio = createAudio();

// Real-time solar calculation for Toronto (America/New_York timezone, handles DST automatically)
const _nyFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
});
const _nyOffFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York', timeZoneName: 'shortOffset',
});
let _sunriseH = 6, _sunsetH = 20, _lastSolarDay = -1;

function _refreshSolar(date) {
  const doy = Math.round((date - new Date(date.getFullYear(), 0, 0)) / 86_400_000);
  if (doy === _lastSolarDay) return;
  _lastSolarDay = doy;
  const LAT     = 43.7 * Math.PI / 180;   // Toronto latitude
  const LON     = 79.4;                   // Toronto longitude (°W)
  const dec     = -23.45 * Math.PI / 180 * Math.cos(2 * Math.PI * (doy + 10) / 365);
  // Hour angle at sunrise/sunset, with standard refraction (sun visible at -0.833°)
  const Z       = Math.cos(90.833 * Math.PI / 180);
  const cosH    = Math.max(-1, Math.min(1,
    (Z - Math.sin(LAT) * Math.sin(dec)) / (Math.cos(LAT) * Math.cos(dec))));
  const H       = Math.acos(cosH) * 180 / Math.PI / 15;
  // Equation of time — the sun runs up to ±16 min fast/slow of clock time
  const B       = 2 * Math.PI * (doy - 81) / 365;
  const eotH    = (9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B)) / 60;
  // UTC offset of America/New_York right now (-5 EST, -4 EDT)
  const offStr  = _nyOffFmt.formatToParts(date).find(p => p.type === 'timeZoneName').value;
  const utcOffH = parseFloat(offStr.replace('GMT', '')) || -5;
  // Solar noon in local clock time: meridian offset + DST + equation of time
  const noonH   = 12 + LON / 15 + utcOffH - eotH;
  _sunriseH     = noonH - H;
  _sunsetH      = noonH + H;
}

function _estHourNow(date) {
  const parts  = _nyFmt.formatToParts(date);
  const h      = parseInt(parts.find(p => p.type === 'hour').value);
  const m      = parseInt(parts.find(p => p.type === 'minute').value);
  const s      = parseInt(parts.find(p => p.type === 'second').value);
  return (h === 24 ? 0 : h) + m / 60 + s / 3600;
}

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

// ── Atmosphere, ocean, crystals, biomes ─────────────────────────────────────
const sky      = createSky(scene);
const water    = createWater(scene);
const crystals = createCrystals(scene);
const biomes   = createBiomes(scene);

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

// Campfire flame hue — default warm orange, or a shop-bought colour
function applyFlame(hex) {
  if (hex == null) {
    _campfireFlame.material.color.setHex(0xFF5500);
    _campfireFlame.material.emissive.setHex(0xFF3300);
    _campfireInner.material.color.setHex(0xFFDD00);
    _campfireInner.material.emissive.setHex(0xFFAA00);
    campfireLight.color.setHex(0xFF6600);
  } else {
    _campfireFlame.material.color.setHex(hex);
    _campfireFlame.material.emissive.setHex(hex);
    const bright = new THREE.Color(hex).lerp(new THREE.Color(0xFFFFFF), 0.45);
    _campfireInner.material.color.copy(bright);
    _campfireInner.material.emissive.copy(bright);
    campfireLight.color.setHex(hex);
  }
}

const torches = createTorches(scene);

const { update: npcUpdate, root: npcRoot } = createNPC(scene);
let multiplayer = { update() {}, getRemotes() { return []; } };  // replaced after avatar selection
let myName = '';                                                 // set after avatar selection

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
const portals    = createPortals(scene, playerPosition, (x, z) => { audio.sfx.whoosh(); teleport(x, z); bus.emit('warp'); });
const ghosts     = createGhosts(scene, { applyEmote: (mesh, id, t) => emotes.applyRemoteEmote(mesh, id, t) });
const minimap    = createMinimap(camera, () => [...multiplayer.getRemotes(), ...ghosts.getRemotes()]);
const fishing    = createFishing(scene);
const secrets    = createSecrets(scene);
const emotes     = createEmotes(getAvatar);
const volleyball = createVolleyball(scene, {
  onBroadcast: state => { if (multiplayer.publishBall) multiplayer.publishBall(state); },
});
// ── Progression, interaction and living-world systems ───────────────────────
const interact    = createInteract(playerPosition, { isMobile });
const cosmetics   = createCosmetics(scene, getAvatar, progress);
const shards      = createShards(scene, { progress, audio, cosmetics });
const tablets     = createTablets(scene, { progress, audio, interact, cosmetics });
const nightLife   = createNight(scene, {
  interact,
  onSpiritSpeak: (mesh, line) => { chat.showBubble(mesh, line); audio.sfx.bell(); },
});
const worldEvents = createEvents(scene);
const pois        = createPOIs(scene, { interact, audio });
const glider      = createGlider(scene, { progress, interact, audio });
const stones      = createStones(scene, { interact, audio, playerPosition });
const weather     = createWeather(scene);
const tasks       = createTasks({ playerPosition });
const treasure    = createTreasure(scene, {
  interact, audio, summit: glider.summit, getTasksNote: tasks.summaryLine,
});
const photo       = createPhoto(renderer, { audio, isMobile });
const ritual      = createRitual(scene, { audio });
const race        = createRace(scene, { interact, audio, playerPosition });
const gosling     = createGosling(scene, { interact, audio, playerPosition });
const shells      = createShells(scene, { audio, playerPosition });
const shop        = createShop(scene, { interact, audio, shells });
const island      = createIsland(scene, { interact, audio });
const skyIsles    = createSkyIslands(scene, { interact, audio, playerPosition });
const cave        = createCave(scene, { interact, audio, shells });
const seasons     = createSeasons(scene, { playerPosition });
initHats({
  getAvatar,
  onChange: id => { if (multiplayer.updateHat) multiplayer.updateHat(id); },
});
initGoods({ sail: setSailColor, flame: applyFlame });
const snowballs   = createSnowballs(scene, {
  camera, playerPosition, biomeAt, audio,
  getTargets:  () => [...multiplayer.getRemotes(), ...ghosts.getRemotes()],
  onBroadcast: data => { if (multiplayer.publishSnow) multiplayer.publishSnow(data); },
});

// World-object interactions (main owns the campfire and rune meshes/coords)
interact.register({
  x: -465, z: 578, r: 4.5, label: 'Feed the campfire',
  cb: () => {
    _fireFeed = 1;
    audio.sfx.grind();
    bus.emit('campfire');
    ritual.onFeed('me', performance.now() / 1000);
    if (multiplayer.publishFire) multiplayer.publishFire();
  },
});
interact.register({
  x: 650, z: 150, r: 8, label: 'Ring the ancient rune',
  cb: () => { audio.sfx.bell(); toast('The rune tolls across the ruins…', 2400); },
});

// U — mute / unmute the soundscape (works even outside pointer lock)
window.addEventListener('keydown', e => {
  if (e.code !== 'KeyU') return;
  const tag = document.activeElement?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  toast(audio.toggleMute() ? '🔇 Sound muted' : '🔊 Sound on', 1500);
});

const hud = createHUD({
  camera, playerPosition, biomeAt,
  getNearestPortal: portals.getNearest,
  getInteractPrompt: interact.getPrompt, isMobile,
});
const chat = createChat({
  onSend: text => {
    if (multiplayer.sendChat) multiplayer.sendChat(text);
    chat.addMessage(myName || 'Me', text, true);
    chat.showBubble(getAvatar(), text);   // visible to self in third-person view
  },
});

// ── Controls help panel ───────────────────────────────────────────────────────
;(() => {
  const ROWS_DESKTOP = [
    ['WASD',    'Move'],
    ['Mouse',   'Look around'],
    ['V',       'Toggle 1st / 3rd person'],
    ['Shift',   'Sprint'],
    ['Space',   'Jump'],
    ['E',       'Interact · board / exit boat'],
    ['Space ✈', '🪂 Hold in the air to glide (find it at the Icy Peaks summit)'],
    ['G',       '❄️ Throw snowball (in the Icy Peaks)'],
    ['J',       '📖 Warden journal'],
    ['K',       '📋 Daily tasks'],
    ['P',       '📷 Save a photo'],
    ['B',       'Cycle trail style'],
    ['U',       'Mute / unmute sound'],
    ['F',       'Cast / reel fishing rod (on boat)'],
    ['H',       'Hit volleyball (near court)'],
    ['T / Enter', '💬 Chat with other players'],
    ['1',       '👋 Wave'],
    ['2',       '🎉 Cheer'],
    ['3',       '👉 Point'],
    ['4',       '🪑 Sit (press again to stand)'],
    ['C',       'Toggle player count'],
    ['Esc',     'Release cursor / close overlay'],
  ];
  const ROWS_MOBILE = [
    ['Joystick', 'Move'],
    ['💬',       'Chat with other players (bottom left)'],
    ['👋🎉👉🪑', 'Emotes (bottom centre)'],
    ['🎣',       'Cast / reel (on boat, bottom right)'],
    ['🏐',       'Hit volleyball (near court, right)'],
    ['❄️',       'Throw snowball (in the Icy Peaks)'],
    ['📷',       'Save a photo (left side)'],
  ];

  const rows = isMobile ? ROWS_MOBILE : ROWS_DESKTOP;

  // Panel
  const panel = document.createElement('div');
  Object.assign(panel.style, {
    position: 'fixed', bottom: '76px', right: '16px',
    background: 'rgba(12,10,8,0.93)', color: '#F0E4C8',
    borderRadius: '12px', padding: '14px 18px',
    fontFamily: 'Arial, sans-serif', fontSize: '13px',
    lineHeight: '1.75', display: 'none', zIndex: '40',
    border: '1px solid rgba(180,140,60,0.35)',
    minWidth: '240px', pointerEvents: 'none',
  });

  const title = document.createElement('div');
  title.textContent = '⌨️  Controls';
  Object.assign(title.style, {
    fontWeight: 'bold', fontSize: '14px', color: '#D4A85A',
    marginBottom: '8px',
  });
  panel.appendChild(title);

  const grid = document.createElement('div');
  Object.assign(grid.style, {
    display: 'grid',
    gridTemplateColumns: 'auto 1fr',
    columnGap: '14px',
  });
  rows.forEach(([key, desc]) => {
    const k = document.createElement('span');
    k.textContent = key;
    Object.assign(k.style, {
      background: 'rgba(255,255,255,0.12)', borderRadius: '4px',
      padding: '0 6px', fontFamily: 'monospace', fontSize: '12px',
      color: '#FFD580', whiteSpace: 'nowrap', alignSelf: 'center',
    });
    const d = document.createElement('span');
    d.textContent = desc;
    d.style.color = '#D8CDB4';
    grid.appendChild(k);
    grid.appendChild(d);
  });
  panel.appendChild(grid);
  document.body.appendChild(panel);

  // Toggle button
  const btn = document.createElement('button');
  btn.textContent = '?';
  Object.assign(btn.style, {
    position: 'fixed', bottom: '20px', right: '20px',
    width: '44px', height: '44px', borderRadius: '50%',
    fontSize: '20px', fontWeight: 'bold', border: 'none',
    background: 'rgba(0,0,0,0.50)', color: '#D4A85A',
    cursor: 'pointer', zIndex: '40',
    boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
  });
  let open = false;
  btn.addEventListener('click', () => {
    open = !open;
    panel.style.display = open ? 'block' : 'none';
    btn.style.background = open ? 'rgba(180,140,60,0.55)' : 'rgba(0,0,0,0.50)';
  });
  document.body.appendChild(btn);
})();

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
  const tag = document.activeElement?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;   // typing in chat
  if (e.code === 'Enter' || e.code === 'KeyT') {
    e.preventDefault();
    chat.open();
    return;
  }
  // Shop steals digits and letters while open (everything gets them back after)
  if (shop.isOpen()) { shop.onKey(e); return; }
  if (e.code === 'KeyC') {
    _ucVisible = !_ucVisible;
    ucEl.style.display = _ucVisible ? 'block' : 'none';
  }
  fishing.onKey(e, playerPosition, getState().ry, isOnBoat());
  emotes.onKey(e);
  volleyball.onKey(e, playerPosition);
  snowballs.onKey(e);
});
// Auto-hide user count when leaving pointer lock
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
  myName = name;
  avatarReady = true;                // set before anything that could throw
  try {
    multiplayer = createMultiplayer(scene, getState, color, name, {
      hat: wornHat(),
      onRemoteEmote: (mesh, id, elapsed) => emotes.applyRemoteEmote(mesh, id, elapsed),
      onBallState:   state => volleyball.handleRemoteState(state),
      onSnow:        data => snowballs.spawnRemote(data),
      onFire:        id => ritual.onFeed(id, performance.now() / 1000),
      onChat: (senderName, text, mesh) => {
        chat.addMessage(senderName, text);
        if (mesh) chat.showBubble(mesh, text);
      },
    });
  } catch (e) { console.warn('Multiplayer unavailable:', e); }
  chat.showMobileButton(isMobile);
  if (!isMobile) renderer.domElement.requestPointerLock();
});

// ─────────────────────────────────────────────────────────────────────────────
//  Day / Night cycle — synced to real US Eastern time with seasonal solar model
// ─────────────────────────────────────────────────────────────────────────────
function updateDayNight(dt, nowSec) {
  const now = new Date();
  _refreshSolar(now);
  const hourEST = _estHourNow(now);

  // Sun elevation: 0 at sunrise/sunset, 1 at solar noon, negative at night.
  // Day half: half-sine arc from sunrise to sunset.
  // Night half: inverted half-sine from sunset to next sunrise.
  let sunElev;
  if (hourEST > _sunriseH && hourEST < _sunsetH) {
    sunElev = Math.sin(Math.PI * (hourEST - _sunriseH) / (_sunsetH - _sunriseH));
  } else {
    const nightDur = 24 - (_sunsetH - _sunriseH);
    const hPast    = hourEST >= _sunsetH ? hourEST - _sunsetH : hourEST + (24 - _sunsetH);
    sunElev = -Math.sin(Math.PI * hPast / nightDur);
  }
  _night   = Math.min(1, Math.max(0, (-sunElev - 0.03) * 5));
  _hourEST = hourEST;

  // Real daylight saturates well before the sun is overhead — full brightness
  // once the sun is ~a quarter of the way up its arc, ramping only near dawn/dusk.
  const t = Math.min(1, Math.max(0, sunElev) / 0.25);
  const dayFactor = _dayFactor = t * t * (3 - 2 * t);
  // Civil twilight: residual sky light for ~50 min past sunset / before sunrise
  const twilight = Math.max(0, Math.min(1, 1 + sunElev / 0.3));

  // Sun arc: east at sunrise, overhead at noon, west at sunset
  const az = (hourEST / 24) * Math.PI * 2;
  _sunDir.set(Math.sin(az) * 120, sunElev * 140, Math.cos(az) * 60).normalize();

  // Sun light + shadow frustum follow the player so shadows work world-wide
  sun.position.set(
    playerPosition.x + _sunDir.x * 170,
    Math.max(_sunDir.y, 0.05) * 170,
    playerPosition.z + _sunDir.z * 170,
  );
  sun.target.position.set(playerPosition.x, 0, playerPosition.z);

  // Weather — seeded per 3-hour block; dims the sun, thickens fog, drives rain
  weather.update(dt, hourEST, dayFactor, camera);
  const wx = weather.current();

  if (sunElev > 0) {
    // Warm orange at low angle, white at noon
    sun.color.copy(_C_DAWN_SUN).lerp(_C_DAY_SUN, Math.pow(dayFactor, 0.5));
    sun.intensity  = dayFactor * 2.2 * wx.sun;
    sun.castShadow = true;
  } else {
    sun.intensity  = 0;
    sun.castShadow = false;
  }

  // Night floor keeps the world dim-gray but readable, like overcast moonlight
  const wxAmb = 0.7 + 0.3 * wx.sun;
  hemi.intensity = (0.28 + twilight * 0.07 + dayFactor * 0.40) * wxAmb;
  fill.intensity = (0.14 + twilight * 0.04 + dayFactor * 0.22) * wxAmb;
  scene.fog.density = ATMOSPHERE.fogDensity * wx.fog;

  // Physical sky (Rayleigh/Mie scattering) + stars after dusk
  const skyMix = Math.max(dayFactor, twilight * 0.18);
  sky.update(_sunDir, sunElev, nowSec, camera);

  // Fog
  scene.fog.color.copy(_C_NIGHT_FOG).lerp(_C_DAY_FOG, skyMix);

  // Tiki torches — off in daylight, glow at night
  torches.update(nowSec, dayFactor);

  // Campfire — always flickers, blazes at night; the sunset-bonfire event
  // and the "feed the fire" interaction both stoke it further
  _fireFeed = Math.max(0, _fireFeed - dt * 0.12);
  const stoke = worldEvents.getCampfireBoost() + _fireFeed * 1.2 + ritual.getBoost();
  const flicker = 0.85 + Math.sin(nowSec * 7.3) * 0.09 + Math.sin(nowSec * 13.1) * 0.06;
  campfireLight.intensity = (0.6 + (1 - dayFactor) * 2.8) * flicker * stoke;
  _campfireFlame.scale.y = (0.85 + Math.sin(nowSec * 6.1) * 0.15) * (0.7 + stoke * 0.35);
  _campfireFlame.scale.x = _campfireFlame.scale.z = 0.9 + Math.sin(nowSec * 9.7) * 0.10;
  _campfireInner.scale.y = 0.90 + Math.sin(nowSec * 11.3) * 0.10;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Micro-feel — footsteps, landing thump, speed-reactive FOV
// ─────────────────────────────────────────────────────────────────────────────
const BASE_FOV = 78;
let _prevPX = SPAWN.x, _prevPY = SPAWN.y, _prevPZ = SPAWN.z;
let _prevVY = 0, _stepAcc = 0;

function updateFeel(dt) {
  if (dt <= 0) return;
  const hSpeed = Math.hypot(playerPosition.x - _prevPX, playerPosition.z - _prevPZ) / dt;
  const vSpeed = (playerPosition.y - _prevPY) / dt;
  _prevPX = playerPosition.x; _prevPY = playerPosition.y; _prevPZ = playerPosition.z;

  // Landing thump — vertical speed snaps from a hard fall to none.
  // The -60 floor ignores the one-frame spikes caused by portal teleports.
  if (_prevVY < -10 && _prevVY > -60 && vSpeed > -1.5) {
    audio.sfx.thump(Math.min(1, -_prevVY / 26));
  }
  _prevVY = vSpeed;

  // Footsteps — cadence follows speed, voice follows the biome underfoot.
  // hSpeed < 40 skips teleport frames; |vSpeed| > 3 means airborne.
  if (hSpeed > 2 && hSpeed < 40 && Math.abs(vSpeed) <= 3 && !isOnBoat() && !isGliding()) {
    _stepAcc += hSpeed * dt;
    if (_stepAcc >= 2.9) {   // stride length in metres
      _stepAcc = 0;
      const b = biomeAt(playerPosition.x, playerPosition.z);
      audio.sfx.step(
        b === 'Icy Peaks' ? 'snow'
        : b === 'Sunset Shore' ? 'sand'
        : (b === 'Ancient Ruins' || b === 'OpenText Campus') ? 'stone'
        : 'grass');
    }
  } else if (hSpeed <= 2) {
    _stepAcc = 0;
  }

  // FOV kick — subtle wide-angle stretch at sprint and glide speeds
  const fovT = BASE_FOV
    + Math.min(1, Math.max(0, (hSpeed - 9) / 9)) * 6
    + (isGliding() ? 4 : 0);
  if (Math.abs(camera.fov - fovT) > 0.01) {
    camera.fov += (fovT - camera.fov) * Math.min(1, dt * 5);
    camera.updateProjectionMatrix();
  }
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
  emotes.showMobileBar(isMobile);
  volleyball.update(dt, playerPosition);
  geese.update(dt, playerPosition);
  npcUpdate(dt, playerPosition);
  portals.update(dt);
  ghosts.update(dt);
  biomes.update(dt, playerPosition, now / 1000);
  crystals.update(now / 1000);
  water.update(now / 1000, _sunDir, scene.fog, _dayFactor);
  interact.update(dt);
  updateBoats(now / 1000);
  glider.update(now / 1000);
  stones.update(dt);
  snowballs.update(dt);
  treasure.update(dt, now / 1000);
  tasks.update(dt);
  ritual.update(dt, now / 1000);
  race.update(dt, now / 1000);
  gosling.update(dt);
  shells.update(dt, now / 1000);
  shop.update(playerPosition);
  island.update(dt, now / 1000);
  skyIsles.update(dt, now / 1000);
  cave.update(dt, now / 1000, playerPosition);
  seasons.update(dt);
  fishing.setConditions({ night: _night, rain: weather.current().rain });
  updateFeel(dt);
  shards.update(dt, playerPosition, now / 1000);
  tablets.update(dt, now / 1000);
  nightLife.update(dt, now / 1000, playerPosition, _night);
  worldEvents.update(dt, _hourEST, _sunsetH, _night, camera);
  pois.update(dt, now / 1000, _night);
  cosmetics.update(dt);
  audio.update(dt, {
    x: playerPosition.x, z: playerPosition.z, altitude: playerPosition.y,
    biome: biomeAt(playerPosition.x, playerPosition.z),
    dayFactor: _dayFactor, night: _night, gliding: isGliding(),
    rain: weather.current().rain, windBoost: weather.current().wind,
  });
  hud.update(dt);
  multiplayer.update(dt);
  // Update counter text only when visible and only when the value changes
  if (_ucVisible) {
    const count = multiplayer.getRemotes().length + 1;
    if (count !== _prevCount) { _prevCount = count; ucNum.textContent = count; }
  }

  minimap.update();
  composer.render();
  photo.afterRender();   // must run while the frame buffer is fresh
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
