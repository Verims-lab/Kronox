import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { X, Play, CheckCircle2, XCircle, Loader2, AlertTriangle } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const SCENARIOS = [
  {
    group: '2 Oyuncu',
    items: [
      { key: '2p_normal', label: 'Normal Akış', desc: 'Sıralı hamle, kart birikimi, tur geçişi' },
      { key: '2p_win', label: 'Kazanma Koşulu', desc: 'P1 10 kart topluyor → status=finished' },
      { key: '2p_delayed', label: 'Gecikmeli Yazma', desc: 'DB 1.5sn geç → race condition engeli' },
      { key: '2p_concurrent', label: 'Eş Zamanlı', desc: '2 oyuncu aynı anda yazar → last-write-wins' },
    ],
  },
  {
    group: '3 Oyuncu',
    items: [
      { key: '3p_turn_order', label: 'Tur Sırası', desc: '0→1→2→0 doğru dönüyor mu? (2 tam tur)' },
      { key: '3p_spectate', label: 'Bekleme / İzleme', desc: 'Sıra olmayan oyuncular kart ekleyemiyor' },
    ],
  },
  {
    group: '4 Oyuncu',
    items: [
      { key: '4p_full', label: 'Tam Döngü', desc: '4 oyuncu, 3 tam tur, tur sırası kontrolü' },
      { key: '4p_win', label: 'Kazanma Koşulu', desc: 'P3 kazanıyor → diğerleri winner ekranını görür' },
    ],
  },
  {
    group: 'Hepsi',
    items: [
      { key: 'all', label: 'Tümünü Çalıştır', desc: '8 senaryoyu sırayla çalıştır, özet raporla' },
    ],
  },
];

export default function SimulationPanel({ onClose }) {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState(null);
  const [results, setResults] = useState(null);
  const [activeScenario, setActiveScenario] = useState(null);

  const runScenario = async (scenario) => {
    setLoading(true);
    setActiveScenario(scenario);
    setResults(null);
    setSummary(null);
    try {
      const res = await base44.functions.invoke('simulateOnlineGame', { scenario });
      setResults(res.data?.results || {});
      setSummary(res.data?.summary || null);
    } catch (err) {
      setResults({ error: err.message });
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status) => {
    if (status === 'PASS') return <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />;
    if (status === 'FAIL') return <XCircle className="w-4 h-4 text-destructive flex-shrink-0" />;
    if (status === 'ERROR') return <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0" />;
    return null;
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="w-full max-w-lg bg-card border border-border rounded-t-2xl p-5 space-y-4 overflow-y-auto"
        onClick={e => e.stopPropagation()}
        style={{ maxHeight: '85vh', paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-cinzel text-base text-primary font-semibold">Online Oyun Simülasyonları</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {SCENARIOS.map(group => (
          <div key={group.group} className="space-y-2">
            <p className="font-inter text-[10px] text-muted-foreground font-semibold uppercase tracking-widest">
              {group.group}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {group.items.map(s => (
                <button
                  key={s.key}
                  onClick={() => runScenario(s.key)}
                  disabled={loading}
                  className={`text-left p-3 rounded-xl border transition-all text-xs font-inter ${
                    activeScenario === s.key
                      ? 'border-primary bg-primary/15'
                      : 'border-border/50 bg-secondary/20 hover:border-primary/40'
                  } disabled:opacity-50`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <Play className="w-3 h-3 text-primary flex-shrink-0" />
                    <span className="font-semibold text-foreground">{s.label}</span>
                  </div>
                  <p className="text-muted-foreground leading-relaxed">{s.desc}</p>
                </button>
              ))}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-sm font-inter text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Simülasyon çalışıyor... ({activeScenario === 'all' ? '~15sn' : '~3sn'})</span>
          </div>
        )}

        <AnimatePresence>
          {results && !loading && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-3"
            >
              {summary && (
                <div className={`flex items-center gap-3 p-3 rounded-xl border ${
                  summary.failed === 0 && summary.errors === 0
                    ? 'border-emerald-500/40 bg-emerald-500/10'
                    : 'border-destructive/40 bg-destructive/10'
                }`}>
                  {summary.failed === 0 && summary.errors === 0
                    ? <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    : <XCircle className="w-5 h-5 text-destructive" />
                  }
                  <div className="font-inter text-sm">
                    <span className="font-bold text-foreground">{summary.passed}/{summary.total}</span>
                    <span className="text-muted-foreground"> test geçti</span>
                    {summary.failed > 0 && <span className="text-destructive ml-2">({summary.failed} başarısız)</span>}
                  </div>
                </div>
              )}

              <p className="font-inter text-xs text-muted-foreground font-semibold uppercase tracking-wider">Detaylar</p>

              {results.error ? (
                <div className="text-sm font-inter text-destructive p-3 bg-destructive/10 rounded-lg">
                  {results.error}
                </div>
              ) : (
                Object.entries(results).map(([key, r]) => (
                  <div key={key} className="border border-border/40 rounded-xl p-3 space-y-1.5">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(r.status)}
                      <span className="font-inter text-xs font-semibold text-foreground">{key}</span>
                      {r.playerCount && (
                        <span className="text-[10px] text-muted-foreground bg-secondary/50 px-1.5 py-0.5 rounded-full">
                          {r.playerCount}P
                        </span>
                      )}
                      <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        r.status === 'PASS' ? 'bg-emerald-500/15 text-emerald-400' :
                        r.status === 'FAIL' ? 'bg-destructive/15 text-destructive' :
                        'bg-yellow-500/15 text-yellow-400'
                      }`}>{r.status}</span>
                    </div>
                    {r.logs?.map((log, i) => (
                      <p key={i} className="font-inter text-[11px] text-muted-foreground pl-5 leading-relaxed">{log}</p>
                    ))}
                    {r.error && (
                      <p className="font-inter text-xs text-destructive pl-5">{r.error}</p>
                    )}
                  </div>
                ))
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}