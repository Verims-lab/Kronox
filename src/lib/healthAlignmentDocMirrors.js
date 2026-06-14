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

export const MOBILE_VISUAL_GUARDRAILS_DOC = `# Kronox Mobile Visual Guardrails

Status: Active manual visual/platform release gate.

- Verify 320px width, common iPhone widths, Android Chrome widths, tablet, and foldable/resizable layouts.
- No horizontal page overflow on Home, Game, Solo map, Profile, Settings, Friends, Liderlik, Market, Daily Wheel, Daily Quest Management, Privacy, and Health Center.
- Use safe-area padding around top bars, bottom CTAs, sheets, and BottomNav.
- Touch targets stay reachable and readable with system font scaling.
- Keyboard focus does not hide form actions or trap scroll.
- Pull-to-refresh/overscroll guards are scoped to the relevant container or active gameplay drag only.
- Reduced motion keeps functional feedback without relying on long animations.
- Loading/error/retry states are local to the affected section when possible.
- Direct URL routes load correctly in installed/standalone and browser modes.
- Service worker/cache updates do not leave stale question/runtime bundles after a question-set or function contract change.
- Push notification UI is feature-detected and remains optional.
- Offline UI is shown only for real offline or failed fetch plus no usable cache.
- Final App Store icon proof is the exported IPA / WixOneApp.app, not only source PNGs.
- npm run check:ios-icons is required before archive upload, but App Store Connect validation remains the final proof.
- Safari/PWA drag, safe-area, keyboard, home-indicator, and back navigation behavior require real-device proof.
- Privacy URL and App Store privacy answers must match the live app behavior.
- Android wrapper edge-to-edge behavior, status/navigation bar handling, back button behavior, orientation, tablet/foldable resizability, and Play Console quality warnings require AAB/device/Play proof.
- Web/PWA source checks do not prove native wrapper behavior.
- Health may statically verify that guardrails and source hooks exist, but real mobile/device/store validation remains manual or NOT_AUTOMATABLE until runtime proof is captured.
`;

