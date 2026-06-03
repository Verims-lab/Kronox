# Kronox Release Proof Checklist

## Purpose

This checklist captures proof items that static Health cannot honestly automate.

Do not mark these as PASS without:

* a real harness
* a recorded manual run
* a real device test
* a real backend/security probe
* a two-account or three-account runtime test where applicable

Health PASS does not mean release-ready.

---

# 1. Two-Account Invite And Lobby

Test with two real users/devices.

Checklist:

* User A sends an Online invite to User B.
* User B sees the invite after the toast/banner disappears.
* Header badge still shows the invite.
* Online pending invite list still shows the invite.
* User B accepts from banner.
* User B accepts from header list in a separate run.
* User B accepts from Online pending list in a separate run.
* The exact clicked invite opens the correct lobby.
* User A sees User B in lobby.
* User B sees stable lobby state.
* No 3–4 second lobby flicker/drop loop appears.
* User A can start the accepted lobby without a 400.
* Both users navigate to game.
* Host and guest see synchronized game state.

---

# 2. Online Scoring Persistence

Test with two accounts.

Checklist:

* Winner gets +15 base.
* Winner gets individual-time bonus when applicable.
* Winner bonus uses player’s own gameplay time, not total match time.
* Missing elapsed time gives winner +15 only.
* Loser gets -6.
* Loser checkpoint floor is applied.
* Result popup shows persisted result, not preview-only.
* Profile Puan updates after match.
* Header/top stat Puan updates after match if shown.
* Leaderboard current user row updates.
* Profile and Leaderboard show the same Kronox Puan.
* Refreshing completed lobby does not double apply.
* Reopening completed lobby does not double apply.
* Winner and loser both persist correctly.

---

# 3. Solo Question Engine

Checklist:

* Solo attempt starts with an 18-question deck.
* The deck has 18 unique question IDs.
* The deck has 18 unique years.
* Passive-category questions are excluded.
* Only active questions are used.
* Win occurs at 10 correct placements.
* Fail occurs at 8 mistakes.
* Timeout fails the level.
* Replay creates a new deck.
* Mid-game flow does not rerandomize questions.
* Insufficient unique-year pool shows clean error.

---

# 4. Solo Gameplay / Result Screens

Checklist:

* Successful Solo popup opens correctly.
* Failed Solo popup opens correctly.
* Time value is compact and readable.
* Puan value is correct.
* Mistake count is correct.
* Speed bonus state is correct.
* Stars match mistake rules.
* Buttons work:

  * replay
  * next level
  * level map
* Result screen does not scroll unexpectedly.
* Result screen does not clip on small phones.

---

# 5. Diamond Economy

Checklist:

* First authenticated entry grants +100 once.
* Same-day daily login grants +20 once.
* First day can total 120.
* Refresh/reopen does not duplicate starter reward.
* Refresh/reopen does not duplicate daily reward.
* Next UTC day grants daily reward once.
* Ledger row is created when available.
* If ledger recovery exists, partial states self-heal.
* Two-device duplicate prevention is manually probed unless backend unique transaction support exists.

---

# 6. Mobile / PWA

Test on mobile browser and installed PWA if possible.

Checklist:

* Home is no-scroll.
* Home respects safe area.
* Online main screen is no-scroll where intended.
* Solo map scrolls only the map/path area.
* Gameplay does not page-scroll during drag.
* Timeline horizontal scroll still works.
* Bottom nav does not collide with home indicator.
* Top bar does not clip under notch/status bar.
* Popups fit small screens.
* Keyboard does not crush input flows.
* PWA manifest/icons work.
* Push subscription works on real installed device if supported.

## Android 15 Edge-To-Edge / Play Console

Use the latest Google Play Console Android 15 edge-to-edge warning as a release gate.

Checklist:

