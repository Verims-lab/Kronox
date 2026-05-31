// Codex136 — Persist a single Online match result to the current user.
//
// CALLED FROM
//   pages/Game.jsx — exactly once per match per local client, when the
//   online winner is decided. Each client persists ONLY its own user
//   record (base44.auth.updateMe), so there is no need for a server-side
//   leaderboard write: every player updates themselves from their own
//   perspective.
//
// IDEMPOTENCY
//   We store the lobby id on online_progress.lastMatchId. If the same
//   lobbyId is presented again (re-mount, StrictMode double-effect,
//   navigation race), we skip — no double-apply.
//
//   Codex136 — IMPORTANT: lastMatchId is only persisted AFTER the
//   underlying updateMe call succeeds. If persistence fails, the marker
//   is never written, so a retry is safe (the next call will go through
//   the idempotency check and proceed normally).
//
// FAILURE
//   Errors are no longer silently swallowed. The function returns a
//   structured result:
//     { ok: true, skipped: false, progress, applied }
//     { ok: true, skipped: true,  reason: 'already_applied', progress }
//     { ok: false, error: <string>, retryable: true, where: 'persist' | 'auth' }
//   Callers (Game.jsx) can surface user-visible signals when desired;
//   gameplay never blocks on the puan write.

import { base44 } from '@/api/base44Client';
import { applyOnlineMatchResult } from './onlineRanking';
import { debugLog } from './debugLog';

export async function applyOnlineMatchToCurrentUser({
  lobbyId,
  result,
  durationSeconds = 0,
}) {
  if (!lobbyId || !result) {
    return { ok: false, error: 'missing_args', retryable: false, where: 'args' };
  }

  // 1. Resolve the current user. Auth failures are retryable later (token
  //    refresh, re-login). We do NOT mark the match as applied here.
  let me = null;
  try {
    me = await base44.auth.me();
  } catch (e) {
    const msg = e?.message || String(e);
    debugLog('[applyOnlineMatch] auth.me failed', { lobbyId, error: msg });
    return { ok: false, error: msg, retryable: true, where: 'auth' };
  }
  if (!me) {
    return { ok: false, error: 'not_authenticated', retryable: true, where: 'auth' };
  }

  const current = me.online_progress && typeof me.online_progress === 'object'
    ? me.online_progress
    : {};

  // 2. Per-user idempotency. Same lobby applied previously → short-circuit.
  if (current.lastMatchId && String(current.lastMatchId) === String(lobbyId)) {
    debugLog('[applyOnlineMatch] skipped (idempotent)', { lobbyId, result });
    return { ok: true, skipped: true, reason: 'already_applied', progress: current };
  }

  // 3. Compute next snapshot (pure math; cannot throw on valid args).
  const { progress: nextProgress, applied } = applyOnlineMatchResult(current, {
    result,
    durationSeconds,
  });

  // 4. Persist. lastMatchId is added to the SAME write so it lands
  //    atomically with the score change. If updateMe rejects, the
  //    marker never lands → next attempt is safe.
  const payload = {
    online_progress: {
      ...nextProgress,
      lastMatchId: String(lobbyId),
    },
  };

  try {
    await base44.auth.updateMe(payload);
  } catch (e) {
    const msg = e?.message || String(e);
    debugLog('[applyOnlineMatch] persist failed', { lobbyId, result, error: msg });
    return { ok: false, error: msg, retryable: true, where: 'persist' };
  }

  debugLog('[applyOnlineMatch] applied', { lobbyId, applied });
  return {
    ok: true,
    skipped: false,
    progress: payload.online_progress,
    applied,
  };
}