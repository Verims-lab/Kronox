import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { sounds } from '@/lib/gameSounds';
import { Play, Pause, Globe, Landmark, FlaskConical, Trophy, Palette, Cpu, Music, BookOpen, Zap, Rocket, Building2, HeartPulse, Leaf, Film } from 'lucide-react';
// Codex153 — Deezer preview proxy removed for security. Music questions
// no longer fetch a live preview URL at runtime; if a question carries a
// pre-stored `media_url`, the card still renders the song title/artist +
// optional cover art, but no audio playback is wired. The play button +
// `<audio>` element are intentionally not rendered when the live preview
// pipeline is unavailable. base44 SDK is no longer needed in this file.

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
  // Codex153 — `onAudioError` kept in the prop signature for backward
  // compatibility with callers (Game / Timeline) but is only fired by the
  // legacy `isitsel` audio path. Music preview pipeline was removed.
  onAudioError,
  draggable = false,
  readOnly = false,
  readOnlyLabel = 'İZLEME MODU',
  onDragStart,
  onDragEnd,
  onTouchDragMove,
  onTouchDragEnd,
}) {
  const [playing, setPlaying] = useState(false);
  const [imgError, setImgError] = useState(false);
  // Codex153 — Live music preview pipeline removed. `audioError` is kept
  // only for the legacy `type === 'isitsel'` audio (which uses the
  // question's own stored `media_url`); music ("muzik") questions no
  // longer attempt audio playback at all.
  const audioRef = useRef(null);
  const touchDragging = useRef(false);

  // Reset transient UI state when the question changes.
  useEffect(() => {
    setImgError(false);
    setPlaying(false);
  }, [question?.id]);

  useEffect(() => {
    return () => {
      const audio = audioRef.current;
      if (!audio) return;
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    };
  }, []);

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
    if (!draggable) return;
    setIsDraggingNow(true);
    handleTouchStart(e);
  };
  const handleTouchEndWrapped = (e) => {
    if (!draggable) return;
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
        minHeight: 240,
        background: hasAlbumArt 
          ? 'transparent'
          : 'linear-gradient(160deg, #0f1428 0%, #0a0f23 100%)',
        border: `2px solid ${neon.border}`,
        boxShadow: isDraggingNow
          ? `0 0 36px ${neon.glow}, 0 0 16px ${neon.glow}, 0 12px 32px rgba(0,0,0,0.6)`
          : `0 0 20px ${neon.glow}, 0 0 8px ${neon.glow}`,
        touchAction: draggable ? 'none' : 'auto',
        transition: 'box-shadow 0.15s ease',
      }}
    >
      {readOnly && (
        <div
          className="absolute left-2 top-2 z-20 rounded-full px-2 py-1 font-inter text-[9px] font-bold tracking-wide text-yellow-200"
          style={{
            background: 'rgba(10,15,35,0.82)',
            border: '1px solid rgba(250,204,21,0.45)',
            boxShadow: '0 0 12px rgba(250,204,21,0.22)',
            pointerEvents: 'none',
          }}
        >
          {readOnlyLabel}
        </div>
      )}

      {hasAlbumArt ? (
        <>
          {/* Premium image layout — 65% of card */}
          <div className="relative w-full" style={{ height: '65%', flexShrink: 0, background: 'linear-gradient(160deg, #0f1428 0%, #0a0f23 100%)' }}>
            <img
              src={question.media_url}
              alt=""
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
              crossOrigin="anonymous"
              onError={() => { setImgError(true); if (onImageError && isGorsel) onImageError(); }}
            />
            {/* Soft bottom fade overlay */}
            <div 
              className="absolute bottom-0 left-0 right-0"
              style={{
                height: '40px',
                background: 'linear-gradient(to bottom, rgba(15,20,40,0) 0%, rgba(15,20,40,0.95) 100%)',
                pointerEvents: 'none',
              }}
            />
          </div>

          {/* Text area — 35% of card with premium spacing */}
          <div className="flex flex-col items-center justify-center flex-1 px-3 py-2.5 gap-1 relative z-10" style={{ background: 'linear-gradient(to bottom, rgba(15,20,40,0.8) 0%, rgba(10,15,35,0.95) 100%)' }}>
            {/* Question text */}
            <p className="text-center font-inter font-bold leading-snug text-white line-clamp-2"
              style={{ fontSize: 11, lineHeight: 1.35 }}>
              {isMuzik ? songTitle : question?.question}
            </p>

            {/* Artist name for music */}
            {isMuzik && artistName && (
              <p className="text-center font-inter line-clamp-1" style={{ fontSize: 8, color: 'rgba(255,255,255,0.6)' }}>
                {artistName}
              </p>
            )}

            {/* Codex153 — Music live preview removed. No audio controls
                or <audio> element are rendered for muzik questions. The
                song title + artist + optional cover art stay visible. */}
          </div>
        </>
      ) : (
        <>
          {/* No media: fallback layout */}
          <div className="flex flex-col items-center px-3 py-3 gap-2 flex-1 justify-center">
            {/* Question text */}
            <p className="text-center font-inter font-bold leading-tight text-white"
              style={{ fontSize: isMuzik ? 11 : 10, lineHeight: 1.3 }}>
              {isMuzik ? songTitle : question?.question}
            </p>

            {/* Category icon */}
            {!isMuzik && (
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
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

            {/* Codex153 — Music live preview removed. Music questions no
                longer render audio controls. Cover art + title + artist
                remain. */}

            {/* Audio for isitsel type — uses the question's own stored
                media_url, no external proxy. */}
            {question?.type === 'isitsel' && question?.media_url && (
              <div className="flex flex-col items-center gap-1 mt-1">
                <audio
                  ref={audioRef}
                  src={question.media_url}
                  onError={() => { if (onAudioError) onAudioError(); }}
                  onEnded={() => setPlaying(false)}
                />
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
        </>
      )}
    </motion.div>
  );
}