* Test on an Android 15 device or emulator.
* Verify Home, Profile, Friends, Settings, Online main, Lobby waiting, Solo map, and Gameplay.
* Status bar does not cover top content or the fixed Kronox top bar.
* Navigation bar does not cover bottom nav, lobby controls, game controls, toast actions, or destructive account-deletion confirmation controls.
* Fixed screens remain no-scroll where intended.
* Scroll screens scroll only their intended content area.
* Gameplay drag/drop does not trigger page overscroll.
* Review the Play Console warning after uploading the new AAB.
* If the warning still lists `android.view.Window.setStatusBarColor`, `android.view.Window.getStatusBarColor`, or `android.view.Window.setNavigationBarColor` under React Native / native-wrapper call sites, update the Android wrapper/dependencies rather than adding web-app workarounds.
* Do not mark this complete from static Health alone; it requires an Android 15 runtime proof and Play Console review.

---

# 7. Visual / UI Runtime Proof

Checklist:

* Profile screen matches current Kronox premium fantasy direction.
* Solo success popup matches expected layout.
* Solo failure popup matches expected layout.
* Online lobby waiting screen is visually stable.
* Top bar is consistent across Home/Solo/Online/Profile/Leaderboard where applicable.
* Bottom nav is consistent across main screens.
* General typography is consistent.
* No unintended italic text appears.
* Button styles feel tactile and consistent.
* Icon style is consistent.
* The digit `7` is clearly distinguishable from `1`.
* Timers, scores, ranks, mistakes, diamonds, and levels are readable.
* Fixed screens do not accidentally scroll.
* Scroll screens only scroll the intended area.
* Reduced motion does not produce excessive animation.
* Correct/wrong feedback is not color-only in critical paths.

---

# 8. RLS And Backend Security

Use two-account or three-account probes.

Checklist:

* Unauthenticated `getQuestions` returns 401.
* Normal authenticated users cannot fetch raw/full question-bank metadata.
* Admin-only functions reject unauthenticated users with 401.
* Admin-only functions reject non-admin users with 403.
* Authorized admins can still use admin tools.
* Wrong user cannot accept another user’s GameInvite.
* Wrong user cannot mutate another user’s GameInvite.
* Wrong user cannot see another user’s FriendRequest.
* Wrong user cannot mutate another user’s FriendRequest.
* Non-player cannot mutate Lobby game state.
* User cannot update another user’s PushSubscription.
* Push subscription cannot be read by unrelated user.

---

# 9. Account Deletion

Use a disposable test account only.

Checklist:

* Profile / Ayarlar shows `Hesabı Sil`.
* First tap opens a confirmation instead of deleting immediately.
* Cancel returns safely without deleting.
* Confirm shows loading state.
* Failure shows a recoverable Turkish error and the button is not stuck.
* Successful deletion logs the user out or redirects safely.
* Reopening the app does not resurrect deleted local progress/cache.
* PushSubscription rows for the test account are removed.
* Pending GameInvite rows involving the test account are cancelled.
* FriendRequest/Friendship rows involving the test account are removed or no longer actionable.
* Public leaderboard row for the test account is removed or anonymized.
* Retained OnlineMatchResult/DiamondTransaction rows no longer contain the deleted user's email.
* Another user's account/data is not deleted.
* `/account-deletion` public page copy matches the in-app flow.

Do not mark destructive account deletion proof as complete without a safe test account.

---

# 10. Accessibility And Motion

Checklist:

* Main tap targets are comfortable on small phones.
* Icon-only buttons have labels/tooltips or accessible names.
* Reduced-motion mode reduces heavy shake/drift/pulse.
* Reduced-motion mode keeps essential feedback.
* Correct/wrong feedback is not color-only in critical paths.
* Popups do not trap focus incorrectly.
* Text contrast is readable.
* Small labels remain readable on mobile.

---

# 11. Leaderboard / Profile Consistency

Checklist:

* Profile Kronox Puan matches Leaderboard current-user row.
* Leaderboard rank uses the same score that is displayed.
* Elmas is not derived from score.
* Seviye is displayed consistently.
* No unintended visible `Level` copy appears except category name `Level Up`.
* Leaderboard does not expose unnecessary private user email.

---

# 12. Manual Proof Recording

For every manual test run, record:

```text
Date:
Build marker:
Device(s):
Accounts used:
Browser/PWA:
Test area:
Result:
Screenshots/video:
Remaining risk:
```

If not tested, state clearly:

```text
Manual/runtime proof: not performed
Remaining release risk: yes
```
