// Codex486 — Kronox profile avatar model.
//
// Avatars are app-local only:
//   • avatar_type: 'icon' | 'photo'
//   • avatar_icon_id: id from KRONOX_AVATAR_ICONS (when type === 'icon')
//   • avatar_color_id: id from KRONOX_AVATAR_COLORS (frame/background tint)
//   • avatar_url: uploaded image URL via Base44 UploadFile (when type === 'photo')
//
// Bundled icons are lucide-react glyphs (ISC-licensed, shipped with the app),
// NOT remote/third-party hotlinked images and NOT trademarked character art.
// Photo avatars store only the safe uploaded file URL — never base64 blobs in
// the profile row, and never private/internal IDs.

export const KRONOX_AVATAR_ICON_CATEGORIES = [
  { id: 'heroes', label: 'Kahramanlar' },
  { id: 'time', label: 'Zaman' },
  { id: 'mythic', label: 'Mitik' },
  { id: 'space', label: 'Uzay' },
  { id: 'wisdom', label: 'Bilgelik' },
  { id: 'energy', label: 'Enerji' },
];

export const KRONOX_AVATAR_ICONS = [
  { id: 'shield', label: 'Kalkan', category: 'heroes' },
  { id: 'helmet', label: 'Miğfer', category: 'heroes' },
  { id: 'sword', label: 'Kılıç', category: 'heroes' },
  { id: 'crown', label: 'Taç', category: 'heroes' },
  { id: 'trophy', label: 'Kupa', category: 'heroes' },
  { id: 'hourglass', label: 'Kum Saati', category: 'time' },
  { id: 'clock', label: 'Saat', category: 'time' },
  { id: 'timer', label: 'Kronometre', category: 'time' },
  { id: 'calendar', label: 'Takvim', category: 'time' },
  { id: 'portal', label: 'Portal', category: 'mythic' },
  { id: 'wand', label: 'Asa', category: 'mythic' },
  { id: 'scroll', label: 'Parşömen', category: 'mythic' },
  { id: 'crystal', label: 'Kristal', category: 'mythic' },
  { id: 'planet', label: 'Gezegen', category: 'space' },
  { id: 'rocket', label: 'Roket', category: 'space' },
  { id: 'orbit', label: 'Yörünge', category: 'space' },
  { id: 'telescope', label: 'Teleskop', category: 'space' },
  { id: 'book', label: 'Kitap', category: 'wisdom' },
  { id: 'compass', label: 'Pusula', category: 'wisdom' },
  { id: 'brain', label: 'Zihin', category: 'wisdom' },
  { id: 'landmark', label: 'Anıt', category: 'wisdom' },
  { id: 'lightning', label: 'Şimşek', category: 'energy' },
  { id: 'flame', label: 'Alev', category: 'energy' },
  { id: 'moon', label: 'Ay', category: 'energy' },
  { id: 'sun', label: 'Güneş', category: 'energy' },
  { id: 'star', label: 'Yıldız', category: 'energy' },
];

const AVATAR_ICON_IDS = new Set(KRONOX_AVATAR_ICONS.map((icon) => icon.id));

// Frame/background tint presets — Kronox dark/navy with gold/cyan accents.
export const KRONOX_AVATAR_COLORS = [
  { id: 'gold', from: '#ffe066', to: '#b97a06', glyph: '#3b2705' },
  { id: 'cyan', from: '#67e8f9', to: '#0e7490', glyph: '#052e36' },
  { id: 'violet', from: '#c4b5fd', to: '#6d28d9', glyph: '#1e1047' },
  { id: 'emerald', from: '#6ee7b7', to: '#047857', glyph: '#04261b' },
  { id: 'rose', from: '#fda4af', to: '#be123c', glyph: '#3f0a18' },
  { id: 'blue', from: '#93c5fd', to: '#1d4ed8', glyph: '#0a1f4d' },
];

const AVATAR_COLOR_IDS = new Set(KRONOX_AVATAR_COLORS.map((color) => color.id));
export const DEFAULT_AVATAR_COLOR_ID = 'gold';

export function normalizeAvatarColorId(value) {
  const text = String(value || '').trim();
  return AVATAR_COLOR_IDS.has(text) ? text : DEFAULT_AVATAR_COLOR_ID;
}

export function getAvatarColor(colorId) {
  return (
    KRONOX_AVATAR_COLORS.find((color) => color.id === normalizeAvatarColorId(colorId)) ||
    KRONOX_AVATAR_COLORS[0]
  );
}

export function isValidAvatarIconId(value) {
  return AVATAR_ICON_IDS.has(String(value || '').trim());
}

// Photo avatars must be HTTPS display URLs that were produced by the upload
// path. Runtime rendering rejects data/blob/javascript URLs and local raw paths.
export function isSafeAvatarPhotoUrl(value) {
  const text = String(value || '').trim();
  if (!text || text.length > 2048) return false;
  try {
    const url = new URL(text);
    return url.protocol === 'https:';
  } catch {
    return false;
  }
}

const AVATAR_PHOTO_FIELD_CANDIDATES = [
  'avatar_url',
  'avatarUrl',
  'avatar_image_url',
  'avatarImageUrl',
  'profile_avatar_url',
  'profileAvatarUrl',
];

function readSafeAvatarPhotoUrl(profile) {
  for (const field of AVATAR_PHOTO_FIELD_CANDIDATES) {
    const value = profile?.[field];
    if (isSafeAvatarPhotoUrl(value)) return String(value).trim();
  }
  return '';
}

export function pickPublicAvatarFields(profile) {
  const colorId = normalizeAvatarColorId(profile?.avatar_color_id);
  const type = String(profile?.avatar_type || '').trim();
  const iconId = String(profile?.avatar_icon_id || '').trim();
  const photoUrl = readSafeAvatarPhotoUrl(profile);

  if ((type === 'photo' || !type) && photoUrl) {
    return {
      avatar_type: 'photo',
      avatar_icon_id: '',
      avatar_color_id: colorId,
      avatar_url: photoUrl,
    };
  }

  if (type === 'icon' && isValidAvatarIconId(iconId)) {
    return {
      avatar_type: 'icon',
      avatar_icon_id: iconId,
      avatar_color_id: colorId,
      avatar_url: '',
    };
  }

  if (!type && isValidAvatarIconId(iconId)) {
    return {
      avatar_type: 'icon',
      avatar_icon_id: iconId,
      avatar_color_id: colorId,
      avatar_url: '',
    };
  }

  return {
    avatar_type: '',
    avatar_icon_id: '',
    avatar_color_id: colorId,
    avatar_url: '',
  };
}

// Reads any profile-like object (User or GuestProfile public shape) into a
// normalized, display-safe avatar descriptor.
export function resolveProfileAvatar(profile) {
  const avatar = pickPublicAvatarFields(profile);
  if (avatar.avatar_type === 'photo' && avatar.avatar_url) {
    return { type: 'photo', url: avatar.avatar_url, colorId: avatar.avatar_color_id };
  }
  if (avatar.avatar_type === 'icon' && avatar.avatar_icon_id) {
    return { type: 'icon', iconId: avatar.avatar_icon_id, colorId: avatar.avatar_color_id };
  }
  return { type: 'none', colorId: avatar.avatar_color_id };
}
