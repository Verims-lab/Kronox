import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, Search, Trash2, UsersRound } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { base44 } from '@/api/base44Client';

const CONFIRM_TEXT = 'SİL';

async function callCleanupFunction(payload) {
  const response = await base44.functions.fetch('/cleanupInactiveGuestUsernames', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.ok === false) {
    throw new Error(body?.error || 'Pasif guest temizliği çalıştırılamadı.');
  }
  return body;
}

function formatNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)).toLocaleString('tr-TR') : '0';
}

function formatDateTime(value) {
  const time = Date.parse(String(value || ''));
  if (!Number.isFinite(time)) return 'Bilinmiyor';
  return new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(time));
}

const REASON_LABELS = {
  missing_or_uncertain_last_open: 'Son açılış belirsiz',
  active_within_10_days: '10 gün içinde aktif',
  score_not_zero: 'Puan 0 değil',
  score_source_missing_or_ambiguous: 'Puan kaynağı belirsiz',
  linked_or_logged_in: 'Login/bağlantı var',
  not_guest_only: 'Guest-only değil',
  has_friends: 'Arkadaş ilişkisi var',
  has_active_social_relation: 'Aktif sosyal/lobi ilişkisi var',
  active_presence: 'Aktif çevrimiçi görünüm var',
  economy_state_not_empty: 'Ekonomi bakiyesi var',
  ambiguous_username_projection: 'Liderlik adı belirsiz',
  invalid_or_unsafe_username: 'Kullanıcı adı geçersiz',
  ambiguous_guest_reference: 'Guest kimliği belirsiz',
};

