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
* `/getQuestions` derives playable category IDs from active `Category` rows;
  old hardcoded seed-category lists must not exclude newer active categories
  from Solo runtime projection.
* First Solo start in a fresh browser attempts online `getQuestions` before any
  offline fallback and shows `Sorular hazırlanıyor...` while pending.
* Guest/no-auth Solo starts use the public-safe minimal `getQuestions`
  projection and do not require login before question loading.
* Empty local question cache alone must not show `İnternet bağlantısı yok`.
* After a question-set replacement, stale local question cache is invalidated by
  cache version and the game fetches fresh DB questions before deck build.
* If online fetch fails while the browser is online, the game shows a retryable
  question-load message, not a fake offline/no-cache screen.
* `Tekrar Dene` clears transient question-load errors and re-fetches online
  without requiring the user to go back.
* Direct `/game` access without Solo launch state is handled as missing game
  state and routes back to Home/Solo entry safely.
* True offline plus no usable cache still shows the offline/no-cache screen.
* Solo deck selection applies soft exposure cooldown/rotation before the attempt starts: never/low-shown and not-recently-shown cards are preferred, high/recent shown cards are downweighted, and missing/corrupt history must not block deck creation.
* Solo category, subcategory, theme, and year-band balancing remains pool-proportional rather than equal-count; large eligible groups may stay large while smaller valid groups are protected from accidental starvation where hard rules allow.
* Question exposure analytics are reviewed after deploy to confirm unique-question coverage and category/subcategory concentration improved.
* Health covers question exposure fairness guardrails: getQuestions projection sampling/metadata, active-vs-runtime pool mismatch diagnostics, repeated Solo deck unique coverage, exposure cooldown/rotation, and category/subcategory/year-band concentration warnings.
* Health covers the category-boundary audit: guest/no-preference users use all
  active categories, saved preferences are Solo-only soft weighting, Online
  remains separate, and no eligible active category is hardcoded out of the
  `getQuestions` projection.
* Question Analytics report wording separates all active questions, Solo-eligible questions, runtime projection diagnostics, unique shown questions, and never-shown counts; it must not imply equal category/subcategory counts.
* Question Analytics report includes the generic top-shown concentration guardrail: high category/subcategory concentration is not automatically unfair and must be compared with the Solo-eligible pool before drawing fairness conclusions.
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
* Solo Joker bar reads `UserJokerInventory` and shows current owned counts for
  `Kronokalkan`, `Kart Değiştir`, and `Zaman Dondur`.
* A joker with balance 0 is disabled and cannot apply an effect.
* Multiple jokers can be used across one Solo level when the player owns them.
* Only one joker can be used for the current question/card; the guard resets on
  the next card and survives `Kart Değiştir` replacement for the same decision.
* `Kronokalkan` forgives the next wrong placement without incrementing mistakes.
* `Kart Değiştir` replaces the current card from the prebuilt deck/reserve, does not fetch mid-attempt, does not immediately re-show the swapped-out card, respects visible timeline spacing, prefers a balanced replacement, and has helper-only diagnostics for replacement source/no-safe-replacement state.
* `Zaman Dondur` freezes the Solo timer for 10 seconds and cleans up after result/replay.
* Successful Solo joker use writes a `JokerTransaction` row with
  `reason: solo_use`, `quantity_delta: -1`, and a stable idempotency key.
* Joker spend must not make balance negative and double tap must not duplicate
  the spend/ledger row.
* used jokers are not refunded on fail, timeout, or exit.
* No refund also applies to replay, browser close, or abandoned attempts.
* Jokers do not spend Diamonds and do not grant Kronox Puan.

---

# 5. Settings Category Preferences

Checklist:

* Settings shows `İlgi Alanlarım` for authenticated users.
* Active `Category.status = A/a` rows load as selectable interests.
* Passive `Category.status = P/p` rows are hidden.
* Existing current-user selections load as selected.
* Saving fewer than 3 category selections is blocked with clear copy.
* Saving 3 or more category selections works.
* There is no maximum selection.
* Preferences are persisted per user in `UserCategoryPreference`.
* Category preference popup appears as optional personalization for any
  authenticated user with fewer than 3 active valid Category preferences,
  including existing users, and it can be deferred.
* Passive Category rows and passive preference rows do not count toward the
  minimum.
* Previously selected Categories that become passive or are removed are filtered
  out of active UI/save state and are not resaved as active preferences.
