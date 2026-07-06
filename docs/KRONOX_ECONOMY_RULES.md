# Kronox Diamond Economy Rules

## Purpose

This document defines the Kronox Diamond / Elmas economy contract.

Diamonds are a persisted player-owned balance.

Registered users use `User.diamonds`. Token-proven completed guests use
`GuestProfile.diamonds` until account linking combines that balance into the
registered account.

Diamonds are separate from Kronox Puan.

---

# 1. Source Of Truth

Canonical balance fields:

```text
User.diamonds
GuestProfile.diamonds for completed guests before account linking
```

Display helper:

```text
getDiamondBalance(user)
```

Existing UI adapter:

```text
getLeaderboardDiamondValue(user)
```

Rules:

* Header, Home, Solo, Online, Profile, and Liderlik Elmas surfaces must agree.
* Diamonds must never be calculated from Kronox Puan.
* Diamonds must never be calculated from Solo stars.
* Diamonds must never be calculated from Solo level.
* Diamonds must never be calculated from Online score.
* Diamonds must never be calculated from leaderboard rank.
* Visible Elmas surfaces must not use placeholder values after authenticated user data is loaded.

---

# 2. Transaction Ledger

`DiamondTransaction` is the economy ledger/audit entity.

Required fields:

```text
user_email
amount
balance_before
balance_after
source
direction
idempotency_key
metadata
created_at
```

Purpose:

* audit balance changes
* protect idempotency
* support future reward sources
* support recovery from partial write states

---

# 3. Active Sources

Current active sources:

```text
starter_bonus
first_login_reward
daily_login
daily_wheel
market_purchase
daily_quest_reward
```

Future schema-ready sources are intentionally inactive:

```text
daily_quest_future
rewarded_ad_future
quest_reward_future
purchase_future
achievement_future
special_event_future
```

Home exposes Daily Wheel through the `Çark` shortcut and Daily Quest / Günün
Görevi Runtime v1 through the `Görevler` shortcut/modal. Runtime owns one canonical daily quest in code:
`solo_level_complete` / `Solo’da Seviye Geç` /
`Bugün 1 Solo seviyesini tamamla.`, target 1, reward 20 Diamonds.
`UserDailyQuestProgress` stores 1 selected UTC-day quest per user, with copied
target/reward, progress, completion, and claim state. Runtime ignores stale or
duplicate `DailyQuestDefinition` rows and does not seed definition rows on Home
or app open. Legacy definition rows should be cleaned manually only after
backup/operator confirmation; they must not duplicate Home quests or rewards.

Daily Quest grants diamonds only through the server-backed
`claimDailyQuestReward` callable. Claims write
`DiamondTransaction.source = daily_quest_reward` with `direction = earn` and an
idempotency key shaped like
`daily_quest_reward:<playerKey>:<YYYY-MM-DD>:<questKey>`, where `playerKey` is
the normalized email for registered users or `guest:<g_owner_key>` for a
token-proven completed guest. The client must
not control reward amount. Daily Quest does not grant Kronox Puan and has no
leaderboard impact. Daily Quest does not affect leaderboard.

Do not implement client-side quest reward diamond grants, Kronox Puan rewards,
Online quest progress, or leaderboard scoring from Daily Quest.

Profile account linking grants a one-time `first_login_reward` of 80 Diamonds
only after a token-proven GuestProfile is successfully linked to a real
account. The grant is server-backed in `linkGuestAccount`, writes
`DiamondTransaction.source = first_login_reward` with `direction = earn`, and
uses `first_login_reward:<email>` as the durable idempotency key. Reopening the
login sheet, retrying the same merge, or switching providers must not grant the
reward again. The reward does not grant Kronox Puan and does not affect
leaderboard sorting or rank.

---

# 3A. Daily Reward Wheel / Günlük Çark

Daily Wheel V2 is an active server-selected retention reward.

Rules:

