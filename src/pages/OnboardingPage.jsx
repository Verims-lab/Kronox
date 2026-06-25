import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Check,
  Loader2,
  Play,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';
import {
  GUEST_ONBOARDING_STATES,
  ensureGuestProfile,
  getGuestOnboardingStep,
  isGuestOnboardingComplete,
  makeKronoxUserFallback,
  updateGuestProfileOnboarding,
} from '@/lib/guestProfile';
import { buildSoloGameConfigForLevel, SOLO_MAX_MOVES, SOLO_LEVEL_TIME_SECONDS } from '@/lib/soloLevels';
import {
  MIN_CATEGORY_SELECTION_COUNT,
  loadActiveCategories,
  sanitizeSelectedCategoryIds,
} from '@/lib/userCategoryPreferences';

const GENDER_OPTIONS = [
  { value: '', label: 'Belirtmek istemiyorum' },
  { value: 'female', label: 'Kadın' },
  { value: 'male', label: 'Erkek' },
  { value: 'non_binary', label: 'Non-binary' },
  { value: 'custom', label: 'Kendim tanımlarım' },
];

const GUIDED_TUTORIAL_TIME_LIMIT_SECONDS = SOLO_LEVEL_TIME_SECONDS;
const PROFILE_SAVE_TIMEOUT_MS = 15000;
const CATEGORY_SAVE_TIMEOUT_MS = 15000;

function withTimeout(promise, timeoutMs, code) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = window.setTimeout(() => {
      const error = new Error(code);
      error.code = code;
      reject(error);
    }, timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId) window.clearTimeout(timeoutId);
  });
}

function tutorialGameConfig() {
  const config = buildSoloGameConfigForLevel({ levelNumber: 1 });
  return {
    ...config,
    onboardingTutorial: true,
    soloLevel: {
      ...config.soloLevel,
      onboardingTutorial: true,
      totalTimeSeconds: GUIDED_TUTORIAL_TIME_LIMIT_SECONDS,
      maxMoves: SOLO_MAX_MOVES,
      maxMistakes: SOLO_MAX_MOVES,
    },
  };
}

function normalizeStep(profile) {
  const step = getGuestOnboardingStep(profile);
  if (step === 'not_started' || step === 'in_progress') return GUEST_ONBOARDING_STATES.GUEST_CREATED;
  if (step === 'completed') return GUEST_ONBOARDING_STATES.ONBOARDING_COMPLETE;
  return step;
}

const ONBOARDING_STEP_RANK = {
  [GUEST_ONBOARDING_STATES.GUEST_CREATED]: 0,
  [GUEST_ONBOARDING_STATES.TUTORIAL_IN_PROGRESS]: 1,
  [GUEST_ONBOARDING_STATES.TUTORIAL_COMPLETED]: 2,
  [GUEST_ONBOARDING_STATES.PROFILE_SETUP_PENDING]: 3,
  [GUEST_ONBOARDING_STATES.CATEGORY_SETUP_PENDING]: 4,
  [GUEST_ONBOARDING_STATES.ONBOARDING_COMPLETE]: 5,
};
const TUTORIAL_IN_PROGRESS_STATUS = GUEST_ONBOARDING_STATES.TUTORIAL_IN_PROGRESS; // tutorial_in_progress

function onboardingStepRank(profile) {
  return ONBOARDING_STEP_RANK[normalizeStep(profile)] ?? 0;
}

