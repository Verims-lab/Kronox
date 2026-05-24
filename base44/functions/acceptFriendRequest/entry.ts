import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Receiver-only accept. Writes both Friendship rows atomically via service role
// (RLS forbids the client from creating the mirror row for another user).
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const requestId = String(body?.requestId || '').trim();
    if (!requestId) {
      return Response.json({ error: 'requestId is required' }, { status: 400 });
    }

    const fr = await base44.asServiceRole.entities.FriendRequest.get(requestId);
    if (!fr) {
      return Response.json({ error: 'Friend request not found' }, { status: 404 });
    }

    const myEmail = String(user.email || '').toLowerCase();
    const toEmail = String(fr.to_email || '').toLowerCase();
    const fromEmail = String(fr.from_email || '').toLowerCase();

    if (toEmail !== myEmail) {
      return Response.json({ error: 'Only the receiver can accept this request' }, { status: 403 });
    }
    if (fr.status !== 'pending') {
      return Response.json({ error: `Request is already ${fr.status}` }, { status: 409 });
    }
    if (!fromEmail || fromEmail === toEmail) {
      return Response.json({ error: 'Invalid friend request' }, { status: 400 });
    }

    // Check for existing friendship rows (idempotent re-accept safe).
    const myExisting = await base44.asServiceRole.entities.Friendship.filter({
      user_email: myEmail, friend_email: fromEmail,
    });
    const theirExisting = await base44.asServiceRole.entities.Friendship.filter({
      user_email: fromEmail, friend_email: myEmail,
    });

    if (!myExisting?.length) {
      await base44.asServiceRole.entities.Friendship.create({
        user_email: myEmail,
        friend_email: fromEmail,
        friend_name: fr.from_name || '',
      });
    }
    if (!theirExisting?.length) {
      await base44.asServiceRole.entities.Friendship.create({
        user_email: fromEmail,
        friend_email: myEmail,
        friend_name: user.full_name || '',
      });
    }

    await base44.asServiceRole.entities.FriendRequest.update(requestId, { status: 'accepted' });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});