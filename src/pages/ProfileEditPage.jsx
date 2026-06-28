import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Check, ChevronRight, Loader2, Pencil, UserRound, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { sounds } from '@/lib/gameSounds';
import { useAuth } from '@/lib/AuthContext';
import CategoryPreferencesSection from '@/components/settings/CategoryPreferencesSection';
import { normalizeSafePublicUsernameInput, resolveSafePublicUsername } from '@/lib/guestProfile';
import {
  PROFILE_AGE_GROUP_OPTIONS,
  PROFILE_GENDER_OPTIONS,
  ageToAgeGroup,
  getProfileOptionLabel,
  normalizeProfileAgeGroupValue,
  normalizeProfileSettingsError,
  updateProfileSettings,
} from '@/lib/profileSettings';

export default function ProfileEditPage() {
  const navigate = useNavigate();
  const { user, guestProfile, isLoadingAuth, checkUserAuth } = useAuth();
  const [localProfile, setLocalProfile] = useState(user || guestProfile || null);
  const [editor, setEditor] = useState(null);
  const [draftUsername, setDraftUsername] = useState('');
  const [draftGender, setDraftGender] = useState('');
  const [draftAgeGroup, setDraftAgeGroup] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setLocalProfile(user || guestProfile || null);
  }, [guestProfile, user]);

  const profile = localProfile || user || guestProfile || {};
  const username = useMemo(() => (
    normalizeSafePublicUsernameInput(profile?.username) || resolveSafePublicUsername('', 'profile')
  ), [profile?.username]);
  const gender = String(profile?.gender || '');
  const ageGroup = normalizeProfileAgeGroupValue(profile?.age_group) || ageToAgeGroup(profile?.age);
  const avatarInitial = username.charAt(0).toLocaleUpperCase('tr-TR') || 'K';

  const openEditor = (field) => {
    sounds.tap();
    setError('');
    setMessage('');
    setDraftUsername(username);
    setDraftGender(gender);
    setDraftAgeGroup(ageGroup);
    setEditor(field);
  };

  const closeEditor = () => {
    if (saving) return;
    setEditor(null);
    setError('');
  };

  const applyResult = async (result) => {
    if (result?.mode === 'registered' && result?.user) setLocalProfile(result.user);
    if (result?.mode === 'guest' && result?.profile) setLocalProfile(result.profile);
    await checkUserAuth?.();
  };

  const saveProfile = async () => {
    if (saving) return;
    setError('');
    setMessage('');

    const nextUsername = editor === 'username' ? draftUsername.trim() : username;
    const nextGender = editor === 'gender' ? draftGender : gender;
    const nextAgeGroup = editor === 'age_group' ? draftAgeGroup : ageGroup;

    if (!normalizeSafePublicUsernameInput(nextUsername)) {
      setError('Takma ad 3-24 karakter olmalı; harf, rakam ve alt çizgi kullanabilirsin.');
      return;
    }

    setSaving(true);
    try {
      const result = await updateProfileSettings({
        username: nextUsername,
        gender: nextGender,
        age_group: nextAgeGroup,
      });
      await applyResult(result);
      setEditor(null);
      setMessage('Profil bilgilerin kaydedildi.');
    } catch (saveError) {
      setError(normalizeProfileSettingsError(saveError));
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    sounds.tap();
    navigate('/profile');
  };

  if (isLoadingAuth && !localProfile) {
    return (
      <ProfileEditShell onBack={handleBack}>
        <div
          className="mt-24 flex items-center justify-center"
          role="status"
          aria-live="polite"
          aria-label="Profil yükleniyor"
        >
          <Loader2 className="h-6 w-6 animate-spin text-amber-200" />
        </div>
      </ProfileEditShell>
    );
  }

  if (!localProfile) {
    return (
      <ProfileEditShell onBack={handleBack}>
        <div className="mt-24 rounded-3xl border border-blue-200/20 bg-white/5 p-5 text-center">
          <p className="font-inter text-sm font-bold text-white">Profil bilgisi yüklenemedi.</p>
          <button
            type="button"
            onClick={() => checkUserAuth?.()}
            className="mt-4 rounded-full bg-amber-300 px-4 py-2 font-inter text-xs font-black text-amber-950"
          >
            Tekrar Dene
          </button>
        </div>
      </ProfileEditShell>
    );
  }

  return (
    <ProfileEditShell onBack={handleBack}>
      <div className="pt-8">
        <div className="relative mx-auto mb-9 flex h-32 w-32 items-center justify-center rounded-full">
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: 'radial-gradient(circle at 35% 30%, rgba(255,224,102,0.40), rgba(30,41,75,0.92) 56%, rgba(4,8,20,0.98) 100%)',
              boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.12), 0 18px 42px rgba(0,0,0,0.35)',
            }}
          />
          <div
            className="relative flex h-24 w-24 items-center justify-center rounded-[2rem]"
            style={{
              background: 'linear-gradient(180deg, rgba(255,255,255,0.14), rgba(255,255,255,0.04))',
              boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.10)',
            }}
          >
            <span className="font-bangers text-5xl text-amber-200 drop-shadow">{avatarInitial}</span>
          </div>
          <button
            type="button"
            disabled
            aria-label="Avatar düzenleme bu sürümde kapalı"
            className="absolute -bottom-1 right-0 flex h-12 w-12 items-center justify-center rounded-full bg-white text-slate-900 opacity-80"
          >
            <Pencil className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5">
          <ProfileFieldRow
            label="Takma Ad"
            value={username}
            onClick={() => openEditor('username')}
          />
          <ProfileFieldRow
            label="Cinsiyet"
            value={getProfileOptionLabel(PROFILE_GENDER_OPTIONS, gender, 'Boş bırak')}
            muted={!gender}
            onClick={() => openEditor('gender')}
          />
          <ProfileFieldRow
            label="Yaş grubu"
            value={getProfileOptionLabel(PROFILE_AGE_GROUP_OPTIONS, ageGroup)}
            muted={!ageGroup}
            onClick={() => openEditor('age_group')}
          />
        </div>

        <section className="mt-6 space-y-2">
          <h2 className="font-inter text-lg font-bold text-white">Kategori seçimi</h2>
          {user ? (
            <CategoryPreferencesSection user={user} />
          ) : (
            <GuestCategoryPreferenceNotice />
          )}
        </section>

        {message && (
          <p
            className="mt-5 rounded-2xl border border-emerald-300/25 bg-emerald-300/10 px-4 py-3 font-inter text-xs font-bold text-emerald-100"
            role="status"
            aria-live="polite"
          >
            {message}
          </p>
        )}
      </div>

      <ProfileEditSheet
        field={editor}
        saving={saving}
        error={error}
        username={draftUsername}
        gender={draftGender}
        ageGroup={draftAgeGroup}
        onUsernameChange={setDraftUsername}
        onGenderChange={setDraftGender}
        onAgeGroupChange={setDraftAgeGroup}
        onClose={closeEditor}
        onSave={saveProfile}
      />
    </ProfileEditShell>
  );
}

