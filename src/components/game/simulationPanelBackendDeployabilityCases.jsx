// Kronox Health Center — Backend Function Deployability Suite.
//
// WHY THIS SUITE EXISTS
//   A serious incident: an older deployed report function imported
//   './_shared/adminAuth.js', which resolved to a file URL under /src/_shared
//   (module not found) and FAILED to deploy under the Base44 function runtime.
//   Because the deploy failed, Base44 kept serving a STALE build, so the real
//   email report was missing new sections even though local proof HTML and
//   `npm run build` (Vite frontend only) looked correct.
//
//   This suite statically guards the callable report function against that
//   class of regression:
//     • It must not import the local shared admin guard via the broken
//       './_shared/adminAuth.js' / './_shared/adminAuth.ts' form.
//     • The analytics report function must inline an AdminUser-backed guard
//       (proven deployable) and keep the full email-body report markers.
//     • Every frontend gateway invocation name maps to a real backend
//       function (no missing / stale function names).
//
//   IMPORTANT HONESTY NOTE
//     `npm run build` only validates the Vite frontend bundle. It does NOT
//     prove that Base44 backend functions deployed. Real backend deploy proof
//     (trigger the function, read its live response/markers) stays a manual
//     runtime step — represented here as a NOT_AUTOMATABLE case.

import deployedReportSource from '../../../base44/functions/sendQuestionAnalyticsReportEmail/entry.ts?raw';
import packageJsonSource from '../../../package.json?raw';
import base44FunctionCompileScriptSource from '../../../scripts/checkBase44FunctionsCompile.mjs?raw';
import adminResetUserProgressSource from '../../../base44/functions/adminResetUserProgress/entry.ts?raw';
import aggregateQuestionStatsSource from '../../../base44/functions/aggregateQuestionStats/entry.ts?raw';
import cancelStaleLobbiesSource from '../../../base44/functions/cancelStaleLobbies/entry.ts?raw';
import cleanupAdminMaintenanceLogSource from '../../../base44/functions/cleanupAdminMaintenanceLog/entry.ts?raw';
import diagnoseSoloQuestionStartQuerySource from '../../../base44/functions/diagnoseSoloQuestionStartQuery/entry.ts?raw';
import expireOldGameInvitesSource from '../../../base44/functions/expireOldGameInvites/entry.ts?raw';
import expirePushSubscriptionsSource from '../../../base44/functions/expirePushSubscriptions/entry.ts?raw';
import generateTechDocSource from '../../../base44/functions/generateTechDoc/entry.ts?raw';
import generateWorkflowDocSource from '../../../base44/functions/generateWorkflowDoc/entry.ts?raw';
import getAdminStatusSource from '../../../base44/functions/getAdminStatus/entry.ts?raw';
import getQuestionsSource from '../../../base44/functions/getQuestions/entry.ts?raw';
import getQuestionsManifestSource from '../../../base44/functions/getQuestions/function.jsonc?raw';
import createGuestProfileSource from '../../../base44/functions/createGuestProfile/entry.ts?raw';
import createGuestProfileManifestSource from '../../../base44/functions/createGuestProfile/function.jsonc?raw';
import getCategoryMetadataSource from '../../../base44/functions/getCategoryMetadata/entry.ts?raw';
import getCategoryMetadataManifestSource from '../../../base44/functions/getCategoryMetadata/function.jsonc?raw';
import linkGuestAccountSource from '../../../base44/functions/linkGuestAccount/entry.ts?raw';
import linkGuestAccountManifestSource from '../../../base44/functions/linkGuestAccount/function.jsonc?raw';
import updateProfileSettingsSource from '../../../base44/functions/updateProfileSettings/entry.ts?raw';
import updateProfileSettingsManifestSource from '../../../base44/functions/updateProfileSettings/function.jsonc?raw';
import refreshLeaderboardProjectionSource from '../../../base44/functions/refreshLeaderboardProjection/entry.ts?raw';
import resetTestAccountProgressSource from '../../../base44/functions/resetTestAccountProgress/entry.ts?raw';
import runTestSuiteSource from '../../../base44/functions/runTestSuite/entry.ts?raw';
import simulateOnlineGameSource from '../../../base44/functions/simulateOnlineGame/entry.ts?raw';
import purchaseJokerWithDiamondsSource from '../../../base44/functions/purchaseJokerWithDiamonds/entry.ts?raw';
import purchaseJokerWithDiamondsManifestSource from '../../../base44/functions/purchaseJokerWithDiamonds/function.jsonc?raw';
import createDailyQuestDefinitionSource from '../../../base44/functions/createDailyQuestDefinition/entry.ts?raw';
import createDailyQuestDefinitionManifestSource from '../../../base44/functions/createDailyQuestDefinition/function.jsonc?raw';
import getDailyQuestStatusSource from '../../../base44/functions/getDailyQuestStatus/entry.ts?raw';
import getDailyQuestStatusManifestSource from '../../../base44/functions/getDailyQuestStatus/function.jsonc?raw';
import recordDailyQuestProgressSource from '../../../base44/functions/recordDailyQuestProgress/entry.ts?raw';
import recordDailyQuestProgressManifestSource from '../../../base44/functions/recordDailyQuestProgress/function.jsonc?raw';
import claimDailyQuestRewardSource from '../../../base44/functions/claimDailyQuestReward/entry.ts?raw';
import claimDailyQuestRewardManifestSource from '../../../base44/functions/claimDailyQuestReward/function.jsonc?raw';
import cleanupGatewaySource from '../../lib/dbGateway/cleanupGateway.js?raw';
import scoringGatewaySource from '../../lib/dbGateway/scoringGateway.js?raw';
import economyGatewaySource from '../../lib/dbGateway/economyGateway.js?raw';
import dailyQuestGatewaySource from '../../lib/dbGateway/dailyQuestGateway.js?raw';
import inviteGatewaySource from '../../lib/dbGateway/inviteGateway.js?raw';
import lobbyGatewaySource from '../../lib/dbGateway/lobbyGateway.js?raw';
import leaderboardGatewaySource from '../../lib/dbGateway/leaderboardGateway.js?raw';
import questionGatewaySource from '../../lib/dbGateway/questionGateway.js?raw';
import categoryGatewaySource from '../../lib/dbGateway/categoryGateway.js?raw';
import analyticsGatewaySource from '../../lib/dbGateway/analyticsGateway.js?raw';
import jokerInventorySource from '../../lib/jokerInventory.js?raw';

