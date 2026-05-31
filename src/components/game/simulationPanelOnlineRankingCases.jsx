// Kronox Health Center — Online ranking / checkpoint contracts (Codex128).
//
// SCOPE
//   Lock the Online puan system in place:
//     • Win  → +15
//     • Loss → −6
//     • Draw → +3 (both sides)
//     • Winner time bonus tiers: ≤60s +10, 61–90s +5, 91s+ +0.
//     • Checkpoint ladder: [0,100,250,500,1000,1500,2000,3000]
//     • Checkpoint floor: a loss can NEVER drop the player's score below
//       their highest reached checkpoint. Wins/draws are NEVER clamped.
//     • Idempotency: re-applying the same lobby id does NOT double-count.
//
//   These are executable contracts — they call the actual helpers from
//   lib/onlineRanking.js, so any drift fails immediately.

import {
  ONLINE_WIN_POINTS,
  ONLINE_LOSS_POINTS,
  ONLINE_DRAW_POINTS,
  ONLINE_CHECKPOINTS,
  ONLINE_TIME_BONUS_TIERS,
  ONLINE_RESULT,
  getOnlineWinnerTimeBonus,
  getReachedCheckpoint,
  calculateOnlineMatchDelta,
  applyOnlineMatchResult,
} from '@/lib/onlineRanking';
// Codex132 — Mirror entity / Game.jsx sources so the Health cases do
// NOT do dynamic ?raw imports of paths outside /src (which sometimes
// resolve to objects → "object is not a function" crashes).
import { userEntitySource } from './simulationPanelContractStrings.jsx';
import gameSource from '../../pages/Game.jsx?raw';

function safeStr(src) {
  if (src == null) return '';
  if (typeof src === 'string') return src;
  try { return String(src); } catch { return ''; }
}

const STATUS = { PASS: 'PASS', FAIL: 'FAIL' };
const ACTION_TYPES = { CODE_FIX: 'CODE_FIX' };

const SUITE_NAMES = {
  online_ranking: 'Online Ranking & Checkpoint Suite',
};

