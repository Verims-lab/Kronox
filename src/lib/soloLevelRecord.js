// Solo success popup — "global rekor / arkadaş rekoru" helper.
//
// Returns one of:
//   { kind: 'global_first' }   → player has THE best time globally for this level.
//   { kind: 'friends_first' }  → player has the best time among accepted friends only.
//   { kind: 'none' }           → no record-worthy status; popup shows no badge.
//
// Strategy
//   • Reuse the existing `getSoloLeaderboard` backend function with the
//     optional `levelNumber` projection (added in Codex152). Each row
//     carries `{ user_email, level: { best_time_seconds } }` when that
//     user has completed the level.
//   • The CURRENT attempt's timeSeconds is compared against those rows
//     — including the player's own previous bestTimeSeconds, so a
//     replay that did NOT beat their own best is correctly NOT a record.
//   • Friend set comes from accepted FriendRequests on both sides
//     (sender/recipient), via `loadFriends()`.
//   • All comparisons are strict "<" so ties don't claim a record.
//
// Failure modes are silent: any thrown error returns { kind: 'none' }
// so the popup never blocks on backend hiccups.

import { base44 } from '@/api/base44Client';
import { loadFriends, normalizeEmail } from '@/lib/friendsApi';

/**
 * @param {{ levelNumber: number, timeSeconds: number, userEmail?: string }} params
 * @returns {Promise<{ kind: 'global_first' | 'friends_first' | 'none' }>}
 */
export async function fetchSoloLevelRecordContext({ levelNumber, timeSeconds, userEmail }) {
  const level = Math.max(0, Math.floor(Number(levelNumber) || 0));
  const attemptTime = Number(timeSeconds);
  if (!level || !Number.isFinite(attemptTime) || attemptTime <= 0) {
    return { kind: 'none' };
  }
  const me = normalizeEmail(userEmail);

  try {
    // Pull leaderboard rows with per-level projection.
    const res = await base44.functions.invoke('getSoloLeaderboard', {
      levelNumber: level,
      limit: 500,
    });
    const rows = Array.isArray(res?.data?.rows) ? res.data.rows : [];

    // Collect every OTHER user's best time for this level (skip my own row
    // so my prior best doesn't beat my current attempt — the new attempt
    // hasn't been persisted yet when this helper runs).
    const othersTimes = [];
    for (const row of rows) {
      const rowEmail = normalizeEmail(row?.user_email);
      if (me && rowEmail === me) continue;
      const t = Number(row?.level?.best_time_seconds);
      if (Number.isFinite(t) && t > 0) othersTimes.push({ email: rowEmail, time: t });
    }

    // Global first → strictly faster than every other completed time.
    const isGlobalFirst = othersTimes.every((o) => attemptTime < o.time);
    if (isGlobalFirst) return { kind: 'global_first' };

    // Friends-first → faster than every accepted friend's best time.
    if (!me) return { kind: 'none' };
    const friends = await loadFriends(me).catch(() => []);
    if (!Array.isArray(friends) || friends.length === 0) return { kind: 'none' };
    const friendEmails = new Set(friends.map((f) => normalizeEmail(f?.friend_email)).filter(Boolean));
    const friendTimes = othersTimes.filter((o) => friendEmails.has(o.email));
    if (friendTimes.length === 0) return { kind: 'none' };
    const beatAllFriends = friendTimes.every((f) => attemptTime < f.time);
    return beatAllFriends ? { kind: 'friends_first' } : { kind: 'none' };
  } catch {
    return { kind: 'none' };
  }
}