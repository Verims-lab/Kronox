import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Play, Zap, Users, Layers, Settings, Shield, Activity } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import EventStream from '@/components/qa/EventStream';
import SimulationResultCard from '@/components/qa/SimulationResultCard';
import RunningOverlay from '@/components/qa/RunningOverlay';

// ─── Scenario groups ────────────────────────────────────────────────────────
const SCENARIO_GROUPS = [
  {
    id: 'multiplayer',
    label: '2P / 3P / 4P',
    icon: <Users className="w-3.5 h-3.5" />,
    color: '#60a5fa',
    items: [
      { key: '2p_normal',         label: 'Normal Akış',       desc: 'Sıralı hamle, kart birikimi, tur geçişi' },
      { key: '2p_win',            label: 'Kazanma (P1)',      desc: 'P1 10 kart topluyor → finished' },
      { key: '2p_rival_win',      label: 'Rakip Kazanır',     desc: 'P1=9, P2=8 → P1 son kartla bitirir' },
      { key: '2p_turn_visibility',label: 'Tur Görünürlüğü',   desc: 'P1 yazar → P2 sırasını DB\'den alıyor mu?' },
      { key: '2p_delayed',        label: 'Gecikmeli Yazma',   desc: 'DB 1.5sn geç → kart ve index korunuyor mu?' },
      { key: '2p_concurrent',     label: 'Eş Zamanlı',        desc: '2 oyuncu aynı anda yazar → last-write-wins' },
      { key: '3p_turn_order',     label: '3P Tur Sırası',     desc: '0→1→2→0 doğru dönüyor mu? (2 tam tur)' },
      { key: '3p_spectate',       label: '3P İzleme',         desc: 'Sıra olmayan oyuncular kart ekleyemiyor' },
      { key: 'player_leave',      label: 'Oyuncu Ayrılır',    desc: 'P3 çıkar → kalan 2 oyuncu, index korunur' },
      { key: 'host_leave',        label: 'Host Ayrılır',      desc: 'Host çıkar → lobi silinir' },
      { key: '4p_full',           label: '4P Tam Döngü',      desc: '4 oyuncu, 3 tam tur, tur sırası kontrolü' },
      { key: '4p_win',            label: '4P Kazanma',        desc: 'P3 kazanıyor → diğerleri winner ekranını görür' },
    ],
  },
  {
    id: 'placement',
    label: 'Kart Yerleşim',
    icon: <Layers className="w-3.5 h-3.5" />,
    color: '#4ade80',
    items: [
      { key: 'placement_boundary',       label: 'Sınır Koşulları',   desc: 'Zone 0/N/orta, eşit yıl kenar değeri' },
      { key: 'placement_empty_timeline', label: 'Boş Timeline',      desc: '0 kartlı oyuncuya her yıl yerleştirilebilir' },
      { key: 'placement_all_zones',      label: 'Tüm Zone Mantığı',  desc: '4 kartlı timeline üzerinde zone 0-4 kombinasyonları' },
      { key: 'card_sort_accuracy',       label: 'Kart Sıralama',     desc: 'Yıllara göre sort ve eşit yıl kararlı sıralama' },
    ],
  },
  {
    id: 'settings',
    label: 'Oyun Ayarları',
    icon: <Settings className="w-3.5 h-3.5" />,
    color: '#a78bfa',
    items: [
      { key: 'win_thresholds',       label: 'Kazanma Eşiği',   desc: '5/7/10/15 kart eşiğinde winner doğru yazılır' },
      { key: 'turn_duration_variants',label: 'Tur Süresi',     desc: '0(süresiz)/10/30/60/120sn kaydedilir' },
      { key: 'category_filter',      label: 'Kategori Filtresi',desc: 'Tüm kategoriler DB\'ye doğru yazılır' },
      { key: 'year_range',           label: 'Yıl Aralığı',     desc: 'Dar/geniş/antik aralıklar doğru kaydedilir' },
      { key: 'category_year_combo',  label: 'Kategori × Yıl',  desc: 'Kombinasyon ayarları tutarlı kaydedilir' },
      { key: 'player_count_limits',  label: 'Oyuncu Limiti',   desc: '1-4 arası her oyuncu sayısı lobi oluşturabilir' },
    ],
  },
  {
    id: 'data',
    label: 'Veri & Soru',
    icon: <Activity className="w-3.5 h-3.5" />,
    color: '#facc15',
    items: [
      { key: 'lobby_state_transitions', label: 'Durum Geçişleri',    desc: 'waiting→starting→in_game→finished' },
      { key: 'pool_exhausted',          label: 'Soru Tükenmesi',     desc: '200 ID kullanıldığında DB tutarlı kalır' },
      { key: 'dedup_questions',         label: 'Soru Dedup',         desc: 'Aynı soru ID iki kez girilmez' },
      { key: 'player_name_edge',        label: 'İsim Kenar Değerler',desc: 'Türkçe, XSS, uzun, tek karakter isimler' },
      { key: 'lobby_chat',              label: 'Lobi Sohbet',        desc: 'Chat/system mesajları oluşturulur ve okunur' },
      { key: 'game_restart',            label: 'Oyun Yeniden Başlat',desc: 'Finished → waiting, kartlar sıfırlanır' },
      { key: 'lobby_code_uniqueness',   label: 'Lobi Kod Benzersizliği',desc: '10 lobi oluştur, kod çakışması kontrol et' },
      { key: 'single_player_offline',   label: 'Offline Soru Havuzu',desc: 'Kategorilere göre min 10 metin soru kontrolü' },
      { key: 'question_type_distribution',label:'Tip Dağılımı',      desc: 'Metin/görsel/ses soru sayıları ve oranları' },
      { key: 'question_year_coverage',  label: 'Yıl Kapsamı',        desc: 'Tüm yıl aralıklarında soru dağılımı' },
      { key: 'offline_game_init',       label: 'Offline Başlatma',   desc: 'Fisher-Yates shuffle, kart dağıtımı, tekrar yok' },
    ],
  },
  {
    id: 'perf',
    label: 'Performans & Stabilite',
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
  {
    id: 'all_sim',
    label: 'Tümü',
    icon: <Shield className="w-3.5 h-3.5" />,
    color: '#a78bfa',
    items: [
      { key: 'all', label: 'Tümünü Çalıştır', desc: '53 senaryoyu sırayla çalıştır, özet raporla' },
    ],
  },
];

const ALL_KEYS = SCENARIO_GROUPS.flatMap(g => g.items.map(i => i.key)).filter(k => k !== 'all');

function getEstimatedMs(key) {
  if (key === 'all') return 120000;
  if (['2p_delayed', 'perf_db_throughput', 'player_count_limits', 'lobby_code_uniqueness', 'win_thresholds', 'turn_duration_variants', 'category_filter', 'year_range', 'player_name_edge'].includes(key)) return 8000;
  return 3500;
}

// ─── Scenario button ────────────────────────────────────────────────────────
function ScenarioButton({ item, groupColor, active, loading, result, onRun }) {
  const statusColor = result?.status === 'PASS' ? '#4ade80' : result?.status === 'FAIL' ? '#f87171' : result?.status === 'ERROR' ? '#facc15' : null;

  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      onClick={() => !loading && onRun(item.key)}
      disabled={loading}
      className="text-left p-3 rounded-xl transition-all relative overflow-hidden"
      style={{
        border: `1px solid ${active ? groupColor + '50' : statusColor ? statusColor + '25' : 'rgba(255,255,255,0.07)'}`,
        background: active ? `${groupColor}0e` : statusColor ? `${statusColor}08` : 'rgba(255,255,255,0.02)',
        opacity: loading && !active ? 0.5 : 1,
      }}
    >
      {/* Top accent line */}
      {statusColor && (
        <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-xl"
          style={{ background: statusColor, opacity: 0.6 }} />
      )}
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex items-center gap-1.5">
          {active && loading
            ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                className="w-2.5 h-2.5 rounded-full border border-t-transparent"
                style={{ borderColor: groupColor }} />
            : <Play className="w-2.5 h-2.5 flex-shrink-0" style={{ color: groupColor }} />
          }
          <span className="font-inter text-xs font-semibold text-white/80 leading-tight">{item.label}</span>
        </div>
        {statusColor && (
          <span className="font-inter text-[9px] font-bold flex-shrink-0"
            style={{ color: statusColor }}>
            {result.status}
          </span>
        )}
      </div>
      <p className="font-inter text-[9px] text-white/30 leading-relaxed pl-4">{item.desc}</p>
    </motion.button>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────
export default function SimulationPanel({ onClose }) {
  const [loading, setLoading] = useState(false);
  const [activeScenario, setActiveScenario] = useState(null);
  const [results, setResults] = useState({});
  const [summary, setSummary] = useState(null);
  const [progress, setProgress] = useState(0);
  const [currentLabel, setCurrentLabel] = useState('');
  const [streamLogs, setStreamLogs] = useState([]);
  const [activeGroup, setActiveGroup] = useState('multiplayer');
  const progressTimerRef = useRef(null);

  const addLog = (msg) => setStreamLogs(prev => [...prev.slice(-80), msg]);

  const runScenario = async (scenarioKey) => {
    setLoading(true);
    setActiveScenario(scenarioKey);
    setProgress(0);

    const scenarioItem = SCENARIO_GROUPS.flatMap(g => g.items).find(i => i.key === scenarioKey);
    const label = scenarioItem?.label || scenarioKey;
    setCurrentLabel(label);
    addLog(`⚡ Başlatıldı: ${label}`);

    const estimatedMs = getEstimatedMs(scenarioKey);
    const intervalMs = 250;
    const steps = estimatedMs / intervalMs;
    let tick = 0;
    clearInterval(progressTimerRef.current);
    progressTimerRef.current = setInterval(() => {
      tick++;
      setProgress(Math.min(94, Math.round((tick / steps) * 100)));
    }, intervalMs);

    try {
      const res = await base44.functions.invoke('simulateOnlineGame', { scenario: scenarioKey });
      const newResults = res.data?.results || {};
      const newSummary = res.data?.summary || null;

      setResults(prev => ({ ...prev, ...newResults }));
      setSummary(newSummary);

      // Stream logs from result
      const scenResults = scenarioKey === 'all' ? Object.entries(newResults) : Object.entries(newResults).filter(([k]) => k === scenarioKey);
      for (const [k, r] of scenResults) {
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
    }
  };

  useEffect(() => () => clearInterval(progressTimerRef.current), []);

  const currentGroup = SCENARIO_GROUPS.find(g => g.id === activeGroup);
  const passCount = Object.values(results).filter(r => r.status === 'PASS').length;
  const failCount = Object.values(results).filter(r => r.status === 'FAIL').length;
  const totalRun = Object.keys(results).length;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(5,7,22,0.85)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <RunningOverlay
        visible={loading}
        label={currentLabel}
        progress={progress}
        subtitle={activeScenario === 'all' ? `${ALL_KEYS.length} senaryo · tahmini ~2dk` : 'tahmini ~3-8sn'}
      />

      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 320, damping: 32 }}
        className="w-full max-w-lg rounded-t-3xl flex flex-col overflow-hidden"
        style={{
          maxHeight: '92vh',
          background: 'linear-gradient(160deg, #0f1428 0%, #0a0f23 100%)',
          border: '1px solid rgba(250,204,21,0.15)',
          borderBottom: 'none',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-white/15" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-2 flex-shrink-0">
          <div>
            <h2 className="font-cinzel text-sm text-primary tracking-widest">ONLINE SİMÜLASYON</h2>
            <p className="font-inter text-[9px] text-white/30">
              {totalRun > 0 ? `${passCount} geçti · ${failCount} başarısız · ${totalRun} çalıştırıldı` : 'Senaryo seçin ve çalıştırın'}
            </p>
          </div>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-white/40 hover:text-white/70 transition-colors"
            style={{ background: 'rgba(255,255,255,0.06)' }}
          >
            <X className="w-4 h-4" />
          </motion.button>
        </div>

        {/* Group tabs */}
        <div className="flex-shrink-0 flex gap-1.5 px-4 pb-2 overflow-x-auto"
          style={{ scrollbarWidth: 'none' }}>
          {SCENARIO_GROUPS.map(g => (
            <motion.button
              key={g.id}
              whileTap={{ scale: 0.95 }}
              onClick={() => setActiveGroup(g.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl whitespace-nowrap flex-shrink-0 transition-all"
              style={{
                background: activeGroup === g.id ? `${g.color}15` : 'rgba(255,255,255,0.04)',
                border: `1px solid ${activeGroup === g.id ? g.color + '40' : 'rgba(255,255,255,0.07)'}`,
                color: activeGroup === g.id ? g.color : 'rgba(255,255,255,0.35)',
              }}
            >
              <span style={{ color: activeGroup === g.id ? g.color : 'rgba(255,255,255,0.35)' }}>{g.icon}</span>
              <span className="font-inter text-[10px] font-semibold">{g.label}</span>
              {/* Pass badge for group */}
              {(() => {
                const groupPassed = g.items.filter(i => results[i.key]?.status === 'PASS').length;
                const groupTotal = g.items.filter(i => results[i.key]).length;
                if (groupTotal === 0) return null;
                return (
                  <span className="font-cinzel text-[8px] px-1 py-0.5 rounded-full"
                    style={{ background: groupPassed === groupTotal ? '#4ade8020' : '#f8717120', color: groupPassed === groupTotal ? '#4ade80' : '#f87171' }}>
                    {groupPassed}/{groupTotal}
                  </span>
                );
              })()}
            </motion.button>
          ))}
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3"
          style={{ scrollbarWidth: 'none' }}>

          {/* Scenario grid */}
          <div className={`grid gap-2 ${currentGroup?.items.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
            {currentGroup?.items.map(item => (
              <ScenarioButton
                key={item.key}
                item={item}
                groupColor={currentGroup.color}
                active={activeScenario === item.key && loading}
                loading={loading}
                result={results[item.key]}
                onRun={runScenario}
              />
            ))}
          </div>

          {/* Event stream */}
          {streamLogs.length > 0 && (
            <EventStream logs={streamLogs} title="CANLI LOG AKIŞI" maxHeight={160} />
          )}

          {/* Results for current group */}
          {currentGroup && Object.entries(results).filter(([k]) => currentGroup.items.some(i => i.key === k)).length > 0 && (
            <div className="space-y-2">
              <p className="font-inter text-[9px] uppercase tracking-widest text-white/25 px-1">Senaryo Sonuçları</p>
              {Object.entries(results)
                .filter(([k]) => currentGroup.items.some(i => i.key === k))
                .map(([key, result]) => (
                  <SimulationResultCard key={key} scenarioKey={key} result={result} />
                ))}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}