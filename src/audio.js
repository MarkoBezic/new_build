// Fully procedural soundscape — WebAudio only, zero asset files.
// Ambient beds: wind (rises with altitude, howls in the Icy Peaks), ocean
// wash near the shore, campfire crackle. Day birdsong and night crickets.
// One-shot SFX for shards, tablets, portals, interactions and unlocks.

const SHORE = 1100;                    // z − x of the waterline
const FIRE  = { x: -465, z: 578 };     // beach campfire

export function createAudio() {
  const AC  = window.AudioContext || window.webkitAudioContext;
  const ctx = new AC();
  let muted = false;

  const master = ctx.createGain();
  master.gain.value = 0.5;
  master.connect(ctx.destination);

  // Browsers gate audio behind a user gesture — resume on the first input
  const resume = () => { if (ctx.state === 'suspended') ctx.resume(); };
  window.addEventListener('pointerdown', resume);
  window.addEventListener('keydown', resume);

  // ── Shared noise buffer (2 s of white noise, looped by every bed) ──────────
  const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  {
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }

  function makeBed(type, freq, q) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf; src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = type; filter.frequency.value = freq; filter.Q.value = q;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    src.connect(filter); filter.connect(gain); gain.connect(master);
    src.start();
    return { gain, filter, target: 0 };
  }

  const wind  = makeBed('bandpass', 500, 0.6);
  const waves = makeBed('lowpass',  420, 0.8);
  const fire  = makeBed('bandpass', 2600, 1.2);
  const rain  = makeBed('lowpass', 1400, 0.4);

  // ── One-shot helpers ───────────────────────────────────────────────────────
  function tone(freq, dur, { type = 'sine', vol = 0.25, when = 0 } = {}) {
    if (muted) return;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    o.type = type; o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur);
  }

  function noiseBurst(dur, freq, { type = 'lowpass', vol = 0.3, sweepTo = 0, when = 0 } = {}) {
    if (muted) return;
    const t = ctx.currentTime + when;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.setValueAtTime(freq, t);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t); src.stop(t + dur);
  }

  const sfx = {
    // Crystal shard pickup — bright two-partial chime
    chime(step = 0) {
      const f = 880 * Math.pow(2, step / 12);
      tone(f, 1.2, { vol: 0.22 });
      tone(f * 2.01, 0.9, { vol: 0.10 });
    },
    // Deep bell — the ruins rune, the spirit
    bell() {
      tone(220, 2.6, { vol: 0.28 });
      tone(220 * 2.76, 1.8, { vol: 0.10 });
      tone(220 * 5.4, 0.8, { vol: 0.05 });
    },
    // Portal warp — filtered noise sweep
    whoosh() {
      noiseBurst(0.9, 260, { type: 'bandpass', vol: 0.4, sweepTo: 2400 });
      noiseBurst(0.8, 2400, { type: 'bandpass', vol: 0.25, sweepTo: 220, when: 0.35 });
    },
    // Small interactions
    plink()  { tone(1320, 0.35, { vol: 0.18 }); tone(1980, 0.25, { vol: 0.08, when: 0.05 }); },
    splash() { noiseBurst(0.5, 900, { vol: 0.3, sweepTo: 250 }); },
    grind()  { noiseBurst(0.6, 220, { vol: 0.35, sweepTo: 120 }); },
    // Unlock fanfare — rising arpeggio
    fanfare() {
      [0, 4, 7, 12].forEach((s, i) => tone(523 * Math.pow(2, s / 12), 0.8, { vol: 0.2, when: i * 0.13 }));
    },
    // Footsteps — filtered noise taps voiced per surface
    step(kind = 'grass') {
      if (kind === 'snow')       noiseBurst(0.10, 1500, { type: 'bandpass', vol: 0.10, sweepTo: 600 });
      else if (kind === 'sand')  noiseBurst(0.12, 420,  { vol: 0.09, sweepTo: 200 });
      else if (kind === 'stone') noiseBurst(0.05, 1600, { vol: 0.07, sweepTo: 900 });
      else                       noiseBurst(0.08, 600,  { vol: 0.07, sweepTo: 300 });
    },
    // Snowball / packed-snow impact
    splat() { noiseBurst(0.22, 1300, { vol: 0.3, sweepTo: 280 }); },
    // Landing impact — weight scales with fall speed (i in 0..1)
    thump(i = 1) { noiseBurst(0.16, 170 + 90 * i, { vol: 0.10 + 0.22 * i, sweepTo: 85 }); },
    // Something small leaves the hand at speed
    whiff() { noiseBurst(0.14, 700, { type: 'bandpass', vol: 0.12, sweepTo: 2000 }); },
    // Camera shutter — two tight clicks
    shutter() {
      tone(2400, 0.03, { type: 'square', vol: 0.10 });
      tone(1700, 0.04, { type: 'square', vol: 0.08, when: 0.05 });
    },
    // A tiny gosling peep
    peep() {
      tone(640, 0.09, { type: 'triangle', vol: 0.06 });
      tone(520, 0.10, { type: 'triangle', vol: 0.04, when: 0.11 });
    },
    // A singing stone — pure tone with a shimmering octave
    note(freq, vol = 0.22) {
      tone(freq, 1.5, { vol });
      tone(freq * 2.005, 0.9, { vol: vol * 0.35 });
    },
  };

  // ── Wildlife + thunder schedulers ──────────────────────────────────────────
  let birdTimer = 4, cricketTimer = 0.5, thunderTimer = 6;

  function thunderRumble() {
    noiseBurst(2.4, 95, { vol: 0.5, sweepTo: 42 });
    noiseBurst(1.4, 240, { vol: 0.18, sweepTo: 70, when: 0.15 });
  }

  function birdChirp() {
    const base = 2200 + Math.random() * 1200;
    const n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      tone(base * (1 + Math.random() * 0.15), 0.12, { type: 'triangle', vol: 0.05, when: i * 0.14 });
    }
  }

  function cricketPulse() {
    tone(4300 + Math.random() * 300, 0.06, { type: 'square', vol: 0.012 });
    tone(4300, 0.06, { type: 'square', vol: 0.010, when: 0.09 });
  }

  // ── Per-frame ambience mix ─────────────────────────────────────────────────
  // s = { x, z, altitude, biome, dayFactor, night }
  function update(dt, s) {
    if (ctx.state !== 'running') return;

    const icy = s.biome === 'Icy Peaks' ? 1 : 0;
    // Wind is silent at ground level (a constant 0.045 floor here was heard
    // as permanent white-noise hiss) — it fades in with altitude, the peaks,
    // and gliding, and stays out of the mix everywhere else.
    wind.target = Math.min(0.14, 0.01 + Math.max(0, s.altitude - 8) * 0.003 + icy * 0.06)
                + (s.gliding ? 0.10 : 0);
    wind.filter.frequency.value = 450 + s.altitude * 8 + icy * 250 + (s.gliding ? 350 : 0);

    const shoreDist = Math.max(0, SHORE - (s.z - s.x));       // 0 at waterline
    const wavesNear = Math.max(0, 1 - shoreDist / 260);
    waves.target = wavesNear * wavesNear * 0.22
                 + 0.10 * Math.max(0, Math.sin(performance.now() / 1000 * 0.55)) * wavesNear;

    const fireDist = Math.hypot(s.x - FIRE.x, s.z - FIRE.z);
    fire.target = fireDist < 20
      ? (1 - fireDist / 20) * (0.10 + Math.random() * 0.14)   // random crackle spikes
      : 0;

    // Weather beds — rain hiss scales with intensity, wind rises in gusty blocks
    rain.target  = (s.rain ?? 0) * 0.24;
    wind.target += (s.windBoost ?? 0) * 0.06;

    for (const bed of [wind, waves, fire, rain]) {
      const t = muted ? 0 : bed.target;
      bed.gain.gain.value += (t - bed.gain.gain.value) * Math.min(1, dt * 3);
    }

    if (!muted) {
      if (s.dayFactor > 0.35 && s.biome !== 'Open Water' && icy === 0 && (s.rain ?? 0) < 0.3 && s.altitude > 0) {
        birdTimer -= dt;
        if (birdTimer <= 0) { birdTimer = 4 + Math.random() * 9; birdChirp(); }
      }
      if (s.night > 0.5 && wavesNear < 0.5 && icy === 0 && (s.rain ?? 0) < 0.3) {
        cricketTimer -= dt;
        if (cricketTimer <= 0) { cricketTimer = 0.35 + Math.random() * 0.5; cricketPulse(); }
      }
      // Distant thunder during storms
      if ((s.rain ?? 0) >= 0.85) {
        thunderTimer -= dt;
        if (thunderTimer <= 0) { thunderTimer = 9 + Math.random() * 18; thunderRumble(); }
      }
    }
  }

  function toggleMute() {
    muted = !muted;
    return muted;
  }

  return { update, sfx, toggleMute };
}
