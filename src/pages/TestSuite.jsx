import React, { useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import { FlaskConical, Play, RotateCcw, ChevronDown } from 'lucide-react';
import QAHeader from '@/components/qa/QAHeader';
import MetricsBoard from '@/components/qa/MetricsBoard';
import TestResultCard from '@/components/qa/TestResultCard';
import RunningOverlay from '@/components/qa/RunningOverlay';
import EventStream from '@/components/qa/EventStream';

const SUITES = [
  { id: 'all',            label: 'Tüm Testler',      icon: '🧪', color: '#facc15' },
  { id: 'smoke',          label: 'Smoke',            icon: '💨', color: '#67e8f9' },
  { id: 'unit',           label: 'Unit',             icon: '⚙️', color: '#60a5fa' },
  { id: 'question_engine',label: 'Soru Motoru',      icon: '🎯', color: '#c084fc' },
  { id: 'functional',     label: 'Fonksiyonel',      icon: '🔧', color: '#4ade80' },
  { id: 'media',          label: 'Medya',            icon: '🖼️', color: '#f9a8d4' },
  { id: 'admin',          label: 'Admin',            icon: '🛡️', color: '#f59e0b' },
  { id: 'tutorial',       label: 'Tutorial',         icon: '📖', color: '#a78bfa' },
  { id: 'regression',     label: 'Regresyon',        icon: '🔁', color: '#fb923c' },
  { id: 'blackbox',       label: 'Black Box',        icon: '📦', color: '#818cf8' },
  { id: 'stability',      label: 'Kararlılık',       icon: '🏗️', color: '#fca5a5' },
  { id: 'performance',    label: 'Performans',       icon: '⚡', color: '#fde68a' },
  { id: 'playability',    label: 'Oynanabilirlik',   icon: '🎮', color: '#f87171' },
  { id: 'music',          label: 'Müzik',            icon: '🎵', color: '#e879f9' },
  { id: 'api',            label: 'API',              icon: '🔌', color: '#38bdf8' },
  { id: 'device',         label: 'Cihaz',            icon: '📱', color: '#2dd4bf' },
  { id: 'ab',             label: 'A/B',              icon: '🔀', color: '#fcd34d' },
];

function SuiteButton({ suite, selected, onSelect }) {
  const isSelected = selected === suite.id;
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={() => onSelect(suite.id)}
      className="flex flex-col items-center gap-1 p-2.5 rounded-xl transition-all"
      style={{
        border: `1px solid ${isSelected ? suite.color + '60' : 'rgba(255,255,255,0.08)'}`,
        background: isSelected ? `${suite.color}12` : 'rgba(255,255,255,0.03)',
        boxShadow: isSelected ? `0 0 12px ${suite.color}20` : 'none',
      }}
    >
      <span className="text-lg leading-none">{suite.icon}</span>
      <span className="font-inter text-[9px] leading-tight text-center"
        style={{ color: isSelected ? suite.color : 'rgba(255,255,255,0.4)' }}>
        {suite.label}
      </span>
    </motion.button>
  );
}

