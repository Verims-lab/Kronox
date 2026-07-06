// Runtime mirrors of the Package 2 docs and out-of-/src backend sources.
//
// Vite's `?raw` import cannot reach outside of `src/` on this host (importing
// from `docs/`, `base44/entities`, or `base44/functions` breaks the build with
// "Failed to parse source for import analysis ... .md?raw / .ts?raw"). These
// JS string mirrors keep the Health Center static contracts inside /src so they
// never break the build. Keep them in sync with the canonical files.

// ─── Docs ──────────────────────────────────────────────────────────────
export const SOLO_QUESTION_ENGINE_DOC = `# Kronox Solo Question Engine

Normal Solo levels use an 18-question deck with 18 unique years and need 7 correct
timeline cards, including seed cards already on the timeline, to pass.
Special Solo levels start at level 5, repeat every 5 levels, use a 21-question deck
with 21 unique years, and need 10 correct timeline cards, including seed
cards already on the timeline, to pass. Normal attempts use 10 evaluated moves;
special attempts use 13 evaluated moves. All new Solo attempts use 180
seconds and fail when their level-specific evaluated move limit is used before
the target card count is reached. Live Solo shows HAMLE / remaining moves, not HATA.
Only active questions (Question.state === "A") from active categories are used.
Replay rebuilds the deck with no mid-attempt re-randomization. Runtime consumes
the deck in order: the first active player question card is soloAttemptDeck[0].
Seed/preplaced cards do not count as the first 5 active player question cards.
They still avoid close-year conflicts with those early active cards.
Visible placed/seed timeline years and the current active card avoid 1-4 year
conflicts such as 1996/1997, 1998/1999, and 1913/1914 where a safe
prebuilt-deck alternative exists.
Fallback may relax category/subcategory balance, era spread, or recently-seen
filtering but never allows duplicate years or invalid first 5 ordered questions
spacing. The first 5 ordered questions are the first 5 displayed active player
question cards. The P0 first-five guardrail avoids more than 2 same-subcategory
or obvious sports-cluster cards when metadata and alternatives allow. Missing,
null, non-numeric, or approximate years are invalid.
P1 balance distributes rich-pool decks across categories, subcategories,
themes, and decades; first 7 active cards avoid 4+ same category/subcategory
or theme where alternatives exist. Deck diagnostics expose categoryDistribution,
subcategoryDistribution, themeDistribution, decadeDistribution, firstSevenCategoryDistribution,
and fallbackTier for Health/admin/debug only.
P2 diagnostics are Health/admin/helper-only and cover deck quality, question
pool health, difficulty-readiness, replay-variety, and Kart Değiştir
replacement diagnostics without exposing debug output to normal players.
Repeat avoidance is currently local/per-device soft weighting. Server-side
per-user/global exposure balancing, low-correct cooldown, and global
underexposure boosts are future approved algorithm work, not hidden runtime
behavior.
`;

export const CATEGORY_TAXONOMY_DOC = `# Kronox Category Taxonomy

CATEGORY_ID_FIELD is category_id — the single canonical live field.
CATEGORY_IMPORT_ALIAS_FIELD is categoryid, used only during import
normalization: categoryid -> category_id.
Do not create competing live DB fields.
Questions reference category_id via main/second/third category fields.
`;