export default function OnboardingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    isLoadingAuth,
    isAuthenticated,
    guestProfile: authGuestProfile,
    checkUserAuth,
  } = useAuth();
  const [guestProfile, setGuestProfile] = useState(authGuestProfile);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [categorySaving, setCategorySaving] = useState(false);
  const [error, setError] = useState('');
  const guidedCompletionHandledRef = useRef(false);

  useEffect(() => {
    if (!authGuestProfile) return;
    setGuestProfile((current) => {
      if (!current) return authGuestProfile;
      return onboardingStepRank(authGuestProfile) >= onboardingStepRank(current)
        ? authGuestProfile
        : current;
    });
  }, [authGuestProfile]);

  useEffect(() => {
    if (isLoadingAuth || isAuthenticated) return undefined;
    let cancelled = false;
    setLoading(true);
    ensureGuestProfile()
      .then((profile) => {
        if (!cancelled) setGuestProfile(profile);
      })
      .catch(() => {
        if (!cancelled) setError('Misafir profilin hazırlanamadı. Lütfen tekrar dene.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [isAuthenticated, isLoadingAuth]);

  useEffect(() => {
    if (!location.state?.guidedTutorialCompleted || busy || guidedCompletionHandledRef.current) return;
    guidedCompletionHandledRef.current = true;
    let cancelled = false;
    async function completeTutorial() {
      setBusy(true);
      setError('');
      try {
        const updated = await updateGuestProfileOnboarding({
          onboarding_status: GUEST_ONBOARDING_STATES.PROFILE_SETUP_PENDING,
          tutorial_status: 'completed',
          profile_setup_status: 'pending',
        });
        if (!cancelled) {
          setGuestProfile(updated);
          void Promise.resolve(checkUserAuth?.()).catch(() => null);
          navigate('/onboarding', { replace: true, state: {} });
        }
      } catch {
        if (!cancelled) setError('Eğitim tamamlandı ama profil adımı kaydedilemedi. Tekrar dene.');
      } finally {
        if (!cancelled) setBusy(false);
      }
    }
    completeTutorial();
    return () => { cancelled = true; };
  }, [busy, checkUserAuth, location.state?.guidedTutorialCompleted, navigate]);

  if (isAuthenticated) return <Navigate to="/" replace />;
  if (isLoadingAuth || loading || !guestProfile) return <OnboardingShell><LoadingState /></OnboardingShell>;
  if (isGuestOnboardingComplete(guestProfile)) return <Navigate to="/" replace />;

  const step = normalizeStep(guestProfile);
  if (step === GUEST_ONBOARDING_STATES.ONBOARDING_COMPLETE) return <Navigate to="/" replace />;
  const isProfileStep = step === GUEST_ONBOARDING_STATES.TUTORIAL_COMPLETED ||
    step === GUEST_ONBOARDING_STATES.PROFILE_SETUP_PENDING;
  const isTutorialResumeStep = step === TUTORIAL_IN_PROGRESS_STATUS &&
    guestProfile?.onboarding_status === TUTORIAL_IN_PROGRESS_STATUS &&
    guestProfile?.tutorial_status === 'in_progress' &&
    guestProfile?.profile_setup_status !== 'completed';

  return (
    <OnboardingShell>
      {error && !isProfileStep && (
        <p className="mb-3 rounded-xl border border-amber-300/35 bg-amber-300/10 px-3 py-2 font-inter text-xs font-bold text-amber-100">
          {error}
        </p>
      )}
      {step === GUEST_ONBOARDING_STATES.GUEST_CREATED && (
        <TutorialStartStep
          busy={busy}
          username={guestProfile.username || makeKronoxUserFallback(guestProfile.guest_id || '')}
          onExistingAccount={() => navigate('/profile?open=account-link', {
            state: { openAccountLink: true, accountLinkEntry: 'first-launch-welcome' },
          })}
          onStart={async () => {
            setBusy(true);
            setError('');
            try {
              const updated = await updateGuestProfileOnboarding({
                onboarding_status: GUEST_ONBOARDING_STATES.TUTORIAL_IN_PROGRESS,
                tutorial_status: 'in_progress',
              });
              setGuestProfile(updated);
              await checkUserAuth?.();
              navigate('/game', { state: tutorialGameConfig() });
            } catch {
              setError('Eğitim seviyesi başlatılamadı. Lütfen tekrar dene.');
            } finally {
              setBusy(false);
            }
          }}
        />
      )}
      {isTutorialResumeStep && (
        <TutorialResumeStep
          busy={busy}
          onResume={() => navigate('/game', { state: tutorialGameConfig() })}
        />
      )}
      {(step === GUEST_ONBOARDING_STATES.TUTORIAL_COMPLETED || step === GUEST_ONBOARDING_STATES.PROFILE_SETUP_PENDING) && (
        <ProfileSetupStep
          profile={guestProfile}
          busy={profileSaving}
          submitError={error}
          onSubmit={async (patch) => {
            setProfileSaving(true);
            setError('');
            try {
              const updated = await withTimeout(updateGuestProfileOnboarding({
                ...patch,
                tutorial_status: 'completed',
                profile_setup_status: 'completed',
                onboarding_status: GUEST_ONBOARDING_STATES.CATEGORY_SETUP_PENDING,
              }), PROFILE_SAVE_TIMEOUT_MS, 'profile_save_timeout');
              setGuestProfile({
                ...(updated || guestProfile),
                username: updated?.username || patch.username || guestProfile?.username,
                display_name: updated?.username || patch.username || guestProfile?.username,
                age: updated?.age ?? patch.age ?? guestProfile?.age,
                gender: updated?.gender ?? patch.gender ?? guestProfile?.gender,
                tutorial_status: 'completed',
                profile_setup_status: 'completed',
                category_setup_status: 'pending',
                onboarding_status: GUEST_ONBOARDING_STATES.CATEGORY_SETUP_PENDING,
              });
              void Promise.resolve(checkUserAuth?.()).catch(() => null);
            } catch (profileError) {
              // Duplicate username is surfaced as a RED INLINE error under the
              // username field (handled inside ProfileSetupStep via this exact
              // sentinel), never as the generic save-failure box.
              setError(profileError?.code === 'username_taken'
                ? 'username_taken'
                : profileError?.code === 'profile_save_timeout'
                  ? 'Profil kaydı uzun sürdü. Bağlantını kontrol edip tekrar dene.'
                : 'Profil bilgilerin kaydedilemedi. Lütfen tekrar dene.');
            } finally {
              setProfileSaving(false);
            }
          }}
        />
      )}
      {step === GUEST_ONBOARDING_STATES.CATEGORY_SETUP_PENDING && (
        <CategorySetupStep
          profile={guestProfile}
          busy={categorySaving}
          submitError={error}
          onComplete={async (selectedIds) => {
            setCategorySaving(true);
            setError('');
            try {
              const updated = await withTimeout(updateGuestProfileOnboarding({
                selected_category_ids: selectedIds,
                tutorial_status: 'completed',
                profile_setup_status: 'completed',
                category_setup_status: 'completed',
                onboarding_status: GUEST_ONBOARDING_STATES.ONBOARDING_COMPLETE,
              }), CATEGORY_SAVE_TIMEOUT_MS, 'category_save_timeout');
              setGuestProfile({
                ...(updated || guestProfile),
                selected_category_ids: selectedIds,
                tutorial_status: 'completed',
                profile_setup_status: 'completed',
                category_setup_status: 'completed',
                onboarding_status: GUEST_ONBOARDING_STATES.ONBOARDING_COMPLETE,
              });
              void Promise.resolve(checkUserAuth?.()).catch(() => null);
              navigate('/', { replace: true });
            } catch {
              setError('Kategoriler kaydedilemedi. Lütfen tekrar dene.');
            } finally {
              setCategorySaving(false);
            }
          }}
        />
      )}
    </OnboardingShell>
  );
}

function OnboardingShell({ children }) {
  return (
    <div
      className="min-h-screen overflow-y-auto bg-background px-4 py-6 text-foreground"
      style={{
        minHeight: '100dvh',
        paddingTop: 'calc(1.5rem + env(safe-area-inset-top))',
        paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))',
        background:
          'radial-gradient(ellipse at 50% 0%, rgba(59,130,246,0.24), transparent 48%), linear-gradient(180deg, #06112d 0%, #081735 54%, #030712 100%)',
      }}
    >
      <div className="mx-auto flex min-h-[calc(100dvh-3rem)] w-full max-w-md flex-col justify-center">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28 }}
        >
          {children}
        </motion.div>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 text-center"
      role="status"
      aria-live="polite"
      aria-label="Kronox profilin hazırlanıyor"
    >
      <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
      <p className="font-inter text-sm font-bold text-blue-100">Kronox profilin hazırlanıyor...</p>
    </div>
  );
}

