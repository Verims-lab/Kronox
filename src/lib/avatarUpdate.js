import { base44 } from '@/api/base44Client';
import { updateProfileSettings } from './profileSettings';
import { isValidAvatarIconId, normalizeAvatarColorId } from './avatarOptions';

// Codex486 — Owner-bound avatar persistence.
//
// Avatar saves reuse updateProfileSettings, which is already auth/guest-token
// owner-bound and preserves all unrelated profile fields (username, Kronox ID,
// age, gender, scores). We only send avatar_* fields here.

export const MAX_AVATAR_UPLOAD_BYTES = 5 * 1024 * 1024; // 5MB
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export function isAcceptedAvatarFile(file) {
  if (!file || typeof file !== 'object') return false;
  const type = String(file.type || '').toLowerCase();
  return ACCEPTED_IMAGE_TYPES.includes(type);
}

export async function uploadAvatarPhoto(file) {
  if (!isAcceptedAvatarFile(file)) {
    const error = new Error('avatar_invalid_file_type');
    error.code = 'avatar_invalid_file_type';
    throw error;
  }
  if (Number(file.size) > MAX_AVATAR_UPLOAD_BYTES) {
    const error = new Error('avatar_file_too_large');
    error.code = 'avatar_file_too_large';
    throw error;
  }
  const { file_url: fileUrl } = await base44.integrations.Core.UploadFile({ file });
  if (!fileUrl) {
    const error = new Error('avatar_upload_failed');
    error.code = 'avatar_upload_failed';
    throw error;
  }
  return fileUrl;
}

export async function saveIconAvatar(iconId, colorId) {
  if (!isValidAvatarIconId(iconId)) {
    const error = new Error('avatar_invalid_icon');
    error.code = 'avatar_invalid_icon';
    throw error;
  }
  return updateProfileSettings({
    avatar_type: 'icon',
    avatar_icon_id: String(iconId).trim(),
    avatar_color_id: normalizeAvatarColorId(colorId),
  });
}

export async function savePhotoAvatar(photoUrl, colorId) {
  return updateProfileSettings({
    avatar_type: 'photo',
    avatar_url: String(photoUrl || '').trim(),
    avatar_color_id: normalizeAvatarColorId(colorId),
  });
}

export function normalizeAvatarSaveError(error) {
  const code = String(error?.code || error?.message || error || '').trim();
  if (code === 'avatar_invalid_file_type') return 'Sadece resim dosyası yükleyebilirsin (JPG, PNG, WEBP).';
  if (code === 'avatar_file_too_large') return 'Fotoğraf en fazla 5 MB olabilir.';
  if (code === 'avatar_upload_failed') return 'Fotoğraf yüklenemedi. Lütfen tekrar dene.';
  if (code === 'avatar_invalid_icon') return 'Geçersiz avatar seçimi.';
  return 'Avatar kaydedilemedi. Lütfen tekrar dene.';
}