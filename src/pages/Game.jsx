/**
 * Game page — UI katmanı.
 * Android mimarisi önerileri:
 * - UI sadece state'i gösterir, iş mantığını hook'lara delege eder.
 * - useGameState  → ViewModel/State Holder
 * - useGameActions → Domain/Use Case layer
 * - useLobbySync  → Repository/Data source layer
 */
import React, { useEffect, useCallback, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Loader2, WifiOff } from 'lucide-react';
import { QUESTION_LOAD_ERROR_KIND, useOfflineQuestions } from '@/hooks/useOfflineQuestions';
import { loadRecentHistory, loadRecentQuestionExposureStats, appendToHistory } from '@/lib/questionHistory';
import { getTimelineCardCount, getTimelineYears, isCorrectPlacement } from '@/lib/gameRules';
import { debugLog } from '@/lib/debugLog';
import { pushAppDiag } from '@/lib/appDiagBus';

import { useGameState } from '@/hooks/useGameState';
import { useGameActions } from '@/hooks/useGameActions';
import { useLobbySync } from '@/hooks/useLobbySync';
import { normalizeOnlineQuestionDeck } from '@/lib/lobbyState';

import GameDebugLog from '@/components/game/GameDebugLog';
import FeedbackOverlay from '@/components/game/FeedbackOverlay';
import GameOver from '@/components/game/GameOver';
import SoloLevelResult from '@/components/game/SoloLevelResult';
import SettingsModal from '@/components/game/SettingsModal';
import GameOverTimer from '@/components/game/GameOverTimer';
import GameLayout from '@/components/game/GameLayout';
import SoloHintRevealPopup from '@/components/game/SoloHintRevealPopup';
import SoloQuestionDebugPanel from '@/components/game/SoloQuestionDebugPanel';
import OnlineGameBootstrapFallback from '@/components/game/OnlineGameBootstrapFallback';
import QuestionPreparationLoading from '@/components/game/QuestionPreparationLoading';
import GameBootstrapDiagnostics, { isDiagnosticsEnabled } from '@/components/game/GameBootstrapDiagnostics';
import GameRenderErrorBoundary from '@/components/game/GameRenderErrorBoundary';
import { useAuth } from '@/lib/AuthContext';
import { GuidedTutorialPopup, GuidedSoloTutorialOverlay } from '@/components/game/GuidedTutorialOverlays';
import { normalizeOnlineEmail, getOpponentEmailForOnlineResult, buildOnlineScorePopupState } from '@/lib/onlineScorePopup';
import { applyLevelAttempt, getSoloCardsRequiredForLevel, getSoloAttemptDeckSizeForLevel, getSoloMaxMovesForLevel, getSoloTimelineWinCardCountForLevel, getSoloLevelCount, isSoloSpecialLevel, SOLO_LEVEL_TIME_SECONDS, SOLO_MAX_MOVES, readSoloProgress, writeSoloProgress } from '@/lib/soloLevels';
import {
  calculateSoloAttemptResult,
  getBestSoloLevelResult,
  SOLO_CARD_SWAP_BUFFER_CARDS,
  SOLO_MISTAKE_SHIELD_BUFFER_CARDS,
  SOLO_RULES_VERSION,
} from '@/lib/soloProgressHelpers';
// Codex166/Codex180 — Solo Question Selection Engine. Builds a controlled
// attempt deck (unique question ids + unique answer/years) once per Solo
// attempt. Gameplay consumes the deck sequentially — no mid-attempt
// re-randomization. Online/legacy paths are untouched.
import {
  buildSoloAttemptDeck,
  shouldShowBeginnerPlacementHint,
} from '@/lib/soloQuestionEngine';
import {
  MIN_CATEGORY_SELECTION_COUNT,
  getValidActiveSelectedCategoryIds,
  loadActiveCategories,
  loadUserCategoryPreferences,
  resolveGameplayCategoryPreferenceFilter,
} from '@/lib/userCategoryPreferences';
import {
  GUEST_ONBOARDING_STATES,
  getCompletedGuestCredentialsPayload,
  getStoredGuestCredentials,
  updateGuestProfileOnboarding,
} from '@/lib/guestProfile';
import {
  buildSoloQuestionRuntimeDebugPayload,
  isSoloQuestionRuntimeDebugAllowed,
} from '@/lib/soloQuestionRuntimeDebug';
import {
  SOLO_UI_JOKER_TYPES,
  buildSoloJokerUseIdempotencyKey,
  emptyJokerBalances,
  getUserJokerBalances,
  normalizeJokerBalances,
  normalizeJokerQuantity,
  soloUiJokerTypeToInventoryType,
  spendUserJoker,
} from '@/lib/jokerInventory';
import {
  buildSoloHintUseIdempotencyKey,
  consumeUserHint,
  ensureUserHintInventory,
  normalizeHintQuantity,
  normalizeHintRevealStage,
} from '@/lib/hintInventory';
import { mergeJokerSpendMutationBalances } from '@/lib/jokerInventorySpendMerge';
import { getOrderedSoloDeckQuestion, getSoloSeedQuestions } from '@/lib/soloDeckRuntime';
import {
  buildQuestionAttemptEventId,
  getQuestionAnalyticsMetadata,
  recordSoloQuestionAnalyticsEvent as writeSoloQuestionAnalyticsEvent,
} from '@/lib/dbGateway/analyticsGateway';
import {
  loadPlayerQuestionExposureStats,
  recordPlayerQuestionExposure,
} from '@/lib/dbGateway/playerQuestionExposureGateway';
import { recordDailyQuestProgress } from '@/lib/dbGateway/dailyQuestGateway';
import {
  QUESTION_ANALYTICS_EVENT_TYPES,
  QUESTION_ANALYTICS_SOURCES,
} from '@/lib/questionAnalyticsContracts';
// Codex128 — Online score/checkpoint system. Online winner kararlaştığında
// her client kendi kullanıcısının puanını günceller (idempotent).
import { applyOnlineMatchToCurrentUser } from '@/lib/applyOnlineResult';
// Codex477 — Player-own elapsed seconds is retained for Online audit/display.
// It does not affect Online score because Online has no speed bonus.
import { getOnlinePlayerElapsedSeconds } from '@/lib/onlinePlayerElapsed';

const GAMEPLAY_DRAG_LOCK_CLASS = 'kronox-game-drag-lock';
const SOLO_JOKER_POST_DRAG_GUARD_MS = 160;
const GUIDED_TUTORIAL_TIME_LIMIT_SECONDS = SOLO_LEVEL_TIME_SECONDS;
const GUIDED_TIMELINE_SWIPE_HINT_MIN_MS = 3000;
const GUIDED_TIMELINE_SWIPE_HINT_MAX_MS = 10000;
const GUIDED_JOKER_TAP_HINT_MIN_MS = 3000;
const GUIDED_JOKER_TAP_HINT_MAX_MS = 10000;
const GUIDED_TUTORIAL_JOKER_TYPE = SOLO_UI_JOKER_TYPES.TIME_FREEZE;
const GUIDED_TUTORIAL_JOKER_SEQUENCE = Object.freeze({
  3: GUIDED_TUTORIAL_JOKER_TYPE,
  4: SOLO_UI_JOKER_TYPES.CARD_SWAP,
  5: SOLO_UI_JOKER_TYPES.MISTAKE_SHIELD,
});

const GUIDED_TUTORIAL_JOKER_COPY = Object.freeze({
  [SOLO_UI_JOKER_TYPES.TIME_FREEZE]: {
    label: 'Zaman Dondur',
    instruction: 'Zamanı Dondur jokerini kullan. Süreyi 10 saniye boyunca durdurur.',
  },
  [SOLO_UI_JOKER_TYPES.CARD_SWAP]: {
    label: 'Kart Değiştir',
    instruction: 'Kart Değiştir jokerini kullan. Olay kartını başka bir olay ile değiştirir',
  },
  [SOLO_UI_JOKER_TYPES.MISTAKE_SHIELD]: {
    label: 'Kronokalkan',
    instruction: 'Kronokalkan jokerini kullan. Bu jokeri kullandığında bir sonraki yanlışın, hamle sayısından düşmez.',
  },
});

function getGuidedTutorialJokerTypeForAskedCard(askedCardNumber = 0) {
  return GUIDED_TUTORIAL_JOKER_SEQUENCE[Math.trunc(Number(askedCardNumber) || 0)] || null;
}

function getGuidedTutorialJokerCopy(jokerType) {
  return GUIDED_TUTORIAL_JOKER_COPY[jokerType] || {
    label: 'Joker',
    instruction: 'Jokeri kullan. Eğitim demosu gerçek joker bakiyeni harcamaz.',
  };
}

function buildGuidedTutorialJokerBalances(targetType = null, demoUsed = false) {
  const balances = emptyJokerBalances();
  const inventoryType = soloUiJokerTypeToInventoryType(targetType);
  if (inventoryType) balances[inventoryType] = demoUsed ? 0 : 1;
  return balances;
}

export function resolveSoloGameReturnPath(routeState = {}) {
  if (routeState?.onboardingTutorial === true || routeState?.soloLevel?.onboardingTutorial === true) {
    return '/onboarding';
  }
  const source = routeState?.soloReturnTo || routeState?.returnTo || routeState?.source || '';
  if (source === 'home' || source === '/') return '/';
  if (
    source === 'solo-levels' ||
    source === 'solo' ||
    source === 'levels' ||
    source === 'level-selection' ||
    source === '/solo'
  ) {
    return '/solo';
  }
  return '/';
}