const STATUS = {
  PASS: 'PASS',
  FAIL: 'FAIL',
  NOT_AUTOMATABLE: 'NOT_AUTOMATABLE',
};

const ACTION_TYPES = {
  CODE_FIX: 'CODE_FIX',
  BACKEND_RUNTIME_PROBE: 'BACKEND_RUNTIME_PROBE',
};

const SUITE_ID = 'backend_deployability_health';
const SUITE_NAME = 'Backend Function Deployability Suite';

// The known backend functions invoked by the frontend gateways. Each must
// have a matching backend implementation in functions/ (or base44/functions/).
// This is the verified frontend → backend invocation map for the dbGateway
// layer; if a gateway adds a new invoke('X', ...) it should also appear here.
const KNOWN_BACKEND_FUNCTIONS = new Set([
  'getQuestions',
  'getSoloLeaderboard',
  'getDailyWheelStatus',
  'claimDailyWheelReward',
  'purchaseJokerWithDiamonds',
  'createDailyQuestDefinition',
  'getDailyQuestStatus',
  'recordDailyQuestProgress',
  'claimDailyQuestReward',
  'findLobbyByCode',
  'startLobbyGame',
  'updateLobbyGameState',
  'refreshLeaderboardProjection',
  'aggregateQuestionStats',
  'cleanupAdminMaintenanceLog',
  'cancelStaleLobbies',
  'expireOldGameInvites',
  'expirePushSubscriptions',
  'ensureUserJokerInventory',
  'spendUserJoker',
  'sendQuestionAnalyticsReportEmail',
]);

const DEPLOY_RISK_BASE44_FUNCTIONS = [
  { name: 'adminResetUserProgress', source: adminResetUserProgressSource },
  { name: 'aggregateQuestionStats', source: aggregateQuestionStatsSource },
  { name: 'cancelStaleLobbies', source: cancelStaleLobbiesSource },
  { name: 'cleanupAdminMaintenanceLog', source: cleanupAdminMaintenanceLogSource },
  { name: 'diagnoseSoloQuestionStartQuery', source: diagnoseSoloQuestionStartQuerySource },
  { name: 'expireOldGameInvites', source: expireOldGameInvitesSource },
  { name: 'expirePushSubscriptions', source: expirePushSubscriptionsSource },
  { name: 'generateTechDoc', source: generateTechDocSource },
  { name: 'generateWorkflowDoc', source: generateWorkflowDocSource },
  { name: 'getAdminStatus', source: getAdminStatusSource },
  { name: 'getQuestions', source: getQuestionsSource },
  { name: 'refreshLeaderboardProjection', source: refreshLeaderboardProjectionSource },
  { name: 'resetTestAccountProgress', source: resetTestAccountProgressSource },
  { name: 'runTestSuite', source: runTestSuiteSource },
  { name: 'simulateOnlineGame', source: simulateOnlineGameSource },
];