* Completing the popup saves preferences and prevents the popup from showing
  again while the user still has 3 or more active valid preferences.
* Users can later change selections under Profile / Settings /
  `İlgi Alanlarım`.
* No login/no saved preferences/empty preferences use all active categories for
  Solo. Saved preferences target 70% selected user categories and 30% full
  eligible pool only when at least 3 active valid preferences are available.
  `Game.jsx` must explicitly call
  `getValidActiveSelectedCategoryIds(preferences, activeCategories)` in the
  Solo-only wiring path; Online category selection remains separate.
* Category preference save validation remains separate from gameplay start and
  must not block question loading.
* Empty preferences must not produce an empty candidate pool or fake
  offline/no-cache error.
* Normal 16-card Solo decks target 11 selected-category and 5 global-pool
  cards; special 19-card Solo decks target 13 selected-category and 6
  global-pool cards.
* The selected-category 70% lane is not difficulty-1 restricted. The global
  30% lane prefers difficulty 1 questions from the full eligible pool where
  possible.
* If the global difficulty-1 pool is insufficient, the broader full eligible
  global pool fills safely instead of failing the deck.
* Selected-category shortage falls back to the full eligible pool instead of
  failing the deck.
* Online question selection is not affected.
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
* `Günlük Ödüller` panel appears on Home above `SOLO MEYDAN OKUMA` and includes
  Daily Wheel plus one compact `Günlük Görev`.
* Daily Wheel claim requires authenticated user.
* Daily Wheel grants Diamonds only and never Kronox Puan.
* Daily Quest Runtime v1 grants diamonds only through the server-backed
  `claimDailyQuestReward` path.
* Daily Wheel and Daily Quest use separate guard fields/idempotency keys:
  `daily_wheel:<email>:<YYYY-MM-DD>` and
  `daily_quest_reward:<email>:<YYYY-MM-DD>:<quest_key>` / `User.daily_quest_*`.
* Daily Wheel is separate from the existing +20 daily login reward.
* Daily Wheel can be claimed at most once per UTC server day.
* Daily Wheel reward is selected server-side by `claimDailyWheelReward`.
* Daily Wheel reward table is `30 high weight 24`, `40 high weight 22`,
  `50 high weight 20`, `60 medium weight 12`, `75 medium weight 10`,
  `100 low weight 7`, `150 rare weight 4`, `250 very_rare weight 1`.
* Daily Wheel UI animates to the backend-selected reward.
* Daily Wheel duplicate tap/refresh returns the same claimed result or claimed status without a duplicate grant.
* Daily Wheel 7-day streak bonus grants `+150` Diamonds on every 7th consecutive daily spin.
* Missing a UTC day resets the Daily Wheel streak gracefully to 1 on next spin.

## Joker Inventory

* `UserJokerInventory` exists as the current user-owned joker balance entity.
* `JokerTransaction` exists as the append-only joker ledger/idempotency audit.
* Every authenticated user receives exactly 3 `mistake_shield` / Kronokalkan,
  3 `card_swap` / Kart Değiştir, and 3 `time_freeze` / Zaman Dondur once.
* Starter grants use idempotency keys shaped like
  `starter_jokers:<email>:<joker_type>` and do not repeat on refresh, login,
  app reopen, or Profile reopen.
* Existing users are lazily initialized; no manual DB backfill is required for
  normal rollout.
* Missing or partial `UserJokerInventory` rows self-heal for authenticated
  users without overwriting existing balances.
* If inventory rows are missing but `JokerTransaction` rows exist, repair uses
  the latest ledger `balance_after` and must not refund spent jokers.
* Duplicate, unknown, or malformed inventory rows do not crash `Joker Çantası`;
  valid known joker balances still render.
* Starter grant, Mağaza purchase, Solo spend, Profile, and Solo bar all use the
  same normalized lowercase `user_email` owner convention.
* Profile displays balances under `Joker Çantası`, not `Envanter`.
* Profile shows only current balances and does not expose `JokerTransaction`
  ledger rows to normal users.
* Profile/Solo/Mağaza use the shared `getUserJokerBalances` path; complete
  `UserJokerInventory` rows render through a fast current-balance read, while
  `ensureUserJokerInventory` runs only for missing/partial rows or explicit
  retry.
* Profile must not scan or sum `JokerTransaction` rows to display balances.
* Profile Joker Çantası has its own loading/error/retry state and must not
  block the rest of Profile.
* Mağaza purchase and Solo spend must refresh/update the shared joker balance
  cache so Profile and Solo show the same persistent counts.
