# Kronox Health Gap Analysis

Status: current Health gap audit.

Health is a contract guard. It is not release proof. Static checks prevent
common drift, but Online, realtime, push, mobile wrappers, RLS/BOLA, and
parallel economy behavior still require simulation or live/manual proof.
The Online lobby/start/reconnect contract remains an architecture target and
manual live-proof area even when reducer/static Health checks pass.

## Why Recent Online Failures Escaped

The recent 4-player lobby/start failure class was not primarily a missing
string. It was a race and recovery problem:

- concurrent lobby joins could overwrite roster arrays
- accepted invitees could exist in `GameInvite` rows but not be reconciled into
  `Lobby.players` before host start
- host start could freeze a stale roster
- non-host clients could miss realtime and remain in the waiting room

Earlier Health checks verified pieces of the flow, but did not tie the full
contract together as a 4-player join/start/recovery path. The current Online
lobby start regression suite now locks merge/retry joins, accepted-invite
reconciliation, idempotent start, shared deck/current question writes, and
fallback polling/refetch.

## Static Checks That Are Not Enough Alone

| Area | Static check value | Gap |
| --- | --- | --- |
| Online start | Confirms source has merge/retry/start/recovery markers | Does not simulate four live accounts or Base44 realtime delivery |
| Invite accept | Confirms `verifiedLobby`/`joinedLobby` contract | Does not prove deployed function freshness |
| Notifications | Executable merge helpers cover stale empty fetches | Does not prove push delivery or service worker behavior on real devices |
| Online presence / player selection | Confirms PlayerPresence owner binding, GuestProfile token proof for guest heartbeat and player selection, 75s TTL/25s heartbeat/12s visible refresh, accepted-friend lookup, backend-owned player selection, username-only labels, random opaque `social_*` target refs, non-routable guest row safety, safe retry copy, and offline fallback | Does not prove deployed function freshness, two-device heartbeat timing, or live non-friend invite delivery |
| Solo records | Confirms backend context and copy | Does not prove production data has multi-user records |
| Economy | Confirms idempotency guards, Daily Wheel V2 no-Puan weighted reward rules, Daily Calendar / Streak Diamond-only rules, and function-level economy lock/recheck guards | Does not prove DB uniqueness or two-device race safety |
| Leaderboard privacy | Confirms sanitized public payload shape | Does not prove live RLS prevents direct entity reads |
| Questions | Confirms no raw client `Question.list` gameplay fallback | Does not prove deployed function is current |

## Coverage Closed In This Pass

- Added architecture-audit Health coverage requiring the new audit/target,
  Health gap, DB reporting readiness, and visual asset readiness docs to stay
  aligned with the MVVM/MVI target and Base44-active boundary.
- Added a focused transient UI timer cleanup guard for Friends, legacy Online-selection, and active debug copy/notice surfaces. Timers are ref-owned, clear prior schedules, and clean up on unmount. `LobbyRoom.jsx` is redirect-only legacy compatibility and owns no copied-state timer; live navigation/unmount profiling remains manual proof.
- Updated invite navigation Health expectations to require `verifiedLobby` and
  `joinedLobby`, not the older `lobby: updatedLobby` token.
- Added executable Online lobby reducer coverage for 4-player representation,
  accepted invite handoff, shared-state-gated start, missed-realtime recovery,
  duplicate start confirmation, stale refresh protection, and expired lobby
  blocking.
- Added executable notification reducer coverage for transient empty fetches,
  subscription upserts, terminal row closure, visual-only toast dismissal,
  accept/reject closure, stable-id dedupe, and private identifier guardrails.
- Retargeted P0 false-pass cases to active source: Online result Health now
  requires backend terminal-state authority and forbids client result/score/
  leaderboard writes; invite open is nonterminal; lobby checks require linked/
  guest actor proof, fail-closed locks, max four, monotonic revision, and public
  DTO sanitization; Daily checks execute canonical distinct-key selection and
  verify backend-source provenance rather than row-count/query-before-create
  strings. The deployment suite gates 50 functions and exact SDK 0.8.34.