export const RELEASE_PROOF_CHECKLIST_DOC = `# Kronox Release Proof Checklist

## Online Scoring Persistence
Two-account invite + scoring proof, OnlineMatchResult idempotency.

## Solo Replay Persistence
Replay does not duplicate Solo points; same-score and lower-score replays add +0.

## RLS And Backend Security
Two/three-account RLS probe matrix, service-role scoping.

## Diamond Economy / Daily Wheel
Daily Wheel is separate from the existing +20 daily login reward.
First authenticated entry grants +100 once. Same-day daily login grants +20 once.
Daily Wheel reward is selected server-side by \`claimDailyWheelReward\`.
Daily Wheel V2 reward table is \`diamond_20 weight 28\`,
\`diamond_60 weight 20\`, \`diamond_100 weight 15\`,
\`joker_krono_kalkan weight 12\`, \`joker_zamani_dondur weight 10\`,
\`joker_kart_degistir weight 8\`, \`gift_box weight 5\`,
\`diamond_250 weight 2\`.
Daily Wheel UI shows 8 equal visual segments and animates to the
backend-selected \`reward_segment_index\`. Gift Box contents are selected
server-side, stored on \`DailyWheelSpin\`, and returned idempotently on
same-day refresh/retry.
DiamondTransaction.idempotency_key has function-level pre-check and
post-create confirmation; no repo DB/entity unique proof exists unless
Base44/platform configuration is attached.
Daily Wheel same-day duplicate prevention uses DailyWheelSpin key/date lookup,
reserve-first spin rows, canonical same-player/same-day re-read,
User/GuestProfile guard re-check, and DiamondTransaction re-check before
balance mutation. No repo
DB/entity unique proof exists for DailyWheelSpin.idempotency_key or
DailyWheelSpin.user_email + spin_date unless Base44/platform configuration is
attached.
DB/entity unique plus code guard is Low risk; code guard only is Medium/P1
hardening; neither is High. Remaining parallel race risk stays manual proof.
Daily Wheel result reflects the server reward with the simplified post-spin UI:
wheel visible, one backend-selected reward line, and one disabled ad/video
\`ÇEVİR\` repeat CTA with smaller \`Yakında\` subtext. Old total/streak/retry
explanatory result copy is not shown, and no fake ad reward flow is active
before future rewarded-ad integration.
Available free spin auto-open and manual Home \`Çark\` tap both use the full
Daily Wheel modal; the old compact \`Çark\` / \`Günlük Çark\` / \`Hazır!\` mini
card is not part of the Home Daily Wheel flow.
Closing a completed Daily Wheel result closes the wheel modal and returns
directly to Home; the old \`Çark\` / \`Günlük Çark\` claimed/cooldown sheet must
not appear behind it, and no hidden overlay may block Home buttons. Already-
claimed Home \`Çark\` taps reopen the read-only post-win result screen from the
stored backend reward payload, or a safe \`Bugünkü ödül alındı\` fallback for
legacy missing-payload data; no new spin, reward, or fake ad path is triggered.
Home exposes Daily Wheel through the Çark shortcut and the Daily Calendar /
Streak through the Home GÜNLÜK shortcut. Daily Calendar / Streak is opened at
/daily, is not a BottomNav item, creates 3 daily_calendar:* tasks per UTC
server day from a 9-day rotating task template cycle, and advances only through
real/idempotent events. claimDailyQuestReward grants only the 7-day Gift Box
through DiamondTransaction.source = daily_calendar_streak_reward for exactly
200 Diamonds. Daily Calendar does not grant Kronox Puan and does not affect
Leaderboard.
Runtime ignores stale/duplicate DailyQuestDefinition rows and does not seed
definition rows on app/Home open. cleanupLegacyDailyQuests is admin-gated,
defaults to dry_run, requires DELETE_LEGACY_DAILY_QUESTS for destructive
deletion, and must not touch Daily Wheel, economy, profile, Solo, Online,
Leaderboard, Store, Friends, or account data. Loading today’s tasks does not grant
Diamonds.
Claimed Home \`Çark\` opens the read-only result screen, not a countdown
mini-card; any embedded legacy launcher countdown outside the current Home flow
must remain plain text without a Diamond icon.
Admin reset sets \`daily_wheel_last_spin_date\` to the current UTC day, clears Daily Wheel guard fields, and removes target \`DailyWheelSpin\` rows. Retained OnlineMatchResult/DiamondTransaction/DailyWheelSpin rows no longer contain the deleted user.
Admin reset remains admin-only, previewed, confirmed, and logged; it prevents stale Daily Wheel availability/countdown state without granting duplicate Diamonds, changing Kronox Puan, or affecting leaderboard sorting or rank.
Admin-only \`Günlük Çark Reset\` appears only on Admin Ekranı, accepts Kronox User ID, calls \`/adminResetDailyWheelState\`, returns 401/403 for unauthenticated or non-admin callers, resets today's Daily Wheel test state only, archives same-day DailyWheelSpin/DiamondTransaction/JokerTransaction idempotency keys to preserve completed reward rows, and does not grant rewards, reverse awarded Diamonds/Jokers, reset Daily Quest, change Kronox Puan, or affect leaderboard.
Retained economy/gameplay rows do not expose the deleted user identity.
Runtime Solo QuestionAttemptEvent writes are best-effort for shown, answered,
swapped-out, and replacement-shown events and must never block drag/drop,
scoring, or result flow. sendQuestionAnalyticsReportEmail sends the manual
admin question analytics report to the authenticated admin email as an
HTML/table/bar formatted email with readable empty states and a plain-text
fallback; the recipient is the requesting authenticated admin's normalized
email, mismatched recipient overrides are rejected, and safe requestedBy /
recipientEmail / emailDispatchStatus diagnostics are returned. Deployed
SendEmail delivery and Gmail rendering remain manual proof. Account deletion proof includes
QuestionAttemptEvent rows so retained analytics rows no longer contain the
deleted user email/key.

PWA push, mobile safe-area, and other runtime proofs remain manual.

## Mağaza Store Manual Proof
Home shows Mağaza top-left with a gold storefront icon, Diamonds center,
notifications right. Mağaza title is Mağaza and the Store catalog shows
real-money Diamond packages (360 ELMAS — ₺79,99; 1.100 ELMAS — ₺199,99 with EN
POPÜLER; 2.400 ELMAS — ₺349,99; 6.200 ELMAS — ₺799,99; 13.000 ELMAS —
₺1.499,99 with EN İYİ DEĞER), Diamond-spend Joker packages, Diamond-spend Hint
packages, Diamond-spend Advantage packages, and future KronoClub / Reklamları
Kaldır sections. Real-money packages show safe unavailable behavior and do not
grant Diamonds until approved IAP/payment verification exists. The Home middle
section keeps left GÜNLÜK,
centered transparent hourglass, and right Çark balanced, with a content-free
mini wheel visual for the Çark shortcut, centered shortcut popups, and CTA
stack spacing balanced between the hourglass and fixed BottomNav. The primary
Home CTA is OYNA / dynamic Seviye X from the canonical Solo progress helper
and direct-starts that resolved Solo level; the secondary CTA is ONLINE KAPIŞ,
remains Home-owned, and matches the primary CTA dimensions. The Home
notification panel uses Barlow Condensed bold italic title typography and Inter
body/empty/error typography.
Client is not trusted for price; purchase validation is server-authoritative.
Successful Diamond-spend purchases write \`DiamondTransaction\` plus matching
\`JokerTransaction\` and/or \`HintTransaction\` grant ledgers with
market_purchase. Runtime explicitly binds UserJokerInventory, UserHintInventory,
DiamondTransaction, JokerTransaction, and HintTransaction. Double-tap, network
retry, insufficient Diamonds, and two tabs/devices proof remains manual. Market
purchase is a Diamond sink; Store purchases do not grant Kronox Puan and do not
affect Leaderboard. Daily Wheel V2 can be a Diamond source and approved joker grant source. Profile
Joker Çantası and Solo joker bar must show the purchased balance through the
shared getUserJokerBalances path. Complete UserJokerInventory rows use a fast
current-balance read, ensureUserJokerInventory runs only for missing/partial
rows or explicit retry, Profile does not scan JokerTransaction to render
balances, and Mağaza purchase/Solo spend update or invalidate the shared cache.
Online mode is unaffected and Daily Wheel V2 does not use Mağaza purchase semantics.
`;

