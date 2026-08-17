import { createClientFromRequest } from 'npm:@base44/sdk@0.8.34';

// B1 read-only integrity report. Both supported modes are dry-run only.
// This function never creates, updates, deletes, merges, grants, spends, or cleans rows.
const DEFAULT_SCAN_LIMIT = 1000;
const MAX_SCAN_LIMIT = 5000;
const PAGE_SIZE = 500;

const DUPLICATE_KEY_CHECKS = [
  { id: 'diamond_transaction_idempotency_key', entity: 'DiamondTransaction', priority: 'P0', fields: ['idempotency_key'], purpose: 'Diamond grant/spend receipt' },
  { id: 'daily_wheel_spin_idempotency_key', entity: 'DailyWheelSpin', priority: 'P0', fields: ['idempotency_key'], purpose: 'Daily Wheel claim receipt' },
  { id: 'daily_wheel_spin_user_day', entity: 'DailyWheelSpin', priority: 'P0', fields: ['user_email', 'spin_date'], purpose: 'One wheel claim per actor/day' },
  { id: 'user_daily_quest_progress_idempotency_key', entity: 'UserDailyQuestProgress', priority: 'P0', fields: ['idempotency_key'], purpose: 'Daily assignment receipt' },
  { id: 'user_daily_quest_progress_user_day_task', entity: 'UserDailyQuestProgress', priority: 'P0', fields: ['user_email', 'quest_date', 'quest_key'], purpose: 'One Daily task row per actor/day/task' },
  { id: 'solo_streak_reward_idempotency_key', entity: 'DiamondTransaction', priority: 'P0', fields: ['idempotency_key'], filter: { source: 'solo_streak' }, purpose: 'One Solo streak reward per attempt/milestone' },
  { id: 'joker_transaction_idempotency_key', entity: 'JokerTransaction', priority: 'P0', fields: ['idempotency_key'], purpose: 'Joker grant/spend receipt' },
  { id: 'hint_transaction_idempotency_key', entity: 'HintTransaction', priority: 'P0', fields: ['idempotency_key'], purpose: 'Hint grant/spend receipt' },
  { id: 'user_joker_inventory_actor_type', entity: 'UserJokerInventory', priority: 'P0', fields: ['user_email', 'joker_type'], purpose: 'One Joker balance per actor/type' },
  { id: 'user_hint_inventory_actor', entity: 'UserHintInventory', priority: 'P0', fields: ['user_email'], purpose: 'One Hint balance per actor' },
  { id: 'online_match_result_idempotency_key', entity: 'OnlineMatchResult', priority: 'P0', fields: ['idempotency_key'], purpose: 'Online result receipt' },
  { id: 'online_match_result_actor_lobby', entity: 'OnlineMatchResult', priority: 'P0', fields: ['lobby_id', 'actor_key_hash'], purpose: 'One Online result per actor/lobby' },
  { id: 'economy_operation_lock_key', entity: 'EconomyOperationLock', priority: 'P0', fields: ['lock_key'], filter: { status: 'active' }, purpose: 'Active operation lock key' },
  { id: 'lobby_code', entity: 'Lobby', priority: 'P1', fields: ['code'], purpose: 'Unique lobby code' },
  { id: 'solo_leaderboard_entry_owner_key', entity: 'SoloLeaderboardEntry', priority: 'P1', fields: ['owner_key'], purpose: 'One materialized score row per actor' },
  { id: 'friend_request_sender_recipient_status', entity: 'FriendRequest', priority: 'P1', fields: ['from_email', 'to_email', 'status'], purpose: 'Open social relation risk' },
  { id: 'game_invite_sender_recipient_status', entity: 'GameInvite', priority: 'P1', fields: ['from_email', 'to_email', 'status'], purpose: 'Invite lifecycle duplicate risk' },
];

