import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Codex080 — Normalized friendship model.
// The accepted FriendRequest IS the friendship. To remove a friend we flip
// the accepted request(s) on both directions back to a non-active state.
// Using 'rejected' so it cleanly drops out of every list (loadFriends filters
// status === 'accepted', loadIncomingRequests filters status === 'pending').
// Any legacy Friendship rows from earlier attempts are also cleaned up so
// the database does not carry dead state.
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

    // Find the accepted FriendRequest(s) between the two emails (either direction).
    const [outgoing, incoming] = await Promise.all([
      base44.asServiceRole.entities.FriendRequest.filter({
        from_email: myEmail, to_email: friendEmail, status: 'accepted',
      }),
      base44.asServiceRole.entities.FriendRequest.filter({
        from_email: friendEmail, to_email: myEmail, status: 'accepted',
      }),
    ]);

    const acceptedRows = [...(outgoing || []), ...(incoming || [])];
    if (!acceptedRows.length) {
      // Nothing accepted — also nothing to clean up beyond legacy Friendship rows below.
    }

    // Flip every accepted request between the pair back to 'rejected'.
    for (const row of acceptedRows) {
      await base44.asServiceRole.entities.FriendRequest.update(row.id, { status: 'rejected' });
    }

    // Legacy cleanup — remove any old Friendship rows from the previous model.
    const [legacyMine, legacyTheirs] = await Promise.all([
      base44.asServiceRole.entities.Friendship.filter({ user_email: myEmail, friend_email: friendEmail }),
      base44.asServiceRole.entities.Friendship.filter({ user_email: friendEmail, friend_email: myEmail }),
    ]);
    for (const row of legacyMine || []) {
      await base44.asServiceRole.entities.Friendship.delete(row.id);
    }
    for (const row of legacyTheirs || []) {
      await base44.asServiceRole.entities.Friendship.delete(row.id);
    }

    if (!acceptedRows.length && !(legacyMine?.length) && !(legacyTheirs?.length)) {
      return Response.json({ error: 'Not friends' }, { status: 404 });
    }

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});