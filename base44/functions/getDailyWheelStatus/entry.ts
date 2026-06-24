import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const GUEST_ID_PREFIX = 'guest_';

function json(payload: unknown, status = 200) {
  return Response.json(payload, { status });
}

function normalizeEmail(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function normalizeNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : 0;
}

function utcDateKey(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

function nextUtcMidnightIso(dateKey: string) {
  const start = Date.parse(`${dateKey}T00:00:00.000Z`);
  return new Date(start + 24 * 60 * 60 * 1000).toISOString();
}

function previousUtcDateKey(dateKey: string) {
  const start = Date.parse(`${dateKey}T00:00:00.000Z`);
  return new Date(start - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function buildIdempotencyKey(email: string, dateKey: string) {
  return `daily_wheel:${email}:${dateKey}`;
}

function safeCredentialText(value: unknown, maxLength = 180) {
  const text = String(value || '').trim();
  if (!text || text.length > maxLength) return '';
  return /^[A-Za-z0-9_-]+$/.test(text) ? text : '';
}

function normalizeGuestId(value: unknown) {
  const text = safeCredentialText(value, 80);
  return text.startsWith(GUEST_ID_PREFIX) ? text : '';
}

function normalizeGuestToken(value: unknown) {
  return safeCredentialText(value, 220);
}

function rowId(row: any) {
  return row?.id || row?._id || null;
}

function ownerKeyFromEmail(rawEmail: unknown) {
  const email = normalizeEmail(rawEmail);
  if (!email) return '';
  let hash = 2166136261;
  for (let i = 0; i < email.length; i += 1) {
    hash ^= email.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `u_${(hash >>> 0).toString(36)}`;
}

function ownerKeyFromGuestId(rawGuestId: unknown) {
  const guestId = String(rawGuestId || '').trim().toLowerCase();
  if (!guestId) return '';
  let hash = 2166136261;
  for (let i = 0; i < guestId.length; i += 1) {
    hash ^= guestId.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `g_${(hash >>> 0).toString(36)}`;
}

function guestPlayerKey(guestId: string) {
  const ownerKey = ownerKeyFromGuestId(guestId);
  return ownerKey ? `guest:${ownerKey}` : '';
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function sha256Base64Url(input: string) {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return bytesToBase64Url(new Uint8Array(digest));
}

async function hashGuestToken(guestId: string, guestToken: string) {
  return sha256Base64Url(`kronox_guest_v1:${guestId}:${guestToken}`);
}

function isGuestProfileComplete(row: any) {
  const status = String(row?.onboarding_status || '').trim();
  if (status === 'onboarding_complete' || status === 'completed') return true;
  const profileCompleted = String(row?.profile_setup_status || '').trim() === 'completed' || Boolean(row?.profile_setup_completed_at);
  const categoryCompleted = String(row?.category_setup_status || '').trim() === 'completed' ||
    Boolean(row?.category_setup_completed_at || row?.onboarding_completed_at);
  return Boolean(profileCompleted && categoryCompleted);
}

async function findGuestProfile(base44: any, guestId: string) {
  const entity = base44?.asServiceRole?.entities?.GuestProfile || base44?.entities?.GuestProfile;
  if (!entity?.filter || !guestId) return null;
  const rows = await entity.filter({ guest_id: guestId }, '-created_at', 5).catch(() => []);
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function resolveDailyWheelPlayer(base44: any, body: any) {
  const user = await base44.auth.me().catch(() => null);
  const email = normalizeEmail(user?.email || user?.user_email);
  if (email && rowId(user)) {
    return {
      ok: true,
      isGuest: false,
      row: user,
      playerKey: email,
      ownerKey: ownerKeyFromEmail(email),
      response: null,
    };
  }

  const guestId = normalizeGuestId(body?.guest_id);
  const guestToken = normalizeGuestToken(body?.guest_token);
  if (!guestId || !guestToken) {
    return { ok: false, response: json({ ok: false, code: 'unauthenticated', error: 'Günlük Çark için profilini tamamlamalısın.' }, 401) };
  }
  const guest = await findGuestProfile(base44, guestId);
  const expectedHash = String(guest?.guest_token_hash || '');
  const providedHash = await hashGuestToken(guestId, guestToken);
  if (!guest || !expectedHash || expectedHash !== providedHash) {
    return { ok: false, response: json({ ok: false, code: 'invalid_guest_token', error: 'Misafir oturumu doğrulanamadı.' }, 401) };
  }
  if (String(guest?.status || '') === 'linked' || !isGuestProfileComplete(guest)) {
    return { ok: false, response: json({ ok: false, code: 'guest_profile_incomplete', error: 'Günlük Çark için profilini tamamlamalısın.' }, 403) };
  }
  return {
    ok: true,
    isGuest: true,
    row: guest,
    playerKey: guestPlayerKey(guestId),
    ownerKey: ownerKeyFromGuestId(guestId),
    response: null,
  };
}

function currentAvailableStreak(playerRow: any, todayKey: string) {
  const lastDate = String(playerRow?.daily_wheel_last_spin_date || '');
  const stored = normalizeNumber(playerRow?.daily_wheel_streak);
  return lastDate && lastDate === previousUtcDateKey(todayKey) ? stored : 0;
}

async function findTodaySpin(base44: any, email: string, dateKey: string, idempotencyKey: string) {
  const entity = base44.asServiceRole.entities.DailyWheelSpin;
  if (!entity?.filter) return null;
  const [byKey, byDate] = await Promise.all([
    entity.filter({ user_email: email, idempotency_key: idempotencyKey }, '-claimed_at', 1).catch(() => []),
    entity.filter({ user_email: email, spin_date: dateKey }, '-claimed_at', 1).catch(() => []),
  ]);
  const rows = [...(Array.isArray(byKey) ? byKey : []), ...(Array.isArray(byDate) ? byDate : [])];
  return rows.find((row: any) => row?.id) || null;
}

async function findTodayDiamondTransaction(base44: any, email: string, idempotencyKey: string) {
  const rows = await base44.asServiceRole.entities.DiamondTransaction
    .filter({ user_email: email, idempotency_key: idempotencyKey }, '-created_at', 1)
    .catch(() => []);
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}


function publicSpinResult(row: any) {
  if (!row) return null;
  return {
    rewardAmount: normalizeNumber(row.reward_amount),
    streakBefore: normalizeNumber(row.streak_before),
    streakAfter: normalizeNumber(row.streak_after),
    streakBonusAmount: normalizeNumber(row.streak_bonus_amount),
    totalRewardAmount: normalizeNumber(row.total_reward_amount),
    claimedAt: row.claimed_at || null,
    nextAvailableAt: row.next_available_at || null,
  };
}

function publicSpinResultFromTransaction(tx: any, user: any, nextAvailableAt: string) {
  if (!tx) return null;
  const metadata = tx?.metadata && typeof tx.metadata === 'object' ? tx.metadata : {};
  const totalRewardAmount = normalizeNumber(tx.amount);
  const streakBonusAmount = normalizeNumber(metadata.streakBonusAmount);
  const rewardAmount = normalizeNumber(metadata.rewardAmount) || Math.max(0, totalRewardAmount - streakBonusAmount);
  const streakAfter = normalizeNumber(metadata.streakAfter ?? user?.daily_wheel_streak);
  const streakBefore = normalizeNumber(metadata.streakBefore ?? Math.max(0, streakAfter - 1));
  return {
    rewardAmount,
    streakBefore,
    streakAfter,
    streakBonusAmount,
    totalRewardAmount,
    claimedAt: tx.created_at || user?.daily_wheel_last_spin_at || null,
    nextAvailableAt: user?.daily_wheel_next_available_at || nextAvailableAt,
  };
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method !== 'POST') {
      return json({ ok: false, code: 'method_not_allowed', error: 'Bu işlem desteklenmiyor.' }, 405);
    }

    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const player = await resolveDailyWheelPlayer(base44, body);
    if (!player.ok) return player.response;
    const playerKey = player.playerKey;
    const playerRow = player.row;

    const todayKey = utcDateKey();
    const nextAvailableAt = nextUtcMidnightIso(todayKey);
    const idempotencyKey = buildIdempotencyKey(playerKey, todayKey);
    const todaySpin = await findTodaySpin(base44, playerKey, todayKey, idempotencyKey);
    const todayTransaction = todaySpin ? null : await findTodayDiamondTransaction(base44, playerKey, idempotencyKey);
    const userGuardClaimed = String(playerRow?.daily_wheel_last_spin_date || '') === todayKey;
    const alreadyClaimedToday = Boolean(todaySpin || todayTransaction || userGuardClaimed);
    const lastReward = todaySpin
      ? publicSpinResult(todaySpin)
      : publicSpinResultFromTransaction(todayTransaction, playerRow, nextAvailableAt);

    return json({
      ok: true,
      playerType: player.isGuest ? 'guest' : 'registered',
      guestProfile: player.isGuest,
      available: !alreadyClaimedToday,
      alreadyClaimedToday,
      serverDate: todayKey,
      nextAvailableAt: todaySpin?.next_available_at || playerRow?.daily_wheel_next_available_at || nextAvailableAt,
      currentStreak: alreadyClaimedToday
        ? normalizeNumber(todaySpin?.streak_after ?? playerRow?.daily_wheel_streak)
        : currentAvailableStreak(playerRow, todayKey),
      lastReward,
      diamondTotal: normalizeNumber(playerRow?.diamonds),
    });
  } catch (error) {
    console.error('[getDailyWheelStatus] failed', error);
    return json({
      ok: false,
      code: 'daily_wheel_status_failed',
      error: 'Günlük Çark durumu alınamadı. Lütfen tekrar dene.',
    }, 500);
  }
});
