import React, { useState, useEffect, useRef } from 'react';
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
      { key: '2p_rival_win', label: 'Rakip Kazanır', desc: 'P1=9 kart, P2=8 kart → P1 son kartla bitirir' },
      { key: '2p_turn_visibility', label: 'Tur Görünürlüğü', desc: 'P1 yazar → P2 sırasını DB\'den alıyor mu?' },
      { key: '2p_delayed', label: 'Gecikmeli Yazma', desc: 'DB 1.5sn geç → kart ve index korunuyor mu?' },
      { key: '2p_concurrent', label: 'Eş Zamanlı', desc: '2 oyuncu aynı anda yazar → last-write-wins' },
    ],
  },
  {
    group: '3 Oyuncu',
    items: [
      { key: '3p_turn_order', label: 'Tur Sırası', desc: '0→1→2→0 doğru dönüyor mu? (2 tam tur)' },
      { key: '3p_spectate', label: 'Bekleme / İzleme', desc: 'Sıra olmayan oyuncular kart ekleyemiyor' },
      { key: 'player_leave', label: 'Oyuncu Ayrılır', desc: 'P3 çıkar → kalan 2 oyuncu, index korunur' },
      { key: 'host_leave', label: 'Host Ayrılır', desc: 'Host çıkar → lobi silinir, diğerleri bilgilendirilir' },
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
    group: 'Kart Yerleşim',
    items: [
      { key: 'placement_boundary', label: 'Sınır Koşulları', desc: 'Zone 0/N/orta, eşit yıl kenar değeri' },
      { key: 'placement_empty_timeline', label: 'Boş Timeline', desc: '0 kartlı oyuncuya her yıl yerleştirilebilir' },
      { key: 'placement_all_zones', label: 'Tüm Zone Mantığı', desc: '4 kartlı timeline üzerinde zone 0-4 kombinasyonları' },
      { key: 'card_sort_accuracy', label: 'Kart Sıralama', desc: 'Yıllara göre sort ve eşit yıl kararlı sıralama' },
    ],
  },
  {
    group: 'Oyun Ayarları',
    items: [
      { key: 'win_thresholds', label: 'Kazanma Eşiği', desc: '5/7/10/15 kart eşiğinde winner doğru yazılır' },
      { key: 'turn_duration_variants', label: 'Tur Süresi', desc: '0(süresiz)/10/30/60/120sn kaydedilir' },
      { key: 'category_filter', label: 'Kategori Filtresi', desc: 'Tüm kategoriler DB\'ye doğru yazılır' },
      { key: 'year_range', label: 'Yıl Aralığı', desc: 'Dar/geniş/antik aralıklar doğru kaydedilir' },
      { key: 'category_year_combo', label: 'Kategori × Yıl', desc: 'Kombinasyon ayarları tutarlı kaydedilir' },
      { key: 'player_count_limits', label: 'Oyuncu Limiti', desc: '1-4 arası her oyuncu sayısı lobi oluşturabilir' },
    ],
  },
  {
    group: 'Veri Bütünlüğü',
    items: [
      { key: 'lobby_state_transitions', label: 'Durum Geçişleri', desc: 'waiting→starting→in_game→finished' },
      { key: 'pool_exhausted', label: 'Soru Tükenmesi', desc: '200 ID kullanıldığında DB tutarlı kalır' },
      { key: 'dedup_questions', label: 'Soru Dedup', desc: 'Aynı soru ID iki kez girilmez (Set filtresi)' },
      { key: 'player_name_edge', label: 'İsim Kenar Değerler', desc: 'Türkçe, XSS, uzun, tek karakter isimler' },
      { key: 'lobby_chat', label: 'Lobi Sohbet', desc: 'Chat/system mesajları oluşturulur ve okunur' },
      { key: 'game_restart', label: 'Oyun Yeniden Başlat', desc: 'Finished → waiting, kartlar ve soru geçmişi sıfırlanır' },
      { key: 'lobby_code_uniqueness', label: 'Lobi Kod Benzersizliği', desc: '10 lobi oluştur, kod çakışması kontrol et' },
    ],
  },
  {
    group: 'Soru Havuzu',
    items: [
      { key: 'single_player_offline', label: 'Offline Soru Havuzu', desc: 'Kategorilere göre min 10 metin soru kontrolü' },
      { key: 'question_type_distribution', label: 'Tip Dağılımı', desc: 'Metin/görsel/ses soru sayıları ve oranları' },
      { key: 'question_year_coverage', label: 'Yıl Kapsamı', desc: 'Antik→Güncel yıl aralıklarında soru dağılımı' },
      { key: 'offline_game_init', label: 'Offline Başlatma', desc: 'Fisher-Yates shuffle, kart dağıtımı, tekrar yok' },
    ],
  },
  {
    group: 'Performans',
    items: [
      { key: 'perf_question_filter', label: 'Soru Filtreleme', desc: '200 soru fetch → filtre → Set lookup ms ölçümü' },
      { key: 'perf_db_throughput', label: 'DB Yazma Hızı', desc: '10 ardışık update, ortalama ms/yazma ölçümü' },
    ],
  },
  {
    group: 'Stabilite',
    items: [
      { key: 'subscription_cleanup', label: 'Sub Temizliği', desc: '5 ardışık update → unsubscribe pattern doğrulaması' },
      { key: 'multi_lobby_isolation', label: 'Çoklu Lobi', desc: '2 paralel lobi birbirini etkilemiyor mu?' },
      { key: 'win_timer_race', label: 'Win + Timer Race', desc: 'Kazanma + timer dolması aynı anda → state tutarlı mı?' },
    ],
  },
  {
    group: 'Ekran & Görünürlük',
    items: [
      { key: 'question_card_rendering', label: 'Soru Kartı Tipi', desc: 'Metin/görsel/ses render mantığı ve fallback' },
      { key: 'header_visibility', label: 'Header Durumları', desc: 'Rota bazlı back/home/login header mantığı' },
      { key: 'bottomnav_visibility', label: 'BottomNav Gizleme', desc: 'Oyun içinde nav gizli, diğerlerinde görünür' },
      { key: 'orientation_layout_logic', label: 'Landscape/Portrait', desc: 'CSS orientation media query & tailwind sınıf mantığı' },
      { key: 'mobile_safe_area', label: 'Mobil Safe Area', desc: 'iOS/Android notch, navigation bar inset padding kontrolü' },
    ],
  },
  {
    group: 'Oynanabilirlik',
    items: [
      { key: 'timer_logic', label: 'Timer Mantığı', desc: 'Süresiz mod, yüzde, renk eşikleri doğrulaması' },
      { key: 'auth_gate_online', label: 'Auth Kapısı', desc: 'Giriş olmadan çevrimiçi oyun engellenebiliyor mu?' },
      { key: 'chat_edge_cases', label: 'Chat Kenar Durumları', desc: 'Boş/uzun/emoji/XSS mesaj DB davranışı' },
    ],
  },
  {
    group: 'Hepsi',
    items: [
      { key: 'all', label: 'Tümünü Çalıştır', desc: '53 senaryoyu sırayla çalıştır, özet raporla' },
    ],
  },
];

