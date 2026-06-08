// Runtime mirrors for repo-root / docs markdown consumed by the Health
// Center alignment suite.
//
// Why a JS mirror?
//   Vite's `?raw` import cannot reach outside of `src/` on this host, so
//   importing markdown directly from the repo root or `docs/` (`.md?raw`)
//   fails at build time. Mirroring the docs as JS strings keeps the Health
//   Center static-contract checks alive while the canonical docs live in
//   the repo. When you change one, change the other — the Health cases
//   cross-check required phrases against these strings.

export const CORE_PROMPT_DOC = `# KRONOX Core Prompt

Status: Active product contract.

Manual runtime proof gates remain visible and NOT_AUTOMATABLE:
- two-account invite + scoring proof
- RLS probe matrix
- push subscription on a real installed device
- destructive account deletion proof
- Android wrapper edge-to-edge and large-screen/orientation proof
- mobile safe-area proof
- real-device drag/drop proof
`;

export const KRONOX_DOC = `# Kronox

Status: Active product overview.

Kronox is a timeline placement game with Solo and Online modes, a Diamond
economy, friends/invites, leaderboard projection, and a Health Center that
keeps product contracts honest.
`;

export const SECURITY_DEPLOYMENT_DOC = `# Kronox Security & Deployment

Status: Active product contract.

- getQuestions requires auth.
- startLobbyGame requires authenticated host, no legacy guest, no client identity override.
- Service-role usage is scoped to admin/maintenance backend functions.
- VAPID private key remains a real secret and must stay secret-managed.
- Backend push config requires VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, and VAPID_SUBJECT or their KRONOX_ compatibility names.
- VAPID_PRIVATE_KEY is read from backend deployment secret/env only; scanner findings that only flag the env var name are deployment-secret management notes unless real key material is present.
- Missing, blank, whitespace-only, placeholder, empty-string, hardcoded, dummy, or VITE_ backend VAPID fallbacks are forbidden.
- VAPID private key values are never logged, returned, printed in Health, or exposed through frontend VITE_ variables.
- Missing VAPID config is reported explicitly as vapid_config_missing / missing_vapid_config and does not break in-app invite flow.
- Current source of truth for admin authorization is the private AdminUser entity.
- Shared backend guard: base44/functions/_shared/adminAuth.ts, preferred wherever the Base44 function deployment supports it.
- Base44 callable/flat functions may inline the same AdminUser-backed guard only when local shared imports are known to break deployment. This is a runtime deployability exception, not a security exception.
- Active AdminUser rows require normalized lowercase email, role: "admin" or owner, and status: "active".
- Inline guards must enforce the same normalized email, active status, and owner/admin role contract. Hardcoded admin allowlists are forbidden.
- disabled/missing AdminUser rows are denied.
- There is no unsafe "if no admin exists, everyone is admin" fallback.
- Do not commit the personal admin emails to source.
- Admin email env allowlists are not used for authorization.
- Client admin UI consumes the backend getAdminStatus status hint; /getAdminStatus is the callable status path.
- AdminUser rows remain private and are not listed by normal users.
- admin-only maintenance functions verify AdminUser-backed authorization server-side.
- account deletion is a destructive, NOT_AUTOMATABLE manual proof gate.
- UserJokerInventory stores current balances for mistake_shield, card_swap, and time_freeze.
- JokerTransaction stores the append-only joker grant/spend ledger.
- ensureUserJokerInventory grants 3 Kronokalkan, 3 Kart Değiştir, and 3 Zaman Dondur once per authenticated user using starter_jokers:<email>:<joker_type> idempotency keys.
- spendUserJoker spends one owned Solo joker using authenticated user context, positive-balance validation, reason solo_use, source solo, quantity_delta -1, and an idempotency key.
- Profile shows only Joker Çantası balances; normal users must not see other users' balances or transaction ledger rows.
- Market purchase is a later phase and must validate Diamonds server-side when added.
- sendQuestionAnalyticsReportEmail is manual/admin-triggered only and sends HTML/table/bar formatted question analytics with text fallback.
- sendQuestionAnalyticsReportEmail is callable from base44/functions/sendQuestionAnalyticsReportEmail/entry.ts with base44/functions/sendQuestionAnalyticsReportEmail/function.jsonc name sendQuestionAnalyticsReportEmail and entry entry.ts; the callable report function INLINES a DB-backed AdminUser guard (no local _shared import) so it deploys cleanly under the Base44 function runtime.

## Backend function deployability (stale-deploy incident)
- npm run build validates only the Vite frontend bundle. It does NOT prove Base44 backend functions deployed. Backend/Base44 functions may require separate deploy/publish proof.
- Function changes must be verified in the actual EXECUTED function path. Editing an unused helper or stale mirror does not change runtime behavior.
- Local proof HTML / helper output is not enough if the deployed function is stale.
- Report/admin functions must NOT use local imports that resolve outside the deployed path. The broken './_shared/adminAuth.js' pattern resolved to a file URL under /src/_shared (module not found) and broke deployment, leaving Base44 serving a stale build. The callable report function now inlines a DB-backed AdminUser guard instead.
- base44/functions/<name>/entry.ts shared imports remain allowed where proven deployable; sendQuestionAnalyticsReportEmail intentionally uses an inline guard for this runtime-sensitive path.
- Critical report/admin functions should include safe template/function markers (e.g. templateVersion static-pool-v2, REPORT_BUILD_MARKER, and bodyContains* diagnostics). If real output lacks the marker, the function deployment is stale.
- sendQuestionAnalyticsReportEmail live deploy is proven by triggering the function and reading reportBuildMarker (current: Codex282), templateVersion static-pool-v2, and bodyContainsStaticPoolSection/Template/QuestionSource = true. A published frontend that does not change reportBuildMarker means the executed backend function did not redeploy.
- A prior Codex275 marker bump was never proven deployed because the runtime function still imported the broken local _shared guard; the recovery inlined the AdminUser guard and uses current reportBuildMarker values as the unambiguous live marker.
- Function-based question analytics reset is currently not used.
- Manual DB reset path after question pool replacement clears only QuestionAttemptEvent, QuestionStatsProjection, and CategoryStatsProjection.
- Manual reset must not delete Question, Category, SubCategory, UserCategoryPreference, UserStatsProjection, UserJokerInventory, JokerTransaction, progress/economy/leaderboard data, Daily Wheel rows, users, or AdminUser.
- manual question analytics reset does not delete Question, Category, SubCategory, UserCategoryPreference, UserStatsProjection, score/progress/economy, leaderboard, Daily Wheel, users, AdminUser, or gameplay rows.
- sendQuestionAnalyticsReportEmail handles stale/deleted question references with diagnostics and bounded sections.
- sendQuestionAnalyticsReportEmail actual sent body includes Rapor Bölümleri, Sistemdeki Soru Havuzu: Kategori / Zorluk Dağılımı, Kategori Bazında Soru Havuzu, Kategori ve Zorluk Bazında Kayıtlı Soru Sayısı, Kategori Bazında Kayıtlı Soru Havuzu, Kategori Bazında Yıl Aralığı, Kategori Tercihleri, Kategori Bazında Gösterim, Kategori İçi Soru Analizi, Kategori Denge Sinyalleri, and Rapor Tamamlandı.
- sendQuestionAnalyticsReportEmail actual sent body includes Rapor Şablonu: static-pool-v2 near the top; absence of that marker in real email indicates stale/not-redeployed backend function template.
- sendQuestionAnalyticsReportEmail accepts any active AdminUser role admin/owner, sends by default to the requesting authenticated admin's normalized email, rejects mismatched recipient overrides, and returns safe requestedBy, recipientEmail, template, body-marker, and emailDispatchStatus diagnostics.
- Category preference report counts are aggregate distinct-user counts only and do not expose user IDs or emails.
- Question analytics report sections render with section-level warnings instead of truncating the whole email.
- unrelated user progress admin reset retains question analytics rows; account deletion anonymizes user-owned analytics identity.
- retained QuestionAttemptEvent analytics rows no longer contain deleted user identity after account deletion.
- UserCategoryPreference rows are user-scoped Settings data.
- normal users can read/update only their own preference rows.
- passive Category.status = P/p rows are not selectable.
- Any user with fewer than 3 active valid Category preferences sees the popup; this applies to new and existing users.
- The source of truth is active valid UserCategoryPreference count.
- Only active categories are selectable and count.
- Passive or removed Category selections are filtered from UI/save state and are not resaved as active preferences.
- completing the popup saves UserCategoryPreference rows before marking the user profile onboarding flag complete.
- Users can later change selections under Profile / Settings / İlgi Alanlarım.
- Solo question selection reads current-user active valid Category preferences before attempt start and targets 70% selected categories / 30% full eligible pool as soft weighting with fallback. The selected-category 70% lane is not difficulty-1 restricted; the global 30% lane prefers difficulty 1 from the full eligible pool where possible and safely falls back when difficulty-1 global candidates are insufficient.
- Online question selection, getQuestions, and analytics do not read preferences for question selection.
- two-account preference RLS proof remains manual/NOT_AUTOMATABLE.
- old UserSubCategoryPreference rows are retained but not used by the current Settings preference UI.
`;

