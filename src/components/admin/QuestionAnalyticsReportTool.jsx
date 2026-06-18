import React, { useState } from 'react';
import { BarChart3, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import KronoxSelectSheet from '@/components/mobile/KronoxSelectSheet';

const PERIOD_OPTIONS = [
  { value: 7, label: 'Son 7 gün' },
  { value: 1, label: 'Son 1 gün' },
  { value: 30, label: 'Son 30 gün' },
];

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
  if (code === 'email_failed') return `E-posta gönderimi başarısız oldu${body?.safeErrorReason ? `: ${body.safeErrorReason}` : '.'}`;
  if (code === 'recipient_override_not_allowed') return 'Rapor yalnızca isteği yapan aktif adminin e-posta adresine gönderilebilir.';
  if (code === 'report_body_validation_failed') return 'Rapor gövdesi doğrulanamadı; backend template/deploy kontrol edilmeli.';
  if (code) return `${fallback} (${code})`;
  return fallback;
}

function missingFunctionMessage(name) {
  return `${name} fonksiyonu bulunamadı veya deploy edilmemiş. Function name/path kontrol edilmeli.`;
}

function isNotFoundError(error) {
  const status = Number(error?.status || error?.response?.status || error?.statusCode);
  const message = String(error?.message || '').toLowerCase();
  return status === 404 || message.includes('status code 404') || message.includes('not found');
}

async function callAdminFunction(name, payload) {
  try {
    const response = await base44.functions.invoke(name, payload);
    const body = unwrapFunctionResponse(response);
    if (body?.ok === false) throw new Error(errorMessageFromBody(body, 'İşlem başarısız oldu.'));
    return body;
  } catch (invokeError) {
    try {
      const response = await base44.functions.fetch(`/${name}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => ({}));
      if (response.status === 404) throw new Error(missingFunctionMessage(name));
      if (response.status === 403) throw new Error('Admin yetkisi gerekli.');
      if (response.status === 401) throw new Error('Oturum doğrulaması gerekli.');
      if (!response.ok || body?.ok === false) {
        throw new Error(errorMessageFromBody(body, invokeError?.message || 'İşlem başarısız oldu.'));
      }
      return body;
    } catch (fetchError) {
      if (isNotFoundError(fetchError) || isNotFoundError(invokeError)) {
        throw new Error(missingFunctionMessage(name));
      }
      throw fetchError;
    }
  }
}

export default function QuestionAnalyticsReportTool() {
  const [periodDays, setPeriodDays] = useState(7);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const sendReport = async () => {
    if (loading) return;
    setLoading(true);
    setMessage('Rapor hazırlanıyor...');
    setError('');
    try {
      const result = await callAdminFunction('sendQuestionAnalyticsReportEmail', { periodDays });
      const recipient = result?.recipientEmail ? ` ${result.recipientEmail} adresine` : '';
      const template = result?.templateVersion ? ` Şablon: ${result.templateVersion}.` : '';
      const dispatch = result?.emailDispatchStatus ? ` Gönderim: ${result.emailDispatchStatus}.` : '';
      setMessage(`Soru analiz raporu${recipient} gönderildi.${template}${dispatch}`);
    } catch (err) {
      setMessage('');
      setError(err?.message || 'Rapor gönderilemedi. Lütfen tekrar dene.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border/40 bg-secondary/20 p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <BarChart3 className="h-4 w-4" />}
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <p className="font-inter text-sm font-semibold text-foreground">Soru Analiz Raporu Gönder</p>
            <p className="font-inter text-xs text-muted-foreground">Admin e-postana soru gösterim/başarı özetini gönderir.</p>
          </div>
          <div className="flex items-center gap-2">
            <KronoxSelectSheet
              label="Rapor dönemi"
              value={periodDays}
              disabled={loading}
              onChange={(nextValue) => setPeriodDays(Number(nextValue))}
              options={PERIOD_OPTIONS}
              sheetTitle="Rapor Dönemi"
              className="min-h-9 flex-1 text-xs"
            />
            <Button
              type="button"
              size="sm"
              disabled={loading}
              onClick={sendReport}
              className="shrink-0 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Gönder'}
            </Button>
          </div>
          <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-3">
            <p className="mb-2 font-inter text-xs font-semibold text-amber-100">Soru Analitik Verilerini Sıfırla</p>
            <p className="font-inter text-xs leading-5 text-amber-100/85">
              Bu işlem şu anda manuel DB temizliği ile yapılır. Function reset yolu devre dışı.
              Soru gösterim/cevap/zaman geçmişinin aktif kaynağı QuestionAttemptEvent tablosudur; mevcut 9 bölümlü rapor ham olaylardan hesaplanır.
              Manuel reset için QuestionAttemptEvent, PlayerQuestionDailyExposure, QuestionStatsProjection ve CategoryStatsProjection temizlenir.
              QuestionStatsProjection ve CategoryStatsProjection manuel aggregateQuestionStats refresh ile oluşan opsiyonel özet tablolardır; boş olmaları normal olabilir.
              Oyuncu bazlı soru tekrar hafızasını da sıfırlamak istersen PlayerQuestionExposure ayrıca temizlenir; bu tablo silinirse sistemin aynı oyuncuya aynı soruyu tekrar göstermeme hafızası da sıfırlanır.
              Soru havuzu, Category, User/GuestProfile/PlayerProfile, UserCategoryPreference, UserJokerInventory, JokerTransaction, DiamondTransaction, Daily Wheel/Daily Quest, leaderboard/skor/seviye ilerleme ve ekonomi kayıtları silinmez.
              Not: Joker Kullanımı Analizi ledger verisinden besleniyorsa bu resetten etkilenmez; Oynanma Zamanı metrikleri QuestionAttemptEvent temizliğiyle sıfırlanır.
            </p>
          </div>
          {message && (
            <p className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 font-inter text-xs font-semibold text-emerald-100">
              {message}
            </p>
          )}
          {error && (
            <p className="rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 font-inter text-xs font-semibold text-red-100">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
