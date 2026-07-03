// Kronox Health Center — unified player-facing Puan language.
//
// SCOPE
//   Kronox has one user-facing score language: Puan / Kronox Puan.
//   Solo and Online remain technical scoring components, but visible UI
//   must not present them as separate score systems.

import leaderboardPageSource from '../../pages/LeaderboardPage.jsx?raw';
import rankingSectionSource from '../leaderboard/KronoxRankingSection.jsx?raw';
import gameSource from '../../pages/Game.jsx?raw';
import gameOverSource from './GameOver.jsx?raw';
import mainMenuSource from '../../pages/MainMenu.jsx?raw';
import profilePageSource from '../../pages/ProfilePage.jsx?raw';
import soloChallengeSource from '../../pages/SoloChallenge.jsx?raw';
import onlineChallengeSource from '../lobby/OnlineChallengeScreen.jsx?raw';
import screenHeaderSource from '../layout/ScreenHeader.jsx?raw';
import { SCORING_RULES_DOC as scoringRulesSource } from '@/lib/scoringRulesDoc';
import leaderboardLibSource from '../../lib/leaderboard.js?raw';
import kronoxScoreSource from '../../lib/kronoxScore.js?raw';
// Codex169 — Read the backend leaderboard projection contract from the
// src-resident mirror (the real functions/ file is outside src/, so a
// `?raw` import returns empty here and false-fails the token scan).
import { GET_SOLO_LEADERBOARD_SOURCE as leaderboardFunctionSource } from '@/lib/healthMirrors/getSoloLeaderboardMirror';
import applyOnlineResultSource from '../../lib/applyOnlineResult.js?raw';

const STATUS = { PASS: 'PASS', FAIL: 'FAIL' };
const ACTION_TYPES = { CODE_FIX: 'CODE_FIX' };
const SUITE_ID = 'unified_kronox_score_health';
const SUITE_NAME = 'Unified Kronox Score Language Suite';

const UI_SOURCES = {
  LeaderboardPage: leaderboardPageSource,
  KronoxRankingSection: rankingSectionSource,
  Game: gameSource,
  GameOver: gameOverSource,
  MainMenu: mainMenuSource,
  ProfilePage: profilePageSource,
  SoloChallenge: soloChallengeSource,
  OnlineChallengeScreen: onlineChallengeSource,
  ScreenHeader: screenHeaderSource,
};

const FORBIDDEN_VISIBLE_COPY = [
  'Solo puanın artık',
  'solo puanına göre',
  '>Solo Puan<',
  '"Solo Puan"',
  "'Solo Puan'",
  'Online puan kaydediliyor',
  '>Online Puan<',
  '"Online Puan"',
  "'Online Puan'",
  'Online skorun',
  'Solo skorun',
];

function safeStr(src) {
  if (src == null) return '';
  if (typeof src === 'string') return src;
  try { return String(src); } catch { return ''; }
}

function pass(reason, extra = {}) { return { status: STATUS.PASS, reason, ...extra }; }
function fail(reason, extra = {}) { return { status: STATUS.FAIL, reason, ...extra }; }

function missingTokens(source, tokens) {
  const src = safeStr(source);
  return tokens.filter((token) => !src.includes(token));
}

function findForbiddenCopy(sources, tokens) {
  return Object.entries(sources).flatMap(([file, source]) => {
    const src = safeStr(source);
    return tokens
      .filter((token) => src.includes(token))
      .map((token) => ({ file, token }));
  });
}

function makeCase(id, name, run, options = {}) {
  return {
    key: `${SUITE_ID}.${id}`,
    suiteId: SUITE_ID,
    suiteName: SUITE_NAME,
    id,
    name,
    critical: options.critical ?? true,
    actionType: options.actionType || ACTION_TYPES.CODE_FIX,
    nextStep: options.nextStep || 'Keep visible score copy unified as Puan / Kronox Puan.',
    ...options,
    run,
  };
}

export const EXTRA_SUITES = [
  { id: SUITE_ID, name: SUITE_NAME, critical: true, color: '#f59e0b' },
];