export const RELEASE_PROOF_CHECKLIST_DOC = `# Kronox Release Proof Checklist

Status: Active manual release gate.

## Solo v2
Normal levels need 7 correct cards with a 16-question deck; special levels
need 10 correct cards with a 19-question deck. All attempts use a 180 seconds
timer and fail on the 10th mistake. Runtime consumes the deck in order. The
first 5 ordered active player question cards keep a minimum 5-year spacing.
Seed/preplaced timeline cards avoid close-year conflicts with those early
active cards.
Visible placed/seed timeline years and the current active card avoid 1-4 year
conflicts where a safe prebuilt-deck alternative exists.
P1 balance distributes rich-pool decks across category, subcategory, theme, and
decade buckets while keeping hard Solo rules mandatory.
P2 diagnostics are Health/admin/helper-only: deck diagnostics, question pool
health, difficulty-readiness, replay-variety, and Kart Değiştir replacement
diagnostics must not appear in normal player UI.
Runtime Solo QuestionAttemptEvent writes are best-effort and manual admin
question analytics email delivery plus Gmail rendering remains deployed/backend proof.
Same-score replay does not add points. Lower-score replay does not add points.
Better replay adds only the positive score delta. Old completed Solo results
are not retroactively recalculated.

## Online Scoring Persistence
Two-account invite + scoring proof, OnlineMatchResult idempotency.

## RLS And Backend Security
Two/three-account RLS probe matrix, service-role scoping.

## PWA / Push
Push subscription works on real installed device if supported. (manual)
sendGameInvitePush requires backend VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, and VAPID_SUBJECT.
Missing or blank VAPID config returns explicit vapid_config_missing / missing_vapid_config diagnostics.
No empty-string, dummy, hardcoded, or VITE_ private-key fallback is allowed.
VAPID_PRIVATE_KEY remains backend-env-only and is never logged or returned; env-var-name scanner findings are deployment-secret management notes unless real key material is exposed.
In-app invites remain functional if push is not configured.

## Android 15 Edge-To-Edge
Play Console reports Window.setStatusBarColor / Window.setNavigationBarColor
deprecations from the native wrapper. Upload a new AAB and verify edge-to-edge
behavior. Do not mark this complete from static Health alone.

## Android Large-Screen / Orientation / Resizability
Verify tablet, foldable, and resizable behavior in Play Console and on device.
Do not mark this complete from static Health alone.

## Settings Category Preferences
Settings shows İlgi Alanlarım for authenticated users. Active Category
rows load as selectable interests, passive rows are hidden, users must select
at least 3 Category interests. There is no maximum selection. Preferences are
persisted per user in UserCategoryPreference. Solo question selection targets
70% selected user categories and 30% full eligible pool. The selected-category
70% lane is not difficulty-1 restricted; the global 30% lane prefers
difficulty 1 where possible with safe fallback. Online question selection is
not affected. Any user with fewer than 3 active valid
Category preferences sees the popup, including new and existing users. The
source of truth is active valid UserCategoryPreference count, only active
categories are selectable and count, passive or removed Category selections are
filtered from active UI/save state, completion prevents repeat prompts only while
the user still has 3 or more active valid preferences, and Users can later change
selections under Profile / Settings / İlgi Alanlarım. SubCategory entity still exists, but Settings currently uses Category interests.
Mobile wrapping/long-name visual proof and two-account preference RLS proof
remain manual/NOT_AUTOMATABLE.
`;