const DAILY_SOURCE_PROOF = [
  { taskType: 'daily_wheel_claim', title: 'Çark çevir', proofSource: 'DailyWheelSpin', receiptField: 'idempotency_key' },
  { taskType: 'joker_used', title: '1/2 joker kullan', proofSource: 'JokerTransaction', receiptField: 'idempotency_key' },
  { taskType: 'time_freeze_joker_used', title: 'Zamanı Dondur jokerini kullan', proofSource: 'JokerTransaction:time_freeze', receiptField: 'idempotency_key' },
  { taskType: 'hint_used', title: 'İpucu kullan', proofSource: 'HintTransaction:solo_use', receiptField: 'idempotency_key' },
  { taskType: 'solo_level_complete', title: '1/2/3 seviye tamamla', proofSource: 'Persisted Solo attempt', receiptField: 'lastAttemptId' },
  { taskType: 'consecutive_correct_4', title: 'Üst üste 4 doğru cevap ver', proofSource: 'QuestionAttemptEvent', receiptField: 'event_id' },
  { taskType: 'correct_answer', title: '5 soruyu doğru cevapla', proofSource: 'QuestionAttemptEvent', receiptField: 'event_id' },
  { taskType: 'jokerless_solo_level_complete', title: 'Jokersiz seviye tamamla', proofSource: 'Persisted Solo attempt', receiptField: 'lastAttemptId' },
  { taskType: 'profile_complete', title: 'Profilini tamamla', proofSource: 'Profile state', receiptField: 'profile_settings_updated_at' },
  { taskType: 'friend_invite_sent', title: 'Arkadaşını davet et', proofSource: 'FriendRequest', receiptField: 'public_ref' },
  { taskType: 'friend_added', title: '1 arkadaş ekle', proofSource: 'FriendRequest:accepted', receiptField: 'public_ref' },
];

