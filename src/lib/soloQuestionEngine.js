// Codex166/Codex180 — Solo Question Selection Engine.
//
// PURPOSE
//   Replaces the previous "shuffle the whole filtered pool and pick on
//   demand" Solo question selection with a controlled, pre-computed
//   attempt deck of level-aware size per Solo attempt.
//
// CORE RULES (locked in by Health suite solo_question_engine_health):
//   • Deck size               = normal 18, special 21
//   • Win condition           = normal 7 correct timeline cards; special 10
//                                (seed cards already count on the timeline)
//   • Special levels          = level 5, then every 5 levels
//   • Fail condition          = level-specific evaluated move limit without target OR 180s time expired
//   • Unique question IDs     in the same deck
//   • Unique answer/year      in the same deck             (HARD rule)
//   • Active questions only   (state==='A')
//   • Active categories only  — caller supplies the active category id
//                               whitelist (numeric main_category_id +
//                               optional legacy string `category`)
//   • First-five spacing      — first 5 ordered cards must be at least
//                               5 years apart when any valid deck exists.
//   • Soft balance            — categories, subcategories, and eras are
//                               spread when the pool is rich enough.
//   • Recently-seen aware     — prefers questions the user has not
//                               recently played, but never relaxes the
//                               unique-year rule to do so.
//
// FALLBACK ORDER (allowed → forbidden):
//   1. Ideal pool: active, year-window, unique-year, category/subcategory/
//      era-balanced, first-five spaced, not recently seen.
//   2. Relax recently-seen.
//   3. Relax category/subcategory/era balance.
//   4. CLEAN FAIL — return { ok:false, reason:'insufficient_unique_years',
//      message:'Bu seviye için yeterli sayıda farklı yıla ait soru
//      bulunamadı.' }. Caller MUST surface this; do not start the level.
//
// Never relax:
//   • required deck size
//   • unique question IDs
//   • unique answer/years
//   • active question / active category gating
//   • first 5 ordered questions at least 5 years apart unless no valid
//     spaced deck exists at all, in which case the level clean-fails.
//
// REPLAY
//   A fresh attempt id (timestamped + random) gives a fresh deck. Replay
//   from the Solo result popup re-mounts Game with a new attempt and
//   therefore a new deck.

import {
  getSoloAttemptDeckSizeForLevel,
  getSoloCardsRequiredForLevel,
  isSoloSpecialLevel,
  SOLO_MAX_EVALUATED_MOVES,
} from './soloProgressHelpers';
import { SOLO_QUESTION_POLICY } from './categoryPolicy';

const DEFAULT_DECK_SIZE = getSoloAttemptDeckSizeForLevel(1);
const FIRST_FIVE_SPACING_TARGET_COUNT = 5;
const FIRST_FIVE_MIN_YEAR_GAP = 5;
const DEFAULT_VISIBLE_SEED_COUNT = 2;
const FIRST_FIVE_SOFT_CLUSTER_CAP = 2;
const FIRST_SEVEN_BALANCE_TARGET_COUNT = 7;
const FIRST_SEVEN_CATEGORY_CAP = 3;
const FIRST_SEVEN_SUBCATEGORY_CAP = 3;
const FIRST_SEVEN_THEME_CAP = 3;
const EXPOSURE_RECENT_BASE_PENALTY = 240;
const EXPOSURE_RECENT_RANK_PENALTY = 340;
const EXPOSURE_COUNT_PENALTY = 36;
const EXPOSURE_NEVER_SHOWN_BOOST = -28;
const EXPOSURE_MAX_PENALTY = 520;
const CATEGORY_PROPORTION_WEIGHT = 42;
const SUBCATEGORY_PROPORTION_WEIGHT = 34;
const THEME_PROPORTION_WEIGHT = 26;
const YEAR_BAND_PROPORTION_WEIGHT = 24;
const USER_CATEGORY_PREFERENCE_RATIO = SOLO_QUESTION_POLICY.selectedCategoryPreferenceRatio;
const USER_CATEGORY_PREFERENCE_MIN_VALID_COUNT = SOLO_QUESTION_POLICY.minimumValidPreferenceCount;
const USER_CATEGORY_PREFERENCE_SELECTED_WEIGHT = 520;
const USER_CATEGORY_PREFERENCE_GLOBAL_WEIGHT = 260;
const USER_CATEGORY_GLOBAL_DIFFICULTY_TARGET = SOLO_QUESTION_POLICY.globalLaneDifficultyTarget;
const USER_CATEGORY_SELECTED_LANE_DIFFICULTIES = new Set(SOLO_QUESTION_POLICY.selectedLaneDifficulties);
const USER_CATEGORY_SELECTED_LANE_DIFFICULTY_RULE = 'difficulty:1|2';
const USER_CATEGORY_GLOBAL_LANE_DIFFICULTY_RULE = 'difficulty:1';
const USER_CATEGORY_GLOBAL_DIFFICULTY_WEIGHT = 360;
const USER_CATEGORY_GLOBAL_DIFFICULTY_FALLBACK_PENALTY = 260;
const SPORTS_CLUSTER_TOKENS = [
  'arena', 'spor', 'sport', 'football', 'futbol', 'soccer', 'basket',
  'tenis', 'tennis', 'olimpiyat', 'olympic', 'messi', 'serena',
];

export function getBeginnerYearSpacingForLevel(levelNumber) {
  const level = Math.trunc(Number(levelNumber) || 0);
  if (level < 1) return null;
  return {
    idealGap: FIRST_FIVE_MIN_YEAR_GAP,
    minGap: FIRST_FIVE_MIN_YEAR_GAP,
    targetCount: FIRST_FIVE_SPACING_TARGET_COUNT,
    hard: true,
  };
}

export function shouldShowBeginnerPlacementHint(levelNumber) {
  const level = Math.trunc(Number(levelNumber) || 0);
  return level >= 1 && level <= 3;
}

