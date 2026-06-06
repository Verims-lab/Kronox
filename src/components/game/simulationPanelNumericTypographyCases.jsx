// Kronox Health Center — Numeric typography contracts.
//
// Locks the global numeric readability split:
//   - timeline-visible years use Bebas Neue via kronox-timeline-number
//   - all other major numeric UI surfaces use Inter SemiBold via kronox-number
//
// These are static contracts only. Pixel-level mobile proof remains manual.

import indexCssSource from '../../index.css?raw';
import timelineSource from './Timeline.jsx?raw';
import timelineCardSource from './TimelineCard.jsx?raw';
import gameLayoutSource from './GameLayout.jsx?raw';
import turnTimerSource from './TurnTimer.jsx?raw';
import soloLevelTimerSource from './SoloLevelTimer.jsx?raw';
import soloJokerBarSource from './SoloJokerBar.jsx?raw';
import soloStatCardSource from './SoloStatCard.jsx?raw';
import statTileSource from '../ui/KronoxStatTile.jsx?raw';
import standardTopBarSource from '../layout/StandardTopBar.jsx?raw';
import screenHeaderSource from '../layout/ScreenHeader.jsx?raw';
import leaderboardSectionSource from '../leaderboard/KronoxRankingSection.jsx?raw';
import dailyWheelCardSource from '../dailyWheel/DailyWheelCard.jsx?raw';
import simulationPanelSource from './SimulationPanel.jsx?raw';
import simulationSuiteSummarySource from './health/SimulationSuiteSummary.jsx?raw';

const STATUS = {
  PASS: 'PASS',
  FAIL: 'FAIL',
  NOT_AUTOMATABLE: 'NOT_AUTOMATABLE',
};

const ACTION_TYPES = {
  CODE_FIX: 'CODE_FIX',
  DEVICE_TEST: 'DEVICE_TEST',
};

const SUITE_ID = 'numeric_typography_health';
const SUITE_NAME = 'Numeric Typography Health Suite';

function makeCase(id, name, run, options = {}) {
  return {
    key: `${SUITE_ID}.${id}`,
    suiteId: SUITE_ID,
    suiteName: SUITE_NAME,
    id,
    name,
    critical: options.critical ?? false,
    actionType: options.actionType || ACTION_TYPES.CODE_FIX,
    ...options,
    run,
  };
}

function pass(reason, extra) { return { status: STATUS.PASS, reason, ...(extra || {}) }; }
function fail(reason, extra) { return { status: STATUS.FAIL, reason, ...(extra || {}) }; }
function notAutomatable(reason, extra) {
  return { status: STATUS.NOT_AUTOMATABLE, reason, ...(extra || {}) };
}

function missingTokens(source, tokens) {
  return tokens.filter((token) => !String(source || '').includes(token));
}

export const EXTRA_SUITES = [
  { id: SUITE_ID, name: SUITE_NAME, critical: false, color: '#facc15' },
];

