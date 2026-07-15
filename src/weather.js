import * as THREE from 'three';
import { dailyRng } from './daily.js';
import { toast } from './hud.js';

// Date-seeded weather — the day is split into 3-hour blocks and each block's
// weather is drawn from a seeded PRNG, so every player sees the same sky at
// the same time with zero backend. States modulate sun, fog, rain and wind;
// a rainbow arcs over the clearing when rain clears in daylight.

const STATES = {
  clear:    { label: '',                              sun: 1.00, fog: 1.0, rain: 0,   wind: 0   },
  mist:     { label: '🌫 Mist drifts through the trees…', sun: 0.85, fog: 2.6, rain: 0,   wind: 0   },
  windy:    { label: '💨 The wind is picking up…',        sun: 0.95, fog: 1.0, rain: 0,   wind: 1   },
  overcast: { label: '☁️ Clouds roll in overhead…',       sun: 0.55, fog: 1.5, rain: 0,   wind: 0.3 },
  rain:     { label: '🌧 Rain begins to fall…',           sun: 0.40, fog: 1.9, rain: 0.7, wind: 0.4 },
  storm:    { label: '⛈ A storm crashes over the island!', sun: 0.25, fog: 2.3, rain: 1,   wind: 1   },
};

// Pick a state for a 3-hour block. Mist favours the early-morning blocks.
function blockState(blockIdx) {
  const r = dailyRng(`wx${blockIdx}`)();
  const morning = blockIdx === 2 || blockIdx === 3;   // 06:00–12:00
  if (morning && r < 0.18) return 'mist';
  if (r < 0.50) return 'clear';
  if (r < 0.62) return 'windy';
  if (r < 0.80) return 'overcast';
  if (r < 0.95) return 'rain';
  return 'storm';
}

const DROPS = 900;

export function createWeather(scene) {
  // ── Rain particles — a box of drops that follows the camera ────────────────
  const pos = new Float32Array(DROPS * 3);
  const vel = new Float32Array(DROPS);
  for (let i = 0; i < DROPS; i++) {
    pos[i * 3]     = (Math.random() - 0.5) * 60;
    pos[i * 3 + 1] = Math.random() * 40 - 10;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 60;
    vel[i] = 22 + Math.random() * 8;
  }
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const rainMat = new THREE.PointsMaterial({
    color: 0xA8C8E8, size: 0.09, transparent: true, opacity: 0,
    depthWrite: false, sizeAttenuation: true,
  });
  const rain = new THREE.Points(rainGeo, rainMat);
  rain.frustumCulled = false;
  rain.visible = false;
  scene.add(rain);

  // ── Rainbow — seven nested arcs over the clearing ──────────────────────────
  const rainbow = new THREE.Group();
  const RB_COLORS = [0xE84040, 0xE89040, 0xE8D840, 0x50C850, 0x40A8E8, 0x5060D8, 0x9050C8];
  RB_COLORS.forEach((c, i) => {
    const arc = new THREE.Mesh(
      new THREE.TorusGeometry(170 - i * 3.2, 1.5, 6, 48, Math.PI),
      new THREE.MeshBasicMaterial({
        color: c, transparent: true, opacity: 0.22,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      }),
    );
    rainbow.add(arc);
  });
  rainbow.position.set(-80, 0, 120);
  rainbow.rotation.y = Math.PI / 5;
  rainbow.visible = false;
  scene.add(rainbow);
  let rainbowT = 0;

  // ── State, smoothed toward the current block's targets ─────────────────────
  let stateId  = null;
  const cur    = { sun: 1, fog: 1, rain: 0, wind: 0 };
  let announced = '';

  function update(dt, hourEST, dayFactor, camera) {
    const id = blockState(Math.floor(hourEST / 3));
    if (id !== stateId) {
      // Rain just ended in daylight → rainbow
      if (stateId && STATES[stateId].rain > 0 && STATES[id].rain === 0 && dayFactor > 0.25) {
        rainbowT = 150;
      }
      stateId = id;
      const label = STATES[id].label;
      if (label && label !== announced) { toast(label, 3500); announced = label; }
    }

    // Ease toward the block's targets so changes roll in, not pop
    const t = STATES[stateId];
    const k = Math.min(1, dt * 0.25);
    cur.sun  += (t.sun  - cur.sun)  * k;
    cur.fog  += (t.fog  - cur.fog)  * k;
    cur.rain += (t.rain - cur.rain) * k;
    cur.wind += (t.wind - cur.wind) * k;

    // Rain particles
    rain.visible = cur.rain > 0.03;
    if (rain.visible) {
      rainMat.opacity = cur.rain * 0.55;
      rain.position.set(camera.position.x, camera.position.y, camera.position.z);
      const p = rainGeo.attributes.position.array;
      const drift = cur.wind * 6;
      for (let i = 0; i < DROPS; i++) {
        p[i * 3 + 1] -= vel[i] * dt;
        p[i * 3]     += drift * dt;
        if (p[i * 3 + 1] < -25) {
          p[i * 3]     = (Math.random() - 0.5) * 60;
          p[i * 3 + 1] = 15 + Math.random() * 15;
          p[i * 3 + 2] = (Math.random() - 0.5) * 60;
        }
      }
      rainGeo.attributes.position.needsUpdate = true;
    }

    // Rainbow lifecycle — fades out over its final 20 s
    if (rainbowT > 0) {
      rainbowT -= dt;
      rainbow.visible = dayFactor > 0.2;
      const fade = Math.min(1, rainbowT / 20) * 0.22;
      rainbow.children.forEach(a => { a.material.opacity = fade; });
      if (rainbowT <= 0) rainbow.visible = false;
    }
  }

  return { update, current: () => cur, isRaining: () => cur.rain > 0.3 };
}
