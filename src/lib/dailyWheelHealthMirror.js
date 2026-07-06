// Health mirror for repo-external Daily Wheel backend/schema artifacts.
// Vite cannot reliably raw-import base44/* files from src Health modules.
// Keep this mirror in sync with:
// - base44/entities/DailyWheelSpin.jsonc
// - base44/functions/getDailyWheelStatus/entry.ts
// - base44/functions/claimDailyWheelReward/entry.ts
// - base44/functions/adminResetDailyWheelState/entry.ts

export const DAILY_WHEEL_BACKEND_HEALTH_SOURCE = `
DailyWheelSpin
user_email
spin_date
reward_type
reward_id
reward_label
reward_segment_index
reward_segment_count
reward_amount
joker_reward_summary
gift_box_status
gift_box_reward_id
gift_box_opened_at
gift_box_reward_summary
streak_before
streak_after
streak_bonus_amount
total_reward_amount
idempotency_key
claimed_at
next_available_at
owner_key
player_type
daily_wheel:<playerKey>:<YYYY-MM-DD>
guest:<g_owner_key>
one claim per player per UTC server day
DailyWheelSpin.idempotency_key
logical guard; unique constraint platform/manual

getDailyWheelStatus
base44.auth.me()
resolveDailyWheelPlayer
isGuestProfileComplete
guestPlayerKey
GuestProfile.diamonds
unauthenticated
Günlük Çark için giriş yapmalısın.
available
alreadyClaimedToday
nextAvailableAt
currentStreak
lastReward
balanceAfter
playerType
guestProfile
daily_wheel_auto_popup_reset_at
dailyWheelAutoPopupResetAt

claimDailyWheelReward
base44.auth.me()
resolveDailyWheelPlayer
updateDailyWheelPlayer
userEntity
dailyWheelSpinEntity
diamondTransactionEntity
jokerInventoryEntity
jokerTransactionEntity
authEntity || serviceEntity
player?.isGuest ? serviceEntity : (authEntity || serviceEntity)
daily_wheel_user_update_unavailable
daily_wheel_guest_update_unavailable
guestPlayerKey
buildIdempotencyKey
findSpin
DAILY_WHEEL_SOURCE = 'daily_wheel'
DAILY_WHEEL_REWARD_TABLE_VERSION = 'daily_wheel_v2'
DAILY_WHEEL_VISUAL_SEGMENT_COUNT = 8
DAILY_WHEEL_JOKER_REASON = 'daily_wheel'
REWARD_TABLE
diamond_20 weight: 28
diamond_60 weight: 20
diamond_100 weight: 15
joker_krono_kalkan weight: 12
joker_zamani_dondur weight: 10
joker_kart_degistir weight: 8
gift_box weight: 5
diamond_250 weight: 2
Daily Wheel popup visual order from top clockwise
diamond_20 segmentIndex 0
diamond_60 segmentIndex 1
diamond_100 segmentIndex 2
joker_krono_kalkan segmentIndex 3
joker_zamani_dondur segmentIndex 4
joker_kart_degistir segmentIndex 5
gift_box segmentIndex 6
diamond_250 segmentIndex 7
ready popup title GÜNLÜK ÇARK HAZIR
ready popup subtitle Bugünkü ödülünü almak için çevir
SONRA does not consume spin
ÇEVİR starts backend claim only
spinning state stays in same premium popup/wheel shell
no separate intermediate spinning-copy screen
available free spin auto-opens the full Daily Wheel modal after player and wheel state resolve
Home Çark manual tap opens the full modal when available and read-only post-win result when already claimed
old compact Çark / Günlük Çark / Hazır card is removed from Home Daily Wheel flow
result reveal waits for backend-selected landing animation
post-spin result screen keeps wheel visible, shows one backend-payload reward line, and shows one disabled ad/video ÇEVİR CTA with smaller Yakında subtext
old result copy removed: Toplam, Toplam Elmas, Seri, repeat heading, repeat explanation
disabled ad repeat has no fake rewarded-ad grant path and cannot start a spin today
completed reward result close returns directly to Home and does not reveal the old Çark / Günlük Çark claimed cooldown sheet
completed reward result close cleans up audio/effects/timers/confetti and leaves no hidden overlay blocking Home
already-claimed Home Çark manual reopen shows read-only post-win result from stored lastReward or safe Bugünkü ödül alındı fallback
already-claimed manual reopen does not call claimDailyWheelReward, start a spin, grant a reward, or fake an ad path
one continuous spin: fast start, decelerate only near the end, light final bounce
no slow-fast-slow: no separate steady loop phase before the landing spin
spin sound/effects synchronized with visible wheel rotation
ticks widen as the wheel decelerates; celebration fires at the visible stop
sound/timers cleaned up on close/unmount so no sound outlives the wheel
segment content scale token 0.8; icons and numbers must not be enlarged
segment content is radially oriented toward the wheel center: rotated by its own segment center angle, not screen-upright
diamond icon+number rotate as one group; joker/gift icons rotate with their segment; content rotates with the wheel; pointer stays stationary
no screen-upright counter-rotation of segment content; orientation must not enlarge content or change reward mapping/stop alignment
visual polish may improve quality but must not change reward mapping or icon sizing
GIFT_BOX_REWARD_TABLE
gift_diamond_50
gift_diamond_70
gift_diamond_80
gift_diamond_100_card_swap
gift_diamond_60_krono_kalkan
gift_diamond_20_zamani_dondur
gift_krono_kalkan_card_swap
gift_zamani_dondur_card_swap
gift_krono_kalkan_zamani_dondur
buildRewardPlan
selectGiftBoxReward
giftBoxResolvedServerSide
noFakeAdRewardFlow
selectReward
randomUnit
STREAK_BONUS_AMOUNT = 150
streakAfter % 7 === 0
createDailyWheelSpin
DailyWheelSpin.create
grantDailyWheelJokers
JokerTransaction.create
UserJokerInventory
postCreateCanonicalSpin
postReserveSpin
postReservePlayer
postReserveTransaction
recoveredExistingDailyWheelSpin
spinRowFromDiamondTransaction
DiamondTransaction.create
owner_key: player.ownerKey
player_type: player.isGuest ? 'guest' : 'registered'
source: DAILY_WHEEL_SOURCE
direction: 'earn'
guestProfileReward
rawGuestTokenServerStored: false
noKronoxPuan: true
grants no Kronox Puan
Daily Wheel V2 can grant Diamonds, approved Solo jokers, or Gift Box rewards
Daily Wheel never grants Kronox Puan
does not affect leaderboard sorting or rank
adminResetDailyWheelState
daily_wheel_admin_reset_at
doesNotReverseRewards: true
grantsRewards: false
daily_wheel_last_spin_date
daily_wheel_next_available_at
daily_wheel_streak
daily_wheel_spin_count
daily_quest_reward:<playerKey>:<YYYY-MM-DD>:<questKey>
daily_quest_last_claim_date
daily_quest_next_available_at
daily_wheel_request_failed
Çark ödülü alınamadı.
Base44 uniqueness is platform/manual proof
Base44 schema-level uniqueness is not assumed
function-level guard only = Medium / P1 hardening
parallel duplicate calls require manual proof
`;