- Pre-Hamle 3 stabilization retargets the remaining historical direct-entity,
  email-hydration, and client-score assertions to active backend owners. Lobby
  freshness checks require sanitized poll/focus/visibility refresh; friend and
  invite checks require backend actor scope plus admin-only direct entity RLS;
  Leaderboard checks require projection-first paint followed by sanitized
  backend friend enrichment; Online result checks prove reserve-before-score
  ordering and structured retry-safe audit failure in updateLobbyGameState.
- Hamle 3 adds the runtime-connected Architecture P1 suite. It executes the
  adaptive poller overlap/backoff contract and guards production Solo reducer/
  ViewModel ownership, waiting/game DTO partition, one bounded social profile
  batch, guarded Daily projection writes, Leaderboard read purity, canonical
  linked/guest profile mapping, token-proven guest inventory visibility, Home/
  BottomNav geometry, and typecheck module-resolution progress.
- Retargeted old Joker, Online recovery, and Leaderboard cases away from exact
  call formatting and retired local counters. Replacement checks fail if fixed
  polling intervals, read-time Leaderboard publish/backfill, client-owned guest
  inventory keys, or direct inventory mutation paths return.
- Added focused friend/presence coverage so fake-online friend pickers, email
  display fallbacks, unscoped presence reads, non-current-user presence writes,
  stale heartbeat timing, missing guest token proof, transient-fetch clearing,
  and long-lived presence polling fail Health.
- Added focused friend-add coverage for email-or-username input, server-side
  username resolution, required username-not-found copy, no client `User.list`
  lookup, no target-email return on username add, and server-side self,
  duplicate, and pending-request guards.
- Added focused friend-invite lifecycle coverage for backend-owned duplicate
  open invite blocking, expired-outgoing delete-before-resend blocking, 72-hour
  friend invite expiry, reverse-pending expiry safety, shared Add
  Friend/Leaderboard handling, Add Friend and Leaderboard double-submit
  suppression, function-level `FriendRequestOperationLock` race hardening, and
  username-safe responses.
- Added focused Online player-selection coverage for online friend / online
  non-friend / offline friend ordering, completed-guest actor proof,
  `u_`/`g_` opaque target refs, non-routable guest row handling, backend-only
  invite recipient resolution, safe retry copy, and no client-visible
  recipient email/private identity fields.
- Retargeted the stale auth-only Online lobby/create-invite checks to the
  current app-player contract: logged-in users and completed GuestProfile
  users resolve through the same lobby creation path, public names remain
  username-safe, GameInvite rows are created after the lobby row exists, and
  player-list failures preserve previous safe rows while showing
  `Oyuncular yüklenemedi.` / `Tekrar Dene`.
- Added Security Pass 1 coverage for exact Base44 SDK pin/alignment, no
  `react-markdown`/`rehype-raw` raw HTML markdown path, guarded chart CSS
  generation without `dangerouslySetInnerHTML`, and Base44 access-token URL
  cleanup/no-token-logging.
- Added Security Pass 2 coverage for `EconomyOperationLock`, post-lock
  idempotency/balance/inventory rechecks, Market purchase negative-balance
  protection, Solo joker non-negative spend protection, Daily Wheel V2 weighted
  reward serialization, and Daily Calendar / Streak Diamond-only claim serialization.
  DB unique/index proof and live
  two-device economy races remain manual gates.
- Added Security Pass 3 coverage for accessible loading/status semantics,
  labeled custom modals, profile/onboarding form feedback semantics,
  incremental unused-import lint behavior, the menubar `displayName` cleanup,
  and the scoped admin-auth / SimulationPanel cleanup decision.
- Updated question analytics reset coverage so the Admin card must list
  report names, actual source tables, Joker/rhythm sub-reports, and protected
  non-reset data instead of a dense paragraph.
- Updated Home CTA coverage so static checks require the primary `OYNA` /
  dynamic `Seviye X` Solo CTA to use canonical Solo progress, direct-start the
  resolved level, keep equal dimensions with `ONLINE KAPIŞ`, preserve Online
  as Home CTA-owned, and keep the Home `Çark` shortcut as a content-free mini
  wheel visual.
- Added notification typography coverage so the notification panel title uses
  Barlow Condensed bold italic and notification body/empty/error text uses
  Inter, without changing notification lifecycle behavior.
- Added admin user-report coverage for the `Kullanıcı Raporu` aggregate-only
  privacy contract and server-time `recordAppOpen` latest-open/coarse-platform
  tracking. This proves source contracts only; deployed admin/non-admin access,
  historical activity completeness, and cleanup-policy decisions remain manual.
