import { normalizeMatchmakingMode } from './randomMatchmakingPolicy.js';
import {
  matchesExactMatchmakingFilter,
  readMatchmakingRows,
} from './randomMatchmakingRead.js';

export const PRIMARY_QUEUE_STORAGE = 'random_match_queue';
export const FALLBACK_QUEUE_STORAGE = 'economy_lock_queue';

const FALLBACK_QUEUE_KIND = 'random_matchmaking_queue';
const FALLBACK_OPERATION_SCOPE = 'random_matchmaking_pair';
const ACTIVE_QUEUE_STATUSES = new Set(['waiting', 'pairing', 'matched']);
const TERMINAL_QUEUE_STATUS_TO_LOCK_STATUS = Object.freeze({
  cancelled: 'released',
  consumed: 'released',
  expired: 'stale',
});

const rowId = (row) => row?.id || row?._id || '';

const rowsFromResult = (value) => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  return null;
};

const isPermissionFailure = (error) => {
  const status = Number(error?.status || error?.response?.status || 0);
  const message = String(error?.message || '').toLowerCase();
  return status === 401
    || status === 403
    || message.includes('permission')
    || message.includes('forbidden')
    || message.includes('unauthorized');
};

const fallbackLockKey = (actorKeyHash, mode) => (
  `random_matchmaking:queue:${normalizeMatchmakingMode(mode)}:${String(actorKeyHash || '')}`
);

export function fallbackQueueRowFromLock(lock) {
  const metadata = lock?.metadata && typeof lock.metadata === 'object' ? lock.metadata : {};
  if (metadata.kind !== FALLBACK_QUEUE_KIND) return null;
  const id = rowId(lock);
  return {
    id,
    _id: id,
    queue_ref: String(metadata.queue_ref || lock?.operation_id || ''),
    actor_key_hash: String(lock?.actor_key || ''),
    mode: normalizeMatchmakingMode(metadata.mode),
    player_type: String(metadata.player_type || ''),
    kronox_user_id: String(metadata.kronox_user_id || ''),
    public_username: String(metadata.public_username || ''),
    status: String(metadata.queue_status || 'waiting'),
    lobby_id: String(metadata.lobby_id || ''),
    lobby_public_ref: String(metadata.lobby_public_ref || ''),
    lobby_code: String(metadata.lobby_code || ''),
    is_host: Boolean(metadata.is_host),
    paired_actor_key_hash: String(metadata.paired_actor_key_hash || ''),
    created_at: metadata.created_at || lock?.acquired_at || null,
    expires_at: metadata.expires_at || lock?.expires_at || null,
    matched_at: metadata.matched_at || null,
    cancelled_at: metadata.cancelled_at || null,
    consumed_at: metadata.consumed_at || null,
  };
}

const fallbackMetadata = (row) => ({
  kind: FALLBACK_QUEUE_KIND,
  queue_ref: String(row?.queue_ref || ''),
  queue_status: String(row?.status || 'waiting'),
  mode: normalizeMatchmakingMode(row?.mode),
  player_type: String(row?.player_type || ''),
  kronox_user_id: String(row?.kronox_user_id || ''),
  public_username: String(row?.public_username || ''),
  lobby_id: String(row?.lobby_id || ''),
  lobby_public_ref: String(row?.lobby_public_ref || ''),
  lobby_code: String(row?.lobby_code || ''),
  is_host: Boolean(row?.is_host),
  paired_actor_key_hash: String(row?.paired_actor_key_hash || ''),
  created_at: row?.created_at || null,
  expires_at: row?.expires_at || null,
  matched_at: row?.matched_at || null,
  cancelled_at: row?.cancelled_at || null,
  consumed_at: row?.consumed_at || null,
});

const fallbackLockStatus = (queueStatus) => (
  ACTIVE_QUEUE_STATUSES.has(queueStatus)
    ? 'active'
    : (TERMINAL_QUEUE_STATUS_TO_LOCK_STATUS[queueStatus] || 'released')
);

const compareQueueRows = (left, right, sort = '-created_at') => {
  const descending = String(sort || '').startsWith('-');
  const field = String(sort || 'created_at').replace(/^-/, '');
  const leftValue = String(left?.[field] || '');
  const rightValue = String(right?.[field] || '');
  const compared = leftValue.localeCompare(rightValue);
  return descending ? -compared : compared;
};

