import { createClientFromRequest } from 'npm:@base44/sdk@0.8.34';

// adminDuplicateKeyCleanup — GFable 5 approved duplicate cleanup executor.
//
// AdminUser-gated. Removes ONLY redundant duplicate rows for the approved
// unique-key targets, using per-entity canonical-row semantics. It NEVER
// mutates player balances, scores, streaks, or rewards — the canonical
// balance sources (User.diamonds, GuestProfile.diamonds, User progress)
// are not touched; only redundant duplicate rows are deleted.
//
// Modes:
//   • dry_run (default) — builds the full deletion plan (kept row + delete
//     candidates per duplicate key) with masked keys; deletes nothing.
//   • execute — requires confirm: 'DELETE_DUPLICATES'; deletes exactly the
//     planned redundant rows.
//
// Canonical-row semantics (admin approved):
//   • DiamondTransaction.idempotency_key  → keep EARLIEST created row
//     (the ledger row for the actually-applied grant); later rows are
//     retry echoes. Balances are untouched.
//   • JokerTransaction.idempotency_key    → keep EARLIEST created row.
//   • UserJokerInventory user+joker_type  → keep NEWEST updated row
//     (server reconciliation writes the post-spend balance to rows;
//     runtime already prefers deduped reads).
//   • UserDailyQuestProgress keys         → keep BEST row per
//     user+quest_date+quest_key: completed status first, then highest
//     progress_value, then earliest created.
//   • SoloLeaderboardEntry.owner_key      → keep NEWEST updated row
//     (matches getSoloLeaderboard server-side dedupe preference).

const PAGE_SIZE = 500;
const SCAN_CAP = 20000;
const DELETE_CHUNK = 20;
const MAX_DELETES_PER_RUN = 3000;
const CONFIRM_TOKEN = 'DELETE_DUPLICATES';

function json(payload: unknown, status = 200) {
  return Response.json(payload, { status });
}

function normalizeEmail(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

async function requireAdmin(base44: any) {
  let user: any = null;
  try { user = await base44.auth.me(); } catch (_e) { user = null; }
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
    && String(row?.status || '').trim().toLowerCase() === 'active'
    && ['owner', 'admin'].includes(String(row?.role || '').trim().toLowerCase())
  ));
  if (!active) {
    return { response: json({ ok: false, code: 'admin_required', error: 'Admin yetkisi gerekli.' }, 403) };
  }
  return { adminActorEmail: email };
}

function maskPrivateKeys(value: unknown) {
  return String(value || '')
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+/g, '<email>')
    .replace(/guest:[A-Za-z0-9_-]+/g, 'guest:<key>')
    .replace(/\bg_[A-Za-z0-9]+/g, 'g_<key>')
    .replace(/\bu_[A-Za-z0-9]+/g, 'u_<key>');
}

function rowTime(row: any, fields: string[]) {
  for (const field of fields) {
    const value = row?.[field];
    if (value) {
      const time = Date.parse(String(value));
      if (Number.isFinite(time)) return time;
    }
  }
  return 0;
}

const createdTime = (row: any) => rowTime(row, ['created_at', 'created_date']);
const updatedTime = (row: any) => rowTime(row, ['updated_at', 'updated_date', 'created_at', 'created_date']);

async function fetchWindow(base44: any, entityName: string) {
  const entity = base44?.asServiceRole?.entities?.[entityName];
  if (!entity?.filter) return { rows: [], entityAvailable: false };
  const seen = new Set<string>();
  const rows: any[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < Math.ceil(SCAN_CAP / PAGE_SIZE) + 2; page += 1) {
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
      if (rows.length >= SCAN_CAP) break;
    }
    cursor = String(batch[batch.length - 1]?.created_date || '') || cursor;
    if (added === 0 || rows.length >= SCAN_CAP || batch.length < PAGE_SIZE) break;
  }
  return { rows, entityAvailable: true };
}

function groupRows(rows: any[], keyFn: (row: any) => string) {
  const groups = new Map<string, any[]>();
  for (const row of rows) {
    const key = keyFn(row);
    if (!key) continue;
    const list = groups.get(key) || [];
    list.push(row);
    groups.set(key, list);
  }
  return groups;
}

// canonicalPick returns the single row to KEEP for a duplicate group.
function pickEarliestCreated(group: any[]) {
  return [...group].sort((a, b) => createdTime(a) - createdTime(b))[0];
}
function pickNewestUpdated(group: any[]) {
  return [...group].sort((a, b) => updatedTime(b) - updatedTime(a))[0];
}
function pickBestQuestRow(group: any[]) {
  return [...group].sort((a, b) => {
    const aCompleted = String(a?.status || '') !== 'active' ? 1 : 0;
    const bCompleted = String(b?.status || '') !== 'active' ? 1 : 0;
    if (aCompleted !== bCompleted) return bCompleted - aCompleted;
    const aProgress = Number(a?.progress_value) || 0;
    const bProgress = Number(b?.progress_value) || 0;
    if (aProgress !== bProgress) return bProgress - aProgress;
    return createdTime(a) - createdTime(b);
  })[0];
}