// Tüm senaryoların flat listesi
const ALL_KEYS = SCENARIOS.flatMap(g => g.items.map(i => i.key)).filter(k => k !== 'all');
const TOTAL_COUNT = ALL_KEYS.length;

function getScenarioCount(key) {
  if (key === 'all') return TOTAL_COUNT;
  return 1;
}

// Tümü için tahmini süre (yeni senaryolar dahil)
function getEstimatedMs(key) {
  if (key === 'all') return 120000; // ~2 dakika 42 senaryo için
  if (['2p_delayed', 'perf_db_throughput', 'player_count_limits', 'lobby_code_uniqueness'].includes(key)) return 8000;
  return 3000;
}

export default function SimulationPanel({ onClose }) {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState(null);
  const [results, setResults] = useState(null);
  const [activeScenario, setActiveScenario] = useState(null);
  const [progress, setProgress] = useState(0);
  const [currentLabel, setCurrentLabel] = useState('');
  const progressTimerRef = useRef(null);

  const runScenario = async (scenarioKey) => {
    setLoading(true);
    setActiveScenario(scenarioKey);
    setResults(null);
    setSummary(null);
    setProgress(0);

    // Senaryo adını bul
    const scenarioItem = SCENARIOS.flatMap(g => g.items).find(i => i.key === scenarioKey);
    setCurrentLabel(scenarioItem?.label || scenarioKey);

    const total = getScenarioCount(scenarioKey);
    const estimatedMs = getEstimatedMs(scenarioKey);
    const intervalMs = 200;
    const steps = estimatedMs / intervalMs;
    let tick = 0;

    clearInterval(progressTimerRef.current);
    progressTimerRef.current = setInterval(() => {
      tick++;
      // Progress 95'te takılır, gerisi sonuç gelince 100 olur
      const pct = Math.min(95, Math.round((tick / steps) * 100));
      setProgress(pct);
    }, intervalMs);

    try {
      const res = await base44.functions.invoke('simulateOnlineGame', { scenario: scenarioKey });
      setResults(res.data?.results || {});
      setSummary(res.data?.summary || null);
    } catch (err) {
      setResults({ error: err.message });
    } finally {
      clearInterval(progressTimerRef.current);
      setProgress(100);
      setLoading(false);
    }
  };

  useEffect(() => {
    return () => clearInterval(progressTimerRef.current);
  }, []);

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

        {/* Running popup — full screen blocker */}
        <AnimatePresence>
          {loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center bg-background/90 backdrop-blur-md"
            >
              <motion.div
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.85, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                className="w-80 bg-card border border-primary/40 rounded-2xl p-7 space-y-5 shadow-2xl"
              >
                <div className="flex flex-col items-center gap-3 text-center">
                  <div className="w-14 h-14 rounded-full border-2 border-primary/30 bg-primary/10 flex items-center justify-center">
                    <Loader2 className="w-7 h-7 animate-spin text-primary" />
                  </div>
                  <div>
                    <p className="font-cinzel text-base text-primary font-bold tracking-wider">SİMÜLASYON ÇALIŞIYOR</p>
                    <p className="font-inter text-sm text-foreground mt-1">{currentLabel}</p>
                    <p className="font-inter text-xs text-muted-foreground mt-0.5">
                      {activeScenario === 'all' ? `${TOTAL_COUNT} senaryo • tahmini ~2dk` : 'tahmini ~3sn'}
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between font-inter text-xs text-muted-foreground">
                    <span>İlerleme</span>
                    <span className="font-cinzel text-primary font-bold">{progress}%</span>
                  </div>
                  <div className="w-full h-3 bg-secondary/50 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-primary rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.2 }}
                    />
                  </div>
                </div>
                <p className="font-inter text-xs text-muted-foreground text-center">Lütfen bekleyin, tamamlanana kadar çıkmayın.</p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

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