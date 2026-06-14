// Runtime mirrors of the Package 2 docs and out-of-/src backend sources.
//
// Vite's `?raw` import cannot reach outside of `src/` on this host (importing
// from `docs/`, `base44/entities`, or `base44/functions` breaks the build with
// "Failed to parse source for import analysis ... .md?raw / .ts?raw"). These
// JS string mirrors keep the Health Center static contracts inside /src so they
// never break the build. Keep them in sync with the canonical files.

// ─── Docs ──────────────────────────────────────────────────────────────
export const SOLO_QUESTION_ENGINE_DOC = `# Kronox Solo Question Engine

Normal Solo levels use a 16-question deck with 16 unique years and need 7 correct
timeline cards, including seed cards already on the timeline, to pass.
Special Solo levels start at level 10, repeat every 5 levels, use a 19-question deck
with 19 unique years, and need 10 correct timeline cards, including seed
cards already on the timeline, to pass. All new Solo attempts use 180
seconds and fail on 10 mistakes; the 10th mistake ends the attempt.
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
Daily Wheel reward table is \`30 high weight 24\`, \`40 high weight 22\`,
\`50 high weight 20\`, \`60 medium weight 12\`, \`75 medium weight 10\`,
\`100 low weight 7\`, \`150 rare weight 4\`, \`250 very_rare weight 1\`.
Daily Wheel UI animates to the backend-selected reward.
Daily Wheel result shows \`+X Elmas kazandın\`; when the 7-day streak bonus
applies it also shows \`7 günlük seri bonusu: +150 elmas\` and
\`Toplam: +Y elmas\`.
Günlük Ödüller panel contains Daily Wheel plus one Günlük Görev for active
Daily Quest Runtime v1. DailyQuestDefinition remains admin-managed, while
UserDailyQuestProgress tracks 1 selected UTC-day quest per user. Progress is
Solo-only in v1 and claimDailyQuestReward grants diamonds only through
DiamondTransaction.source = daily_quest_reward. Daily Quest does not grant
Kronox Puan and has no leaderboard impact. Home copy says "Günlük Görevleri Yap,
Elmasları Kazan!" and runtime backend functions explicitly bind
UserDailyQuestProgress. One claim per quest per UTC day is enforced by
UserDailyQuestProgress plus daily_quest_reward idempotency keys.
Günlük Görev requires active DailyQuestDefinition rows; fresh DBs seed the
default Solo-focused definitions idempotently when no definitions exist.
DailyQuestDefinition.quest_key is the logical unique key; duplicate rows are
grouped by quest_key, Admin UI warns instead of auto-deleting, and runtime
selects one canonical active definition before choosing the first logical
Daily Quest. getDailyQuestStatus preserves newly created rows if immediate
refresh is stale; loading today’s quests does not grant Diamonds.
Daily Wheel claimed countdown shows \`Yarın hazır\` or compact time text
without a Diamond icon.
Admin reset sets \`daily_wheel_last_spin_date\` to the current UTC day, clears Daily Wheel guard fields, and removes target \`DailyWheelSpin\` rows. Retained OnlineMatchResult/DiamondTransaction/DailyWheelSpin rows no longer contain the deleted user.
Admin reset remains admin-only, previewed, confirmed, and logged; it prevents stale Daily Wheel availability/countdown state without granting duplicate Diamonds, changing Kronox Puan, or affecting leaderboard sorting or rank.
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

## Mağaza Phase 1 Manual Proof
Home shows Mağaza top-left, Diamonds center, notifications right. Mağaza title
is Mağaza and prices are Zaman Dondur 40, Kart Değiştir 50, Kronokalkan 60.
Client is not trusted for price; purchase validation is server-authoritative.
Successful purchases write both \`DiamondTransaction\` and \`JokerTransaction\`
with market_purchase and the same idempotency key. Runtime explicitly binds
UserJokerInventory, DiamondTransaction, and JokerTransaction. Double-tap, network retry,
insufficient Diamonds, and two tabs/devices proof remains manual. Market
purchase is a Diamond sink; Daily Wheel remains a Diamond source. Profile
Joker Çantası and Solo joker bar must show the purchased balance through the
shared getUserJokerBalances path. Complete UserJokerInventory rows use a fast
current-balance read, ensureUserJokerInventory runs only for missing/partial
rows or explicit retry, Profile does not scan JokerTransaction to render
balances, and Mağaza purchase/Solo spend update or invalidate the shared cache.
Online mode is unaffected and Daily Wheel remains Diamond-only.
`;

// ─── Out-of-/src backend sources (token mirrors) ───────────────────────
export const startLobbyGameSource = `
  // Mirror of base44/functions/startLobbyGame/entry.ts — token contract.
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
  function isActiveQuestion(q) { return String(q?.state || 'A') === 'A'; }
  const hasSelectedCategoryIds = Array.isArray(selectedCategoryIds) && selectedCategoryIds.length > 0;
  if (!hasSelectedCategoryIds) return [];
  // No all-category last-resort fallback exists here.
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
  const projected = toProjectionLeaderboardRow(rows[0]);
  const topRows = rows.slice(0, 10);
  const currentUserRank = projected?.rank || null;
  const friendUserKeys = await loadAcceptedFriendOwnerKeys(base44, user.email);
  const rankConfidence = currentUserRank ? 'window_exact' : 'projection_row_found_rank_outside_window';
  const rankScope = currentUserRank ? 'top_projection_window' : 'outside_top_projection_window';
  // solo_leaderboard_entry_total_kronox_score_projection — persisted public read model.
  // compact response: topRows, currentUserRow, currentUserRank, friendUserKeys, rankConfidence, rankScope.
  // User.list fallback is reserved only for optional per-level record lookup.
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
