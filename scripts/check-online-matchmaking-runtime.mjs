import assert from 'node:assert/strict';

import {
  SAME_QUESTION_DUEL_MODE,
  STANDARD_RANDOM_MODE,
  isQueueRowExpired,
  normalizeMatchmakingMode,
  selectCommittedPairingPeer,
  selectCompatibleWaitingRow,
  selectLiveLockWinner,
  selectOwnActiveQueueRow,
} from '../base44/shared/randomMatchmakingPolicy.js';
import { readMatchmakingRows } from '../base44/shared/randomMatchmakingRead.js';
import {
  FALLBACK_QUEUE_STORAGE,
  createEconomyLockQueueStore,
  resolveMatchmakingQueueStore,
} from '../base44/shared/randomMatchmakingQueueStore.js';

const now = Date.parse('2026-08-19T12:00:00.000Z');
const freshExpiry = '2026-08-19T12:00:30.000Z';
const rows = [
  { id: 'duel-a', actor_key_hash: 'actor-a', mode: SAME_QUESTION_DUEL_MODE, player_type: 'guest', status: 'waiting', created_at: '2026-08-19T11:59:58.000Z', expires_at: freshExpiry },
  { id: 'duel-b', actor_key_hash: 'actor-b', mode: SAME_QUESTION_DUEL_MODE, player_type: 'linked', status: 'waiting', created_at: '2026-08-19T11:59:59.000Z', expires_at: freshExpiry },
  { id: 'random-c', actor_key_hash: 'actor-c', mode: STANDARD_RANDOM_MODE, player_type: 'guest', status: 'waiting', created_at: '2026-08-19T11:59:57.000Z', expires_at: freshExpiry },
];

assert.equal(normalizeMatchmakingMode('same_question_duel'), SAME_QUESTION_DUEL_MODE);
assert.equal(normalizeMatchmakingMode('random_online'), STANDARD_RANDOM_MODE);
assert.equal(selectCompatibleWaitingRow(rows, 'actor-a', SAME_QUESTION_DUEL_MODE, now)?.id, 'duel-b');
assert.equal(selectCompatibleWaitingRow(rows, 'actor-b', SAME_QUESTION_DUEL_MODE, now)?.id, 'duel-a');
assert.equal(selectCompatibleWaitingRow(rows, 'actor-a', STANDARD_RANDOM_MODE, now)?.id, 'random-c');
assert.equal(selectCompatibleWaitingRow([rows[0]], 'actor-a', SAME_QUESTION_DUEL_MODE, now), null);
assert.equal(selectOwnActiveQueueRow([...rows].reverse(), 'actor-b', SAME_QUESTION_DUEL_MODE)?.id, 'duel-b');
assert.equal(isQueueRowExpired({ created_at: '2026-08-19T11:59:00.000Z' }, now), true);

const committedPair = [
  {
    id: 'pair-a',
    actor_key_hash: 'actor-a',
    paired_actor_key_hash: 'actor-b',
    lobby_id: 'shared-session',
    mode: SAME_QUESTION_DUEL_MODE,
    status: 'pairing',
    created_at: '2026-08-19T11:59:58.000Z',
    expires_at: freshExpiry,
  },
  {
    id: 'pair-b',
    actor_key_hash: 'actor-b',
    paired_actor_key_hash: 'actor-a',
    lobby_id: 'shared-session',
    mode: SAME_QUESTION_DUEL_MODE,
    status: 'pairing',
    created_at: '2026-08-19T11:59:59.000Z',
    expires_at: freshExpiry,
  },
];
assert.equal(selectCommittedPairingPeer(committedPair, committedPair[0], SAME_QUESTION_DUEL_MODE)?.id, 'pair-b');
assert.equal(selectCommittedPairingPeer(
  [{ ...committedPair[1], mode: STANDARD_RANDOM_MODE }],
  committedPair[0],
  SAME_QUESTION_DUEL_MODE,
), null);
assert.equal(selectCommittedPairingPeer(
  [{ ...committedPair[1], paired_actor_key_hash: 'actor-other' }],
  committedPair[0],
  SAME_QUESTION_DUEL_MODE,
), null);
assert.equal(selectOwnActiveQueueRow(
  [rows[0], committedPair[0]],
  'actor-a',
  SAME_QUESTION_DUEL_MODE,
)?.id, 'pair-a');

const historicalLocks = Array.from({ length: 30 }, (_, index) => ({
  id: `released-${index}`,
  status: 'released',
  acquired_at: `2026-08-19T11:58:${String(index).padStart(2, '0')}.000Z`,
  expires_at: freshExpiry,
}));
const liveLocks = [
  ...historicalLocks,
  { id: 'live-newer', status: 'active', acquired_at: '2026-08-19T11:59:59.100Z', expires_at: freshExpiry },
  { id: 'live-winner', status: 'active', acquired_at: '2026-08-19T11:59:59.000Z', expires_at: freshExpiry },
];
assert.equal(selectLiveLockWinner(liveLocks, now)?.id, 'live-winner');

const readCalls = [];
const scopedRows = await readMatchmakingRows({
  entity: {
    filter: async (query, sort) => {
      readCalls.push({ query, sort });
      if (Object.keys(query).length > 1) throw new Error('compound_filter_rejected');
      return rows;
    },
    list: async () => {
      throw new Error('broad_list_rejected');
    },
  },
  filter: { status: 'waiting', mode: SAME_QUESTION_DUEL_MODE },
  scopedFallbackFilters: [{ status: 'waiting' }],
  sort: '-created_at',
  limit: 100,
  fallbackLimit: 500,
});
assert.equal(scopedRows.strategy, 'scoped_filter_sorted');
assert.deepEqual(scopedRows.rows.map((row) => row.id), ['duel-a', 'duel-b']);
assert.deepEqual(readCalls.map((call) => call.query), [
  { status: 'waiting', mode: SAME_QUESTION_DUEL_MODE },
  { status: 'waiting' },
]);

