import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Play, Zap, Users, Layers, Settings, Shield, Activity, ChevronRight, CheckCircle2, XCircle, AlertCircle, Clock } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import EventStream from '@/components/qa/EventStream';

// ─── Scenario groups (unchanged) ────────────────────────────────────────────
const SCENARIO_GROUPS = [
  {
    id: 'multiplayer',
    label: '2P / 3P / 4P',
    icon: <Users className="w-3.5 h-3.5" />,
    color: '#60a5fa',
    items: [
      { key: '2p_normal',          label: 'Normal Akış',          desc: 'Sıralı hamle, kart birikimi, tur geçişi' },
      { key: '2p_win',             label: 'Kazanma (P1)',         desc: 'P1 10 kart topluyor → finished' },
      { key: '2p_rival_win',       label: 'Rakip Kazanır',        desc: 'P1=9, P2=8 → P1 son kartla bitirir' },
      { key: '2p_turn_visibility', label: 'Tur Görünürlüğü',      desc: 'P1 yazar → P2 sırasını DB\'den alıyor mu?' },
      { key: '2p_delayed',         label: 'Gecikmeli Yazma',      desc: 'DB 1.5sn geç → kart ve index korunuyor mu?' },
      { key: '2p_concurrent',      label: 'Eş Zamanlı',           desc: '2 oyuncu aynı anda yazar → last-write-wins' },
      { key: '3p_turn_order',      label: '3P Tur Sırası',        desc: '0→1→2→0 doğru dönüyor mu? (2 tam tur)' },
      { key: '3p_spectate',        label: '3P İzleme',            desc: 'Sıra olmayan oyuncular kart ekleyemiyor' },
      { key: 'player_leave',       label: 'Oyuncu Ayrılır',       desc: 'P3 çıkar → kalan 2 oyuncu, index korunur' },
      { key: 'host_leave',         label: 'Host Ayrılır',         desc: 'Host çıkar → lobi silinir' },
      { key: '4p_full',            label: '4P Tam Döngü',         desc: '4 oyuncu, 3 tam tur, tur sırası kontrolü' },
      { key: '4p_win',             label: '4P Kazanma',           desc: 'P3 kazanıyor → diğerleri winner ekranını görür' },
    ],
  },
  {
    id: 'placement',
    label: 'Kart Yerleşim',
    icon: <Layers className="w-3.5 h-3.5" />,
    color: '#4ade80',
    items: [
      { key: 'placement_boundary',        label: 'Sınır Koşulları',   desc: 'Zone 0/N/orta, eşit yıl kenar değeri' },
      { key: 'placement_empty_timeline',  label: 'Boş Timeline',      desc: '0 kartlı oyuncuya her yıl yerleştirilebilir' },
      { key: 'placement_all_zones',       label: 'Tüm Zone Mantığı',  desc: '4 kartlı timeline üzerinde zone 0-4 kombinasyonları' },
      { key: 'card_sort_accuracy',        label: 'Kart Sıralama',     desc: 'Yıllara göre sort ve eşit yıl kararlı sıralama' },
    ],
  },
  {
    id: 'settings',
    label: 'Oyun Ayarları',
    icon: <Settings className="w-3.5 h-3.5" />,
    color: '#a78bfa',
    items: [
      { key: 'win_thresholds',         label: 'Kazanma Eşiği',     desc: '5/7/10/15 kart eşiğinde winner doğru yazılır' },
      { key: 'turn_duration_variants', label: 'Tur Süresi',        desc: '0(süresiz)/10/30/60/120sn kaydedilir' },
      { key: 'category_filter',        label: 'Kategori Filtresi', desc: 'Tüm kategoriler DB\'ye doğru yazılır' },
      { key: 'year_range',             label: 'Yıl Aralığı',       desc: 'Dar/geniş/antik aralıklar doğru kaydedilir' },
      { key: 'category_year_combo',    label: 'Kategori × Yıl',   desc: 'Kombinasyon ayarları tutarlı kaydedilir' },
      { key: 'player_count_limits',    label: 'Oyuncu Limiti',     desc: '1-4 arası her oyuncu sayısı lobi oluşturabilir' },
    ],
  },
  {
    id: 'data',
    label: 'Veri & Soru',
    icon: <Activity className="w-3.5 h-3.5" />,
    color: '#facc15',
    items: [
      { key: 'lobby_state_transitions',    label: 'Durum Geçişleri',      desc: 'waiting→starting→in_game→finished' },
      { key: 'pool_exhausted',             label: 'Soru Tükenmesi',       desc: '200 ID kullanıldığında DB tutarlı kalır' },
      { key: 'dedup_questions',            label: 'Soru Dedup',           desc: 'Aynı soru ID iki kez girilmez' },
      { key: 'player_name_edge',           label: 'İsim Kenar Değerler',  desc: 'Türkçe, XSS, uzun, tek karakter isimler' },
      { key: 'lobby_chat',                 label: 'Lobi Sohbet',          desc: 'Chat/system mesajları oluşturulur ve okunur' },
      { key: 'game_restart',               label: 'Oyun Yeniden Başlat',  desc: 'Finished → waiting, kartlar sıfırlanır' },
      { key: 'lobby_code_uniqueness',      label: 'Lobi Kod Benzersizliği', desc: '10 lobi oluştur, kod çakışması kontrol et' },
      { key: 'single_player_offline',      label: 'Offline Soru Havuzu',  desc: 'Kategorilere göre min 10 metin soru kontrolü' },
      { key: 'question_type_distribution', label: 'Tip Dağılımı',         desc: 'Metin/görsel/ses soru sayıları ve oranları' },
      { key: 'question_year_coverage',     label: 'Yıl Kapsamı',          desc: 'Tüm yıl aralıklarında soru dağılımı' },
      { key: 'offline_game_init',          label: 'Offline Başlatma',     desc: 'Fisher-Yates shuffle, kart dağıtımı, tekrar yok' },
    ],
  },
  {
    id: 'perf',
    label: 'Performans',
    icon: <Zap className="w-3.5 h-3.5" />,
    color: '#f87171',
    items: [
      { key: 'perf_question_filter', label: 'Soru Filtreleme',   desc: '200 soru fetch → filtre → Set lookup ms ölçümü' },
      { key: 'perf_db_throughput',   label: 'DB Yazma Hızı',     desc: '10 ardışık update, ortalama ms/yazma ölçümü' },
      { key: 'subscription_cleanup', label: 'Sub Temizliği',     desc: '5 ardışık update → unsubscribe pattern doğrulaması' },
      { key: 'multi_lobby_isolation',label: 'Çoklu Lobi',        desc: '2 paralel lobi birbirini etkilemiyor mu?' },
      { key: 'win_timer_race',       label: 'Win + Timer Race',  desc: 'Kazanma + timer dolması aynı anda → state tutarlı' },
    ],
  },
];

