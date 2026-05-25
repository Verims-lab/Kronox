import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Receiver-only accept of a pending FriendRequest.
//
// Friendship rows must exist on BOTH sides of the relationship. The current
// Friendship RLS contract pins `data.user_email` to the caller — so the
// receiver can always create their own row, but the mirror row owned by the
// sender can be rejected at the storage layer even from a service-role
// context in this environment. We treat each create independently: if it
// fails, we re-check via filter to see whether the row is already present
// (common when the user retries after the previous attempt half-succeeded)
// and only return a structured error when both the create AND the lookup
// confirm the row is genuinely missing. This makes accept idempotent and
// avoids surfacing raw 500s for duplicate/race conditions.
//
// Security guarantees preserved:
//   - Only the recipient (to_email === caller) can accept.
//   - Self-requests rejected (from_email === to_email).
//   - Status must be 'pending' (idempotent re-accept of already-accepted
//     returns a clean 200 success instead of 5xx so the UI clears the row).
//   - Sender / third-party callers get 403, not 500.

async function safeGetFriendRequest(base44, requestId) {
  try {
    const fr = await base44.asServiceRole.entities.FriendRequest.get(requestId);
    return fr || null;
  } catch (_) {
    // Base44 SDK throws on not-found; treat as null for clean 404 handling.
    return null;
  }
}

async function ensureFriendshipRow(base44, userEmail, friendEmail, friendName) {
  // Idempotent: returns true if the row exists (created or pre-existing),
  // false only if create failed AND the row is still missing after a fresh
  // filter check.
  const existing = await base44.asServiceRole.entities.Friendship.filter({
    user_email: userEmail,
    friend_email: friendEmail,
  });
  if (existing?.length) return { ok: true, created: false };

  try {
    await base44.asServiceRole.entities.Friendship.create({
      user_email: userEmail,
      friend_email: friendEmail,
      friend_name: friendName || '',
    });
    return { ok: true, created: true };
  } catch (err) {
    // Re-check — another path (race, mirror create, retry) may have made the
    // row exist. Treat as success when it did.
    const recheck = await base44.asServiceRole.entities.Friendship.filter({
      user_email: userEmail,
      friend_email: friendEmail,
    });
    if (recheck?.length) return { ok: true, created: false };
    return { ok: false, error: err?.message || 'Friendship create failed' };
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

    // Idempotent re-accept: if already accepted, treat as success so the UI
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

    // Create my row first — this is always allowed by RLS because
    // data.user_email === caller. If THIS fails, surface a clean error.
    const mine = await ensureFriendshipRow(
      base44,
      myEmail,
      fromEmail,
      fr.from_name || '',
    );
    if (!mine.ok) {
      return Response.json(
        { error: 'Arkadaşlık kaydı oluşturulamadı.', detail: mine.error },
        { status: 422 },
      );
    }

    // Mirror row owned by the sender. In some environments RLS rejects this
    // even via service role (data.user_email !== caller). ensureFriendshipRow
    // returns ok:true if the row already exists OR is created successfully;
    // ok:false only when truly missing. When missing we still mark the
    // FriendRequest as accepted (my-side row exists so the user sees the
    // friend appear), but surface a soft warning instead of crashing.
    const mirror = await ensureFriendshipRow(
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
      mirrorCreated: mirror.ok,
      mirrorWarning: mirror.ok ? null : 'Karşı taraf kaydı oluşturulamadı, daha sonra eşitlenecek.',
    });
  } catch (error) {
    // Any unhandled exception → log on server, return a clean user-facing
    // Turkish error. Never leak raw "Request failed with status code 500"
    // shape to the UI.
    console.error('[acceptFriendRequest] unhandled error:', error?.message || error);
    return Response.json(
      { error: 'Arkadaşlık isteği kabul edilemedi. Lütfen tekrar dene.' },
      { status: 500 },
    );
  }
});