* Recommended/manual DB setup remains: unique `UserJokerInventory.user_email +
  joker_type`, unique `JokerTransaction.idempotency_key`, and indexes for
  `UserJokerInventory.user_email`, `JokerTransaction.user_email + created_at`,
  and `JokerTransaction.user_email + joker_type`.
* Runtime performance proof: after login, Profile Joker Çantası should load
  quickly; after Mağaza purchase and Solo spend, Profile and Solo counts should
  refresh without false zero or long blank states.
* Runtime two-account proof must verify users cannot read/mutate other users'
  joker balances or create arbitrary grant rows.
* Solo use spends one owned joker through `spendUserJoker` and writes
  `JokerTransaction.reason = solo_use`.
* Home shows the Mağaza entry at top-left, Diamond count top-center, and
  notifications top-right.
* Mağaza Phase 1 sells only three Solo jokers:
  `Zaman Dondur = 40` Diamonds, `Kart Değiştir = 50` Diamonds,
  `Kronokalkan = 60` Diamonds.
* Mağaza purchase uses `purchaseJokerWithDiamonds`; the client displays price
  but the backend owns the trusted price table and sufficient-Diamond check.
* `purchaseJokerWithDiamonds` explicitly binds `UserJokerInventory`,
  `DiamondTransaction`, and `JokerTransaction`; missing deployed entity
  registries must fail safely rather than exposing raw errors.
* Successful purchase writes both `DiamondTransaction.source = market_purchase`
  with `direction = spend` and `JokerTransaction.reason = market_purchase`.
* Purchase uses a per-action idempotency key and pending UI guard; live
  double-tap/race proof remains manual unless Base44 unique constraints are
  configured.
* Insufficient Diamonds must not decrease Diamonds, increase joker balance, or
  write successful purchase ledger rows.
* Both `DiamondTransaction` and `JokerTransaction` must be present for a
  completed Mağaza purchase; partial ledger states fail closed and require
  reconciliation.
* Client is not trusted for price; purchase validation is server-authoritative.
* Manual Mağaza Phase 1 proof:
  1. Open Home on mobile browser/PWA.
  2. Confirm Mağaza top-left, Diamonds center, notifications right.
  3. Open Mağaza and confirm title `Mağaza`.
  4. Confirm prices: Zaman Dondur 40, Kart Değiştir 50, Kronokalkan 60.
  5. Buy Zaman Dondur with sufficient Diamonds.
  6. Confirm Diamonds decrease by 40 and Zaman Dondur increases by 1.
  7. Confirm both `DiamondTransaction` and `JokerTransaction` exist with
     `market_purchase` and the same idempotency key.
  8. Confirm failed purchase copy is safe, e.g.
     `Satın alma tamamlanamadı. Tekrar dene.`
  9. Return to Profile and confirm `Joker Çantası` updated.
  10. Start Solo and confirm the purchased joker count appears in the joker bar.
  11. Test an existing account with missing/partial joker rows and confirm
      `Joker Çantası` self-heals without duplicate starter grants.
  12. Try insufficient Diamonds and confirm no balance changes.
  13. Double-tap purchase and confirm no duplicate charge/grant.
  14. Retry after a simulated network failure if possible and confirm no
      double-charge or double-grant.
  14. Repeat from two tabs/devices if possible; this is the live race proof.
  14. Verify Online mode remains unaffected.
  15. Verify Daily Wheel still grants Diamonds only.
* Market purchase is a Diamond sink; Daily Wheel remains a Diamond source.
* Daily Wheel remains Diamond-only and must not grant jokers.
* Daily Wheel result shows `+X Elmas kazandın`; when the 7-day streak bonus applies it also shows `7 günlük seri bonusu: +150 elmas` and `Toplam: +Y elmas`.
* Daily Wheel claimed countdown shows `Yarın hazır` or compact time text without a Diamond icon.
* Admin hard-zero / maintenance reset clears Daily Wheel guard fields without granting duplicate Diamonds, changing Kronox Puan, or affecting leaderboard sorting or rank.
* Home diamond count updates immediately after a successful wheel claim.
* Multi-device Daily Wheel duplicate prevention remains a live backend/platform probe unless unique idempotency constraints are configured.

## Daily Quest Runtime v1

* `DailyQuestDefinition` exists as the admin-managed template table.
* Profile / `Admin Ekranı` shows `Günlük Görev Yönetimi` only to active
  `AdminUser` role `owner`/`admin`.
