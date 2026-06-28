import React, { useEffect, useState } from 'react';
import { Clock3, Loader2, RefreshCw, ShieldCheck, Smartphone, Trophy, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';

function unwrapFunctionResponse(response) {
  if (response?.data?.data && typeof response.data.data === 'object') return response.data.data;
  if (response?.data && typeof response.data === 'object') return response.data;
  if (response && typeof response === 'object') return response;
  return {};
}

function errorMessageFromBody(body, fallback) {
  const code = String(body?.code || body?.error || '').trim();
  if (code === 'Admin access required') return 'Admin yetkisi gerekli.';
  if (code === 'Authentication required') return 'Oturum doğrulaması gerekli.';
  if (code === 'user_report_failed') return 'Kullanıcı raporu hazırlanamadı.';
  if (code) return `${fallback} (${code})`;
  return fallback;
}

function isNotFoundError(error) {
  const status = Number(error?.status || error?.response?.status || error?.statusCode);
  const message = String(error?.message || '').toLowerCase();
  return status === 404 || message.includes('status code 404') || message.includes('not found');
}

async function callUserReportFunction() {
  try {
    const response = await base44.functions.invoke('getUserReport', {});
    const body = unwrapFunctionResponse(response);
    if (body?.ok === false) throw new Error(errorMessageFromBody(body, 'Rapor alınamadı.'));
    return body;
  } catch (invokeError) {
    try {
      const response = await base44.functions.fetch('/getUserReport', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const body = await response.json().catch(() => ({}));
      if (response.status === 404) throw new Error('getUserReport fonksiyonu bulunamadı veya deploy edilmemiş.');
      if (response.status === 403) throw new Error('Admin yetkisi gerekli.');
      if (response.status === 401) throw new Error('Oturum doğrulaması gerekli.');
      if (!response.ok || body?.ok === false) {
        throw new Error(errorMessageFromBody(body, invokeError?.message || 'Rapor alınamadı.'));
      }
      return body;
    } catch (fetchError) {
      if (isNotFoundError(fetchError) || isNotFoundError(invokeError)) {
        throw new Error('getUserReport fonksiyonu bulunamadı veya deploy edilmemiş.');
      }
      throw fetchError;
    }
  }
}

function formatNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)).toLocaleString('tr-TR') : '0';
}

function formatPercent(value) {
  const number = Number(value);
  return Number.isFinite(number) ? `%${number.toLocaleString('tr-TR')}` : '%0';
}

function formatDateTime(value) {
  const time = Date.parse(String(value || ''));
  if (!Number.isFinite(time)) return '';
  return new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(time));
}

const PLATFORM_LABELS = {
  ios: 'iOS',
  android: 'Android',
  other: 'Other',
  unknown: 'Bilinmiyor',
};

