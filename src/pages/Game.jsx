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
import { Clock3, Hand, Loader2, MoveHorizontal, Shield, Sparkles, WifiOff } from 'lucide-react';
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
import SoloQuestionDebugPanel from '@/components/game/SoloQuestionDebugPanel';
import OnlineGameBootstrapFallback from '@/components/game/OnlineGameBootstrapFallback';
import GameBootstrapDiagnostics, { isDiagnosticsEnabled } from '@/components/game/GameBootstrapDiagnostics';
import GameRenderErrorBoundary from '@/components/game/GameRenderErrorBoundary';
import { useAuth } from '@/lib/AuthContext';
import {
  applyLevelAttempt,
  getSoloCardsRequiredForLevel,
  getSoloAttemptDeckSizeForLevel,
  getSoloTimelineWinCardCountForLevel,
  getSoloLevelCount,
  isSoloSpecialLevel,
  SOLO_LEVEL_TIME_SECONDS,
  SOLO_MAX_MISTAKES,
  readSoloProgress,
  writeSoloProgress,
} from '@/lib/soloLevels';
import { calculateSoloAttemptResult, getBestSoloLevelResult, SOLO_RULES_VERSION } from '@/lib/soloProgressHelpers';
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
  getOrderedSoloDeckQuestion,
  getSoloSeedQuestions,
} from '@/lib/soloDeckRuntime';
import {
  buildQuestionAttemptEventId,
  getQuestionAnalyticsMetadata,
  recordSoloQuestionAnalyticsEvent as writeSoloQuestionAnalyticsEvent,
} from '@/lib/dbGateway/analyticsGateway';
import { recordDailyQuestProgress } from '@/lib/dbGateway/dailyQuestGateway';
import {
  QUESTION_ANALYTICS_EVENT_TYPES,
  QUESTION_ANALYTICS_SOURCES,
} from '@/lib/questionAnalyticsContracts';
// Codex128 — Online score/checkpoint system. Online winner kararlaştığında
// her client kendi kullanıcısının puanını günceller (idempotent).
import { applyOnlineMatchToCurrentUser } from '@/lib/applyOnlineResult';
// Codex146 — Player-own elapsed seconds canonical source for Online score
// time bonus AND result popup time display. Same source = no inconsistency.
import { getOnlinePlayerElapsedSeconds } from '@/lib/onlinePlayerElapsed';

const GAMEPLAY_DRAG_LOCK_CLASS = 'kronox-game-drag-lock';

const GUIDED_TUTORIAL_MESSAGES = [
  {
    icon: Hand,
    title: 'Kartı Tut ve Sürükle',
    body: 'Kartı parmağınla tutup zaman çizgisindeki uygun boşluğa bırak.',
  },
  {
    icon: MoveHorizontal,
    title: 'Önce mi Sonra mı?',
    body: 'Daha eski olayları sola, daha yeni olayları sağa yerleştir.',
  },
  {
    icon: Sparkles,
    title: 'Araya Yerleştir',
    body: 'İki olayın arasındaki boşluk da geçerli bir hamledir.',
  },
  {
    icon: Clock3,
    title: 'Zaman ve Hamle',
    body: 'Amaç olayları yıllarına göre sıralamak. Bu eğitimde süre ve hata baskısı yok.',
  },
  {
    icon: Shield,
    title: 'Jokerleri Tanı',
    body: 'Jokerler normal Solo’da çantandan harcanır; bu eğitimde yalnızca tanıtılır.',
  },
];

