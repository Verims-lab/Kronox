export const LOBBY_ACCEPTANCE_FRESH_WINDOW_MS = 2 * 60 * 1000;

function readTime(value) {
  const time = Date.parse(String(value || ''));
  return Number.isFinite(time) ? time : null;
}

export function isLobbyAcceptanceNotificationEligible(invite, now = Date.now()) {
  if (!invite || invite.status !== 'accepted' || invite.notification_suppressed === true) return false;
  const acceptedAt = readTime(invite.accepted_at);
  if (acceptedAt === null) return false;
  const age = now - acceptedAt;
  return age >= 0 && age <= LOBBY_ACCEPTANCE_FRESH_WINDOW_MS;
}

export function collapseLobbyAcceptanceNotifications(invites, now = Date.now()) {
  const byId = new Map();
  (Array.isArray(invites) ? invites : []).forEach((invite) => {
    if (invite?.id && isLobbyAcceptanceNotificationEligible(invite, now)) byId.set(invite.id, invite);
  });
  const rows = Array.from(byId.values());
  if (!rows.length) return null;
  const lobbyRefs = new Set(rows.map((row) => row.lobby_ref || row.lobby_id).filter(Boolean));
  return {
    rows,
    count: rows.length,
    sameLobby: lobbyRefs.size === 1,
    lobbyRef: lobbyRefs.size === 1 ? Array.from(lobbyRefs)[0] : '',
  };
}