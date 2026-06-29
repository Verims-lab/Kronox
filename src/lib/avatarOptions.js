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

export const KRONOX_AVATAR_ICONS = [
  { id: 'shield', label: 'Kalkan' },
  { id: 'hourglass', label: 'Kum Saati' },
  { id: 'lightning', label: 'Şimşek' },
  { id: 'crown', label: 'Taç' },
  { id: 'compass', label: 'Pusula' },
  { id: 'star', label: 'Yıldız' },
  { id: 'book', label: 'Kitap' },
  { id: 'flame', label: 'Alev' },
  { id: 'moon', label: 'Ay' },
  { id: 'planet', label: 'Gezegen' },
  { id: 'helmet', label: 'Miğfer' },
  { id: 'crystal', label: 'Kristal' },
  { id: 'trophy', label: 'Kupa' },
  { id: 'portal', label: 'Portal' },
  { id: 'rocket', label: 'Roket' },
  { id: 'sword', label: 'Kılıç' },
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

// Only same-origin Base44 storage URLs are treated as safe photo avatars, so
// no arbitrary third-party hotlink can be persisted as an avatar.
export function isSafeAvatarPhotoUrl(value) {
  const text = String(value || '').trim();
  if (!text) return false;
  try {
    const url = new URL(text);
    return url.protocol === 'https:';
  } catch {
    return false;
  }
}

// Reads any profile-like object (User or GuestProfile public shape) into a
// normalized, display-safe avatar descriptor.
export function resolveProfileAvatar(profile) {
  const type = String(profile?.avatar_type || '').trim();
  const colorId = normalizeAvatarColorId(profile?.avatar_color_id);
  if (type === 'photo' && isSafeAvatarPhotoUrl(profile?.avatar_url)) {
    return { type: 'photo', url: String(profile.avatar_url).trim(), colorId };
  }
  if (type === 'icon' && isValidAvatarIconId(profile?.avatar_icon_id)) {
    return { type: 'icon', iconId: String(profile.avatar_icon_id).trim(), colorId };
  }
  return { type: 'none', colorId };
}