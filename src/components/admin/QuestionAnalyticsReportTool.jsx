import React, { useState } from 'react';
import { BarChart3, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';

const PERIOD_OPTIONS = [
  { value: 7, label: 'Son 7 gün' },
  { value: 1, label: 'Son 1 gün' },
  { value: 30, label: 'Son 30 gün' },
];

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
      const response = await base44.functions.fetch('/sendQuestionAnalyticsReportEmail', {
        method: 'POST',
        body: JSON.stringify({ periodDays }),
      });
      if (!response.ok) throw new Error('send_failed');
      const body = await response.json().catch(() => ({}));
      if (body?.ok === false) throw new Error('send_failed');
      setMessage('Soru analiz raporu e-posta olarak gönderildi.');
    } catch (_error) {
      setMessage('');
      setError('Rapor gönderilemedi. Lütfen tekrar dene.');
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
            <select
              value={periodDays}
              disabled={loading}
              onChange={(event) => setPeriodDays(Number(event.target.value))}
              className="h-9 flex-1 rounded-xl border border-border/50 bg-background/70 px-3 font-inter text-xs font-semibold text-foreground outline-none disabled:opacity-60"
            >
              {PERIOD_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
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
