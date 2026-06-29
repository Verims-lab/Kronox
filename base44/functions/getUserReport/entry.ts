import { createClientFromRequest } from 'npm:@base44/sdk@0.8.34';

const MAX_USER_ROWS = 10000;
const MAX_GUEST_ROWS = 10000;
const MAX_LEADERBOARD_ROWS = 10000;
const PLATFORM_VALUES = ['ios', 'android', 'other', 'unknown'] as const;
const UNSAFE_PUBLIC_USERNAME_PATTERN = /^(apple|google|firebase|auth0|base44|provider|uid|owner)(?:[\w:-].*)?$/i;
const INTERNAL_ID_PUBLIC_USERNAME_PATTERN = /^(guest|player|owner|user_key|player_key|g|u)_[A-Za-z0-9_-]{4,}$/i;
const KRONOX_ID_PATTERN = /^KX-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/;

function json(payload: unknown, status = 200) {
  return Response.json(payload, { status });
}

function normalizeEmail(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function isActiveAdminRole(role: unknown) {
  const value = String(role || '').trim().toLowerCase();
  return value === 'owner' || value === 'admin';
}

function isActiveAdminStatus(status: unknown) {
  return String(status || '').trim().toLowerCase() === 'active';
}

const ADMIN_AUTH_FIELD_CANDIDATES = {
  email: ['email', 'Email', 'user_email', 'admin_email'],
  role: ['role', 'Role', 'user_role'],
  status: ['status', 'Status'],
};

function readAdminAuthField(row: any, candidates: string[]) {
  for (const field of candidates) {
    if (row && Object.prototype.hasOwnProperty.call(row, field)) {
      return { value: row[field], field };
    }
  }
  return { value: undefined, field: '' };
}

async function getAdminAuthorization(base44: any, user: any) {
  const email = normalizeEmail(user?.email);
  if (!email) return { isAdmin: false, row: null, role: '', status: '' };

  const adminEntity = base44?.asServiceRole?.entities?.AdminUser;
  if (!adminEntity?.filter) return { isAdmin: false, row: null, role: '', status: '' };

  let rows: any[] = [];
  for (const field of ADMIN_AUTH_FIELD_CANDIDATES.email) {
    const result = await adminEntity.filter({ [field]: email }, '-updated_at', 10).catch(() => []);
    if (Array.isArray(result) && result.length > 0) {
      rows = result;
      break;
    }
  }

  const exactRows = (rows || [])
    .map((candidate: any) => {
      const emailField = readAdminAuthField(candidate, ADMIN_AUTH_FIELD_CANDIDATES.email);
      const roleField = readAdminAuthField(candidate, ADMIN_AUTH_FIELD_CANDIDATES.role);
      const statusField = readAdminAuthField(candidate, ADMIN_AUTH_FIELD_CANDIDATES.status);
      return {
        candidate,
        email: normalizeEmail(emailField.value),
        role: String(roleField.value || '').trim().toLowerCase(),
        status: String(statusField.value || '').trim().toLowerCase(),
      };
    })
    .filter((candidate) => candidate.email === email);

  const active = exactRows.find((candidate) => (
    isActiveAdminStatus(candidate.status) && isActiveAdminRole(candidate.role)
  )) || null;

  return {
    isAdmin: Boolean(active?.candidate),
    row: active?.candidate || null,
    role: active?.role || '',
    status: active?.status || '',
  };
}

async function requireAdmin(base44: any) {
  try {
    const user = await base44.auth.me();
    if (!user?.email) return { response: json({ ok: false, error: 'Authentication required' }, 401) };

    const authorization = await getAdminAuthorization(base44, user);
    if (!authorization.isAdmin) return { response: json({ ok: false, error: 'Admin access required' }, 403) };

    return { user, admin: authorization.row, adminRole: authorization.role };
  } catch (_error) {
    return { response: json({ ok: false, error: 'Authentication required' }, 401) };
  }
}

function safeNumber(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function safeInteger(value: unknown) {
  return Math.max(0, Math.floor(safeNumber(value, 0)));
}

function normalizeUsername(value: unknown) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text;
}

function isSafePublicUsername(value: unknown) {
  const username = normalizeUsername(value);
  return Boolean(
    username &&
    /^[A-Za-z0-9_]{3,24}$/.test(username) &&
    !username.includes('@') &&
    !UNSAFE_PUBLIC_USERNAME_PATTERN.test(username) &&
    !INTERNAL_ID_PUBLIC_USERNAME_PATTERN.test(username),
  );
}

function normalizeUsernameKey(value: unknown) {
  const username = normalizeUsername(value);
  return isSafePublicUsername(username) ? username.toLowerCase() : '';
}

function hasKronoxUserId(row: any) {
  return KRONOX_ID_PATTERN.test(String(row?.kronox_user_id || '').trim().toUpperCase());
}

function usernameKeyFromRow(row: any) {
  return normalizeUsernameKey(row?.username || row?.public_username || row?.display_name) || '';
}

function usernameKeyFromLeaderboard(row: any) {
  return normalizeUsernameKey(row?.username || row?.public_username) || '';
}

function parseTime(value: unknown) {
  const time = Date.parse(String(value || ''));
  return Number.isFinite(time) ? time : 0;
}

function firstTimeValue(...values: unknown[]) {
  for (const value of values) {
    const time = parseTime(value);
    if (time) return String(value);
  }
  return '';
}

function latestProfileTime(row: any) {
  return firstTimeValue(row?.last_app_open_at, row?.last_seen_at);
}

function createdTime(row: any) {
  return firstTimeValue(row?.created_at, row?.created_date);
}

function normalizePlatform(value: unknown) {
  const platform = String(value || '').trim().toLowerCase();
  return PLATFORM_VALUES.includes(platform as any) ? platform : 'unknown';
}

function blankPlatformCounts() {
  return { ios: 0, android: 0, other: 0, unknown: 0 };
}

function incrementPlatform(counts: Record<string, number>, value: unknown) {
  const platform = normalizePlatform(value);
  counts[platform] = (counts[platform] || 0) + 1;
}

async function safeList(entity: any, sort: string, limit: number) {
  if (!entity?.list) return [];
  const rows = await entity.list(sort, limit).catch(() => []);
  return Array.isArray(rows) ? rows : [];
}

function mergePlatform(existing: string, next: string) {
  if (existing && existing !== 'unknown') return existing;
  return normalizePlatform(next);
}

function buildUserReport(users: any[], guests: any[], leaderboardRows: any[]) {
  const nowMs = Date.now();
  const oneDayMs = 24 * 60 * 60 * 1000;
  const inactiveCutoffMs = nowMs - 10 * oneDayMs;
  const newUserCutoffMs = nowMs - 7 * oneDayMs;
  const active1CutoffMs = nowMs - oneDayMs;
  const active7CutoffMs = nowMs - 7 * oneDayMs;
  const active30CutoffMs = nowMs - 30 * oneDayMs;

  const usernameProfiles = new Map<string, any>();
  const loggedInEmails = new Set<string>();
  const guestUsernames = new Set<string>();
  let invalidUsernameRows = 0;
  let userRowsWithKronoxId = 0;
  let guestRowsWithKronoxId = 0;

  const upsertProfile = (usernameKey: string, patch: any) => {
    if (!usernameKey) return;
    const current = usernameProfiles.get(usernameKey) || {
      usernameKey,
      playerTypes: new Set(),
      lastOpenAt: '',
      createdAt: '',
      platform: 'unknown',
    };
    if (patch.playerType) current.playerTypes.add(patch.playerType);
    if (patch.lastOpenAt && parseTime(patch.lastOpenAt) > parseTime(current.lastOpenAt)) current.lastOpenAt = patch.lastOpenAt;
    if (patch.createdAt && (!current.createdAt || parseTime(patch.createdAt) < parseTime(current.createdAt))) current.createdAt = patch.createdAt;
    current.platform = mergePlatform(current.platform, patch.platform);
    usernameProfiles.set(usernameKey, current);
  };

  for (const user of users) {
    if (hasKronoxUserId(user)) userRowsWithKronoxId += 1;
    const usernameKey = usernameKeyFromRow(user);
    if (!usernameKey) {
      invalidUsernameRows += 1;
    } else {
      upsertProfile(usernameKey, {
        playerType: 'linked',
        lastOpenAt: latestProfileTime(user),
        createdAt: createdTime(user),
        platform: user?.app_platform,
      });
    }
    const email = normalizeEmail(user?.email || user?.user_email);
    if (email) loggedInEmails.add(email);
  }

  for (const guest of guests) {
    if (hasKronoxUserId(guest)) guestRowsWithKronoxId += 1;
    const usernameKey = usernameKeyFromRow(guest);
    const isLinkedGuest = String(guest?.status || '').trim().toLowerCase() === 'linked' || Boolean(guest?.linked_user_email);
    if (!usernameKey) {
      invalidUsernameRows += 1;
      continue;
    }
    upsertProfile(usernameKey, {
      playerType: isLinkedGuest ? 'linked_guest_profile' : 'guest',
      lastOpenAt: latestProfileTime(guest),
      createdAt: createdTime(guest),
      platform: guest?.app_platform,
    });
    if (!isLinkedGuest) guestUsernames.add(usernameKey);
  }

  const positiveScoreUsernames = new Set<string>();
  for (const row of leaderboardRows) {
    if (safeInteger(row?.total_kronox_score) <= 0) continue;
    const usernameKey = usernameKeyFromLeaderboard(row);
    if (usernameKey) positiveScoreUsernames.add(usernameKey);
  }
  for (const user of users) {
    if (safeInteger(user?.kronox_puan_total) <= 0) continue;
    const usernameKey = usernameKeyFromRow(user);
    if (usernameKey) positiveScoreUsernames.add(usernameKey);
  }
  for (const guest of guests) {
    if (safeInteger(guest?.kronox_puan_total) <= 0) continue;
    const usernameKey = usernameKeyFromRow(guest);
    if (usernameKey) positiveScoreUsernames.add(usernameKey);
  }

  let inactive10Days = 0;
  let noLastOpen = 0;
  let zeroScoreInactive10Days = 0;
  let newUsers7Days = 0;
  let active1Day = 0;
  let active7Days = 0;
  let active30Days = 0;
  const platformBreakdown = blankPlatformCounts();
  const active30PlatformBreakdown = blankPlatformCounts();

  for (const [usernameKey, profile] of usernameProfiles.entries()) {
    const lastOpenMs = parseTime(profile.lastOpenAt);
    const createdMs = parseTime(profile.createdAt);
    const hasPositiveScore = positiveScoreUsernames.has(usernameKey);
    incrementPlatform(platformBreakdown, profile.platform);
    if (!lastOpenMs) {
      noLastOpen += 1;
    } else {
      if (lastOpenMs < inactiveCutoffMs) {
        inactive10Days += 1;
        if (!hasPositiveScore) zeroScoreInactive10Days += 1;
      }
      if (lastOpenMs >= active1CutoffMs) active1Day += 1;
      if (lastOpenMs >= active7CutoffMs) active7Days += 1;
      if (lastOpenMs >= active30CutoffMs) {
        active30Days += 1;
        incrementPlatform(active30PlatformBreakdown, profile.platform);
      }
    }
    if (createdMs && createdMs >= newUserCutoffMs) newUsers7Days += 1;
  }

  const totalUsers = usernameProfiles.size;
  const positiveScoreUsers = Array.from(positiveScoreUsernames).filter((key) => usernameProfiles.has(key)).length;
  const zeroScoreUsers = Math.max(0, totalUsers - positiveScoreUsers);
  const loggedInUsers = loggedInEmails.size;
  const loginRatio = totalUsers > 0 ? Math.round((loggedInUsers / totalUsers) * 1000) / 10 : 0;

  return {
    generatedAt: new Date(nowMs).toISOString(),
    windowDays: {
      inactiveThresholdDays: 10,
      activeWindows: [1, 7, 30],
      newUserWindowDays: 7,
    },
    counts: {
      totalUsersByDistinctValidUsername: totalUsers,
      loggedInUsers,
      guestUsers: guestUsernames.size,
      loginRatioPercent: loginRatio,
      usersWithKronoxPuanGreaterThanZero: positiveScoreUsers,
      usersWithZeroKronoxPuan: zeroScoreUsers,
      inactive10DaysUsers: inactive10Days,
      noLastOpenUsers: noLastOpen,
      zeroScoreAndInactive10DaysUsers: zeroScoreInactive10Days,
      newUsers7Days,
      activeUsers1Day: active1Day,
      activeUsers7Days: active7Days,
      activeUsers30Days: active30Days,
      rowsWithKronoxUserId: userRowsWithKronoxId + guestRowsWithKronoxId,
      rowsMissingKronoxUserId: Math.max(0, users.length + guests.length - userRowsWithKronoxId - guestRowsWithKronoxId),
    },
    platformBreakdown,
    active30DayPlatformBreakdown: active30PlatformBreakdown,
    sourceRows: {
      userRowsRead: users.length,
      guestProfileRowsRead: guests.length,
      soloLeaderboardRowsRead: leaderboardRows.length,
      invalidUsernameRowsExcluded: invalidUsernameRows,
    },
    sourceOfTruth: {
      username: 'distinct valid username across User and GuestProfile; invalid/empty unsafe usernames excluded',
      loggedIn: 'User rows with authenticated email/user_email, counted server-side only and not returned',
      score: 'SoloLeaderboardEntry.total_kronox_score plus User/GuestProfile.kronox_puan_total repair where projection is missing',
      activity: 'server-written last_app_open_at or last_seen_at; missing timestamps are reported separately',
      platform: 'server-recorded coarse app_platform: ios/android/other/unknown',
      kronoxUserId: 'aggregate coverage only; immutable Kronox ID values are not exported from this report',
    },
    notes: [
      'Bu rapor salt okunurdur; kullanıcı silmez.',
      'E-posta, provider ID, owner_key, raw guest_id ve internal player_key döndürülmez.',
      'Kronox ID sadece toplu kapsam sayılarıyla raporlanır; kimlik listesi dışa aktarılmaz.',
      'Son açılış bilgisi olmayan kullanıcılar 10+ gün inaktif sayısına sessizce eklenmez.',
    ],
  };
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405);

  const base44 = createClientFromRequest(req);
  const admin = await requireAdmin(base44);
  if (admin.response) return admin.response;

  try {
    const users = await safeList(base44.asServiceRole.entities.User, '-created_date', MAX_USER_ROWS);
    const guests = await safeList(base44.asServiceRole.entities.GuestProfile, '-created_at', MAX_GUEST_ROWS);
    const leaderboardRows = await safeList(base44.asServiceRole.entities.SoloLeaderboardEntry, '-total_kronox_score', MAX_LEADERBOARD_ROWS);
    const report = buildUserReport(users, guests, leaderboardRows);

    return json({
      ok: true,
      report,
      contract: {
        adminOnly: true,
        aggregateOnly: true,
        readOnly: true,
        deletesUsers: false,
        mutatesScoreOrEconomy: false,
        exposesEmail: false,
        exposesProviderId: false,
        exposesOwnerKey: false,
        exposesRawGuestId: false,
        exposesInternalPlayerKey: false,
        coarsePlatformOnly: true,
      },
    });
  } catch (_error) {
    return json({ ok: false, code: 'user_report_failed', error: 'Kullanıcı raporu hazırlanamadı.' }, 500);
  }
});
