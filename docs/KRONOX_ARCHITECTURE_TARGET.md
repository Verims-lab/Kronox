# Kronox Architecture Target

Status: target architecture map.

Kronox should move toward Feature-Based MVVM with MVI-style state machines for
the flows that can break gameplay, multiplayer, notifications, and economy.

This target does not replace Base44 today. It defines boundaries that make the
current React/Base44 implementation safer now and portable later.

## Reference Principles

- Android architecture guidance separates UI, state holders, optional domain
  use cases, and data layers. Kronox should mirror that separation in React.
- React reducer/context guidance supports extracting complex screen state into
  reducer files plus context or hooks, instead of scattering updates through
  deep component trees.
- OWASP MASVS/MASTG thinking maps to Kronox as: protect stored identifiers,
  avoid sensitive logs/payloads, validate route/deep-link input, and enforce
  backend authorization for every user-owned object.
- Capacitor-style web-native wrappers are a future option only if Kronox first
  owns clean web/domain/backend boundaries.
- Codex modernization should remain incremental: inventory, pilot, parity plan,
  small fixes, decision log, no giant rewrite.

## Folder Pattern

Future feature folders should follow this shape when a file is naturally
touched for product work:

```text
src/features/<feature>/
  views/              React page/component shells
  viewModel/          hooks that expose state, commands, and derived UI state
  state/              reducers/state machines, event/action definitions
  services/           domain use cases, validation, orchestration
  gateways/           Base44 calls or provider-specific backend access
  model/              feature DTOs, normalization helpers
  health/             focused Health helpers/case source if feature-owned
```

Existing files do not need to be moved immediately. New code should prefer this
shape when it reduces risk.

## Layer Meaning

| Layer | Kronox meaning | Current example | Target rule |
| --- | --- | --- | --- |
| View | Render-only React surface | `IncomingInvitesPanel`, `WaitingRoomPanel`, `SoloSuccessPopup` | Receives state and commands; no direct protected writes |
| ViewModel | Hook/state holder for a screen or feature | `useNotificationCenter`, `useWaitingRoomSync`, `useLobbySync` | Owns subscriptions, loading/error state, derived view state |
| MVI reducer | Deterministic transition layer | `soloAttemptReducer`, `onlineLobbyReducer`, `notificationReducer` | Events in, immutable state out, effects described separately |
| Service/use case | Domain operation | invite helpers, leaderboard helpers, solo engine helpers | No JSX; owns product rules and payload shaping |
| Gateway/API | Base44 backend access | `dbGateway/lobbyGateway`, `base44Client` | Single provider-specific boundary per feature |
| Backend | Base44 function/entity implementation | `base44/functions/**/entry.ts` | Server authority, auth, service role, compact safe response |

## Pilot Flow Targets

### App Startup / Home First Render

Current:
- `AuthContext` owns app identity bootstrap for authenticated users and
  app-owned GuestProfile players.
- Home also starts optional daily reward, market, leaderboard, presence, invite,
  category-modal, and service-worker work around app entry.

Target:
- Startup is split into: critical identity bootstrap, first Home render, then
  non-critical background refresh.
- Critical identity may use the cached public GuestProfile for repeat guest
  launches; backend GuestProfile verification, Kronox ID ensure, profile
  hydration, Diamond economy grant, starter joker repair, account-link merge,
  admin status, app-open activity, presence, invite checks, reward status, and
  Market/Liderlik warm-up must not block Home first paint.
- Home is part of the initial app shell rather than a lazy route chunk. Heavy
  non-home screens remain lazy.

Parity plan:
- Guest/profile correctness remains backend-verified in background and must
  patch shared auth state when authoritative data arrives.
- Daily Wheel V2 remains server-authoritative for weighted Diamonds, approved
  Solo jokers, and Gift Box rewards; Daily Calendar / Streak remains
  Diamond-only.
  Home may show loading/cached status while post-paint refresh completes.
- Low-end Android/WebView startup timing remains a manual release proof gate.

### Solo Gameplay Completion / Records

Current:
- `Game.jsx` owns attempt lifecycle, timers, placement, persistence, result
  routing, and record popup handoff.
- Pure helpers exist for scoring, deck building, question runtime, and record
  context.