function json(payload, status = 200) {
  return Response.json(payload, { status });
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function isActiveAdminRole(role) {
  return ['owner', 'admin'].includes(String(role || '').trim().toLowerCase());
}

async function requireAdmin(base44) {
  const user = await base44.auth.me().catch(() => null);
  if (!user?.email) return { response: json({ ok: false, code: 'auth_required', error: 'Giriş gerekli.' }, 401) };
  const email = normalizeEmail(user.email);
  const entity = base44?.asServiceRole?.entities?.AdminUser;
  if (!entity?.filter) return { response: json({ ok: false, code: 'admin_required', error: 'Admin yetkisi gerekli.' }, 403) };
  const rows = await entity.filter({ email }, '-updated_at', 10).catch(() => []);
  const active = (Array.isArray(rows) ? rows : []).some((row) => (
    normalizeEmail(row?.email) === email
    && String(row?.status || '').toLowerCase() === 'active'
    && isActiveAdminRole(row?.role)
  ));
  return active ? { admin: true } : { response: json({ ok: false, code: 'admin_required', error: 'Admin yetkisi gerekli.' }, 403) };
}

async function fetchWindow(base44, entityName, cap) {
  const entity = base44?.asServiceRole?.entities?.[entityName];
  if (!entity?.filter) return { rows: [], entityAvailable: false, scanWindowComplete: false };
  const rows = [];
  const seen = new Set();
  let cursor = null;
  while (rows.length < cap) {
    const query = cursor ? { created_date: { $gte: cursor } } : {};
    const batch = await entity.filter(query, 'created_date', Math.min(PAGE_SIZE, cap - rows.length)).catch(() => []);
    if (!Array.isArray(batch) || batch.length === 0) break;
    let added = 0;
    for (const row of batch) {
      const id = String(row?.id || row?._id || '');
      if (!id || seen.has(id)) continue;
      seen.add(id);
      rows.push(row);
      added += 1;
    }
    cursor = String(batch[batch.length - 1]?.created_date || '') || cursor;
    if (!added || batch.length < PAGE_SIZE) break;
  }
  return { rows, entityAvailable: true, scanWindowComplete: rows.length < cap };
}

function matchesFilter(row, filter = {}) {
  return Object.entries(filter).every(([field, value]) => String(row?.[field] || '') === String(value));
}

function keyFingerprint(value) {
  const text = String(value || '');
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `key_${(hash >>> 0).toString(36)}`;
}

function duplicateReport(rows, fields, filter) {
  const counts = new Map();
  let missingKeyRows = 0;
  const relevant = rows.filter((row) => matchesFilter(row, filter));
  for (const row of relevant) {
    const parts = fields.map((field) => String(row?.[field] ?? '').trim());
    if (parts.some((part) => !part)) { missingKeyRows += 1; continue; }
    const key = parts.join('|');
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const duplicates = [...counts.entries()].filter(([, count]) => count > 1).sort((a, b) => b[1] - a[1]);
  return {
    scannedRows: relevant.length,
    distinctKeys: counts.size,
    duplicateKeyCount: duplicates.length,
    duplicateRowCount: duplicates.reduce((sum, [, count]) => sum + count - 1, 0),
    missingKeyRows,
    samples: duplicates.slice(0, 3).map(([key, count]) => ({ fingerprint: keyFingerprint(key), count })),
  };
}

function latestDate(rows, fields = ['created_at', 'claimed_at', 'applied_at', 'created_date']) {
  return rows.reduce((latest, row) => {
    const value = fields.map((field) => row?.[field]).find(Boolean);
    const time = Date.parse(String(value || ''));
    return Number.isFinite(time) && time > latest.time ? { time, value } : latest;
  }, { time: 0, value: null }).value;
}

function summarizeLedger(rows, sourceField = 'source') {
  const buckets = new Map();
  for (const row of rows) {
    const source = String(row?.[sourceField] || row?.reason || 'unknown');
    const direction = String(row?.direction || (Number(row?.quantity_delta) < 0 ? 'spend' : 'earn'));
    const key = `${source}|${direction}`;
    const current = buckets.get(key) || { source, direction, rowCount: 0, amountTotal: 0, idempotencyKeyCoverage: 0, latestAt: null };
    current.rowCount += 1;
    current.amountTotal += Math.abs(Number(row?.amount ?? row?.quantity_delta) || 0);
    current.idempotencyKeyCoverage += row?.idempotency_key ? 1 : 0;
    current.latestAt = latestDate([current.latestAt ? { created_at: current.latestAt } : {}, row]);
    buckets.set(key, current);
  }
  return [...buckets.values()].sort((a, b) => a.source.localeCompare(b.source));
}

function buildDailySnapshot(windows, checks, serverDay) {
  const rows = windows.UserDailyQuestProgress?.rows || [];
  const today = rows.filter((row) => String(row?.quest_date || '') === serverDay && String(row?.quest_key || '').startsWith('daily_calendar:'));
  const duplicateCheck = checks.find((check) => check.id === 'user_daily_quest_progress_user_day_task');
  return {
    serverDay,
    currentDayRows: today.length,
    currentDayCompletedRows: today.filter((row) => ['completed', 'claimed'].includes(String(row?.status || ''))).length,
    duplicateReceiptRisk: Number(duplicateCheck?.duplicateKeyCount || 0) > 0,
    cacheContract: '60s actor/day cache with source-event invalidation',
    tasks: DAILY_SOURCE_PROOF.map((task) => ({ ...task, proofRegistryPresent: true })),
  };
}

function buildIntegritySnapshot(windows, checks) {
  const diamondRows = windows.DiamondTransaction?.rows || [];
  const jokerRows = windows.JokerTransaction?.rows || [];
  const hintRows = windows.HintTransaction?.rows || [];
  const lockRows = windows.EconomyOperationLock?.rows || [];
  const onlineRows = windows.OnlineMatchResult?.rows || [];
  const lobbyRows = windows.Lobby?.rows || [];
  const streakRows = diamondRows.filter((row) => String(row?.source || '') === 'solo_streak');
  return {
    economy: {
      diamondLedger: summarizeLedger(diamondRows),
      jokerLedger: summarizeLedger(jokerRows, 'reason'),
      hintLedger: summarizeLedger(hintRows, 'reason'),
      operationLocks: summarizeLedger(lockRows, 'operation_scope'),
      distinctSourcesRequired: ['daily_wheel', 'daily_calendar_streak_reward', 'solo_streak', 'market_purchase', 'starter_bonus', 'first_login_reward', 'daily_login', 'admin_adjustment'],
      readOnly: true,
    },
    daily: buildDailySnapshot(windows, checks, new Date().toISOString().slice(0, 10)),
    solo: {
      streakRewardReceipts: streakRows.length,
      latestReceiptAt: latestDate(streakRows),
      duplicateReceiptRisk: Number(checks.find((check) => check.id === 'solo_streak_reward_idempotency_key')?.duplicateKeyCount || 0) > 0,
      attemptProof: 'QuestionAttemptEvent + persisted Solo attempt metadata',
      rewardIsolation: ['Diamonds only', 'No Kronox Puan', 'No Leaderboard', 'No Daily Goals'],
    },
    online: {
      sharedDeckLobbyCount: lobbyRows.filter((row) => Array.isArray(row?.online_question_deck) && row.online_question_deck.length > 0).length,
      serverAuthoredDeckMarkerCount: lobbyRows.filter((row) => row?.online_deck_meta?.source === 'online_shared_all_active_random_deck_v1').length,
      resultReceiptCount: onlineRows.length,
      appliedResultCount: onlineRows.filter((row) => String(row?.status || '') === 'applied').length,
      duplicateReceiptRisk: checks.some((check) => ['online_match_result_idempotency_key', 'online_match_result_actor_lobby'].includes(check.id) && check.duplicateKeyCount > 0),
      authority: 'startLobbyGame shared deck + updateLobbyGameState commit_result',
      scoreRule: 'winner_15_loser_minus_6',
    },
  };
}

export default async function adminDuplicateKeyReport(req) {
  try {
    if (req.method !== 'POST') return json({ ok: false, code: 'method_not_allowed', error: 'Bu işlem desteklenmiyor.' }, 405);
    const base44 = createClientFromRequest(req);
    const auth = await requireAdmin(base44);
    if (auth.response) return auth.response;
    const body = await req.json().catch(() => ({}));
    const requestedMode = String(body?.mode || 'dry_run').trim().toLowerCase();
    const mode = requestedMode === 'prepare_cleanup_plan' ? 'prepare_cleanup_plan' : 'dry_run';
    const scanLimit = Math.max(PAGE_SIZE, Math.min(MAX_SCAN_LIMIT, Math.floor(Number(body?.scanLimit) || DEFAULT_SCAN_LIMIT)));
    const requestedCheckIds = Array.isArray(body?.checks) ? body.checks.map(String) : [];
    const activeChecks = requestedCheckIds.length ? DUPLICATE_KEY_CHECKS.filter((check) => requestedCheckIds.includes(check.id)) : DUPLICATE_KEY_CHECKS;
    const entityNames = [...new Set(activeChecks.map((check) => check.entity))];
    const windows = {};
    for (const entityName of entityNames) windows[entityName] = await fetchWindow(base44, entityName, scanLimit);
    const checks = activeChecks.map((check) => {
      const window = windows[check.entity] || { rows: [], entityAvailable: false, scanWindowComplete: false };
      const report = duplicateReport(window.rows, check.fields, check.filter);
      const status = !window.entityAvailable || !window.scanWindowComplete ? 'INCOMPLETE' : report.duplicateKeyCount > 0 ? 'FAIL' : 'PASS';
      return {
        id: check.id,
        entity: check.entity,
        priority: check.priority,
        uniqueKeyFields: check.fields,
        purpose: check.purpose,
        status,
        entityAvailable: window.entityAvailable,
        scanWindowComplete: window.scanWindowComplete,
        ...report,
        uniqueIndexBlockedByDuplicates: report.duplicateKeyCount > 0,
      };
    });
    return json({
      ok: true,
      reportVersion: 'b1-read-only-integrity-v1',
      mode,
      dryRun: true,
      readOnly: true,
      mutatesRows: false,
      mutatesBalances: false,
      destructiveCleanupImplemented: false,
      duplicateCleanupRequiredBeforeUniqueIndex: true,
      indexSupportModel: 'platform_manual_only',
      scanLimit,
      scannedAt: new Date().toISOString(),
      checks,
      integritySnapshot: buildIntegritySnapshot(windows, checks),
    });
  } catch (error) {
    console.error('[adminDuplicateKeyReport] failed');
    return json({ ok: false, code: 'duplicate_report_failed', error: 'Rapor oluşturulamadı.' }, 500);
  }
}