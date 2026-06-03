import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, RotateCcw, Search, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';

const MODE_HARD_ZERO = 'hard_zero';
const MODE_NEW_PLAYER = 'new_player';

const MODE_OPTIONS = [
  {
    value: MODE_HARD_ZERO,
    label: 'Hard zero reset',
    help: 'Kronox Puan, Elmas, Solo/Online ilerleme ve liderlik projeksiyonu 0 kalır. Starter/günlük Elmas bugün tekrar verilmez.',
  },
  {
    value: MODE_NEW_PLAYER,
    label: 'New player reset',
    help: 'İlerleme 0 yapılır ve ödül işaretleri temizlenir. Kullanıcı uygulamayı açınca yeni oyuncu gibi +100/+20 Elmas alabilir.',
  },
];

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

async function callAdminResetUserProgress(payload) {
  const response = await base44.functions.fetch('/adminResetUserProgress', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.ok === false) {
    throw new Error(body?.error || 'Kullanıcı ilerlemesi sıfırlanamadı.');
  }
  return body;
}

export default function ResetUserProgressTool() {
  const [targetEmail, setTargetEmail] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [mode, setMode] = useState(MODE_HARD_ZERO);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState('');

  const normalizedTarget = normalizeEmail(targetEmail);
  const normalizedConfirm = normalizeEmail(confirmEmail);
  const confirmationMatches = normalizedTarget && normalizedTarget === normalizedConfirm;
  const selectedMode = useMemo(
    () => MODE_OPTIONS.find((option) => option.value === mode) || MODE_OPTIONS[0],
    [mode],
  );

  const handlePreview = async () => {
    setError('');
    setResult(null);
    setPreview(null);
    if (!normalizedTarget) {
      setError('Hedef kullanıcı e-postası gerekli.');
      return;
    }
    setLoading('preview');
    try {
      const body = await callAdminResetUserProgress({
        action: 'preview',
        targetEmail: normalizedTarget,
        mode,
      });
      setPreview(body.preview || null);
    } catch (err) {
      setError(err?.message || 'Önizleme alınamadı.');
    } finally {
      setLoading('');
    }
  };

  const handleExecute = async () => {
    setError('');
    setResult(null);
    if (!preview) {
      setError('Önce hedef kullanıcı için önizleme alın.');
      return;
    }
    if (!confirmationMatches) {
      setError('Sıfırlamak için hedef e-postayı onay alanına birebir yaz.');
      return;
    }
    setLoading('execute');
    try {
      const body = await callAdminResetUserProgress({
        action: 'execute',
        targetEmail: normalizedTarget,
        confirmEmail: normalizedConfirm,
        mode,
      });
      setResult(body.reset || null);
      setPreview(null);
      setConfirmEmail('');
    } catch (err) {
      setError(err?.message || 'Sıfırlama başarısız oldu.');
    } finally {
      setLoading('');
    }
  };

  return (
    <div className="rounded-2xl border border-amber-300/25 bg-amber-300/5 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber-300/30 bg-amber-300/10 text-amber-200">
          <RotateCcw className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-cinzel text-sm font-black tracking-wide text-amber-100">Reset User Progress</p>
          <p className="mt-1 font-inter text-xs leading-relaxed text-blue-100/65">
            Admin-only bakım aracı. Kullanıcı hesabını silmez; görünür Puan, Elmas, Solo/Online ilerleme ve liderlik projeksiyonunu sıfırlar.
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <label className="block">
          <span className="font-inter text-[10px] font-black uppercase tracking-[0.18em] text-blue-100/55">Target email</span>
          <input
            value={targetEmail}
            onChange={(event) => {
              setTargetEmail(event.target.value);
              setPreview(null);
              setResult(null);
            }}
            type="email"
            inputMode="email"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="user@example.com"
            className="mt-1 h-11 w-full rounded-xl border border-blue-200/15 bg-slate-950/50 px-3 font-inter text-sm text-white outline-none transition focus:border-amber-300/60"
          />
        </label>

        <label className="block">
          <span className="font-inter text-[10px] font-black uppercase tracking-[0.18em] text-blue-100/55">Reset mode</span>
          <select
            value={mode}
            onChange={(event) => {
              setMode(event.target.value);
              setResult(null);
            }}
            className="mt-1 h-11 w-full rounded-xl border border-blue-200/15 bg-slate-950/50 px-3 font-inter text-sm text-white outline-none transition focus:border-amber-300/60"
          >
            {MODE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <span className="mt-1 block font-inter text-[11px] leading-relaxed text-blue-100/55">{selectedMode.help}</span>
        </label>

        <Button
          type="button"
          variant="outline"
          onClick={handlePreview}
          disabled={Boolean(loading) || !normalizedTarget}
          className="w-full border-amber-300/35 bg-amber-300/10 text-amber-50 hover:bg-amber-300/15"
        >
          {loading === 'preview' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
          Preview reset
        </Button>

        {preview && (
          <div className="rounded-xl border border-blue-200/15 bg-slate-950/45 p-3">
            <div className="flex items-start gap-2">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-200" />
              <div className="min-w-0 flex-1">
                <p className="font-inter text-xs font-black text-amber-100">Önizleme: {preview.targetEmail}</p>
                <div className="mt-2 grid grid-cols-2 gap-2 font-inter text-[11px] text-blue-100/70">
                  <SummaryCell label="Kronox Puan" value={preview.currentKronoxPuan} />
                  <SummaryCell label="Elmas" value={preview.diamonds} />
                  <SummaryCell label="Solo" value={`Seviye ${preview.solo?.currentLevel || 1} · ${preview.solo?.totalStars || 0} yıldız`} />
                  <SummaryCell label="Online" value={`${preview.online?.score || 0} puan · ${preview.online?.wins || 0}/${preview.online?.losses || 0}`} />
                  <SummaryCell label="Liderlik" value={preview.leaderboard?.status === 'exists' ? `${preview.leaderboard.rowCount} satır` : 'satır yok'} />
                  <SummaryCell label="Tamamlanan" value={`${preview.solo?.completedLevelCount || 0} seviye`} />
                </div>
              </div>
            </div>

            <label className="mt-3 block">
              <span className="font-inter text-[10px] font-black uppercase tracking-[0.18em] text-red-100/70">
                Confirm exact email
              </span>
              <input
                value={confirmEmail}
                onChange={(event) => setConfirmEmail(event.target.value)}
                type="email"
                inputMode="email"
                autoCapitalize="none"
                spellCheck={false}
                placeholder={preview.targetEmail}
                className="mt-1 h-11 w-full rounded-xl border border-red-300/25 bg-red-950/20 px-3 font-inter text-sm text-white outline-none transition focus:border-red-300/70"
              />
            </label>

            <Button
              type="button"
              onClick={handleExecute}
              disabled={Boolean(loading) || !confirmationMatches}
              className="mt-3 w-full bg-red-600 text-white hover:bg-red-500 disabled:opacity-45"
            >
              {loading === 'execute' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <AlertTriangle className="mr-2 h-4 w-4" />}
              Execute reset
            </Button>
          </div>
        )}

        {error && (
          <p className="rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 font-inter text-xs font-semibold text-red-100">
            {error}
          </p>
        )}

        {result && (
          <div className="rounded-xl border border-emerald-300/25 bg-emerald-400/10 px-3 py-2 font-inter text-xs text-emerald-50">
            <div className="flex items-center gap-2 font-black">
              <CheckCircle2 className="h-4 w-4" />
              Sıfırlama tamamlandı.
            </div>
            <p className="mt-1 text-emerald-50/75">
              {result.targetEmail} · {result.mode === MODE_HARD_ZERO ? 'Hard zero reset' : 'New player reset'} · local progress reset marker: {result.progressResetAt}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCell({ label, value }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1.5">
      <div className="text-[9px] font-black uppercase tracking-[0.14em] text-blue-100/45">{label}</div>
      <div className="mt-0.5 truncate text-xs font-bold text-blue-50">{value}</div>
    </div>
  );
}
