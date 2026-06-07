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

* Normal Solo levels start with a 16-question deck.
* Special Solo levels start with a 19-question deck.
* The deck has unique question IDs.
* The deck has unique years.
* Passive-category questions are excluded.
* Only active questions are used.
* Normal Solo levels win after 7 correct timeline cards, including seed cards already on the timeline.
* Special Solo levels start at level 10 and repeat every 5 levels.
* Special Solo levels win after 10 correct timeline cards, including seed cards already on the timeline.
* Fail occurs on the 10th mistake.
* Timeout at 180 seconds fails the level.
* Replay creates a new deck.
* Replay does not duplicate Solo points: same-score and lower-score replays add +0.
* Better replay adds only the positive score delta.
* Mid-game flow does not rerandomize questions.
* Runtime consumes the Solo attempt deck in order: the first active player question card is `soloAttemptDeck[0]`.
* Insufficient unique-year pool shows clean error.
* First 5 displayed active player question cards are at least 5 years apart.
* Seed/preplaced timeline cards do not create close-year conflicts with the first 5 active player question cards.
* Visible placed/seed timeline years do not create 1-4 year conflicts with the current active card when a safe prebuilt-deck alternative exists.
* First 5 cards avoid 3+ same-subcategory or obvious sports-cluster cards when metadata and alternatives allow.
* Normal and special Solo decks avoid one active category dominating where the pool allows.
* First 7 active displayed cards avoid 4+ same-category cards where the pool allows.
* First 7 active displayed cards avoid 4+ same-subcategory/theme cards where the pool allows.
* Sports/theme cards do not appear 3+ back-to-back where metadata and alternatives allow.
* Deck exposes category, subcategory, theme/sports, decade/era, first-5, first-7, and fallback-tier diagnostics for Health/admin/debug only.
* P2 deck diagnostics expose level type, correct target, fail threshold, question IDs, answer years, difficulty distribution, balance score, and warnings for Health/admin/debug only.
* Question pool health warns about insufficient unique years, invalid years, sparse/overrepresented categories or subcategories, and missing sub_category/tag/difficulty metadata.
* `/getQuestions` runtime projection uses deterministic pool-proportional sampling before any gameplay cap; it must not return an ordered newest/category slice.
* Solo deck selection applies soft exposure cooldown/rotation before the attempt starts: never/low-shown and not-recently-shown cards are preferred, high/recent shown cards are downweighted, and missing/corrupt history must not block deck creation.
* Solo category, subcategory, theme, and year-band balancing remains pool-proportional rather than equal-count; large eligible groups may stay large while smaller valid groups are protected from accidental starvation where hard rules allow.
* Question exposure analytics are reviewed after deploy to confirm unique-question coverage and category/subcategory concentration improved.
* Health covers question exposure fairness guardrails: getQuestions projection sampling/metadata, active-vs-runtime pool mismatch diagnostics, repeated Solo deck unique coverage, exposure cooldown/rotation, and category/subcategory/year-band concentration warnings.
* Question Analytics report wording separates all active questions, Solo-eligible questions, runtime projection diagnostics, unique shown questions, and never-shown counts; it must not imply equal category/subcategory counts.
* Difficulty progression remains readiness-only and falls back safely when current question data has mostly difficulty 1 or missing difficulty.
* Replay variety diagnostics can detect repeated first-5 sequences without weakening hard deck rules.
* Deck feels category/subcategory/theme balanced where the pool allows.
* Deck feels era/year balanced rather than clustered.
* Levels 1-3 show beginner-friendly year spacing and a subtle correct-slot pulse while dragging.
* Level 4+ shows no placement pulse unless a future onboarding rule enables it.
* Old completed Solo results are not retroactively recalculated.

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
* Solo Joker bar appears below the timeline and above `KARTI YERLEŞTİR`.
* Each new Solo attempt starts with `Kronokalkan`, `Kart Değiştir`, and `Zaman Dondur`.
* Only 1 joker can be used per attempt; used/disabled states are clear.
* `Kronokalkan` forgives the next wrong placement without incrementing mistakes.
* `Kart Değiştir` replaces the current card from the prebuilt deck/reserve, does not fetch mid-attempt, does not immediately re-show the swapped-out card, respects visible timeline spacing, prefers a balanced replacement, and has helper-only diagnostics for replacement source/no-safe-replacement state.
* `Zaman Dondur` freezes the Solo timer for 10 seconds and cleans up after result/replay.
* Jokers remain free in v1, do not spend Diamonds, and do not grant Kronox Puan.

---

# 5. Settings Category Preferences

Checklist:

