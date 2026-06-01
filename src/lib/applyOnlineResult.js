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
//   Codex139 adds OnlineMatchResult as the durable idempotency source for
//   older lobby reopens: one logical result row per player_email + lobby_id.
//   lastMatchId remains as a same-session/recent-match guard.
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

const ONLINE_MATCH_RESULT_ENTITY = 'OnlineMatchResult';

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function isMissingOnlineMatchResultEntityError(error) {
  const message = String(error?.message || error || '');
  return message.includes(`Entity schema ${ONLINE_MATCH_RESULT_ENTITY} not found`) ||
    message.includes(`${ONLINE_MATCH_RESULT_ENTITY} not found`) ||
    message.includes(`schema ${ONLINE_MATCH_RESULT_ENTITY}`);
}

async function findExistingOnlineMatchResult({ lobbyId, playerEmail }) {
  if (!lobbyId || !playerEmail) return { supported: true, row: null };
  if (!base44.entities?.OnlineMatchResult?.filter) {
    return { supported: false, row: null, error: 'entity_client_unavailable' };
  }
  try {
    const rows = await base44.entities.OnlineMatchResult.filter(
      { lobby_id: String(lobbyId), player_email: playerEmail },
      '-applied_at',
      1,
    );
    return { supported: true, row: rows?.[0] || null };
  } catch (error) {
    if (isMissingOnlineMatchResultEntityError(error)) {
      debugLog('[applyOnlineMatch] OnlineMatchResult entity unavailable; falling back to lastMatchId only', {
        lobbyId,
        playerEmail,
      });
      return { supported: false, row: null, error };
    }
    throw error;
  }
}

async function createOnlineMatchResult({
  lobbyId,
  playerEmail,
  opponentEmail = '',
  result,
  durationSeconds,
  source = 'client_game_result',
  applied,
}) {
  if (!lobbyId || !playerEmail || !applied) return { persisted: false, skipped: 'missing_audit_args' };
  const now = new Date().toISOString();
  const payload = {
    lobby_id: String(lobbyId),
    player_email: playerEmail,
    opponent_email: normalizeEmail(opponentEmail),
    result,
    delta: Number(applied.delta) || 0,
    effective_delta: Number(applied.effectiveDelta) || 0,
    score_before: Number(applied.previousScore) || 0,
    score_after: Number(applied.nextScore) || 0,
    elapsed_seconds: Number.isFinite(Number(durationSeconds)) ? Number(durationSeconds) : undefined,
    checkpoint_before: Number(applied.floorCheckpoint) || 0,
    checkpoint_after: Number(applied.peakCheckpoint) || 0,
    applied_at: now,
    created_at: now,
    source,
    metadata: {
      clampedByCheckpoint: Boolean(applied.clampedByCheckpoint),
      peakScore: Number(applied.peakScore) || 0,
    },
  };

  try {
    const existing = await findExistingOnlineMatchResult({ lobbyId, playerEmail });
    if (existing.row?.id) return { persisted: true, row: existing.row, skipped: 'already_recorded' };
    if (existing.supported === false) return { persisted: false, skipped: 'entity_unavailable' };
    if (!base44.entities?.OnlineMatchResult?.create) {
      return { persisted: false, skipped: 'entity_client_unavailable' };
    }
    const row = await base44.entities.OnlineMatchResult.create(payload);
    return { persisted: true, row };
  } catch (error) {
    if (isMissingOnlineMatchResultEntityError(error)) {
      return { persisted: false, skipped: 'entity_unavailable' };
    }
    return { persisted: false, error: error?.message || String(error) };
  }
}

export async function applyOnlineMatchToCurrentUser({
  lobbyId,
  result,
  durationSeconds = 0,
  opponentEmail = '',
  source = 'client_game_result',
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
  const playerEmail = normalizeEmail(me.email);

  const current = me.online_progress && typeof me.online_progress === 'object'
    ? me.online_progress
    : {};

  // 2a. Durable per-user/lobby idempotency. This catches older lobby
  //     reopens even after lastMatchId has moved on to a newer match.
  let existingResult = { supported: false, row: null };
  try {
    existingResult = await findExistingOnlineMatchResult({ lobbyId, playerEmail });
  } catch (e) {
    const msg = e?.message || String(e);
    debugLog('[applyOnlineMatch] OnlineMatchResult lookup failed', { lobbyId, error: msg });
    return { ok: false, error: msg, retryable: true, where: 'online_match_result_lookup' };
  }
  if (existingResult.row?.id) {
    debugLog('[applyOnlineMatch] skipped (OnlineMatchResult exists)', { lobbyId, result });
    return {
      ok: true,
      skipped: true,
      reason: 'already_recorded',
      progress: current,
      onlineMatchResult: existingResult.row,
    };
  }

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
  const onlineMatchResult = await createOnlineMatchResult({
    lobbyId,
    playerEmail,
    opponentEmail,
    result,
    durationSeconds,
    source,
    applied,
  });
  if (!onlineMatchResult.persisted) {
    debugLog('[applyOnlineMatch] OnlineMatchResult audit row not persisted', {
      lobbyId,
      reason: onlineMatchResult.skipped || onlineMatchResult.error || 'unknown',
    });
  }

  return {
    ok: true,
    skipped: false,
    progress: payload.online_progress,
    applied,
    onlineMatchResult,
  };
}
