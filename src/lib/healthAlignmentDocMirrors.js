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

export const PRODUCT_WORKFLOW_DOC = `# Kronox Product Workflow

Status: Active product workflow contract.

- First-time guests use app-owned GuestProfile, not Firebase anonymous auth and not Base44 anonymous auth.
- Guest onboarding runs through the guided first Solo level, then profile setup, then category setup, then Ana Sayfa.
- The first-launch welcome shows Seviye 1 as the guided first Solo level start and Hesabım Var as a secondary route to Profile account connection; Apple / Google / Email buttons stay in the existing Profile flow.
- Eğitime Devam is only for true tutorial_in_progress; tutorial_completed routes to profile setup, profile complete plus category pending routes to category selection, and onboarding_complete routes to Ana Sayfa.
- Home / Ana Sayfa must not render Google, Apple, Email, Hesabını bağla, or progress-protection account-link CTAs; account linking belongs under Profile. The first-launch welcome may show Hesabım Var only as a route to Profile account connection, not as an inline provider/login surface.
- Public identity is username. display_name / Görünen Ad is a legacy/internal projection mirror, not a separate public editable identity or public leaderboard response field.
- Profile avatar fields are public visual metadata only: public rows may carry sanitized avatar_type, avatar_icon_id, avatar_color_id, and avatar_url, but username remains the public identity and private identifiers/storage metadata stay forbidden.
- kronox_user_id is the immutable canonical app user identity for backend-owned relationships and support/admin correlation. It is system-assigned, opaque, non-sequential, preserved through guest-to-account linking, never user-editable, and never reused after deletion. It is not authorization proof; server-side ownership and access-control checks remain required.
- Friends can be added by email address or registered Kronox username. Username lookup is backend-owned and username-based add responses must not reveal the target email. FriendRequest sends use a function-level FriendRequestOperationLock race guard because DB/entity unique constraints are not repo-proven.
- Category selection uses current active Category metadata and getCategoryMetadata; stale hardcoded category fallback arrays and old seed category names are forbidden as runtime fallbacks.
- Authenticated category preference save minimum is 3 active valid categories; guest category selection is advisory and empty guest selections mean all active Solo categories remain eligible.
- Online category list is sorted by category_id ASC and Online is not a BottomNav item.
- Current Solo shows HAMLE / remaining moves and Puan / Kronox Puan. HATA is legacy/internal and not current visible Solo result/stat copy.
- Normal Solo uses 2 anchors, an internal 18-question attempt deck buffer, 10 evaluated moves, a 180-second timer, and a 7-card target including anchors. Special Solo starts at level 5 and every 5 levels after that, uses an internal 21-question attempt deck buffer, a 13 evaluated move limit, the same 180-second timer, and a 10-card target. The extra special moves are only a mistake buffer and do not change scoring.
- Online uses Lobby.selected_category_ids and a startLobbyGame shared deck selected 100% from active lobby-selected categories with difficulty 1/2 only; Online does not use Solo preferences.
- Unified Kronox Puan is Solo best-score component plus Online progress score. Online winner scoring is exactly +15 Kronox Puan, loser scoring is exactly -6 Kronox Puan before checkpoint protection, and Online has no speed bonus.
- Daily Wheel V2 grants server-selected Diamonds, approved Solo jokers, or Gift Box rewards only, never Kronox Puan, and never leaderboard impact. Daily Wheel ready popup is a centered blurred modal; its fixed clockwise visual segment order is diamond_20, diamond_60, diamond_100, joker_krono_kalkan, joker_zamani_dondur, joker_kart_degistir, gift_box, diamond_250, and the wheel lands by backend reward_segment_index. The spin stays in the same premium popup/wheel shell with no separate intermediate spinning-copy screen; result reveal/effects wait for the backend-selected landing animation, and segment content uses the shared 0.8 scale token. Post-spin result UI is simplified: the wheel remains visible, one backend-payload reward line appears below it, and one disabled ad/video ÇEVİR repeat CTA appears at the bottom; old total/streak/retry explanatory result copy is not shown and no fake ad reward path exists. Segment content is radially oriented toward the wheel center: each Diamond icon+number group and each Joker/Gift icon is rotated by its own segment center angle so it faces the hub instead of being artificially kept screen-upright, and the content rotates with the wheel during spin while the pointer stays stationary; this orientation must not enlarge content or change reward mapping/stop alignment. The wheel uses one continuous spin that reaches a clear fast pace immediately and decelerates only near the end with a light final bounce, never slow → fast → slow, with no separate steady pre-spin loop; spin sound/effects are synchronized to the visible rotation and never continue after the wheel stops. Visual polish may improve quality but must not enlarge icons/numbers or change reward mapping. Daily Quest grants Diamonds only, no Kronox Puan, and no leaderboard impact. Authenticated users and token-proven completed GuestProfile users can use these daily systems. Guest rewards persist on GuestProfile.diamonds with internal guest:<g_owner_key> ledger keys. Daily Wheel uses DailyWheelSpin, DiamondTransaction when Diamonds are granted, JokerTransaction/UserJokerInventory when jokers are granted, function-level idempotency guards, and EconomyOperationLock balance mutation guards; DB/entity unique constraints are not repo-proven.
- Question Analytics is an admin/private nine-section email-body report sourced from QuestionAttemptEvent. PlayerQuestionExposure is optional anti-repeat memory reset scope.
- Health PASS is not release-ready proof; manual NOT_AUTOMATABLE gates remain required.
- Stale Codex040 PDF references are old structure only; current truth is markdown/source plus current code and Health contracts.
`;

export const TECHNICAL_FLOW_DOC = `# Kronox Technical Flow

Status: Active technical flow contract.

- App routes are owned by src/App.jsx; BottomNav visible tabs are Ana Sayfa, Liderlik, and Profil. Profile is guest-compatible and the app-level onboarding guard must not bounce normal /profile tab navigation while guest state is recoverable.
- createGuestProfile is public by design but narrow: it creates/verifies GuestProfile and stores guest_token_hash only. Guest mutations require guest_id + raw guest token.
- linkGuestAccount is Profile-only and verifies guest token proof plus authenticated user before AccountLinkTransaction merge. It preserves the guest kronox_user_id as the canonical identity when linking, plus guest Diamonds, Daily Wheel/Daily Quest same-day guards/history, leaderboard username identity, category preferences, progress, and inventory where applicable.
- getCategoryMetadata returns category_id, name, description, and status from current active Category rows only; it must not expose questions, answers, years, user data, admin fields, passive/deleted categories, or stale fallback arrays.
- Base44 function.jsonc files use the repo-supported name + entry shape only; auth/public scope is enforced in entry.ts guards. createGuestProfile and getCategoryMetadata are public-by-design and narrow, user-owned functions call base44.auth.me(), guest daily/leaderboard paths verify guest_id + raw guest token against completed GuestProfile, and admin-only functions use AdminUser guards.
- configured \`function.jsonc\` manifests are the platform-published source in this repo; extra entry.ts directories are compile-checked but need matching manifest/deploy proof before being classified as published callables.
- Configured function auth/public matrix covers createGuestProfile, ensureKronoxUserId, getCategoryMetadata, getQuestions, getPlayerQuestionExposureStats, recordPlayerQuestionExposure, updateProfileSettings, linkGuestAccount, sendFriendRequest, updatePlayerPresence, getFriendPresence, getOnlinePlayerSelection, createGameInvitesForTargets, getAdminStatus, ensureUserJokerInventory, spendUserJoker, purchaseJokerWithDiamonds, getDailyQuestStatus, recordDailyQuestProgress, claimDailyQuestReward, createDailyQuestDefinition, diagnoseSoloQuestionStartQuery, and sendQuestionAnalyticsReportEmail.
- /admin has a route-level UX guard that waits for AuthContext/AdminUser status before mounting AdminPage; non-admin users are redirected without an admin-tool flash, while server-side AdminUser guards remain the real security boundary.
- Dependency cleanup result: unused direct Stripe, Three, React Leaflet, React Quill, Moment, jsPDF, html2canvas, and Lodash packages were removed; recharts and embla-carousel-react stay because UI primitives import them.
- UserCategoryPreference is authenticated Settings/Profile data. Fewer than 3 active valid preferences means Solo uses all active categories; 3+ enables Solo-only soft weighting.
- SubCategory/UserSubCategoryPreference are future/legacy data and not current Profile Info preference UI.
- Solo runtime uses getQuestions bounded projections and buildSoloAttemptDeck; raw Question.list gameplay fallback and full-bank exposure are forbidden.
- PlayerQuestionExposure is private per-player anti-repeat memory; PlayerQuestionDailyExposure is daily anonymous exposure summary; actual reports source history from QuestionAttemptEvent.
- UserJokerInventory is the current joker balance source and JokerTransaction is the ledger. purchaseJokerWithDiamonds writes DiamondTransaction plus JokerTransaction under EconomyOperationLock.
- claimDailyWheelReward writes DailyWheelSpin, DiamondTransaction for Diamond portions, and JokerTransaction/UserJokerInventory for approved joker portions using function-level same-day/idempotency guards plus EconomyOperationLock; no atomic/upsert guarantee is repo-proven. adminResetDailyWheelState is an AdminUser-gated Admin Ekranı support tool that accepts Kronox User ID, resets only today's Daily Wheel test guards/auto-popup marker/blocking same-day wheel idempotency rows, archives DailyWheelSpin/DiamondTransaction/JokerTransaction idempotency keys to preserve completed reward rows, grants no rewards, reverses no Diamonds/Jokers, and does not affect Daily Quest, Kronox Puan, or leaderboard.
- startLobbyGame owns the Online shared deck. Online does not read Solo preference weighting or guest Solo projection.
- sendQuestionAnalyticsReportEmail is admin-only, email-body-only, exactly nine sections, with anonymized User0001-style per-player coverage where used.
- Public assets must not contain secrets, tokens, question bank, answer years, internal IDs, raw guest IDs/tokens, provider IDs, or private user data.
- Public avatar projection may include only sanitized avatar_type, avatar_icon_id, avatar_color_id, and https avatar_url visual metadata; it must not expose email, provider IDs, owner_key, raw guest IDs, internal player keys, auth IDs, or raw storage metadata.
- Health static alignment can check docs/source contracts, but real device, two-account, Base44 deployment, push, RLS/BOLA, and store-wrapper proof remain manual.
- Uploaded kronox-teknik-dokuman.pdf and kronox-is-akisi.pdf are stale Codex040-era references unless regenerated from current source.
`;

