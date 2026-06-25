/**
 * sendGameInvitePush
 *
 * Best-effort Web Push delivery for pending GameInvite rows.
 * Security model:
 * - Caller must be authenticated.
 * - Caller must match invite.from_email.
 * - Function only sends to invite.to_email active PushSubscription rows.
 * - Push failure never invalidates the invite/lobby creation flow.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import webpush from 'npm:web-push@3.6.7';

const normalizeEmail = (value: unknown) => String(value || '').trim().toLowerCase();
const json = (body: unknown, status = 200) => Response.json(body, { status });
// Codex130 — Game invite TTL: 10 minutes (was 5).
const GAME_INVITE_TTL_MS = 10 * 60 * 1000;
const VAPID_CONFIG_FIELDS = [
  { key: 'subject', canonicalName: 'VAPID_SUBJECT', envNames: ['VAPID_SUBJECT', 'KRONOX_VAPID_SUBJECT'] },
  { key: 'publicKey', canonicalName: 'VAPID_PUBLIC_KEY', envNames: ['VAPID_PUBLIC_KEY', 'KRONOX_VAPID_PUBLIC_KEY'] },
  { key: 'privateKey', canonicalName: 'VAPID_PRIVATE_KEY', envNames: ['VAPID_PRIVATE_KEY', 'KRONOX_VAPID_PRIVATE_KEY'] },
] as const;
const VAPID_SECRET_HEALTH_CLASSIFICATION = {
  vapidPrivateKeySource: 'server_env_secret',
  vapidPrivateKeyProductionSecretManagerVerification: 'MANUAL_REQUIRED',
  envSourcedVapidPrivateKeyFindingSeverity: 'WARNING',
  criticalOnlyWhen: 'hardcoded_logged_returned_client_exposed_or_insecure_default',
} as const;

function isInvalidVapidValue(value: string) {
  const normalized = value.trim().toLowerCase();
  return [
    'changeme',
    'change_me',
    'change-me',
    'placeholder',
    'dummy',
    'todo',
    'test',
    'your_vapid_key',
    'your_vapid_public_key',
    'your_vapid_private_key',
    'your_vapid_subject',
  ].includes(normalized);
}

function isValidVapidSubject(value: string) {
  const normalized = value.trim().toLowerCase();
  return normalized.startsWith('mailto:') || normalized.startsWith('https://');
}

function isLikelyVapidKey(value: string) {
  return /^[A-Za-z0-9_-]{20,}$/.test(value.trim());
}

function safePublicActorName(value: unknown, fallback = 'Bir arkadaşın') {
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

function readRequiredVapidValue(field: typeof VAPID_CONFIG_FIELDS[number]) {
  for (const envName of field.envNames) {
    const raw = Deno.env.get(envName);
    if (typeof raw !== 'string') continue;
    const value = raw.trim();
    if (!value) continue;
    if (isInvalidVapidValue(value)) {
      return { value: null, invalid: field.canonicalName };
    }
    if (field.key === 'subject' && !isValidVapidSubject(value)) {
      return { value: null, invalid: field.canonicalName };
    }
    if ((field.key === 'publicKey' || field.key === 'privateKey') && !isLikelyVapidKey(value)) {
      return { value: null, invalid: field.canonicalName };
    }
    return { value, invalid: null };
  }
  return { value: null, invalid: null };
}
// Codex139 — Naive ISO timestamp guard. Base44 sometimes serializes
// `created_date` / `expires_at` without a timezone suffix; on non-UTC hosts
// `new Date(naiveStr)` parses as local time and a fresh invite is instantly
// flagged as expired. `parseInviteTimestamp` appends `Z` to naive strings
// so they parse as UTC. `readTime` is kept as the numeric wrapper used by
// the existing TTL math.
function parseInviteTimestamp(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  const str = String(value).trim();
  if (!str) return null;
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(str);
  const normalized = hasZone ? str : `${str}Z`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}
const readTime = (value: unknown) => {
  const d = parseInviteTimestamp(value);
  return d ? d.getTime() : NaN;
};
const getInviteExpiry = (invite: any) => {
  // Codex139 — expires_at is parsed through the safe parser so naive ISO
  // strings (no zone) are treated as UTC, not local time.
  const explicitDate = parseInviteTimestamp(invite?.expires_at || invite?.expiresAt);
  if (explicitDate) return explicitDate.getTime();
  const created = readTime(invite?.created_at || invite?.createdAt || invite?.created_date || invite?.createdDate);
  return Number.isFinite(created) ? created + GAME_INVITE_TTL_MS : NaN;
};

function getVapidConfig() {
  const config: Record<string, string> = {};
  const missing: string[] = [];
  const invalid: string[] = [];

  for (const field of VAPID_CONFIG_FIELDS) {
    const result = readRequiredVapidValue(field);
    if (result.invalid) {
      invalid.push(result.invalid);
      continue;
    }
    if (!result.value) {
      missing.push(field.canonicalName);
      continue;
    }
    config[field.key] = result.value;
  }

  return {
    subject: config.subject,
    publicKey: config.publicKey,
    privateKey: config.privateKey,
    missing,
    invalid,
  };
}

function summarizeVapidConfigState(config: ReturnType<typeof getVapidConfig>) {
  return {
    missingCount: config.missing.length,
    invalidCount: config.invalid.length,
  };
}

function getVapidSecretHealthClassification() {
  return {
    vapidPrivateKeySource: VAPID_SECRET_HEALTH_CLASSIFICATION.vapidPrivateKeySource,
    vapidPrivateKeyProductionSecretManagerVerification: VAPID_SECRET_HEALTH_CLASSIFICATION.vapidPrivateKeyProductionSecretManagerVerification,
    envSourcedVapidPrivateKeyFindingSeverity: VAPID_SECRET_HEALTH_CLASSIFICATION.envSourcedVapidPrivateKeyFindingSeverity,
  };
}

function sanitizePushErrorReason(error: unknown) {
  const statusCode = Number((error as any)?.statusCode || (error as any)?.status || 0);
  if (statusCode === 404 || statusCode === 410) return 'subscription_expired';
  if (statusCode === 401 || statusCode === 403) return 'push_provider_rejected';
  if (statusCode >= 500) return 'push_provider_unavailable';
  return 'push_failed';
}

function skippedPushSummary(skipped: string, extra: Record<string, unknown> = {}) {
  return {
    attempted: false,
    sent: 0,
    failed: 0,
    expired: 0,
    skipped,
    skippedReasons: { [skipped]: 1 },
    failedReasons: [],
    subscriptionCount: 0,
    ...extra,
  };
}

function buildTargetUrl(invite: any) {
  const params = new URLSearchParams();
  if (invite?.id) params.set('inviteId', invite.id);
  if (invite?.lobby_id) params.set('lobbyId', invite.lobby_id);
  if (invite?.lobby_code) params.set('lobbyCode', invite.lobby_code);
  const query = params.toString();
  return query ? `/lobby?${query}` : '/lobby';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return json({ ok: false, error: 'Giriş yapmanız gerekiyor.' }, 401);

    const body = await req.json().catch(() => ({}));
    const inviteId = String(body?.inviteId || '').trim();
    if (!inviteId) return json({ ok: false, error: 'inviteId is required' }, 400);

    const invite = await base44.asServiceRole.entities.GameInvite.get(inviteId);
    if (!invite) return json({ ok: false, error: 'Davet bulunamadı.' }, 404);

    const myEmail = normalizeEmail(user.email);
    const fromEmail = normalizeEmail(invite.from_email);
    const toEmail = normalizeEmail(invite.to_email);

    if (!myEmail || myEmail !== fromEmail) {
      return json({ ok: false, error: 'Bu davet için bildirim gönderemezsin.' }, 403);
    }
    if (!toEmail || toEmail === fromEmail) {
      return json({ ok: false, error: 'Geçersiz davet alıcısı.' }, 400);
    }
    if (invite.status !== 'pending') {
      return json({
        ok: true,
        push: skippedPushSummary(`invite_${invite.status}`),
      });
    }
    const expiresAt = getInviteExpiry(invite);
    if (Number.isFinite(expiresAt) && expiresAt <= Date.now()) {
      await base44.asServiceRole.entities.GameInvite.update(inviteId, {
        status: 'expired',
        expired_at: new Date().toISOString(),
      }).catch(() => null);
      return json({
        ok: true,
        push: skippedPushSummary('invite_expired'),
      });
    }

    const recipientRows = await base44.asServiceRole.entities.User.filter(
      { email: toEmail },
      '-created_date',
      1,
    ).catch(() => []);
    const recipient = recipientRows?.[0] || null;
    if (recipient?.game_invite_notifications_enabled === false) {
      return json({
        ok: true,
        push: skippedPushSummary('recipient_notifications_disabled'),
      });
    }

    const config = getVapidConfig();
    if (config.missing.length || config.invalid.length) {
      const configState = summarizeVapidConfigState(config);
      const secretManagement = getVapidSecretHealthClassification();
      console.warn('[sendGameInvitePush] VAPID config missing or invalid; push skipped but in-app invite remains available.', {
        reason: 'vapid_config_missing',
        ...configState,
      });
      return json({
        ok: true,
        pushSent: false,
        pushSkipped: true,
        missingConfig: true,
        reason: 'vapid_config_missing',
        push: {
          ...skippedPushSummary('missing_vapid_config', {
            ok: false,
            reason: 'vapid_config_missing',
            missingConfig: true,
            ...configState,
          }),
          ok: false,
          reason: 'vapid_config_missing',
          missingConfig: true,
          secretManagement,
        },
      });
    }

    const subscriptions = await base44.asServiceRole.entities.PushSubscription.filter(
      { user_email: toEmail, status: 'active' },
      '-last_seen_at',
      25,
    );

    if (!subscriptions?.length) {
      return json({
        ok: true,
        push: skippedPushSummary('no_active_subscriptions'),
      });
    }

    webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);

    const senderName = safePublicActorName(invite.from_name, 'Bir arkadaşın');
    const targetUrl = buildTargetUrl(invite);
    const notificationPayload = JSON.stringify({
      title: 'Kronox',
      body: `${senderName} seni Kronox oyununa davet etti.`,
      data: {
        inviteId: invite.id,
        lobbyId: invite.lobby_id || null,
        lobbyCode: invite.lobby_code || null,
        targetUrl,
        expiresAt: Number.isFinite(expiresAt) ? new Date(expiresAt).toISOString() : null,
      },
    });

    let sent = 0;
    let failed = 0;
    let expired = 0;
    const failedReasons: Array<{ statusCode: number; reason: string }> = [];

    for (const row of subscriptions) {
      try {
        await webpush.sendNotification({
          endpoint: row.endpoint,
          keys: {
            p256dh: row.keys_p256dh,
            auth: row.keys_auth,
          },
        }, notificationPayload, { TTL: 60 * 20 });
        sent += 1;
      } catch (error) {
        failed += 1;
        const statusCode = Number((error as any)?.statusCode || (error as any)?.status || 0);
        const safeReason = sanitizePushErrorReason(error);
        failedReasons.push({
          statusCode,
          reason: safeReason,
        });
        if (statusCode === 404 || statusCode === 410) {
          expired += 1;
          await base44.asServiceRole.entities.PushSubscription.update(row.id, {
            status: 'expired',
            disabled_at: new Date().toISOString(),
          }).catch(() => null);
        }
        console.warn('[sendGameInvitePush] push failed:', {
          inviteId,
          subscriptionId: row.id,
          statusCode,
          reason: safeReason,
        });
      }
    }

    return json({
      ok: true,
      push: {
        attempted: true,
        sent,
        failed,
        expired,
        failedReasons: failedReasons.slice(0, 5),
        subscriptionCount: subscriptions.length,
      },
    });
  } catch {
    console.error('[sendGameInvitePush] error:', { reason: 'push_invite_failed' });
    return json({ ok: false, error: 'Push notification failed', reason: 'push_invite_failed' }, 500);
  }
});
