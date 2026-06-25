import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const USERNAME_NOT_FOUND_MESSAGE = 'Kronox’ta bu kullanıcı adıyla biri yok.';
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

    const [acceptedOut, acceptedIn] = await Promise.all([
      base44.asServiceRole.entities.FriendRequest.filter({ from_email: fromEmail, to_email: targetEmail, status: 'accepted' }, '-updated_date', 1),
      base44.asServiceRole.entities.FriendRequest.filter({ from_email: targetEmail, to_email: fromEmail, status: 'accepted' }, '-updated_date', 1),
    ]);
    const existingFriend = acceptedOut?.[0] || acceptedIn?.[0] || null;
    if (existingFriend) {
      return json({ ok: false, code: 'already_friends', error: 'Bu kullanıcı zaten arkadaşın.' }, 409);
    }

    const [pendingOut, pendingIn] = await Promise.all([
      base44.asServiceRole.entities.FriendRequest.filter({ from_email: fromEmail, to_email: targetEmail, status: 'pending' }, '-created_date', 1),
      base44.asServiceRole.entities.FriendRequest.filter({ from_email: targetEmail, to_email: fromEmail, status: 'pending' }, '-created_date', 1),
    ]);
    if (pendingOut?.[0]) {
      return json({
        ok: true,
        alreadyPending: true,
        requestStatus: 'pending',
        inputKind,
        targetLabel: target.username,
        recipientRegistered: target.registered,
        emailSent: false,
        emailError: null,
        privacy: {
          targetEmailReturned: false,
          publicIdentity: 'username',
        },
      });
    }
    if (pendingIn?.[0]) {
      return json({ ok: false, code: 'reverse_pending', error: 'Bu kişi sana zaten istek göndermiş — Gelen İstekler listesinden kabul et.' }, 409);
    }

    const created = await base44.asServiceRole.entities.FriendRequest.create({
      from_email: fromEmail,
      from_name: senderName,
      from_username: senderName,
      to_email: targetEmail,
      to_name: target.username,
      to_username: target.username,
      status: 'pending',
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
      privacy: {
        targetEmailReturned: false,
        publicIdentity: 'username',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Arkadaşlık isteği gönderilemedi.';
    console.error('[sendFriendRequest] failed:', message);
    return json({ ok: false, code: 'friend_request_failed', error: 'Arkadaşlık isteği gönderilemedi. Lütfen tekrar dene.' }, 500);
  }
});
