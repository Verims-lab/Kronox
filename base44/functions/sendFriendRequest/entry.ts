import { createClientFromRequest } from 'npm:@base44/sdk@0.8.34';

const USERNAME_NOT_FOUND_MESSAGE = 'Kronox’ta bu kullanıcı adıyla biri yok.';
const OPEN_INVITE_EXISTS_MESSAGE = 'Bu kişiye gönderilmiş açık davet var.';
const EXPIRED_INVITE_REQUIRES_DELETE_MESSAGE = 'Bu kişiye süresi dolmuş bir davetin var. Yeniden davet göndermeden önce eski daveti silmelisin.';
const FRIEND_REQUEST_IN_PROGRESS_MESSAGE = 'Arkadaşlık isteği işleniyor. Lütfen tekrar dene.';
const FRIEND_REQUEST_TTL_MS = 3 * 24 * 60 * 60 * 1000;
const FRIEND_REQUEST_LOCK_TTL_MS = 8_000;
const FRIEND_REQUEST_LOCK_SETTLE_MS = 80;
const UNSAFE_PUBLIC_USERNAME_PATTERN = /^(apple|google|firebase|auth0|base44|provider|uid|owner)(?:[\w:-].*)?$/i;
const INTERNAL_ID_PUBLIC_USERNAME_PATTERN = /^(guest|player|owner|user_key|player_key|g|u)_[A-Za-z0-9_-]{4,}$/i;

const normalizeEmail = (value: unknown) => String(value || '').trim().toLowerCase();
const json = (payload: unknown, status = 200) => Response.json(payload, { status });