// Deterministic-capable shuffler. If `random` is omitted, falls back to
// Math.random so existing callers stay non-deterministic.
function fisherYatesShuffle(items, random = Math.random) {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function normalizeRecentIds(recentIds) {
  if (!recentIds) return new Set();
  const values = recentIds instanceof Set
    ? Array.from(recentIds)
    : (Array.isArray(recentIds) ? recentIds : [recentIds]);
  return new Set(values.map((value) => String(value ?? '').trim()).filter(Boolean));
}

function normalizeRecentIdRanks(recentIds) {
  if (!recentIds || recentIds instanceof Set) return new Map();
  const values = Array.isArray(recentIds) ? recentIds : [recentIds];
  const ranks = new Map();
  for (const [index, value] of values.entries()) {
    const id = String(value ?? '').trim();
    if (!id || ranks.has(id)) continue;
    ranks.set(id, index);
  }
  return ranks;
}

function normalizeQuestionId(value) {
  const id = String(value ?? '').trim();
  return id || null;
}

function parseTimestampMs(value) {
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) return numeric;
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeExposureCount(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
}

function normalizeQuestionExposureStats(questionExposureStats) {
  const stats = new Map();
  if (!questionExposureStats) return stats;

  const entries = questionExposureStats instanceof Map
    ? Array.from(questionExposureStats.entries())
    : Array.isArray(questionExposureStats)
      ? questionExposureStats.map((item) => {
        if (Array.isArray(item)) return item;
        return [item?.questionId ?? item?.question_id ?? item?.id, item];
      })
      : Object.entries(questionExposureStats);

  for (const [rawId, rawStat] of entries) {
    const id = normalizeQuestionId(rawId ?? rawStat?.questionId ?? rawStat?.question_id ?? rawStat?.id);
    if (!id) continue;
    const stat = rawStat && typeof rawStat === 'object' ? rawStat : {};
    stats.set(id, {
      shownCount: normalizeExposureCount(
        stat.shownCount
          ?? stat.shown_count
          ?? stat.soloShownCount
          ?? stat.solo_shown_count
          ?? stat.exposureCount
          ?? stat.count,
      ),
      lastShownAt: parseTimestampMs(stat.lastShownAt ?? stat.last_shown_at ?? stat.shownAt ?? stat.shown_at),
      recentRank: Number.isFinite(Number(stat.recentRank ?? stat.recent_rank))
        ? Math.max(0, Number(stat.recentRank ?? stat.recent_rank))
        : null,
      source: String(stat.source || 'unknown'),
    });
  }

  return stats;
}

function getQuestionExposureStat(question, exposureStats = new Map()) {
  const id = normalizeQuestionId(question?.id ?? question?.question_id);
  const stored = id ? exposureStats.get(id) : null;
  const fieldShownCount = normalizeExposureCount(
    question?.solo_shown_count
      ?? question?.shown_count
      ?? question?.exposure_count
      ?? question?.shownCount,
  );
  const fieldLastShownAt = parseTimestampMs(
    question?.last_solo_shown_at
      ?? question?.last_shown_at
      ?? question?.lastShownAt,
  );

  if (!stored && fieldShownCount === 0 && !fieldLastShownAt) return null;

  return {
    shownCount: Math.max(stored?.shownCount || 0, fieldShownCount),
    lastShownAt: Math.max(stored?.lastShownAt || 0, fieldLastShownAt || 0) || null,
    recentRank: stored?.recentRank ?? null,
    source: stored?.source || (fieldShownCount || fieldLastShownAt ? 'question_projection' : 'unknown'),
  };
}

function getQuestionRecentRank(id, stat, options = {}) {
  const statRank = Number(stat?.recentRank);
  if (Number.isFinite(statRank)) return Math.max(0, statRank);
  const rank = id ? options.recentRanks?.get(id) : null;
  return Number.isFinite(Number(rank)) ? Math.max(0, Number(rank)) : null;
}

function scoreQuestionExposure(question, options = {}) {
  const id = normalizeQuestionId(question?.id ?? question?.question_id);
  const recentHit = Boolean(id && options.recentIds?.has(id));
  const playerStat = getQuestionExposureStat(question, options.playerExposureStats);
  const globalStat = getQuestionExposureStat(question, options.globalExposureStats ?? options.exposureStats);
  const stat = playerStat || globalStat;
  const recentRank = getQuestionRecentRank(id, playerStat || globalStat, options);
  const hasPlayerSignals = Boolean(options.playerExposureStats?.size);
  const hasGlobalSignals = Boolean(options.globalExposureStats?.size || options.exposureStats?.size);
  if (!recentHit && !playerStat && !globalStat && !hasPlayerSignals && !hasGlobalSignals) return 0;

  let score = 0;
  if (hasPlayerSignals) {
    if (playerStat?.shownCount > 0) {
      score += 920 + Math.min(1600, playerStat.shownCount * 260);
    } else {
      score -= 420;
    }

    const playerAgeMs = playerStat?.lastShownAt ? Date.now() - Number(playerStat.lastShownAt) : Infinity;
    if (Number.isFinite(playerAgeMs) && playerAgeMs >= 0) {
      const playerAgeDays = playerAgeMs / (24 * 60 * 60 * 1000);
      if (playerAgeDays < 1) score += 360;
      else if (playerAgeDays < 7) score += 240;
      else if (playerAgeDays < 30) score += 120;
    }
  }

  if (recentHit) {
    score += Number.isFinite(recentRank)
      ? Math.max(40, EXPOSURE_RECENT_RANK_PENALTY - Math.min(EXPOSURE_RECENT_RANK_PENALTY - 40, recentRank * 0.45))
      : EXPOSURE_RECENT_BASE_PENALTY;
  }
  if (globalStat?.shownCount > 0) {
    score += Math.min(
      Math.round(EXPOSURE_MAX_PENALTY * 0.45),
      (Math.log2(globalStat.shownCount + 1) * EXPOSURE_COUNT_PENALTY * 0.5) + globalStat.shownCount * 5,
    );
  } else if (hasGlobalSignals) {
    score += EXPOSURE_NEVER_SHOWN_BOOST;
  }

  if (!recentHit && Number.isFinite(recentRank)) {
    score += Math.max(0, 80 - recentRank * 0.35);
  }

  const ageMs = globalStat?.lastShownAt ? Date.now() - Number(globalStat.lastShownAt) : Infinity;
  if (Number.isFinite(ageMs) && ageMs >= 0) {
    const ageDays = ageMs / (24 * 60 * 60 * 1000);
    if (ageDays < 1) score += 90;
    else if (ageDays < 7) score += 60;
    else if (ageDays < 30) score += 25;
  }

  return score;
}

function normalizeAllowedCategoryIds(allowedMainCategoryIds) {
  if (!allowedMainCategoryIds) return null;
  const values = allowedMainCategoryIds instanceof Set
    ? Array.from(allowedMainCategoryIds)
    : (Array.isArray(allowedMainCategoryIds) ? allowedMainCategoryIds : [allowedMainCategoryIds]);
  const normalized = values
    .map((value) => {
      const raw = value && typeof value === 'object'
        ? (value.main_category_id ?? value.category_id ?? value.categoryid ?? value.categoryId ?? value.id)
        : value;
      const numeric = Number(raw);
      if (!Number.isFinite(numeric)) return null;
      const id = Math.trunc(numeric);
      return id > 0 ? String(id) : null;
    })
    .filter(Boolean);
  return normalized.length ? new Set(normalized) : null;
}

function normalizeCategoryIdSet(values) {
  if (!values) return new Set();
  const source = values instanceof Set
    ? Array.from(values)
    : (Array.isArray(values) ? values : [values]);
  return new Set(source
    .map((value) => {
      const raw = value && typeof value === 'object'
        ? (value.category_id ?? value.main_category_id ?? value.categoryId ?? value.id)
        : value;
      const numeric = Number(raw);
      if (!Number.isFinite(numeric)) return null;
      const id = Math.trunc(numeric);
      return id > 0 ? String(id) : null;
    })
    .filter(Boolean));
}

function getQuestionMainCategoryId(question) {
  const cid = Number(question?.main_category_id ?? question?.mainCategoryId ?? question?.category_id ?? question?.categoryid ?? question?.categoryId);
  return Number.isFinite(cid) && cid > 0 ? String(Math.trunc(cid)) : null;
}

export function getSoloCategoryPreferenceTargetCounts(deckSize = DEFAULT_DECK_SIZE) {
  const size = Math.max(0, Math.trunc(Number(deckSize) || 0));
  const selectedCategoryTargetCount = Math.min(size, Math.max(0, Math.round(size * USER_CATEGORY_PREFERENCE_RATIO)));
  return {
    preferenceRatioTarget: '70/30',
    selectedCategoryTargetCount,
    globalTargetCount: Math.max(0, size - selectedCategoryTargetCount),
  };
}

function buildUserCategoryPreferenceContext(args = {}, deckSize = DEFAULT_DECK_SIZE) {
  const selectedCategoryIds = normalizeCategoryIdSet(
    args.userSelectedCategoryIds
      ?? args.selectedCategoryIds
      ?? args.userCategoryPreferenceIds,
  );
  const targets = getSoloCategoryPreferenceTargetCounts(deckSize);
  const preferenceRowsAvailable = args.userCategoryPreferenceAvailable !== false;
  const enoughPreferences = selectedCategoryIds.size >= USER_CATEGORY_PREFERENCE_MIN_VALID_COUNT;
  const enabled = preferenceRowsAvailable && enoughPreferences;
  const fallbackReason = enabled
    ? null
    : (args.userCategoryPreferenceFallbackReason
      || (!preferenceRowsAvailable
        ? 'preference_unavailable'
        : selectedCategoryIds.size > 0
          ? 'insufficient_valid_user_category_preferences'
          : 'no_valid_user_category_preferences'));

  return {
    ...targets,
    enabled,
    userCategoryPreferenceAvailable: preferenceRowsAvailable,
    preferenceWeightingEnabled: enabled,
    selectedCategoryIds,
    selectedCategoryIdsCount: selectedCategoryIds.size,
    minimumValidCategoryPreferenceCount: USER_CATEGORY_PREFERENCE_MIN_VALID_COUNT,
    softPreferenceOnly: true,
    hardFilterToSelectedCategories: false,
    fallbackUsed: !enabled,
    fallbackReason,
  };
}

function isQuestionInUserSelectedCategory(question, preferenceContext) {
  if (!preferenceContext?.selectedCategoryIds?.size) return false;
  const categoryId = getQuestionMainCategoryId(question);
  return Boolean(categoryId && preferenceContext.selectedCategoryIds.has(categoryId));
}

function enrichPreferenceContextForGlobalDifficulty(preferenceContext = {}, candidates = []) {
  const context = {
    ...preferenceContext,
    globalDifficultyTarget: USER_CATEGORY_GLOBAL_DIFFICULTY_TARGET,
    globalDifficultyTargetLabel: `difficulty:${USER_CATEGORY_GLOBAL_DIFFICULTY_TARGET}`,
    globalDifficultyRuleAppliesOnlyToGlobal30: true,
    selectedCategoryDifficultyRule: USER_CATEGORY_SELECTED_LANE_DIFFICULTY_RULE,
    selectedCategoryDifficultyAllowedValues: Array.from(USER_CATEGORY_SELECTED_LANE_DIFFICULTIES),
    selectedCategoryDifficultyUnrestricted: false,
    globalLaneDifficultyRule: USER_CATEGORY_GLOBAL_LANE_DIFFICULTY_RULE,
    globalPoolHardFilteredToSelectedCategories: false,
  };
  const fullEligibleCandidates = candidates || [];
  const selectedCandidates = fullEligibleCandidates
    .filter((question) => isQuestionInUserSelectedCategory(question, context));
  const nonSelectedCandidates = fullEligibleCandidates
    .filter((question) => !isQuestionInUserSelectedCategory(question, context));
  const globalCandidates = fullEligibleCandidates;
  const globalDifficultyCandidates = globalCandidates.filter(isGlobalDifficultyTargetQuestion);
  const fullEligibleDifficultyCandidates = fullEligibleCandidates.filter(isGlobalDifficultyTargetQuestion);
  const globalDifficultyYears = new Set(globalDifficultyCandidates
    .map((question) => Number(question?.year))
    .filter(Number.isFinite));
  const fullEligibleDifficultyYears = new Set(fullEligibleDifficultyCandidates
    .map((question) => Number(question?.year))
    .filter(Number.isFinite));
  const globalTargetCount = Math.max(0, Number(context.globalTargetCount) || 0);
  const globalDifficulty1TargetCount = Math.min(globalTargetCount, globalDifficultyYears.size);
  return {
    ...context,
    fullEligibleCandidateCount: fullEligibleCandidates.length,
    fullEligibleCandidateCategoryDistribution: buildDistribution(fullEligibleCandidates, getCategoryKey),
    selectedLaneCandidateCategoryDistribution: buildDistribution(selectedCandidates, getCategoryKey),
    globalLaneCandidateCategoryDistribution: buildDistribution(globalCandidates, getCategoryKey),
    nonSelectedCandidateCategoryDistribution: buildDistribution(nonSelectedCandidates, getCategoryKey),
    globalCandidateCount: globalCandidates.length,
    fullEligibleDifficulty1CandidateCount: fullEligibleDifficultyCandidates.length,
    fullEligibleDifficulty1CandidateYears: fullEligibleDifficultyYears.size,
    fullEligibleDifficulty1CandidateCategoryDistribution: buildDistribution(fullEligibleDifficultyCandidates, getCategoryKey),
    globalDifficulty1CandidateCategoryDistribution: buildDistribution(globalDifficultyCandidates, getCategoryKey),
    globalDifficulty1CandidateCount: globalDifficultyCandidates.length,
    globalDifficulty1CandidateYears: globalDifficultyYears.size,
    globalDifficulty1TargetCount,
    globalDifficultyFallbackExpected: Boolean(context.enabled && globalDifficulty1TargetCount < globalTargetCount),
    globalDifficultyFallbackReason: context.enabled && globalDifficulty1TargetCount < globalTargetCount
      ? 'insufficient_global_difficulty_1_candidates'
      : null,
  };
}

function countPreferredCategoryCards(items = [], preferenceContext) {
  return (items || []).reduce(
    (count, question) => count + (isQuestionInUserSelectedCategory(question, preferenceContext) ? 1 : 0),
    0,
  );
}

function countGlobalCandidateCards(items = [], preferenceContext) {
  return (items || []).reduce(
    (count, question) => count + (isQuestionInUserSelectedCategory(question, preferenceContext) ? 0 : 1),
    0,
  );
}

function countGlobalDifficultyTargetCards(items = [], preferenceContext) {
  return (items || []).reduce((count, question) => {
    if (preferenceContext?.enabled && isQuestionInUserSelectedCategory(question, preferenceContext)) {
      return count;
    }
    return count + (isGlobalDifficultyTargetQuestion(question) ? 1 : 0);
  }, 0);
}

function scoreGlobalDifficultyTarget(question, selected, options = {}) {
  const context = options.preferenceContext;
  if (!context?.enabled) return 0;

  const selectedGlobalCount = countGlobalCandidateCards(selected, context);
  const globalTargetCount = Math.max(0, Number(context.globalTargetCount) || 0);
  if (selectedGlobalCount >= globalTargetCount) return 0;

  const difficultyTargetCount = Math.max(0, Number(context.globalDifficulty1TargetCount) || 0);
  const selectedDifficultyCount = countGlobalDifficultyTargetCards(selected, context);
  if (selectedDifficultyCount >= difficultyTargetCount) return 0;

  const missing = Math.max(0, difficultyTargetCount - selectedDifficultyCount);
  if (isGlobalDifficultyTargetQuestion(question)) {
    return -USER_CATEGORY_GLOBAL_DIFFICULTY_WEIGHT - Math.min(180, missing * 22);
  }
  return USER_CATEGORY_GLOBAL_DIFFICULTY_FALLBACK_PENALTY + Math.min(220, missing * 32);
}

function scoreUserCategoryPreferenceTarget(question, selected, options = {}) {
  const context = options.preferenceContext;
  if (!context?.enabled) return 0;

  const selectedPreferredCount = countPreferredCategoryCards(selected, context);
  const selectedGlobalCount = Math.max(0, selected.length - selectedPreferredCount);
  const preferredCandidate = isQuestionInUserSelectedCategory(question, context);
  const selectedMissing = Math.max(0, context.selectedCategoryTargetCount - selectedPreferredCount);
  const globalMissing = Math.max(0, context.globalTargetCount - selectedGlobalCount);

  if (preferredCandidate) {
    if (selectedPreferredCount < context.selectedCategoryTargetCount) {
      return -USER_CATEGORY_PREFERENCE_SELECTED_WEIGHT - Math.min(220, selectedMissing * 24);
    }
    return USER_CATEGORY_PREFERENCE_SELECTED_WEIGHT * 0.55
      + Math.max(0, selectedPreferredCount - context.selectedCategoryTargetCount + 1) * 150;
  }

  if (selectedGlobalCount < context.globalTargetCount) {
    return -USER_CATEGORY_PREFERENCE_GLOBAL_WEIGHT - Math.min(140, globalMissing * 18);
  }

  if (selectedPreferredCount < context.selectedCategoryTargetCount) {
    return USER_CATEGORY_PREFERENCE_SELECTED_WEIGHT * 0.85 + selectedMissing * 36;
  }

  return 0;
}

function parseCleanNumericYear(value) {
  if (typeof value === 'number') return Number.isFinite(value) && Number.isInteger(value) ? value : null;
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!text) return null;
  if (!/^-?\d{1,4}$/.test(text)) return null;
  const year = Number(text);
  return Number.isFinite(year) ? year : null;
}

// Question is considered playable only when runtime data marks it active.
// The authenticated getQuestions path now projects playable rows with
// state==='A'; missing state should be normalized before the deck engine.
function isActiveQuestion(question) {
  if (!question) return false;
  const state = question.state;
  return String(state).toUpperCase() === 'A';
}

// Categories: caller supplies an active main_category_id whitelist (the
// engine does NOT consult Category.status itself — that responsibility
// stays with the data layer that builds the whitelist).
function isInAllowedCategory(question, allowedMainCategoryIds) {
  if (!allowedMainCategoryIds || allowedMainCategoryIds.size === 0) return true;
  const mid = Number(question?.main_category_id ?? question?.mainCategoryId ?? question?.category_id ?? question?.categoryid ?? question?.categoryId);
  if (Number.isFinite(mid)) return allowedMainCategoryIds.has(String(Math.trunc(mid)));
  // Backward compat: rows without numeric main_category_id are accepted
  // only when the caller doesn't enforce a strict whitelist — but we are
  // here, so reject. The caller should backfill main_category_id during
  // its data layer.
  return false;
}