* grants Diamonds, approved Solo jokers, or Gift Box rewards only
* grants no Kronox Puan
* does not affect leaderboard sorting or rank
* is separate from the existing +20 daily login reward
* claim requires an authenticated user or a token-proven completed GuestProfile
* one free claim per player per UTC server day
* reward is selected server-side by `claimDailyWheelReward`
* when a free spin is available and the daily auto-popup is eligible, Home
  opens the full Daily Wheel modal after player and wheel state are resolved;
  it must not open the old compact `Çark` / `Günlük Çark` / `Hazır!` card
* manual Home `Çark` taps open the full Daily Wheel modal when a spin is
  available, and open the read-only post-win result when today is already
  claimed
* UI animates to the backend-selected 8-slice segment
* the spinning state stays inside the same premium popup/wheel shell and must
  not show a separate intermediate spinning-copy screen
* the wheel uses one continuous spin: it reaches a clear fast pace immediately
  after `ÇEVİR`, holds a steady fast rotation, and decelerates only near the
  final phase before a light final bounce on the backend-selected segment; it
  must not visually behave as slow → fast → slow and must not use a separate
  steady pre-spin loop that hands off into the landing
* spin sound/effects are synchronized to the visible rotation: the spin sound
  starts with the visible spin, ticks widen as the wheel decelerates, and the
  sound/effects never continue after the wheel has visually stopped
* celebration cues (confetti/glow, haptic, reward sound) and the result copy
  reveal only after the wheel visually stops (the landing animation completes)
* spin timers, sound, confetti/glow, haptics, and effect callbacks are cleaned
  up or ignored on close/unmount/error so no hidden overlay, delayed burst, or
  second spin remains after returning Home
* visual polish may improve wheel/icon quality but must not change reward
  mapping, segment order/size, pointer alignment, or the reduced `0.8` segment
  content scale (icons/numbers must not be enlarged)
* localStorage/sessionStorage may only hide the once-per-day auto-popup, never grant rewards
* closing the auto-popup does not consume the free spin
* after the free spin is used, the result screen is simplified: the wheel stays
  visible, one backend-payload reward line is shown below it, and the bottom
  repeat ad-spin CTA is visible as a disabled, subdued ad/video `ÇEVİR`
  control with smaller `Yakında` subtext; the old total/streak/retry
  explanatory result texts are not shown
* closing a completed reward result closes the Daily Wheel modal and returns
  directly to usable Home; it must not reveal the old `Çark` / `Günlük Çark`
  countdown sheet behind the result and must not leave an invisible backdrop
  blocking Home buttons
* if today's free spin is already claimed and the player manually opens
  `Çark` from Home, the read-only post-win result screen opens with the stored
  backend reward payload or a safe `Bugünkü ödül alındı` fallback; it does not
  start a spin, grant a reward, or mark auto-popup state as a new claim
* disabled ad repeat is future rewarded-ad integration only; it cannot trigger
  a spin or grant an ad reward today

Reward table and weights:

```text
diamond_20 — 20 Diamonds — weight 28
diamond_60 — 60 Diamonds — weight 20
diamond_100 — 100 Diamonds — weight 15
joker_krono_kalkan — 1 Kronokalkan — weight 12
joker_zamani_dondur — 1 Zaman Dondur — weight 10
joker_kart_degistir — 1 Kart Değiştir — weight 8
gift_box — server-resolved Gift Box — weight 5
diamond_250 — 250 Diamonds — weight 2
```

The visual wheel always uses 8 equal segments. Segment weights live on the
server; the client only animates to `reward_segment_index` returned by the
claim response.

Daily Wheel popup visual contract:

