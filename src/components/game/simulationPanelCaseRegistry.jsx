// Kronox Health Center — Case Registry / Aggregator.
//
// PURPOSE
//   One small file SimulationPanel.jsx imports from. It flattens every
//   modular health-case file's `EXTRA_SUITES` + `EXTRA_TESTS` exports
//   into `ALL_EXTRA_SUITES` + `ALL_EXTRA_TESTS`, and re-exports the
//   penalty/score hooks the panel needs.
//
// HOW TO ADD A NEW HEALTH CASE FILE
//   1. Create the new module under `components/game/`. Use a stable
//      descriptive name (NOT a Codex tag). Examples:
//        - simulationPanelSoloProgressCases.js
//        - simulationPanelOnboardingCases.js
//   2. From it, export:
//        - `EXTRA_SUITES` (array of { id, name, critical, color })
//        - `EXTRA_TESTS`  (array of case objects shaped like makeCase output)
//   3. Add the module to `MODULES` below. That's it — SimulationPanel
//      picks the new suite + cases up automatically:
//        - suites list, suiteSummary, totalCases
//        - PASS/WARNING/FAIL/BLOCKED/NOT_AUTOMATABLE counts
//        - top blockers / critical failures (when critical & FAIL/ERROR)
//        - runtime-proof grouping, manual-verification section
//        - report JSON export
//        - score penalties (case penalty by status+critical; static-
//          limitation penalty for critical+runtimeProofRequired+
//          STATIC_CHECK_LIMITATION PASS cases)
//
//   The aggregator deliberately does NOT add new suites to the social
//   uncertainty penalty set inside `simulationPanelExtraCases.js`. That
//   set is intentionally scoped to social/RLS/invite suites only. New
//   non-social suites should not silently inflate that penalty.
//
// WHY NOT EDIT simulationPanelExtraCases.js DIRECTLY?
//   That file has hit the platform's 2000-line per-file edit cap. It's
//   intentionally frozen. New cases go through this registry instead.

import {
  EXTRA_SUITES as BASE_EXTRA_SUITES,
  EXTRA_TESTS as BASE_EXTRA_TESTS,
  ACTION_TYPES,
  criticalSocialUncertaintyPenalty,
  criticalStaticLimitationPenalty,
} from './simulationPanelExtraCases';
// Codex132 — Stale-contract overrides. `simulationPanelExtraCases.jsx`
// is frozen at the 2000-line edit cap. A handful of its cases became
// stale after Codex127/Codex129/Codex130 product changes. The override
// module exports OVERRIDDEN_CASE_KEYS (a Set of `${suiteId}.${id}`
// keys) plus replacement cases that match the current product. We
// filter the stale ids out of BASE_EXTRA_TESTS and append the
// replacements. Suite ids, critical flags, and penalty scoping stay
// identical — totals and JSON shape do not shift.
import { OVERRIDDEN_CASE_KEYS, EXTRA_TESTS as OVERRIDE_TESTS } from './simulationPanelHealthOverrideCases';

