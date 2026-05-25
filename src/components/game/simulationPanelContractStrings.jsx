// components/game/simulationPanelContractStrings.js
// Extracted contract-string mirrors of out-of-/src entity and function files.
// These mirror the live entities/*.json and functions/*.js shapes so the
// simulator can run STATIC_CONTRACT checks without ?raw-importing files that
// live outside /src (which breaks Vite's chunk evaluation).
//
// Keep these in sync when the underlying entity/function changes.

export const friendshipEntitySource = `
  "name": "Friendship",
  "properties": {
    "user_email": {},
    "friend_email": {},
    "friend_name": {}
  },
  "rls": {
    "create": { "data.user_email": "{{user.email}}" },
    "read":   { "data.user_email": "{{user.email}}", "user_condition": { "role": "admin" } },
    "update": { "data.user_email": "{{user.email}}", "user_condition": { "role": "admin" } },
    "delete": { "data.user_email": "{{user.email}}", "user_condition": { "role": "admin" } }
  }
`;

export const friendRequestEntitySource = `
  "name": "FriendRequest",
  "properties": {
    "from_email": {},
    "to_email": {},
    "status": { "enum": ["pending","accepted","rejected","cancelled"] }
  },
  "rls": {
    "create": { "data.from_email": "{{user.email}}" },
    "read":   { "data.from_email": "{{user.email}}", "data.to_email": "{{user.email}}", "user_condition": { "role": "admin" } },
    "update": { "data.from_email": "{{user.email}}", "data.to_email": "{{user.email}}", "user_condition": { "role": "admin" } }
  }
`;

export const gameInviteEntitySource = `
  "name": "GameInvite",
  "properties": {
    "lobby_id": {},
    "lobby_code": {},
    "from_email": {},
    "to_email": {},
    "status": { "enum": ["pending","accepted","rejected","cancelled","expired"] }
  },
  "rls": {
    "create": { "data.from_email": "{{user.email}}" },
    "read":   { "data.from_email": "{{user.email}}", "data.to_email": "{{user.email}}", "user_condition": { "role": "admin" } },
    "update": { "data.from_email": "{{user.email}}", "data.to_email": "{{user.email}}", "user_condition": { "role": "admin" } }
  }
`;

export const acceptGameInviteFnSource = `
  // Public contract of functions/acceptGameInvite.js — mirrored.
  if (toEmail !== myEmail) {
    return Response.json({ error: 'Bu davet sana ait değil.' }, { status: 403 });
  }
  if (lobby.status !== 'waiting') {
    await base44.asServiceRole.entities.GameInvite.update(invite.id, { status: 'expired' });
  }
  const newPlayer = { email: myEmail, name: displayName, ready: false, cards: [] };
  const verifiedLobby = await base44.asServiceRole.entities.Lobby.update(lobby.id, {
    players: [...lobby.players, newPlayer],
  });
`;

// Codex080 — normalized friendship model. Mirrors live functions/acceptFriendRequest.js.
export const acceptFriendRequestFnSource = `
  // Public contract of functions/acceptFriendRequest.js — mirrored.
  //
  // Codex080 ROOT-CAUSE FIX (replaces all prior attempts):
  //   Root cause proven by live backend probe: Friendship.create RLS pins
  //   data.user_email === {{user.email}} and this rule is enforced even
  //   under base44.asServiceRole on this app. The live probe returned:
  //     403 "Permission denied for create operation on Friendship entity"
  //   So creating the sender-owned mirror row was IMPOSSIBLE.
  //
  //   Codex080 switches to a NORMALIZED model: the accepted FriendRequest
  //   row IS the friendship. Both sender and recipient can read it under
  //   existing FriendRequest RLS. The client friend-list loader projects
  //   both sides into the existing {friend_email, friend_name} shape so
  //   the UI is unchanged.
  if (toEmail !== myEmail) {
    return json({ ok: false, error: 'Only the receiver can accept this request' }, 403);
  }
  if (!fromEmail || fromEmail === toEmail) {
    return json({ ok: false, error: 'Invalid friend request' }, 400);
  }
  if (fr.status !== 'pending' && fr.status !== 'accepted') {
    return json({ ok: false, error: 'Request is already ' + fr.status }, 409);
  }
  if (fr.status === 'pending') {
    await base44.asServiceRole.entities.FriendRequest.update(requestId, { status: 'accepted' });
  }
  return json({
    ok: true,
    success: true,
    requestStatus: 'accepted',
    alreadyFriends: fr.status === 'accepted',
  });
`;

export const removeFriendFnSource = `
  // Public contract of functions/removeFriend.js — mirrored (Codex080).
  // Normalized model: flip accepted FriendRequest(s) between the pair back
  // to 'rejected'. Also legacy-cleans any old Friendship rows.
  await base44.asServiceRole.entities.FriendRequest.update(row.id, { status: 'rejected' });
  await base44.asServiceRole.entities.Friendship.delete(row.id);
`;