* Settings shows `İlgi Alanlarım` for authenticated users.
* Active `Category.status = A/a` rows load as selectable interests.
* Passive `Category.status = P/p` rows are hidden.
* Existing current-user selections load as selected.
* Saving fewer than 3 category selections is blocked with clear copy.
* Saving 3 or more category selections works.
* There is no maximum selection limit.
* Preferences are persisted per user in `UserCategoryPreference`.
* First-login Category preference popup appears for safely identified new
  users and prompts for at least 3 active Category interests.
* Completing the popup saves preferences and prevents the popup from showing
  again for that user.
* Existing users are not hard-blocked solely because preferences are empty.
* Users without a trustworthy profile creation timestamp are not forced into
  the popup by static client inference.
* Users can later change selections under Profile / Settings /
  `İlgi Alanlarım`.
* Preferences do not affect Solo/Online question selection yet.
* Settings no longer shows SubCategory preference options; old
  `UserSubCategoryPreference` rows are left untouched.
* Two-account preference RLS proof remains manual/runtime proof.

---

# 6. Diamond Economy

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
* Daily Wheel appears on Home above `SOLO MEYDAN OKUMA`.
* Daily Wheel claim requires authenticated user.
* Daily Wheel grants Diamonds only and never Kronox Puan.
* Daily Wheel is separate from the existing +20 daily login reward.
* Daily Wheel can be claimed at most once per UTC server day.
* Daily Wheel reward is selected server-side by `claimDailyWheelReward`.
* Daily Wheel reward weights are `10=25%`, `15=22%`, `20=18%`, `25=13%`, `30=10%`, `40=6%`, `50=4%`, `100=2%`.
* Daily Wheel UI animates to the backend-selected reward.
* Daily Wheel duplicate tap/refresh returns the same claimed result or claimed status without a duplicate grant.
* Daily Wheel 7-day streak bonus grants `+100` Diamonds on every 7th consecutive daily spin.
* Missing a UTC day resets the Daily Wheel streak gracefully to 1 on next spin.
* Daily Wheel result shows `+X Elmas kazandın`; when the 7-day streak bonus applies it also shows `7 günlük seri bonusu: +100 elmas` and `Toplam: +Y elmas`.
* Daily Wheel claimed countdown shows `Yarın hazır` or compact time text without a Diamond icon.
* Admin hard-zero / maintenance reset clears Daily Wheel guard fields without granting duplicate Diamonds, changing Kronox Puan, or affecting leaderboard sorting or rank.
* Home diamond count updates immediately after a successful wheel claim.
* Multi-device Daily Wheel duplicate prevention remains a live backend/platform probe unless unique idempotency constraints are configured.

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

## Android Large-Screen / Orientation / Resizability

Use any Google Play Console large-screen, orientation, or resizability warning as a release gate.

Checklist:

* Test on tablet, foldable, and resizable emulator profiles where available.
* App content remains readable when the Android wrapper allows resize, split screen, or larger display classes.
* No important Home, Profile, Friends, Settings, Online, Lobby, Solo, or Gameplay controls are clipped at large widths or unusual aspect ratios.
* If the Android wrapper is locked to portrait, confirm the Play Console warning and document whether the restriction is intentional for this release.
* If Play Console flags unsupported large screens, fix the native wrapper/manifest configuration rather than hiding the warning in web code.
* Do not mark this complete from static Health alone; it requires Android runtime proof and Play Console review.

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
* Admin source-of-truth is the DB-backed `AdminUser` entity and shared backend
  guard `base44/functions/_shared/adminAuth.ts`.
* Frontend admin UI visibility is based on the backend current-user
  `getAdminStatus` route. `getQuestions` must never be used as the admin-status
  source; `AdminUser` rows are not read/listed directly by the client.
* Callable admin status function exists at
  deployed root path `functions/getAdminStatus.js`, plus
  `base44/functions/getAdminStatus/entry.ts` with
  `base44/functions/getAdminStatus/function.jsonc` declaring
  `name: "getAdminStatus"` and `entry: "entry.ts"`.
* Runtime proof must confirm the app is not using a stale persisted Base44
  `functions_version` that returns 404 for `getAdminStatus`: the client must
  not pass `functionsVersion` into `createClient`, and app bootstrap clears
  stale `base44_functions_version` before invoking admin status.
* Legacy admin email env allowlists are not used for authorization.
* There is no unsafe "if no admin exists, everyone is admin" fallback.
* Add the requested new admins by creating `AdminUser` rows in Base44 Data:
  normalized lowercase `email`, `role: "admin"`, `status: "active"`. Do not
  commit the personal admin emails to source.
