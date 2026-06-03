# Kronox Play Games Auto Sign-In Audit

Date: 2026-06-03
Branch inspected: Codex
Scope: Google Play Games automatic sign-in feasibility, current Kronox auth/profile flow, Play Games profile-link architecture, account deletion impact.

## Executive Summary

Implementation is blocked in this repository because no native Android wrapper exists.

Kronox is currently a Vite/Base44 web/PWA app. The repo contains `public/manifest.json` and `public/kronox-sw.js`, but no Android project, Gradle files, Android manifest, `MainActivity`, Capacitor config, Bubblewrap/TWA manifest, or Google Play Games SDK dependency. Google Play Games Services sign-in cannot be implemented honestly in React-only web code.

Do not add a fake client-side Play Games player id to React state. Google explicitly warns that the player id returned by the Android SDK should not be stored in a backend as trusted identity because an untrusted device can tamper with it. The safe path is native Android Play Games Services v2 sign-in, server-side auth-code verification, and a Kronox profile link created only after backend verification.

## Packaging State

Evidence from repo inspection:

* No `android/` directory.
* No `app/build.gradle`, root `build.gradle`, `settings.gradle`, or `AndroidManifest.xml`.
* No `MainActivity.kt` or `MainActivity.java`.
* No `capacitor.config.ts/js/json`.
* No Bubblewrap or TWA manifest.
* No `play-services-games-v2`, `GamesSignInClient`, `PlayGamesSdk`, or Google Sign-In dependency.
* Current app package is `base44-app`, with Vite scripts only: `dev`, `build`, `lint`, `typecheck`, `preview`.
* PWA artifacts exist: `public/manifest.json`, `public/kronox-sw.js`.

Conclusion: the Google Play package layer is missing from this repo. If Kronox is already uploaded to Google Play, the Android/TWA/WebView wrapper is maintained outside this repository and must be brought into this repo or documented as an external release artifact before Play Games work can proceed safely.

## Current Auth And Profile Flow

Primary auth source:

* `src/lib/AuthContext.jsx`
* `src/api/base44Client.js`
* `src/lib/app-params.js`

Current behavior:

* `base44.auth.me()` is the authenticated profile source.
* `base44.auth.redirectToLogin(...)` starts email/Base44 login.
* `base44.auth.updateMe(...)` persists current-user profile fields.
* The app uses `requiresAuth: false`, so the app can open publicly, but user-owned persistence depends on a Base44 authenticated user.
* App bootstrap grants Diamond rewards after `base44.auth.me()` returns a user.

Important user-owned fields live on `User`:

* `solo_progress`
* `online_progress`
* `kronox_puan_total`
* `diamonds`
* `starter_bonus_granted_at`
* `last_daily_diamond_reward_date`
* `hasCompletedTutorial`
* `game_invite_notifications_enabled`

## Progress And Identity Dependencies

Solo:

* `src/lib/soloLevels.js` stores signed-in progress on `User.solo_progress`.
* Guest fallback exists in localStorage under `kx_solo_progress_v1:guest`.
* Signed-in local mirrors are scoped by owner key derived from email.
* Play Games-linked restore would need either a real Base44 user session or a new verified profile storage path.

Diamonds:

* `src/lib/diamondEconomy.js` grants `+100` starter and `+20` daily only after a user/profile is loaded.
* Idempotency keys currently include normalized email.
* Play Games-only profiles need a non-email durable key strategy or an email-linked Base44 account.

Unified Puan / Leaderboard:

* Visible Puan is derived from Solo + Online components.
* Public leaderboard uses email-derived owner keys internally.
* Play Games-only accounts need a verified identity mapped to an internal Kronox profile id or a new owner-key input that does not expose raw Play Games ids.

Online / Friends / Invites:

* Online currently expects authenticated user identity.
* `MainMenu.jsx` redirects unauthenticated users to Base44 login before Online.
* `LobbyRoom.jsx` uses `host_email`, `players[].email`, and `invited_emails`.
* `FriendRequest`, `GameInvite`, push subscriptions, and friend lookup are email-centric.
* Play Games automatic sign-in can recognize a player, but it does not automatically provide a safe email identity for existing friend/invite flows.

Account Deletion:

* `/deleteAccount` now requires authenticated Base44 user context and cleans up rows by current user id/email.
* Play Games-linked users must still be able to delete their account in-app.
* Any future Play Games mapping entity must be deleted or anonymized in the same deletion flow.

## Correct Target Architecture

### 1. Native Android Layer

Add or bring in an Android wrapper:

* Android project with Gradle.
* `AndroidManifest.xml`.
* `MainActivity`.
* Play Games Services v2 dependency.
* A WebView/Capacitor/native bridge, or a native shell that can securely pass verified auth state into the web app.

Recommended wrapper choice:

* Capacitor or a deliberate custom WebView shell if the web app must keep most UI in React.
* TWA/Bubblewrap is less ideal for bidirectional native auth bridging unless the release pipeline already supports a bridge extension.

### 2. Play Games Automatic Sign-In

The native layer should initialize Play Games Services v2 on app launch and let the SDK attempt platform authentication automatically. The web app should only receive a signed-in/failed status after native sign-in completes.

### 3. Server-Side Verification

The native layer should request server-side access and send a single-use server auth code to a Kronox backend function.

Required backend behavior:

* Exchange the auth code with Google server-side.
* Verify the player through Play Games Services REST APIs.
* Never trust arbitrary client-supplied `playerId`, display name, email, or admin flags.
* Store only the minimal stable verified mapping needed by Kronox.

Suggested backend function:

```text
base44/functions/linkPlayGamesProfile/entry.ts
```

