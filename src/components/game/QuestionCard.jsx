import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Image, Volume2, Play, Pause, GripHorizontal } from 'lucide-react';

export default function QuestionCard({ question, onImageError, landscape = false, draggable = false, onDragStart, onDragEnd }) {
  const [playing, setPlaying] = useState(false);
  const [imgError, setImgError] = useState(false);
  const audioRef = useRef(null);

  useEffect(() => {
    setImgError(false);
    setPlaying(false);
  }, [question?.id]);

  const handleImgError = () => {
    setImgError(true);
    if (onImageError) onImageError();
  };

  const toggleAudio = () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play();
      setPlaying(true);
    }
  };

  const handleAudioEnd = () => setPlaying(false);

  return (
    <motion.div
      initial={{ rotateY: 180, opacity: 0 }}
      animate={{ rotateY: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 200, damping: 20 }}
      draggable={draggable}
      onDragStart={draggable ? onDragStart : undefined}
      onDragEnd={draggable ? onDragEnd : undefined}
      className={`relative flex flex-col items-center justify-center 
        w-full mx-auto rounded-xl gap-2
        border-2 border-primary/50 bg-gradient-to-br from-primary/15 to-primary/5
        shadow-xl shadow-primary/20
        ${draggable ? 'cursor-grab active:cursor-grabbing' : ''}
        ${landscape ? 'p-3' : 'p-5 gap-3'}`}
    >
      {/* Visual */}
      {question.type === 'gorsel' && question.media_url && !imgError && (
        <div className="w-full rounded-lg overflow-hidden border border-primary/20">
          <img
            src={question.media_url}
            alt="Soru görseli"
            className={`w-full object-cover ${landscape ? 'max-h-20' : 'max-h-36 md:max-h-64'}`}
            referrerPolicy="no-referrer"
            crossOrigin="anonymous"
            onError={handleImgError}
          />
        </div>
      )}
      {question.type === 'gorsel' && question.media_url && imgError && (
        <div className="w-full rounded-lg border border-primary/20 bg-secondary/30 flex flex-col items-center justify-center py-4 gap-1">
          <Image className="w-6 h-6 text-muted-foreground/50" />
          <p className="text-xs font-inter text-muted-foreground">Görsel yüklenemedi</p>
        </div>
      )}

      {/* Audio */}
      {question.type === 'isitsel' && question.media_url && (
        <div className="flex flex-col items-center gap-1.5 w-full">
          <audio ref={audioRef} src={question.media_url} onEnded={handleAudioEnd} />
          <button
            onClick={toggleAudio}
            className={`rounded-full bg-primary/20 border-2 border-primary/50 flex items-center justify-center hover:bg-primary/30 transition-all ${landscape ? 'w-10 h-10' : 'w-16 h-16'}`}
          >
            {playing
              ? <Pause className={landscape ? 'w-4 h-4 text-primary' : 'w-7 h-7 text-primary'} />
              : <Play className={landscape ? 'w-4 h-4 text-primary ml-0.5' : 'w-7 h-7 text-primary ml-1'} />
            }
          </button>
          {!landscape && (
            <p className="text-xs font-inter text-muted-foreground flex items-center gap-1">
              <Volume2 className="w-3 h-3" />
              Sesi dinle
            </p>
          )}
        </div>
      )}

      {/* Text badge for visual/audio types */}
      {question.type === 'gorsel' && !question.media_url && (
        <div className="flex items-center gap-1 text-muted-foreground text-xs">
          <Image className="w-4 h-4" />
          <span>Görsel yok</span>
        </div>
      )}

      <p className={`font-inter text-foreground text-center leading-relaxed break-words w-full ${landscape ? 'text-xs font-medium' : 'text-base font-semibold'}`}>
        {question.question}
      </p>

      {draggable && !landscape && (
        <div className="flex items-center gap-1 text-primary/50">
          <GripHorizontal className="w-4 h-4" />
          <span className="text-xs font-inter text-primary/50">sürükle & bırak</span>
        </div>
      )}
      {!draggable && !landscape && (
        <div className="text-primary/40 text-xs font-cinzel tracking-widest">
          KRONOS
        </div>
      )}
    </motion.div>
  );
}