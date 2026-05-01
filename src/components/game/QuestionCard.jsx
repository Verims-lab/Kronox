import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Image, Volume2, Play, Pause, GripVertical } from 'lucide-react';

export default function QuestionCard({
  question,
  onImageError,
  draggable = false,
  onDragStart,
  onDragEnd,
  onTouchDragMove,
  onTouchDragEnd,
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

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 220, damping: 22 }}
      draggable={draggable}
      onDragStart={draggable ? onDragStart : undefined}
      onDragEnd={draggable ? onDragEnd : undefined}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ touchAction: draggable ? 'none' : 'auto' }}
      className={`
        relative flex flex-col w-full rounded-2xl gap-2.5 p-4
        border-2 border-primary/40 bg-gradient-to-b from-primary/10 to-card
        shadow-xl shadow-primary/15
        ${draggable ? 'cursor-grab active:cursor-grabbing active:scale-95 transition-transform duration-100' : ''}
      `}
    >
      {/* Drag handle indicator */}
      {draggable && (
        <div className="absolute top-2 right-2 text-primary/25">
          <GripVertical className="w-4 h-4" />
        </div>
      )}

      {/* Görsel */}
      {question.type === 'gorsel' && question.media_url && !imgError && (
        <div className="w-full rounded-xl overflow-hidden border border-primary/20">
          <img
            src={question.media_url}
            alt="Soru görseli"
            className="w-full object-cover max-h-28"
            referrerPolicy="no-referrer"
            crossOrigin="anonymous"
            onError={handleImgError}
          />
        </div>
      )}
      {question.type === 'gorsel' && question.media_url && imgError && (
        <div className="w-full rounded-xl border border-primary/20 bg-secondary/30 flex flex-col items-center justify-center py-3 gap-1">
          <Image className="w-5 h-5 text-muted-foreground/50" />
          <p className="text-xs font-inter text-muted-foreground">Görsel yüklenemedi</p>
        </div>
      )}

      {/* Ses */}
      {question.type === 'isitsel' && question.media_url && (
        <div className="flex flex-col items-center gap-1.5 w-full">
          <audio ref={audioRef} src={question.media_url} onEnded={() => setPlaying(false)} />
          <button
            onClick={toggleAudio}
            className="w-12 h-12 rounded-full bg-primary/20 border-2 border-primary/50 flex items-center justify-center hover:bg-primary/30 transition-all"
          >
            {playing
              ? <Pause className="w-5 h-5 text-primary" />
              : <Play className="w-5 h-5 text-primary ml-0.5" />
            }
          </button>
          <p className="text-xs font-inter text-muted-foreground flex items-center gap-1">
            <Volume2 className="w-3 h-3" /> Sesi dinle
          </p>
        </div>
      )}

      {/* Soru metni */}
      <p className="font-inter text-sm font-medium text-foreground leading-relaxed">
        {question.question}
      </p>

      {/* Alt sürükle ipucu */}
      {draggable && (
        <div className="flex items-center gap-1 text-primary/40 pt-1 border-t border-primary/15 mt-auto">
          <GripVertical className="w-3 h-3" />
          <span className="text-xs font-inter">timeline'a sürükle</span>
        </div>
      )}
    </motion.div>
  );
}