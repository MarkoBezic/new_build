# New Build

A browser-based 3D exploration game built with Three.js and Vite.

## Run locally

- `npm install` installs dependencies.
- `npm run dev` starts development at the URL printed in the terminal.
- `npm run build` creates the production game in `dist/`.
- `npm run preview` serves that production build locally.
- `npm test` runs movement-input and notification regression tests.

Desktop browsers use captured mouse-look when supported. If capture is
rejected (including in the embedded browser), gameplay starts with right-button
drag to look. WASD moves and Escape pauses in either mode. Touch devices use
the existing virtual joystick and touch-look controls.

## Controls

WASD / arrows move; Shift sprints; Space jumps (hold while falling to use an
unlocked glider); V switches camera; E interacts; J opens the journal;
M opens the map; Escape releases mouse capture. The gear opens settings.

## Graphics

Settings apply immediately and are saved on this browser:

- **Balanced** (default): up to 1.5× resolution on desktop, 1× on touch devices,
  with shadows and nearby NPC outlines.
- **Performance**: up to 1× resolution, with shadows and outlines disabled.
- **High quality**: up to 2× resolution, with shadows and nearby NPC outlines.

The game bypasses postprocessing when outlines are not needed, refreshes
shadows by elapsed time, and skips the game/render update while the tab is hidden.
Actual frame rate depends on the device and scene; no FPS benchmark is claimed.

## Movement polish

Desktop jumping accepts a press up to 140 ms before landing and allows a
100 ms grace period after leaving a ledge. A jump consumes that grace period,
so it cannot be used for double jumps. Pausing, losing focus, and teleporting
clear queued jump input. Walking off a ledge correctly clears grounded state.

## Validation

The production build and 20 regression tests pass. Entry, avatar selection,
settings changes, and a 390 px wide layout were checked in the embedded browser.
Full mouse-look traversal still needs a playtest in a pointer-lock-capable browser.
The build currently reports a large JavaScript chunk warning.

## Basement camera

Desktop and touch share an orbit camera that respects underground floors.
Walls, floors, and the undercroft ceilings shorten the camera boom while
preserving the requested view angle. The camera eases back out after an
obstruction and hides the avatar at very short distances so it cannot fill
the view. Changing camera mode preserves the character's underground height.

For a visual regression check, run the development server and open
`/new_build/tests/camera-preview.html`. This loads the actual castle geometry
with a stationary avatar and selectable viewing angles, without requiring
pointer lock or joining multiplayer. Level, upward, and downward views were
visually checked there. Full in-game traversal still requires a regular browser.

Character selection, entry, Escape pause, resume, and camera switching were
verified in the embedded browser with the mouse-capture fallback. No runtime
errors were recorded during that check.