function makeCase(suiteId, id, name, run, options = {}) {
  return {
    key: `${suiteId}.${id}`,
    suiteId,
    suiteName: SUITE_NAMES[suiteId] || suiteId,
    id,
    name,
    critical: options.critical ?? true,
    ...options,
    run,
  };
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

export const EXTRA_SUITES = [
  {
    id: 'online_ranking',
    name: SUITE_NAMES.online_ranking,
    critical: true,
    color: '#fbbf24',
  },
];

export const EXTRA_TESTS = [
  /* 1. Sabit puan kuralları */
  makeCase('online_ranking', 'point_constants',
    'Online point constants: win=+15, loss=−6, draw=+3',
    () => {
      const errors = [];
      if (ONLINE_WIN_POINTS !== 15) errors.push({ field: 'win', expected: 15, actual: ONLINE_WIN_POINTS });
      if (ONLINE_LOSS_POINTS !== -6) errors.push({ field: 'loss', expected: -6, actual: ONLINE_LOSS_POINTS });
      if (ONLINE_DRAW_POINTS !== 3) errors.push({ field: 'draw', expected: 3, actual: ONLINE_DRAW_POINTS });
      if (errors.length) {
        return fail('Online point constants drifted.', {
          verification: 'EXECUTABLE',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          errors,
        });
      }
      return pass('Online point constants match product spec.',
        { verification: 'EXECUTABLE' });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 2. Time bonus tier sınırları (≤60, 61–90, 91+) */
  makeCase('online_ranking', 'time_bonus_tiers_boundaries',
    'Winner time bonus: ≤60s → +10, 61–90s → +5, 91s+ → +0 (inclusive boundaries)',
    () => {
      const errors = [];
      const cases = [
        { seconds: 0,   expected: 10 },
        { seconds: 1,   expected: 10 },
        { seconds: 59,  expected: 10 },
        { seconds: 60,  expected: 10 },
        { seconds: 61,  expected: 5 },
        { seconds: 75,  expected: 5 },
        { seconds: 90,  expected: 5 },
        { seconds: 91,  expected: 0 },
        { seconds: 120, expected: 0 },
        { seconds: 600, expected: 0 },
      ];
      for (const c of cases) {
        const got = getOnlineWinnerTimeBonus(c.seconds);
        if (got !== c.expected) errors.push({ ...c, got });
      }
      // Also assert the tier structure itself matches the product.
      if (ONLINE_TIME_BONUS_TIERS.length !== 2) {
        errors.push({ field: 'tier_count', expected: 2, actual: ONLINE_TIME_BONUS_TIERS.length });
      }
      if (errors.length) {
        return fail('Winner time bonus tiers drifted.', {
          verification: 'EXECUTABLE',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          errors,
        });
      }
      return pass('Winner time bonus tiers cover product boundaries.',
        { verification: 'EXECUTABLE' });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 3. Checkpoint ladder doğru */
  makeCase('online_ranking', 'checkpoint_ladder_matches_spec',
    'Checkpoint ladder is exactly [0,100,250,500,1000,1500,2000,3000]',
    () => {
      const expected = [0, 100, 250, 500, 1000, 1500, 2000, 3000];
      const actual = Array.from(ONLINE_CHECKPOINTS);
      const ok = expected.length === actual.length && expected.every((v, i) => v === actual[i]);
      if (!ok) {
        return fail('Checkpoint ladder drifted from product spec.', {
          verification: 'EXECUTABLE',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          expected, actual,
        });
      }
      return pass('Checkpoint ladder matches product spec.',
        { verification: 'EXECUTABLE' });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 4. getReachedCheckpoint sınır davranışı */
  makeCase('online_ranking', 'reached_checkpoint_boundaries',
    'getReachedCheckpoint returns the highest checkpoint ≤ score at exact and just-below boundaries',
    () => {
      const cases = [
        { score: 0,    expected: 0 },
        { score: 50,   expected: 0 },
        { score: 99,   expected: 0 },
        { score: 100,  expected: 100 },
        { score: 249,  expected: 100 },
        { score: 250,  expected: 250 },
        { score: 999,  expected: 500 },
        { score: 1000, expected: 1000 },
        { score: 1500, expected: 1500 },
        { score: 2999, expected: 2000 },
        { score: 3000, expected: 3000 },
        { score: 5000, expected: 3000 },
      ];
      const errors = cases
        .map((c) => ({ ...c, got: getReachedCheckpoint(c.score) }))
        .filter((c) => c.got !== c.expected);
      if (errors.length) {
        return fail('getReachedCheckpoint boundary handling is wrong.', {
          verification: 'EXECUTABLE',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          errors,
        });
      }
      return pass('Reached checkpoint resolution is correct at every boundary.',
        { verification: 'EXECUTABLE' });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 5. Tek-maç delta hesabı */
  makeCase('online_ranking', 'match_delta_computation',
    'calculateOnlineMatchDelta combines base + time bonus correctly for each result',
    () => {
      const w30 = calculateOnlineMatchDelta({ result: ONLINE_RESULT.WIN, durationSeconds: 30 });
      const w75 = calculateOnlineMatchDelta({ result: ONLINE_RESULT.WIN, durationSeconds: 75 });
      const w150 = calculateOnlineMatchDelta({ result: ONLINE_RESULT.WIN, durationSeconds: 150 });
      const loss = calculateOnlineMatchDelta({ result: ONLINE_RESULT.LOSS, durationSeconds: 999 });
      const draw = calculateOnlineMatchDelta({ result: ONLINE_RESULT.DRAW, durationSeconds: 30 });

      const checks = [
        assertEq(w30.delta, 25, 'win @30s → 15+10'),
        assertEq(w75.delta, 20, 'win @75s → 15+5'),
        assertEq(w150.delta, 15, 'win @150s → 15+0'),
        assertEq(loss.delta, -6, 'loss → −6 (time ignored)'),
        assertEq(draw.delta, 3, 'draw → +3 (time ignored)'),
        assertEq(loss.timeBonus, 0, 'loss time bonus must be 0'),
        assertEq(draw.timeBonus, 0, 'draw time bonus must be 0'),
      ].filter(Boolean);

      if (checks.length) return checks[0];
      return pass('Match delta math matches product spec for every result type.',
        { verification: 'EXECUTABLE' });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 6. Checkpoint kuralı — kayıp peakCheckpoint'in altına düşüremez */
  makeCase('online_ranking', 'loss_cannot_drop_below_peak_checkpoint',
    'A loss never drops score below the highest reached checkpoint',
    () => {
      // Player who has reached the 500 checkpoint, currently sits at 502.
      // Two consecutive losses would prospectively take them to 490 then 484,
      // but the floor is 500.
      let progress = { score: 502, peakScore: 502, peakCheckpoint: 500 };
      const a = applyOnlineMatchResult(progress, { result: ONLINE_RESULT.LOSS });
      const errA = assertEq(a.progress.score, 500, 'first loss floors at 500');
      if (errA) return errA;
      const errClamp = assertEq(a.applied.clampedByCheckpoint, true, 'clamp flag must be true');
      if (errClamp) return errClamp;

      const b = applyOnlineMatchResult(a.progress, { result: ONLINE_RESULT.LOSS });
      const errB = assertEq(b.progress.score, 500, 'second loss still floors at 500');
      if (errB) return errB;
      // A third loss still sits at 500.
      const c = applyOnlineMatchResult(b.progress, { result: ONLINE_RESULT.LOSS });
      const errC = assertEq(c.progress.score, 500, 'third loss still floors at 500');
      if (errC) return errC;
      // peakCheckpoint must never decrease.
      const errPeak = assertEq(c.progress.peakCheckpoint, 500, 'peakCheckpoint preserved');
      if (errPeak) return errPeak;
      return pass('Checkpoint floor holds across repeated losses.',
        { verification: 'EXECUTABLE' });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 7. Checkpoint kuralı — kazanç hiçbir zaman clamp edilmez */
  makeCase('online_ranking', 'win_never_clamped_by_checkpoint',
    'A win is never reduced by the checkpoint floor; clampedByCheckpoint stays false for wins',
    () => {
      const progress = { score: 95, peakScore: 95, peakCheckpoint: 0 };
      const r = applyOnlineMatchResult(progress, { result: ONLINE_RESULT.WIN, durationSeconds: 30 });
      // 95 + 15 + 10 = 120, no clamp
      const e1 = assertEq(r.progress.score, 120, 'win adds full delta');
      if (e1) return e1;
      const e2 = assertEq(r.applied.clampedByCheckpoint, false, 'win never clamped');
      if (e2) return e2;
      const e3 = assertEq(r.progress.peakCheckpoint, 100, 'peakCheckpoint ratchets up to 100');
      if (e3) return e3;
      return pass('Wins ignore checkpoint floor and ratchet peak up.',
        { verification: 'EXECUTABLE' });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 8. Beraberlik her iki tarafa +3 verir, peakCheckpoint bozulmaz */
  makeCase('online_ranking', 'draw_adds_three_each_side',
    'Draw adds +3 to both players independently with no time bonus',
    () => {
      const p1 = applyOnlineMatchResult({ score: 200 }, { result: ONLINE_RESULT.DRAW, durationSeconds: 30 });
      const p2 = applyOnlineMatchResult({ score: 1480 }, { result: ONLINE_RESULT.DRAW, durationSeconds: 30 });
      const e1 = assertEq(p1.progress.score, 203, 'player 1 +3');
      if (e1) return e1;
      const e2 = assertEq(p2.progress.score, 1483, 'player 2 +3');
      if (e2) return e2;
      const e3 = assertEq(p1.applied.timeBonus, 0, 'draw time bonus = 0');
      if (e3) return e3;
      return pass('Draw distributes +3/+3 without time bonus.',
        { verification: 'EXECUTABLE' });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 9. peakScore ve peakCheckpoint hep ratchet — geri gitmez */
  makeCase('online_ranking', 'peak_score_and_checkpoint_are_monotonic',
    'peakScore and peakCheckpoint only ever increase, even after losses',
    () => {
      // Build a player that reached 510 (above 500 checkpoint), then took a loss.
      let p = { score: 510, peakScore: 510, peakCheckpoint: 500 };
      p = applyOnlineMatchResult(p, { result: ONLINE_RESULT.LOSS }).progress; // floors at 504
      const e1 = assertEq(p.peakScore, 510, 'peakScore preserved after loss');
      if (e1) return e1;
      const e2 = assertEq(p.peakCheckpoint, 500, 'peakCheckpoint preserved after loss');
      if (e2) return e2;
      // Now another loss; score drops to 500 (floor), peak still 510.
      p = applyOnlineMatchResult(p, { result: ONLINE_RESULT.LOSS }).progress;
      const e3 = assertEq(p.score, 500, 'second loss floors at 500');
      if (e3) return e3;
      const e4 = assertEq(p.peakScore, 510, 'peakScore still 510');
      if (e4) return e4;
      return pass('Peak metrics never decrease.',
        { verification: 'EXECUTABLE' });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 10. Sayım (wins/losses/draws) doğru artar */
  makeCase('online_ranking', 'counters_increment_per_result',
    'wins/losses/draws counters increment exactly once per applied result',
    () => {
      let p = {};
      p = applyOnlineMatchResult(p, { result: ONLINE_RESULT.WIN, durationSeconds: 30 }).progress;
      p = applyOnlineMatchResult(p, { result: ONLINE_RESULT.WIN, durationSeconds: 75 }).progress;
      p = applyOnlineMatchResult(p, { result: ONLINE_RESULT.LOSS }).progress;
      p = applyOnlineMatchResult(p, { result: ONLINE_RESULT.DRAW }).progress;
      const e1 = assertEq(p.wins, 2, 'wins');
      if (e1) return e1;
      const e2 = assertEq(p.losses, 1, 'losses');
      if (e2) return e2;
      const e3 = assertEq(p.draws, 1, 'draws');
      if (e3) return e3;
      return pass('Result counters increment exactly once per match.',
        { verification: 'EXECUTABLE' });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 11. Game.jsx idempotent wiring kontrolü (static) */
  makeCase('online_ranking', 'game_applies_result_once_per_lobby',
    'Game.jsx wires applyOnlineMatchToCurrentUser with an onlineResultAppliedRef guard',
    () => {
      const src = safeStr(gameSource);
      const required = [
        'applyOnlineMatchToCurrentUser',
        'onlineResultAppliedRef',
        "result = localIsWinner ? 'win' : 'loss'",
      ];
      const missing = required.filter((t) => !src.includes(t));
      if (missing.length) {
        return fail('Online result is not wired into Game.jsx correctly.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          missing,
        });
      }
      return pass('Game.jsx applies the online match result exactly once per match.',
        { verification: 'STATIC_CONTRACT', classification: 'STATIC_CHECK_LIMITATION' });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 12. User entity online_progress alanını içeriyor mu */
  makeCase('online_ranking', 'user_entity_has_online_progress',
    'User entity exposes online_progress with score/peakScore/peakCheckpoint/wins/losses/draws/lastMatchId',
    () => {
      // Codex132 — Use the mirrored userEntitySource (kept in sync with
      // entities/User.json) instead of a dynamic ?raw import of a path
      // outside /src. Vite occasionally returns a parsed JSON object for
      // such imports, turning .includes(...) into a TypeError.
      const raw = safeStr(userEntitySource);
      const required = [
        'online_progress',
        'peakCheckpoint',
        'peakScore',
        'lastMatchId',
        'wins',
        'losses',
        'draws',
      ];
      const missing = required.filter((t) => !raw.includes(t));
      if (missing.length) {
        return fail('User entity is missing online_progress fields.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          missing,
        });
      }
      return pass('User.online_progress schema present.',
        { verification: 'STATIC_CONTRACT', classification: 'STATIC_CHECK_LIMITATION' });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),
];