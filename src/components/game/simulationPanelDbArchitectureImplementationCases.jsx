// Kronox Health Center — DB Architecture Implementation contracts.
//
// Scope: additive DB gateway, analytics/projection entities, cleanup jobs,
// SEO/GEO projection boundary, and platform idempotency documentation.
// Runtime cleanup execution and live uniqueness guarantees remain manual proof.

import gatewayIndexSource from '../../lib/dbGateway/index.js?raw';
import questionGatewaySource from '../../lib/dbGateway/questionGateway.js?raw';
import categoryGatewaySource from '../../lib/dbGateway/categoryGateway.js?raw';
import analyticsGatewaySource from '../../lib/dbGateway/analyticsGateway.js?raw';
import cleanupGatewaySource from '../../lib/dbGateway/cleanupGateway.js?raw';
import leaderboardGatewaySource from '../../lib/dbGateway/leaderboardGateway.js?raw';
import dailyQuestGatewaySource from '../../lib/dbGateway/dailyQuestGateway.js?raw';
import { DB_ARCHITECTURE_IMPLEMENTATION_MIRROR } from '@/lib/dbArchitectureMirrors';

const STATUS = {
  PASS: 'PASS',
  FAIL: 'FAIL',
  NOT_AUTOMATABLE: 'NOT_AUTOMATABLE',
};

const ACTION_TYPES = {
  CODE_FIX: 'CODE_FIX',
  MANUAL_REVIEW: 'MANUAL_REVIEW',
};

const SUITE_ID = 'db_architecture_implementation_health';
const SUITE_NAME = 'DB Architecture Implementation Suite';

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

function text(source) {
  if (source == null) return '';
  if (typeof source === 'string') return source;
  try { return String(source); } catch { return ''; }
}

function missingTokens(source, tokens) {
  const value = text(source);
  return tokens.filter((token) => !value.includes(token));
}

export const EXTRA_SUITES = [
  { id: SUITE_ID, name: SUITE_NAME, critical: true, color: '#38bdf8' },
];

