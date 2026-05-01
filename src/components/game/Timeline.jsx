import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import TimelineCard from './TimelineCard.jsx';
import { Clock } from 'lucide-react';

// Dikey drop zone — iki kart arasındaki yatay çizgi
function VerticalDropZone({ index, isActive, isDragMode, onDrop, onHover }) {
  const [isOver, setIsOver] = useState(false);
  const disabled = !onDrop && !onHover;
  const highlighted = isOver || isActive;

  const handleMouseEnter = () => { if (onHover) onHover(index); setIsOver(true); };
  const handleMouseLeave = () => setIsOver(false);
  const handleClick = () => { if (onDrop) onDrop(index); else if (onHover) onHover(index); };

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      className={`relative flex items-center justify-center w-full transition-all duration-150 ${disabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`}
      style={{ height: highlighted ? 52 : isDragMode ? 36 : 20 }}
    >
      <div className={`w-full rounded-full transition-all duration-150 ${
        highlighted
          ? 'h-1.5 bg-primary shadow-lg shadow-primary/50'
          : isDragMode
            ? 'h-0.5 bg-primary/40 animate-pulse'
            : 'h-px bg-border/40'
      }`} />
      {highlighted && (
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1 bg-primary text-primary-foreground text-xs font-cinzel px-3 py-1 rounded-full shadow-lg whitespace-nowrap">
          <Clock className="w-3 h-3" />
          Buraya yerleştir
        </div>
      )}
    </div>
  );
}

// Ghost preview card — drag sırasında zone'da gösterilir
function GhostCard() {
  return (
    <div className="w-full rounded-xl border-2 border-dashed border-primary bg-primary/10 shadow-lg shadow-primary/20 animate-pulse flex items-center gap-3 px-4 py-3">
      <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
        <Clock className="w-5 h-5 text-primary/60" />
      </div>
      <div className="flex-1 space-y-1.5">
        <div className="h-3 rounded bg-primary/20 w-10" />
        <div className="h-2 rounded bg-primary/10 w-20" />
      </div>
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
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
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

  // Auto-scroll to bottom on new card
  useEffect(() => {
    if (!scrollRef.current) return;
    setTimeout(() => {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }, 80);
  }, [cards.length]);

  const totalZones = groupedCards.length + 1;
  const items = [];

  for (let i = 0; i < totalZones; i++) {
    items.push(
      <div
        key={`dz-${i}`}
        ref={el => (dropZoneRefs.current[i] = el)}
        className="w-full px-2"
        style={{ minHeight: isDragMode ? 36 : 20 }}
      >
        {activeZone === i ? (
          <GhostCard />
        ) : (
          <VerticalDropZone
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
        <div key={`card-${i}`} className="w-full px-2">
          <TimelineCard card={groupedCards[i]} index={i} />
        </div>
      );
    }
  }

  return (
    <div
      ref={scrollRef}
      className="flex flex-col w-full h-full overflow-y-auto py-2"
    >
      {items}
    </div>
  );
}