export const ARCHITECTURE_AUDIT_DOC = `# Kronox Architecture Audit

Status: current audit and safe-fix record.

Kronox target architecture is Feature-Based MVVM with MVI-style state machines
for Solo gameplay, Online lobby/start/reconnect, and friend/game invite
notifications. Current Base44 production path remains active. Base44 migration
work is paused. The audit inventories Solo, Online, Notifications, Profile,
Leaderboard, Economy/Daily/Jokers, Questions/Categories, Admin/Health, shared
hooks/components, backend functions, entities/data model, and release/mobile
constraints. Safe fixes are small, localized, validated, and avoid broad
runtime rewrites.

Phase 1 adds src/lib/soloAttemptReducer.js as a pure Solo attempt lifecycle
reducer for HAMLE rules, persistence status, joker usage summary, and
success-only backend record-context eligibility. Game.jsx still owns active
runtime side effects until later ViewModel handoffs. The DB reporting plan now
defines the privacy-safe SoloLevelAttemptEvent contract without broad runtime
analytics writes.

Phase 1 also adds src/lib/onlineLobbyReducer.js and
src/lib/notificationReducer.js as pure MVI foundations. useWaitingRoomSync
feeds authoritative lobby subscription/poll events into the Online reducer
without changing route payloads. useNotificationCenter remains the shared
ViewModel/store and delegates notification fetch/subscription/terminal
lifecycle transitions to the notification reducer.

The Online/social presence and player-selection foundation adds backend-owned
PlayerPresence, updatePlayerPresence, getFriendPresence,
getOnlinePlayerSelection, createGameInvitesForTargets, usePresenceHeartbeat,
useFriendPresence, and src/lib/onlinePlayerSelection.js. Presence uses a 25s
visible heartbeat, 75s server-owned TTL, runtime session ids, and token-proven
GuestProfile support. Presence writes are current-user-bound, friend reads are
accepted-friend-scoped, player selection returns online friends, online
non-friends, then offline friends as username + opaque target_ref only,
stale/missing presence displays offline, transient refresh failures preserve
previous safe rows, and public surfaces render username-safe labels instead of
email/provider/internal id fallbacks.

Friend add now uses backend-owned sendFriendRequest so email or username input
shares one server-side path for target resolution, self/duplicate/pending
guards, function-level FriendRequestOperationLock race hardening, and no
target-email return on username add.

Unified Kronox Puan now keeps Solo and Online components separate internally
while visible Profile/Header/Leaderboard surfaces use Solo best-score plus
Online progress. Online winner scoring is exactly +15, loser scoring is
exactly -6 before checkpoint protection, and elapsed seconds are audit/display
only with no Online speed bonus.

Full architecture/performance cleanup audit restored the root @base44/sdk
package and lockfile contract to exact 0.8.34, matching the security Health
suite and deployment docs. Transient Friends, Online lobby, and debug copy/
notice timers are ref-owned, clear previous timers before rescheduling, and
clean up on unmount. No broad runtime refactor, unused-code deletion, or
Base44 migration work was attempted during this safe pass.
`;

export const ARCHITECTURE_TARGET_DOC = `# Kronox Architecture Target

Status: target architecture map.

Feature folders should separate Views, ViewModels, MVI reducers/state machines,
services/use cases, gateways/API access, and Base44 backend implementation.
Pilot flows are Solo gameplay completion/records, Online lobby/start/reconnect,
and friend/game invite notifications. Current Base44 production path remains
active. Base44 migration work is paused while gateway boundaries reduce direct
provider coupling.

App startup is split into critical identity bootstrap, first Home render, and
non-critical background refresh. Home is part of the initial app shell instead
of a lazy route chunk. Repeat guest launches may use cached public
GuestProfile data to release first render while backend GuestProfile
verification, Kronox ID ensure, profile hydration, Diamond economy grant,
starter joker repair, account-link merge, admin status, app-open activity,
presence, invite checks, reward status, and Market/Liderlik warm-up continue
after paint/idle. Daily Wheel V2 and Daily Quest remain server-authoritative;
Daily Quest is Diamond-only, while Daily Wheel V2 supports weighted Diamonds,
approved Solo jokers, and Gift Box rewards. Loading/cached status is allowed while post-paint refresh
completes. Low-end Android/WebView startup timing remains a manual proof gate.

Solo Phase 1 starts at src/lib/soloAttemptReducer.js: the reducer is pure,
effect-free, uses current HAMLE scoring constants, tracks persistence and
record-context status, and leaves analytics, daily quest, Base44 persistence,
and record-context requests outside the reducer.

Online Phase 1 starts at src/lib/onlineLobbyReducer.js: the reducer is pure,
effect-free, owns idle/creating/waiting/joining/joined/starting/started/
recovering/expired/error phases, gates started state on backend-owned shared
game state, and leaves Base44 calls/subscriptions outside the reducer.

Notification Phase 1 starts at src/lib/notificationReducer.js: the reducer is
pure, effect-free, preserves valid pending rows through transient empty fetches,
treats toast dismiss as visual-only, and closes actionable notifications only
on accepted/rejected/expired/terminal/invalidation lifecycle events.

Immutable Kronox ID Phase 1 starts at src/lib/kronoxUserId.js,
base44/functions/ensureKronoxUserId, base44/entities/KronoxUserIdTombstone,
createGuestProfile, updateProfileSettings, and linkGuestAccount. The ID field
is kronox_user_id, uses an opaque KX-XXXX-XXXX-XXXX format, is backend-assigned
or backfilled, is rejected from client profile update payloads, is preserved
through guest-to-account linking, and is tombstoned on account deletion or
eligible inactive guest cleanup so it is never reused. It is a support/admin
correlation identifier, not authorization proof.

Presence/player-selection Phase 1 starts at src/hooks/usePresenceHeartbeat.js,
src/hooks/useFriendPresence.js, src/lib/onlinePlayerSelection.js,
base44/entities/PlayerPresence.jsonc, base44/functions/updatePlayerPresence,
base44/functions/getFriendPresence, base44/functions/getOnlinePlayerSelection,
and base44/functions/createGameInvitesForTargets. Presence is best-effort and
relationship-scoped for friend reads: users heartbeat only their own runtime
session, linked actors derive identity from auth.me, guest actors require
GuestProfile token proof, friend lookup is restricted to accepted FriendRequest
rows, and stale/missing presence displays offline rather than online. Explicit
offline is session-scoped and TTL is the final safety net. Online non-friend
discovery is fresh-presence-only. Friend, invite, lobby, notification, presence,
and player selection surfaces render username-safe labels only; email, provider
ID, raw guest ID, kronox_user_id, owner_key, and internal player_key values are
never public display fallbacks. The UI stores opaque target_ref values and
backend functions resolve recipient email privately for GameInvite creation.
Profile avatar fields are public visual metadata only. Public rows may carry
only sanitized avatar_type, avatar_icon_id, avatar_color_id, and avatar_url;
username remains the public identity, and email/provider/owner/raw guest/internal
player/auth/storage fields stay forbidden in public avatar payloads.

Friends can be added by email address or registered Kronox username. Username
lookup and duplicate/self checks stay backend-owned, and username-based add
responses return only username-safe labels, never the target email. Open
outgoing friend invites are blocked server-side with a stable warning, new
friend invites expire no earlier than 72 hours after creation, and expired
outgoing invites must be cancelled/deleted before the sender can invite the
same target again. Open reverse-pending requests still route the player to
Gelen İstekler; expired reverse-pending rows are stale and must not block a
fresh outgoing request. Add Friend and Leaderboard suppress duplicate
in-flight submissions locally, while FriendRequestOperationLock narrows
backend parallel-send races without claiming DB-level uniqueness proof.

Loading states expose status semantics with role="status", aria-live, and a
clear accessible name without changing visual layout. Icon-only controls have
accessible labels, custom modal/sheet surfaces are named dialogs, and inline
form feedback uses alert/status semantics where practical. Static Health guards
these source contracts; keyboard, screen-reader, and real-device focus behavior
remain manual proof.

Admin authorization guard extraction stays a follow-up while Base44 function
bundles require inline AdminUser-backed guards. SimulationPanel source files
stay in the Health/admin/test-suite path until a separate test-runner migration
is planned.

Mağaza catalog is code-side/static for Phase 1 joker products and may be
cached/prefetched for fast open, but purchase remains server-authoritative:
the client is never trusted for price, cost, user identity, reward, or target
account. Satın Al readiness should depend only on auth/user, item data,
sufficient Diamonds, item availability, and purchase in-flight state; slow
non-critical inventory count refresh or starter self-heal must not silently
disable an otherwise valid purchase button.

Unified Kronox Puan is the only player-facing score source. Solo contributes
its best-score component; Online contributes User.online_progress.score. Online
winner scoring is exactly +15, loser scoring is exactly -6 before checkpoint
protection, and Online has no speed bonus. Online elapsed seconds may be stored
or displayed for audit/diagnostics but must not change score.

User.kronox_puan_total / GuestProfile.kronox_puan_total are the materialized
current-score projections for visible score reads. The public leaderboard hot
path reads bounded SoloLeaderboardEntry projection rows sorted by
total_kronox_score; bounded User repair is maintenance/fallback work, not
required before first Liderlik rows render. Home may idle-prefetch the
Liderlik chunk and projection-only snapshot.
`;

