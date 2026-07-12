import { base44 } from '@/api/base44Client';
import {
  applyLevelAttempt,
  readSoloProgress,
  writeSoloProgress,
} from '@/lib/soloLevels';
import {
  calculateSoloAttemptResult,
  getBestSoloLevelResult,
  SOLO_RULES_VERSION,
} from '@/lib/soloProgressHelpers';

export async function persistSoloLevelAttempt({
  levelNumber,
  result,
  cardTarget,
  onPersistedCompletion,
} = {}) {
  const player = await base44.auth.me().catch(() => null);
  const current = readSoloProgress(player);
  const previousEntry = current?.levels?.[String(levelNumber)] || null;
  const attempt = calculateSoloAttemptResult({
    mistakes: result.mistakes,
    usedMoves: result.usedMoves,
    remainingMoves: result.remainingMoves,
    maxMoves: result.maxMoves,
    completedCards: result.cardsCompleted,
    elapsedSeconds: result.timeSeconds,
    requiredCards: cardTarget,
  });
  const normalizedResult = {
    ...attempt,
    soloRulesVersion: result.soloRulesVersion || SOLO_RULES_VERSION,
    stars: result.stars,
    passed: result.passed,
    usedMoves: result.usedMoves,
    remainingMoves: result.remainingMoves,
    maxMoves: result.maxMoves,
    baseScore: result.baseScore,
    timeBonus: result.timeBonus,
    levelScore: result.levelScore,
  };
  const bestPreview = getBestSoloLevelResult(previousEntry, normalizedResult);
  const next = applyLevelAttempt(current, {
    levelNumber,
    stars: result.stars,
    mistakes: result.mistakes,
    usedMoves: result.usedMoves,
    remainingMoves: result.remainingMoves,
    maxMoves: result.maxMoves,
    timeSeconds: result.timeSeconds,
    cardsCompleted: result.cardsCompleted,
    cardTarget,
    passed: result.passed,
    baseScore: result.baseScore,
    timeBonus: result.timeBonus,
    levelScore: result.levelScore,
    soloRulesVersion: result.soloRulesVersion || SOLO_RULES_VERSION,
  });
  const persisted = await writeSoloProgress(player, next);

  if (persisted && result.passed && typeof onPersistedCompletion === 'function') {
    await onPersistedCompletion();
  }

  return {
    persisted: Boolean(persisted),
    scoreDelta: bestPreview.scoreDelta,
    didImproveScore: bestPreview.didImprove,
    bestScoreAfter: bestPreview.updatedBestLevelResult.bestScore,
  };
}
