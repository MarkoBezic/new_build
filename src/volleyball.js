import * as THREE from 'three';

// Must match beach_volleyball.js exactly
const COURT_L  = 16, COURT_W = 8, NET_H = 2.43;
const POST_OUT = 1.0;
const CX = -480 + COURT_L * Math.SQRT2;   // ≈ -457.37
const CZ =  575 + COURT_L * Math.SQRT2;   // ≈ 597.63
const HL = COURT_L / 2;   // 8
const HW = COURT_W / 2;   // 4

const BALL_R     = 0.105;
const FLOOR_Y    = 0.155;  // beach surface y (matches court GY)
const GRAVITY    = -9.5;
const HIT_RANGE  = 3.0;
const COURT_NEAR = 12;     // show HUD + allow hits within this radius of court centre
const WIN_SCORE  = 5;

const INV_SQRT2 = Math.SQRT1_2;   // 1/√2 ≈ 0.707  (ROT_Y = -π/4)

// ── Coord transforms (ROT_Y = -π/4, cos = sin = ±√2/2) ───────────────────────
function worldToLocal(wx, wz) {
  const dx = wx - CX, dz = wz - CZ;
  return { lx: (dx - dz) * INV_SQRT2, lz: (dx + dz) * INV_SQRT2 };
}
function localToWorld(lx, lz) {
  return { wx: CX + (lx + lz) * INV_SQRT2, wz: CZ + (-lx + lz) * INV_SQRT2 };
}

// ── Ball mesh ─────────────────────────────────────────────────────────────────
function buildBallMesh(scene) {
  const g    = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(BALL_R, 14, 10),
    new THREE.MeshLambertMaterial({ color: 0xE85D04 }),
  );
  body.castShadow = true;
  // White seam lines
  const seams = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.SphereGeometry(BALL_R + 0.003, 7, 5)),
    new THREE.LineBasicMaterial({ color: 0xFFFFFF }),
  );
  g.add(body, seams);
  scene.add(g);
  return g;
}

// ── HUD ───────────────────────────────────────────────────────────────────────
function buildHUD() {
  const el = document.createElement('div');
  Object.assign(el.style, {
    position: 'fixed', top: '14px', left: '50%',
    transform: 'translateX(-50%)',
    background: 'rgba(0,0,0,0.58)', color: '#fff',
    padding: '5px 18px', borderRadius: '8px',
    fontFamily: 'Arial, sans-serif', fontSize: '15px',
    display: 'none', zIndex: '20', textAlign: 'center',
    pointerEvents: 'none',
  });
  document.body.appendChild(el);
  return el;
}

// ── Mobile hit button ─────────────────────────────────────────────────────────
function buildHitBtn() {
  const b = document.createElement('button');
  b.textContent = '🏐';
  Object.assign(b.style, {
    position: 'fixed', bottom: '160px', right: '20px',
    width: '64px', height: '64px', borderRadius: '50%',
    fontSize: '28px', border: 'none',
    background: 'rgba(232,93,4,0.85)', color: '#fff',
    display: 'none', zIndex: '30', cursor: 'pointer',
  });
  document.body.appendChild(b);
  return b;
}