* the ready popup is a centered responsive modal over a blurred dark overlay
* popup width is `min(92vw, 32rem)`, with `height: auto`
* the wheel is centered at 85% of the popup width, max `22rem`, with a 1:1 aspect ratio
* the pointer is stationary; wheel icons/text rotate with the wheel
* the center hub is a small metallic gold hub with no logo/text/icon
* segment content is radially oriented toward the wheel center: each Diamond
  icon+number group and each Joker/Gift icon is rotated by its own segment
  center angle so it faces the hub, and must not be artificially kept
  screen-upright via a counter-rotation; the Diamond icon stays above its
  number within the rotated group; this improves natural spin feel and must not
  enlarge content or change reward mapping/segment order/stop alignment
* segment icon/number content uses the shared `0.8` scale token so the wheel
  stays full-size while slice content is reduced by 20%
* visual segments are fixed clockwise from the top:
  `diamond_20`, `diamond_60`, `diamond_100`, `joker_krono_kalkan`,
  `joker_zamani_dondur`, `joker_kart_degistir`, `gift_box`, `diamond_250`
* Diamond slices show a diamond icon above `20`, `60`, `100`, or `250`;
  joker and Gift Box slices are icon-only
* segment visuals must not add visible wrappers, pills, or badges inside slices
* title copy is exactly `GÜNLÜK ÇARK HAZIR`
* subtitle copy is exactly `Bugünkü ödülünü almak için çevir`
* actions are equal-width `SONRA` and `ÇEVİR`; `SONRA` only closes the popup
  and never consumes a spin

Gift Box package table:

```text
diamond_50
diamond_70
diamond_80
diamond_100 + joker_kart_degistir
diamond_60 + joker_krono_kalkan
diamond_20 + joker_zamani_dondur
joker_krono_kalkan + joker_kart_degistir
joker_zamani_dondur + joker_kart_degistir
joker_krono_kalkan + joker_zamani_dondur
```

Gift Box contents are selected server-side during the same idempotent claim and
stored on `DailyWheelSpin`. A Gift Box package must not contain two separate
Diamond rewards or the same joker twice.

7-day streak:

```text
7-day streak bonus: +150 diamonds
```

If the user misses a UTC day, the next successful spin resets the streak to 1.

Completed guests can see and claim the Daily Wheel and Daily Quest from Home.
Guest Daily Wheel and Daily Quest rows use internal `guest:<g_owner_key>` keys,
never raw `guest_id` as public identity. Guest balances and same-day guards are
stored on `GuestProfile`; `linkGuestAccount` copies daily reward history/guards
to the registered owner key so a guest cannot claim the same UTC-day reward
again immediately after linking.

Result screen:

```text
💎 +60 Elmas
🛡 Kronokalkan
⏳ Zaman Dondur
🔄 Kart Değiştir
🎁 Hediye Kutusu
```

The result line uses the backend claim payload (`rewardType`, `rewardId`,
`rewardAmount`, `jokerRewards`, and Gift Box fields). The result screen does
not show old `Toplam`, `Toplam Elmas`, `Seri`, repeat-heading, or repeat
explanation copy.

Home claimed-day manual opens use the read-only result screen, not a countdown
mini-card. Any embedded legacy launcher countdown outside the current Home flow
must remain plain text if it is ever reused, with no Diamond icon beside the
time. The old small claimed/cooldown popup is not part of the current Daily
Wheel flow.

Dedicated spin ledger:

```text
DailyWheelSpin
```

Daily idempotency key:

```text
daily_wheel:<playerKey>:<YYYY-MM-DD>
```

Player guard fields:

```text
daily_wheel_last_spin_at
daily_wheel_last_spin_date
daily_wheel_next_available_at
daily_wheel_streak
daily_wheel_spin_count
```

Diamond audit ledger:

```text
DiamondTransaction.source = daily_wheel
```

Concurrency note:

