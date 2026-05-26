import React, { useEffect, useMemo, useState } from 'react';

/**
 * Codex084 — Dev/admin-gated bootstrap diagnostics overlay.
 *
 * Purpose:
 *   When the host black-screens on /game after pressing OYUNU BAŞLAT but
 *   Player 2 enters fine, the only way to compare the two clients is to
 *   see exactly what state each one has during render. Console logs are
 *   not enough because mobile WebViews swallow them. This overlay shows
 *   the live bootstrap state directly on the page.
 *
 * Visibility — STRICT OPT-IN only (Codex086):
 *   - URL contains ?diag=1 (one-tap toggle on a real device), OR
 *   - localStorage.setItem('kx_diag','1') (persists across reloads)
 *
 * NOTE: Admin-auto-show and DEV-auto-show were REMOVED in Codex086 because
 * the overlay was covering the host's playable game screen during normal
 * gameplay. Now strictly opt-in.
 *
 * Strict rules followed:
 *   - UI-only. NO authority logic, NO mutations, NO writes.
 *   - Never imports Timeline/QuestionCard/updateLobbyGameState.
 *   - Removed from production via the gate above.
 */
export default function GameBootstrapDiagnostics({
  visible,
  currentUser,
  routeLobbyId,
  routeLobbyCode,
  routeStateLobbyId,
  routeStateStatus,
  routeStateRevision,
  resolvedLobbyId,
  lobbyData,
  players,
  currentPlayerIndex,
  currentQuestion,
  isOnline,
  isLoading,
  isError,
  isGameReady,
  renderStage,
  lastError,
}) {
  const [collapsed, setCollapsed] = useState(false);

  // Track when each field first became truthy so we can see the bootstrap order.
  const [timeline, setTimeline] = useState([]);
  useEffect(() => {
    if (!visible) return;
    setTimeline((prev) => {
      const next = [...prev];
      const stamp = new Date().toISOString().slice(11, 23);
      const last = next[next.length - 1]?.stage;
      if (last !== renderStage) next.push({ t: stamp, stage: renderStage });
      // Keep only last 12 entries to avoid runaway state.
      return next.slice(-12);
    });
  }, [renderStage, visible]);

  const fields = useMemo(() => ([
    ['route', window.location.pathname + window.location.search],
    ['user.email', currentUser?.email || '(none)'],
    ['routeLobbyId', routeLobbyId || '(none)'],
    ['routeLobbyCode', routeLobbyCode || '(none)'],
    ['routeState.lobbyId', routeStateLobbyId || '(none)'],
    ['routeState.status', routeStateStatus || '(none)'],
    ['routeState.revision', String(routeStateRevision ?? '(none)')],
    ['resolvedLobbyId', resolvedLobbyId || '(none)'],
    ['lobbyData?', lobbyData ? 'yes' : 'NO'],
    ['lobby.id', lobbyData?.id || '(none)'],
    ['lobby.status', lobbyData?.status || '(none)'],
    ['lobby.state_revision', String(lobbyData?.state_revision ?? '(none)')],
    ['lobby.players.count', String(players?.length || 0)],
    ['lobby.players.emails', (players || []).map(p => p?.email || '?').join(',') || '(empty)'],
    ['currentPlayerIndex', String(currentPlayerIndex ?? '(none)')],
    ['currentQuestion?', currentQuestion ? 'yes' : 'NO'],
    ['currentQuestion.id', currentQuestion?.id || '(none)'],
    ['isOnline', String(isOnline)],
    ['questions.isLoading', String(isLoading)],
    ['questions.isError', String(isError)],
    ['isGameReady', String(isGameReady)],
    ['renderStage', renderStage],
    ['lastError', lastError || '(none)'],
  ]), [
    currentUser?.email, routeLobbyId, routeLobbyCode, routeStateLobbyId,
    routeStateStatus, routeStateRevision, resolvedLobbyId, lobbyData,
    players, currentPlayerIndex, currentQuestion, isOnline, isLoading,
    isError, isGameReady, renderStage, lastError,
  ]);

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        left: 'calc(0.5rem + env(safe-area-inset-left))',
        right: 'calc(0.5rem + env(safe-area-inset-right))',
        top: 'calc(0.5rem + env(safe-area-inset-top))',
        zIndex: 99999,
        maxHeight: '60vh',
        overflow: 'auto',
        background: 'rgba(0,0,0,0.86)',
        color: '#facc15',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        fontSize: 10,
        lineHeight: 1.35,
        borderRadius: 8,
        padding: '6px 8px',
        boxShadow: '0 6px 18px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(250,204,21,0.35)',
        pointerEvents: 'auto',
      }}
      role="status"
      aria-label="Bootstrap diagnostics"
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 4,
          gap: 8,
        }}
      >
        <span style={{ color: '#fde68a', fontWeight: 'bold' }}>
          KX-DIAG {renderStage}
        </span>
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          style={{
            background: 'rgba(250,204,21,0.15)',
            color: '#facc15',
            border: '1px solid rgba(250,204,21,0.45)',
            padding: '2px 6px',
            borderRadius: 4,
            fontSize: 10,
            cursor: 'pointer',
          }}
          aria-label="Toggle diagnostics"
        >
          {collapsed ? 'expand' : 'collapse'}
        </button>
      </div>
      {!collapsed && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '1px 8px' }}>
            {fields.map(([k, v]) => (
              <React.Fragment key={k}>
                <span style={{ color: '#fcd34d' }}>{k}</span>
                <span style={{ color: '#e0f2fe', wordBreak: 'break-all' }}>{String(v)}</span>
              </React.Fragment>
            ))}
          </div>
          {timeline.length > 0 && (
            <div style={{ marginTop: 6, paddingTop: 4, borderTop: '1px dashed rgba(250,204,21,0.4)' }}>
              <span style={{ color: '#fcd34d' }}>stage timeline</span>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', color: '#e0f2fe' }}>
                {timeline.map((row, i) => (
                  <li key={i}>{row.t} → {row.stage}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Codex086 — admin role NO LONGER auto-enables the in-game overlay. Same
// reason as AppDiagnostics: it was blocking the host's gameplay because
// admins always saw it. Now strictly opt-in via ?diag=1 or localStorage.
export function isDiagnosticsEnabled(_currentUser) {
  if (typeof window === 'undefined') return false;
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('diag') === '1') return true;
  } catch (_e) { /* ignore */ }
  try {
    if (window.localStorage?.getItem('kx_diag') === '1') return true;
  } catch (_e) { /* ignore */ }
  return false;
}