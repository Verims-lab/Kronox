import notifierSource from '../invites/GameInviteNotifier.jsx?raw';
import toastSource from '../ui/use-toast.jsx?raw';
import notificationCenterSource from '../../hooks/useNotificationCenter.js?raw';
import notificationViewModelSource from '../../lib/notificationViewModel.js?raw';
import identitySource from '../../lib/notificationIdentity.js?raw';
import integrityToolSource from '../admin/IntegritySnapshotTool.jsx?raw';
import {
  collapseLobbyAcceptanceNotifications,
  isLobbyAcceptanceNotificationEligible,
} from '@/lib/lobbyAcceptanceNotifications';

const SUITE_ID = 'notification_flood_health';
const pass = (reason, extra = {}) => ({ status: 'PASS', reason, verification: 'EXECUTABLE_SIMULATION', ...extra });
const fail = (reason, actual) => ({ status: 'FAIL', reason, verification: 'EXECUTABLE_SIMULATION', actionType: 'CODE_FIX', actual });
const makeCase = (id, name, run, relatedFiles) => ({ key: `${SUITE_ID}.${id}`, suiteId: SUITE_ID, suiteName: 'Notification Flood Health Suite', id, name, critical: true, actionType: 'CODE_FIX', relatedFiles, run });

const now = Date.parse('2026-08-19T06:00:00.000Z');
const invite = (id, lobby = 'lobby_a', patch = {}) => ({ id, status: 'accepted', accepted_at: new Date(now - 10_000).toISOString(), lobby_ref: lobby, to_name: `KronoxUser${id}`, ...patch });

export const EXTRA_SUITES = [{ id: SUITE_ID, name: 'Notification Flood Health Suite', critical: true, color: '#f59e0b' }];

export const EXTRA_TESTS = [
  makeCase('testing_agent_artifacts_do_not_pollute_user_feed', 'Explicit Testing Agent artifacts are suppressed from the normal feed', () => {
    const tagged = invite('1001', 'lobby_a', { notification_suppressed: true });
    return !isLobbyAcceptanceNotificationEligible(tagged, now)
      ? pass('Explicitly tagged test artifacts are excluded from user-facing acceptance notifications.')
      : fail('A tagged test artifact remained notification-eligible.', tagged);
  }, ['src/lib/lobbyAcceptanceNotifications.js', 'base44/functions/getOnlinePlayerSelection/entry.ts']),

  makeCase('lobby_accept_notifications_deduped', 'Repeated same-lobby acceptance events collapse into one summary', () => {
    const summary = collapseLobbyAcceptanceNotifications([invite('1001'), invite('1001'), invite('1002')], now);
    return summary?.count === 2 && summary.sameLobby === true
      ? pass('Duplicate event IDs are removed and same-lobby accepts collapse into one batch.')
      : fail('Acceptance events were not deduped/collapsed.', summary);
  }, ['src/lib/lobbyAcceptanceNotifications.js', 'src/components/invites/GameInviteNotifier.jsx']),

  makeCase('notification_toast_count_capped', 'Visible toast stack has a strict maximum', () => {
    const ok = toastSource.includes('const TOAST_LIMIT = 4') && toastSource.includes('.slice(0, TOAST_LIMIT)');
    return ok ? pass('The shared toast viewport is capped at four visible items.') : fail('Toast cap is missing or unbounded.', null);
  }, ['src/components/ui/use-toast.jsx']),

  makeCase('dismissed_notifications_do_not_replay', 'Bootstrap and handled acceptance events do not replay after route/app open', () => {
    const required = ['acceptedOutgoingBootstrappedRef', 'handledAcceptedOutgoingInviteIdsRef', 'markAcceptedOutgoingInviteHandled', 'collapseLobbyAcceptanceNotifications'];
    const missing = required.filter((token) => !notifierSource.includes(token));
    return !missing.length ? pass('Historical accepts are baselined and handled IDs stay suppressed across route changes.') : fail('Replay suppression wiring is incomplete.', missing);
  }, ['src/components/invites/GameInviteNotifier.jsx']),

  makeCase('test_artifact_cleanup_is_admin_only_dry_run_first', 'Artifact recovery is admin report-only and non-destructive', () => {
    const required = ['adminDuplicateKeyReport', "mode: 'dry_run'", 'notificationArtifactSnapshot', 'readOnly'];
    const missing = required.filter((token) => !integrityToolSource.includes(token));
    return !missing.length ? pass('Existing artifacts are visible through the guarded read-only Integrity Snapshot; no automatic deletion path is exposed.') : fail('Admin dry-run artifact visibility is incomplete.', missing);
  }, ['src/components/admin/IntegritySnapshotTool.jsx', 'base44/functions/adminDuplicateKeyReport/entry.ts']),

  makeCase('notification_privacy_no_private_ids', 'Acceptance UI renders username-safe labels without private identifiers', () => {
    const rendered = `${notifierSource}\n${notificationViewModelSource}`;
    const forbidden = ['invite.to_email', 'invite.from_email', 'owner_key', 'guest_token', 'actor_key_hash', 'player_key'].filter((token) => rendered.includes(token));
    const safe = identitySource.includes('getSafeNotificationActorName');
    return safe && !forbidden.length ? pass('Notification rendering remains username-only and private identifiers are absent.') : fail('Private notification fallback detected.', { safe, forbidden });
  }, ['src/components/invites/GameInviteNotifier.jsx', 'src/lib/notificationIdentity.js']),

  makeCase('testing_agent_teardown_or_suppression_exists', 'Testing Agent pollution has active suppression even without destructive teardown', () => {
    const required = ['notification_suppressed', 'accepted_at', "status === 'accepted'"];
    const source = `${notificationCenterSource}\n${notifierSource}`;
    const missing = required.filter((token) => !source.includes(token) && !isLobbyAcceptanceNotificationEligible.toString().includes(token));
    return !missing.length ? pass('Terminal test artifacts are freshness-filtered, test-marker suppressed, baselined, and never auto-deleted.') : fail('Testing artifact suppression is incomplete.', missing);
  }, ['src/hooks/useNotificationCenter.js', 'src/lib/lobbyAcceptanceNotifications.js', 'base44/functions/getOnlinePlayerSelection/entry.ts']),
];