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
M opens the map; Escape releases mouse capture. Menu → Settings opens settings. M opens one island map; K goes directly to Journal → Daily. Opening a main panel releases the cursor and stops local movement. Back or Escape returns to the pause menu; Resume exploring returns to play.

## Underwater exploration

From a boat in deep water, press Z (or tap the dive button) to dive.
Diving detaches your character from the boat so swimming does not snap you
back to its position.

- Desktop: WASD / arrows swim, mouse look steers, Space rises, Q descends,
  and Shift swims faster. Forward/backward follow your viewing angle.
- Touch: drag the left side to swim and the right side to aim, including up/down.
- Z / the dive button returns you to your original boat. Running out of air
  uses the same safe return. Your boat stays in place while you explore.

Automated checks exercise the real desktop and touch player controllers with
DOM event targets: boarding, diving, horizontal movement, desktop ascent/descent,
and returning to the boat. A physical-device underwater playtest is still needed.

## Graphics

Settings apply immediately and are saved on this browser:

- **Balanced** (default): up to 1.5× resolution on desktop, 1× on touch devices,
  with shadows and nearby NPC outlines.
- **Performance**: up to 1× resolution, with shadows and outlines disabled.
- **High quality**: up to 2× resolution, with shadows and nearby NPC outlines.

The game bypasses postprocessing when outlines are not needed, refreshes
shadows by elapsed time, and skips the game/render update while the tab is hidden.
Entry, pause and main panels freeze local simulation and render the background
at most four times per second. Multiplayer updates continue while a visible
menu is open. Ambience fades out in menus. Actual frame rate depends on the
device and scene; no FPS benchmark is claimed.

## Interface

- Avatar colour is preselected; colour and optional name are remembered locally.
- Entry hides gameplay controls. During play, Map / Journal / Menu share one bar.
- Settings, controls and photo capture live in the pause menu; P still saves photos.
- The optional minimap (including player dots) is in Settings → Navigation.
- Currency appears briefly on changes; totals remain in Journal → Records.
- Journal defaults to Beginnings on first use, remembers its tab, and lets you
  pin one suggested activity. Unread story fragments are summarized.
- Map markers cluster nearby places; the discovered-place picker exposes every
  location individually for keyboard and touch use.
- Mobile emotes expand from one button. Reading panels have explicit Back buttons.
- Scheduled events remain in Journal → Daily; the HUD announces active events
  and countdowns only within 30 minutes.

The lightweight loading shell paints before the world module evaluates. The
multiplayer module loads after entering. World construction is still synchronous;
region streaming and spatial forest batches need separate traversal/GPU profiling.

## Movement polish

Desktop jumping accepts a press up to 140 ms before landing and allows a
100 ms grace period after leaving a ledge. A jump consumes that grace period,
so it cannot be used for double jumps. Pausing, losing focus, and teleporting
clear queued jump input. Walking off a ledge correctly clears grounded state.

## Validation

The production build and 30 regression tests pass, including navigation state,
map marker grouping, movement input, camera collision and notification checks.
Desktop entry, M → J switching, K → Daily, Escape → pause and a 390 × 844
mobile-emulated entry/settings flow were checked in Chrome.

In a local development check with DevTools open, paused CPU samples dropped
from an earlier 61.8% to 5.5–6.3%, and style recalculations from 60/sec to 0/sec.
These are directional observations, not controlled benchmarks or an FPS claim.
The main game chunk is approximately 830 kB minified (242 kB gzip), plus a
separate multiplayer chunk loaded after entry. The build still warns about large
chunks. Physical-phone comfort, extended gameplay and production loading remain
to be measured.

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
