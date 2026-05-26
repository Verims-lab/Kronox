/**
 * Codex085 — Lightweight pub/sub for App/router-level diagnostics.
 *
 * Why a bus and not React context: the diagnostics overlay must render even
 * if Game.jsx crashes during render. Context that depends on Game's tree
 * would not survive that. A module-level bus is render-independent — any
 * code (handlers, error boundaries, route components) can push events at
 * any time, and the AppDiagnostics overlay subscribes once at app root.
 *
 * Public API:
 *   pushAppDiag(partial)       — merge partial snapshot
 *   subscribeAppDiag(listener) — listener gets the merged snapshot
 *   getAppDiagSnapshot()       — current snapshot
 *   appDiagSetBuildMarker(s)   — convenience for App boot
 *
 * The bus is intentionally NOT a state store — it carries the most recent
 * observation of each field. It is only used by the diagnostics overlay.
 */

const _state = {
  buildMarker: null,

  // Navigation lifecycle
  lastNavTarget: null,         // e.g. '/game'
  lastNavPayloadKeys: [],      // keys of options.state passed to navigate(...)
  lastNavAt: null,             // ISO timestamp

  // WaitingRoom start action
  startActionFired: false,
  startActionReturned: false,
  startLobbyId: null,
  startLobbyStatus: null,
  startLobbyRevision: null,
  startSource: null,           // 'live-refetch' | 'function-response' | …

  // Game route mount lifecycle
  gameMounted: false,
  gameUnmounted: false,
  gameRenderStage: null,
  gameLobbyId: null,
  gameLobbyStatus: null,
  gameLobbyRevision: null,
  gamePlayersCount: null,
  gameCurrentQId: null,

  // Last caught error (from boundary or handler)
  lastError: null,
  lastErrorWhere: null,        // 'game_render' | 'app_router' | 'handle_start' | …
};

const _listeners = new Set();

export function pushAppDiag(partial) {
  if (!partial || typeof partial !== 'object') return;
  Object.assign(_state, partial);
  for (const fn of _listeners) {
    try { fn({ ..._state }); } catch { /* ignore listener errors */ }
  }
}

export function subscribeAppDiag(listener) {
  _listeners.add(listener);
  // Push current state immediately so the overlay paints on subscribe
  try { listener({ ..._state }); } catch { /* ignore */ }
  return () => _listeners.delete(listener);
}

export function getAppDiagSnapshot() {
  return { ..._state };
}

export function appDiagSetBuildMarker(marker) {
  pushAppDiag({ buildMarker: marker });
}