// Year normalization is data-layer's job (questionRuntimeAdapter parses
// year out of the answer when missing). The engine only requires a
// finite integer year here.
function hasUsableYear(question) {
  return parseCleanNumericYear(question?.year) !== null;
}

// Question text + id sanity.
function hasUsableContent(question) {
  if (!question || question.id === undefined || question.id === null) return false;
  if (typeof question.question !== 'string') return false;
  return question.question.trim().length > 0;
}

// Pure filter: returns the subset of `pool` that survives every HARD
// gate. Unique-year deduplication happens later inside the selector.
function filterCandidatePool(pool, allowedMainCategoryIds) {
  return (pool || []).filter((q) =>
    hasUsableContent(q)
    && hasUsableYear(q)
    && isActiveQuestion(q)
    && isInAllowedCategory(q, allowedMainCategoryIds),
  );
}

// Group candidates by year so we can guarantee unique years by picking
// at most one from each bucket. We keep all rows per year so soft
// category balance can still pick the most balancing card.
function groupByYear(candidates) {
  const buckets = new Map();
  for (const q of candidates) {
    const y = Number(q.year);
    if (!buckets.has(y)) buckets.set(y, []);
    buckets.get(y).push(q);
  }
  return buckets;
}

function isSpacedFromAll(year, selectedYears, minGap) {
  return selectedYears.every((selectedYear) => Math.abs(Number(selectedYear) - Number(year)) >= minGap);
}

function hasMinimumYearGap(years, minGap = FIRST_FIVE_MIN_YEAR_GAP) {
  const numericYears = years.map(Number).filter(Number.isFinite);
  for (let i = 0; i < numericYears.length; i += 1) {
    for (let j = i + 1; j < numericYears.length; j += 1) {
      if (Math.abs(numericYears[i] - numericYears[j]) < minGap) return false;
    }
  }
  return true;
}

function canPickSpacedYears(years, targetCount = FIRST_FIVE_SPACING_TARGET_COUNT, minGap = FIRST_FIVE_MIN_YEAR_GAP) {
  const picked = [];
  for (const year of [...years].sort((a, b) => Number(a) - Number(b))) {
    if (!Number.isFinite(Number(year))) continue;
    if (!isSpacedFromAll(year, picked, minGap)) continue;
    picked.push(year);
    if (picked.length >= targetCount) return true;
  }
  return false;
}

function orderYearsForEraSpread(years, random) {
  const sorted = [...years].sort((a, b) => Number(a) - Number(b));
  if (sorted.length <= 1) return sorted;
  const bucketCount = Math.min(4, sorted.length);
  const buckets = Array.from({ length: bucketCount }, () => []);
  sorted.forEach((year, index) => {
    const bucketIndex = Math.min(bucketCount - 1, Math.floor((index * bucketCount) / sorted.length));
    buckets[bucketIndex].push(year);
  });
  const shuffledBuckets = buckets.map((bucket) => fisherYatesShuffle(bucket, random));
  const out = [];
  let cursor = 0;
  while (out.length < sorted.length) {
    const bucket = shuffledBuckets[cursor % bucketCount];
    if (bucket.length) out.push(bucket.shift());
    cursor += 1;
  }
  return out;
}

function orderYearsForExposureFairness(years, buckets, random, options = {}) {
  const eraOrdered = orderYearsForEraSpread(years, random);
  if (!options.exposureStats?.size && !options.recentIds?.size && !options.preferenceContext?.enabled) return eraOrdered;

  return eraOrdered
    .map((year, index) => {
      const bucket = buckets?.get(Number(year)) || [];
      const exposureScore = bucket.length
        ? Math.min(...bucket.map((question) => scoreQuestionExposure(question, options)))
        : 0;
      const preferenceScore = bucket.length
        ? Math.min(...bucket.map((question) => scoreUserCategoryPreferenceTarget(question, [], options)))
        : 0;
      return { year, index, exposureScore: exposureScore + preferenceScore * 0.25 };
    })
    .sort((a, b) => {
      if (a.exposureScore !== b.exposureScore) return a.exposureScore - b.exposureScore;
      return a.index - b.index;
    })
    .map((item) => item.year);
}

function orderYearsForBeginnerSpacing(years, levelNumber, targetCountOverride = null) {
  const spacing = getBeginnerYearSpacingForLevel(levelNumber);
  if (!spacing || years.length === 0) return years;

  const requestedTarget = Number(targetCountOverride);
  const targetCount = Math.min(
    Math.max(
      spacing.targetCount,
      Number.isFinite(requestedTarget) ? Math.trunc(requestedTarget) : spacing.targetCount,
    ),
    years.length,
  );
  const priorityYears = [];
  const prioritySet = new Set();

  const collectPriorityYears = (orderedYears) => {
    priorityYears.length = 0;
    prioritySet.clear();
    for (const year of orderedYears) {
      if (priorityYears.length >= targetCount) break;
      if (!Number.isFinite(Number(year))) continue;
      if (!isSpacedFromAll(year, priorityYears, spacing.minGap)) continue;
      priorityYears.push(year);
      prioritySet.add(year);
    }
    return priorityYears.length >= targetCount;
  };

  if (!collectPriorityYears(years)) {
    collectPriorityYears([...years].sort((a, b) => Number(a) - Number(b)));
  }

  if (priorityYears.length >= targetCount) {
    return [
      ...priorityYears,
      ...years.filter((year) => !prioritySet.has(year)),
    ];
  }

  return null;
}

function getQuestionYear(question) {
  const year = Number(question?.year);
  return Number.isFinite(year) ? year : null;
}

function orderDeckForBeginnerSpacing(deck, levelNumber, random, options = {}) {
  const spacing = getBeginnerYearSpacingForLevel(levelNumber);
  const shuffled = fisherYatesShuffle(deck, random);
  if (!spacing || shuffled.length === 0) return shuffled;

  const targetCount = Math.min(spacing.targetCount, shuffled.length);
  const requestedSeedCount = Number(options.seedCount);
  const seedCount = Math.max(0, Math.min(
    Math.trunc(Number.isFinite(requestedSeedCount) ? requestedSeedCount : DEFAULT_VISIBLE_SEED_COUNT),
    Math.max(0, shuffled.length - targetCount),
  ));
  const makeSearchOrder = (candidates, selected, sourceOrder) => candidates
    .map((question, index) => ({
      question,
      index,
      score: scoreCandidateForBalance(question, selected, sourceOrder, {
        targets: options.balanceTargets,
        recentIds: options.recentIds,
        recentRanks: options.recentRanks,
        exposureStats: options.exposureStats,
        playerExposureStats: options.playerExposureStats,
        globalExposureStats: options.globalExposureStats,
        preferenceContext: options.preferenceContext,
      }),
      year: Number(question?.year),
    }))
    .sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score;
      if (a.index !== b.index) return a.index - b.index;
      return a.year - b.year;
    })
    .map((item) => item.question);

  const findSeedTail = (remaining, selectedFront, sourceOrder) => {
    if (seedCount <= 0) return [];

    const searchSeeds = (selectedSeeds, candidatePool) => {
      if (selectedSeeds.length >= seedCount) return selectedSeeds;
      const selectedYears = [...selectedFront, ...selectedSeeds].map((question) => Number(question.year));
      const candidates = makeSearchOrder(candidatePool, [...selectedFront, ...selectedSeeds], sourceOrder)
        .filter((question) => {
          const year = Number(question?.year);
          return Number.isFinite(year) && isSpacedFromAll(year, selectedYears, spacing.minGap);
        });

      for (const question of candidates) {
        const nextPool = candidatePool.filter((item) => item.id !== question.id);
        const found = searchSeeds([...selectedSeeds, question], nextPool);
        if (found) return found;
      }

      return null;
    };

    return searchSeeds([], remaining);
  };

  const composeOrderedDeck = (orderedDeck, useSoftClusterGuard) => {
    const searchFront = (selectedFront, candidatePool) => {
      if (selectedFront.length >= targetCount) {
        const seedTail = findSeedTail(candidatePool, selectedFront, orderedDeck);
        if (!seedTail) return null;
        return { front: selectedFront, seedTail };
      }

      const selectedYears = selectedFront.map((question) => Number(question.year));
      const candidates = makeSearchOrder(candidatePool, selectedFront, orderedDeck)
        .filter((question) => {
          const year = Number(question?.year);
          if (!Number.isFinite(year)) return false;
          if (!isSpacedFromAll(year, selectedYears, spacing.minGap)) return false;
          if (useSoftClusterGuard && exceedsFirstFiveSoftClusterCap(question, selectedFront)) return false;
          return true;
        });

      for (const question of candidates) {
        const nextPool = candidatePool.filter((item) => item.id !== question.id);
        const found = searchFront([...selectedFront, question], nextPool);
        if (found) return found;
      }

      return null;
    };

    const found = searchFront([], orderedDeck.slice());
    if (!found) return null;
    const { front, seedTail } = found;
    const frontIds = new Set(front.map((question) => question.id));
    const seedIds = new Set(seedTail.map((question) => question.id));
    const rest = fisherYatesShuffle(
      orderedDeck.filter((question) => !frontIds.has(question.id) && !seedIds.has(question.id)),
      random,
    );
    const orderedMiddle = orderCardsForBalance(rest, front, random, {
      targets: options.balanceTargets,
      recentIds: options.recentIds,
      recentRanks: options.recentRanks,
      exposureStats: options.exposureStats,
      preferenceContext: options.preferenceContext,
    });
    return [...front, ...orderedMiddle, ...seedTail];
  };

  const sorted = [...shuffled].sort((a, b) => Number(a?.year) - Number(b?.year));
  for (const [orderedDeck, useSoftClusterGuard] of [
    [shuffled, true],
    [sorted, true],
    [shuffled, false],
    [sorted, false],
  ]) {
    const ordered = composeOrderedDeck(orderedDeck, useSoftClusterGuard);
    if (ordered) return ordered;
  }

  return null;
}

function getCategoryKey(question) {
  const cid = Number(question?.main_category_id ?? question?.mainCategoryId ?? question?.category_id ?? question?.categoryid ?? question?.categoryId);
  return Number.isFinite(cid) ? `cat:${cid}` : 'cat:unknown';
}

function getSubcategoryKey(question) {
  const raw = question?.sub_category ?? question?.subcategory ?? question?.tag ?? '';
  const key = String(raw || '').trim().toLowerCase();
  return key || 'sub:unknown';
}

function getThemeKey(question) {
  const sportsKey = getSportsClusterKey(question);
  if (sportsKey) return 'theme:sports';
  const tag = String(question?.tag || '').trim().toLowerCase();
  if (tag) return `theme:${tag.split(/[,\s/|]+/).filter(Boolean)[0] || tag}`;
  const subcategoryKey = getSubcategoryKey(question);
  if (isKnownSubcategoryKey(subcategoryKey)) return subcategoryKey.replace(/^sub:/, 'theme:');
  return getCategoryKey(question).replace(/^cat:/, 'theme:cat:');
}

function getDecadeKey(question) {
  const year = getQuestionYear(question);
  if (year === null) return 'decade:unknown';
  return `decade:${Math.floor(year / 10) * 10}`;
}

function getYearBandKey(question) {
  const year = getQuestionYear(question);
  if (year === null) return 'year_band:unknown';
  const band = Math.floor(year / 50) * 50;
  return `year_band:${band}-${band + 49}`;
}

function isKnownSubcategoryKey(key) {
  return key && key !== 'sub:unknown';
}

function getSportsClusterKey(question) {
  const cid = Number(question?.main_category_id);
  if (Number.isFinite(cid) && cid === 5) return 'sports';
  const text = [
    question?.sub_category,
    question?.subcategory,
    question?.tag,
    question?.category,
    question?.question,
  ].map((value) => String(value || '').toLowerCase()).join(' ');
  return SPORTS_CLUSTER_TOKENS.some((token) => text.includes(token)) ? 'sports' : null;
}

function countMatching(items, selector, expected) {
  return items.reduce((count, item) => count + (selector(item) === expected ? 1 : 0), 0);
}

