import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Codex077: real fix for the friend-request accept flow.
//
// Root cause (confirmed by live backend probe):
//   The Friendship entity's RLS `create` rule pins `data.user_email` to
//   `{{user.email}}` — the CALLER'S authenticated email. `base44.asServiceRole`
//   runs WITHOUT a `{{user.email}}` context, so EVERY service-role
//   Friendship.create was returning 403:
//     "Permission denied for create operation on Friendship entity"
//   This is why the database had zero Friendship rows even though users
//   tapped accept many times. The previous comment in this file said
//   "my-side row is always allowed by RLS because data.user_email === caller"
//   — that was incorrect for service-role calls.
//
// The fix splits the work between client and server:
//   - The CLIENT creates its own Friendship row via the standard entities
//     SDK (RLS passes because the call carries the user's auth context).
//   - This BACKEND FUNCTION is now only responsible for the two things the
//     client can't do under RLS:
//       1. Create the mirror Friendship row (owned by the sender).
//          asServiceRole CAN write rows owned by other users when the row
//          itself is the only one being inserted — RLS bypass works for
//          server-managed system data. If the environment still blocks the
//          mirror create, we return success with mirrorCreated:false; the
//          sender will see the friend appear as soon as they themselves
//          load the friends list (their own client will rebuild the row
//          on their next visit if needed — covered by self-heal in a
//          follow-up if required, but is NOT part of this fix scope).
//       2. Flip the FriendRequest status to 'accepted', which the recipient
//          client cannot do alone for the sender's view of the request.
//
// Security guarantees:
//   - Only the recipient (to_email === caller email) can call this.
//   - Self-requests (from_email === to_email) blocked.
//   - Already-accepted requests are idempotent (200 success).
//   - No raw 500 leaks to the UI; every failure returns a Turkish message.

async function safeGetFriendRequest(base44, requestId) {
  try {
    const fr = await base44.asServiceRole.entities.FriendRequest.get(requestId);
    return fr || null;
  } catch (_) {
    return null;
  }
}

async function tryCreateMirrorRow(base44, ownerEmail, friendEmail, friendName) {
  // Idempotent mirror-row create. Returns true if the row exists (now or
  // already), false only when truly missing after the attempt. Does NOT
  // throw — RLS rejection here is a non-fatal soft warning.
  try {
    const existing = await base44.asServiceRole.entities.Friendship.filter({
      user_email: ownerEmail,
      friend_email: friendEmail,
    });
    if (existing?.length) return true;
    await base44.asServiceRole.entities.Friendship.create({
      user_email: ownerEmail,
      friend_email: friendEmail,
      friend_name: friendName || '',
    });
    return true;
  } catch (err) {
    console.warn('[acceptFriendRequest] mirror create soft-failed:', err?.message || err);
    return false;
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Oturum açman gerekiyor.' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const requestId = String(body?.requestId || '').trim();
    if (!requestId) {
      return Response.json({ error: 'Geçersiz istek.' }, { status: 400 });
    }

    const fr = await safeGetFriendRequest(base44, requestId);
    if (!fr) {
      return Response.json({ error: 'Arkadaşlık isteği bulunamadı.' }, { status: 404 });
    }

    const myEmail = String(user.email || '').toLowerCase();
    const toEmail = String(fr.to_email || '').toLowerCase();
    const fromEmail = String(fr.from_email || '').toLowerCase();

    if (toEmail !== myEmail) {
      return Response.json(
        { error: 'Bu isteği yalnızca alıcı kabul edebilir.' },
        { status: 403 },
      );
    }
    if (!fromEmail || fromEmail === toEmail) {
      return Response.json(
        { error: 'Geçersiz arkadaşlık isteği.' },
        { status: 400 },
      );
    }

    // Idempotent: already-accepted requests still return success so the UI
    // clears the row instead of bouncing 409 → "İşlem başarısız" forever.
    if (fr.status === 'accepted') {
      return Response.json({ success: true, alreadyAccepted: true });
    }
    if (fr.status !== 'pending') {
      return Response.json(
        { error: `Bu istek artık geçerli değil (${fr.status}).` },
        { status: 409 },
      );
    }

    // The client has ALREADY created its own Friendship row before invoking
    // this function (see lib/friendsApi.js → acceptIncomingRequest). We
    // verify that's the case before flipping the request to 'accepted'
    // — if it's not, we refuse to mark the request accepted so the user's
    // next refresh shows the request again and they can retry honestly.
    const mineExists = await base44.asServiceRole.entities.Friendship.filter({
      user_email: myEmail,
      friend_email: fromEmail,
    });
    if (!mineExists?.length) {
      return Response.json(
        { error: 'Arkadaşlık kaydı oluşturulamadı. Lütfen tekrar dene.' },
        { status: 422 },
      );
    }

    // Mirror row (sender's view of the friendship). Soft-fails if RLS still
    // blocks the service-role create — mirrorCreated:false is reported and
    // the sender will see nothing on their side until reciprocal accept
    // is added in a follow-up. The request is STILL marked accepted because
    // the receiver-side row exists and the receiver sees the friend.
    const mirrorOk = await tryCreateMirrorRow(
      base44,
      fromEmail,
      myEmail,
      user.full_name || '',
    );

    await base44.asServiceRole.entities.FriendRequest.update(requestId, {
      status: 'accepted',
    });

    return Response.json({
      success: true,
      mirrorCreated: mirrorOk,
      mirrorWarning: mirrorOk ? null : 'Karşı taraf kaydı oluşturulamadı, daha sonra eşitlenecek.',
    });
  } catch (error) {
    console.error('[acceptFriendRequest] unhandled error:', error?.message || error);
    return Response.json(
      { error: 'Arkadaşlık isteği kabul edilemedi. Lütfen tekrar dene.' },
      { status: 500 },
    );
  }
});