export const HEALTH_GAP_ANALYSIS_DOC = `# Kronox Health Gap Analysis

Status: current Health gap audit.

Health is a contract guard. It is not release proof. Static checks
cover 4-player Online lobby join/start/recovery, invite verified lobby, notification
no-flicker, Solo backend record context, Daily Quest Diamond-only rewards,
leaderboard username-only payloads, Online category isolation, no raw
Question.list gameplay fallback, unified Solo + Online Kronox Puan with Online
winner +15, loser -6, no speed bonus, economy idempotency guards, and private
identifier display. Immutable Kronox ID static coverage checks backend
assignment/backfill, client-input rejection, guest-to-account preservation,
Profile Info read-only/copy display, internal friend/Online/leaderboard
dual-writes, tombstone non-reuse, and public output stripping. Focused
presence, player-selection, and friend-add
coverage protects PlayerPresence owner binding, GuestProfile token proof, 75s
TTL / 25s heartbeat / 12s visible refresh, accepted-friend lookup, online
friend / online non-friend / offline friend ordering, opaque target refs,
username-only labels, offline fallback, previous-row preservation,
current-user heartbeat wiring, backend-only invite target resolution,
email-or-username friend add,
server-side username resolution, required username-not-found copy, reverse-pending
expiry safety, Add Friend and Leaderboard double-submit suppression,
function-level FriendRequestOperationLock race hardening, and no target-email
return on username add or player selection. Executable reducer
coverage now protects Online 4-player representation/start/recovery
transitions and notification transient-empty, terminal, dismiss, accept/reject,
dedupe, and privacy transitions. Mağaza performance/readiness coverage requires
idle route/inventory warm-up, fast UserJokerInventory reads before starter
self-heal, explicit Satın Al readiness, and parallel starter repair in the
purchase function while preserving server-authoritative price/idempotency.
Liderlik performance/score-storage coverage requires idle Leaderboard
chunk/snapshot warm-up, projection-only fast reads, cached-row rendering while
refetching, deferred friend enrichment, and materialized kronox_puan_total as
the primary visible score read path. App startup fast-path coverage requires
direct Home shell import, cached GuestProfile repeat-launch support, post-paint
AuthContext maintenance, deferred presence/invite/category modules, idle
Market/Liderlik warm-up, and delayed Daily Wheel/Daily Quest status refresh.
Solo joker inventory merge coverage now executable-checks that Kart Değiştir,
Kronokalkan, and Zaman Dondur decrement only the selected joker, preserve
untouched counts through partial mutation payloads, avoid double-spend on
idempotent retries, and keep guided tutorial demos separate from real inventory
spend.
Transient UI timer cleanup coverage now guards ref-owned timeout cleanup for
Friends success notices, Online lobby auto-trim/copy-code feedback, and debug
copy controls; live navigation/unmount profiling remains manual proof.
Security Pass 3 coverage protects accessible
loading/status semantics, labeled custom modals, profile/onboarding form
feedback semantics, incremental unused-import lint behavior, the menubar
displayName cleanup, and the scoped admin-auth / SimulationPanel cleanup
decision. Admin inactive guest username cleanup coverage protects the
AdminUser-gated dry-run/confirm/delete contract, server-side eligibility
recheck, username release, audit log, no automatic scheduler, no
linked/scored/social/missing-last-open deletion, and no private identifier
response. Question analytics reset coverage requires the Admin card to list
report names, actual source tables, Joker/rhythm sub-reports, and protected
non-reset data instead of a dense paragraph. Home CTA coverage requires OYNA /
dynamic Seviye X from canonical Solo progress, direct-start to the resolved
Solo level, equal dimensions with ONLINE KAPIŞMA, and Online remaining
Home-owned. Two-account, realtime, push,
RLS/BOLA, keyboard/screen-reader,
device, and store proof remain manual/live probes.
The Online lobby/start/reconnect contract remains an architecture target and
manual live-proof area even when reducer/static Health checks pass.
Static Health coverage now exists for the strongest current UX contracts:
Profile/Settings route ownership, BottomNav ownership, own leaderboard-row
navigation, global avatar propagation with safe public avatar fields, public identifier privacy with no email/provider/owner/raw guest/internal identifiers, Solo/Online active question long-word
fit, focused visual scope, heavy-effect manual proof gates, Timeline visual safety, and asset/readiness
docs. Manual proof remains required for mobile route walkthrough, PWA/native
wrapper navigation, real touch drag, failure-injection UI timing, avatar visual
proof across leaderboard/friends/lobby/invites/header, low-end Android/WebView
smoothness, and bundle/device image-decode behavior.
`;

export const DB_REPORTING_READINESS_DOC = `# Kronox DB Reporting Readiness

Status: reporting-readiness audit.

Future reports include DAU/WAU/MAU (DAU / WAU / MAU), new vs returning users,
guest vs linked users, Solo level funnel/pass/fail/moves/time, Solo record
counts, daily reward claims, joker earn/spend/purchase, Diamond balance
changes, leaderboard movement, category preference distribution, question
exposure/difficulty, Online lobby lifecycle, invite lifecycle, notification
lifecycle, platform split, retention cohorts, admin user-report aggregates, and
economy fraud/race anomalies. Missing event tables must be backward-compatible
and privacy-safe.
Daily reward claim reports should keep first-login account-link rewards distinct
through DiamondTransaction.source first_login_reward.

Leaderboard reads use the materialized SoloLeaderboardEntry.total_kronox_score
projection first. The fast player-facing Liderlik path may skip bounded
User.kronox_puan_total repair and friend enrichment so top rows can render from
projection/cache; repair remains a bounded server-side maintenance or fallback
path and never returns full User rows.
The approved Liderlik UI no longer renders top Puan/Seviye/Elmas stat cards,
the old unified-score helper sentence, or the removed friends empty area. It
keeps the centered trophy + LİDERLİK heading, scrollable ranking rows, shared
KronoxAvatar rendering, username-only public identity, and a fixed Senin Sıran
card above BottomNav using the same materialized visible Puan source. The
current player's public row, fixed Senin Sıran card, and fallback own-score
state are normalized through one totalKronoxScore value sourced from
getKronoxVisibleScore and do not reconstruct historical score transactions on
Leaderboard load.

Unified Kronox Puan is the player-facing score source: Solo contributes the
Solo best-score component and Online contributes User.online_progress.score.
Online match scoring is flat and unified: winner +15 Kronox Puan, loser -6
Kronox Puan with checkpoint protection, and no Online speed bonus. Online
result writes use OnlineMatchResult per-user/lobby idempotency plus
User.online_progress / kronox_puan_total projection updates; elapsed seconds
are audit/display only and do not change the Online score delta.
Visible score reads prefer the materialized kronox_puan_total projection when
present, with derived Solo+Online computation only as a compatibility fallback
for older rows.

Admin User Report Phase 1: Kullanıcı Raporu is AdminUser-gated, read-only, and
aggregate-only. It counts distinct valid username across User and GuestProfile,
logged-in users from User email/user_email server-side only, guest-only
GuestProfile usernames, users with >0 Kronox Puan from
SoloLeaderboardEntry.total_kronox_score plus safe kronox_puan_total repair,
inactive 10+ day users from server-written last_app_open_at / last_seen_at,
unknown/no-last-open users separately, new users in 7 days, active users in
1/7/30 days, coarse app_platform iOS/Android/Other/Unknown, and aggregate
kronox_user_id coverage counts only. The report does not delete users, mutate
score/economy data, return raw rows, expose raw Kronox IDs, email, provider ID,
owner_key, raw guest_id, internal player_key, or start cleanup policy.

Admin Inactive Guest Username Cleanup Phase 1: cleanupInactiveGuestUsernames is
AdminUser-gated, dry-run first, manually confirmed with SİL plus unchanged
preview count, and re-runs eligibility server-side before deleting anything.
Eligibility requires server-written last_app_open_at / last_seen_at older than
10 days, known score exactly 0, GuestProfile.status=guest with no linked
account evidence, no accepted friends, no pending social/game invite or active
lobby relation, no fresh presence, and no positive Diamond balance. Missing
last-open, ambiguous score, linked/login evidence, score > 0, friends/social
relations, active presence/lobby state, or economy balance blocks deletion.
Confirmed cleanup deletes only the eligible GuestProfile username source, that
guest-owner zero-score SoloLeaderboardEntry projection, and guest-owner
presence rows; it tombstones the deleted kronox_user_id and does not delete
User rows, auth/provider accounts, Diamond/Joker ledgers, questions,
categories, or unrelated analytics. Responses and UI must not expose email,
provider ID, owner_key, raw guest_id, internal
player_key, auth IDs, or unsafe Base44 row IDs. AdminMaintenanceLog records safe
aggregate preview/execute metadata only.

recordAppOpen writes latest app-open support using server time. Authenticated
users are derived from auth.me and updated through base44.auth.updateMe; guests
require guest_id + raw guest token proof against GuestProfile.guest_token_hash.
The function writes last_app_open_at, last_seen_at, and coarse app_platform
only. Client timestamps are ignored, frontend calls are best-effort/throttled,
and no precise device identifier or fingerprint is stored.

Question analytics manual reset remains manual DB maintenance only; function
reset is disabled. The reset card maps Kategori Bazında Gösterim to
QuestionAttemptEvent, PlayerQuestionDailyExposure, Question, Category, and
UserCategoryPreference; anonymous most-shown and repeat-risk reports to
PlayerQuestionDailyExposure plus Category labels; top-shown and most-wrong
reports to QuestionAttemptEvent plus current Question/Category labels; Joker
Kullanımı Analizi to QuestionAttemptEvent plus protected JokerTransaction and
UserJokerInventory signals; and Oynanma Zamanı ve Kullanım Ritmi to
QuestionAttemptEvent plus protected DiamondTransaction and DailyWheelSpin
activity notes. Manual reset clears QuestionAttemptEvent,
PlayerQuestionDailyExposure, and populated QuestionStatsProjection /
CategoryStatsProjection rows; PlayerQuestionExposure is optional anti-repeat
memory reset. It must not delete Question, Category, User, GuestProfile,
PlayerProfile, UserCategoryPreference, UserJokerInventory, JokerTransaction,
DiamondTransaction, Daily Wheel, Daily Quest, leaderboard, score, progress,
gameplay, or economy records.

Online Presence Operational Contract: PlayerPresence is operational state, not
a public analytics table. updatePlayerPresence derives linked actors from
auth.me and guest actors from guest_id + raw guest token proof against
GuestProfile.guest_token_hash, then writes server-owned last_heartbeat_at and
presence_expires_at. Freshness uses a 75 second TTL, the frontend sends a 25s
visible heartbeat and 12s visible presence refresh, explicit offline writes are
session-scoped, public responses return username/status/opaque refs only, and
Base44 index/unique proof remains manual.

Online player selection / invite reporting Phase 1 uses existing GameInvite
rows with invite_target_ref, recipient_relation, and created_source metadata.
Public reports may aggregate by day/status/relation/source, but must not
export from_email, to_email, user_email, raw target_ref, provider ID,
owner_key, raw guest_id, internal player_key, or full question data.

FriendRequest Duplicate / Expiry Guard Phase 1 uses a backend-owned
FriendRequestOperationLock for friend_request_send races because the repo does
not prove Base44 unique/index schema syntax for active FriendRequest rows.
sendFriendRequest creates a TTL lock, re-reads active locks, selects one
canonical winner, marks expired locks stale, and returns
FRIEND_REQUEST_IN_PROGRESS or the open-invite warning to duplicate sends. The
manual proof checklist covers Leaderboard sends, Add Friend username/email
sends, open duplicate warning, expired invite cancel/delete before resend,
delivery failure preserving the row, parallel rapid submits creating at most
one pending FriendRequest, and no email/provider/owner/raw guest/internal player/lock identifiers in public UI, client responses, or exports.

SoloLevelAttemptEvent Phase 1 defines actor_key_hash, player_type, level,
rules_version, passed, used_moves, elapsed_seconds, stars,
correct_placements, evaluated_moves, joker_used_summary, created_at/day, and
source. Public reports/export must include no email, no provider ID, no
owner_key, no raw guest_id, no internal player_key, no full question bank, and
no answer years / correct answers. Runtime writes are deferred until a
backend-owned best-effort function path with idempotency key handling is
implemented and Health-covered.

Economy Race Reporting Phase 1 adds EconomyOperationLock as an admin-only
operational guard. Future EconomyIdempotencyEvent reporting should use
anonymized actor hash, operation scope, hashed idempotency key, lock result,
duplicate-attempt counter, ledger consistency result, server-owned
balance_after, created day, and coarse source. Public reports/export must
include no email, provider ID, owner_key, raw guest_id, raw guest token, or
internal player_key. DB unique/index proof remains manual for DiamondTransaction,
JokerTransaction, DailyWheelSpin, UserJokerInventory, and active
EconomyOperationLock keys.
`;

