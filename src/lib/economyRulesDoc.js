// Runtime mirror of docs/KRONOX_ECONOMY_RULES.md.
//
// Why a JS mirror?
//   Vite's `?raw` import cannot reach outside of `src/` on this host, so
//   importing markdown directly from `docs/` (`.md?raw`) fails at build time.
//   Mirroring the doc as a JS module keeps the Health Center static-contract
//   checks alive while the canonical doc lives under `docs/`.
//   When you change one, change the other — the Health cases cross-check
//   required phrases against this string.

export const ECONOMY_RULES_DOC_PATH = 'docs/KRONOX_ECONOMY_RULES.md';

export const ECONOMY_RULES_DOC = `# Kronox Diamond Economy Rules

Status: Active product contract.

## Canonical balance
The canonical Diamond balance lives on the server-owned player profile.
Registered users use User.diamonds. Token-proven completed guests use
GuestProfile.diamonds until account linking combines that balance into the
registered account. It is never derived from stars, score, or completed levels.

## Ledger and idempotency
Every grant is recorded in DiamondTransaction with balance_before,
balance_after, source, and a durable idempotency_key. One logical row should
exist per idempotency_key. DiamondTransaction create helpers re-check
user_email + idempotency_key before create and confirm by idempotency_key after
create.
Base44 schema-level uniqueness is not assumed. DB/entity unique plus
function-level guard is Low risk; function-level guard only = Medium/P1 hardening;
neither DB/entity unique nor function-level guard is High.

## Active sources
- starter_bonus (one-time, guarded by User.starter_bonus_granted_at)
- first_login_reward (one-time Profile account-link reward, guarded by User.first_login_reward_granted_at and DiamondTransaction idempotency_key first_login_reward:<email>)
- daily_login (guarded by User.last_daily_diamond_reward_date)
- daily_wheel (server-backed Daily Wheel V2 claim; Diamonds, approved Solo jokers, or Gift Box only; no Kronox Puan)
- market_purchase (server-backed Mağaza joker purchase; Diamond spend only)

Daily Wheel V2 is separate from the existing +20 daily login reward, grants one free spin once
per UTC server day, uses idempotency_key daily_wheel:<playerKey>:<YYYY-MM-DD>,
records a DailyWheelSpin row plus DiamondTransaction.source = daily_wheel for
Diamond portions and JokerTransaction.reason = daily_wheel for approved joker
portions, and grants a 7-day streak bonus: +150 diamonds when applicable
(7 günlük seri bonusu: +150 elmas). This Daily Wheel spin-streak bonus is
separate from the Daily Calendar / Streak 200-Diamond streak reward. It grants no Kronox Puan
and does not affect leaderboard sorting or rank. Daily
Wheel same-day duplicate
prevention uses key/date lookup, reserve-first DailyWheelSpin rows, canonical
same-player/same-day re-read, User/GuestProfile guard re-check, and DiamondTransaction
re-check before balance mutation. This is not an atomic upsert until DB/entity
unique proof is attached for DailyWheelSpin.idempotency_key,
DailyWheelSpin.user_email + spin_date, and DiamondTransaction.idempotency_key.
Daily Wheel balance mutation also uses the shared function-level EconomyOperationLock
so a same-player market purchase, Daily Quest claim, or second wheel claim cannot
overwrite the same Diamond balance without first passing the lock and post-lock
rechecks. DB/entity unique constraints or live parallel backend proof remain manual.
Disabled repeat-ad spin is future rewarded-ad integration only; the post-spin
result screen keeps the wheel visible, shows one backend-payload reward line,
and shows one disabled, subdued ad/video ÇEVİR control with smaller Yakında
subtext. It cannot trigger a spin today and has no fake ad reward path.
Closing a completed reward result closes the Daily Wheel modal and returns
directly to usable Home without revealing the old Çark / Günlük Çark countdown
sheet or leaving an invisible backdrop over Home.
Already-claimed manual Çark opens are read-only post-win result reopens from
the stored backend reward payload, or safe Bugünkü ödül alındı fallback when
legacy data has no payload; they do not start a spin, grant a reward, or mark
auto-popup state as a new claim.
Daily Wheel claim requires an authenticated user or a token-proven completed
GuestProfile, and guest reward rows use internal guest:<g_owner_key> keys.

Daily Wheel reward is selected server-side by claimDailyWheelReward and the UI
animates to the backend-selected 8-slice reward_segment_index. Reward weights
are diamond_20 weight 28, diamond_60 weight 20, diamond_100 weight 15,
joker_krono_kalkan weight 12, joker_zamani_dondur weight 10,
joker_kart_degistir weight 8, gift_box weight 5, and diamond_250 weight 2.
The visual wheel always uses 8 equal segments; probabilities live on the
server. Closing the once-per-day auto-popup does not consume the free spin.
The spinning state stays inside the same premium popup/wheel shell and must not
show a separate intermediate spinning-copy screen. Result copy, confetti,
haptic, and reward sound reveal only after the backend-selected landing
animation completes.
Daily Wheel ready popup is a centered responsive modal over a blurred dark
overlay. The popup uses width min(92vw, 32rem), height auto, a dark navy
gradient, thin gold border, and a light glow. The wheel is centered at 85% of
the popup width, max 22rem, aspect-ratio 1/1, with a stationary gold pointer,
a small unbranded metallic gold center hub, and segment contents that rotate
with the wheel. Segment icon/number content uses the shared 0.8 scale token so
the wheel stays full-size while slice content is reduced by 20%. The fixed
clockwise visual order from the top is diamond_20, diamond_60, diamond_100,
joker_krono_kalkan, joker_zamani_dondur, joker_kart_degistir, gift_box,
diamond_250. Diamond slices show a diamond icon above 20/60/100/250; joker and
Gift Box slices are icon-only. Segment visuals must not add visible wrappers,
pills, or badges inside slices. Ready copy is
exactly GÜNLÜK ÇARK HAZIR and Bugünkü ödülünü almak için çevir, with equal
SONRA and ÇEVİR actions. SONRA only closes the popup and never consumes a spin.

Gift Box contents are selected server-side during the same idempotent claim and
stored on DailyWheelSpin. Gift Box packages are diamond_50, diamond_70,
diamond_80, diamond_100 + joker_kart_degistir,
diamond_60 + joker_krono_kalkan, diamond_20 + joker_zamani_dondur,
joker_krono_kalkan + joker_kart_degistir,
joker_zamani_dondur + joker_kart_degistir, and
joker_krono_kalkan + joker_zamani_dondur. A Gift Box package must not contain
two separate Diamond rewards or the same joker twice.

After the free spin is used, the result screen remains simplified: wheel
visible, backend-selected reward line, and one disabled, subdued ad/video
ÇEVİR repeat control with smaller Yakında subtext. Future rewarded-ad integration may add up to 5 ad
spins/day for 6 total spins with the free spin, but no fake rewarded-ad grant
flow is active.

Admin Ekranı includes a narrow Günlük Çark Reset support tool backed by
adminResetDailyWheelState. The tool accepts Kronox User ID only, requires
active AdminUser owner/admin authorization server-side, resets today's Daily
Wheel test state (free-spin guard, next-available guard, auto-popup reset
marker, and blocking same-day wheel idempotency rows), archives same-day
DailyWheelSpin/DiamondTransaction/JokerTransaction idempotency keys under an
admin-reset namespace to preserve completed reward audit rows, and writes
AdminMaintenanceLog. It does not grant rewards, does not reverse previously
awarded Diamonds or Jokers, and does not affect Daily Quest, Kronox Puan,
leaderboard, Solo, Online, profile, or account data.

Result UI reflects the server reward as one concise backend-payload line:
Diamonds, approved jokers, or Hediye Kutusu. The old total/streak/retry
explanatory result texts are not rendered. The Home claimed-state countdown is
card-only and uses Yarın hazır or compact time text such as 11 sa 24 dk without
a Diamond icon; the old small claimed/cooldown popup is not part of the current
Daily Wheel flow.

Home exposes Daily Wheel through the Çark shortcut and the Daily Calendar /
Streak through the Home GÜNLÜK shortcut. Daily Calendar creates 3
daily_calendar:* UserDailyQuestProgress rows per UTC server day from a 9-day
rotating task template cycle. Task progress is real-event-based and idempotent;
recordDailyQuestProgress does not grant Diamonds. claimDailyQuestReward grants
only the 7-day streak reward, writes DiamondTransaction.source =
daily_calendar_streak_reward with direction = earn, grants exactly 200
Diamonds, uses a daily_calendar_streak:<playerKey>:<streak_anchor_date>:<claim_number>:200
idempotency key, and updates User.daily_calendar_* /
GuestProfile.daily_calendar_* fields instead of Daily Wheel fields. Daily
Calendar does not grant Kronox Puan and does not affect Leaderboard.
Daily Calendar screen UI is display-only: Daily header shows only GÜNLÜK,
Calendar legend shows only Tamamlandı and Bugün, today tasks have no renewal
countdown, task cards show title-only rows, and the 7-day reward UI shows only
200 Elmas with no Gift Box icon/name. Completed guests can see, progress, and
claim Daily Calendar rewards through guest_id + guest_token proof; guest rewards
persist on GuestProfile.diamonds.

Legacy DailyQuestDefinition rows are ignored by the active runtime. The
admin-gated cleanupLegacyDailyQuests path defaults to dry_run and only deletes
legacy Daily Quest definition/progress rows after explicit
DELETE_LEGACY_DAILY_QUESTS confirmation; it must not delete Daily Wheel,
economy, profile, Solo, Online, Leaderboard, Store, Friends, or account data.

First authenticated entry grants +100 once. Same-day daily login grants +20 once.
Starter and daily login grants are backend-only through the server-side
claimLoginBonuses function: EconomyOperationLock (operation_scope
login_bonus_grant), idempotency_key find-before-create with post-lock re-check
and confirm-after-write, and server-side User.diamonds + guard-field updates.
The client must not create DiamondTransaction rows and must not mutate the
Diamond balance for these grants; cleanup alone is not enough — the backend
guard is the permanent enforcement, and adminDuplicateKeyReport remains the
duplicate monitor.
First-day total: \`120\` Diamonds. This combines starter 100 Diamonds plus
daily login 20 Diamonds only; it does not imply Kronox Puan and does not affect
leaderboard rank.

Profile account linking grants a one-time first_login_reward of 80 Diamonds
only after a token-proven GuestProfile is successfully linked to a real
account. The grant is server-backed in linkGuestAccount, writes
DiamondTransaction.source = first_login_reward with direction = earn, and uses
first_login_reward:<email> as the durable idempotency key. Reopening the login
sheet, retrying the same merge, or switching providers must not grant the
reward again. The reward does not grant Kronox Puan and does not affect
leaderboard sorting or rank.

## Mağaza / Store purchases
Mağaza displays real-money Diamond packages, Diamond-spend Joker packages,
Diamond-spend Hint packages, Diamond-spend Advantage packages, and future
KronoClub / Reklamları Kaldır sections. Real-money Diamond packages are display
only until an approved IAP/payment success path exists: 360 ELMAS — ₺79,99,
1.100 ELMAS — ₺199,99 with EN POPÜLER, 2.400 ELMAS — ₺349,99, 6.200 ELMAS —
₺799,99, and 13.000 ELMAS — ₺1.499,99 with EN İYİ DEĞER. Current no-IAP
behavior renders disabled Yakında buttons with no purchase handler and no
Diamond/benefit grant. Disabled real-money Diamond package state carries
reason: 'real_money_unavailable'; KronoClub and Reklamları Kaldır carry
reason: 'future_feature'.
Diamond-spend Joker packages are Kronokalkan 1/5/15 = 60/270/720 Diamonds,
Zamanı Dondur 1/5/15 = 40/180/480 Diamonds, and Kart Değiştir 1/5/15 =
50/225/600 Diamonds. Hint packages are 5/15/40 İpucu = 150/400/800 Diamonds.
Advantage Packages are Başlangıç Paketi = 2 Kronokalkan + 2 Kart Değiştir + 2
Zamanı Dondur + 10 İpucu for 250 Diamonds and Mega Paket = 10 Kronokalkan + 10
Kart Değiştir + 10 Zamanı Dondur + 30 İpucu for 1.000 Diamonds. KronoClub and
Reklamları Kaldır are future/disabled Yakında buttons and grant no benefits.
Mağaza keeps the main MAĞAZA title but removes subtitle and section
explanatory copy above/under Elmas, Joker, İpucu, Avantaj, and Yakında
sections. Diamond package cards render amount plus Elmas as two lines, show TL
price, and do not render Birim fiyat, unit-price fields, or decorative extra
Diamond dots. Diamond-spend Joker, Hint, and Advantage cards show the Diamond
price on the right side and do not render direct card-level SATIN AL buttons;
tapping the card opens a detail popup with package contents and a purchase CTA
that includes the Diamond price. The detail popup is centered, safe-area-aware,
bounded by 100dvh minus safe areas, internally scrollable if needed, and kept
above BottomNav so the purchase CTA remains tappable. Purchase success is not
shown as a persistent Store banner/list; only safe failure/info states may
render.
Diamond source/sink balance: Daily Wheel V2 can be a Diamond source and/or
approved joker grant source, while Mağaza purchase is a Diamond sink —
Mağaza Diamond-spend purchases only remove Diamonds server-side.
purchaseJokerWithDiamonds owns the trusted Store product/price table,
purchase validation is server-authoritative, Client is not trusted for price,
client-provided price/cost is ignored, validates authenticated self-owned user
context and sufficient User.diamonds server-side, writes DiamondTransaction.source
= market_purchase with direction = spend, writes JokerTransaction.reason =
market_purchase for joker grants, and writes HintTransaction.reason =
market_purchase / UserHintInventory for hint grants. purchaseJokerWithDiamonds
explicitly binds UserJokerInventory, UserHintInventory, DiamondTransaction,
JokerTransaction, and HintTransaction in the Base44 runtime path; deployed proof
must confirm Diamond decrease, inventory increase, ledgers, insufficient-Diamond
block, and duplicate tap guard. Store purchases do not grant Kronox Puan.
Store purchases do not affect Leaderboard.
Insufficient Diamonds do not decrease Diamonds, increase inventory balances, or
write successful purchase ledgers. Purchase uses an idempotency key; double-tap,
network retry, and two tabs/devices are guarded by EconomyOperationLock,
post-lock idempotency rechecks, and a refreshed server balance; live race proof
remains manual. Starter inventory repair during purchase is best-effort; a
starter self-heal error must not block a valid purchased joker balance and
ledger write. Partial failure reconciliation: ledger write failure uses
best-effort rollback of Diamond, joker, and hint balances, but live
provider/backend consistency proof remains manual.
Solo onboarding levels 1-6 (before_after and timeline_basic) show Joker and
Hint controls in training mode. Training use applies the safe teaching effect
but must not call spendUserJoker or consumeUserHint, must not decrement
UserJokerInventory or UserHintInventory, must not write JokerTransaction.reason
= solo_use or HintTransaction.reason = solo_use, and must not complete Daily
Calendar joker/hint tasks. From level 7 onward, normal Solo joker use still
spends UserJokerInventory and writes JokerTransaction.
Hint gameplay consumption is active only for Solo Hint / İpucu from level 7
onward: each player
gets exactly 3 starter Hints once through ensureUserHintInventory, consumeUserHint
spends one Hint server-side with HintTransaction.reason = solo_use and source =
solo_hint, and double-tap/retry paths use idempotency plus EconomyOperationLock.
The gameplay Hint launcher only opens the popup; the popup has one hammer action,
keeps stage 0 fully covered from the first rendered frame, and reveal advances
only after server confirmation.
Hint use is separate from Joker use. Real Hint use can satisfy Daily hint_used
after the ledger row exists; training Hint use in levels 1-6 cannot. Hint use
never grants Kronox Puan or affects Leaderboard.
Opening the Hint popup pauses the visible Solo timer; if Zaman Dondur is
already active, the Hint pause is overlap-aware and never subtracts the same
frozen seconds twice.
Joker balance read-performance contract: UserJokerInventory is the Profile/Solo current-balance source. JokerTransaction is the ledger/audit trail and must not be summed on Profile open. Profile, Solo, and Mağaza use the shared getUserJokerBalances / mutation-result cache path keyed by normalized user email. Complete inventory rows render through a fast current-balance read; missing or partial rows trigger idempotent starter/self-heal. Mağaza purchase and Solo spend must update or invalidate the shared balance cache so Profile and Solo do not show stale counts. spendUserJoker validates Solo context, uses deploy-safe UserJokerInventory/JokerTransaction entity fallback, and returns safe user-facing errors. Normal Solo joker spend uses EconomyOperationLock, rechecks the JokerTransaction idempotency key after the lock, then re-reads UserJokerInventory and refuses to decrement a zero balance. Admin/static reconciliation can compare UserJokerInventory.quantity against JokerTransaction summed deltas and latest balance_after without mutating data. Guest/no-login paths must not query user-owned joker inventory. Live performance proof remains manual: login, open Profile, confirm Joker Çantası loads quickly, purchase/spend a joker, and confirm Profile/Solo counts refresh.
Hint balance read-performance contract: UserHintInventory is the current-balance
source for Solo Hint / İpucu. HintTransaction is the ledger/idempotency audit trail and must
not be summed on Solo open or Profile open. Profile Joker Çantası displays
Kronokalkan, Kart Değiştir, Zaman Dondur, and İpucu as four compact cards in one
non-scrolling row; the İpucu card reads UserHintInventory.quantity through a
display-only helper and must not initialize, consume, grant, or mutate Hint
inventory. ensureUserHintInventory is idempotent and must preserve spent
balances; it must not refill a user back to 3 on every app open. consumeUserHint
uses EconomyOperationLock, rechecks the HintTransaction idempotency key after the
lock, decrements one Hint, and returns a sanitized balance response. Hint popup
actions are locally locked and stale-card guarded so double taps and active-card
changes cannot double-spend or reveal before server confirmation. Completed guests
use token-proven internal guest:<g_owner_key> actor keys only through backend
functions; public UI/export must not expose these keys.

## Admin reset and account deletion
Admin reset sets \`daily_wheel_last_spin_date\` to the current UTC day, clears Daily Wheel guard fields, and removes target \`DailyWheelSpin\` rows. Retained OnlineMatchResult/DiamondTransaction/DailyWheelSpin rows no longer contain the deleted user.
Admin reset remains admin-only, previewed, confirmed, and logged; it prevents stale Daily Wheel availability/countdown state without granting duplicate Diamonds, changing Kronox Puan, or affecting leaderboard sorting or rank.
Retained economy/gameplay rows do not expose the deleted user identity.

Future sources (daily_quest_future, wheel_spin, rewarded_ad, quest_reward,
real-money purchase fulfillment, achievement, special_event) are schema-ready
but not active yet.
`;