- Added admin inactive guest username cleanup coverage for the AdminUser-gated
  dry-run/confirm/delete contract, server-side eligibility recheck, username
  release, audit log, no automatic scheduler, no linked/scored/social/missing
  last-open deletion, and no private identifier response.
- Added immutable Kronox user ID coverage for backend assignment/backfill,
  client-input rejection, guest-to-account preservation, tombstone non-reuse,
  Profile Info read-only/copy UI, internal friend/Online/leaderboard
  dual-writes, and public leaderboard stripping.
- Added global avatar propagation coverage for leaderboard, friends, Online
  player selection, lobby, invite, and header surfaces; safe public avatar
  projection; local bundled icon categories; and public avatar privacy fields.
- Added avatar parity coverage for the previously missed drift class:
  profile avatar saves refresh existing `SoloLeaderboardEntry` rows with the
  safe avatar quartet, and Leaderboard hydration overlays current-player plus
  accepted-friend custom avatars from already-safe sources without private
  per-row profile reads.
- Added Mağaza performance/readiness coverage so static checks require idle
  route/inventory warm-up, fast `UserJokerInventory` reads before starter
  self-heal, explicit `Satın Al` readiness, and parallel starter repair in the
  purchase function while preserving server-authoritative price/idempotency.
- Added Liderlik performance/score-storage coverage so static checks require
  idle Leaderboard chunk/snapshot warm-up, projection-only fast reads,
  cached-row rendering while refetching, deferred friend enrichment, and
  materialized `kronox_puan_total` as the primary visible score read path.
- Added app startup fast-path coverage so static checks require Home to be in
  the initial shell, cached GuestProfile repeat-launch support, and post-paint
  background maintenance for profile/Kronox ID/economy/joker/admin/rewards,
  presence, invite, Market, and Liderlik work.
- Added Solo joker inventory merge coverage so executable checks prove
  `Kart Değiştir`, `Kronokalkan`, and `Zamanı Dondur` decrement only the
  selected joker, preserve untouched counts through partial mutation payloads,
  keep idempotent retries from double-spending, and keep guided tutorial demos
  separate from real inventory spend.

## Required Coverage Areas

