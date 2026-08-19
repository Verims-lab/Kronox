import React from 'react';

const confidenceTone = {
  HIGH: 'text-emerald-300',
  MEDIUM: 'text-amber-300',
  LOW: 'text-orange-300',
  BLOCKED: 'text-red-300',
};

export default function DuplicateEligibilityReview({ review }) {
  const reasons = review?.conflictReasons || [];
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2" data-eligibility-fingerprint={review.fingerprintKey}>
      <div className="flex flex-wrap items-center justify-between gap-1 text-[9px]">
        <span className="font-mono text-sky-200">{review.fingerprintKey}</span>
        <span className={`font-black ${confidenceTone[review.canonicalConfidence] || confidenceTone.BLOCKED}`}>
          {review.currentClassification} · {review.canonicalConfidence}
        </span>
      </div>
      <p className="mt-1 text-[10px] text-white">{review.rowCount} satır · {review.extraRowCount} fazla</p>
      <dl className="mt-1 space-y-1 text-[9px] text-muted-foreground">
        <div><dt className="inline font-bold text-amber-200">Kanonik aday: </dt><dd className="inline font-mono">{review.proposedCanonicalRowFingerprint}</dd></div>
        <div><dt className="inline font-bold text-amber-200">Güven seviyesi: </dt><dd className="inline">{review.canonicalConfidence}</dd></div>
        <div><dt className="inline font-bold text-amber-200">Çakışma nedeni: </dt><dd className="inline">{reasons.length ? reasons.join(', ') : 'Exact duplicate sinyalleri uyumlu'}</dd></div>
        <div><dt className="inline font-bold text-amber-200">Karar: </dt><dd className="inline">{review.requiredReviewerDecision}</dd></div>
      </dl>
    </div>
  );
}