function GuestCategoryPreferenceNotice() {
  return (
    <div
      className="rounded-2xl px-4 py-4"
      style={{
        background: 'linear-gradient(180deg, rgba(31,41,55,0.92), rgba(18,25,35,0.95))',
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.06)',
      }}
    >
      <p className="font-inter text-sm font-black text-white">Misafir kategori kurulumu hazır.</p>
      <p className="mt-1 font-inter text-xs font-semibold leading-relaxed text-blue-100/64">
        Kalıcı kategori tercihlerini hesabını bağladıktan sonra burada güncelleyebilirsin.
      </p>
    </div>
  );
}

function ProfileEditShell({ children, onBack }) {
  return (
    <div
      className="min-h-screen bg-background text-white"
      style={{
        minHeight: '100dvh',
        paddingTop: 'calc(4.75rem + env(safe-area-inset-top))',
        paddingBottom: 'calc(5rem + env(safe-area-inset-bottom))',
        background:
          'radial-gradient(ellipse at 50% 0%, rgba(59,130,246,0.22), transparent 44%), linear-gradient(180deg, #030611 0%, #071125 55%, #02040a 100%)',
      }}
    >
      <header
        className="fixed left-0 right-0 top-0 z-[110] flex items-center justify-center"
        style={{
          paddingTop: 'env(safe-area-inset-top)',
          height: 'calc(4rem + env(safe-area-inset-top))',
          background: 'linear-gradient(180deg, rgba(3,6,17,0.98), rgba(3,6,17,0.68), rgba(3,6,17,0))',
        }}
      >
        <button
          type="button"
          onClick={onBack}
          aria-label="Profile geri dön"
          className="absolute left-4 flex h-11 w-11 items-center justify-center rounded-full text-white active:scale-95"
          style={{ top: 'calc(env(safe-area-inset-top) + 0.55rem)' }}
        >
          <ArrowLeft className="h-7 w-7" strokeWidth={2.4} />
        </button>
        <h1 className="font-inter text-2xl font-bold tracking-tight text-white">Profil Bilgileri</h1>
      </header>
      <main className="mx-auto w-full max-w-md px-4">
        {children}
      </main>
    </div>
  );
}

