import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Diamond, Loader2, PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { getKronoxUserId, normalizeKronoxUserId } from '@/lib/kronoxUserId';
import AdminCollapsibleSection from '@/components/admin/AdminCollapsibleSection';

const AMOUNT_OPTIONS = [100, 300, 500, 1000];

function unwrapFunctionBody(body) {
  if (body?.data?.data && typeof body.data.data === 'object') return body.data.data;
  if (body?.data && typeof body.data === 'object') return body.data;
  if (body && typeof body === 'object') return body;
  return {};
}

async function callAdminGrantDiamonds(payload) {
  const response = await base44.functions.fetch('/adminGrantDiamonds', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = unwrapFunctionBody(await response.json().catch(() => ({})));
  if (!response.ok || body?.ok === false) {
    throw new Error(body?.error || 'Elmas yüklenemedi.');
  }
  return body;
}

function buildRequestId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `admin-diamond-grant:${crypto.randomUUID()}`;
  }
  return `admin-diamond-grant:${Date.now().toString(36)}`;
}

function formatNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)).toLocaleString('tr-TR') : '0';
}

export default function AdminDiamondGrantTool() {
  const { user, guestProfile, setUser, checkUserAuth } = useAuth();
  const [kronoxUserId, setKronoxUserId] = useState('');
  const [amount, setAmount] = useState(100);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const normalizedKronoxUserId = normalizeKronoxUserId(kronoxUserId);
  const canSubmit = Boolean(normalizedKronoxUserId && amount && !loading);
  const currentActorKronoxUserId = useMemo(
    () => getKronoxUserId(user) || getKronoxUserId(guestProfile),
    [guestProfile, user],
  );

  const handleGrant = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const body = await callAdminGrantDiamonds({
        kronox_user_id: normalizedKronoxUserId,
        amount,
        request_id: buildRequestId(),
      });
      setResult(body);
      if (body?.diamondBalanceAfter != null && normalizedKronoxUserId === currentActorKronoxUserId) {
        setUser?.((current) => (current ? { ...current, diamonds: body.diamondBalanceAfter } : current));
        await checkUserAuth?.().catch(() => null);
      }
    } catch (err) {
      setError(err?.message || 'Elmas yüklenemedi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminCollapsibleSection
      title="Test Elmas Yükleme"
      description="Kullanıcı ID ile yalnızca test Elmas bakiyesi ekler; Puan ve liderlik etkilenmez."
      icon={loading ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Diamond aria-hidden="true" />}
      summary="Kapalı"
      tone="info"
      defaultOpen={false}
    >
      <div className="space-y-3">
        <label className="block">
          <span className="font-inter text-[10px] font-black uppercase tracking-[0.18em] text-blue-100/55">Kullanıcı ID</span>
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
            className="mt-1 h-11 w-full rounded-xl border border-blue-200/15 bg-slate-950/50 px-3 font-inter text-sm font-semibold uppercase tracking-wide text-white outline-none transition focus:border-cyan-300/60"
          />
        </label>

        <div>
          <p className="font-inter text-[10px] font-black uppercase tracking-[0.18em] text-blue-100/55">Miktar</p>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {AMOUNT_OPTIONS.map((option) => {
              const selected = option === amount;
              return (
                <button
                  key={option}
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    setAmount(option);
                    setError('');
                    setResult(null);
                  }}
                  className={`min-h-11 rounded-xl border px-2 font-inter text-sm font-black transition ${
                    selected
                      ? 'border-cyan-200 bg-cyan-300/20 text-cyan-50 shadow-[0_0_18px_rgba(103,232,249,0.16)]'
                      : 'border-blue-200/15 bg-slate-950/45 text-blue-100/70 hover:border-cyan-300/40'
                  } disabled:opacity-60`}
                >
                  {formatNumber(option)}
                </button>
              );
            })}
          </div>
        </div>

        <Button
          type="button"
          onClick={handleGrant}
          disabled={!canSubmit}
          className="w-full bg-cyan-300 text-slate-950 hover:bg-cyan-200 disabled:opacity-45"
        >
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
          Yükle
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
              {result.alreadyApplied ? 'Bu istek daha önce uygulanmış.' : 'Elmas yüklendi.'}
            </div>
            <p className="mt-1 text-emerald-50/80">
              {result.targetUsername || 'Oyuncu'} için +{formatNumber(result.amountAdded)} Elmas. Yeni bakiye: {formatNumber(result.diamondBalanceAfter)}.
            </p>
          </div>
        )}
      </div>
    </AdminCollapsibleSection>
  );
}
