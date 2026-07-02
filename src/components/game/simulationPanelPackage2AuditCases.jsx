// Kronox Health Center — Package 2 audit-fix contracts.
//
// These cases lock the cross-cutting Package 1 audit findings that span
// multiple older suites. Runtime/two-account/device proofs remain manual.

// In-/src sources stay as real ?raw imports.
import gameSource from '../../pages/Game.jsx?raw';
import categoryFiltersSource from '../../lib/categoryFilters.js?raw';
import applyOnlineResultSource from '../../lib/applyOnlineResult.js?raw';
import diamondEconomySource from '../../lib/diamondEconomy.js?raw';
import rankingSectionSource from '../leaderboard/KronoxRankingSection.jsx?raw';
// Out-of-/src sources (base44/* and docs/*) cannot be ?raw-imported on this
// host — they are mirrored as JS strings to keep the build healthy.
import {
  startLobbyGameSource,
  getSoloLeaderboardSource,
  userEntitySource,
  SOLO_QUESTION_ENGINE_DOC as soloQuestionDocSource,
  CATEGORY_TAXONOMY_DOC as categoryTaxonomyDocSource,
  RELEASE_PROOF_CHECKLIST_DOC as releaseChecklistDocSource,
} from '@/lib/package2DocMirrors';

const STATUS = { PASS: 'PASS', FAIL: 'FAIL', NOT_AUTOMATABLE: 'NOT_AUTOMATABLE' };
const ACTION_TYPES = { CODE_FIX: 'CODE_FIX', HUMAN_RUNTIME_PROOF: 'HUMAN_RUNTIME_PROOF' };
const SUITE_ID = 'package2_audit_fix_health';
const SUITE_NAME = 'Package 2 Audit Fix Suite';

function makeCase(id, name, run, options = {}) {
  return {
    key: `${SUITE_ID}.${id}`,
    suiteId: SUITE_ID,
    suiteName: SUITE_NAME,
    id,
    name,
    critical: options.critical ?? true,
    actionType: options.actionType || ACTION_TYPES.CODE_FIX,
    nextStep: options.nextStep || 'Complete the Package 2 audit fix contract.',
    ...options,
    run,
  };
}

function pass(reason, extra = {}) { return { status: STATUS.PASS, reason, ...extra }; }
function fail(reason, extra = {}) { return { status: STATUS.FAIL, reason, ...extra }; }
function notAutomatable(reason, extra = {}) { return { status: STATUS.NOT_AUTOMATABLE, reason, ...extra }; }
function safeStr(value) { return String(value || ''); }
function missingTokens(source, tokens) {
  const src = safeStr(source);
  return tokens.filter((token) => !src.includes(token));
}

export const EXTRA_SUITES = [
  { id: SUITE_ID, name: SUITE_NAME, critical: true, color: '#38bdf8' },
];