export const VISUAL_ASSET_READINESS_DOC = `# Kronox Visual Asset Readiness

Status: asset pipeline readiness note.

Kronox can add higher-quality visual assets without starting a visual redesign:
card art, backgrounds, store screenshots,
icons/splash assets, responsive high-density variants, lazy/preload strategy,
asset naming, fallback behavior, and future CDN/storage planning. This pass makes
no full visual redesign. Assets must not include secrets, private identifiers, or
the full question bank, and must preserve mobile performance.
`;

export const UX_QUALITY_GUARDRAILS_DOC = `# Kronox UX Quality Guardrails

Status: AI-assisted UX audit guardrails.

This document is adapted guidance, not vendored skill content. It translates
Taste Skill inspiration into Kronox-specific rules and does not copy external
SKILL.md content into Kronox.

Kronox is a mobile-first social timeline trivia game with dark navy fantasy /
arcade identity, blue/gold heroic surfaces, readable Turkish copy, strong
numbers, thumb-safe controls, and low-end Android/WebView-safe performance.

Do not start a full visual redesign unless explicitly requested. Do not start a
framework, routing, Tailwind, animation-library, Base44, adapter, gameplay-rule,
Solo/Online logic, or question-bank exposure migration during focused UX polish.

Profile > Profil Bilgileri owns username, optional private profile fields,
Kategori seçimi, and the current player's read-only/copyable Kullanıcı ID.
Hazırlanıyor is a temporary loading state only; if the ID cannot be
loaded/backfilled, the row shows a safe retryable error instead of staying on
loading copy.
Settings owns privacy, account, and app preferences rather than category
gameplay selection. BottomNav remains exactly \`Ana Sayfa\`, \`Liderlik\`, \`Profil\`, and Online remains Home CTA-owned.

Public identity is username only. Do not render email, provider ID, owner_key,
raw guest_id, kronox_user_id, internal player_key, raw guest token, answer
years, correct answers, or full question bank content in public UI.
Safe profile avatars may appear in public rows only as avatar_type,
avatar_icon_id, avatar_color_id, and https avatar_url visual metadata; username
remains the public identity.

Prefer transform and opacity for animation. Avoid layout-heavy animation,
repeated blur loops, and large glowing stacks around gameplay. Do not introduce GSAP, Motion, or a new animation library unless a future task explicitly
approves the dependency and validates bundle/performance impact. Low-end Android/WebView smoothness is a release proof concern, not something static
Health can prove.

Health is a contract guard. It is not release proof. Static checks can verify
source contracts for route ownership, public identity, long-word fit, visual
scope, and heavy-effect gates, but real mobile/device/gameplay confidence still
requires manual proof.
`;

export const PROFILE_FIELDS_DOC = `# Kronox Profile Fields

Status: Active profile/onboarding contract.

- Puan uses the shared visible Kronox Puan helper.
- Seviye uses the same Solo progress helper as the Solo level path.
- Elmas uses persisted User.diamonds through the shared Diamond display helper.
- Joker Çantası uses UserJokerInventory current balances through getUserJokerBalances; JokerTransaction is ledger/audit only and is not a Profile render-time balance source.
- User Category preferences are Solo-only soft 70/30 weighting input when at least 3 active valid preferences exist. Empty or fewer-than-3 preferences use all active categories for Solo. Online question selection is not affected. Kategori seçimi is edited from Profile > Profil Bilgileri for authenticated users through UserCategoryPreference; Settings owns privacy/account actions instead.
- GuestProfile public identity uses username; display_name is only a legacy/internal projection mirror and is not a public fallback identity. Email, Google ID, Apple ID, provider UID, raw guest id, kronox_user_id, internal owner_key, and internal player_key values are not public display names outside the current player's own Profile Info support row.
- Profile avatar is public visual metadata only: avatar_type, avatar_icon_id, avatar_color_id, and https avatar_url may propagate to leaderboard, friends, Online player selection, lobby, invites, notifications, and header rows; username remains the public identity.
- GuestProfile is app-owned; Firebase anonymous auth and Base44 anonymous auth are not used. Default username format is KronoxUser#### / KronoxUser#####.
- Profile > Profil Bilgileri exposes username plus optional private age_group and gender for guest and authenticated users, and may show the current player's immutable kronox_user_id as read-only/copyable Kullanıcı ID. The Profile Info row actively ensures/backfills the ID for the current owner; Hazırlanıyor is loading-only and failure shows Kullanıcı ID hazırlanamadı with retry. The Profile landing routes Profil Bilgileri, Arkadaşlarım, and Ayarlar to dedicated screens; Gizlilik Politikası and Hesabı Sil live under Settings, with signed-in deletion still guarded by the in-app confirmation flow. age is a legacy/private compatibility field; current Profile edit UI collects age_group only and does not ask for exact birthdate or exact age. age, age_group, gender, and kronox_user_id are private/support fields only and must not appear in public leaderboard rows, public projections, scoring, matchmaking, Solo category weighting, or Online game selection. getSoloLeaderboard returns sanitized username plus opaque leaderboard_id and strips owner_key/display_name/email/provider ids/raw guest id/kronox_user_id/internal player_key; completed guests can open Liderlik and appear only as username.
- Guest account linking is implemented through linkGuestAccount and belongs under Profile. It preserves guest Diamonds, Daily Wheel/Daily Quest guard fields/history, leaderboard username identity, category preferences, progress, and inventory where applicable. Home / Ana Sayfa must not render Google, Apple, email, Hesabını bağla, or progress-protection account-link prompts. The first-launch welcome may show only Hesabım Var as a secondary route into the Profile account-connection card; it must not duplicate Apple / Google / Email buttons.
- Guest onboarding Phase 2 status values include guest_created, tutorial_in_progress, tutorial_completed, profile_setup_pending, category_setup_pending, and onboarding_complete.
- Eğitime Devam is valid only for true resumable tutorial_in_progress state; stale tutorial_in_progress cannot override tutorial_completed, profile_setup_pending, category_setup_pending, or onboarding_complete.
- The profile setup step follows the guided first Solo level, shows username plus optional age/gender, and Kategorilere Geç must either advance to category_setup_pending after a successful save or show a visible retryable error.
- The category setup step stores optional guest selected_category_ids. Fewer than 3 selections show guidance but guest play remains possible. Empty guest selections mean all active Solo categories remain eligible.
- Guest category save requires guest_id + raw guest token ownership proof. Category save failure shows Kategoriler kaydedilemedi. Lütfen tekrar dene.
- Guest category loading uses current safe Category metadata directly or through getCategoryMetadata, never raw question-bank reads and never a stale hardcoded seed fallback.
- getCategoryMetadata is metadata-only and returns category_id, name, description, and status from current active Category rows.
- The category completion CTA label is exactly Ana Sayfa. A successful guest category save writes category_setup_status = completed and onboarding_status = onboarding_complete, then routes directly to Ana Sayfa.
- Onboarding completion must not show Google / Apple / Email account-link buttons; guests can later open Profile if they want to secure progress. The first-launch Hesabım Var entry is the only onboarding account-recovery link and it routes to Profile instead of starting provider auth inline.
- On app restart, onboarding_complete or safely repairable completed category/profile state opens Ana Sayfa instead of returning to the blue onboarding shell.
`;

