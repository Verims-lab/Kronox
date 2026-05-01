import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import TimelineCard from './TimelineCard.jsx';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// Horizontal drop zone — dashed oval between cards
function HorizontalDropZone({ index, isActive, isDragMode, onDrop, onHover, ref: refProp }) {
  const [isOver, setIsOver] = useState(false);
  const disabled = !onDrop && !onHover;
  const highlighted = isOver || isActive;

  const handleMouseEnter = () => { if (onHover) onHover(index); setIsOver(true); };
  const handleMouseLeave = () => setIsOver(false);
  const handleClick = () => { if (onDrop) onDrop(index); else if (onHover) onHover(index); };

  return (
    <div
      ref={refProp}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      className={`relative flex items-center justify-center flex-shrink-0 transition-all duration-150 ${disabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`}
      style={{ width: highlighted ? 80 : isDragMode ? 56 : 32, height: 90 }}
    >
      {/* Dashed oval */}
      <div className={`rounded-2xl border-2 border-dashed transition-all duration-150 flex items-center justify-center
        ${highlighted
          ? 'border-cyan-400 bg-cyan-400/15 shadow-lg'
          : isDragMode
            ? 'border-cyan-500/60 bg-cyan-500/5 animate-pulse'
            : 'border-white/20 bg-white/5'}
      `}
        style={{ width: highlighted ? 70 : isDragMode ? 48 : 26, height: 78 }}
      >
        {isDragMode && !highlighted && (
          <div className="w-1 h-8 rounded-full bg-white/20" />
        )}
        {highlighted && (
          <div className="w-2 h-2 rounded-full bg-cyan-400 shadow-lg shadow-cyan-400/60" />
        )}
      </div>
    </div>
  );
}

// Ghost preview card shown in drop zone when dragging
function GhostCard() {
  return (
    <div
      className="flex-shrink-0 rounded-2xl border-2 border-dashed border-cyan-400 bg-cyan-400/15 flex flex-col items-center justify-center animate-pulse"
      style={{ width: 72, minHeight: 90 }}
    >
      <div className="w-8 h-4 rounded bg-cyan-400/30 mb-1" />
      <div className="w-6 h-6 rounded bg-cyan-400/20 mb-1" />
      <div className="w-10 h-2 rounded bg-cyan-400/20" />
    </div>
  );
}

export default function Timeline({
  cards = [],
  onPlaceCard,
  selectedZone,
  onSelectZone,
  isDragMode,
  externalTouchX,
  externalTouchY,
  externalTouchEnd,
  onExternalZoneChange,
}) {
  const sortedCards = Array.isArray(cards) ? [...cards].sort((a, b) => a.year - b.year) : [];

  const groupedCards = useMemo(() => {
    const groups = [];
    for (const card of sortedCards) {
      const last = groups[groups.length - 1];
      if (last && last.year === card.year) {
        last.stackCount = (last.stackCount || 1) + 1;
      } else {
        groups.push({ ...card, stackCount: 1 });
      }
    }
    return groups;
  }, [sortedCards]);

  const scrollRef = useRef(null);
  const dropZoneRefs = useRef([]);
  const [touchOverZone, setTouchOverZone] = useState(null);

  const activeZone = touchOverZone !== null ? touchOverZone : (isDragMode ? selectedZone : null);

  const getZoneAtPoint = useCallback((x, y) => {
    for (let i = 0; i < dropZoneRefs.current.length; i++) {
      const el = dropZoneRefs.current[i];
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      // Expand hit area a bit
      if (x >= rect.left - 10 && x <= rect.right + 10 && y >= rect.top - 20 && y <= rect.bottom + 20) {
        return i;
      }
    }
    return null;
  }, []);

  useEffect(() => {
    if (externalTouchX == null || externalTouchY == null) {
      setTouchOverZone(null);
      return;
    }
    const zone = getZoneAtPoint(externalTouchX, externalTouchY);
    setTouchOverZone(zone);
    if (onExternalZoneChange) onExternalZoneChange(zone);
  }, [externalTouchX, externalTouchY, getZoneAtPoint, onExternalZoneChange]);

  useEffect(() => {
    if (!externalTouchEnd) return;
    const zone = getZoneAtPoint(externalTouchEnd.x, externalTouchEnd.y);
    setTouchOverZone(null);
    if (zone !== null && onPlaceCard) onPlaceCard(zone);
  }, [externalTouchEnd, getZoneAtPoint, onPlaceCard]);

  // Auto-scroll to end on new card
  useEffect(() => {
    if (!scrollRef.current) return;
    setTimeout(() => {
      scrollRef.current.scrollTo({ left: scrollRef.current.scrollWidth, behavior: 'smooth' });
    }, 80);
  }, [cards.length]);

  const totalZones = groupedCards.length + 1;
  const items = [];

  for (let i = 0; i < totalZones; i++) {
    items.push(
      <div
        key={`dz-${i}`}
        ref={el => (dropZoneRefs.current[i] = el)}
      >
        {activeZone === i ? (
          <GhostCard />
        ) : (
          <HorizontalDropZone
            index={i}
            isActive={selectedZone === i && !isDragMode}
            isDragMode={isDragMode}
            onDrop={onPlaceCard}
            onHover={onSelectZone}
          />
        )}
      </div>
    );

    if (i < groupedCards.length) {
      items.push(
        <TimelineCard
          key={`card-${i}`}
          card={groupedCards[i]}
          index={i}
        />
      );
    }
  }

  return (
    <div className="w-full flex flex-col items-start">
      {/* Scroll hints */}
      <div className="flex items-center gap-1 px-2 mb-1 w-full justify-between">
        <div className="flex items-center gap-1 text-white/40 text-xs font-inter">
          <ChevronLeft className="w-3 h-3" />
          <span>Daha eski</span>
        </div>
        <div className="flex items-center gap-1 text-white/40 text-xs font-inter">
          <span>Daha yeni</span>
          <ChevronRight className="w-3 h-3" />
        </div>
      </div>

      {/* Horizontal scroll timeline */}
      <div
        ref={scrollRef}
        className="flex flex-row items-center w-full overflow-x-auto py-2 px-2"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', justifyContent: 'center' }}
      >
        <style>{`.timeline-scroll::-webkit-scrollbar { display: none; }`}</style>
        {/* Connection line */}
        <div className="absolute h-0.5 bg-gradient-to-r from-cyan-500/0 via-cyan-400/60 to-cyan-500/0 pointer-events-none" style={{ width: '100%', zIndex: 0 }} />
        
        <div className="flex flex-row items-center gap-0 relative" style={{ minWidth: 'max-content' }}>
          {/* Background line */}
          <div className="absolute top-1/2 left-4 right-4 h-0.5 bg-gradient-to-r from-cyan-500/30 via-cyan-400/60 to-cyan-500/30 -translate-y-1/2 pointer-events-none rounded-full" />
          {items}
        </div>
      </div>
    </div>
  );
}