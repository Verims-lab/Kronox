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

Parity plan:
- Preserve exact user-facing behavior: dismissing a toast is visual only;
  accepted/expired/rejected rows close actionable notifications.
- Keep labels username-safe.
- Keep push optional and manual device-proven.

## Cross-Cutting Rules

- Public identity is username only.
- UI must not trust request-body user/owner/reward/score fields.
- Service-role writes stay inside Base44 functions.
- Question bank stays backend-only through compact projections.
- Daily Wheel/Daily Quest remain Diamond-only.
- Online stays separate from Solo category preferences.
- Health must protect product contracts and explicitly label manual gates.
- Android/iOS wrapper work remains manual proof until a repo-owned native
  pipeline exists.

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
