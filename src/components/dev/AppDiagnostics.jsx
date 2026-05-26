/**
 * Codex085 — App/router-level diagnostics overlay.
 *
 * This sits ONE LEVEL ABOVE Game.jsx so it renders even if:
 *   - The host never actually navigates to /game (route stuck on /lobby)
 *   - Game.jsx crashes during initial render (hook error / import fail)
 *   - AnimatePresence is blocking the route transition (mode="wait" exit hang)
 *
 * It is rendered from App.jsx at the AuthenticatedApp shell level, OUTSIDE
 * the AnimatePresence wrapper so animation state cannot hide it.
 *
 * Visibility (any of these enables it):
 *   - import.meta.env.DEV
 *   - currentUser.role === 'admin'
 *   - URL param ?diag=1
 *   - localStorage.setItem('kx_diag','1')
 *
 * Updates come from `appDiagBus` (a tiny pub/sub) so any code can push
 * snapshot events without prop-drilling. See lib/appDiagBus.js.
 */
import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { subscribeAppDiag, getAppDiagSnapshot } from '@/lib/appDiagBus';

export function isAppDiagEnabled(currentUser) {
  if (typeof window === 'undefined') return false;
  try {
    if (import.meta?.env?.DEV) return true;
  } catch {
    // ignore — vite import.meta may not exist in tests
  }
  if (currentUser?.role === 'admin') return true;
  const params = new URLSearchParams(window.location.search);
  if (params.get('diag') === '1') return true;
  try {
    if (window.localStorage?.getItem('kx_diag') === '1') return true;
  } catch {
    // ignore
  }
  return false;
}

export default function AppDiagnostics({ currentUser }) {
  const location = useLocation();
  const visible = isAppDiagEnabled(currentUser);
  const [snapshot, setSnapshot] = useState(() => getAppDiagSnapshot());
  const [prevPath, setPrevPath] = useState(null);

  useEffect(() => {
    const unsub = subscribeAppDiag((next) => setSnapshot(next));
    return unsub;
  }, []);

  useEffect(() => {
    setPrevPath((p) => (p !== location.pathname ? location.pathname : p));
    // Track previous pathname AFTER the new path is observed
  }, [location.pathname]);

  if (!visible) return null;

  const blackScreenReason = deriveBlackScreenReason(snapshot, location);

  return (
    <div
      data-kx-app-diag="true"
      style={{
        position: 'fixed',
        top: 'env(safe-area-inset-top, 0px)',
        left: 0,
        right: 0,
        zIndex: 2147483647, // max z so nothing can cover it
        pointerEvents: 'none',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      }}
    >
      <div
        style={{
          margin: '4px 6px',
          padding: '6px 8px',
          background: 'rgba(0,0,0,0.78)',
          color: '#fde047',
          border: '1px solid #facc15',
          borderRadius: 6,
          fontSize: 10,
          lineHeight: 1.35,
          maxHeight: '45vh',
          overflow: 'auto',
          pointerEvents: 'auto',
        }}
      >
        <div style={{ fontWeight: 700, color: '#fff', marginBottom: 4 }}>
          KX APP DIAG · build {snapshot.buildMarker || '?'} · {blackScreenReason}
        </div>
        <Row k="path" v={location.pathname} />
        <Row k="prevPath" v={prevPath || '(initial)'} />
        <Row k="search" v={location.search || '(none)'} />
        <Row k="user" v={currentUser?.email || '(anon)'} />
        <hr style={{ borderColor: '#854d0e', margin: '4px 0' }} />
        <Row k="navTarget" v={snapshot.lastNavTarget || '—'} />
        <Row k="navPayloadKeys" v={(snapshot.lastNavPayloadKeys || []).join(',') || '—'} />
        <Row k="navAt" v={snapshot.lastNavAt || '—'} />
        <hr style={{ borderColor: '#854d0e', margin: '4px 0' }} />
        <Row k="startFired" v={String(!!snapshot.startActionFired)} />
        <Row k="startReturned" v={String(!!snapshot.startActionReturned)} />
        <Row k="startLobbyId" v={snapshot.startLobbyId || '—'} />
        <Row k="startStatus" v={snapshot.startLobbyStatus || '—'} />
        <Row k="startRevision" v={snapshot.startLobbyRevision ?? '—'} />
        <Row k="startSource" v={snapshot.startSource || '—'} />
        <hr style={{ borderColor: '#854d0e', margin: '4px 0' }} />
        <Row k="gameMounted" v={String(!!snapshot.gameMounted)} />
        <Row k="gameUnmounted" v={String(!!snapshot.gameUnmounted)} />
        <Row k="gameRenderStage" v={snapshot.gameRenderStage || '—'} />
        <Row k="gameLobbyId" v={snapshot.gameLobbyId || '—'} />
        <Row k="gameLobbyStatus" v={snapshot.gameLobbyStatus || '—'} />
        <Row k="gameLobbyRevision" v={snapshot.gameLobbyRevision ?? '—'} />
        <Row k="gamePlayersCount" v={snapshot.gamePlayersCount ?? '—'} />
        <Row k="gameCurrentQId" v={snapshot.gameCurrentQId || '—'} />
        <hr style={{ borderColor: '#854d0e', margin: '4px 0' }} />
        <Row k="lastError" v={snapshot.lastError || '—'} />
        <Row k="lastErrorWhere" v={snapshot.lastErrorWhere || '—'} />
      </div>
    </div>
  );
}

function Row({ k, v }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: 6 }}>
      <span style={{ color: '#fbbf24', opacity: 0.85 }}>{k}</span>
      <span style={{ wordBreak: 'break-all', color: '#fef3c7' }}>{String(v)}</span>
    </div>
  );
}

/**
 * Derives a single human-readable reason why the user is staring at a black
 * screen. Returns one of:
 *   route_not_changed | game_not_mounted | render_crash_before_game
 *   missing_lobby_id | missing_route_state | waiting_for_live_lobby
 *   ok | unknown
 */
function deriveBlackScreenReason(snap, location) {
  if (snap.lastErrorWhere === 'game_render') return 'render_crash_before_game';
  if (snap.lastErrorWhere === 'app_router') return 'render_crash_before_game';
  if (location.pathname === '/game') {
    if (snap.gameMounted && snap.gameRenderStage) return `ok:${snap.gameRenderStage}`;
    if (!snap.gameMounted && snap.startActionReturned) return 'game_not_mounted';
    if (!snap.gameMounted) return 'game_route_not_mounted';
  }
  if (snap.startActionReturned && location.pathname !== '/game') {
    return 'route_not_changed';
  }
  if (snap.lastNavTarget === '/game' && location.pathname !== '/game') {
    return 'route_not_changed';
  }
  if (snap.gameMounted && !snap.gameLobbyId) return 'missing_lobby_id';
  if (snap.gameMounted && !snap.gameCurrentQId) return 'waiting_for_live_lobby';
  return 'unknown';
}