function isValidEmail(value: unknown) {
  const email = normalizeEmail(value);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalizeUsernameInput(value: unknown) {
  const explicitName = String(value || '').trim();
  if (
    explicitName
      && explicitName.length >= 3
      && explicitName.length <= 24
      && /^[A-Za-z0-9_]+$/.test(explicitName)
      && !explicitName.includes('@')
      && !UNSAFE_PUBLIC_USERNAME_PATTERN.test(explicitName)
      && !INTERNAL_ID_PUBLIC_USERNAME_PATTERN.test(explicitName)
  ) {
    return explicitName;
  }
  return '';
}

function normalizeUsernameKey(value: unknown) {
  return normalizeUsernameInput(value).toLowerCase();
}

function makeUsernameFallback(seed: unknown) {
  const text = String(seed || '').trim();
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `KronoxUser${1000 + ((hash >>> 0) % 90000)}`;
}

function safePublicUsername(value: unknown, fallbackSeed: unknown) {
  return normalizeUsernameInput(value) || makeUsernameFallback(fallbackSeed);
}

function sanitizeAppUrl(raw: unknown) {
  const s = String(raw || '').trim();
  if (!s) return null;
  try {
    const u = new URL(s);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    u.search = '';
    u.hash = '';
    return u.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}

function escapeText(value: unknown) {
  return String(value || '').replace(/[\u0000-\u001F\u007F]/g, '').slice(0, 200);
}

function parseTime(raw: unknown) {
  if (!raw) return NaN;
  if (raw instanceof Date) return raw.getTime();
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : NaN;
  const text = String(raw || '').trim();
  if (!text) return NaN;
  let normalized = text;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(text)) {
    normalized = `${text}Z`;
  }
  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function getFriendRequestExpiresAt(row: any) {
  return parseTime(row?.expires_at || row?.expiresAt);
}

function isFriendRequestExpired(row: any, nowMs: number) {
  const status = String(row?.status || '').toLowerCase();
  if (status === 'expired') return true;
  const expiresAt = getFriendRequestExpiresAt(row);
  return Number.isFinite(expiresAt) && expiresAt <= nowMs;
}

function findOutgoingInviteConflict(rows: any[], nowMs: number) {
  const candidates = (Array.isArray(rows) ? rows : []).filter(Boolean);
  const expired = candidates.find((row) => isFriendRequestExpired(row, nowMs));
  if (expired) return { type: 'expired', row: expired };
  const open = candidates.find((row) => String(row?.status || '').toLowerCase() === 'pending');
  if (open) return { type: 'open', row: open };
  return null;
}

function findOpenReversePendingRequest(rows: any[], nowMs: number) {
  return (Array.isArray(rows) ? rows : []).find((row) => (
    String(row?.status || '').toLowerCase() === 'pending'
    && !isFriendRequestExpired(row, nowMs)
  )) || null;
}

async function markExpiredFriendRequestRows(base44: any, rows: any[], nowMs: number) {
  const expiredRows = (Array.isArray(rows) ? rows : []).filter((row) => isFriendRequestExpired(row, nowMs));
  if (!expiredRows.length) return;
  await Promise.all(expiredRows.map(async (row) => {
    const id = row?.id || row?._id;
    if (!id) return;
    await base44.asServiceRole.entities.FriendRequest.update(id, {
      status: 'expired',
      expired_at: new Date(nowMs).toISOString(),
    }).catch(() => null);
  }));
}

function nowIso() {
  return new Date().toISOString();
}

function rowId(row: any) {
  return row?.id || row?._id || null;
}

function safeLockText(value: unknown, fallback = '') {
  const text = String(value || '').trim();
  return text ? text.slice(0, 220) : fallback;
}

function hashLockComponent(value: unknown) {
  const text = normalizeEmail(value) || String(value || '').trim().toLowerCase();
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function buildFriendRequestLockKey(fromEmail: string, targetEmail: string) {
  return `friend_request:${hashLockComponent(fromEmail)}:${hashLockComponent(targetEmail)}`;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function friendRequestOperationLockEntity(base44: any) {
  // FriendRequestOperationLock is a function-level race guard. It narrows
  // duplicate-send windows but does not claim DB-level uniqueness.
  const serviceEntity = base44?.asServiceRole?.entities ? base44.asServiceRole.entities.FriendRequestOperationLock : null;
  const authEntity = base44?.entities ? base44.entities.FriendRequestOperationLock : null;
  return serviceEntity || authEntity;
}

function isSameLockRow(a: any, b: any) {
  const left = rowId(a);
  const right = rowId(b);
  if (left && right) return left === right;
  return Boolean(a?.operation_id && b?.operation_id && a.operation_id === b.operation_id && a.lock_key === b.lock_key);
}

function isActiveFriendRequestLock(row: any, nowMs: number) {
  if (String(row?.status || '') !== 'active') return false;
  const expiresMs = Date.parse(String(row?.expires_at || ''));
  return Number.isFinite(expiresMs) ? expiresMs > nowMs : true;
}

function selectCanonicalFriendRequestLock(rows: any[], nowMs: number) {
  return (Array.isArray(rows) ? rows : [])
    .filter((row) => isActiveFriendRequestLock(row, nowMs))
    .sort((a, b) => {
      const acquiredDiff = Date.parse(String(a?.acquired_at || '')) - Date.parse(String(b?.acquired_at || ''));
      if (Number.isFinite(acquiredDiff) && acquiredDiff !== 0) return acquiredDiff;
      return String(rowId(a) || a?.operation_id || '').localeCompare(String(rowId(b) || b?.operation_id || ''));
    })[0] || null;
}

async function findFriendRequestOperationLocks(base44: any, lockKey: string) {
  const entity = friendRequestOperationLockEntity(base44);
  if (!entity?.filter) return [];
  const rows = await entity.filter({ lock_key: lockKey }, '-acquired_at', 25).catch(() => []);
  return Array.isArray(rows) ? rows : [];
}

async function markExpiredFriendRequestOperationLocks(base44: any, lockKey: string, nowMs: number) {
  const entity = friendRequestOperationLockEntity(base44);
  if (!entity?.update) return;
  const now = new Date(nowMs).toISOString();
  const rows = await findFriendRequestOperationLocks(base44, lockKey);
  await Promise.all(rows
    .filter((row) => String(row?.status || '') === 'active')
    .filter((row) => {
      const expiresMs = Date.parse(String(row?.expires_at || ''));
      return Number.isFinite(expiresMs) && expiresMs <= nowMs;
    })
    .map((row) => entity.update(rowId(row), {
      status: 'stale',
      released_at: now,
      metadata: {
        ...(row?.metadata && typeof row.metadata === 'object' ? row.metadata : {}),
        staleRecovery: true,
      },
    }).catch(() => null)));
}

async function releaseFriendRequestOperationLock(base44: any, lock: any, status = 'released') {
  const entity = friendRequestOperationLockEntity(base44);
  const id = rowId(lock);
  if (!entity?.update || !id) return;
  await entity.update(id, {
    status,
    released_at: nowIso(),
  }).catch(() => null);
}

async function acquireFriendRequestOperationLock(base44: any, lockKey: string, context: Record<string, unknown>) {
  const entity = friendRequestOperationLockEntity(base44);
  if (!entity?.filter || !entity?.create || !entity?.update) {
    return { ok: false, code: 'friend_request_lock_unavailable', lock: null };
  }
  const now = nowIso();
  const nowMs = Date.parse(now);
  await markExpiredFriendRequestOperationLocks(base44, lockKey, nowMs);
  const existing = selectCanonicalFriendRequestLock(await findFriendRequestOperationLocks(base44, lockKey), nowMs);
  if (existing) return { ok: false, code: 'FRIEND_REQUEST_IN_PROGRESS', lock: existing };

  const created = await entity.create({
    lock_key: lockKey,
    actor_key_hash: safeLockText(context.actorKeyHash, ''),
    target_key_hash: safeLockText(context.targetKeyHash, ''),
    operation_scope: 'friend_request_send',
    operation_id: safeLockText(context.operationId, lockKey),
    status: 'active',
    acquired_at: now,
    expires_at: new Date(nowMs + FRIEND_REQUEST_LOCK_TTL_MS).toISOString(),
    metadata: {
      phase: 'friend_request_parallel_race_guard_phase_1',
      ttlMs: FRIEND_REQUEST_LOCK_TTL_MS,
      ...(context.metadata && typeof context.metadata === 'object' ? context.metadata : {}),
    },
  });
  await sleep(FRIEND_REQUEST_LOCK_SETTLE_MS);
  const canonical = selectCanonicalFriendRequestLock(await findFriendRequestOperationLocks(base44, lockKey), Date.now());
  if (!isSameLockRow(canonical, created)) {
    await releaseFriendRequestOperationLock(base44, created, 'released');
    return { ok: false, code: 'FRIEND_REQUEST_IN_PROGRESS', lock: canonical };
  }
  return { ok: true, code: 'locked', lock: created };
}

async function withFriendRequestOperationLock(
  base44: any,
  lockKey: string,
  context: Record<string, unknown>,
  callback: () => Promise<Response>,
) {
  const lockResult = await acquireFriendRequestOperationLock(base44, lockKey, context);
  if (!lockResult.ok) {
    const unavailable = lockResult.code === 'friend_request_lock_unavailable';
    const error = unavailable
      ? 'Arkadaşlık isteği şu an doğrulanamıyor. Lütfen tekrar dene.'
      : FRIEND_REQUEST_IN_PROGRESS_MESSAGE;
    return json({
      ok: false,
      code: lockResult.code,
      error,
      message: error,
      privacy: {
        targetEmailReturned: false,
        publicIdentity: 'username',
      },
    }, 409);
  }
  try {
    return await callback();
  } finally {
    await releaseFriendRequestOperationLock(base44, lockResult.lock);
  }
}

function conflictResponse({
  code,
  error,
  inputKind,
  target,
  request,
}: {
  code: string;
  error: string;
  inputKind: string;
  target: { username: string; registered: boolean };
  request?: any;
}) {
  return {
    ok: false,
    code,
    error,
    message: error,
    requestStatus: request?.status || null,
    requestId: request?.id || request?._id || null,
    inputKind,
    targetLabel: target.username,
    recipientRegistered: target.registered,
    privacy: {
      targetEmailReturned: false,
      publicIdentity: 'username',
    },
  };
}

async function findCurrentUser(base44: any, authUser: any, email: string) {
  if (authUser?.id || authUser?._id) {
    try {
      const row = await base44.asServiceRole.entities.User.get(authUser.id || authUser._id);
      if (row) return row;
    } catch {
      // Fall through to email lookup.
    }
  }
  const rows = await base44.asServiceRole.entities.User.filter({ email }, '-updated_date', 1).catch(() => []);
  return rows?.[0] || authUser || null;
}

async function findTargetByEmail(base44: any, email: string) {
  const rows = await base44.asServiceRole.entities.User.filter({ email }, '-updated_date', 1).catch(() => []);
  const user = rows?.[0] || null;
  return {
    email,
    username: user ? safePublicUsername(user.username || user.public_username || user.display_name, email) : makeUsernameFallback(email),
    registered: Boolean(user),
  };
}

async function findTargetByUsername(base44: any, username: string) {
  const usernameKey = normalizeUsernameKey(username);
  if (!usernameKey) {
    return { ok: false, code: 'invalid_username', error: 'Geçerli bir kullanıcı adı gir.' };
  }
  const [normalizedRows, usernameRows, publicUsernameRows] = await Promise.all([
    base44.asServiceRole.entities.User.filter({ username_normalized: usernameKey }, '-updated_date', 2).catch(() => []),
    base44.asServiceRole.entities.User.filter({ username }, '-updated_date', 2).catch(() => []),
    base44.asServiceRole.entities.User.filter({ public_username: username }, '-updated_date', 2).catch(() => []),
  ]);
  const rows = [...(normalizedRows || []), ...(usernameRows || []), ...(publicUsernameRows || [])];
  const exact = (rows || []).find((row: any) => normalizeUsernameKey(row?.username) === usernameKey || normalizeUsernameKey(row?.public_username) === usernameKey) || rows?.[0] || null;
  if (!exact?.email) {
    return { ok: false, code: 'username_not_found', error: USERNAME_NOT_FOUND_MESSAGE };
  }
  return {
    ok: true,
    target: {
      email: normalizeEmail(exact.email),
      username: safePublicUsername(exact.username || exact.public_username || exact.display_name, username),
      registered: true,
    },
  };
}

async function sendFriendRequestEmail(base44: any, { toEmail, senderName, appUrl }: { toEmail: string; senderName: string; appUrl: string }) {
  const deepLink = `${appUrl}/friends`;
  const subject = 'Kronox arkadaşlık isteğin var';
  const bodyText = [
    `${escapeText(senderName)} sana Kronox'ta arkadaşlık isteği gönderdi.`,
    '',
    'Kabul etmek için Kronox\'u aç:',
    deepLink,
    '',
    'Uygulama yüklü değilse bu bağlantıdan Kronox\'u web üzerinden açabilir veya ana ekrana ekleyebilirsin.',
  ].join('\n');

  try {
    await base44.integrations.Core.SendEmail({
      from_name: 'Kronox',
      to: toEmail,
      subject,
      body: bodyText,
    });
    return { emailSent: true, emailError: null };
  } catch (mailErr) {
    const reason = mailErr instanceof Error ? mailErr.message : 'send failed';
    console.error('[sendFriendRequest] SendEmail failed:', reason);
    return { emailSent: false, emailError: 'email_failed' };
  }
}

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return json({ ok: false, code: 'method_not_allowed', error: 'Bu işlem desteklenmiyor.' }, 405);
    }

    const base44 = createClientFromRequest(req);
    const authUser = await base44.auth.me().catch(() => null);
    const fromEmail = normalizeEmail(authUser?.email || authUser?.user_email);
    if (!authUser || !fromEmail) return json({ ok: false, code: 'unauthorized', error: 'Önce giriş yapmalısın.' }, 401);

    const body = await req.json().catch(() => ({}));
    const rawInput = String(body?.target || body?.toEmail || '').trim();
    const inputKind = rawInput.includes('@') ? 'email' : 'username';
    if (!rawInput) return json({ ok: false, code: 'empty_target', error: 'E-posta veya kullanıcı adı gir.' }, 400);

    const currentUser = await findCurrentUser(base44, authUser, fromEmail);
    const senderName = safePublicUsername(
      currentUser?.username || currentUser?.public_username || authUser?.username || authUser?.public_username || authUser?.full_name,
      fromEmail,
    );

    let target: { email: string; username: string; registered: boolean };
    if (inputKind === 'email') {
      const targetEmail = normalizeEmail(rawInput);
      if (!isValidEmail(targetEmail)) return json({ ok: false, code: 'invalid_email', error: 'Geçerli bir e-posta adresi gir.' }, 400);
      target = await findTargetByEmail(base44, targetEmail);
    } else {
      const result = await findTargetByUsername(base44, rawInput);
      if (!result.ok) return json({ ok: false, code: result.code, error: result.error }, result.code === 'username_not_found' ? 404 : 400);
      target = result.target;
    }

    const targetEmail = normalizeEmail(target.email);
    if (!targetEmail) return json({ ok: false, code: 'target_not_found', error: USERNAME_NOT_FOUND_MESSAGE }, 404);
    if (targetEmail === fromEmail) return json({ ok: false, code: 'self_add', error: 'Kendini ekleyemezsin.' }, 400);

    const lockKey = buildFriendRequestLockKey(fromEmail, targetEmail);
    return await withFriendRequestOperationLock(base44, lockKey, {
      actorKeyHash: hashLockComponent(fromEmail),
      targetKeyHash: hashLockComponent(targetEmail),
      operationId: lockKey,
      metadata: {
        inputKind,
        targetRegistered: target.registered,
        targetEmailReturned: false,
      },
    }, async () => {
      const [acceptedOut, acceptedIn] = await Promise.all([
        base44.asServiceRole.entities.FriendRequest.filter({ from_email: fromEmail, to_email: targetEmail, status: 'accepted' }, '-updated_date', 1),
        base44.asServiceRole.entities.FriendRequest.filter({ from_email: targetEmail, to_email: fromEmail, status: 'accepted' }, '-updated_date', 1),
      ]);
      const existingFriend = acceptedOut?.[0] || acceptedIn?.[0] || null;
      if (existingFriend) {
        return json({ ok: false, code: 'already_friends', error: 'Bu kullanıcı zaten arkadaşın.' }, 409);
      }

      const [pendingOut, expiredOut, pendingIn] = await Promise.all([
        base44.asServiceRole.entities.FriendRequest.filter({ from_email: fromEmail, to_email: targetEmail, status: 'pending' }, '-created_date', 20),
        base44.asServiceRole.entities.FriendRequest.filter({ from_email: fromEmail, to_email: targetEmail, status: 'expired' }, '-created_date', 20).catch(() => []),
        base44.asServiceRole.entities.FriendRequest.filter({ from_email: targetEmail, to_email: fromEmail, status: 'pending' }, '-created_date', 20),
      ]);
      const nowMs = Date.now();
      const outgoingConflict = findOutgoingInviteConflict([...(pendingOut || []), ...(expiredOut || [])], nowMs);
      if (outgoingConflict?.type === 'expired') {
        return json(conflictResponse({
          code: 'EXPIRED_INVITE_REQUIRES_DELETE',
          error: EXPIRED_INVITE_REQUIRES_DELETE_MESSAGE,
          inputKind,
          target,
          request: outgoingConflict.row,
        }), 409);
      }
      if (outgoingConflict?.type === 'open') {
        // Duplicate open outgoing request guard: do NOT create a second
        // FriendRequest. Return a typed safe error and never leak target email.
        return json(conflictResponse({
          code: 'OPEN_INVITE_EXISTS',
          error: OPEN_INVITE_EXISTS_MESSAGE,
          inputKind,
          target,
          request: outgoingConflict.row,
        }), 409);
      }
      const reversePending = findOpenReversePendingRequest(pendingIn || [], nowMs);
      if (!reversePending) {
        await markExpiredFriendRequestRows(base44, pendingIn || [], nowMs);
      }
      if (reversePending) {
        return json({ ok: false, code: 'reverse_pending', error: 'Bu kişi sana zaten istek göndermiş — Gelen İstekler listesinden kabul et.' }, 409);
      }

      const expiresAt = new Date(nowMs + FRIEND_REQUEST_TTL_MS);
      const created = await base44.asServiceRole.entities.FriendRequest.create({
        from_email: fromEmail,
        from_name: senderName,
        from_username: senderName,
        to_email: targetEmail,
        to_name: target.username,
        to_username: target.username,
        status: 'pending',
        expires_at: expiresAt.toISOString(),
      });

      const appUrl = sanitizeAppUrl(body?.appUrl) || 'https://kronox.base44.app';
      const emailResult = await sendFriendRequestEmail(base44, {
        toEmail: targetEmail,
        senderName,
        appUrl,
      });

      return json({
        ok: true,
        requestId: created?.id || created?._id || null,
        requestStatus: 'pending',
        inputKind,
        targetLabel: target.username,
        recipientRegistered: target.registered,
        emailSent: emailResult.emailSent,
        emailError: emailResult.emailError,
        expires_at: expiresAt.toISOString(),
        privacy: {
          targetEmailReturned: false,
          publicIdentity: 'username',
        },
      });
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Arkadaşlık isteği gönderilemedi.';
    console.error('[sendFriendRequest] failed:', message);
    return json({ ok: false, code: 'friend_request_failed', error: 'Arkadaşlık isteği gönderilemedi. Lütfen tekrar dene.' }, 500);
  }
});