| Flow / contract | Current coverage | Needed next |
| --- | --- | --- |
| 4-player Online lobby join/start | Source-connected backend lock/revision/cap/one-deck checks plus executable reducer phase simulation | Live parallel multi-client Base44 probe remains manual |
| Host start shared state | Static source markers for deck/current question/status/revision | Backend runtime probe against deployed `startLobbyGame` |
| Non-host recovery | Executable non-overlap/backoff poller probe plus scoped sanitized refresh/reducer recovery checks | Browser automation with delayed/missed refresh and reconnect timing |
| Invite accept verified lobby | Static `verifiedLobby`/`joinedLobby` contract | Deployed function freshness marker or Base44 test-function proof |
| Notification no-flicker | Executable merge/reducer tests plus static ViewModel guards | Timed UI harness with transient empty fetch injection |
| Friend/player online/offline presence | Static backend contract and UI-helper checks for `PlayerPresence`, runtime heartbeat session, 75s TTL, token-proven guest presence, accepted-friend lookup, online non-friend selection, offline fallback, previous-row preservation, opaque target refs, and username-only labels | Multi-account live proof: user B appears online after heartbeat, user C appears as an online non-friend, and stale/offline rows fall out correctly |
| Online non-friend invite | Static backend contract for `createGameInvitesForTargets` resolving fresh target refs without returning email | Live proof that selected online non-friend receives in-app invite and can accept into `verifiedLobby` / `joinedLobby` |
| Friend add by email/username | Static UI/backend/privacy checks for email-or-username input, server-side username lookup, required username-not-found copy, no target email return, Add Friend double-submit guard, and function-level FriendRequest send lock | Two-account live proof for existing email, existing username, missing username, self-add, duplicate friend, pending request, expired resend after cancel/delete, and parallel send attempts |
| Unified Solo + Online Kronox Puan | Static/executable scoring suites confirm visible Kronox Puan includes Solo best-score plus Online progress, Online winner is exactly +15, loser is exactly -6 with checkpoint protection, Online has no speed bonus, and result popup copy shows the persisted delta/new score | Two-account live proof that winner/loser score writes, Profile, Header, and Leaderboard all refresh to the same persisted Kronox Puan |
| Solo record congratulations | Static backend context/copy checks | Production-like multi-user record fixture or backend probe |
| Immutable Kronox user ID | Static source checks for backend generation/backfill, link preservation, Profile Info read-only/copy display, internal dual-write fields, tombstone non-reuse, and public output stripping | Deployed two-account/guest-link proof; DB uniqueness/index proof if the platform adds first-class constraints; full production backfill audit |
| Global profile avatar propagation | Static UI/projection checks for shared renderer usage, safe avatar quartet, bundled icon categories, leaderboard/friends/Online match-found/invite/header propagation, profile-save projection refresh, current/friend Leaderboard avatar overlay, and no private avatar payload fields | Manual visual proof across leaderboard, friends, player select, Online match-found, invites, header, uploaded photo fallback, and guest/linked profiles |
| Mağaza open / purchase readiness | Static Market checks for idle chunk/cache warm-up, fast inventory read before starter self-heal, explicit purchase-readiness helper, and backend server-price/idempotency/lock guards | Manual low-end mobile proof for first open/reopen, sufficient/insufficient Diamond CTA state, purchase success, and double-tap/retry behavior |
| Liderlik open / score projection performance | Static Leaderboard checks for idle chunk/snapshot warm-up, projection-only `getSoloLeaderboard` fast mode, cached rows during refetch, deferred friend enrichment, bounded repair, and materialized score reads | Manual low-end mobile proof for cold/repeat BottomNav opens, deployed Base44 latency, DB index/sort behavior, exact rank at scale, and post-score-change refresh |
| App startup / Home first render | Static startup fast-path checks for direct Home shell import, cached GuestProfile repeat launch, post-paint AuthContext maintenance, deferred presence/invite/category modules, idle Market/Liderlik warm-up, and delayed Daily Wheel/Daily Calendar status refresh | Manual Android/WebView proof for cold/repeat app launch, splash duration, dark-loader duration, first Home paint, and deployed Base44 latency |
| Daily Calendar / Streak Diamond-only | Executable canonical distinct-key fixture plus source-connected assignment/provenance/claim guards | Two-device assignment/claim race and platform unique-index proof |
| Leaderboard username-only | Static public payload checks | RLS/BOLA live probe |
| Guest Joker/Hint inventory | Runtime-connected token-proof/cache/UI checks; no fake balance or public actor key | Guest device spend/reload/account-link parity and cross-account RLS probe |
| Typecheck progress | Vite raw imports, scoped vendor declaration, and touched P1 modules are checked; diagnostics reduced from 1,260 to 370 | Continue component-prop/inference cleanup until `npm run typecheck` can block release |
| Online category isolation | Static start/Game/Health mirror checks | Live lobby start with Solo preferences set differently |
| No raw Question.list gameplay fallback | Static source checks | Deployed `getQuestions` marker proof |
| Economy idempotency | Static guard checks plus function-level operation lock/recheck coverage | Platform unique/index proof or transactional replacement |
| Public UI private identifiers | Static forbidden-token checks | Visual/manual walkthrough for lobbies, leaderboard, notifications |
| Accessibility loading/forms/modals | Static status/label/dialog/form-feedback checks | Keyboard, TalkBack/VoiceOver, and real mobile focus-order proof |
| Admin Kullanıcı Raporu | Static source checks for AdminUser gate, aggregate-only response, no delete action, username/logged-in/score/inactive metrics, and coarse platform tracking | Deployed admin/non-admin function probe; historical completeness of last_app_open_at for older rows |
| Admin inactive guest username cleanup | Static source checks for AdminUser gate, dry-run before delete, typed confirmation, server-side eligibility, username release, audit log, and privacy-safe response | Deployed admin/non-admin function probe; backup/export policy; manual sample proof that an eligible released username can be claimed again |

## UX Quality Health Coverage And Remaining Gaps

Static Health coverage now exists for the strongest current UX contracts:
Profile/Settings route ownership, BottomNav ownership, own leaderboard-row
navigation, public identifier privacy, Solo/Online active question long-word
fit, focused visual scope, heavy-effect manual proof gates, Timeline visual safety,
and asset/readiness docs. Health is still a contract guard, not release proof.

