import { base44 } from '@/api/base44Client';
import { commitOnlineMatchResult } from '@/lib/dbGateway/lobbyGateway';
import { debugLog } from '@/lib/debugLog';

function toAppliedResult(data, durationSeconds) {
  if (!data?.saved) return null;
  return {
    result: data.result,
    base: Number(data.delta) || 0,
    timeBonus: 0,
    delta: Number(data.delta) || 0,
    effectiveDelta: Number(data.effectiveDelta) || 0,
    previousScore: Number(data.scoreBefore) || 0,
    nextScore: Number(data.scoreAfter) || 0,
    elapsedSeconds: Number.isFinite(Number(durationSeconds)) ? Number(durationSeconds) : null,
    floorCheckpoint: 0,
    clampedByCheckpoint: Number(data.effectiveDelta) !== Number(data.delta),
  };
}

export async function applyOnlineMatchToCurrentUser({
  lobbyId,
  durationSeconds,
  source = 'online_game',
}) {
  if (!lobbyId) {
    return { ok: false, error: 'missing_lobby', retryable: false, where: 'args' };
  }

  try {
    const response = await commitOnlineMatchResult({ lobbyId, durationSeconds, source });
    const data = response?.data || {};
    if (!data?.ok || !data?.saved) {
      return {
        ok: false,
        error: data?.error || 'online_result_not_committed',
        retryable: !['not_lobby_participant', 'invalid_guest_token'].includes(data?.code),
        where: 'backend_commit',
      };
    }

    let refreshedUser = null;
    try {
      refreshedUser = await base44.auth.me();
    } catch {
      // Guests have no auth.me profile; their backend-owned GuestProfile
      // projection is refreshed on the next normal guest profile sync.
    }

    return {
      ok: true,
      skipped: Boolean(data.alreadyApplied),
      alreadyApplied: Boolean(data.alreadyApplied),
      reason: data.alreadyApplied ? 'already_recorded' : 'backend_committed',
      applied: toAppliedResult(data, durationSeconds),
      refreshedUser,
      userPatch: data.userPatch || null,
    };
  } catch (error) {
    const data = error?.response?.data || {};
    const message = data?.error || error?.message || 'Online puan kaydedilemedi.';
    debugLog('[applyOnlineResult] backend commit failed', { lobbyId, code: data?.code || null, error: message });
    return {
      ok: false,
      error: message,
      retryable: !['not_lobby_participant', 'invalid_guest_token'].includes(data?.code),
      where: 'backend_commit',
    };
  }
}

export const onlineResultAuthorityContract = Object.freeze({
  authority: 'updateLobbyGameState:commit_result',
  clientOnlineMatchResultWrites: false,
  clientProfileScoreWrites: false,
  clientLeaderboardWrites: false,
  scoreRule: 'winner_15_loser_minus_6',
  guestSupportedWithTokenProof: true,
});
