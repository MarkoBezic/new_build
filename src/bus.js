// Tiny event bus — lets gameplay systems announce moments (a fish caught,
// a stone skipped) without knowing who listens (daily tasks, future stats).

const subs = {};

export const bus = {
  on(ev, fn)    { (subs[ev] ??= []).push(fn); },
  emit(ev, data) { for (const fn of subs[ev] ?? []) fn(data); },
};