| UX guardrail | Current static/executable coverage | Manual proof still needed |
| --- | --- | --- |
| Profile/Settings route ownership | Profile menu and `/profile/edit` keep `Profil Bilgileri`, Friends, Settings, privacy, and account deletion on their intended screens | Mobile route walkthrough and back-stack proof |
| BottomNav ownership | Visible tabs remain `Ana Sayfa`, `Liderlik`, `Profil`; Online remains Home CTA-owned | PWA/native wrapper navigation behavior |
| Solo/Online question-card fit parity | Shared or parallel fit helpers protect long Turkish words without raw question-bank client fallback | Real device gameplay with long content |
| Timeline visual safety | Visual changes around drop zones avoid layout-heavy animation and preserve drag/drop source contracts | Real touch drag, invalid drop, scroll containment |
| Public identifier privacy | Public Profile, Leaderboard, lobby, invite, notification, and push text keep the no email/provider/owner/raw guest/internal identifier contract, including no email, provider ID, owner_key, raw guest_id, or internal player_key | Visual walkthrough with guest and linked accounts |
| Focused visual task scope | UX polish tasks do not introduce broad redesign, new motion libraries, package changes, or backend/entity edits without explicit scope | Human review of diff intent |
| Gameplay performance | Heavy blur/glow/animation tokens stay out of gameplay-critical paths or are labeled manual proof gates | Low-end Android/WebView smoothness proof |
| Loading/empty/error states | Profile, Settings, Friends, Invites, Online lobby, Leaderboard, and Admin/reporting have local loading/error/empty handling markers where relevant | Timing and failure-injection UI proof |
| Asset readiness | New visual assets include optimization/dimension/fallback notes and avoid startup/game-start critical loads | Bundle size and device image-decode proof |

Manual proof remains required for mobile route walkthrough, PWA/native wrapper
navigation, real touch drag, failure-injection UI timing, low-end
Android/WebView smoothness, and bundle/device image-decode behavior.

## Health Design Rules

- Keep static checks precise and product-contract oriented.
- Prefer executable helper tests where pure selectors/reducers exist.
- Mark real-device, Base44 deployment, RLS/BOLA, push, App Store/Play Store,
  and two-account runtime proof as manual or NOT_AUTOMATABLE.
- Do not weaken failing checks by swapping real product requirements for vague
  text.
- When a static check uses source tokens, pair it with a doc note explaining
  what live proof remains.

## Paket B6 — HealthCenter Intelligence

B6 inventories the active registry, requires globally unique suite/case keys, removes obsolete/duplicate coverage, and adds on-demand grouped packs: Quick Smoke, Release Gate, Security, Economy, Online, Daily, Solo, Mobile, Admin / Proof, and Full. Runtime E2E remains a separate report and is excluded from Full Health. Reports now include run/build/pack metadata, executed suite count, blockers, warnings, manual-required count, elapsed time, proof quality (`EXECUTABLE`, `SOURCE_CONNECTED`, `STATIC_ONLY`, `MANUAL_EXTERNAL`), fix owner, and next action. The latest completed pack summary is local Admin UI state only and is never release proof.

Retired suites `research_test_strategy`, `report_ux_human_decision`, and `sre_release_health_signals` scanned orchestration comments and duplicated stronger executable report-integrity/intelligence coverage. Retired duplicate cases covered old Timeline DOM-manual rows, repeated subjective beauty/title checks, and the obsolete "random matchmaking not detected" warning; active dedicated mobile/DOM, visual, and matchmaking suites remain. No meaningful contract was removed without stronger replacement.

Health runs are single-owner, reject duplicate concurrent starts, batch/yield UI work, persist completed pack summaries, and invalidate progress when the panel closes or unmounts. They run on-demand from guarded Admin only. Scheduled/continuous monitoring requires external automation or future platform support; B6 does not fake a scheduler.

The proof classifier now preserves evidence strength: `EXECUTABLE` means a helper/runtime simulation actually ran, `SOURCE_CONNECTED` means a static contract inspected named active files, `STATIC_ONLY` remains a limitation, and `MANUAL_EXTERNAL` always wins over executable-looking labels. The three former dynamic `health_intelligence` catalog cases are retired into the dedicated `health_proof_integrity` suite; their catalog, retired-key, and pack coverage remains executable rather than duplicated.

