import * as THREE from 'three';
import { OCEAN } from './world.config.js';

// Animated ocean — a large tessellated plane whose vertex shader runs three
// directional sine waves (Gerstner-lite) with analytic normals; the fragment
// shader mixes deep/shallow colour by wave height, adds a fresnel sky tint,
// a sun glint, and the scene's exponential fog.
//
// The plane's near edge lies along the shoreline diagonal z − x = OCEAN.coast
// and it extends past the world rim to the horizon.
export function createWater(scene) {
  const uniforms = {
    uTime:       { value: 0 },
    uSunDir:     { value: new THREE.Vector3(0.3, 0.8, 0.2) },
    uSunColor:   { value: new THREE.Color(0xFFF4D6) },
    uDeep:       { value: new THREE.Color(0x0D3E63) },
    uShallow:    { value: new THREE.Color(0x2E8FBF) },
    uSky:        { value: new THREE.Color(0xBFE3F2) },
    uDayFactor:  { value: 1 },
    uFogColor:   { value: new THREE.Color(0x5A7A48) },
    uFogDensity: { value: 0.006 },
  };

  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */`
      uniform float uTime;
      varying vec3  vWorldPos;
      varying vec3  vNormal;
      varying float vWaveH;
      varying float vFogDepth;

      // sum of 3 directional sines; returns height, accumulates derivatives
      void wave(vec2 p, vec2 dir, float freq, float amp, float speed,
                inout float h, inout vec2 grad) {
        float ph = dot(p, dir) * freq + uTime * speed;
        h    += sin(ph) * amp;
        grad += dir * (cos(ph) * amp * freq);
      }

      void main() {
        vec3 pos = position;
        float h = 0.0;
        vec2 grad = vec2(0.0);
        wave(pos.xz, normalize(vec2( 0.7,  0.7)), 0.055, 0.075, 1.15, h, grad);
        wave(pos.xz, normalize(vec2(-0.4,  0.9)), 0.110, 0.045, 1.70, h, grad);
        wave(pos.xz, normalize(vec2( 0.9, -0.2)), 0.230, 0.022, 2.60, h, grad);
        pos.y += h;

        vWaveH    = h;
        vNormal   = normalize(vec3(-grad.x, 1.0, -grad.y));
        vec4 wp   = modelMatrix * vec4(pos, 1.0);
        vWorldPos = wp.xyz;
        vec4 mv   = viewMatrix * wp;
        vFogDepth = -mv.z;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */`
      uniform vec3  uSunDir;
      uniform vec3  uSunColor;
      uniform vec3  uDeep;
      uniform vec3  uShallow;
      uniform vec3  uSky;
      uniform float uDayFactor;
      uniform vec3  uFogColor;
      uniform float uFogDensity;
      varying vec3  vWorldPos;
      varying vec3  vNormal;
      varying float vWaveH;
      varying float vFogDepth;

      void main() {
        vec3 n = normalize(vNormal);
        vec3 v = normalize(cameraPosition - vWorldPos);

        vec3 base = mix(uDeep, uShallow, clamp(vWaveH * 4.5 + 0.5, 0.0, 1.0));
        float fresnel = pow(1.0 - max(dot(v, n), 0.0), 3.0);
        vec3 col = mix(base, uSky, fresnel * 0.65);

        // Sun glint — fades out as the sun sets
        vec3 r = reflect(-normalize(uSunDir), n);
        float spec = pow(max(dot(r, v), 0.0), 70.0);
        col += uSunColor * spec * 0.9 * clamp(uSunDir.y * 4.0, 0.0, 1.0);

        // Night dimming
        col *= 0.25 + 0.75 * uDayFactor;

        float fogF = 1.0 - exp(-uFogDensity * uFogDensity * vFogDepth * vFogDepth);
        col = mix(col, uFogColor, clamp(fogF, 0.0, 1.0));
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });

  // Bake orientation into the geometry so local axes == world axes
  const geo = new THREE.PlaneGeometry(3200, 1700, 190, 100);
  geo.rotateX(-Math.PI / 2);
  geo.rotateY(-Math.PI / 4);   // long axis runs along the shoreline diagonal

  const mesh = new THREE.Mesh(geo, mat);
  // Shoreline midpoint is (−coast/2, +coast/2); push the plane seaward along
  // the diagonal's normal (−1,1)/√2 by half its width.
  const off = 1700 / 2 / Math.SQRT2 - 4;   // slight overlap onto the beach edge
  mesh.position.set(-OCEAN.coast / 2 - off, 0.12, OCEAN.coast / 2 + off);
  scene.add(mesh);

  function update(nowSec, sunDir, fog, dayFactor) {
    uniforms.uTime.value = nowSec;
    uniforms.uSunDir.value.copy(sunDir);
    uniforms.uDayFactor.value = dayFactor;
    if (fog) {
      uniforms.uFogColor.value.copy(fog.color);
      uniforms.uFogDensity.value = fog.density;
    }
  }

  return { update };
}
