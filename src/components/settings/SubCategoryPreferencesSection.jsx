import React, { useEffect, useMemo, useState } from 'react';
import { Check, Loader2, Save, Sparkles } from 'lucide-react';
import {
  MIN_SUBCATEGORY_SELECTION_COUNT,
  getSelectedSubCategoryIds,
  loadActiveSubCategories,
  loadUserSubCategoryPreferences,
  normalizeSubCategoryId,
  saveUserSubCategoryPreferences,
} from '@/lib/userSubCategoryPreferences';

function sameIdSet(a, b) {
  if (a.size !== b.size) return false;
  for (const value of a) if (!b.has(value)) return false;
  return true;
}

function toIdSet(values) {
  return new Set(Array.from(values || []).map(Number).filter(Number.isFinite));
}

export default function SubCategoryPreferencesSection({ user }) {
  const [activeSubCategories, setActiveSubCategories] = useState([]);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [savedSelectedIds, setSavedSelectedIds] = useState(() => new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [validation, setValidation] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      setValidation('');
      setSuccess('');
      try {
        const [subCategories, preferences] = await Promise.all([
          loadActiveSubCategories(),
          loadUserSubCategoryPreferences(user),
        ]);
        if (cancelled) return;
        const activeIds = new Set(subCategories
          .map((item) => normalizeSubCategoryId(item?.id))
          .filter((id) => id !== null));
        const selected = new Set(Array.from(getSelectedSubCategoryIds(preferences))
          .filter((id) => activeIds.has(id)));
        setActiveSubCategories(subCategories);
        setSelectedIds(selected);
        setSavedSelectedIds(new Set(selected));
      } catch {
        if (!cancelled) {
          setActiveSubCategories([]);
          setSelectedIds(new Set());
          setSavedSelectedIds(new Set());
          setError('İlgi alanları yüklenemedi. Lütfen tekrar dene.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [user]);

  const selectedSubCategories = useMemo(() => {
    return activeSubCategories.filter((item) => selectedIds.has(Number(item.id)));
  }, [activeSubCategories, selectedIds]);

  const selectedCount = selectedIds.size;
  const canSave = selectedCount >= MIN_SUBCATEGORY_SELECTION_COUNT;
  const dirty = !sameIdSet(selectedIds, savedSelectedIds);
  const remaining = Math.max(0, MIN_SUBCATEGORY_SELECTION_COUNT - selectedCount);

  const toggleSubCategory = (id) => {
    setValidation('');
    setSuccess('');
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    setSuccess('');
    setValidation('');
    setError('');
    if (!canSave) {
      setValidation('En az 5 ilgi alanı seçmelisin.');
      return;
    }
    setSaving(true);
    try {
      const result = await saveUserSubCategoryPreferences(user, selectedIds, activeSubCategories);
      const next = toIdSet(result.selectedIds);
      setSelectedIds(next);
      setSavedSelectedIds(new Set(next));
      setSuccess('İlgi alanların kaydedildi.');
    } catch (err) {
      setValidation(err?.message || 'İlgi alanları kaydedilemedi. Lütfen tekrar dene.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border/40 bg-secondary/20 p-4">
      <div className="mb-3 flex items-start gap-3">
        <div className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-xl border border-primary/25 bg-primary/10 text-primary">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-inter text-base font-black text-foreground">İlgi Alanlarım</h2>
          <p className="mt-1 font-inter text-xs leading-relaxed text-muted-foreground">
            Oyun deneyimini kişiselleştirmek için en az 5 ilgi alanı seç.
          </p>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="kronox-number rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          Seçili: {selectedCount}
        </span>
        <span className="rounded-full border border-border/40 bg-background/35 px-3 py-1 text-xs font-semibold text-muted-foreground">
          En az {MIN_SUBCATEGORY_SELECTION_COUNT} ilgi alanı seçmelisin.
        </span>
        {remaining > 0 && (
          <span className="kronox-number rounded-full border border-amber-300/35 bg-amber-300/10 px-3 py-1 text-xs font-semibold text-amber-100">
            {remaining} seçim kaldı
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex min-h-24 items-center justify-center rounded-xl border border-border/30 bg-background/20">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : activeSubCategories.length === 0 ? (
        <p className="rounded-xl border border-border/35 bg-background/25 px-3 py-4 text-center font-inter text-sm font-semibold text-muted-foreground">
          İlgi alanları henüz hazırlanıyor.
        </p>
      ) : (
        <>
          {selectedSubCategories.length > 0 && (
            <div className="mb-3">
              <p className="mb-2 px-1 font-inter text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Seçtiklerin
              </p>
              <div className="flex flex-wrap gap-2">
                {selectedSubCategories.map((item) => (
                  <button
                    key={`selected-${item.id}`}
                    type="button"
                    onClick={() => toggleSubCategory(Number(item.id))}
                    className="inline-flex min-h-9 max-w-full items-center gap-1.5 rounded-full border border-primary/35 bg-primary/15 px-3 py-1.5 text-left font-inter text-xs font-bold text-primary"
                  >
                    <Check className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="min-w-0 break-words">{item.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-2">
            {activeSubCategories.map((item) => {
              const id = Number(item.id);
              const selected = selectedIds.has(id);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => toggleSubCategory(id)}
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

      {(validation || error || success) && (
        <p
          className={`mt-3 rounded-xl border px-3 py-2 font-inter text-xs font-bold ${
            success
              ? 'border-emerald-300/35 bg-emerald-400/10 text-emerald-100'
              : 'border-amber-300/35 bg-amber-300/10 text-amber-100'
          }`}
        >
          {success || validation || error}
        </p>
      )}

      <button
        type="button"
        onClick={handleSave}
        disabled={loading || saving || activeSubCategories.length === 0 || (!dirty && canSave)}
        className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 py-3 font-inter text-sm font-black transition-transform active:scale-[0.98] disabled:opacity-55"
        style={{
          background: 'linear-gradient(180deg, #facc15, #d99b05)',
          color: '#1a1003',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.55), 0 10px 24px rgba(0,0,0,0.28)',
        }}
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Kaydet
      </button>
    </div>
  );
}