function GuidedSoloTutorialOverlay({ cardsCompleted = 0, cardTarget = 7, mistakes = 0 }) {
  const activeIndex = Math.min(
    GUIDED_TUTORIAL_MESSAGES.length - 1,
    Math.max(0, Math.floor(Math.max(0, Number(cardsCompleted) - 2))),
  );
  const item = GUIDED_TUTORIAL_MESSAGES[activeIndex] || GUIDED_TUTORIAL_MESSAGES[0];
  const Icon = item.icon;
  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-[42] px-4"
      style={{ top: 'calc(6.5rem + env(safe-area-inset-top))' }}
      data-kronox-guided-first-solo-level="true"
    >
      <div className="mx-auto max-w-[340px] rounded-2xl border border-yellow-300/35 bg-slate-950/78 px-3 py-2.5 shadow-2xl backdrop-blur-md">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 grid h-8 w-8 flex-shrink-0 place-items-center rounded-xl border border-yellow-300/35 bg-yellow-300/12 text-yellow-200">
            <Icon className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-inter text-xs font-black text-yellow-100">{item.title}</span>
            <span className="mt-0.5 block font-inter text-[11px] font-semibold leading-snug text-blue-100/82">{item.body}</span>
            <span className="mt-1.5 flex flex-wrap gap-1.5 font-inter text-[10px] font-bold text-blue-100/62">
              <span>{Math.max(0, Number(cardsCompleted) || 0)}/{Math.max(1, Number(cardTarget) || 7)} kart</span>
              <span>Hamle hatası: {Math.max(0, Number(mistakes) || 0)}</span>
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

const normalizeOnlineEmail = (value) => String(value || '').trim().toLowerCase();

const getOpponentEmailForOnlineResult = (players = [], localEmail = null) => {
  const normalizedLocal = normalizeOnlineEmail(localEmail);
  return players.find((player) => {
    const email = normalizeOnlineEmail(player?.email);
    return email && email !== normalizedLocal;
  })?.email || '';
};

// Codex146 — Popup state must always carry the SAME elapsedSeconds value
// that was used for scoring. We never recompute it on the popup side, so
// "Süren: X" and "Hız Bonusu: +Y" can never drift apart.
const buildOnlineScorePopupState = ({ result, elapsedSeconds, response }) => {
  if (!response) return null;
  if (response.ok === false) {
    return {
      result,
      elapsedSeconds,
      pending: false,
      error: true,
      // Persistence failed — DO NOT show a successful +points message.
      message: 'Puan kaydedilemedi. Tekrar dene.',
    };
  }
  if (response.skipped && !response.applied) {
    return {
      result,
      elapsedSeconds,
      pending: false,
      skipped: true,
      noScoreDelta: true,
      message: 'Bu maçın puanı daha önce işlendi.',
    };
  }
  const applied = response.applied;
  if (!applied) return null;
  return {
    result: applied.result || result,
    // Prefer the elapsedSeconds reported back by the persistence layer
    // (idempotent replays read it from the audit row). Falls back to the
    // value we just passed in so first-apply still shows the local time.
    elapsedSeconds: Number.isFinite(Number(applied.elapsedSeconds))
      ? Number(applied.elapsedSeconds)
      : (Number.isFinite(Number(elapsedSeconds)) ? Number(elapsedSeconds) : null),
    pending: false,
    skipped: Boolean(response.skipped),
    delta: Number(applied.delta) || 0,
    effectiveDelta: Number(applied.effectiveDelta) || 0,
    baseDelta: Number(applied.base) || 0,
    timeBonus: Number(applied.timeBonus) || 0,
    scoreBefore: Number(applied.previousScore) || 0,
    scoreAfter: Number(applied.nextScore) || 0,
    checkpointApplied: Boolean(applied.clampedByCheckpoint),
    protectedFloor: Number(applied.floorCheckpoint) || 0,
    reconciled: Boolean(response.reconciled),
    saved: true,
  };
};

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
  const { user: authUser, adminStatus } = useAuth();
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
    debugLog('[Game] mount:', {
      routeState,
      lobbyId,
      onlineMode: isOnlineFromState,
    });
    // Codex085 — App-level diag: confirm Game actually mounted on this client.
    pushAppDiag({
      gameMounted: true,
      gameUnmounted: false,
      gameLobbyId: lobbyId || null,
    });
    return () => {
      pushAppDiag({ gameMounted: false, gameUnmounted: true });
    };
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
  //   mistakeCount        — incremented every time `feedback.result === 'wrong'`
  //                         is observed. We use a ref to dedupe within one
  //                         feedback object (effect runs twice in dev StrictMode).
  //   soloLevelResult     — { passed, stars, mistakes, timeSeconds,
  //                           cardsCompleted, failReason } when the attempt
  //                         ends. Triggers the SoloLevelResult overlay.
  //   soloResultPersistedRef — guard so we only call writeSoloProgress once
  //                         per attempt even if effects re-run.
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
  const [jokerBalances, setJokerBalances] = useState(() => emptyJokerBalances());
  const [jokerInventoryLoading, setJokerInventoryLoading] = useState(false);
  const [jokerSpendPendingType, setJokerSpendPendingType] = useState(null);
  const [mistakeShieldActive, setMistakeShieldActive] = useState(false);
  const [jokerMessage, setJokerMessage] = useState('');
  const [jokerError, setJokerError] = useState('');
  const [timerFreezeUntil, setTimerFreezeUntil] = useState(0);
  const [timerFreezeTick, setTimerFreezeTick] = useState(0);
  const [frozenElapsedOffset, setFrozenElapsedOffset] = useState(0);
  const timerFreezeStartRef = useRef(null);
  const timerFreezeElapsedAtStartRef = useRef(null);
  const timerFreezeTimeoutRef = useRef(null);
  const timerFreezeIntervalRef = useRef(null);
  const jokerUsedRef = useRef(false);
  const jokerSpendPendingRef = useRef(false);
  const soloJokerDecisionKeyByQuestionIdRef = useRef(new Map());
  const soloJokerUsedByDecisionKeyRef = useRef(new Map());
  const soloSkippedQuestionIdsRef = useRef(new Set());
  const soloAnalyticsEventIdsRef = useRef(new Set());
  const soloQuestionShownAtRef = useRef(new Map());
  const soloReplacementQuestionIdsRef = useRef(new Set());
  const soloDailyQuestAttemptRecordedRef = useRef(null);
  const soloDailyQuestCompletionRecordedRef = useRef(null);
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

  useEffect(() => {
    let active = true;
    base44.auth.me()
      .then(u => { if (active) setCurrentUser(u || null); })
      .catch(() => { if (active) setCurrentUser(null); })
      .finally(() => { if (active) setCurrentUserLoaded(true); });
    return () => { active = false; };
  }, []);

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

  const soloCategoryPreferenceReady = !isSoloLevelMode
    || soloCategoryPreferenceState.status === 'ready'
    || soloCategoryPreferenceState.status === 'unavailable';
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
  const timerFreezeNow = timerFreezeTick || Date.now();
  const isSoloTimerFrozen = Boolean(isSoloLevelMode && timerFreezeUntil > timerFreezeNow && timerFreezeStartRef.current);
  const activeFreezeOffset = isSoloTimerFrozen
    ? Math.min(10, Math.max(0, Math.floor((timerFreezeNow - timerFreezeStartRef.current) / 1000)))
    : 0;
  const soloEffectiveElapsedSeconds = isSoloLevelMode
    ? Math.max(0, isSoloTimerFrozen
      ? (timerFreezeElapsedAtStartRef.current ?? overallSeconds)
      : overallSeconds - frozenElapsedOffset - activeFreezeOffset)
    : overallSeconds;
  const soloEffectiveElapsedSecondsRef = useRef(0);

  useEffect(() => {
    soloEffectiveElapsedSecondsRef.current = soloEffectiveElapsedSeconds;
  }, [soloEffectiveElapsedSeconds]);

  useEffect(() => {
    jokerUsedRef.current = Boolean(usedJokerType);
  }, [usedJokerType]);

  const clearSoloTimerFreeze = useCallback((applyElapsed = false, updateState = true) => {
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
      const rawElapsed = Number(overallSecondsRef.current ?? 0);
      if (Number.isFinite(startEffectiveElapsed) && Number.isFinite(rawElapsed)) {
        const nextOffset = Math.max(0, rawElapsed - startEffectiveElapsed);
        setFrozenElapsedOffset((prev) => Math.max(prev, nextOffset));
      }
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

    return Math.max(0, Math.floor(rawElapsed - freezeOffset));
  }, [frozenElapsedOffset, isSoloTimerFrozen, overallSecondsRef]);

  const resetSoloJokers = useCallback(() => {
    clearSoloTimerFreeze(false);
    jokerUsedRef.current = false;
    jokerSpendPendingRef.current = false;
    soloJokerDecisionKeyByQuestionIdRef.current = new Map();
    soloJokerUsedByDecisionKeyRef.current = new Map();
    soloSkippedQuestionIdsRef.current = new Set();
    soloAnalyticsEventIdsRef.current = new Set();
    soloQuestionShownAtRef.current = new Map();
    soloReplacementQuestionIdsRef.current = new Set();
    soloDailyQuestAttemptRecordedRef.current = null;
    soloDailyQuestCompletionRecordedRef.current = null;
    setUsedJokerType(null);
    setJokerSpendPendingType(null);
    setMistakeShieldActive(false);
    setJokerMessage('');
    setJokerError('');
    setFrozenElapsedOffset(0);
  }, [clearSoloTimerFreeze]);

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

  const currentPlayer = players.length > 0 ? players[currentPlayerIndex] : null;
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
    if (!isSoloLevelMode || !question || !soloAttemptId || !currentUser?.email) return;
    const placementIndex = extra.placement_index ?? getSoloQuestionAnalyticsPlacementIndex(question);
    const eventId = extra.event_id || getSoloQuestionAnalyticsEventId(question, eventType, placementIndex);
    if (!eventId || soloAnalyticsEventIdsRef.current.has(eventId)) return;
    soloAnalyticsEventIdsRef.current.add(eventId);

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

    writeSoloQuestionAnalyticsEvent({
      ...getQuestionAnalyticsMetadata(question),
      ...extra,
      event_id: eventId,
      attempt_id: soloAttemptId,
      mode: 'solo',
      level: soloLevel?.levelNumber ?? null,
      is_special_level: isSoloSpecialLevel(soloLevel?.levelNumber),
      event_type: eventType,
      placement_index: placementIndex,
      source: extra.source || (soloReplacementQuestionIdsRef.current.has(String(question.id))
        ? QUESTION_ANALYTICS_SOURCES.REPLACEMENT
        : QUESTION_ANALYTICS_SOURCES.DECK),
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
    isSoloLevelMode,
    soloAttemptId,
    soloLevel?.levelNumber,
    usedJokerType,
  ]);

  const recordDailyQuestSoloEvent = useCallback((eventType, eventId, metadata = {}) => {
    if (!isSoloLevelMode || !currentUser?.email) return;
    recordDailyQuestProgress({
      eventType,
      mode: 'solo',
      amount: 1,
      eventId,
      metadata: {
        ...metadata,
        soloAttemptId,
        soloLevelNumber: soloLevel?.levelNumber,
        source: 'Game.jsx',
      },
    }).catch((error) => {
      debugLog('[Game] daily quest progress failed:', error?.message || error);
    });
  }, [currentUser?.email, isSoloLevelMode, soloAttemptId, soloLevel?.levelNumber]);

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
      recordDailyQuestSoloEvent('correct_cards', `${soloAttemptId || 'solo_attempt'}:correct:${event.question.id}:${event.zone}`, {
        questionId: event.question.id,
        zone: event.zone,
        questType: 'correct_cards',
      });
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

    debugLog('[Game] online turn derived state:', {
      lobbyId,
      lobbyDataPlayersLength: lobbyData?.players?.length || 0,
      renderedPlayersCount: players.length,
      computedCurrentPlayerIndex: currentPlayerIndex,
      computedCurrentPlayerName: currentPlayer?.name || null,
      computedCurrentPlayerEmail: currentPlayer?.email || null,
      computedIsMyTurn: Boolean(isMyTurn),
      myPlayerName,
      currentQuestionId: lobbyData?.current_question_id || null,
      playerSummary: players.map(p => ({
        name: p.name,
        email: p.email,
        cardCount: p.cards?.length || 0,
      })),
      renderedTurnMessageText,
    });
  }, [
    isOnline,
    lobbyId,
    currentPlayerIndex,
    currentPlayer?.name,
    currentPlayer?.email,
    isMyTurn,
    myPlayerName,
    lobbyData?.current_question_id,
    players,
    renderedTurnMessageText,
  ]);

  // Codex128 — Apply Online score/checkpoint result for the local user
  // exactly once per match. Runs on every client from its own perspective,
  // so each player updates only their own User.online_progress. Idempotent
  // via online_progress.lastMatchId == lobbyId guard inside the helper.
  //
  // Codex146 — `playerOwnElapsedRef` captures THIS client's own gameplay
  // timer the FIRST time we observe the match as finished. Subscription
  // events can later overwrite `winner` with a stripped-down
  // { name, email } object (no durationSeconds), but the ref is sticky
  // so the time used for scoring and the time shown in the popup are
  // always the same single snapshot.
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
    // timestamps for scoring time.
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
      const popupState = buildOnlineScorePopupState({ result, elapsedSeconds: durationSeconds, response: res });
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
      if (!currentUserLoaded || !preferenceReady) return;
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
      if (
        currentUser?.email &&
        engineResult.attemptId &&
        soloDailyQuestAttemptRecordedRef.current !== engineResult.attemptId
      ) {
        soloDailyQuestAttemptRecordedRef.current = engineResult.attemptId;
        recordDailyQuestProgress({
          eventType: 'start_solo_attempt',
          mode: 'solo',
          amount: 1,
          eventId: engineResult.attemptId,
          metadata: {
            soloAttemptId: engineResult.attemptId,
            soloLevelNumber: soloLevel?.levelNumber,
            questType: 'start_solo_attempt',
            source: 'Game.jsx',
          },
        }).catch((error) => {
          debugLog('[Game] daily quest start progress failed:', error?.message || error);
        });
      }
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
  }, [playerNames, questionPool, allQuestions, activeCategoryIds, yearStart, yearEnd, isLoading, isOnline, isSoloLevelMode, currentUserLoaded, currentUser?.email, soloCategoryPreferenceState.status, soloRuntimeCategoryPreferenceState, resetSoloJokers, setLobbyData, setError, soloLevel?.levelNumber, soloQuestionDebugEnabled, soloBootstrapRetryNonce]);

  // Overall timer başlatma
  useEffect(() => {
    if (players.length > 0 && currentQuestion != null && !gameStarted) {
      setGameStarted(true);
    }
  }, [players.length, currentQuestion, gameStarted, setGameStarted]);

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

  // ─── Handlers (UI event → action delegation) ─────────────────────
  const handleDropOnZone = useCallback((zoneIndex) => doPlacement(zoneIndex, { category, yearStart, yearEnd }), [doPlacement, category, yearStart, yearEnd]);
  const handleConfirmPlacement = useCallback(() => { if (selectedZone !== null) doPlacement(selectedZone, { category, yearStart, yearEnd }); }, [doPlacement, selectedZone, category, yearStart, yearEnd]);
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
    engageGameplayDragLock();
    setIsDragging(true);
  }, [engageGameplayDragLock, setIsDragging]);
  const handleGameplayCardDragEnd = useCallback(() => {
    releaseGameplayDragLock();
    setIsDragging(false);
    setTouchDragPos(null);
  }, [releaseGameplayDragLock, setIsDragging, setTouchDragPos]);
  const handleGameplayCardTouchMove = useCallback((x, y) => {
    engageGameplayDragLock();
    setIsDragging(true);
    setTouchDragPos({ x, y });
  }, [engageGameplayDragLock, setIsDragging, setTouchDragPos]);
  const handleGameplayCardTouchEnd = useCallback((x, y) => {
    releaseGameplayDragLock();
    setIsDragging(false);
    setTouchDragPos(null);
    setTouchDragEnd({ x, y });
    setTimeout(() => setTouchDragEnd(null), 100);
  }, [releaseGameplayDragLock, setIsDragging, setTouchDragEnd, setTouchDragPos]);
  const handleGameplayCardTouchCancel = useCallback(() => {
    releaseGameplayDragLock();
    setIsDragging(false);
    setTouchDragPos(null);
  }, [releaseGameplayDragLock, setIsDragging, setTouchDragPos]);

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
      setJokerMessage('Zaman Dondur tamamlandı.');
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
        setJokerBalances(normalizeJokerBalances(response?.balances));
        setJokerError(response?.error || 'Joker kullanılamadı.');
        return false;
      }
      setJokerBalances(normalizeJokerBalances(response?.balances));
      setJokerError('');
      recordDailyQuestSoloEvent('use_joker', idempotencyKey, {
        jokerType: inventoryType,
        uiJokerType: jokerType,
        relatedQuestionId,
        questType: 'use_joker',
      });
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
    recordDailyQuestSoloEvent,
  ]);

  const handleUseSoloJoker = useCallback(async (jokerType) => {
    if (!isSoloLevelMode || soloLevelResult || winner || feedback || !isMyTurn || jokerSpendPendingRef.current) return;
    if (!currentQuestion?.id) return;
    setJokerError('');

    const decisionKey = getCurrentSoloJokerDecisionKey(currentQuestion);
    if (!decisionKey) return;
    if (soloJokerUsedByDecisionKeyRef.current.has(decisionKey)) {
      setJokerError('Bu kartta zaten joker kullandın.');
      return;
    }

    if (jokerType === SOLO_UI_JOKER_TYPES.MISTAKE_SHIELD) {
      if (mistakeShieldActive) {
        setJokerError('Kronokalkan zaten aktif.');
        return;
      }
      const spent = await spendSoloJokerForCurrentCard(jokerType, decisionKey, currentQuestion.id);
      if (!spent) return;
      markSoloJokerUsedForDecision(decisionKey, jokerType);
      setMistakeShieldActive(true);
      setJokerMessage('Kronokalkan aktif: Bir sonraki hata sayılmayacak.');
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
      setJokerMessage('Zaman Dondur aktif: Süre 10 sn durduruldu.');
      startSoloTimerFreeze();
      return;
    }

    if (jokerType === SOLO_UI_JOKER_TYPES.CARD_SWAP) {
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
      setJokerMessage('Kart Değiştir aktif: Kart değiştirildi.');
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
    currentQuestion,
    getCurrentSoloJokerDecisionKey,
    soloLevelResult,
    winner,
    feedback,
    isMyTurn,
    mistakeShieldActive,
    isSoloTimerFrozen,
    spendSoloJokerForCurrentCard,
    markSoloJokerUsedForDecision,
    startSoloTimerFreeze,
    soloAttemptDeck,
    currentPlayer,
    usedQuestionIds,
    recordSoloQuestionAnalyticsEvent,
    setSelectedZone,
    setLobbyData,
  ]);
  const handleRestart = () => {
    setOnlineScoreResult(null);
    onlineResultAppliedRef.current = false;
    playerOwnElapsedRef.current = null;
    resetGame();
    navigate('/');
  };

  // Codex106 — count wrong placements as mistakes. We watch `feedback`
  // changes (which doPlacement already sets on every placement) instead of
  // patching useGameActions, so the placement flow itself stays untouched.
  useEffect(() => {
    if (!isSoloLevelMode) return;
    if (!feedback) { lastCountedFeedbackRef.current = null; return; }
    if (feedback === lastCountedFeedbackRef.current) return;
    lastCountedFeedbackRef.current = feedback;
    if (feedback.result === 'wrong') {
      setSoloCorrectStreak(0);
      if (mistakeShieldActive) {
        setMistakeShieldActive(false);
        setJokerMessage('Kronokalkan hatayı engelledi!');
        setJokerError('');
        return;
      }
      setMistakeCount((prev) => prev + 1);
      return;
    }
    if (feedback.result === 'correct') {
      setSoloCorrectStreak((prev) => prev + 1);
    }
  }, [feedback, isSoloLevelMode, mistakeShieldActive]);

  // Codex106 — finalize result when the attempt ends.
  //
  //   PASS  → winner set by doPlacement when the level-aware placed-card
  //           target is reached. Stars come from current mistakeCount.
  //   FAIL  → mistakeCount >= maxMistakes (10th mistake) OR overallSeconds >= 180
  //           before winner exists. We force-stop the timer by setting
  //           gameStarted=false and surface a fail overlay.
  //
  // Persistence happens once; SoloChallenge re-reads progress on its
  // location.state.soloResultApplied flag.
  const cardsCompletedSolo = useMemo(() => {
    if (!isSoloLevelMode || !players.length) return 0;
    const me = players[0];
    // Same source as hasPlayerWon(): the current timeline card count.
    // This prevents the header counter from subtracting seed cards while
    // completion uses the full authoritative card set.
    return getTimelineCardCount(me);
  }, [isSoloLevelMode, players]);

  useEffect(() => {
    if (!isSoloLevelMode || soloLevelResult) return;
    const maxMistakes = isGuidedSoloTutorial ? (soloLevel?.maxMistakes ?? SOLO_MAX_MISTAKES * 10) : (soloLevel?.maxMistakes ?? SOLO_MAX_MISTAKES);
    const totalTime = soloLevel?.totalTimeSeconds ?? SOLO_LEVEL_TIME_SECONDS;
    const cardTarget = winCardCount || soloCardsRequired || 7;

    // PASS path — winner was set by the win condition inside doPlacement.
    if (winner) {
      const elapsed = getSoloResultElapsedSeconds(winner.durationSeconds);
      const attempt = calculateSoloAttemptResult({
        mistakes: mistakeCount,
        completedCards: cardTarget,
        elapsedSeconds: elapsed,
        requiredCards: cardTarget,
      });
      // The win condition already enforces the card target via winCardCount.
      setSoloLevelResult({
        passed: attempt.passed,
        stars: attempt.stars,
        mistakes: attempt.mistakes,
        timeSeconds: elapsed,
        baseScore: attempt.baseScore,
        timeBonus: attempt.timeBonus,
        levelScore: attempt.levelScore,
        cardsCompleted: cardTarget,
        cardTarget,
        failReason: attempt.failReason,
        soloRulesVersion: SOLO_RULES_VERSION,
      });
      const completionEventId = `${soloAttemptId || 'solo_attempt'}:complete_solo_level:${soloLevel?.levelNumber || 1}`;
      if (soloDailyQuestCompletionRecordedRef.current !== completionEventId) {
        soloDailyQuestCompletionRecordedRef.current = completionEventId;
        recordDailyQuestSoloEvent('complete_solo_level', completionEventId, {
          questType: 'complete_solo_level',
          passed: true,
          cardsCompleted: cardTarget,
          elapsedSeconds: elapsed,
        });
      }
      return;
    }

    // FAIL — too many mistakes.
    if (mistakeCount >= maxMistakes) {
      const elapsed = getSoloResultElapsedSeconds(overallSecondsRef.current);
      const attempt = calculateSoloAttemptResult({
        mistakes: mistakeCount,
        completedCards: cardsCompletedSolo,
        elapsedSeconds: elapsed,
        requiredCards: cardTarget,
      });
      setGameStarted(false);
      setSoloLevelResult({
        passed: attempt.passed,
        stars: attempt.stars,
        mistakes: attempt.mistakes,
        timeSeconds: elapsed,
        baseScore: attempt.baseScore,
        timeBonus: attempt.timeBonus,
        levelScore: attempt.levelScore,
        cardsCompleted: cardsCompletedSolo,
        cardTarget,
        failReason: attempt.failReason || 'mistakes',
        soloRulesVersion: SOLO_RULES_VERSION,
      });
      return;
    }

    // FAIL — total timer expired without a winner.
    if (gameStarted && soloEffectiveElapsedSeconds >= totalTime) {
      const attempt = calculateSoloAttemptResult({
        mistakes: mistakeCount,
        completedCards: cardsCompletedSolo,
        elapsedSeconds: totalTime,
        requiredCards: cardTarget,
      });
      setGameStarted(false);
      setSoloLevelResult({
        passed: attempt.passed,
        stars: attempt.stars,
        mistakes: attempt.mistakes,
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
    isGuidedSoloTutorial,
    soloLevelResult,
    soloLevel,
    winner,
    mistakeCount,
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
          completedCards: soloLevelResult.cardsCompleted,
          elapsedSeconds: soloLevelResult.timeSeconds,
          requiredCards: soloLevelResult.cardTarget ?? soloCardsRequired ?? 7,
        });
        const bestPreview = getBestSoloLevelResult(previousEntry, {
          ...attempt,
          soloRulesVersion: soloLevelResult.soloRulesVersion || SOLO_RULES_VERSION,
          stars: soloLevelResult.stars,
          passed: soloLevelResult.passed,
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
          totalTimeSeconds: isGuidedSoloTutorial ? SOLO_LEVEL_TIME_SECONDS * 20 : SOLO_LEVEL_TIME_SECONDS,
          maxMistakes: isGuidedSoloTutorial ? SOLO_MAX_MISTAKES * 10 : SOLO_MAX_MISTAKES,
          soloRulesVersion: SOLO_RULES_VERSION,
        },
        onboardingTutorial: isGuidedSoloTutorial,
      },
    });
  }, [isGuidedSoloTutorial, soloLevel, resetGame, resetSoloJokers, navigate, routeYearStart, routeYearEnd]);

  // Codex106-23 — Jump straight into the next level after a passed attempt.
  // We rebuild the route state from the next level number, reusing the same
  // year window so Game.jsx renders identical question generation.
  const handleSoloNextLevel = useCallback(() => {
    if (!soloLevel) return;
    if (isGuidedSoloTutorial) {
      resetSoloJokers();
      resetGame();
      navigate('/onboarding', { replace: true, state: { guidedTutorialCompleted: true } });
      return;
    }
    const nextLevelNumber = soloLevel.levelNumber + 1;
    if (nextLevelNumber > getSoloLevelCount()) return;
    const nextCardCount = getSoloCardsRequiredForLevel(nextLevelNumber);
    setSoloLevelResult(null);
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
          maxMistakes: SOLO_MAX_MISTAKES,
          soloRulesVersion: SOLO_RULES_VERSION,
        },
      },
    });
  }, [isGuidedSoloTutorial, soloLevel, resetGame, resetSoloJokers, navigate, routeYearStart, routeYearEnd]);

  const handleSoloBackToPath = useCallback(() => {
    resetSoloJokers();
    resetGame();
    if (isGuidedSoloTutorial) {
      navigate('/onboarding', { state: soloLevelResult?.passed ? { guidedTutorialCompleted: true } : {} });
      return;
    }
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

  if (!isOnline && isLoading && !isGameReadyEarly) return (
    <>{diagnosticsOverlay}
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4 px-6">
        <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto" />
        <p className="font-inter text-sm text-muted-foreground">Sorular hazırlanıyor...</p>
        <p className="font-inter text-xs text-muted-foreground/60">İlk yüklemede biraz sürebilir...</p>
        <Button onClick={() => navigate('/')} variant="outline" size="sm">Geri Dön</Button>
      </div>
    </div></>
  );

  if (!isOnline && isError && !isGameReadyEarly) return (
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
  const soloJokers = isSoloLevelMode ? {
    enabled: true,
    usedJokerType,
    balances: isGuidedSoloTutorial ? emptyJokerBalances() : jokerBalances,
    loading: isGuidedSoloTutorial ? false : jokerInventoryLoading,
    pendingType: jokerSpendPendingType,
    mistakeShieldActive: isGuidedSoloTutorial ? false : mistakeShieldActive,
    timerFrozen: isGuidedSoloTutorial ? false : isSoloTimerFrozen,
    message: isGuidedSoloTutorial ? 'Eğitimde jokerler sadece tanıtılır; gerçek çantandan harcanmaz.' : jokerMessage,
    error: jokerError,
    disabled: Boolean(isGuidedSoloTutorial || soloLevelResult || winner || jokerInventoryLoading || jokerSpendPendingType),
    onUseJoker: handleUseSoloJoker,
  } : null;

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
          mistakes={mistakeCount}
        />
      )}

      <AnimatePresence>
        {feedback && (
          <FeedbackOverlay result={feedback.result} year={feedback.year} songTitle={feedback.songTitle} guessedYear={feedback.guessedYear} onDone={handleFeedbackDone} />
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
        soloLevelTotalSeconds={isSoloLevelMode ? (soloLevel?.totalTimeSeconds ?? SOLO_LEVEL_TIME_SECONDS) : undefined}
        soloLevelElapsedSeconds={isSoloLevelMode ? soloEffectiveElapsedSeconds : undefined}
        soloLevelTimerFrozen={isSoloLevelMode ? isSoloTimerFrozen : false}
        soloJokers={isSoloLevelMode ? soloJokers : null}
        balances={soloJokers?.balances || null}
        beginnerPlacementHintZone={beginnerPlacementHintZone}
        correctStreak={isSoloLevelMode ? soloCorrectStreak : 0}
      />
      <SoloQuestionDebugPanel payload={soloQuestionDebugPayload} />
    </GameRenderErrorBoundary>
  );
}
