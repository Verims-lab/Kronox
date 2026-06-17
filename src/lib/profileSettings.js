import { base44 } from '@/api/base44Client';
import { getStoredGuestCredentials } from './guestProfile';

export const PROFILE_GENDER_OPTIONS = [
  { value: '', label: 'Boş bırak' },
  { value: 'female', label: 'Kadın' },
  { value: 'male', label: 'Erkek' },
  { value: 'non_binary', label: 'Non-binary' },
  { value: 'prefer_not_to_say', label: 'Belirtmek istemiyorum' },
  { value: 'custom', label: 'Kendim tanımlarım' },
];

export function normalizeProfileSettingsError(error) {
  const code = String(error?.code || error?.message || error || '').trim();
  if (code === 'username_taken') return 'Bu kullanıcı adı alınmış. Başka bir Kronox adı seç.';
  if (code === 'invalid_username') return 'Kullanıcı adın 3-24 karakter olmalı; harf, rakam ve alt çizgi kullanabilirsin.';
  if (code === 'invalid_age') return 'Yaş alanı boş bırakılabilir veya 7-120 arasında bir sayı olmalı.';
  if (code === 'invalid_gender') return 'Cinsiyet seçimini kontrol et.';
  return 'Profil ayarların kaydedilemedi. Lütfen tekrar dene.';
}

export async function updateProfileSettings(patch = {}) {
  const credentials = getStoredGuestCredentials();
  const response = await base44.functions.invoke('updateProfileSettings', {
    ...patch,
    ...(credentials.guest_id && credentials.guest_token ? credentials : {}),
  });
  const data = response?.data || response || {};
  if (data?.ok === false) {
    const error = new Error(data.code || data.error || 'profile_settings_update_failed');
    error.code = data.code || data.error || 'profile_settings_update_failed';
    throw error;
  }
  return data;
}