// ─── Out-of-/src backend sources (token mirrors) ───────────────────────
export const startLobbyGameSource = `
  // Mirror of base44/functions/startLobbyGame/entry.ts — token contract.
  const CATEGORY_METADATA_POLICY = { sourceOfTruth: 'Category', legacyHardcodedCategoryFallbackAllowed: false };
  const ONLINE_GAME_POLICY = { categorySourceOfTruth: 'Category', selectedCategoriesOnly: true, difficultyRule: 'difficulty_1_or_2_only' };
  const user = await base44.auth.me();
  if (!user?.email) {
    return json({ error: 'Oturum gerekli.', code: 'unauthenticated' }, 401);
  }
  const actorEmail = normalizeEmail(user.email);
  const hostEmail = normalizeEmail(lobby.host_email);
  const authenticatedHost = Boolean(hostEmail && actorEmail === hostEmail);
  if (!authenticatedHost) {
    return json({ error: 'Sadece host oyunu baslatabilir.' }, 403);
  }
  const activeIds = await loadActiveMainCategoryIds();
  await base44.asServiceRole.entities.Category.list('category_id', 1000);
  function isActiveQuestion(q) { return String(q?.state || 'A') === 'A'; }
  const hasSelectedCategoryIds = Array.isArray(selectedCategoryIds) && selectedCategoryIds.length > 0;
  if (!hasSelectedCategoryIds) return [];
  // No all-category, legacy category-name, or stale hardcoded category fallback exists here.
  const ONLINE_DECK_SELECTION_SOURCE = 'online_shared_selected_category_deck_v1';
  const ONLINE_ALLOWED_DIFFICULTIES = new Set([1, 2]);
  const sharedDeck = activePool
    .filter((question) => ONLINE_ALLOWED_DIFFICULTIES.has(Number(question.difficulty)))
    .slice(0, 96);
  const updateData = {
    status: 'starting',
    online_question_deck: sharedDeck,
    online_deck_meta: {
      source: ONLINE_DECK_SELECTION_SOURCE,
      selectedCategoriesOnly: true,
      soloPreferenceWeightingApplied: false,
      guestSoloPathUsed: false,
      difficultyRule: 'difficulty_1_or_2_only',
      categorySourceOfTruth: ONLINE_GAME_POLICY.categorySourceOfTruth,
      legacyHardcodedCategoryFallbackAllowed: false,
    },
  };
  if (activePool.length < needed) {
    return json({
      error: 'Seçilen kategoriler için yeterli aktif soru bulunamadı.',
      code: 'insufficient_active_questions_for_selected_categories',
    }, 422);
  }
`;

