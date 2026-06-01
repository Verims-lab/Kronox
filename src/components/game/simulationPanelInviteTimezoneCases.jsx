// Codex138 — Invite timezone parse regression suite.
//
// Bug shown in the WhatsApp video: a GameInvite created at 14:33:11 UTC
// was flipped to `status: 'expired'` at 14:33:13 UTC — ~1.6 seconds after
// creation. Root cause: Base44 sometimes serializes `created_date` WITHOUT
// a timezone suffix (e.g. "2026-05-31T14:33:11.992000"). `new Date()` on
// such a naive string is treated as LOCAL time. On Europe/Istanbul (UTC+3)
// the parsed instant lands 3 hours before the true UTC moment, so
// `created + 10min` is ~2h50m in the past and the client (and Deno
// server) incorrectly believes the invite expired.
//
// The fix appends `Z` to naive ISO strings before parsing, in three
// places: lib/gameInviteSelectors.js (client), functions/acceptGameInvite,
// and functions/sendGameInvitePush. The GameInvite entity schema also
// gained `created_at`/`expires_at`/`expired_at`/`accepted_at`/`declined_at`/
// `completed_at` so client-set timestamps stop getting silently dropped.
//
// Cases here lock those invariants executable + static so a regression
// cannot ship silently again.

import gameInviteSelectorsSource from '../../lib/gameInviteSelectors.js?raw';
import {
  acceptGameInviteFnSource,
  sendGameInvitePushFnSource,
} from './simulationPanelContractStrings.jsx';

import {
  GAME_INVITE_TTL_MS,
  filterActiveIncomingGameInvites,
  isActiveIncomingGameInvite,
  isInviteExpired,
  parseInviteExpiresAt,
} from '@/lib/gameInviteSelectors';

const STATUS = { PASS: 'PASS', FAIL: 'FAIL' };
const ACTION_TYPES = { CODE_FIX: 'CODE_FIX' };

const SUITE_NAME = 'Invite Timezone Parse Suite';

function safeStr(src) {
  if (src == null) return '';
  if (typeof src === 'string') return src;
  try { return String(src); } catch { return ''; }
}

function missing(src, tokens) {
  const s = safeStr(src);
  return tokens.filter((t) => !s.includes(t));
}

function makeCase(id, name, run, options = {}) {
  return {
    key: `invite_timezone_parse.${id}`,
    suiteId: 'invite_timezone_parse',
    suiteName: SUITE_NAME,
    id,
    name,
    critical: options.critical ?? true,
    ...options,
    run,
  };
}

function pass(reason, extra) { return { status: STATUS.PASS, reason, ...(extra || {}) }; }
function fail(reason, extra) { return { status: STATUS.FAIL, reason, ...(extra || {}) }; }

export const EXTRA_SUITES = [
  {
    id: 'invite_timezone_parse',
    name: SUITE_NAME,
    critical: true,
    color: '#fb923c',
  },
];