function ProfileFieldRow({ label, value, muted = false, onClick }) {
  return (
    <section className="space-y-2">
      <h2 className="font-inter text-lg font-bold text-white">{label}</h2>
      <button
        type="button"
        onClick={onClick}
        className="flex min-h-[4rem] w-full items-center gap-3 rounded-2xl px-4 text-left active:scale-[0.99]"
        style={{
          background: 'linear-gradient(180deg, rgba(31,41,55,0.92), rgba(18,25,35,0.95))',
          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.06)',
        }}
      >
        <span className={`min-w-0 flex-1 truncate font-inter text-lg font-bold ${muted ? 'text-white/50' : 'text-white'}`}>
          {value}
        </span>
        <ChevronRight className="h-5 w-5 shrink-0 text-white/55" />
      </button>
    </section>
  );
}

function ProfileEditSheet({
  field,
  saving,
  error,
  username,
  gender,
  ageGroup,
  onUsernameChange,
  onGenderChange,
  onAgeGroupChange,
  onClose,
  onSave,
}) {
  const title = field === 'username'
    ? 'Takma Ad'
    : field === 'gender'
      ? 'Cinsiyet'
      : 'Yaş grubu';

  return (
    <AnimatePresence>
      {field && (
        <motion.div
          className="fixed inset-0 z-[150] flex items-end justify-center bg-slate-950/70 px-3 pb-3 backdrop-blur-sm"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.75rem)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="profile-edit-sheet-title"
        >
          <button
            type="button"
            className="absolute inset-0"
            onClick={onClose}
            aria-label="Düzenleme ekranını kapat"
          />
          <motion.div
            className="relative w-full max-w-md rounded-[1.75rem] p-5"
            style={{
              background: 'linear-gradient(180deg, rgba(20,33,69,0.99), rgba(5,10,24,0.99))',
              boxShadow: 'inset 0 0 0 1px rgba(120,170,255,0.28), 0 24px 60px rgba(0,0,0,0.46)',
            }}
            initial={{ y: 26, scale: 0.98 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 24, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 340, damping: 30 }}
          >
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-300 text-amber-950">
                <UserRound className="h-5 w-5" />
              </div>
              <h2 id="profile-edit-sheet-title" className="flex-1 font-inter text-lg font-black text-white">{title}</h2>
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.08] text-white/70 disabled:opacity-60"
                aria-label="Kapat"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {field === 'username' && (
              <label className="block space-y-2">
                <span className="font-inter text-xs font-black uppercase tracking-wider text-blue-100/70">Takma Ad</span>
                <input
                  value={username}
                  onChange={(event) => onUsernameChange(event.target.value)}
                  maxLength={24}
                  autoComplete="nickname"
                  className="h-12 w-full rounded-2xl border border-blue-200/20 bg-slate-950/60 px-4 font-inter text-base font-black text-white outline-none focus:border-amber-300"
                  placeholder="KronoxUser4827"
                />
                <p className="font-inter text-[11px] font-semibold leading-relaxed text-blue-100/58">
                  Herkese açık kimliğin budur. Harf, rakam ve alt çizgi kullanabilirsin.
                </p>
              </label>
            )}

            {field === 'gender' && (
              <OptionList
                options={PROFILE_GENDER_OPTIONS}
                value={gender}
                onChange={onGenderChange}
              />
            )}

            {field === 'age_group' && (
              <OptionList
                options={PROFILE_AGE_GROUP_OPTIONS}
                value={ageGroup}
                onChange={onAgeGroupChange}
              />
            )}

            {error && (
              <p className="mt-4 rounded-2xl border border-red-300/25 bg-red-500/10 px-4 py-3 font-inter text-xs font-bold text-red-100" role="alert">
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-amber-300 font-inter text-sm font-black text-amber-950 disabled:opacity-70"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Kaydet
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function OptionList({ options, value, onChange }) {
  return (
    <div className="space-y-2">
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <button
            type="button"
            key={option.value || 'blank'}
            onClick={() => onChange(option.value)}
            className="flex h-12 w-full items-center gap-3 rounded-2xl px-4 text-left"
            style={{
              background: selected ? 'rgba(250,204,21,0.18)' : 'rgba(255,255,255,0.06)',
              boxShadow: selected ? 'inset 0 0 0 1px rgba(250,204,21,0.48)' : 'inset 0 0 0 1px rgba(255,255,255,0.08)',
            }}
          >
            <span className="flex-1 font-inter text-sm font-bold text-white">{option.label}</span>
            {selected && <Check className="h-4 w-4 text-amber-200" />}
          </button>
        );
      })}
    </div>
  );
}