function StepHeader({ icon: Icon, title, body }) {
  return (
    <div className="mb-5 text-center">
      <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-primary/35 bg-primary/10 text-primary">
        <Icon className="h-7 w-7" />
      </div>
      <h1 className="font-cinzel text-2xl font-black text-white">{title}</h1>
      <p className="mt-2 font-inter text-sm leading-relaxed text-blue-100/76">{body}</p>
    </div>
  );
}

function TutorialStartStep({ username, busy, onStart, onExistingAccount }) {
  const displayName = username || 'KronoxUser';

  return (
    <div className="rounded-2xl border border-primary/25 bg-slate-950/42 p-5 shadow-2xl">
      <div className="mb-5 text-center">
        <h1 className="font-cinzel text-2xl font-black text-white">İlk Seviye Seni Bekliyor</h1>
      </div>
      <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4 text-center font-inter text-sm font-semibold leading-relaxed text-blue-100/82">
        <p>Sevgili {displayName}</p>
        <p className="mt-4">
          Tek yapman gereken olay kartını, olayın gerçekleştiğini tahmin ettiğin zaman aralığına sürüklemek.
          <br />
          7 kartı tamamla.
          <br />
          Zamana hükmet…
        </p>
      </div>
      <Button onClick={onStart} disabled={busy} className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl font-inter font-black">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}
        Seviye 1
      </Button>
      <button
        type="button"
        onClick={onExistingAccount}
        disabled={busy}
        className="mt-3 flex min-h-11 w-full items-center justify-center rounded-xl border border-primary/30 bg-white/[0.03] px-4 font-inter text-sm font-black text-blue-100/82 transition-colors hover:bg-white/[0.06] hover:text-white active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
      >
        Hesabım Var
      </button>
    </div>
  );
}

