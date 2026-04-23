import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { X, Play, CheckCircle2, XCircle, Loader2, AlertTriangle } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const SCENARIOS = [
  { key: 'normal', label: 'Normal Akış', desc: '2 oyuncu sıralı hamle, hızlı bağlantı' },
  { key: 'delayed', label: 'Gecikmeli Yazma', desc: 'DB yazma yavaş, subscription erken geliyor (race condition)' },
  { key: 'concurrent', label: 'Eş Zamanlı', desc: 'İki oyuncu aynı anda hamle yapıyor' },
  { key: 'all', label: 'Tümünü Çalıştır', desc: '3 senaryoyu parallel çalıştır' },
];

export default function SimulationPanel({ onClose }) {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [activeScenario, setActiveScenario] = useState(null);

  const runScenario = async (scenario) => {
    setLoading(true);
    setActiveScenario(scenario);
    setResults(null);
    try {
      const res = await base44.functions.invoke('simulateOnlineGame', { scenario });
      setResults(res.data?.results || {});
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
        style={{ maxHeight: '80vh', paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-cinzel text-base text-primary font-semibold">Online Oyun Simülasyonları</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {SCENARIOS.map(s => (
            <button
              key={s.key}
              onClick={() => runScenario(s.key)}
              disabled={loading}
              className={`text-left p-3 rounded-xl border transition-all text-xs font-inter ${
                activeScenario === s.key
                  ? 'border-primary bg-primary/15'
                  : 'border-border/50 bg-secondary/20 hover:border-primary/40'
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <Play className="w-3 h-3 text-primary" />
                <span className="font-semibold text-foreground">{s.label}</span>
              </div>
              <p className="text-muted-foreground leading-relaxed">{s.desc}</p>
            </button>
          ))}
        </div>

        {loading && (
          <div className="flex items-center gap-2 text-sm font-inter text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Simülasyon çalışıyor...</span>
          </div>
        )}

        <AnimatePresence>
          {results && !loading && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-3"
            >
              <p className="font-inter text-xs text-muted-foreground font-semibold uppercase tracking-wider">Sonuçlar</p>
              {results.error ? (
                <div className="text-sm font-inter text-destructive p-3 bg-destructive/10 rounded-lg">
                  {results.error}
                </div>
              ) : (
                Object.entries(results).map(([key, r]) => (
                  <div key={key} className="border border-border/40 rounded-xl p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(r.status)}
                      <span className="font-inter text-sm font-semibold text-foreground">{r.scenario}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                        r.status === 'PASS' ? 'bg-emerald-500/15 text-emerald-400' :
                        r.status === 'FAIL' ? 'bg-destructive/15 text-destructive' :
                        'bg-yellow-500/15 text-yellow-400'
                      }`}>{r.status}</span>
                    </div>
                    {r.logs?.map((log, i) => (
                      <p key={i} className="font-inter text-xs text-muted-foreground pl-6 leading-relaxed">{log}</p>
                    ))}
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