* Active admins can list definitions and create new definitions through the
  server-backed `createDailyQuestDefinition` callable.
* Normal users and disabled/passive admins cannot view the management UI and
  must receive 401/403 if they call the backend directly.
* Required definition fields are `quest_key`, `title`, `description`,
  `quest_type`, `target_value`, `reward_diamonds`, and `status`.
* Supported v1 `quest_type` values are `start_solo_attempt`, `correct_cards`,
  `complete_solo_level`, and `use_joker`.
* `quest_type` is a dropdown/enum, not arbitrary admin free text.
* `target_value` and `reward_diamonds` must be integers of at least 1.
* `title` and `description` are display-only; text is not parsed with AI,
  NLP, regex, scripts, or any free-text executable condition.
* Daily Quest definitions are Diamond-only templates: no Kronox Puan field,
  no leaderboard impact, and no Solo/Online scoring changes.
* `UserDailyQuestProgress` exists as the user-owned per-day progress table.
* `getDailyQuestStatus` ensures 1 Daily Quest per UTC day and excludes passive
  definitions from new daily sets.
* `DailyQuestDefinition.quest_key` is the logical unique key. Admin create and
  default seed must reject/skip existing `quest_key` rows; Base44/platform
  uniqueness is recommended where available.
* Admin list/refresh is read-only and must not seed default definitions.
  Existing duplicate `quest_key` rows are grouped into one canonical Admin UI
  row with a warning; cleanup is manual after backup, not automatic deletion.
* Runtime groups duplicate active definitions by `quest_key` and selects one
  canonical definition by `sort_order`, `created_at`, then stable id before
  selecting the first logical Daily Quest.
* Günlük Görev requires active `DailyQuestDefinition` rows. Fresh DBs seed
  the default Solo-focused definitions idempotently when no definitions exist;
  if no active definitions remain, Home shows
  `Günlük görev yakında hazır olacak.` instead of a permanent loading state.
* `getDailyQuestStatus` is authenticated and user-owned, not admin-only. It
  creates/fetches current-user `UserDailyQuestProgress` rows and preserves
  newly created rows if an immediate Base44 refresh is stale.
* Older same-day 3-quest rows are retained but Home displays only the selected
  current primary quest.
* Loading or ensuring today’s quests does not grant Diamonds;
  `claimDailyQuestReward` remains the only reward path.
* Completing progress alone does not grant Diamonds; completed and unclaimed
  quests must show an `Al` claim action.
* The Home Daily Quest copy is
  `Günlük Görevleri Yap, Elmasları Kazan!`.
* `recordDailyQuestProgress` updates Solo-only events:
  `start_solo_attempt`, `correct_cards`, `complete_solo_level`, and `use_joker`.
  `start_solo_attempt` is recorded only after the Solo deck is built, the first
  question is selected, and the attempt actually starts.
* `claimDailyQuestReward` requires completed status, uses the reward copied in
  the progress row, writes `DiamondTransaction.source = daily_quest_reward`,
  updates the visible `User.diamonds` balance, returns `diamondBalanceAfter`,
  and marks the row claimed.
* `getDailyQuestStatus`, `recordDailyQuestProgress`, and
  `claimDailyQuestReward` explicitly bind `UserDailyQuestProgress` in their
  Base44 runtime functions for deployability.
* One claim per quest per UTC day is enforced by `UserDailyQuestProgress` status
  plus the `daily_quest_reward:<email>:<YYYY-MM-DD>:<quest_key>` idempotency
  key; duplicate claim must not grant Diamonds twice.
* Daily Quest does not grant Kronox Puan and has no leaderboard impact.
* Daily Quest grants diamonds only.
* Active User summary fields are `daily_quest_last_claim_date` and
  `daily_quest_next_available_at`.
* Initial definitions are seeded idempotently by `quest_key`:
  `start_1_solo_attempt`, `correct_5_cards`, `complete_1_solo_level`, and
  `use_1_joker`.
* Manual duplicate cleanup recommendation: keep one canonical
  `DailyQuestDefinition` per `quest_key`; deactivate or delete duplicates only
  after backup/operator confirmation.
* Daily Wheel remains separate from Daily Quest definitions, and Mağaza /
  Joker Inventory / Solo joker spending remain unaffected.
