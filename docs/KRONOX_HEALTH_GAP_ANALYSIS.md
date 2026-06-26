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
| Online presence / player selection | Confirms PlayerPresence owner binding, accepted-friend lookup, backend-owned player selection, username-only labels, opaque target refs, and offline fallback | Does not prove deployed function freshness, two-device heartbeat timing, or live non-friend invite delivery |
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
  display fallbacks, unscoped presence reads, and non-current-user presence
  writes fail Health.
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

## Required Coverage Areas

| Flow / contract | Current coverage | Needed next |
| --- | --- | --- |
| 4-player Online lobby join/start | `online_lobby_start_regression` static suite plus executable reducer phase simulation | Add a real or mocked multi-client simulation harness when feasible |
| Host start shared state | Static source markers for deck/current question/status/revision | Backend runtime probe against deployed `startLobbyGame` |
| Non-host recovery | Static subscription + poll/refetch markers plus reducer recovery simulation | Browser automation with delayed/missed subscription event |
| Invite accept verified lobby | Static `verifiedLobby`/`joinedLobby` contract | Deployed function freshness marker or Base44 test-function proof |
| Notification no-flicker | Executable merge/reducer tests plus static ViewModel guards | Timed UI harness with transient empty fetch injection |
| Friend/player online/offline presence | Static backend contract and UI-helper checks for `PlayerPresence`, heartbeat, accepted-friend lookup, online non-friend selection, offline fallback, opaque target refs, and username-only labels | Multi-account live proof: user B appears online after heartbeat, user C appears as an online non-friend, and stale/offline rows fall out correctly |
| Online non-friend invite | Static backend contract for `createGameInvitesForTargets` resolving fresh target refs without returning email | Live proof that selected online non-friend receives in-app invite and can accept into `verifiedLobby` / `joinedLobby` |
| Friend add by email/username | Static UI/backend/privacy checks for email-or-username input, server-side username lookup, required username-not-found copy, no target email return, Add Friend double-submit guard, and function-level FriendRequest send lock | Two-account live proof for existing email, existing username, missing username, self-add, duplicate friend, pending request, expired resend after cancel/delete, and parallel send attempts |
| Solo record congratulations | Static backend context/copy checks | Production-like multi-user record fixture or backend probe |
| Daily Quest Diamond-only | Static runtime/backend checks | Two-device claim race proof |
| Leaderboard username-only | Static public payload checks | RLS/BOLA live probe |
| Online category isolation | Static start/Game/Health mirror checks | Live lobby start with Solo preferences set differently |
| No raw Question.list gameplay fallback | Static source checks | Deployed `getQuestions` marker proof |
| Economy idempotency | Static guard checks plus function-level operation lock/recheck coverage | Platform unique/index proof or transactional replacement |
| Public UI private identifiers | Static forbidden-token checks | Visual/manual walkthrough for lobbies, leaderboard, notifications |
| Accessibility loading/forms/modals | Static status/label/dialog/form-feedback checks | Keyboard, TalkBack/VoiceOver, and real mobile focus-order proof |

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
