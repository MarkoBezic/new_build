// One owner for the entry, play, pause and reading-panel states.
export function createMenuState(onChange = () => {}) {
  const panels = new Map();
  let stage = 'entry', active = null;
  function change(next, id = null, data) {
    if (active) panels.get(active)?.show(false);
    active = id;
    stage = next;
    if (active) panels.get(active)?.show(true, data);
    onChange(stage, active);
  }
  return {
    get stage() { return stage; },
    get active() { return active; },
    register(id, panel) { panels.set(id, panel); },
    open(id, data) { if (stage !== 'entry' && panels.has(id)) change('panel', id, data); },
    toggle(id, data) { if (active === id && data === undefined) change('pause'); else this.open(id, data); },
    pause() { if (stage !== 'entry') change('pause'); },
    play() { change('playing'); },
    key(e) { return active ? panels.get(active)?.onKey?.(e) : false; },
  };
}
