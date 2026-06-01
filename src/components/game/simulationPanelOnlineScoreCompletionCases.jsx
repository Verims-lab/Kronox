// Kronox Health Center — Online score completion contracts.
//
// SCOPE
//   Locks the end-of-online-match behavior:
//     • match completion calls the current-user score writer
//     • winner gains +15 plus own elapsed-time bonus
//     • loser gets -6 with checkpoint floor
//     • result popup displays the real applied delta
//     • Online scoring never mutates Solo score

import {
  calculateOnlineWinnerDelta,
  calculateOnlineLoserDelta,
  applyOnlineScoreWithCheckpoint,
  applyOnlineMatchResult,
} from '@/lib/onlineRanking';
import { getOnlinePlayerElapsedSeconds } from '@/lib/onlinePlayerElapsed';
import gameSource from '../../pages/Game.jsx?raw';
import gameOverSource from './GameOver.jsx?raw';
import applyOnlineResultSource from '../../lib/applyOnlineResult.js?raw';
import onlineRankingSource from '../../lib/onlineRanking.js?raw';
import playerElapsedSource from '../../lib/onlinePlayerElapsed.js?raw';

const STATUS = { PASS: 'PASS', FAIL: 'FAIL' };
const ACTION_TYPES = { CODE_FIX: 'CODE_FIX' };
const SUITE_ID = 'online_score_completion_health';
const SUITE_NAME = 'Online Score Completion Suite';

function safeStr(src) {
  if (src == null) return '';
  if (typeof src === 'string') return src;
  try { return String(src); } catch { return ''; }
}

function pass(reason, extra) { return { status: STATUS.PASS, reason, ...(extra || {}) }; }
function fail(reason, extra) { return { status: STATUS.FAIL, reason, ...(extra || {}) }; }

function missingTokens(source, tokens) {
  const src = safeStr(source);
  return tokens.filter((token) => !src.includes(token));
}