await assert.rejects(() => readMatchmakingRows({
  entity: {
    filter: async () => {
      throw new Error('filter_rejected');
    },
    list: async () => {
      throw new Error('list_rejected');
    },
  },
  filter: { status: 'waiting', mode: STANDARD_RANDOM_MODE },
  scopedFallbackFilters: [{ status: 'waiting' }],
  sort: '-created_at',
  limit: 100,
  fallbackLimit: 500,
}), /matchmaking_read_unavailable/);

await assert.rejects(() => readMatchmakingRows({
  entity: {
    filter: async () => {
      const error = new Error('backend_rejected');
      error.response = { status: 403 };
      throw error;
    },
    list: async () => {
      throw new Error('fallback_rejected');
    },
  },
  filter: { status: 'waiting', mode: STANDARD_RANDOM_MODE },
  scopedFallbackFilters: [{ status: 'waiting' }],
  sort: '-created_at',
  limit: 100,
  fallbackLimit: 500,
}), /matchmaking_read_permission_denied/);

const fallbackLocks = [];
const fallbackEntity = {
  async filter(query) {
    return fallbackLocks.filter((row) => Object.entries(query || {}).every(([key, value]) => (
      String(row?.[key] ?? '') === String(value ?? '')
    )));
  },
  async list() {
    return [...fallbackLocks];
  },
  async get(id) {
    return fallbackLocks.find((row) => row.id === id) || null;
  },
  async create(data) {
    const row = { id: `fallback-${fallbackLocks.length + 1}`, ...data };
    fallbackLocks.push(row);
    return row;
  },
  async update(id, patch) {
    const index = fallbackLocks.findIndex((row) => row.id === id);
    assert.notEqual(index, -1);
    fallbackLocks[index] = {
      ...fallbackLocks[index],
      ...patch,
      metadata: {
        ...(fallbackLocks[index]?.metadata || {}),
        ...(patch?.metadata || {}),
      },
    };
    return fallbackLocks[index];
  },
};
const unavailablePrimary = {
  filter: async () => { throw new Error('queue_endpoint_unavailable'); },
  list: async () => { throw new Error('queue_endpoint_unavailable'); },
  get: async () => null,
  create: async () => null,
  update: async () => null,
};
const resolvedQueue = await resolveMatchmakingQueueStore({
  primaryEntity: unavailablePrimary,
  fallbackEntity,
  actorKeyHash: 'actor-a',
  mode: STANDARD_RANDOM_MODE,
});
assert.equal(resolvedQueue.strategy, FALLBACK_QUEUE_STORAGE);

const deniedFallbackEntity = {
  filter: async () => {
    const error = new Error('permission denied');
    error.status = 403;
    throw error;
  },
  list: async () => {
    const error = new Error('permission denied');
    error.status = 403;
    throw error;
  },
  get: async () => null,
  create: async () => null,
  update: async () => null,
};
await assert.rejects(() => resolveMatchmakingQueueStore({
  primaryEntity: unavailablePrimary,
  fallbackEntity: deniedFallbackEntity,
  actorKeyHash: 'actor-denied',
  mode: STANDARD_RANDOM_MODE,
}), /matchmaking_fallback_queue_permission_denied/);

const fallbackQueue = createEconomyLockQueueStore(fallbackEntity);
const fallbackA = await fallbackQueue.create({
  queue_ref: 'queue-a',
  actor_key_hash: 'actor-a',
  mode: STANDARD_RANDOM_MODE,
  player_type: 'linked',
  public_username: 'PlayerA',
  status: 'waiting',
  created_at: '2026-08-19T11:59:58.000Z',
  expires_at: freshExpiry,
});
await fallbackQueue.create({
  queue_ref: 'queue-b',
  actor_key_hash: 'actor-b',
  mode: STANDARD_RANDOM_MODE,
  player_type: 'guest',
  public_username: 'PlayerB',
  status: 'waiting',
  created_at: '2026-08-19T11:59:59.000Z',
  expires_at: freshExpiry,
});
await fallbackQueue.create({
  queue_ref: 'queue-duel',
  actor_key_hash: 'actor-c',
  mode: SAME_QUESTION_DUEL_MODE,
  player_type: 'guest',
  public_username: 'PlayerC',
  status: 'waiting',
  created_at: '2026-08-19T11:59:59.000Z',
  expires_at: freshExpiry,
});
const fallbackOnlineRows = await fallbackQueue.filter({
  status: 'waiting',
  mode: STANDARD_RANDOM_MODE,
}, '-created_at', 100);
assert.deepEqual(fallbackOnlineRows.map((row) => row.queue_ref).sort(), ['queue-a', 'queue-b']);
assert.equal(selectCompatibleWaitingRow(
  fallbackOnlineRows,
  'actor-a',
  STANDARD_RANDOM_MODE,
  now,
)?.queue_ref, 'queue-b');
const fallbackCancelled = await fallbackQueue.update(fallbackA.id, {
  status: 'cancelled',
  cancelled_at: '2026-08-19T12:00:01.000Z',
});
assert.equal(fallbackCancelled.status, 'cancelled');
assert.equal((await fallbackQueue.filter({
  actor_key_hash: 'actor-a',
  mode: STANDARD_RANDOM_MODE,
}, '-created_at', 5))[0]?.status, 'cancelled');

process.stdout.write('Online matchmaking runtime contracts: PASS (canonical modes, mode isolation, no self-match, reciprocal pair commit, active-row priority, scoped read fallback, deployed lock-store queue fallback, fail-closed permission classification, expiry, and live-lock election).\n');
