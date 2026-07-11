import { createClientFromRequest } from 'npm:@base44/sdk@0.8.34';

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
    const targetRef = String(body?.targetRef || body?.friendRef || '').trim();
    const legacyFriendEmail = String(body?.friendEmail || '').trim().toLowerCase();
    if (!targetRef && !legacyFriendEmail) {
      return Response.json({ error: 'targetRef is required' }, { status: 400 });
    }

    const myEmail = String(user.email || '').toLowerCase();
    if (legacyFriendEmail === myEmail) {
      return Response.json({ error: 'Cannot remove self' }, { status: 400 });
    }

    const [allOutgoing, allIncoming] = await Promise.all([
      base44.asServiceRole.entities.FriendRequest.filter({ from_email: myEmail, status: 'accepted' }, '-updated_date', 200),
      base44.asServiceRole.entities.FriendRequest.filter({ to_email: myEmail, status: 'accepted' }, '-updated_date', 200),
    ]);
    const candidates = [
      ...(allOutgoing || []).map((row) => ({ row, otherEmail: String(row?.to_email || '').trim().toLowerCase() })),
      ...(allIncoming || []).map((row) => ({ row, otherEmail: String(row?.from_email || '').trim().toLowerCase() })),
    ];
    let friendEmail = legacyFriendEmail;
    if (!friendEmail && targetRef) {
      for (const candidate of candidates) {
        const profiles = await base44.asServiceRole.entities.User.filter({ email: candidate.otherEmail }, '-updated_date', 1).catch(() => []);
        if (String(profiles?.[0]?.social_ref || '') === targetRef) {
          friendEmail = candidate.otherEmail;
          break;
        }
      }
    }
    if (!friendEmail || friendEmail === myEmail) {
      return Response.json({ error: 'Not friends' }, { status: 404 });
    }

    const acceptedRows = candidates
      .filter((candidate) => candidate.otherEmail === friendEmail)
      .map((candidate) => candidate.row);
    if (!acceptedRows.length) {
      // Nothing accepted — also nothing to clean up beyond legacy Friendship rows below.
    }

    // Flip every accepted request between the pair back to 'rejected'.
    // Defense-in-depth: even though the filters above already scope rows to
    // exactly (myEmail <-> friendEmail), re-verify each row belongs to the
    // authenticated caller before the service-role update touches it.
    for (const row of acceptedRows) {
      const rowFrom = String(row?.from_email || '').trim().toLowerCase();
      const rowTo = String(row?.to_email || '').trim().toLowerCase();
      const involvesMe = rowFrom === myEmail || rowTo === myEmail;
      const involvesFriend = rowFrom === friendEmail || rowTo === friendEmail;
      if (!involvesMe || !involvesFriend) continue;
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

    return Response.json({ success: true, targetRef: targetRef || null });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