Base44 schema-level uniqueness is not assumed for `DailyWheelSpin.idempotency_key`
or `DiamondTransaction.idempotency_key`. The current backend uses
query-before-write, User/GuestProfile guard fields, reserve-first
`DailyWheelSpin` rows, and recovery from existing spin rows. After reserving a
spin row, the claim path re-reads the canonical same-player/same-UTC-day spin,
re-checks the User/GuestProfile guard, and re-checks the
`DiamondTransaction` idempotency key before mutating `User.diamonds` or
`GuestProfile.diamonds`. Daily Wheel balance mutation also uses the shared
function-level `EconomyOperationLock` so a same-player market purchase, Daily
Quest claim, or second wheel claim cannot overwrite the same Diamond balance
without first passing the lock and post-lock rechecks. This is function-level
guard only, not an atomic upsert; logical guard; unique constraint platform/manual.
DB/entity unique constraints or live parallel backend proof remain manual.

---

# 4. Starter Bonus

Amount:

```text
+100 Diamonds
```

Grant timing:

```text
after authenticated user/profile is loaded at app entry
```

Idempotency key:

```text
starter_bonus:<normalizedEmail>
```

Persistent guard:

```text
User.starter_bonus_granted_at
```

Rules:

* grant only once per user
* must not duplicate on refresh
* must not duplicate across devices as far as platform allows
* must create or recover ledger row where possible

---

# 5. Daily Login Reward

Amount:

```text
+20 Diamonds
```

Grant timing:

```text
after authenticated user/profile is loaded on a new day
```

Day boundary:

```text
UTC
```

Daily key format:

```text
YYYY-MM-DD
```

Idempotency key:

```text
daily_login:<normalizedEmail>:<YYYY-MM-DD>
```

Persistent guard:

```text
User.last_daily_diamond_reward_date
```

Rules:

* grant at most once per user per UTC day
* refresh/reopen on same UTC day must not duplicate
* next UTC day may grant again
* must create or recover ledger row where possible

---

# 6. First-Day Total

A brand-new authenticated user can receive both rewards on the same UTC day:

```text
starter bonus = +100
daily login = +20
first-day total = 120
```

First-day total: `120` Diamonds. This combines starter 100 Diamonds plus daily
login 20 Diamonds only; it does not imply Kronox Puan and does not affect
leaderboard rank.

Refreshing the app after that must not grant another starter or daily reward.

---

# 7. Grant Flow

The app bootstrap calls:

```text
ensureDiamondEconomyForUser(user)
```

after:

```text
base44.auth.me()
```

resolves.

For each reward:

1. normalize user email with trim/lowercase
2. build source idempotency key
3. check persisted User guard field
4. check `DiamondTransaction` by `user_email + idempotency_key`
5. refresh current user profile before writing
6. update `User.diamonds` and guard field through `base44.auth.updateMe`
7. create `DiamondTransaction` ledger row through a helper that re-checks the
   idempotency key before create and confirms the row by idempotency key after
   create
8. recover ledger if guard exists but ledger is missing
9. recover guard if ledger exists but guard is missing
10. do not grant again during recovery

---

# 8. Recovery Behavior

If User guard exists but ledger row is missing:

* create a recovery ledger row
* do not grant again
* do not increase balance again

If ledger row exists but User guard is missing:

* restore the guard
* keep balance at least as high as the recorded transaction balance
* do not grant again

If ledger creation fails after balance update:

* do not repeatedly grant on refresh
* report diagnostic error
* allow recovery path to create ledger later

---

# 9. Concurrency Notes

Base44 schema-level uniqueness is not assumed for `idempotency_key`.

Current protection is best-effort using:

* persisted User guard fields
* transaction query-before-write
* user profile refresh before update
* DiamondTransaction create helpers that pre-check and post-confirm by
  `idempotency_key`
* short-lived `EconomyOperationLock` rows with TTL/stale recovery and
  deterministic winner selection for player balance/inventory mutations
* post-lock idempotency and balance/inventory rechecks before write
* Daily Wheel reserve-first `DailyWheelSpin` rows plus canonical same-day
  re-read before `User.diamonds` is updated
* Daily Wheel post-reserve User guard and DiamondTransaction re-checks
* stable idempotency keys
* recovery paths