export const getSoloLeaderboardSource = `
  // Mirror of base44/functions/getSoloLeaderboard/entry.ts — token contract.
  const rows = await base44.asServiceRole.entities.SoloLeaderboardEntry.list('-total_kronox_score', 200);
  const userRepairRows = await base44.asServiceRole.entities.User.list('-kronox_puan_total', 200);
  const projected = toProjectionLeaderboardRow(rows[0]);
  const fallbackReason = findProjectionRepairReason(rows, userRepairRows, 10);
  const fallbackUsed = Boolean(fallbackReason);
  const rankedWindowRows = mergeProjectionAndUserScoreRows(rows, userRepairRows);
  const scoreSourceMismatches = scoreSourceMismatchSummary(rows, userRepairRows);
  const backfillResult = fallbackUsed ? await repairSoloLeaderboardProjection(base44, rows, userRepairRows) : { attempted: 0 };
  const positiveDecoratedRows = rankedWindowRows.filter(isPositiveScoreRow);
  const zeroDecoratedRows = rankedWindowRows.filter((row) => !isPositiveScoreRow(row));
  const topRows = [...positiveDecoratedRows, ...zeroDecoratedRows].slice(0, 10);
  const currentUserRank = projected?.rank || null;
  const friendUserKeys = await loadAcceptedFriendOwnerKeys(base44, user.email);
  const publicTopRows = toPublicLeaderboardRows(topRows);
  const publicCurrentUserRow = toPublicLeaderboardRow(currentUserRow);
  const publicFriendsOutsideTop = toPublicLeaderboardRows(friendsOutsideTop);
  const publicCompactResponseRows = toPublicLeaderboardRows(compactRows([...topRows, currentUserRow, ...friendsOutsideTop]));
  const rankConfidence = currentUserRank ? 'exact' : (fallbackUsed ? 'fallback' : 'limited');
  const rankScope = currentUserRank ? 'global' : 'projection_limited';
  // solo_leaderboard_entry_total_kronox_score_projection — internal projection source.
  // sanitized compact response: publicTopRows, publicCurrentUserRow, publicFriendsOutsideTop, publicCompactResponseRows, currentUserRank, rankConfidence, rankScope.
  // public rows use username + leaderboard_id and strip owner_key/display_name/email/provider ids.
  // User.list server-side repair is allowed for projection completeness; broadUserRowsReturned: false.
  // User.kronox_puan_total plus computed solo_progress can reconstruct zeroed scores.
  // Projection-above-user mismatches are kept for manual audit, not down-written.
  // sourceScoreRepairMode: non_destructive_positive_user_rows_only; scoreSourceMismatches.
  // projection_score_stale_above_user_score and projection_score_stale_below_user_score both trigger repair.
  // projectionRowsRead, positiveScoreRowsRead, zeroScoreRowsRead, fallbackUsed, fallbackReason, backfillResult.
  // backfillKronoxPuanProjection remains the legacy User.kronox_puan_total fill for per-level fallback rows.
  // Privacy: raw user_email is never returned in leaderboard rows.
`;

export const userEntitySource = `
  "name": "User",
  "properties": {
    "kronox_puan_total": { "description": "user_kronox_puan_total_projection" },
    "computedTotalKronoxScore": {},
    "role": { "enum": ["admin","user"] }
  }
`;