Target:
- `soloAttemptReducer` owns events such as `CARD_PLACED`, `JOKER_USED`,
  `TARGET_REACHED`, `ATTEMPT_FAILED`, `PERSIST_REQUESTED`,
  `PERSIST_SUCCEEDED`, and record-context status transitions.
- ViewModel owns effects: analytics writes, daily quest progress, persistence,
  record context request.
- View renders `SoloLevelResult` from reducer state only.

Phase 1 foundation:
- `src/lib/soloAttemptReducer.js` defines the pure, effect-free Solo attempt
  state contract for current HAMLE rules, persistence status, joker usage
  summary, and backend record-context eligibility.
- `Game.jsx` still owns the active runtime side effects in Phase 1. Later
  integration should route one handoff at a time through a ViewModel before
  changing render behavior.

Parity plan:
- Keep current scoring and HAMLE thresholds unchanged.
- Add reducer tests before replacing existing state.
- Keep record context backend-only and guest-proofed.

### Online Lobby / Start / Reconnect

Current:
- Lobby state is split across route state, `LobbyRoom`, `useWaitingRoomSync`,
  `useLobbySync`, `WaitingRoomPanel`, and Base44 functions.
- Recent fixes added merge/retry joins, accepted-invite reconciliation,
  idempotent start, and missed-realtime refetch/polling.

Target:
- `onlineLobbyReducer` owns phases: `idle`, `creating`, `waiting`,
  `joining`, `joined`, `starting`, `started`, `recovering`, `expired`,
  `error`.
- Service commands: `createLobby`, `joinByCode`, `acceptInvite`,
  `startLobbyGame`, `refreshLobby`, `recoverStartedLobby`.
- Gateway wraps Base44 entity/function/subscription calls.
- Backend remains the source of truth for roster, shared deck, current question,
  host authorization, and state revision.

Phase 1 foundation:
- `src/lib/onlineLobbyReducer.js` defines the pure, effect-free lobby phase
  state contract for create/join/invite/start/recovery/expired transitions.
- `useWaitingRoomSync` feeds authoritative subscription and polling events into
  the reducer while existing fetch/subscription side effects and route payloads
  stay unchanged.
- Started state is client-visible only after the backend-owned shared game
  state is present.

Parity plan:
- Keep existing route shape and `joinedLobby`/`verifiedLobby` payloads.
- Add simulation-level Health for 4-player join/start/recovery before any
  broad restructuring.
- Keep two-account live proof manual.

### Friend/Game Invite Notifications

Current:
- `useNotificationCenter` already acts like a ViewModel/store.
- Selectors merge fetch/subscription rows and preserve valid pending items
  through transient empty fetches.

Target:
- `notificationReducer` owns events: `FETCH_STARTED`, `FETCH_SUCCESS`,
  `FETCH_EMPTY_STALE`, `SUBSCRIPTION_ROW`, `TERMINAL_ROW`,
  `TOAST_DISMISSED`, `INVITE_OPENED`, `INVITE_REJECTED`,
  `FRIEND_REQUEST_ACCEPTED`, `FRIEND_REQUEST_REJECTED`, `ROW_EXPIRED`, and
  `ROW_INVALIDATED`.
- Views read slices: header count, dropdown rows, banner candidates, panel rows.
- Gateway owns Base44 `FriendRequest`/`GameInvite` queries and subscriptions.

Phase 1 foundation:
- `src/lib/notificationReducer.js` defines the pure notification lifecycle
  state contract for fetch, subscription, terminal, dismiss, accept, reject,
  expiry, and invalidation events.
- `useNotificationCenter` remains the shared ViewModel/store and delegates row
  merge/close transitions to the reducer; transient empty fetches preserve
  valid pending friend requests and game invites.
- `src/hooks/usePresenceHeartbeat.js` and `src/hooks/useFriendPresence.js`
  provide the focused Online/social presence foundation. Presence writes go
  through `updatePlayerPresence`, reads go through `getFriendPresence`, and
  both remain backend-owned instead of letting UI mark arbitrary users online.
  Heartbeats use a runtime app-session id, a 25 second visible interval, and a
  75 second server-owned TTL. Authenticated actors are derived from `auth.me`;
  guest actors must prove GuestProfile ownership with `guest_id + guest_token`.