const ALL_RUNNABLE_KEYS = SCENARIO_GROUPS.flatMap(g => g.items.map(i => i.key));

function getEstimatedMs(key) {
  if (['2p_delayed', 'perf_db_throughput', 'player_count_limits', 'lobby_code_uniqueness',
       'win_thresholds', 'turn_duration_variants', 'category_filter', 'year_range', 'player_name_edge'].includes(key)) return 8000;
  return 3500;
}

// ─── Result row ──────────────────────────────────────────────────────────────
function ResultRow({ scenarioKey, result, label }) {
  const isPass  = result.status === 'PASS';
  const isFail  = result.status === 'FAIL';
  const isWarn  = result.status === 'WARNING';
  const color   = isPass ? '#4ade80' : isFail ? '#f87171' : isWarn ? '#facc15' : '#a78bfa';
  const Icon    = isPass ? CheckCircle2 : isFail ? XCircle : isWarn ? AlertCircle : Clock;
  const prefix  = isPass ? '✅' : isFail ? '❌' : isWarn ? '⚠️' : '⚡';
  const durationText = result.duration_ms ? ` — ${result.duration_ms}ms` : '';

  return (
    <div className="flex items-start gap-2.5 py-1.5 px-2.5 rounded-lg"
      style={{ background: `${color}0c`, border: `1px solid ${color}22` }}>
      <Icon className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-inter text-[11px] font-semibold text-white/80 truncate">{label || scenarioKey}</span>
          <span className="font-bangers text-[10px] tracking-wide" style={{ color }}>{result.status}{durationText}</span>
        </div>
        {result.error && (
          <p className="font-inter text-[10px] text-white/35 mt-0.5 leading-snug break-words">{result.error}</p>
        )}
      </div>
    </div>
  );
}

