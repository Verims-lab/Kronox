import React, { useState } from 'react';
import { motion } from 'framer-motion';

export default function DropZone({ index, isActive, onDrop, onHover, isDragMode }) {
  const [isOver, setIsOver] = useState(false);
  const disabled = !onDrop && !onHover;

  // ── HTML5 Drag & Drop ──
  const handleDragOver = (e) => {
    if (!onDrop) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsOver(true);
  };
  const handleDragLeave = () => setIsOver(false);
  const handleDrop = (e) => {
    e.preventDefault();
    setIsOver(false);
    if (onDrop) onDrop(index);
  };

  // ── Mouse hover → auto-select zone ──
  const handleMouseEnter = () => {
    if (onHover) onHover(index);
    setIsOver(true);
  };
  const handleMouseLeave = () => setIsOver(false);

  // ── Click → place card ──
  const handleClick = () => {
    if (onDrop) onDrop(index);
    else if (onHover) onHover(index);
  };

  const highlighted = isOver || isActive;

  return (
    <motion.div
      animate={highlighted ? { scale: 1.15 } : { scale: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
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