* Manual proof: open Home, see `Günlük Ödüller`, confirm Daily Wheel and one
  `Günlük Görev`, start a Solo attempt, correctly place cards, complete a Solo
  level, successfully use a joker, claim the completed quest, confirm
  Diamonds increase, confirm one `daily_quest_reward` DiamondTransaction exists,
  retry duplicate claim, confirm no Kronox Puan/leaderboard change, and confirm
  Online mode does not progress quests.

---

# 7. Privacy Policy / App Store Privacy

Checklist:

* Public privacy URL is `https://kronoxgame.com/privacy`.
* `/privacy` must be publicly accessible without login, admin status, backend
  data, or redirect to Home/login.
* The page title is `Gizlilik Politikası`, includes a last-updated date, and
  lists a support contact email.
* The policy must disclose current Kronox data categories: account/profile
  data, gameplay/progress/leaderboard data, friends/invites/social data,
  category preferences, optional push subscription/notification data,
  local storage/cache/IndexedDB use, Daily Wheel/Daily Quest/Mağaza/Joker/
  Diamond economy records, and question analytics/reporting data.
* The policy must state Kronox does not sell personal data for third-party
  advertising and must not claim that no data is collected.
* Account deletion/access/correction requests must be covered. If the in-app
  account deletion flow is available, users may use it; support email remains
  available for privacy requests.
* App Store Connect privacy answers must match the `/privacy` policy. Update
  both whenever data collection, analytics, push notifications, social features,
  or economy/ledger behavior changes.
* Manual proof: open `https://kronoxgame.com/privacy` from a fresh browser
  without login and confirm the Turkish privacy policy loads on mobile.

---

# 8. Mobile / PWA

Test on mobile browser and installed PWA if possible.

Checklist:

* Home is no-scroll.
* Home respects safe area.
* Online main screen is no-scroll where intended.
* Solo map scrolls only the map/path area.
* Gameplay does not page-scroll during drag.
* Timeline horizontal scroll still works.
* Bottom nav does not collide with home indicator.
* BottomNav visible tabs are Ana Sayfa, Liderlik, and Profil only. Online is
  launched from Home through Online Kapışma, not from BottomNav. Switching
  visible tabs preserves the previous subroute/scroll state; tapping the active
  tab resets that tab to its root. `/game` remains outside tab stacks and
  full-screen according to existing gameplay rules.
* Top bar does not clip under notch/status bar.
* Popups fit small screens.
* Keyboard does not crush input flows.
* Friends, Liderlik, and admin maintenance lists use the app-provided scoped
  Pull-to-Refresh. It must call the real list reload path, respect reduced
  motion, and must not install global gesture handlers or affect gameplay drag.
* Category preferences and admin selection controls use Kronox-themed
  bottom-sheet selectors instead of raw native HTML selects in the targeted
  surfaces. The sheets must support Escape/backdrop close, focus return,
  dark-mode readability, safe-area bottom padding, and reduced-motion behavior.
* PWA manifest/icons work. PWA/web icons may be separate from native iOS
  AppIcon assets, but any icon source consumed by Wix/native wrapper generation
  must be a local opaque PNG.
* iOS AppIcon PNGs must be fully opaque before App Store upload. No alpha
  channel, no `tRNS` transparency chunk, and no transparent corners are allowed.
* The 1024x1024 `ios-marketing` / large app icon must be RGB/opaque. App Store
  Connect error 90717 means a transparent or alpha-channel icon remains in the
  final `WixOneApp.app` icon asset, not merely that source files look wrong.
* `index.html`, `public/manifest.json`, `src/manifest.json`, and the splash
  screen must point at local opaque `/assets/icons/kronox-app-icon-*` PNGs so
  wrapper/icon regeneration cannot reintroduce the old transparent remote icon.
* Base44's **Generate App Store files → App logo** upload is also an iOS icon
  source. Upload `public/assets/icons/base44-app-logo-1024-no-alpha.png` there:
  a 1024x1024 RGB/no-alpha PNG on an opaque Kronox navy/black background. App
  Store Connect 90717 can persist if Base44 regenerates `WixOneApp.app`
  AppIcon assets from a transparent uploaded logo, even when repo icons are
  alpha-free.
* Run `npm run check:ios-icons` before native archive upload; it validates
  `ios/App/App/Assets.xcassets/AppIcon.appiconset/Contents.json`, referenced
  PNG dimensions, manifest icon PNGs, forbidden transparent source references,
  the Base44 upload logo PNG, and no-alpha PNG metadata.
