// Kronox Health Center — Profile Avatar contracts (Codex486).
//
// Locked product decisions:
// - Profile avatar can be a bundled app-local icon or an uploaded photo.
// - Bundled icons are lucide-react glyphs (ISC, shipped with the app), never
//   runtime-hotlinked remote images or trademarked character art.
// - Avatar updates are owner-bound through updateProfileSettings (auth.me or
//   guest-token proof) and never overwrite protected fields (kronox_user_id,
//   username, scores) or accept a client kronox_user_id.
// - Photo avatars store only a safe https Base44 storage URL (no base64 blobs,
//   no private/internal IDs) and uploads accept image types only.

import updateProfileSettingsSource from '../../../base44/functions/updateProfileSettings/entry.ts?raw';
import acceptGameInviteSource from '../../../base44/functions/acceptGameInvite/entry.ts?raw';
import findLobbyByCodeSource from '../../../base44/functions/findLobbyByCode/entry.ts?raw';
import getOnlinePlayerSelectionSource from '../../../base44/functions/getOnlinePlayerSelection/entry.ts?raw';
import getSoloLeaderboardSource from '../../../base44/functions/getSoloLeaderboard/entry.ts?raw';
import createLobbyInvitePanelSource from '../lobby/CreateLobbyInvitePanel.jsx?raw';
import friendListItemSource from '../friends/FriendListItem.jsx?raw';
import friendSelectModalSource from '../lobby/FriendSelectModal.jsx?raw';
import incomingInvitesPanelSource from '../invites/IncomingInvitesPanel.jsx?raw';
import incomingRequestItemSource from '../friends/IncomingRequestItem.jsx?raw';
import kronoxRankingSectionSource from '../leaderboard/KronoxRankingSection.jsx?raw';
import leaderboardPageSource from '../../pages/LeaderboardPage.jsx?raw';
import outgoingRequestItemSource from '../friends/OutgoingRequestItem.jsx?raw';
import screenHeaderSource from '../layout/ScreenHeader.jsx?raw';
import waitingRoomPanelSource from '../lobby/WaitingRoomPanel.jsx?raw';
import avatarOptionsSource from '../../lib/avatarOptions.js?raw';
import avatarUpdateSource from '../../lib/avatarUpdate.js?raw';
import friendsApiSource from '../../lib/friendsApi.js?raw';
import leaderboardSource from '../../lib/leaderboard.js?raw';
import lobbyUtilsSource from '../../lib/lobbyUtils.js?raw';
import onlinePlayerSelectionSource from '../../lib/onlinePlayerSelection.js?raw';
import presenceSource from '../../lib/presence.js?raw';
import avatarPickerSource from '../profile/AvatarPickerSheet.jsx?raw';
import kronoxAvatarSource from '../profile/KronoxAvatar.jsx?raw';

const SUITE_ID = 'profile_avatar_health';
const SUITE_NAME = 'Profile Avatar Health Suite';

const STATUS = { PASS: 'PASS', FAIL: 'FAIL', NOT_AUTOMATABLE: 'NOT_AUTOMATABLE' };
const ACTION_TYPES = { CODE_FIX: 'CODE_FIX', MANUAL_DEVICE: 'MANUAL_DEVICE' };

function makeCase(id, name, run, options = {}) {
  return {
    key: `${SUITE_ID}.${id}`,
    suiteId: SUITE_ID,
    suiteName: SUITE_NAME,
    id,
    name,
    critical: options.critical ?? true,
    ...options,
    run,
  };
}

function pass(reason, extra = {}) { return { status: STATUS.PASS, reason, ...extra }; }
function fail(reason, extra = {}) { return { status: STATUS.FAIL, reason, ...extra }; }
function notAutomatable(reason, extra = {}) { return { status: STATUS.NOT_AUTOMATABLE, reason, ...extra }; }

function missing(source, tokens) {
  return tokens.filter((token) => !String(source || '').includes(token));
}
function present(source, tokens) {
  return tokens.filter((token) => String(source || '').includes(token));
}