export const EXTRA_TESTS = [
  makeCase('db_architecture_doc_exists',
    'DB architecture implementation document contract is present',
    () => {
      const missing = missingTokens(DB_ARCHITECTURE_IMPLEMENTATION_MIRROR, [
        'docs/KRONOX_DB_ARCHITECTURE.md exists',
        'Implemented now',
        'Scaffolded now',
        'Base44 index/unique-key declarations are a platform/manual configuration gap',
      ]);
      if (missing.length) {
        return fail('DB architecture implementation mirror is missing required doc-status contract tokens.', {
          verification: 'STATIC_CONTRACT',
          missing,
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('DB architecture doc implementation status is mirrored for Health.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('db_gateway_modules_exist',
    'DB gateway folder exports focused gateway modules',
    () => {
      const combined = [
        gatewayIndexSource,
        questionGatewaySource,
        categoryGatewaySource,
        analyticsGatewaySource,
        cleanupGatewaySource,
        leaderboardGatewaySource,
        dailyQuestGatewaySource,
      ].map(text).join('\n');
      const missing = missingTokens(combined, [
        'questionGateway',
        'categoryGateway',
        'inviteGateway',
        'lobbyGateway',
        'scoringGateway',
        'economyGateway',
        'leaderboardGateway',
        'analyticsGateway',
        'cleanupGateway',
        'dailyQuestGateway',
      ]);
      if (missing.length) {
        return fail('DB gateway exports are incomplete.', {
          verification: 'STATIC_CONTRACT',
          file: 'src/lib/dbGateway/index.js',
          missing,
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('DB gateway module foundation is present and exported.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('daily_quest_definition_entity_registered',
    'DailyQuestDefinition template entity is registered in DB architecture',
    () => {
      const combined = `${dailyQuestGatewaySource}\n${DB_ARCHITECTURE_IMPLEMENTATION_MIRROR}`;
      const missing = missingTokens(combined, [
        'DailyQuestDefinition',
        'createDailyQuestDefinition',
        'quest_type + target_value',
        'reward_diamonds only',
        'never Kronox Puan',
        'start_solo_attempt',
        'correct_cards',
        'complete_solo_level',
        'use_joker',
      ]);
      if (missing.length) {
        return fail('DailyQuestDefinition DB architecture contract is incomplete.', {
          verification: 'STATIC_CONTRACT',
          missing,
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('DailyQuestDefinition is documented as an admin-managed template entity with enum logic and Diamond-only rewards.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('analytics_entities_exist',
    'Analytics/statistics entity contract is implemented',
    () => {
      const missing = missingTokens(DB_ARCHITECTURE_IMPLEMENTATION_MIRROR, [
        'QuestionAttemptEvent',
        'QuestionStatsProjection',
        'UserStatsProjection',
        'CategoryStatsProjection',
        'LobbyMatchStats',
      ]);
      if (missing.length) {
        return fail('Analytics/statistics entity contract is incomplete.', {
          verification: 'STATIC_CONTRACT',
          missing,
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Analytics/statistics entity names are locked into the DB architecture contract.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('question_stats_projection_exists',
    'Question stats projection and aggregation job are present',
    () => {
      const combined = `${analyticsGatewaySource}\n${cleanupGatewaySource}\n${DB_ARCHITECTURE_IMPLEMENTATION_MIRROR}`;
      const missing = missingTokens(combined, [
        'QuestionStatsProjection',
        'CategoryStatsProjection',
        'QuestionAttemptEvent',
        'aggregateQuestionStats',
      ]);
      if (missing.length) {
        return fail('Question statistics projection/aggregation contract is incomplete.', {
          verification: 'STATIC_CONTRACT',
          missing,
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Question statistics projection is scaffolded with an aggregation job contract.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('leaderboard_projection_strategy_exists',
    'Leaderboard projection uses internal unified score row plus sanitized public response',
    () => {
      const combined = `${leaderboardGatewaySource}\n${DB_ARCHITECTURE_IMPLEMENTATION_MIRROR}`;
      const missing = missingTokens(combined, [
        'SoloLeaderboardEntry',
        'total_kronox_score',
        'unified Kronox Puan',
        'noRawEmail',
        'getSoloLeaderboard returns sanitized username plus opaque leaderboard_id',
      ]);
      if (missing.length) {
        return fail('Leaderboard projection strategy is missing sanitized unified score tokens.', {
          verification: 'STATIC_CONTRACT',
          file: 'src/lib/dbGateway/leaderboardGateway.js + docs mirror',
          missing,
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Leaderboard projection strategy is explicit: internal projection row, sanitized public function response.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('cleanup_job_functions_exist',
    'Cleanup/retention job function contracts exist',
    () => {
      const missing = missingTokens(DB_ARCHITECTURE_IMPLEMENTATION_MIRROR, [
        'expireOldGameInvites',
        'cancelStaleLobbies',
        'expirePushSubscriptions',
        'refreshLeaderboardProjection',
        'aggregateQuestionStats',
        'cleanupAdminMaintenanceLog',
      ]);
      if (missing.length) {
        return fail('Cleanup/retention job list is incomplete.', {
          verification: 'STATIC_CONTRACT',
          missing,
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Cleanup/retention job contracts are present.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('cleanup_jobs_admin_gated',
    'Cleanup jobs are admin/service gated and dry-run capable',
    () => {
      const combined = `${cleanupGatewaySource}\n${DB_ARCHITECTURE_IMPLEMENTATION_MIRROR}`;
      const missing = missingTokens(combined, [
        'requires admin auth',
        'dryRun',
        'AdminMaintenanceLog',
      ]);
      if (missing.length) {
        return fail('Cleanup jobs are missing admin/dry-run/logging contract tokens.', {
          verification: 'STATIC_CONTRACT',
          missing,
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Cleanup jobs are documented as admin-gated, dry-run capable, and logged.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('cleanup_jobs_status_transition_first',
    'Cleanup jobs use status transition first and avoid hard delete',
    () => {
      const missing = missingTokens(DB_ARCHITECTURE_IMPLEMENTATION_MIRROR, [
        'status-transition-first',
        'do not hard delete production data',
        'status expired',
        'status cancelled',
        'retention_status archived',
      ]);
      if (missing.length) {
        return fail('Cleanup job retention contract is incomplete.', {
          verification: 'STATIC_CONTRACT',
          missing,
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Cleanup jobs are status-transition-first with no hard-delete default.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('public_seo_geo_projection_does_not_expose_raw_question_bank',
    'SEO/GEO projection is public-safe and raw Question stays protected',
    () => {
      const missing = missingTokens(DB_ARCHITECTURE_IMPLEMENTATION_MIRROR, [
        'QuestionPublicProjection',
        'public_visibility',
        'Raw Question remains protected',
        'must not be exposed as public full question bank',
      ]);
      if (missing.length) {
        return fail('SEO/GEO public projection boundary is incomplete.', {
          verification: 'STATIC_CONTRACT',
          missing,
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('SEO/GEO projection is opt-in and keeps the raw question bank protected.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('idempotency_unique_key_platform_limitation_documented',
    'Idempotency unique-key/platform limitation is documented honestly',
    () => {
      const missing = missingTokens(DB_ARCHITECTURE_IMPLEMENTATION_MIRROR, [
        'DiamondTransaction.idempotency_key unique',
        'DailyQuestDefinition.quest_key unique',
        'UserDailyQuestProgress.idempotency_key unique',
        'user_email + quest_date + quest_key unique',
        'DailyWheelSpin.idempotency_key unique',
        'UserJokerInventory user_email + joker_type unique',
        'JokerTransaction.idempotency_key unique',
        'UserCategoryPreference user_email + category_id unique',
        'FriendRequest to_email + status',
        'GameInvite to_email + status + expires_at',
        'Question state + main_category_id',
        'OnlineMatchResult.idempotency_key unique',
        'lobby_id + player_email unique',
        'QuestionAttemptEvent.event_id unique',
        'Runtime uniqueness proof remains manual/NOT_AUTOMATABLE',
      ]);
      if (missing.length) {
        return fail('Idempotency/platform limitation contract is incomplete.', {
          verification: 'STATIC_CONTRACT',
          missing,
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Idempotency uniqueness requirements and platform limits remain explicit.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('legacy_entities_documented',
    'Legacy entities are retained with proof-before-delete status',
    () => {
      const missing = missingTokens(DB_ARCHITECTURE_IMPLEMENTATION_MIRROR, [
        'Friendship is kept as legacy/candidate',
        'GameRecord is kept as legacy/candidate',
        'LobbyMessage is kept as legacy/candidate',
        'no deletion without reference proof',
      ]);
      if (missing.length) {
        return fail('Legacy entity cleanup contract is incomplete.', {
          verification: 'STATIC_CONTRACT',
          missing,
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Legacy entity status is documented without deleting production data.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('question_attempt_runtime_wiring_manual',
    'QuestionAttemptEvent runtime writes require manual proof before release',
    () => notAutomatable('QuestionAttemptEvent gateway exists and Solo runtime now writes shown/answered/swap events best-effort. Deployed write volume, RLS, no-gameplay-delay proof, and future Online analytics wiring remain manual.', {
      verification: 'RUNTIME_PROBE_REQUIRED',
      classification: 'NOT_AUTOMATABLE_RUNTIME_REQUIRED',
      file: 'src/lib/dbGateway/analyticsGateway.js',
      actionType: ACTION_TYPES.MANUAL_REVIEW,
    }), { critical: false }),
];