const uniqueQueries = (queries) => {
  const seen = new Set();
  return queries.filter((query) => {
    const key = JSON.stringify(Object.entries(query || {}).sort(([left], [right]) => left.localeCompare(right)));
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

async function readFallbackLocks(entity, query = {}, sort = '-acquired_at', limit = 100) {
  const actorKeyHash = String(query?.actor_key_hash || '');
  const canonicalMode = normalizeMatchmakingMode(query?.mode);
  const backendLimit = Math.max(25, Math.min(250, Number(limit) || 100));
  const backendQueries = uniqueQueries([
    ...(actorKeyHash && query?.mode
      ? [{ lock_key: fallbackLockKey(actorKeyHash, canonicalMode) }]
      : []),
    ...(actorKeyHash ? [{ actor_key: actorKeyHash }] : []),
    { operation_scope: FALLBACK_OPERATION_SCOPE },
  ]);
  let permissionDenied = false;

  for (const backendQuery of backendQueries) {
    for (const backendSort of ['-acquired_at', undefined]) {
      try {
        const result = await entity.filter(backendQuery, backendSort, backendLimit);
        const locks = rowsFromResult(result);
        if (locks) {
          return locks
            .map(fallbackQueueRowFromLock)
            .filter(Boolean)
            .filter((row) => matchesExactMatchmakingFilter(row, query))
            .sort((left, right) => compareQueueRows(left, right, sort))
            .slice(0, Number(limit) || 100);
        }
      } catch (error) {
        permissionDenied = permissionDenied || isPermissionFailure(error);
      }
    }
  }

  for (const backendSort of ['-acquired_at', undefined]) {
    try {
      const result = await entity.list(backendSort, backendLimit);
      const locks = rowsFromResult(result);
      if (locks) {
        return locks
          .map(fallbackQueueRowFromLock)
          .filter(Boolean)
          .filter((row) => matchesExactMatchmakingFilter(row, query))
          .sort((left, right) => compareQueueRows(left, right, sort))
          .slice(0, Number(limit) || 100);
      }
    } catch (error) {
      permissionDenied = permissionDenied || isPermissionFailure(error);
    }
  }

  throw new Error(permissionDenied
    ? 'matchmaking_fallback_queue_permission_denied'
    : 'matchmaking_fallback_queue_unavailable');
}

export function createEconomyLockQueueStore(entity) {
  if (!entity?.filter || !entity?.list || !entity?.get || !entity?.create || !entity?.update) {
    throw new Error('matchmaking_fallback_queue_store_unavailable');
  }
  return {
    filter: (query, sort, limit) => readFallbackLocks(entity, query, sort, limit),
    list: (sort, limit) => readFallbackLocks(entity, {}, sort, limit),
    async get(id) {
      const lock = await entity.get(id);
      return fallbackQueueRowFromLock(lock);
    },
    async create(data) {
      const queueRef = String(data?.queue_ref || '');
      const actorKeyHash = String(data?.actor_key_hash || '');
      const mode = normalizeMatchmakingMode(data?.mode);
      const createdAt = data?.created_at || new Date().toISOString();
      const row = {
        ...data,
        queue_ref: queueRef,
        actor_key_hash: actorKeyHash,
        mode,
        status: data?.status || 'waiting',
        created_at: createdAt,
      };
      const lock = await entity.create({
        lock_key: fallbackLockKey(actorKeyHash, mode),
        actor_key: actorKeyHash,
        operation_scope: FALLBACK_OPERATION_SCOPE,
        operation_id: queueRef,
        status: fallbackLockStatus(row.status),
        acquired_at: createdAt,
        expires_at: row.expires_at,
        metadata: fallbackMetadata(row),
      });
      return fallbackQueueRowFromLock(lock) || { ...row, id: rowId(lock), _id: rowId(lock) };
    },
    async update(id, patch) {
      const lock = await entity.get(id);
      const current = fallbackQueueRowFromLock(lock);
      if (!current) throw new Error('matchmaking_fallback_queue_row_missing');
      const merged = { ...current, ...(patch || {}) };
      const terminal = !ACTIVE_QUEUE_STATUSES.has(merged.status);
      const updated = await entity.update(id, {
        status: fallbackLockStatus(merged.status),
        expires_at: merged.expires_at || lock?.expires_at,
        ...(terminal ? { released_at: new Date().toISOString() } : {}),
        metadata: fallbackMetadata(merged),
      });
      return fallbackQueueRowFromLock(updated) || { ...merged, id, _id: id };
    },
  };
}

export async function resolveMatchmakingQueueStore({
  primaryEntity,
  fallbackEntity,
  actorKeyHash,
  mode,
}) {
  if (primaryEntity?.filter && primaryEntity?.list && primaryEntity?.get && primaryEntity?.create && primaryEntity?.update) {
    try {
      await readMatchmakingRows({
        entity: primaryEntity,
        filter: { actor_key_hash: actorKeyHash, mode: normalizeMatchmakingMode(mode) },
        scopedFallbackFilters: [{ actor_key_hash: actorKeyHash }],
        sort: '-created_at',
        limit: 5,
        fallbackLimit: 25,
      });
      return { entity: primaryEntity, strategy: PRIMARY_QUEUE_STORAGE };
    } catch {
      // The deployed queue endpoint can lag source schema changes. Continue
      // with the existing backend-private lock entity instead of failing a
      // valid player admission with a server error.
    }
  }

  const fallbackStore = createEconomyLockQueueStore(fallbackEntity);
  await fallbackStore.filter({
    actor_key_hash: actorKeyHash,
    mode: normalizeMatchmakingMode(mode),
  }, '-created_at', 5);
  return { entity: fallbackStore, strategy: FALLBACK_QUEUE_STORAGE };
}