export const CATEGORY_TAXONOMY_DOC = `# Kronox Category Taxonomy

Status: Active product contract.

category_id is the single canonical live field. Canonical categories:
Chronicle, Flashback, Kült, Viral, Arena, Level Up.
`;

export const DB_ARCHITECTURE_DOC = `# Kronox DB Architecture

Status: Implementation tracking doc.

- DB gateway modules wrap entity access.
- Analytics entities: QuestionAttemptEvent, QuestionStatsProjection,
  UserStatsProjection, CategoryStatsProjection.
- Leaderboard projection: SoloLeaderboardEntry.
- cleanup/retention jobs are status-transition-first.
- Base44 index/unique-key declarations are a platform/manual configuration gap.
- Runtime uniqueness proof remains manual/NOT_AUTOMATABLE.
- Solo QuestionAttemptEvent runtime writes are enabled best-effort; Online analytics remains deferred.
- Manual admin question analytics HTML/table/bar email report exists with no scheduled trigger.
- Manual DB reset path can reset question analytics history/projections after replacing the question pool.
- Question analytics reports handle empty analytics state and stale/deleted question IDs safely.
- Question analytics reports include category pool counts, registered category/difficulty/year-range pool detail, aggregate category preference counts, category exposure counts, within-category most/least/never-shown analysis, and category fairness signals.
- Kategori Bazında Soru Havuzu is static Question table data, not event/projection data, and includes active question count, difficulty 1-5/unknown distribution, oldest year, newest year, and Unknown/unmapped category diagnostics even when analytics tables are empty.
- Kategori ve Zorluk Bazında Kayıtlı Soru Sayısı / Kategori Bazında Kayıtlı Soru Havuzu is static active Question table data grouped by category and difficulty level with registered question count, oldest year, and newest year, including asked and never-asked active questions.
- Static Question DB pool sections appear near the top before long event detail tables; Rapor Bölümleri proves included sections and Rapor Tamamlandı at the end diagnoses clipping/truncation if missing.
- Sistemdeki Soru Havuzu: Kategori / Zorluk Dağılımı is an email-safe inline HTML/CSS stacked-bar chart sourced from active Question rows, with numeric Zorluk 1-5/Bilinmiyor counts and no JavaScript chart dependency.
- Long event-based detail sections are row-limited for email readability.
- Legacy candidates kept without deletion: Friendship, GameRecord, LobbyMessage.
- Raw Question remains protected.
- UserCategoryPreference stores app-open popup and Settings Category preferences per user; minimum 3 selections. There is no maximum selection.
- Solo question selection targets 70% selected user categories and 30% full eligible pool when at least 3 active valid preferences are available.
- This is a soft weighting target with fallback, not hard filtering. The selected-category 70% lane is not difficulty-1 restricted; the global 30% lane prefers difficulty 1 from the full eligible pool where possible and safely falls back when difficulty-1 global candidates are insufficient.
- Online question selection is not affected.
- Any user with fewer than 3 active valid Category preferences sees the popup; this applies to new and existing users.
- The source of truth is active valid UserCategoryPreference count.
- Only active categories are selectable and count.
- Users can later change selections under Profile / Settings / İlgi Alanlarım.
- UserCategoryPreference duplicate active rows are collapsed/passivated by the save helper; platform unique-key proof remains manual.
- UserCategoryPreference RLS runtime proof remains manual/NOT_AUTOMATABLE.
- UserSubCategoryPreference rows are retained legacy data and are not the current Settings source-of-truth.
`;