function TutorialResumeStep({ busy, onResume }) {
  return (
    <div className="rounded-2xl border border-primary/25 bg-slate-950/42 p-5 shadow-2xl">
      <StepHeader
        icon={Play}
        title="Eğitime Devam"
        body="Yarım kalan rehberli seviyeyi buradan sürdürebilirsin. Bu bölüm normal Solo kurallarını değiştirmez."
      />
      <Button onClick={onResume} disabled={busy} className="min-h-12 w-full rounded-xl font-inter font-black">
        Devam Et
      </Button>
    </div>
  );
}

function normalizeOptionalAgeInput(value) {
  const text = String(value || '').trim();
  if (!text) return { ok: true, value: null };
  const age = Math.trunc(Number(text));
  if (!Number.isFinite(age) || age < 7 || age > 120) {
    return { ok: false, value: null };
  }
  return { ok: true, value: age };
}

function ProfileSetupStep({ profile, busy, submitError, onSubmit }) {
  const fallbackUsername = useMemo(
    () => profile.username || makeKronoxUserFallback(profile.guest_id || ''),
    [profile.guest_id, profile.username]
  );
  const [username, setUsername] = useState(fallbackUsername);
  const [age, setAge] = useState(profile.age || '');
  const [gender, setGender] = useState(profile.gender || '');
  const [validation, setValidation] = useState('');
  // The exact username value the backend rejected as taken. While the input
  // still equals it, the inline red error stays and save is blocked.
  const [takenUsername, setTakenUsername] = useState('');

  useEffect(() => {
    setUsername(fallbackUsername);
    setAge(profile.age || '');
    setGender(profile.gender || '');
  }, [fallbackUsername, profile.age, profile.gender]);

  // When the parent reports a duplicate username, lock onto the current
  // typed value so the inline error shows and submit stays blocked until edit.
  useEffect(() => {
    if (submitError === 'username_taken') setTakenUsername(username.trim().toLowerCase());
  }, [submitError]);

  const normalizedUsername = username.trim() || fallbackUsername;
  const isUsernameTaken = Boolean(takenUsername) && username.trim().toLowerCase() === takenUsername;
  const usernameInlineError = isUsernameTaken ? 'Bu kullanıcı adı kullanılıyor.' : '';
  // Generic submit box is shown only for non-duplicate errors.
  const genericSubmitError = submitError === 'username_taken' ? '' : submitError;
  const canSubmit = normalizedUsername.trim().length >= 3 && !isUsernameTaken;

  return (
    <form
      className="rounded-2xl border border-primary/25 bg-slate-950/42 p-5 shadow-2xl"
      onSubmit={(event) => {
        event.preventDefault();
        setValidation('');
        if (!canSubmit) {
          setValidation('Kullanıcı adı en az 3 karakter olmalı.');
          return;
        }
        const normalizedAge = normalizeOptionalAgeInput(age);
        if (!normalizedAge.ok) {
          setValidation('Yaş alanı boş bırakılabilir veya 7-120 arasında olmalı.');
          return;
        }
        onSubmit({
          username: normalizedUsername.trim(),
          age: normalizedAge.value,
          gender,
        });
      }}
    >
      <StepHeader
        icon={UserRound}
        title="Profilini Tamamla"
        body="İstersen adını düzenle. E-posta, Google ID veya Apple ID liderlikte görünmez."
      />
      <div className="space-y-3">
        <Field label="Kullanıcı Adı">
          <input
            value={username}
            onChange={(event) => { setUsername(event.target.value); setValidation(''); }}
            aria-invalid={isUsernameTaken}
            className={`h-11 w-full rounded-xl border bg-white/[0.06] px-3 font-inter text-sm font-bold text-white outline-none ${isUsernameTaken ? 'border-red-500 focus:border-red-500' : 'border-white/12 focus:border-primary/70'}`}
            maxLength={24}
            autoComplete="username"
          />
          {usernameInlineError && (
            <p className="mt-1.5 font-inter text-xs font-bold text-red-400">{usernameInlineError}</p>
          )}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Yaş (opsiyonel)">
            <input
              value={age}
              onChange={(event) => setAge(event.target.value)}
              type="number"
              min="7"
              max="120"
              className="h-11 w-full rounded-xl border border-white/12 bg-white/[0.06] px-3 font-inter text-sm font-bold text-white outline-none focus:border-primary/70"
            />
          </Field>
          <Field label="Cinsiyet (opsiyonel)">
            <select
              value={gender}
              onChange={(event) => setGender(event.target.value)}
              className="h-11 w-full rounded-xl border border-white/12 bg-slate-950 px-3 font-inter text-xs font-bold text-white outline-none focus:border-primary/70"
            >
              {GENDER_OPTIONS.map((option) => (
                <option key={option.value || 'empty'} value={option.value}>{option.label}</option>
              ))}
            </select>
          </Field>
        </div>
      </div>
      {(validation || genericSubmitError) && (
        <p className="mt-3 rounded-xl border border-amber-300/35 bg-amber-300/10 px-3 py-2 font-inter text-xs font-bold text-amber-100" role="alert">
          {validation || genericSubmitError}
        </p>
      )}
      <Button type="submit" disabled={busy || !canSubmit} className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl font-inter font-black">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ArrowRight className="h-4 w-4" aria-hidden="true" />}
        Kategorilere Geç
      </Button>
    </form>
  );
}

