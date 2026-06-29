import { createClientFromRequest } from 'npm:@base44/sdk@0.8.34';
// Verims Comment
// Codex080 — Normalized friendship model.
//
// Root cause of every previous failure: Friendship.create RLS pins
// `data.user_email === {{user.email}}`. This rule is enforced even under
// `asServiceRole` on this app, so creating the sender-owned mirror row
// always returned 403 "Permission denied for create operation on Friendship".
// Mirrored-rows model is therefore unworkable here.
//
// New model: the accepted FriendRequest row IS the friendship. Both sender
// and recipient can read it under existing RLS (sender via from_email,
// recipient via to_email). The friend list loader on the client reads both
// sides of the accepted requests. No Friendship row is required.
//
// This function therefore only:
//   1. Validates the caller is the recipient (toEmail === myEmail).
//   2. Validates the request exists and is pending or already accepted.
//   3. Flips status to 'accepted' (idempotent).
//
// Old/orphan Friendship rows are left untouched here; removeFriend cleans
// them up. Old "accepted" requests with no Friendship are auto-repaired
// because the new friend list query no longer depends on Friendship.

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();
const KRONOX_ID_PATTERN = /^KX-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/;

function json(payload, status = 200) {
  return Response.json(payload, { status });
}

function normalizeKronoxUserId(value) {
  const text = String(value || '').trim().toUpperCase();
  return KRONOX_ID_PATTERN.test(text) ? text : '';
}

function parseTime(raw) {
  if (!raw) return NaN;
  if (raw instanceof Date) return raw.getTime();
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : NaN;
  const text = String(raw || '').trim();
  if (!text) return NaN;
  const normalized = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(text)
    ? `${text}Z`
    : text;
  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function isFriendRequestExpired(row) {
  if (String(row?.status || '').toLowerCase() === 'expired') return true;
  const expiresAt = parseTime(row?.expires_at || row?.expiresAt);
  return Number.isFinite(expiresAt) && expiresAt <= Date.now();
}

async function findUserByEmail(base44, email) {
  if (!email) return null;
  const rows = await base44.asServiceRole.entities.User.filter({ email }, '-updated_date', 1).catch(() => []);
  return rows?.[0] || null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return json({ ok: false, error: 'Unauthorized' }, 401);

    const body = await req.json().catch(() => ({}));
    const requestId = String(body?.requestId || '').trim();
    if (!requestId) return json({ ok: false, error: 'requestId is required' }, 400);

    let fr = null;
    try {
      fr = await base44.asServiceRole.entities.FriendRequest.get(requestId);
    } catch (_e) {
      // Base44 throws on missing entity; normalize to 404 for the client.
    }
    if (!fr) return json({ ok: false, error: 'Friend request not found' }, 404);


    const myEmail = normalizeEmail(user.email);
    const toEmail = normalizeEmail(fr.to_email);
    const fromEmail = normalizeEmail(fr.from_email);

    // Security: only the recipient can accept their own request.
    if (toEmail !== myEmail) {
      return json({ ok: false, error: 'Only the receiver can accept this request' }, 403);
    }
    // Self-request guard (defense in depth — client already blocks).
    if (!fromEmail || fromEmail === toEmail) {
      return json({ ok: false, error: 'Invalid friend request' }, 400);
    }
    // Status guard: only pending or already-accepted is valid.
    if (fr.status !== 'pending' && fr.status !== 'accepted') {
      return json({ ok: false, error: `Request is already ${fr.status}` }, 409);
    }
    if (fr.status === 'pending' && isFriendRequestExpired(fr)) {
      await base44.asServiceRole.entities.FriendRequest.update(requestId, {
        status: 'expired',
        expired_at: new Date().toISOString(),
      }).catch(() => null);
      return json({ ok: false, code: 'friend_request_expired', error: 'Davetin süresi doldu.' }, 409);
    }

    // Idempotent flip. If status is already accepted, this is a no-op success.
    if (fr.status === 'pending') {
      const [senderUser, receiverUser] = await Promise.all([
        findUserByEmail(base44, fromEmail),
        findUserByEmail(base44, toEmail),
      ]);
      await base44.asServiceRole.entities.FriendRequest.update(requestId, {
        status: 'accepted',
        ...(normalizeKronoxUserId(fr.from_kronox_user_id) ? {} : {
          from_kronox_user_id: normalizeKronoxUserId(senderUser?.kronox_user_id),
        }),
        ...(normalizeKronoxUserId(fr.to_kronox_user_id) ? {} : {
          to_kronox_user_id: normalizeKronoxUserId(receiverUser?.kronox_user_id),
        }),
      });
    }

    return json({
      ok: true,
      success: true,
      requestStatus: 'accepted',
      alreadyFriends: fr.status === 'accepted',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown acceptFriendRequest error';
    return json({ ok: false, error: message }, 500);
  }
});