// ─── Scenario card ───────────────────────────────────────────────────────────
function ScenarioCard({ item, groupColor, isActive, loading, result, onRun }) {
  const statusColor = result?.status === 'PASS' ? '#4ade80' : result?.status === 'FAIL' ? '#f87171' : result?.status === 'ERROR' ? '#facc15' : null;

  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      onClick={() => !loading && onRun(item.key)}
      disabled={loading}
      className="text-left w-full p-3.5 rounded-2xl transition-all relative overflow-hidden"
      style={{
        border: `1px solid ${isActive ? groupColor + '60' : statusColor ? statusColor + '30' : 'rgba(255,255,255,0.08)'}`,
        background: isActive ? `${groupColor}12` : statusColor ? `${statusColor}09` : 'rgba(255,255,255,0.03)',
        opacity: loading && !isActive ? 0.45 : 1,
        boxShadow: isActive ? `0 0 16px ${groupColor}25` : 'none',
      }}
    >
      {statusColor && (
        <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl"
          style={{ background: statusColor, opacity: 0.7 }} />
      )}
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-2">
          {isActive && loading
            ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
                className="w-3 h-3 rounded-full border-2 border-t-transparent flex-shrink-0"
                style={{ borderColor: groupColor }} />
            : <Play className="w-3 h-3 flex-shrink-0" style={{ color: groupColor }} />
          }
          <span className="font-inter text-xs font-semibold text-white/85 leading-tight">{item.label}</span>
        </div>
        {statusColor && (
          <span className="font-bangers text-[10px] tracking-wide flex-shrink-0" style={{ color: statusColor }}>
            {result.status}
          </span>
        )}
      </div>
      <p className="font-inter text-[10px] text-white/30 leading-relaxed pl-5">{item.desc}</p>
    </motion.button>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────
export default function SimulationPanel({ onClose }) {
  const [loading, setLoading]             = useState(false);
  const [activeScenario, setActiveScenario] = useState(null);
  const [results, setResults]             = useState({});
  const [progress, setProgress]           = useState(0);
  const [runAllProgress, setRunAllProgress] = useState(null); // { done, total } | null
  const [streamLogs, setStreamLogs]       = useState([]);
  const [activeGroup, setActiveGroup]     = useState('multiplayer');
  const progressTimerRef = useRef(null);
  const runAllAbortRef   = useRef(false);

  const addLog = (msg) => setStreamLogs(prev => [...prev.slice(-120), msg]);

  const currentGroup = SCENARIO_GROUPS.find(g => g.id === activeGroup);
  const passCount    = Object.values(results).filter(r => r.status === 'PASS').length;
  const failCount    = Object.values(results).filter(r => r.status === 'FAIL').length;
  const totalRun     = Object.keys(results).length;

  // ── Run single scenario ─────────────────────────────────────────────────
  const runScenario = async (scenarioKey) => {
    if (loading) return;
    setLoading(true);
    setActiveScenario(scenarioKey);
    setProgress(0);

    const item = SCENARIO_GROUPS.flatMap(g => g.items).find(i => i.key === scenarioKey);
    addLog(`⚡ Başlatıldı: ${item?.label || scenarioKey}`);

    const estimatedMs = getEstimatedMs(scenarioKey);
    let tick = 0;
    const steps = estimatedMs / 250;
    clearInterval(progressTimerRef.current);
    progressTimerRef.current = setInterval(() => {
      tick++;
      setProgress(Math.min(94, Math.round((tick / steps) * 100)));
    }, 250);

    try {
      const res = await base44.functions.invoke('simulateOnlineGame', { scenario: scenarioKey });
      const newResults = res.data?.results || {};
      setResults(prev => ({ ...prev, ...newResults }));
      for (const [k, r] of Object.entries(newResults)) {
        (r.logs || []).forEach(l => addLog(l));
        addLog(`${r.status === 'PASS' ? '✅' : '❌'} ${k}: ${r.status}`);
      }
    } catch (err) {
      setResults(prev => ({ ...prev, [scenarioKey]: { status: 'ERROR', error: err.message } }));
      addLog(`❌ Hata: ${err.message}`);
    } finally {
      clearInterval(progressTimerRef.current);
      setProgress(100);
      setLoading(false);
      setActiveScenario(null);
    }
  };

  // ── Run all in current tab ──────────────────────────────────────────────
  const runAllInGroup = async () => {
    if (loading) return;
    const keys = currentGroup?.items.map(i => i.key) || [];
    if (!keys.length) return;

    runAllAbortRef.current = false;
    setLoading(true);
    setRunAllProgress({ done: 0, total: keys.length });
    addLog(`⚡ Tümü başlatıldı: ${currentGroup.label} (${keys.length} senaryo)`);

    for (let i = 0; i < keys.length; i++) {
      if (runAllAbortRef.current) break;
      const key = keys[i];
      const item = currentGroup.items.find(x => x.key === key);
      setActiveScenario(key);
      setRunAllProgress({ done: i, total: keys.length });
      addLog(`▶ [${i + 1}/${keys.length}] ${item?.label || key}`);

      try {
        const res = await base44.functions.invoke('simulateOnlineGame', { scenario: key });
        const newResults = res.data?.results || {};
        setResults(prev => ({ ...prev, ...newResults }));
        for (const [k, r] of Object.entries(newResults)) {
          addLog(`${r.status === 'PASS' ? '✅' : '❌'} ${k}: ${r.status}`);
        }
      } catch (err) {
        setResults(prev => ({ ...prev, [key]: { status: 'ERROR', error: err.message } }));
        addLog(`❌ ${key}: ${err.message}`);
      }
    }

    setLoading(false);
    setActiveScenario(null);
    setRunAllProgress(null);
    addLog(`🏁 Tamamlandı: ${currentGroup?.label}`);
  };

  useEffect(() => () => {
    clearInterval(progressTimerRef.current);
    runAllAbortRef.current = true;
  }, []);

  const groupResults = currentGroup
    ? Object.entries(results).filter(([k]) => currentGroup.items.some(i => i.key === k))
    : [];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(5,7,22,0.88)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.92, opacity: 0, y: 12 }}
        transition={{ type: 'spring', stiffness: 340, damping: 30 }}
        className="w-full flex flex-col rounded-3xl overflow-hidden"
        style={{
          maxWidth: 960,
          maxHeight: '90vh',
          width: 'calc(100vw - 32px)',
          background: 'linear-gradient(160deg, #0f1428 0%, #0a0f23 100%)',
          border: '1px solid rgba(250,204,21,0.18)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.7), 0 0 60px rgba(250,204,21,0.06)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex-shrink-0 px-5 pt-5 pb-3"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-cinzel text-base text-primary tracking-widest font-bold">ONLINE SİMÜLASYON</h2>
              <p className="font-inter text-[10px] text-white/35 mt-0.5">
                {totalRun > 0
                  ? <span>
                      <span className="text-emerald-400 font-semibold">{passCount} geçti</span>
                      {' · '}
                      <span className="text-red-400 font-semibold">{failCount} başarısız</span>
                      {' · '}
                      {totalRun} çalıştırıldı
                    </span>
                  : 'Senaryo seçin ve çalıştırın'}
              </p>
            </div>
            <motion.button
              whileTap={{ scale: 0.88 }}
              onClick={onClose}
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              <X className="w-4 h-4 text-white/50" />
            </motion.button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1.5 mt-3 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
            {SCENARIO_GROUPS.map(g => {
              const gPassed = g.items.filter(i => results[i.key]?.status === 'PASS').length;
              const gTotal  = g.items.filter(i => results[i.key]).length;
              return (
                <motion.button
                  key={g.id}
                  whileTap={{ scale: 0.94 }}
                  onClick={() => setActiveGroup(g.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl whitespace-nowrap flex-shrink-0 transition-all"
                  style={{
                    background: activeGroup === g.id ? `${g.color}18` : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${activeGroup === g.id ? g.color + '45' : 'rgba(255,255,255,0.07)'}`,
                    color: activeGroup === g.id ? g.color : 'rgba(255,255,255,0.35)',
                  }}
                >
                  <span style={{ color: activeGroup === g.id ? g.color : 'rgba(255,255,255,0.3)' }}>{g.icon}</span>
                  <span className="font-inter text-[10px] font-semibold">{g.label}</span>
                  {gTotal > 0 && (
                    <span className="font-cinzel text-[8px] px-1 py-0.5 rounded-full"
                      style={{ background: gPassed === gTotal ? '#4ade8020' : '#f8717120', color: gPassed === gTotal ? '#4ade80' : '#f87171' }}>
                      {gPassed}/{gTotal}
                    </span>
                  )}
                </motion.button>
              );
            })}
          </div>

          {/* Run All bar */}
          <div className="flex items-center gap-3 mt-3">
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={runAllInGroup}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl font-inter text-xs font-bold transition-all"
              style={{
                background: loading ? 'rgba(250,204,21,0.07)' : 'rgba(250,204,21,0.14)',
                border: `1px solid ${loading ? 'rgba(250,204,21,0.2)' : 'rgba(250,204,21,0.45)'}`,
                color: loading ? 'rgba(250,204,21,0.4)' : '#facc15',
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading && runAllProgress
                ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                    className="w-3 h-3 rounded-full border-2 border-t-transparent border-yellow-400" />
                : <Zap className="w-3 h-3" />
              }
              {loading && runAllProgress
                ? `Çalışıyor ${runAllProgress.done + 1} / ${runAllProgress.total}`
                : `Tümünü Çalıştır (${currentGroup?.items.length})`
              }
            </motion.button>

            {/* Progress bar for run-all */}
            {loading && runAllProgress && (
              <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: 'linear-gradient(to right, #f59e0b, #facc15)' }}
                  animate={{ width: `${Math.round((runAllProgress.done / runAllProgress.total) * 100)}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            )}
          </div>
        </div>

        {/* ── Scrollable body ─────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto min-h-0 p-5 space-y-4"
          style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>

          {/* Scenario grid */}
          <div className={`grid gap-2.5 ${(currentGroup?.items.length ?? 0) > 4 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
            {currentGroup?.items.map(item => (
              <ScenarioCard
                key={item.key}
                item={item}
                groupColor={currentGroup.color}
                isActive={activeScenario === item.key && loading}
                loading={loading}
                result={results[item.key]}
                onRun={runScenario}
              />
            ))}
          </div>

          {/* ── Results panel ──────────────────────────────────────────────── */}
          {groupResults.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary/60" />
                <p className="font-inter text-[10px] uppercase tracking-widest text-white/30">Senaryo Sonuçları</p>
              </div>
              <div className="space-y-1.5">
                {groupResults.map(([key, result]) => {
                  const label = currentGroup?.items.find(i => i.key === key)?.label;
                  return <ResultRow key={key} scenarioKey={key} result={result} label={label} />;
                })}
              </div>
            </div>
          )}

          {/* ── Live event stream ──────────────────────────────────────────── */}
          {streamLogs.length > 0 && (
            <EventStream logs={streamLogs} title="CANLI LOG AKIŞI" maxHeight={180} />
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}