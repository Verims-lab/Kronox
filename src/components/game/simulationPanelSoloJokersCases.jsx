// Kronox Health Center — Solo joker inventory usage contracts.
//
// Scope: Phase 2 Solo-only joker spending from UserJokerInventory. Runtime
// touch feel, provider delivery, and two-account RLS remain manual proof.

import gameSource from '../../pages/Game.jsx?raw';
import gameLayoutSource from './GameLayout.jsx?raw';
import soloJokerBarSource from './SoloJokerBar.jsx?raw';
import soloTimerSource from './SoloLevelTimer.jsx?raw';
import jokerInventorySource from '../../lib/jokerInventory.js?raw';
import spendUserJokerSource from '../../../base44/functions/spendUserJoker/entry.ts?raw';
import marketPageSource from '../../pages/MarketPage.jsx?raw';
import purchaseJokerWithDiamondsSource from '../../../base44/functions/purchaseJokerWithDiamonds/entry.ts?raw';
import { SOLO_QUESTION_ENGINE_DOC } from '@/lib/soloQuestionEngineDoc';

const STATUS = { PASS: 'PASS', FAIL: 'FAIL', NOT_AUTOMATABLE: 'NOT_AUTOMATABLE' };
const ACTION_TYPES = { CODE_FIX: 'CODE_FIX', HUMAN_RUNTIME_PROOF: 'HUMAN_RUNTIME_PROOF' };
const SUITE_ID = 'solo_jokers_health';
const SUITE_NAME = 'Solo Jokers Health Suite';

function safeStr(src) {
  if (src == null) return '';
  if (typeof src === 'string') return src;
  try { return String(src); } catch { return ''; }
}

function missingTokens(source, tokens) {
  const src = safeStr(source);
  return tokens.filter((token) => !src.includes(token));
}

function forbiddenTokens(source, tokens) {
  const src = safeStr(source);
  return tokens.filter((token) => src.includes(token));
}

function getHandleUseSoloJokerSource() {
  const src = safeStr(gameSource);
  const start = src.indexOf('const handleUseSoloJoker');
  const end = src.indexOf('const handleRestart', start);
  if (start < 0 || end < 0) return '';
  return src.slice(start, end);
}

function pass(reason, extra = {}) { return { status: STATUS.PASS, reason, ...extra }; }
function fail(reason, extra = {}) { return { status: STATUS.FAIL, reason, ...extra }; }
function notAutomatable(reason, extra = {}) { return { status: STATUS.NOT_AUTOMATABLE, reason, ...extra }; }

function makeCase(id, name, run, options = {}) {
  return {
    key: `${SUITE_ID}.${id}`,
    suiteId: SUITE_ID,
    suiteName: SUITE_NAME,
    id,
    name,
    critical: options.critical ?? true,
    actionType: options.actionType || ACTION_TYPES.CODE_FIX,
    nextStep: options.nextStep || 'Keep Solo jokers inventory-backed, Solo-only, one-use-per-card, and ledger-backed.',
    ...options,
    run,
  };
}

export const EXTRA_SUITES = [
  { id: SUITE_ID, name: SUITE_NAME, critical: true, color: '#facc15' },
];

