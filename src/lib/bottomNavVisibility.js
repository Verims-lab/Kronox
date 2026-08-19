// Codex103 — Lightweight pub/sub for runtime BottomNav visibility overrides.
//
// Most routes decide BottomNav visibility purely by pathname. The active
// /online page uses this override only while invite acceptance or matched
// direct-start is immersive; the Online selection surface keeps nav visible.
//
// Gameplay and backend match authority remain outside this visibility signal.

let hidden = false;
const listeners = new Set();

export function setBottomNavHidden(next) {
  const value = Boolean(next);
  if (value === hidden) return;
  hidden = value;
  listeners.forEach((fn) => {
    try { fn(hidden); } catch { /* ignore listener errors */ }
  });
}

export function getBottomNavHidden() {
  return hidden;
}

export function subscribeBottomNavHidden(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
