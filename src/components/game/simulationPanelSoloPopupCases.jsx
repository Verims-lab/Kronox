// Solo level-end result screen UI contracts (redesign pass).
//
// SCOPE
//   These cases lock the redesigned Solo level-end success/failure screens:
//     • Success title uses "SEVİYE TAMAMLANDI!" and failure uses
//       "SEVİYE GEÇİLEMEDİ!".
//     • Success metrics are SÜRE / HAMLE / PUAN; failure metrics are
//       SÜRE / TAMAMLANAN / HAMLE.
//     • Success shows "Hız Bonusu +X" ONLY when a speed bonus was earned
//       (timeBonus > 0 guard) — never unconditionally.
//     • Success screen does NOT render failure-only continuation
//       ("OYNAMAYA DEVAM ET" / "ÜCRETSİZ").
//     • Failure continuation cards do NOT grant client-only continuation:
//       no real rewarded-ad SDK, no diamond mutation from the screen.
//     • Both screens honor prefers-reduced-motion.
//     • Both screens keep the shared MM:SS time formatter.
//     • Public popup prop contracts the parent depends on are intact.
//   Game logic / scoring / stars are NOT changed — the cases below only
//   inspect import + JSX/label/value strings.

import successSource from './SoloSuccessPopup.jsx?raw';
import failureSource from './SoloFailureCard.jsx?raw';
import metricCardSource from './SoloResultMetricCard.jsx?raw';
import timeFormatSource from '../../lib/soloTimeFormat.js?raw';

const STATUS = { PASS: 'PASS', FAIL: 'FAIL' };
const ACTION_TYPES = { CODE_FIX: 'CODE_FIX' };
const SUITE_ID = 'solo_result_popup_ui';
const SUITE_NAME = 'Solo Result Popup UI Suite';

function safeStr(src) {
  if (src == null) return '';
  if (typeof src === 'string') return src;
  try { return String(src); } catch { return ''; }
}

function pass(reason, extra = {}) { return { status: STATUS.PASS, reason, ...extra }; }
function fail(reason, extra = {}) { return { status: STATUS.FAIL, reason, ...extra }; }

function missingTokens(source, tokens) {
  const src = safeStr(source);
  return tokens.filter((t) => !src.includes(t));
}

function forbiddenTokensFound(source, tokens) {
  const src = safeStr(source);
  return tokens.filter((t) => src.includes(t));
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
    nextStep: options.nextStep || 'Keep the Solo level-end screens aligned with the redesign contract.',
    ...options,
    run,
  };
}

export const EXTRA_SUITES = [
  { id: SUITE_ID, name: SUITE_NAME, critical: true, color: '#3b82f6' },
];