export const EXTRA_TESTS = [
  makeCase('solo_jokers_render_three_options',
    'Solo gameplay renders the three joker options',
    () => {
      const missing = missingTokens(soloJokerBarSource, [
        'Kronokalkan',
        'Kart Değiştir',
        'Zaman Dondur',
        'Shield',
        'RefreshCw',
        'Snowflake',
      ]);
      if (missing.length) return fail('SoloJokerBar lost one or more required joker options.', {
        verification: 'STATIC_CONTRACT',
        file: 'components/game/SoloJokerBar.jsx',
        missing,
      });
      return pass('SoloJokerBar renders Kronokalkan, Kart Değiştir, and Zaman Dondur.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('solo_joker_area_has_no_rectangular_containers',
    'Solo joker area renders circular joker visuals, count badges, and labels',
    () => {
      const missing = missingTokens(soloJokerBarSource, [
        'grid grid-cols-3',
        'max-w-[280px]',
        'gap-0',
        'bg-transparent',
        'rounded-full',
        'clamp(38px, 10.8vw, 44px)',
        'h-5 w-5',
        'absolute -right-1 -top-1',
        'aria-label={`${label}, kalan ${balance}`}',
      ]);
      const forbidden = forbiddenTokens(soloJokerBarSource, [
        'Jokerler • 1 hak',
        'rounded-[26px]',
        'rounded-2xl px-1 py-1.5',
        'background: isUsed',
        'border: isUsed',
      ]);
      if (missing.length || forbidden.length) return fail('SoloJokerBar lost the circle/badge/label contract.', {
        verification: 'STATIC_CONTRACT',
        file: 'components/game/SoloJokerBar.jsx',
        actual: { missing, forbidden },
      });
      return pass('Solo joker UI remains the compact circular icon badge layout.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('solo_jokers_read_inventory_balances',
    'Solo joker buttons read UserJokerInventory balances',
    () => {
      const missing = missingTokens(`${gameSource}\n${gameLayoutSource}\n${soloJokerBarSource}\n${jokerInventorySource}`, [
        'getUserJokerBalances(currentUser, { ensureStarter: true })',
        'setJokerBalances(normalizeJokerBalances',
        'balances={soloJokers?.balances || null}',
        'balances?.[inventoryType]',
        "base44.functions.invoke('ensureUserJokerInventory'",
      ]);
      if (missing.length) return fail('Solo joker UI is not clearly reading persistent user balances.', {
        verification: 'STATIC_CONTRACT',
        files: ['pages/Game.jsx', 'components/game/GameLayout.jsx', 'components/game/SoloJokerBar.jsx', 'src/lib/jokerInventory.js'],
        missing,
      });
      return pass('Solo joker buttons load and display UserJokerInventory balances.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('solo_jokers_display_current_balance_count',
    'Solo joker buttons display current balance counts',
    () => {
      const missing = missingTokens(soloJokerBarSource, [
        'const balance = normalizeJokerQuantity(balances?.[inventoryType])',
        '{balance}',
        'balance <= 0',
        'aria-label={`${label}, kalan ${balance}`}',
      ]);
      if (missing.length) return fail('Solo joker buttons no longer show owned balance counts or disable zero balance.', {
        verification: 'STATIC_CONTRACT',
        file: 'components/game/SoloJokerBar.jsx',
        missing,
      });
      return pass('Solo joker badges show actual owned counts and zero-balance buttons lock.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('old_one_joker_per_level_limit_removed',
    'Old one-joker-per-level limit is removed',
    () => {
      const forbidden = forbiddenTokens(gameSource, [
        'if (!isSoloLevelMode || jokerUsedRef.current || usedJokerType',
        'remainingUses = jokerConsumed ? 0 : 1',
        'Bu level’da joker hakkımı kullandım.',
      ]);
      const missing = missingTokens(gameSource, [
        'soloJokerUsedByDecisionKeyRef',
        'getCurrentSoloJokerDecisionKey',
        'Bu kartta zaten joker kullandın.',
      ]);
      if (forbidden.length || missing.length) return fail('Solo still looks globally limited to one joker per level or lacks per-card keys.', {
        verification: 'STATIC_CONTRACT',
        file: 'pages/Game.jsx',
        actual: { forbidden, missing },
      });
      return pass('The global one-joker-per-level guard is gone; decisions are keyed per current card/question.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('one_joker_per_question_card_guard_exists',
    'One-joker-per-question/card guard exists',
    () => {
      const missing = missingTokens(gameSource, [
        'soloJokerUsedByDecisionKeyRef.current.has(decisionKey)',
        'markSoloJokerUsedForDecision(decisionKey, jokerType)',
        'soloJokerDecisionKeyByQuestionIdRef.current.set(String(replacement.id), decisionKey)',
      ]);
      if (missing.length) return fail('Per-card joker guard is incomplete or Kart Değiştir can reset it.', {
        verification: 'STATIC_CONTRACT',
        file: 'pages/Game.jsx',
        missing,
      });
      return pass('A stable decision key enforces one joker per current card and survives Kart Değiştir replacement.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('current_card_guard_resets_on_next_question',
    'Current-card joker guard resets on next question/card',
    () => {
      const missing = missingTokens(gameSource, [
        'getCurrentSoloJokerDecisionKey(currentQuestion)',
        'const currentCardJoker = soloJokerUsedByDecisionKeyRef.current.get(decisionKey) || null',
        'setUsedJokerType(currentCardJoker)',
      ]);
      if (missing.length) return fail('Game.jsx does not derive used joker UI state from the current card decision key.', {
        verification: 'STATIC_CONTRACT',
        file: 'pages/Game.jsx',
        missing,
      });
      return pass('Joker-used UI state follows the current question/card decision key and resets on new cards.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('spend_requires_positive_balance_and_non_negative_inventory',
    'Joker spend requires positive balance and cannot make balance negative',
    () => {
      const missing = missingTokens(`${gameSource}\n${spendUserJokerSource}`, [
        'balance <= 0',
        'insufficient_joker_balance',
        'quantityBefore <= 0',
        'const balanceAfter = quantityBefore - 1',
        '"minimum": 0',
      ]);
      if (missing.length) return fail('Solo joker spend no longer clearly requires positive balance and non-negative inventory.', {
        verification: 'STATIC_CONTRACT',
        files: ['pages/Game.jsx', 'base44/functions/spendUserJoker/entry.ts'],
        missing,
      });
      return pass('Solo joker spend checks positive balance and writes a non-negative balanceAfter.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('kronokalkan_spends_after_activation_validation',
    'Kronokalkan consumes only after successful activation validation',
    () => {
      const handleSource = getHandleUseSoloJokerSource();
      const missing = missingTokens(handleSource, [
        "jokerType === SOLO_UI_JOKER_TYPES.MISTAKE_SHIELD",
        'if (mistakeShieldActive)',
        'const spent = await spendSoloJokerForCurrentCard(jokerType, decisionKey, currentQuestion.id)',
        'if (!spent) return',
        'markSoloJokerUsedForDecision(decisionKey, jokerType)',
        'setMistakeShieldActive(true)',
      ]);
      if (missing.length) return fail('Kronokalkan does not validate/apply spend before activation as expected.', {
        verification: 'STATIC_CONTRACT',
        file: 'pages/Game.jsx',
        missing,
      });
      return pass('Kronokalkan validates state, spends inventory, then activates shield.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('kronokalkan_next_wrong_not_counted',
    'Kronokalkan absorbs the next wrong placement without incrementing mistakes',
    () => {
      const missing = missingTokens(gameSource, [
        "feedback.result === 'wrong'",
        'if (mistakeShieldActive)',
        'Kronokalkan hatayı engelledi!',
        'setMistakeCount((prev) => prev + 1)',
      ]);
      if (missing.length) return fail('Kronokalkan no longer wraps wrong-feedback mistake counting.', {
        verification: 'STATIC_CONTRACT',
        file: 'pages/Game.jsx',
        missing,
      });
      return pass('Wrong feedback consumes Kronokalkan before mistake count increments.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('kart_degistir_spends_only_after_replacement_exists',
    'Kart Değiştir consumes only after replacement exists',
    () => {
      const handleSource = getHandleUseSoloJokerSource();
      const replacementIdx = handleSource.indexOf('if (!replacement)');
      const spendIdx = handleSource.indexOf('spendSoloJokerForCurrentCard(jokerType, decisionKey, currentQuestion.id)', replacementIdx);
      const missing = missingTokens(handleSource, [
        "jokerType === SOLO_UI_JOKER_TYPES.CARD_SWAP",
        'getOrderedSoloDeckQuestion',
        'if (!replacement)',
        'Bu kart şu anda değiştirilemiyor.',
        'if (!spent) return',
        'current_question_id: replacement.id',
      ]);
      if (missing.length || replacementIdx < 0 || spendIdx < replacementIdx) return fail('Kart Değiştir may spend before proving a replacement exists.', {
        verification: 'STATIC_CONTRACT',
        file: 'pages/Game.jsx',
        actual: { missing, replacementIdx, spendIdx },
      });
      return pass('Kart Değiştir proves a replacement exists before spending and applying replacement.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('kart_degistir_does_not_fetch_mid_attempt',
    'Kart Değiştir does not fetch or rerandomize mid-attempt',
    () => {
      const handleSource = getHandleUseSoloJokerSource();
      const forbidden = ['base44', 'buildSoloAttemptDeck', 'fetch('].filter((token) => handleSource.includes(token));
      if (!handleSource || forbidden.length) return fail('Kart Değiştir handler contains a backend fetch/rebuild token.', {
        verification: 'STATIC_CONTRACT',
        file: 'pages/Game.jsx',
        forbidden,
      });
      return pass('Kart Değiştir mutates the prebuilt attempt state only; no question fetch or deck rebuild exists.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('kart_degistir_preserves_deck_rules',
    'Kart Değiştir preserves unique-year/timeline safety while using the prebuilt deck',
    () => {
      const handleSource = getHandleUseSoloJokerSource();
      const missing = missingTokens(handleSource, [
        'getTimelineYears(currentPlayer.cards || [])',
        'usedIds.delete(currentQuestion.id)',
        'soloSkippedQuestionIdsRef.current',
        'skippedIds.add(currentQuestion.id)',
        'excludeQuestionIds: [currentQuestion.id]',
        'allowSkippedFallback: false',
        'requireVisibleYearSpacing: true',
      ]);
      if (missing.length) return fail('Kart Değiştir lost the static guards that keep replacement cards safe.', {
        verification: 'STATIC_CONTRACT',
        file: 'pages/Game.jsx',
        missing,
      });
      return pass('Kart Değiştir excludes current/used/skipped cards and preserves visible timeline spacing.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('zaman_dondur_spends_after_freeze_validation',
    'Zaman Dondur consumes only after freeze can start and cannot stack',
    () => {
      const handleSource = getHandleUseSoloJokerSource();
      const missing = missingTokens(handleSource, [
        "jokerType === SOLO_UI_JOKER_TYPES.TIME_FREEZE",
        'if (isSoloTimerFrozen || timerFreezeStartRef.current)',
        'Zaman Dondur zaten aktif.',
        'const spent = await spendSoloJokerForCurrentCard(jokerType, decisionKey, currentQuestion.id)',
        'if (!spent) return',
        'startSoloTimerFreeze()',
      ]);
      if (missing.length) return fail('Zaman Dondur no longer validates no-stack state before spend/start.', {
        verification: 'STATIC_CONTRACT',
        file: 'pages/Game.jsx',
        missing,
      });
      return pass('Zaman Dondur rejects stacking, spends inventory, and then starts freeze.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('zaman_dondur_freezes_timer_10_seconds',
    'Zaman Dondur freezes the Solo timer for 10 seconds',
    () => {
      const missing = missingTokens(gameSource, [
        'startSoloTimerFreeze',
        'start + 10000',
        'setTimerFreezeUntil',
        'setFrozenElapsedOffset',
        'soloEffectiveElapsedSeconds',
      ]);
      const timerMissing = missingTokens(soloTimerSource, ['frozen = false', 'Donduruldu']);
      if (missing.length || timerMissing.length) return fail('Zaman Dondur lost its 10-second effective-timer freeze contract.', {
        verification: 'STATIC_CONTRACT',
        files: ['pages/Game.jsx', 'components/game/SoloLevelTimer.jsx'],
        actual: { missing, timerMissing },
      });
      return pass('Zaman Dondur subtracts a frozen offset from Solo elapsed time and marks the timer as frozen.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('zaman_dondur_cleans_up_on_level_end',
    'Zaman Dondur timers are cleaned up on reset/unmount',
    () => {
      const missing = missingTokens(gameSource, [
        'clearSoloTimerFreeze',
        'window.clearTimeout(timerFreezeTimeoutRef.current)',
        'window.clearInterval(timerFreezeIntervalRef.current)',
        'resetSoloJokers();',
        'clearSoloTimerFreeze(false, false)',
      ]);
      if (missing.length) return fail('Zaman Dondur cleanup/reset contract drifted.', {
        verification: 'STATIC_CONTRACT',
        file: 'pages/Game.jsx',
        missing,
      });
      return pass('Timer-freeze timeout/interval are cleared on reset and unmount.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('solo_use_writes_joker_transaction_ledger',
    'Successful Solo joker use writes JokerTransaction reason solo_use with delta -1',
    () => {
      const missing = missingTokens(`${jokerInventorySource}\n${spendUserJokerSource}`, [
        "SOLO_USE: 'solo_use'",
        "const SOLO_USE_REASON = 'solo_use'",
        'quantity_delta: -1',
        'source: SOLO_SOURCE',
        'idempotency_key: idempotencyKey',
        'balance_after: balanceAfter',
        'created_by: email',
      ]);
      if (missing.length) return fail('Solo joker spend ledger contract is incomplete.', {
        verification: 'STATIC_CONTRACT',
        files: ['src/lib/jokerInventory.js', 'base44/functions/spendUserJoker/entry.ts'],
        missing,
      });
      return pass('Successful Solo joker use writes a JokerTransaction solo_use row with quantity_delta -1.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('double_tap_idempotency_and_pending_guard',
    'Double tap does not create duplicate spend/ledger rows',
    () => {
      const missing = missingTokens(`${gameSource}\n${jokerInventorySource}\n${spendUserJokerSource}`, [
        'jokerSpendPendingRef.current',
        'setJokerSpendPendingType(jokerType)',
        'buildSoloJokerUseIdempotencyKey',
        'findTransaction(base44, email, jokerType, idempotencyKey)',
        'alreadyApplied',
      ]);
      if (missing.length) return fail('Solo joker double-tap/idempotency guard is incomplete.', {
        verification: 'STATIC_CONTRACT',
        missing,
      });
      return pass('Client pending state plus backend idempotency key guard protects Solo joker spends from double taps.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('used_jokers_are_not_refunded',
    'Used jokers are not refunded on fail, exit, or replay',
    () => {
      const forbidden = forbiddenTokens(gameSource, [
        'reason: JOKER_TRANSACTION_REASONS.REFUND',
        "reason: 'refund'",
        'quantity_delta: 1',
        'refund',
      ]);
      const docMissing = missingTokens(SOLO_QUESTION_ENGINE_DOC, [
        'used jokers are not refunded on fail, timeout, or exit',
      ]);
      if (forbidden.length || docMissing.length) return fail('Solo appears to refund used jokers or the no-refund doc contract is missing.', {
        verification: 'STATIC_CONTRACT',
        actual: { forbidden, docMissing },
      });
      return pass('No Solo refund path exists; used joker transactions remain on fail/exit/replay.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('profile_reads_updated_balance',
    'Profile Joker Çantası reads latest balance after use',
    () => {
      const missing = missingTokens(jokerInventorySource, [
        'getUserJokerBalances',
        'options.ensureStarter !== false',
        'readOwnInventoryRows',
      ]);
      if (missing.length) return fail('Profile/helper path does not clearly reread latest inventory rows.', {
        verification: 'STATIC_CONTRACT',
        file: 'src/lib/jokerInventory.js',
        missing,
      });
      return pass('Profile uses getUserJokerBalances on mount, so returning from Solo reads latest balances.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('solo_bar_can_reflect_market_purchased_balances',
    'Solo joker bar can reflect purchased Market balances',
    () => {
      const missing = missingTokens(`${marketPageSource}\n${gameSource}\n${soloJokerBarSource}\n${jokerInventorySource}`, [
        'setBalances(nextBalances)',
        'getUserJokerBalances(currentUser, { ensureStarter: true })',
        'balances={soloJokers?.balances || null}',
        'const balance = normalizeJokerQuantity(balances?.[inventoryType])',
        'UserJokerInventory',
      ]);
      if (missing.length) return fail('Purchased joker balances cannot clearly flow into Solo joker display.', {
        verification: 'STATIC_CONTRACT',
        files: ['src/pages/MarketPage.jsx', 'src/pages/Game.jsx', 'src/components/game/SoloJokerBar.jsx'],
        missing,
      });
      return pass('Market purchase refreshes owned balances and Solo rereads/passes UserJokerInventory balances into SoloJokerBar.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('market_purchase_does_not_bypass_solo_spend_ledger',
    'Market purchase does not bypass Solo spend ledger',
    () => {
      const missing = missingTokens(`${purchaseJokerWithDiamondsSource}\n${spendUserJokerSource}\n${gameSource}`, [
        "reason: MARKET_PURCHASE_REASON",
        "const SOLO_USE_REASON = 'solo_use'",
        'spendUserJoker(currentUser',
        'quantity_delta: -1',
        'quantity_delta: quantity',
      ]);
      const gameForbidden = forbiddenTokens(gameSource, [
        "reason: 'market_purchase'",
        'MARKET_PURCHASE_REASON',
        'purchaseJokerWithDiamonds',
      ]);
      if (missing.length || gameForbidden.length) return fail('Solo gameplay can bypass the Solo spend path or Market can write Solo-use ledgers.', {
        verification: 'STATIC_CONTRACT',
        actual: { missing, gameForbidden },
      });
      return pass('Market only grants purchased inventory; Solo still spends through spendUserJoker and solo_use ledger rows.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('market_purchase_does_not_restore_attempt_local_free_jokers',
    'Market purchase does not restore attempt-local free joker counts',
    () => {
      const combined = `${gameSource}\n${soloJokerBarSource}\n${jokerInventorySource}`;
      const forbidden = forbiddenTokens(combined, [
        'remainingUses = jokerConsumed ? 0 : 1',
        'Jokerler • 1 hak',
        'defaultBalance = 1',
        'attemptLocalJoker',
        'free joker',
      ]);
      const missing = missingTokens(combined, [
        'balances={soloJokers?.balances || null}',
        'normalizeJokerQuantity(balances?.[inventoryType])',
      ]);
      if (forbidden.length || missing.length) return fail('Solo can regress to free attempt-local joker counts instead of persistent balances.', {
        verification: 'STATIC_CONTRACT',
        actual: { forbidden, missing },
      });
      return pass('Solo count display remains persistent-balance-based with no attempt-local free count source.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('solo_jokers_do_not_affect_online',
    'Solo jokers are not rendered or wired in Online mode',
    () => {
      const layoutMissing = missingTokens(gameLayoutSource, [
        'SoloJokerBar',
        '!isOnline',
        'soloJokers?.enabled',
      ]);
      const gameMissing = missingTokens(gameSource, [
        'soloJokers={isSoloLevelMode ?',
        'if (!isSoloLevelMode || soloLevelResult',
      ]);
      const onlineForbidden = forbiddenTokens(gameSource, [
        'isOnline && spendUserJoker',
        'isOnline && getUserJokerBalances',
      ]);
      if (layoutMissing.length || gameMissing.length || onlineForbidden.length) return fail('Solo joker rendering/action gates no longer prove Solo-only behavior.', {
        verification: 'STATIC_CONTRACT',
        files: ['pages/Game.jsx', 'components/game/GameLayout.jsx'],
        actual: { layoutMissing, gameMissing, onlineForbidden },
      });
      return pass('Solo joker UI/action wiring is gated by isSoloLevelMode and hidden when isOnline is true.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('solo_jokers_do_not_grant_kronox_puan',
    'Solo jokers do not directly grant Kronox Puan',
    () => {
      const handleSource = getHandleUseSoloJokerSource();
      const forbidden = ['Kronox Puan', 'levelScore', 'scoreDelta', 'writeSoloProgress', 'kronox_puan_total'].filter((token) => handleSource.includes(token));
      if (!handleSource || forbidden.length) return fail('Solo joker action handler contains score/progress write tokens.', {
        verification: 'STATIC_CONTRACT',
        file: 'pages/Game.jsx',
        forbidden,
      });
      return pass('Solo joker actions do not write score/progress or mention Kronox Puan.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('market_stays_outside_solo_gameplay',
    'Mağaza purchase UI stays outside Solo gameplay',
    () => {
      const uiForbidden = ['Joker Market', 'Joker Pazarı', 'diamond-to-joker', 'Satın Al', 'Mağaza'].filter((token) => safeStr(soloJokerBarSource).includes(token));
      const helperMissing = missingTokens(jokerInventorySource, ['MARKET_PURCHASE']);
      if (uiForbidden.length || helperMissing.length) return fail('A joker market UI appears active or future market reason drifted.', {
        verification: 'STATIC_CONTRACT',
        actual: { uiForbidden, helperMissing },
      });
      return pass('Mağaza purchase exists outside Solo; Solo gameplay keeps only owned-count joker usage controls.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('daily_wheel_remains_diamond_only_in_solo_phase_2',
    'Daily Wheel remains Diamond-only in Phase 2',
    () => {
      const forbidden = forbiddenTokens(`${gameSource}\n${soloJokerBarSource}`, [
        'DailyWheelSpin',
        'claimDailyWheelReward',
        'DiamondTransaction',
      ]);
      if (forbidden.length) return fail('Solo joker Phase 2 touched Daily Wheel or Diamond ledger code.', {
        verification: 'STATIC_CONTRACT',
        forbidden,
      });
      return pass('Solo joker Phase 2 does not touch Daily Wheel or Diamond reward paths.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('solo_jokers_runtime_proof_required',
    'Solo joker behavior still needs manual gameplay proof',
    () => notAutomatable('Manual Solo run must verify touch layout, owned-count display, one joker per card, multi-joker-per-level, no refunds, and real ledger/balance updates.', {
      verification: 'MANUAL_RUNTIME_PROOF_REQUIRED',
      classification: 'NOT_AUTOMATABLE',
      actionType: ACTION_TYPES.HUMAN_RUNTIME_PROOF,
      manualProof: [
        'Use two different jokers on two different cards in one Solo level and confirm both balances decrease.',
        'Confirm a second joker is blocked on the same current card, including after Kart Değiştir replacement.',
        'Confirm a failed/exited attempt does not refund used jokers.',
        'Return to Profile and confirm Joker Çantası balances match the spends.',
      ],
    }), { critical: false, actionType: ACTION_TYPES.HUMAN_RUNTIME_PROOF }),
];
