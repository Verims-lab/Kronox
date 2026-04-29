import React, { useState } from 'react';
import { motion } from 'framer-motion';

export default function DropZone({ index, isActive, onDrop, isDragMode }) {
  const [isOver, setIsOver] = useState(false);
  const disabled = !onDrop;

  // ── HTML5 Drag & Drop ──
  const handleDragOver = (e) => {
    if (disabled) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsOver(true);
  };
  const handleDragLeave = () => setIsOver(false);
  const handleDrop = (e) => {
    e.preventDefault();
    setIsOver(false);
    if (!disabled) onDrop(index);
  };

  // ── Touch events (mobile) ──
  // Touch drag is handled externally; onDrop is called by Timeline on touch-end
  // DropZone just needs to visually highlight when "touched over"

  const highlighted = isOver || isActive;

  return (
    <motion.div
      animate={highlighted ? { scale: 1.15 } : { scale: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`
        flex items-center justify-center
        w-8 h-20 min-w-8 landscape:w-6 landscape:h-16 landscape:min-w-6
        rounded-md border-2 border-dashed
        transition-colors duration-150
        ${disabled ? 'cursor-not-allowed opacity-30' : 'cursor-pointer'}
        ${highlighted
          ? 'border-primary bg-primary/30 shadow-lg shadow-primary/30'
          : isDragMode
            ? 'border-primary/60 bg-primary/10 animate-pulse'
            : disabled
              ? 'border-muted-foreground/20 bg-muted/10'
              : 'border-muted-foreground/30 bg-muted/30 hover:border-primary/50 hover:bg-primary/10'}
      `}
    >
      <div className={`w-1 h-6 rounded-full transition-colors duration-150 ${highlighted ? 'bg-primary' : 'bg-muted-foreground/30'}`} />
    </motion.div>
  );
}