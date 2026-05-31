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
// Codex123 — Phase 3 UI consolidation: lock the shared KronoxStatTile +
// shared style tokens contracts for Profile/Leaderboard so neither
// surface can silently revert to a local StatTile duplicate.
import * as uiConsolidationCases from './simulationPanelUiConsolidationCases';
// Codex127 — Online challenge flow simplification:
// kategori carousel + arkadaş popup + tek adımda lobi + davet.
import * as onlineChallengeCases from './simulationPanelOnlineChallengeCases';
// Codex128 — Online puan/checkpoint sistemi: win/loss/draw + time bonus +
// checkpoint floor + idempotent match write contracts.
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

const MODULES = [
  soloProgressCases,
  soloMapCases,
  soloFocusCases,
  soloUnlockCases,
  leaderboardCases,
  soloMapFocusCases,
  leaderboardFallbackCases,
  healthArchitectureCases,
  uiConsolidationCases,
  onlineChallengeCases,
  onlineRankingCases,
  inviteDeliveryCases,
  inviteLifecycleCases,
  lobbySimplificationCases,
  headerNotificationsCases,
  gameInviteLifecycleCases,
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
const FILTERED_BASE_EXTRA_TESTS = BASE_EXTRA_TESTS.filter(
  (c) => !(c?.key && OVERRIDDEN_CASE_KEYS.has(c.key)),
);

// Aggregated outputs SimulationPanel.jsx consumes. Ordering: legacy
// social/release-risk suites first (preserves every existing suite id
// and side-panel position), then overrides, then modular additions.
export const ALL_EXTRA_SUITES = [...BASE_EXTRA_SUITES, ...MODULAR_EXTRA_SUITES];
export const ALL_EXTRA_TESTS = [
  ...FILTERED_BASE_EXTRA_TESTS,
  ...OVERRIDE_TESTS,
  ...MODULAR_EXTRA_TESTS,
];

// Re-export the score hooks unchanged so SimulationPanel.jsx only needs
// to import from the registry.
export { ACTION_TYPES, criticalSocialUncertaintyPenalty, criticalStaticLimitationPenalty };