export default function Game() {
  const location = useLocation();
  const navigate = useNavigate();

  // Route state
  const routeState = useMemo(() => location.state || {}, [location.state]);
  const routeSearch = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const routeLobbyId = routeState.lobbyId ?? routeSearch.get('lobbyId') ?? null;
  const routeLobbyCode = routeState.lobbyCode ?? routeSearch.get('lobbyCode') ?? null;
  const [resolvedLobbyId, setResolvedLobbyId] = useState(routeLobbyId);
  const lobbyId = resolvedLobbyId || routeLobbyId;
  const isOnlineFromState = routeState.online === true || routeSearch.get('online') === '1' || !!routeLobbyId || !!routeLobbyCode;
  // For non-host online join, playerNames may not be in state — useLobbySync will fetch them
  const playerNames = routeState.playerNames ?? (isOnlineFromState ? [] : null);
  const initialPlayers = routeState.initialPlayers ?? [];
  const routeCategory = routeState.category || 'karisik';
  const routeYearStart = routeState.yearStart ?? 0;
  const routeYearEnd = routeState.yearEnd ?? new Date().getFullYear();
  const routeTurnDuration = routeState.turnDuration ?? 60;
  const routeWinCardCount = routeState.winCardCount ?? 10;
  const routeMyPlayerName = routeState.myPlayerName ?? null;
  const routeOnlineQuestionDeck = Array.isArray(routeState.onlineQuestionDeck) ? routeState.onlineQuestionDeck : [];
  const routeOnlineDeckMeta = routeState.onlineDeckMeta || null;
  const soloReturnTo = routeState.soloReturnTo || routeState.returnTo || routeState.source || null;
  // Codex106 — Solo Level mode payload. Only present when SoloChallenge
  // launches a level attempt. Null/absent means legacy solo (no level
  // enforcement, current behavior). We keep all level logic gated behind
  // this so non-level paths (online + legacy solo) stay byte-for-byte
  // identical.
  const soloLevel = routeState.soloLevel || null;
  const isSoloLevelMode = Boolean(soloLevel && !isOnlineFromState);
  const isGuidedSoloTutorial = Boolean(isSoloLevelMode && (routeState.onboardingTutorial === true || soloLevel?.onboardingTutorial === true));
  const currentQuestionIdFromState = routeState.currentQuestionId ?? null;
  const [currentUser, setCurrentUser] = useState(null);
  const { user: authUser, adminStatus, guestProfile, authChecked, isLoadingAuth } = useAuth();
  const guestDailyQuestPayload = useMemo(
    () => getCompletedGuestCredentialsPayload(guestProfile),
    [guestProfile],
  );
  const guestRecordPayload = useMemo(() => {
    if (authUser?.email) return null;
    const credentials = getStoredGuestCredentials();
    if (!credentials.guest_id || !credentials.guest_token) return guestDailyQuestPayload;
    return {
      player_type: 'guest',
      guest_id: credentials.guest_id,
      guest_token: credentials.guest_token,
    };
  }, [authUser?.email, guestDailyQuestPayload, guestProfile?.guest_id]);
  const soloQuestionDebugAllowed = useMemo(() => isSoloQuestionRuntimeDebugAllowed({
    currentUser,
    authUser,
    adminStatus,
  }), [currentUser, authUser, adminStatus]);
  const soloQuestionDebugFlagEnabled = routeSearch.get('soloDebug') === '1';
  const soloQuestionDebugEnabled = isSoloLevelMode && soloQuestionDebugAllowed && soloQuestionDebugFlagEnabled;
  // Codex084 — boundaryError + diagVisible must live at top-level so they
  // share render position with every early-return gate. Previously placed
  // mid-component AFTER several `if (...) return ...` paths, which violated
  // Rules of Hooks and could itself produce a blank/black screen on the
  // host once a gate flipped between renders.
  const [boundaryError, setBoundaryError] = useState(null);

  useEffect(() => {
    debugLog('[Game] mount:', { routeState, lobbyId, onlineMode: isOnlineFromState });
    pushAppDiag({ gameMounted: true, gameUnmounted: false, gameLobbyId: lobbyId || null });
    return () => { pushAppDiag({ gameMounted: false, gameUnmounted: true }); };
  }, [routeState, lobbyId, isOnlineFromState]);

  useEffect(() => {
    setResolvedLobbyId(routeLobbyId);
  }, [routeLobbyId]);

  // ─── State (ViewModel layer) ─────────────────────────────────────────
  const {
    lobbyData, setLobbyData,
    feedback, setFeedback,
    winner, setWinner,
    selectedZone, setSelectedZone,
    isDragging, setIsDragging,
    touchDragPos, setTouchDragPos,
    touchDragEnd, setTouchDragEnd,
    timerKey, setTimerKey,
    showSettings, setShowSettings,
    overallSeconds, setOverallSeconds,
    gameStarted, setGameStarted,
    error, setError,
    isTimeUp, setIsTimeUp,
    isPlacingRef,
    overallSecondsRef,
    players,
    currentPlayerIndex,
    usedQuestionIds,
    isOnline,
    resetGame,
  } = useGameState({ playerNames, initialPlayers, currentQuestionIdFromState, lobbyId, isOnlineMode: isOnlineFromState });

  const lobbyDataRef = useRef(null);
  useEffect(() => { lobbyDataRef.current = lobbyData; }, [lobbyData]);
  const [soloBootstrapRetryNonce, setSoloBootstrapRetryNonce] = useState(0);
  const winTimerRef = useRef(null);
  const gameplayDragLockRef = useRef(false);

  const releaseGameplayDragLock = useCallback(() => {
    gameplayDragLockRef.current = false;
    if (typeof document === 'undefined') return;
    document.documentElement.classList.remove(GAMEPLAY_DRAG_LOCK_CLASS);
    document.body.classList.remove(GAMEPLAY_DRAG_LOCK_CLASS);
  }, []);

  const engageGameplayDragLock = useCallback(() => {
    gameplayDragLockRef.current = true;
    if (typeof document === 'undefined') return;
    document.documentElement.classList.add(GAMEPLAY_DRAG_LOCK_CLASS);
    document.body.classList.add(GAMEPLAY_DRAG_LOCK_CLASS);
  }, []);

  // Codex106 — Solo Level attempt state. All gated by `isSoloLevelMode`,
  // so other modes (online, legacy solo) are unaffected.
  //
  //   usedMoveCount       — incremented only after a valid timeline placement
  //                         is evaluated (feedback correct/wrong). Dragging,
  //                         invalid drops, tutorial hints, and joker activation
  //                         never consume moves.
  //   mistakeCount        — legacy analytics/progress metadata for wrong
  //                         placements; no longer drives stars or visible limits.
  //   soloLevelResult     — { passed, stars, usedMoves, remainingMoves,
  //                           mistakes, timeSeconds,
  //                           cardsCompleted, failReason } when the attempt
  //                         ends. Triggers the SoloLevelResult overlay.
  //   soloResultPersistedRef — guard so we only call writeSoloProgress once
  //                         per attempt even if effects re-run.
  const soloMaxMoves = useMemo(() => {
    const canonicalMaxMoves = getSoloMaxMovesForLevel(soloLevel?.levelNumber);
    const configuredMaxMoves = Number(soloLevel?.maxMoves);
    const safeConfiguredMaxMoves = Number.isFinite(configuredMaxMoves) && configuredMaxMoves > 0
      ? Math.floor(configuredMaxMoves)
      : 0;
    return Math.max(1, canonicalMaxMoves, safeConfiguredMaxMoves || SOLO_MAX_MOVES);
  }, [soloLevel?.levelNumber, soloLevel?.maxMoves]);
  const [usedMoveCount, setUsedMoveCount] = useState(0);
  const remainingMoveCount = Math.max(0, soloMaxMoves - usedMoveCount);
  const [mistakeCount, setMistakeCount] = useState(0);
  const lastCountedFeedbackRef = useRef(null);
  const [soloLevelResult, setSoloLevelResult] = useState(null);
  const soloResultPersistedRef = useRef(false);
  const [onlineScoreResult, setOnlineScoreResult] = useState(null);
  // Codex166/Codex180 — Solo attempt deck. Created exactly once per Solo
  // attempt by the Solo Question Selection Engine, then consumed sequentially by
  // gameplay. `soloAttemptId` lets debugging confirm replay produced a
  // fresh deck. Both are null outside Solo mode so other paths are
  // byte-for-byte identical.
  const [soloAttemptDeck, setSoloAttemptDeck] = useState(null);
  const [soloAttemptId, setSoloAttemptId] = useState(null);
  const [soloCorrectStreak, setSoloCorrectStreak] = useState(0);
  const [usedJokerType, setUsedJokerType] = useState(null);
  const [guidedTutorialJokerDemoUsedByCard, setGuidedTutorialJokerDemoUsedByCard] = useState({});
  const [guidedTutorialPopup, setGuidedTutorialPopup] = useState(null);
  const [guidedTutorialTimerIntroShown, setGuidedTutorialTimerIntroShown] = useState(false);
  const [guidedTutorialMistakePopupShown, setGuidedTutorialMistakePopupShown] = useState(false);
  const [isTimelineSwipeHintActive, setIsTimelineSwipeHintActive] = useState(false);
  const [hasTimelineSwipeHintMinimumElapsed, setHasTimelineSwipeHintMinimumElapsed] = useState(false);
  const [isGuidedJokerTapHintActive, setIsGuidedJokerTapHintActive] = useState(false);
  const [hasGuidedJokerTapHintMinimumElapsed, setHasGuidedJokerTapHintMinimumElapsed] = useState(false);
  const [jokerBalances, setJokerBalances] = useState(() => emptyJokerBalances());
  const [jokerInventoryLoading, setJokerInventoryLoading] = useState(false);
  const [jokerSpendPendingType, setJokerSpendPendingType] = useState(null);
  const [mistakeShieldActive, setMistakeShieldActive] = useState(false);
  const [jokerMessage, setJokerMessage] = useState('');
  const [jokerError, setJokerError] = useState('');
  const [hintBalance, setHintBalance] = useState(0);
  const [hintInventoryLoading, setHintInventoryLoading] = useState(false);
  const [hintConsumePending, setHintConsumePending] = useState(false);
  const [hintPopupOpen, setHintPopupOpen] = useState(false);
  const [hintRevealStagesByCard, setHintRevealStagesByCard] = useState({});
  const [hintError, setHintError] = useState('');
  const [timerFreezeUntil, setTimerFreezeUntil] = useState(0);
  const [timerFreezeTick, setTimerFreezeTick] = useState(0);
  const [frozenElapsedOffset, setFrozenElapsedOffset] = useState(0);
  const [guidedTutorialPauseOffset, setGuidedTutorialPauseOffset] = useState(0);
  const [hintPauseOffset, setHintPauseOffset] = useState(0);
  const timerFreezeStartRef = useRef(null);
  const timerFreezeElapsedAtStartRef = useRef(null);
  const timerFreezeTimeoutRef = useRef(null);
  const timerFreezeIntervalRef = useRef(null);
  const soloJokerDragGuardUntilRef = useRef(0);
  const soloJokerDragGuardTimerRef = useRef(null);
  const [soloJokerDragLocked, setSoloJokerDragLocked] = useState(false);
  const guidedTutorialPauseElapsedAtStartRef = useRef(null);
  const hintPauseElapsedAtStartRef = useRef(null);
  const timelineSwipeHintStartedAtRef = useRef(null);
  const timelineSwipeHintMinimumTimerRef = useRef(null);
  const timelineSwipeHintAutoStopTimerRef = useRef(null);
  const timelineSwipeHintActiveRef = useRef(false);
  const timelineSwipeHintMinimumElapsedRef = useRef(false);
  const timelineSwipeHintPendingInteractionRef = useRef(false);
  const guidedJokerTapHintMinimumTimerRef = useRef(null);
  const guidedJokerTapHintAutoStopTimerRef = useRef(null);
  const guidedJokerTapHintActiveRef = useRef(false);
  const guidedJokerTapHintMinimumElapsedRef = useRef(false);
  const jokerUsedRef = useRef(false);
  const jokerSpendPendingRef = useRef(false);
  const hintConsumePendingRef = useRef(false);
  const hintPopupOpenRef = useRef(false);
  const soloJokerDecisionKeyByQuestionIdRef = useRef(new Map());
  const soloJokerUsedByDecisionKeyRef = useRef(new Map());
  const soloSkippedQuestionIdsRef = useRef(new Set());
  const soloAnalyticsEventIdsRef = useRef(new Set());
  const soloExposureEventIdsRef = useRef(new Set());
  const soloQuestionShownAtRef = useRef(new Map());
  const soloReplacementQuestionIdsRef = useRef(new Set());
  const soloDailyQuestCompletionRecordedRef = useRef(null);
  const soloDailyQuestCorrectStreakRef = useRef(0);
  const [currentUserLoaded, setCurrentUserLoaded] = useState(false);
  const [soloCategoryPreferenceState, setSoloCategoryPreferenceState] = useState({
    status: 'idle',
    selectedCategoryIds: [],
    rawPreferenceRows: [],
    activeCategoryRows: [],
    available: false,
    fallbackReason: 'not_loaded',
  });
  const [soloQuestionDebugRuntimeState, setSoloQuestionDebugRuntimeState] = useState(null);
  const [soloPlayerExposureState, setSoloPlayerExposureState] = useState({
    status: 'idle',
    mode: 'solo',
    stats: [],
    fallbackReason: 'not_loaded',
  });

  useEffect(() => {
    if (!authChecked && isLoadingAuth) {
      setCurrentUserLoaded(false);
      return;
    }
    setCurrentUser(authUser || null);
    setCurrentUserLoaded(true);
  }, [authChecked, authUser, isLoadingAuth]);

  useEffect(() => {
    let active = true;
    if (!isSoloLevelMode) {
      setSoloCategoryPreferenceState({
        status: 'idle',
        selectedCategoryIds: [],
        rawPreferenceRows: [],
        activeCategoryRows: [],
        available: false,
        fallbackReason: 'not_solo_mode',
      });
      return () => { active = false; };
    }
    if (!currentUserLoaded) {
      setSoloCategoryPreferenceState((previous) => ({
        ...previous,
        status: 'loading',
        fallbackReason: 'user_session_loading',
      }));
      return () => { active = false; };
    }
    if (!currentUser?.email) {
      setSoloCategoryPreferenceState({
        status: 'unavailable',
        selectedCategoryIds: [],
        rawPreferenceRows: [],
        activeCategoryRows: [],
        available: false,
        fallbackReason: 'missing_authenticated_user',
      });
      return () => { active = false; };
    }

    setSoloCategoryPreferenceState((previous) => ({
      ...previous,
      status: 'loading',
      fallbackReason: 'preference_loading',
    }));

    async function loadSoloCategoryPreferences() {
      try {
        const [activeCategories, preferences] = await Promise.all([
          loadActiveCategories(),
          loadUserCategoryPreferences(currentUser),
        ]);
        if (!active) return;
        const validSelectedCategoryIds = getValidActiveSelectedCategoryIds(preferences, activeCategories);
        const preferenceFilter = resolveGameplayCategoryPreferenceFilter(preferences, activeCategories);
        const selectedCategoryIds = Array.from(validSelectedCategoryIds);
        const hasPreferenceFilter = selectedCategoryIds.length > 0;
        setSoloCategoryPreferenceState({
          status: 'ready',
          selectedCategoryIds: hasPreferenceFilter ? selectedCategoryIds : [],
          rawPreferenceRows: Array.isArray(preferences) ? preferences.map((preference) => ({
            category_id: preference?.category_id ?? preference?.categoryId ?? preference?.main_category_id ?? null,
            status: preference?.status ?? preference?.state ?? null,
          })) : [],
          activeCategoryRows: Array.isArray(activeCategories) ? activeCategories.map((categoryRow) => ({
            category_id: categoryRow?.category_id ?? categoryRow?.id ?? null,
            name: categoryRow?.name ?? categoryRow?.title ?? categoryRow?.category_name ?? null,
            status: categoryRow?.status ?? categoryRow?.state ?? null,
          })) : [],
          available: hasPreferenceFilter,
          fallbackReason: hasPreferenceFilter ? null : preferenceFilter.fallbackReason,
        });
      } catch {
        if (!active) return;
        setSoloCategoryPreferenceState({
          status: 'unavailable',
          selectedCategoryIds: [],
          rawPreferenceRows: [],
          activeCategoryRows: [],
          available: false,
          fallbackReason: 'preference_load_failed',
        });
      }
    }

    loadSoloCategoryPreferences();
    return () => { active = false; };
  }, [isSoloLevelMode, currentUserLoaded, currentUser?.email]);

  useEffect(() => {
    let active = true;
    const exposureMode = isGuidedSoloTutorial ? 'tutorial' : 'solo';
    if (!isSoloLevelMode) {
      setSoloPlayerExposureState({
        status: 'idle',
        mode: exposureMode,
        stats: [],
        fallbackReason: 'not_solo_mode',
      });
      return () => { active = false; };
    }
    if (!currentUserLoaded) {
      setSoloPlayerExposureState((previous) => ({
        ...previous,
        status: 'loading',
        mode: exposureMode,
        fallbackReason: 'user_session_loading',
      }));
      return () => { active = false; };
    }

    setSoloPlayerExposureState((previous) => ({
      ...previous,
      status: 'loading',
      mode: exposureMode,
      fallbackReason: 'player_exposure_loading',
    }));

    loadPlayerQuestionExposureStats({ mode: exposureMode })
      .then((stats) => {
        if (!active) return;
        setSoloPlayerExposureState({
          status: 'ready',
          mode: exposureMode,
          stats: Array.isArray(stats) ? stats : [],
          fallbackReason: null,
        });
      })
      .catch(() => {
        if (!active) return;
        setSoloPlayerExposureState({
          status: 'unavailable',
          mode: exposureMode,
          stats: [],
          fallbackReason: 'player_exposure_unavailable',
        });
      });
    return () => { active = false; };
  }, [
    currentUserLoaded,
    currentUser?.email,
    guestProfile?.guest_id,
    isGuidedSoloTutorial,
    isSoloLevelMode,
  ]);

  useEffect(() => {
    if (soloQuestionDebugEnabled) return;
    setSoloQuestionDebugRuntimeState(null);
  }, [soloQuestionDebugEnabled]);

  useEffect(() => {
    let active = true;
    if (!isSoloLevelMode) {
      setJokerBalances(emptyJokerBalances());
      setJokerInventoryLoading(false);
      return () => { active = false; };
    }
    if (!currentUserLoaded) {
      setJokerInventoryLoading(true);
      return () => { active = false; };
    }
    if (!currentUser?.email) {
      setJokerBalances(emptyJokerBalances());
      setJokerInventoryLoading(false);
      return () => { active = false; };
    }

    setJokerInventoryLoading(true);
    getUserJokerBalances(currentUser, { ensureStarter: true })
      .then((result) => {
        if (!active) return;
        setJokerBalances(normalizeJokerBalances(result?.balances || result?.items));
        setJokerError('');
      })
      .catch(() => {
        if (!active) return;
        setJokerBalances(emptyJokerBalances());
        setJokerError('Joker Çantası yüklenemedi.');
      })
      .finally(() => {
        if (active) setJokerInventoryLoading(false);
      });
    return () => { active = false; };
  }, [isSoloLevelMode, currentUserLoaded, currentUser?.email]);

  useEffect(() => {
    let active = true;
    if (!isSoloLevelMode) {
      setHintBalance(0);
      setHintInventoryLoading(false);
      setHintError('');
      return () => { active = false; };
    }
    if (!currentUserLoaded) {
      setHintInventoryLoading(true);
      return () => { active = false; };
    }
    const storedGuestCredentials = currentUser?.email ? null : getStoredGuestCredentials();
    const guestCredentials = currentUser?.email
      ? null
      : (guestDailyQuestPayload || (
        storedGuestCredentials?.guest_id && storedGuestCredentials?.guest_token
          ? {
            player_type: 'guest',
            guest_id: storedGuestCredentials.guest_id,
            guest_token: storedGuestCredentials.guest_token,
          }
          : null
      ));
    if (!currentUser?.email && !guestCredentials) {
      setHintBalance(0);
      setHintInventoryLoading(false);
      setHintError('İpucu için profilini tamamlamalısın.');
      return () => { active = false; };
    }

    setHintInventoryLoading(true);
    ensureUserHintInventory({ guestCredentials })
      .then((result) => {
        if (!active) return;
        setHintBalance(normalizeHintQuantity(result?.hintBalance));
        setHintError('');
      })
      .catch(() => {
        if (!active) return;
        setHintBalance(0);
        setHintError('İpucu hakları yüklenemedi.');
      })
      .finally(() => {
        if (active) setHintInventoryLoading(false);
      });
    return () => { active = false; };
  }, [currentUser?.email, currentUserLoaded, guestDailyQuestPayload, isSoloLevelMode]);

  const soloCategoryPreferenceReady = !isSoloLevelMode
    || soloCategoryPreferenceState.status === 'ready'
    || soloCategoryPreferenceState.status === 'unavailable';
  const soloPlayerExposureReady = !isSoloLevelMode
    || soloPlayerExposureState.status === 'ready'
    || soloPlayerExposureState.status === 'unavailable';
  const questionFetchEnabled = !isOnline && (!isSoloLevelMode || (currentUserLoaded && soloCategoryPreferenceReady));
  const questionRequestContext = useMemo(() => ({
    authScope: currentUser?.email ? 'authenticated' : 'guest',
    requestKind: isGuidedSoloTutorial ? 'guided_first_solo_level' : (isSoloLevelMode ? 'solo_attempt' : 'gameplay_runtime'),
    levelNumber: soloLevel?.levelNumber || 1,
    deckSize: getSoloAttemptDeckSizeForLevel(soloLevel?.levelNumber),
    seedCount: Array.isArray(playerNames) ? playerNames.length * 2 : 2,
    yearStart: routeYearStart,
    yearEnd: routeYearEnd,
    selectedCategoryIds: soloCategoryPreferenceState.selectedCategoryIds,
    categoryPreferenceAvailable: soloCategoryPreferenceState.available === true,
    categoryPreferenceFallbackReason: soloCategoryPreferenceState.fallbackReason,
  }), [
    currentUser?.email,
    isGuidedSoloTutorial,
    isSoloLevelMode,
    playerNames,
    routeYearEnd,
    routeYearStart,
    soloCategoryPreferenceState.available,
    soloCategoryPreferenceState.fallbackReason,
    soloCategoryPreferenceState.selectedCategoryIds,
    soloLevel?.levelNumber,
  ]);

  // ─── Data fetching — offline-first (Repository layer) ───────────
  const {
    questions: allQuestions,
    isLoading,
    isError,
    errorKind: questionLoadErrorKind,
    isFromCache,
    activeCategoryIds,
    debugSnapshot: questionLoadDebugSnapshot,
    retry: refetch,
  } = useOfflineQuestions({
    debugEnabled: soloQuestionDebugEnabled,
    enabled: questionFetchEnabled,
    requestContext: questionRequestContext,
  });

  const soloRuntimeCategoryPreferenceState = useMemo(() => {
    const activeSet = new Set((activeCategoryIds || [])
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id) && id > 0));
    const selectedIds = (soloCategoryPreferenceState.selectedCategoryIds || [])
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id) && id > 0);
    const validSelectedIds = selectedIds.filter((id) => activeSet.has(id));
    const rejectedCategoryIds = selectedIds
      .filter((id) => !activeSet.has(id))
      .map((id) => ({
        category_id: id,
        reason: 'missing_from_getQuestions_active_category_whitelist',
      }));
    const hasRuntimePreferenceFilter = validSelectedIds.length >= MIN_CATEGORY_SELECTION_COUNT;

    return {
      ...soloCategoryPreferenceState,
      selectedCategoryIds: hasRuntimePreferenceFilter ? validSelectedIds : [],
      preferenceCategoryIdsRaw: soloCategoryPreferenceState.selectedCategoryIds || [],
      preferenceCategoryIdsValidAfterCategoryIntersection: validSelectedIds,
      preferenceCategoryIdsRejectedWithReason: rejectedCategoryIds,
      available: soloCategoryPreferenceState.available === true && hasRuntimePreferenceFilter,
      fallbackReason: hasRuntimePreferenceFilter
        ? soloCategoryPreferenceState.fallbackReason
        : (
          soloCategoryPreferenceState.available === true
            ? 'insufficient_preferences_after_getQuestions_active_category_intersection'
            : soloCategoryPreferenceState.fallbackReason
        ),
    };
  }, [activeCategoryIds, soloCategoryPreferenceState]);

  // ─── Lobby sync (Repository layer) ───────────────────────────────
  useLobbySync({
    lobbyId: routeLobbyId,
    lobbyCode: routeLobbyCode,
    initialPlayers,
    currentQuestionIdFromState,
    setLobbyData,
    setWinner,
    setError,
    onLobbyResolved: setResolvedLobbyId,
    initialOnlineQuestionDeck: routeOnlineQuestionDeck,
    initialOnlineDeckMeta: routeOnlineDeckMeta,
  });

  // ─── Derived state ─────────────────────────────────────────────────
  const onlineQuestionDeck = useMemo(
    () => normalizeOnlineQuestionDeck(lobbyData?.online_question_deck || []),
    [lobbyData?.online_question_deck],
  );

  const currentQuestion = useMemo(() => {
    const currentQuestionId = lobbyData?.current_question_id;
    if (!currentQuestionId) return null;
    if (isOnline) {
      if (!Array.isArray(onlineQuestionDeck) || onlineQuestionDeck.length === 0) return null;
      const wantedId = String(currentQuestionId);
      return onlineQuestionDeck.find(q => String(q.id) === wantedId) || null;
    }
    // Solo attempts consume a frozen deck. A background getQuestions refresh can
    // replace allQuestions with a different projection, so the active card must
    // be resolved from the attempt deck first or gameplay can fall back to the
    // bootstrap timeout screen mid-attempt.
    const isSoloDeckReady = isSoloLevelMode && Array.isArray(soloAttemptDeck) && soloAttemptDeck.length > 0;
    const sourceQuestions = isSoloDeckReady ? soloAttemptDeck : allQuestions;
    if (!Array.isArray(sourceQuestions) || sourceQuestions.length === 0) return null;
    const wantedId = String(currentQuestionId);
    return sourceQuestions.find(q => String(q.id) === wantedId) || null;
  }, [lobbyData?.current_question_id, allQuestions, isOnline, isSoloLevelMode, onlineQuestionDeck, soloAttemptDeck]);

  const category = isOnline ? (lobbyData?.category || routeCategory) : routeCategory;
  const yearStart = isOnline ? (lobbyData?.year_start ?? routeYearStart) : routeYearStart;
  const yearEnd = isOnline ? (lobbyData?.year_end ?? routeYearEnd) : routeYearEnd;
  const turnDuration = isOnline ? (lobbyData?.turn_duration ?? routeTurnDuration) : routeTurnDuration;
  const routeDerivedWinCardCount = isOnline ? (lobbyData?.win_card_count ?? routeWinCardCount) : routeWinCardCount;
  const winCardCount = isSoloLevelMode
    ? getSoloTimelineWinCardCountForLevel(soloLevel?.levelNumber)
    : routeDerivedWinCardCount;
  const soloCardsRequired = isSoloLevelMode
    ? getSoloCardsRequiredForLevel(soloLevel?.levelNumber)
    : null;
  const cardsCompletedSolo = useMemo(() => {
    if (!isSoloLevelMode || !players.length) return 0;
    const me = players[0];
    // Same source as hasPlayerWon(): the current timeline card count.
    // This prevents the header counter from subtracting seed cards while
    // completion uses the full authoritative card set.
    return getTimelineCardCount(me);
  }, [isSoloLevelMode, players]);
  const currentTimelinePlayer = players.length > 0 ? players[currentPlayerIndex] : null;
  const soloSeedCardCount = isSoloLevelMode ? Math.max(0, (playerNames?.length || 1) * 2) : 0;
  const guidedTutorialAskedCardNumber = isGuidedSoloTutorial && currentQuestion
    ? Math.max(1, cardsCompletedSolo - soloSeedCardCount + 1)
    : 0;
  const guidedTutorialExpectedJokerType = getGuidedTutorialJokerTypeForAskedCard(guidedTutorialAskedCardNumber);
  const guidedTutorialCurrentJokerUsed = Boolean(
    guidedTutorialExpectedJokerType &&
    guidedTutorialJokerDemoUsedByCard[guidedTutorialAskedCardNumber]
  );
  const guidedTutorialCorrectTargetZone = useMemo(() => {
    if (!isGuidedSoloTutorial || !currentQuestion || !currentTimelinePlayer) return null;
    const questionYear = Number(currentQuestion.year);
    const cards = Array.isArray(currentTimelinePlayer.cards) ? currentTimelinePlayer.cards : [];
    if (!Number.isFinite(questionYear)) return null;
    for (let zoneIndex = 0; zoneIndex <= cards.length; zoneIndex += 1) {
      if (isCorrectPlacement(cards, questionYear, zoneIndex)) return zoneIndex;
    }
    return null;
  }, [currentTimelinePlayer, currentQuestion, isGuidedSoloTutorial]);
  const guidedTutorialStepMode = isGuidedSoloTutorial && currentQuestion
    ? guidedTutorialAskedCardNumber === 2
      ? 'timeline-scroll'
      : 'placement'
    : null;
  const timerFreezeNow = timerFreezeTick || Date.now();
  const isSoloTimerFrozen = Boolean(isSoloLevelMode && timerFreezeUntil > timerFreezeNow && timerFreezeStartRef.current);
  const activeFreezeOffset = isSoloTimerFrozen
    ? Math.min(10, Math.max(0, Math.floor((timerFreezeNow - timerFreezeStartRef.current) / 1000)))
    : 0;
  const guidedTutorialPopupOpen = Boolean(isGuidedSoloTutorial && guidedTutorialPopup);
  if (guidedTutorialPopupOpen && guidedTutorialPauseElapsedAtStartRef.current === null) {
    guidedTutorialPauseElapsedAtStartRef.current = Number(overallSecondsRef.current ?? overallSeconds) || 0;
  }
  const activeGuidedTutorialPauseOffset = guidedTutorialPopupOpen && Number.isFinite(Number(guidedTutorialPauseElapsedAtStartRef.current))
    ? Math.max(0, Number(overallSeconds || 0) - Number(guidedTutorialPauseElapsedAtStartRef.current))
    : 0;
  const hintPopupTimerOpen = Boolean(isSoloLevelMode && hintPopupOpen);
  if (hintPopupTimerOpen && hintPauseElapsedAtStartRef.current === null) {
    hintPauseElapsedAtStartRef.current = Number(overallSecondsRef.current ?? overallSeconds) || 0;
  }
  const activeHintPauseOffset = hintPopupTimerOpen && Number.isFinite(Number(hintPauseElapsedAtStartRef.current))
    ? Math.max(0, Number(overallSeconds || 0) - Number(hintPauseElapsedAtStartRef.current))
    : 0;
  const soloEffectiveElapsedSeconds = isSoloLevelMode
    ? Math.max(0, isSoloTimerFrozen
      ? (timerFreezeElapsedAtStartRef.current ?? overallSeconds)
      : overallSeconds - frozenElapsedOffset - guidedTutorialPauseOffset - hintPauseOffset - activeFreezeOffset - activeGuidedTutorialPauseOffset - activeHintPauseOffset)
    : overallSeconds;
  const soloEffectiveElapsedSecondsRef = useRef(0);

  useEffect(() => {
    soloEffectiveElapsedSecondsRef.current = soloEffectiveElapsedSeconds;
  }, [soloEffectiveElapsedSeconds]);

  useEffect(() => {
    jokerUsedRef.current = Boolean(usedJokerType);
  }, [usedJokerType]);

  const clearTimelineSwipeHintTimers = useCallback(() => {
    if (timelineSwipeHintMinimumTimerRef.current) {
      window.clearTimeout(timelineSwipeHintMinimumTimerRef.current);
      timelineSwipeHintMinimumTimerRef.current = null;
    }
    if (timelineSwipeHintAutoStopTimerRef.current) {
      window.clearTimeout(timelineSwipeHintAutoStopTimerRef.current);
      timelineSwipeHintAutoStopTimerRef.current = null;
    }
  }, []);

  const stopTimelineSwipeHint = useCallback((reason = 'manual_stop', updateState = true) => {
    clearTimelineSwipeHintTimers();
    timelineSwipeHintStartedAtRef.current = null;
    timelineSwipeHintActiveRef.current = false;
    timelineSwipeHintMinimumElapsedRef.current = false;
    timelineSwipeHintPendingInteractionRef.current = false;
    if (updateState) {
      setIsTimelineSwipeHintActive(false);
      setHasTimelineSwipeHintMinimumElapsed(false);
    }
    debugLog('[Game] guided timeline swipe hint stopped', { reason });
  }, [clearTimelineSwipeHintTimers]);

  const clearGuidedJokerTapHintTimers = useCallback(() => {
    if (guidedJokerTapHintMinimumTimerRef.current) {
      window.clearTimeout(guidedJokerTapHintMinimumTimerRef.current);
      guidedJokerTapHintMinimumTimerRef.current = null;
    }
    if (guidedJokerTapHintAutoStopTimerRef.current) {
      window.clearTimeout(guidedJokerTapHintAutoStopTimerRef.current);
      guidedJokerTapHintAutoStopTimerRef.current = null;
    }
  }, []);

  const stopGuidedJokerTapHint = useCallback((reason = 'manual_stop', updateState = true) => {
    clearGuidedJokerTapHintTimers();
    guidedJokerTapHintActiveRef.current = false;
    if (updateState) {
      setIsGuidedJokerTapHintActive(false);
    }
    debugLog('[Game] guided joker tap hint stopped', { reason });
  }, [clearGuidedJokerTapHintTimers]);

  const clearSoloJokerDragGuard = useCallback(() => {
    if (soloJokerDragGuardTimerRef.current) {
      window.clearTimeout(soloJokerDragGuardTimerRef.current);
      soloJokerDragGuardTimerRef.current = null;
    }
    soloJokerDragGuardUntilRef.current = 0;
    setSoloJokerDragLocked(false);
  }, []);

  const lockSoloJokersForDrag = useCallback(() => {
    if (!isSoloLevelMode) return;
    if (soloJokerDragGuardTimerRef.current) {
      window.clearTimeout(soloJokerDragGuardTimerRef.current);
      soloJokerDragGuardTimerRef.current = null;
    }
    soloJokerDragGuardUntilRef.current = Number.POSITIVE_INFINITY;
    setSoloJokerDragLocked(true);
  }, [isSoloLevelMode]);

  const releaseSoloJokersAfterDrag = useCallback(() => {
    if (!isSoloLevelMode) return;
    const guardUntil = Date.now() + SOLO_JOKER_POST_DRAG_GUARD_MS;
    if (soloJokerDragGuardTimerRef.current) {
      window.clearTimeout(soloJokerDragGuardTimerRef.current);
    }
    soloJokerDragGuardUntilRef.current = guardUntil;
    setSoloJokerDragLocked(true);
    soloJokerDragGuardTimerRef.current = window.setTimeout(() => {
      if (Date.now() >= soloJokerDragGuardUntilRef.current) {
        soloJokerDragGuardUntilRef.current = 0;
        setSoloJokerDragLocked(false);
      }
      soloJokerDragGuardTimerRef.current = null;
    }, SOLO_JOKER_POST_DRAG_GUARD_MS);
  }, [isSoloLevelMode]);

  useEffect(() => () => clearSoloJokerDragGuard(), [clearSoloJokerDragGuard]);

  const handleTimelineSwipeHintInteraction = useCallback((reason = 'user_interaction') => {
    if (!timelineSwipeHintActiveRef.current) return;
    if (timelineSwipeHintMinimumElapsedRef.current) {
      stopTimelineSwipeHint(reason);
      return;
    }
    timelineSwipeHintPendingInteractionRef.current = true;
  }, [stopTimelineSwipeHint]);

  const clearSoloTimerFreeze = useCallback((applyElapsed = false, updateState = true) => {
    const hadActiveFreeze = Boolean(timerFreezeStartRef.current);
    const rawElapsed = Number(overallSecondsRef.current ?? 0);
    if (timerFreezeTimeoutRef.current) {
      window.clearTimeout(timerFreezeTimeoutRef.current);
      timerFreezeTimeoutRef.current = null;
    }
    if (timerFreezeIntervalRef.current) {
      window.clearInterval(timerFreezeIntervalRef.current);
      timerFreezeIntervalRef.current = null;
    }
    if (applyElapsed && updateState && timerFreezeStartRef.current) {
      const startEffectiveElapsed = Number(timerFreezeElapsedAtStartRef.current);
      if (Number.isFinite(startEffectiveElapsed) && Number.isFinite(rawElapsed)) {
        const nextOffset = Math.max(0, rawElapsed - startEffectiveElapsed);
        setFrozenElapsedOffset((prev) => Math.max(prev, nextOffset));
      }
    }
    if (hadActiveFreeze && hintPopupOpenRef.current && Number.isFinite(rawElapsed)) {
      hintPauseElapsedAtStartRef.current = rawElapsed;
    }
    timerFreezeStartRef.current = null;
    timerFreezeElapsedAtStartRef.current = null;
    if (updateState) {
      setTimerFreezeUntil(0);
      setTimerFreezeTick(0);
    }
  }, [overallSecondsRef]);

  const getSoloResultElapsedSeconds = useCallback((snapshotSeconds = null) => {
    const snapshot = Number(snapshotSeconds);
    const hasSnapshot = snapshotSeconds !== null && snapshotSeconds !== undefined && Number.isFinite(snapshot);
    const rawElapsed = hasSnapshot
      ? snapshot
      : Number(overallSecondsRef.current ?? 0);
    const frozenStartElapsed = Number(timerFreezeElapsedAtStartRef.current);
    let freezeOffset = Number(frozenElapsedOffset) || 0;

    if (timerFreezeStartRef.current && Number.isFinite(frozenStartElapsed)) {
      const pendingFreezeOffset = Math.min(10, Math.max(0, rawElapsed - frozenStartElapsed));
      freezeOffset = Math.max(freezeOffset, pendingFreezeOffset);
    }

    if (isSoloTimerFrozen && Number.isFinite(frozenStartElapsed)) {
      return Math.max(0, Math.floor(frozenStartElapsed));
    }

    let hintOffset = Number(hintPauseOffset) || 0;
    const hintPausedAt = Number(hintPauseElapsedAtStartRef.current);
    if (hintPopupOpen && Number.isFinite(hintPausedAt)) {
      hintOffset = Math.max(hintOffset, rawElapsed - hintPausedAt);
    }

    return Math.max(0, Math.floor(rawElapsed - freezeOffset - hintOffset));
  }, [frozenElapsedOffset, hintPauseOffset, hintPopupOpen, isSoloTimerFrozen, overallSecondsRef]);

  const resetSoloJokers = useCallback(() => {
    clearSoloJokerDragGuard();
    clearSoloTimerFreeze(false);
    jokerUsedRef.current = false;
    jokerSpendPendingRef.current = false;
    soloJokerDecisionKeyByQuestionIdRef.current = new Map();
    soloJokerUsedByDecisionKeyRef.current = new Map();
    soloSkippedQuestionIdsRef.current = new Set();
    soloAnalyticsEventIdsRef.current = new Set();
    soloQuestionShownAtRef.current = new Map();
    soloReplacementQuestionIdsRef.current = new Set();
    soloDailyQuestCompletionRecordedRef.current = null;
    soloDailyQuestCorrectStreakRef.current = 0;
    hintConsumePendingRef.current = false;
    hintPopupOpenRef.current = false;
    setUsedJokerType(null);
    setGuidedTutorialJokerDemoUsedByCard({});
    setGuidedTutorialPopup(null);
    setGuidedTutorialTimerIntroShown(false);
    setGuidedTutorialMistakePopupShown(false);
    stopGuidedJokerTapHint('solo_joker_reset');
    setJokerSpendPendingType(null);
    setMistakeShieldActive(false);
    setJokerMessage('');
    setJokerError('');
    setHintConsumePending(false);
    setHintPopupOpen(false);
    setHintRevealStagesByCard({});
    setHintError('');
    setFrozenElapsedOffset(0);
    setGuidedTutorialPauseOffset(0);
    setHintPauseOffset(0);
    guidedTutorialPauseElapsedAtStartRef.current = null;
    hintPauseElapsedAtStartRef.current = null;
    stopTimelineSwipeHint('solo_joker_reset');
  }, [clearSoloJokerDragGuard, clearSoloTimerFreeze, stopGuidedJokerTapHint, stopTimelineSwipeHint]);

  const closeGuidedTutorialPopup = useCallback(() => {
    const pausedAt = Number(guidedTutorialPauseElapsedAtStartRef.current);
    const rawElapsed = Number(overallSecondsRef.current ?? overallSeconds);
    if (Number.isFinite(pausedAt) && Number.isFinite(rawElapsed)) {
      setGuidedTutorialPauseOffset((previous) => Math.max(previous, rawElapsed - pausedAt));
    }
    guidedTutorialPauseElapsedAtStartRef.current = null;
    setGuidedTutorialPopup(null);
  }, [overallSeconds, overallSecondsRef]);

  const closeSoloHintPopup = useCallback(() => {
    const pausedAt = Number(hintPauseElapsedAtStartRef.current);
    const rawElapsed = Number(overallSecondsRef.current ?? overallSeconds);
    const freezeCurrentlyCoversHintPause = Boolean(
      timerFreezeStartRef.current &&
      Number(timerFreezeUntil) > Date.now()
    );
    if (!freezeCurrentlyCoversHintPause && Number.isFinite(pausedAt) && Number.isFinite(rawElapsed)) {
      setHintPauseOffset((previous) => Math.max(previous, rawElapsed - pausedAt));
    }
    hintPauseElapsedAtStartRef.current = null;
    hintPopupOpenRef.current = false;
    setHintPopupOpen(false);
  }, [overallSeconds, overallSecondsRef, timerFreezeUntil]);

  useEffect(() => {
    const shouldRunTimelineSwipeHint = Boolean(
      isGuidedSoloTutorial &&
      guidedTutorialStepMode === 'timeline-scroll' &&
      currentQuestion &&
      !winner &&
      !soloLevelResult
    );

    if (!shouldRunTimelineSwipeHint) {
      stopTimelineSwipeHint('tutorial_step_exit');
      return undefined;
    }

    clearTimelineSwipeHintTimers();
    timelineSwipeHintStartedAtRef.current = Date.now();
    timelineSwipeHintActiveRef.current = true;
    timelineSwipeHintMinimumElapsedRef.current = false;
    timelineSwipeHintPendingInteractionRef.current = false;
    setIsTimelineSwipeHintActive(true);
    setHasTimelineSwipeHintMinimumElapsed(false);

    timelineSwipeHintMinimumTimerRef.current = window.setTimeout(() => {
      timelineSwipeHintMinimumTimerRef.current = null;
      timelineSwipeHintMinimumElapsedRef.current = true;
      setHasTimelineSwipeHintMinimumElapsed(true);
      if (timelineSwipeHintPendingInteractionRef.current) {
        stopTimelineSwipeHint('pending_interaction_after_minimum');
      }
    }, GUIDED_TIMELINE_SWIPE_HINT_MIN_MS);

    timelineSwipeHintAutoStopTimerRef.current = window.setTimeout(() => {
      stopTimelineSwipeHint('auto_stop_10s');
    }, GUIDED_TIMELINE_SWIPE_HINT_MAX_MS);

    return () => {
      stopTimelineSwipeHint('timeline_swipe_hint_cleanup', false);
    };
  }, [
    clearTimelineSwipeHintTimers,
    currentQuestion?.id,
    guidedTutorialStepMode,
    isGuidedSoloTutorial,
    soloLevelResult,
    stopTimelineSwipeHint,
    winner,
  ]);

  // Codex166/Codex180 — Solo mode: the attempt deck IS the question pool.
  // Gameplay (pickQuestion in useGameActions) walks this prebuilt source-of-truth,
  // never re-randomizes mid-attempt, and can never run out of unique
  // years. Other modes keep the existing year/category/type filter.
  const questionPool = useMemo(() => {
    if (isOnline) {
      return onlineQuestionDeck;
    }
    if (isSoloLevelMode && Array.isArray(soloAttemptDeck)) {
      return soloAttemptDeck;
    }
    return allQuestions
      .filter(q => category === 'muzik' ? q.type === 'muzik' : q.type === 'metin')
      .filter(q => q.year >= yearStart && q.year <= yearEnd)
      .filter(q => category === 'karisik' || q.category === category)
      .filter(q => q.type !== 'muzik' || (q.media_url && q.media_url.length > 0));
  }, [allQuestions, yearStart, yearEnd, category, isOnline, isSoloLevelMode, onlineQuestionDeck, soloAttemptDeck]);

  const pickOrderedSoloQuestion = useCallback((usedIds, questions, usedTimelineYears = new Set()) => {
    if (!isSoloLevelMode) return null;
    const chosen = getOrderedSoloDeckQuestion(questions, usedIds, usedTimelineYears, {
      skippedQuestionIds: soloSkippedQuestionIdsRef.current,
    });
    if (chosen) appendToHistory([chosen.id]);
    return chosen;
  }, [isSoloLevelMode]);

  const myPlayerName = useMemo(() => {
    if (!isOnline) return routeMyPlayerName;
    if (routeMyPlayerName) return routeMyPlayerName;
    const email = currentUser?.email;
    if (!email) return null;
    return players.find(p => p.email === email)?.name || null;
  }, [players, routeMyPlayerName, currentUser?.email, isOnline]);

  const myPlayer = useMemo(() => {
    if (!isOnline || !myPlayerName) return null;
    return players.find(p => p.name === myPlayerName);
  }, [players, myPlayerName, isOnline]);
  const localPlayerEmail = isOnline ? (myPlayer?.email || currentUser?.email || null) : null;

  const currentPlayer = currentTimelinePlayer;
  const isMyTurn = !isOnline || (myPlayerName && currentPlayer?.name === myPlayerName);
  const renderedTurnMessageText = currentQuestion && isMyTurn && !winner
    ? 'KARTI ZAMAN ÇİZGİSİNE YERLEŞTİR!'
    : currentQuestion && !isMyTurn
      ? `${currentPlayer?.name || 'Oyuncu'} düşünüyor…`
      : '';

  const getSoloQuestionAnalyticsPlacementIndex = useCallback((question) => {
    if (!Array.isArray(soloAttemptDeck) || !question?.id) return 0;
    const index = soloAttemptDeck.findIndex((item) => String(item?.id) === String(question.id));
    return index >= 0 ? index + 1 : 0;
  }, [soloAttemptDeck]);

  const getCurrentSoloJokerDecisionKey = useCallback((question = currentQuestion) => {
    if (!isSoloLevelMode || !question?.id) return '';
    const questionId = String(question.id);
    const mappedKey = soloJokerDecisionKeyByQuestionIdRef.current.get(questionId);
    if (mappedKey) return mappedKey;
    const placementIndex = getSoloQuestionAnalyticsPlacementIndex(question) || 'current';
    const key = `${soloAttemptId || 'solo_attempt'}:${placementIndex}:${questionId}`;
    soloJokerDecisionKeyByQuestionIdRef.current.set(questionId, key);
    return key;
  }, [currentQuestion, getSoloQuestionAnalyticsPlacementIndex, isSoloLevelMode, soloAttemptId]);

  const getCurrentSoloHintCardKey = useCallback((question = currentQuestion) => {
    if (!isSoloLevelMode || !question?.id) return '';
    const placementIndex = getSoloQuestionAnalyticsPlacementIndex(question) || 'current';
    return `${soloAttemptId || 'solo_attempt'}:${placementIndex}:${String(question.id)}`;
  }, [currentQuestion, getSoloQuestionAnalyticsPlacementIndex, isSoloLevelMode, soloAttemptId]);

  const currentSoloHintCardKey = getCurrentSoloHintCardKey(currentQuestion);
  const currentSoloHintRevealStage = normalizeHintRevealStage(
    currentSoloHintCardKey ? hintRevealStagesByCard[currentSoloHintCardKey] : 0,
  );

  useEffect(() => {
    if (!isSoloLevelMode) return;
    setHintError('');
  }, [currentQuestion?.id, isSoloLevelMode]);

  useEffect(() => {
    if (!isSoloLevelMode || !currentQuestion?.id) {
      jokerUsedRef.current = false;
      setUsedJokerType(null);
      return;
    }
    const decisionKey = getCurrentSoloJokerDecisionKey(currentQuestion);
    const currentCardJoker = soloJokerUsedByDecisionKeyRef.current.get(decisionKey) || null;
    jokerUsedRef.current = Boolean(currentCardJoker);
    setUsedJokerType(currentCardJoker);
  }, [currentQuestion, getCurrentSoloJokerDecisionKey, isSoloLevelMode]);

  const getSoloQuestionAnalyticsEventId = useCallback((question, eventType, placementIndexOverride = null) => buildQuestionAttemptEventId({
    attemptId: soloAttemptId,
    questionId: question?.id,
    eventType,
    placementIndex: placementIndexOverride ?? getSoloQuestionAnalyticsPlacementIndex(question),
    mode: 'solo',
  }), [getSoloQuestionAnalyticsPlacementIndex, soloAttemptId]);

  const recordSoloQuestionAnalyticsEvent = useCallback((question, eventType, extra = {}) => {
    if (!isSoloLevelMode || !question || !soloAttemptId) return;
    const placementIndex = extra.placement_index ?? getSoloQuestionAnalyticsPlacementIndex(question);
    const eventId = extra.event_id || getSoloQuestionAnalyticsEventId(question, eventType, placementIndex);
    if (!eventId) return;

    const nowIso = new Date().toISOString();
    if (
      eventType === QUESTION_ANALYTICS_EVENT_TYPES.SHOWN ||
      eventType === QUESTION_ANALYTICS_EVENT_TYPES.REPLACEMENT_SHOWN
    ) {
      soloQuestionShownAtRef.current.set(String(question.id), Date.now());
    }
    if (eventType === QUESTION_ANALYTICS_EVENT_TYPES.REPLACEMENT_SHOWN) {
      const shownEventId = getSoloQuestionAnalyticsEventId(question, QUESTION_ANALYTICS_EVENT_TYPES.SHOWN, placementIndex);
      if (shownEventId) soloAnalyticsEventIdsRef.current.add(shownEventId);
    }

    const metadata = getQuestionAnalyticsMetadata(question);
    const source = extra.source || (soloReplacementQuestionIdsRef.current.has(String(question.id))
      ? QUESTION_ANALYTICS_SOURCES.REPLACEMENT
      : QUESTION_ANALYTICS_SOURCES.DECK);
    if (
      eventType === QUESTION_ANALYTICS_EVENT_TYPES.SHOWN ||
      eventType === QUESTION_ANALYTICS_EVENT_TYPES.REPLACEMENT_SHOWN
    ) {
      const exposureMode = isGuidedSoloTutorial ? 'tutorial' : 'solo';
      const exposureEventKey = [
        'player_question_exposure',
        exposureMode,
        soloAttemptId,
        question?.id,
        eventType === QUESTION_ANALYTICS_EVENT_TYPES.REPLACEMENT_SHOWN ? 'replacement' : 'playable',
        placementIndex,
      ].filter(Boolean).join(':');
      if (!soloExposureEventIdsRef.current.has(exposureEventKey)) {
        soloExposureEventIdsRef.current.add(exposureEventKey);
        recordPlayerQuestionExposure({
          ...metadata,
          event_key: exposureEventKey,
          event_id: eventId,
          attempt_id: soloAttemptId,
          mode: exposureMode,
          role: eventType === QUESTION_ANALYTICS_EVENT_TYPES.REPLACEMENT_SHOWN ? 'replacement' : 'playable',
          source,
          actualShownOnly: true,
          bufferedQuestionsCounted: false,
          shown_sequence: placementIndex,
          shown_at: extra.shown_at || nowIso,
        }).catch(() => null);
      }
    }

    if (!currentUser?.email || soloAnalyticsEventIdsRef.current.has(eventId)) return;
    soloAnalyticsEventIdsRef.current.add(eventId);

    writeSoloQuestionAnalyticsEvent({
      ...metadata,
      ...extra,
      event_id: eventId,
      attempt_id: soloAttemptId,
      mode: 'solo',
      level: soloLevel?.levelNumber ?? null,
      is_special_level: isSoloSpecialLevel(soloLevel?.levelNumber),
      event_type: eventType,
      placement_index: placementIndex,
      source,
      joker_used: Boolean(usedJokerType || extra.joker_used),
      joker_type: extra.joker_type || usedJokerType || '',
      shown_at: extra.shown_at || (
        eventType === QUESTION_ANALYTICS_EVENT_TYPES.SHOWN ||
        eventType === QUESTION_ANALYTICS_EVENT_TYPES.REPLACEMENT_SHOWN
          ? nowIso
          : undefined
      ),
      answered_at: extra.answered_at || (eventType === QUESTION_ANALYTICS_EVENT_TYPES.ANSWERED ? nowIso : undefined),
      created_at: extra.created_at || nowIso,
    }, { user: currentUser }).catch(() => null);
  }, [
    currentUser,
    getSoloQuestionAnalyticsEventId,
    getSoloQuestionAnalyticsPlacementIndex,
    isGuidedSoloTutorial,
    isSoloLevelMode,
    soloAttemptId,
    soloLevel?.levelNumber,
    usedJokerType,
  ]);

  const recordDailyQuestSoloEvent = useCallback((eventType, eventId, metadata = {}) => {
    if (!isSoloLevelMode || (!currentUser?.email && !guestDailyQuestPayload)) return;
    recordDailyQuestProgress({
      ...(guestDailyQuestPayload || {}),
      eventType,
      mode: 'solo',
      amount: 1,
      eventId,
      ...metadata,
      metadata: {
        ...metadata,
        soloAttemptId,
        soloLevelNumber: soloLevel?.levelNumber,
        source: 'Game.jsx',
      },
    }).catch((error) => {
      debugLog('[Game] daily quest progress failed:', error?.message || error);
    });
  }, [currentUser?.email, guestDailyQuestPayload, isSoloLevelMode, soloAttemptId, soloLevel?.levelNumber]);

  useEffect(() => {
    if (!isSoloLevelMode || !currentQuestion || !isMyTurn || winner || soloLevelResult) return;
    recordSoloQuestionAnalyticsEvent(currentQuestion, QUESTION_ANALYTICS_EVENT_TYPES.SHOWN);
  }, [
    currentQuestion,
    isMyTurn,
    isSoloLevelMode,
    recordSoloQuestionAnalyticsEvent,
    soloLevelResult,
    winner,
  ]);

  const handleSoloQuestionAnswered = useCallback((event) => {
    if (!isSoloLevelMode || !event?.question) return;
    const questionId = String(event.question.id);
    const nextDailyCorrectStreak = event.isCorrect
      ? soloDailyQuestCorrectStreakRef.current + 1
      : 0;
    soloDailyQuestCorrectStreakRef.current = nextDailyCorrectStreak;
    const shownAt = soloQuestionShownAtRef.current.get(questionId);
    const responseTimeMs = shownAt ? Math.max(0, Date.now() - shownAt) : undefined;
    const nextMistakeNumber = event.isCorrect
      ? mistakeCount
      : (mistakeShieldActive ? mistakeCount : mistakeCount + 1);
    recordSoloQuestionAnalyticsEvent(event.question, QUESTION_ANALYTICS_EVENT_TYPES.ANSWERED, {
      is_correct: Boolean(event.isCorrect),
      response_time_ms: responseTimeMs,
      mistake_number: nextMistakeNumber,
      metadata: {
        zone: event.zone,
        guessedYear: event.guessedYear,
        shieldActive: Boolean(mistakeShieldActive),
        hasWon: Boolean(event.hasWon),
      },
    });
    if (event.isCorrect) {
      const correctEventId = `${soloAttemptId || 'solo_attempt'}:correct_answer:${questionId}`;
      recordDailyQuestSoloEvent('correct_answer', correctEventId, {
        questType: 'correct_answer',
        questionId,
        isCorrect: true,
      });
      if (nextDailyCorrectStreak >= 4) {
        const streakEventId = `${soloAttemptId || 'solo_attempt'}:consecutive_correct_4:${questionId}`;
        recordDailyQuestSoloEvent('consecutive_correct_4', streakEventId, {
          questType: 'consecutive_correct_4',
          questionId,
          consecutiveCorrect: nextDailyCorrectStreak,
        });
      }
    }
  }, [
    isSoloLevelMode,
    mistakeCount,
    mistakeShieldActive,
    recordSoloQuestionAnalyticsEvent,
    recordDailyQuestSoloEvent,
    soloAttemptId,
  ]);

  useEffect(() => {
    if (!isOnline) return;
    debugLog('[Game] online turn derived state:', { lobbyId, renderedPlayersCount: players.length, computedCurrentPlayerIndex: currentPlayerIndex, computedCurrentPlayerName: currentPlayer?.name || null, computedIsMyTurn: Boolean(isMyTurn), myPlayerName, currentQuestionId: lobbyData?.current_question_id || null, renderedTurnMessageText });
  }, [isOnline, lobbyId, currentPlayerIndex, currentPlayer?.name, currentPlayer?.email, isMyTurn, myPlayerName, lobbyData?.current_question_id, players, renderedTurnMessageText]);

  // Codex128 — Apply Online score/checkpoint result for the local user
  // exactly once per match. Runs on every client from its own perspective,
  // so each player updates only their own User.online_progress. Idempotent
  // via online_progress.lastMatchId == lobbyId guard inside the helper.
  //
  // Codex146 — `playerOwnElapsedRef` captures THIS client's own gameplay
  // timer the FIRST time we observe the match as finished. Subscription
  // events can later overwrite `winner` with a stripped-down
  // { name, email } object (no durationSeconds), but the ref is sticky
  // so the audit/display time shown in the popup is stable. Codex477:
  // Online score deltas do not use elapsed time or speed bonuses.
  const onlineResultAppliedRef = useRef(false);
  const playerOwnElapsedRef = useRef(null);
  useEffect(() => {
    if (!isOnline || !winner || !lobbyId) return;
    if (onlineResultAppliedRef.current) return;
    const winnerEmail = winner.email || winner.winner_email || lobbyData?.winner_email || null;
    const winnerName = winner.name || lobbyData?.winner || null;
    const isWinnerByEmail = Boolean(
      winnerEmail &&
      localPlayerEmail &&
      normalizeOnlineEmail(winnerEmail) === normalizeOnlineEmail(localPlayerEmail),
    );
    const isWinnerByName = Boolean(winnerName && myPlayerName && winnerName === myPlayerName);
    const localIsWinner = isWinnerByEmail || (!winnerEmail && isWinnerByName);
    const result = localIsWinner ? 'win' : 'loss';

    // Codex146 — Capture the player-own elapsed seconds exactly once,
    // the first time this effect sees a finished match. Source priority:
    //   1) winner.durationSeconds (set by useGameActions on the client
    //      that actually placed the winning card — most accurate)
    //   2) overallSecondsRef.current (local gameplay timer snapshot —
    //      used for the loser client and for the winner if subscription
    //      arrived first and stripped durationSeconds)
    // We do NOT use lobby.created_at / lobby.last_activity_at / invite
    // timestamps for elapsed display/audit.
    if (playerOwnElapsedRef.current === null) {
      playerOwnElapsedRef.current = getOnlinePlayerElapsedSeconds(
        { elapsedSeconds: winner.durationSeconds },
        overallSecondsRef.current,
      );
    }
    const durationSeconds = playerOwnElapsedRef.current;
    const opponentEmail = getOpponentEmailForOnlineResult(players, localPlayerEmail);
    setOnlineScoreResult({
      result,
      elapsedSeconds: durationSeconds,
      pending: true,
      message: 'Puan kaydediliyor...',
    });
    onlineResultAppliedRef.current = true;
    // Codex136 — structured-result aware. Persistence failures release the
    // ref so a later mount/effect run can retry safely. Gameplay is never
    // blocked on the puan write.
    applyOnlineMatchToCurrentUser({
      lobbyId,
      result,
      durationSeconds,
      opponentEmail,
      source: routeState?.inviteId ? 'friend_invite' : 'code_lobby',
    }).then((res) => {
      if (res?.refreshedUser) setCurrentUser(res.refreshedUser);
      const popupState = buildOnlineScorePopupState({ result, elapsedSeconds: durationSeconds, response: res }); // persisted proof: scoreAfter + saved: true on success; non-saved error/pending on failure
      if (popupState) setOnlineScoreResult(popupState);
      if (res && res.ok === false && res.retryable !== false) {
        debugLog('[Game] online score persist failed; will allow retry on next mount', res);
        // Codex146 — keep elapsed snapshot so a retry uses the same time
        // value the user was shown; just unflag applied so the effect runs.
        onlineResultAppliedRef.current = false;
      }
    }).catch((err) => {
      const message = err?.message || String(err);
      debugLog('[Game] online score persist crashed; will allow retry on next mount', { lobbyId, error: message });
      setOnlineScoreResult({
        result,
        elapsedSeconds: durationSeconds,
        pending: false,
        error: true,
        // Codex146 — failure message clearly indicates score did NOT persist.
        message: 'Puan kaydedilemedi. Tekrar dene.',
      });
      onlineResultAppliedRef.current = false;
    });
  }, [isOnline, winner, lobbyId, lobbyData?.winner_email, lobbyData?.winner, localPlayerEmail, myPlayerName, overallSecondsRef, players, routeState?.inviteId]);

  useEffect(() => {
    if (!isOnline || !winner) return;

    const winnerEmail = winner.email || winner.winner_email || lobbyData?.winner_email || null;
    const winnerName = winner.name || lobbyData?.winner || null;
    const isWinnerByEmail = Boolean(
      winnerEmail &&
      localPlayerEmail &&
      normalizeOnlineEmail(winnerEmail) === normalizeOnlineEmail(localPlayerEmail),
    );
    const isWinnerByName = Boolean(winnerName && myPlayerName && winnerName === myPlayerName);

    debugLog('[Game] online GameOver perspective:', {
      playerName: myPlayerName,
      playerEmail: localPlayerEmail,
      eventStatus: lobbyData?.status || null,
      eventWinner: winnerName,
      eventWinnerEmail: winnerEmail,
      eventLobbyId: lobbyId,
      setWinnerCalled: true,
      currentScreenState: 'game-over',
      renderedGameOver: true,
      isLocalWinner: isWinnerByEmail || (!winnerEmail && isWinnerByName),
      renderedTurnMessageText,
    });
  }, [
    isOnline,
    winner,
    lobbyData?.status,
    lobbyData?.winner,
    lobbyData?.winner_email,
    lobbyId,
    localPlayerEmail,
    myPlayerName,
    renderedTurnMessageText,
  ]);

  // ─── Actions (Domain/Use Case layer) ─────────────────────────
  const { doPlacement, advanceTurn, skipCurrentQuestion } = useGameActions({
    lobbyData,
    players,
    currentPlayerIndex,
    usedQuestionIds,
    currentQuestion,
    questionPool,
    winCardCount,
    lobbyId,
    isPlacingRef,
    overallSecondsRef,
    setLobbyData,
    setFeedback,
    setWinner,
    setSelectedZone,
    setTimerKey,
    setGameStarted,
    orderedQuestionPicker: isSoloLevelMode ? pickOrderedSoloQuestion : null,
    onQuestionAnswered: isSoloLevelMode ? handleSoloQuestionAnswered : null,
  });

  // ─── Effects ───────────────────────────────────────────────────────

  // Redirect if no player names and not an online game (online games fetch via useLobbySync)
  useEffect(() => {
    if (!playerNames && !isOnline) navigate('/');
  }, [playerNames, isOnline, navigate]);

  const handleQuestionBootstrapRetry = useCallback(() => {
    if (isSoloLevelMode) {
      lobbyDataRef.current = null;
      setLobbyData(null);
      setSoloAttemptDeck(null);
      setSoloAttemptId(null);
      setGameStarted(false);
      setWinner(null);
      setError(null);
      setSoloBootstrapRetryNonce((value) => value + 1);
    }
    refetch();
  }, [isSoloLevelMode, refetch, setError, setGameStarted, setLobbyData, setWinner]);

  useEffect(() => {
    if (isOnline || !playerNames) return;
    if (isLoading || allQuestions.length === 0) return;
    if (lobbyDataRef.current !== null) return;

    // Codex166/Codex180 — Solo Level mode: build the controlled attempt
    // deck via the Solo Question Selection Engine. Engine guarantees
    // unique question ids + unique years, active questions/categories,
    // and clean error when the pool can't supply the required unique years.
    let shuffled;
    if (isSoloLevelMode) {
      const preferenceReady = soloCategoryPreferenceState.status === 'ready'
        || soloCategoryPreferenceState.status === 'unavailable';
      const exposureReady = soloPlayerExposureState.status === 'ready'
        || soloPlayerExposureState.status === 'unavailable';
      if (!currentUserLoaded || !preferenceReady || !exposureReady) return;
      resetSoloJokers();
      // Base candidate pool: legacy year-window + non-music filter (same
      // as the non-Solo branch). The engine then enforces the HARD rules.
      const candidatePool = allQuestions
        .filter(q => q.type === 'metin')
        .filter(q => q.year >= yearStart && q.year <= yearEnd);
      const engineResult = buildSoloAttemptDeck({
        pool: candidatePool,
        // Codex168 — runtime wiring now passes the active Category
        // whitelist from the authenticated question fetch path. The
        // engine still owns the hard gate, so passive categories cannot
        // enter a Solo attempt deck even if stale cached rows exist.
        allowedMainCategoryIds: activeCategoryIds,
        recentlySeenQuestionIds: loadRecentHistory(),
        playerQuestionExposureStats: soloPlayerExposureState.stats,
        questionExposureStats: loadRecentQuestionExposureStats(),
        // No login or no saved Category preferences means all active
        // categories. Saved preferences are optional personalization, not a
        // gameplay gate or an empty question-pool filter.
        userSelectedCategoryIds: soloRuntimeCategoryPreferenceState.selectedCategoryIds,
        userCategoryPreferenceAvailable: soloRuntimeCategoryPreferenceState.available === true,
        userCategoryPreferenceFallbackReason: soloRuntimeCategoryPreferenceState.fallbackReason,
        levelNumber: soloLevel?.levelNumber,
        deckSize: getSoloAttemptDeckSizeForLevel(soloLevel?.levelNumber),
        seedCount: playerNames.length * 2,
        requireActiveCategoryWhitelist: true,
      });
      if (!engineResult.ok) {
        if (soloQuestionDebugEnabled) {
          setSoloQuestionDebugRuntimeState({
            candidatePool,
            engineResult,
            deck: [],
            soloStartInput: {
              level: soloLevel?.levelNumber,
              difficulty: 'level_window',
              requestedCount: getSoloAttemptDeckSizeForLevel(soloLevel?.levelNumber),
              yearStart,
              yearEnd,
              activeCategoryIds,
              playerSeedCount: playerNames.length * 2,
            },
          });
        }
        setError(engineResult.message);
        return;
      }
      if (soloQuestionDebugEnabled) {
        setSoloQuestionDebugRuntimeState({
          candidatePool,
          engineResult,
          deck: engineResult.deck,
          soloStartInput: {
            level: soloLevel?.levelNumber,
            difficulty: 'level_window',
            requestedCount: getSoloAttemptDeckSizeForLevel(soloLevel?.levelNumber),
            yearStart,
            yearEnd,
            activeCategoryIds,
            playerSeedCount: playerNames.length * 2,
          },
        });
      }
      setSoloAttemptDeck(engineResult.deck);
      setSoloAttemptId(engineResult.attemptId);
      shuffled = engineResult.deck;
    } else {
      // Legacy non-Solo offline path — exclude recently used cross-game
      // questions for better variety, then shuffle. UNCHANGED behavior.
      const recentHistory = new Set(loadRecentHistory());
      let seedPool = questionPool.filter(q => !recentHistory.has(String(q.id)));
      if (seedPool.length < playerNames.length * 2 + 5) {
        seedPool = [...questionPool];
      }
      shuffled = [...seedPool];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      if (shuffled.length < 3) {
        setError(`Yeterli soru yok. ${shuffled.length} soru var.`);
        return;
      }
    }

    let cursor = 0;
    const soloSeedQuestions = isSoloLevelMode ? getSoloSeedQuestions(shuffled, playerNames.length * 2) : [];
    let soloSeedCursor = 0;
    const used = new Set();
    const newPlayers = playerNames.map((name) => {
      const cards = [];
      for (let j = 0; j < 2; j++) {
        const q = isSoloLevelMode ? soloSeedQuestions[soloSeedCursor++] : shuffled[cursor++];
        if (q) {
          cards.push({ id: q.id, year: q.year, question: q.question, type: q.type, media_url: q.media_url });
          used.add(q.id);
        }
      }
      return { name, email: `player_${name}`, cards };
    });

    const firstQ = isSoloLevelMode
      ? getOrderedSoloDeckQuestion(shuffled, used, getTimelineYears(newPlayers[0]?.cards || []), {
        skippedQuestionIds: soloSkippedQuestionIdsRef.current,
        allowSkippedFallback: false,
      })
      : shuffled[cursor];
    if (!firstQ) { setError('İlk soru için yeterli soru yok'); return; }
    used.add(firstQ.id);

    // Record seed questions in persistent history
    appendToHistory([...used]);

    setLobbyData({
      players: newPlayers,
      current_player_index: 0,
      current_question_id: firstQ.id,
      used_question_ids: [...used]
    });
  }, [playerNames, questionPool, allQuestions, activeCategoryIds, yearStart, yearEnd, isLoading, isOnline, isSoloLevelMode, currentUserLoaded, currentUser?.email, soloCategoryPreferenceState.status, soloRuntimeCategoryPreferenceState, soloPlayerExposureState.status, soloPlayerExposureState.stats, resetSoloJokers, setLobbyData, setError, soloLevel?.levelNumber, soloQuestionDebugEnabled, soloBootstrapRetryNonce]);

  // Overall timer başlatma
  useEffect(() => {
    if (players.length > 0 && currentQuestion != null && !gameStarted) {
      setGameStarted(true);
    }
  }, [players.length, currentQuestion, gameStarted, setGameStarted]);

  useEffect(() => {
    if (!isGuidedSoloTutorial || guidedTutorialTimerIntroShown || !currentQuestion || winner || soloLevelResult) return;
    setGuidedTutorialTimerIntroShown(true);
    setGuidedTutorialPopup({ type: 'timer' });
  }, [
    currentQuestion,
    guidedTutorialTimerIntroShown,
    isGuidedSoloTutorial,
    soloLevelResult,
    winner,
  ]);

  useEffect(() => {
    if (!isGuidedSoloTutorial || guidedTutorialMistakePopupShown || !feedback || feedback.result !== 'wrong') return;
    setGuidedTutorialMistakePopupShown(true);
    setGuidedTutorialPopup({ type: 'mistake', protected: Boolean(mistakeShieldActive) });
  }, [feedback, guidedTutorialMistakePopupShown, isGuidedSoloTutorial, mistakeShieldActive]);

  // Timer reset on player turn change
  useEffect(() => {
    setTimerKey(k => k + 1);
    setIsTimeUp(false);
  }, [currentPlayerIndex, setTimerKey, setIsTimeUp]);

  // Codex282 — Mobile web gameplay drag guard. Browsers may treat card
  // movement as pull-to-refresh unless a native touchmove listener is
  // registered with passive:false while the card is actively dragged.
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const preventPullToRefreshDuringDrag = (event) => {
      if (!gameplayDragLockRef.current) return;
      if ('pointerType' in event && event.pointerType && event.pointerType !== 'touch') return;
      if (event.cancelable) event.preventDefault();
    };

    const cleanupCancelledDrag = () => {
      releaseGameplayDragLock();
      setIsDragging(false);
      setTouchDragPos(null);
    };

    window.addEventListener('touchmove', preventPullToRefreshDuringDrag, { passive: false });
    window.addEventListener('pointermove', preventPullToRefreshDuringDrag, { passive: false });
    window.addEventListener('touchend', cleanupCancelledDrag, { passive: true });
    window.addEventListener('pointerup', cleanupCancelledDrag, { passive: true });
    window.addEventListener('touchcancel', cleanupCancelledDrag, { passive: true });
    window.addEventListener('pointercancel', cleanupCancelledDrag, { passive: true });

    return () => {
      window.removeEventListener('touchmove', preventPullToRefreshDuringDrag);
      window.removeEventListener('pointermove', preventPullToRefreshDuringDrag);
      window.removeEventListener('touchend', cleanupCancelledDrag);
      window.removeEventListener('pointerup', cleanupCancelledDrag);
      window.removeEventListener('touchcancel', cleanupCancelledDrag);
      window.removeEventListener('pointercancel', cleanupCancelledDrag);
      releaseGameplayDragLock();
    };
  }, [releaseGameplayDragLock, setIsDragging, setTouchDragPos]);

  useEffect(() => {
    if (!isDragging) releaseGameplayDragLock();
  }, [isDragging, releaseGameplayDragLock]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimeout(winTimerRef.current);
      clearSoloTimerFreeze(false, false);
      releaseGameplayDragLock();
    };
  }, [clearSoloTimerFreeze, releaseGameplayDragLock]);

  // Browser close uyarısı
  useEffect(() => {
    const activeGameplayAttempt = Boolean(gameStarted && currentQuestion && !winner && !soloLevelResult);
    if (!activeGameplayAttempt) return;
    const handleBeforeUnload = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [gameStarted, currentQuestion, winner, soloLevelResult]);

  // Geri tuşu yakalama
  useEffect(() => {
    if (winner || soloLevelResult) return;
    window.history.pushState(null, '', window.location.href);
    const handlePopState = () => {
      if (window.confirm('Oyundan çıkmak istediğine emin misin?')) {
        navigate('/');
      } else {
        window.history.pushState(null, '', window.location.href);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [winner, soloLevelResult, navigate]);

  const guidedTutorialJokerStepActive = Boolean(
    isGuidedSoloTutorial &&
    !soloLevelResult &&
    !winner &&
    currentQuestion &&
    guidedTutorialExpectedJokerType
  );
  const guidedTutorialJokerDemoWaiting = Boolean(
    guidedTutorialJokerStepActive &&
    !guidedTutorialCurrentJokerUsed &&
    !feedback &&
    !guidedTutorialPopup
  );
  const guidedTutorialJokerRequiresTapBeforePlacement = Boolean(
    guidedTutorialJokerDemoWaiting &&
    (isGuidedJokerTapHintActive || !hasGuidedJokerTapHintMinimumElapsed)
  );

  useEffect(() => {
    if (!guidedTutorialJokerDemoWaiting) {
      stopGuidedJokerTapHint('tutorial_joker_step_exit');
      return undefined;
    }

    clearGuidedJokerTapHintTimers();
    guidedJokerTapHintActiveRef.current = true;
    guidedJokerTapHintMinimumElapsedRef.current = false;
    setIsGuidedJokerTapHintActive(true);
    setHasGuidedJokerTapHintMinimumElapsed(false);

    guidedJokerTapHintMinimumTimerRef.current = window.setTimeout(() => {
      guidedJokerTapHintMinimumTimerRef.current = null;
      guidedJokerTapHintMinimumElapsedRef.current = true;
      setHasGuidedJokerTapHintMinimumElapsed(true);
    }, GUIDED_JOKER_TAP_HINT_MIN_MS);

    guidedJokerTapHintAutoStopTimerRef.current = window.setTimeout(() => {
      guidedJokerTapHintMinimumElapsedRef.current = true;
      setHasGuidedJokerTapHintMinimumElapsed(true);
      stopGuidedJokerTapHint('auto_stop_10s');
    }, GUIDED_JOKER_TAP_HINT_MAX_MS);

    return () => {
      stopGuidedJokerTapHint('tutorial_joker_hint_cleanup', false);
    };
  }, [
    currentQuestion?.id,
    guidedTutorialAskedCardNumber,
    guidedTutorialExpectedJokerType,
    guidedTutorialJokerDemoWaiting,
    clearGuidedJokerTapHintTimers,
    stopGuidedJokerTapHint,
  ]);

  // ─── Handlers (UI event → action delegation) ─────────────────────
  const handleDropOnZone = useCallback((zoneIndex) => {
    if (guidedTutorialPopup) {
      setSelectedZone(zoneIndex);
      return;
    }
    if (guidedTutorialJokerRequiresTapBeforePlacement) {
      setSelectedZone(zoneIndex);
      setJokerError('');
      setJokerMessage(`Önce ${getGuidedTutorialJokerCopy(guidedTutorialExpectedJokerType).label} jokerini dene; gerçek çantandan harcanmaz.`);
      return;
    }
    doPlacement(zoneIndex, { category, yearStart, yearEnd });
  }, [doPlacement, category, yearStart, yearEnd, guidedTutorialExpectedJokerType, guidedTutorialJokerRequiresTapBeforePlacement, guidedTutorialPopup, setSelectedZone]);
  const handleConfirmPlacement = useCallback(() => {
    if (selectedZone === null) return;
    if (guidedTutorialPopup) return;
    if (guidedTutorialJokerRequiresTapBeforePlacement) {
      setJokerError('');
      setJokerMessage(`Devam etmeden önce ${getGuidedTutorialJokerCopy(guidedTutorialExpectedJokerType).label} jokerini bir kez kullan.`);
      return;
    }
    doPlacement(selectedZone, { category, yearStart, yearEnd });
  }, [doPlacement, selectedZone, category, yearStart, yearEnd, guidedTutorialExpectedJokerType, guidedTutorialJokerRequiresTapBeforePlacement, guidedTutorialPopup]);
  const handleTimeUp = useCallback(() => {
    if (feedback !== null || winner) return;
    if (!isMyTurn) return;
    setIsTimeUp(true);
    advanceTurn(winner);
  }, [feedback, winner, isMyTurn, advanceTurn, setIsTimeUp]);
  const handleFeedbackDone = useCallback(() => { setFeedback(null); setIsTimeUp(false); }, [setFeedback, setIsTimeUp]);
  const handleImageError = useCallback(() => {
    if (!isMyTurn) return;
    skipCurrentQuestion(currentQuestion?.id);
  }, [currentQuestion?.id, isMyTurn, skipCurrentQuestion]);
  const handleAudioError = useCallback(() => {
    if (!isMyTurn) return;
    skipCurrentQuestion(currentQuestion?.id);
  }, [currentQuestion?.id, isMyTurn, skipCurrentQuestion]);
  const handleGameplayCardDragStart = useCallback(() => {
    handleTimelineSwipeHintInteraction('question_card_drag_start');
    engageGameplayDragLock();
    lockSoloJokersForDrag();
    setIsDragging(true);
  }, [engageGameplayDragLock, handleTimelineSwipeHintInteraction, lockSoloJokersForDrag, setIsDragging]);
  const handleGameplayCardDragEnd = useCallback(() => {
    releaseGameplayDragLock();
    releaseSoloJokersAfterDrag();
    setIsDragging(false);
    setTouchDragPos(null);
  }, [releaseGameplayDragLock, releaseSoloJokersAfterDrag, setIsDragging, setTouchDragPos]);
  const handleGameplayCardTouchMove = useCallback((x, y) => {
    handleTimelineSwipeHintInteraction('question_card_touch_drag');
    engageGameplayDragLock();
    lockSoloJokersForDrag();
    setIsDragging(true);
    setTouchDragPos({ x, y });
  }, [engageGameplayDragLock, handleTimelineSwipeHintInteraction, lockSoloJokersForDrag, setIsDragging, setTouchDragPos]);
  const handleGameplayCardTouchEnd = useCallback((x, y) => {
    releaseGameplayDragLock();
    releaseSoloJokersAfterDrag();
    setIsDragging(false);
    setTouchDragPos(null);
    setTouchDragEnd({ x, y });
    setTimeout(() => setTouchDragEnd(null), 100);
  }, [releaseGameplayDragLock, releaseSoloJokersAfterDrag, setIsDragging, setTouchDragEnd, setTouchDragPos]);
  const handleGameplayCardTouchCancel = useCallback(() => {
    releaseGameplayDragLock();
    releaseSoloJokersAfterDrag();
    setIsDragging(false);
    setTouchDragPos(null);
  }, [releaseGameplayDragLock, releaseSoloJokersAfterDrag, setIsDragging, setTouchDragPos]);

  const markSoloJokerUsedForDecision = useCallback((decisionKey, jokerType) => {
    if (!decisionKey || !jokerType) return;
    soloJokerUsedByDecisionKeyRef.current.set(decisionKey, jokerType);
    jokerUsedRef.current = true;
    setUsedJokerType(jokerType);
  }, []);

  const startSoloTimerFreeze = useCallback(() => {
    const start = Date.now();
    timerFreezeStartRef.current = start;
    timerFreezeElapsedAtStartRef.current = soloEffectiveElapsedSecondsRef.current;
    setTimerFreezeUntil(start + 10000);
    setTimerFreezeTick(start);
    if (timerFreezeIntervalRef.current) window.clearInterval(timerFreezeIntervalRef.current);
    timerFreezeIntervalRef.current = window.setInterval(() => setTimerFreezeTick(Date.now()), 250);
    if (timerFreezeTimeoutRef.current) window.clearTimeout(timerFreezeTimeoutRef.current);
    timerFreezeTimeoutRef.current = window.setTimeout(() => {
      clearSoloTimerFreeze(true);
      setJokerMessage('');
    }, 10000);
  }, [clearSoloTimerFreeze]);

  const spendSoloJokerForCurrentCard = useCallback(async (jokerType, decisionKey, relatedQuestionId) => {
    const inventoryType = soloUiJokerTypeToInventoryType(jokerType);
    if (!inventoryType) {
      setJokerError('Joker türü geçersiz.');
      return false;
    }
    if (!currentUser?.email) {
      setJokerError('Joker kullanmak için giriş yapmalısın.');
      return false;
    }
    if (jokerInventoryLoading) {
      setJokerError('Joker Çantası hazırlanıyor.');
      return false;
    }
    const balance = normalizeJokerQuantity(jokerBalances[inventoryType]);
    if (balance <= 0) {
      setJokerError('Bu jokerden kalmadı.');
      return false;
    }
    if (jokerSpendPendingRef.current) return false;

    const idempotencyKey = buildSoloJokerUseIdempotencyKey(
      currentUser.email,
      soloAttemptId,
      decisionKey,
      jokerType,
    );
    if (!idempotencyKey) {
      setJokerError('Joker işlemi doğrulanamadı.');
      return false;
    }

    const setSoloJokerBalancesFromSpendResponse = (response) => {
      setJokerBalances((previousBalances) => mergeJokerSpendMutationBalances(
        previousBalances,
        response,
        inventoryType,
      ));
    };

    jokerSpendPendingRef.current = true;
    setJokerSpendPendingType(jokerType);
    try {
      const response = await spendUserJoker(currentUser, {
        jokerType: inventoryType,
        idempotencyKey,
        relatedEntityType: 'solo_question',
        relatedEntityId: relatedQuestionId,
        metadata: {
          soloAttemptId,
          soloLevelNumber: soloLevel?.levelNumber,
          questionId: relatedQuestionId,
          decisionKey,
          uiJokerType: jokerType,
          effect: 'solo_joker_use',
        },
      });
      if (response?.ok === false) {
        setSoloJokerBalancesFromSpendResponse(response);
        setJokerError(response?.error || 'Joker kullanılamadı.');
        return false;
      }
      setSoloJokerBalancesFromSpendResponse(response);
      recordDailyQuestProgress({
        eventType: 'joker_used',
        mode: 'joker',
        amount: 1,
        eventId: response?.transactionId || idempotencyKey,
        idempotencyKey,
        transactionId: response?.transactionId,
        metadata: {
          source: 'Game.jsx',
          soloAttemptId,
          soloLevelNumber: soloLevel?.levelNumber,
          questionId: relatedQuestionId,
          decisionKey,
          uiJokerType: jokerType,
          jokerType: inventoryType,
        },
      }).catch((error) => {
        debugLog('[Game] daily joker task progress failed:', error?.message || error);
      });
      if (inventoryType === 'time_freeze') {
        recordDailyQuestProgress({
          eventType: 'time_freeze_joker_used',
          mode: 'joker',
          amount: 1,
          eventId: response?.transactionId || idempotencyKey,
          idempotencyKey,
          transactionId: response?.transactionId,
          metadata: {
            source: 'Game.jsx',
            soloAttemptId,
            soloLevelNumber: soloLevel?.levelNumber,
            questionId: relatedQuestionId,
            decisionKey,
            uiJokerType: jokerType,
            jokerType: inventoryType,
          },
        }).catch((error) => {
          debugLog('[Game] daily time-freeze task progress failed:', error?.message || error);
        });
      }
      setJokerError('');
      return true;
    } catch {
      setJokerError('Joker kullanılamadı. Lütfen tekrar dene.');
      return false;
    } finally {
      jokerSpendPendingRef.current = false;
      setJokerSpendPendingType(null);
    }
  }, [
    currentUser,
    jokerBalances,
    jokerInventoryLoading,
    soloAttemptId,
    soloLevel?.levelNumber,
  ]);

  const handleUseSoloJoker = useCallback(async (jokerType) => {
    if (!isSoloLevelMode || soloLevelResult || winner || feedback || !isMyTurn || jokerSpendPendingRef.current) return;
    const dragGuardActive = Boolean(
      isDragging ||
      soloJokerDragLocked ||
      Date.now() < soloJokerDragGuardUntilRef.current
    );
    if (dragGuardActive) return;
    if (!currentQuestion?.id) return;
    setJokerError('');

    const decisionKey = getCurrentSoloJokerDecisionKey(currentQuestion);
    if (!decisionKey) return;
    if (soloJokerUsedByDecisionKeyRef.current.has(decisionKey)) {
      setJokerError('Bu kartta zaten joker kullandın.');
      return;
    }

    if (isGuidedSoloTutorial) {
      if (!guidedTutorialExpectedJokerType) {
        setJokerError('Joker adımı birazdan açılacak.');
        return;
      }
      const expectedJokerCopy = getGuidedTutorialJokerCopy(guidedTutorialExpectedJokerType);
      if (jokerType !== guidedTutorialExpectedJokerType) {
        setJokerError(`Eğitimde şimdi ${expectedJokerCopy.label} jokerini dene.`);
        return;
      }
      if (!guidedTutorialJokerStepActive) {
        setJokerError('Joker adımı birazdan açılacak.');
        return;
      }
      const markGuidedTutorialJokerDemoUsed = () => {
        markSoloJokerUsedForDecision(decisionKey, jokerType);
        setGuidedTutorialJokerDemoUsedByCard((previous) => ({
          ...previous,
          [guidedTutorialAskedCardNumber]: true,
        }));
        stopGuidedJokerTapHint('joker_pressed');
      };
      setJokerError('');
      if (jokerType === SOLO_UI_JOKER_TYPES.TIME_FREEZE) {
        markGuidedTutorialJokerDemoUsed();
        setJokerMessage('');
        startSoloTimerFreeze();
        return;
      }
      if (jokerType === SOLO_UI_JOKER_TYPES.MISTAKE_SHIELD) {
        markGuidedTutorialJokerDemoUsed();
        setJokerMessage('');
        setMistakeShieldActive(true);
        return;
      }
      if (jokerType === SOLO_UI_JOKER_TYPES.CARD_SWAP) {
        const usedSwapCount = Array.from(soloJokerUsedByDecisionKeyRef.current.values())
          .filter((usedType) => usedType === SOLO_UI_JOKER_TYPES.CARD_SWAP).length;
        if (usedSwapCount >= SOLO_CARD_SWAP_BUFFER_CARDS) {
          stopGuidedJokerTapHint('joker_pressed');
          setJokerError('Bu seviyede Kart Değiştir yedek kart hakkı bitti.');
          return;
        }
        if (!Array.isArray(soloAttemptDeck) || !currentQuestion || !currentPlayer) {
          stopGuidedJokerTapHint('joker_pressed');
          setJokerError('Bu kart şu anda değiştirilemiyor.');
          return;
        }
        const usedIds = new Set([...(usedQuestionIds || [])]);
        usedIds.delete(currentQuestion.id);
        const timelineYears = getTimelineYears(currentPlayer.cards || []);
        const skippedIds = new Set(soloSkippedQuestionIdsRef.current);
        skippedIds.add(currentQuestion.id);
        const replacement = getOrderedSoloDeckQuestion(soloAttemptDeck, usedIds, timelineYears, {
          skippedQuestionIds: skippedIds,
          excludeQuestionIds: [currentQuestion.id],
          allowSkippedFallback: false,
          requireVisibleYearSpacing: true,
        });

        if (!replacement) {
          stopGuidedJokerTapHint('joker_pressed');
          setJokerError('Bu kart şu anda değiştirilemiyor.');
          return;
        }

        soloJokerDecisionKeyByQuestionIdRef.current.set(String(replacement.id), decisionKey);
        markGuidedTutorialJokerDemoUsed();
        setJokerMessage('');
        setSelectedZone(null);
        soloSkippedQuestionIdsRef.current = skippedIds;
        soloReplacementQuestionIdsRef.current.add(String(replacement.id));
        recordSoloQuestionAnalyticsEvent(currentQuestion, QUESTION_ANALYTICS_EVENT_TYPES.SWAPPED_OUT, {
          was_swapped_out: true,
          joker_used: true,
          joker_type: 'swapCard',
          source: QUESTION_ANALYTICS_SOURCES.DECK,
        });
        recordSoloQuestionAnalyticsEvent(replacement, QUESTION_ANALYTICS_EVENT_TYPES.REPLACEMENT_SHOWN, {
          replacement_for_question_id: String(currentQuestion.id),
          joker_used: true,
          joker_type: 'swapCard',
          source: QUESTION_ANALYTICS_SOURCES.REPLACEMENT,
        });
        appendToHistory([currentQuestion.id, replacement.id]);
        setLobbyData((prev) => {
          if (!prev) return prev;
          const nextUsed = new Set(prev.used_question_ids || []);
          nextUsed.delete(currentQuestion.id);
          nextUsed.add(replacement.id);
          return {
            ...prev,
            current_question_id: replacement.id,
            used_question_ids: [...nextUsed],
          };
        });
        return;
      }
      return;
    }

    if (jokerType === SOLO_UI_JOKER_TYPES.MISTAKE_SHIELD) {
      if (mistakeShieldActive) {
        setJokerError('Kronokalkan zaten aktif.');
        return;
      }
      const usedShieldCount = Array.from(soloJokerUsedByDecisionKeyRef.current.values())
        .filter((usedType) => usedType === SOLO_UI_JOKER_TYPES.MISTAKE_SHIELD).length;
      if (usedShieldCount >= SOLO_MISTAKE_SHIELD_BUFFER_CARDS) {
        setJokerError('Bu seviyede Kronokalkan yedek hakkı bitti.');
        return;
      }
      const spent = await spendSoloJokerForCurrentCard(jokerType, decisionKey, currentQuestion.id);
      if (!spent) return;
      markSoloJokerUsedForDecision(decisionKey, jokerType);
      setMistakeShieldActive(true);
      setJokerMessage('');
      return;
    }

    if (jokerType === SOLO_UI_JOKER_TYPES.TIME_FREEZE) {
      if (isSoloTimerFrozen || timerFreezeStartRef.current) {
        setJokerError('Zaman Dondur zaten aktif.');
        return;
      }
      const spent = await spendSoloJokerForCurrentCard(jokerType, decisionKey, currentQuestion.id);
      if (!spent) return;
      markSoloJokerUsedForDecision(decisionKey, jokerType);
      setJokerMessage('');
      startSoloTimerFreeze();
      return;
    }

    if (jokerType === SOLO_UI_JOKER_TYPES.CARD_SWAP) {
      const usedSwapCount = Array.from(soloJokerUsedByDecisionKeyRef.current.values())
        .filter((usedType) => usedType === SOLO_UI_JOKER_TYPES.CARD_SWAP).length;
      if (usedSwapCount >= SOLO_CARD_SWAP_BUFFER_CARDS) {
        setJokerError('Bu seviyede Kart Değiştir yedek kart hakkı bitti.');
        return;
      }
      if (!Array.isArray(soloAttemptDeck) || !currentQuestion || !currentPlayer) {
        setJokerError('Bu kart şu anda değiştirilemiyor.');
        return;
      }
      const usedIds = new Set([...(usedQuestionIds || [])]);
      usedIds.delete(currentQuestion.id);
      const timelineYears = getTimelineYears(currentPlayer.cards || []);
      const skippedIds = new Set(soloSkippedQuestionIdsRef.current);
      skippedIds.add(currentQuestion.id);
      const replacement = getOrderedSoloDeckQuestion(soloAttemptDeck, usedIds, timelineYears, {
        skippedQuestionIds: skippedIds,
        excludeQuestionIds: [currentQuestion.id],
        allowSkippedFallback: false,
        requireVisibleYearSpacing: true,
      });

      if (!replacement) {
        setJokerError('Bu kart şu anda değiştirilemiyor.');
        return;
      }

      const spent = await spendSoloJokerForCurrentCard(jokerType, decisionKey, currentQuestion.id);
      if (!spent) return;
      soloJokerDecisionKeyByQuestionIdRef.current.set(String(replacement.id), decisionKey);
      markSoloJokerUsedForDecision(decisionKey, jokerType);
      setJokerMessage('');
      setSelectedZone(null);
      soloSkippedQuestionIdsRef.current = skippedIds;
      soloReplacementQuestionIdsRef.current.add(String(replacement.id));
      recordSoloQuestionAnalyticsEvent(currentQuestion, QUESTION_ANALYTICS_EVENT_TYPES.SWAPPED_OUT, {
        was_swapped_out: true,
        joker_used: true,
        joker_type: 'swapCard',
        source: QUESTION_ANALYTICS_SOURCES.DECK,
      });
      recordSoloQuestionAnalyticsEvent(replacement, QUESTION_ANALYTICS_EVENT_TYPES.REPLACEMENT_SHOWN, {
        replacement_for_question_id: String(currentQuestion.id),
        joker_used: true,
        joker_type: 'swapCard',
        source: QUESTION_ANALYTICS_SOURCES.REPLACEMENT,
      });
      appendToHistory([currentQuestion.id, replacement.id]);
      setLobbyData((prev) => {
        if (!prev) return prev;
        const nextUsed = new Set(prev.used_question_ids || []);
        nextUsed.delete(currentQuestion.id);
        nextUsed.add(replacement.id);
        return {
          ...prev,
          current_question_id: replacement.id,
          used_question_ids: [...nextUsed],
        };
      });
    }
  }, [
    isSoloLevelMode,
    isGuidedSoloTutorial,
    currentQuestion,
    getCurrentSoloJokerDecisionKey,
    soloLevelResult,
    winner,
    feedback,
    isMyTurn,
    isDragging,
    soloJokerDragLocked,
    guidedTutorialAskedCardNumber,
    guidedTutorialExpectedJokerType,
    guidedTutorialJokerStepActive,
    mistakeShieldActive,
    isSoloTimerFrozen,
    markSoloJokerUsedForDecision,
    startSoloTimerFreeze,
    stopGuidedJokerTapHint,
    spendSoloJokerForCurrentCard,
    soloAttemptDeck,
    currentPlayer,
    usedQuestionIds,
    recordSoloQuestionAnalyticsEvent,
    setSelectedZone,
    setLobbyData,
  ]);

  const handleOpenSoloHint = useCallback(() => {
    if (!isSoloLevelMode || isGuidedSoloTutorial || soloLevelResult || winner || feedback || !isMyTurn) return;
    if (!currentQuestion?.id || !currentSoloHintCardKey) return;
    if (hintInventoryLoading) {
      setHintError('İpucu hakları hazırlanıyor.');
      return;
    }
    const balance = normalizeHintQuantity(hintBalance);
    if (balance <= 0 && currentSoloHintRevealStage <= 0) {
      setHintError('İpucu hakkın kalmadı.');
      return;
    }
    setHintError('');
    hintPopupOpenRef.current = true;
    setHintPopupOpen(true);
  }, [
    currentQuestion?.id,
    currentSoloHintCardKey,
    currentSoloHintRevealStage,
    feedback,
    hintBalance,
    hintInventoryLoading,
    isGuidedSoloTutorial,
    isMyTurn,
    isSoloLevelMode,
    soloLevelResult,
    winner,
  ]);

  const handleUseSoloHint = useCallback(async () => {
    if (!hintPopupOpen || hintConsumePendingRef.current) return;
    if (!isSoloLevelMode || isGuidedSoloTutorial || soloLevelResult || winner || feedback || !isMyTurn) return;
    if (!currentQuestion?.id || !currentSoloHintCardKey) return;
    const currentStage = normalizeHintRevealStage(currentSoloHintRevealStage);
    if (currentStage >= 3) return;
    if (normalizeHintQuantity(hintBalance) <= 0) {
      setHintError('İpucu hakkın kalmadı.');
      return;
    }
    const nextStage = currentStage + 1;
    const idempotencyKey = buildSoloHintUseIdempotencyKey({
      soloAttemptId,
      questionId: currentQuestion.id,
      revealStage: nextStage,
    });
    if (!idempotencyKey) {
      setHintError('İpucu işlemi doğrulanamadı.');
      return;
    }

    hintConsumePendingRef.current = true;
    setHintConsumePending(true);
    try {
      const response = await consumeUserHint({
        guestCredentials: currentUser?.email ? null : guestDailyQuestPayload,
        idempotencyKey,
        soloAttemptId,
        soloLevelNumber: soloLevel?.levelNumber,
        questionId: currentQuestion.id,
        revealStage: nextStage,
      });
      if (response?.ok === false) {
        setHintBalance(normalizeHintQuantity(response?.hintBalance ?? hintBalance));
        setHintError(response?.error || 'İpucu kullanılamadı.');
        return;
      }

      const responseStage = normalizeHintRevealStage(response?.revealStage || nextStage);
      setHintBalance(normalizeHintQuantity(response?.hintBalance));
      setHintRevealStagesByCard((previous) => ({
        ...previous,
        [currentSoloHintCardKey]: Math.max(
          normalizeHintRevealStage(previous[currentSoloHintCardKey]),
          responseStage,
          nextStage,
        ),
      }));
      setHintError('');
      recordDailyQuestProgress({
        ...(currentUser?.email ? {} : (guestDailyQuestPayload || {})),
        eventType: 'hint_used',
        mode: 'solo_hint',
        amount: 1,
        eventId: response?.transactionId || idempotencyKey,
        idempotencyKey,
        transactionId: response?.transactionId,
        metadata: {
          source: 'Game.jsx',
          soloAttemptId,
          soloLevelNumber: soloLevel?.levelNumber,
          questionId: currentQuestion.id,
          revealStage: responseStage,
          hintUseSeparateFromJoker: true,
        },
      }).catch((error) => {
        debugLog('[Game] daily hint task progress failed:', error?.message || error);
      });
    } catch {
      setHintError('İpucu kullanılamadı. Lütfen tekrar dene.');
    } finally {
      hintConsumePendingRef.current = false;
      setHintConsumePending(false);
    }
  }, [
    currentQuestion?.id,
    currentSoloHintCardKey,
    currentSoloHintRevealStage,
    currentUser?.email,
    feedback,
    guestDailyQuestPayload,
    hintBalance,
    hintPopupOpen,
    isGuidedSoloTutorial,
    isMyTurn,
    isSoloLevelMode,
    soloAttemptId,
    soloLevel?.levelNumber,
    soloLevelResult,
    winner,
  ]);

  const handleRestart = () => {
    setOnlineScoreResult(null);
    onlineResultAppliedRef.current = false;
    playerOwnElapsedRef.current = null;
    resetGame();
    navigate('/');
  };

  // Solo v3 — count evaluated placement moves from feedback. `feedback` is
  // produced only by the final placement evaluation path, so touch/drag start,
  // invalid drops, cancelled drags, tutorial hints, popups, and joker buttons
  // do not consume moves.
  useEffect(() => {
    if (!isSoloLevelMode) return;
    if (!feedback) { lastCountedFeedbackRef.current = null; return; }
    if (feedback === lastCountedFeedbackRef.current) return;
    lastCountedFeedbackRef.current = feedback;
    if (feedback.result === 'wrong') {
      setSoloCorrectStreak(0);
      if (mistakeShieldActive) {
        setMistakeShieldActive(false);
        setJokerMessage('');
        setJokerError('');
        return;
      }
      setUsedMoveCount((prev) => Math.min(soloMaxMoves, prev + 1));
      setMistakeCount((prev) => prev + 1);
      return;
    }
    if (feedback.result === 'correct') {
      setUsedMoveCount((prev) => Math.min(soloMaxMoves, prev + 1));
      setSoloCorrectStreak((prev) => prev + 1);
    }
  }, [feedback, isSoloLevelMode, mistakeShieldActive, soloMaxMoves]);

  // Codex106 — finalize result when the attempt ends.
  //
  //   PASS  → winner set by doPlacement when the level-aware placed-card
  //           target is reached. Stars come from used evaluated moves.
  //   FAIL  → usedMoveCount >= maxMoves without enough timeline cards OR
  //           overallSeconds >= 180
  //           before winner exists. We force-stop the timer by setting
  //           gameStarted=false and surface a fail overlay.
  //
  // Persistence happens once; SoloChallenge re-reads progress on its
  // location.state.soloResultApplied flag.
  useEffect(() => {
    if (!isSoloLevelMode || soloLevelResult) return;
    const totalTime = soloLevel?.totalTimeSeconds ?? SOLO_LEVEL_TIME_SECONDS;
    const cardTarget = winCardCount || soloCardsRequired || 7;
    const remainingMoves = Math.max(0, soloMaxMoves - usedMoveCount);

    // PASS path — winner was set by the win condition inside doPlacement.
    if (winner) {
      const elapsed = getSoloResultElapsedSeconds(winner.durationSeconds);
      const attempt = calculateSoloAttemptResult({
        mistakes: mistakeCount,
        usedMoves: usedMoveCount,
        remainingMoves,
        maxMoves: soloMaxMoves,
        completedCards: cardTarget,
        elapsedSeconds: elapsed,
        requiredCards: cardTarget,
      });
      // The win condition already enforces the card target via winCardCount.
      setSoloLevelResult({
        passed: attempt.passed,
        stars: attempt.stars,
        mistakes: attempt.mistakes,
        usedMoves: attempt.usedMoves,
        remainingMoves: attempt.remainingMoves,
        maxMoves: attempt.maxMoves,
        timeSeconds: elapsed,
        baseScore: attempt.baseScore,
        timeBonus: attempt.timeBonus,
        levelScore: attempt.levelScore,
        cardsCompleted: cardTarget,
        cardTarget,
        failReason: attempt.failReason,
        soloRulesVersion: SOLO_RULES_VERSION,
      });
      const completionEventId = `${soloAttemptId || 'solo_attempt'}:solo_level_complete:${soloLevel?.levelNumber || 1}`;
      if (soloDailyQuestCompletionRecordedRef.current !== completionEventId) {
        soloDailyQuestCompletionRecordedRef.current = completionEventId;
        recordDailyQuestSoloEvent('solo_level_complete', completionEventId, {
          questType: 'solo_level_complete',
          passed: true,
          cardsCompleted: cardTarget,
          elapsedSeconds: elapsed,
        });
        const jokerlessCompletionEventId = `${soloAttemptId || 'solo_attempt'}:jokerless_solo_level_complete:${soloLevel?.levelNumber || 1}`;
        const jokerUsedThisAttempt = soloJokerUsedByDecisionKeyRef.current.size > 0;
        if (!jokerUsedThisAttempt) {
          recordDailyQuestSoloEvent('jokerless_solo_level_complete', jokerlessCompletionEventId, {
            questType: 'jokerless_solo_level_complete',
            passed: true,
            jokerUsed: false,
            cardsCompleted: cardTarget,
            elapsedSeconds: elapsed,
          });
        }
      }
      return;
    }

    // FAIL — no remaining evaluated placement moves and target not reached.
    if (usedMoveCount >= soloMaxMoves && cardsCompletedSolo < cardTarget) {
      const elapsed = getSoloResultElapsedSeconds(overallSecondsRef.current);
      const attempt = calculateSoloAttemptResult({
        mistakes: mistakeCount,
        usedMoves: usedMoveCount,
        remainingMoves,
        maxMoves: soloMaxMoves,
        completedCards: cardsCompletedSolo,
        elapsedSeconds: elapsed,
        requiredCards: cardTarget,
      });
      setGameStarted(false);
      setSoloLevelResult({
        passed: attempt.passed,
        stars: attempt.stars,
        mistakes: attempt.mistakes,
        usedMoves: attempt.usedMoves,
        remainingMoves: attempt.remainingMoves,
        maxMoves: attempt.maxMoves,
        timeSeconds: elapsed,
        baseScore: attempt.baseScore,
        timeBonus: attempt.timeBonus,
        levelScore: attempt.levelScore,
        cardsCompleted: cardsCompletedSolo,
        cardTarget,
        failReason: attempt.failReason || 'moves',
        soloRulesVersion: SOLO_RULES_VERSION,
      });
      return;
    }

    // FAIL — total timer expired without a winner.
    if (gameStarted && soloEffectiveElapsedSeconds >= totalTime) {
      const attempt = calculateSoloAttemptResult({
        mistakes: mistakeCount,
        usedMoves: usedMoveCount,
        remainingMoves,
        maxMoves: soloMaxMoves,
        completedCards: cardsCompletedSolo,
        elapsedSeconds: totalTime,
        requiredCards: cardTarget,
      });
      setGameStarted(false);
      setSoloLevelResult({
        passed: attempt.passed,
        stars: attempt.stars,
        mistakes: attempt.mistakes,
        usedMoves: attempt.usedMoves,
        remainingMoves: attempt.remainingMoves,
        maxMoves: attempt.maxMoves,
        timeSeconds: totalTime,
        baseScore: attempt.baseScore,
        timeBonus: attempt.timeBonus,
        levelScore: attempt.levelScore,
        cardsCompleted: cardsCompletedSolo,
        cardTarget,
        failReason: attempt.failReason || 'timeout',
        soloRulesVersion: SOLO_RULES_VERSION,
      });
    }
  }, [
    isSoloLevelMode,
    soloLevelResult,
    soloLevel,
    winner,
    mistakeCount,
    usedMoveCount,
    soloMaxMoves,
    getSoloResultElapsedSeconds,
    soloEffectiveElapsedSeconds,
    gameStarted,
    cardsCompletedSolo,
    soloCardsRequired,
    winCardCount,
    setGameStarted,
    recordDailyQuestSoloEvent,
    soloAttemptId,
  ]);

  // Persist the level attempt once when the result first lands.
  useEffect(() => {
    if (!isSoloLevelMode || !soloLevelResult || soloResultPersistedRef.current) return;
    soloResultPersistedRef.current = true;
    const levelNumber = soloLevel?.levelNumber ?? 1;
    (async () => {
      try {
        const me = await base44.auth.me().catch(() => null);
        const current = readSoloProgress(me);
        const previousEntry = current?.levels?.[String(levelNumber)] || null;
        const attempt = calculateSoloAttemptResult({
          mistakes: soloLevelResult.mistakes,
          usedMoves: soloLevelResult.usedMoves,
          remainingMoves: soloLevelResult.remainingMoves,
          maxMoves: soloLevelResult.maxMoves,
          completedCards: soloLevelResult.cardsCompleted,
          elapsedSeconds: soloLevelResult.timeSeconds,
          requiredCards: soloLevelResult.cardTarget ?? soloCardsRequired ?? 7,
        });
        const bestPreview = getBestSoloLevelResult(previousEntry, {
          ...attempt,
          soloRulesVersion: soloLevelResult.soloRulesVersion || SOLO_RULES_VERSION,
          stars: soloLevelResult.stars,
          passed: soloLevelResult.passed,
          usedMoves: soloLevelResult.usedMoves,
          remainingMoves: soloLevelResult.remainingMoves,
          maxMoves: soloLevelResult.maxMoves,
          baseScore: soloLevelResult.baseScore,
          timeBonus: soloLevelResult.timeBonus,
          levelScore: soloLevelResult.levelScore,
        });
        setSoloLevelResult((prev) => prev ? {
          ...prev,
          scoreDelta: bestPreview.scoreDelta,
          didImproveScore: bestPreview.didImprove,
          bestScoreAfter: bestPreview.updatedBestLevelResult.bestScore,
        } : prev);
        const next = applyLevelAttempt(current, {
          levelNumber,
          stars: soloLevelResult.stars,
          mistakes: soloLevelResult.mistakes,
          usedMoves: soloLevelResult.usedMoves,
          remainingMoves: soloLevelResult.remainingMoves,
          maxMoves: soloLevelResult.maxMoves,
          timeSeconds: soloLevelResult.timeSeconds,
          cardsCompleted: soloLevelResult.cardsCompleted,
          cardTarget: soloLevelResult.cardTarget ?? soloCardsRequired ?? 7,
          passed: soloLevelResult.passed,
          baseScore: soloLevelResult.baseScore,
          timeBonus: soloLevelResult.timeBonus,
          levelScore: soloLevelResult.levelScore,
          soloRulesVersion: soloLevelResult.soloRulesVersion || SOLO_RULES_VERSION,
        });
        await writeSoloProgress(me, next);
      } catch (e) {
        debugLog('[Game] solo progress persist failed:', e?.message || e);
      }
    })();
  }, [isSoloLevelMode, soloLevelResult, soloLevel, soloCardsRequired]);

  const handleSoloRetry = useCallback(() => {
    if (!soloLevel) return;
    // Reset all attempt-local state and re-enter the same level.
    setSoloLevelResult(null);
    setUsedMoveCount(0);
    setMistakeCount(0);
    setSoloCorrectStreak(0);
    lastCountedFeedbackRef.current = null;
    soloResultPersistedRef.current = false;
    resetSoloJokers();
    // Codex166 — Replay = new attempt = new deck. Drop the previous
    // attempt deck so the Solo init effect re-runs the engine.
    setSoloAttemptDeck(null);
    setSoloAttemptId(null);
    resetGame();
    const retryMaxMoves = getSoloMaxMovesForLevel(soloLevel.levelNumber);
    navigate('/game', {
      replace: true,
      state: {
        playerNames: ['Sen'],
        category: 'karisik',
        yearStart: routeYearStart,
        yearEnd: routeYearEnd,
        turnDuration: 0,
        winCardCount: getSoloTimelineWinCardCountForLevel(soloLevel.levelNumber),
        soloLevel: {
          ...soloLevel,
          cardCount: getSoloCardsRequiredForLevel(soloLevel.levelNumber),
          deckSize: getSoloAttemptDeckSizeForLevel(soloLevel.levelNumber),
          onboardingTutorial: isGuidedSoloTutorial,
          totalTimeSeconds: isGuidedSoloTutorial ? GUIDED_TUTORIAL_TIME_LIMIT_SECONDS : SOLO_LEVEL_TIME_SECONDS,
          maxMoves: retryMaxMoves,
          maxMistakes: retryMaxMoves,
          soloRulesVersion: SOLO_RULES_VERSION,
        },
        onboardingTutorial: isGuidedSoloTutorial,
        soloReturnTo,
      },
    });
  }, [isGuidedSoloTutorial, soloLevel, soloReturnTo, resetGame, resetSoloJokers, navigate, routeYearStart, routeYearEnd]);

  // Codex106-23 — Jump straight into the next level after a passed attempt.
  // We rebuild the route state from the next level number, reusing the same
  // year window so Game.jsx renders identical question generation.
  const handleSoloNextLevel = useCallback(() => {
    if (!soloLevel) return;
    if (isGuidedSoloTutorial) {
      (async () => {
        try {
          await updateGuestProfileOnboarding({
            onboarding_status: GUEST_ONBOARDING_STATES.PROFILE_SETUP_PENDING,
            tutorial_status: 'completed',
            profile_setup_status: 'pending',
          });
        } catch (error) {
          debugLog('[Game] guided tutorial completion handoff deferred:', error?.message || error);
        } finally {
          resetSoloJokers();
          resetGame();
          navigate('/onboarding', { replace: true, state: { guidedTutorialCompleted: true } });
        }
      })();
      return;
    }
    const nextLevelNumber = soloLevel.levelNumber + 1;
    if (nextLevelNumber > getSoloLevelCount()) return;
    const nextCardCount = getSoloCardsRequiredForLevel(nextLevelNumber);
    const nextMaxMoves = getSoloMaxMovesForLevel(nextLevelNumber);
    setSoloLevelResult(null);
    setUsedMoveCount(0);
    setMistakeCount(0);
    setSoloCorrectStreak(0);
    lastCountedFeedbackRef.current = null;
    soloResultPersistedRef.current = false;
    resetSoloJokers();
    // Codex166 — New level = new attempt = new deck.
    setSoloAttemptDeck(null);
    setSoloAttemptId(null);
    resetGame();
    navigate('/game', {
      replace: true,
      state: {
        playerNames: ['Sen'],
        category: 'karisik',
        yearStart: routeYearStart,
        yearEnd: routeYearEnd,
        turnDuration: 0,
        winCardCount: getSoloTimelineWinCardCountForLevel(nextLevelNumber),
        soloLevel: {
          ...soloLevel,
          levelNumber: nextLevelNumber,
          cardCount: nextCardCount,
          deckSize: getSoloAttemptDeckSizeForLevel(nextLevelNumber),
          totalTimeSeconds: SOLO_LEVEL_TIME_SECONDS,
          maxMoves: nextMaxMoves,
          maxMistakes: nextMaxMoves,
          soloRulesVersion: SOLO_RULES_VERSION,
        },
        soloReturnTo,
      },
    });
  }, [isGuidedSoloTutorial, soloLevel, soloReturnTo, resetGame, resetSoloJokers, navigate, routeYearStart, routeYearEnd]);

  const handleSoloGameplayBack = useCallback(() => {
    if (!isSoloLevelMode) return;
    resetSoloJokers();
    resetGame();
    navigate(resolveSoloGameReturnPath(routeState), { replace: true });
  }, [isSoloLevelMode, navigate, resetGame, resetSoloJokers, routeState]);

  const handleSoloBackToPath = useCallback(() => {
    if (isGuidedSoloTutorial) {
      (async () => {
        if (soloLevelResult?.passed) {
          try {
            await updateGuestProfileOnboarding({
              onboarding_status: GUEST_ONBOARDING_STATES.PROFILE_SETUP_PENDING,
              tutorial_status: 'completed',
              profile_setup_status: 'pending',
            });
          } catch (error) {
            debugLog('[Game] guided tutorial completion back-path handoff deferred:', error?.message || error);
          }
        }
        resetSoloJokers();
        resetGame();
        navigate('/onboarding', { state: soloLevelResult?.passed ? { guidedTutorialCompleted: true } : {} });
      })();
      return;
    }
    resetSoloJokers();
    resetGame();
    navigate('/solo', { state: { soloResultApplied: true } });
  }, [isGuidedSoloTutorial, soloLevelResult?.passed, resetSoloJokers, resetGame, navigate]);

  const gameOverView = winner ? (
    <>
      <GameDebugLog />
      <GameOver
        winner={winner.name}
        winnerEmail={winner.email || winner.winner_email || lobbyData?.winner_email || null}
        durationSeconds={winner.durationSeconds}
        winCardCount={winCardCount}
        onRestart={handleRestart}
        isSinglePlayer={!isOnline && playerNames?.length === 1}
        isOnline={isOnline}
        localPlayerName={myPlayer?.name || myPlayerName}
        localPlayerEmail={localPlayerEmail}
        onlineScoreResult={isOnline ? onlineScoreResult : null}
      />
    </>
  ) : null;

  const beginnerPlacementHintZone = useMemo(() => {
    if (!isSoloLevelMode) return null;
    if (!shouldShowBeginnerPlacementHint(soloLevel?.levelNumber)) return null;
    if (!isDragging || !isMyTurn || feedback || winner || !currentQuestion || !currentPlayer) return null;

    const questionYear = Number(currentQuestion.year);
    const cards = Array.isArray(currentPlayer.cards) ? currentPlayer.cards : [];
    if (!Number.isFinite(questionYear)) return null;

    for (let zoneIndex = 0; zoneIndex <= cards.length; zoneIndex += 1) {
      if (isCorrectPlacement(cards, questionYear, zoneIndex)) return zoneIndex;
    }
    return null;
  }, [
    isSoloLevelMode,
    soloLevel?.levelNumber,
    isDragging,
    isMyTurn,
    feedback,
    winner,
    currentQuestion,
    currentPlayer,
  ]);

  // ─── Diagnostics overlay (Codex084) ──────────────────────────────
  // Must be computed BEFORE every render guard so we can render it on any
  // gate. All inputs are non-hook derived values; safe to do here.
  const availableQuestionsCount = allQuestions.filter(q => q.year >= yearStart && q.year <= yearEnd).length;
  const onlineDeckReady = isOnline && onlineQuestionDeck.length > 0;
  const bootstrapQuestionsReady = isOnline ? onlineDeckReady : allQuestions.length > 0;
  const isGameReadyEarly = isOnline
    ? players.length > 0 && onlineDeckReady && lobbyData?.current_question_id && currentQuestion != null
    : players.length > 0 && currentQuestion != null;
  const missingOnlineQuestionEarly = isOnline && onlineDeckReady && lobbyData?.current_question_id && !currentQuestion;
  const renderStage = winner
    ? 'render_game_over'
    : error
      ? 'render_error'
      : (!isOnline && isLoading && !isGameReadyEarly)
        ? 'waiting_for_questions'
        : (!isOnline && isError && !isGameReadyEarly)
          ? 'questions_error'
          : missingOnlineQuestionEarly
            ? 'waiting_for_question'
            : (isOnline && !lobbyData)
              ? 'waiting_for_lobby'
              : (isOnline && (!lobbyData?.players || lobbyData.players.length === 0))
                ? 'waiting_for_players'
                : !isGameReadyEarly
                  ? 'waiting_bootstrap'
                  : 'ready';
  const diagVisibleEarly = isDiagnosticsEnabled(currentUser);

  // Codex084 — one-line render-stage log on every render so we can compare
  // host vs Player 2 in runtime logs. Tagged so it's grep-able.
  if (isOnline) {
    debugLog('[Game.bootstrap]', {
      renderStage,
      lobbyId: routeLobbyId || resolvedLobbyId || null,
      lobbyCode: routeLobbyCode || null,
      userEmail: currentUser?.email || null,
      hasLobbyData: !!lobbyData,
      lobbyStatus: lobbyData?.status || null,
      stateRevision: lobbyData?.state_revision ?? null,
      playersCount: lobbyData?.players?.length || 0,
      currentQuestionId: lobbyData?.current_question_id || null,
      currentQuestionLoaded: !!currentQuestion,
      onlineDeckCount: onlineQuestionDeck.length,
      onlineDeckSource: lobbyData?.online_deck_meta?.source || null,
      isLoading,
      isError,
      questionLoadErrorKind,
      isGameReady: isGameReadyEarly,
    });
  }

  // Codex085 — App-level diag: surface every render-stage transition to the
  // overlay one level above. This must be inside the function body (not an
  // effect) because we need it captured on EVERY render path, including the
  // very first render where an early-return guard might otherwise hide it.
  // pushAppDiag is a pure module-level emitter — safe during render.
  if (isOnline) {
    pushAppDiag({
      gameRenderStage: renderStage,
      gameLobbyId: lobbyId || null,
      gameLobbyStatus: lobbyData?.status || null,
      gameLobbyRevision: lobbyData?.state_revision ?? null,
      gamePlayersCount: lobbyData?.players?.length ?? 0,
      gameCurrentQId: lobbyData?.current_question_id || null,
    });
  }

  const diagnosticsOverlay = (
    <GameBootstrapDiagnostics
      visible={diagVisibleEarly}
      currentUser={currentUser}
      routeLobbyId={routeLobbyId}
      routeLobbyCode={routeLobbyCode}
      routeStateLobbyId={routeState?.lobbyId || null}
      routeStateStatus={routeState?.status || null}
      routeStateRevision={routeState?.state_revision ?? null}
      resolvedLobbyId={resolvedLobbyId}
      lobbyData={lobbyData}
      players={players}
      currentPlayerIndex={currentPlayerIndex}
      currentQuestion={currentQuestion}
      isOnline={isOnline}
      isLoading={isLoading}
      isError={isError}
      lastError={boundaryError?.message || error || questionLoadErrorKind || null}
      isGameReady={isGameReadyEarly}
      renderStage={renderStage}
    />
  );

  const questionLoadErrorCopy = (() => {
    if (questionLoadErrorKind === QUESTION_LOAD_ERROR_KIND.OFFLINE_NO_CACHE) {
      return {
        icon: 'offline',
        title: 'İnternet bağlantısı yok',
        body: 'Sorular yüklenemedi ve önbellek bulunamadı.',
      };
    }
    if (questionLoadErrorKind === QUESTION_LOAD_ERROR_KIND.NO_ACTIVE_QUESTIONS) {
      return {
        icon: 'data',
        title: 'Şu anda aktif soru bulunamadı.',
        body: 'Soru havuzu hazır olduğunda oyun başlayacak.',
      };
    }
    return {
      icon: 'data',
      title: 'Sorular yüklenemedi.',
      body: 'Sorular hazırlanamadı. Lütfen tekrar dene.',
    };
  })();

  const soloQuestionDebugPayload = useMemo(() => {
    if (!soloQuestionDebugEnabled || !soloQuestionDebugRuntimeState) return null;
    return buildSoloQuestionRuntimeDebugPayload({
      currentUserEmail: currentUser?.email || authUser?.email,
      isDebugAllowed: soloQuestionDebugEnabled,
      questionLoadDebugSnapshot,
      soloStartInput: soloQuestionDebugRuntimeState.soloStartInput,
      soloCategoryPreferenceState: soloRuntimeCategoryPreferenceState,
      activeCategoryIds,
      allQuestions,
      candidatePool: soloQuestionDebugRuntimeState.candidatePool,
      engineResult: soloQuestionDebugRuntimeState.engineResult,
      deck: soloQuestionDebugRuntimeState.deck,
      isFromCache,
    });
  }, [
    soloQuestionDebugEnabled,
    soloQuestionDebugRuntimeState,
    currentUser?.email,
    guestDailyQuestPayload,
    authUser?.email,
    questionLoadDebugSnapshot,
    soloRuntimeCategoryPreferenceState,
    activeCategoryIds,
    allQuestions,
    isFromCache,
  ]);

  const soloCurrentQuestionDeckIndex = useMemo(() => {
    if (!isSoloLevelMode || !Array.isArray(soloAttemptDeck) || !currentQuestion?.id) return -1;
    return soloAttemptDeck.findIndex((question) => String(question?.id) === String(currentQuestion.id));
  }, [currentQuestion?.id, isSoloLevelMode, soloAttemptDeck]);

  useEffect(() => {
    if (!isSoloLevelMode) return;
    const soloAttemptSnapshot = {
      soloAttemptId: soloAttemptId || null,
      soloLevelNumber: soloLevel?.levelNumber ?? null,
      soloGamePhase: soloLevelResult
        ? 'result'
        : winner
          ? 'finished'
          : currentQuestion
            ? 'active'
            : isLoading
              ? 'question_loading'
              : isError
                ? 'question_error'
                : 'bootstrap_wait',
      soloRoutePath: location.pathname,
      soloDeckLength: Array.isArray(soloAttemptDeck) ? soloAttemptDeck.length : 0,
      soloCurrentQuestionId: currentQuestion?.id ? String(currentQuestion.id) : null,
      soloCurrentQuestionIndex: soloCurrentQuestionDeckIndex >= 0 ? soloCurrentQuestionDeckIndex + 1 : null,
      soloCurrentLobbyQuestionId: lobbyData?.current_question_id ? String(lobbyData.current_question_id) : null,
      soloQuestionsLoading: Boolean(isLoading),
      soloQuestionsError: Boolean(isError),
      soloQuestionLoadErrorKind: questionLoadErrorKind || null,
      soloAuthUserPresent: Boolean(currentUser?.email || authUser?.email),
      soloCurrentUserLoaded: Boolean(currentUserLoaded),
      soloLoadingDuringActiveAttempt: Boolean(isLoading && currentQuestion && soloAttemptDeck?.length),
      soloJokerPendingType: jokerSpendPendingType || null,
      soloDiagAt: new Date().toISOString(),
    };
    pushAppDiag(soloAttemptSnapshot);
    debugLog('[Game.soloAttempt]', soloAttemptSnapshot);
  }, [
    currentQuestion,
    authUser?.email,
    currentUser?.email,
    currentUserLoaded,
    isError,
    isLoading,
    isSoloLevelMode,
    jokerSpendPendingType,
    lobbyData?.current_question_id,
    location.pathname,
    questionLoadErrorKind,
    soloAttemptId,
    soloCurrentQuestionDeckIndex,
    soloLevel?.levelNumber,
    soloLevelResult,
    soloAttemptDeck,
    winner,
  ]);

  useEffect(() => {
    if (!isSoloLevelMode) return;
    const publishBrowserState = (eventType) => {
      pushAppDiag({
        soloBrowserEvent: eventType,
        soloBrowserEventAt: new Date().toISOString(),
        soloVisibilityState: typeof document !== 'undefined' ? document.visibilityState : null,
        soloNavigatorOnline: typeof navigator !== 'undefined' ? navigator.onLine : null,
        soloAttemptId: soloAttemptId || null,
        soloDeckLength: Array.isArray(soloAttemptDeck) ? soloAttemptDeck.length : 0,
        soloHasCurrentQuestion: Boolean(currentQuestion),
      });
    };
    const onVisibilityChange = () => publishBrowserState('visibilitychange');
    const onOnline = () => publishBrowserState('online');
    const onOffline = () => publishBrowserState('offline');
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [currentQuestion, isSoloLevelMode, soloAttemptDeck, soloAttemptId]);

  // ─── Render guards ───────────────────────────────────────────────
  // For online games, playerNames may be empty array (non-host joined with just lobbyId)
  if (!playerNames && !isOnline) return (
    <>{diagnosticsOverlay}
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="text-center space-y-4">
        <p className="font-inter text-foreground font-semibold">Oyun bilgisi eksik.</p>
        <p className="font-inter text-sm text-muted-foreground">Oyuna başlamak için Ana Sayfa’dan Solo’ya giriş yap.</p>
        <Button onClick={() => navigate('/')} variant="outline">Ana Sayfa’ya Dön</Button>
      </div>
    </div></>
  );

  // Codex106 — In Solo Level mode, ALWAYS show SoloLevelResult instead of
  // the generic GameOver. We render it as soon as `soloLevelResult` exists
  // (pass OR fail), regardless of whether `winner` was set internally.
  if (isSoloLevelMode && soloLevelResult) {
    // Codex106-23 — Compute next-level availability for the popup.
    //   - hasNextLevel: passed AND next level number is within the catalog.
    //   - isNextLevelComingSoon: passed AND already on the final level
    //     (catalog ends — "Yakında" state).
    // We don't show a next-level CTA on failed attempts at all.
    const nextLevelNumber = soloLevel.levelNumber + 1;
    const hasNextLevel = !isGuidedSoloTutorial && soloLevelResult.passed && nextLevelNumber <= getSoloLevelCount();
    const isNextLevelComingSoon = soloLevelResult.passed && nextLevelNumber > getSoloLevelCount();
    return (
      <>
        {diagnosticsOverlay}
        <SoloLevelResult
          levelNumber={soloLevel.levelNumber}
          passed={soloLevelResult.passed}
          stars={soloLevelResult.stars}
          mistakes={soloLevelResult.mistakes}
          usedMoves={soloLevelResult.usedMoves}
          remainingMoves={soloLevelResult.remainingMoves}
          maxMoves={soloLevelResult.maxMoves}
          timeSeconds={soloLevelResult.timeSeconds}
          baseScore={soloLevelResult.baseScore}
          timeBonus={soloLevelResult.timeBonus}
          levelScore={soloLevelResult.levelScore}
          scoreDelta={soloLevelResult.scoreDelta}
          didImproveScore={soloLevelResult.didImproveScore}
          cardsCompleted={soloLevelResult.cardsCompleted}
          cardTarget={soloLevelResult.cardTarget}
          failReason={soloLevelResult.failReason}
          nextLevelNumber={nextLevelNumber}
          hasNextLevel={hasNextLevel}
          isNextLevelComingSoon={isNextLevelComingSoon}
          onRetry={handleSoloRetry}
          onNextLevel={handleSoloNextLevel}
          onBackToPath={handleSoloBackToPath}
          successPrimaryActionLabel={isGuidedSoloTutorial ? 'PROFİLİNİ TAMAMLA' : undefined}
          successBackToPathLabel={isGuidedSoloTutorial ? 'EĞİTİME DÖN' : undefined}
          successPrimaryActionEnabled={isGuidedSoloTutorial ? soloLevelResult.passed : undefined}
          guestRecordPayload={guestRecordPayload}
        />
        <SoloQuestionDebugPanel payload={soloQuestionDebugPayload} />
      </>
    );
  }

  // In solo level mode, suppress generic GameOver — SoloLevelResult will
  // mount within the same frame once the result effect runs.
  if (winner && !isSoloLevelMode) return (<>{diagnosticsOverlay}{gameOverView}</>);

  if (error) return (
    <>{diagnosticsOverlay}
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="text-center space-y-4">
        <p className="font-inter text-destructive">Hata: {error}</p>
        <Button onClick={() => navigate('/')} variant="outline">Geri Dön</Button>
      </div>
    </div>
    <SoloQuestionDebugPanel payload={soloQuestionDebugPayload} />
    </>
  );

  if (!isOnline) {
    if (isLoading && !isGameReadyEarly) return (
      <>{diagnosticsOverlay}
      <QuestionPreparationLoading />
      </>
    );

    if (isError && !isGameReadyEarly) return (
      <>{diagnosticsOverlay}
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="text-center space-y-4">
          {questionLoadErrorCopy.icon === 'offline'
            ? <WifiOff className="w-10 h-10 text-muted-foreground mx-auto" />
            : <Loader2 className="w-10 h-10 text-muted-foreground mx-auto" />}
          <p className="font-inter text-foreground font-semibold">{questionLoadErrorCopy.title}</p>
          <p className="font-inter text-sm text-muted-foreground">{questionLoadErrorCopy.body}</p>
          <Button onClick={handleQuestionBootstrapRetry} className="w-full">Tekrar Dene</Button>
          <Button onClick={() => navigate('/')} variant="outline" className="w-full">Geri Dön</Button>
        </div>
      </div></>
    );
  }

  if (!isOnline && allQuestions.length > 0 && availableQuestionsCount < 10) return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="text-center space-y-4">
        <p className="font-inter text-foreground">
          Oyun için en az 10 soru gerekli. Seçilen aralıkta <span className="text-primary font-bold">{availableQuestionsCount}</span> soru var.
        </p>
        <Button onClick={() => navigate('/')} variant="outline">Geri Dön</Button>
      </div>
    </div>
  );

  if (missingOnlineQuestionEarly) return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="text-center space-y-4">
        <p className="font-inter text-foreground font-semibold">Oyun sorusu yüklenemedi.</p>
        <p className="font-inter text-sm text-muted-foreground">Lobi durumu geldi ama aktif soru bulunamadı. Tekrar dene.</p>
        <Button onClick={handleQuestionBootstrapRetry} className="w-full">Soruları Yenile</Button>
        <Button onClick={() => navigate('/lobby')} variant="outline" className="w-full">Lobiye Dön</Button>
      </div>
    </div>
  );

  if (!isGameReadyEarly) return (
    <>
      {diagnosticsOverlay}
      <OnlineGameBootstrapFallback
      isOnline={isOnline}
      hasLobbyData={!!lobbyData}
      hasQuestions={bootstrapQuestionsReady}
      lobbyId={lobbyId}
      lobbyCode={routeLobbyCode}
      onRefetchLobby={async () => {
        if (!lobbyId && !routeLobbyCode) return;
        try {
          const fresh = lobbyId
            ? await base44.entities.Lobby.get(lobbyId)
            : (await base44.entities.Lobby.filter({ code: routeLobbyCode }, '-created_date', 1))?.[0];
          if (fresh) setLobbyData(fresh);
        } catch (e) {
          debugLog('[Game] manual refetch failed:', e.message);
        }
      }}
      onRetryQuestions={isOnline ? null : handleQuestionBootstrapRetry}
      retryQuestionsWhenNotReady={isSoloLevelMode}
      onBackHome={() => navigate('/')}
      />
    </>
  );

  // ─── Render ───────────────────────────────────────────────────────
  const guidedTutorialJokerBalances = isGuidedSoloTutorial
    ? buildGuidedTutorialJokerBalances(guidedTutorialExpectedJokerType, guidedTutorialCurrentJokerUsed || !guidedTutorialJokerStepActive)
    : null;
  const guidedJokerDemoHintActive = Boolean(
    guidedTutorialJokerDemoWaiting &&
    isGuidedJokerTapHintActive &&
    isMyTurn &&
    !isDragging &&
    !jokerSpendPendingType &&
    !guidedTutorialPopup &&
    !hintPopupOpen
  );
  const guidedTutorialJokerInstruction = guidedTutorialJokerStepActive
    ? getGuidedTutorialJokerCopy(guidedTutorialExpectedJokerType).instruction
    : '';
  const soloJokers = isSoloLevelMode ? {
    enabled: true,
    usedJokerType,
    balances: isGuidedSoloTutorial ? guidedTutorialJokerBalances : jokerBalances,
    loading: isGuidedSoloTutorial ? false : jokerInventoryLoading,
    pendingType: jokerSpendPendingType,
    mistakeShieldActive,
    timerFrozen: isSoloTimerFrozen,
    message: jokerMessage,
    error: jokerError,
    disabled: Boolean(
      soloLevelResult ||
      winner ||
      jokerInventoryLoading ||
      jokerSpendPendingType ||
      guidedTutorialPopup ||
      hintPopupOpen ||
      isDragging ||
      soloJokerDragLocked ||
      (isGuidedSoloTutorial && !guidedTutorialJokerStepActive)
    ),
    dragLocked: Boolean(isDragging || soloJokerDragLocked),
    tutorialDemoType: isGuidedSoloTutorial ? guidedTutorialExpectedJokerType : null,
    tutorialDemoHintActive: guidedJokerDemoHintActive,
    tutorialFocusActive: guidedJokerDemoHintActive,
    onUseJoker: handleUseSoloJoker,
  } : null;
  const soloHint = isSoloLevelMode ? {
    enabled: !isGuidedSoloTutorial,
    balance: hintBalance,
    loading: hintInventoryLoading,
    pending: hintConsumePending,
    revealStage: currentSoloHintRevealStage,
    error: hintError,
    disabled: Boolean(
      soloLevelResult ||
      winner ||
      feedback ||
      hintInventoryLoading ||
      hintConsumePending ||
      guidedTutorialPopup ||
      isDragging ||
      soloJokerDragLocked
    ),
    onOpen: handleOpenSoloHint,
  } : null;
  const guidedDragHintActive = Boolean(
    isGuidedSoloTutorial &&
    guidedTutorialStepMode !== 'timeline-scroll' &&
    guidedTutorialCorrectTargetZone !== null &&
    !guidedTutorialPopup &&
    !guidedTutorialJokerRequiresTapBeforePlacement &&
    selectedZone === null &&
    !feedback &&
    !winner &&
    currentQuestion
  );
  const guidedTimelineScrollHintActive = Boolean(
    isGuidedSoloTutorial &&
    guidedTutorialStepMode === 'timeline-scroll' &&
    isTimelineSwipeHintActive &&
    !guidedTutorialPopup &&
    !guidedTutorialJokerRequiresTapBeforePlacement &&
    selectedZone === null &&
    !feedback &&
    !winner &&
    currentQuestion
  );

  return (
    <GameRenderErrorBoundary
      onError={(err) => {
        setBoundaryError(err);
        // Codex085 — surface render crashes to App-level diag too
        pushAppDiag({
          lastError: err?.message || String(err),
          lastErrorWhere: 'game_render',
        });
      }}
      onReset={() => {
        setBoundaryError(null);
        pushAppDiag({ lastError: null, lastErrorWhere: null });
      }}
      onBackHome={() => navigate('/')}
    >
      {diagnosticsOverlay}
      <GameDebugLog />
      <GameOverTimer active={gameStarted && !winner} onTick={(s) => setOverallSeconds(s)} />
      {isGuidedSoloTutorial && (
        <GuidedSoloTutorialOverlay
          cardsCompleted={cardsCompletedSolo}
          cardTarget={winCardCount}
          remainingMoves={remainingMoveCount}
          jokerInstruction={guidedTutorialJokerInstruction} /* renders tutorial-only data-kronox-guided-joker-single-copy demo; no real UserJokerInventory spend */
        />
      )}
      {isGuidedSoloTutorial && (
        <GuidedTutorialPopup
          popup={guidedTutorialPopup}
          onContinue={closeGuidedTutorialPopup}
        />
      )}
      <SoloHintRevealPopup
        open={Boolean(hintPopupOpen && currentQuestion)}
        year={currentQuestion?.year}
        stage={currentSoloHintRevealStage}
        remaining={hintBalance}
        pending={hintConsumePending}
        error={hintError}
        onUseHint={handleUseSoloHint}
        onClose={closeSoloHintPopup}
      />

      <AnimatePresence>
        {feedback && (
          <FeedbackOverlay result={feedback.result} year={feedback.year} onDone={handleFeedbackDone} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      </AnimatePresence>

      {/* Offline cache banner */}
      {isFromCache && (
        <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 py-1 text-xs font-inter"
          style={{ background: 'rgba(245,158,11,0.15)', borderBottom: '1px solid rgba(245,158,11,0.3)', paddingTop: 'calc(0.25rem + env(safe-area-inset-top))' }}>
          <WifiOff className="w-3 h-3 text-yellow-400" />
          <span className="text-yellow-300">Önbellekten oynuyor</span>
        </div>
      )}

      <GameLayout
        players={players}
        currentPlayerIndex={currentPlayerIndex}
        currentPlayer={currentPlayer}
        currentQuestion={currentQuestion}
        winCardCount={winCardCount}
        selectedZone={selectedZone}
        isDragging={isDragging}
        touchDragPos={touchDragPos}
        touchDragEnd={touchDragEnd}
        isMyTurn={isMyTurn}
        isOnline={isOnline}
        myEmail={localPlayerEmail}
        feedback={feedback}
        winner={winner}
        turnDuration={turnDuration}
        timerKey={timerKey}
        onSelectZone={setSelectedZone}
        onDropOnZone={handleDropOnZone}
        onConfirmPlacement={handleConfirmPlacement}
        onImageError={handleImageError}
        onAudioError={handleAudioError}
        onDragStart={handleGameplayCardDragStart}
        onDragEnd={handleGameplayCardDragEnd}
        onTouchDragMove={handleGameplayCardTouchMove}
        onTouchDragEnd={handleGameplayCardTouchEnd}
        onTouchDragCancel={handleGameplayCardTouchCancel}
        onTimeUp={handleTimeUp}
        isTimeUp={isTimeUp}
        progressCardCount={isSoloLevelMode ? cardsCompletedSolo : undefined}
        progressCardTarget={isSoloLevelMode ? winCardCount : undefined}
        remainingMoves={isSoloLevelMode ? remainingMoveCount : undefined}
        maxMoves={isSoloLevelMode ? soloMaxMoves : undefined}
        soloLevelTotalSeconds={isSoloLevelMode ? (soloLevel?.totalTimeSeconds ?? SOLO_LEVEL_TIME_SECONDS) : undefined}
        soloLevelElapsedSeconds={isSoloLevelMode ? soloEffectiveElapsedSeconds : undefined}
        soloLevelTimerFrozen={isSoloLevelMode ? (isSoloTimerFrozen || hintPopupOpen) : false}
        soloJokers={isSoloLevelMode ? soloJokers : null}
        soloHint={isSoloLevelMode ? soloHint : null}
        onSoloBack={isSoloLevelMode ? handleSoloGameplayBack : undefined}
        balances={soloJokers?.balances || null}
        beginnerPlacementHintZone={beginnerPlacementHintZone}
        guidedDragHintActive={guidedDragHintActive}
        guidedDragTargetZone={guidedTutorialCorrectTargetZone}
        guidedTimelineScrollHintActive={guidedTimelineScrollHintActive}
        guidedTimelineSwipeHintMinimumElapsed={hasTimelineSwipeHintMinimumElapsed}
        onTimelineSwipeHintInteraction={handleTimelineSwipeHintInteraction}
        interactionPaused={Boolean(guidedTutorialPopup || hintPopupOpen)}
        correctStreak={isSoloLevelMode ? soloCorrectStreak : 0}
      />
      <SoloQuestionDebugPanel payload={soloQuestionDebugPayload} />
    </GameRenderErrorBoundary>
  );
}