const CLEANUP_TARGETS = [
  {
    id: 'diamond_transaction_idempotency_key',
    entity: 'DiamondTransaction',
    keyFn: (row: any) => String(row?.idempotency_key || '').trim(),
    pickCanonical: pickEarliestCreated,
    strategy: 'keep earliest ledger row per idempotency_key; later retry echoes deleted; balances untouched',
  },
  {
    id: 'joker_transaction_idempotency_key',
    entity: 'JokerTransaction',
    keyFn: (row: any) => String(row?.idempotency_key || '').trim(),
    pickCanonical: pickEarliestCreated,
    strategy: 'keep earliest ledger row per idempotency_key; balances untouched',
  },
  {
    id: 'user_joker_inventory_user_joker_type',
    entity: 'UserJokerInventory',
    keyFn: (row: any) => {
      const email = normalizeEmail(row?.user_email);
      const jokerType = String(row?.joker_type || '').trim();
      return email && jokerType ? `${email}|${jokerType}` : '';
    },
    pickCanonical: pickNewestUpdated,
    strategy: 'keep newest updated balance row per user_email + joker_type (matches runtime dedupe preference)',
  },
  {
    id: 'user_daily_quest_progress_user_day_task',
    entity: 'UserDailyQuestProgress',
    keyFn: (row: any) => {
      const email = normalizeEmail(row?.user_email);
      const date = String(row?.quest_date || '').trim();
      const questKey = String(row?.quest_key || '').trim();
      return email && date && questKey ? `${email}|${date}|${questKey}` : '';
    },
    pickCanonical: pickBestQuestRow,
    strategy: 'keep best row per user + quest_date + quest_key: completed first, then highest progress, then earliest created',
  },
  {
    id: 'solo_leaderboard_entry_owner_key',
    entity: 'SoloLeaderboardEntry',
    keyFn: (row: any) => String(row?.owner_key || '').trim(),
    pickCanonical: pickNewestUpdated,
    strategy: 'keep newest updated projection row per owner_key (matches getSoloLeaderboard dedupe)',
  },
];

Deno.serve(async (req: Request) => {
  try {
    if (req.method !== 'POST') {
      return json({ ok: false, code: 'method_not_allowed', error: 'Bu islem desteklenmiyor.' }, 405);
    }
    const base44 = createClientFromRequest(req);
    const adminAuth = await requireAdmin(base44);
    if (adminAuth.response) return adminAuth.response;

    const body = await req.json().catch(() => ({}));
    const mode = String(body?.mode || 'dry_run').trim().toLowerCase() === 'execute' ? 'execute' : 'dry_run';
    if (mode === 'execute' && String(body?.confirm || '') !== CONFIRM_TOKEN) {
      return json({
        ok: false,
        code: 'confirmation_required',
        error: `execute modu icin confirm: '${CONFIRM_TOKEN}' gereklidir.`,
      }, 400);
    }
    // Batch cap per run: large cleanups are executed over multiple calls to
    // stay under the function timeout. Re-run until totalPlannedDeletes = 0.
    const maxDeletes = Math.max(20, Math.min(MAX_DELETES_PER_RUN, Math.floor(Number(body?.maxDeletes) || 200)));
    const requestedTargetIds = Array.isArray(body?.targets)
      ? body.targets.map((id: unknown) => String(id || '').trim()).filter(Boolean)
      : [];
    const activeTargets = requestedTargetIds.length
      ? CLEANUP_TARGETS.filter((target) => requestedTargetIds.includes(target.id))
      : CLEANUP_TARGETS;

    const results: any[] = [];
    let totalPlanned = 0;
    let totalDeleted = 0;
    let totalDeleteFailures = 0;

    for (const target of activeTargets) {
      const window = await fetchWindow(base44, target.entity);
      const groups = groupRows(window.rows, target.keyFn);
      const deleteIds: string[] = [];
      const sampleGroups: any[] = [];
      let duplicateGroupCount = 0;

      for (const [key, group] of groups.entries()) {
        if (group.length < 2) continue;
        duplicateGroupCount += 1;
        const keepRow = target.pickCanonical(group);
        const keepId = String(keepRow?.id || keepRow?._id || '');
        const removeIds = group
          .map((row) => String(row?.id || row?._id || ''))
          .filter((id) => id && id !== keepId);
        deleteIds.push(...removeIds);
        if (sampleGroups.length < 5) {
          sampleGroups.push({
            key: maskPrivateKeys(key),
            groupSize: group.length,
            deleteCount: removeIds.length,
          });
        }
      }

      totalPlanned += deleteIds.length;
      const result: Record<string, unknown> = {
        id: target.id,
        entity: target.entity,
        strategy: target.strategy,
        entityAvailable: window.entityAvailable,
        scannedRows: window.rows.length,
        duplicateGroupCount,
        plannedDeleteCount: deleteIds.length,
        sampleGroups,
      };

      if (mode === 'execute' && deleteIds.length > 0) {
        const entity = base44?.asServiceRole?.entities?.[target.entity];
        const cappedIds = deleteIds.slice(0, Math.max(0, maxDeletes - totalDeleted));
        let deleted = 0;
        let failures = 0;
        for (let i = 0; i < cappedIds.length; i += DELETE_CHUNK) {
          const chunk = cappedIds.slice(i, i + DELETE_CHUNK);
          const outcomes = await Promise.all(chunk.map((id) => (
            entity.delete(id).then(() => true).catch(() => false)
          )));
          for (const okDelete of outcomes) {
            if (okDelete) deleted += 1; else failures += 1;
          }
        }
        totalDeleted += deleted;
        totalDeleteFailures += failures;
        result.deletedCount = deleted;
        result.deleteFailures = failures;
        result.deleteCapReached = cappedIds.length < deleteIds.length;
      }

      results.push(result);
    }

    return json({
      ok: true,
      mode,
      executed: mode === 'execute',
      balancesMutated: false,
      scoresMutated: false,
      totalPlannedDeletes: totalPlanned,
      totalDeleted,
      totalDeleteFailures,
      maxDeletesPerRun: MAX_DELETES_PER_RUN,
      scannedAt: new Date().toISOString(),
      results,
    });
  } catch (error) {
    console.error('[adminDuplicateKeyCleanup] failed', (error as any)?.message || error);
    return json({ ok: false, code: 'duplicate_cleanup_failed', error: 'Temizlik calistirilamadi.' }, 500);
  }
});