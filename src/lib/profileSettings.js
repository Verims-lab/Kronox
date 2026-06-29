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

export const PROFILE_AGE_GROUP_OPTIONS = [
  { value: '', label: 'Belirtmek istemiyorum' },
  { value: '13_17', label: '13-17' },
  { value: '18_24', label: '18-24' },
  { value: '25_34', label: '25-34' },
  { value: '35_44', label: '35-44' },
  { value: '45_plus', label: '45+' },
];

export function normalizeProfileAgeGroupValue(value) {
  const text = String(value || '').trim();
  return PROFILE_AGE_GROUP_OPTIONS.some((option) => option.value === text) ? text : '';
}

export function ageToAgeGroup(age) {
  const numericAge = Math.trunc(Number(age));
  if (!Number.isFinite(numericAge)) return '';
  if (numericAge >= 13 && numericAge <= 17) return '13_17';
  if (numericAge >= 18 && numericAge <= 24) return '18_24';
  if (numericAge >= 25 && numericAge <= 34) return '25_34';
  if (numericAge >= 35 && numericAge <= 44) return '35_44';
  if (numericAge >= 45) return '45_plus';
  return '';
}

export function getProfileOptionLabel(options, value, fallback = 'Belirtmek istemiyorum') {
  return options.find((option) => option.value === String(value || '').trim())?.label || fallback;
}

export function normalizeProfileSettingsError(error) {
  const code = String(error?.code || error?.message || error || '').trim();
  if (code === 'username_taken') return 'Bu kullanıcı adı alınmış. Başka bir Kronox adı seç.';
  if (code === 'invalid_username') return 'Kullanıcı adın 3-24 karakter olmalı; harf, rakam ve alt çizgi kullanabilirsin.';
  if (code === 'invalid_age') return 'Yaş alanı boş bırakılabilir veya 7-120 arasında bir sayı olmalı.';
  if (code === 'invalid_age_group') return 'Yaş grubu seçimini kontrol et.';
  if (code === 'invalid_gender') return 'Cinsiyet seçimini kontrol et.';
  return 'Profil ayarların kaydedilemedi. Lütfen tekrar dene.';
}

function unwrapFunctionResponse(response) {
  if (response?.data?.data && typeof response.data.data === 'object') return response.data.data;
  if (response?.data && typeof response.data === 'object') return response.data;
  if (response && typeof response === 'object') return response;
  return {};
}

export async function updateProfileSettings(patch = {}) {
  const credentials = getStoredGuestCredentials();
  const response = await base44.functions.invoke('updateProfileSettings', {
    ...patch,
    ...(credentials.guest_id && credentials.guest_token ? credentials : {}),
  });
  const data = unwrapFunctionResponse(response);
  if (data?.ok === false) {
    const error = new Error(data.code || data.error || 'profile_settings_update_failed');
    error.code = data.code || data.error || 'profile_settings_update_failed';
    throw error;
  }
  return data;
}