export const EXTRA_TESTS = [
  makeCase('visible_copy_uses_unified_puan_language',
    'User-facing score copy uses unified Puan language',
    () => {
      const offenders = findForbiddenCopy(UI_SOURCES, FORBIDDEN_VISIBLE_COPY);
      if (offenders.length) {
        return fail('Visible UI still exposes separate Solo/Online Puan wording.', {
          verification: 'STATIC_CONTRACT',
          actual: offenders,
        });
      }
      return pass('Visible score UI avoids separate Solo/Online Puan labels.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('leaderboard_description_uses_unified_puan_language',
    'Liderlik avoids separate Solo/Online score copy while showing unified Puan rows',
    () => {
      const missing = missingTokens(`${leaderboardPageSource}\n${rankingSectionSource}`, [
        'row.summary.totalKronoxScore',
        'Puan',
      ]);
      const offenders = findForbiddenCopy({ LeaderboardPage: leaderboardPageSource, KronoxRankingSection: rankingSectionSource }, [
        'Solo puanın artık',
        'solo puanına göre',
        '>Solo Puan<',
        'Kronox Puanın Solo ve Online sonuçlarınla güncellenir.',
      ]);
      if (missing.length || offenders.length) {
        return fail('Liderlik unified Puan row copy/source drifted or the removed old description returned.', {
          verification: 'STATIC_CONTRACT',
          actual: { missing, offenders },
        });
      }
      return pass('Liderlik rows/current-user card use unified Puan without separate Solo/Online labels or the removed old description.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('result_popup_uses_unified_puan_language',
    'Online result popup uses unified Puan wording',
    () => {
      const missing = missingTokens(gameOverSource, [
        'Kazandığın Puan:',
        'Kaybettiğin Puan:',
        'Yeni Kronox Puanın:',
      ]);
      const offenders = findForbiddenCopy({ GameOver: gameOverSource }, [
        'Online Puan',
        'Online skor',
        'Yeni Online Puanın',
      ]);
      if (missing.length || offenders.length) {
        return fail('Online result popup does not use unified Puan copy.', {
          verification: 'STATIC_CONTRACT',
          actual: { missing, offenders },
        });
      }
      return pass('Online result popup uses gained/lost/new Kronox Puan language.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('online_result_has_no_speed_bonus',
    'Online result popup and scoring docs remove speed bonus',
    () => {
      const missing = missingTokens(`${gameOverSource}\n${scoringRulesSource}`, [
        'Kazandığın Puan:',
        'Kaybettiğin Puan:',
        'Online has no speed bonus',
        'winner scoring is exactly +15',
        'loser scoring is exactly -6',
      ]);
      const offenders = findForbiddenCopy({ GameOver: gameOverSource }, [
        'Hız Bonusu',
      ]);
      if (missing.length || offenders.length) {
        return fail('Online speed bonus wording or missing flat +15/-6 contract can drift unified Puan UI.', {
          verification: 'STATIC_CONTRACT',
          actual: { missing, offenders },
        });
      }
      return pass('Online result UI and docs expose flat +15/-6 scoring without speed bonus.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('technical_docs_allow_components_but_ui_is_unified',
    'Docs allow technical components while UI remains unified',
    () => {
      const missing = missingTokens(scoringRulesSource, [
        'Kronox has one player-facing score language',
        'Visible UI must use **Puan** or **Kronox Puan**',
        'Internally, two scoring components feed that visible score',
      ]);
      if (missing.length) {
        return fail('Scoring docs do not document the unified visible Puan contract.', {
          verification: 'STATIC_CONTRACT',
          missing,
        });
      }
      return pass('Docs separate technical Solo/Online components from user-facing unified Puan copy.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('no_separate_visible_online_score_label',
    'No visible Online Puan label remains',
    () => {
      const offenders = findForbiddenCopy(UI_SOURCES, [
        '>Online Puan<',
        '"Online Puan"',
        "'Online Puan'",
        'Online puan kaydediliyor',
        'Online skorun',
      ]);
      if (offenders.length) {
        return fail('Visible UI still has Online Puan/Online skor copy.', {
          verification: 'STATIC_CONTRACT',
          actual: offenders,
        });
      }
      return pass('Visible UI does not expose a separate Online Puan label.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('leaderboard_row_uses_unified_puan',
    'Leaderboard row score uses unified Kronox Puan',
    () => {
      const missing = missingTokens(`${leaderboardLibSource}\n${rankingSectionSource}`, [
        'total_kronox_score',
        'summary.totalKronoxScore',
        'row.summary.totalKronoxScore',
      ]);
      if (missing.length) {
        return fail('Leaderboard rows can still display Solo-only score instead of unified Kronox Puan.', {
          verification: 'STATIC_CONTRACT',
          missing,
        });
      }
      return pass('Leaderboard rows display summary.totalKronoxScore.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('leaderboard_top_and_row_score_same_source',
    'Leaderboard current-user card, row, and fallback score use the same unified source',
    () => {
      const missing = missingTokens(`${leaderboardPageSource}\n${leaderboardLibSource}\n${rankingSectionSource}`, [
        'getKronoxVisibleScore(user',
        'withCurrentTotalKronoxScore',
        'total_kronox_score: totalKronoxScore',
        'totalKronoxScore: getKronoxVisibleScore(user',
        'getKronoxVisibleScore(leaderboardPlayer',
        'total_kronox_score: totalKronoxScore',
        'row.summary.totalKronoxScore',
        'ownScore?.totalKronoxScore',
        'Senin Sıran',
      ]);
      if (missing.length) {
        return fail('Liderlik current-user card, row, and fallback are not tied to the same unified Puan source.', {
          verification: 'STATIC_CONTRACT',
          missing,
        });
      }
      return pass('Liderlik row, current-user card, and own fallback share unified Kronox Puan.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('materialized_kronox_puan_is_primary_read_path',
    'Visible Kronox Puan reads the materialized current-score projection first',
    () => {
      const missing = missingTokens(`${kronoxScoreSource}\n${leaderboardLibSource}\n${leaderboardFunctionSource}\n${applyOnlineResultSource}`, [
        'getMaterializedKronoxScore',
        'user?.kronox_puan_total',
        'kronoxPuan = kronox_puan_total',
        'materialized === null ? derived : Math.max(materialized, derived)',
        'total_kronox_score',
        'User.list(\'-kronox_puan_total\', limit)',
        'projectionEntity.list(\'-total_kronox_score\', limit)',
        'kronox_puan_total: buildSoloLeaderboardPayload',
      ]);
      if (missing.length) {
        return fail('Visible score reads can drift back to derived-only progress/history reconstruction instead of the materialized current score.', {
          verification: 'STATIC_CONTRACT',
          missing,
        });
      }
      return pass('Visible Puan prefers User.kronox_puan_total and leaderboard reads sorted projection rows; ledgers/history remain audit/idempotency paths.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('leaderboard_sort_score_matches_display_score',
    'Leaderboard sort key matches displayed row score',
    () => {
      const missing = missingTokens(`${leaderboardLibSource}\n${rankingSectionSource}`, [
        'scoreDiff = b.summary.totalKronoxScore - a.summary.totalKronoxScore',
        'row.summary.totalKronoxScore',
      ]);
      if (missing.length) {
        return fail('Leaderboard could sort by a different score than it displays.', {
          verification: 'STATIC_CONTRACT',
          missing,
        });
      }
      return pass('Leaderboard sort key and displayed score both use totalKronoxScore.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('online_delta_reflected_in_leaderboard_rows',
    'Online delta is included in leaderboard row Puan',
    () => {
      const missing = missingTokens(`${leaderboardLibSource}\n${leaderboardFunctionSource}\n${kronoxScoreSource}`, [
        'online_score',
        'online_progress?.score',
        'getKronoxVisibleScore(user',
        'getSoloProgressScore(user, options) + getOnlineProgressScore(user)',
        'totalKronoxScore = summary.totalSoloScore + onlineScore',
      ]);
      if (missing.length) {
        return fail('Online progress score is not included in leaderboard row projection.', {
          verification: 'STATIC_CONTRACT',
          missing,
        });
      }
      return pass('Frontend and backend leaderboard projections add Online score to Solo component.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('profile_and_leaderboard_current_user_puan_match',
    'Profile Puan and current-user leaderboard row Puan match',
    () => {
      const missing = missingTokens(`${profilePageSource}\n${leaderboardPageSource}\n${leaderboardLibSource}`, [
        'getKronoxVisibleScore(user',
        'totalKronoxScore: getKronoxVisibleScore(user',
        'getKronoxVisibleScore(leaderboardPlayer',
        'total_kronox_score: totalKronoxScore',
      ]);
      if (missing.length) {
        return fail('Profile and current-user leaderboard row can drift from the unified Puan helper.', {
          verification: 'STATIC_CONTRACT',
          missing,
        });
      }
      return pass('Profile stats and current-user leaderboard row are wired to unified Kronox Puan.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('leaderboard_entry_not_solo_only_when_visible_puan',
    'Visible leaderboard rows do not use Solo-only totals',
    () => {
      const offenders = findForbiddenCopy({ KronoxRankingSection: rankingSectionSource }, [
        'row.summary.totalSoloScore',
      ]);
      const missing = missingTokens(leaderboardLibSource, [
        'totalKronoxScore',
        'onlineScore',
      ]);
      if (offenders.length || missing.length) {
        return fail('Visible leaderboard row still depends on Solo-only totalSoloScore.', {
          verification: 'STATIC_CONTRACT',
          actual: { offenders, missing },
        });
      }
      return pass('Visible leaderboard row uses unified totalKronoxScore, not totalSoloScore alone.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('leaderboard_publish_runs_after_online_score_change',
    'Online score persistence refreshes leaderboard-safe row',
    () => {
      const missing = missingTokens(applyOnlineResultSource, [
        'publishLeaderboardAfterOnlineScore',
        'publishSoloLeaderboardEntry',
        'refreshedUser || { ...me, online_progress: payload.online_progress }',
      ]);
      if (missing.length) {
        return fail('Online score changes may not refresh the leaderboard-safe row.', {
          verification: 'STATIC_CONTRACT',
          missing,
        });
      }
      return pass('Online score persistence best-effort publishes the refreshed leaderboard-safe row.', { verification: 'STATIC_CONTRACT' });
    }),
];