const BASE44_DEPLOY_RISK_IMPORT_TOKENS = [
  '_shared/adminAuth',
  '../_shared/adminAuth',
  './_shared/adminAuth',
  'file:///__shared',
  '../_shared',
];

function text(source) {
  if (source == null) return '';
  if (typeof source === 'string') return source;
  try { return String(source); } catch { return ''; }
}

function missingTokens(source, tokens) {
  const value = text(source);
  return tokens.filter((token) => !value.includes(token));
}

function forbiddenTokens(source, tokens) {
  const value = text(source);
  return tokens.filter((token) => value.includes(token));
}

function pass(reason, extra = {}) { return { status: STATUS.PASS, reason, ...extra }; }
function fail(reason, extra = {}) { return { status: STATUS.FAIL, reason, ...extra }; }
function notAutomatable(reason, extra = {}) { return { status: STATUS.NOT_AUTOMATABLE, reason, ...extra }; }

function makeCase(id, name, run, options = {}) {
  return {
    key: `${SUITE_ID}.${id}`,
    suiteId: SUITE_ID,
    suiteName: SUITE_NAME,
    id,
    name,
    critical: options.critical ?? true,
    actionType: options.actionType || ACTION_TYPES.CODE_FIX,
    nextStep: options.nextStep
      || 'Keep deployed report functions free of broken local imports; prove real backend deploy by triggering the function and reading its live markers.',
    ...options,
    run,
  };
}

