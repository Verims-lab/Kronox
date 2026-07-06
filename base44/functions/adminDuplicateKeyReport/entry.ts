import { createClientFromRequest } from 'npm:@base44/sdk@0.8.34';

// adminDuplicateKeyReport — GFable 5 DB indexing prep.
//
// AdminUser-gated, READ-ONLY duplicate dry-run tool for every planned P0/P1
// unique key. Base44 repo JSONC schemas cannot declare indexes/unique
// constraints, so unique keys are platform/manual configuration. Rule:
// duplicate cleanup must complete before any unique constraint is configured
// (INDEX BEFORE DUPLICATE CLEANUP IS NOT ALLOWED).
//
// Modes (both read-only):
//   • dry_run (default)        — duplicate counts + masked sample keys.
//   • prepare_cleanup_plan     — same counts plus a canonical-row cleanup
//                                strategy note per duplicate-bearing key.
//
// This function NEVER mutates rows or balances. Destructive cleanup is
// intentionally NOT implemented: canonical-row semantics for economy ledgers
// and inventory merges require explicit product/admin approval first.

const DEFAULT_SCAN_LIMIT = 5000;
const MAX_SCAN_LIMIT = 20000;
const PAGE_SIZE = 500;

const DUPLICATE_KEY_CHECKS = [
  { id: 'diamond_transaction_idempotency_key', entity: 'DiamondTransaction', priority: 'P0', fields: ['idempotency_key'], purpose: 'Prevent duplicate Diamond grant/spend from retry, double-click, race, or repeated backend invocation.' },
  { id: 'daily_wheel_spin_idempotency_key', entity: 'DailyWheelSpin', priority: 'P0', fields: ['idempotency_key'], purpose: 'Daily Wheel claim retry safety.' },
  { id: 'daily_wheel_spin_user_day', entity: 'DailyWheelSpin', priority: 'P0', fields: ['user_email', 'spin_date'], purpose: 'One free Daily Wheel spin per player per UTC server day.' },
  { id: 'user_joker_inventory_user_joker_type', entity: 'UserJokerInventory', priority: 'P0', fields: ['user_email', 'joker_type'], purpose: 'One balance row per user per joker type for Solo joker bar / Market display.' },
  { id: 'user_daily_quest_progress_idempotency_key', entity: 'UserDailyQuestProgress', priority: 'P0', fields: ['idempotency_key'], purpose: 'Daily Calendar task assignment idempotency.' },
  { id: 'user_daily_quest_progress_user_day_task', entity: 'UserDailyQuestProgress', priority: 'P0', fields: ['user_email', 'quest_date', 'quest_key'], purpose: 'One row per player per UTC day per Daily Calendar task (3-task day / streak correctness).' },
  { id: 'joker_transaction_idempotency_key', entity: 'JokerTransaction', priority: 'P0', fields: ['idempotency_key'], purpose: 'Prevent duplicate joker grant/spend ledger rows.' },
  { id: 'hint_transaction_idempotency_key', entity: 'HintTransaction', priority: 'P0', fields: ['idempotency_key'], purpose: 'Prevent duplicate Hint grant/spend ledger rows.' },
  { id: 'solo_leaderboard_entry_owner_key', entity: 'SoloLeaderboardEntry', priority: 'P1', fields: ['owner_key'], purpose: 'One leaderboard projection row per player; fast total_kronox_score descending sort.' },
  { id: 'lobby_code', entity: 'Lobby', priority: 'P1', fields: ['code'], purpose: 'Fast unique lobby-code lookup.' },
];