function exceedsFirstFiveSoftClusterCap(question, selectedFront) {
  const subcategoryKey = getSubcategoryKey(question);
  if (
    isKnownSubcategoryKey(subcategoryKey) &&
    countMatching(selectedFront, getSubcategoryKey, subcategoryKey) >= FIRST_FIVE_SOFT_CLUSTER_CAP
  ) {
    return true;
  }

  const sportsKey = getSportsClusterKey(question);
  if (
    sportsKey &&
    countMatching(selectedFront, getSportsClusterKey, sportsKey) >= FIRST_FIVE_SOFT_CLUSTER_CAP
  ) {
    return true;
  }

  return false;
}

function buildDistribution(items, selector) {
  const distribution = {};
  for (const item of items || []) {
    const key = selector(item);
    if (!key) continue;
    distribution[key] = (distribution[key] || 0) + 1;
  }
  return distribution;
}

function getMaxDistributionCount(distribution) {
  return Math.max(0, ...Object.values(distribution || {}).map((value) => Number(value) || 0));
}

function getMaxConsecutiveCount(items, selector) {
  let max = 0;
  let current = 0;
  let previous = null;
  for (const item of items || []) {
    const key = selector(item);
    if (key && key === previous) current += 1;
    else current = key ? 1 : 0;
    previous = key;
    max = Math.max(max, current);
  }
  return max;
}

function countDistinctBy(candidates, selector) {
  return new Set(candidates.map(selector).filter(Boolean)).size;
}

function buildPoolProportionalTargets(distribution = {}, deckSize = DEFAULT_DECK_SIZE, options = {}) {
  const total = Math.max(1, Object.values(distribution).reduce((sum, value) => sum + (Number(value) || 0), 0));
  const targets = {};
  for (const [key, rawCount] of Object.entries(distribution || {})) {
    const count = Math.max(0, Number(rawCount) || 0);
    if (count <= 0) continue;
    const share = count / total;
    const idealDeckCount = share * deckSize;
    const isUnknown = key === options.unknownKey;
    const smallProtection = !isUnknown && count >= 2 && idealDeckCount > 0 && idealDeckCount < 1;
    targets[key] = {
      count,
      share,
      idealDeckCount,
      // Per-bucket soft cap follows the eligible-pool share. This keeps large
      // buckets large when the pool says they are large, without letting DB
      // order or easy-spacing buckets overrun the deck.
      softCap: Math.max(1, Math.ceil(idealDeckCount + (smallProtection ? 1 : 0.75))),
      smallProtection,
      isUnknown,
    };
  }
  return targets;
}

function getProportionalTarget(targets = {}, key) {
  return targets?.[key] || null;
}

function getMaxSoftCap(targets = {}, fallback = DEFAULT_DECK_SIZE) {
  const caps = Object.values(targets || {}).map((target) => Number(target?.softCap)).filter(Number.isFinite);
  return caps.length ? Math.max(...caps) : fallback;
}

function scoreProportionalBucket({ key, selectedCount, position, targetMap, weight, allowBoost = true }) {
  const target = getProportionalTarget(targetMap, key);
  if (!target) return 0;

  const nextPosition = Math.max(1, position + 1);
  const afterCount = selectedCount + 1;
  const expectedByNow = target.share * nextPosition;
  const overByNow = Math.max(0, afterCount - Math.max(1, expectedByNow + 1.25));
  const overIdealDeck = Math.max(0, afterCount - Math.max(1, target.idealDeckCount + 0.5));
  const overSoftCap = Math.max(0, afterCount - target.softCap);
  let score = 0;

  if (overByNow > 0) score += overByNow * weight * 0.35;
  if (overIdealDeck > 0) score += overIdealDeck * weight * 0.85;

  if (allowBoost && !target.isUnknown && selectedCount < Math.floor(target.idealDeckCount)) {
    const underTarget = Math.max(0, target.idealDeckCount - selectedCount);
    score -= Math.min(weight * 0.45, underTarget * weight * 0.18);
  }

  if (overSoftCap > 0) score += overSoftCap * weight * 1.65;
  if (target.smallProtection && selectedCount === 0 && nextPosition > 3 && allowBoost) {
    score -= weight * 0.22;
  }

  return score;
}

function getMinimumPairGap(years) {
  const numericYears = years.map(Number).filter(Number.isFinite);
  if (numericYears.length < 2) return Infinity;
  let minGap = Infinity;
  for (let i = 0; i < numericYears.length; i += 1) {
    for (let j = i + 1; j < numericYears.length; j += 1) {
      minGap = Math.min(minGap, Math.abs(numericYears[i] - numericYears[j]));
    }
  }
  return minGap;
}

function countMissingMetadata(items, selector, missingKey) {
  return (items || []).filter((item) => selector(item) === missingKey).length;
}

function normalizeDifficultyValue(question) {
  const raw = question?.difficulty ?? question?.Difficulty;
  if (raw === undefined || raw === null || raw === '') return null;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > 5) return null;
  return value;
}

function isGlobalDifficultyTargetQuestion(question) {
  return normalizeDifficultyValue(question) === USER_CATEGORY_GLOBAL_DIFFICULTY_TARGET;
}

function isSelectedCategoryLaneDifficultyAllowed(question) {
  const difficulty = normalizeDifficultyValue(question);
  return difficulty === null || USER_CATEGORY_SELECTED_LANE_DIFFICULTIES.has(difficulty);
}

function filterPreferenceLaneCandidatePool(candidates = [], preferenceContext = {}) {
  if (!preferenceContext?.enabled) return candidates || [];
  return (candidates || []).filter((question) => {
    if (isQuestionInUserSelectedCategory(question, preferenceContext)) {
      return isSelectedCategoryLaneDifficultyAllowed(question);
    }
    return true;
  });
}

function getDifficultyKey(question) {
  const difficulty = normalizeDifficultyValue(question);
  return difficulty === null ? 'difficulty:missing' : `difficulty:${difficulty}`;
}

function buildDeckWarnings({
  deck = [],
  meta = {},
  fallbackTier = meta.fallbackTier,
  poolHealth = null,
} = {}) {
  const warnings = [];
  const firstFiveYears = deck.slice(0, FIRST_FIVE_SPACING_TARGET_COUNT).map((q) => Number(q?.year));
  if (firstFiveYears.length >= FIRST_FIVE_SPACING_TARGET_COUNT && getMinimumPairGap(firstFiveYears) < FIRST_FIVE_MIN_YEAR_GAP) {
    warnings.push('first_five_spacing_below_contract');
  }
  if (meta.earlyVisibleMinimumGapOk === false) warnings.push('early_visible_spacing_conflict');
  if (fallbackTier && fallbackTier !== 'ideal') warnings.push(`fallback:${fallbackTier}`);
  if (Number(meta.maxFirstSevenCategoryCount) > FIRST_SEVEN_CATEGORY_CAP) warnings.push('first_seven_category_balance_limited');
  if (Number(meta.maxFirstSevenSubcategoryCount) > FIRST_SEVEN_SUBCATEGORY_CAP) warnings.push('first_seven_subcategory_balance_limited');
  if (Number(meta.firstFiveSportsClusterCount) > FIRST_FIVE_SOFT_CLUSTER_CAP) warnings.push('first_five_sports_cluster_limited');
  if (poolHealth?.warnings?.length) warnings.push(...poolHealth.warnings.map((warning) => `pool:${warning}`));
  return [...new Set(warnings)];
}

export function getSoloDifficultyStrategy(levelNumber, pool = []) {
  const level = Math.max(1, Math.trunc(Number(levelNumber) || 1));
  const special = isSoloSpecialLevel(level);
  const early = !special && level <= 3;
  const mid = !special && level > 3 && level < 10;
  const availableDifficulties = [...new Set((pool || [])
    .map(normalizeDifficultyValue)
    .filter((value) => value !== null))]
    .sort((a, b) => a - b);
  const hasDifficultyMetadata = availableDifficulties.length > 0;
  const preferredDifficulties = special
    ? [2, 3, 4, 1, 5]
    : early
      ? [1, 2]
      : mid
        ? [1, 2, 3]
        : [1, 2, 3, 4];
  const usablePreferredDifficulties = hasDifficultyMetadata
    ? preferredDifficulties.filter((difficulty) => availableDifficulties.includes(difficulty))
    : [1];
  return {
    readinessOnly: true,
    levelNumber: level,
    levelType: special ? 'special' : 'normal',
    phase: special ? 'special' : early ? 'early' : mid ? 'mid' : 'late',
    preferredDifficulties,
    usablePreferredDifficulties: usablePreferredDifficulties.length ? usablePreferredDifficulties : availableDifficulties,
    availableDifficulties,
    missingDifficultyFallback: !hasDifficultyMetadata,
    fallbackMode: hasDifficultyMetadata ? 'metadata_available_soft_preference' : 'missing_difficulty_safe_easy',
  };
}

export function getSoloDeckDiagnostics(resultOrDeck, options = {}) {
  const result = Array.isArray(resultOrDeck) ? { ok: true, deck: resultOrDeck, meta: options.meta || {} } : (resultOrDeck || {});
  const deck = Array.isArray(result.deck) ? result.deck : [];
  const meta = result.meta || {};
  const levelNumber = Math.max(1, Math.trunc(Number(options.levelNumber ?? meta.levelNumber) || 1));
  const firstFiveCards = deck.slice(0, FIRST_FIVE_SPACING_TARGET_COUNT);
  const years = deck.map((q) => Number(q?.year)).filter(Number.isFinite);
  const firstFiveYears = firstFiveCards.map((q) => Number(q?.year)).filter(Number.isFinite);
  const difficultyStrategy = getSoloDifficultyStrategy(levelNumber, deck);
  const diagnostics = {
    adminHealthOnly: true,
    exposeToNormalPlayers: false,
    levelNumber,
    levelType: isSoloSpecialLevel(levelNumber) ? 'special' : 'normal',
    deckSize: deck.length || Number(meta.deckSize) || getSoloAttemptDeckSizeForLevel(levelNumber),
    correctTarget: getSoloCardsRequiredForLevel(levelNumber),
    maxMoveLimit: SOLO_MAX_EVALUATED_MOVES,
    maxMistakeFailThreshold: SOLO_MAX_EVALUATED_MOVES,
    questionIds: deck.map((q) => q?.id).filter((id) => id !== undefined && id !== null),
    answerYears: years,
    firstFiveYears,
    minimumFirstFiveYearGap: getMinimumPairGap(firstFiveYears),
    visibleSpacingConflictCount: meta.earlyVisibleMinimumGapOk === false ? 1 : 0,
    categoryDistribution: meta.categoryDistribution || buildDistribution(deck, getCategoryKey),
    subcategoryDistribution: meta.subcategoryDistribution || buildDistribution(deck, getSubcategoryKey),
    themeDistribution: meta.themeDistribution || buildDistribution(deck, getThemeKey),
    sportsLikeCount: Number(meta.themeDistribution?.['theme:sports'] ?? buildDistribution(deck, getThemeKey)['theme:sports'] ?? 0),
    decadeDistribution: meta.decadeDistribution || buildDistribution(deck, getDecadeKey),
    yearBandDistribution: meta.yearBandDistribution || buildDistribution(deck, getYearBandKey),
    difficultyDistribution: buildDistribution(deck, getDifficultyKey),
    fallbackTier: meta.fallbackTier || 'unknown',
    diversityFairness: meta.diversityFairness || null,
    exposureFairness: meta.exposureFairness || null,
    categoryPreferenceFairness: meta.categoryPreferenceFairness || null,
    balanceScore: {
      maxCategoryCount: Number(meta.maxCategoryCount) || getMaxDistributionCount(meta.categoryDistribution || buildDistribution(deck, getCategoryKey)),
      maxSubcategoryCount: Number(meta.maxSubcategoryCount) || getMaxDistributionCount(meta.subcategoryDistribution || buildDistribution(deck, getSubcategoryKey)),
      maxThemeCount: Number(meta.maxThemeCount) || getMaxDistributionCount(meta.themeDistribution || buildDistribution(deck, getThemeKey)),
      maxDecadeCount: Number(meta.maxDecadeCount) || getMaxDistributionCount(meta.decadeDistribution || buildDistribution(deck, getDecadeKey)),
      maxYearBandCount: Number(meta.maxYearBandCount) || getMaxDistributionCount(meta.yearBandDistribution || buildDistribution(deck, getYearBandKey)),
      maxConsecutiveThemeCount: Number(meta.maxConsecutiveThemeCount) || getMaxConsecutiveCount(deck, getThemeKey),
    },
    difficultyStrategy,
  };
  diagnostics.warnings = buildDeckWarnings({ deck, meta, fallbackTier: diagnostics.fallbackTier, poolHealth: options.poolHealth });
  return diagnostics;
}