Suggested request:

```json
{
  "serverAuthCode": "...",
  "deviceContext": "android"
}
```

Suggested response:

```json
{
  "ok": true,
  "kronoxProfile": {
    "id": "...",
    "displayName": "...",
    "provider": "google_play_games"
  }
}
```

Blocker: this requires Play Console game configuration, Android OAuth client configuration, game server credential/client id, signing certificate SHA setup, and secure server-side Google credential handling. None of that is present in this repo.

### 4. Kronox Profile Mapping

Prefer a dedicated mapping entity rather than overloading public fields:

```text
PlayGamesProfileLink
```

Suggested fields:

* `provider`: `google_play_games`
* `verified_player_id_hash`
* `display_name`
* `avatar_url` if approved and needed
* `linked_user_id`
* `linked_user_email` only when the user later links email
* `created_at`
* `last_seen_at`
* `deleted_at`

Alternative: add fields to `User`, but that assumes Play Games sign-in can produce or link to a Base44 user session.

### 5. Base44 Session Strategy

This is the key architectural dependency.

Option A: Base44 supports custom/external auth sessions.

* Backend verifies Play Games auth code.
* Backend creates or finds a Base44 user/profile.
* Backend returns a Base44-compatible session/token to the web layer.
* Existing RLS, `auth.me`, `updateMe`, Solo, Diamonds, Online, and deletion flows can continue with less rewrite.

Option B: Base44 does not support custom sessions.

* Do not pretend Play Games users are `base44.auth.me()` users.
* Add service-role backend functions for Play Games profile reads/writes after verified session proof.
* This is a much larger architecture change because Solo progress, Online, friends, invites, notifications, score persistence, and account deletion currently rely on Base44 auth/user email.

Recommended decision before implementation: confirm whether Base44 can mint or accept a verified external-auth session for Google Play Games identities.

### 6. Web Bridge

Suggested web entry point:

```text
src/lib/playGamesBridge.js
```

Responsibilities:

* listen for native Play Games sign-in status
* request link/restore from backend
* notify `AuthContext` only after backend verification
* avoid storing raw auth codes in localStorage
* provide a safe fallback to existing email login

The bridge must be inert on normal web/PWA browsers.

### 7. Guest Progress Merge

Current guest Solo progress exists locally.

After verified Play Games link:

* read guest local Solo progress
* compare with profile/server progress using existing monotonic Solo helpers
* merge only if it improves progress
* do not overwrite better server progress with local data
* publish leaderboard projection after merge
* apply Diamond economy once for the newly recognized profile

### 8. Online Mode Feasibility

Online mode can use Play Games identity only after Kronox has a trusted authenticated app identity.

Email-centric blockers:

* `FriendRequest.from_email/to_email`
* `GameInvite.from_email/to_email`
* `Lobby.host_email`
* `Lobby.players[].email`
* `PushSubscription.user_email`

Safe incremental approach:

* Let Play Games auto sign-in restore Solo, Diamonds, Puan, tutorial, and profile first.
* Keep friend/invite email flows behind email linking until identity model is expanded.
* For Play Games-only Online matchmaking, add a separate internal `player_key` model rather than overloading fake email.

Do not create fake emails from Play Games ids for production social/RLS flows.

### 9. Account Deletion And Compliance

Future deletion must remove/anonymize:

* `PlayGamesProfileLink`
* any Play Games profile display cache
* any native bridge token/cache
* existing user-owned rows already covered by `/deleteAccount`

Public `/account-deletion` copy remains accurate only if Play Games-linked users can delete in-app or request deletion through support with a verifiable identity path.

### 10. Data Safety

Google Play Data Safety should be reviewed before release if Play Games sign-in is added.

Likely data categories affected:

* account identifiers
* player profile/display name
* gameplay progress
* scores/leaderboard data
* device/app identifiers related to Play services
* diagnostics needed for sign-in failures

Do not store server auth codes after exchange. Do not log tokens or raw auth codes.

## Exact Missing Layer

To start implementation, add or import these layers:

```text
android/settings.gradle
android/build.gradle
android/app/build.gradle
android/app/src/main/AndroidManifest.xml
android/app/src/main/java/.../MainActivity.kt
android/app/src/main/res/values/strings.xml
```

Native dependencies:

```text
com.google.android.gms:play-services-games-v2
```

Bridge layer:

```text
MainActivity -> PlayGames bridge -> Kronox web runtime
src/lib/playGamesBridge.js
src/lib/AuthContext.jsx integration
```

Backend/data:

```text
base44/functions/linkPlayGamesProfile/entry.ts
base44/entities/PlayGamesProfileLink.jsonc
base44/functions/deleteAccount/entry.ts update for PlayGamesProfileLink cleanup
```

Configuration:

* Play Console game services project.
* Android OAuth client.
* Game server OAuth credential/client id.
* Release signing SHA certificate.
* Production secret storage for Google client/server credentials.

## Implementation Decision

No Play Games implementation was started in this pass because the required native Android wrapper is absent.

The safe next step is to decide where the Android packaging layer lives:

1. Bring the existing Play Store wrapper into this repo if it exists elsewhere.
2. Or create a controlled Android wrapper project in this repo.
3. Then implement Play Games Services v2 native sign-in and server-side verification.

## References

Official docs checked during this audit:

* Android Developers: Platform authentication for Android games — https://developer.android.com/games/pgs/android/android-signin
* Android Developers: Server-side access to Google Play Games Services — https://developer.android.com/games/pgs/android/server-access
* Android Developers: Platform authentication overview — https://developer.android.com/games/pgs/signin
