// Runtime mirrors of the Package 2 docs and out-of-/src backend sources.
//
// Vite's `?raw` import cannot reach outside of `src/` on this host (importing
// from `docs/`, `base44/entities`, or `base44/functions` breaks the build with
// "Failed to parse source for import analysis ... .md?raw / .ts?raw"). These
// JS string mirrors keep the Health Center static contracts inside /src so they
// never break the build. Keep them in sync with the canonical files.

// ─── Docs ──────────────────────────────────────────────────────────────
export const SOLO_QUESTION_ENGINE_DOC = `# Kronox Solo Question Engine

Normal Solo levels use 16 unique years (16 questions) and need 7 correct
placements to pass. Special Solo levels start at level 10, repeat every
5 levels, use 19 unique years (19 questions), and need 10 correct placements
to pass. All new Solo attempts use 180 seconds and fail on the 10th mistake.
Only active questions (Question.state === "A") from active categories are used.
Replay rebuilds the deck with no mid-attempt re-randomization. Fallback may
relax category/subcategory balance, era spread, or recently-seen filtering but
never allows duplicate years or invalid first 5 spacing.
`;

export const CATEGORY_TAXONOMY_DOC = `# Kronox Category Taxonomy

CATEGORY_ID_FIELD is category_id — the single canonical live field.
CATEGORY_IMPORT_ALIAS_FIELD is categoryid, used only during import
normalization: categoryid -> category_id.
Do not create competing live DB fields.
Questions reference category_id via main/second/third category fields.
`;

export const RELEASE_PROOF_CHECKLIST_DOC = `# Kronox Release Proof Checklist

## Online Scoring Persistence
Two-account invite + scoring proof, OnlineMatchResult idempotency.

## RLS And Backend Security
Two/three-account RLS probe matrix, service-role scoping.

PWA push, mobile safe-area, and other runtime proofs remain manual.
`;

// ─── Out-of-/src backend sources (token mirrors) ───────────────────────
export const startLobbyGameSource = `
  // Mirror of base44/functions/startLobbyGame/entry.ts — token contract.
  const activeIds = await loadActiveMainCategoryIds();
  function isActiveQuestion(q) { return String(q?.state || 'A') === 'A'; }
  const hasSelectedCategoryIds = Array.isArray(selectedCategoryIds) && selectedCategoryIds.length > 0;
  if (!hasSelectedCategoryIds) return [];
  // No all-category last-resort fallback exists here.
  if (activePool.length < needed) {
    return json({
      error: 'Seçilen kategoriler için yeterli aktif soru bulunamadı.',
      code: 'insufficient_active_questions_for_selected_categories',
    }, 422);
  }
`;

export const getSoloLeaderboardSource = `
  // Mirror of base44/functions/getSoloLeaderboard/entry.ts — token contract.
  const rows = await base44.asServiceRole.entities.User.list('-kronox_puan_total', 200);
  const computedTotalKronoxScore = summary.totalSoloScore + online_score;
  const projected = backfillKronoxPuanProjection(user, computedTotalKronoxScore);
  // user_kronox_puan_total_projection — persisted unified projection field.
  // Privacy: raw user_email is never returned in leaderboard rows.
`;

export const userEntitySource = `
  "name": "User",
  "properties": {
    "kronox_puan_total": { "description": "user_kronox_puan_total_projection" },
    "computedTotalKronoxScore": {},
    "role": { "enum": ["admin","user"] }
  }
`;