export const EXTRA_TESTS = [
  makeCase('solo_runtime_passes_active_category_whitelist',
    'Game.jsx passes active category whitelist into Solo deck engine',
    () => {
      const missing = missingTokens(gameSource, [
        'activeCategoryIds',
        'allowedMainCategoryIds: activeCategoryIds',
        'buildSoloAttemptDeck',
      ]);
      if (missing.length) {
        return fail('Solo runtime can still skip active-category enforcement.', {
          verification: 'STATIC_CONTRACT',
          file: 'src/pages/Game.jsx',
          missing,
        });
      }
      return pass('Solo runtime wires active category IDs into buildSoloAttemptDeck.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('category_id_is_canonical_with_import_alias_only',
    'category_id is canonical; categoryid exists only as import alias normalization',
    () => {
      const missing = missingTokens(`${categoryFiltersSource}\n${categoryTaxonomyDocSource}`, [
        'CATEGORY_ID_FIELD',
        'CATEGORY_IMPORT_ALIAS_FIELD',
        'categoryid -> category_id',
        'Do not create competing live DB fields',
      ]);
      if (missing.length) {
        return fail('Category ID canonical/import-alias contract is incomplete.', {
          verification: 'STATIC_CONTRACT',
          file: 'src/lib/categoryFilters.js + docs/KRONOX_CATEGORY_TAXONOMY.md',
          missing,
        });
      }
      return pass('category_id is documented and implemented as the canonical field with categoryid as import alias only.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('online_start_strict_active_selected_questions',
    'startLobbyGame filters active questions/categories and has no all-category fallback',
    () => {
      const missing = missingTokens(startLobbyGameSource, [
        'isActiveQuestion',
        'loadActiveMainCategoryIds',
        'hasSelectedCategoryIds',
        'return []',
        'Seçilen kategoriler için yeterli aktif soru bulunamadı.',
        'insufficient_active_questions_for_selected_categories',
      ]);
      const forbidden = [
        'Last-resort fallback',
      ].filter((token) => safeStr(startLobbyGameSource).includes(token));
      if (missing.length || forbidden.length) {
        return fail('startLobbyGame still permits inactive or wrong-category question start.', {
          verification: 'STATIC_CONTRACT',
          file: 'base44/functions/startLobbyGame/entry.ts',
          actual: { missing, forbidden },
        });
      }
      return pass('startLobbyGame uses active-only strict selected category filtering and safe content error.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('start_lobby_game_requires_authenticated_host',
    'startLobbyGame requires authenticated host and has no guest-host fallback',
    () => {
      const src = safeStr(startLobbyGameSource);
      const missing = missingTokens(src, [
        'await base44.auth.me()',
        'Oturum gerekli.',
        'unauthenticated',
        '401',
        'authenticatedHost',
        'Sadece host oyunu baslatabilir.',
        '403',
      ]);
      const forbidden = ['guestHost', 'startsWith(\'guest_\')', 'body?.playerEmail', 'body?.email']
        .filter((token) => src.includes(token));
      if (missing.length || forbidden.length) {
        return fail('startLobbyGame auth/host authorization contract is incomplete.', {
          verification: 'STATIC_CONTRACT',
          file: 'base44/functions/startLobbyGame/entry.ts',
          actual: { missing, forbidden },
        });
      }
      return pass('startLobbyGame fails closed on missing auth and only the authenticated host can start.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('online_score_audit_reserved_before_visible_score',
    'Online score creates durable audit/idempotency row before visible score write',
    () => {
      const src = safeStr(applyOnlineResultSource);
      const fnStart = src.indexOf('export async function applyOnlineMatchToCurrentUser');
      const applySource = fnStart >= 0 ? src.slice(fnStart) : src;
      const auditIndex = applySource.indexOf('const onlineMatchResult = await createOnlineMatchResult');
      // Codex170 — apply path persists the single prepared unified payload
      // via `await base44.auth.updateMe(payload)`; the durable
      // OnlineMatchResult reservation must come BEFORE that visible write.
      const updateIndex = applySource.indexOf('await base44.auth.updateMe(payload)');
      const missing = missingTokens(applyOnlineResultSource, [
        'OnlineMatchResult audit reservation failed; score not applied',
        'buildOnlineMatchResultIdempotencyKey',
        'idempotency_key',
        'where: \'audit\'',
        'reconciled_from_audit',
        'kronox_puan_total',
      ]);
      if (missing.length || auditIndex < 0 || updateIndex < 0 || auditIndex > updateIndex) {
        return fail('Online score can still write visible score before durable idempotency reservation.', {
          verification: 'STATIC_CONTRACT',
          file: 'src/lib/applyOnlineResult.js',
          actual: { missing, auditIndex, updateIndex },
        });
      }
      return pass('Online score reserves OnlineMatchResult before updateMe and keeps reconciliation path.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('diamond_ledger_guard_recovery_exists',
    'Diamond economy detects and repairs guard/ledger mismatch without regranting',
    () => {
      const missing = missingTokens(diamondEconomySource, [
        'recoverMissingDiamondTransaction',
        'recoverUserGuardFromTransaction',
        'ledgerRecoveredFromGuard',
        'guardRecoveredFromTransaction',
        'already_recorded',
      ]);
      if (missing.length) {
        return fail('Diamond idempotency lacks guard/ledger recovery helpers.', {
          verification: 'STATIC_CONTRACT',
          file: 'src/lib/diamondEconomy.js',
          missing,
        });
      }
      return pass('Diamond economy has retry-safe guard/ledger recovery paths.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('leaderboard_uses_persisted_unified_projection_and_no_email',
    'Leaderboard uses persisted unified score projection and does not expose raw email',
    () => {
      const missing = missingTokens(`${userEntitySource}\n${getSoloLeaderboardSource}`, [
        'kronox_puan_total',
        'user_kronox_puan_total_projection',
        'computedTotalKronoxScore',
        "User.list('-kronox_puan_total'",
        'backfillKronoxPuanProjection',
      ]);
      const forbidden = [
        'user_email: normalizeEmail',
        "User.list('-updated_date'",
      ].filter((token) => safeStr(getSoloLeaderboardSource).includes(token));
      if (missing.length || forbidden.length) {
        return fail('Leaderboard persisted-score/privacy contract drifted.', {
          verification: 'STATIC_CONTRACT',
          file: 'base44/functions/getSoloLeaderboard/entry.ts + base44/entities/User.jsonc',
          actual: { missing, forbidden },
        });
      }
      return pass('Leaderboard projection prefers User.kronox_puan_total and omits raw user_email.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('visible_level_copy_uses_seviye',
    'Visible leaderboard ranking copy uses Seviye, not Level',
    () => {
      const forbidden = ['Level {level}', 'Level {row.summary.currentLevel}']
        .filter((token) => safeStr(rankingSectionSource).includes(token));
      if (forbidden.length) {
        return fail('Visible leaderboard ranking copy still leaks Level wording.', {
          verification: 'STATIC_CONTRACT',
          file: 'src/components/leaderboard/KronoxRankingSection.jsx',
          forbidden,
        });
      }
      return pass('Visible leaderboard ranking copy uses Seviye.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('package2_docs_exist',
    'Package 2 docs exist for Solo engine, category taxonomy, and release proof',
    () => {
      const missing = missingTokens(`${soloQuestionDocSource}\n${categoryTaxonomyDocSource}\n${releaseChecklistDocSource}`, [
        '18-question deck',
        '21-question deck',
        'first 5 ordered questions',
        'categoryid -> category_id',
        'Question.state === "A"',
        'Online Scoring Persistence',
        'RLS And Backend Security',
      ]);
      if (missing.length) {
        return fail('Package 2 documentation is missing required release/audit contracts.', {
          verification: 'STATIC_CONTRACT',
          file: 'docs/KRONOX_SOLO_QUESTION_ENGINE.md + docs/KRONOX_CATEGORY_TAXONOMY.md + docs/KRONOX_RELEASE_PROOF_CHECKLIST.md',
          missing,
        });
      }
      return pass('Package 2 docs cover Solo engine, category taxonomy/import boundary, and release proof checklist.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('runtime_release_proofs_remain_manual',
    'Two-account/mobile/RLS release proofs remain manual unless a real harness is added',
    () => notAutomatable('Static source can verify contracts, but two-account invite/scoring, PWA push, mobile safe-area, and RLS probes still require manual or backend runtime proof.', {
      verification: 'NOT_AUTOMATABLE',
      actionType: ACTION_TYPES.HUMAN_RUNTIME_PROOF,
      file: 'docs/KRONOX_RELEASE_PROOF_CHECKLIST.md',
    }),
    { actionType: ACTION_TYPES.HUMAN_RUNTIME_PROOF, runtimeProofRequired: true }),
];
