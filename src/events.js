import * as THREE from 'three';

// Real-time scheduled world events — appointment mechanics on the actual
// Toronto clock. Predictable but ephemeral: the bonfire blazes around sunset
// and a meteor shower streaks the sky from 22:00–22:25 every night. Events
// concentrate players in the same place at the same time.

export function createEvents(scene) {
  // ── Event banner ────────────────────────────────────────────────────────────
  const banner = document.createElement('div');
  Object.assign(banner.style, {
    position: 'fixed', top: '70px', left: '50%', transform: 'translateX(-50%)',
    color: '#FFE0A8', font: '13px/1.5 system-ui, sans-serif',
    background: 'rgba(30,18,4,0.6)', padding: '5px 16px', borderRadius: '10px',
    border: '1px solid rgba(255,180,80,0.35)', pointerEvents: 'none',
    zIndex: '15', opacity: '0', transition: 'opacity 0.8s ease',
    textShadow: '0 1px 3px rgba(0,0,0,0.8)', whiteSpace: 'nowrap',
  });
  document.body.appendChild(banner);
  let bannerText = '';

  // ── Event clock — countdown to the next appointment ─────────────────────────
  const clock = document.createElement('div');
  Object.assign(clock.style, {
    position: 'fixed', top: '70px', left: '50%', transform: 'translateX(-50%)',
    color: '#C8BDA0', font: '12px/1.5 system-ui, sans-serif',
    background: 'rgba(0,0,0,0.35)', padding: '3px 12px', borderRadius: '8px',
    pointerEvents: 'none', zIndex: '14', textShadow: '0 1px 3px rgba(0,0,0,0.8)',
  });
  document.body.appendChild(clock);
  let clockTimer = 0, clockText = '';

  // ── Meteor pool ─────────────────────────────────────────────────────────────
  const METEORS = 6;
  const meteors = [];
  const mMat = new THREE.MeshBasicMaterial({
    color: 0xCFE8FF, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  for (let i = 0; i < METEORS; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 26), mMat.clone());
    m.visible = false;
    scene.add(m);
    meteors.push({ mesh: m, life: 0, wait: Math.random() * 3, vel: new THREE.Vector3() });
  }

  function spawnMeteor(mt, camera) {
    const a = Math.random() * Math.PI * 2;
    mt.mesh.position.set(
      camera.position.x + Math.cos(a) * (150 + Math.random() * 350),
      320 + Math.random() * 220,
      camera.position.z + Math.sin(a) * (150 + Math.random() * 350),
    );
    mt.vel.set(120 + Math.random() * 80, -170 - Math.random() * 60, 40).multiplyScalar(1);
    mt.mesh.lookAt(mt.mesh.position.clone().add(mt.vel));
    mt.mesh.rotateX(Math.PI / 2);   // align the streak with its motion
    mt.life = 1.4;
    mt.mesh.visible = true;
  }

  let bonfire = false, shower = false;

  // hourEST: fractional local hour; sunsetH: today's sunset hour
  function update(dt, hourEST, sunsetH, night, camera) {
    bonfire = hourEST > sunsetH - 0.2 && hourEST < sunsetH + 0.8;
    shower  = hourEST >= 22 && hourEST < 22.42 && night > 0.2;

    const text = shower  ? '🌠 Meteor shower — look up!'
               : bonfire ? '🔥 The sunset bonfire is lit at Sunset Shore — gather round'
               : '';
    if (text !== bannerText) {
      bannerText = text;
      if (text) banner.textContent = text;
      banner.style.opacity = text ? '1' : '0';
    }

    // Countdown line — hidden while an event banner is showing
    clockTimer -= dt;
    if (clockTimer <= 0) {
      clockTimer = 1;
      let next = '';
      if (!text) {
        const upcoming = [
          { h: (sunsetH - 0.2 + 24) % 24, label: '🔥 Sunset bonfire' },
          { h: 22, label: '🌠 Meteor shower' },
        ].map(ev => ({ ...ev, d: (ev.h - hourEST + 24) % 24 }))
          .sort((a, b) => a.d - b.d)[0];
        const hh = Math.floor(upcoming.d), mm = Math.floor((upcoming.d - hh) * 60);
        next = `${upcoming.label} in ${hh > 0 ? `${hh}h ` : ''}${mm}m`;
      }
      if (next !== clockText) {
        clockText = next;
        clock.textContent = next;
        clock.style.display = next ? 'block' : 'none';
      }
    }

    for (const mt of meteors) {
      if (mt.life > 0) {
        mt.life -= dt;
        mt.mesh.position.addScaledVector(mt.vel, dt);
        mt.mesh.material.opacity = Math.min(1, mt.life * 2.4) * 0.8 * night;
        if (mt.life <= 0) { mt.mesh.visible = false; mt.wait = 0.4 + Math.random() * 2.2; }
      } else if (shower) {
        mt.wait -= dt;
        if (mt.wait <= 0) spawnMeteor(mt, camera);
      }
    }
  }

  // Campfire flame/light multiplier during the bonfire window
  function getCampfireBoost() { return bonfire ? 1.9 : 1; }

  return { update, getCampfireBoost };
}
