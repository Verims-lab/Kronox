import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, Loader2, FlaskConical, ChevronDown, ChevronRight, Clock } from 'lucide-react';

const SUITES = [
  { id: 'all',         label: 'Tüm Testler',          icon: '🧪', color: 'text-primary border-primary bg-primary/10' },
  { id: 'unit',        label: 'Unit',                  icon: '⚙️',  color: 'text-blue-400 border-blue-400/50 bg-blue-400/10' },
  { id: 'blackbox',    label: 'Black Box',             icon: '📦',  color: 'text-violet-400 border-violet-400/50 bg-violet-400/10' },
  { id: 'functional',  label: 'Fonksiyonel',           icon: '🔧',  color: 'text-emerald-400 border-emerald-400/50 bg-emerald-400/10' },
  { id: 'performance', label: 'Performans',            icon: '⚡',  color: 'text-yellow-400 border-yellow-400/50 bg-yellow-400/10' },
  { id: 'playability', label: 'Oynanabilirlik',        icon: '🎮',  color: 'text-rose-400 border-rose-400/50 bg-rose-400/10' },
  { id: 'music',       label: 'Müzik',                 icon: '🎵',  color: 'text-pink-400 border-pink-400/50 bg-pink-400/10' },
  { id: 'ui',          label: 'UI/Ön Yüz',             icon: '🖥️',  color: 'text-cyan-400 border-cyan-400/50 bg-cyan-400/10' },
  { id: 'e2e',         label: 'Uçtan Uca (E2E)',       icon: '🔁',  color: 'text-orange-400 border-orange-400/50 bg-orange-400/10' },
  { id: 'api',         label: 'API',                   icon: '🔌',  color: 'text-indigo-400 border-indigo-400/50 bg-indigo-400/10' },
  { id: 'stability',   label: 'Kararlılık',            icon: '🛡️',  color: 'text-red-400 border-red-400/50 bg-red-400/10' },
  { id: 'device',      label: 'Cihaz Çeşitliliği',    icon: '📱',  color: 'text-teal-400 border-teal-400/50 bg-teal-400/10' },
  { id: 'ab',          label: 'A/B Testleri',          icon: '🔀',  color: 'text-amber-400 border-amber-400/50 bg-amber-400/10' },
];

function ResultRow({ r }) {
  const [open, setOpen] = useState(false);
  const isPass = r.status === 'PASS';

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="border border-border/30 rounded-xl overflow-hidden"
    >
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${isPass ? 'hover:bg-emerald-500/5' : 'hover:bg-red-500/5'}`}
      >
        {isPass
          ? <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          : <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />}
        <span className="flex-1 font-inter text-sm text-foreground">{r.name}</span>
        <span className="font-inter text-xs text-muted-foreground mr-2">{r.duration}ms</span>
        {(r.error || r.detail) && (
          open ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
        )}
      </button>
      <AnimatePresence>
        {open && (r.error || r.detail) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className={`px-4 py-2 border-t border-border/20 font-mono text-xs ${isPass ? 'text-emerald-400/80 bg-emerald-500/5' : 'text-red-400/80 bg-red-500/5'}`}
          >
            {r.error || r.detail}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function TestSuite() {
  const [selectedSuite, setSelectedSuite] = useState('all');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [elapsed, setElapsed] = useState(null);

  const runTests = async () => {
    setLoading(true);
    setResults(null);
    const t0 = Date.now();
    try {
      const res = await base44.functions.invoke('runTestSuite', { suite: selectedSuite });
      setResults(res.data);
    } catch (e) {
      setResults({ error: e.message });
    } finally {
      setElapsed(Date.now() - t0);
      setLoading(false);
    }
  };

  const passCount = results?.pass ?? 0;
  const failCount = results?.fail ?? 0;
  const total = results?.total ?? 0;
  const successRate = total > 0 ? Math.round((passCount / total) * 100) : 0;

  return (
    <div
      className="min-h-screen bg-background"
      style={{
        paddingTop: 'calc(4rem + env(safe-area-inset-top))',
        paddingBottom: 'calc(4rem + env(safe-area-inset-bottom))',
      }}
    >
      <div className="max-w-2xl mx-auto px-4 space-y-6 pb-8">

        {/* Header */}
        <div className="flex items-center gap-3 pt-2">
          <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center">
            <FlaskConical className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="font-cinzel text-xl text-primary tracking-wider">TEST SUITE</h1>
            <p className="font-inter text-xs text-muted-foreground">Kronos — 12 suite · 91 test senaryosu</p>
          </div>
        </div>

        {/* Suite seçimi */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {SUITES.map(s => (
            <button
              key={s.id}
              onClick={() => setSelectedSuite(s.id)}
              className={`flex items-center gap-2 px-3 py-3 rounded-xl border-2 font-inter text-sm font-medium transition-all text-left ${
                selectedSuite === s.id ? s.color : 'border-border/40 bg-secondary/20 text-muted-foreground hover:border-border/70'
              }`}
            >
              <span className="text-base">{s.icon}</span>
              <span>{s.label}</span>
            </button>
          ))}
        </div>

        {/* Çalıştır butonu */}
        <Button
          onClick={runTests}
          disabled={loading}
          size="lg"
          className="w-full h-12 bg-primary text-primary-foreground font-cinzel tracking-wider gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Testler çalışıyor...
            </>
          ) : (
            <>
              <FlaskConical className="w-4 h-4" />
              TESTLERI ÇALIŞTIR
            </>
          )}
        </Button>

        {/* Özet */}
        {results && !results.error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-4 gap-3"
          >
            {[
              { label: 'Toplam', value: total, color: 'text-foreground' },
              { label: 'Başarılı', value: passCount, color: 'text-emerald-400' },
              { label: 'Başarısız', value: failCount, color: 'text-red-400' },
              { label: 'Başarı', value: `${successRate}%`, color: successRate === 100 ? 'text-emerald-400' : successRate >= 80 ? 'text-yellow-400' : 'text-red-400' },
            ].map(stat => (
              <div key={stat.label} className="flex flex-col items-center justify-center p-3 rounded-xl border border-border/30 bg-secondary/20">
                <span className={`font-cinzel text-2xl font-bold ${stat.color}`}>{stat.value}</span>
                <span className="font-inter text-[10px] text-muted-foreground mt-1">{stat.label}</span>
              </div>
            ))}
          </motion.div>
        )}

        {/* Süre */}
        {elapsed && results && (
          <div className="flex items-center gap-1.5 text-xs font-inter text-muted-foreground">
            <Clock className="w-3.5 h-3.5" />
            Toplam süre: {(elapsed / 1000).toFixed(1)}s
          </div>
        )}

        {/* Hata */}
        {results?.error && (
          <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 font-inter text-sm text-red-400">
            Hata: {results.error}
          </div>
        )}

        {/* Sonuçlar */}
        {results?.results && (
          <div className="space-y-2">
            <p className="font-inter text-xs text-muted-foreground font-semibold uppercase tracking-widest px-1">Sonuçlar</p>
            {results.results.map((r, i) => (
              <ResultRow key={i} r={r} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}