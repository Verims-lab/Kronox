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

process.stdout.write('Online matchmaking runtime contracts: PASS (canonical modes, mode isolation, no self-match, reciprocal pair commit, active-row priority, scoped compound-filter fallback, fail-closed and permission-classified reads, expiry fallback, live-lock election).\n');
