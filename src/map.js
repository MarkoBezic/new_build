import { save, load } from './persistence.js';
import { makeMobileButton } from './hud.js';
import { OCEAN } from './world.config.js';

// The island map (M) — a hand-drawn-style canvas chart. Geography is always
// inked (any islander could sketch the coastline), but location markers only
// appear once you have stood there: exploration fills in the chart.

const POIS = [
  { id: 'spawn',    x: 0,    z: -165, icon: '🏕', label: 'Spawn Ring',      pre: true },
  { id: 'board',    x: 10,   z: -152, icon: '📜', label: 'Notice Board',    pre: true },
  { id: 'gate',     x: 0,    z: -130, icon: '🌀', label: 'Warp Gate' },
  { id: 'campus',   x: 0,    z: 0,    icon: '🏛', label: 'Glass Hall' },
  { id: 'pond',     x: -160, z: 20,   icon: '💧', label: 'The Pond' },
  { id: 'cave',     x: 160,  z: -20,  icon: '⛰', label: 'Hollow Hill' },
  { id: 'stones',   x: 148,  z: -20,  icon: '🎵', label: 'Singing Stones' },
  { id: 'ruins',    x: 650,  z: 150,  icon: '🏺', label: 'Ancient Ruins' },
  { id: 'icy',      x: 350,  z: -650, icon: '🏔', label: 'Icy Peaks' },
  { id: 'sky',      x: 296,  z: -540, icon: '☁️', label: 'Sky Islands' },
  { id: 'shop',     x: -482, z: 555,  icon: '🐚', label: "Moss's Shop" },
  { id: 'plinko',   x: -498, z: 542,  icon: '🪙', label: 'Shellfall' },
  { id: 'fire',     x: -465, z: 578,  icon: '🔥', label: 'Campfire' },
  { id: 'court',    x: -457, z: 597,  icon: '🏐', label: 'Volleyball' },
  { id: 'race',     x: 8,    z: -136, icon: '🏁', label: 'Meadow Circuit' },
  { id: 'wreck',    x: -440, z: 620,  icon: '⚓', label: 'Shipwreck' },
  { id: 'seacave',  x: -560, z: 700,  icon: '🕳', label: 'Sea Cave' },
  { id: 'volcano',  x: -700, z: 900,  icon: '🌋', label: 'Ember Isle' },
  { id: 'castle',   x: -120, z: -520, icon: '🏰', label: 'Northkeep Castle' },
];

const EXTENT = 1000;   // world units mapped edge-to-edge (covers Ember Isle)

