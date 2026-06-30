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
| Online presence / player selection | Confirms PlayerPresence owner binding, GuestProfile token proof for guest heartbeat, 75s TTL/25s heartbeat/12s visible refresh, accepted-friend lookup, backend-owned player selection, username-only labels, opaque target refs, and offline fallback | Does not prove deployed function freshness, two-device heartbeat timing, or live non-friend invite delivery |
| Solo records | Confirms backend context and copy | Does not prove production data has multi-user records |
| Economy | Confirms idempotency guards, Diamond-only rules, and function-level economy lock/recheck guards | Does not prove DB uniqueness or two-device race safety |
| Leaderboard privacy | Confirms sanitized public payload shape | Does not prove live RLS prevents direct entity reads |
| Questions | Confirms no raw client `Question.list` gameplay fallback | Does not prove deployed function is current |

## Coverage Closed In This Pass

- Added architecture-audit Health coverage requiring the new audit/target,
  Health gap, DB reporting readiness, and visual asset readiness docs to stay
  aligned with the MVVM/MVI target and Base44-active boundary.
- Updated invite navigation Health expectations to require `verifiedLobby` and
  `joinedLobby`, not the older `lobby: updatedLobby` token.
- Added executable Online lobby reducer coverage for 4-player representation,
  accepted invite handoff, shared-state-gated start, missed-realtime recovery,
  duplicate start confirmation, stale refresh protection, and expired lobby
  blocking.
- Added executable notification reducer coverage for transient empty fetches,
  subscription upserts, terminal row closure, visual-only toast dismissal,
  accept/reject closure, stable-id dedupe, and private identifier guardrails.
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
  non-friend / offline friend ordering, current-user/unroutable exclusion,
  opaque target refs, backend-only invite recipient resolution, and no
  client-visible recipient email.
- Added Security Pass 1 coverage for exact Base44 SDK pin/alignment, no
  `react-markdown`/`rehype-raw` raw HTML markdown path, guarded chart CSS
  generation without `dangerouslySetInnerHTML`, and Base44 access-token URL
  cleanup/no-token-logging.
- Added Security Pass 2 coverage for `EconomyOperationLock`, post-lock
  idempotency/balance/inventory rechecks, Market purchase negative-balance
  protection, Solo joker non-negative spend protection, and Daily Wheel /
  Daily Quest Diamond-only claim serialization. DB unique/index proof and live
  two-device economy races remain manual gates.
- Added Security Pass 3 coverage for accessible loading/status semantics,
  labeled custom modals, profile/onboarding form feedback semantics,
  incremental unused-import lint behavior, the menubar `displayName` cleanup,
  and the scoped admin-auth / SimulationPanel cleanup decision.
- Updated question analytics reset coverage so the Admin card must list
  report names, actual source tables, Joker/rhythm sub-reports, and protected
  non-reset data instead of a dense paragraph.
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
  `Kart Değiştir`, `Kronokalkan`, and `Zaman Dondur` decrement only the
  selected joker, preserve untouched counts through partial mutation payloads,
  keep idempotent retries from double-spending, and keep guided tutorial demos
  separate from real inventory spend.

## Required Coverage Areas

