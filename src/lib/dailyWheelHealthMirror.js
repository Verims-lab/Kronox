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