export const MOBILE_VISUAL_GUARDRAILS_DOC = `# Kronox Mobile Visual Guardrails

Status: Active manual visual/platform release gate.

- Verify 320px width, common iPhone widths, Android Chrome widths, tablet, and foldable/resizable layouts.
- No horizontal page overflow on Home, Game, Solo map, Profile, Settings, Friends, Liderlik, Market, Daily Wheel, Daily Quest Management, Privacy, and Health Center.
- Use safe-area padding around top bars, bottom CTAs, sheets, and BottomNav.
- Touch targets stay reachable and readable with system font scaling.
- Keyboard focus does not hide form actions or trap scroll.
- In-app pinch/page zoom is disabled globally by the app shell; viewport scale remains 1 across routed Kronox screens.
- The zoom guard targets scale gestures only and must not block one-finger Solo drag/drop, timeline horizontal scroll/auto-scroll, normal scrollable panels, BottomNav taps, form inputs, or modals.
- Pull-to-refresh/overscroll guards are scoped to the relevant container or active gameplay drag only.
- Reduced motion keeps functional feedback without relying on long animations.
- Loading/error/retry states are local to the affected section when possible.
- Health Center report actions, case details, copy buttons, clipboard fallback textarea, manual proof details, and raw JSON preview must fit narrow mobile widths without horizontal overflow.
- Direct URL routes load correctly in installed/standalone and browser modes.
- Browser/PWA/WebView zoom prevention is web-owned in index.html plus the root app-shell zoom guard; native Android/iOS wrapper files are not edited for this contract.
- Service worker/cache updates do not leave stale question/runtime bundles after a question-set or function contract change.
- Push notification UI is feature-detected and remains optional.
- Offline UI is shown only for real offline or failed fetch plus no usable cache.
- Final App Store icon proof is the exported IPA / WixOneApp.app, not only source PNGs.
- npm run check:ios-icons is required before archive upload, but App Store Connect validation remains the final proof.
- Safari/PWA drag, safe-area, keyboard, home-indicator, pinch/double-tap zoom rejection, and back navigation behavior require real-device proof.
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
- getQuestions serves an authenticated bounded server attempt candidate buffer for signed-in Solo and an explicit capped guest_gameplay_runtime minimal deck for first-time guest Solo; admin/full-bank/diagnostics still require active AdminUser owner/admin authorization. Authenticated candidate reads are bounded to 96 * 3 = 288 rows per active category/query variant before projection.
- startLobbyGame requires authenticated host, no legacy guest, no client identity override.
- sendFriendRequest requires authenticated user context, resolves email or username targets server-side, checks self/friend/open-pending guards under FriendRequestOperationLock, requires deletion of expired outgoing invites before resend, sets FriendRequest.expires_at at least 72 hours after creation, keeps open reverse-pending requests actionable through Gelen İstekler, ignores/expires stale reverse-pending rows, creates the FriendRequest row before SendEmail, treats email delivery failure as a soft failure that does not roll back the request, stores username-safe labels, and never returns the target email for username-based add. FriendRequestOperationLock is a function-level guard, not DB unique/index proof.
- Online non-friend game invites use opaque target_ref values in the client. createGameInvitesForTargets resolves target refs backend-side to routable recipients, while public player-selection, lobby, invite, notification, and push payloads use username-safe labels and never expose target email, provider IDs, owner keys, raw guest IDs, or internal player keys.
- DailyWheelSpin, GameInvite, and FriendRequest direct client create is not part of the secure product contract. Their RLS create rules allow only admin/service-role writes; callers must use claimDailyWheelReward, linkGuestAccount, createGameInvitesForTargets, or sendFriendRequest so the backend derives the actor, validates guest-token proof where applicable, and returns only privacy-safe response shapes.
- Security Pass 1 pins @base44/sdk exactly at 0.8.34 and aligns Base44 Deno function imports to npm:@base44/sdk@0.8.34. Do not reintroduce frontend ^ SDK ranges, unversioned function SDK imports, or npm:@base44/sdk@0.8.25 without a documented Base44 runtime compatibility split.
- User/admin/question markdown is not rendered as raw HTML. react-markdown is not a runtime dependency, rehype-raw is forbidden for user/content markdown, and dangerouslySetInnerHTML must not be used for user-generated, backend-provided, or markdown-provided content. Static generated CSS should use guarded text children instead of raw HTML injection.
- The remaining Base44 access_token URL/localStorage pattern is a known Base44-managed auth pattern; current mitigation keeps access_token removed from the URL immediately, avoids token logging/rendering, and avoids a custom token store.
- Service-role usage is scoped to admin/maintenance backend functions.
- VAPID private key remains a real secret and must stay secret-managed.
- Backend push config requires VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, and VAPID_SUBJECT or their KRONOX_ compatibility names.
- VAPID_PRIVATE_KEY is server-only and read from backend deployment secret/env only; scanner findings that only flag the env var name are deployment-secret management notes unless real key material is present. It is never logged, returned, sent to the client, exposed through VITE_, or included in raw error/stack responses.
- Health/security triage classifies env-sourced VAPID_PRIVATE_KEY deployment verification as MANUAL_REQUIRED/warning; it is a blocker only if key material is hardcoded, exposed through VITE_, logged, returned, or included in raw errors.
- Required triage wording: VAPID_PRIVATE_KEY is server-side env/secret sourced. Production secret manager verification is MANUAL_REQUIRED.
- Release operators manually verify the Base44 production secret manager/env contains the intended VAPID_PRIVATE_KEY, no default/placeholder key is active, and rotation is completed if exposure is suspected.
- VAPID_PUBLIC_KEY is public by design for browser subscription but remains public-by-design/config-managed, not hardcoded.
- VAPID_SUBJECT is deployment-controlled contact/config metadata and must not be hardcoded as a source fallback or logged unnecessarily.
- VAPID_SUBJECT uses a mailto: or https:// subject and VAPID keys are non-empty base64url-style deployment values.
- Missing, blank, whitespace-only, placeholder, empty-string, hardcoded, dummy, or VITE_ backend VAPID fallbacks are forbidden.
- VAPID private key values are never logged, returned, printed in Health, or exposed through frontend VITE_ variables.
- Missing VAPID config is reported explicitly as vapid_config_missing / missing_vapid_config with pushSent:false, pushSkipped:true, missingConfig:true, vapidConfigured/vapidConfigValid booleans, skippedReasons, failedReasons, subscriptionCount, and safe counts; it does not return VAPID values and does not break in-app invite flow.
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
- Profile normal-user actions include screen-navigation rows for Profil Bilgileri, Arkadaşlarım, and Ayarlar; privacy/account-deletion actions live under Settings.
- Active AdminUser owner/admin users additionally see Admin Ekranı on Profile.
- Admin Ekranı contains admin-only maintenance/report tools, including Günlük Çark Reset for Kronox User ID-targeted Daily Wheel testing resets; Settings remains account/security focused.
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
- App Store Guideline 4.8: when third-party login is offered, the Profile login surface must expose Sign in with Apple / Apple ile devam et through Base44 auth alongside Google. Base44 Settings -> Authentication -> Apple toggle is a manual deployment step; no Apple client secret or native credential belongs in source.
- Manual Required / P0 release gate: physical Apple parity must be proven on a physical iOS/TestFlight/App Store build before iOS/App Store release. Sign in with Apple must be visible wherever Google login is offered; static repo checks are not enough and must not be treated as automated proof.
- UserJokerInventory stores current balances for mistake_shield, card_swap, and time_freeze.
- JokerTransaction stores the append-only joker grant/spend ledger.
- ensureUserJokerInventory grants 3 Kronokalkan, 3 Kart Değiştir, and 3 Zaman Dondur once per authenticated user using starter_jokers:<email>:<joker_type> idempotency keys; missing or partial UserJokerInventory rows self-heal, existing balances are preserved, owner email is normalized, and duplicate/malformed rows do not crash Joker Çantası.
- spendUserJoker spends one owned Solo joker using authenticated user context, positive-balance validation, Solo-context validation, deploy-safe UserJokerInventory/JokerTransaction entity fallback, reason solo_use, source solo, quantity_delta -1, safe user-facing errors, and an idempotency key.
- spendUserJoker uses EconomyOperationLock, post-lock idempotency recheck, and a fresh UserJokerInventory read before decrementing; guided/tutorial joker demos remain tutorial-only and do not spend real inventory.
- Profile shows only Joker Çantası balances; normal users must not see other users' balances or transaction ledger rows.
- Mağaza Phase 1 purchases use purchaseJokerWithDiamonds; users purchase only for themselves, backend owns trusted joker prices, sufficient Diamonds are validated server-side, and successful purchases write DiamondTransaction plus JokerTransaction with market_purchase.
- Mağaza purchases are server-authoritative economy actions: the client is not trusted for price, cost, user identity, or target account; service-role writes stay scoped to the authenticated user.
- Mağaza purchase idempotency keys, EconomyOperationLock, refreshed server balance reads, and post-lock ledger rechecks protect double-tap/retry/concurrent request flows; real two-device/backend race proof remains manual unless Base44 uniqueness is proven.
- Mağaza Phase 1 does not expose bundles, subscriptions, cosmetics, random boxes, ads, external payments, or Online-mode joker purchases.
- Daily Quest Definition management UI is removed from Profile / Admin Ekranı; runtime no longer depends on Admin-created quest definitions.
- createDailyQuestDefinition is a Base44 callable with an inline AdminUser-backed guard for active owner/admin rows; normal users and disabled admins are rejected.
- DailyQuestDefinition title and description are display-only; quest_type plus target_value are the executable logic contract.
- DailyQuestDefinition.quest_key is the logical unique key for legacy/manual cleanup paths. Runtime does not list, seed, or select definition rows; explicit legacy seed/create skips or rejects existing keys. Existing duplicate rows require manual cleanup after backup, not automatic deletion.
- Supported active Daily Quest runtime quest_type value is solo_level_complete.
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
- Manual DB reset path after question pool replacement clears QuestionAttemptEvent, PlayerQuestionDailyExposure, and any populated QuestionStatsProjection/CategoryStatsProjection manual aggregate rows. Projection tables may be empty because the active 9-section report computes history from raw QuestionAttemptEvent rows.
- PlayerQuestionExposure is optional reset scope only when per-player anti-repeat memory should restart; clearing it resets the same-player question freshness memory.
- Manual reset must not delete Question, Category, SubCategory, User, GuestProfile, PlayerProfile, UserCategoryPreference, UserStatsProjection, UserJokerInventory, JokerTransaction, DiamondTransaction, progress/economy/leaderboard data, Daily Wheel/Daily Quest rows, users, or AdminUser.
- Do not delete Question, Category, SubCategory, User, GuestProfile, PlayerProfile, UserCategoryPreference, UserStatsProjection, UserJokerInventory, JokerTransaction, DiamondTransaction, progress/economy, leaderboard, Daily Wheel/Daily Quest, users, AdminUser, or gameplay rows during question analytics reset.
- manual question analytics reset does not delete Question, Category, SubCategory, user/guest/player profiles, UserCategoryPreference, UserStatsProjection, score/progress/economy, leaderboard, Daily Wheel/Daily Quest, users, AdminUser, or gameplay rows.
- Joker Kullanımı Analizi may be ledger-derived from JokerTransaction/UserJokerInventory and is not fully reset by question analytics cleanup. DiamondTransaction and DailyWheelSpin are economy/audit rows, not question analytics reset tables. Oynanma Zamanı hour/day metrics reset through QuestionAttemptEvent timestamps.
- sendQuestionAnalyticsReportEmail handles stale/deleted question references with diagnostics and bounded sections.
- sendQuestionAnalyticsReportEmail actual sent body includes exactly Executive Summary, Kategori Bazında Soru Havuzu, Kategori Tercihleri, Kategori Bazında Gösterim, En Çok Gösterilen Sorular, Az ya da Hiç Gösterilmeyen Sorular, En Çok Yanlış Yapılan Sorular, Joker Kullanımı Analizi, and Oynanma Zamanı ve Kullanım Ritmi. Kategori Bazında Soru Havuzu includes the category-based Top 10 answer year/count table inside the same section.
- Generated email output intentionally excludes Rapor Şablonu, Rapor Bölümleri, Sistemdeki Soru Havuzu: Kategori / Zorluk Dağılımı, Kategori ve Zorluk Bazında Kayıtlı Soru Sayısı, Kategori Bazında Yıl Aralığı, and Kategori İçi Soru Analizi.
- sendQuestionAnalyticsReportEmail accepts any active AdminUser role admin/owner, sends by default to the requesting authenticated admin's normalized email, rejects mismatched recipient overrides, and the Admin Ekranı UI returns safe requestedBy, recipientEmail, template, body-marker, and emailDispatchStatus diagnostics.
- Category preference report counts are aggregate distinct-user counts only and do not expose user IDs or emails.
- PlayerQuestionExposure and PlayerQuestionDailyExposure are private per-player question exposure projections for Solo anti-repeat and anonymous coverage analytics.
- Guest exposure reads/writes require guest_id + raw guest token verification against GuestProfile.guest_token_hash; guest_id alone is not enough.
- Exposure writes are best-effort, count only active shown/replacement/tutorial cards, and do not count server candidate pools or unused buffers.
- Question Analytics may include anonymous per-player coverage only as User0001-style labels inside the existing nine-section email body; it must not print player_key, owner_key, email, provider ids, raw guest ids/tokens, or username.
- Question analytics report sections render with section-level warnings instead of truncating the whole email.
- unrelated user progress admin reset retains question analytics rows; account deletion anonymizes user-owned analytics identity.
- retained QuestionAttemptEvent analytics rows no longer contain deleted user identity after account deletion.
- UserCategoryPreference rows are user-scoped Profile Info data.
- normal users can read/update only their own preference rows.
- passive Category.status = P/p rows are not selectable.
- Any authenticated user with fewer than 3 active valid Category preferences sees an optional personalization popup; this applies to new and existing users, can be deferred, and must not block gameplay.
- The source of truth is active valid UserCategoryPreference count.
- Only active categories are selectable and count.
- Passive or removed Category selections are filtered from UI/save state and are not resaved as active preferences.
- completing the popup saves UserCategoryPreference rows before marking the user profile onboarding flag complete.
- Users can later change selections under Profile > Profil Bilgileri > Kategori seçimi.
- first-time guest onboarding can load category-selection metadata without login; the allowed public getCategoryMetadata response scope is category_id, name, description, and status from current active Category rows only.
- getCategoryMetadata is public by design for unauthenticated guest category selection and must not return questions, answers, years, full question-bank rows, user data, admin/internal fields, hidden notes, deleted/passive categories, or stale hardcoded seed arrays.
- seedQuestionCategories is removed; category creation/backfill is manual/admin content management and runtime code must not restore stale hardcoded seed arrays, QUESTION_CATEGORIES, fixed historical category ID lists, or deployable fallback names.
- Category preference writes remain separate from public metadata reads and require guest_id + raw guest token ownership proof.
- Game question loading first attempts online getQuestions when online or network state is unknown; signed-in Solo uses the authenticated bounded minimal server attempt candidate buffer, first-time guest Solo uses only the explicit capped guest_gameplay_runtime minimal projection, empty local cache is not offline, stale cache is invalidated by question-runtime-v10-solo-architecture, Retry re-fetches online, and false offline/no-cache is reserved for known offline plus failed fetch plus no usable cache. Gameplay fetches request the v2 per-category projection and server_attempt_candidate_buffer_v1 explicitly; getQuestions fetches numeric/string main_category_id and category_id variants per active Category before the bounded response cap, returns getQuestionsRuntimeMarker for both authenticated and guest modes, exposes projectionDiagnostics only for admin/debug diagnostics, reports sourcePoolCapRemoved and responseCapApplied in the response/diagnostics contract, returns an empty/retryable state instead of fallback IDs when Category read fails, and Question category fields are not capped to the original 1-6 seed set.
- Solo question selection reads current-user active valid Category preferences before attempt start when signed in. Game.jsx explicitly calls getValidActiveSelectedCategoryIds(preferences, activeCategories) in the Solo-only path. Authenticated users with no saved preferences or empty preferences use all active categories for Solo; missing authentication uses the explicit capped guest Solo projection and must not expose raw questions. Category preference save validation remains separate from gameplay start. Insufficient preferences also use all active categories for Solo. Saved preferences target 70% selected categories / 30% full eligible pool only when at least 3 active valid preferences exist; this is soft weighting with fallback. The selected-category 70% lane uses selected user categories with difficulty 1 and 2 eligible; the global 30% lane first uses all active categories with difficulty 1, then selected-category shortage or global difficulty-1 shortage fills from the broader active global pool before clean failure.
- getQuestions derives active playable category IDs from active Category rows; stale hardcoded seed-category ID subsets must not exclude newer active categories from runtime projection.
- getQuestions/category helpers accept active status aliases a, active, and aktif, and category_id normalization accepts any positive live DB id so categories added after the original seed set can enter the Solo candidate pool.
- Online question selection, getQuestions, and analytics do not read preferences for question selection. Online start uses startLobbyGame to reconcile accepted invite participants, then persist a bounded shared online_question_deck/current_question_id on Lobby, selected 100% from active lobby-selected categories with difficulty 1/2 only; missing/invalid selected categories or Category read failures must not fall back to legacy category names, Lobby.category, or old seeded arrays; Game reads/refetches that persisted deck instead of the Solo getQuestions buffer, and waiting-room clients can transition from realtime or polling if a subscription event is missed.
- two-account preference RLS proof remains manual/NOT_AUTOMATABLE.
- old UserSubCategoryPreference rows are retained but not used by the current Profile Info preference UI.
`;