// Extract every invoke('name', ...) call from a gateway source.
function extractInvokedNames(source) {
  const value = text(source);
  const names = new Set();
  const re = /functions\.invoke\(\s*['"]([^'"]+)['"]/g;
  let match;
  while ((match = re.exec(value)) !== null) {
    if (match[1]) names.add(match[1]);
  }
  return names;
}

export const EXTRA_SUITES = [
  { id: SUITE_ID, name: SUITE_NAME, critical: true, color: '#fb7185' },
];

export const EXTRA_TESTS = [
  makeCase('base44_function_compile_gate_registered',
    'Base44 function compile/deploy gate is registered before manual deploy',
    () => {
      const missing = missingTokens(`${packageJsonSource}\n${base44FunctionCompileScriptSource}`, [
        '"check:base44-functions": "node scripts/checkBase44FunctionsCompile.mjs"',
        'walkEntryFiles(functionsDir)',
        'ts.createProgram',
        'getSyntacticDiagnostics',
        'getSemanticDiagnostics',
        'DUPLICATE_DECLARATION_CODES',
        '_shared/adminAuth',
        '../_shared',
        'file:///__shared',
        'hardcoded email literal',
        'getQuestionsRuntimeMarker',
        'requestPayload',
        'responsePayload',
        'per_category_projection_v2',
      ]);
      if (missing.length) {
        return fail('Base44 function compile/deploy gate is missing or too weak to catch dashboard deploy blockers.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          files: ['package.json', 'scripts/checkBase44FunctionsCompile.mjs'],
          expected: 'npm run check:base44-functions validates all base44/functions entry.ts files for syntax, duplicate declarations, deploy-risk imports, email literals, and getQuestions marker diagnostics',
          actual: { missing },
          actionType: ACTION_TYPES.CODE_FIX,
          nextStep: 'Wire npm run check:base44-functions into pre-deploy validation before Base44 Save & Deploy.',
        });
      }
      return pass('Base44 function compile/deploy gate is registered and checks function syntax, duplicate declarations, deploy-risk imports, email literals, and getQuestions markers.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        files: ['package.json', 'scripts/checkBase44FunctionsCompile.mjs'],
      });
    }),

  makeCase('critical_base44_functions_have_no_shared_admin_auth_imports',
    'Critical Base44 functions have no deploy-risk shared adminAuth imports',
    () => {
      const offenders = DEPLOY_RISK_BASE44_FUNCTIONS
        .map((fn) => {
          const found = forbiddenTokens(fn.source, BASE44_DEPLOY_RISK_IMPORT_TOKENS);
          return found.length ? { function: fn.name, found } : null;
        })
        .filter(Boolean);
      if (offenders.length) {
        return fail('A critical Base44 function still contains a shared adminAuth import/path that may not be bundled during deploy.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          files: DEPLOY_RISK_BASE44_FUNCTIONS.map((fn) => `base44/functions/${fn.name}/entry.ts`),
          expected: 'self-contained function bundle or an explicitly proven deploy-safe import; no _shared/adminAuth / ../_shared / file:///__shared references',
          actual: { offenders },
          actionType: ACTION_TYPES.CODE_FIX,
          nextStep: 'Inline the AdminUser guard in the affected function or prove the import is bundled by Base44 before deployment.',
        });
      }
      return pass('Critical Base44 functions are free of shared adminAuth deploy-risk imports.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        files: DEPLOY_RISK_BASE44_FUNCTIONS.map((fn) => `base44/functions/${fn.name}/entry.ts`),
      });
    }),

  makeCase('base44_function_auth_model_is_guard_based',
    'Base44 function auth model is guard-based, not unsupported manifest fields',
    () => {
      const manifestCombined = [
        createGuestProfileManifestSource,
        getCategoryMetadataManifestSource,
        getQuestionsManifestSource,
        linkGuestAccountManifestSource,
        updateProfileSettingsManifestSource,
        purchaseJokerWithDiamondsManifestSource,
        createDailyQuestDefinitionManifestSource,
        getDailyQuestStatusManifestSource,
        recordDailyQuestProgressManifestSource,
        claimDailyQuestRewardManifestSource,
      ].map(text).join('\n');
      const sourceCombined = [
        createGuestProfileSource,
        getCategoryMetadataSource,
        getQuestionsSource,
        linkGuestAccountSource,
        updateProfileSettingsSource,
        purchaseJokerWithDiamondsSource,
        createDailyQuestDefinitionSource,
        deployedReportSource,
      ].map(text).join('\n');
      const manifestMissing = missingTokens(manifestCombined, [
        '"name": "createGuestProfile"',
        '"name": "getCategoryMetadata"',
        '"name": "getQuestions"',
        '"name": "linkGuestAccount"',
        '"name": "updateProfileSettings"',
        '"entry": "entry.ts"',
      ]);
      const unsupportedManifestFields = forbiddenTokens(manifestCombined, [
        'requireAuth',
        'authRequired',
        'allowUnauthenticated',
        '"public"',
        '"auth"',
        '"permissions"',
      ]);
      const guardMissing = missingTokens(sourceCombined, [
        'Public by design: first-open guest onboarding',
        'Public by design: guest onboarding category selection',
        'guestCallableWithoutLogin: true',
        'base44.auth.me()',
        'guest_id',
        'guest_token',
        'function requireAdmin(base44)',
        'entities?.AdminUser',
        'requestBodyTrustedForIdentity: false',
        'if (needsAdmin && !isAdmin)',
      ]);
      if (manifestMissing.length || unsupportedManifestFields.length || guardMissing.length) {
        return fail('Base44 function auth/public model is stale or assumes unsupported manifest auth fields.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          files: [
            'base44/functions/*/function.jsonc',
            'base44/functions/createGuestProfile/entry.ts',
            'base44/functions/getCategoryMetadata/entry.ts',
            'base44/functions/getQuestions/entry.ts',
            'base44/functions/linkGuestAccount/entry.ts',
            'base44/functions/updateProfileSettings/entry.ts',
            'base44/functions/sendQuestionAnalyticsReportEmail/entry.ts',
          ],
          expected: 'function.jsonc uses supported name/entry only; public-by-design functions are narrow; user/admin functions enforce auth in entry.ts guards',
          actual: { manifestMissing, unsupportedManifestFields, guardMissing },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Base44 function manifests stay name/entry-only while public, user-owned, and admin-only boundaries are enforced by entry.ts guards.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
      });
    }),

  makeCase('deployed_report_has_no_broken_local_import',
    'Deployed analytics report function has no broken local _shared import',
    () => {
      const src = text(deployedReportSource);
      // The exact broken pattern that caused the stale-deploy incident, plus
      // the relative variants that also fail in the report runtime.
      const forbidden = forbiddenTokens(src, [
        "from './_shared/adminAuth.js'",
        "from './_shared/adminAuth.ts'",
        "from '../_shared/adminAuth.js'",
        "from '../_shared/adminAuth.ts'",
        "from '/src/_shared/adminAuth",
        'file://' + '/src/_shared/adminAuth',
      ]);
      if (forbidden.length) {
        return fail('Deployed report function still imports the local shared admin guard, which can break Base44 deployment.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'base44/functions/sendQuestionAnalyticsReportEmail/entry.ts',
          expected: 'inline AdminUser-backed guard; no local _shared import in the callable report path',
          actual: { foundForbidden: forbidden },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Deployed report function has no broken local _shared import in the callable path.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        file: 'base44/functions/sendQuestionAnalyticsReportEmail/entry.ts',
      });
    }),

  makeCase('deployed_report_inlines_admin_user_guard',
    'Deployed analytics report function inlines a DB-backed AdminUser guard',
    () => {
      const required = [
        'function requireAdmin(base44)',
        'getAdminAuthorization',
        'entities?.AdminUser',
        "value === 'owner' || value === 'admin'",
        'isActiveStatus',
        'Admin access required',
        'requireAdmin(base44)',
        'if (admin.response) return admin.response',
      ];
      const missing = missingTokens(deployedReportSource, required);
      // Ensure the guard actually runs before the report work (auth boundary).
      const guardIdx = text(deployedReportSource).indexOf('requireAdmin(base44)');
      const sendIdx = text(deployedReportSource).indexOf('Core.SendEmail');
      const guardBeforeSend = guardIdx >= 0 && (sendIdx < 0 || guardIdx < sendIdx);
      if (missing.length || !guardBeforeSend) {
        return fail('Deployed report function admin guard is missing, not DB-backed, or runs after report work.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'base44/functions/sendQuestionAnalyticsReportEmail/entry.ts',
          expected: 'inline AdminUser-backed requireAdmin returning 403 before SendEmail',
          actual: { missing, guardBeforeSend },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Deployed report function authorizes admins from an inline DB-backed AdminUser guard before doing any report work.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        file: 'base44/functions/sendQuestionAnalyticsReportEmail/entry.ts',
      });
    }),

  makeCase('deployed_report_keeps_full_email_report_markers',
    'Deployed analytics report function keeps exact nine-section email-body markers and diagnostics',
    () => {
      const required = [
        'REPORT_TEMPLATE_VERSION = "nine-section-email-v1"',
        'bodyContainsExecutiveSummary',
        'bodyContainsNineRequiredSections',
        'bodyContainsExactlyRequiredSections',
        'requiredSectionOrderValid',
        'renderedSectionHeaderCount',
        'bodyRemovedSectionsPresent',
        'report_body_validation_failed',
        'emailBodyMode: "nine_section_email_body"',
        'reportDeliveryMode: "email_body_only"',
        'missingBodySections',
        'bodyLength',
        'Executive Summary',
        'Kategori Bazında Soru Havuzu',
        'Kategori Tercihleri',
        'Kategori Bazında Gösterim',
        'En Çok Gösterilen Sorular',
        'Az ya da Hiç Gösterilmeyen Sorular',
        'En Çok Yanlış Yapılan Sorular',
        'Joker Kullanımı Analizi',
        'Oynanma Zamanı ve Kullanım Ritmi',
        'Joker Tipi Özeti',
        'Saat Bazında Oynanma',
        'body: emailHtml',
        'html: emailHtml',
      ];
      const missing = missingTokens(deployedReportSource, required);
      const forbidden = forbiddenTokens(deployedReportSource, [
        'PDF Eki',
        'Detaylı rapor PDF olarak ekte yer almaktadır',
        'PDF_ATTACHMENT_CONTENT_TYPE',
        'buildQuestionAnalyticsPdfAttachment',
        'buildSendEmailAttachmentPayload',
        'attachments: emailAttachments',
        'application/pdf',
        'pdfGenerated',
        'attachmentCount',
        'emailBodyMode: "full_product_intelligence_email"',
        'bodyContainsProductIntelligenceSections',
        'safeSectionHtml("Solo Soru Algoritması İçin Sinyaller"',
        'safeSectionHtml("Doğru Soru Tiplerini Öğrenme',
        'safeSectionHtml("Daha Uzun Oynama',
        'safeSectionHtml("Önerilen Aksiyonlar"',
        'safeSectionHtml("Data Quality / Eksik Ölçüm"',
      ]);
      const emailOrderOk = text(deployedReportSource).indexOf('safeSectionHtml("Executive Summary"') >= 0
        && text(deployedReportSource).indexOf('safeSectionHtml("Kategori Bazında Soru Havuzu"') > text(deployedReportSource).indexOf('safeSectionHtml("Executive Summary"')
        && text(deployedReportSource).indexOf('safeSectionHtml("Oynanma Zamanı ve Kullanım Ritmi"') > text(deployedReportSource).indexOf('safeSectionHtml("Joker Kullanımı Analizi"');
      if (missing.length || forbidden.length || !emailOrderOk) {
        return fail('Deployed report function lost the exact nine-section email-body markers or restored the attachment/old section contract.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'base44/functions/sendQuestionAnalyticsReportEmail/entry.ts',
          expected: 'nine-section-email-v1 markers + exact nine report sections + no attachment payload',
          actual: { missing, forbidden, emailOrderOk },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Deployed report function keeps exact nine-section email-body markers, body diagnostics, and no attachment requirement.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        file: 'base44/functions/sendQuestionAnalyticsReportEmail/entry.ts',
      });
    }),

  makeCase('frontend_invocations_map_to_known_backend_functions',
    'Every frontend gateway invoke() name maps to a known backend function',
    () => {
      const gatewaySources = [
        cleanupGatewaySource,
        scoringGatewaySource,
        economyGatewaySource,
        dailyQuestGatewaySource,
        inviteGatewaySource,
        lobbyGatewaySource,
        leaderboardGatewaySource,
        questionGatewaySource,
        categoryGatewaySource,
        analyticsGatewaySource,
        jokerInventorySource,
      ];
      const invoked = new Set();
      for (const src of gatewaySources) {
        for (const name of extractInvokedNames(src)) invoked.add(name);
      }
      const unknown = Array.from(invoked).filter((name) => !KNOWN_BACKEND_FUNCTIONS.has(name));
      if (unknown.length) {
        return fail('A frontend gateway invokes a backend function name that is not in the known backend function map.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'src/lib/dbGateway/*.js',
          expected: 'every functions.invoke("X") name maps to a real deployed backend function',
          actual: { invoked: Array.from(invoked), unknown },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('All dbGateway invoke() names map to known backend functions; no missing/stale function name.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actual: { invoked: Array.from(invoked) },
      });
    }),

  makeCase('get_questions_backend_function_deployable_contract',
    'getQuestions backend function is registered and deployable with the v2 projection contract',
    () => {
      const missing = missingTokens(`${getQuestionsSource}\n${getQuestionsManifestSource}\n${questionGatewaySource}`, [
        '"name": "getQuestions"',
        '"entry": "entry.ts"',
        "base44.functions.invoke('getQuestions'",
        'GET_QUESTIONS_RUNTIME_CONTRACT_VERSION',
        'GET_QUESTIONS_RUNTIME_MARKER',
        'getQuestions-live-per-category-v7-Codex343',
        'getQuestionsRuntimeMarker',
        'requestPayload',
        'responsePayload',
        'pong: true',
        'functionContractVersion',
        'includeDiagnostics',
        "GAMEPLAY_PROJECTION_VERSION = 'per_category_projection_v2'",
        'MAX_AUTH_GAMEPLAY_RESPONSE_LIMIT = 96',
        'SERVER_ATTEMPT_SELECTION_MODE',
        'server_attempt_candidate_buffer_v1',
        'sourcePoolCapRemoved',
        'responseCapApplied',
        'projectionDiagnostics',
        'buildProjectionDiagnostics',
        'buildServerAttemptCandidateBuffer',
        'filterSoloAttemptCandidatePool',
        'SELECTED_CATEGORY_LANE_DIFFICULTIES',
        'GLOBAL_FALLBACK_LANE_DIFFICULTIES',
        'GUEST_PRIMARY_DIFFICULTIES',
        'selectedDeckCountsByDifficulty',
        'eligibleQuestionCountByDifficulty',
        'Category.list',
        'loadActiveQuestionCandidates',
        'fetchQuestionRowsForCategory',
        "getServiceEntity(base44, 'Question')",
        "getServiceEntity(base44, 'Category')",
        'service_entity_unavailable',
        'base44_client_create_failed',
        'req.clone().json()',
        '.filter(descriptor.filters',
        'projectionCappedBeforeCategoryCoverage: false',
        'fallbackUsed',
        'categoriesWithZeroPlayableQuestions',
        'CATEGORY_METADATA_POLICY',
        'legacyHardcodedCategoryFallbackAllowed: false',
        'staleCategoryFallbackUsed: false',
      ]);
      const forbidden = forbiddenTokens(getQuestionsSource, [
        'MAX_GAMEPLAY_LIMIT = 1200',
        'MAX_GAMEPLAY_LIMIT = 500',
        'const KNOWN_CATEGORY_IDS = [1, 2, 3, 4, 5, 6]',
        'FALLBACK_ACTIVE_CATEGORY_IDS',
        'fallback_active_category_ids',
        'ONLINE_ID_TO_MAIN_CATEGORY_ID',
        'FALLBACK_ACTIVE_CATEGORY_IDS = [1, 2, 3, 4, 5, 6]',
        'const payload = await req.json().catch',
        'const payload: Record<string, unknown>',
        'Question.list(\'-created_date\', 500)',
        'Question.list("-created_date", 500)',
        'projectionCappedBeforeCategoryCoverage: true',
      ]);
      if (missing.length || forbidden.length) {
        return fail('getQuestions is not clearly registered/deployable with the live active-category v2 projection contract.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          files: ['base44/functions/getQuestions/entry.ts', 'base44/functions/getQuestions/function.jsonc', 'src/lib/dbGateway/questionGateway.js'],
          expected: 'callable getQuestions manifest plus v2 per-category bounded server attempt response diagnostics and no stale 1-6/500/1200 cap',
          actual: { missing, forbidden },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('getQuestions is registered with a callable manifest and carries the v2 active-category projection contract.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
      });
    }),

  makeCase('purchase_joker_backend_function_deployable_contract',
    'purchaseJokerWithDiamonds backend function is registered and deployable',
    () => {
      const missing = missingTokens(`${purchaseJokerWithDiamondsSource}\n${purchaseJokerWithDiamondsManifestSource}\n${economyGatewaySource}`, [
        '"name": "purchaseJokerWithDiamonds"',
        '"entry": "entry.ts"',
        "base44.functions.invoke('purchaseJokerWithDiamonds'",
        'createClientFromRequest',
        'Deno.serve',
        'base44.auth.me()',
        'entities.UserJokerInventory',
        'entities.DiamondTransaction',
        'entities.JokerTransaction',
      ]);
      const forbidden = forbiddenTokens(purchaseJokerWithDiamondsSource, [
        "from './_shared",
        "from '../_shared",
        'file://' + '/src/_shared',
      ]);
      if (missing.length || forbidden.length) {
        return fail('purchaseJokerWithDiamonds is not clearly registered/deployable or has broken local imports.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          files: ['base44/functions/purchaseJokerWithDiamonds/entry.ts', 'base44/functions/purchaseJokerWithDiamonds/function.jsonc', 'src/lib/dbGateway/economyGateway.js'],
          actual: { missing, forbidden },
        });
      }
      return pass('purchaseJokerWithDiamonds is a registered Base44 callable function with no broken local imports.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
      });
    }),

  makeCase('purchase_joker_backend_auth_service_role_scope',
    'purchaseJokerWithDiamonds validates auth and keeps economy writes user-bound',
    () => {
      const missing = missingTokens(purchaseJokerWithDiamondsSource, [
        'base44.auth.me()',
        'const email = normalizeEmail(user?.email)',
        'user_email: email',
        'entities.UserJokerInventory',
        'entities.DiamondTransaction',
        'entities.JokerTransaction',
        'updateCurrentUser(base44',
        'base44.auth.updateMe',
      ]);
      const forbidden = forbiddenTokens(purchaseJokerWithDiamondsSource, [
        'body?.email',
        'body?.user_email',
        'body?.userId',
        'body?.price',
        'body?.diamondCost',
      ]);
      if (missing.length || forbidden.length) {
        return fail('purchaseJokerWithDiamonds service-role/auth scope can drift from authenticated-user-owned writes.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'base44/functions/purchaseJokerWithDiamonds/entry.ts',
          actual: { missing, forbidden },
        });
      }
      return pass('purchaseJokerWithDiamonds scopes economy writes to the authenticated user and backend price table, with service-role/auth entity fallback.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
      });
    }),

  makeCase('daily_quest_definition_backend_function_deployable_contract',
    'createDailyQuestDefinition backend function is registered and deployable',
    () => {
      const missing = missingTokens(`${createDailyQuestDefinitionSource}\n${createDailyQuestDefinitionManifestSource}\n${dailyQuestGatewaySource}`, [
        '"name": "createDailyQuestDefinition"',
        '"entry": "entry.ts"',
        "base44.functions.invoke('createDailyQuestDefinition'",
        'createClientFromRequest',
        'Deno.serve',
        'base44.auth.me()',
        'entities?.AdminUser',
        'entities?.DailyQuestDefinition',
      ]);
      const forbidden = forbiddenTokens(createDailyQuestDefinitionSource, [
        "from './_shared",
        "from '../_shared",
        'file://' + '/src/_shared',
      ]);
      if (missing.length || forbidden.length) {
        return fail('createDailyQuestDefinition is not clearly registered/deployable or has broken local imports.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          files: ['base44/functions/createDailyQuestDefinition/entry.ts', 'base44/functions/createDailyQuestDefinition/function.jsonc', 'src/lib/dbGateway/dailyQuestGateway.js'],
          actual: { missing, forbidden },
        });
      }
      return pass('createDailyQuestDefinition is a registered Base44 callable function with no broken local imports.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
      });
    }),

  makeCase('daily_quest_definition_backend_admin_scope',
    'createDailyQuestDefinition uses AdminUser-backed admin authorization',
    () => {
      const missing = missingTokens(createDailyQuestDefinitionSource, [
        'function requireAdmin(base44)',
        'getAdminAuthorization',
        'entities?.AdminUser',
        "value === 'owner' || value === 'admin'",
        'isActiveStatus',
        'Admin yetkisi gerekli.',
        'requireAdmin(base44)',
        'if (admin.response) return admin.response',
        'created_by: admin.adminEmail',
        'updated_by: admin.adminEmail',
      ]);
      const forbidden = forbiddenTokens(createDailyQuestDefinitionSource, [
        'body?.adminEmail',
        'body?.user_email',
        'hardcoded',
      ]);
      if (missing.length || forbidden.length) {
        return fail('createDailyQuestDefinition admin guard can drift from the AdminUser-backed contract.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'base44/functions/createDailyQuestDefinition/entry.ts',
          actual: { missing, forbidden },
        });
      }
      return pass('createDailyQuestDefinition authorizes active owner/admin AdminUser rows before list/create/status writes.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
      });
    }),

  makeCase('daily_quest_runtime_backend_functions_deployable_contract',
    'Daily Quest runtime backend functions are registered and deployable',
    () => {
      const combined = [
        getDailyQuestStatusSource,
        getDailyQuestStatusManifestSource,
        recordDailyQuestProgressSource,
        recordDailyQuestProgressManifestSource,
        claimDailyQuestRewardSource,
        claimDailyQuestRewardManifestSource,
        dailyQuestGatewaySource,
      ].join('\n');
      const missing = missingTokens(combined, [
        '"name": "getDailyQuestStatus"',
        '"name": "recordDailyQuestProgress"',
        '"name": "claimDailyQuestReward"',
        "base44.functions.invoke('getDailyQuestStatus'",
        "base44.functions.invoke('recordDailyQuestProgress'",
        "base44.functions.invoke('claimDailyQuestReward'",
        'createClientFromRequest',
        'Deno.serve',
        'base44.auth.me()',
        'entities.UserDailyQuestProgress',
        'entities.DailyQuestDefinition',
        'entities.DiamondTransaction',
        'daily_quest_reward',
      ]);
      const forbidden = forbiddenTokens(`${getDailyQuestStatusSource}\n${recordDailyQuestProgressSource}\n${claimDailyQuestRewardSource}`, [
        "from './_shared",
        "from '../_shared",
        'file://' + '/src/_shared',
        'kronox_puan_total',
        'SoloLeaderboardEntry',
      ]);
      if (missing.length || forbidden.length) {
        return fail('Daily Quest runtime functions are not clearly registered/deployable or can drift into score/leaderboard writes.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          files: [
            'base44/functions/getDailyQuestStatus/entry.ts',
            'base44/functions/recordDailyQuestProgress/entry.ts',
            'base44/functions/claimDailyQuestReward/entry.ts',
            'src/lib/dbGateway/dailyQuestGateway.js',
          ],
          actual: { missing, forbidden },
        });
      }
      return pass('Daily Quest runtime functions are registered callable Base44 functions with no broken local imports and Diamond-only claim source.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
      });
    }),

  makeCase('npm_build_is_not_backend_deploy_proof',
    'Backend deploy proof is manual: npm run build only validates the Vite frontend',
    () => notAutomatable(
      'npm run build validates only the Vite frontend bundle and does NOT prove Base44 backend functions deployed. Real backend deploy proof requires triggering the function and reading its live response/markers (e.g. sendQuestionAnalyticsReportEmail must return templateVersion: nine-section-email-v1, emailBodyMode: nine_section_email_body, reportDeliveryMode: email_body_only, bodyContainsExactlyRequiredSections true, requiredSectionOrderValid true, renderedSectionHeaderCount 9, and bodyLength > 1000). Do this manually in a safe/admin context before release.',
      {
        verification: 'BACKEND_RUNTIME_PROBE',
        actionType: ACTION_TYPES.BACKEND_RUNTIME_PROBE,
        nextStep: 'As admin, trigger sendQuestionAnalyticsReportEmail and confirm templateVersion=nine-section-email-v1, emailBodyMode=nine_section_email_body, reportDeliveryMode=email_body_only, exactly nine required sections are present in order, removed sections are absent, Joker/time sections have tables, and the received email body is useful without an attachment.',
      },
    ),
    { critical: true, actionType: ACTION_TYPES.BACKEND_RUNTIME_PROBE, runtimeProofRequired: true }),
];
