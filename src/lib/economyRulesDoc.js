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
portions, and grants a 7-day streak bonus: +150 diamonds when applicable. It
grants no Kronox Puan and does not affect leaderboard sorting or rank. Daily
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
and shows one disabled ad/video ÇEVİR CTA. It cannot trigger a spin today and
has no fake ad reward path.
Closing a completed reward result closes the Daily Wheel modal and returns
directly to Home without revealing the old Çark / Günlük Çark countdown sheet.
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
visible, backend-selected reward line, and one disabled ad/video ÇEVİR repeat
CTA. Future rewarded-ad integration may add up to 5 ad spins/day for 6 total
spins with the free spin, but no fake rewarded-ad grant flow is active.

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

Home exposes Daily Wheel through the Çark shortcut and Daily Quest Runtime v1
Günlük Görev through the Görevler shortcut/modal. Runtime owns one canonical code-backed quest: solo_level_complete /
Solo’da Seviye Geç / Bugün 1 Solo seviyesini tamamla., target 1, reward 20
Diamonds. UserDailyQuestProgress stores 1 selected UTC-day player quest.
Runtime ignores stale or duplicate DailyQuestDefinition rows and does not seed
definition rows on app/Home open. getDailyQuestStatus is
authenticated-or-completed-guest but not admin-only and preserves newly created
progress rows if immediate refresh is stale.
claimDailyQuestReward grants diamonds only, writes DiamondTransaction.source =
daily_quest_reward with direction = earn, uses
daily_quest_reward:<playerKey>:<YYYY-MM-DD>:<questKey>, and uses
User.daily_quest_* / GuestProfile.daily_quest_* fields instead of Daily Wheel fields. Home copy says
"Günlük Görevleri Yap, Elmasları Kazan!" and runtime backend functions
explicitly bind UserDailyQuestProgress. Daily Quest does not grant Kronox Puan
and has no leaderboard impact. Completed guests can see, progress, and claim
Daily Quest rewards through guest_id + guest_token proof; guest rewards persist
on GuestProfile.diamonds.

First authenticated entry grants +100 once. Same-day daily login grants +20 once.
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
behavior is safe unavailable copy: Satın alma yakında aktif olacak.
Diamond-spend Joker packages are Kronokalkan 1/5/15 = 60/270/720 Diamonds,
Zamanı Dondur 1/5/15 = 40/180/480 Diamonds, and Kart Değiştir 1/5/15 =
50/225/600 Diamonds. Hint packages are 5/15/40 İpucu = 40/100/240 Diamonds.
Advantage Packages are Başlangıç Paketi = 2 Kronokalkan + 2 Kart Değiştir + 2
Zamanı Dondur + 10 İpucu for 250 Diamonds and Mega Paket = 10 Kronokalkan + 10
Kart Değiştir + 10 Zamanı Dondur + 30 İpucu for 1.000 Diamonds. KronoClub and
Reklamları Kaldır are future/disabled and grant no benefits.
Diamond source/sink balance: Daily Wheel V2 can be a Diamond source and/or
approved joker grant source, while Mağaza Diamond-spend purchases are Diamond
sinks. purchaseJokerWithDiamonds owns the trusted Store product/price table,
purchase validation is server-authoritative, Client is not trusted for price,
client-provided price/cost is ignored, validates authenticated self-owned user
context and sufficient User.diamonds server-side, writes DiamondTransaction.source
= market_purchase with direction = spend, writes JokerTransaction.reason =
market_purchase for joker grants, and writes HintTransaction.reason =
market_purchase / UserHintInventory for hint grants. purchaseJokerWithDiamonds
explicitly binds UserJokerInventory, UserHintInventory, DiamondTransaction,
JokerTransaction, and HintTransaction in the Base44 runtime path; deployed proof
must confirm Diamond decrease, inventory increase, ledgers, insufficient-Diamond
block, and duplicate tap guard. Store purchases do not grant Kronox Puan and do
not affect Leaderboard.
Insufficient Diamonds do not decrease Diamonds, increase inventory balances, or
write successful purchase ledgers. Purchase uses an idempotency key; double-tap,
network retry, and two tabs/devices are guarded by EconomyOperationLock,
post-lock idempotency rechecks, and a refreshed server balance; live race proof
remains manual. Starter inventory repair during purchase is best-effort; a
starter self-heal error must not block a valid purchased joker balance and
ledger write. Partial failure reconciliation: ledger write failure uses
best-effort rollback of Diamond, joker, and hint balances, but live
provider/backend consistency proof remains manual.
Joker balance read-performance contract: UserJokerInventory is the Profile/Solo current-balance source. JokerTransaction is the ledger/audit trail and must not be summed on Profile open. Profile, Solo, and Mağaza use the shared getUserJokerBalances / mutation-result cache path keyed by normalized user email. Complete inventory rows render through a fast current-balance read; missing or partial rows trigger idempotent starter/self-heal. Mağaza purchase and Solo spend must update or invalidate the shared balance cache so Profile and Solo do not show stale counts. spendUserJoker validates Solo context, uses deploy-safe UserJokerInventory/JokerTransaction entity fallback, and returns safe user-facing errors. Normal Solo joker spend uses EconomyOperationLock, rechecks the JokerTransaction idempotency key after the lock, then re-reads UserJokerInventory and refuses to decrement a zero balance. Admin/static reconciliation can compare UserJokerInventory.quantity against JokerTransaction summed deltas and latest balance_after without mutating data. Guest/no-login paths must not query user-owned joker inventory. Live performance proof remains manual: login, open Profile, confirm Joker Çantası loads quickly, purchase/spend a joker, and confirm Profile/Solo counts refresh.

## Admin reset and account deletion
Admin reset sets \`daily_wheel_last_spin_date\` to the current UTC day, clears Daily Wheel guard fields, and removes target \`DailyWheelSpin\` rows. Retained OnlineMatchResult/DiamondTransaction/DailyWheelSpin rows no longer contain the deleted user.
Admin reset remains admin-only, previewed, confirmed, and logged; it prevents stale Daily Wheel availability/countdown state without granting duplicate Diamonds, changing Kronox Puan, or affecting leaderboard sorting or rank.
Retained economy/gameplay rows do not expose the deleted user identity.

Future sources (daily_quest_future, wheel_spin, rewarded_ad, quest_reward,
real-money purchase fulfillment, achievement, special_event) are schema-ready
but not active yet.
`;