export const EXTRA_TESTS = [
  /* 1. The exact video bug — naive ISO created_date must NOT expire instantly. */
  makeCase(
    'naive_iso_created_date_does_not_expire_immediately',
    'A pending invite whose created_date is a naive ISO string (no timezone) stays active for the full 10-minute TTL',
    () => {
      // Mirrors the exact strings observed in the failing runtime log.
      const naiveCreatedAt = '2026-05-31T14:33:11.992000';
      const now = new Date('2026-05-31T14:33:13Z').getTime();
      const invite = {
        id: 'reg_naive_iso',
        status: 'pending',
        to_email: 'recipient@example.com',
        lobby_id: 'lobby_naive_iso',
        created_at: naiveCreatedAt,
      };
      const expiresAt = parseInviteExpiresAt(invite);
      const stillActive = isActiveIncomingGameInvite(invite, 'recipient@example.com', now);
      const expired = isInviteExpired(invite, now);
      const remainingMs = expiresAt - now;
      // The created instant is 14:33:11.992 UTC, so the deadline is
      // 14:43:11.992 UTC and at 14:33:13 UTC we must have ~10 min left.
      const ok = stillActive === true
        && expired === false
        && Number.isFinite(expiresAt)
        && remainingMs > (9 * 60 * 1000)
        && remainingMs <= GAME_INVITE_TTL_MS;
      if (!ok) {
        return fail('Naive ISO created_date is parsed as local time and instantly marked expired (regression of the video bug).', {
          verification: 'EXECUTABLE',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          actual: { expiresAt, remainingMs, stillActive, expired },
          expected: { stillActive: true, expired: false, remainingMsGreaterThan: 9 * 60 * 1000 },
        });
      }
      return pass('Naive ISO created_date is parsed as UTC; invite stays active for the full TTL.', {
        verification: 'EXECUTABLE',
        actual: { remainingMs },
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX },
  ),

  /* 2. Multiple naive timestamp formats from Base44 all parse safely. */
  makeCase(
    'all_base44_timestamp_formats_parse_as_utc',
    'created_date strings with and without timezone suffix all yield identical UTC instants',
    () => {
      const formats = [
        '2026-05-31T14:33:11.992452+00:00', // microseconds + explicit offset (create event)
        '2026-05-31T14:33:11.992000',       // milliseconds, no zone (update event)
        '2026-05-31T14:33:11.992Z',         // standard ISO
        '2026-05-31T14:33:11',              // seconds only, no zone
      ];
      const expectedExpiry = new Date('2026-05-31T14:33:11Z').getTime() + GAME_INVITE_TTL_MS;
      const tolerance = 1000; // 1s tolerance for sub-second precision differences
      const drift = formats.map((createdAt) => {
        const invite = { id: `fmt_${createdAt}`, status: 'pending', to_email: 'me@example.com', lobby_id: 'lobby_fmt', created_at: createdAt };
        const expiresAt = parseInviteExpiresAt(invite);
        return Math.abs(expiresAt - expectedExpiry);
      });
      const bad = drift.filter((d) => !Number.isFinite(d) || d > tolerance);
      if (bad.length) {
        return fail('At least one Base44 timestamp format drifts more than 1s from UTC truth.', {
          verification: 'EXECUTABLE',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          actual: { drift },
        });
      }
      return pass('All Base44 timestamp formats land within 1s of the UTC truth.', {
        verification: 'EXECUTABLE',
        actual: { drift },
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX },
  ),

  /* 3. Genuinely expired invites still expire after 10 minutes. */
  makeCase(
    'genuinely_old_invite_is_expired',
    'A pending invite older than 10 minutes IS marked expired (TTL is still enforced)',
    () => {
      const now = Date.now();
      const naiveOld = new Date(now - (11 * 60 * 1000)).toISOString().replace(/Z$/, '');
      const invite = { id: 'old_invite', status: 'pending', to_email: 'me@example.com', lobby_id: 'l1', created_at: naiveOld };
      const expired = isInviteExpired(invite, now);
      const active = isActiveIncomingGameInvite(invite, 'me@example.com', now);
      if (expired !== true || active !== false) {
        return fail('TTL guard is too permissive — a truly old invite is still considered active.', {
          verification: 'EXECUTABLE',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          actual: { expired, active },
        });
      }
      return pass('Old invites (>10 min) are correctly marked expired.', { verification: 'EXECUTABLE' });
    },
    { actionType: ACTION_TYPES.CODE_FIX },
  ),

  /* 4. filterActiveIncomingGameInvites keeps the active invite. */
  makeCase(
    'filter_keeps_freshly_created_invite',
    'filterActiveIncomingGameInvites returns the new invite (single source of truth)',
    () => {
      const me = 'me@example.com';
      const now = new Date('2026-05-31T14:33:13Z').getTime();
      const rows = [
        { id: 'a', status: 'pending', to_email: me, lobby_id: 'L1', created_at: '2026-05-31T14:33:11.992000' },
        { id: 'b', status: 'pending', to_email: 'other@example.com', lobby_id: 'L2', created_at: '2026-05-31T14:33:11.992000' },
        { id: 'c', status: 'accepted', to_email: me, lobby_id: 'L3', created_at: '2026-05-31T14:33:11.992000' },
      ];
      const active = filterActiveIncomingGameInvites(rows, me, now);
      const ids = active.map((r) => r.id);
      if (ids.length !== 1 || ids[0] !== 'a') {
        return fail('Single-source-of-truth active filter dropped the legitimately active invite.', {
          verification: 'EXECUTABLE',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          actual: { ids },
        });
      }
      return pass('Active filter keeps exactly the pending, recipient-matched, non-expired invite.', { verification: 'EXECUTABLE' });
    },
    { actionType: ACTION_TYPES.CODE_FIX },
  ),

  /* 5. Client selector source has the UTC normalization helper. */
  makeCase(
    'client_selector_normalizes_naive_iso_to_utc',
    'lib/gameInviteSelectors.js appends Z to naive ISO strings before new Date(...)',
    () => {
      const m = missing(gameInviteSelectorsSource, [
        'parseBase44Timestamp',
        'hasZone',
        '`${str}Z`',
      ]);
      if (m.length) {
        return fail('Client timestamp parser does not guard against naive ISO strings.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          missing: m,
        });
      }
      return pass('Client parser handles naive ISO strings as UTC.', { verification: 'STATIC_CONTRACT' });
    },
    { actionType: ACTION_TYPES.CODE_FIX },
  ),

  /* 6. Backend acceptGameInvite parser has the same guard. */
  makeCase(
    'accept_backend_parser_handles_naive_iso',
    'functions/acceptGameInvite normalizes naive ISO timestamps to UTC',
    () => {
      const m = missing(acceptGameInviteFnSource, [
        'hasZone',
        '`${str}Z`',
      ]);
      if (m.length) {
        return fail('Backend acceptGameInvite would incorrectly expire fresh invites under naive timestamps.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          missing: m,
        });
      }
      return pass('Backend acceptGameInvite handles naive ISO strings as UTC.', { verification: 'STATIC_CONTRACT' });
    },
    { actionType: ACTION_TYPES.CODE_FIX },
  ),

  /* 7. Backend sendGameInvitePush parser has the same guard. */
  makeCase(
    'push_backend_parser_handles_naive_iso',
    'functions/sendGameInvitePush normalizes naive ISO timestamps to UTC',
    () => {
      const m = missing(sendGameInvitePushFnSource, [
        'hasZone',
        '`${str}Z`',
      ]);
      if (m.length) {
        return fail('Backend sendGameInvitePush would incorrectly expire fresh invites under naive timestamps.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          missing: m,
        });
      }
      return pass('Backend sendGameInvitePush handles naive ISO strings as UTC.', { verification: 'STATIC_CONTRACT' });
    },
    { actionType: ACTION_TYPES.CODE_FIX },
  ),

  /* 8. Stable TTL — must remain 10 minutes. */
  makeCase(
    'ttl_remains_ten_minutes',
    'GAME_INVITE_TTL_MS is exactly 10 minutes (product rule unchanged by the timezone fix)',
    () => {
      const expected = 10 * 60 * 1000;
      if (GAME_INVITE_TTL_MS !== expected) {
        return fail('TTL drifted from the documented 10-minute product rule.', {
          verification: 'EXECUTABLE',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          actual: GAME_INVITE_TTL_MS,
        });
      }
      return pass('TTL remains 10 minutes.', { verification: 'EXECUTABLE' });
    },
    { actionType: ACTION_TYPES.CODE_FIX },
  ),
];
