import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Volume2, Play, Pause } from 'lucide-react';

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
  const audioRef = useRef(null);
  const touchDragging = useRef(false);

  useEffect(() => {
    setImgError(false);
    setAudioError(false);
    setPlaying(false);
    if (question?.type === 'muzik' && audioRef.current) {
      const timer = setTimeout(() => {
        const p = audioRef.current?.play();
        if (p !== undefined) p.then(() => setPlaying(true)).catch(() => setPlaying(false));
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [question?.id]);

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
    touchDragging.current = true;
    if (onDragStart) onDragStart();
  };

  const handleTouchMove = (e) => {
    if (!draggable || !touchDragging.current) return;
    e.preventDefault();
    const touch = e.touches[0];
    if (onTouchDragMove) onTouchDragMove(touch.clientX, touch.clientY);
  };

  const handleTouchEnd = (e) => {
    if (!draggable || !touchDragging.current) return;
    touchDragging.current = false;
    const touch = e.changedTouches[0];
    if (onTouchDragEnd) onTouchDragEnd(touch.clientX, touch.clientY);
    if (onDragEnd) onDragEnd();
  };

  const neon = categoryNeon[question?.category] || defaultNeon;

  const hasAlbumArt = (question?.type === 'gorsel' || question?.type === 'muzik') && question?.media_url && !imgError;
  const isMuzik = question?.type === 'muzik';
  const isGorsel = question?.type === 'gorsel';

  // For muzik: show title (song name) + artist from question text
  const lines = (question?.question || '').split('\n');
  const songTitle = isMuzik ? (lines[0] || '') : null;
  const artistName = isMuzik ? (lines[1] || '') : null;

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0, y: 16 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 220, damping: 22 }}
      draggable={draggable}
      onDragStart={draggable ? onDragStart : undefined}
      onDragEnd={draggable ? onDragEnd : undefined}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className={`relative flex flex-col rounded-2xl overflow-hidden select-none mx-auto
        ${draggable ? 'cursor-grab active:cursor-grabbing' : ''}
      `}
      style={{
        width: 160,
        minHeight: 200,
        background: 'linear-gradient(160deg, #0f1428 0%, #0a0f23 100%)',
        border: `2px solid ${neon.border}`,
        boxShadow: `0 0 20px ${neon.glow}, 0 0 8px ${neon.glow}`,
        touchAction: draggable ? 'none' : 'auto',
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

        {/* Artist name for music */}
        {isMuzik && artistName && (
          <p className="text-center font-inter" style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>
            {artistName}
          </p>
        )}

        {/* Audio controls for muzik */}
        {isMuzik && question?.media_url && !audioError && (
          <div className="flex flex-col items-center gap-1 mt-1">
            <audio
              ref={audioRef}
              src={question.media_url}
              onError={() => { setAudioError(true); if (onAudioError) onAudioError(); }}
              onEnded={() => {
                if (audioRef.current) {
                  audioRef.current.currentTime = 0;
                  audioRef.current.play();
                }
              }}
            />
            <button
              onClick={toggleAudio}
              className="w-9 h-9 rounded-full flex items-center justify-center"
              style={{ background: neon.border }}
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

        {/* Text/gorsel without media — just question text */}
        {!isMuzik && question?.type !== 'isitsel' && !hasAlbumArt && (
          <p className="text-center font-inter text-white/80 text-xs mt-1">
            {question?.question}
          </p>
        )}
      </div>

      {/* Bottom bar — year hint */}
      <div
        className="w-full flex items-center justify-center py-2"
        style={{ borderTop: `1px solid ${neon.border}30` }}
      >
        <p className="font-inter text-center" style={{ fontSize: 9, color: neon.border, opacity: 0.7 }}>
          Bu olay ne zaman?
        </p>
      </div>
    </motion.div>
  );
}