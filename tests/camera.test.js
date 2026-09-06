import test from 'node:test';
import assert from 'node:assert/strict';
import { createThirdPersonCamera } from '../src/third-person-camera.js';
import { addStructure, cameraBlock, terrainSuppressed, resolveMove } from '../src/collision.js';

// Castle undercroft dimensions: floor -6, ceiling +4; surface at +5.
addStructure({ x: 0, z: 0, r: 100,
  floors: [{ x0:-34,x1:34,z0:-30,z1:32,top:-6 }],
  walls: [{ x0:3,x1:4,z0:-10,z1:10,y0:-6,y1:4 }],
  cameraSolids: [{ x0:-34,x1:34,z0:-30,z1:32,y0:4,y1:4.5 }],
  basements: [{ x0:-34,x1:34,z0:-30,z1:32,top:4.6 }],
});
const make = () => createThirdPersonCamera({ cameraBlock, terrainSuppressed, groundAt: () => 5 });

test('level third-person view remains at character height below world zero', () => {
  const p = make().update(0,-6,0,0,0,1/60);
  assert.equal(p.y,-4.8);
  assert.equal(p.distance,5);
});
test('normal yaw and pitch angles remain available throughout the basement', () => {
  for (const yaw of [0,Math.PI/2,Math.PI,3*Math.PI/2]) {
    for (const pitch of [-0.6,0,0.6]) {
      const p = make().update(0,-6,0,yaw,pitch,1/60);
      assert.ok(p.distance > 0.8);
      assert.ok(p.y < 0, 'camera must not snap to the surface');
      assert.ok(Math.abs((p.y+4.8)/p.distance-Math.sin(pitch)) < 1e-9);
      assert.equal(cameraBlock(0,-4.8,0,p.x,p.y,p.z,0.2),1);
    }
  }
});
test('terrain suppression uses feet even when the look-at point is above the threshold', () => {
  const p = make().update(0,4,0,Math.PI,0,1/60);
  assert.equal(p.distance,5);
  assert.equal(p.y,5.2);
});
test('camera-only ceiling blocks upward orbit without changing walking collision', () => {
  const p = make().update(0,1,0,0,1.1,1/60);
  assert.ok(p.y < 3.8);
  assert.ok(p.distance < 5);
  assert.deepEqual(resolveMove(0,0,0,1,3), {x:0,z:1});
});
test('looking upward cannot move the camera beneath the basement floor', () => {
  const p = make().update(0,-6,0,0,-1.1,1/60);
  assert.ok(p.y > -5.8);
  assert.ok(p.distance < 5);
});
test('wall retraction is immediate and recovery is gradual', () => {
  const camera = make();
  camera.update(0,-6,0,0,0,1/60);
  const close = camera.update(0,-6,0,Math.PI/2,0,1/60).distance;
  assert.ok(close < 2.8);
  const recovery = camera.update(0,-6,0,0,0,1/60).distance;
  assert.ok(recovery > close && recovery < 3.1);
  camera.reset();
  assert.equal(camera.update(0,-6,0,0,0,1/60).distance,5);
});
test('recovery speed is consistent across different frame rates', () => {
  const recover = fps => {
    const camera = make();
    camera.update(0,-6,0,Math.PI/2,0,1/fps);
    let d;
    for (let i=0;i<fps;i++) d=camera.update(0,-6,0,0,0,1/fps).distance;
    return d;
  };
  assert.ok(Math.abs(recover(30)-recover(120)) < 1e-9);
});
test('outdoor ground pulls the camera in without lifting its orbit', () => {
  const camera = createThirdPersonCamera({ cameraBlock:()=>1, terrainSuppressed:()=>false, groundAt:()=>0 });
  const p=camera.update(0,0,0,0,-0.6,1/60);
  assert.ok(p.y >= 0.25 && p.distance < 5);
  assert.ok(Math.abs((p.y-1.2)/p.distance-Math.sin(-0.6)) < 1e-9);
});
test('swimming does not restore the surface clamp', () => {
  const camera = createThirdPersonCamera({ cameraBlock:()=>1, terrainSuppressed:()=>false, groundAt:()=>0 });
  assert.equal(camera.update(0,-10,0,0,0,1/60,true).y,-8.8);
});
