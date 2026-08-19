import sendGameInvitePushSource from '../../../base44/functions/sendGameInvitePush/entry.ts?raw';
import inviteApiSource from '../../lib/inviteApi.js?raw';

const suiteId = 'vapid_runtime_secrets';
const pass = (reason, extra = {}) => ({ status: 'PASS', reason, ...extra });
const fail = (reason, extra = {}) => ({ status: 'FAIL', reason, ...extra });
const makeCase = (id, name, run, options = {}) => ({ key: `${suiteId}.${id}`, suiteId, suiteName: 'VAPID Runtime Secrets Security Suite', id, name, critical: options.critical ?? true, ...options, run });
const has = (token) => sendGameInvitePushSource.includes(token);
const absent = (token) => !has(token);
const sourceCase = (id, name, test, success) => makeCase(id, name, () => test() ? pass(success, { verification: 'SOURCE_CONNECTED' }) : fail(`${name} contract failed.`, { verification: 'SOURCE_CONNECTED', file: 'base44/functions/sendGameInvitePush/entry.ts' }));

export const EXTRA_SUITES = [{ id: suiteId, name: 'VAPID Runtime Secrets Security Suite', critical: true, color: '#ef4444' }];
export const EXTRA_TESTS = [
  sourceCase('no_deno_env_subject', 'VAPID_SUBJECT avoids Deno.env.get', () => absent('Deno.env.get("VAPID_SUBJECT")') && absent("Deno.env.get('VAPID_SUBJECT')"), 'VAPID_SUBJECT has no direct Deno environment read.'),
  sourceCase('no_deno_env_public_key', 'VAPID_PUBLIC_KEY avoids Deno.env.get', () => absent('Deno.env.get("VAPID_PUBLIC_KEY")') && absent("Deno.env.get('VAPID_PUBLIC_KEY')"), 'VAPID_PUBLIC_KEY has no direct Deno environment read.'),
  sourceCase('no_deno_env_private_key', 'VAPID_PRIVATE_KEY avoids Deno.env.get', () => absent('Deno.env.get("VAPID_PRIVATE_KEY")') && absent("Deno.env.get('VAPID_PRIVATE_KEY')"), 'VAPID_PRIVATE_KEY has no direct Deno environment read.'),
  sourceCase('base44_runtime_secrets_used', 'Base44 request-time secrets.get is used', () => has("import { secrets } from 'base44:runtime'") && ['VAPID_SUBJECT','VAPID_PUBLIC_KEY','VAPID_PRIVATE_KEY'].every((name) => has(`secrets.get(\"${name}\")`)) && sendGameInvitePushSource.indexOf('const config = getVapidConfig()') > sendGameInvitePushSource.indexOf('export default async function'), 'All VAPID values use request-path Base44 runtime secrets.'),
  sourceCase('private_key_not_hardcoded', 'VAPID private key is not hardcoded', () => !/(?:privateKey|VAPID_PRIVATE_KEY)\s*[:=]\s*['"][A-Za-z0-9_-]{40,}['"]/.test(sendGameInvitePushSource), 'No VAPID private-key material is committed.'),
  sourceCase('private_key_not_output', 'VAPID private key is not logged or returned', () => !/console\.(?:log|warn|error)\([^;]*(?:config\.privateKey|secretValues\.privateKey)/.test(sendGameInvitePushSource) && !/return\s+json\(\{[^}]*privateKey\s*:/.test(sendGameInvitePushSource), 'Private-key values are absent from logs and responses.'),
  sourceCase('missing_config_fails_closed', 'Missing VAPID config fails closed', () => has('PUSH_VAPID_NOT_CONFIGURED') && has("skippedPushSummary('missing_vapid_config'") && has('attempted: false') && has('pushSent: false'), 'Missing configuration skips push with safe diagnostics.'),
  sourceCase('placeholder_values_rejected', 'Placeholder-like VAPID values are rejected', () => ['changeme','placeholder','default','demo','test','insecure','unsafe','dev-private-key','your-vapid-private-key','your-vapid-public-key'].every((token) => has(`'${token}'`)) && has('isInvalidVapidValue(value)'), 'Known placeholder/default key values fail validation.'),
  sourceCase('push_remains_best_effort', 'Push failure preserves invite flow', () => has('push skipped but in-app invite remains available') && inviteApiSource.includes('Promise.allSettled') && inviteApiSource.indexOf("functions.invoke('createGameInvitesForTargets'") < inviteApiSource.indexOf('pushCreatedInvites(data.invites || [])'), 'GameInvite creation completes before best-effort push delivery.'),
  makeCase('production_provisioning_manual', 'Production VAPID provisioning remains manual proof', () => ({ status: 'NOT_AUTOMATABLE', reason: 'Source checks cannot verify deployed Base44 project secret values or real-device push delivery.', verification: 'NOT_AUTOMATABLE', classification: 'MANUAL_EXTERNAL', runtimeProofRequired: true }), { critical: false, runtimeProofRequired: true }),
];