import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Symmetric removal: deletes both directional Friendship rows.
// Caller may only remove a friend they actually have (verified via service role lookup).
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const friendEmail = String(body?.friendEmail || '').trim().toLowerCase();
    if (!friendEmail) {
      return Response.json({ error: 'friendEmail is required' }, { status: 400 });
    }

    const myEmail = String(user.email || '').toLowerCase();
    if (friendEmail === myEmail) {
      return Response.json({ error: 'Cannot remove self' }, { status: 400 });
    }

    // Verify the requester actually owns the relationship before touching the mirror row.
    const mine = await base44.asServiceRole.entities.Friendship.filter({
      user_email: myEmail, friend_email: friendEmail,
    });
    if (!mine?.length) {
      return Response.json({ error: 'Not friends' }, { status: 404 });
    }

    const theirs = await base44.asServiceRole.entities.Friendship.filter({
      user_email: friendEmail, friend_email: myEmail,
    });

    for (const row of mine) {
      await base44.asServiceRole.entities.Friendship.delete(row.id);
    }
    for (const row of theirs || []) {
      await base44.asServiceRole.entities.Friendship.delete(row.id);
    }

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});