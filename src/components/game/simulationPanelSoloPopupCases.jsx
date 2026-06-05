// Codex164 — Solo Result Popup UI contracts.
//
// SCOPE
//   These cases lock the visual/typography fixes from the UI correction
//   pass:
//     • Success + Failure popups share the same SoloStatCard component.
//     • Both popups use the shared compact MM:SS time formatter.
//     • The verbose "2 DAK 0 SANİYE" format is gone from the failure
//       popup (no formatDuration import).
//     • The shared SoloStatCard label allows two-line wrapping (no
//       truncate / no force one-line) for labeled cards.
//     • Both popups use TimerReset (not Clock) for the time icon.
//     • Game logic / scoring / stars / props are NOT changed — the
//       cases below only inspect import + JSX/label/value strings.

import successSource from './SoloSuccessPopup.jsx?raw';
import failureSource from './SoloFailureCard.jsx?raw';
import statCardSource from './SoloStatCard.jsx?raw';
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
    nextStep: options.nextStep || 'Keep Solo popup typography/layout aligned with the UI correction pass.',
    ...options,
    run,
  };
}

export const EXTRA_SUITES = [
  { id: SUITE_ID, name: SUITE_NAME, critical: true, color: '#3b82f6' },
];

export const EXTRA_TESTS = [
  makeCase('shared_solo_stat_card_used',
    'Both popups use the shared SoloStatCard component',
    () => {
      const successMissing = missingTokens(successSource, [
        "import SoloStatCard from './SoloStatCard'",
        '<SoloStatCard',
      ]);
      const failureMissing = missingTokens(failureSource, [
        "import SoloStatCard from './SoloStatCard'",
        '<SoloStatCard',
      ]);
      if (successMissing.length || failureMissing.length) {
        return fail('A Solo result popup is no longer using the shared SoloStatCard.', {
          verification: 'STATIC_CONTRACT',
          files: ['components/game/SoloSuccessPopup.jsx', 'components/game/SoloFailureCard.jsx'],
          actual: { successMissing, failureMissing },
        });
      }
      return pass('Both Solo result popups use the shared SoloStatCard.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('shared_compact_duration_used',
    'Both popups use the shared compact MM:SS time formatter',
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
        return fail('Compact MM:SS time formatter is not wired into both popups.', {
          verification: 'STATIC_CONTRACT',
          files: ['lib/soloTimeFormat.js', 'components/game/SoloSuccessPopup.jsx', 'components/game/SoloFailureCard.jsx'],
          actual: { formatterMissing, successMissing, failureMissing },
        });
      }
      return pass('Both popups format time as MM:SS via the shared helper.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('failure_popup_timeout_has_no_maximum_footer',
    'Failure timeout state does not show a non-record Maksimum footer',
    () => {
      const forbidden = forbiddenTokensFound(failureSource, [
        'Maksimum',
        'maxTimeSeconds',
        'formatCompactDuration(maxTimeSeconds)',
      ]);
      if (forbidden.length) {
        return fail('Failure popup still shows or computes the old non-record maximum-time footer.', {
          verification: 'STATIC_CONTRACT',
          file: 'components/game/SoloFailureCard.jsx',
          actual: { forbidden },
        });
      }
      return pass('Failure popup keeps the time card clean; record-style footer copy remains success-only.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('failure_popup_no_longer_uses_verbose_duration',
    'Failure popup no longer imports GameOverTimer.formatDuration',
    () => {
      const src = safeStr(failureSource);
      // Verbose formatter would surface as either the import or the
      // call site. The compact formatter call must be the only one.
      const stillImports = /from\s+'\.\/GameOverTimer'/.test(src) && /\bformatDuration\b/.test(src);
      const stillCallsVerbose = /\bformatDuration\(/.test(src);
      if (stillImports || stillCallsVerbose) {
        return fail('Failure popup still references the verbose "2 DAK 0 SANİYE" formatter.', {
          verification: 'STATIC_CONTRACT',
          file: 'components/game/SoloFailureCard.jsx',
          actual: { stillImports, stillCallsVerbose },
        });
      }
      return pass('Failure popup uses only the shared compact MM:SS formatter.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('shared_stat_card_label_wraps_not_truncates',
    'SoloStatCard label wraps to a second line instead of truncating',
    () => {
      // The label span must NOT use `truncate` (single-line ellipsis)
      // and must allow normal whitespace + overflow-wrap so
      // short labels like "HIZ BONUSU" can still break when needed.
      const src = safeStr(statCardSource);
      const usesTruncate = /className="[^"]*\btruncate\b[^"]*"/.test(src);
      const allowsWrap = src.includes("whiteSpace: 'normal'")
        && src.includes("overflowWrap: 'anywhere'");
      if (usesTruncate || !allowsWrap) {
        return fail('SoloStatCard label cannot wrap onto a second line.', {
          verification: 'STATIC_CONTRACT',
          file: 'components/game/SoloStatCard.jsx',
          actual: { usesTruncate, allowsWrap },
        });
      }
      return pass('SoloStatCard label allows two-line wrapping (no truncate).', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('solo_result_short_stat_labels',
    'Solo result popups use short SÜRE/PUAN/HATA stat labels',
    () => {
      const combined = `${successSource}\n${failureSource}`;
      const oldLabels = ['KAZANILAN<br />PUAN', 'KAZANILAN PUAN', 'TOPLAM SÜRE', 'HATA SAYISI'];
      const forbidden = forbiddenTokensFound(combined, oldLabels);
      const required = [
        ...missingTokens(successSource, ['label="SÜRE"', 'label="PUAN"', 'label="HATA"']),
        ...missingTokens(failureSource, ['label="SÜRE"', 'label="PUAN"', 'label="HATA"']),
        ...missingTokens(successSource, ['<UnitLabel color="#facc15">Puan</UnitLabel>', '<UnitLabel color="#fca5a5">Hata</UnitLabel>']),
        ...missingTokens(failureSource, ['<FailureFooter tone="gold">Puan</FailureFooter>', '<FailureFooter tone="red">Hata</FailureFooter>']),
      ];
      if (forbidden.length || required.length) {
        return fail('Solo result popup stat labels drifted from the short-label product decision.', {
          verification: 'STATIC_CONTRACT',
          files: ['components/game/SoloSuccessPopup.jsx', 'components/game/SoloFailureCard.jsx'],
          actual: { forbidden, required },
        });
      }
      return pass('Success and failure popups use SÜRE/PUAN/HATA with compact Puan/Hata unit copy.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('time_icon_is_timer_reset_not_clock',
    'Both popups use the TimerReset icon for the time card',
    () => {
      // The brief asked for a different, clock/time-themed icon. We
      // switched from Clock to TimerReset in both popups. Health locks
      // that swap so a future revert is caught.
      const successUsesTimer = /\bTimerReset\b/.test(successSource)
        && /icon=\{TimerReset\}/.test(successSource);
      const successDroppedClock = !/\bClock\b/.test(successSource);
      const failureUsesTimer = /\bTimerReset\b/.test(failureSource)
        && /icon=\{TimerReset\}/.test(failureSource);
      const failureDroppedClock = !/\bClock\b/.test(failureSource);
      if (!successUsesTimer || !successDroppedClock || !failureUsesTimer || !failureDroppedClock) {
        return fail('A Solo popup still uses the Clock icon for the time card.', {
          verification: 'STATIC_CONTRACT',
          files: ['components/game/SoloSuccessPopup.jsx', 'components/game/SoloFailureCard.jsx'],
          actual: { successUsesTimer, successDroppedClock, failureUsesTimer, failureDroppedClock },
        });
      }
      return pass('Both popups use TimerReset (not Clock) for the time card.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('popup_prop_contracts_unchanged',
    'Popup public prop contracts are unchanged by the UI correction',
    () => {
      // The brief explicitly says: do not change game logic / popup
      // flow / props. Lock the prop names the parent depends on.
      const successProps = ['levelNumber', 'stars', 'mistakes', 'timeSeconds', 'levelScore', 'timeBonus', 'hasNextLevel', 'onNextLevel', 'onRetry', 'onBackToPath'];
      const failureProps = ['levelNumber', 'mistakes', 'timeSeconds', 'levelScore', 'failReason', 'onRetry', 'onBackToPath'];
      const successMissing = successProps.filter((p) => !successSource.includes(p));
      const failureMissing = failureProps.filter((p) => !failureSource.includes(p));
      if (successMissing.length || failureMissing.length) {
        return fail('A popup public prop contract changed during the UI correction.', {
          verification: 'STATIC_CONTRACT',
          files: ['components/game/SoloSuccessPopup.jsx', 'components/game/SoloFailureCard.jsx'],
          actual: { successMissing, failureMissing },
        });
      }
      return pass('Public popup props (levelNumber/stars/mistakes/score/...) are intact.', { verification: 'STATIC_CONTRACT' });
    }),
];