export function analyzeSoloQuestionPool(pool = [], args = {}) {
  const deckSizeNormal = getSoloAttemptDeckSizeForLevel(1);
  const deckSizeSpecial = getSoloAttemptDeckSizeForLevel(10);
  const allowedCats = normalizeAllowedCategoryIds(args.allowedMainCategoryIds);
  const candidates = filterCandidatePool(pool, allowedCats);
  const rawRows = Array.isArray(pool) ? pool : [];
  const invalidYearCount = rawRows.filter((q) => !hasUsableYear(q)).length;
  const inactiveQuestionCount = rawRows.filter((q) => !isActiveQuestion(q)).length;
  const missingSubcategoryCount = countMissingMetadata(candidates, getSubcategoryKey, 'sub:unknown');
  const missingThemeCount = countMissingMetadata(candidates, getThemeKey, 'theme:cat:unknown');
  const missingDifficultyCount = candidates.filter((q) => normalizeDifficultyValue(q) === null).length;
  const uniqueYearCount = new Set(candidates.map((q) => Number(q.year)).filter(Number.isFinite)).size;
  const categoryDistribution = buildDistribution(candidates, getCategoryKey);
  const subcategoryDistribution = buildDistribution(candidates, getSubcategoryKey);
  const themeDistribution = buildDistribution(candidates, getThemeKey);
  const decadeDistribution = buildDistribution(candidates, getDecadeKey);
  const yearBandDistribution = buildDistribution(candidates, getYearBandKey);
  const canBuildNormalDeck = uniqueYearCount >= deckSizeNormal && canPickSpacedYears([...new Set(candidates.map((q) => Number(q.year)))]);
  const canBuildSpecialDeck = uniqueYearCount >= deckSizeSpecial && canPickSpacedYears([...new Set(candidates.map((q) => Number(q.year)))]);
  const warnings = [];
  const hardFailures = [];
  if (uniqueYearCount < deckSizeNormal) hardFailures.push('insufficient_unique_years_for_normal_deck');
  if (uniqueYearCount < deckSizeSpecial) hardFailures.push('insufficient_unique_years_for_special_deck');
  if (!canPickSpacedYears([...new Set(candidates.map((q) => Number(q.year)))])) hardFailures.push('insufficient_first_five_spacing_pool');
  if (invalidYearCount > 0) warnings.push('invalid_or_missing_years_present');
  if (missingSubcategoryCount > 0) warnings.push('missing_subcategory_metadata');
  if (missingDifficultyCount > 0) warnings.push('missing_difficulty_metadata');
  if (getMaxDistributionCount(categoryDistribution) > Math.ceil(Math.max(1, candidates.length) * 0.5)) warnings.push('category_overrepresented');
  if (getMaxDistributionCount(subcategoryDistribution) > Math.ceil(Math.max(1, candidates.length) * 0.35)) warnings.push('subcategory_overrepresented');
  if (Object.keys(categoryDistribution).length < 3 && candidates.length >= deckSizeNormal) warnings.push('sparse_category_variety');
  if (Object.keys(subcategoryDistribution).length < 5 && candidates.length >= deckSizeNormal) warnings.push('sparse_subcategory_variety');
  return {
    adminHealthOnly: true,
    exposeToNormalPlayers: false,
    rawCount: rawRows.length,
    activeCandidateCount: candidates.length,
    inactiveQuestionCount,
    invalidYearCount,
    uniqueYearCount,
    missingSubcategoryCount,
    missingThemeCount,
    missingDifficultyCount,
    categoryDistribution,
    subcategoryDistribution,
    themeDistribution,
    decadeDistribution,
    yearBandDistribution,
    canBuildNormalDeck,
    canBuildSpecialDeck,
    canSatisfyFirstFiveSpacing: !hardFailures.includes('insufficient_first_five_spacing_pool'),
    canSatisfyP1Balance: warnings.every((warning) => ![
      'category_overrepresented',
      'subcategory_overrepresented',
      'sparse_category_variety',
      'sparse_subcategory_variety',
    ].includes(warning)),
    warnings,
    hardFailures,
  };
}

export function getSoloReplayVarietyDiagnostics(previousDeck = [], nextDeck = []) {
  const previousFirstFive = (previousDeck || []).slice(0, FIRST_FIVE_SPACING_TARGET_COUNT).map((q) => q?.id);
  const nextFirstFive = (nextDeck || []).slice(0, FIRST_FIVE_SPACING_TARGET_COUNT).map((q) => q?.id);
  const previousIds = new Set((previousDeck || []).map((q) => q?.id));
  const nextIds = new Set((nextDeck || []).map((q) => q?.id));
  const repeatedIds = [...nextIds].filter((id) => previousIds.has(id));
  return {
    adminHealthOnly: true,
    exposeToNormalPlayers: false,
    previousFirstFive,
    nextFirstFive,
    exactFirstFiveRepeat: previousFirstFive.length > 0 && previousFirstFive.join('|') === nextFirstFive.join('|'),
    repeatedQuestionCount: repeatedIds.length,
    repeatedQuestionIds: repeatedIds,
    softOnly: true,
  };
}

export function getKartDegistirDiagnostics({
  deck = [],
  currentQuestion = null,
  replacement = null,
  timelineYears = [],
  previousContextCards = [],
  noSafeReplacement = false,
} = {}) {
  const replacementInDeck = !!replacement && (deck || []).some((q) => q?.id === replacement?.id);
  const currentYear = getQuestionYear(currentQuestion);
  const replacementYear = getQuestionYear(replacement);
  const timeline = Array.from(timelineYears instanceof Set ? timelineYears : new Set(timelineYears || []))
    .map(Number)
    .filter(Number.isFinite);
  const preservedVisibleSpacing = replacementYear !== null
    ? timeline.every((year) => Math.abs(year - replacementYear) >= FIRST_FIVE_MIN_YEAR_GAP)
    : false;
  const beforeContext = [...(previousContextCards || []), currentQuestion].filter(Boolean);
  const afterContext = [...(previousContextCards || []), replacement].filter(Boolean);
  const beforeThemeMax = getMaxDistributionCount(buildDistribution(beforeContext, getThemeKey));
  const afterThemeMax = getMaxDistributionCount(buildDistribution(afterContext, getThemeKey));
  return {
    adminHealthOnly: true,
    exposeToNormalPlayers: false,
    swappedOutQuestionId: currentQuestion?.id ?? null,
    replacementQuestionId: replacement?.id ?? null,
    replacementSource: replacementInDeck ? 'unused_deck_reserve' : replacement ? 'unknown' : 'none',
    swappedOutYear: currentYear,
    replacementYear,
    preservedVisibleSpacing,
    worsenedCategorySubcategoryBalance: afterThemeMax > beforeThemeMax,
    noSafeReplacement,
    jokerShouldBeConsumed: !!replacement && !noSafeReplacement,
  };
}

function makeBalanceTargets(candidates, deckSize) {
  const categoryCount = Math.max(1, countDistinctBy(candidates, getCategoryKey));
  const subcategoryCount = Math.max(1, countDistinctBy(candidates, getSubcategoryKey));
  const themeCount = Math.max(1, countDistinctBy(candidates, getThemeKey));
  const decadeCount = Math.max(1, countDistinctBy(candidates, getDecadeKey));
  const yearBandCount = Math.max(1, countDistinctBy(candidates, getYearBandKey));
  const categoryDistribution = buildDistribution(candidates, getCategoryKey);
  const subcategoryDistribution = buildDistribution(candidates, getSubcategoryKey);
  const themeDistribution = buildDistribution(candidates, getThemeKey);
  const decadeDistribution = buildDistribution(candidates, getDecadeKey);
  const yearBandDistribution = buildDistribution(candidates, getYearBandKey);
  const categoryTargets = buildPoolProportionalTargets(categoryDistribution, deckSize);
  const subcategoryTargets = buildPoolProportionalTargets(subcategoryDistribution, deckSize, { unknownKey: 'sub:unknown' });
  const themeTargets = buildPoolProportionalTargets(themeDistribution, deckSize);
  const decadeTargets = buildPoolProportionalTargets(decadeDistribution, deckSize);
  const yearBandTargets = buildPoolProportionalTargets(yearBandDistribution, deckSize, { unknownKey: 'year_band:unknown' });
  return {
    categoryCount,
    subcategoryCount,
    themeCount,
    decadeCount,
    yearBandCount,
    categoryCap: Math.max(2, Math.min(deckSize, getMaxSoftCap(categoryTargets, deckSize))),
    subcategoryCap: Math.max(2, getMaxSoftCap(subcategoryTargets, Math.ceil(deckSize / subcategoryCount) + 1)),
    themeCap: Math.max(2, getMaxSoftCap(themeTargets, Math.ceil(deckSize / themeCount) + 1)),
    decadeCap: Math.max(3, getMaxSoftCap(decadeTargets, Math.ceil(deckSize / decadeCount) + 1)),
    yearBandCap: Math.max(3, getMaxSoftCap(yearBandTargets, Math.ceil(deckSize / yearBandCount) + 1)),
    categoryDistribution,
    subcategoryDistribution,
    themeDistribution,
    decadeDistribution,
    yearBandDistribution,
    categoryTargets,
    subcategoryTargets,
    themeTargets,
    decadeTargets,
    yearBandTargets,
    poolProportional: true,
    equalCountBalancing: false,
  };
}

function scoreCandidateForBalance(question, selected, sourceOrder = [], options = {}) {
  const position = selected.length;
  const targets = options.targets || makeBalanceTargets([...selected, question], Math.max(position + 1, DEFAULT_DECK_SIZE));
  const categoryKey = getCategoryKey(question);
  const subcategoryKey = getSubcategoryKey(question);
  const themeKey = getThemeKey(question);
  const decadeKey = getDecadeKey(question);
  const yearBandKey = getYearBandKey(question);
  const categoryCount = countMatching(selected, getCategoryKey, categoryKey);
  const subcategoryCount = countMatching(selected, getSubcategoryKey, subcategoryKey);
  const themeCount = countMatching(selected, getThemeKey, themeKey);
  const decadeCount = countMatching(selected, getDecadeKey, decadeKey);
  const yearBandCount = countMatching(selected, getYearBandKey, yearBandKey);
  const sportsCount = countMatching(selected, getThemeKey, 'theme:sports');
  const last = selected[selected.length - 1] || null;
  const previous = selected[selected.length - 2] || null;
  const sourceIndex = sourceOrder.findIndex((item) => item?.id === question?.id);
  let score = 0;

  score += scoreQuestionExposure(question, options);
  score += scoreGlobalDifficultyTarget(question, selected, options);
  score += scoreUserCategoryPreferenceTarget(question, selected, options);
  score += scoreProportionalBucket({
    key: categoryKey,
    selectedCount: categoryCount,
    position,
    targetMap: targets.categoryTargets,
    weight: CATEGORY_PROPORTION_WEIGHT,
  });
  score += scoreProportionalBucket({
    key: subcategoryKey,
    selectedCount: subcategoryCount,
    position,
    targetMap: targets.subcategoryTargets,
    weight: SUBCATEGORY_PROPORTION_WEIGHT,
    allowBoost: isKnownSubcategoryKey(subcategoryKey),
  });
  score += scoreProportionalBucket({
    key: themeKey,
    selectedCount: themeCount,
    position,
    targetMap: targets.themeTargets,
    weight: THEME_PROPORTION_WEIGHT,
  });
  score += scoreProportionalBucket({
    key: yearBandKey,
    selectedCount: yearBandCount,
    position,
    targetMap: targets.yearBandTargets,
    weight: YEAR_BAND_PROPORTION_WEIGHT,
  });
  score += categoryCount * 16;
  score += (isKnownSubcategoryKey(subcategoryKey) ? subcategoryCount : Math.max(0, subcategoryCount - 1)) * 14;
  score += themeCount * 12;
  score += decadeCount * 9;
  score += yearBandCount * 5;

  if (categoryCount >= (getProportionalTarget(targets.categoryTargets, categoryKey)?.softCap ?? targets.categoryCap)) score += 85;
  if (isKnownSubcategoryKey(subcategoryKey) && subcategoryCount >= (getProportionalTarget(targets.subcategoryTargets, subcategoryKey)?.softCap ?? targets.subcategoryCap)) score += 80;
  if (themeCount >= (getProportionalTarget(targets.themeTargets, themeKey)?.softCap ?? targets.themeCap)) score += 70;
  if (decadeCount >= (getProportionalTarget(targets.decadeTargets, decadeKey)?.softCap ?? targets.decadeCap)) score += 45;
  if (yearBandCount >= (getProportionalTarget(targets.yearBandTargets, yearBandKey)?.softCap ?? targets.yearBandCap)) score += 50;

  if (position < FIRST_SEVEN_BALANCE_TARGET_COUNT && categoryCount >= FIRST_SEVEN_CATEGORY_CAP) score += 140;
  if (position < FIRST_SEVEN_BALANCE_TARGET_COUNT && isKnownSubcategoryKey(subcategoryKey) && subcategoryCount >= FIRST_SEVEN_SUBCATEGORY_CAP) score += 150;
  if (position < FIRST_SEVEN_BALANCE_TARGET_COUNT && themeCount >= FIRST_SEVEN_THEME_CAP) score += 130;
  if (position < FIRST_FIVE_SPACING_TARGET_COUNT && themeKey === 'theme:sports' && sportsCount >= FIRST_FIVE_SOFT_CLUSTER_CAP) score += 180;

  if (last) {
    if (getCategoryKey(last) === categoryKey) score += 35;
    if (isKnownSubcategoryKey(subcategoryKey) && getSubcategoryKey(last) === subcategoryKey) score += 95;
    if (getThemeKey(last) === themeKey) score += 80;
    if (getDecadeKey(last) === decadeKey) score += 45;
    if (getYearBandKey(last) === yearBandKey) score += 20;
  }
  if (last && previous) {
    if (getThemeKey(last) === themeKey && getThemeKey(previous) === themeKey) score += 220;
    if (isKnownSubcategoryKey(subcategoryKey) && getSubcategoryKey(last) === subcategoryKey && getSubcategoryKey(previous) === subcategoryKey) score += 220;
  }

  if (sourceIndex >= 0) score += sourceIndex * 0.01;
  return score;
}