function assertEq(actual, expected, label) {
  if (actual !== expected) {
    return fail(`${label}: expected ${expected}, got ${actual}`, {
      verification: 'EXECUTABLE',
      classification: 'REAL_PRODUCT_RISK',
      actionType: ACTION_TYPES.CODE_FIX,
      actual,
      expected,
      label,
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
  { id: SUITE_ID, name: SUITE_NAME, critical: true, color: '#22c55e' },
];

export const EXTRA_TESTS = [
  makeCase('online_score_applied_on_match_completion',
    'Online completion path calls score application',
    () => {
      const missing = missingTokens(gameSource, [
        'applyOnlineMatchToCurrentUser',
        'onlineResultAppliedRef',
        'setOnlineScoreResult',
        "result = localIsWinner ? 'win' : 'loss'",
      ]);
      if (missing.length) return fail('Game.jsx no longer applies Online score on match completion.', { verification: 'STATIC_CONTRACT', missing });
      return pass('Game.jsx applies the Online result once and stores popup score state.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('online_score_winner_gain_loser_loss',
    'Winner gains positive delta and loser gets -6',
    () => {
      const checks = [
        assertEq(calculateOnlineWinnerDelta(54), 25, 'winner 54s'),
        assertEq(calculateOnlineWinnerDelta(75), 20, 'winner 75s'),
        assertEq(calculateOnlineWinnerDelta(110), 15, 'winner 110s'),
        assertEq(calculateOnlineLoserDelta(), -6, 'loser delta'),
      ].filter(Boolean);
      if (checks.length) return checks[0];
      return pass('Winner/loser Online deltas match product scoring.', { verification: 'EXECUTABLE' });
    }),

  makeCase('online_score_uses_player_own_elapsed_time',
    'Winner time bonus uses the current player gameplay timer, not lobby duration',
    () => {
      // Codex146 — Source-of-truth helper replaces the inline winner-bonus
      // comment. We require the helper import + the local timer ref + the
      // sticky per-match snapshot ref.
      const src = safeStr(gameSource);
      const missing = missingTokens(src, [
        'getOnlinePlayerElapsedSeconds',
        'overallSecondsRef.current',
        'playerOwnElapsedRef',
      ]);
      const forbidden = ['created_date', 'created_at', 'invite', 'joined_at']
        .filter((token) => src.includes(`durationSeconds = lobbyData?.${token}`));
      if (missing.length || forbidden.length) {
        return fail('Online winner bonus may not be using the local gameplay timer.', {
          verification: 'STATIC_CONTRACT',
          missing,
          forbidden,
        });
      }
      return pass('Online winner bonus is sourced from the local gameplay elapsed timer.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('online_score_missing_time_base_only',
    'Missing winner elapsed time gives +15 base only',
    () => {
      const checks = [
        assertEq(calculateOnlineWinnerDelta(undefined), 15, 'undefined elapsed'),
        assertEq(calculateOnlineWinnerDelta(null), 15, 'null elapsed'),
        assertEq(calculateOnlineWinnerDelta(Number.NaN), 15, 'NaN elapsed'),
      ].filter(Boolean);
      if (checks.length) return checks[0];
      return pass('Missing elapsedSeconds does not accidentally receive a speed bonus.', { verification: 'EXECUTABLE' });
    }),

  makeCase('online_score_checkpoint_floor_loss',
    'Loss cannot drop below checkpoint floor',
    () => {
      const checks = [
        assertEq(applyOnlineScoreWithCheckpoint(252, -6), 250, '252 loss floors at 250'),
        assertEq(applyOnlineScoreWithCheckpoint(263, -6), 257, '263 loss applies normally'),
        assertEq(applyOnlineScoreWithCheckpoint(101, -6), 100, '101 loss floors at 100'),
        assertEq(applyOnlineScoreWithCheckpoint(99, -6), 93, '99 loss applies normally'),
      ].filter(Boolean);
      if (checks.length) return checks[0];
      return pass('Loser checkpoint floor examples match the product contract.', { verification: 'EXECUTABLE' });
    }),

  makeCase('online_score_no_draw_contract',
    'Online completion has no draw scoring path',
    () => {
      const r = applyOnlineMatchResult({ score: 100 }, { result: 'draw', durationSeconds: 54 });
      const drawTokens = missingTokens(onlineRankingSource, [
        'Draw scoring is removed',
        'return { base: 0, timeBonus: 0, delta: 0 }',
      ]);
      const checks = [
        assertEq(r.progress.score, 100, 'draw score unchanged'),
        assertEq(r.applied.delta, 0, 'draw delta zero'),
      ].filter(Boolean);
      if (checks.length) return checks[0];
      if (drawTokens.length) return fail('Online draw-removal source contract drifted.', { verification: 'STATIC_CONTRACT', missing: drawTokens });
      return pass('Draws do not score and active completion resolves win/loss only.', { verification: 'EXECUTABLE' });
    }),

  makeCase('online_score_idempotent_per_user_lobby',
    'Score applies once per current user and lobby',
    () => {
      const missing = missingTokens(applyOnlineResultSource, [
        'findExistingOnlineMatchResult',
        "{ lobby_id: String(lobbyId), player_email: playerEmail }",
        'already_recorded',
        'lastMatchId',
      ]);
      const blocksFirstApply = safeStr(applyOnlineResultSource).includes("where: 'online_match_result_lookup'");
      if (missing.length || blocksFirstApply) {
        return fail('Online score idempotency is missing or can block the first apply on audit lookup failure.', {
          verification: 'STATIC_CONTRACT',
          missing,
          blocksFirstApply,
        });
      }
      return pass('Online scoring checks player+lobby audit rows and falls back without blocking first apply.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('online_score_code_lobby_path_supported',
    'Code/lobby completion path applies Online score',
    () => {
      const missing = missingTokens(gameSource, [
        "source: routeState?.inviteId ? 'friend_invite' : 'code_lobby'",
        'applyOnlineMatchToCurrentUser',
      ]);
      if (missing.length) return fail('Code/lobby source path is not represented in the completion writer.', { verification: 'STATIC_CONTRACT', missing });
      return pass('Code/lobby joined matches use the shared Game.jsx completion writer.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('online_score_friend_invite_path_supported',
    'Friend-invite completion path applies Online score',
    () => {
      const missing = missingTokens(gameSource, [
        "source: routeState?.inviteId ? 'friend_invite' : 'code_lobby'",
        'applyOnlineMatchToCurrentUser',
      ]);
      if (missing.length) return fail('Friend-invite source path is not represented in the completion writer.', { verification: 'STATIC_CONTRACT', missing });
      return pass('Friend-invite matches use the same Game.jsx completion writer.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('online_result_popup_shows_score_delta',
    'Result popup shows the current player Online score delta',
    () => {
      const missing = missingTokens(gameOverSource, [
        'onlineScoreResult',
        'Puan',
        'Galibiyet: +',
        'Mağlubiyet:',
        'Checkpoint koruması',
        'Skor:',
      ]);
      if (missing.length) return fail('GameOver popup no longer displays Online score delta/breakdown.', { verification: 'STATIC_CONTRACT', missing });
      return pass('GameOver displays the real current-player Online score delta and checkpoint details.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('online_score_not_solo_total_score',
    'Online scoring does not mutate Solo totalSoloScore',
    () => {
      const src = safeStr(applyOnlineResultSource);
      const bad = src.includes('totalSoloScore') || src.includes('solo_progress');
      if (bad) return fail('Online scoring writer references Solo score/progress.', { verification: 'STATIC_CONTRACT' });
      return pass('Online scoring writes online_progress and OnlineMatchResult only.', { verification: 'STATIC_CONTRACT' });
    }),

  // ─── Codex146 — Player-own elapsed time + popup/scoring parity ──────

  makeCase('online_score_player_elapsed_time_not_lobby_duration',
    'Scoring time source is player-own gameplay timer, not lobby/invite duration',
    () => {
      const src = safeStr(gameSource);
      const missing = missingTokens(src, [
        'getOnlinePlayerElapsedSeconds',
        'playerOwnElapsedRef',
        'overallSecondsRef.current',
      ]);
      const forbidden = ['created_date', 'created_at', 'joined_at', 'last_activity_at']
        .filter((token) => src.includes(`durationSeconds: lobbyData?.${token}`) ||
                            src.includes(`elapsedSeconds: lobbyData?.${token}`));
      if (missing.length || forbidden.length) {
        return fail('Online scoring time source may be lobby/invite duration instead of player-own time.', {
          verification: 'STATIC_CONTRACT',
          missing,
          forbidden,
        });
      }
      return pass('Online scoring uses the local gameplay timer via getOnlinePlayerElapsedSeconds.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('online_popup_time_matches_scoring_time',
    'Result popup time and scoring time read the same single value',
    () => {
      const overSrc = safeStr(gameOverSource);
      const gameSrc = safeStr(gameSource);
      const missingOver = missingTokens(overSrc, [
        'displayDurationSeconds',
        'onlineScoreResult?.elapsedSeconds',
      ]);
      const missingGame = missingTokens(gameSrc, [
        'elapsedSeconds: durationSeconds',
      ]);
      if (missingOver.length || missingGame.length) {
        return fail('Popup time and scoring time may have drifted apart.', {
          verification: 'STATIC_CONTRACT',
          missingOver,
          missingGame,
        });
      }
      return pass('Popup time reads onlineScoreResult.elapsedSeconds (same value sent to scoring).', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('online_player_elapsed_helper_returns_null_for_missing',
    'getOnlinePlayerElapsedSeconds returns null when no reliable time exists',
    () => {
      const checks = [
        assertEq(getOnlinePlayerElapsedSeconds({}, undefined), null, 'undefined fallback'),
        assertEq(getOnlinePlayerElapsedSeconds({}, null), null, 'null fallback'),
        assertEq(getOnlinePlayerElapsedSeconds({ elapsedSeconds: -3 }, null), null, 'negative explicit'),
        assertEq(getOnlinePlayerElapsedSeconds({ elapsedSeconds: NaN }, null), null, 'NaN explicit'),
        assertEq(getOnlinePlayerElapsedSeconds({}, 0), 0, 'zero fallback ok'),
        assertEq(getOnlinePlayerElapsedSeconds({ elapsedSeconds: 42 }, 999), 42, 'explicit wins over fallback'),
        assertEq(getOnlinePlayerElapsedSeconds({}, 205), 205, 'fallback used when no explicit'),
      ].filter(Boolean);
      if (checks.length) return checks[0];
      return pass('Player-own elapsed helper returns null for missing/invalid time.', { verification: 'EXECUTABLE' });
    }),

  makeCase('online_winner_3_25_gets_15_not_25',
    'Winner own elapsed 205s (3:25) gives +15 base only, no speed bonus',
    () => {
      const checks = [
        assertEq(calculateOnlineWinnerDelta(205), 15, 'winner 3:25 → +15'),
        assertEq(calculateOnlineWinnerDelta(91), 15, 'winner 91s → +15'),
      ].filter(Boolean);
      if (checks.length) return checks[0];
      return pass('Winner over 90s gets +15 only (no fake +10 bonus).', { verification: 'EXECUTABLE' });
    }),

  makeCase('online_score_update_failure_not_shown_as_success',
    'Persistence failure does NOT show a successful +points message',
    () => {
      const src = safeStr(gameSource);
      const missing = missingTokens(src, [
        'Puan kaydedilemedi. Tekrar dene.',
        'error: true',
      ]);
      if (missing.length) return fail('Persistence failure message is missing or shows success.', { verification: 'STATIC_CONTRACT', missing });
      return pass('Persistence failure clearly shows "Puan kaydedilemedi" instead of a delta.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('online_score_idempotency_does_not_block_first_persist',
    'Idempotency guard does not block the first real apply',
    () => {
      const src = safeStr(applyOnlineResultSource);
      const missing = missingTokens(src, [
        "where: 'persist'",
        'lastMatchId: String(lobbyId)',
        'already_recorded',
      ]);
      // The guard must not abort the apply when the audit lookup itself fails.
      const blocksFirstApply = src.includes("where: 'online_match_result_lookup'");
      if (missing.length || blocksFirstApply) {
        return fail('Idempotency may block the first real persist.', {
          verification: 'STATIC_CONTRACT',
          missing,
          blocksFirstApply,
        });
      }
      return pass('First completion persists; only AFTER successful updateMe is lastMatchId stored.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('online_score_helper_file_exists',
    'lib/onlinePlayerElapsed.js helper module is present',
    () => {
      const src = safeStr(playerElapsedSource);
      const missing = missingTokens(src, [
        'export function getOnlinePlayerElapsedSeconds',
        'isUsableSeconds',
        'Same input → same output',
      ]);
      if (missing.length) return fail('Player-own elapsed helper module shape changed.', { verification: 'STATIC_CONTRACT', missing });
      return pass('Player-own elapsed helper module is the canonical scoring/display time source.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('online_popup_failure_copy_uses_kronox_wording',
    'Popup failure copy uses "Puan kaydedilemedi. Tekrar dene." per product spec',
    () => {
      const src = safeStr(gameSource);
      if (!src.includes('Puan kaydedilemedi. Tekrar dene.')) {
        return fail('Failure copy does not match product wording.', { verification: 'STATIC_CONTRACT' });
      }
      return pass('Failure copy matches product wording.', { verification: 'STATIC_CONTRACT' });
    }),
];