function CategorySetupStep({ profile, busy, submitError, onComplete }) {
  const [activeCategories, setActiveCategories] = useState([]);
  const [selectedIds, setSelectedIds] = useState(() => new Set(profile.selected_category_ids || []));
  const [loading, setLoading] = useState(true);
  const [validation, setValidation] = useState('');
  const [categoryLoadError, setCategoryLoadError] = useState('');
  const loadRequestRef = useRef(0);

  const loadCategories = () => {
    const requestId = loadRequestRef.current + 1;
    loadRequestRef.current = requestId;
    setLoading(true);
    setCategoryLoadError('');
    loadActiveCategories()
      .then((categories) => {
        if (loadRequestRef.current !== requestId) return;
        setActiveCategories(categories);
        if (!categories.length) {
          setCategoryLoadError('Kategori listesi yüklenemedi. Lütfen tekrar dene.');
        }
      })
      .catch(() => {
        if (loadRequestRef.current !== requestId) return;
        setActiveCategories([]);
        setCategoryLoadError('Kategori listesi yüklenemedi. Lütfen tekrar dene.');
      })
      .finally(() => {
        if (loadRequestRef.current === requestId) setLoading(false);
      });
  };

  useEffect(() => {
    loadCategories();
    return () => {
      loadRequestRef.current += 1;
    };
  }, []);

  const activeSelectedIds = useMemo(() => sanitizeSelectedCategoryIds(selectedIds, activeCategories), [activeCategories, selectedIds]);
  const selectedCount = activeSelectedIds.size;
  const remaining = Math.max(0, MIN_CATEGORY_SELECTION_COUNT - selectedCount);

  const toggleCategory = (id) => {
    setValidation('');
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Save rules: a valid saved preference is 0 categories OR >= 3 categories.
  // 1–2 selected categories can never be persisted as active preferences.
  const finishWithSelection = () => {
    if (selectedCount > 0 && selectedCount < MIN_CATEGORY_SELECTION_COUNT) {
      setValidation('En az 3 kategori seçmelisin.');
      return;
    }
    onComplete(Array.from(activeSelectedIds));
  };

  // Leaving without completing 3 selections continues with 0 categories.
  const continueWithoutSelection = () => {
    onComplete([]);
  };

  return (
    <div className="rounded-2xl border border-primary/25 bg-slate-950/42 p-5 shadow-2xl">
      <StepHeader
        icon={ShieldCheck}
        title="İlgi Alanlarını Seç"
        body="En az 3 kategori seçiniz."
      />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 font-inter text-xs font-bold text-primary">
          Seçili: {selectedCount}
        </span>
        {remaining > 0 && (
          <span className="rounded-full border border-amber-300/35 bg-amber-300/10 px-3 py-1 font-inter text-xs font-bold text-amber-100">
            Önerilen için {remaining} seçim kaldı
          </span>
        )}
      </div>
      {loading ? (
        <div
          className="grid min-h-40 place-items-center rounded-xl border border-white/10 bg-white/[0.04]"
          role="status"
          aria-live="polite"
          aria-label="Kategoriler yükleniyor"
        >
          <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden="true" />
        </div>
      ) : activeCategories.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-5 text-center">
          <p className="font-inter text-sm font-bold text-blue-100/78">
            {categoryLoadError || 'Kategoriler hazırlanıyor. Ana Sayfa’ya geçip daha sonra Profil içinden seçebilirsin.'}
          </p>
          <button
            type="button"
            onClick={loadCategories}
            className="mt-3 min-h-10 rounded-xl border border-white/15 px-4 py-2 font-inter text-xs font-black text-blue-100"
          >
            Tekrar Dene
          </button>
        </div>
      ) : (
        <div className="max-h-[42vh] space-y-2 overflow-y-auto pr-1">
          {activeCategories.map((category) => {
            const id = Number(category.category_id);
            const selected = selectedIds.has(id);
            return (
              <button
                key={id}
                type="button"
                onClick={() => toggleCategory(id)}
                className="min-h-12 w-full rounded-xl border p-3 text-left transition-colors"
                style={{
                  borderColor: selected ? 'rgba(250,204,21,0.55)' : 'rgba(148,163,184,0.22)',
                  background: selected ? 'rgba(250,204,21,0.12)' : 'rgba(255,255,255,0.04)',
                }}
              >
                <span className="flex items-start gap-2">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border border-primary/45">
                    {selected && <Check className="h-3.5 w-3.5 text-primary" strokeWidth={3} />}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-inter text-sm font-extrabold text-white">{category.name}</span>
                    {category.description && (
                      <span className="mt-1 block font-inter text-xs leading-relaxed text-blue-100/62">{category.description}</span>
                    )}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
      {(validation || submitError) && (
        <p className="mt-3 rounded-xl border border-amber-300/35 bg-amber-300/10 px-3 py-2 font-inter text-xs font-bold text-amber-100" role="alert">
          {validation || submitError}
        </p>
      )}
      <div className="mt-5 flex flex-col gap-2">
        <Button onClick={finishWithSelection} disabled={busy || loading} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl font-inter font-black">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ArrowRight className="h-4 w-4" aria-hidden="true" />}
          Ana Sayfa
        </Button>
        <button
          type="button"
          onClick={continueWithoutSelection}
          disabled={busy}
          className="min-h-11 w-full rounded-xl border border-white/15 px-4 py-3 font-inter text-sm font-black text-blue-100"
        >
          Şimdilik Misafir Devam Et
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-inter text-[10px] font-bold uppercase tracking-widest text-blue-100/62">{label}</span>
      {children}
    </label>
  );
}