function pickBestBalanceCandidate(candidates, selected, sourceOrder, options = {}) {
  let best = null;
  let bestScore = Infinity;
  for (const question of candidates) {
    const score = scoreCandidateForBalance(question, selected, sourceOrder, options);
    if (score < bestScore) {
      best = question;
      bestScore = score;
    }
  }
  return best;
}

function orderCardsForBalance(cards, prefix = [], random = Math.random, options = {}) {
  const remaining = fisherYatesShuffle(cards || [], random);
  const ordered = [];
  const sourceOrder = [...prefix, ...remaining];
  while (remaining.length > 0) {
    const selected = [...prefix, ...ordered];
    const pick = pickBestBalanceCandidate(remaining, selected, sourceOrder, options);
    if (!pick) break;
    ordered.push(pick);
    const index = remaining.findIndex((item) => item.id === pick.id);
    if (index >= 0) remaining.splice(index, 1);
    else break;
  }
  return ordered;
}

// Pick one question per year using soft P1 balance scoring. The scoring
// prefers category/subcategory/theme/decade spread, recently unseen cards,
// and varied ordering, while unique years remain a hard selector rule.
function selectUniqueYearDeck({
  candidates,
  deckSize,
  recentIds,
  recentRanks,
  exposureStats,
  playerExposureStats,
  globalExposureStats,
  preferenceContext,
  random,
  levelNumber,
  balanceTargets,
  earlyVisibleTargetCount,
}) {
  const buckets = groupByYear(candidates);
  if (buckets.size < deckSize) return null; // not enough distinct years

  const years = orderYearsForBeginnerSpacing(
    orderYearsForExposureFairness(Array.from(buckets.keys()), buckets, random, {
      recentIds,
      recentRanks,
      exposureStats,
      playerExposureStats,
      globalExposureStats,
      preferenceContext,
    }),
    levelNumber,
    earlyVisibleTargetCount,
  );
  if (!years) return null;
  const deck = [];
  const usedIds = new Set();
  const usedYears = new Set();
  const sourceOrder = fisherYatesShuffle(
    candidates
      .filter((question) => buckets.has(Number(question.year)))
      .sort((a, b) => years.indexOf(Number(a.year)) - years.indexOf(Number(b.year))),
    random,
  );
  const priorityYears = years.slice(0, Math.min(earlyVisibleTargetCount || FIRST_FIVE_SPACING_TARGET_COUNT, deckSize));

  for (const year of priorityYears) {
    const bucket = buckets.get(year).filter((q) => !usedIds.has(q.id));
    if (bucket.length === 0) continue;
    const pick = pickBestBalanceCandidate(fisherYatesShuffle(bucket, random), deck, sourceOrder, {
      recentIds,
      recentRanks,
      exposureStats,
      playerExposureStats,
      globalExposureStats,
      preferenceContext,
      targets: balanceTargets || makeBalanceTargets(candidates, deckSize),
    });
    if (!pick) continue;
    deck.push(pick);
    usedIds.add(pick.id);
    usedYears.add(Number(pick.year));
  }

  while (deck.length < deckSize) {
    const available = sourceOrder.filter((question) => {
      const year = Number(question.year);
      return !usedIds.has(question.id) && !usedYears.has(year);
    });
    if (available.length === 0) break;
    const pick = pickBestBalanceCandidate(available, deck, sourceOrder, {
      recentIds,
      recentRanks,
      exposureStats,
      playerExposureStats,
      globalExposureStats,
      preferenceContext,
      targets: balanceTargets || makeBalanceTargets(candidates, deckSize),
    });
    if (!pick) break;
    deck.push(pick);
    usedIds.add(pick.id);
    usedYears.add(Number(pick.year));
  }

  // If scoring cannot fill from the full source order for any unexpected
  // reason, fall back to the era-spread year walk without changing hard rules.
  for (const year of years) {
    if (deck.length >= deckSize) break;
    if (usedYears.has(Number(year))) continue;
    const bucket = buckets.get(year).filter((q) => !usedIds.has(q.id));
    if (bucket.length === 0) continue;
    const pick = pickBestBalanceCandidate(fisherYatesShuffle(bucket, random), deck, sourceOrder, {
      recentIds,
      recentRanks,
      exposureStats,
      playerExposureStats,
      globalExposureStats,
      preferenceContext,
      targets: balanceTargets || makeBalanceTargets(candidates, deckSize),
    });
    if (!pick) continue;

    deck.push(pick);
    usedIds.add(pick.id);
    usedYears.add(Number(pick.year));
  }

  return deck.length === deckSize ? deck : null;
}

function buildExposureDiagnostics(candidates = [], selectedDeck = [], recentIds = new Set(), exposureStats = new Map(), recentRanks = new Map()) {
  const countStats = (items) => {
    let withExposureStats = 0;
    let neverShown = 0;
    let recentHits = 0;
    let shownCountTotal = 0;
    let highExposureCount = 0;
    let rankedRecentHits = 0;
    let recentRankTotal = 0;

    for (const question of items || []) {
      const id = normalizeQuestionId(question?.id ?? question?.question_id);
      const stat = getQuestionExposureStat(question, exposureStats);
      const recentRank = getQuestionRecentRank(id, stat, { recentRanks });
      const shownCount = Number(stat?.shownCount) || 0;
      if (stat) withExposureStats += 1;
      if (exposureStats.size > 0 && shownCount === 0) neverShown += 1;
      if (id && recentIds.has(id)) recentHits += 1;
      if (id && recentIds.has(id) && Number.isFinite(recentRank)) {
        rankedRecentHits += 1;
        recentRankTotal += recentRank;
      }
      shownCountTotal += shownCount;
      if (shownCount >= 3 || (id && recentIds.has(id))) highExposureCount += 1;
    }

    return {
      withExposureStats,
      neverShown,
      recentHits,
      shownCountTotal,
      highExposureCount,
      rankedRecentHits,
      averageRecentRank: rankedRecentHits ? recentRankTotal / rankedRecentHits : null,
    };
  };

  const candidateStats = countStats(candidates);
  const selectedStats = countStats(selectedDeck);
  const candidateAverageShownCount = candidates.length ? candidateStats.shownCountTotal / candidates.length : 0;
  const selectedAverageShownCount = selectedDeck.length ? selectedStats.shownCountTotal / selectedDeck.length : 0;
  const candidateRecentHistoryRatio = candidates.length ? candidateStats.recentHits / candidates.length : 0;
  const selectedRecentHistoryRatio = selectedDeck.length ? selectedStats.recentHits / selectedDeck.length : 0;
  const selectedDeckSize = selectedDeck.length;
  const candidateNonRecentHistoryCount = Math.max(0, candidates.length - candidateStats.recentHits);
  const selectedNonRecentHistoryCount = Math.max(0, selectedDeckSize - selectedStats.recentHits);
  const minimumRecentHistoryNeeded = Math.max(0, selectedDeckSize - candidateNonRecentHistoryCount);
  const selectedRecentHistoryOverMinimum = Math.max(0, selectedStats.recentHits - minimumRecentHistoryNeeded);
  const recentHistoryScarcity = Boolean(
    selectedDeckSize > 0
      && (candidateNonRecentHistoryCount < selectedDeckSize || candidateRecentHistoryRatio >= 0.95),
  );
  const recentHistoryScarcityReason = recentHistoryScarcity
    ? (candidateNonRecentHistoryCount < selectedDeckSize
      ? 'non_recent_alternatives_below_deck_size'
      : 'candidate_pool_nearly_all_recent')
    : null;
  return {
    strategy: 'local_recent_history_and_optional_projection_stats_soft_penalty_v2_scarcity_aware',
    softCooldownOnly: true,
    localRecentHistoryUsed: recentIds.size > 0 || exposureStats.size > 0,
    exposureStatsAvailable: exposureStats.size > 0,
    eligibleCandidateCount: candidates.length,
    distinctCandidateIds: new Set(candidates.map((question) => normalizeQuestionId(question?.id)).filter(Boolean)).size,
    candidateExposureStatsCount: candidateStats.withExposureStats,
    neverShownCandidateCount: exposureStats.size > 0 ? candidateStats.neverShown : null,
    recentHistoryHitCount: candidateStats.recentHits,
    candidateRecentHistoryRatio,
    candidateNonRecentHistoryCount,
    candidateShownCountTotal: candidateStats.shownCountTotal,
    candidateAverageShownCount,
    candidateAverageRecentRank: candidateStats.averageRecentRank,
    selectedDeckIds: selectedDeck.map((question) => normalizeQuestionId(question?.id)).filter(Boolean),
    selectedExposureStatsCount: selectedStats.withExposureStats,
    selectedNeverShownCount: exposureStats.size > 0 ? selectedStats.neverShown : null,
    selectedRecentHistoryHitCount: selectedStats.recentHits,
    selectedRecentHistoryRatio,
    selectedNonRecentHistoryCount,
    minimumRecentHistoryNeeded,
    selectedRecentHistoryOverMinimum,
    recentHistoryScarcity,
    recentHistoryScarcityReason,
    selectedShownCountTotal: selectedStats.shownCountTotal,
    selectedAverageShownCount,
    selectedAverageRecentRank: selectedStats.averageRecentRank,
    recentHistorySelectionImprovement: candidateRecentHistoryRatio - selectedRecentHistoryRatio,
    averageShownCountImprovement: candidateAverageShownCount - selectedAverageShownCount,
    highExposurePenaltyAppliedCount: candidateStats.highExposureCount,
    cooldownPenaltyAppliedCount: candidateStats.recentHits + candidateStats.highExposureCount,
    leastRecentTierFallbackUsed: candidateStats.recentHits >= Math.max(0, candidates.length - selectedDeck.length)
      && selectedStats.recentHits > 0,
  };
}