Base44 automation audit result for this repository: 28 committed `function.jsonc` manifests parse successfully and currently contain zero local automation declarations. Local `function.jsonc` files are the automation source of truth. Base44 automations deploy atomically with their function; dashboard changes are overwritten on the next local function deploy and there is no two-way sync. Any future scheduled/entity/connector declaration must pass local type/schedule/trigger/`function_args` validation. Cleanup/integrity automation must be disabled or explicitly dry-run/report-only. Live deployed dashboard state remains manual/external proof.

Primary-source notes used for B6 guidance:

- Base44 backend-function overview documents a maximum of 50 backend functions: https://docs.base44.com/developers/backend/resources/backend-functions/overview
- Base44 automations documents scheduled/entity/connector configuration in `function.jsonc`, request-body `function_args`, atomic per-function deploy, and local-over-dashboard source-of-truth behavior: https://docs.base44.com/developers/backend/resources/backend-functions/automations
- Base44 runtime guidance says `waitUntil` is best-effort and not guaranteed for critical must-not-lose work; Kronox currently has no committed Base44 `waitUntil` usage.
- Base44 SDK guidance recommends latest unversioned installation; Kronox keeps its existing exact 0.8.34 cross-runtime gate until a separate SDK migration/deploy proof is approved.
- React effect cleanup: https://react.dev/reference/react/useEffect
- Vite environment variables: `VITE_` values are bundled into client code and cannot contain secrets: https://vite.dev/guide/env-and-mode.html
- MDN `AbortController.abort()` cancels fetch/response consumption when its signal is supplied: https://developer.mozilla.org/en-US/docs/Web/API/AbortController/abort
- OWASP logging guidance excludes secrets, access tokens, and sensitive personal data from direct logs: https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html

Official guidance informs Health/docs only; it does not replace live Base44 deployment, device, RLS, secret, index, or store proof.

## Runtime E2E Automation Health Suite V2

HealthCheck lists a display-only `Runtime E2E Automation Health Suite` with 10
registry-owned screen scenarios. Full Run does not execute browser automation,
and automation results never increment Health blocker, fail, or warning counts.
The separate report owns `automationPassed`, `automationFailed`,
`automationNotRun`, `automationNotAutomatable`, and
`automationManualExternal` only.

Run it with `npm run health:e2e`. Each executed scenario uses a real isolated
Chromium context. Real failures retain a screenshot and trace under ignored
`test-results/health-e2e`. HealthCheck can load/import the latest report and copy
selected failure/setup-gap JSON, all setup gaps, or the full redacted report.
Reports exclude credentials, private IDs, raw backend errors, URL query values,
storage contents, and absolute local paths.

Set `KRONOX_E2E_BASE_URL` for a preview/deployment or let the runner start local
Vite. Base44 app identity comes from `VITE_BASE44_APP_ID` or approved `app_id`
runtime bootstrap; `VITE_BASE44_APP_BASE_URL`/`app_base_url` selects the app
endpoint. An endpoint alone is not accepted as app identity. This workspace's
current local setup has an app base URL but no app ID, so V2 reports the exact
`VITE_BASE44_APP_ID`/`app_id` setup gap instead of accepting backend proof.

V2 classifies targets as `LOCAL_DEV`, `BASE44_PREVIEW`,
`PRODUCTION_CUSTOM_DOMAIN`, or `UNKNOWN_EXTERNAL`. Local/preview targets can
expose direct backend signals that a production custom domain may proxy through
its own origin. The report therefore separates `directBackendPreflightStatus`
from `runtimeBackendProbeStatus`. An observable direct success is `REACHABLE`;
a custom-domain observation gap is
`PROD_CUSTOM_DOMAIN_PREFLIGHT_UNSUPPORTED`, and a loaded Home with a restored
actor may become `PROD_RUNTIME_PROBE_REQUIRED`. Production does not finish at a
generic `UNKNOWN` when one of those specific states applies.

