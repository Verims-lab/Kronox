// Health mirror for repo-external Daily Wheel backend/schema artifacts.
// Vite cannot reliably raw-import base44/* files from src Health modules.
// Keep this mirror in sync with:
// - base44/entities/DailyWheelSpin.jsonc
// - base44/functions/getDailyWheelStatus/entry.ts
// - base44/functions/claimDailyWheelReward/entry.ts

export const DAILY_WHEEL_BACKEND_HEALTH_SOURCE = `
DailyWheelSpin
user_email
spin_date
reward_amount
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
playerType
guestProfile

claimDailyWheelReward
base44.auth.me()
resolveDailyWheelPlayer
updateDailyWheelPlayer
guestPlayerKey
buildIdempotencyKey
findSpin
DAILY_WHEEL_SOURCE = 'daily_wheel'
REWARD_TABLE
30 high weight 24
40 high weight 22
50 high weight 20
60 medium weight 12
75 medium weight 10
100 low weight 7
150 rare weight 4
250 very_rare weight 1
selectReward
randomUnit
STREAK_BONUS_AMOUNT = 150
streakAfter % 7 === 0
createDailyWheelSpin
DailyWheelSpin.create
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
does not affect leaderboard sorting or rank
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