function compactProportionalTargets(targets = {}) {
  return Object.fromEntries(Object.entries(targets || {}).map(([key, target]) => [key, {
    poolCount: target.count,
    poolShare: Number(target.share.toFixed(4)),
    idealDeckCount: Number(target.idealDeckCount.toFixed(2)),
    softCap: target.softCap,
    smallProtection: target.smallProtection,
  }]));
}

function buildDiversityDiagnostics(candidates = [], selectedDeck = [], balanceTargets = {}) {
  return {
    strategy: 'pool_proportional_category_subcategory_theme_year_band_v1',
    poolProportional: true,
    equalCountBalancing: false,
    softOnly: true,
    eligibleCandidateCount: candidates.length,
    selectedDeckSize: selectedDeck.length,
    eligibleCategoryDistribution: balanceTargets.categoryDistribution || buildDistribution(candidates, getCategoryKey),
    selectedCategoryDistribution: buildDistribution(selectedDeck, getCategoryKey),
    categoryTargets: compactProportionalTargets(balanceTargets.categoryTargets),
    eligibleSubcategoryDistribution: balanceTargets.subcategoryDistribution || buildDistribution(candidates, getSubcategoryKey),
    selectedSubcategoryDistribution: buildDistribution(selectedDeck, getSubcategoryKey),
    subcategoryTargets: compactProportionalTargets(balanceTargets.subcategoryTargets),
    eligibleThemeDistribution: balanceTargets.themeDistribution || buildDistribution(candidates, getThemeKey),
    selectedThemeDistribution: buildDistribution(selectedDeck, getThemeKey),
    themeTargets: compactProportionalTargets(balanceTargets.themeTargets),
    eligibleYearBandDistribution: balanceTargets.yearBandDistribution || buildDistribution(candidates, getYearBandKey),
    selectedYearBandDistribution: buildDistribution(selectedDeck, getYearBandKey),
    yearBandTargets: compactProportionalTargets(balanceTargets.yearBandTargets),
    eligibleDecadeDistribution: balanceTargets.decadeDistribution || buildDistribution(candidates, getDecadeKey),
    selectedDecadeDistribution: buildDistribution(selectedDeck, getDecadeKey),
  };
}

function buildCategoryPreferenceDiagnostics(candidates = [], selectedDeck = [], preferenceContext = {}) {
  const selectedCategoryCandidateCount = (candidates || [])
    .filter((question) => isQuestionInUserSelectedCategory(question, preferenceContext)).length;
  const selectedCategoryCandidateYears = new Set((candidates || [])
    .filter((question) => isQuestionInUserSelectedCategory(question, preferenceContext))
    .map((question) => Number(question?.year))
    .filter(Number.isFinite)).size;
  const selectedCategoryActualCount = countPreferredCategoryCards(selectedDeck, preferenceContext);
  const globalActualCount = Math.max(0, selectedDeck.length - selectedCategoryActualCount);
  const globalDifficulty1ActualCount = countGlobalDifficultyTargetCards(selectedDeck, preferenceContext);
  const globalFallbackFillCount = Math.max(0, globalActualCount - globalDifficulty1ActualCount);
  const selectedCategoryDifficultyDistribution = buildDistribution(
    selectedDeck.filter((question) => isQuestionInUserSelectedCategory(question, preferenceContext)),
    getDifficultyKey,
  );
  const globalDifficultyDistribution = buildDistribution(
    selectedDeck.filter((question) => !isQuestionInUserSelectedCategory(question, preferenceContext)),
    getDifficultyKey,
  );
  const firstFivePreferenceCount = countPreferredCategoryCards(
    selectedDeck.slice(0, FIRST_FIVE_SPACING_TARGET_COUNT),
    preferenceContext,
  );
  const targetCount = Number(preferenceContext.selectedCategoryTargetCount) || 0;
  const shortage = preferenceContext.enabled
    && selectedCategoryCandidateYears < targetCount;
  const ratioActual = selectedDeck.length ? selectedCategoryActualCount / selectedDeck.length : 0;
  const fallbackReason = preferenceContext.fallbackReason
    || (shortage ? 'selected_category_shortage_filled_from_global_pool' : null)
    || (preferenceContext.enabled && selectedCategoryActualCount < targetCount ? 'hard_rules_or_spacing_prevented_exact_ratio' : null);

  return {
    strategy: 'solo_user_category_preference_70_selected_30_global_soft_target_v1',
    softTargetOnly: true,
    hardFilterToSelectedCategories: false,
    userCategoryPreferenceAvailable: preferenceContext.userCategoryPreferenceAvailable !== false,
    preferenceWeightingEnabled: Boolean(preferenceContext.enabled),
    selectedCategoryIdsCount: preferenceContext.selectedCategoryIdsCount || 0,
    minimumValidCategoryPreferenceCount: preferenceContext.minimumValidCategoryPreferenceCount || USER_CATEGORY_PREFERENCE_MIN_VALID_COUNT,
    selectedCategoryTargetCount: preferenceContext.selectedCategoryTargetCount || 0,
    globalTargetCount: preferenceContext.globalTargetCount || 0,
    globalDifficultyTarget: preferenceContext.globalDifficultyTarget || USER_CATEGORY_GLOBAL_DIFFICULTY_TARGET,
    globalDifficultyTargetLabel: preferenceContext.globalDifficultyTargetLabel || `difficulty:${USER_CATEGORY_GLOBAL_DIFFICULTY_TARGET}`,
    globalDifficulty1CandidateCount: preferenceContext.globalDifficulty1CandidateCount || 0,
    globalDifficulty1CandidateYears: preferenceContext.globalDifficulty1CandidateYears || 0,
    globalDifficulty1TargetCount: preferenceContext.globalDifficulty1TargetCount || 0,
    globalDifficulty1ActualCount,
    globalFallbackFillCount,
    broaderGlobalFallbackUsed: Boolean(preferenceContext.enabled && globalFallbackFillCount > 0),
    globalFallbackUsed: Boolean(
      preferenceContext.globalDifficultyFallbackExpected
      || (preferenceContext.enabled && globalDifficulty1ActualCount < (preferenceContext.globalDifficulty1TargetCount || 0)),
    ),
    globalFallbackReason: preferenceContext.globalDifficultyFallbackReason
      || (preferenceContext.enabled && globalDifficulty1ActualCount < (preferenceContext.globalDifficulty1TargetCount || 0)
        ? 'hard_rules_or_spacing_prevented_exact_global_difficulty_1_target'
        : null),
    selectedCategoryDifficultyRule: preferenceContext.selectedCategoryDifficultyRule || USER_CATEGORY_SELECTED_LANE_DIFFICULTY_RULE,
    selectedCategoryDifficultyAllowedValues: preferenceContext.selectedCategoryDifficultyAllowedValues || Array.from(USER_CATEGORY_SELECTED_LANE_DIFFICULTIES),
    selectedCategoryDifficultyUnrestricted: false,
    globalDifficultyRuleAppliesOnlyToGlobal30: preferenceContext.globalDifficultyRuleAppliesOnlyToGlobal30 !== false,
    globalLaneDifficultyRule: preferenceContext.globalLaneDifficultyRule || USER_CATEGORY_GLOBAL_LANE_DIFFICULTY_RULE,
    globalPoolHardFilteredToSelectedCategories: false,
    fullEligibleCandidateCategoryDistribution: preferenceContext.fullEligibleCandidateCategoryDistribution || buildDistribution(candidates, getCategoryKey),
    selectedLaneCandidateCategoryDistribution: preferenceContext.selectedLaneCandidateCategoryDistribution || {},
    globalLaneCandidateCategoryDistribution: preferenceContext.globalLaneCandidateCategoryDistribution || {},
    nonSelectedCandidateCategoryDistribution: preferenceContext.nonSelectedCandidateCategoryDistribution || {},
    fullEligibleDifficulty1CandidateCount: preferenceContext.fullEligibleDifficulty1CandidateCount || 0,
    fullEligibleDifficulty1CandidateYears: preferenceContext.fullEligibleDifficulty1CandidateYears || 0,
    fullEligibleDifficulty1CandidateCategoryDistribution: preferenceContext.fullEligibleDifficulty1CandidateCategoryDistribution || {},
    globalDifficulty1CandidateCategoryDistribution: preferenceContext.globalDifficulty1CandidateCategoryDistribution || {},
    selectedCategoryActualCount,
    globalActualCount,
    selectedCategoryCandidateCount,
    selectedCategoryCandidateYears,
    fullEligibleCandidateCount: candidates.length,
    fallbackUsed: Boolean(preferenceContext.fallbackUsed || shortage || (preferenceContext.enabled && selectedCategoryActualCount < targetCount)),
    fallbackReason,
    preferenceRatioTarget: preferenceContext.preferenceRatioTarget || '70/30',
    preferenceRatioActual: {
      selectedCategoryShare: Number(ratioActual.toFixed(4)),
      globalShare: Number((1 - ratioActual).toFixed(4)),
    },
    firstFivePreferenceCount,
    deckDifficultyDistribution: buildDistribution(selectedDeck, getDifficultyKey),
    firstFiveDifficultyDistribution: buildDistribution(
      selectedDeck.slice(0, FIRST_FIVE_SPACING_TARGET_COUNT),
      getDifficultyKey,
    ),
    selectedCategoryDifficultyDistribution,
    globalDifficultyDistribution,
    deckCategoryDistribution: buildDistribution(selectedDeck, getCategoryKey),
    kartDegistirReservePreferenceAware: true,
    noBackendFetchMidAttempt: true,
  };
}

/**
 * buildSoloAttemptDeck — Public entry point.
 *
 * @param {Object} args
 * @param {Array}  args.pool                  Normalized question pool
 *                                            (questionRuntimeAdapter shape).
 * @param {Iterable<number|string|Object>=} args.allowedMainCategoryIds
 *                                            main_category_id / category_id
 *                                            whitelist (active categories),
 *                                            normalized before comparison.
 *                                            Omit / empty → no category gate.
 * @param {boolean=} args.requireActiveCategoryWhitelist
 *                                            When true, empty/missing active
 *                                            category metadata clean-fails
 *                                            instead of building from a stale
 *                                            broad pool.
 * @param {Iterable<string|number>=} args.recentlySeenQuestionIds
 *                                            Question ids the user has
 *                                            recently seen (cross-attempt).
 * @param {Map|Object|Array=} args.questionExposureStats
 *                                            Optional global/local
 *                                            shown-count/last-shown stats
 *                                            for secondary cooldown scoring.
 * @param {Map|Object|Array=} args.playerQuestionExposureStats
 *                                            Per-player PlayerQuestionExposure
 *                                            stats. These dominate freshness:
 *                                            unseen first, then lower shown
 *                                            count, then older last_shown_at.
 * @param {Iterable<number|string|Object>=} args.userSelectedCategoryIds
 *                                            Active valid current-user
 *                                            Category preference IDs. When
 *                                            at least 3 are present, Solo
 *                                            softly targets 70% preferred
 *                                            categories and 30% global pool.
 * @param {boolean=} args.userCategoryPreferenceAvailable
 *                                            False means preference read
 *                                            failed/unavailable; engine falls
 *                                            back to global Solo selection.
 * @param {number=} args.deckSize             Defaults from the Solo rules:
 *                                            normal 18, special 21. Engine
 *                                            does not relax this; passed in
 *                                            only for tests.
 * @param {number=} args.seedCount            Visible seed/preplaced timeline
 *                                            cards that should stay spaced
 *                                            from the first five active
 *                                            player cards. Defaults to 2.
 * @param {Function=} args.random             Random source (0..1). Defaults
 *                                            to Math.random.
 * @param {number=} args.levelNumber          Solo level number. All Solo
 *                                            attempts enforce the first-five
 *                                            5-year spacing rule.
 *
 * @returns {{ ok:true, deck:Array, attemptId:string, meta:Object }
 *         | { ok:false, reason:string, message:string, meta:Object }}
 *   On success, `deck` contains exactly `deckSize` questions with unique
 *   ids AND unique years, all from active categories (per the caller's
 *   whitelist) and active questions. On failure, `message` is a Turkish
 *   user-safe string the UI may render directly.
 */
