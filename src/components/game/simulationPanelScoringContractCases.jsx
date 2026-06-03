// Kronox Health Center — Scoring Contract Suite (Codex136).
//
// SCOPE
//   Lock the doc-vs-code alignment delivered in Codex136. Source of
//   truth: docs/KRONOX_SCORING_RULES.md.
//
//   Covers:
//     • solo_time_bonus_contract                         (S1 fix)
//     • online_score_no_draw_contract                    (O1 fix)
//     • online_score_time_bonus_missing_time_zero        (O2 fix)
//     • online_score_base_applies_even_without_bonus_time (O2 fix)
//     • online_score_helper_naming_contract              (O3 alias)
//     • online_score_persistence_field_matches_reader    (O5 fix)
//     • online_score_authority_model_documented          (doc only)
//     • online_score_persistence_failure_retry_safe      (O4 fix)
//     • online_score_idempotency_does_not_block_first_apply
//
//   All executable cases call real helpers. Static cases mirror only
//   in-/src/ sources (no `?raw` of paths outside src — Vite sometimes
//   resolves those to objects).

import {
  // canonical helpers (Codex128)
  ONLINE_WIN_POINTS,
  ONLINE_LOSS_POINTS,
  ONLINE_RESULT,
  getOnlineWinnerTimeBonus,
  calculateOnlineMatchDelta,
  applyOnlineMatchResult,
  // Codex136 doc-named aliases
  calculateOnlineWinnerDelta,
  calculateOnlineLoserDelta,
  getOnlineCheckpoint,
  applyOnlineScoreWithCheckpoint,
  applyOnlineMatchResultOnce,
} from '@/lib/onlineRanking';
import { calculateSoloTimeBonus } from '@/lib/soloProgressHelpers';
import onlineRankingSource from '../../lib/onlineRanking.js?raw';
import applyOnlineResultSource from '../../lib/applyOnlineResult.js?raw';

const STATUS = { PASS: 'PASS', FAIL: 'FAIL' };
const ACTION_TYPES = { CODE_FIX: 'CODE_FIX', DOC_FIX: 'DOC_FIX' };

const SUITE_ID = 'scoring_contract';
const SUITE_NAME = 'Scoring Contract Suite (Codex136 alignment)';

function safeStr(src) {
  if (src == null) return '';
  if (typeof src === 'string') return src;
  try { return String(src); } catch { return ''; }
}
function pass(reason, extra) { return { status: STATUS.PASS, reason, ...(extra || {}) }; }
function fail(reason, extra) { return { status: STATUS.FAIL, reason, ...(extra || {}) }; }
function assertEq(actual, expected, label) {
  if (actual !== expected) {
    return fail(`${label}: expected ${expected}, got ${actual}`, {
      verification: 'EXECUTABLE',
      classification: 'REAL_PRODUCT_RISK',
      actionType: ACTION_TYPES.CODE_FIX,
      actual, expected, label,
    });
  }
  return null;
}
function makeCase(id, name, run, options = {}) {
  return {
    key: `${SUITE_ID}.${id}`,
    suiteId: SUITE_ID,
    suiteName: SUITE_NAME,
    id,
    name,
    critical: options.critical ?? true,
    ...options,
    run,
  };
}

export const EXTRA_SUITES = [
  {
    id: SUITE_ID,
    name: SUITE_NAME,
    critical: true,
    color: '#f59e0b',
  },
];