There is no repo-proven atomic upsert or DB/entity unique constraint for
`DiamondTransaction.idempotency_key`, `DailyWheelSpin.idempotency_key`, or
`DailyWheelSpin.user_email + spin_date`. Risk classification:

* DB/entity unique plus function-level guard = Low
* function-level guard only = Medium/P1 hardening
* neither DB/entity unique nor function-level guard = High

True multi-device duplicate-proofing should still be verified with a runtime
parallel probe.

If Base44 later supports unique constraints, add a unique constraint on:

```text
DiamondTransaction.idempotency_key
DailyWheelSpin.idempotency_key
DailyWheelSpin.user_email + spin_date
EconomyOperationLock.lock_key where status = active
```

---

# 10. Account Deletion Retention

Account deletion rules:

* `User.diamonds` is removed with the user profile.
* retained `DiamondTransaction` audit rows must anonymize `user_email` and any email-bearing idempotency key.
* retained `DailyWheelSpin` audit rows must anonymize `user_email`, `owner_key`, and any email-bearing idempotency key.
* Retained OnlineMatchResult/DiamondTransaction/DailyWheelSpin rows no longer contain the deleted user.
* account deletion must not grant or spend Diamonds.

Daily Wheel deletion cleanup contract:

* Retained OnlineMatchResult/DiamondTransaction/DailyWheelSpin rows no longer contain the deleted user.
* retained economy/gameplay rows must not expose the deleted user identity.

---

# 11. Admin Progress Reset

Admin maintenance reset is not available to normal users.

Backend function:

```text
adminResetUserProgress
```

Modes:

```text
hard_zero
new_player
```

`hard_zero`:

* sets `User.diamonds = 0`
* sets `starter_bonus_granted_at` so starter bonus is not immediately re-granted
* sets `last_daily_diamond_reward_date` to the current UTC day so same-day daily reward is not immediately re-granted
* sets `daily_wheel_last_spin_date` to the current UTC day so same-day Daily Wheel is not immediately re-granted
* clears Daily Wheel guard fields, including streak/count values
* removes target `DailyWheelSpin` rows
* writes an `admin_adjustment` DiamondTransaction audit row when possible

`new_player`:

* sets `User.diamonds = 0`
* clears starter/daily reward guard fields
* clears Daily Wheel guard fields
* removes target `DailyWheelSpin` rows
* allows the normal app-entry economy bootstrap to grant starter + daily Diamonds again

Both modes write `User.progress_reset_at` so local user progress mirrors are invalidated and server state wins after refresh/reopen.

Daily Wheel admin reset cleanup contract:

* clears Daily Wheel guard fields
* removes target `DailyWheelSpin` rows
* prevents stale Daily Wheel availability/countdown state without granting duplicate Diamonds
* does not affect Kronox Puan
* does not affect leaderboard sorting or rank
* reset must not delete the user account or authentication identity
* admin reset remains admin-only, previewed, confirmed, and logged

Narrow Daily Wheel test reset:

```text
adminResetDailyWheelState
```

* lives only on Admin Ekranı as Günlük Çark Reset
* accepts Kronox User ID, not raw guest_id, owner_key, email, or internal player_key
* requires active AdminUser owner/admin authorization server-side
* resets today’s Daily Wheel test state only: free-spin guard, next-available guard, auto-popup reset marker, and blocking same-day wheel idempotency rows
* preserves completed reward/audit rows by archiving same-day DailyWheelSpin, DiamondTransaction, and JokerTransaction idempotency keys under an admin-reset namespace instead of subtracting balances
* does not grant rewards
* does not reverse previously awarded Diamonds or Jokers
* does not affect Daily Quest, Kronox Puan, leaderboard, Solo, Online, profile, or account data
* writes AdminMaintenanceLog

---

# 3B. Mağaza / Store Purchases

Mağaza displays the expanded Store catalog:

```text
Real-money Diamond packages (display only until approved IAP/payment exists):
360 ELMAS — ₺79,99, unit ₺0,22
1.100 ELMAS — ₺199,99, unit ₺0,18, EN POPÜLER
2.400 ELMAS — ₺349,99, unit ₺0,15
6.200 ELMAS — ₺799,99, unit ₺0,13
13.000 ELMAS — ₺1.499,99, unit ₺0,12, EN İYİ DEĞER

Diamond-spend jokers:
Kronokalkan 1/5/15 = 60/270/720 Diamonds
Zamanı Dondur 1/5/15 = 40/180/480 Diamonds
Kart Değiştir 1/5/15 = 50/225/600 Diamonds

Diamond-spend hints:
5/15/40 İpucu = 40/100/240 Diamonds

Diamond-spend advantage packages:
Başlangıç Paketi = 2 Kronokalkan + 2 Kart Değiştir + 2 Zamanı Dondur + 10 İpucu for 250 Diamonds
Mega Paket = 10 Kronokalkan + 10 Kart Değiştir + 10 Zamanı Dondur + 30 İpucu for 1.000 Diamonds
```

KronoClub and Reklamları Kaldır are future real-money sections only. They do
not grant subscriptions, ad removal, or any benefit until an approved real
purchase path exists.

Solo move interaction:

* Kart Değiştir does not consume a Solo move; it uses the deck's card-swap buffer.
* Zaman Dondur does not consume a Solo move and does not require extra deck cards.
* Kronokalkan does not consume a Solo move when activated; it protects the next wrong valid placement from consuming one move.
* Kart Değiştir and Kronokalkan are capped by the per-attempt deck buffer; extra use beyond that buffer fails safely before any joker spend.
* Normal Solo joker use still spends `UserJokerInventory` and writes `JokerTransaction`.
* Guided tutorial joker demos remain tutorial-only and must not spend real inventory.

Purchase rules:

* Diamond source/sink balance: Daily Wheel V2 can be a Diamond source and/or an
  approved joker grant source, while Mağaza Diamond-spend purchases are Diamond
  sinks
* real-money Diamond packages must not grant Diamonds unless a real approved
  IAP/payment success path exists; current no-IAP behavior is safe unavailable
  copy: `Satın alma yakında aktif olacak.`
* `purchaseJokerWithDiamonds` owns the trusted Store product and price table
* purchase validation is server-authoritative; Client is not trusted for price
  and client-provided price/cost is ignored
* authenticated user can purchase only for self
* sufficient `User.diamonds` is validated server-side
* successful purchase writes `DiamondTransaction.source = market_purchase`
  with `direction = spend`
* successful joker grants write `JokerTransaction.reason = market_purchase`
* successful hint grants write `HintTransaction.reason = market_purchase`
  and update `UserHintInventory`
* advantage packages grant every configured joker/hint quantity exactly once
  or fail without a successful purchase response
* insufficient Diamonds do not decrease Diamonds, increase joker balance, or
  write successful purchase ledgers
* purchase uses an idempotency key; double-tap, network retry, and two
  tabs/devices are guarded by `EconomyOperationLock`, post-lock idempotency
  rechecks, and a refreshed server balance; live race proof remains manual
* starter inventory repair during purchase is best-effort; a starter self-heal
  error must not block a valid purchase that can still write the purchased
  joker balance and ledgers
* Partial failure reconciliation: ledger write failure uses best-effort rollback
  of the Diamond and joker balances, but live provider/backend consistency proof
  remains manual
* Store purchases do not grant Kronox Puan
* Store purchases do not affect Leaderboard
* Daily Wheel and Daily Quest behavior is unchanged by Store purchases

Joker balance read-performance contract:

* `UserJokerInventory` is the Profile/Solo current-balance source.
* `JokerTransaction` is the ledger/audit trail and must not be summed on Profile
  open.
* Profile, Solo, and Mağaza use the shared `getUserJokerBalances` /
  mutation-result cache path keyed by normalized user email.
* Complete inventory rows render through a fast current-balance read; missing or
  partial rows trigger idempotent starter/self-heal.