export default function UserReportTool() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadReport = async () => {
    if (loading) return;
    setLoading(true);
    setError('');
    try {
      const result = await callUserReportFunction();
      setReport(result?.report || null);
    } catch (err) {
      setError(err?.message || 'Kullanıcı raporu alınamadı.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const counts = report?.counts || {};
  const platformBreakdown = report?.platformBreakdown || {};
  const active30PlatformBreakdown = report?.active30DayPlatformBreakdown || {};
  const generatedAt = formatDateTime(report?.generatedAt);

  return (
    <div className="rounded-2xl border border-border/40 bg-secondary/20 p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Users className="h-4 w-4" aria-hidden="true" />}
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-inter text-sm font-semibold text-foreground">Kullanıcı Raporu</p>
              <p className="font-inter text-xs leading-5 text-muted-foreground">
                Bu rapor kullanıcı, giriş, puan ve son aktiflik özetlerini gösterir. Silme işlemi yapmaz.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={loading}
              onClick={loadReport}
              className="shrink-0 border-primary/25 bg-primary/10 px-2 text-primary hover:bg-primary/15"
              aria-label="Kullanıcı raporunu yenile"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            </Button>
          </div>

          {error && (
            <p className="rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 font-inter text-xs font-semibold text-red-100">
              {error}
            </p>
          )}

          {!error && !report && (
            <div
              className="rounded-xl border border-primary/15 bg-background/20 px-3 py-4 text-center font-inter text-xs text-muted-foreground"
              role="status"
              aria-live="polite"
            >
              {loading ? 'Kullanıcı raporu yükleniyor...' : 'Rapor henüz yüklenmedi.'}
            </div>
          )}

          {report && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <Metric icon={<Users />} label="Toplam kullanıcı" value={formatNumber(counts.totalUsersByDistinctValidUsername)} />
                <Metric icon={<ShieldCheck />} label="Login olmuş kullanıcı" value={formatNumber(counts.loggedInUsers)} helper={formatPercent(counts.loginRatioPercent)} />
                <Metric icon={<Trophy />} label="0’dan fazla puan" value={formatNumber(counts.usersWithKronoxPuanGreaterThanZero)} />
                <Metric icon={<Clock3 />} label="10+ gündür açmamış" value={formatNumber(counts.inactive10DaysUsers)} />
                <Metric icon={<Users />} label="Guest kullanıcı" value={formatNumber(counts.guestUsers)} />
                <Metric icon={<Trophy />} label="0 puanlı kullanıcı" value={formatNumber(counts.usersWithZeroKronoxPuan)} />
                <Metric icon={<Clock3 />} label="0 puan + 10+ gün pasif" value={formatNumber(counts.zeroScoreAndInactive10DaysUsers)} />
                <Metric icon={<Clock3 />} label="Son açılış bilinmiyor" value={formatNumber(counts.noLastOpenUsers)} />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <SmallStat label="Son 7 günde yeni" value={counts.newUsers7Days} />
                <SmallStat label="Aktif 1 gün" value={counts.activeUsers1Day} />
                <SmallStat label="Aktif 7 gün" value={counts.activeUsers7Days} />
                <SmallStat label="Aktif 30 gün" value={counts.activeUsers30Days} />
              </div>

              <div className="rounded-xl border border-border/30 bg-background/20 p-3">
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-foreground">
                  <Smartphone className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                  Platform kırılımı
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(PLATFORM_LABELS).map(([key, label]) => (
                    <SmallStat key={key} label={label} value={platformBreakdown[key]} />
                  ))}
                </div>
                <p className="mt-2 font-inter text-[11px] leading-4 text-muted-foreground">
                  Aktif 30 gün platform: iOS {formatNumber(active30PlatformBreakdown.ios)}, Android {formatNumber(active30PlatformBreakdown.android)}, Other {formatNumber(active30PlatformBreakdown.other)}, Bilinmiyor {formatNumber(active30PlatformBreakdown.unknown)}.
                </p>
              </div>

              <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 font-inter text-xs leading-5 text-amber-100/90">
                Login olmamış ve uzun süre 0 puanda kalan kullanıcılar için temizlik politikası ayrı bir işlem olarak değerlendirilecektir. Bu rapor kullanıcı silmez.
              </div>

              <div className="font-inter text-[11px] leading-4 text-muted-foreground">
                {generatedAt && <p>Oluşturma: {generatedAt}</p>}
                <p>Kaynak: username bazlı User + GuestProfile; skor için SoloLeaderboardEntry total_kronox_score ve güvenli kronox_puan_total onarımı.</p>
                <p>Okunan satırlar: User {formatNumber(report?.sourceRows?.userRowsRead)}, GuestProfile {formatNumber(report?.sourceRows?.guestProfileRowsRead)}, Liderlik {formatNumber(report?.sourceRows?.soloLeaderboardRowsRead)}.</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Metric({ icon, label, value, helper }) {
  return (
    <div className="rounded-xl border border-border/30 bg-background/20 p-3">
      <div className="mb-2 flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10 text-primary [&>svg]:h-3.5 [&>svg]:w-3.5">
        {icon}
      </div>
      <p className="font-inter text-[11px] font-semibold leading-4 text-muted-foreground">{label}</p>
      <div className="mt-1 flex items-end gap-1.5">
        <p className="kronox-number text-lg font-black leading-none text-foreground">{value}</p>
        {helper && <p className="kronox-number text-[11px] font-bold leading-none text-primary">{helper}</p>}
      </div>
    </div>
  );
}

function SmallStat({ label, value }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/10 px-2.5 py-2">
      <p className="font-inter text-[10px] font-semibold leading-4 text-muted-foreground">{label}</p>
      <p className="kronox-number text-base font-black leading-none text-foreground">{formatNumber(value)}</p>
    </div>
  );
}