Each scenario records a safe category/status service summary and its own
`backendEvidence`. `UI_ONLY` proves only rendered browser behavior;
`SESSION_RESTORED` proves Home plus a restored actor session but not backend
behavior; `BACKEND_RUNTIME_PROBE` means a backend proof was attempted or is
still owed; `BACKEND_CONNECTED` requires a successful classified response in
the scenario's declared service category. A backend-dependent PASS without that
evidence is demoted to `AUTOMATION_NOT_AUTOMATABLE`. App bootstrap alone may
PASS at `SESSION_RESTORED`. BottomNav and Store remain `UI_ONLY`. If no backend
traffic is classifiable, `serviceSummaryUnavailableReason` says so explicitly.
Critical console output is reduced to safe categories, summaries, actions, and
fingerprints; raw messages, query values, tokens, identities, and stack traces
are not exported.

The Codex634 production run established a reachable custom-domain preflight,
but also exposed three proof-layer gaps now guarded by Codex635. Home `OYNA`
may commit the current Solo level directly to `/game` or open `/solo`; the map
is only an entry state, and Solo PASS still requires `/game`,
`solo-game-screen`, the question area, and an interaction target. A visible
current map node must commit `/game`; a missing question-service request or
successful response becomes a precise setup gap rather than a false gameplay
PASS. Online `/lobby` and waiting UI are likewise not matchmaking proof. A
classified request with no observed response is retained as
`BACKEND_RUNTIME_RESPONSE_NOT_OBSERVED`, while no request, a rejected response,
and a network failure remain distinct diagnostics.

The Codex635 production report was core-Health green but not Runtime E2E
release-green. Codex636 fixes the real Solo route collision: React Router's
case-insensitive matching allowed legacy `/Game` to capture canonical `/game`
and replace it with `/solo`; the legacy route is now explicitly
case-sensitive. The Solo map remains entry state only, and a pass still needs
the committed `/game` route, gameplay root, question area, interaction target,
and a successful Solo question response.

Codex636 also scopes backend proof to the action started after each scenario's
baseline. Leaderboard snapshot, Daily Calendar status, Daily Wheel status,
Solo question bootstrap, and Online matchmaking waits record safe action,
request/completion timestamps, status class, abort/cancel state, and a bounded
no-response timeout. Route visibility never substitutes for the required
response. This closes the earlier Leaderboard/Daily/Wheel race where the
scenario navigated away before a legitimate delayed response was observed.

HTTP 401/403 observations remain critical `BACKEND_PERMISSION_DENIED` evidence
unless the exact bundled `/api/app-logs/{app}/log-user-in-app/...` request is
proven fire-and-forget page-activity telemetry. That one endpoint remains a
visible non-blocking diagnostic and cannot provide backend proof. The prior
`gameplay_entity` label caused by an app-activity route suffix was a classifier
artifact; exact app-activity detection now runs before gameplay/leaderboard
keywords. The protected profile and leaderboard denials were genuine direct
client requests, so direct `User` hydration and `SoloLeaderboardEntry` access
were removed in favor of already-authorized identity data and the sanitized
service-role `getSoloLeaderboard` path. Real gameplay/entity denials remain
critical. Reports include only scenario, service category, status class,
sanitized endpoint category, safe action label, and redacted fingerprint; there is no blanket
optional-request downgrade and no raw URL or actor identity. Base44
`APP_NOT_FOUND` continues to force `backendAvailable: false` and
`base44AppReachable: false`, and can never preserve a backend-dependent PASS.
The frontend package, lockfile root/resolution, and critical function imports
remain exact-pinned to Base44 SDK `0.8.34`.

Home-owned scenarios may use an isolated completed guest or linked actor from
`KRONOX_E2E_STORAGE_STATE`; credentials are never hardcoded. Create a local
fixture with `mkdir -p .auth` and
`npx playwright codegen --save-storage=.auth/kronox-e2e-prod.json https://kronoxgame.com`,
complete the isolated actor session interactively, then close the browser.
`.auth/`, generated storage-state JSON, `.env.local`, reports, and traces are
ignored and must never be committed or printed. A production run uses existing
local environment values without echoing them, for example
`KRONOX_E2E_BASE_URL=https://kronoxgame.com KRONOX_E2E_STORAGE_STATE=.auth/kronox-e2e-prod.json KRONOX_E2E_USE_GUEST=false KRONOX_E2E_ALLOW_MATCHMAKING=true npm run health:e2e`.

