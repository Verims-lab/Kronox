export const DAILY_WHEEL_V2_VERSION = 'daily_wheel_v2';
export const DAILY_WHEEL_VISUAL_SEGMENT_COUNT = 8;

export const DAILY_WHEEL_REWARD_SEGMENTS = Object.freeze([
  { id: 'diamond_20', type: 'diamonds', diamondAmount: 20, label: '+20 Elmas', shortLabel: '+20' },
  { id: 'diamond_60', type: 'diamonds', diamondAmount: 60, label: '+60 Elmas', shortLabel: '+60' },
  { id: 'diamond_100', type: 'diamonds', diamondAmount: 100, label: '+100 Elmas', shortLabel: '+100' },
  { id: 'joker_krono_kalkan', type: 'joker', jokerType: 'mistake_shield', label: 'Kronokalkan', shortLabel: 'Kalkan' },
  { id: 'joker_zamani_dondur', type: 'joker', jokerType: 'time_freeze', label: 'Zaman Dondur', shortLabel: 'Dondur' },
  { id: 'joker_kart_degistir', type: 'joker', jokerType: 'card_swap', label: 'Kart Değiştir', shortLabel: 'Değiştir' },
  { id: 'gift_box', type: 'gift_box', label: 'Hediye Kutusu', shortLabel: 'Kutu' },
  { id: 'diamond_250', type: 'diamonds', diamondAmount: 250, label: '+250 Elmas', shortLabel: '+250' },
]);

export const DAILY_WHEEL_REWARD_SEGMENT_IDS = DAILY_WHEEL_REWARD_SEGMENTS.map((segment) => segment.id);

export const DAILY_WHEEL_JOKER_LABELS = Object.freeze({
  mistake_shield: 'Kronokalkan',
  time_freeze: 'Zaman Dondur',
  card_swap: 'Kart Değiştir',
});

export function normalizeDailyWheelSegmentIndex(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.min(
    DAILY_WHEEL_VISUAL_SEGMENT_COUNT - 1,
    Math.max(0, Math.floor(number)),
  );
}

export function getDailyWheelSegmentById(id) {
  return DAILY_WHEEL_REWARD_SEGMENTS.find((segment) => segment.id === id) || DAILY_WHEEL_REWARD_SEGMENTS[0];
}

export function getDailyWheelSegmentIndex(id) {
  const index = DAILY_WHEEL_REWARD_SEGMENTS.findIndex((segment) => segment.id === id);
  return index >= 0 ? index : 0;
}

export function formatDailyWheelJokerLabel(jokerType) {
  return DAILY_WHEEL_JOKER_LABELS[jokerType] || 'Joker';
}

export function normalizeDailyWheelJokerRewards(input) {
  if (!Array.isArray(input)) return [];
  const byType = new Map();
  input.forEach((row) => {
    const jokerType = String(row?.jokerType || row?.joker_type || row?.type || '').trim();
    if (!Object.prototype.hasOwnProperty.call(DAILY_WHEEL_JOKER_LABELS, jokerType)) return;
    const quantity = Math.max(0, Math.floor(Number(row?.quantity) || 0));
    if (!quantity) return;
    const existing = byType.get(jokerType) || 0;
    byType.set(jokerType, existing + quantity);
  });
  return Array.from(byType.entries()).map(([jokerType, quantity]) => ({
    jokerType,
    label: formatDailyWheelJokerLabel(jokerType),
    quantity,
  }));
}

export function summarizeDailyWheelReward(result) {
  const rewardType = String(result?.rewardType || result?.reward_type || '').trim();
  const rewardId = String(result?.rewardId || result?.reward_id || '').trim();
  const diamondAmount = Math.max(0, Math.floor(Number(result?.rewardAmount ?? result?.reward_amount) || 0));
  const totalDiamonds = Math.max(0, Math.floor(Number(result?.totalRewardAmount ?? result?.total_reward_amount) || 0));
  const jokerRewards = normalizeDailyWheelJokerRewards(result?.jokerRewards || result?.joker_reward_summary);
  const giftBox = result?.giftBox && typeof result.giftBox === 'object' ? result.giftBox : null;

  if (rewardType === 'gift_box' || rewardId === 'gift_box') {
    return {
      title: 'Hediye Kutusu açıldı!',
      subtitle: 'Kutunun içindeki ödüller hesabına eklendi.',
      totalDiamonds,
      jokerRewards,
      giftBox,
    };
  }
  if (rewardType === 'joker' || jokerRewards.length) {
    const first = jokerRewards[0] || {};
    return {
      title: `${first.label || 'Joker'} kazandın`,
      subtitle: 'Joker Çantası bakiyen güncellendi.',
      totalDiamonds,
      jokerRewards,
      giftBox,
    };
  }
  return {
    title: `+${diamondAmount.toLocaleString('tr-TR')} Elmas kazandın`,
    subtitle: 'Elmas bakiyen güncellendi.',
    totalDiamonds,
    jokerRewards,
    giftBox,
  };
}
