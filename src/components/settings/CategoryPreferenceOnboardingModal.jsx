import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import {
  MIN_CATEGORY_SELECTION_COUNT,
  getValidActiveSelectedCategoryIds,
  loadActiveCategories,
  loadUserCategoryPreferences,
  saveUserCategoryPreferences,
  sanitizeSelectedCategoryIds,
} from '@/lib/userCategoryPreferences';
import {
  markCategoryPreferenceOnboardingCompleted,
  markCategoryPreferenceOnboardingDeferred,
  shouldShowCategoryPreferenceOnboarding,
} from '@/lib/categoryPreferenceOnboarding';

function toIdSet(values) {
  return new Set(Array.from(values || []).map(Number).filter(Number.isFinite));
}

export default function CategoryPreferenceOnboardingModal({ user, disabled = false, onCompleted }) {
  const [activeCategories, setActiveCategories] = useState([]);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [validation, setValidation] = useState('');
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [dismissedForSession, setDismissedForSession] = useState(false);
  const [completedForSession, setCompletedForSession] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const userEmail = String(user?.email || '').trim().toLowerCase();
  const shouldCheck = !disabled
    && !dismissedForSession
    && !completedForSession
    && Boolean(userEmail);
  const shouldShow = shouldCheck && needsOnboarding;

  useEffect(() => {
    setActiveCategories([]);
    setSelectedIds(new Set());
    setError('');
    setValidation('');
    setNeedsOnboarding(false);
    setDismissedForSession(false);
    setCompletedForSession(false);
  }, [userEmail]);

  useEffect(() => {
    if (!shouldCheck) return undefined;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      setValidation('');
      try {
        const [categories, preferences] = await Promise.all([
          loadActiveCategories(),
          loadUserCategoryPreferences(user),
        ]);
        if (cancelled) return;
        const selected = getValidActiveSelectedCategoryIds(preferences, categories);
        setActiveCategories(categories);
        setSelectedIds(selected);
        setNeedsOnboarding(shouldShowCategoryPreferenceOnboarding({
          user,
          preferences,
          activeCategories: categories,
          categoriesLoaded: true,
        }));
      } catch (err) {
        if (!cancelled) {
          console.warn('[CategoryPreferenceOnboardingModal] category preference bootstrap failed', err?.message || err);
          setActiveCategories([]);
          setSelectedIds(new Set());
          setNeedsOnboarding(false);
          setError('Kategoriler yüklenemedi. Lütfen tekrar dene.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [shouldCheck, user, reloadKey]);

  const activeSelectedIds = useMemo(() => {
    return sanitizeSelectedCategoryIds(selectedIds, activeCategories);
  }, [activeCategories, selectedIds]);

  const selectedCategories = useMemo(() => {
    return activeCategories.filter((item) => activeSelectedIds.has(Number(item.category_id)));
  }, [activeCategories, activeSelectedIds]);

  const selectedCount = activeSelectedIds.size;
  const canContinue = selectedCount >= MIN_CATEGORY_SELECTION_COUNT;
  const remaining = Math.max(0, MIN_CATEGORY_SELECTION_COUNT - selectedCount);
  const setupUnavailable = !loading && activeCategories.length < MIN_CATEGORY_SELECTION_COUNT;

  const toggleCategory = (id) => {
    setValidation('');
    setError('');
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleContinue = async () => {
    setError('');
    setValidation('');
    if (!canContinue) {
      setValidation('En az 3 kategori seçmelisin.');
      return;
    }
    setSaving(true);
    try {
      const result = await saveUserCategoryPreferences(user, selectedIds, activeCategories);
      setSelectedIds(toIdSet(result.selectedIds));
      await markCategoryPreferenceOnboardingCompleted(user);
      setNeedsOnboarding(false);
      setCompletedForSession(true);
      onCompleted?.();
    } catch (err) {
      setValidation(err?.message || 'İlgi alanları kaydedilemedi. Lütfen tekrar dene.');
    } finally {
      setSaving(false);
    }
  };

  const handleDismiss = async () => {
    setDismissedForSession(true);
    setNeedsOnboarding(false);
    setError('');
    setValidation('');
    try {
      await markCategoryPreferenceOnboardingDeferred(user);
      onCompleted?.();
    } catch (err) {
      console.warn('[CategoryPreferenceOnboardingModal] category preference defer failed', err?.message || err);
    }
  };

  const handleRetry = () => {
    setError('');
    setValidation('');
    setActiveCategories([]);
    setSelectedIds(new Set());
    setNeedsOnboarding(false);
    setReloadKey((value) => value + 1);
  };

  return (
    <AnimatePresence>
      {shouldShow && (
        <motion.div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-background/90 px-4 py-6 backdrop-blur-md"
          style={{
            paddingTop: 'calc(1.5rem + env(safe-area-inset-top))',
            paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="category-preference-onboarding-title"
        >
          <motion.div
            className="max-h-full w-full max-w-md overflow-y-auto rounded-2xl border border-primary/25 bg-card p-4 shadow-2xl"
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          >
            <div className="mb-4 flex items-start gap-3">
              <div className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 id="category-preference-onboarding-title" className="font-cinzel text-xl font-black text-foreground">
                  İlgi Alanlarını Seç
                </h2>
                <p className="mt-1 font-inter text-sm leading-relaxed text-muted-foreground">
                  Kronox deneyimini kişiselleştirmek için kategori seçebilirsin. Şimdi seçmezsen Solo tüm aktif kategorilerle başlar.
                </p>
              </div>
            </div>

            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="kronox-number rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                Seçili: {selectedCount}
              </span>
              <span className="rounded-full border border-border/40 bg-background/35 px-3 py-1 text-xs font-semibold text-muted-foreground">
                En az {MIN_CATEGORY_SELECTION_COUNT} kategori seçmelisin.
              </span>
              {remaining > 0 && !setupUnavailable && (
                <span className="kronox-number rounded-full border border-amber-300/35 bg-amber-300/10 px-3 py-1 text-xs font-semibold text-amber-100">
                  {remaining} seçim kaldı
                </span>
              )}
            </div>

            {loading ? (
              <div
                className="flex min-h-40 items-center justify-center rounded-xl border border-border/30 bg-background/20"
                role="status"
                aria-live="polite"
                aria-label="Kategori tercihleri yükleniyor"
              >
                <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden="true" />
              </div>
            ) : setupUnavailable ? (
              <div className="rounded-xl border border-border/35 bg-background/25 px-3 py-5 text-center">
                <p className="font-inter text-sm font-bold text-foreground">Kategoriler henüz hazırlanıyor.</p>
                <p className="mt-2 font-inter text-xs leading-relaxed text-muted-foreground">
                  Bu adımı daha sonra Profil / Ayarlar içinden tamamlayabilirsin.
                </p>
              </div>
            ) : (
              <>
                {selectedCategories.length > 0 && (
                  <div className="mb-3">
                    <p className="mb-2 px-1 font-inter text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      Seçtiklerin
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {selectedCategories.map((item) => {
                        const id = Number(item.category_id);
                        return (
                          <button
                            key={`onboarding-selected-${id}`}
                            type="button"
                            onClick={() => toggleCategory(id)}
                            className="inline-flex min-h-9 max-w-full items-center gap-1.5 rounded-full border border-primary/35 bg-primary/15 px-3 py-1.5 text-left font-inter text-xs font-bold text-primary"
                          >
                            <Check className="h-3.5 w-3.5 flex-shrink-0" />
                            <span className="min-w-0 break-words">{item.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-2">
                  {activeCategories.map((item) => {
                    const id = Number(item.category_id);
                    const selected = selectedIds.has(id);
                    return (
                      <button
                        key={`onboarding-category-${id}`}
                        type="button"
                        onClick={() => toggleCategory(id)}
                        aria-pressed={selected}
                        className="min-h-12 w-full rounded-xl border p-3 text-left transition-colors"
                        style={{
                          borderColor: selected ? 'rgba(250,204,21,0.48)' : 'rgba(148,163,184,0.22)',
                          background: selected ? 'rgba(250,204,21,0.10)' : 'rgba(15,23,42,0.24)',
                        }}
                      >
                        <div className="flex items-start gap-2">
                          <span
                            className="mt-0.5 grid h-5 w-5 flex-shrink-0 place-items-center rounded-full border"
                            style={{
                              borderColor: selected ? 'rgba(250,204,21,0.75)' : 'rgba(148,163,184,0.38)',
                              background: selected ? 'rgba(250,204,21,0.22)' : 'transparent',
                            }}
                          >
                            {selected && <Check className="h-3.5 w-3.5 text-primary" strokeWidth={3} />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block break-words font-inter text-sm font-extrabold text-foreground">
                              {item.name}
                            </span>
                            {item.description && (
                              <span className="mt-1 block break-words font-inter text-xs leading-relaxed text-muted-foreground">
                                {item.description}
                              </span>
                            )}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {(validation || error) && (
              <p className="mt-3 rounded-xl border border-amber-300/35 bg-amber-300/10 px-3 py-2 font-inter text-xs font-bold text-amber-100">
                {validation || error}
              </p>
            )}

            <div className="mt-4 flex flex-col gap-2">
              {setupUnavailable ? (
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="min-h-11 w-full rounded-xl border border-border/45 px-4 py-3 font-inter text-sm font-black text-foreground"
                >
                  Daha Sonra
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleContinue}
                    disabled={loading || saving || !canContinue}
                    className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 py-3 font-inter text-sm font-black transition-transform active:scale-[0.98] disabled:opacity-55"
                    style={{
                      background: 'linear-gradient(180deg, #facc15, #d99b05)',
                      color: '#1a1003',
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.55), 0 10px 24px rgba(0,0,0,0.28)',
                    }}
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    Devam Et
                  </button>
                  <button
                    type="button"
                    onClick={handleDismiss}
                    className="min-h-11 w-full rounded-xl border border-border/45 px-4 py-3 font-inter text-sm font-black text-foreground"
                  >
                    Daha Sonra
                  </button>
                </>
              )}

              {error && (
                <button
                  type="button"
                  onClick={handleRetry}
                  className="flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-border/45 px-4 py-2 font-inter text-xs font-bold text-muted-foreground"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Tekrar Dene
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