* After any icon change, clean the native/iOS build folder, delete stale
  archives, regenerate wrapper/native assets if that toolchain caches icons,
  click Base44 **Generate Files** again, rebuild/archive, and inspect the final
  exported IPA or `Payload/WixOneApp.app`. Old IPA/archive files must not be
  reused after replacing the Base44 App logo.
* Final release gate: validate the final `WixOneApp.app` icon asset from the
  regenerated archive/exported IPA before upload. Source PNG checks are a
  pre-upload guard, but the final `WixOneApp.app` icon asset is the object App
  Store Connect rejects for App Store 90717 if any alpha channel remains.
* Release execution: archive/export the iOS build after Base44 regenerates the
  files, then re-upload or validate in App Store Connect. Do not treat a web
  deploy or old local archive as proof for App Store 90717.
  If icons are compiled into `Assets.car`, use Xcode/`assetutil` or App Store
  Connect validation as the final proof; source-only checks must not claim the
  90717 fix is proven. Real App Store Connect re-upload validation remains
  manual.
* Push subscription works on real installed device if supported.
* `sendGameInvitePush` requires backend `VAPID_PUBLIC_KEY`,
  `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` config; missing/blank values return
  explicit `vapid_config_missing` / `missing_vapid_config` push diagnostics.
* `VAPID_PRIVATE_KEY` is backend-env-only: it must be stored as a deployment
  secret, never committed, never read from `VITE_`, and never logged/returned.
  Scanner findings that only flag the env var name are deployment-secret
  management notes unless actual key material is found.
* `VAPID_PUBLIC_KEY` may be used by browser subscription code through
  `VITE_KRONOX_VAPID_PUBLIC_KEY`; it is public-by-design but still
  config-managed. Backend push signing must use only deployment-managed
  non-`VITE_` config.
* `VAPID_SUBJECT` is deployment configured and validated; it is not hardcoded
  as a source fallback. It may contain contact/config metadata and must not be
  logged or returned unnecessarily.
* `VAPID_SUBJECT` uses a `mailto:` or `https://` subject and VAPID keys use
  non-empty base64url-style deployment values.
* Backend push config has no empty-string, dummy, hardcoded, or `VITE_`
  private-key fallback; in-app invites remain functional if push is not
  configured.
* Missing VAPID config returns safe skip diagnostics such as `pushSent: false`,
  `pushSkipped: true`, `missingConfig: true`, and
  `reason: vapid_config_missing`; push summaries preserve `skippedReasons`,
  `failedReasons`, `missing_vapid_config`, `no_active_subscriptions`, and
  `subscriptionCount` without returning VAPID values, private keys, push auth
  secrets, or raw provider stack traces.
* `npm run build` is not backend-secret proof. Real push delivery remains a
  manual runtime proof on a subscribed device with deployed backend secrets.

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
* Mobile browser gameplay uses a scoped card-drag overscroll guard: the guard
  is active only during gameplay/card drag, uses a `passive:false` touchmove
  prevention path where needed, and must not disable Profile/Settings scrolling.
* App-provided Pull-to-Refresh is separate from the gameplay drag guard and is
  scoped only to Friends, Liderlik, and admin list containers.
* Real-device proof is required on iOS Safari, Android Chrome, and PWA/standalone
  before release: start Solo, drag the question card vertically/diagonally,
  confirm pull-to-refresh does not fire, then confirm placement, drop-zone
  hit-testing, and horizontal timeline auto-scroll still work.
* If the browser is refreshed anyway, full current-attempt restore is not proven
  by this guard; treat refresh resume as a separate follow-up risk unless a
  runtime restore proof exists.
* Used jokers are not refunded if the browser is refreshed or closed after
  the joker effect was applied.
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

# 9. Visual / UI Runtime Proof

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

# 10. RLS And Backend Security

Use two-account or three-account probes.

Checklist:

* Unauthenticated `getQuestions` returns 401.
* Normal authenticated users cannot fetch raw/full question-bank metadata.
* Admin-only functions reject unauthenticated users with 401.
* Admin-only functions reject non-admin users with 403.
* Authorized admins can still use admin tools.
* Profile normal-user actions are `Sosyal / Arkadaşlarım` and `Hesap / Ayarlar`.
* Active `AdminUser` role `owner`/`admin` users additionally see `Admin Ekranı`.
* `Admin Ekranı` contains admin-only maintenance/report tools; Settings remains
  account/help/preferences focused.