// Modular case files. Add new files here; the order only affects suite
// listing order on the side panel (existing ids/positions don't move).
import * as soloProgressCases from './simulationPanelSoloProgressCases';
import * as soloMapCases from './simulationPanelSoloMapCases';
import * as soloFocusCases from './simulationPanelSoloFocusCases';
import * as soloUnlockCases from './simulationPanelSoloUnlockCases';
import * as leaderboardCases from './simulationPanelLeaderboardCases';
// Codex117 — Solo Map Focus suite (level → section helper + CTA/map
// single-source-of-truth contract + auto-scroll fix lock-in).
import * as soloMapFocusCases from './simulationPanelSoloMapFocusCases';
// Codex119 — Liderlik graceful fallback contracts (friendly placeholder
// when global ranking fails, own-score visibility, admin diagnostics).
import * as leaderboardFallbackCases from './simulationPanelLeaderboardFallbackCases';
// Codex123 — Phase 2 architecture guards: lock the SimulationPanel split
// (runner extracted, report builder extracted, registry single-import,
// report shape preserved, simulationPanelExtraCases not silently growing,
// SimulationPanel.jsx stays in orchestration-size).
import * as healthArchitectureCases from './simulationPanelHealthArchitectureCases';
// Codex145 — Health/Admin panel mobile-safe UI contracts: top safe-area
// clipping, internal scroll container, and report visibility on mobile/PWA.
import * as healthUiCases from './simulationPanelHealthUiCases';
// Codex123 — Phase 3 UI consolidation: lock the shared KronoxStatTile +
// shared style tokens contracts for Profile/Leaderboard so neither
// surface can silently revert to a local StatTile duplicate.
import * as uiConsolidationCases from './simulationPanelUiConsolidationCases';
// Codex127 — Online challenge flow simplification:
// kategori carousel + arkadaş popup + tek adımda lobi + davet.
import * as onlineChallengeCases from './simulationPanelOnlineChallengeCases';
// Codex128 — Online score/checkpoint system: win/loss only, no draw
// scoring, time bonus + checkpoint floor + idempotent match write contracts.
import * as onlineRankingCases from './simulationPanelOnlineRankingCases';
// Codex129 — Friend invite delivery & email honesty contracts.
import * as inviteDeliveryCases from './simulationPanelInviteDeliveryCases';
// Codex130 — Game invite lifecycle, 10-min TTL, stale lobby cleanup,
// in-app banner auto-dismiss, focus/visibility recheck contracts.
import * as inviteLifecycleCases from './simulationPanelInviteLifecycleCases';
// Codex131 — Lobby simplification + active-lobby return contracts.
import * as lobbySimplificationCases from './simulationPanelLobbySimplificationCases';
// Codex134 — Shared real-time header notification system contracts.
import * as headerNotificationsCases from './simulationPanelHeaderNotificationsCases';
// Codex135 — Game invite lifecycle hardening (single-source-of-truth
// selector + toast dismiss safety + fresh-invite persistence).
import * as gameInviteLifecycleCases from './simulationPanelGameInviteLifecycleCases';
// Codex151 — Notification lifecycle stabilization: fetch/subscription
// merge safety, banner/view-model split, and stable invite-to-lobby route.
import * as notificationLifecycleCases from './simulationPanelNotificationLifecycleCases';
// Codex136 — Scoring contract suite (Solo time-bonus boundary fix, Online
// draw removal, missing-time → +0 bonus, doc-named helper aliases,
// lastMatchAt persistence, structured persistence failure / retry safety).
import * as scoringContractCases from './simulationPanelScoringContractCases';
// Codex138 — Invite timezone parse regression: the WhatsApp-video bug
// where Base44's naive ISO `created_date` was parsed as local time and
// the invite was instantly flipped to expired. Client + Deno backend
// parsers now append `Z` to naive strings so they parse as UTC. The
// GameInvite entity also gained the missing timestamp columns.
import * as inviteTimezoneCases from './simulationPanelInviteTimezoneCases';
// Codex140 — GameInvite "Aç" regression: successful accept must open the
// lobby/waiting room; fresh lobby timestamps must not be parsed as stale.
import * as gameInviteOpenToLobbyCases from './simulationPanelGameInviteOpenToLobbyCases';
// Codex139 — DB/Data Model hardening:
// schema docs, Solo localStorage scoping, leaderboard projection drift,
// OnlineMatchResult idempotency, cleanup/retention, and RLS probe matrix.
import * as dataModelCases from './simulationPanelDataModelCases';
// Codex143 — Online match completion scoring: winner/loser score apply,
// player-own elapsed time, checkpoint loss floor, and result popup delta.
import * as onlineScoreCompletionCases from './simulationPanelOnlineScoreCompletionCases';
// Codex146 — Visible Kronox Puan must include persisted Online score, not
// just popup/audit rows. Locks shared score helper + refresh/reconcile path.
import * as onlineScoreVisiblePuanCases from './simulationPanelOnlineScoreVisiblePuanCases';
// Codex149 — Player-facing copy must use one unified Puan / Kronox Puan
// language. Solo and Online remain technical components, not UI score labels.
import * as unifiedKronoxScoreCases from './simulationPanelUnifiedKronoxScoreCases';
// Codex152 — Diamond economy foundation: canonical User.diamonds balance,
// starter + daily login grants, idempotent ledger, and display contracts.
import * as diamondEconomyCases from './simulationPanelDiamondEconomyCases';
// Codex157 — Security cleanup: unused Spotify/external music import
// functions are gone, VAPID keys are env/config-only, and admin access no
// longer depends on a committed personal email.
import * as securityCleanupCases from './simulationPanelSecurityCleanupCases';
// Codex154 — Security: admin authorization hardening. Locks in that no
// admin-only backend function contains a hardcoded admin email literal,
// each reads admin allowlist env/secrets, requires auth, rejects
// non-admins with 403, and fails closed when config is missing.
import * as adminAuthorizationCases from './simulationPanelAdminAuthorizationCases';
// Codex154 — Backend function security guard: generateTechDoc must require
// server-side auth/admin authorization before internal PDF generation.
import * as backendSecurityCases from './simulationPanelBackendSecurityCases';
// Codex155 — Question dataset DB preparation: Category entity + fixed seed
// path, future Question metadata fields, and no gameplay schema switch yet.
import * as questionSchemaCases from './simulationPanelQuestionSchemaCases';
// Codex158 — Category status/description contracts: schema fields, seed
// all-active + non-empty descriptions, shared active-filter helper, and
// passive categories hidden from UI selection.
import * as categoryStatusCases from './simulationPanelCategoryStatusCases';
// Codex163 — Placement Feedback Animation: visual-only correct/wrong
// drop feedback (green pulse / red glow + shake + void-reject), no
// changes to drag/drop, hit-testing, scoring, or timeline ordering.
import * as placementFeedbackCases from './simulationPanelPlacementFeedbackCases';

