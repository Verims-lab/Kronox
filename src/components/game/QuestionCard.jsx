import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { HelpCircle, Volume2, Play, Pause, ImageOff } from 'lucide-react';

// Category emoji mapping
const categoryEmoji = {
  tarih: '🏰',
  bilim: '🔬',
  spor: '⚽',
  sanat: '🎨',
  teknoloji: '💡',
  genel: '🌍',
};

// Neon glow colors per category
const categoryNeon = {
  tarih:    { border: '#f59e0b', shadow: '0 0 8px 2px rgba(245,158,11,0.7), 0 0 20px 4px rgba(245,158,11,0.35)' },
  bilim:    { border: '#22d3ee', shadow: '0 0 8px 2px rgba(34,211,238,0.7), 0 0 20px 4px rgba(34,211,238,0.35)' },
  spor:     { border: '#4ade80', shadow: '0 0 8px 2px rgba(74,222,128,0.7), 0 0 20px 4px rgba(74,222,128,0.35)' },
  sanat:    { border: '#f472b6', shadow: '0 0 8px 2px rgba(244,114,182,0.7), 0 0 20px 4px rgba(244,114,182,0.35)' },
  teknoloji:{ border: '#a78bfa', shadow: '0 0 8px 2px rgba(167,139,250,0.7), 0 0 20px 4px rgba(167,139,250,0.35)' },
  genel:    { border: '#60a5fa', shadow: '0 0 8px 2px rgba(96,165,250,0.7), 0 0 20px 4px rgba(96,165,250,0.35)' },
};

export default function QuestionCard({
  question,
  onImageError,
  draggable = false,
  onDragStart,
  onDragEnd,
  onTouchDragMove,
  onTouchDragEnd,
  compact = false,
}) {
  const [playing, setPlaying] = useState(false);
  const [imgError, setImgError] = useState(false);
  const audioRef = useRef(null);
  const touchDragging = useRef(false);

  useEffect(() => {
    setImgError(false);
    setPlaying(false);
  }, [question?.id]);

  const handleImgError = () => {
    setImgError(true);
    if (onImageError) onImageError();
  };

  const toggleAudio = (e) => {
    e.stopPropagation();
    if (!audioRef.current) return;
    if (playing) { audioRef.current.pause(); setPlaying(false); }
    else { audioRef.current.play(); setPlaying(true); }
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

  const emoji = categoryEmoji[question?.category] || '🌍';
  const neon = categoryNeon[question?.category] || categoryNeon.genel;

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0, y: 20 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 220, damping: 22 }}
      draggable={draggable}
      onDragStart={draggable ? onDragStart : undefined}
      onDragEnd={draggable ? onDragEnd : undefined}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className={`
        relative flex flex-col items-center rounded-2xl mx-auto
        bg-white text-gray-800
        ${draggable ? 'cursor-grab active:cursor-grabbing active:scale-95 transition-transform duration-100' : ''}
        ${compact ? 'p-3 gap-2' : 'p-4 gap-3'}
      `}
      style={{
        width: 144,
        minHeight: 180,
        touchAction: draggable ? 'none' : 'auto',
        border: `2px solid ${neon.border}`,
        boxShadow: neon.shadow,
      }}
    >
      {/* Help icon top right */}
      <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
        <HelpCircle className="w-4 h-4 text-white" />
      </div>

      {/* Title */}
      <p className={`font-inter font-bold text-gray-800 text-center leading-tight ${compact ? 'text-xs' : 'text-xs'} pr-5`}>
        {question.question}
      </p>

      {/* Visual content */}
      {question.type === 'gorsel' && question.media_url && !imgError && (
        <div className="w-full flex items-center justify-center">
          <img
            src={question.media_url}
            alt="Soru görseli"
            className={`object-contain rounded-xl ${compact ? 'max-h-12' : 'max-h-16'}`}
            referrerPolicy="no-referrer"
            crossOrigin="anonymous"
            onError={handleImgError}
          />
        </div>
      )}
      {question.type === 'gorsel' && (imgError || !question.media_url) && (
        <div className="w-full flex flex-col items-center justify-center py-4 gap-1">
          <span className="text-5xl">{emoji}</span>
        </div>
      )}
      {question.type === 'metin' && (
        <div className="flex items-center justify-center">
          <span className={compact ? 'text-3xl' : 'text-4xl'}>{emoji}</span>
        </div>
      )}

      {/* Audio */}
      {question.type === 'isitsel' && question.media_url && (
        <div className="flex flex-col items-center gap-1.5">
          <audio ref={audioRef} src={question.media_url} onEnded={() => setPlaying(false)} />
          <button
            onClick={toggleAudio}
            className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center shadow-lg"
          >
            {playing ? <Pause className="w-5 h-5 text-white" /> : <Play className="w-5 h-5 text-white ml-0.5" />}
          </button>
          <p className="text-xs text-gray-500 flex items-center gap-1">
            <Volume2 className="w-3 h-3" /> Sesi dinle
          </p>
        </div>
      )}

      {/* Bottom label */}
      {!compact && (
        <div className="w-full pt-1 border-t border-gray-100">
          <p className="text-center text-[10px] font-inter text-gray-400">Bu olay ne zaman?</p>
        </div>
      )}
    </motion.div>
  );
}