- Online player selection goes through `getOnlinePlayerSelection` and
  `src/lib/onlinePlayerSelection.js`. The picker order is online friends,
  online non-friends, then offline friends; offline non-friends are excluded.
  The UI stores opaque `target_ref` values only. `createGameInvitesForTargets`
  resolves those refs backend-side to existing `GameInvite` recipients.
  Player-selection and friend-presence UI refresh while visible, refetch on
  focus/reconnect, and preserve previous safe rows through transient failures.

Parity plan:
- Preserve exact user-facing behavior: dismissing a toast is visual only;
  accepted/expired/rejected rows close actionable notifications.
- Keep labels username-safe.
- Keep push optional and manual device-proven.

## Cross-Cutting Rules

- Public identity is username only.
- `kronox_user_id` is the immutable canonical app user identity for
  backend-owned relationships and support/admin correlation. It is system
  assigned, opaque, non-sequential, never user-editable, preserved through
  guest-to-account linking, and never reused after deletion. It is not an
  authorization token: Base44 functions must still enforce current
  user/profile ownership.
- Profile > Profil Bilgileri may show the current player their own
  `Kullanıcı ID` as a read-only/copyable support value. Public leaderboard,
  friend, invite, lobby, notification, and Online surfaces continue to render
  username-safe labels rather than Kronox ID, email, provider IDs, owner_key,
  raw guest_id, or internal player_key values.
- Friends can be added by email address or registered Kronox username. Username
  lookup and duplicate/self checks stay backend-owned, and username-based add
  responses must return only username-safe labels, never the target email.
- Open outgoing friend invites are blocked server-side with a stable warning.
  New friend invites expire no earlier than 72 hours after creation, and expired
  outgoing invites must be cancelled/deleted before the sender can invite the
  same target again. Open reverse-pending requests still route the player to
  Gelen İstekler; expired reverse-pending rows are stale and must not block a
  fresh outgoing request. `FriendRequestOperationLock` is a function-level
  duplicate-send race guard; DB unique/index proof remains a manual/platform
  gate.
- Friend, invite, lobby, notification, and presence surfaces must render
  username-safe labels only. Emails, provider IDs, raw guest IDs, owner keys,
  and internal player keys are never public display fallbacks.
- Profile avatar fields are public visual metadata only. Public rows may carry
  only sanitized `avatar_type`, `avatar_icon_id`, `avatar_color_id`, and
  `avatar_url`; username remains the public identity, and email, provider IDs,
  owner keys, raw guest IDs, internal player keys, auth IDs, and raw storage
  metadata remain forbidden in public avatar payloads.
- Presence is best-effort and relationship-scoped: the current user can only
  heartbeat their own session, friend lookup is restricted to accepted
  friendships, and stale/missing presence displays offline rather than online.
  Explicit offline updates only the same runtime session row; TTL expiry is the
  final safety net for missed closes/background events.
- Online non-friend discovery is presence-fresh only. Public selection payloads
  must not return email, provider ID, raw guest ID, owner_key, or internal
  player_key; backend-private routing data is allowed only inside service-role
  functions/entities and must not be rendered or exported.
- UI must not trust request-body user/owner/reward/score fields.
- Service-role writes stay inside Base44 functions.
- Question bank stays backend-only through compact projections.
- Daily Wheel V2 rewards remain server-selected and no-Puan/no-leaderboard;
  Daily Calendar / Streak remains Diamond-only.
- Mağaza catalog is code-side/static for real-money Diamond display packages,
  Diamond-spend Joker packages, Diamond-spend Hint packages, Diamond-spend
  Advantage packages, and future KronoClub / Reklamları Kaldır sections. It may
  be cached/prefetched for fast open, but purchase remains
  server-authoritative: the client is never trusted for price, cost, user
  identity, reward, or target account. Real-money/TL packages, KronoClub, and
  Reklamları Kaldır must stay visible but disabled with exact `Yakında` button
  copy and must not grant Diamonds/benefits without approved IAP/payment
  verification. Diamond-spend `Satın Al` readiness should depend only on
  auth/user, item data, sufficient Diamonds, item availability, and purchase
  in-flight state; slow non-critical inventory count refresh or starter
  self-heal must not silently disable an otherwise valid Diamond purchase
  button.
