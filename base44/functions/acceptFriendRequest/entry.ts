import { createClientFromRequest } from 'npm:@base44/sdk@0.8.34';
// Verims Comment
// Codex080 — Normalized friendship model.
//
// Root cause of every previous failure: the legacy Friendship row create rule pins
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
    const requestRef = String(body?.requestRef || body?.requestId || '').trim();
    const action = String(body?.action || 'accept').trim().toLowerCase();
    if (!requestRef) return json({ ok: false, error: 'requestRef is required' }, 400);
    if (!['accept', 'reject', 'cancel'].includes(action)) {
      return json({ ok: false, error: 'Unsupported friend request action' }, 400);
    }

    let fr = null;
    const publicRows = await base44.asServiceRole.entities.FriendRequest
      .filter({ public_ref: requestRef }, '-updated_date', 2)
      .catch(() => []);
    fr = publicRows?.[0] || null;
    if (!fr) {
      try {
        fr = await base44.asServiceRole.entities.FriendRequest.get(requestRef);
      } catch (_e) {
        // Legacy internal references are accepted only after owner validation below.
      }
    }
    if (!fr) return json({ ok: false, error: 'Friend request not found' }, 404);


    const myEmail = normalizeEmail(user.email);
    const toEmail = normalizeEmail(fr.to_email);
    const fromEmail = normalizeEmail(fr.from_email);
    const rowId = String(fr?.id || fr?._id || '').trim();

    const callerIsRecipient = toEmail === myEmail;
    const callerIsSender = fromEmail === myEmail;
    if ((action === 'accept' || action === 'reject') && !callerIsRecipient) {
      return json({ ok: false, code: 'friend_request_receiver_only', error: 'Only the receiver can update this request' }, 403);
    }
    if (action === 'cancel' && !callerIsSender) {
      return json({ ok: false, error: 'Only the sender can cancel this request' }, 403);
    }
    // Self-request guard (defense in depth — client already blocks).
    if (!fromEmail || fromEmail === toEmail) {
      return json({ ok: false, error: 'Invalid friend request' }, 400);
    }
    if (action === 'reject') {
      if (fr.status !== 'pending') return json({ ok: false, error: `Request is already ${fr.status}` }, 409);
      await base44.asServiceRole.entities.FriendRequest.update(rowId, {
        status: 'rejected',
        cancelled_at: new Date().toISOString(),
      });
      return json({ ok: true, success: true, requestRef: fr.public_ref || requestRef, requestStatus: 'rejected' });
    }
    if (action === 'cancel') {
      if (!['pending', 'expired'].includes(fr.status)) return json({ ok: false, error: `Request is already ${fr.status}` }, 409);
      await base44.asServiceRole.entities.FriendRequest.update(rowId, {
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
      });
      return json({ ok: true, success: true, requestRef: fr.public_ref || requestRef, requestStatus: 'cancelled' });
    }

    // Status guard: only pending or already-accepted is valid.
    if (fr.status !== 'pending' && fr.status !== 'accepted') {
      return json({ ok: false, error: `Request is already ${fr.status}` }, 409);
    }
    if (fr.status === 'pending' && isFriendRequestExpired(fr)) {
      await base44.asServiceRole.entities.FriendRequest.update(rowId, {
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
      // Security (CWE-285): Kronox IDs written on accept are always derived
      // from the trusted authenticated User rows looked up by email, never
      // from the client-influenced stored request payload. This prevents
      // spoofing/forging friendship relationships via a manipulated
      // from_kronox_user_id/to_kronox_user_id on the FriendRequest row.
      const trustedFromKronoxUserId = normalizeKronoxUserId(senderUser?.kronox_user_id);
      const trustedToKronoxUserId = normalizeKronoxUserId(receiverUser?.kronox_user_id);
      await base44.asServiceRole.entities.FriendRequest.update(rowId, {
        status: 'accepted',
        accepted_at: new Date().toISOString(),
        ...(trustedFromKronoxUserId ? { from_kronox_user_id: trustedFromKronoxUserId } : {}),
        ...(trustedToKronoxUserId ? { to_kronox_user_id: trustedToKronoxUserId } : {}),
      });
    }

    return json({
      ok: true,
      success: true,
      requestStatus: 'accepted',
      requestRef: fr.public_ref || requestRef,
      alreadyFriends: fr.status === 'accepted',
    });
  } catch (_error) {
    return json({
      ok: false,
      code: 'friend_request_action_failed',
      error: 'Arkadaşlık isteği işlenemedi. Lütfen tekrar dene.',
    }, 500);
  }
});