import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { sounds } from '@/lib/gameSounds';
import { Volume2, Play, Pause, Globe, Landmark, FlaskConical, Trophy, Palette, Cpu, Music, BookOpen, Tv, Zap, Rocket, Building2, HeartPulse, Leaf, Film } from 'lucide-react';
import { base44 } from '@/api/base44Client';

// Soruya uygun ikon seçimi (anahtar kelime bazlı)
function getQuestionIcon(question, category) {
  const text = (question || '').toLowerCase();

  // Kategori bazlı fallback ikonlar
  const categoryIcons = {
    tarih: Landmark,
    bilim: FlaskConical,
    spor: Trophy,
    sanat: Palette,
    teknoloji: Cpu,
    muzik: Music,
    genel: BookOpen,
  };

  // Anahtar kelime bazlı ikon seçimi
  if (text.includes('uzay') || text.includes('nasa') || text.includes('ay ') || text.includes('roket') || text.includes('astrono')) return Rocket;
  if (text.includes('bilgisayar') || text.includes('internet') || text.includes('yazılım') || text.includes('teknoloji') || text.includes('apple') || text.includes('microsoft') || text.includes('google') || text.includes('iphone')) return Cpu;
  if (text.includes('müzik') || text.includes('şarkı') || text.includes('albüm') || text.includes('konser') || text.includes('band') || text.includes('müzisyen')) return Music;
  if (text.includes('film') || text.includes('sinema') || text.includes('oscar') || text.includes('yönetmen') || text.includes('dizi') || text.includes('tv ') || text.includes('televizyon')) return Film;
  if (text.includes('savaş') || text.includes('dünya savaşı') || text.includes('ordu') || text.includes('asker') || text.includes('imparator') || text.includes('cumhuriyet') || text.includes('devrim')) return Landmark;
  if (text.includes('spor') || text.includes('futbol') || text.includes('olimpiyat') || text.includes('dünya kupası') || text.includes('şampiyona') || text.includes('atletizm') || text.includes('fifa') || text.includes('nba')) return Trophy;
  if (text.includes('bilim') || text.includes('keşif') || text.includes('aşı') || text.includes('dna') || text.includes('atom') || text.includes('element') || text.includes('fizik') || text.includes('kimya')) return FlaskConical;
  if (text.includes('sanat') || text.includes('ressam') || text.includes('tablo') || text.includes('heykel') || text.includes('mimari') || text.includes('müze') || text.includes('fotoğraf')) return Palette;
  if (text.includes('sağlık') || text.includes('hastalık') || text.includes('salgın') || text.includes('tıp') || text.includes('ilaç') || text.includes('pandemi') || text.includes('covid')) return HeartPulse;
  if (text.includes('çevre') || text.includes('iklim') || text.includes('doğa') || text.includes('orman') || text.includes('deniz') || text.includes('hayvan')) return Leaf;
  if (text.includes('bina') || text.includes('köprü') || text.includes('şehir') || text.includes('inşaat') || text.includes('mimari') || text.includes('kule')) return Building2;
  if (text.includes('enerji') || text.includes('elektrik') || text.includes('nükleer') || text.includes('güneş')) return Zap;
  if (text.includes('dünya') || text.includes('ülke') || text.includes('kıta') || text.includes('coğrafya') || text.includes('harita')) return Globe;

  return categoryIcons[category] || BookOpen;
}

// Neon border colors per category
const categoryNeon = {
  tarih:    { border: '#f59e0b', glow: 'rgba(245,158,11,0.5)' },
  bilim:    { border: '#22d3ee', glow: 'rgba(34,211,238,0.5)' },
  spor:     { border: '#4ade80', glow: 'rgba(74,222,128,0.5)' },
  sanat:    { border: '#f472b6', glow: 'rgba(244,114,182,0.5)' },
  teknoloji:{ border: '#a78bfa', glow: 'rgba(167,139,250,0.5)' },
  genel:    { border: '#facc15', glow: 'rgba(250,204,21,0.5)' },
  muzik:    { border: '#facc15', glow: 'rgba(250,204,21,0.5)' },
};

const defaultNeon = { border: '#facc15', glow: 'rgba(250,204,21,0.5)' };