const CLEANUP_STRATEGY_NOTES: Record<string, string> = {
  DiamondTransaction: 'Canonical row = earliest ledger row per idempotency_key whose balance_after matches the applied grant/spend; extra rows are audit-archive candidates only. Cleanup must preserve the visible User/GuestProfile balance and never re-apply or reverse grants. Requires explicit admin approval; not automated.',
  DailyWheelSpin: 'Canonical row = earliest claimed spin per player/day; later rows are retry echoes. No balance mutation during cleanup.',
  UserJokerInventory: 'Canonical row = row matching the latest JokerTransaction balance_after (fallback: newest updated row); duplicates are merge/passivate candidates. Runtime already dedupes on read; cleanup must not change effective balances.',
  UserDailyQuestProgress: 'daily_calendar:* duplicates: keep the row with the highest progress_value/earliest completion. Legacy daily_quest:* rows are handled by the existing admin-gated cleanupLegacyDailyQuests dry-run/delete path.',
  JokerTransaction: 'Ledger rows are append-only audit; duplicates per idempotency_key are archive candidates only, never balance mutations.',
  HintTransaction: 'Ledger rows are append-only audit; duplicates per idempotency_key are archive candidates only, never balance mutations.',
  SoloLeaderboardEntry: 'Canonical row = newest updated_at per owner_key (getSoloLeaderboard already dedupes server-side); older projection rows are passivate/remove candidates after admin confirmation.',
  Lobby: 'Duplicate codes would require regenerating codes on non-authoritative rows; only with explicit admin confirmation.',
};

function json(payload: unknown, status = 200) {
  return Response.json(payload, { status });
}

function normalizeEmail(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function isActiveAdminRole(role: unknown) {
  const value = String(role || '').trim().toLowerCase();
  return value === 'owner' || value === 'admin';
}

function isActiveAdminStatus(status: unknown) {
  return String(status || '').trim().toLowerCase() === 'active';
}

async function requireAdmin(base44: any) {
  let user: any = null;
  try {
    user = await base44.auth.me();
  } catch (_error) {
    user = null;
  }
  if (!user?.email) {
    return { response: json({ ok: false, code: 'auth_required', error: 'Giris gerekli.' }, 401) };
  }
  const email = normalizeEmail(user.email);
  const adminEntity = base44?.asServiceRole?.entities?.AdminUser;
  if (!adminEntity?.filter) {
    return { response: json({ ok: false, code: 'admin_required', error: 'Admin yetkisi gerekli.' }, 403) };
  }
  let rows: any[] = [];
  for (const field of ['email', 'Email', 'user_email', 'admin_email']) {
    const result = await adminEntity.filter({ [field]: email }, '-updated_at', 10).catch(() => []);
    if (Array.isArray(result) && result.length > 0) { rows = result; break; }
  }
  const active = rows.find((row) => (
    normalizeEmail(row?.email || row?.user_email || row?.admin_email) === email
    && isActiveAdminStatus(row?.status)
    && isActiveAdminRole(row?.role)
  ));
  if (!active) {
    return { response: json({ ok: false, code: 'admin_required', error: 'Admin yetkisi gerekli.' }, 403) };
  }
  return { adminActorEmail: email };
}

// Masked sample keys only: never return raw emails, guest ids, owner keys, or
// internal player keys in the report payload.
function maskPrivateKeys(value: unknown) {
  return String(value || '')
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+/g, '<email>')
    .replace(/guest:[A-Za-z0-9_-]+/g, 'guest:<key>')
    .replace(/\bg_[A-Za-z0-9]+/g, 'g_<key>')
    .replace(/\bu_[A-Za-z0-9]+/g, 'u_<key>');
}

async function fetchWindow(base44: any, entityName: string, cap: number) {
  const entity = base44?.asServiceRole?.entities?.[entityName];
  if (!entity?.filter) return { rows: [], entityAvailable: false };
  const seen = new Set<string>();
  const rows: any[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < Math.ceil(MAX_SCAN_LIMIT / PAGE_SIZE) + 2; page += 1) {
    const query = cursor ? { created_date: { $gte: cursor } } : {};
    const batch = await entity.filter(query, 'created_date', PAGE_SIZE).catch(() => []);
    if (!Array.isArray(batch) || batch.length === 0) break;
    let added = 0;
    for (const row of batch) {
      const id = String(row?.id || row?._id || '');
      if (!id || seen.has(id)) continue;
      seen.add(id);
      rows.push(row);
      added += 1;
      if (rows.length >= cap) break;
    }
    cursor = String(batch[batch.length - 1]?.created_date || '') || cursor;
    if (added === 0 || rows.length >= cap || batch.length < PAGE_SIZE) break;
  }
  return { rows, entityAvailable: true };
}

