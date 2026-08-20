import { base44 } from '@/api/base44Client';
import { getStoredGuestCredentials } from '@/lib/guestProfile';
import {
  normalizeOnlineMatchmakingMode,
  STANDARD_RANDOM_MODE,
} from '@/lib/onlineModeDisplay';

// Thin client wrapper around the Online Kapış / Duello matchmaking backend.
// Guest credentials are attached the same way lobbyGateway does; linked users
// are authenticated via the request itself.

function withActorProof(payload = {}) {
  const guest = getStoredGuestCredentials();
  return {
    ...payload,
    ...(guest?.guest_id && guest?.guest_token ? {
      guest_id: guest.guest_id,
      guest_token: guest.guest_token,
    } : {}),
  };
}

const SAFE_ERROR_SUFFIXES = new Set([
  'QUEUE_CREATE_FAILED',
  'QUEUE_READ_FAILED',
  'PAIRING_RACE',
  'SELF_MATCH_FALSE_POSITIVE',
  'STALE_QUEUE',
  'SESSION_CREATE_FAILED',
  'DIRECT_START_PAYLOAD_MISSING',
  'PERMISSION_DENIED',
  'TIMEOUT',
  'NETWORK_FAILURE',
  'UNKNOWN_START_FAILURE',
]);

const SAFE_QUEUE_ACTIONS = new Set([
  'create_waiting',
  'find_waiting',
  'pair_waiting',
  'create_match',
  'direct_start',
  'poll_status',
  'cleanup_cancel',
  'cleanup_timeout',
]);

function modePrefix(mode) {
  return normalizeOnlineMatchmakingMode(mode) === 'same_question_duel' ? 'DUELLO' : 'ONLINE';
}

function safeErrorCategory(value, mode, fallbackSuffix = 'UNKNOWN_START_FAILURE') {
  const text = String(value || '').trim().toUpperCase();
  const prefix = modePrefix(mode);
  const suffix = text.startsWith(`${prefix}_`) ? text.slice(prefix.length + 1) : '';
  return SAFE_ERROR_SUFFIXES.has(suffix) ? `${prefix}_${suffix}` : `${prefix}_${fallbackSuffix}`;
}

function safeDiagnostics(value, mode, action) {
  const source = value && typeof value === 'object' ? value : {};
  const queueAction = String(source.queueAction || action || 'find_waiting');
  return {
    modeKeySent: normalizeOnlineMatchmakingMode(source.modeKeySent || mode),
    canonicalModeKey: normalizeOnlineMatchmakingMode(source.canonicalModeKey || mode),
    queueScope: normalizeOnlineMatchmakingMode(source.queueScope || mode),
    queueAction: SAFE_QUEUE_ACTIONS.has(queueAction) ? queueAction : 'find_waiting',
    actorKind: ['guest', 'authenticated', 'unknown'].includes(source.actorKind) ? source.actorKind : 'unknown',
    selfMatchPrevented: Boolean(source.selfMatchPrevented),
    staleQueueDetected: Boolean(source.staleQueueDetected),
    matchedOpponentPublicSafe: Boolean(source.matchedOpponentPublicSafe),
    matchCreated: Boolean(source.matchCreated),
    directGamePayloadAvailable: Boolean(source.directGamePayloadAvailable),
    routeAfterMatch: source.routeAfterMatch === '/duel' ? '/duel' : '/game',
    lobbyRouteObserved: false,
    errorCategory: source.errorCategory
      ? safeErrorCategory(source.errorCategory, mode)
      : null,
  };
}

export class MatchmakingRequestError extends Error {
  constructor({ category, mode, recoverable = false, diagnostics = null }) {
    super('matchmaking_request_failed');
    this.name = 'MatchmakingRequestError';
    this.category = safeErrorCategory(category, mode);
    this.recoverable = Boolean(recoverable);
    this.diagnostics = diagnostics;
  }
}

async function invoke(action, extra = {}) {
  const mode = normalizeOnlineMatchmakingMode(extra?.mode);
  try {
    const res = await base44.functions.invoke('randomMatchmaking', withActorProof({ action, ...extra, mode }));
    const data = res?.data || res || {};
    const diagnostics = safeDiagnostics(data?.diagnostics, mode, action);
    if (data?.error) {
      const category = safeErrorCategory(data?.errorCategory || data?.diagnostics?.errorCategory, mode);
      throw new MatchmakingRequestError({
        category,
        mode,
        recoverable: category.endsWith('_PAIRING_RACE') || category.endsWith('_NETWORK_FAILURE'),
        diagnostics,
      });
    }
    return { ...data, diagnostics };
  } catch (error) {
    if (error instanceof MatchmakingRequestError) throw error;
    const data = error?.response?.data || error?.data || {};
    const status = Number(error?.response?.status || error?.status || 0);
    const fallbackSuffix = status === 401 || status === 403
      ? 'PERMISSION_DENIED'
      : status >= 500
        ? 'NETWORK_FAILURE'
        : 'UNKNOWN_START_FAILURE';
    const category = safeErrorCategory(data?.errorCategory || data?.diagnostics?.errorCategory, mode, fallbackSuffix);
    throw new MatchmakingRequestError({
      category,
      mode,
      recoverable: category.endsWith('_PAIRING_RACE') || category.endsWith('_NETWORK_FAILURE'),
      diagnostics: safeDiagnostics(data?.diagnostics, mode, action),
    });
  }
}

export const joinRandomMatchmaking = (mode = STANDARD_RANDOM_MODE) => invoke('join', {
  mode: normalizeOnlineMatchmakingMode(mode),
});
export const pollRandomMatchmaking = (mode = STANDARD_RANDOM_MODE) => invoke('poll', {
  mode: normalizeOnlineMatchmakingMode(mode),
});
export const cancelRandomMatchmaking = (mode = STANDARD_RANDOM_MODE) => invoke('cancel', {
  mode: normalizeOnlineMatchmakingMode(mode),
});
export const consumeRandomMatchmaking = (mode = STANDARD_RANDOM_MODE) => invoke('consume', {
  mode: normalizeOnlineMatchmakingMode(mode),
});
