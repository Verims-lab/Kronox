import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Check,
  Loader2,
  Play,
  ShieldCheck,
  Sparkles,
  UserRound,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';
import AuthProviderButtons from '@/components/auth/AuthProviderButtons';
import {
  GUEST_ONBOARDING_STATES,
  ensureGuestProfile,
  getGuestOnboardingStep,
  isGuestOnboardingComplete,
  makeKronoxUserFallback,
  prepareGuestAccountLink,
  updateGuestProfileOnboarding,
} from '@/lib/guestProfile';
import { buildSoloGameConfigForLevel, readSoloProgress, SOLO_MAX_MOVES, SOLO_LEVEL_TIME_SECONDS } from '@/lib/soloLevels';
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
  const [showSecureProgressPrompt, setShowSecureProgressPrompt] = useState(false);
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
  if (isGuestOnboardingComplete(guestProfile)) {
    if (showSecureProgressPrompt) {
      return (
        <OnboardingShell>
          <SecureProgressStep
            busy={busy}
            onGuestContinue={() => navigate('/', { replace: true })}
            onBeforeStart={({ provider }) => prepareGuestAccountLink({
              provider,
              soloProgress: readSoloProgress(null),
            })}
          />
        </OnboardingShell>
      );
    }
    return <Navigate to="/" replace />;
  }

  const step = normalizeStep(guestProfile);
  const isProfileStep = step === GUEST_ONBOARDING_STATES.TUTORIAL_COMPLETED ||
    step === GUEST_ONBOARDING_STATES.PROFILE_SETUP_PENDING;
  const isTutorialResumeStep = step === GUEST_ONBOARDING_STATES.TUTORIAL_IN_PROGRESS &&
    guestProfile?.onboarding_status === GUEST_ONBOARDING_STATES.TUTORIAL_IN_PROGRESS &&
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
          username={guestProfile.username || guestProfile.display_name}
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
                display_name: updated?.display_name || updated?.username || patch.username || guestProfile?.display_name,
                age: updated?.age ?? patch.age ?? guestProfile?.age,
                gender: updated?.gender ?? patch.gender ?? guestProfile?.gender,
                tutorial_status: 'completed',
                profile_setup_status: 'completed',
                category_setup_status: 'pending',
                onboarding_status: GUEST_ONBOARDING_STATES.CATEGORY_SETUP_PENDING,
              });
              void Promise.resolve(checkUserAuth?.()).catch(() => null);
            } catch (profileError) {
              setError(profileError?.code === 'username_taken'
                ? 'Bu kullanıcı adı alınmış. Başka bir Kronox adı seç.'
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
          onComplete={async (selectedIds) => {
            setCategorySaving(true);
            setError('');
            try {
              const updated = await updateGuestProfileOnboarding({
                selected_category_ids: selectedIds,
                tutorial_status: 'completed',
                profile_setup_status: 'completed',
                category_setup_status: 'completed',
                onboarding_status: GUEST_ONBOARDING_STATES.ONBOARDING_COMPLETE,
              });
              setGuestProfile(updated);
              await checkUserAuth?.();
              setShowSecureProgressPrompt(true);
            } catch {
              setError('Kategori seçimlerin kaydedilemedi. Lütfen tekrar dene.');
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
    <div className="flex flex-col items-center justify-center gap-3 text-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
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

function TutorialStartStep({ username, busy, onStart }) {
  return (
    <div className="rounded-2xl border border-primary/25 bg-slate-950/42 p-5 shadow-2xl">
      <StepHeader
        icon={Sparkles}
        title="İlk Seviye Seni Bekliyor"
        body={`${username || 'KronoxUser'}, önce gerçek oyunun içinde kısa bir rehberli seviye oynayacaksın. Giriş yapmak zorunda değilsin.`}
      />
      <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.04] p-3 font-inter text-xs font-semibold text-blue-100/80">
        <p>• Kartı zaman çizgisine sürükle.</p>
        <p>• Önce, sonra ve iki olay arasına yerleştirmeyi öğren.</p>
        <p>• Hamle sayısı ve jokerleri sadece eğitim amaçlı tanı.</p>
      </div>
      <Button onClick={onStart} disabled={busy} className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl font-inter font-black">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
        Rehberli İlk Seviyeyi Oyna
      </Button>
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
    () => profile.username || profile.display_name || makeKronoxUserFallback(profile.guest_id || ''),
    [profile.display_name, profile.guest_id, profile.username]
  );
  const [username, setUsername] = useState(fallbackUsername);
  const [age, setAge] = useState(profile.age || '');
  const [gender, setGender] = useState(profile.gender || '');
  const [validation, setValidation] = useState('');

  useEffect(() => {
    setUsername(fallbackUsername);
    setAge(profile.age || '');
    setGender(profile.gender || '');
  }, [fallbackUsername, profile.age, profile.gender]);

  const normalizedUsername = username.trim() || fallbackUsername;
  const canSubmit = normalizedUsername.trim().length >= 3;

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
            onChange={(event) => setUsername(event.target.value)}
            className="h-11 w-full rounded-xl border border-white/12 bg-white/[0.06] px-3 font-inter text-sm font-bold text-white outline-none focus:border-primary/70"
            maxLength={24}
            autoComplete="username"
          />
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
      {(validation || submitError) && (
        <p className="mt-3 rounded-xl border border-amber-300/35 bg-amber-300/10 px-3 py-2 font-inter text-xs font-bold text-amber-100">
          {validation || submitError}
        </p>
      )}
      <Button type="submit" disabled={busy || !canSubmit} className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl font-inter font-black">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
        Kategorilere Geç
      </Button>
    </form>
  );
}

function CategorySetupStep({ profile, busy, onComplete }) {
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

  const finish = (force = false) => {
    if (!force && selectedCount > 0 && selectedCount < MIN_CATEGORY_SELECTION_COUNT) {
      setValidation('En iyi deneyim için en az 3 kategori öneriyoruz. Yine de misafir olarak devam edebilirsin.');
      return;
    }
    onComplete(Array.from(activeSelectedIds));
  };

  return (
    <div className="rounded-2xl border border-primary/25 bg-slate-950/42 p-5 shadow-2xl">
      <StepHeader
        icon={ShieldCheck}
        title="İlgi Alanlarını Seç"
        body="Solo tercihleri yumuşak ağırlıktır; seçim yapmazsan tüm aktif kategoriler kullanılabilir."
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
        <div className="grid min-h-40 place-items-center rounded-xl border border-white/10 bg-white/[0.04]">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
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
      {validation && <p className="mt-3 rounded-xl border border-amber-300/35 bg-amber-300/10 px-3 py-2 font-inter text-xs font-bold text-amber-100">{validation}</p>}
      <div className="mt-5 flex flex-col gap-2">
        <Button onClick={() => finish(false)} disabled={busy || loading} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl font-inter font-black">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
          Ana Sayfa’ya Geç
        </Button>
        {(validation || selectedCount === 0) && (
          <button
            type="button"
            onClick={() => finish(true)}
            disabled={busy}
            className="min-h-11 w-full rounded-xl border border-white/15 px-4 py-3 font-inter text-sm font-black text-blue-100"
          >
            Şimdilik Misafir Devam Et
          </button>
        )}
      </div>
    </div>
  );
}

function SecureProgressStep({ busy, onGuestContinue, onBeforeStart }) {
  return (
    <div className="rounded-2xl border border-primary/25 bg-slate-950/42 p-5 shadow-2xl">
      <StepHeader
        icon={ShieldCheck}
        title="İlerlemeni Güvenceye Al"
        body="Hesabını bağlarsan misafir ilerlemen, Kronox Puanın, kategori seçimlerin ve ilerideki ödüllerin kaybolmaz. Bu adım zorunlu değil."
      />
      <AuthProviderButtons
        fromUrl="/"
        onBeforeStart={onBeforeStart}
      />
      <button
        type="button"
        onClick={onGuestContinue}
        disabled={busy}
        className="mt-3 min-h-11 w-full rounded-xl border border-white/15 px-4 py-3 font-inter text-sm font-black text-blue-100"
      >
        Şimdilik misafir devam et
      </button>
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