export function createMap({ playerPosition, getState, isMobile }) {
  const found = new Set(load('map:found', POIS.filter(p => p.pre).map(p => p.id)));

  // ── Overlay + canvas ────────────────────────────────────────────────────────
  const wrap = document.createElement('div');
  Object.assign(wrap.style, {
    position: 'fixed', inset: '0', display: 'none', zIndex: '48',
    background: 'rgba(8,6,3,0.82)', alignItems: 'center', justifyContent: 'center',
  });
  const canvas = document.createElement('canvas');
  const SIZE = 640;
  canvas.width = canvas.height = SIZE;
  Object.assign(canvas.style, {
    width: 'min(90vw, 78vh)', height: 'min(90vw, 78vh)',
    borderRadius: '12px', border: '2px solid rgba(212,168,90,0.5)',
  });
  wrap.appendChild(canvas);
  document.body.appendChild(wrap);
  const ctx = canvas.getContext('2d');
  let open = false;

  const mx = x => ((x + EXTENT) / (EXTENT * 2)) * SIZE;
  const mz = z => ((z + EXTENT) / (EXTENT * 2)) * SIZE;

  function draw() {
    // Parchment
    ctx.fillStyle = '#E4D4AC';
    ctx.fillRect(0, 0, SIZE, SIZE);

    // Ocean — everything past the shore diagonal (z − x > coast)
    ctx.fillStyle = '#7FA8C8';
    ctx.beginPath();
    ctx.moveTo(mx(-EXTENT), mz(-EXTENT + OCEAN.coast));
    ctx.lineTo(mx(EXTENT - OCEAN.coast), mz(EXTENT));
    ctx.lineTo(mx(-EXTENT), mz(EXTENT));
    ctx.closePath();
    ctx.fill();
    // Beach strip
    ctx.strokeStyle = '#D4BC7A';
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.moveTo(mx(-EXTENT), mz(-EXTENT + OCEAN.coast - 40));
    ctx.lineTo(mx(EXTENT - OCEAN.coast + 40), mz(EXTENT));
    ctx.stroke();

    // Forest bound + biomes
    const circle = (x, z, r, fill) => {
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.arc(mx(x), mz(z), (r / (EXTENT * 2)) * SIZE, 0, Math.PI * 2);
      ctx.fill();
    };
    circle(0, 0, 920, 'rgba(116,144,84,0.35)');    // forest
    circle(0, 0, 62,  'rgba(180,208,120,0.8)');    // clearing
    circle(350, -650, 220, 'rgba(238,244,252,0.85)'); // icy
    circle(650, 150, 180, 'rgba(200,180,140,0.85)');  // ruins
    circle(-160, 20, 22, '#5D8FB8');                  // pond
    circle(-700, 900, 58, '#5A4A45');                 // Ember Isle
    circle(-700, 900, 12, '#D85A2A');                 // crater
    // Northkeep — square moat ring + keep
    ctx.strokeStyle = '#5D8FB8'; ctx.lineWidth = 4;
    ctx.strokeRect(mx(-120) - (46 / (EXTENT * 2)) * SIZE, mz(-520) - (46 / (EXTENT * 2)) * SIZE,
      (92 / (EXTENT * 2)) * SIZE, (92 / (EXTENT * 2)) * SIZE);
    ctx.fillStyle = '#9A9488';
    ctx.fillRect(mx(-134) - 1, mz(-532) - 1, (28 / (EXTENT * 2)) * SIZE, (20 / (EXTENT * 2)) * SIZE);

    // Discovered POI markers
    ctx.textAlign = 'center';
    for (const p of POIS) {
      if (!found.has(p.id)) continue;
      ctx.font = '17px serif';
      ctx.fillText(p.icon, mx(p.x), mz(p.z) + 6);
      ctx.font = '10px Georgia';
      ctx.fillStyle = '#3A2C18';
      ctx.fillText(p.label, mx(p.x), mz(p.z) + 19);
    }

    // Player arrow
    const px = mx(playerPosition.x), pz = mz(playerPosition.z);
    const ry = getState().ry + Math.PI;   // forward is −Z in world space
    ctx.save();
    ctx.translate(px, pz);
    ctx.rotate(-ry);
    ctx.fillStyle = '#C83A3A';
    ctx.beginPath();
    ctx.moveTo(0, -9); ctx.lineTo(6, 7); ctx.lineTo(-6, 7);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Title + compass
    ctx.fillStyle = '#3A2C18';
    ctx.font = 'bold 20px Georgia';
    ctx.fillText("The Warden's Island", SIZE / 2, 30);
    ctx.font = 'bold 16px Georgia';
    ctx.fillText('N ↑', SIZE - 36, 32);
    ctx.font = '11px Georgia';
    ctx.fillText(`${found.size} / ${POIS.length} places charted · M to close`, SIZE / 2, SIZE - 14);
  }

  function toggle(force) {
    open = force ?? !open;
    wrap.style.display = open ? 'flex' : 'none';
    if (open) draw();
  }

  window.addEventListener('keydown', e => {
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (e.code === 'KeyM') toggle();
    if (e.code === 'Escape') toggle(false);
  });
  wrap.addEventListener('click', () => toggle(false));

  if (isMobile) {
    makeMobileButton('🗺', { bottom: '214px', left: '20px' }, () => toggle()).style.display = 'block';
  }

  // ── Discovery + live redraw ─────────────────────────────────────────────────
  let pollT = 0, redrawT = 0;
  function update(dt) {
    pollT -= dt;
    if (pollT <= 0) {
      pollT = 1;
      let changed = false;
      for (const p of POIS) {
        if (found.has(p.id)) continue;
        if (Math.hypot(playerPosition.x - p.x, playerPosition.z - p.z) < 45) {
          found.add(p.id);
          changed = true;
        }
      }
      if (changed) save('map:found', [...found]);
    }
    if (open) {
      redrawT -= dt;
      if (redrawT <= 0) { redrawT = 0.2; draw(); }
    }
  }

  return { update };
}
