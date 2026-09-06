// Keep the requested orbit angle. Obstacles shorten the boom instead of
// lifting the camera, which would pin underground views above the ceiling.
export function createThirdPersonCamera({ cameraBlock, terrainSuppressed, groundAt, distance = 5 }) {
  let currentDistance = null;
  const position = { x: 0, y: 0, z: 0, distance };
  return {
    reset() { currentDistance = null; },
    update(x, feetY, z, yaw, pitch, dt, swimming = false) {
      const y = feetY + 1.2;
      const dx = Math.sin(yaw) * Math.cos(pitch);
      const dy = Math.sin(pitch);
      const dz = Math.cos(yaw) * Math.cos(pitch);
      // Inflate collision boxes to leave room for the camera near plane.
      const hit = cameraBlock(x, y, z, x + dx * distance, y + dy * distance, z + dz * distance, 0.2);
      let safeDistance = hit < 1 ? Math.max(0.05, distance * hit - 0.05) : distance;

      // Use the player's FEET to decide whether the surface heightmap applies.
      // No world-zero clamp: basement floors and diving can be below sea level.
      if (!swimming && !terrainSuppressed(x, z, feetY)) {
        const clearsGround = d => y + dy * d >= groundAt(x + dx * d, z + dz * d) + 0.25;
        let previous = 0;
        for (let i = 1; i <= 12; i++) {
          const sample = safeDistance * i / 12;
          if (!clearsGround(sample)) {
            let low = previous, high = sample;
            for (let j = 0; j < 6; j++) {
              const middle = (low + high) / 2;
              if (clearsGround(middle)) low = middle;
              else high = middle;
            }
            safeDistance = Math.max(0.05, low);
            break;
          }
          previous = sample;
        }
      }
      // Pull in immediately to stay out of solid geometry. Ease back out with
      // frame-rate-independent damping, so pillars and doorways don't pump the view.
      if (currentDistance === null || safeDistance < currentDistance) currentDistance = safeDistance;
      else currentDistance += (safeDistance - currentDistance) * (1 - Math.exp(-6 * dt));
      position.x = x + dx * currentDistance;
      position.y = y + dy * currentDistance;
      position.z = z + dz * currentDistance;
      position.distance = currentDistance;
      return position;
    },
  };
}