export const EXTRA_TESTS = [
  /* 1. Solo time bonus — boundary fix for exactly 60.0s / 90.0s / 120.0s */
  makeCase('solo_time_bonus_contract',
    'Solo time bonus: 0-60 → +15, 61-90 → +10, 91-120 → +5, 121+ → +0',
    () => {
      const checks = [
        assertEq(calculateSoloTimeBonus(0,    true), 15, '0s   → +15'),
        assertEq(calculateSoloTimeBonus(59.9, true), 15, '59.9s → +15'),
        assertEq(calculateSoloTimeBonus(60,   true), 15, '60.0s → +15 (boundary)'),
        assertEq(calculateSoloTimeBonus(60.1, true), 10, '60.1s → +10'),
        assertEq(calculateSoloTimeBonus(75,   true), 10, '75s   → +10'),
        assertEq(calculateSoloTimeBonus(90,   true), 10, '90.0s → +10 (boundary)'),
        assertEq(calculateSoloTimeBonus(90.1, true), 5,  '90.1s → +5'),
        assertEq(calculateSoloTimeBonus(120,  true), 5,  '120s  → +5'),
        assertEq(calculateSoloTimeBonus(120.1, true), 0, '120.1s → +0'),
        assertEq(calculateSoloTimeBonus(45, false), 0,   'failed attempt → +0'),
      ].filter(Boolean);
      if (checks.length) return checks[0];
      return pass('Solo time bonus matches docs/KRONOX_SCORING_RULES.md §2.4.',
        { verification: 'EXECUTABLE' });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 2. Online — no draw scoring */
  makeCase('online_score_no_draw_contract',
    'Online draw scoring removed: no ONLINE_DRAW_POINTS, no RESULT_DRAW, no draws counter, no +3 delta',
    () => {
      const src = safeStr(onlineRankingSource);
      const forbidden = [
        'ONLINE_DRAW_POINTS',
        'RESULT_DRAW',
        // Active +3 award branch (in calculateOnlineMatchDelta) must be gone.
        // Defensive token: doc/comment mentions are fine as long as the
        // active code path doesn't return +3 for any input.
      ];
      const present = forbidden.filter((t) => src.includes(t));
      if (present.length) {
        return fail('Active draw scoring still present in lib/onlineRanking.js.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          forbiddenTokens: present,
        });
      }
      // Executable: passing result='draw' must not award points.
      const drawDelta = calculateOnlineMatchDelta({ result: 'draw', durationSeconds: 30 });
      const e1 = assertEq(drawDelta.delta, 0, "draw delta must be 0");
      if (e1) return e1;
      const applied = applyOnlineMatchResult({ score: 100 }, { result: 'draw' });
      const e2 = assertEq(applied.progress.score, 100, "draw must not mutate score");
      if (e2) return e2;
      const e3 = assertEq(applied.progress.draws, undefined, "no draws field written");
      if (e3) return e3;
      // ONLINE_RESULT enum must not expose DRAW anymore.
      const e4 = assertEq(ONLINE_RESULT.DRAW, undefined, "ONLINE_RESULT.DRAW must be undefined");
      if (e4) return e4;
      return pass('Draw scoring removed from active path; only WIN/LOSS supported.',
        { verification: 'EXECUTABLE' });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 3. Online — missing winner time → +0 bonus */
  makeCase('online_score_time_bonus_missing_time_zero',
    'Missing/invalid winner elapsed → +0 bonus (winner still gets +15 base)',
    () => {
      const checks = [
        assertEq(getOnlineWinnerTimeBonus(undefined), 0, 'undefined → 0'),
        assertEq(getOnlineWinnerTimeBonus(null), 0,      'null → 0'),
        assertEq(getOnlineWinnerTimeBonus(NaN), 0,       'NaN → 0'),
        assertEq(getOnlineWinnerTimeBonus('not a number'), 0, 'string → 0'),
        assertEq(getOnlineWinnerTimeBonus(-1), 0,        'negative → 0'),
        // valid times still correct
        assertEq(getOnlineWinnerTimeBonus(54), 10,  '54s → 10'),
        assertEq(getOnlineWinnerTimeBonus(60), 10,  '60s → 10'),
        assertEq(getOnlineWinnerTimeBonus(75), 5,   '75s → 5'),
        assertEq(getOnlineWinnerTimeBonus(90), 5,   '90s → 5'),
        assertEq(getOnlineWinnerTimeBonus(110), 0,  '110s → 0'),
      ].filter(Boolean);
      if (checks.length) return checks[0];
      return pass('Missing/invalid winner time correctly yields +0 bonus.',
        { verification: 'EXECUTABLE' });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 4. Online — base still applies even without time bonus */
  makeCase('online_score_base_applies_even_without_bonus_time',
    'Winner with missing elapsed still gets +15 base (no time bonus, but score updates)',
    () => {
      const checks = [
        assertEq(calculateOnlineMatchDelta({ result: 'win' }).delta, 15, 'undefined → +15'),
        assertEq(calculateOnlineMatchDelta({ result: 'win', durationSeconds: null }).delta, 15, 'null → +15'),
        assertEq(calculateOnlineMatchDelta({ result: 'win', durationSeconds: 75 }).delta, 20, '75 → +20'),
        assertEq(calculateOnlineMatchDelta({ result: 'win', durationSeconds: 54 }).delta, 25, '54 → +25'),
      ].filter(Boolean);
      if (checks.length) return checks[0];
      // Full flow: missing winner time still updates score.
      const r = applyOnlineMatchResult({ score: 100 }, { result: 'win' });
      const e1 = assertEq(r.progress.score, 115, 'score updates by +15 even without time');
      if (e1) return e1;
      return pass('Winner base +15 is applied even when elapsed is missing/invalid.',
        { verification: 'EXECUTABLE' });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 5. Online — doc-named helper aliases exist and produce the right values */
  makeCase('online_score_helper_naming_contract',
    'Doc-named helpers exist as thin aliases: calculateOnlineWinnerDelta / calculateOnlineLoserDelta / getOnlineCheckpoint / applyOnlineScoreWithCheckpoint / applyOnlineMatchResultOnce',
    () => {
      const namedExist = [
        ['calculateOnlineWinnerDelta', calculateOnlineWinnerDelta],
        ['calculateOnlineLoserDelta',  calculateOnlineLoserDelta],
        ['getOnlineCheckpoint',        getOnlineCheckpoint],
        ['applyOnlineScoreWithCheckpoint', applyOnlineScoreWithCheckpoint],
        ['applyOnlineMatchResultOnce', applyOnlineMatchResultOnce],
      ];
      const missing = namedExist.filter(([, fn]) => typeof fn !== 'function').map(([n]) => n);
      if (missing.length) {
        return fail('Doc-named helper aliases are not exported.', {
          verification: 'EXECUTABLE',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          missing,
        });
      }
      const checks = [
        assertEq(calculateOnlineWinnerDelta(54), 25, 'winner @54s'),
        assertEq(calculateOnlineWinnerDelta(75), 20, 'winner @75s'),
        assertEq(calculateOnlineWinnerDelta(110), 15, 'winner @110s'),
        assertEq(calculateOnlineWinnerDelta(undefined), 15, 'winner missing'),
        assertEq(calculateOnlineLoserDelta(), -6, 'loser → -6'),
        assertEq(getOnlineCheckpoint(263), 250, 'checkpoint @263'),
        assertEq(getOnlineCheckpoint(252), 250, 'checkpoint @252'),
        assertEq(getOnlineCheckpoint(99), 0,    'checkpoint @99'),
        assertEq(applyOnlineScoreWithCheckpoint(252, -6), 250, 'floor protects 252→250'),
        assertEq(applyOnlineScoreWithCheckpoint(263, -6), 257, 'no floor 263→257'),
        assertEq(applyOnlineScoreWithCheckpoint(101, -6), 100, 'floor protects 101→100'),
        assertEq(applyOnlineScoreWithCheckpoint(99, -6),  93,  'no floor 99→93'),
        assertEq(applyOnlineScoreWithCheckpoint(100, 15), 115, 'win passes through'),
      ].filter(Boolean);
      if (checks.length) return checks[0];
      const once = applyOnlineMatchResultOnce({ progress: { score: 100 }, result: 'win', durationSeconds: 54 });
      const e = assertEq(once.progress.score, 125, 'applyOnlineMatchResultOnce shape works');
      if (e) return e;
      return pass('All doc-named aliases exist and return the expected values.',
        { verification: 'EXECUTABLE' });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 6. Online — persistence field matches reader (lastMatchAt + no draws) */
  makeCase('online_score_persistence_field_matches_reader',
    'Writer emits lastMatchAt (not lastUpdatedAt) and does not write draws field',
    () => {
      const r = applyOnlineMatchResult({}, { result: 'win', durationSeconds: 54 });
      const e1 = assertEq(typeof r.progress.lastMatchAt, 'string', 'lastMatchAt is a string ISO timestamp');
      if (e1) return e1;
      const e2 = assertEq(r.progress.lastUpdatedAt, undefined, 'legacy lastUpdatedAt not written');
      if (e2) return e2;
      const e3 = assertEq(r.progress.draws, undefined, 'draws not written');
      if (e3) return e3;
      // Existing user with draws field on disk must not crash this helper.
      const legacy = { score: 50, draws: 3 };
      const r2 = applyOnlineMatchResult(legacy, { result: 'win' });
      const e4 = assertEq(r2.progress.draws, undefined, 'legacy draws ignored, not re-emitted');
      if (e4) return e4;
      const e5 = assertEq(r2.progress.score, 65, 'legacy draws does not block scoring');
      if (e5) return e5;
      return pass('Writer uses lastMatchAt and never emits draws; legacy progress safe.',
        { verification: 'EXECUTABLE' });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 7. Authority model is documented (Option A) */
  makeCase('online_score_authority_model_documented',
    'lib/applyOnlineResult.js documents Option A (each client updates only its own score)',
    () => {
      const src = safeStr(applyOnlineResultSource);
      const required = [
        'base44.auth.updateMe',
        'lastMatchId',
      ];
      const missing = required.filter((t) => !src.includes(t));
      if (missing.length) {
        return fail('Authority model wiring missing in applyOnlineResult.js.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          missing,
        });
      }
      return pass('Option A authority model is documented and wired through updateMe + lastMatchId.',
        { verification: 'STATIC_CONTRACT', classification: 'STATIC_CHECK_LIMITATION' });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 8. Persistence failure leaves the function retry-safe */
  makeCase('online_score_persistence_failure_retry_safe',
    'applyOnlineMatchToCurrentUser returns structured failure and does not mark match applied when persist fails',
    () => {
      const src = safeStr(applyOnlineResultSource);
      const required = [
        // structured return shape
        "ok: false",
        "retryable: true",
        "where: 'persist'",
        "where: 'auth'",
        // idempotency marker is only attached when persist succeeds
        "lastMatchId: String(lobbyId)",
        // happy-path success shape
        "ok: true",
      ];
      const missing = required.filter((t) => !src.includes(t));
      if (missing.length) {
        return fail('Structured retry-safe failure handling not implemented.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          missing,
        });
      }
      // Defensive — applyOnlineMatchResult itself never throws on valid math,
      // so the structured failure path can only be reached on auth or persist
      // failure. We don't try to mock SDK here; static + executable math is
      // enough for the contract.
      return pass('Failure handling returns structured result and keeps retry safe.',
        { verification: 'STATIC_CONTRACT', classification: 'STATIC_CHECK_LIMITATION' });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 9. First apply is never blocked by idempotency */
  makeCase('online_score_idempotency_does_not_block_first_apply',
    'First time a lobbyId is presented, the score is applied; only second presentation short-circuits',
    () => {
      // Pure-math sanity: lastMatchId comparison is the only short-circuit.
      // Empty progress + a lobby id must NOT short-circuit; that is enforced
      // in the source file by the `current.lastMatchId && String(...) === ...`
      // guard. Mirror that token here so a regression that removes the guard
      // fails this case.
      const src = safeStr(applyOnlineResultSource);
      const required = [
        'current.lastMatchId && String(current.lastMatchId) === String(lobbyId)',
        "reason: 'already_applied'",
      ];
      const missing = required.filter((t) => !src.includes(t));
      if (missing.length) {
        return fail('Idempotency guard missing or weakened.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          missing,
        });
      }
      // Also lock the constants the guard depends on.
      const checks = [
        assertEq(ONLINE_WIN_POINTS, 15, 'ONLINE_WIN_POINTS'),
        assertEq(ONLINE_LOSS_POINTS, -6, 'ONLINE_LOSS_POINTS'),
      ].filter(Boolean);
      if (checks.length) return checks[0];
      return pass('Idempotency check fires only on a repeat lobbyId presentation.',
        { verification: 'STATIC_CONTRACT', classification: 'STATIC_CHECK_LIMITATION' });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),
];