* Direct `/admin` access by normal users is blocked or redirected safely.
* Admin source-of-truth is the DB-backed `AdminUser` entity. The shared
  backend guard `base44/functions/_shared/adminAuth.ts` is preferred wherever
  the function deployment supports it; runtime-sensitive Base44 callable/flat
  functions may inline the same AdminUser role/status contract.
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
* Runtime proof: both new admin accounts can open Profile / `Admin Ekranı`,
  `/test-suite` / Health Simulator, and the admin question analytics trigger;
  a normal account remains blocked from those surfaces and receives 403 from
  backend admin-only functions; a disabled `AdminUser` row also receives 403.
* Runtime proof: `simulateOnlineGame` blocks unauthenticated callers, normal
  users, and disabled/passive admins; only active `AdminUser` owner/admin rows
  may run it. The function must not contain `en_core_news_sm`, trust
  `user.role`, trust request-body roles, or use hardcoded admin emails.
* Runtime proof: `resetTestAccountProgress` blocks unauthenticated callers,
  normal users, and disabled/passive admins; only active `AdminUser`
  owner/admin rows may reset the intended test target, and the request must
  include exact target-email confirmation. It must not read
  `KRONOX_TEST_RESET_EMAILS` or `TEST_RESET_EMAILS`; remove those legacy env vars
  from deployment after this migration.
* Runtime proof: when each active admin triggers the Question Analytics Report,
  the backend response shows `requestedBy` and `recipientEmail` as that same
  authenticated admin email, plus a safe email dispatch status. The report
  recipient must not be hardcoded or derived from `created_by`.
* Wrong user cannot accept another user’s GameInvite.
* Wrong user cannot mutate another user’s GameInvite.
* Wrong user cannot see another user’s FriendRequest.
* Wrong user cannot mutate another user’s FriendRequest.
* Non-player cannot mutate Lobby game state.
* User cannot update another user’s PushSubscription.
* Push subscription cannot be read by unrelated user.

---

# 11. Account Deletion

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

# 12. Accessibility And Motion

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

# 13. Leaderboard / Profile Consistency

Checklist:

* Profile Kronox Puan matches Leaderboard current-user row.
* Leaderboard rank uses the same score that is displayed.
* Elmas is not derived from score.
* Seviye is displayed consistently.
* No unintended visible `Level` copy appears except category name `Level Up`.
* Leaderboard does not expose unnecessary private user email.

---

# 14. Admin Maintenance Reset

Use an admin account and a disposable target user.

Checklist:

* Normal users cannot see `Admin Ekranı` or the `Reset User Progress` tool.
* Unauthenticated `/adminResetUserProgress` calls return 401.
* Authenticated non-admin `/adminResetUserProgress` calls return 403.
* Legacy `/resetTestAccountProgress` calls also use AdminUser-backed
  authorization, return 401/403 for unauthenticated or non-admin callers, block
  disabled/passive admins, require exact target-email confirmation, and do not
  use `KRONOX_TEST_RESET_EMAILS` / `TEST_RESET_EMAILS`.
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

# 15. DB Architecture / Maintenance Jobs

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
* `aggregateQuestionStats` dry-run reports projected counts from
  `QuestionAttemptEvent` without changing gameplay source rows. A non-dry-run
  admin call writes optional `QuestionStatsProjection` and
  `CategoryStatsProjection` summaries. These projection tables may be empty if
  the manual refresh has not been run, and the current 9-section email report
  does not require them.
* `sendQuestionAnalyticsReportEmail` sends the manual admin question analytics
  report to the authenticated admin email for the selected period. The report
  must render as HTML/table/bar formatted email with readable empty states and
  a plain-text fallback. The function must be registered at
  `base44/functions/sendQuestionAnalyticsReportEmail/entry.ts` with
  `base44/functions/sendQuestionAnalyticsReportEmail/function.jsonc`
  (`name: "sendQuestionAnalyticsReportEmail"`, `entry: "entry.ts"`). Verify
  deployed SendEmail delivery and Gmail desktop/mobile rendering with an admin
  account. The callable report function inlines the DB-backed AdminUser guard
  for the current Base44 function runtime so a local `_shared` import cannot
  break deploy and leave a stale event-detail-first report body. Shared
  AdminUser guard imports remain preferred for functions where they deploy
  cleanly; the inline report guard must enforce the same normalized email,
  active status, and `owner`/`admin` role contract with no hardcoded admin
  allowlist. `npm run build` is a Vite frontend build and is not, by itself,
  proof that Base44 backend functions were redeployed.