export function buildSoloAttemptDeck(args = {}) {
  const deckSize = Number.isFinite(args.deckSize)
    ? Math.trunc(args.deckSize)
    : getSoloAttemptDeckSizeForLevel(args.levelNumber);
  const requestedSeedCount = Number(args.seedCount);
  const seedCount = Math.max(0, Math.trunc(Number.isFinite(requestedSeedCount) ? requestedSeedCount : DEFAULT_VISIBLE_SEED_COUNT));
  const random = typeof args.random === 'function' ? args.random : Math.random;
  const allowedCats = normalizeAllowedCategoryIds(args.allowedMainCategoryIds);
  const recentIds = normalizeRecentIds(args.recentlySeenQuestionIds);
  const recentRanks = normalizeRecentIdRanks(args.recentlySeenQuestionIds);
  const playerExposureStats = normalizeQuestionExposureStats(args.playerQuestionExposureStats);
  const globalExposureStats = normalizeQuestionExposureStats(args.globalQuestionExposureStats ?? args.questionExposureStats);
  const exposureStats = globalExposureStats;

  if (args.requireActiveCategoryWhitelist === true && (!allowedCats || allowedCats.size === 0)) {
    return {
      ok: false,
      reason: 'missing_active_category_whitelist',
      message: 'Aktif kategori bilgisi alınamadı. Lütfen tekrar dene.',
      meta: { deckSize, seedCount },
    };
  }

  const baseCandidates = filterCandidatePool(args.pool, allowedCats);
  const basePreferenceContext = buildUserCategoryPreferenceContext(args, deckSize);
  const candidates = filterPreferenceLaneCandidatePool(baseCandidates, basePreferenceContext);
  const distinctYears = new Set(candidates.map((q) => Number(q.year))).size;
  const years = Array.from(new Set(candidates.map((q) => Number(q.year)).filter(Number.isFinite)));
  const earlyVisibleTargetCount = Math.min(deckSize, FIRST_FIVE_SPACING_TARGET_COUNT + seedCount);
  const firstFiveSpacingPossible = canPickSpacedYears(years, earlyVisibleTargetCount);
  const preferenceContext = enrichPreferenceContextForGlobalDifficulty(
    basePreferenceContext,
    candidates,
  );

  if (distinctYears >= deckSize && !firstFiveSpacingPossible) {
    return {
      ok: false,
      reason: 'insufficient_first_five_spacing',
      message: 'Bu seviye için ilk 5 kart arasında en az 5 yıl aralığı sağlayacak yeterli soru yok.',
      meta: { candidateCount: candidates.length, distinctYears, deckSize, seedCount },
    };
  }

  const balanceTargets = makeBalanceTargets(candidates, deckSize);
  let fallbackTier = 'ideal';

  // Tier 1 — ideal: balances category/subcategory/theme/decade and keeps
  // recently-seen questions as a soft penalty rather than a hard blocker.
  let deck = selectUniqueYearDeck({
    candidates,
    deckSize,
      recentIds,
      recentRanks,
      exposureStats,
      playerExposureStats,
      globalExposureStats,
    preferenceContext,
    random,
    balanceTargets,
    levelNumber: args.levelNumber,
    earlyVisibleTargetCount,
  });

  // Tier 2 — relax recently-seen.
  if (!deck) {
    fallbackTier = 'recently_seen_relaxed';
    deck = selectUniqueYearDeck({
      candidates, deckSize,
      recentIds: new Set(),
      recentRanks: new Map(),
      exposureStats,
      playerExposureStats,
      globalExposureStats,
      preferenceContext,
      random,
      balanceTargets,
      levelNumber: args.levelNumber,
      earlyVisibleTargetCount,
    });
  }

  // Tier 3 — relax balance scoring. Hard rules are still enforced by the
  // candidate pool, unique-year selector, and final ordering checks.
  if (!deck) {
    fallbackTier = 'balance_relaxed';
    deck = selectUniqueYearDeck({
      candidates, deckSize,
      recentIds: new Set(),
      recentRanks: new Map(),
      exposureStats,
      playerExposureStats,
      globalExposureStats,
      preferenceContext,
      random,
      balanceTargets: {
        categoryCap: deckSize,
        subcategoryCap: deckSize,
        themeCap: deckSize,
        decadeCap: deckSize,
        categoryCount: balanceTargets.categoryCount,
        subcategoryCount: balanceTargets.subcategoryCount,
        themeCount: balanceTargets.themeCount,
        decadeCount: balanceTargets.decadeCount,
      },
      levelNumber: args.levelNumber,
      earlyVisibleTargetCount,
    });
  }

  if (!deck) {
    return {
      ok: false,
      reason: 'insufficient_unique_years',
      message: 'Bu seviye için yeterli sayıda farklı yıla ait soru bulunamadı.',
      meta: { candidateCount: candidates.length, distinctYears, deckSize },
    };
  }

  // Final order: the first 5 playable questions must be at least 5 years
  // apart. If a selected deck somehow cannot be ordered that way, fail
  // cleanly instead of starting an invalid attempt.
  const beginnerSpacing = getBeginnerYearSpacingForLevel(args.levelNumber);
  const finalDeck = orderDeckForBeginnerSpacing(deck, args.levelNumber, random, {
    seedCount,
    balanceTargets,
    recentIds,
    recentRanks,
    exposureStats,
    playerExposureStats,
    globalExposureStats,
    preferenceContext,
  });
  if (!finalDeck) {
    return {
      ok: false,
      reason: 'insufficient_first_five_spacing',
      message: 'Bu seviye için ilk 5 kart arasında en az 5 yıl aralığı sağlayacak yeterli soru yok.',
      meta: { candidateCount: candidates.length, distinctYears, deckSize, seedCount },
    };
  }
  const firstFiveCards = finalDeck.slice(0, FIRST_FIVE_SPACING_TARGET_COUNT);
  const firstSevenCards = finalDeck.slice(0, FIRST_SEVEN_BALANCE_TARGET_COUNT);
  const visibleSeedCards = seedCount > 0 ? finalDeck.slice(-seedCount) : [];
  const earlyVisibleCards = [...firstFiveCards, ...visibleSeedCards];
  const categoryDistribution = buildDistribution(finalDeck, getCategoryKey);
  const subcategoryDistribution = buildDistribution(finalDeck, getSubcategoryKey);
  const themeDistribution = buildDistribution(finalDeck, getThemeKey);
  const decadeDistribution = buildDistribution(finalDeck, getDecadeKey);
  const yearBandDistribution = buildDistribution(finalDeck, getYearBandKey);
  const firstFiveCategoryDistribution = buildDistribution(firstFiveCards, getCategoryKey);
  const firstFiveSubcategoryDistribution = buildDistribution(firstFiveCards, getSubcategoryKey);
  const firstFiveThemeDistribution = buildDistribution(firstFiveCards, getThemeKey);
  const firstSevenCategoryDistribution = buildDistribution(firstSevenCards, getCategoryKey);
  const firstSevenSubcategoryDistribution = buildDistribution(firstSevenCards, getSubcategoryKey);
  const firstSevenThemeDistribution = buildDistribution(firstSevenCards, getThemeKey);
  const exposureFairness = buildExposureDiagnostics(candidates, finalDeck, recentIds, playerExposureStats.size ? playerExposureStats : exposureStats, recentRanks);
  const diversityFairness = buildDiversityDiagnostics(candidates, finalDeck, balanceTargets);
  const categoryPreferenceFairness = buildCategoryPreferenceDiagnostics(candidates, finalDeck, preferenceContext);
  return {
    ok: true,
    deck: finalDeck,
    attemptId: `solo_${Date.now()}_${Math.floor(random() * 1e9).toString(36)}`,
    meta: {
      candidateCount: candidates.length,
      distinctYears,
      deckSize,
      seedCount,
      levelNumber: Math.max(1, Math.trunc(Number(args.levelNumber) || 1)),
      levelType: isSoloSpecialLevel(args.levelNumber) ? 'special' : 'normal',
      categoriesUsed: new Set(
        finalDeck
          .map((q) => Number(q?.main_category_id))
          .filter((n) => Number.isFinite(n)),
      ).size,
      fallbackTier,
      categoryDistribution,
      subcategoryDistribution,
      themeDistribution,
      decadeDistribution,
      yearBandDistribution,
      firstFiveCategoryDistribution,
      firstFiveSubcategoryDistribution,
      firstFiveThemeDistribution,
      firstSevenCategoryDistribution,
      firstSevenSubcategoryDistribution,
      firstSevenThemeDistribution,
      firstFiveSportsClusterCount: firstFiveCards.filter((q) => getSportsClusterKey(q) === 'sports').length,
      firstSevenSportsClusterCount: firstSevenCards.filter((q) => getSportsClusterKey(q) === 'sports').length,
      exposureFairness,
      playerExposureAwareSelection: playerExposureStats.size > 0,
      playerExposureStatsCount: playerExposureStats.size,
      exposurePriority: [
        'unseen_by_this_player',
        'lower_player_shown_count',
        'older_player_last_shown_at',
        'global_metrics_secondary',
        'stable_randomization',
      ],
      diversityFairness,
      categoryPreferenceFairness,
      maxCategoryCount: getMaxDistributionCount(categoryDistribution),
      maxSubcategoryCount: getMaxDistributionCount(subcategoryDistribution),
      maxThemeCount: getMaxDistributionCount(themeDistribution),
      maxDecadeCount: getMaxDistributionCount(decadeDistribution),
      maxYearBandCount: getMaxDistributionCount(yearBandDistribution),
      maxFirstSevenCategoryCount: getMaxDistributionCount(firstSevenCategoryDistribution),
      maxFirstSevenSubcategoryCount: getMaxDistributionCount(firstSevenSubcategoryDistribution),
      maxConsecutiveCategoryCount: getMaxConsecutiveCount(finalDeck, getCategoryKey),
      maxConsecutiveSubcategoryCount: getMaxConsecutiveCount(finalDeck, getSubcategoryKey),
      maxConsecutiveThemeCount: getMaxConsecutiveCount(finalDeck, getThemeKey),
      maxConsecutiveDecadeCount: getMaxConsecutiveCount(finalDeck, getDecadeKey),
      earlyVisibleYears: earlyVisibleCards.map((q) => Number(q?.year)).filter(Number.isFinite),
      earlyVisibleMinimumGapOk: hasMinimumYearGap(earlyVisibleCards.map((q) => Number(q?.year)), FIRST_FIVE_MIN_YEAR_GAP),
      beginnerYearSpacing: beginnerSpacing
        ? {
          levelNumber: Math.trunc(Number(args.levelNumber) || 0),
          idealGap: beginnerSpacing.idealGap,
          minGap: beginnerSpacing.minGap,
          targetCount: beginnerSpacing.targetCount,
          hard: true,
        }
        : null,
      categoryBalance: {
        categoryCount: balanceTargets.categoryCount,
        maxCategorySoftCap: balanceTargets.categoryCap,
        poolProportional: true,
        equalCountBalancing: false,
      },
      subcategoryBalance: {
        subcategoryCount: balanceTargets.subcategoryCount,
        maxSubcategorySoftCap: balanceTargets.subcategoryCap,
        poolProportional: true,
        equalCountBalancing: false,
      },
      themeBalance: {
        themeCount: balanceTargets.themeCount,
        maxThemeSoftCap: balanceTargets.themeCap,
        poolProportional: true,
      },
      eraSpread: {
        decadeCount: balanceTargets.decadeCount,
        yearBandCount: balanceTargets.yearBandCount,
        maxDecadeSoftCap: balanceTargets.decadeCap,
        maxYearBandSoftCap: balanceTargets.yearBandCap,
        poolProportional: true,
      },
    },
  };
}

// Internal exports for the Health suite — kept on the named export
// surface so tests can call them without re-implementing rules.
export const __soloEngineInternals = {
  filterCandidatePool,
  isActiveQuestion,
  isInAllowedCategory,
  hasUsableYear,
  hasUsableContent,
  getBeginnerYearSpacingForLevel,
  shouldShowBeginnerPlacementHint,
  canPickSpacedYears,
  orderYearsForEraSpread,
  getCategoryKey,
  getSubcategoryKey,
  getThemeKey,
  getDecadeKey,
  getYearBandKey,
  getSoloDeckDiagnostics,
  analyzeSoloQuestionPool,
  getSoloDifficultyStrategy,
  getSoloReplayVarietyDiagnostics,
  getKartDegistirDiagnostics,
  getSoloCategoryPreferenceTargetCounts,
  DEFAULT_DECK_SIZE,
};