| Flow / contract | Current coverage | Needed next |
| --- | --- | --- |
| 4-player Online lobby join/start | `online_lobby_start_regression` static suite plus executable reducer phase simulation | Add a real or mocked multi-client simulation harness when feasible |
| Host start shared state | Static source markers for deck/current question/status/revision | Backend runtime probe against deployed `startLobbyGame` |
| Non-host recovery | Static subscription + poll/refetch markers plus reducer recovery simulation | Browser automation with delayed/missed subscription event |
| Invite accept verified lobby | Static `verifiedLobby`/`joinedLobby` contract | Deployed function freshness marker or Base44 test-function proof |
| Notification no-flicker | Executable merge/reducer tests plus static ViewModel guards | Timed UI harness with transient empty fetch injection |
| Friend/player online/offline presence | Static backend contract and UI-helper checks for `PlayerPresence`, runtime heartbeat session, 75s TTL, token-proven guest presence, accepted-friend lookup, online non-friend selection, offline fallback, previous-row preservation, opaque target refs, and username-only labels | Multi-account live proof: user B appears online after heartbeat, user C appears as an online non-friend, and stale/offline rows fall out correctly |
| Online non-friend invite | Static backend contract for `createGameInvitesForTargets` resolving fresh target refs without returning email | Live proof that selected online non-friend receives in-app invite and can accept into `verifiedLobby` / `joinedLobby` |
| Friend add by email/username | Static UI/backend/privacy checks for email-or-username input, server-side username lookup, required username-not-found copy, no target email return, Add Friend double-submit guard, and function-level FriendRequest send lock | Two-account live proof for existing email, existing username, missing username, self-add, duplicate friend, pending request, expired resend after cancel/delete, and parallel send attempts |
| Unified Solo + Online Kronox Puan | Static/executable scoring suites confirm visible Kronox Puan includes Solo best-score plus Online progress, Online winner is exactly +15, loser is exactly -6 with checkpoint protection, Online has no speed bonus, and result popup copy shows the persisted delta/new score | Two-account live proof that winner/loser score writes, Profile, Header, and Leaderboard all refresh to the same persisted Kronox Puan |
| Solo record congratulations | Static backend context/copy checks | Production-like multi-user record fixture or backend probe |
| Immutable Kronox user ID | Static source checks for backend generation/backfill, link preservation, Profile Info read-only/copy display, internal dual-write fields, tombstone non-reuse, and public output stripping | Deployed two-account/guest-link proof; DB uniqueness/index proof if the platform adds first-class constraints; full production backfill audit |
| Global profile avatar propagation | Static UI/projection checks for shared renderer usage, safe avatar quartet, bundled icon categories, leaderboard/friends/Online/lobby/invite/header propagation, and no private avatar payload fields | Manual visual proof across leaderboard, friends, player select, lobby, invites, header, uploaded photo fallback, and guest/linked profiles |
| Mağaza open / purchase readiness | Static Market checks for idle chunk/cache warm-up, fast inventory read before starter self-heal, explicit purchase-readiness helper, and backend server-price/idempotency/lock guards | Manual low-end mobile proof for first open/reopen, sufficient/insufficient Diamond CTA state, purchase success, and double-tap/retry behavior |
| Liderlik open / score projection performance | Static Leaderboard checks for idle chunk/snapshot warm-up, projection-only `getSoloLeaderboard` fast mode, cached rows during refetch, deferred friend enrichment, bounded repair, and materialized score reads | Manual low-end mobile proof for cold/repeat BottomNav opens, deployed Base44 latency, DB index/sort behavior, exact rank at scale, and post-score-change refresh |
| App startup / Home first render | Static startup fast-path checks for direct Home shell import, cached GuestProfile repeat launch, post-paint AuthContext maintenance, deferred presence/invite/category modules, idle Market/Liderlik warm-up, and delayed Daily Wheel/Daily Quest status refresh | Manual Android/WebView proof for cold/repeat app launch, splash duration, dark-loader duration, first Home paint, and deployed Base44 latency |
| Daily Quest Diamond-only | Static runtime/backend checks | Two-device claim race proof |
| Leaderboard username-only | Static public payload checks | RLS/BOLA live probe |
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

## Manual / Live Probe Checklist

- Two-account Online: host creates 4-player lobby, three recipients join by
  code/invite, host starts, every player lands on the same question.
- Realtime miss: block or delay subscription event for one non-host, confirm
  poll/refetch transitions to game.
- Invite accept: expired, accepted, stale lobby, non-recipient, and duplicate
  accept all return safe states.
- Notification lifecycle: transient empty fetch does not clear valid pending
  rows; terminal status does clear them.
- Solo records: fastest rank 1, fastest top 3, fewest HAMLE, and combined
  backend context all render only after success.
- Economy: same user double-taps/refreshes reward and joker purchase across
  two devices without duplicate grant/spend.
- Privacy: no email/provider/raw guest/owner/internal player ids visible in
  leaderboard, lobby, notification, or push text.
- Friend invite duplicate/expiry proof: Account A sends a friend invite to
  Account B from Leaderboard, retries while it is open and sees the open-invite
  warning, sends from Add Friend by username/email and receives the same
  duplicate contract, lets an invite expire and confirms resend is blocked
  until the sender cancels/deletes the expired row, then confirms a new invite
  can be sent after cancel/delete. Parallel rapid submits should create at most
  one pending FriendRequest; lock conflicts return a safe retry message.