- Unified Kronox Puan is the only player-facing score source. Solo contributes
  its best-score component; Online contributes `User.online_progress.score`.
  Online winner scoring is exactly `+15`, loser scoring is exactly `-6` before
  checkpoint protection, and Online has no speed bonus. Online elapsed seconds
  may be stored or displayed for audit/diagnostics but must not change score.
- `User.kronox_puan_total` / `GuestProfile.kronox_puan_total` are the
  materialized current-score projections for visible score reads. The
  public leaderboard hot path reads bounded `SoloLeaderboardEntry`
  projection rows sorted by `total_kronox_score`; bounded `User` repair is
  maintenance/fallback work, not required before first Liderlik rows render.
  Home may idle-prefetch the Liderlik chunk and projection-only snapshot.
- Online stays separate from Solo category preferences.
- Health must protect product contracts and explicitly label manual gates.
- Android/iOS wrapper work remains manual proof until a repo-owned native
  pipeline exists.
- Loading states should expose status semantics (`role="status"`,
  `aria-live`, and a clear accessible name) without changing visual layout.
  Icon-only controls must have accessible labels, custom modal/sheet surfaces
  must be named dialogs, and inline form feedback should use alert/status
  semantics where practical. Static Health guards these source contracts;
  keyboard, screen-reader, and real-device focus behavior remain manual proof.
- Admin authorization guard extraction stays a follow-up while Base44 function
  bundles require inline AdminUser-backed guards. SimulationPanel source files
  stay in the Health/admin/test-suite path until a separate test-runner
  migration is planned.
- App-open/latest-active reporting is server-owned through `recordAppOpen`.
  Authenticated users are derived from `auth.me`; guest users require
  `guest_id + raw guest token` proof. The function writes server-time
  `last_app_open_at` / `last_seen_at` plus coarse `app_platform` only, and
  never stores precise device identifiers or client-provided timestamps.
- Admin aggregate reports such as `Kullanıcı Raporu` must stay behind
  AdminUser-gated functions, return counts instead of private rows, and avoid
  delete/cleanup actions unless a future task explicitly adds a separate
  confirmed maintenance flow.
- The confirmed maintenance exception is `cleanupInactiveGuestUsernames`: it is
  AdminUser-gated, dry-run first, typed-confirmed, server-side rechecked, and
  deletes only eligible inactive zero-score guest-only `GuestProfile` username
  sources plus that guest-owner zero-score leaderboard/presence residue so the
  username can be reused. It tombstones eligible deleted `kronox_user_id`
  values so Kronox IDs are never recycled. It must not delete linked users,
  scored users, users with social relations, users with missing last-open data,
  or real auth accounts.

## UX Polish Governance

- Visual polish work must preserve architecture boundaries. Views may change
  presentation; reducers, gateways, Base44 functions, and entity schemas should
  change only when the task is explicitly about state, backend ownership, or
  data contracts.
- Solo/Online shared components should keep safe parity for typography,
  question-card fit, loading states, and responsive constraints while
  preserving Solo and Online gameplay separation.
- Gameplay state machines/reducers are not visual-design knobs. Do not rewrite
  Solo attempt, Online lobby, notification, economy, or question-selection
  state machines merely to make a screen look richer.
- Profile and Settings visual/navigation changes must preserve route ownership:
  Profile owns `Profil Bilgileri`, Friends, and account-link entry; Settings
  owns privacy/account actions; BottomNav stays `Ana Sayfa`, `Liderlik`,
  `Profil`.
- Base44 remains the production path. UX quality work may improve prompts,
  docs, assets, and React surfaces, but it must not start Base44 migration or
  adapter migration work.
- Motion and asset additions should remain transform/opacity-first and
  low-end Android/WebView-aware. Heavy effects near drag/drop, Online lobby
  start, or notification action paths require manual proof before release
  claims.

## Migration Boundary Without Migrating

The safest next architecture work is not replacing Base44. It is reducing the
number of files that know about Base44 by creating provider-specific gateways:

- `soloProgressGateway`
- `onlineLobbyGateway`
- `notificationGateway`
- `economyGateway`
- `leaderboardGateway`
- `questionGateway`
- `profileGateway`

Each gateway should preserve current payloads first. Provider-neutral adapters
come only after parity tests and live proof exist.