export default function TestSuite() {
  const [selectedSuite, setSelectedSuite] = useState('all');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [elapsed, setElapsed] = useState(null);
  const [progress, setProgress] = useState(0);
  const [showResults, setShowResults] = useState(true);
  const [lastRunTime, setLastRunTime] = useState(null);

  const runTests = useCallback(async () => {
    setLoading(true);
    setResults(null);
    setProgress(0);
    const t0 = Date.now();
    const estimatedMs = selectedSuite === 'all' ? 90000 : 12000;
    const intervalMs = 300;
    const steps = estimatedMs / intervalMs;
    let tick = 0;
    const timer = setInterval(() => {
      tick++;
      setProgress(Math.min(94, Math.round((tick / steps) * 100)));
    }, intervalMs);

    try {
      const res = await base44.functions.invoke('runTestSuite', { suite: selectedSuite });
      setResults(res.data);
      setLastRunTime(new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }));
      setShowResults(true);
    } catch (e) {
      setResults({ error: e.message });
    } finally {
      clearInterval(timer);
      setProgress(100);
      setElapsed(Date.now() - t0);
      setLoading(false);
    }
  }, [selectedSuite]);

  const passCount = results?.pass ?? 0;
  const failCount = results?.fail ?? 0;
  const total = results?.total ?? 0;
  const successRate = total > 0 ? Math.round((passCount / total) * 100) : 0;
  const avgDuration = results?.results
    ? Math.round(results.results.reduce((s, r) => s + (r.duration || 0), 0) / Math.max(1, results.results.length))
    : 0;
  const healthScore = results ? successRate : 88;

  // Derive live event stream from results
  const streamLogs = results?.results
    ? results.results.slice(-30).map(r =>
        `${r.status === 'PASS' ? '✅' : '❌'} [${r.duration}ms] ${r.name}`
      )
    : [];

  return (
    <div className="min-h-screen" style={{
      paddingTop: 'calc(3.5rem + env(safe-area-inset-top))',
      paddingBottom: 'calc(5rem + env(safe-area-inset-bottom))',
      background: 'radial-gradient(ellipse at top, #12063a 0%, #0a0e2e 50%, #050716 100%)',
    }}>
      <RunningOverlay
        visible={loading}
        label={SUITES.find(s => s.id === selectedSuite)?.label || selectedSuite}
        progress={progress}
        subtitle={selectedSuite === 'all' ? '130+ test senaryosu · tahmini ~120sn' : 'tahmini ~12sn'}
      />

      <div className="max-w-2xl mx-auto">
        <QAHeader
          healthScore={healthScore}
          totalTests="130+"
          lastRunTime={lastRunTime}
        />

        {/* Suite selector */}
        <div className="px-4 mb-4">
          <p className="font-inter text-[9px] uppercase tracking-widest text-white/30 mb-2 px-1">Test Paketi Seç</p>
          <div className="grid grid-cols-6 gap-1.5">
            {SUITES.slice(0, 6).map(s => (
              <SuiteButton key={s.id} suite={s} selected={selectedSuite} onSelect={setSelectedSuite} />
            ))}
          </div>
          <div className="grid grid-cols-6 gap-1.5 mt-1.5">
            {SUITES.slice(6, 12).map(s => (
              <SuiteButton key={s.id} suite={s} selected={selectedSuite} onSelect={setSelectedSuite} />
            ))}
          </div>
          <div className="grid grid-cols-5 gap-1.5 mt-1.5">
            {SUITES.slice(12).map(s => (
              <SuiteButton key={s.id} suite={s} selected={selectedSuite} onSelect={setSelectedSuite} />
            ))}
          </div>
        </div>

        {/* Run button */}
        <div className="px-4 mb-4">
          <motion.button
            onClick={runTests}
            disabled={loading}
            whileTap={{ scale: 0.98 }}
            animate={!loading ? {
              boxShadow: ['0 0 16px rgba(250,204,21,0.3)', '0 0 28px rgba(250,204,21,0.5)', '0 0 16px rgba(250,204,21,0.3)'],
            } : {}}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            className="w-full h-12 rounded-2xl font-cinzel text-base tracking-widest flex items-center justify-center gap-2 transition-all"
            style={{
              background: loading ? 'rgba(255,255,255,0.06)' : 'linear-gradient(135deg, #f59e0b, #facc15)',
              color: loading ? 'rgba(255,255,255,0.3)' : '#0a0f23',
              border: loading ? '1px solid rgba(255,255,255,0.1)' : 'none',
            }}
          >
            {loading ? (
              <>
                <FlaskConical className="w-4 h-4 animate-pulse" />
                ÇALIŞIYOR...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                TESTLERI ÇALIŞTIR
              </>
            )}
          </motion.button>
        </div>

        {/* Metrics */}
        <div className="px-4 mb-4">
          <MetricsBoard metrics={{ passCount, failCount, total, avgDuration, successRate, lastSuite: selectedSuite }} />
        </div>

        {/* Event stream */}
        {streamLogs.length > 0 && (
          <div className="px-4 mb-4">
            <EventStream logs={streamLogs} title="TEST ÇIKTISI" maxHeight={160} />
          </div>
        )}

        {/* Warning count */}
        {results?.results && (
          <div className="px-5 mb-1 flex items-center gap-3 flex-wrap">
            {elapsed && (
              <span className="font-inter text-[10px] text-white/25">
                Toplam süre: {(elapsed / 1000).toFixed(1)}s · {total} test
              </span>
            )}
            {results.results.filter(r => r.status === 'WARNING').length > 0 && (
              <span className="font-inter text-[10px] text-yellow-400/70">
                ⚠️ {results.results.filter(r => r.status === 'WARNING').length} uyarı
              </span>
            )}
            {results.results.filter(r => r.status === 'SKIPPED' || (r.detail && r.detail.includes('SKIPPED'))).length > 0 && (
              <span className="font-inter text-[10px] text-white/30">
                ⏭ bazı testler atlandı
              </span>
            )}
          </div>
        )}

        {/* Error */}
        {results?.error && (
          <div className="px-4 mb-4">
            <div className="p-4 rounded-2xl font-mono text-xs text-red-400"
              style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)' }}>
              ❌ {results.error}
            </div>
          </div>
        )}

        {/* Results list */}
        {results?.results && (
          <div className="px-4 space-y-3">
            <button
              onClick={() => setShowResults(v => !v)}
              className="w-full flex items-center justify-between px-1"
            >
              <p className="font-inter text-[9px] uppercase tracking-widest text-white/30">
                Test Sonuçları ({results.results.length})
              </p>
              <ChevronDown className={`w-3.5 h-3.5 text-white/30 transition-transform ${showResults ? '' : '-rotate-90'}`} />
            </button>

            <AnimatePresence>
              {showResults && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-1.5"
                >
                  {/* Failures first */}
                  {results.results.filter(r => r.status !== 'PASS').map((r, i) => (
                    <TestResultCard key={`fail-${i}`} r={r} index={i} />
                  ))}
                  {results.results.filter(r => r.status === 'PASS').map((r, i) => (
                    <TestResultCard key={`pass-${i}`} r={r} index={i + results.results.filter(x => x.status !== 'PASS').length} />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}