export default function QuestionCard({
  question,
  onImageError,
  onAudioError,
  draggable = false,
  onDragStart,
  onDragEnd,
  onTouchDragMove,
  onTouchDragEnd,
}) {
  const [playing, setPlaying] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [audioError, setAudioError] = useState(false);
  const [livePreviewUrl, setLivePreviewUrl] = useState(null);
  const audioRef = useRef(null);
  const touchDragging = useRef(false);

  // Müzik soruları için canlı Deezer preview URL çek
  useEffect(() => {
    setImgError(false);
    setAudioError(false);
    setPlaying(false);
    setLivePreviewUrl(null);

    if (question?.type !== 'muzik') return;

    const lines = (question?.question || '').split('\n');
    const songTitle = lines[0] || '';
    const artistName = lines[1] || '';
    const searchQuery = artistName ? `${songTitle} ${artistName}` : songTitle;

    base44.functions.invoke('getDeezerPreview', { query: searchQuery })
      .then(res => {
        const url = res?.data?.previewUrl;
        if (url) setLivePreviewUrl(url);
        else setAudioError(true);
      })
      .catch(() => setAudioError(true));
  }, [question?.id]);

  // Preview URL hazır olunca otomatik çal
  useEffect(() => {
    if (!livePreviewUrl || !audioRef.current) return;
    audioRef.current.load();
    const timer = setTimeout(() => {
      const p = audioRef.current?.play();
      if (p !== undefined) p.then(() => setPlaying(true)).catch(() => setPlaying(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [livePreviewUrl]);

  const toggleAudio = (e) => {
    e.stopPropagation();
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      const p = audioRef.current.play();
      if (p !== undefined) p.then(() => setPlaying(true)).catch(() => setPlaying(false));
      else setPlaying(true);
    }
  };

  const handleTouchStart = (e) => {
    if (!draggable) return;
    e.preventDefault();
    touchDragging.current = true;
    sounds.pickup();
    if (onDragStart) onDragStart();
  };

  const handleTouchMove = (e) => {
    if (!draggable || !touchDragging.current) return;
    e.preventDefault();
    const touch = e.touches[0];
    // Emit raw viewport coordinates — world transform happens in Timeline
    if (onTouchDragMove) onTouchDragMove(touch.clientX, touch.clientY);
  };

  const handleTouchEnd = (e) => {
    if (!draggable || !touchDragging.current) return;
    touchDragging.current = false;
    const touch = e.changedTouches[0];
    // Emit raw viewport coordinates — world transform happens in Timeline
    if (onTouchDragEnd) onTouchDragEnd(touch.clientX, touch.clientY);
    if (onDragEnd) onDragEnd();
  };

  const neon = categoryNeon[question?.category] || defaultNeon;
  const QuestionIcon = getQuestionIcon(question?.question, question?.category);

  const hasAlbumArt = question?.media_url && !imgError;
  const isMuzik = question?.type === 'muzik';
  const isGorsel = question?.type === 'gorsel';

  // For muzik: show title (song name) + artist from question text
  const lines = (question?.question || '').split('\n');
  const songTitle = isMuzik ? (lines[0] || '') : null;
  const artistName = isMuzik ? (lines[1] || '') : null;

  const [isDraggingNow, setIsDraggingNow] = useState(false);

  const handleTouchStartWrapped = (e) => {
    setIsDraggingNow(true);
    handleTouchStart(e);
  };
  const handleTouchEndWrapped = (e) => {
    setIsDraggingNow(false);
    handleTouchEnd(e);
  };

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0, y: 16 }}
      animate={{
        scale: isDraggingNow ? 1.06 : 1,
        opacity: 1,
        y: 0,
        rotate: isDraggingNow ? 2 : 0,
      }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      draggable={draggable}
      onDragStart={draggable ? onDragStart : undefined}
      onDragEnd={draggable ? onDragEnd : undefined}
      onTouchStart={handleTouchStartWrapped}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEndWrapped}
      className={`relative flex flex-col rounded-2xl overflow-hidden select-none mx-auto
        ${draggable ? 'cursor-grab active:cursor-grabbing' : ''}
      `}
      style={{
        width: 160,
        minHeight: 200,
        background: 'linear-gradient(160deg, #0f1428 0%, #0a0f23 100%)',
        border: `2px solid ${neon.border}`,
        boxShadow: isDraggingNow
          ? `0 0 36px ${neon.glow}, 0 0 16px ${neon.glow}, 0 12px 32px rgba(0,0,0,0.6)`
          : `0 0 20px ${neon.glow}, 0 0 8px ${neon.glow}`,
        touchAction: draggable ? 'none' : 'auto',
        transition: 'box-shadow 0.15s ease',
      }}
    >
      {/* Album art — full width top section */}
      {hasAlbumArt && (
        <div className="w-full overflow-hidden" style={{ height: 96, flexShrink: 0 }}>
          <img
            src={question.media_url}
            alt=""
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
            crossOrigin="anonymous"
            onError={() => { setImgError(true); if (onImageError && isGorsel) onImageError(); }}
          />
        </div>
      )}

      {/* Content area */}
      <div className="flex flex-col items-center px-3 py-3 gap-1 flex-1">
        {/* Question text or song title */}
        <p className="text-center font-inter font-bold leading-tight text-white"
          style={{ fontSize: isMuzik ? 11 : 10, lineHeight: 1.3 }}>
          {isMuzik ? songTitle : question?.question}
        </p>

        {/* Category icon — below question text, only for non-album-art cards */}
        {!hasAlbumArt && !isMuzik && (
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mt-2 flex-shrink-0"
            style={{ background: `${neon.border}18`, border: `1.5px solid ${neon.border}50` }}
          >
            {question?.icon_url ? (
              <img src={question.icon_url} alt="" className="w-9 h-9 object-contain" />
            ) : (
              <QuestionIcon style={{ width: 28, height: 28, color: neon.border }} strokeWidth={1.5} />
            )}
          </div>
        )}

        {/* Artist name for music */}
        {isMuzik && artistName && (
          <p className="text-center font-inter" style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>
            {artistName}
          </p>
        )}

        {/* Audio controls for muzik */}
        {isMuzik && !audioError && (
          <div className="flex flex-col items-center gap-1 mt-1">
            {livePreviewUrl && (
              <audio
                ref={audioRef}
                src={livePreviewUrl}
                onError={() => { setAudioError(true); if (onAudioError) onAudioError(); }}
                onEnded={() => {
                  if (audioRef.current) {
                    audioRef.current.currentTime = 0;
                    audioRef.current.play();
                  }
                }}
              />
            )}
            <button
              onClick={livePreviewUrl ? toggleAudio : undefined}
              className="w-9 h-9 rounded-full flex items-center justify-center"
              style={{ background: livePreviewUrl ? neon.border : 'rgba(255,255,255,0.15)', opacity: livePreviewUrl ? 1 : 0.5 }}
            >
              {playing ? <Pause className="w-4 h-4 text-black" /> : <Play className="w-4 h-4 text-black ml-0.5" />}
            </button>
          </div>
        )}

        {/* Audio for isitsel type */}
        {question?.type === 'isitsel' && question?.media_url && (
          <div className="flex flex-col items-center gap-1 mt-1">
            <audio ref={audioRef} src={question.media_url} onEnded={() => setPlaying(false)} />
            <button
              onClick={toggleAudio}
              className="w-9 h-9 rounded-full bg-blue-500 flex items-center justify-center"
            >
              {playing ? <Pause className="w-4 h-4 text-white" /> : <Play className="w-4 h-4 text-white ml-0.5" />}
            </button>
            <p className="text-center font-inter" style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>
              Sesi dinle
            </p>
          </div>
        )}

        {/* intentionally removed duplicate text render */}
      </div>

      {/* Bottom bar — year hint */}
      <div
        className="w-full flex items-center justify-center py-2"
        style={{ borderTop: `1px solid ${neon.border}30` }}
      >
        <p className="font-inter text-center" style={{ fontSize: 9, color: neon.border, opacity: 0.7 }}>
          Bu olay ne zaman gerçekleşti?
        </p>
      </div>
    </motion.div>
  );
}