export const EXTRA_SUITES = [
  { id: SUITE_ID, name: SUITE_NAME, critical: true, color: '#f59e0b' },
];

export const EXTRA_TESTS = [
  makeCase('avatar_update_owner_bound',
    'Avatar update is owner-bound and rejects client kronox_user_id',
    () => {
      const requiredMissing = missing(updateProfileSettingsSource, [
        'buildAvatarPatch',
        'base44.auth.me()',
        'verifyGuestProfile',
        "code: 'kronox_user_id_client_input_forbidden'",
      ]);
      if (requiredMissing.length) {
        return fail('Avatar save path is not clearly owner-bound.', {
          verification: 'STATIC_CONTRACT',
          file: 'base44/functions/updateProfileSettings/entry.ts',
          expected: 'Avatar patch only applied through auth/guest-token-verified updateProfileSettings; client kronox_user_id rejected',
          actual: { missing: requiredMissing },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Avatar saves go through the existing owner-bound updateProfileSettings path.', {
        verification: 'STATIC_CONTRACT', actionType: ACTION_TYPES.CODE_FIX,
      });
    }),

  makeCase('avatar_does_not_overwrite_protected_fields',
    'Avatar patch preserves username/Kronox ID and is validated server-side',
    () => {
      const requiredMissing = missing(updateProfileSettingsSource, [
        'function buildAvatarPatch',
        "code: 'invalid_avatar'",
        'AVATAR_ICON_IDS.has(iconId)',
        'isSafeAvatarPhotoUrl',
        'ensureKronoxUserIdPatch',
      ]);
      // The avatar patch must be spread alongside username/age/gender, never
      // touching kronox_user_id / scores / economy fields.
      const forbidden = present(updateProfileSettingsSource, [
        'avatar_type: body.kronox_user_id',
        'diamonds: body',
      ]);
      if (requiredMissing.length || forbidden.length) {
        return fail('Avatar patch could overwrite protected fields or skip validation.', {
          verification: 'STATIC_CONTRACT',
          file: 'base44/functions/updateProfileSettings/entry.ts',
          expected: 'Validated avatar patch merged with profile patch; no score/economy/kronox_user_id writes',
          actual: { missing: requiredMissing, forbidden },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Avatar fields are validated and merged without overwriting protected profile fields.', {
        verification: 'STATIC_CONTRACT', actionType: ACTION_TYPES.CODE_FIX,
      });
    }),

  makeCase('avatar_icons_bundled_not_hotlinked',
    'Avatar icons are app-local lucide glyphs, not runtime remote hotlinks',
    () => {
      const combined = `${avatarOptionsSource}\n${kronoxAvatarSource}`;
      const requiredMissing = missing(combined, [
        'KRONOX_AVATAR_ICONS',
        'KRONOX_AVATAR_ICON_CATEGORIES',
        'getAvatarIconGlyph',
        "from 'lucide-react'",
      ]);
      const forbidden = present(`${avatarOptionsSource}\n${kronoxAvatarSource}`, [
        'http://',
        'images.unsplash',
        'cdn.',
        '.png"',
        '.svg"',
      ]).filter((token) => !`${avatarOptionsSource}\n${kronoxAvatarSource}`.includes(`// ${token}`));
      if (requiredMissing.length || forbidden.length) {
        return fail('Avatar icons are not strictly bundled/app-local.', {
          verification: 'STATIC_CONTRACT',
          expected: 'Bundled lucide glyph icon set; no remote image hotlinks for icons',
          actual: { missing: requiredMissing, forbidden },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Bundled icon avatars use the shipped lucide glyph set with no remote hotlinks.', {
        verification: 'STATIC_CONTRACT', classification: 'STATIC_CHECK_LIMITATION', actionType: ACTION_TYPES.CODE_FIX,
      });
    }),

  makeCase('avatar_icon_categories_local',
    'Avatar icon categories are local, app-owned, and broad enough for profile choice',
    () => {
      const combined = `${avatarOptionsSource}\n${avatarPickerSource}`;
      const requiredMissing = missing(combined, [
        'KRONOX_AVATAR_ICON_CATEGORIES',
        'Kahramanlar',
        'Zaman',
        'Mitik',
        'Uzay',
        'Bilgelik',
        'Enerji',
        "category: 'heroes'",
        "category: 'time'",
        "category: 'mythic'",
        "category: 'space'",
        "category: 'wisdom'",
        "category: 'energy'",
        "id: 'wand'",
        "id: 'telescope'",
        "id: 'brain'",
        "id: 'sun'",
      ]);
      const forbidden = present(combined, [
        'images.unsplash',
        'cdn.',
        'marvel',
        'pokemon',
        'disney',
      ]);
      if (requiredMissing.length || forbidden.length) {
        return fail('Avatar icon set is missing local categories or includes unsafe inspiration tokens.', {
          verification: 'STATIC_CONTRACT',
          expected: 'Bundled app-local icon categories with no hotlinked/trademark character assets',
          actual: { missing: requiredMissing, forbidden },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Avatar icon picker groups a broader bundled glyph set into local Kronox categories.', {
        verification: 'STATIC_CONTRACT', actionType: ACTION_TYPES.CODE_FIX,
      });
    }),

  makeCase('avatar_global_surfaces_use_shared_renderer',
    'Global public avatar surfaces use the shared KronoxAvatar renderer',
    () => {
      const surfaceChecks = [
        ['leaderboard', kronoxRankingSectionSource],
        ['friend row', friendListItemSource],
        ['incoming friend request', incomingRequestItemSource],
        ['outgoing friend request', outgoingRequestItemSource],
        ['player select modal', friendSelectModalSource],
        ['create lobby invite panel', createLobbyInvitePanelSource],
        ['waiting room player list', waitingRoomPanelSource],
        ['incoming invites panel', incomingInvitesPanelSource],
        ['screen header profile control', screenHeaderSource],
      ].map(([name, source]) => ({ name, missing: missing(source, ['KronoxAvatar', '<KronoxAvatar']) }))
        .filter((entry) => entry.missing.length);
      if (surfaceChecks.length) {
        return fail('One or more public avatar surfaces still bypass the shared renderer.', {
          verification: 'STATIC_CONTRACT',
          expected: 'Leaderboard, friends, invites, player select, lobby, and header render KronoxAvatar',
          actual: surfaceChecks,
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Leaderboard, friends, invites, player select, lobby, and header avatar surfaces share KronoxAvatar.', {
        verification: 'STATIC_CONTRACT', actionType: ACTION_TYPES.CODE_FIX,
      });
    }),

  makeCase('avatar_public_projection_safe_quartet',
    'Public avatar projection carries only sanitized avatar fields',
    () => {
      const combined = [
        avatarOptionsSource,
        friendsApiSource,
        presenceSource,
        onlinePlayerSelectionSource,
        leaderboardSource,
        lobbyUtilsSource,
        getOnlinePlayerSelectionSource,
        getSoloLeaderboardSource,
      ].join('\n');
      const requiredMissing = missing(combined, [
        'pickPublicAvatarFields',
        'avatar_type',
        'avatar_icon_id',
        'avatar_color_id',
        'avatar_url',
        'isSafeAvatarPhotoUrl',
        "url.protocol === 'https:'",
      ]);
      const forbidden = present(combined, [
        'avatar_email',
        'avatar_owner_key',
        'avatar_guest_id',
        'avatar_player_key',
        'avatar_provider',
      ]);
      if (requiredMissing.length || forbidden.length) {
        return fail('Public avatar projection is missing the safe quartet or contains private avatar fields.', {
          verification: 'STATIC_CONTRACT',
          expected: 'Only avatar_type/avatar_icon_id/avatar_color_id/avatar_url are projected; URLs are https-only',
          actual: { missing: requiredMissing, forbidden },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Public avatar projection uses a sanitized quartet and https-only photo URLs.', {
        verification: 'STATIC_CONTRACT', actionType: ACTION_TYPES.CODE_FIX,
      });
    }),

  makeCase('avatar_profile_save_refreshes_leaderboard_projection',
    'Profile avatar save refreshes the public leaderboard projection avatar fields',
    () => {
      const requiredMissing = missing(updateProfileSettingsSource, [
        'refreshLeaderboardIdentity',
        'SoloLeaderboardEntry',
        'pickPublicAvatarFields(profile)',
        'avatar_type',
        'avatar_icon_id',
        'avatar_color_id',
        'avatar_url',
        'getAuthOwnerKey(email)',
        'getGuestOwnerKey(guestId)',
        'leaderboardUpdated',
      ]);
      if (requiredMissing.length) {
        return fail('Profile avatar changes may not refresh the existing SoloLeaderboardEntry projection.', {
          verification: 'STATIC_CONTRACT',
          file: 'base44/functions/updateProfileSettings/entry.ts',
          expected: 'updateProfileSettings refreshes username plus safe avatar quartet into the owner leaderboard projection for registered and guest profiles',
          actual: { missing: requiredMissing },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Profile saves propagate the safe avatar quartet into existing leaderboard projection rows.', {
        verification: 'STATIC_CONTRACT', actionType: ACTION_TYPES.CODE_FIX,
      });
    }),

  makeCase('avatar_leaderboard_hydrates_current_and_friend_avatars',
    'Leaderboard hydration preserves current-player and accepted-friend custom avatars',
    () => {
      const combined = `${leaderboardSource}\n${leaderboardPageSource}`;
      const requiredMissing = missing(combined, [
        'getPublicLeaderboardId',
        'getFriendLeaderboardAvatarMap',
        'mergeLeaderboardAvatarFields',
        'friendAvatarByLeaderboardId',
        'withAvatarParity',
        'currentPayload',
        'loadFriends(normalizedUserEmail)',
      ]);
      const forbidden = present(leaderboardPageSource, [
        'base44.entities.User.list',
        'base44.entities.User.filter',
        'base44.asServiceRole.entities.User',
      ]);
      if (requiredMissing.length || forbidden.length) {
        return fail('Leaderboard hydration can still lose custom avatars or add private per-row profile fetches.', {
          verification: 'STATIC_CONTRACT',
          expected: 'Leaderboard overlays safe avatars from currentPayload and deferred accepted-friend rows while staying off private User reads in the page',
          actual: { missing: requiredMissing, forbidden },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Leaderboard hydration uses safe current/friend avatar overlays without private per-row User reads.', {
        verification: 'STATIC_CONTRACT', actionType: ACTION_TYPES.CODE_FIX,
      });
    }),

  makeCase('avatar_lobby_players_carry_safe_fields',
    'Lobby and invite player payloads preserve safe avatar fields without changing route contracts',
    () => {
      const combined = `${lobbyUtilsSource}\n${findLobbyByCodeSource}\n${acceptGameInviteSource}`;
      const requiredMissing = missing(combined, [
        'buildPlayerPayload',
        'pickPublicAvatarFields(player)',
        'pickPublicAvatarFields(currentUser)',
        'joinedLobby',
        'verifiedLobby',
        'avatar_icon_id',
        'avatar_color_id',
      ]);
      const forbidden = present(combined, [
        'player_key: currentUser',
        'owner_key: currentUser',
        'raw_guest_id: currentUser',
      ]);
      if (requiredMissing.length || forbidden.length) {
        return fail('Lobby/invite player payloads do not clearly propagate safe avatars through existing contracts.', {
          verification: 'STATIC_CONTRACT',
          expected: 'Safe avatar fields travel with players while joinedLobby/verifiedLobby route shape stays intact',
          actual: { missing: requiredMissing, forbidden },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Lobby and invite player payloads carry safe avatar fields while preserving joinedLobby/verifiedLobby.', {
        verification: 'STATIC_CONTRACT', actionType: ACTION_TYPES.CODE_FIX,
      });
    }),

  makeCase('avatar_photo_upload_image_only',
    'Photo avatar upload accepts image types only and goes through Base44 storage',
    () => {
      const requiredMissing = missing(avatarUpdateSource, [
        'isAcceptedAvatarFile',
        "'image/jpeg'",
        'MAX_AVATAR_UPLOAD_BYTES',
        'base44.integrations.Core.UploadFile',
      ]);
      const pickerMissing = missing(avatarPickerSource, [
        'accept="image/*"',
        'object-cover',
        'isAcceptedAvatarFile',
      ]);
      if (requiredMissing.length || pickerMissing.length) {
        return fail('Photo upload does not strictly validate image types / Base44 storage.', {
          verification: 'STATIC_CONTRACT',
          expected: 'Image-only accept + size limit + Base44 UploadFile + circular object-cover preview',
          actual: { missing: requiredMissing, pickerMissing },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Photo upload validates image types, limits size, uses Base44 storage, and crops with object-cover.', {
        verification: 'STATIC_CONTRACT', actionType: ACTION_TYPES.CODE_FIX,
      });
    }),

  makeCase('avatar_public_payload_no_private_ids',
    'Public guest avatar payload exposes only safe avatar fields',
    () => {
      // publicGuestProfile only returns avatar_type/icon/url/color — never
      // guest_token, owner_key, email, or internal player keys for avatars.
      const requiredMissing = missing(updateProfileSettingsSource, [
        'avatar_type:',
        'avatar_icon_id:',
        'avatar_url: isSafeAvatarPhotoUrl',
        'avatar_color_id:',
      ]);
      const forbidden = present(updateProfileSettingsSource, [
        'guest_token_hash: row',
        'owner_key: row',
      ]);
      if (requiredMissing.length || forbidden.length) {
        return fail('Public avatar payload may leak internals or miss safe fields.', {
          verification: 'STATIC_CONTRACT',
          file: 'base44/functions/updateProfileSettings/entry.ts',
          expected: 'publicGuestProfile returns only sanitized avatar fields; no token/owner_key/email leakage',
          actual: { missing: requiredMissing, forbidden },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Public guest profile returns only sanitized avatar fields.', {
        verification: 'STATIC_CONTRACT', actionType: ACTION_TYPES.CODE_FIX,
      });
    }),

  makeCase('avatar_guest_supported_no_login_barrier',
    'Guests can set avatars; no login is forced by the avatar feature',
    () => {
      const requiredMissing = missing(avatarUpdateSource, ['updateProfileSettings']);
      // updateProfileSettings supports a guest-token branch, so the avatar
      // helper inherits guest support without a login barrier.
      const guestBranchMissing = missing(updateProfileSettingsSource, [
        'guest_id',
        'guest_token',
        "mode: 'guest'",
      ]);
      if (requiredMissing.length || guestBranchMissing.length) {
        return fail('Guest avatar support / no-login contract is not provable.', {
          verification: 'STATIC_CONTRACT',
          expected: 'Avatar save reuses updateProfileSettings guest-token branch; no forced login',
          actual: { missing: requiredMissing, guestBranchMissing },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Avatar save reuses the guest-token-capable profile update path; no login barrier added.', {
        verification: 'STATIC_CONTRACT', actionType: ACTION_TYPES.CODE_FIX,
      });
    }),

  makeCase('avatar_runtime_device_proof',
    'Avatar pick/upload/persist round-trip needs manual device proof',
    () => notAutomatable('Static Health verifies the avatar contract; real icon select + photo upload + persist-after-reload and guest/linked round-trips remain manual device proof.', {
      verification: 'NOT_AUTOMATABLE',
      verificationLabels: ['MANUAL_REQUIRED', 'MANUAL_DEVICE'],
      actionType: ACTION_TYPES.MANUAL_DEVICE,
    }),
    { critical: false, runtimeProofRequired: true, actionType: ACTION_TYPES.MANUAL_DEVICE }),
];
