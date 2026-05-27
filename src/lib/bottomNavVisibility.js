// Codex103 — Lightweight pub/sub for runtime BottomNav visibility overrides.
//
// Most routes decide BottomNav visibility purely by pathname (see HIDDEN_ROUTES
// in components/layout/BottomNav.jsx). But /lobby is a single route that hosts
// multiple sub-states:
//   - mode=null      → Online Kapışma seçim ekranı (nav VISIBLE)
//   - mode=create    → Lobi oluşturma akışı       (nav HIDDEN)
//   - mode=join      → Lobiye katılma akışı       (nav HIDDEN)
//   - waiting room   → Gerçek lobby               (nav HIDDEN)
//
// LobbyRoom signals these sub-states via setBottomNavHidden(true|false) and
// BottomNav subscribes to the changes. No global state library, no context
// rewiring, no refactor — just a tiny event bus.
//
// IMPORTANT: This does NOT touch lobby flow, invite logic, tutorial state,
// notification routing, drag/drop, timeline, or any game logic.

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