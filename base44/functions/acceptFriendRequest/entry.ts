import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

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

function json(payload, status = 200) {
  return Response.json(payload, { status });
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

    // Idempotent flip. If status is already accepted, this is a no-op success.
    if (fr.status === 'pending') {
      await base44.asServiceRole.entities.FriendRequest.update(requestId, { status: 'accepted' });
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
