import { base44 } from '@/api/base44Client';

export {
  buildDiamondIdempotencyKey,
  ensureDiamondEconomyForUser,
  getDiamondBalance,
  grantDiamondsOnce,
  normalizeEconomyEmail,
} from '@/lib/diamondEconomy';

export function getDailyWheelStatus(payload = {}) {
  return base44.functions.invoke('getDailyWheelStatus', payload);
}

export function claimDailyWheelReward(payload = {}) {
  return base44.functions.invoke('claimDailyWheelReward', payload);
}

export function purchaseJokerWithDiamonds(payload = {}) {
  return base44.functions.invoke('purchaseJokerWithDiamonds', payload);
}

export const economyGatewayContract = Object.freeze({
  balanceSource: 'User.diamonds / completed guest GuestProfile.diamonds',
  ledger: 'DiamondTransaction / JokerTransaction',
  wheelLedger: 'DailyWheelSpin',
  marketPurchaseFunction: 'purchaseJokerWithDiamonds',
  marketPurchase: 'server-backed Mağaza spends Diamonds for Solo jokers; client never supplies trusted price',
  dailyWheel: 'server-backed Daily Wheel V2 grants weighted Diamonds, approved Solo jokers, or server-resolved Gift Box rewards for authenticated users or token-proven completed guests; no Kronox Puan, no leaderboard impact, 8 equal visual segments, backend weights 28/20/15/12/10/8/5/2, and +150 seven-day streak bonus when applicable',
  dailyQuestV1: 'Home Görevler shortcut exposes active Daily Quest Runtime v1 with canonical solo_level_complete; claimDailyQuestReward grants diamonds only through DiamondTransaction source daily_quest_reward with separate daily_quest_* fields, never Daily Wheel fields; completed guests persist on GuestProfile.diamonds',
  idempotency: 'one free claim per player per UTC server day; DailyWheelSpin.idempotency_key/user_email+spin_date, DiamondTransaction.idempotency_key, and JokerTransaction.idempotency_key logical guards; unique constraint platform/manual; function-level guard only until DB/entity unique proof is attached',
  rewardAmountsChanged: true,
});
