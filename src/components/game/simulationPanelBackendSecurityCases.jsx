// Kronox Health Center — Backend Security Contracts.
//
// Scope: static contracts for admin-only backend functions. Runtime auth
// probes still require real unauthenticated/non-admin/admin sessions.

import generateTechDocSource from '../../../base44/functions/generateTechDoc/entry.ts?raw';
import adminAuthSource from '../../../base44/functions/_shared/adminAuth.ts?raw';
import getQuestionsSource from '../../../base44/functions/getQuestions/entry.ts?raw';
import purchaseJokerWithDiamondsSource from '../../../base44/functions/purchaseJokerWithDiamonds/entry.ts?raw';
import recordDailyQuestProgressSource from '../../../base44/functions/recordDailyQuestProgress/entry.ts?raw';
import claimDailyQuestRewardSource from '../../../base44/functions/claimDailyQuestReward/entry.ts?raw';
import sendGameInvitePushSource from '../../../base44/functions/sendGameInvitePush/entry.ts?raw';
import questionEntitySource from '../../../base44/entities/Question.jsonc?raw';
import useOfflineQuestionsSource from '../../hooks/useOfflineQuestions.js?raw';
import notificationApiSource from '../../lib/notificationApi.js?raw';
import adminPageSource from '../../pages/AdminPage.jsx?raw';

const STATUS = {
  PASS: 'PASS',
  FAIL: 'FAIL',
  NOT_AUTOMATABLE: 'NOT_AUTOMATABLE',
};

const ACTION_TYPES = {
  CODE_FIX: 'CODE_FIX',
  BACKEND_RUNTIME_PROBE: 'BACKEND_RUNTIME_PROBE',
};

const SUITE_ID = 'backend_security_health';
const SUITE_NAME = 'Backend Security Health Suite';

function makeCase(id, name, run, options = {}) {
  return {
    key: `${SUITE_ID}.${id}`,
    suiteId: SUITE_ID,
    suiteName: SUITE_NAME,
    id,
    name,
    critical: options.critical ?? true,
    ...options,
    run,
  };
}

function pass(reason, extra) { return { status: STATUS.PASS, reason, ...(extra || {}) }; }
function fail(reason, extra) { return { status: STATUS.FAIL, reason, ...(extra || {}) }; }
function notAutomatable(reason, extra) {
  return { status: STATUS.NOT_AUTOMATABLE, reason, ...(extra || {}) };
}

function missingTokens(source, tokens) {
  return tokens.filter((token) => !String(source || '').includes(token));
}

function presentTokens(source, tokens) {
  return tokens.filter((token) => String(source || '').includes(token));
}

export const EXTRA_SUITES = [
  {
    id: SUITE_ID,
    name: SUITE_NAME,
    critical: true,
    color: '#f97316',
  },
];