* Runtime proof: both new admin accounts can open Settings admin tools,
  `/test-suite` / Health Simulator, and the admin question analytics trigger;
  a normal account remains blocked from those surfaces and receives 403 from
  backend admin-only functions; a disabled `AdminUser` row also receives 403.
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
* Retained OnlineMatchResult/DiamondTransaction/DailyWheelSpin rows no longer contain the deleted user's email.
* Retained OnlineMatchResult/DiamondTransaction/DailyWheelSpin rows no longer contain the deleted user.
* Daily Wheel deletion cleanup contract: Retained OnlineMatchResult/DiamondTransaction/DailyWheelSpin rows no longer contain the deleted user.
* Retained economy/gameplay rows do not expose the deleted user identity.
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

# 12. Admin Maintenance Reset

Use an admin account and a disposable target user.

Checklist:

* Normal users cannot see the `Reset User Progress` Settings tool.
* Unauthenticated `/adminResetUserProgress` calls return 401.
* Authenticated non-admin `/adminResetUserProgress` calls return 403.
* Admin preview by target email shows only safe summary values.
* Execute requires typing the exact target email again.
* `Hard zero reset` sets visible Kronox Puan, Solo progress, Online progress, Elmas, Top 5 records, and leaderboard projection to 0 / starting state.
* `Hard zero reset` does not immediately re-grant starter, same-day daily login, or same-day Daily Wheel Diamonds after target refresh.
* `Hard zero reset` sets `daily_wheel_last_spin_date` to the current UTC day and clears Daily Wheel guard fields.
* `New player reset` sets visible progress to starting state and allows normal starter/daily Diamond bootstrap plus Daily Wheel availability on next app entry.
* `New player reset` clears Daily Wheel guard fields and removes target `DailyWheelSpin` rows.
* Daily Wheel admin reset cleanup contract: clears Daily Wheel guard fields.
* Target user account and login/auth identity remain intact.
* Target user local Solo progress mirror is invalidated by `progress_reset_at` after refresh/reopen.
* AdminMaintenanceLog records admin email, target email, mode, timestamp, and result.
* Public leaderboard rows do not expose target raw email after reset.

Do not run this proof against production users without explicit approval.

---

# 13. DB Architecture / Maintenance Jobs

Use an admin account and non-production data where possible.

Checklist:

* `src/lib/dbGateway` modules build successfully.
* Direct normal-user access to raw `Question` remains blocked.
* `QuestionPublicProjection` can be read publicly only for opt-in public rows;
  raw `Question` is not used for SEO/GEO public pages.
* `SoloLeaderboardEntry.total_kronox_score` matches the displayed Kronox Puan
  used for leaderboard sorting.
* `refreshLeaderboardProjection` dry-run returns a safe summary and does not
  expose raw user email in public leaderboard rows.
* `expireOldGameInvites` dry-run identifies only pending invites past
  `expires_at`.
* `cancelStaleLobbies` dry-run targets only waiting/starting lobbies and
  protects active/in_game/finished lobbies.
* `expirePushSubscriptions` dry-run does not delete active subscriptions.
* `aggregateQuestionStats` dry-run updates projected counts from
  `QuestionAttemptEvent` without changing gameplay source rows. Verify
  `shown`/`replacement_shown`, `answered`, and `swapped_out` event types are
  counted separately.
* `sendQuestionAnalyticsReportEmail` sends the manual admin question analytics
  report to the authenticated admin email for the selected period. The report
  must render as HTML/table/bar formatted email with readable empty states and
  a plain-text fallback. Verify deployed SendEmail delivery and Gmail desktop/
  mobile rendering with an admin account.
* `cleanupAdminMaintenanceLog` dry-run archives by retention marker only and
  does not hard delete.
* Admin-only maintenance functions return 401 unauthenticated and 403 for
  non-admin users.
* Base44/platform unique keys are configured or explicitly documented as not
  available:
  * `DiamondTransaction.idempotency_key`
  * `DailyWheelSpin.idempotency_key`
  * `OnlineMatchResult.idempotency_key`
  * `OnlineMatchResult.lobby_id + player_email`
  * `PushSubscription.user_email + endpoint`
  * `SoloLeaderboardEntry.owner_key`
  * `Category.category_id`
* Runtime Solo `QuestionAttemptEvent` writes are enabled for shown, answered,
  swapped-out, and replacement-shown events. Verify they are best-effort and
  never block drag/drop, scoring, or result flow.
* Account deletion proof includes user-owned `QuestionAttemptEvent` rows:
  retained analytics rows must no longer contain the deleted user email/key.

Do not mark scheduled cleanup or platform unique-key proof complete until
verified against the deployed Base44 environment.

---

# 14. Manual Proof Recording

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