* Any active `AdminUser` with role `admin` or `owner` can trigger the report.
  The recipient defaults to the requesting authenticated admin's normalized
  email; mismatched recipient overrides are rejected, and `created_by` is not
  used as the recipient. The function returns safe diagnostics including
  `requestedBy`, `recipientEmail`, `emailDispatchStatus`, template version, and
  body-marker booleans. Verify each active admin's real inbox/provider delivery
  manually.
* Question Analytics report is currently sent fully inside the email body. The
  PDF attachment flow is intentionally disabled/cancelled for now after runtime
  email receipt showed the attachment was not reliable. The email must not say
  `PDF ekte` or otherwise claim an attachment exists.
* Runtime proof requires triggering the live `sendQuestionAnalyticsReportEmail`
  function as an active admin and confirming `templateVersion:
  nine-section-email-v1`, `emailBodyMode: nine_section_email_body`,
  `reportDeliveryMode: email_body_only`, `bodyContainsExactlyRequiredSections:
  true`, `requiredSectionOrderValid: true`, `renderedSectionHeaderCount: 9`,
  `bodyLength > 1000`, `reportBuildMarker: Codex323`, the email arrives, and the received email body is
  readable/useful without an attachment. `npm run build` does not prove Base44
  backend function deployment or live SendEmail output.
* Runtime Projection wording is diagnostic only and must include
  `getQuestions diagnostics` while keeping active pool, Solo-eligible pool,
  and runtime projection concepts separate. The email report must not fake a
  live projection if it does not call `/getQuestions`.
* The active report builder keeps Gmail-safe hidden markers for each exact
  section, for example `--- Executive Summary ---`, while visible headings
  remain clean.
* These sections are intentionally removed from generated email output:
  `Rapor Şablonu`, `Rapor Bölümleri`,
  `Sistemdeki Soru Havuzu: Kategori / Zorluk Dağılımı`,
  `Kategori ve Zorluk Bazında Kayıtlı Soru Sayısı`,
  `Kategori Bazında Yıl Aralığı`, and `Kategori İçi Soru Analizi`.
* The email body must contain exactly these 9 sections in this order:
  `Executive Summary`, `Kategori Bazında Soru Havuzu`, `Kategori Tercihleri`,
  `Kategori Bazında Gösterim`, `En Çok Gösterilen Sorular`, `Az ya da Hiç
  Gösterilmeyen Sorular`, `En Çok Yanlış Yapılan Sorular`, `Joker Kullanımı
  Analizi`, and `Oynanma Zamanı ve Kullanım Ritmi`. Joker and play-rhythm
  sections must be table-based and must show structured `Yeterli veri yok` rows
  when exact metrics are not captured.
* The report must not invent analytics. If joker outcomes, session duration,
  guest/preference source, exit reason, or local timezone are not captured, the
  email report must mark the data as insufficient and recommend exact
  instrumentation. Category preference counts remain aggregate-only; no user IDs
  or emails appear in the report.
* If attachment support is revisited later, release proof must include a real
  Gmail receipt with an openable attachment before docs/Health can make it
  mandatory again.
* Question analytics reset is currently a manual DB maintenance operation; the
  function-based reset path is not used. The active source for question
  show/answer/time history is `QuestionAttemptEvent`, and the current
  9-section email report computes those sections from raw events. After
  replacing the question pool, manually clear `QuestionAttemptEvent` and, if
  populated, the optional manual projection tables `QuestionStatsProjection`
  and `CategoryStatsProjection`.
* Manual question analytics reset must not delete `Question`, `Category`,
  `SubCategory`, `UserCategoryPreference`, `UserStatsProjection`, scores,
  diamonds, progress, leaderboard rows, `UserJokerInventory`,
  `JokerTransaction`, users, admin rows, Daily Wheel, or gameplay/economy data.
* Static pool and category preference report sections remain based on current
  `Question`, `Category`, and `UserCategoryPreference` rows after reset.
* `JokerTransaction`, `DiamondTransaction`, `UserJokerInventory`, and
  `DailyWheelSpin` are ledger/current-state sources and are not cleared by a
  question analytics reset. If `Joker Kullanımı Analizi` is ledger-derived, it
  may continue to show historical economy signals until a separate analytics
  event source exists. `Oynanma Zamanı` hour/day metrics reset with
  `QuestionAttemptEvent` timestamps.
* Question Analytics report handles stale/deleted question IDs, unknown
  categories, section-level render failures, and empty analytics state without
  truncating the email; large sections remain capped.
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

# 16. Manual Proof Recording

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
