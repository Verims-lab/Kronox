import { createClientFromRequest } from 'npm:@base44/sdk@0.8.34';

const KRONOX_ID_PATTERN = /^KX-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/;
const DAILY_WHEEL_SOURCE = 'daily_wheel';
const ADMIN_RESET_ACTION = 'admin_reset_daily_wheel_state';
const GUEST_LINKED_STATUS = 'linked';

function json(payload: unknown, status = 200) {
  return Response.json(payload, { status });
}

function normalizeEmail(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function normalizeKronoxUserId(value: unknown) {
  const text = String(value || '').trim().toUpperCase();
  return KRONOX_ID_PATTERN.test(text) ? text : '';
}

function normalizeDayKey(value: unknown) {
  const text = String(value || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
}

function utcDateKey(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

function previousUtcDateKey(dateKey: string) {
  const start = Date.parse(`${dateKey}T00:00:00.000Z`);
  return new Date(start - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function normalizeNumber(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : fallback;
}

function rowId(row: any) {
  return row?.id || row?._id || null;
}

function ownerKeyFromText(prefix: string, rawValue: unknown) {
  const value = String(rawValue || '').trim().toLowerCase();
  if (!value) return '';
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `${prefix}_${(hash >>> 0).toString(36)}`;
}

function ownerKeyFromEmail(value: unknown) {
  return ownerKeyFromText('u', normalizeEmail(value));
}

function ownerKeyFromGuestId(value: unknown) {
  return ownerKeyFromText('g', value);
}

function safeDisplayName(row: any) {
  const value = [
    row?.username,
    row?.display_name,
    row?.displayName,
    row?.name,
  ].map((entry) => String(entry || '').replace(/\s+/g, ' ').trim())
    .find((entry) => entry && !entry.includes('@'));
  return value ? value.slice(0, 32) : 'Oyuncu';
}

function archiveSuffix(timestamp: string) {
  return timestamp.replace(/[^0-9A-Za-z]/g, '').slice(0, 20);
}

function archiveText(prefix: string, original: unknown, timestamp: string, maxLength = 220) {
  const safeOriginal = String(original || '').trim().replace(/[^A-Za-z0-9:_-]/g, '_').slice(0, 150);
  return `${prefix}:${archiveSuffix(timestamp)}:${safeOriginal || 'missing'}`.slice(0, maxLength);
}

function isActiveAdminRole(role: unknown) {
  const value = String(role || '').trim().toLowerCase();
  return value === 'owner' || value === 'admin';
}

function isActiveAdminStatus(status: unknown) {
  return String(status || '').trim().toLowerCase() === 'active';
}

const ADMIN_AUTH_FIELD_CANDIDATES = {
  email: ['email', 'Email', 'user_email', 'admin_email'],
  role: ['role', 'Role', 'user_role'],
  status: ['status', 'Status'],
};

function readAdminAuthField(row: any, candidates: string[]) {
  for (const field of candidates) {
    if (row && Object.prototype.hasOwnProperty.call(row, field)) {
      return { value: row[field], field };
    }
  }
  return { value: undefined, field: '' };
}

async function getAdminAuthorization(base44: any, user: any) {
  const email = normalizeEmail(user?.email);
  if (!email) return { isAdmin: false, row: null, role: '', status: '' };

  const adminEntity = base44?.asServiceRole?.entities?.AdminUser;
  if (!adminEntity?.filter) return { isAdmin: false, row: null, role: '', status: '' };

  let rows: any[] = [];
  for (const field of ADMIN_AUTH_FIELD_CANDIDATES.email) {
    const result = await adminEntity.filter({ [field]: email }, '-updated_at', 10).catch(() => []);
    if (Array.isArray(result) && result.length > 0) {
      rows = result;
      break;
    }
  }

  const exactRows = rows
    .map((candidate) => {
      const emailField = readAdminAuthField(candidate, ADMIN_AUTH_FIELD_CANDIDATES.email);
      const roleField = readAdminAuthField(candidate, ADMIN_AUTH_FIELD_CANDIDATES.role);
      const statusField = readAdminAuthField(candidate, ADMIN_AUTH_FIELD_CANDIDATES.status);
      return {
        candidate,
        email: normalizeEmail(emailField.value),
        role: String(roleField.value || '').trim().toLowerCase(),
        status: String(statusField.value || '').trim().toLowerCase(),
      };
    })
    .filter((candidate) => candidate.email === email);

  const active = exactRows.find((candidate) => (
    isActiveAdminStatus(candidate.status) && isActiveAdminRole(candidate.role)
  )) || null;

  return {
    isAdmin: Boolean(active?.candidate),
    row: active?.candidate || null,
    role: active?.role || '',
    status: active?.status || '',
  };
}

async function requireAdmin(base44: any) {
  try {
    const user = await base44.auth.me();
    if (!user?.email) {
      return { response: json({ ok: false, success: false, code: 'auth_required', error: 'Giris gerekli.' }, 401) };
    }
    const authorization = await getAdminAuthorization(base44, user);
    if (!authorization.isAdmin) {
      return { response: json({ ok: false, success: false, code: 'admin_required', error: 'Admin yetkisi gerekli.' }, 403) };
    }
    return {
      user,
      admin: authorization.row,
      adminRole: authorization.role,
      adminActorEmail: normalizeEmail(user.email),
      adminActorKey: ownerKeyFromEmail(user.email),
    };
  } catch (_error) {
    return { response: json({ ok: false, success: false, code: 'auth_required', error: 'Giris gerekli.' }, 401) };
  }
}

function entityStore(base44: any, entityName: string) {
  return base44?.asServiceRole?.entities?.[entityName] || base44?.entities?.[entityName] || null;
}

async function safeFilter(base44: any, entityName: string, filter: Record<string, unknown>, sort = '-updated_at', limit = 25) {
  const entity = entityStore(base44, entityName);
  if (!entity?.filter) return [];
  const rows = await entity.filter(filter, sort, limit).catch(() => []);
  return Array.isArray(rows) ? rows : [];
}

function uniqueRows(rows: any[]) {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const id = String(rowId(row) || '');
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function userTargetFromRow(row: any) {
  const email = normalizeEmail(row?.email || row?.user_email);
  if (!rowId(row) || !email) return null;
  return {
    row,
    rowId: rowId(row),
    playerType: 'registered',
    economyKey: email,
    kronoxUserId: normalizeKronoxUserId(row?.kronox_user_id),
    username: safeDisplayName(row),
  };
}

function guestTargetFromRow(row: any) {
  const guestId = String(row?.guest_id || '').trim();
  const ownerKey = ownerKeyFromGuestId(guestId);
  if (!rowId(row) || !guestId || !ownerKey) return null;
  return {
    row,
    rowId: rowId(row),
    playerType: 'guest',
    economyKey: `guest:${ownerKey}`,
    ownerKey,
    kronoxUserId: normalizeKronoxUserId(row?.kronox_user_id),
    username: safeDisplayName(row),
  };
}

async function resolveTarget(base44: any, kronoxUserId: string) {
  const userRows = uniqueRows((await safeFilter(base44, 'User', { kronox_user_id: kronoxUserId }, '-updated_at', 10))
    .filter((row) => normalizeKronoxUserId(row?.kronox_user_id) === kronoxUserId));
  if (userRows.length > 1) {
    return { response: json({ ok: false, success: false, code: 'ambiguous_target', error: 'Bu Kullanici ID icin birden fazla kayit bulundu.' }, 409) };
  }
  if (userRows.length === 1) {
    const target = userTargetFromRow(userRows[0]);
    if (!target) return { response: json({ ok: false, success: false, code: 'invalid_target', error: 'Kullanici kaydi dogrulanamadi.' }, 409) };
    return { target };
  }

  const guestRows = uniqueRows((await safeFilter(base44, 'GuestProfile', { kronox_user_id: kronoxUserId }, '-updated_at', 10))
    .filter((row) => normalizeKronoxUserId(row?.kronox_user_id) === kronoxUserId));
  const activeGuests = guestRows.filter((row) => (
    String(row?.status || '').trim().toLowerCase() !== GUEST_LINKED_STATUS && !normalizeEmail(row?.linked_user_email)
  ));
  if (activeGuests.length > 1) {
    return { response: json({ ok: false, success: false, code: 'ambiguous_target', error: 'Bu Kullanici ID icin birden fazla guest kaydi bulundu.' }, 409) };
  }
  if (activeGuests.length === 1) {
    const target = guestTargetFromRow(activeGuests[0]);
    if (!target) return { response: json({ ok: false, success: false, code: 'invalid_target', error: 'Guest kaydi dogrulanamadi.' }, 409) };
    return { target };
  }
  if (guestRows.length > 0) {
    return {
      response: json({
        ok: false,
        success: false,
        code: 'linked_guest_canonical_user_missing',
        error: 'Bu ID bagli guest kaydinda gorunuyor; kayitli kullanici kaydi dogrulanamadi.',
      }, 409),
    };
  }
  return { response: json({ ok: false, success: false, code: 'target_not_found', error: 'Kullanici ID bulunamadi.' }, 404) };
}

function buildDailyWheelIdempotencyKey(economyActorKey: string, dayKey: string) {
  return `daily_wheel:${economyActorKey}:${dayKey}`;
}

async function findTodaySpinRows(base44: any, target: any, dayKey: string, idempotencyKey: string) {
  const rows = await Promise.all([
    safeFilter(base44, 'DailyWheelSpin', { user_email: target.economyKey, idempotency_key: idempotencyKey }, '-claimed_at', 20),
    safeFilter(base44, 'DailyWheelSpin', { user_email: target.economyKey, spin_date: dayKey }, '-claimed_at', 20),
  ]);
  return uniqueRows(rows.flat());
}

async function findTodayDiamondTransactions(base44: any, target: any, idempotencyKey: string) {
  const rows = await safeFilter(base44, 'DiamondTransaction', {
    user_email: target.economyKey,
    idempotency_key: idempotencyKey,
  }, '-created_at', 20);
  return uniqueRows(rows.filter((row) => String(row?.source || '') === DAILY_WHEEL_SOURCE));
}

async function findTodayJokerTransactions(base44: any, target: any, idempotencyKey: string) {
  const rows = await safeFilter(base44, 'JokerTransaction', {
    user_email: target.economyKey,
    reason: DAILY_WHEEL_SOURCE,
  }, '-created_at', 100);
  return uniqueRows(rows.filter((row) => String(row?.idempotency_key || '').startsWith(`${idempotencyKey}:joker:`)));
}

async function archiveRows(base44: any, entityName: string, rows: any[], nowIso: string, context: Record<string, unknown>) {
  const entity = entityStore(base44, entityName);
  if (!entity?.update) return { available: false, archived: 0 };
  let archived = 0;
  for (const row of rows) {
    const id = rowId(row);
    if (!id) continue;
    const metadata = row?.metadata && typeof row.metadata === 'object' ? row.metadata : {};
    const originalIdempotencyKey = String(row?.idempotency_key || '');
    const originalSpinDate = String(row?.spin_date || '');
    const patch: Record<string, unknown> = {
      idempotency_key: archiveText('admin_reset_daily_wheel', originalIdempotencyKey, nowIso),
      metadata: {
        ...metadata,
        adminDailyWheelReset: {
          ...context,
          resetAt: nowIso,
          originalIdempotencyKey,
          originalSpinDate,
          preservesCompletedRewardRecord: true,
          doesNotReverseRewards: true,
          doesNotGrantRewards: true,
          noKronoxPuan: true,
          noLeaderboardImpact: true,
        },
      },
      description: `${String(row?.description || entityName).slice(0, 80)}:${ADMIN_RESET_ACTION}`,
    };
    if (entityName === 'DailyWheelSpin') {
      patch.spin_date = archiveText('admin_reset_day', originalSpinDate || context.dayKey, nowIso, 96);
    }
    await entity.update(id, patch);
    archived += 1;
  }
  return { available: true, archived };
}

function deriveStreakBeforeReset(target: any, spinRows: any[], dayKey: string) {
  const sorted = [...spinRows].sort((a, b) => Date.parse(String(b?.claimed_at || '')) - Date.parse(String(a?.claimed_at || '')));
  const fromSpin = sorted.find((row) => Number.isFinite(Number(row?.streak_before)));
  if (fromSpin) return normalizeNumber(fromSpin.streak_before);
  if (String(target?.row?.daily_wheel_last_spin_date || '') === dayKey) {
    return Math.max(0, normalizeNumber(target?.row?.daily_wheel_streak) - 1);
  }
  return normalizeNumber(target?.row?.daily_wheel_streak);
}

async function resetTargetDailyWheelGuard(base44: any, target: any, dayKey: string, nowIso: string, spinRows: any[]) {
  const entityName = target.playerType === 'guest' ? 'GuestProfile' : 'User';
  const entity = entityStore(base44, entityName);
  if (!entity?.update || !target.rowId) return { available: false, updated: false };
  const priorStreak = deriveStreakBeforeReset(target, spinRows, dayKey);
  const priorDate = priorStreak > 0 ? previousUtcDateKey(dayKey) : '';
  await entity.update(target.rowId, {
    daily_wheel_last_spin_at: priorDate ? `${priorDate}T23:59:59.000Z` : '',
    daily_wheel_last_spin_date: priorDate,
    daily_wheel_next_available_at: '',
    daily_wheel_streak: priorStreak,
    daily_wheel_auto_popup_reset_at: nowIso,
    daily_wheel_admin_reset_at: nowIso,
    ...(target.playerType === 'guest' ? { last_seen_at: nowIso } : {}),
  });
  return {
    available: true,
    updated: true,
    priorStreak,
    restoredLastSpinDate: priorDate,
  };
}

async function createAdminAuditLog(base44: any, adminAuth: any, target: any, summary: Record<string, unknown>) {
  const entity = entityStore(base44, 'AdminMaintenanceLog');
  if (!entity?.create) return { available: false, created: false };
  const created = await entity.create({
    action: ADMIN_RESET_ACTION,
    admin_email: adminAuth.adminActorEmail,
    target_email: target.playerType === 'registered' ? target.economyKey : `kronox:${target.kronoxUserId}`,
    result: 'success',
    metadata: {
      ...summary,
      adminActorKey: adminAuth.adminActorKey,
      targetKronoxUserId: target.kronoxUserId,
      targetPlayerType: target.playerType,
      noRewardReversal: true,
      grantsRewards: false,
      noDailyQuestImpact: true,
      noKronoxPuan: true,
      noLeaderboardImpact: true,
      noPrivatePublicResponseIds: true,
    },
    created_at: String(summary.resetAt || new Date().toISOString()),
    description: ADMIN_RESET_ACTION,
  }).catch(() => null);
  return { available: true, created: Boolean(created) };
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method !== 'POST') {
      return json({ ok: false, success: false, code: 'method_not_allowed', error: 'Bu islem desteklenmiyor.' }, 405);
    }

    const base44 = createClientFromRequest(req);
    const adminAuth = await requireAdmin(base44);
    if (adminAuth.response) return adminAuth.response;

    const body = await req.json().catch(() => ({}));
    const kronoxUserId = normalizeKronoxUserId(body?.kronox_user_id || body?.kronoxUserId);
    const dayKey = normalizeDayKey(body?.dayKey || body?.date) || utcDateKey();
    if (!kronoxUserId) {
      return json({ ok: false, success: false, code: 'invalid_kronox_user_id', error: 'Gecerli Kullanici ID gerekli.' }, 400);
    }

    const resolved = await resolveTarget(base44, kronoxUserId);
    if (resolved.response) return resolved.response;
    const target = resolved.target;
    const nowIso = new Date().toISOString();
    const idempotencyKey = buildDailyWheelIdempotencyKey(target.economyKey, dayKey);

    const [spinRows, diamondTransactions, jokerTransactions] = await Promise.all([
      findTodaySpinRows(base44, target, dayKey, idempotencyKey),
      findTodayDiamondTransactions(base44, target, idempotencyKey),
      findTodayJokerTransactions(base44, target, idempotencyKey),
    ]);

    const resetContext = {
      action: ADMIN_RESET_ACTION,
      dayKey,
      targetKronoxUserId: target.kronoxUserId,
      targetPlayerType: target.playerType,
    };
    const [spinArchive, diamondArchive, jokerArchive, guardReset] = await Promise.all([
      archiveRows(base44, 'DailyWheelSpin', spinRows, nowIso, resetContext),
      archiveRows(base44, 'DiamondTransaction', diamondTransactions, nowIso, resetContext),
      archiveRows(base44, 'JokerTransaction', jokerTransactions, nowIso, resetContext),
      resetTargetDailyWheelGuard(base44, target, dayKey, nowIso, spinRows),
    ]);

    const resetItems = {
      freeSpinStateReset: Boolean(guardReset.updated),
      autoPopupStateReset: Boolean(guardReset.updated),
      pendingWheelStateCleared: spinArchive.archived > 0 || diamondArchive.archived > 0 || jokerArchive.archived > 0,
      pendingGiftBoxStateHandled: spinRows.some((row) => String(row?.gift_box_status || row?.metadata?.giftBox?.status || '') !== ''),
      adFutureStateReset: false,
      archivedDailyWheelSpinRows: spinArchive.archived,
      archivedDiamondLedgerRows: diamondArchive.archived,
      archivedJokerLedgerRows: jokerArchive.archived,
    };

    const summary = {
      resetAt: nowIso,
      dayKey,
      resetItems,
      guardReset,
      doesNotReverseRewards: true,
      grantsRewards: false,
      noDailyQuestImpact: true,
      noKronoxPuan: true,
      noLeaderboardImpact: true,
    };
    const log = await createAdminAuditLog(base44, adminAuth, target, summary);

    return json({
      ok: true,
      success: true,
      targetKronoxUserId: target.kronoxUserId,
      targetPlayerType: target.playerType,
      targetUsername: target.username,
      dayKey,
      resetAt: nowIso,
      resetItems,
      message: 'Günlük çark test durumu sıfırlandı. Daha önce kazanılan ödüller geri alınmadı.',
      doesNotReverseRewards: true,
      grantsRewards: false,
      noDailyQuestImpact: true,
      noKronoxPuan: true,
      noLeaderboardImpact: true,
      log,
    });
  } catch (error) {
    console.error('[adminResetDailyWheelState] failed', error?.message || error);
    return json({
      ok: false,
      success: false,
      code: 'admin_daily_wheel_reset_failed',
      error: 'Günlük çark sıfırlanamadı.',
    }, 500);
  }
});
