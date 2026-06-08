import { base44 } from '@/api/base44Client';

export {
  buildDiamondIdempotencyKey,
  ensureDiamondEconomyForUser,
  getDiamondBalance,
  grantDiamondsOnce,
  normalizeEconomyEmail,
} from '@/lib/diamondEconomy';

export function getDailyWheelStatus() {
  return base44.functions.invoke('getDailyWheelStatus', {});
}

export function claimDailyWheelReward(payload = {}) {
  return base44.functions.invoke('claimDailyWheelReward', payload);
}

export function purchaseJokerWithDiamonds(payload = {}) {
  return base44.functions.invoke('purchaseJokerWithDiamonds', payload);
}

export const economyGatewayContract = Object.freeze({
  balanceSource: 'User.diamonds',
  ledger: 'DiamondTransaction',
  wheelLedger: 'DailyWheelSpin',
  marketPurchaseFunction: 'purchaseJokerWithDiamonds',
  marketPurchase: 'server-backed Mağaza spends Diamonds for Solo jokers; client never supplies trusted price',
  dailyWheel: 'server-backed Daily Wheel grants Diamonds only, no Kronox Puan; does not affect leaderboard sorting or rank',
  idempotency: 'one claim per user per UTC server day; DiamondTransaction.idempotency_key and DailyWheelSpin.idempotency_key logical guard; unique constraint platform/manual',
  rewardAmountsChanged: false,
});
