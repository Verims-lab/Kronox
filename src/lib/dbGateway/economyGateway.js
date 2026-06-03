export {
  buildDiamondIdempotencyKey,
  ensureDiamondEconomyForUser,
  getDiamondBalance,
  grantDiamondsOnce,
  normalizeEconomyEmail,
} from '@/lib/diamondEconomy';

export const economyGatewayContract = Object.freeze({
  balanceSource: 'User.diamonds',
  ledger: 'DiamondTransaction',
  idempotency: 'DiamondTransaction.idempotency_key logical guard; unique constraint platform/manual',
  rewardAmountsChanged: false,
});
