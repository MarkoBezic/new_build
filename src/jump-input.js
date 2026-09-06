// A brief grace period at ledges and a queued press just before landing.
export function createJumpInput() {
  let buffered = 0;
  let grace = 0;
  return {
    press() { buffered = 0.14; },
    update(dt, grounded) {
      buffered = Math.max(0, buffered - dt);
      grace = grounded ? 0.1 : Math.max(0, grace - dt);
    },
    consume() {
      if (buffered <= 0 || grace <= 0) return false;
      buffered = 0;
      grace = 0;
      return true;
    },
    reset() { buffered = 0; grace = 0; },
  };
}
