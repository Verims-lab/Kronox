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
import getQuestionsSource from '../../../base44/functions/getQuestions/entry.ts?raw';
import getQuestionsManifestSource from '../../../base44/functions/getQuestions/function.jsonc?raw';
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
        "GAMEPLAY_PROJECTION_VERSION = 'per_category_projection_v2'",
        'projectionDiagnostics',
        'fallbackUsed',
        'categoriesWithZeroPlayableQuestions',
      ]);
      const forbidden = forbiddenTokens(getQuestionsSource, [
        'MAX_GAMEPLAY_LIMIT = 500',
        'const KNOWN_CATEGORY_IDS = [1, 2, 3, 4, 5, 6]',
      ]);
      if (missing.length || forbidden.length) {
        return fail('getQuestions is not clearly registered/deployable with the live active-category v2 projection contract.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          files: ['base44/functions/getQuestions/entry.ts', 'base44/functions/getQuestions/function.jsonc', 'src/lib/dbGateway/questionGateway.js'],
          expected: 'callable getQuestions manifest plus v2 per-category projection diagnostics and no stale 1-6/500 cap',
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