export const SECURITY_DEPLOYMENT_DOC = `# Kronox Security & Deployment

Status: Active product contract.

- Object-level authorization is a backend contract.
- Service-role functions derive the actor from trusted backend auth context.
- User-owned objects are scoped by owner, recipient, participant, host, active admin row, or another documented authority field before return or mutation.
- Request-body user, email, role, or owner fields are not trusted for authorization.
- UI hiding is not the authorization boundary.
- Two-account probes remain mandatory for category preferences, friends, invites, lobbies, Daily Quest progress, Daily Wheel, Diamond/Joker economy, push subscriptions, and analytics cleanup.
- getQuestions serves an authenticated minimal playable projection for Solo; admin/full-bank diagnostics still require active AdminUser owner/admin authorization.
- startLobbyGame requires authenticated host, no legacy guest, no client identity override.
- Service-role usage is scoped to admin/maintenance backend functions.
- VAPID private key remains a real secret and must stay secret-managed.
- Backend push config requires VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, and VAPID_SUBJECT or their KRONOX_ compatibility names.
- VAPID_PRIVATE_KEY is server-only and read from backend deployment secret/env only; scanner findings that only flag the env var name are deployment-secret management notes unless real key material is present. It is never logged, returned, sent to the client, exposed through VITE_, or included in raw error/stack responses.
- Health/security triage classifies env-sourced VAPID_PRIVATE_KEY deployment verification as MANUAL_REQUIRED/warning; it is a blocker only if key material is hardcoded, exposed through VITE_, logged, returned, or included in raw errors.
- VAPID_PUBLIC_KEY is public by design for browser subscription but remains public-by-design/config-managed, not hardcoded.
- VAPID_SUBJECT is deployment-controlled contact/config metadata and must not be hardcoded as a source fallback or logged unnecessarily.
- VAPID_SUBJECT uses a mailto: or https:// subject and VAPID keys are non-empty base64url-style deployment values.
- Missing, blank, whitespace-only, placeholder, empty-string, hardcoded, dummy, or VITE_ backend VAPID fallbacks are forbidden.
- VAPID private key values are never logged, returned, printed in Health, or exposed through frontend VITE_ variables.
- Missing VAPID config is reported explicitly as vapid_config_missing / missing_vapid_config with pushSent:false, pushSkipped:true, missingConfig:true, skippedReasons, failedReasons, subscriptionCount, and safe counts; it does not return VAPID values and does not break in-app invite flow.
- Current source of truth for admin authorization is the private AdminUser entity.
- Inline backend guard: Base44 functions carry the AdminUser-backed guard locally because individual function deploy bundles do not reliably include shared helper modules.
- Do not import _shared/adminAuth.ts from Base44 functions. Shared local helpers are a deployability risk, not an authorization source.
- Active AdminUser rows require normalized lowercase email, role: "admin" or owner, and status: "active".
- Inline guards must enforce the same normalized email, active status, and owner/admin role contract. Hardcoded admin allowlists are forbidden.
- disabled/missing AdminUser rows are denied.
- There is no unsafe "if no admin exists, everyone is admin" fallback.
- Do not commit the personal admin emails to source.
- Admin email env allowlists are not used for authorization.
- resetTestAccountProgress uses AdminUser-backed authorization and exact target-email confirmation; KRONOX_TEST_RESET_EMAILS and TEST_RESET_EMAILS are deprecated and must not control runtime access.
- Client admin UI consumes the backend getAdminStatus status hint; /getAdminStatus is the callable status path.
- AdminUser rows remain private and are not listed by normal users.
- Profile normal-user actions are Sosyal / Arkadaşlarım and Hesap / Ayarlar.
- Active AdminUser owner/admin users additionally see Admin Ekranı on Profile.
- Admin Ekranı contains admin-only maintenance/report tools; Settings remains account/help/preferences focused.
- BottomNav visible items are Ana Sayfa, Liderlik, and Profil; Online is launched from Home through Online Kapışma, not exposed as a bottom tab.
- Direct /admin access by normal users is blocked or redirected safely.
- admin-only maintenance functions verify AdminUser-backed authorization server-side.
- Admin Ekranı list refresh uses scoped Pull-to-Refresh only after the admin gate has passed; bottom-sheet selectors do not replace backend AdminUser authorization.
- simulateOnlineGame and runTestSuite are admin-only backend tools. They must call the inline AdminUser guard before any service-role simulation/test writes; user.role, request-body role fields, hardcoded admin emails, and typo role strings such as en_core_news_sm are not valid authorization. Runtime auth proof for simulateOnlineGame must verify unauthenticated, normal user, and disabled/passive admin calls are blocked, while active owner/admin AdminUser rows succeed. npm run build does not prove this deployed backend behavior.
- account deletion is a destructive, NOT_AUTOMATABLE manual proof gate.
- Public privacy URL is https://kronoxgame.com/privacy.
- /privacy must load without login, admin status, backend data, or redirect.
- Gizlilik Politikası includes last-updated date, configured support contact from VITE_KRONOX_SUPPORT_EMAIL when present, account/profile data, gameplay/progress/leaderboard data, friends/invites/social data, optional push subscription data, local storage/cache, economy/ledger data, and question analytics/reporting disclosure.
- App Store Connect privacy answers must match the /privacy page and update when data collection, analytics, push notifications, social features, or economy behavior changes.
- App Store Guideline 4.8: when third-party login is offered, the login surface must expose Sign in with Apple / Apple ile Giriş Yap through Base44 auth. Base44 Settings -> Authentication -> Apple toggle is a manual deployment step; no Apple client secret or native credential belongs in source.
- UserJokerInventory stores current balances for mistake_shield, card_swap, and time_freeze.
- JokerTransaction stores the append-only joker grant/spend ledger.
- ensureUserJokerInventory grants 3 Kronokalkan, 3 Kart Değiştir, and 3 Zaman Dondur once per authenticated user using starter_jokers:<email>:<joker_type> idempotency keys; missing or partial UserJokerInventory rows self-heal, existing balances are preserved, owner email is normalized, and duplicate/malformed rows do not crash Joker Çantası.
- spendUserJoker spends one owned Solo joker using authenticated user context, positive-balance validation, Solo-context validation, deploy-safe UserJokerInventory/JokerTransaction entity fallback, reason solo_use, source solo, quantity_delta -1, safe user-facing errors, and an idempotency key.
- Profile shows only Joker Çantası balances; normal users must not see other users' balances or transaction ledger rows.
- Mağaza Phase 1 purchases use purchaseJokerWithDiamonds; users purchase only for themselves, backend owns trusted joker prices, sufficient Diamonds are validated server-side, and successful purchases write DiamondTransaction plus JokerTransaction with market_purchase.
- Mağaza purchases are server-authoritative economy actions: the client is not trusted for price, cost, user identity, or target account; service-role writes stay scoped to the authenticated user.
- Mağaza purchase idempotency keys protect double-tap and retry flows; real two-device/backend race proof remains manual unless Base44 uniqueness is proven.
- Mağaza Phase 1 does not expose bundles, subscriptions, cosmetics, random boxes, ads, external payments, or Online-mode joker purchases.
- Daily Quest Definition management is admin-only under Profile / Admin Ekranı as Günlük Görev Yönetimi.
- createDailyQuestDefinition is a Base44 callable with an inline AdminUser-backed guard for active owner/admin rows; normal users and disabled admins are rejected.
- DailyQuestDefinition title and description are display-only; quest_type plus target_value are the executable logic contract.
- DailyQuestDefinition.quest_key is the logical unique key. Admin list is read-only and never seeds on refresh; explicit seed/create skip or reject existing keys. Existing duplicate rows are grouped by quest_key with Admin warnings and require manual cleanup after backup, not automatic deletion.
- Supported Daily Quest v1 quest_type values are start_solo_attempt, correct_cards, complete_solo_level, and use_joker.
- Daily Quest definitions use reward_diamonds only, never Kronox Puan, and do not affect leaderboard.
- Daily Quest text is never parsed by AI, NLP, regex, scripts, or arbitrary free-text executable conditions.
- sendQuestionAnalyticsReportEmail is manual/admin-triggered only and sends the full useful question analytics/product intelligence report inside the email body with text fallback. The PDF attachment flow is intentionally disabled/cancelled for now.
- sendQuestionAnalyticsReportEmail is callable from base44/functions/sendQuestionAnalyticsReportEmail/entry.ts with base44/functions/sendQuestionAnalyticsReportEmail/function.jsonc name sendQuestionAnalyticsReportEmail and entry entry.ts; the callable report function INLINES a DB-backed AdminUser guard (no local _shared import) so it deploys cleanly under the Base44 function runtime.

## Backend function deployability (stale-deploy incident)
- npm run build validates only the Vite frontend bundle. It does NOT prove Base44 backend functions deployed. Backend/Base44 functions may require separate deploy/publish proof.
- Function changes must be verified in the actual EXECUTED function path. Editing an unused helper or stale mirror does not change runtime behavior.
- Local proof HTML / helper output is not enough if the deployed function is stale.
- Static Health fails critical Base44 functions that contain _shared/adminAuth, ../_shared, or file:///__shared deploy-risk imports; live runtime marker proof still requires Base44 Test Function/deploy validation.
- npm run check:base44-functions is the pre-deploy static gate for Base44 function sources. It catches TypeScript syntax/duplicate-declaration blockers, deploy-risk _shared imports, committed email literals, and missing getQuestions runtime marker/projectionDiagnostics before manual Save & Deploy.
- Report/admin functions must NOT use local imports that resolve outside the deployed path. The broken './_shared/adminAuth.js' pattern resolved to a file URL under /src/_shared (module not found) and broke deployment, leaving Base44 serving a stale build. The callable report function now inlines a DB-backed AdminUser guard instead.
- base44/functions/<name>/entry.ts shared imports remain allowed where proven deployable; sendQuestionAnalyticsReportEmail intentionally uses an inline guard for this runtime-sensitive path.
- Critical report/admin functions should include safe template/function markers (e.g. templateVersion nine-section-email-v1, REPORT_BUILD_MARKER, emailBodyMode, reportDeliveryMode, and body section diagnostics). If real output lacks the marker, the function deployment is stale.
- sendQuestionAnalyticsReportEmail live deploy is proven by triggering the function and reading reportBuildMarker (current: Codex347), templateVersion nine-section-email-v1, emailBodyMode nine_section_email_body, reportDeliveryMode email_body_only, bodyContainsExactlyRequiredSections true, requiredSectionOrderValid true, renderedSectionHeaderCount 9, and bodyLength > 1000. A published frontend that does not change reportBuildMarker means the executed backend function did not redeploy.
- The report separates active pool, Solo-eligible pool, and Runtime Projection diagnostics. Runtime Projection is based on getQuestions diagnostics, remains diagnostic/admin proof only, and must not be faked by email generation. Top-shown concentration must be compared with the Solo-eligible pool before fairness conclusions.
- A prior Codex275 marker bump was never proven deployed because the runtime function still imported the broken local _shared guard; the recovery inlined the AdminUser guard and uses current reportBuildMarker values as the unambiguous live marker.
- Function-based question analytics reset is currently not used.
- Manual DB reset path after question pool replacement clears QuestionAttemptEvent and any populated QuestionStatsProjection/CategoryStatsProjection manual aggregate rows. Projection tables may be empty because the active 9-section report computes history from raw QuestionAttemptEvent rows.
- Manual reset must not delete Question, Category, SubCategory, UserCategoryPreference, UserStatsProjection, UserJokerInventory, JokerTransaction, progress/economy/leaderboard data, Daily Wheel rows, users, or AdminUser.
- manual question analytics reset does not delete Question, Category, SubCategory, UserCategoryPreference, UserStatsProjection, score/progress/economy, leaderboard, Daily Wheel, users, AdminUser, or gameplay rows.
- Joker Kullanımı Analizi may be ledger-derived from JokerTransaction/UserJokerInventory and is not fully reset by question analytics cleanup. DiamondTransaction and DailyWheelSpin are economy/audit rows, not question analytics reset tables. Oynanma Zamanı hour/day metrics reset through QuestionAttemptEvent timestamps.
- sendQuestionAnalyticsReportEmail handles stale/deleted question references with diagnostics and bounded sections.
- sendQuestionAnalyticsReportEmail actual sent body includes exactly Executive Summary, Kategori Bazında Soru Havuzu, Kategori Tercihleri, Kategori Bazında Gösterim, En Çok Gösterilen Sorular, Az ya da Hiç Gösterilmeyen Sorular, En Çok Yanlış Yapılan Sorular, Joker Kullanımı Analizi, and Oynanma Zamanı ve Kullanım Ritmi. Kategori Bazında Soru Havuzu includes the category-based Top 10 answer year/count table inside the same section.
- Generated email output intentionally excludes Rapor Şablonu, Rapor Bölümleri, Sistemdeki Soru Havuzu: Kategori / Zorluk Dağılımı, Kategori ve Zorluk Bazında Kayıtlı Soru Sayısı, Kategori Bazında Yıl Aralığı, and Kategori İçi Soru Analizi.
- sendQuestionAnalyticsReportEmail accepts any active AdminUser role admin/owner, sends by default to the requesting authenticated admin's normalized email, rejects mismatched recipient overrides, and the Admin Ekranı UI returns safe requestedBy, recipientEmail, template, body-marker, and emailDispatchStatus diagnostics.
- Category preference report counts are aggregate distinct-user counts only and do not expose user IDs or emails.
- Question analytics report sections render with section-level warnings instead of truncating the whole email.
- unrelated user progress admin reset retains question analytics rows; account deletion anonymizes user-owned analytics identity.
- retained QuestionAttemptEvent analytics rows no longer contain deleted user identity after account deletion.
- UserCategoryPreference rows are user-scoped Settings data.
- normal users can read/update only their own preference rows.
- passive Category.status = P/p rows are not selectable.
- Any authenticated user with fewer than 3 active valid Category preferences sees an optional personalization popup; this applies to new and existing users, can be deferred, and must not block gameplay.
- The source of truth is active valid UserCategoryPreference count.
- Only active categories are selectable and count.
- Passive or removed Category selections are filtered from UI/save state and are not resaved as active preferences.
- completing the popup saves UserCategoryPreference rows before marking the user profile onboarding flag complete.
- Users can later change selections under Profile / Settings / İlgi Alanlarım.
- Game question loading first attempts online getQuestions when online or network state is unknown; Solo uses the authenticated minimal projection, empty local cache is not offline, stale cache is invalidated by question-runtime-v7-getQuestions-live-marker, Retry re-fetches online, and false offline/no-cache is reserved for known offline plus failed fetch plus no usable cache. Gameplay fetches request the v2 per-category projection explicitly; getQuestions fetches numeric/string main_category_id and category_id variants per active Category before any final projection cap, returns safe v2 projectionDiagnostics plus getQuestionsRuntimeMarker, uses fallback IDs only when Category read fails, and Question category fields are not capped to the original 1-6 seed set.
- Solo question selection reads current-user active valid Category preferences before attempt start when signed in. Game.jsx explicitly calls getValidActiveSelectedCategoryIds(preferences, activeCategories) in the Solo-only path. Authenticated users with no saved preferences or empty preferences use all active categories for Solo; missing authentication is an auth-required state and must not expose raw questions. Category preference save validation remains separate from gameplay start. Insufficient preferences also use all active categories for Solo. Saved preferences target 70% selected categories / 30% full eligible pool only when at least 3 active valid preferences exist; this is soft weighting with fallback. The selected-category 70% lane is not difficulty-1 restricted; the global 30% lane prefers difficulty 1 from the full eligible pool where possible and safely falls back when difficulty-1 global candidates are insufficient.
- getQuestions derives active playable category IDs from active Category rows; stale hardcoded seed-category ID subsets must not exclude newer active categories from runtime projection.
- getQuestions/category helpers accept active status aliases a, active, and aktif, and category_id normalization accepts any positive live DB id so categories added after the original seed set can enter the Solo candidate pool.
- Online question selection, getQuestions, and analytics do not read preferences for question selection.
- two-account preference RLS proof remains manual/NOT_AUTOMATABLE.
- old UserSubCategoryPreference rows are retained but not used by the current Settings preference UI.
`;