export const RELEASE_PROOF_CHECKLIST_DOC = `# Kronox Release Proof Checklist

Status: Active manual release gate.

## Canonical Workflow Docs
Review docs/KRONOX_PRODUCT_WORKFLOW.md for onboarding, identity, Profile, category selection, Solo, Online, economy, leaderboard, analytics, Health, and release proof changes.
Review docs/KRONOX_TECHNICAL_FLOW.md for route flow, Base44 entities/functions, guest/account-linking state, question runtime, category metadata, exposure analytics, economy ledgers, admin/security boundaries, Health alignment, and deployment validation changes.
These docs supersede old PDF-style documents such as stale Codex040 kronox-is-akisi.pdf and kronox-teknik-dokuman.pdf references unless those PDFs are regenerated from current source.
Stale contracts such as Home login CTAs, standalone tutorial onboarding, hardcoded category fallbacks, visible HATA scoring, public display_name identity/leaderboard payloads, raw Question.list gameplay fallback, Daily Quest Puan rewards, Daily Quest leaderboard impact, Online Solo-preference selection, and old fixed 10-card Solo decks must be removed or explicitly marked legacy before release.

## Full Audit Release Gates
Health Center, Admin Ekranı, reports, and large maintenance lists avoid rebuilding expensive derived output after every row/case. Long admin work is batched or yielded around the 50ms long-task budget. Gameplay paths do not run Health/report/question-analytics calculations. Large email/report/list output stays bounded, paginated, or summarized. Health Copy Blocker JSON is intentionally blocker-only and includes real FAIL/BLOCKER/CRITICAL code/security/static failures plus summary counts, not manual-only verification reminders or the full raw PASS payload. Health Copy Warning JSON is warning-only. Manual Required / NOT_AUTOMATABLE does not reduce automated score; critical manual gates keep releaseReady=false until completed or accepted. Last Run and copy/download actions use the newest completed report only. Health mobile report actions, case details, copy buttons, clipboard fallback textarea, manual proof details, and raw JSON preview must fit 320px-class screens without horizontal overflow. User-owned backend operations enforce object-level authorization server-side; UI hiding is not accepted as proof. Two-account probes verify user-owned reads/writes for invites, lobbies, category preferences, Daily Quest progress, Daily Wheel, Diamond/Joker economy, PushSubscription, and analytics cleanup. Base44/manual DB constraints are checked for user+date, user+status, quest_key, question_id, category_id, created_at, endpoint, and idempotency_key. iOS, Android, and PWA wrapper quality remain separate manual gates: safe-area, keyboard, scroll/overscroll, back navigation, orientation, accessibility, reduced motion, 320px layout, push, icon, App Store, physical Apple parity, and Play Console proof. npm run build does not prove Base44 backend deployment, RLS/BOLA behavior, device gestures, push delivery, final IPA icon state, physical Apple parity, or Play Console wrapper quality.
npm run check:base44-functions must run before Base44 Save & Deploy to catch function syntax, duplicate declarations, deploy-risk _shared imports, committed email literals, and getQuestions marker/projection diagnostics before manual backend publish.

## Solo v3
Normal levels need 7 correct cards with an internal 18-question deck buffer; special levels
start at level 5/every 5 levels, need 10 correct cards, and use an internal
21-question deck buffer. Normal attempts use 10 evaluated moves; special
attempts use 13 evaluated moves. All attempts use a 180 seconds timer and fail
when the level-specific move limit is used before the target is reached.
Runtime consumes the deck in order. The visible in-game limit is HAMLE /
remaining moves, not HATA. The
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
Home shows Mağaza top-left with a gold storefront icon, Diamonds center,
notifications right. Mağaza title is Mağaza and prices are Zaman Dondur 40,
Kart Değiştir 50, Kronokalkan 60.
Home uses a larger centered transparent local Kronox logo, a larger centered
transparent hourglass visual balanced between left Görevler and right Çark,
compact shortcuts with ready badges, centered Görevler/Çark popups, and large
OYNA / dynamic Seviye X and ONLINE KAPIŞMA CTAs whose stack position balances
the hourglass-to-Solo gap with the Online-to-BottomNav gap; the expanded Günlük
Ödüller panel is not rendered on first Home paint. The Home primary Solo CTA
reads Seviye X from the canonical Solo progress helper and direct-starts that
resolved level; the secondary Online CTA remains Home-owned and has the same
dimensions as the primary CTA.
Client is not trusted for price; purchase validation is server-authoritative.
Market open should be fast: Home may idle-prefetch the Market chunk and fast
UserJokerInventory cache, the static Phase 1 catalog renders immediately, and
starter inventory self-heal/count refresh is non-critical for Satın Al
readiness.
Successful purchase writes both DiamondTransaction and JokerTransaction with
market_purchase and the same idempotency key. Runtime explicitly binds
UserJokerInventory, DiamondTransaction, and JokerTransaction. Double-tap, network retry,
insufficient Diamonds, and two tabs/devices proof remains manual. Market
purchase is a Diamond sink; Daily Wheel V2 can be a Diamond source and approved joker grant source. Profile
Joker Çantası and Solo joker bar must show the purchased balance; Online mode
is unaffected and Daily Wheel V2 does not use Mağaza purchase semantics.

## Daily Quest Runtime v1
Daily Quest Runtime v1 is active.
The active quest is code-owned, not Admin-definition-owned:
solo_level_complete / Solo’da Seviye Geç / Bugün 1 Solo seviyesini tamamla.,
target 1, reward 20 Diamonds. UserDailyQuestProgress stores 1 selected UTC-day
player quest from this canonical runtime contract. Authenticated users use
normalized email keys; completed guests use token-proven internal
guest:<g_owner_key> keys and persist rewards on GuestProfile.diamonds.
recordDailyQuestProgress increments only passed Solo level completion, and
Online mode does not increment Daily Quest progress. claimDailyQuestReward
grants diamonds only through DiamondTransaction.source = daily_quest_reward,
using the reward copied into the progress row rather than a client-provided
amount. Completed progress alone does not grant Diamonds; completed and
unclaimed quests expose an Al claim action. Successful claimDailyQuestReward
updates visible User.diamonds or GuestProfile.diamonds, returns diamondBalanceAfter and questStatus:
claimed, and only then marks the progress row claimed. Daily Quest does not
grant Kronox Puan and has no leaderboard impact. Daily Quest does not affect
leaderboard. Home Görevler Daily Quest copy is
"Günlük Görevleri Yap, Elmasları Kazan!" and the runtime backend functions
explicitly bind UserDailyQuestProgress for status, progress, and claim
deployability.
Günlük Görev no longer requires active DailyQuestDefinition rows; getDailyQuestStatus and
recordDailyQuestProgress do not seed definition rows on app/Home open. Runtime ignores
stale or duplicate DailyQuestDefinition rows and stops duplicate/empty DB definition bloat.
Profile / Admin Ekranı does not mount
Günlük Görev Yönetimi. getDailyQuestStatus is authenticated-or-completed-guest but not
admin-only and preserves newly created rows if immediate Base44 refresh is stale. Older
same-day rows from the previous model are retained but the Home Görevler flow displays
only the canonical solo_level_complete quest. Loading or ensuring today’s quests does not grant Diamonds;
claimDailyQuestReward remains the only reward path. \`claimDailyQuestReward\` remains the only reward path.
One claim per quest per UTC day is enforced by UserDailyQuestProgress and
daily_quest_reward idempotency keys. User/GuestProfile fields daily_quest_last_claim_date
and daily_quest_next_available_at track claim summary/reset availability only. Stale
legacy rows require manual cleanup after backup/operator approval.
Daily Wheel remains separate from Daily Quest definitions.
Daily Wheel and Daily Quest are separate.
daily_wheel:<playerKey>:<YYYY-MM-DD>
daily_quest_reward:<playerKey>:<YYYY-MM-DD>:<quest_key>

## Online Scoring Persistence
Two-account invite + scoring proof, OnlineMatchResult idempotency, winner
exactly +15, loser exactly -6 with checkpoint protection, no Online speed
bonus, and Profile/Header/Leaderboard refresh to the same persisted Kronox
Puan.

## RLS And Backend Security
Two/three-account RLS probe matrix, service-role scoping.

## Privacy Policy / App Store Privacy
Public privacy URL is https://kronoxgame.com/privacy. /privacy must be publicly accessible without login, admin status, backend data, or redirect to Home/login. The page title is Gizlilik Politikası, includes a last-updated date, and lists the configured support contact from VITE_KRONOX_SUPPORT_EMAIL when present. The policy discloses account/profile data, gameplay/progress/leaderboard data, friends/invites/social data, category preferences, optional push subscription/notification data, local storage/cache/IndexedDB use, Daily Wheel/Daily Quest/Mağaza/Joker/Diamond economy records, and question analytics/reporting data. The policy states Kronox does not sell personal data for third-party advertising and must not claim that no data is collected. Account deletion/access/correction requests are covered and must not rely on committed support email literals. App Store Connect privacy answers must match the /privacy policy and be updated whenever data collection, analytics, push notifications, social features, or economy/ledger behavior changes. App Store Guideline 4.8 remains a Manual Required / P0 release gate: physical Apple parity must be proven on a physical iOS/TestFlight/App Store build, and Sign in with Apple must be visible wherever Google login is offered. Manual proof opens https://kronoxgame.com/privacy from a fresh browser without login and confirms Turkish policy content loads on mobile.

## PWA / Push
BottomNav visible tabs are Ana Sayfa, Liderlik, and Profil only. Online is launched from Home through Online Kapışma, not from BottomNav. Switching visible tabs preserves subroute/scroll state and re-tapping the active tab resets that tab to its root while /game remains full-screen.
Home / Ana Sayfa does not show Google / Apple / email login buttons or a secure-progress / Hesabını bağla account-link card; guest account linking is available from Profile instead. The first-launch welcome may show a secondary Hesabım Var route into that Profile flow, but provider buttons must not appear on the welcome screen.
Friends, Liderlik, and Admin Ekranı maintenance lists use scoped Pull-to-Refresh wrappers that call real reload paths, respect reduced motion, and do not affect gameplay drag.
Category/Admin selection controls use Kronox bottom-sheet selectors instead of raw native HTML selects in the targeted surfaces; sheets support Escape/backdrop close, focus return, safe-area bottom padding, dark mode, and reduced motion.
iOS AppIcon PNGs must be fully opaque before App Store upload. PWA/web icons may be separate from native iOS AppIcon assets, but Wix/native wrapper generation must consume local opaque PNGs. No alpha channel, no tRNS transparency chunk, and no transparent corners are allowed. The 1024x1024 ios-marketing / large app icon must be RGB/opaque. App Store Connect error 90717 means a transparent or alpha-channel icon remains in the final \`WixOneApp.app\` icon asset. index.html, public/manifest.json, src/manifest.json, and the splash screen point at local opaque /assets/icons/kronox-app-icon-* PNGs. Base44 Generate App Store files App logo upload is also an iOS icon source; upload public/assets/icons/base44-app-logo-1024-no-alpha.png there, then click Generate Files again. App Store Connect 90717 can persist if Base44 regenerates WixOneApp.app AppIcon assets from a transparent uploaded logo, and old IPA/archive files must not be reused. Run npm run check:ios-icons before native archive upload; it validates ios/App/App/Assets.xcassets/AppIcon.appiconset/Contents.json, referenced PNG dimensions, manifest icon PNGs, forbidden transparent source references, the Base44 upload logo PNG, and no-alpha PNG metadata. After icon changes, clean the native/iOS build folder, delete stale archives, regenerate wrapper/native assets if cached, rebuild/archive, and inspect the final exported IPA or Payload/WixOneApp.app. Final release gate: validate the final \`WixOneApp.app\` icon asset from the regenerated archive/exported IPA before upload. Release execution: archive/export the iOS build after Base44 regenerates the files, then re-upload or validate in App Store Connect. If icons are compiled into Assets.car, use Xcode/assetutil or App Store Connect validation as the final proof; source-only checks must not claim the 90717 fix is proven. Real App Store Connect re-upload validation remains manual.
Push subscription works on real installed device if supported. (manual)
sendGameInvitePush requires backend VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, and VAPID_SUBJECT.
Missing or blank VAPID config returns explicit vapid_config_missing / missing_vapid_config diagnostics.
No empty-string, dummy, hardcoded, or VITE_ private-key fallback is allowed.
Safe VAPID-missing diagnostics use pushSent:false, pushSkipped:true, missingConfig:true, reason:vapid_config_missing, vapidConfigured/vapidConfigValid booleans, skippedReasons, failedReasons, subscriptionCount, and counts only.
VAPID_PRIVATE_KEY remains backend-env-only and is never logged or returned; env-var-name scanner findings are deployment-secret management notes unless real key material is exposed.
VAPID_PRIVATE_KEY is server-side env/secret sourced. Production secret manager verification is MANUAL_REQUIRED.
VAPID_PUBLIC_KEY is public-by-design/config-managed, and VAPID_SUBJECT is contact/config metadata that must not be logged or returned unnecessarily.
In-app invites remain functional if push is not configured.
Friend/game invite notifications use public username labels only, preserve valid pending rows through transient empty refreshes, and close only on explicit user action, terminal status, expiry, or confirmed source invalidation.
npm run build does not prove backend VAPID secret deployment; real push delivery requires a subscribed device and deployed backend secrets.

## Android 15 Edge-To-Edge
Play Console reports Window.setStatusBarColor / Window.setNavigationBarColor
deprecations from the native wrapper. Upload a new AAB and verify edge-to-edge
behavior. Do not mark this complete from static Health alone.

## Android Large-Screen / Orientation / Resizability
Verify tablet, foldable, and resizable behavior in Play Console and on device.
Do not mark this complete from static Health alone.

## Profile Info Category Preferences
Profile > Profil Bilgileri shows Kategori seçimi for authenticated users. Active Category
rows load as selectable interests, passive rows are hidden, users must select
at least 3 Category interests. There is no maximum selection. Preferences are
persisted per user in UserCategoryPreference. Solo question selection targets
70% selected user categories and 30% full eligible pool. The selected-category
70% lane uses selected categories with difficulty 1 and 2 eligible; the global
30% lane prefers all-active difficulty 1 and broadens safely if short. Online question
selection is not affected by preferences and uses startLobbyGame's persisted
shared online_question_deck/current_question_id from accepted-roster-reconciled,
active lobby-selected difficulty-1/2 categories. Waiting-room clients may
recover from a missed realtime event by polling/refetching the Lobby.
Any user with fewer than 3 active valid
Category preferences sees an optional popup, including new and existing users.
The source of truth is active valid UserCategoryPreference count, only active
categories are selectable and count, passive or removed Category selections are
filtered from active UI/save state, completion prevents repeat prompts only while
the user still has 3 or more active valid preferences, and Users can later change
selections under Profile > Profil Bilgileri > Kategori seçimi. First-time guest onboarding
loads category metadata without login through current Category rows or
getCategoryMetadata. The public getCategoryMetadata response contains only
category_id, name, description, and status, and must not include questions,
answers, years, full question-bank data, user data, admin/internal category
fields, passive/deleted rows, or stale hardcoded fallback arrays. Guest
category preference save is a separate guest_id + raw guest token write proof.
Authenticated users with
no saved preferences or empty preferences use all active categories for Solo;
missing authentication uses the explicit capped guest Solo projection and must
not expose raw questions. Category preference save validation remains separate from gameplay
start. Insufficient preferences also use all active categories for Solo.
SubCategory entity still exists, but Profile Info currently uses Category interests.
The Profile Info Category preference surface is custom touch UI with no raw native select in the targeted section; save validation and user scoping remain unchanged.
Mobile wrapping/long-name visual proof and two-account preference RLS proof
remain manual/NOT_AUTOMATABLE.
`;