export default function InactiveGuestCleanupTool() {
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const candidateCount = Number(preview?.totalCandidateCount || 0);
  const confirmMatches = confirmText.trim() === CONFIRM_TEXT;
  const skippedRows = useMemo(() => (
    Object.entries(preview?.skippedReasonCounts || {})
      .filter(([, count]) => Number(count) > 0)
      .sort((a, b) => Number(b[1]) - Number(a[1]))
      .slice(0, 6)
  ), [preview]);

  const handlePreview = async () => {
    if (loading) return;
    setLoading('preview');
    setError('');
    setResult(null);
    setPreview(null);
    setConfirmText('');
    try {
      const body = await callCleanupFunction({ action: 'preview' });
      setPreview(body?.preview || null);
    } catch (err) {
      setError(err?.message || 'Aday önizlemesi alınamadı.');
    } finally {
      setLoading('');
    }
  };

  const handleExecute = async () => {
    if (!preview || !confirmMatches || loading) return;
    setLoading('execute');
    setError('');
    setResult(null);
    try {
      const body = await callCleanupFunction({
        action: 'execute',
        confirmText,
        previewCandidateCount: candidateCount,
      });
      setResult(body || null);
      setPreview(null);
      setConfirmText('');
      setConfirmOpen(false);
    } catch (err) {
      setError(err?.message || 'Temizlik tamamlanamadı.');
    } finally {
      setLoading('');
    }
  };

  return (
    <div className="rounded-2xl border border-red-300/25 bg-red-300/5 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-red-300/30 bg-red-300/10 text-red-100">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <UsersRound className="h-4 w-4" aria-hidden="true" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-cinzel text-sm font-black tracking-wide text-red-50">Pasif Guest Kullanıcı Adlarını Temizle</p>
          <p className="mt-1 font-inter text-xs leading-relaxed text-blue-100/65">
            10 günden fazla açılmamış, 0 puanlı, login olmamış ve arkadaşı olmayan kullanıcı adlarını temizler. İşlem manuel onay gerektirir ve kullanıcı adlarını yeniden kullanılabilir hale getirir.
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <Button
          type="button"
          variant="outline"
          onClick={handlePreview}
          disabled={Boolean(loading)}
          className="w-full border-red-200/35 bg-red-300/10 text-red-50 hover:bg-red-300/15"
        >
          {loading === 'preview' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
          Adayları Bul
        </Button>

        {preview && (
          <div className="rounded-xl border border-blue-200/15 bg-slate-950/45 p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-inter text-xs font-black text-red-50">
                  {formatNumber(candidateCount)} aday bulundu
                </p>
                <p className="mt-1 font-inter text-[11px] leading-relaxed text-blue-100/60">
                  Liste yalnızca güvenli kullanıcı adı, son açılış, puan ve ilişki özetini gösterir.
                </p>
              </div>
              <span className="rounded-full border border-red-200/30 bg-red-500/10 px-2 py-1 font-inter text-[10px] font-black text-red-100">
                Dry-run
              </span>
            </div>

            <div className="mt-3 max-h-52 space-y-2 overflow-auto pr-1">
              {(preview.candidates || []).map((candidate) => (
                <div key={`${candidate.username}-${candidate.last_app_open_at}`} className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-inter text-xs font-black text-white">{candidate.username}</p>
                      <p className="mt-0.5 font-inter text-[10px] text-blue-100/55">
                        Son açılış: {formatDateTime(candidate.last_app_open_at)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right font-inter text-[10px] font-bold text-blue-100/60">
                      <p>{formatNumber(candidate.score)} puan</p>
                      <p>{formatNumber(candidate.friend_count)} arkadaş</p>
                    </div>
                  </div>
                </div>
              ))}
              {candidateCount === 0 && (
                <p className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-3 text-center font-inter text-xs text-blue-100/60">
                  Şu anda güvenli silinebilir aday yok.
                </p>
              )}
            </div>

            {skippedRows.length > 0 && (
              <div className="mt-3 rounded-lg border border-white/10 bg-black/10 p-2.5">
                <p className="font-inter text-[10px] font-black uppercase tracking-[0.16em] text-blue-100/45">Bloklanan özet</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {skippedRows.map(([reason, count]) => (
                    <div key={reason} className="rounded-md bg-white/[0.03] px-2 py-1.5">
                      <p className="truncate font-inter text-[10px] text-blue-100/55">{REASON_LABELS[reason] || reason}</p>
                      <p className="kronox-number text-sm font-black text-blue-50">{formatNumber(count)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Button
              type="button"
              onClick={() => setConfirmOpen(true)}
              disabled={Boolean(loading) || candidateCount <= 0}
              className="mt-3 w-full bg-red-600 text-white hover:bg-red-500 disabled:opacity-45"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Seçili/Aday Kullanıcı Adlarını Sil
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
              Temizlik tamamlandı.
            </div>
            <p className="mt-1 text-emerald-50/75">
              {formatNumber(result.deletedReleasedCount)} kullanıcı adı serbest bırakıldı. Kalan aday: {formatNumber(result.remainingCandidateCount)}.
            </p>
          </div>
        )}
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="max-w-sm border-red-300/25 bg-slate-950 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-50">
              <AlertTriangle className="h-5 w-5 text-red-200" />
              Kullanıcı adları silinsin mi?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-blue-100/65">
              Bu işlem aday guest profillerini kaldırır ve kullanıcı adlarını yeniden kullanılabilir hale getirir. Login olmuş, puanlı, arkadaşı olan veya son açılışı belirsiz kullanıcılar silinmez. İşlem kolayca geri alınamaz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <p className="font-inter text-xs text-blue-100/65">
              Devam etmek için <span className="font-black text-red-100">{CONFIRM_TEXT}</span> yaz.
            </p>
            <Input
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value)}
              autoCapitalize="characters"
              placeholder={CONFIRM_TEXT}
              className="border-red-300/25 bg-red-950/20 text-white focus-visible:ring-red-300"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading === 'execute'} className="border-white/15 bg-transparent text-white hover:bg-white/10">
              Vazgeç
            </AlertDialogCancel>
            <Button
              type="button"
              disabled={!confirmMatches || loading === 'execute'}
              onClick={handleExecute}
              className="bg-red-600 text-white hover:bg-red-500 disabled:opacity-45"
            >
              {loading === 'execute' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Sil ve Serbest Bırak
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
