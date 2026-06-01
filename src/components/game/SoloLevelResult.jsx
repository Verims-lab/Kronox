import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
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
 * Props (unchanged contract — Game.jsx still passes the same fields):
 *   levelNumber, passed, stars, mistakes, timeSeconds,
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
  timeSeconds,
  baseScore = 0,
  timeBonus = 0,
  levelScore = 0,
  // scoreDelta + didImproveScore + isNextLevelComingSoon + nextLevelNumber
  // are kept in the public prop list for backwards compatibility with
  // Game.jsx, even though the new success popup doesn't render them.
  scoreDelta,
  didImproveScore,
  cardsCompleted,
  cardTarget,
  failReason,
  nextLevelNumber,
  hasNextLevel,
  isNextLevelComingSoon,
  onRetry,
  onNextLevel,
  onBackToPath,
}) {
  // Reference the unused props so lint stays clean without changing the
  // public contract that Game.jsx relies on.
  void scoreDelta;
  void didImproveScore;
  void nextLevelNumber;
  void isNextLevelComingSoon;

  // Current user email — needed by the success popup's record-context
  // lookup. Resolved once on mount regardless of pass/fail so hook order
  // is stable across renders.
  const [currentUserEmail, setCurrentUserEmail] = useState(null);
  useEffect(() => {
    let cancelled = false;
    base44.auth.me()
      .then((u) => { if (!cancelled) setCurrentUserEmail(u?.email || null); })
      .catch(() => { if (!cancelled) setCurrentUserEmail(null); });
    return () => { cancelled = true; };
  }, []);

  if (passed) {
    return (
      <SoloSuccessPopup
        levelNumber={levelNumber}
        stars={stars}
        mistakes={mistakes}
        timeSeconds={timeSeconds}
        levelScore={levelScore}
        timeBonus={timeBonus}
        hasNextLevel={hasNextLevel}
        userEmail={currentUserEmail}
        onNextLevel={onNextLevel}
        onRetry={onRetry}
        onBackToPath={onBackToPath}
      />
    );
  }

  return (
    <SoloFailureCard
      levelNumber={levelNumber}
      stars={stars}
      mistakes={mistakes}
      timeSeconds={timeSeconds}
      baseScore={baseScore}
      timeBonus={timeBonus}
      levelScore={levelScore}
      cardsCompleted={cardsCompleted}
      cardTarget={cardTarget}
      failReason={failReason}
      onRetry={onRetry}
      onBackToPath={onBackToPath}
    />
  );
}