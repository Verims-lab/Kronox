// Codex128 — Persist a single Online match result to the current user.
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
// FAILURE
//   Network/auth errors are swallowed and logged; gameplay never blocks
//   on the puan write.

import { base44 } from '@/api/base44Client';
import { applyOnlineMatchResult } from './onlineRanking';
import { debugLog } from './debugLog';

export async function applyOnlineMatchToCurrentUser({
  lobbyId,
  result,
  durationSeconds = 0,
}) {
  if (!lobbyId || !result) return null;
  try {
    const me = await base44.auth.me().catch(() => null);
    if (!me) return null;
    const current = me.online_progress && typeof me.online_progress === 'object'
      ? me.online_progress
      : {};
    if (current.lastMatchId && String(current.lastMatchId) === String(lobbyId)) {
      debugLog('[applyOnlineMatch] skipped (idempotent)', { lobbyId, result });
      return { skipped: true, reason: 'already_applied', progress: current };
    }
    const { progress: nextProgress, applied } = applyOnlineMatchResult(current, {
      result,
      durationSeconds,
    });
    const payload = {
      online_progress: {
        ...nextProgress,
        lastMatchId: String(lobbyId),
      },
    };
    await base44.auth.updateMe(payload);
    debugLog('[applyOnlineMatch] applied', { lobbyId, applied });
    return { skipped: false, progress: payload.online_progress, applied };
  } catch (e) {
    debugLog('[applyOnlineMatch] failed', { lobbyId, result, error: e?.message || String(e) });
    return null;
  }
}