export const RELEASE_PROOF_CHECKLIST_DOC = `# Kronox Release Proof Checklist

Status: Active manual release gate.

## Full Audit Release Gates
Health Center, Admin Ekranı, reports, and large maintenance lists avoid rebuilding expensive derived output after every row/case. Long admin work is batched or yielded around the 50ms long-task budget. Gameplay paths do not run Health/report/question-analytics calculations. Large email/report/list output stays bounded, paginated, or summarized. Health Copy Blocker JSON is intentionally blocker-only and includes real FAIL/BLOCKER/CRITICAL code/security/static failures plus summary counts, not manual-only verification reminders or the full raw PASS payload. User-owned backend operations enforce object-level authorization server-side; UI hiding is not accepted as proof. Two-account probes verify user-owned reads/writes for invites, lobbies, category preferences, Daily Quest progress, Daily Wheel, Diamond/Joker economy, PushSubscription, and analytics cleanup. Base44/manual DB constraints are checked for user+date, user+status, quest_key, question_id, category_id, created_at, endpoint, and idempotency_key. iOS, Android, and PWA wrapper quality remain separate manual gates: safe-area, keyboard, scroll/overscroll, back navigation, orientation, accessibility, reduced motion, 320px layout, push, icon, App Store, and Play Console proof. npm run build does not prove Base44 backend deployment, RLS/BOLA behavior, device gestures, push delivery, final IPA icon state, or Play Console wrapper quality.
npm run check:base44-functions must run before Base44 Save & Deploy to catch function syntax, duplicate declarations, deploy-risk _shared imports, committed email literals, and getQuestions marker/projection diagnostics before manual backend publish.

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

## Mağaza Phase 1
Home shows Mağaza top-left, Diamonds center, notifications right. Mağaza title
is Mağaza and prices are Zaman Dondur 40, Kart Değiştir 50, Kronokalkan 60.
Client is not trusted for price; purchase validation is server-authoritative.
Successful purchase writes both DiamondTransaction and JokerTransaction with
market_purchase and the same idempotency key. Runtime explicitly binds
UserJokerInventory, DiamondTransaction, and JokerTransaction. Double-tap, network retry,
insufficient Diamonds, and two tabs/devices proof remains manual. Market
purchase is a Diamond sink; Daily Wheel remains a Diamond source. Profile
Joker Çantası and Solo joker bar must show the purchased balance; Online mode
is unaffected and Daily Wheel remains Diamond-only.

## Daily Quest Runtime v1
DailyQuestDefinition stores admin-managed system templates. Günlük Görev
Yönetimi lives under Profile / Admin Ekranı and is visible only to active
AdminUser owner/admin users. Active admins can list definitions and create new
definitions through createDailyQuestDefinition. title and description are
display-only; quest_type + target_value drive runtime progress logic. Supported
v1 types are start_solo_attempt, correct_cards, complete_solo_level, and
use_joker. UserDailyQuestProgress stores 1 selected UTC-day user quest from
active definitions. recordDailyQuestProgress increments Solo-only progress events, and
Online mode does not increment Daily Quest progress. claimDailyQuestReward
grants diamonds only through DiamondTransaction.source = daily_quest_reward,
using the reward copied into the progress row rather than a client-provided
amount. Completed progress alone does not grant Diamonds; completed and
unclaimed quests expose an Al claim action. Successful claimDailyQuestReward
updates visible User.diamonds, returns diamondBalanceAfter and questStatus:
claimed, and only then marks the progress row claimed. Daily Quest does not
grant Kronox Puan and has no leaderboard impact. Home Daily Quest copy is
"Günlük Görevleri Yap, Elmasları Kazan!" and the runtime backend functions
explicitly bind UserDailyQuestProgress for status, progress, and claim
deployability.
Günlük Görev requires active DailyQuestDefinition rows; getDailyQuestStatus and
recordDailyQuestProgress seed fixed default templates idempotently only when no
definition rows exist. Runtime groups duplicate active definitions by quest_key,
chooses one canonical definition by sort_order, created_at, and stable id, then
selects the first logical daily quest. getDailyQuestStatus is authenticated but
not admin-only and preserves newly created rows if immediate Base44 refresh is
stale. Loading or ensuring today’s quests does not grant Diamonds;
claimDailyQuestReward remains the only reward path.
One claim per quest per UTC day is enforced by UserDailyQuestProgress and
daily_quest_reward idempotency keys. User fields daily_quest_last_claim_date
and daily_quest_next_available_at track claim summary/reset availability only.

## Online Scoring Persistence
Two-account invite + scoring proof, OnlineMatchResult idempotency.

## RLS And Backend Security
Two/three-account RLS probe matrix, service-role scoping.

## Privacy Policy / App Store Privacy
Public privacy URL is https://kronoxgame.com/privacy. /privacy must be publicly accessible without login, admin status, backend data, or redirect to Home/login. The page title is Gizlilik Politikası, includes a last-updated date, and lists the configured support contact from VITE_KRONOX_SUPPORT_EMAIL when present. The policy discloses account/profile data, gameplay/progress/leaderboard data, friends/invites/social data, category preferences, optional push subscription/notification data, local storage/cache/IndexedDB use, Daily Wheel/Daily Quest/Mağaza/Joker/Diamond economy records, and question analytics/reporting data. The policy states Kronox does not sell personal data for third-party advertising and must not claim that no data is collected. Account deletion/access/correction requests are covered and must not rely on committed support email literals. App Store Connect privacy answers must match the /privacy policy and be updated whenever data collection, analytics, push notifications, social features, or economy/ledger behavior changes. Manual proof opens https://kronoxgame.com/privacy from a fresh browser without login and confirms Turkish policy content loads on mobile.

## PWA / Push
BottomNav visible tabs are Ana Sayfa, Liderlik, and Profil only. Online is launched from Home through Online Kapışma, not from BottomNav. Switching visible tabs preserves subroute/scroll state and re-tapping the active tab resets that tab to its root while /game remains full-screen.
Friends, Liderlik, and Admin Ekranı maintenance lists use scoped Pull-to-Refresh wrappers that call real reload paths, respect reduced motion, and do not affect gameplay drag.
Category/Admin selection controls use Kronox bottom-sheet selectors instead of raw native HTML selects in the targeted surfaces; sheets support Escape/backdrop close, focus return, safe-area bottom padding, dark mode, and reduced motion.
iOS AppIcon PNGs must be fully opaque before App Store upload. PWA/web icons may be separate from native iOS AppIcon assets, but Wix/native wrapper generation must consume local opaque PNGs. No alpha channel, no tRNS transparency chunk, and no transparent corners are allowed. The 1024x1024 ios-marketing / large app icon must be RGB/opaque. App Store Connect error 90717 means a transparent or alpha-channel icon remains in the final \`WixOneApp.app\` icon asset. index.html, public/manifest.json, src/manifest.json, and the splash screen point at local opaque /assets/icons/kronox-app-icon-* PNGs. Base44 Generate App Store files App logo upload is also an iOS icon source; upload public/assets/icons/base44-app-logo-1024-no-alpha.png there, then click Generate Files again. App Store Connect 90717 can persist if Base44 regenerates WixOneApp.app AppIcon assets from a transparent uploaded logo, and old IPA/archive files must not be reused. Run npm run check:ios-icons before native archive upload; it validates ios/App/App/Assets.xcassets/AppIcon.appiconset/Contents.json, referenced PNG dimensions, manifest icon PNGs, forbidden transparent source references, the Base44 upload logo PNG, and no-alpha PNG metadata. After icon changes, clean the native/iOS build folder, delete stale archives, regenerate wrapper/native assets if cached, rebuild/archive, and inspect the final exported IPA or Payload/WixOneApp.app. Final release gate: validate the final \`WixOneApp.app\` icon asset from the regenerated archive/exported IPA before upload. Release execution: archive/export the iOS build after Base44 regenerates the files, then re-upload or validate in App Store Connect. If icons are compiled into Assets.car, use Xcode/assetutil or App Store Connect validation as the final proof; source-only checks must not claim the 90717 fix is proven. Real App Store Connect re-upload validation remains manual.
Push subscription works on real installed device if supported. (manual)
sendGameInvitePush requires backend VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, and VAPID_SUBJECT.
Missing or blank VAPID config returns explicit vapid_config_missing / missing_vapid_config diagnostics.
No empty-string, dummy, hardcoded, or VITE_ private-key fallback is allowed.
Safe VAPID-missing diagnostics use pushSent:false, pushSkipped:true, missingConfig:true, reason:vapid_config_missing, skippedReasons, failedReasons, subscriptionCount, and counts only.
VAPID_PRIVATE_KEY remains backend-env-only and is never logged or returned; env-var-name scanner findings are deployment-secret management notes unless real key material is exposed.
VAPID_PUBLIC_KEY is public-by-design/config-managed, and VAPID_SUBJECT is contact/config metadata that must not be logged or returned unnecessarily.
In-app invites remain functional if push is not configured.
npm run build does not prove backend VAPID secret deployment; real push delivery requires a subscribed device and deployed backend secrets.

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
Category preferences sees an optional popup, including new and existing users.
The source of truth is active valid UserCategoryPreference count, only active
categories are selectable and count, passive or removed Category selections are
filtered from active UI/save state, completion prevents repeat prompts only while
the user still has 3 or more active valid preferences, and Users can later change
selections under Profile / Settings / İlgi Alanlarım. Authenticated users with
no saved preferences or empty preferences use all active categories for Solo;
missing authentication is an auth-required state and must not expose raw
questions. Category preference save validation remains separate from gameplay
start. Insufficient preferences also use all active categories for Solo.
SubCategory entity still exists, but Settings currently uses Category interests.
The Settings Category preference surface is custom touch UI with no raw native select in the targeted section; save validation and user scoping remain unchanged.
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
- Hot UI paths read current-state tables/projections directly and must not sum append-only ledgers or scan full analytics history during render.
- Admin/Health/report paths may process larger datasets, but they should batch, paginate, cap output, or yield work so long JavaScript tasks do not block the app shell.
- Gameplay must not run Health, report, projection refresh, cleanup, or aggregate maintenance jobs.
- Service-role functions bind every user-owned object to authenticated user/admin context before reading, writing, updating, or deleting it.
- If Base44 cannot enforce a DB-level unique/index constraint, the service layer remains responsible for idempotency and duplicate detection.
- Solo QuestionAttemptEvent runtime writes are enabled best-effort; Online analytics remains deferred.
- Manual admin question analytics full email-body report exists with no scheduled trigger and no active PDF attachment requirement.
- Manual DB reset path can reset question analytics history/projections after replacing the question pool.
- Question analytics reports handle empty analytics state and stale/deleted question IDs safely.
- Question analytics email reports include exactly the nine required sections in order; Joker Kullanımı Analizi and Oynanma Zamanı ve Kullanım Ritmi must contain tables or structured no-data rows.
- Legacy static/template sections are forbidden, while the explicitly requested Kategori Bazında Soru Havuzu table is required.
- Removed legacy report sections stay forbidden in generated email output: Rapor Şablonu, Rapor Bölümleri, Sistemdeki Soru Havuzu: Kategori / Zorluk Dağılımı, Kategori ve Zorluk Bazında Kayıtlı Soru Sayısı, Kategori Bazında Yıl Aralığı, and Kategori İçi Soru Analizi.
- Long event-based detail sections are row-limited for email readability.
- Legacy candidates kept without deletion: Friendship, GameRecord, LobbyMessage.
- Raw Question remains protected.
- UserCategoryPreference stores app-open popup and Settings Category preferences per user; minimum 3 selections. There is no maximum selection.
- Authenticated users with no saved preferences or empty preferences use all active categories for Solo; missing authentication is an auth-required state and must not expose raw questions. Insufficient preferences also use all active categories for Solo. Saved preferences target 70% selected user categories plus 30% full eligible pool only when at least 3 active valid preferences are available.
- This is a soft weighting target with fallback, not hard filtering. The selected-category 70% lane is not difficulty-1 restricted; the global 30% lane prefers difficulty 1 from the full eligible pool where possible and safely falls back when difficulty-1 global candidates are insufficient.
- Online question selection is not affected.
- Any authenticated user with fewer than 3 active valid Category preferences sees an optional personalization popup; this applies to new and existing users, can be deferred, and must not block gameplay.
- The source of truth is active valid UserCategoryPreference count.
- Only active categories are selectable and count.
- Users can later change selections under Profile / Settings / İlgi Alanlarım.
- UserCategoryPreference duplicate active rows are collapsed/passivated by the save helper; platform unique-key proof remains manual.
- UserCategoryPreference RLS runtime proof remains manual/NOT_AUTOMATABLE.
- UserSubCategoryPreference rows are retained legacy data and are not the current Settings source-of-truth.
`;
