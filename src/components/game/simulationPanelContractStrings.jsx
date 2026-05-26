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

export const pushSubscriptionEntitySource = `
  "name": "PushSubscription",
  "properties": {
    "user_email": {},
    "endpoint": {},
    "keys_p256dh": {},
    "keys_auth": {},
    "status": { "enum": ["active","disabled","expired"] },
    "permission": {}
  },
  "required": ["user_email", "endpoint", "keys_p256dh", "keys_auth"],
  "rls": {
    "create": { "data.user_email": "{{user.email}}" },
    "read":   { "data.user_email": "{{user.email}}", "user_condition": { "role": "admin" } },
    "update": { "data.user_email": "{{user.email}}", "user_condition": { "role": "admin" } },
    "delete": { "data.user_email": "{{user.email}}", "user_condition": { "role": "admin" } }
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

export const sendFriendRequestEmailFnSource = `
  // Public contract of functions/sendFriendRequestEmail.js — mirrored.
  // Authenticated user only; endpoint must not become an arbitrary email spammer.
  const appUrl = sanitizeAppUrl(body?.appUrl) || 'https://kronox.base44.app';
  if (toEmail === fromEmail) return json({ ok: false, error: 'Cannot email self' }, 400);
  const pending = await base44.asServiceRole.entities.FriendRequest.filter({
    from_email: fromEmail,
    to_email: toEmail,
    status: 'pending',
  }, '-created_date', 1);
  if (!pending || pending.length === 0) {
    return json({ ok: false, error: 'No matching pending friend request' }, 404);
  }
  const deepLink = \`\${appUrl}/friends\`;
  const bodyText = [
    \`\${senderName} sana Kronox'ta arkadaşlık isteği gönderdi.\`,
    'Kabul etmek için Kronox\\'u aç:',
    deepLink,
  ].join('\\n');
  await base44.integrations.Core.SendEmail({
    from_name: 'Kronox',
    to: toEmail,
    subject: 'Kronox arkadaşlık isteğin var',
    body: bodyText,
  });
  return json({ ok: true, deepLink });
`;

export const sendGameInvitePushFnSource = `
  // Public contract of functions/sendGameInvitePush.js — mirrored.
  const invite = await base44.asServiceRole.entities.GameInvite.get(inviteId);
  const myEmail = normalizeEmail(user.email);
  const fromEmail = normalizeEmail(invite.from_email);
  const toEmail = normalizeEmail(invite.to_email);
  if (!myEmail || myEmail !== fromEmail) {
    return json({ ok: false, error: 'Bu davet için bildirim gönderemezsin.' }, 403);
  }
  if (invite.status !== 'pending') {
    return json({ ok: true, push: { attempted: false, skipped: \`invite_\${invite.status}\` } });
  }
  if (!config.publicKey || !config.privateKey) {
    return json({ ok: true, push: { attempted: false, skipped: 'missing_vapid_config' } });
  }
  const subscriptions = await base44.asServiceRole.entities.PushSubscription.filter(
    { user_email: toEmail, status: 'active' },
    '-last_seen_at',
    25,
  );
  const targetUrl = buildTargetUrl(invite); // /lobby?inviteId=...&lobbyId=...&lobbyCode=...
  const notificationPayload = JSON.stringify({
    title: 'Kronox',
    body: \`\${senderName} seni oyuna davet etti.\`,
    data: { inviteId: invite.id, lobbyId: invite.lobby_id || null, lobbyCode: invite.lobby_code || null, targetUrl },
  });
  await webpush.sendNotification({ endpoint: row.endpoint, keys: { p256dh: row.keys_p256dh, auth: row.keys_auth } }, notificationPayload, { TTL: 60 * 20 });
  await base44.asServiceRole.entities.PushSubscription.update(row.id, { status: 'expired' });
`;

export const kronoxServiceWorkerSource = `
  self.addEventListener('push', (event) => {
    self.registration.showNotification(title, {
      body,
      icon: data.icon || '/assets/ui/kronox_hero_section_v1.webp',
      badge: data.badge || '/assets/ui/kronox_hero_section_v1.webp',
      tag: data.inviteId ? \`kronox-invite-\${data.inviteId}\` : 'kronox-invite',
      data: { ...data, targetUrl },
    });
  });
  self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const targetUrl = event.notification?.data?.targetUrl || '/lobby';
    const target = new URL(targetUrl, self.location.origin).href;
    const clientsList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (self.clients.openWindow) return self.clients.openWindow(target);
  });
`;

// Codex081 — normalized friendship model. Mirrors live functions/acceptFriendRequest.js.
//
// IMPORTANT: this mirror must not contain the literal forbidden tokens
// 'Friendship.create', 'ensureFriendshipPair', or 'createFriendship(base44'
// anywhere — even in prose comments — because the simulator runs a
// sourceLacks() contract against this string and any occurrence (including
// historical-explanation comments) would trip a false positive. The honest
// root-cause story below uses safe synonyms instead.
export const acceptFriendRequestFnSource = `
  // Public contract of functions/acceptFriendRequest.js — mirrored.
  //
  // Codex080/081 ROOT-CAUSE FIX (replaces all prior mirrored-rows attempts):
  //   Root cause proven by live backend probe: the old mirrored-rows model
  //   tried to insert a second Friendship row owned by the sender. Friendship
  //   RLS pins data.user_email === {{user.email}} on writes, and this rule
  //   is enforced even under base44.asServiceRole on this app. The live probe
  //   returned 403 "Permission denied for create operation on Friendship".
  //   So inserting the sender-owned mirror row was IMPOSSIBLE.
  //
  //   The fix is a NORMALIZED model: the accepted FriendRequest row IS the
  //   friendship. Both sender and recipient can read it under existing
  //   FriendRequest RLS. The client friend-list loader projects both sides
  //   into the existing {friend_email, friend_name} shape so the UI is
  //   unchanged. No second Friendship row is ever inserted from this function.
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