const MODULES = [
  soloProgressCases,
  soloMapCases,
  soloFocusCases,
  soloUnlockCases,
  leaderboardCases,
  soloMapFocusCases,
  leaderboardFallbackCases,
  healthArchitectureCases,
  healthUiCases,
  uiConsolidationCases,
  onlineChallengeCases,
  onlineRankingCases,
  inviteDeliveryCases,
  inviteLifecycleCases,
  lobbySimplificationCases,
  headerNotificationsCases,
  gameInviteLifecycleCases,
  notificationLifecycleCases,
  scoringContractCases,
  inviteTimezoneCases,
  gameInviteOpenToLobbyCases,
  dataModelCases,
  onlineScoreCompletionCases,
  onlineScoreVisiblePuanCases,
  unifiedKronoxScoreCases,
  diamondEconomyCases,
  securityCleanupCases,
  adminAuthorizationCases,
  backendSecurityCases,
  questionSchemaCases,
  categoryStatusCases,
  placementFeedbackCases,
];

function flatten(key) {
  return MODULES.flatMap((mod) => {
    const value = mod?.[key];
    return Array.isArray(value) ? value : [];
  });
}

const MODULAR_EXTRA_SUITES = flatten('EXTRA_SUITES');
const MODULAR_EXTRA_TESTS = flatten('EXTRA_TESTS');

// Codex132 — Filter overridden case keys out of BASE_EXTRA_TESTS before
// appending the override + modular replacements. `key` follows the
// `${suiteId}.${id}` convention defined by `makeCase` in both the base
// extras file and every modular file.
//
// Codex153 — Filter also applies to MODULAR_EXTRA_TESTS so stale cases
// living in modular files (e.g. simulationPanelSoloFocusCases when Solo
// path mimarisi yenilendi) can be overridden by id without editing the
// frozen modular file. Whichever file the original case lived in, the
// override is the single source of truth.
const FILTERED_BASE_EXTRA_TESTS = BASE_EXTRA_TESTS.filter(
  (c) => !(c?.key && OVERRIDDEN_CASE_KEYS.has(c.key)),
);
const FILTERED_MODULAR_EXTRA_TESTS = MODULAR_EXTRA_TESTS.filter(
  (c) => !(c?.key && OVERRIDDEN_CASE_KEYS.has(c.key)),
);

// Aggregated outputs SimulationPanel.jsx consumes. Ordering: legacy
// social/release-risk suites first (preserves every existing suite id
// and side-panel position), then overrides, then modular additions.
export const ALL_EXTRA_SUITES = [...BASE_EXTRA_SUITES, ...MODULAR_EXTRA_SUITES];
export const ALL_EXTRA_TESTS = [
  ...FILTERED_BASE_EXTRA_TESTS,
  ...OVERRIDE_TESTS,
  ...FILTERED_MODULAR_EXTRA_TESTS,
];

// Re-export the score hooks unchanged so SimulationPanel.jsx only needs
// to import from the registry.
export { ACTION_TYPES, criticalSocialUncertaintyPenalty, criticalStaticLimitationPenalty };