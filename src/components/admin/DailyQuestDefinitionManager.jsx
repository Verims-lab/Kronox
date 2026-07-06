import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ClipboardList, Loader2, Plus, Save, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import KronoxSelectSheet from '@/components/mobile/KronoxSelectSheet';
import DailyQuestDefinitionList from './DailyQuestDefinitionList';
import { AdminRefreshContext } from '@/lib/AdminRefreshContext';
import {
  DAILY_QUEST_TYPE_LABELS,
  DAILY_QUEST_V1_TYPES,
  legacyCreateDailyQuestDefinitionRow,
  legacyListDailyQuestDefinitionRows,
  legacySeedDailyQuestDefinitionRows,
  legacyUpdateDailyQuestDefinitionStatus,
} from '@/lib/dbGateway/dailyQuestGateway';

const DEFAULT_FORM = {
  quest_key: '',
  title: '',
  description: '',
  quest_type: 'start_solo_attempt',
  target_value: 1,
  reward_diamonds: 20,
  status: 'active',
  sort_order: '',
};

function normalizeQuestKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function positiveNumber(value, fallback = 1) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 1 ? Math.floor(number) : fallback;
}

function sortNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.floor(number) : 0;
}

export default function DailyQuestDefinitionManager() {
  const onRegisterRefresh = useContext(AdminRefreshContext);
  const [definitions, setDefinitions] = useState([]);
  const [duplicateGroups, setDuplicateGroups] = useState([]);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [loading, setLoading] = useState('list');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const existingKeys = useMemo(
    () => new Set(definitions.map((item) => String(item.quest_key || '').trim()).filter(Boolean)),
    [definitions],
  );
  const duplicateDefinitionCount = useMemo(
    () => duplicateGroups.reduce((total, group) => total + Number(group?.duplicate_count || 0), 0),
    [duplicateGroups],
  );

  const applyDefinitionPayload = useCallback((body) => {
    setDefinitions(Array.isArray(body?.definitions) ? body.definitions : []);
    setDuplicateGroups(Array.isArray(body?.duplicateGroups) ? body.duplicateGroups : []);
  }, []);

  const loadDefinitions = useCallback(async () => {
    setLoading('list');
    setError('');
    setMessage('');
    try {
      const body = await legacyListDailyQuestDefinitionRows();
      applyDefinitionPayload(body);
      if (Array.isArray(body?.seededKeys) && body.seededKeys.length) {
        setMessage('Varsayılan günlük görevler eklendi.');
      }
    } catch (err) {
      setError(err?.message || 'Günlük görevler yüklenemedi.');
    } finally {
      setLoading('');
    }
  }, [applyDefinitionPayload]);

  useEffect(() => {
    loadDefinitions();
  }, [loadDefinitions]);

  useEffect(() => {
    if (typeof onRegisterRefresh !== 'function') return undefined;
    return onRegisterRefresh(loadDefinitions);
  }, [loadDefinitions, onRegisterRefresh]);

  const updateForm = (field, value) => {
    setMessage('');
    setError('');
    setForm((current) => ({ ...current, [field]: value }));
  };

  const validateForm = () => {
    const questKey = normalizeQuestKey(form.quest_key);
    if (!questKey) return 'Görev anahtarı gerekli.';
    if (existingKeys.has(questKey)) return 'Bu görev anahtarı zaten var.';
    if (!String(form.title || '').trim()) return 'Başlık gerekli.';
    if (!String(form.description || '').trim()) return 'Açıklama gerekli.';
    if (!DAILY_QUEST_V1_TYPES.includes(form.quest_type)) return 'Geçerli bir görev tipi seçin.';
    if (positiveNumber(form.target_value, 0) < 1 || positiveNumber(form.reward_diamonds, 0) < 1) {
      return 'Hedef ve ödül 1 veya daha büyük olmalı.';
    }
    return '';
  };

  const handleSave = async () => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      setMessage('');
      return;
    }
    setLoading('save');
    setError('');
    setMessage('');
    try {
      const body = await legacyCreateDailyQuestDefinitionRow({
        quest_key: normalizeQuestKey(form.quest_key),
        title: form.title,
        description: form.description,
        quest_type: form.quest_type,
        target_value: positiveNumber(form.target_value),
        reward_diamonds: positiveNumber(form.reward_diamonds),
        status: form.status === 'passive' ? 'passive' : 'active',
        sort_order: sortNumber(form.sort_order),
      });
      applyDefinitionPayload(body);
      setForm(DEFAULT_FORM);
      setMessage(body?.message || 'Günlük görev kaydedildi.');
    } catch (err) {
      setError(err?.message || 'Günlük görev kaydedilemedi.');
    } finally {
      setLoading('');
    }
  };

  const handleSeed = async () => {
    setLoading('seed');
    setError('');
    setMessage('');
    try {
      const body = await legacySeedDailyQuestDefinitionRows();
      applyDefinitionPayload(body);
      const count = Array.isArray(body?.seededKeys) ? body.seededKeys.length : 0;
      setMessage(count ? 'Varsayılan günlük görevler eklendi.' : 'Varsayılan günlük görevler zaten mevcut.');
    } catch (err) {
      setError(err?.message || 'Varsayılan görevler hazırlanamadı.');
    } finally {
      setLoading('');
    }
  };

  const handleStatusToggle = useCallback(async (definition) => {
    if (!definition?.id) return;
    const nextStatus = definition.status === 'active' ? 'passive' : 'active';
    setLoading(`status:${definition.id}`);
    setError('');
    setMessage('');
    try {
      const body = await legacyUpdateDailyQuestDefinitionStatus(definition.id, nextStatus);
      applyDefinitionPayload(body);
      setMessage(body?.message || 'Günlük görev güncellendi.');
    } catch (err) {
      setError(err?.message || 'Durum güncellenemedi.');
    } finally {
      setLoading('');
    }
  }, [applyDefinitionPayload]);

  const busy = Boolean(loading);
  const questTypeOptions = DAILY_QUEST_V1_TYPES.map((type) => ({
    value: type,
    label: DAILY_QUEST_TYPE_LABELS[type],
  }));
  const statusOptions = [
    { value: 'active', label: 'Aktif' },
    { value: 'passive', label: 'Pasif' },
  ];

  return (
    <div className="rounded-2xl border border-sky-300/25 bg-sky-400/5 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-sky-300/30 bg-sky-300/10 text-sky-100">
          {loading === 'list' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardList className="h-4 w-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-cinzel text-sm font-black tracking-wide text-sky-50">Günlük Görev Yönetimi</p>
          <p className="mt-1 font-inter text-xs leading-relaxed text-blue-100/65">
            Admin metni yalnızca gösterim içindir; ilerleme mantığını görev tipi ve hedef belirler.
          </p>
        </div>
      </div>

      <DailyQuestDefinitionList
        definitions={definitions}
        duplicateDefinitionCount={duplicateDefinitionCount}
        loading={loading}
        busy={busy}
        onRefresh={loadDefinitions}
        onStatusToggle={handleStatusToggle}
      />

      <div className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/5 p-3">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <p className="font-inter text-xs font-black uppercase tracking-[0.18em] text-amber-100/70">Yeni Görev Ekle</p>
            <p className="mt-1 font-inter text-[11px] leading-relaxed text-amber-50/60">
              Başlık ve açıklama çalıştırılmaz; sistem yalnızca seçilen enum görev tipini ölçer.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label="Varsayılan günlük görevleri ekle"
            onClick={handleSeed}
            disabled={busy}
            className="h-9 shrink-0 border-amber-300/30 bg-amber-300/10 text-amber-50 hover:bg-amber-300/15"
          >
            {loading === 'seed' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Görev Anahtarı">
            <input
              value={form.quest_key}
              onChange={(event) => updateForm('quest_key', normalizeQuestKey(event.target.value))}
              placeholder="correct_5_cards"
              autoCapitalize="none"
              spellCheck={false}
              className="h-10 w-full rounded-xl border border-blue-200/15 bg-slate-950/50 px-3 font-inter text-sm text-white outline-none transition focus:border-amber-300/60"
            />
          </Field>
          <Field label="Görev Tipi">
            <KronoxSelectSheet
              label="Görev Tipi"
              value={form.quest_type}
              onChange={(nextValue) => updateForm('quest_type', nextValue)}
              options={questTypeOptions}
              disabled={busy}
              sheetTitle="Görev Tipi Seç"
            />
          </Field>
          <Field label="Başlık">
            <input
              value={form.title}
              onChange={(event) => updateForm('title', event.target.value)}
              placeholder="5 Kart Doğru Yerleştir"
              className="h-10 w-full rounded-xl border border-blue-200/15 bg-slate-950/50 px-3 font-inter text-sm text-white outline-none transition focus:border-amber-300/60"
            />
          </Field>
          <Field label="Açıklama">
            <input
              value={form.description}
              onChange={(event) => updateForm('description', event.target.value)}
              placeholder="Bugün 5 kartı doğru yerleştir."
              className="h-10 w-full rounded-xl border border-blue-200/15 bg-slate-950/50 px-3 font-inter text-sm text-white outline-none transition focus:border-amber-300/60"
            />
          </Field>
          <Field label="Hedef">
            <input
              value={form.target_value}
              onChange={(event) => updateForm('target_value', event.target.value)}
              type="number"
              min="1"
              step="1"
              className="h-10 w-full rounded-xl border border-blue-200/15 bg-slate-950/50 px-3 font-inter text-sm text-white outline-none transition focus:border-amber-300/60"
            />
          </Field>
          <Field label="Ödül Elmas">
            <input
              value={form.reward_diamonds}
              onChange={(event) => updateForm('reward_diamonds', event.target.value)}
              type="number"
              min="1"
              step="1"
              className="h-10 w-full rounded-xl border border-blue-200/15 bg-slate-950/50 px-3 font-inter text-sm text-white outline-none transition focus:border-amber-300/60"
            />
          </Field>
          <Field label="Durum">
            <KronoxSelectSheet
              label="Durum"
              value={form.status}
              onChange={(nextValue) => updateForm('status', nextValue)}
              options={statusOptions}
              disabled={busy}
              sheetTitle="Görev Durumu"
            />
          </Field>
          <Field label="Sıra">
            <input
              value={form.sort_order}
              onChange={(event) => updateForm('sort_order', event.target.value)}
              type="number"
              step="1"
              placeholder="50"
              className="h-10 w-full rounded-xl border border-blue-200/15 bg-slate-950/50 px-3 font-inter text-sm text-white outline-none transition focus:border-amber-300/60"
            />
          </Field>
        </div>

        <div className="mt-3 rounded-xl border border-sky-300/20 bg-sky-300/5 px-3 py-2">
          <div className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-sky-100" />
            <p className="font-inter text-[11px] leading-relaxed text-sky-50/75">
              Ödül yalnızca Elmas olur. Kronox Puan ve liderlik tablosu bu tanımdan etkilenmez.
            </p>
          </div>
        </div>

        <Button
          type="button"
          onClick={handleSave}
          disabled={busy}
          className="mt-3 w-full bg-amber-400 text-slate-950 hover:bg-amber-300 disabled:opacity-55"
        >
          {loading === 'save' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Kaydet
        </Button>

        {message && (
          <p className="mt-3 rounded-xl border border-emerald-300/25 bg-emerald-400/10 px-3 py-2 font-inter text-xs font-semibold text-emerald-50">
            <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />
            {message}
          </p>
        )}
        {error && (
          <p className="mt-3 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 font-inter text-xs font-semibold text-red-100">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="font-inter text-[10px] font-black uppercase tracking-[0.18em] text-blue-100/55">{label}</span>
      <span className="mt-1 block">{children}</span>
    </label>
  );
}