export const EXTRA_TESTS = [
  makeCase(
    'shared_numeric_font_tokens_exist',
    'Shared numeric font tokens define Inter SemiBold and timeline Bebas Neue',
    () => {
      const missing = missingTokens(indexCssSource, [
        '--font-bebas',
        "'Bebas Neue'",
        '.kronox-number',
        'font-weight: 600',
        '.kronox-timeline-number',
        'font-family: var(--font-bebas)',
        'font-variant-numeric: tabular-nums',
      ]);
      if (missing.length) return fail('Shared numeric font tokens are incomplete.', {
        verification: 'STATIC_CONTRACT',
        file: 'src/index.css',
        expected: 'kronox-number = Inter SemiBold; kronox-timeline-number = Bebas Neue timeline years',
        actual: { missing },
      });
      return pass('Shared numeric font tokens exist for Inter SemiBold and timeline Bebas Neue.', {
        verification: 'STATIC_CONTRACT',
      });
    },
  ),

  makeCase(
    'timeline_years_use_bebas_token',
    'Timeline-visible year numbers use the Bebas Neue timeline token',
    () => {
      const missing = [
        ...missingTokens(timelineCardSource, ['kronox-timeline-number']),
        ...missingTokens(timelineSource, ['kronox-timeline-number']),
      ];
      if (missing.length) return fail('Timeline year surfaces are not using the timeline numeric token.', {
        verification: 'STATIC_CONTRACT',
        files: ['components/game/TimelineCard.jsx', 'components/game/Timeline.jsx'],
        expected: 'Timeline card years and remaining timeline year labels use kronox-timeline-number',
        actual: { missing },
      });
      return pass('Timeline card years and timeline year labels use kronox-timeline-number.', {
        verification: 'STATIC_CONTRACT',
      });
    },
  ),

  makeCase(
    'gameplay_general_numbers_use_inter_token',
    'Gameplay timer, progress, joker badges, and result stats use the general numeric token',
    () => {
      const checks = [
        ['TurnTimer.jsx', turnTimerSource],
        ['SoloLevelTimer.jsx', soloLevelTimerSource],
        ['GameLayout.jsx', gameLayoutSource],
        ['SoloJokerBar.jsx', soloJokerBarSource],
        ['SoloStatCard.jsx', soloStatCardSource],
      ].map(([file, source]) => ({ file, missing: missingTokens(source, ['kronox-number']) }))
        .filter((item) => item.missing.length);
      if (checks.length) return fail('A gameplay numeric surface is missing kronox-number.', {
        verification: 'STATIC_CONTRACT',
        expected: 'Timer/progress/joker badge/result stat numbers use Inter SemiBold via kronox-number',
        actual: checks,
      });
      return pass('Gameplay non-timeline numeric surfaces use kronox-number.', {
        verification: 'STATIC_CONTRACT',
      });
    },
  ),

  makeCase(
    'economy_leaderboard_health_numbers_use_inter_token',
    'Economy/profile/leaderboard/Health numeric values use the general numeric token',
    () => {
      const checks = [
        ['KronoxStatTile.jsx', statTileSource],
        ['StandardTopBar.jsx', standardTopBarSource],
        ['ScreenHeader.jsx', screenHeaderSource],
        ['KronoxRankingSection.jsx', leaderboardSectionSource],
        ['DailyWheelCard.jsx', dailyWheelCardSource],
        ['SimulationPanel.jsx', simulationPanelSource],
        ['SimulationSuiteSummary.jsx', simulationSuiteSummarySource],
      ].map(([file, source]) => ({ file, missing: missingTokens(source, ['kronox-number']) }))
        .filter((item) => item.missing.length);
      if (checks.length) return fail('A major non-gameplay numeric surface is missing kronox-number.', {
        verification: 'STATIC_CONTRACT',
        expected: 'Puan/Elmas/level/rank/reward/Health counts use Inter SemiBold via kronox-number',
        actual: checks,
      });
      return pass('Profile/economy/leaderboard/Daily Wheel/Health numeric surfaces use kronox-number.', {
        verification: 'STATIC_CONTRACT',
      });
    },
  ),

  makeCase(
    'numeric_typography_requires_mobile_visual_review',
    'Numeric typography remains mobile visual proof, not a fake static PASS',
    () => notAutomatable('Static source checks cannot prove glyph clarity, no overflow, or 7/1 readability on real mobile devices. Manual screenshots are still required for gameplay, result popup, profile, leaderboard, and Daily Wheel.', {
      verification: 'MANUAL_VISUAL_PROOF_REQUIRED',
      actionType: ACTION_TYPES.DEVICE_TEST,
      runtimeProofRequired: true,
      manualSteps: [
        'Open Solo gameplay and verify timeline years use Bebas Neue while timer/progress/joker badge use Inter SemiBold.',
        'Open the Solo result popup and verify time/score/mistake numbers use Inter SemiBold.',
        'Open Profile, Liderlik, Daily Wheel, and Health Center to verify numbers do not overflow and 7/1 are distinguishable.',
      ],
    }),
    { actionType: ACTION_TYPES.DEVICE_TEST },
  ),
];