export const EXTRA_TESTS = [
  makeCase('generate_tech_doc_requires_server_auth',
    'generateTechDoc authenticates server-side before generating internal docs',
    () => {
      const required = [
        'requireAdmin',
        '../_shared/adminAuth.ts',
        'base44.auth.me()',
        '401',
        'if (auth.response) return auth.response',
        'PDFDocument.create()',
      ];
      const combined = `${generateTechDocSource}\n${adminAuthSource}`;
      const missing = missingTokens(combined, required);
      const guardBeforePdf = generateTechDocSource.indexOf('if (auth.response) return auth.response') < generateTechDocSource.indexOf('PDFDocument.create()');
      if (missing.length || !guardBeforePdf) {
        return fail('generateTechDoc can generate internal docs before server auth is proven.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'base44/functions/generateTechDoc/entry.ts',
          expected: 'base44.auth.me() guard returns 401 before PDFDocument.create()',
          actual: { missing, guardBeforePdf },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('generateTechDoc performs server-side authentication before creating the PDF.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    }),

  makeCase('generate_tech_doc_requires_admin_authorization',
    'generateTechDoc requires DB-backed server-side AdminUser authorization',
    () => {
      const required = [
        'requireAdmin',
        '../_shared/adminAuth.ts',
        'entities.AdminUser',
        'status',
        'active',
        'owner',
        'admin',
        '403',
        'Admin access required',
      ];
      const combined = `${generateTechDocSource}\n${adminAuthSource}`;
      const forbidden = presentTokens(generateTechDocSource, [
        'req.json()',
        'body.isAdmin',
        'isAdmin: true',
        'admin: true',
        ['ADMIN', 'EMAIL ='].join('_'),
      ]);
      const missing = missingTokens(combined, required);
      if (missing.length || forbidden.length) {
        return fail('generateTechDoc admin authorization contract drifted.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'base44/functions/generateTechDoc/entry.ts',
          expected: 'server-side AdminUser authorization; no client-supplied admin flag or committed email',
          actual: { missing, forbidden },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('generateTechDoc authorizes admins from server auth context only.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    }),

  makeCase('generate_tech_doc_errors_do_not_leak_internal_doc_details',
    'generateTechDoc returns controlled errors and does not expose stack traces',
    () => {
      const required = [
        "Response.json({ error: 'Internal server error' }, { status: 500 })",
        "console.error('[generateTechDoc] failed', error)",
      ];
      const forbidden = presentTokens(generateTechDocSource, [
        'stack: error.stack',
        'error.message, stack',
      ]);
      const missing = missingTokens(generateTechDocSource, required);
      if (missing.length || forbidden.length) {
        return fail('generateTechDoc error response can leak internal details.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'base44/functions/generateTechDoc/entry.ts',
          expected: 'generic 500 JSON response; stack logged server-side only',
          actual: { missing, forbidden },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('generateTechDoc uses controlled JSON errors without stack leakage.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    }),

  makeCase('generate_tech_doc_client_handles_401_403',
    'Admin Ekranı direct caller checks generateTechDoc response status before downloading',
    () => {
      const required = [
        "base44.functions.fetch('/generateTechDoc'",
        'if (!res.ok)',
        'setDocError',
        'await res.json().catch',
        'Teknik doküman indirilemedi.',
      ];
      const missing = missingTokens(adminPageSource, required);
      if (missing.length) {
        return fail('Admin Ekranı would still download 401/403 JSON as a PDF.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'src/pages/AdminPage.jsx',
          expected: 'res.ok guard + controlled admin-facing error copy',
          actual: { missing },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Admin Ekranı handles generateTechDoc 401/403 responses gracefully.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    },
    { critical: false }),

  makeCase('generate_tech_doc_runtime_auth_probe_needed',
    'Runtime probe: unauthenticated 401, non-admin 403, admin success',
    () => notAutomatable('Static contracts prove the guard exists, but release sign-off still needs real calls as unauthenticated, authenticated non-admin, and admin users.', {
      verification: 'NOT_AUTOMATABLE',
      classification: 'STATIC_CHECK_LIMITATION',
      actionType: ACTION_TYPES.BACKEND_RUNTIME_PROBE,
      expected: 'unauthenticated -> 401; non-admin -> 403; admin -> PDF success',
      actual: 'runtime auth contexts not available in static Health',
    }),
    { actionType: ACTION_TYPES.BACKEND_RUNTIME_PROBE, critical: true, runtimeProofRequired: true }),

  makeCase('send_game_invite_push_vapid_secret_contract',
    'sendGameInvitePush keeps VAPID private key backend-only and push best-effort',
    () => {
      const requiredBackend = [
        'VAPID_CONFIG_FIELDS',
        "canonicalName: 'VAPID_PRIVATE_KEY'",
        "envNames: ['VAPID_PRIVATE_KEY', 'KRONOX_VAPID_PRIVATE_KEY']",
        'Deno.env.get(envName)',
        'webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey)',
        'vapid_config_missing',
        'pushSent: false',
        'pushSkipped: true',
        'missingConfig: true',
        'isValidVapidSubject',
        'isLikelyVapidKey',
        'summarizeVapidConfigState',
        'sanitizePushErrorReason',
      ];
      const requiredFrontend = [
        'VITE_KRONOX_VAPID_PUBLIC_KEY',
        'missing_vapid_public_key',
        'registerKronoxServiceWorker',
      ];
      const forbiddenBackend = presentTokens(sendGameInvitePushSource, [
        "Deno.env.get('VITE_",
        'acceptedEnvNames',
        'missingConfig: config.missing',
        'invalidConfig: config.invalid',
        'return json({ ok: false, error: (error as Error)?.message',
      ]);
      const forbiddenFrontend = presentTokens(notificationApiSource, [
        'VAPID_PRIVATE_KEY',
        'VITE_KRONOX_VAPID_PRIVATE_KEY',
      ]);
      const missing = [
        ...missingTokens(sendGameInvitePushSource, requiredBackend),
        ...missingTokens(notificationApiSource, requiredFrontend),
      ];
      if (missing.length || forbiddenBackend.length || forbiddenFrontend.length) {
        return fail('Game invite push can expose or mishandle VAPID config.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          files: ['base44/functions/sendGameInvitePush/entry.ts', 'src/lib/notificationApi.js'],
          expected: 'Backend-only VAPID_PRIVATE_KEY, public client key only, explicit safe push skip when config is missing',
          actual: { missing, forbiddenBackend, forbiddenFrontend },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('sendGameInvitePush uses backend-only VAPID private-key config and preserves in-app invites when push is skipped.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    }),

  makeCase('get_questions_requires_auth',
    'getQuestions requires authentication before returning playable questions',
    () => {
      const required = [
        'await base44.auth.me()',
        'Giris yapmaniz gerekiyor.',
        '}, 401)',
        'authenticated_minimal_projection',
      ];
      const forbidden = presentTokens(getQuestionsSource, [
        'auth gerekmez',
        'Service role ile soruları çek',
      ]);
      const missing = missingTokens(getQuestionsSource, required);
      if (missing.length || forbidden.length) {
        return fail('getQuestions can still expose questions without authenticated user context.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'base44/functions/getQuestions/entry.ts',
          expected: 'auth.me guard returning 401 before scoped service-role Question.filter',
          actual: { missing, forbidden },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('getQuestions has an authenticated-user guard and no unauthenticated source contract.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
      });
    }),

  makeCase('get_questions_returns_minimal_projection',
    'getQuestions returns minimal playable projection and active-only rows',
    () => {
      const required = [
        'normalizeQuestionForRuntime',
        'isActiveQuestion',
        "state === 'A'",
        'activeCategoryIds',
        'main_category_id',
        'sub_category:',
        'tag:',
        'category: \'genel\'',
        'type: \'metin\'',
        'media_url: \'\'',
      ];
      const forbidden = presentTokens(getQuestionsSource, [
        'region:',
        '...question',
      ]);
      const missing = missingTokens(getQuestionsSource, required);
      if (missing.length || forbidden.length) {
        return fail('getQuestions minimal projection or active-only filter drifted.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'base44/functions/getQuestions/entry.ts',
          expected: 'active Question + active Category + minimal gameplay fields only',
          actual: { missing, forbidden },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('getQuestions filters active playable rows and returns only minimal runtime fields.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('get_questions_projection_uses_pool_proportional_sampling',
    'getQuestions projection uses pool-proportional fair sampling before capping',
    () => {
      const required = [
        'PROJECTION_SAMPLING_STRATEGY',
        'pool_proportional_category_subcategory_daily_sample_v1',
        'MAX_GAMEPLAY_LIMIT = 900',
        'QUESTION_FETCH_PER_CATEGORY_LIMIT = 1000',
        'buildPoolProportionalProjection',
        'allocateProportionalSlots',
        'sampleWithinCategory',
        'stableShuffleQuestions',
        'getProjectionSeed',
        'utc-day:',
        'projectionDiagnostics',
        'poolProportional: true',
        'equalCategoryCounts: false',
        'finalProjectionShuffled: true',
        'samplingStrategy: PROJECTION_SAMPLING_STRATEGY',
      ];
      const forbidden = presentTokens(getQuestionsSource, [
        'MAX_GAMEPLAY_LIMIT = 500',
        'QUESTION_FETCH_PER_CATEGORY_LIMIT = 250',
        '.filter(Boolean)\n      .slice(0, limit)',
      ]);
      const missing = missingTokens(getQuestionsSource, required);
      if (missing.length || forbidden.length) {
        return fail('getQuestions can regress to a narrow ordered projection slice instead of fair proportional sampling.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'base44/functions/getQuestions/entry.ts',
          expected: 'broad active fetch + deterministic pool-proportional category/subcategory sampling before cap',
          actual: { missing, forbidden },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('getQuestions uses deterministic pool-proportional sampling and admin-only diagnostics before returning the minimal projection.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
      });
    }),

  makeCase('get_questions_projection_preserves_solo_metadata',
    'getQuestions projection preserves Solo eligibility and balancing metadata',
    () => {
      const required = [
        'normalizeQuestionForRuntime',
        'id',
        'question',
        'answer',
        'year',
        'state',
        'main_category_id',
        'category_id',
        'categoryId',
        'sub_category',
        'tag',
        'difficulty',
        'type: \'metin\'',
        'category: \'genel\'',
      ];
      const forbidden = presentTokens(getQuestionsSource, [
        'delete normalized.sub_category',
        'delete normalized.tag',
        'delete normalized.difficulty',
      ]);
      const missing = missingTokens(getQuestionsSource, required);
      if (missing.length || forbidden.length) {
        return fail('getQuestions projection can drop fields the Solo engine needs for active-category, exposure, or diversity guardrails.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'base44/functions/getQuestions/entry.ts',
          expected: 'minimal playable projection with year/state/category/subcategory/tag/difficulty fields preserved',
          actual: { missing, forbidden },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('getQuestions keeps the runtime metadata Solo uses for eligibility, proportional diversity, and analytics interpretation.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
      });
    }),

  makeCase('get_questions_projection_diagnostics_expose_pool_gap',
    'getQuestions diagnostics expose active/projection distribution and pool gap fields',
    () => {
      const required = [
        'buildProjectionDiagnostics',
        'fetchedActiveTotal',
        'eligibleAfterNormalization',
        'returnedTotal',
        'droppedDuringNormalization',
        'activeCategoryWhitelistSize',
        'fetchedByCategory',
        'eligibleByCategory',
        'returnedByCategory',
        'returnedTopSubCategories',
        'returnedByEraBand',
        'projectionLimit',
        'projectionSeed',
        'finalProjectionShuffled: true',
        'poolProportional: true',
        'equalCategoryCounts: false',
        'includeDiagnostics',
        'isAuthorizedAdmin',
      ];
      const missing = missingTokens(getQuestionsSource, required);
      if (missing.length) {
        return fail('getQuestions no longer exposes the safe admin/Health projection funnel needed to detect active-vs-runtime pool mismatch.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'base44/functions/getQuestions/entry.ts',
          expected: 'admin-only diagnostics for fetched active, normalized eligible, returned projection, category/subcategory/year-band distributions',
          actual: { missing },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Projection diagnostics can reveal active pool, returned runtime pool, category/subcategory, and year-band mismatch without exposing raw bank rows.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
      });
    }),

  makeCase('get_questions_projection_seed_rotation_and_small_group_guard',
    'getQuestions projection protects small groups and has deterministic seed rotation',
    () => {
      const required = [
        'getUtcDayBucket',
        'getProjectionSeed',
        'utc-day:',
        'admin-provided:',
        'stableQuestionScore',
        'stableShuffleQuestions',
        'if (target >= entries.length && entry.slots === 0) entry.slots = 1',
        'sampleWithinCategory',
        'projection-fill',
        'final-projection',
      ];
      const forbidden = presentTokens(getQuestionsSource, [
        'Math.random()',
        '.slice(0, MAX_GAMEPLAY_LIMIT)',
      ]);
      const missing = missingTokens(getQuestionsSource, required);
      if (missing.length || forbidden.length) {
        return fail('Projection sampling can regress to non-debuggable random, ordered cap, or small-group starvation.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'base44/functions/getQuestions/entry.ts',
          expected: 'UTC-day/admin seed rotation, stable shuffle, proportional small-group protection before final cap',
          actual: { missing, forbidden },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Projection sampling is deterministic, rotates by bucket/seed, and protects valid small groups when projection size allows.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
      });
    }),

  makeCase('no_public_question_bank_fallback',
    'Gameplay question loading has no direct public Question.list fallback',
    () => {
      const forbidden = presentTokens(useOfflineQuestionsSource, [
        'base44.entities.Question.list',
        'Question.list(',
      ]);
      const required = missingTokens(useOfflineQuestionsSource, [
        "base44.functions.invoke('getQuestions'",
        'activeCategoryIds',
        'Direct Question.list fallback',
      ]);
      const questionReadIsAdminOnly = String(questionEntitySource).includes('"read"')
        && String(questionEntitySource).includes('"role": "admin"');
      if (forbidden.length || required.length || !questionReadIsAdminOnly) {
        return fail('Question bank can still be read through a client/entity fallback.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          expected: 'useOfflineQuestions invokes getQuestions only; Question.read is admin-only',
          actual: { forbidden, required, questionReadIsAdminOnly },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Normal gameplay uses authenticated getQuestions and direct Question read is admin-only.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('market_purchase_is_server_authoritative',
    'Market purchase does not trust client price or client identity',
    () => {
      const required = [
        'base44.auth.me()',
        'const email = normalizeEmail(user?.email)',
        'JOKER_MARKET_PRODUCTS',
        'const diamondCost = product.price * quantity',
        'clientPriceIgnored: true',
        'user_email: email',
      ];
      const forbidden = presentTokens(purchaseJokerWithDiamondsSource, [
        'body?.email',
        'body?.user_email',
        'body?.userId',
        'body?.price',
        'body?.diamondCost',
        'clientPrice',
      ]).filter((token) => token !== 'clientPrice');
      const missing = missingTokens(purchaseJokerWithDiamondsSource, required);
      if (missing.length || forbidden.length) {
        return fail('purchaseJokerWithDiamonds can trust client-controlled price or identity.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'base44/functions/purchaseJokerWithDiamonds/entry.ts',
          expected: 'authenticated user context + backend price table only',
          actual: { missing, forbidden },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Market purchase uses authenticated user context and backend-owned prices only.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
      });
    }),

  makeCase('market_purchase_rejects_bad_inputs_and_insufficient_diamonds',
    'Market purchase validates joker type, quantity, and sufficient Diamonds',
    () => {
      const required = [
        'invalid_joker_type',
        'parsePurchaseQuantity',
        'number <= 0',
        'invalid_quantity',
        'diamondBefore < diamondCost',
        'insufficient_diamonds',
        'Yeterli elmas yok.',
      ];
      const missing = missingTokens(purchaseJokerWithDiamondsSource, required);
      if (missing.length) {
        return fail('Market purchase input and sufficient-balance validation is incomplete.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'base44/functions/purchaseJokerWithDiamonds/entry.ts',
          missing,
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Market purchase rejects invalid joker types, zero/negative quantities, and insufficient Diamonds before successful writes.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('market_purchase_errors_do_not_leak_secrets_or_stacks',
    'Market purchase errors are controlled and do not expose secrets or stack traces',
    () => {
      const required = [
        'market_purchase_failed',
        'Satın alma tamamlanamadı. Lütfen tekrar dene.',
        "console.error('[purchaseJokerWithDiamonds] failed'",
      ];
      const forbidden = presentTokens(purchaseJokerWithDiamondsSource, [
        'stack: error',
        'error.stack',
        'error: error.message',
        'token',
        'secret',
      ]);
      const missing = missingTokens(purchaseJokerWithDiamondsSource, required);
      if (missing.length || forbidden.length) {
        return fail('Market purchase can expose raw backend error details or secrets.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'base44/functions/purchaseJokerWithDiamonds/entry.ts',
          actual: { missing, forbidden },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Market purchase returns controlled Turkish error copy and logs details server-side only.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('daily_quest_runtime_claim_is_user_bound_and_server_rewarded',
    'Daily Quest runtime claim is user-bound, server-rewarded, and Diamond-only',
    () => {
      const combined = `${recordDailyQuestProgressSource}\n${claimDailyQuestRewardSource}`;
      const required = [
        'base44.auth.me()',
        'normalizeEmail(user?.email)',
        'normalizeEmail(row?.user_email) === email',
        'mode !== \'solo\'',
        'non_solo_mode',
        'rewardDiamonds = Math.max(1, normalizeNumber(progress.reward_diamonds, 1))',
        'findDiamondTransaction',
        'daily_quest_reward',
        "direction: 'earn'",
        'clientRewardIgnored: true',
        'noKronoxPuan: true',
        'noLeaderboardImpact: true',
      ];
      const forbidden = presentTokens(claimDailyQuestRewardSource, [
        'body?.user_email',
        'body?.email',
        'body?.reward',
        'body?.reward_diamonds',
        'body?.amount',
        'body?.diamondAmount',
        'kronox_puan_total',
        'total_kronox_score',
        'SoloLeaderboardEntry',
      ]);
      const missing = missingTokens(combined, required);
      if (missing.length || forbidden.length) {
        return fail('Daily Quest runtime can trust client identity/reward values or affect Puan/leaderboard.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          files: [
            'base44/functions/recordDailyQuestProgress/entry.ts',
            'base44/functions/claimDailyQuestReward/entry.ts',
          ],
          actual: { missing, forbidden },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Daily Quest progress/claim uses authenticated ownership, server-row rewards, daily_quest_reward ledger, and no Puan/leaderboard writes.', {
        verification: 'STATIC_CONTRACT',
      });
    }),
];
