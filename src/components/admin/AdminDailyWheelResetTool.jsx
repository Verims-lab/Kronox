import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { getKronoxUserId, normalizeKronoxUserId } from '@/lib/kronoxUserId';
import AdminCollapsibleSection from '@/components/admin/AdminCollapsibleSection';

function unwrapFunctionBody(body) {
  if (body?.data?.data && typeof body.data.data === 'object') return body.data.data;
  if (body?.data && typeof body.data === 'object') return body.data;
  if (body && typeof body === 'object') return body;
  return {};
}

async function callAdminResetDailyWheelState(payload) {
  const response = await base44.functions.fetch('/adminResetDailyWheelState', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = unwrapFunctionBody(await response.json().catch(() => ({})));
  if (!response.ok || body?.ok === false || body?.success === false) {
    throw new Error(body?.error || 'Günlük çark sıfırlanamadı.');
  }
  return body;
}

function clearLocalDailyWheelPopupKeys(dayKey) {
  if (typeof localStorage === 'undefined' || !dayKey) return 0;
  let removed = 0;
  const prefix = 'kronox_daily_wheel_auto_popup_seen:';
  try {
    const keys = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key && key.startsWith(prefix) && key.includes(`:${dayKey}`)) keys.push(key);
    }
    keys.forEach((key) => {
      localStorage.removeItem(key);
      removed += 1;
    });
  } catch {
    return removed;
  }
  return removed;
}

export default function AdminDailyWheelResetTool() {
  const { user, guestProfile, checkUserAuth } = useAuth();
  const [kronoxUserId, setKronoxUserId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const normalizedKronoxUserId = normalizeKronoxUserId(kronoxUserId);
  const canSubmit = Boolean(normalizedKronoxUserId && !loading);
  const currentActorKronoxUserId = useMemo(
    () => getKronoxUserId(user) || getKronoxUserId(guestProfile),
    [guestProfile, user],
  );

  const handleReset = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const body = await callAdminResetDailyWheelState({
        kronox_user_id: normalizedKronoxUserId,
      });
      const localPopupKeysCleared = normalizedKronoxUserId === currentActorKronoxUserId
        ? clearLocalDailyWheelPopupKeys(body.dayKey)
        : 0;
      setResult({ ...body, localPopupKeysCleared });
      if (normalizedKronoxUserId === currentActorKronoxUserId) {
        await checkUserAuth?.().catch(() => null);
      }
    } catch (err) {
      setError(err?.message || 'Günlük çark sıfırlanamadı.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminCollapsibleSection
      title="Günlük Çark Reset"
      description="Kronox User ID ile kullanıcının bugünkü çark hakkını test için sıfırlar."
      icon={loading ? <Loader2 className="animate-spin" aria-hidden="true" /> : <RotateCcw aria-hidden="true" />}
      summary="Kapalı"
      tone="warning"
      defaultOpen={false}
    >
      <div className="space-y-3">
        <label className="block">
          <span className="font-inter text-[10px] font-black uppercase tracking-[0.18em] text-blue-100/55">Kronox User ID</span>
          <input
            value={kronoxUserId}
            onChange={(event) => {
              setKronoxUserId(event.target.value.toUpperCase());
              setError('');
              setResult(null);
            }}
            type="text"
            inputMode="text"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="KX-XXXX-XXXX-XXXX"
            className="mt-1 h-11 w-full rounded-xl border border-blue-200/15 bg-slate-950/50 px-3 font-inter text-sm font-semibold uppercase tracking-wide text-white outline-none transition focus:border-amber-300/60"
          />
        </label>

        <p className="rounded-xl border border-amber-300/20 bg-amber-300/10 px-3 py-2 font-inter text-xs font-semibold leading-relaxed text-amber-50/90">
          Daha önce kazanılan Elmas/Joker ödülleri geri alınmaz. Daily Quest, Kronox Puan ve Liderlik etkilenmez.
        </p>

        <Button
          type="button"
          onClick={handleReset}
          disabled={!canSubmit}
          className="w-full bg-amber-300 text-slate-950 hover:bg-amber-200 disabled:opacity-45"
        >
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
          Çarkı Resetle
        </Button>

        {!loading && kronoxUserId && !normalizedKronoxUserId && (
          <p className="rounded-xl border border-amber-300/25 bg-amber-300/10 px-3 py-2 font-inter text-xs font-semibold text-amber-100">
            Kullanıcı ID formatı KX-XXXX-XXXX-XXXX olmalı.
          </p>
        )}

        {error && (
          <p className="flex items-start gap-2 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 font-inter text-xs font-semibold text-red-100">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </p>
        )}

        {result && (
          <div className="rounded-xl border border-emerald-300/25 bg-emerald-400/10 px-3 py-2 font-inter text-xs text-emerald-50">
            <div className="flex items-center gap-2 font-black">
              <CheckCircle2 className="h-4 w-4" />
              Günlük çark test durumu sıfırlandı.
            </div>
            <p className="mt-1 text-emerald-50/80">
              {result.targetUsername || 'Oyuncu'} · {result.targetKronoxUserId} · {result.dayKey}
            </p>
            <p className="mt-1 text-emerald-50/70">
              Arşivlenen çark kayıtları: {Number(result.resetItems?.archivedDailyWheelSpinRows) || 0}. Ödül geri alınmadı.
            </p>
          </div>
        )}
      </div>
    </AdminCollapsibleSection>
  );
}
