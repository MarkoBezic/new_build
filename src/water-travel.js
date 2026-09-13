// Shared boat/diver state for desktop and touch players.
export function createWaterTravel() {
  return {
    boat: null,
    onBoat: false,
    swimming: false,
    hasCastOff: false,
    boardCooldown: 0,
    setSwimming(value) {
      this.swimming = !!value;
      if (this.swimming) {
        // Keep the boat as the return point, but stop its position owning the diver.
        this.onBoat = false;
        this.hasCastOff = false;
        this.boardCooldown = 1.2;
      } else {
        this.onBoat = !!this.boat;
      }
    },
    surfacePosition(fallback) {
      return this.boat ? { x: this.boat.x, z: this.boat.z } : fallback;
    },
  };
}