export const EXTRA_TESTS = [
  makeCase('success_screen_completed_structure',
    'Success screen uses SEVİYE TAMAMLANDI title with SÜRE/HAMLE/PUAN metrics',
    () => {
      const missing = missingTokens(successSource, [
        '. SEVİYE TAMAMLANDI!',
        'label="SÜRE"',
        'label="HAMLE"',
        'label="PUAN"',
      ]);
      if (missing.length) {
        return fail('Success level-end screen structure drifted from the redesign.', {
          verification: 'STATIC_CONTRACT',
          file: 'components/game/SoloSuccessPopup.jsx',
          actual: { missing },
        });
      }
      return pass('Success screen shows the completed title and SÜRE/HAMLE/PUAN metrics.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('failure_screen_failed_structure',
    'Failure screen uses SEVİYE GEÇİLEMEDİ title with SÜRE/TAMAMLANAN/HAMLE metrics',
    () => {
      const missing = missingTokens(failureSource, [
        '. SEVİYE GEÇİLEMEDİ!',
        'label="SÜRE"',
        'label="TAMAMLANAN"',
        'label="HAMLE"',
        'Yeniden denemeye ne dersin?',
      ]);
      if (missing.length) {
        return fail('Failure level-end screen structure drifted from the redesign.', {
          verification: 'STATIC_CONTRACT',
          file: 'components/game/SoloFailureCard.jsx',
          actual: { missing },
        });
      }
      return pass('Failure screen shows the failed title, message and SÜRE/TAMAMLANAN/HAMLE metrics.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('success_speed_bonus_conditional',
    'Success speed bonus row is guarded by timeBonus > 0',
    () => {
      const src = safeStr(successSource);
      const hasGuard = /speedBonusEarned\s*=\s*Number\(timeBonus\)\s*>\s*0/.test(src)
        && /speedBonusEarned\s*\?/.test(src)
        && src.includes('Hız Bonusu');
      if (!hasGuard) {
        return fail('Success screen does not gate the "Hız Bonusu" row behind an earned speed bonus.', {
          verification: 'STATIC_CONTRACT',
          file: 'components/game/SoloSuccessPopup.jsx',
          actual: { hasGuard },
        });
      }
      return pass('Speed bonus row only renders when timeBonus > 0.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('success_screen_no_failure_continuation',
    'Success screen does not render failure-only continuation options',
    () => {
      const forbidden = forbiddenTokensFound(successSource, [
        'OYNAMAYA DEVAM ET',
        'ÜCRETSİZ',
        'ContinuationCard',
      ]);
      if (forbidden.length) {
        return fail('Success screen leaked failure-only continuation UI.', {
          verification: 'STATIC_CONTRACT',
          file: 'components/game/SoloSuccessPopup.jsx',
          actual: { forbidden },
        });
      }
      return pass('Success screen has no continuation UI.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('failure_continuation_is_safe_disabled',
    'Failure continuation grants nothing: no rewarded-ad SDK, no diamond mutation',
    () => {
      const src = safeStr(failureSource);
      // The continuation cards must be visually present but must not wire
      // any real grant/mutation flow while none exists in the project.
      const showsCards = src.includes('OYNAMAYA DEVAM ET')
        && src.includes('ÜCRETSİZ')
        && src.includes('aria-disabled="true"');
      const forbidden = forbiddenTokensFound(src, [
        'AdMob', 'rewardedAd', 'RewardedAd', 'loadAd',
        'DiamondTransaction', 'purchaseJoker', 'updateMe(', 'entities.User.update',
        'grantContinuation', 'onContinue',
      ]);
      if (!showsCards || forbidden.length) {
        return fail('Failure continuation cards are missing or wire an unsafe/fake continuation flow.', {
          verification: 'STATIC_CONTRACT',
          file: 'components/game/SoloFailureCard.jsx',
          actual: { showsCards, forbidden },
        });
      }
      return pass('Continuation cards are shown disabled with no ad SDK and no economy mutation.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('level_end_respects_reduced_motion',
    'Both level-end screens honor prefers-reduced-motion',
    () => {
      const successMissing = missingTokens(successSource, ['useReducedMotion', 'reduceMotion']);
      const failureMissing = missingTokens(failureSource, ['useReducedMotion', 'reduceMotion']);
      if (successMissing.length || failureMissing.length) {
        return fail('A level-end screen no longer branches on reduced motion.', {
          verification: 'STATIC_CONTRACT',
          files: ['components/game/SoloSuccessPopup.jsx', 'components/game/SoloFailureCard.jsx'],
          actual: { successMissing, failureMissing },
        });
      }
      return pass('Both screens read useReducedMotion and adjust their animation.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('shared_compact_duration_used',
    'Both screens use the shared compact MM:SS time formatter',
    () => {
      const formatterMissing = missingTokens(timeFormatSource, [
        'export function formatCompactDuration',
        ".padStart(2, '0')",
      ]);
      const successMissing = missingTokens(successSource, [
        "from '@/lib/soloTimeFormat'",
        'formatCompactDuration(timeSeconds)',
      ]);
      const failureMissing = missingTokens(failureSource, [
        "from '@/lib/soloTimeFormat'",
        'formatCompactDuration(timeSeconds)',
      ]);
      if (formatterMissing.length || successMissing.length || failureMissing.length) {
        return fail('Compact MM:SS time formatter is not wired into both screens.', {
          verification: 'STATIC_CONTRACT',
          files: ['lib/soloTimeFormat.js', 'components/game/SoloSuccessPopup.jsx', 'components/game/SoloFailureCard.jsx'],
          actual: { formatterMissing, successMissing, failureMissing },
        });
      }
      return pass('Both screens format time as MM:SS via the shared helper.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('shared_metric_card_used',
    'Both screens use the shared SoloResultMetricCard component',
    () => {
      const cardMissing = missingTokens(metricCardSource, ['export default function SoloResultMetricCard']);
      const successMissing = missingTokens(successSource, [
        "import SoloResultMetricCard from './SoloResultMetricCard'",
        '<SoloResultMetricCard',
      ]);
      const failureMissing = missingTokens(failureSource, [
        "import SoloResultMetricCard from './SoloResultMetricCard'",
        '<SoloResultMetricCard',
      ]);
      if (cardMissing.length || successMissing.length || failureMissing.length) {
        return fail('A level-end screen is not using the shared SoloResultMetricCard.', {
          verification: 'STATIC_CONTRACT',
          files: ['components/game/SoloResultMetricCard.jsx', 'components/game/SoloSuccessPopup.jsx', 'components/game/SoloFailureCard.jsx'],
          actual: { cardMissing, successMissing, failureMissing },
        });
      }
      return pass('Both level-end screens use the shared SoloResultMetricCard.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('popup_prop_contracts_unchanged',
    'Level-end screen public prop contracts are intact',
    () => {
      const successProps = ['levelNumber', 'stars', 'usedMoves', 'timeSeconds', 'levelScore', 'timeBonus', 'hasNextLevel', 'onNextLevel', 'onRetry', 'onBackToPath'];
      const failureProps = ['levelNumber', 'usedMoves', 'timeSeconds', 'cardsCompleted', 'cardTarget', 'failReason', 'onRetry', 'onBackToPath'];
      const successMissing = successProps.filter((p) => !successSource.includes(p));
      const failureMissing = failureProps.filter((p) => !failureSource.includes(p));
      if (successMissing.length || failureMissing.length) {
        return fail('A level-end screen public prop contract changed.', {
          verification: 'STATIC_CONTRACT',
          files: ['components/game/SoloSuccessPopup.jsx', 'components/game/SoloFailureCard.jsx'],
          actual: { successMissing, failureMissing },
        });
      }
      return pass('Public props (levelNumber/stars/usedMoves/score/cardsCompleted/...) are intact.', { verification: 'STATIC_CONTRACT' });
    }),
];