export const CATEGORY_TAXONOMY_DOC = `# Kronox Category Taxonomy

Status: Active product contract.

category_id is the single canonical live field. Current active Category rows
are the category-selection source of truth. Original seed names are historical
seed-helper references only and must not be rendered as onboarding fallback
categories when live metadata is unavailable.
`;

export const DB_ARCHITECTURE_DOC = `# Kronox DB Architecture

Status: Implementation tracking doc.

- DB gateway modules wrap entity access.
- Analytics entities: QuestionAttemptEvent, PlayerQuestionExposure,
  PlayerQuestionDailyExposure, QuestionStatsProjection, UserStatsProjection,
  CategoryStatsProjection.
- Leaderboard projection: SoloLeaderboardEntry.
- cleanup/retention jobs are status-transition-first.
- Base44 index/unique-key declarations are a platform/manual configuration gap.
- Runtime uniqueness proof remains manual/NOT_AUTOMATABLE.
- Hot UI paths read current-state tables/projections directly and must not sum append-only ledgers or scan full analytics history during render.
- Admin/Health/report paths may process larger datasets, but they should batch, paginate, cap output, or yield work so long JavaScript tasks do not block the app shell.
- Gameplay must not run Health, report, projection refresh, cleanup, or aggregate maintenance jobs.
- Service-role functions bind every user-owned object to authenticated user/admin context before reading, writing, updating, or deleting it.
- If Base44 cannot enforce a DB-level unique/index constraint, the service layer remains responsible for idempotency and duplicate detection.
- EconomyOperationLock is a function-level TTL/stale-recovery guard for player economy mutations; it reduces parallel read-modify-write races but does not prove DB-level atomic compare-and-swap.
- FriendRequestOperationLock is a function-level TTL/stale-recovery guard for friend_request_send duplicate races; it reduces same sender/target parallel creates but does not prove DB-level uniqueness.
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
- UserCategoryPreference stores app-open popup and Profile Info Category preferences per user; minimum 3 selections. There is no maximum selection.
- Authenticated users with no saved preferences or empty preferences use all active categories for Solo; missing authentication uses the explicit capped guest Solo projection and must not expose raw questions. Insufficient preferences also use all active categories for Solo. Saved preferences target 70% selected user categories plus 30% full eligible pool only when at least 3 active valid preferences are available.
- This is a soft weighting target with fallback, not hard filtering. The selected-category 70% lane uses selected user categories with difficulty 1 and 2 eligible; the global 30% lane first uses all active categories with difficulty 1, then selected-category shortage or global difficulty-1 shortage fills from the broader active global pool before clean failure.
- Online question selection is not affected by Solo preferences: startLobbyGame reconciles accepted invite participants, persists a bounded shared online_question_deck/current_question_id on Lobby, selected 100% from active lobby-selected categories with difficulty 1/2 only, and Game reads/refetches that persisted deck instead of the Solo getQuestions buffer.
- Any authenticated user with fewer than 3 active valid Category preferences sees an optional personalization popup; this applies to new and existing users, can be deferred, and must not block gameplay.
- The source of truth is active valid UserCategoryPreference count.
- Only active categories are selectable and count.
- Users can later change selections under Profile > Profil Bilgileri > Kategori seçimi.
- UserCategoryPreference duplicate active rows are collapsed/passivated by the save helper; platform unique-key proof remains manual.
- UserCategoryPreference RLS runtime proof remains manual/NOT_AUTOMATABLE.
- UserSubCategoryPreference rows are retained legacy data and are not the current Profile Info source-of-truth.
`;