// ── Main export ───────────────────────────────────────────────────────────────
export function createVolleyball(scene, { onBroadcast } = {}) {
  const ballMesh = buildBallMesh(scene);
  const hud      = buildHUD();
  const hitBtn   = buildHitBtn();

  // Physics state — in LOCAL court coordinates (Y is world Y)
  let lx = 0, ly = NET_H + 1.2, lz = 0;
  let vx = 0, vy = 0, vz = 0;
  let prevLx = lx;

  let scoreL     = 0, scoreR = 0;
  let inPlay     = false;
  let deadTimer  = 3.0;    // start with auto-serve after 3 s
  let serveLeft  = true;
  let nearCourt  = false;
  let canHit     = false;
  let _playerPos = { x: CX, y: FLOOR_Y, z: CZ };

  // ── Serve / score helpers ───────────────────────────────────────────────────
  function doServe(left) {
    lx = left ? -HL * 0.55 : HL * 0.55;
    lz = 0;
    ly = FLOOR_Y + 0.8;
    vx = left ? 4.8 : -4.8;
    vy = 6.2;
    vz = 0;
    prevLx  = lx;
    inPlay  = true;
    deadTimer = -1;
    if (onBroadcast) onBroadcast({ lx, ly, lz, vx, vy, vz, scoreL, scoreR, serveLeft });
  }

  function doScore(leftScores) {
    if (leftScores) scoreL++; else scoreR++;
    inPlay    = false;
    deadTimer = 2.5;
    serveLeft = leftScores;   // scorer earns the serve
    // Reset ball to hover above net centre while dead
    lx = 0; lz = 0; ly = NET_H + 1.2;
    vx = 0; vy = 0; vz = 0;
    if (onBroadcast) onBroadcast({ scored: true, scoreL, scoreR, serveLeft });
    if (scoreL >= WIN_SCORE || scoreR >= WIN_SCORE) {
      deadTimer = 5.0;
      setTimeout(() => { scoreL = 0; scoreR = 0; }, 5000);
    }
  }

  function tryHit(pPos) {
    if (!inPlay || !canHit) return;
    const { lx: plx, lz: plz } = worldToLocal(pPos.x, pPos.z);
    const dist = Math.hypot(plx - lx, pPos.y - ly, plz - lz);
    if (dist > HIT_RANGE) return;

    // Direct hit toward opposite side of net
    const hitsFromLeft = plx < 0;
    vx = (hitsFromLeft ? 1 : -1) * (3.8 + Math.random() * 1.8);
    vy = 5.0 + Math.random() * 1.5;
    vz = -lz * 1.8;   // pull toward centre line
    if (onBroadcast) onBroadcast({ lx, ly, lz, vx, vy, vz, scoreL, scoreR, serveLeft });
  }

  // ── Per-frame update ────────────────────────────────────────────────────────
  function update(dt, playerPos) {
    _playerPos = playerPos;
    const { lx: plx, lz: plz } = worldToLocal(playerPos.x, playerPos.z);
    nearCourt = Math.hypot(plx, plz) < COURT_NEAR;

    if (inPlay) {
      vy += GRAVITY * dt;

      const nlx = lx + vx * dt;
      const nly = ly + vy * dt;
      const nlz = lz + vz * dt;

      // Net collision — check sign change of lx
      if (prevLx !== 0 && Math.sign(prevLx) !== Math.sign(nlx)) {
        const frac   = Math.abs(prevLx) / (Math.abs(prevLx) + Math.abs(nlx));
        const lyCross = ly + vy * frac * dt;
        if (lyCross - BALL_R < NET_H) {
          // Ball hits net — reverse horizontal component with damping
          vx *= -0.78;
          vy *= 0.55;
          prevLx = lx;
          moveBallMesh();
          refreshHUD();
          return;
        }
      }

      // Apply movement
      lx = nlx; ly = nly; lz = nlz;
      prevLx = lx;

      // Lateral air drag
      vx *= 1 - 0.018 * dt;
      vz *= 1 - 0.018 * dt;

      // Floor / out-of-bounds
      if (ly - BALL_R <= FLOOR_Y) {
        ly = FLOOR_Y + BALL_R;
        const inBounds = Math.abs(lx) < HL && Math.abs(lz) < HW;
        const nearBounds = Math.abs(lx) < HL + 2 && Math.abs(lz) < HW + 2;
        if (nearBounds) {
          // Count as in-court landing — award point to opposite side
          doScore(lx > 0);   // ball on right side → left scores
        } else {
          // Dribble-stop far outside
          vy = -vy * 0.25;
          if (Math.abs(vy) < 0.8) doScore(lx > 0);
        }
      }

      // Very far out — kill instantly
      if (Math.abs(lx) > HL * 2.5 || Math.abs(lz) > HW * 3) doScore(lx > 0);
    } else {
      // Dead ball — hover above net with gentle bob
      ly = NET_H + 1.2 + Math.sin(performance.now() / 700) * 0.14;

      if (deadTimer > 0) {
        deadTimer -= dt;
        if (deadTimer <= 0) doServe(serveLeft);
      }
    }

    // Proximity for hit
    canHit = nearCourt && Math.hypot(plx - lx, plz - lz) < HIT_RANGE * 1.4;

    moveBallMesh();
    refreshHUD();
    hitBtn.style.display = (canHit && inPlay && 'ontouchstart' in window) ? 'block' : 'none';
  }

  function moveBallMesh() {
    const { wx, wz } = localToWorld(lx, lz);
    ballMesh.position.set(wx, ly, wz);
    if (inPlay) {
      // Spin proportional to velocity
      ballMesh.rotation.x += vz * 0.04;
      ballMesh.rotation.z -= vx * 0.04;
    }
  }

  function refreshHUD() {
    hud.style.display = nearCourt ? 'block' : 'none';
    if (!nearCourt) return;
    const win = scoreL >= WIN_SCORE || scoreR >= WIN_SCORE;
    if (win) {
      hud.textContent = scoreL > scoreR ? '🏐 Left wins! Resetting…' : '🏐 Right wins! Resetting…';
      return;
    }
    let text = `🏐  ${scoreL} — ${scoreR}`;
    if (!inPlay) {
      const secs = Math.ceil(Math.max(0, deadTimer));
      text += `   ${serveLeft ? '◀' : '▶'} serve in ${secs}s`;
    } else {
      text += `   Press V to hit`;
    }
    hud.textContent = text;
  }

  // ── Key handler ─────────────────────────────────────────────────────────────
  function onKey(e, playerPos) {
    if (e.code !== 'KeyH') return;
    if (!nearCourt) return;
    if (inPlay) {
      tryHit(playerPos);
    } else if (deadTimer <= 0) {
      doServe(serveLeft);
    }
  }

  // ── Remote state (Ably) ─────────────────────────────────────────────────────
  function handleRemoteState(data) {
    if (data.scored) {
      scoreL    = data.scoreL;
      scoreR    = data.scoreR;
      serveLeft = data.serveLeft;
      inPlay    = false;
      lx = 0; lz = 0; ly = NET_H + 1.2;
      vx = 0; vy = 0; vz = 0;
      deadTimer = 2.5;
    } else {
      lx = data.lx; ly = data.ly; lz = data.lz;
      vx = data.vx; vy = data.vy; vz = data.vz;
      scoreL    = data.scoreL    ?? scoreL;
      scoreR    = data.scoreR    ?? scoreR;
      serveLeft = data.serveLeft ?? serveLeft;
      prevLx = lx;
      inPlay = true;
      deadTimer = -1;
    }
  }

  // Mobile hit
  hitBtn.addEventListener('touchend', e => {
    e.preventDefault();
    tryHit(_playerPos);
  });

  return { update, onKey, handleRemoteState };
}