Wheel, Diamond purchase, and matchmaking mutations require their explicit
`KRONOX_E2E_ALLOW_*` gates. Online requires a completed linked or token-proven
guest actor plus `KRONOX_E2E_ALLOW_MATCHMAKING=true`; production
direct-preflight limitations no longer block its safe search/cancel probe, but only observed matchmaking
backend evidence can support PASS. Duello A/B actor fixtures may be declared
through `KRONOX_E2E_STORAGE_STATE_A/B`, but the scenario remains
`AUTOMATION_MANUAL_EXTERNAL` until deterministic pairing and correct-claim
fixtures prove two real contexts, one accepted claim, and reconciled snapshots.
Missing setup never becomes a fake PASS. Health PASS remains contract proof,
not release-ready proof while manual/external gates remain.

`Online Matchmaking Runtime Health Suite` adds executable/source-connected
coverage for canonical mode keys, Duello/normal lane isolation, two-actor
selection, no self-match, guest/linked compatibility, backend poll
reconciliation, final timeout poll plus cancel cleanup, safe Turkish UI, the
two-phone manual gate, App-not-found rejection, and non-fake Duello two-context
evidence. This suite guards the repaired contract but does not replace two real
phones against the deployed `randomMatchmaking` function.

## Codex637 Online / Duello Direct-Start Coverage

The active product no longer has a lobby step. `/online` owns selection,
bounded 30-second search, and the same-screen `Rakip bulundu` / `Oyun başlıyor`
transition. A participant-scoped backend `GAME` snapshot gates direct `/game`
or `/duel` navigation; the private `Lobby` row remains only the authoritative
session store. Legacy `/lobby` routes redirect and are explicitly invalid
Runtime E2E evidence.

Twenty-five focused `online_flow`, `duello_flow`, and
`runtime_e2e_automation` cases now guard no-lobby routing/UI/copy, authoritative
direct start, queue cancellation/timeout/consumption, matched transition
timing, safe Turkish errors, no pre-game question-bank exposure, public
identity privacy, Full Health separation, and precise E2E gaps. Runtime Online
must fail `LOBBY_STILL_PRESENT` if a lobby route/surface appears; missing
two-actor or direct-start evidence becomes `TWO_ACTOR_REQUIRED`,
`MATCH_FOUND_DIRECT_GAME_PENDING`, backend-response, or permission evidence,
never route-only PASS.

Static/source checks cannot prove simultaneous two-client delivery or Duello's
first-correct race. Duello therefore remains `MANUAL_EXTERNAL` until two
isolated actors and deterministic pairing/claim fixtures prove the shared card,
one accepted claim, first-to-10 result, and single backend `+15`/`-6` commit.
Online also retains `+15`/`-6`; neither mode has a speed bonus. Permission/RLS
diagnostics remain visible and blocking where applicable.

## Manual / Live Probe Checklist

- Two-phone matchmaking: use distinct actors, enter Duello within 30 seconds,
  confirm both show `Rakip bulundu` on `/online`, never render `/lobby`, and
  enter the same exactly-two-player `/duel`; repeat through `Online Kapış`, then
  verify timeout/retry/cancel and a second attempt leave no active ghost row.
- Two-account friend Online: one actor invites one friend, acceptance enters
  `/online`, both clients show the direct transition, and both land on the same
  `/game` question without ready/start UI.
- Realtime miss: block or delay one matched update, then confirm sanitized
  snapshot polling still transitions that participant directly to game.
- Invite accept: expired, accepted, stale lobby, non-recipient, and duplicate
  accept all return safe states.
- Notification lifecycle: transient empty fetch does not clear valid pending
  rows; terminal status does clear them.
- Solo records: fastest rank 1, fastest top 3, fewest HAMLE, and combined
  backend context all render only after success.
- Economy: same user double-taps/refreshes reward and joker purchase across
  two devices without duplicate grant/spend.
- Privacy: no email/provider/raw guest/owner/internal player ids visible in
  leaderboard, match-found, notification, or push text.
- Friend invite duplicate/expiry proof: Account A sends a friend invite to
  Account B from Leaderboard, retries while it is open and sees the open-invite
  warning, sends from Add Friend by username/email and receives the same
  duplicate contract, lets an invite expire and confirms resend is blocked
  until the sender cancels/deletes the expired row, then confirms a new invite
  can be sent after cancel/delete. Parallel rapid submits should create at most
  one pending FriendRequest; lock conflicts return a safe retry message.