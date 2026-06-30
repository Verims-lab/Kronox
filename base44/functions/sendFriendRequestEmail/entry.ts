// Codex087 — Friend request email notification.
//
// Security model:
//  - Authenticated user only (must be the sender).
//  - The function verifies that an actual pending FriendRequest exists from
//    the authenticated user to the provided `toEmail`. This prevents using
//    this endpoint as an open email spammer.
//  - `appUrl` is sanitized to https://... and used to build a single safe
//    deep link to /friends (the Friends inbox surface). No raw user input
//    is rendered into the email body.
//  - Email is sent via the built-in Base44 SendEmail integration. If it
//    fails, we return ok:false with a short reason — the client treats
//    this as a soft warning and does NOT roll back the FriendRequest.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.34';

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

function json(payload, status = 200) {
  return Response.json(payload, { status });
}

// Trusted base domain for app deep links. The client may NOT redirect this
// to an arbitrary host: appUrl is only honored when it resolves to the
// official Kronox domain. Anything else — including any other *.base44.app
// subdomain — is rejected so notification emails can never carry a
// phishing link (CWE-601 open redirect).
const KRONOX_DEFAULT_APP_URL = 'https://kronox.base44.app';
const KRONOX_TRUSTED_APP_HOSTS = ['kronox.base44.app'];

function isTrustedAppHost(hostname) {
  const host = String(hostname || '').trim().toLowerCase();
  return KRONOX_TRUSTED_APP_HOSTS.includes(host);
}

function sanitizeAppUrl(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  try {
    const u = new URL(s);
    // Only https and only a trusted Kronox/base44 host — block open redirects.
    if (u.protocol !== 'https:') return null;
    if (!isTrustedAppHost(u.hostname)) return null;
    // Strip query/hash — we control the deep link ourselves.
    u.search = '';
    u.hash = '';
    // Strip trailing slash for clean concatenation.
    return u.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}

function escapeText(s) {
  // Plain-text email body; just defang any control characters.
  return String(s || '').replace(/[\u0000-\u001F\u007F]/g, '').slice(0, 200);
}

function safePublicActorName(value, fallback = 'Bir oyuncu') {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim();
  if (
    normalized &&
    /^[A-Za-z0-9_]{3,24}$/.test(normalized) &&
    !normalized.includes('@') &&
    !/^(apple|google|firebase|auth0|base44|provider|uid|owner)(?:[\w:-].*)?$/i.test(normalized) &&
    !/^(guest|player|owner|user_key|player_key|g|u)_[A-Za-z0-9_-]{4,}$/i.test(normalized)
  ) {
    return normalized;
  }
  return fallback;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return json({ ok: false, error: 'Unauthorized' }, 401);

    const body = await req.json().catch(() => ({}));
    const toEmail = normalizeEmail(body?.toEmail);
    const fromEmail = normalizeEmail(user.email);
    const senderName = escapeText(safePublicActorName(user.username || user.public_username || user.full_name, 'Bir oyuncu'));
    const appUrl = sanitizeAppUrl(body?.appUrl) || KRONOX_DEFAULT_APP_URL;

    if (!toEmail) return json({ ok: false, error: 'toEmail required' }, 400);
    if (toEmail === fromEmail) return json({ ok: false, error: 'Cannot email self' }, 400);

    // Spam-prevention: only allow this email if an actual pending request
    // from the caller to toEmail exists. The client just created it, so
    // this check should pass for legitimate flows.
    let pending = [];
    try {
      pending = await base44.asServiceRole.entities.FriendRequest.filter({
        from_email: fromEmail,
        to_email: toEmail,
        status: 'pending',
      }, '-created_date', 1);
    } catch (_e) {
      pending = [];
    }
    if (!pending || pending.length === 0) {
      return json({ ok: false, error: 'No matching pending friend request' }, 404);
    }

    const deepLink = `${appUrl}/friends`;
    const subject = 'Kronox arkadaşlık isteğin var';
    const bodyText = [
      `${senderName} sana Kronox'ta arkadaşlık isteği gönderdi.`,
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
    } catch (mailErr) {
      const reason = mailErr instanceof Error ? mailErr.message : 'send failed';
      console.error('[sendFriendRequestEmail] SendEmail failed:', reason);
      return json({ ok: false, error: 'email_failed', reason }, 502);
    }

    return json({ ok: true, deepLink });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[sendFriendRequestEmail] failed:', message);
    return json({ ok: false, error: message }, 500);
  }
});