* Mağaza purchase and Solo spend must update or invalidate the shared balance
  cache so Profile and Solo do not show stale counts.
* `spendUserJoker` validates Solo context, uses deploy-safe entity fallback for
  `UserJokerInventory`/`JokerTransaction`, and returns safe user-facing errors.
* Normal Solo joker spend uses `EconomyOperationLock`, rechecks the
  `JokerTransaction` idempotency key after the lock, then re-reads
  `UserJokerInventory` and refuses to decrement a zero balance.
* Admin/static reconciliation can compare `UserJokerInventory.quantity` against
  `JokerTransaction` summed deltas and latest `balance_after`; it must report
  mismatches without auto-fixing.
* Guest/no-login paths must not query user-owned joker inventory.
* Live performance proof remains manual: login, open Profile, confirm Joker
  Çantası loads quickly, purchase/spend a joker, and confirm Profile/Solo counts
  refresh.

---

# 12. Not Implemented Yet

The following are not implemented:

* Rewarded ads
* Real-money purchase fulfillment / IAP verification
* Achievement rewards
* Special event rewards
* Hint gameplay consumption

Daily Quest / Günün Görevi Runtime v1 is active; only future Daily Quest reward
sources such as `daily_quest_future` remain inactive until explicitly approved.

Do not implement these without explicit product approval.

---

# 13. Health Coverage Expectations

Health should cover:

```text
diamond_balance_display_uses_real_field
diamond_starter_bonus_once
diamond_daily_login_once_per_utc_day
diamond_first_day_total_120
diamond_transaction_idempotency_key_used
diamond_reward_retry_safe
diamond_balance_ledger_consistency_contract
diamond_multi_device_runtime_probe_visible
daily_wheel_exists_on_home
daily_wheel_diamonds_only_no_puan
daily_wheel_one_spin_per_server_day
daily_wheel_streak_bonus_contract
```

Rules:

* do not fake PASS for multi-device runtime race tests
* keep runtime-only checks NOT_AUTOMATABLE unless actually proven
* do not derive Elmas from score/stars/level in tests or UI

---

# 14. Manual Proof

Manual/release proof should verify:

* first login grants +100
* daily login grants +20
* first day can total 120
* refresh does not duplicate
* same-day reopen does not duplicate
* next UTC day grants once
* Daily Wheel grants once per UTC server day
* Daily Wheel does not grant Kronox Puan
* 7th consecutive Daily Wheel spin grants +150 extra Diamonds
* two-device duplicate prevention is probed
* ledger recovery does not double grant
## GuestProfile And Economy Boundary

Phase 1 GuestProfile creates portable guest identity. Phase 3 account linking
adds the one-time merge path and preserves completed-guest Daily Quest and
Daily Wheel balances, guard fields, and history copies; it does not change
Market prices, normal Joker spend/purchase rules, or Diamond reward rules.

Guest-to-authenticated merge is server-authoritative, one-time, idempotent, and
audited through `linkGuestAccount` plus `AccountLinkTransaction`. Guest Diamonds
may be combined once with the authenticated `User.diamonds` balance through
`DiamondTransaction.source = account_link_merge`. Guest joker balances may be
combined once through `UserJokerInventory` current balances and
`JokerTransaction.reason = account_link_merge`. Guest Daily Wheel and Daily
Quest same-day guard fields are copied to the linked user, and guest reward
history rows are copied under the registered internal owner key to prevent
duplicate same-day claims after account linking.

`User.linked_guest_ids` prevents repeated additive economy merge if an account
link request retries after a partial response. `UserJokerInventory` remains the
current joker balance source and `JokerTransaction` remains the ledger. Raw
guest token must never be stored server-side or logged.

Profile > Profil Bilgileri optional `age_group` / `gender` edits are private profile metadata.
They must not grant Diamonds, affect Daily Quest/Wheel rewards, change Market
prices, alter joker balances, or appear in economy ledgers.