function duplicateReport(rows: any[], fields: string[]) {
  const counts = new Map<string, number>();
  let missingKeyRows = 0;
  for (const row of rows) {
    const parts = fields.map((field) => String(row?.[field] ?? '').trim());
    if (parts.some((part) => !part)) { missingKeyRows += 1; continue; }
    const key = parts.join('|');
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const duplicates = [...counts.entries()]
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1]);
  return {
    scannedRows: rows.length,
    distinctKeys: counts.size,
    duplicateKeyCount: duplicates.length,
    rowsInDuplicateGroups: duplicates.reduce((sum, [, count]) => sum + count, 0),
    missingKeyRows,
    sampleKeys: duplicates.slice(0, 5).map(([key, count]) => ({ key: maskPrivateKeys(key), count })),
  };
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method !== 'POST') {
      return json({ ok: false, code: 'method_not_allowed', error: 'Bu islem desteklenmiyor.' }, 405);
    }
    const base44 = createClientFromRequest(req);
    const adminAuth = await requireAdmin(base44);
    if (adminAuth.response) return adminAuth.response;

    const body = await req.json().catch(() => ({}));
    const requestedMode = String(body?.mode || 'dry_run').trim().toLowerCase();
    const mode = requestedMode === 'prepare_cleanup_plan' ? 'prepare_cleanup_plan' : 'dry_run';
    const scanLimit = Math.max(PAGE_SIZE, Math.min(MAX_SCAN_LIMIT, Math.floor(Number(body?.scanLimit) || DEFAULT_SCAN_LIMIT)));
    const requestedCheckIds = Array.isArray(body?.checks)
      ? body.checks.map((id: unknown) => String(id || '').trim()).filter(Boolean)
      : [];
    const activeChecks = requestedCheckIds.length
      ? DUPLICATE_KEY_CHECKS.filter((check) => requestedCheckIds.includes(check.id))
      : DUPLICATE_KEY_CHECKS;

    // One bounded read per entity, shared across that entity's key checks.
    const entityNames = [...new Set(activeChecks.map((check) => check.entity))];
    const windows: Record<string, { rows: any[]; entityAvailable: boolean }> = {};
    for (const entityName of entityNames) {
      windows[entityName] = await fetchWindow(base44, entityName, scanLimit);
    }

    const checks = activeChecks.map((check) => {
      const window = windows[check.entity] || { rows: [], entityAvailable: false };
      const report = duplicateReport(window.rows, check.fields);
      const scanWindowComplete = report.scannedRows < scanLimit;
      const result: Record<string, unknown> = {
        id: check.id,
        entity: check.entity,
        priority: check.priority,
        uniqueKeyFields: check.fields,
        purpose: check.purpose,
        entityAvailable: window.entityAvailable,
        scanWindowComplete,
        ...report,
        uniqueIndexBlockedByDuplicates: report.duplicateKeyCount > 0,
      };
      if (mode === 'prepare_cleanup_plan' && report.duplicateKeyCount > 0) {
        result.cleanupPlan = {
          requiresExplicitAdminConfirmation: true,
          destructiveCleanupImplemented: false,
          canonicalRowStrategy: CLEANUP_STRATEGY_NOTES[check.entity] || 'Define canonical-row semantics with product approval before any cleanup.',
        };
      }
      return result;
    });

    return json({
      ok: true,
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
    });
  } catch (error) {
    console.error('[adminDuplicateKeyReport] failed', (error as any)?.message || error);
    return json({ ok: false, code: 'duplicate_report_failed', error: 'Rapor olusturulamadi.' }, 500);
  }
});