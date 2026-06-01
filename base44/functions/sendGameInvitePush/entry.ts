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
// Codex138 — Base44 server `created_date` may be serialized WITHOUT a
// timezone suffix. Append `Z` to naive ISO strings so they parse as UTC.
const readTime = (value: unknown) => {
  if (value == null) return NaN;
  if (value instanceof Date) {
    const t = value.getTime();
    return Number.isFinite(t) ? t : NaN;
  }
  const str = String(value).trim();
  if (!str) return NaN;
  const hasZone = /Z$/i.test(str) || /[+-]\d{2}:?\d{2}$/.test(str);
  const t = new Date(hasZone ? str : `${str}Z`).getTime();
  return Number.isFinite(t) ? t : NaN;
};
const getInviteExpiry = (invite: any) => {
  const explicit = readTime(invite?.expires_at || invite?.expiresAt);
  if (Number.isFinite(explicit)) return explicit;
  const created = readTime(invite?.created_at || invite?.createdAt || invite?.created_date || invite?.createdDate);
  return Number.isFinite(created) ? created + GAME_INVITE_TTL_MS : NaN;
};

function getVapidConfig() {
  return {
    subject: Deno.env.get('KRONOX_VAPID_SUBJECT') || 'mailto:support@kronox.app',
    publicKey: Deno.env.get('KRONOX_VAPID_PUBLIC_KEY') || Deno.env.get('VITE_KRONOX_VAPID_PUBLIC_KEY') || '',
    privateKey: Deno.env.get('KRONOX_VAPID_PRIVATE_KEY') || '',
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
        push: { attempted: false, sent: 0, failed: 0, skipped: `invite_${invite.status}` },
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
        push: { attempted: false, sent: 0, failed: 0, skipped: 'invite_expired' },
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
        push: { attempted: false, sent: 0, failed: 0, skipped: 'recipient_notifications_disabled' },
      });
    }

    const config = getVapidConfig();
    if (!config.publicKey || !config.privateKey) {
      return json({
        ok: true,
        push: {
          attempted: false,
          sent: 0,
          failed: 0,
          skipped: 'missing_vapid_config',
          missingConfig: {
            publicKey: !config.publicKey,
            privateKey: !config.privateKey,
          },
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
        push: { attempted: false, sent: 0, failed: 0, skipped: 'no_active_subscriptions' },
      });
    }

    webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);

    const senderName = String(invite.from_name || '').trim() || fromEmail;
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
        failedReasons.push({
          statusCode,
          reason: (error as Error)?.message || 'push_failed',
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
          message: (error as Error)?.message || 'push_failed',
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
  } catch (error) {
    console.error('[sendGameInvitePush] error:', (error as Error)?.message || error);
    return json({ ok: false, error: (error as Error)?.message || 'Push notification failed' }, 500);
  }
});