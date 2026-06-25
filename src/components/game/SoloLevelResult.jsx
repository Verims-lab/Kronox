import React from 'react';
import SoloSuccessPopup from './SoloSuccessPopup';
import SoloFailureCard from './SoloFailureCard';

/**
 * Solo level attempt result router.
 *
 * Hooks must run in a stable order on every render, so this component
 * stays a thin dispatcher: it always calls the same hook list, then
 * delegates rendering to either the success or failure subcomponent.
 * Each branch owns its own UI + any branch-specific async lookups (rank
 * for fail, global/friends record for success).
 *
 * Props:
 *   levelNumber, passed, stars, usedMoves, remainingMoves, maxMoves, mistakes, timeSeconds,
 *   baseScore, timeBonus, levelScore, scoreDelta, didImproveScore,
 *   cardsCompleted, cardTarget, failReason,
 *   nextLevelNumber, hasNextLevel, isNextLevelComingSoon,
 *   onRetry, onNextLevel, onBackToPath
 */
export default function SoloLevelResult({
  levelNumber,
  passed,
  stars,
  mistakes,
  usedMoves,
  remainingMoves,
  maxMoves,
  timeSeconds,
  timeBonus = 0,
  levelScore = 0,
  // scoreDelta + didImproveScore + isNextLevelComingSoon + nextLevelNumber
  // are kept in the public prop list for backwards compatibility with
  // Game.jsx, even though the new success popup doesn't render them.
  scoreDelta,
  didImproveScore,
  failReason,
  nextLevelNumber,
  hasNextLevel,
  isNextLevelComingSoon,
  onRetry,
  onNextLevel,
  onBackToPath,
  successPrimaryActionLabel,
  successBackToPathLabel,
  successPrimaryActionEnabled,
  guestRecordPayload,
}) {
  // Reference the unused props so lint stays clean without changing the
  // public contract that Game.jsx relies on.
  void scoreDelta;
  void didImproveScore;
  void nextLevelNumber;
  void isNextLevelComingSoon;

  if (passed) {
    const successHasPrimaryAction = successPrimaryActionEnabled ?? hasNextLevel;
    return (
      <SoloSuccessPopup
        levelNumber={levelNumber}
        stars={stars}
        mistakes={mistakes}
        usedMoves={usedMoves}
        remainingMoves={remainingMoves}
        maxMoves={maxMoves}
        timeSeconds={timeSeconds}
        levelScore={levelScore}
        timeBonus={timeBonus}
        hasNextLevel={successHasPrimaryAction}
        guestRecordPayload={guestRecordPayload}
        onNextLevel={onNextLevel}
        onRetry={onRetry}
        onBackToPath={onBackToPath}
        primaryActionLabel={successPrimaryActionLabel}
        backToPathLabel={successBackToPathLabel}
      />
    );
  }

  return (
    <SoloFailureCard
      levelNumber={levelNumber}
      mistakes={mistakes}
      usedMoves={usedMoves}
      remainingMoves={remainingMoves}
      maxMoves={maxMoves}
      timeSeconds={timeSeconds}
      levelScore={levelScore}
      failReason={failReason}
      onRetry={onRetry}
      onBackToPath={onBackToPath}
    />
  );
}
