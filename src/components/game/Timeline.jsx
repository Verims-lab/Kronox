import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import TimelineCard from './TimelineCard.jsx';

// Year axis tick
function YearTick({ year }) {
  return (
    <div className="flex flex-col items-center flex-shrink-0" style={{ minWidth: 48 }}>
      <span className="font-inter text-white/50" style={{ fontSize: 9 }}>{year}</span>
      <div className="w-px h-2 bg-white/30 mt-0.5" />
    </div>
  );
}

// Drop zone between cards — shows yellow arrow indicator when active
function DropZone({ index, isActive, isDragMode, onDrop, onHover, refProp, isTimeUp }) {
  const [isOver, setIsOver] = useState(false);
  const highlighted = isOver || isActive;

  const handleMouseEnter = () => { if (onHover) onHover(index); setIsOver(true); };
  const handleMouseLeave = () => setIsOver(false);
  const handleClick = () => { if (onDrop) onDrop(index); else if (onHover) onHover(index); };

  const borderColor = isTimeUp ? '#ef4444' : highlighted ? '#facc15' : isDragMode ? 'rgba(250,204,21,0.4)' : 'rgba(255,255,255,0.15)';
  const bgColor = isTimeUp ? 'rgba(239,68,68,0.08)' : highlighted ? 'rgba(250,204,21,0.12)' : isDragMode ? 'rgba(250,204,21,0.04)' : 'rgba(255,255,255,0.03)';

  return (
    <div
      ref={refProp}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      className="relative flex-shrink-0 flex flex-col items-center justify-center cursor-pointer transition-all duration-150"
      style={{ width: highlighted ? 72 : isDragMode ? 52 : 28, height: 88 }}
    >
      {/* Arrow indicator above zone when active */}
      {highlighted && !isTimeUp && (
        <div
          className="absolute -top-4 left-1/2 -translate-x-1/2 flex flex-col items-center"
          style={{ zIndex: 10 }}
        >
          <svg width="16" height="14" viewBox="0 0 16 14" fill="none">
            <path d="M8 14L0 0h16L8 14z" fill="#facc15" opacity="0.9" />
          </svg>
        </div>
      )}

      <div
        className="rounded-xl border-dashed transition-all duration-150 flex items-center justify-center"
        style={{
          width: highlighted ? 64 : isDragMode ? 44 : 22,
          height: 80,
          borderWidth: highlighted ? 2 : 1.5,
          borderStyle: 'dashed',
          borderColor,
          background: bgColor,
          boxShadow: highlighted ? `0 0 12px rgba(250,204,21,0.25)` : 'none',
        }}
      >
        {isDragMode && !highlighted && (
          <div className="w-0.5 h-6 rounded-full bg-white/20" />
        )}
      </div>
    </div>
  );
}

// Ghost card preview shown in the active drop zone during drag
function GhostCard() {
  return (
    <div
      className="flex-shrink-0 flex flex-col items-center justify-center rounded-xl"
      style={{
        width: 72,
        height: 88,
        border: '1.5px dashed #facc15',
        background: 'rgba(250,204,21,0.08)',
        boxShadow: '0 0 14px rgba(250,204,21,0.3)',
      }}
    >
      <div className="w-8 h-3 rounded bg-yellow-400/30 mb-1.5" />
      <div className="w-10 h-2 rounded bg-yellow-400/20 mb-1" />
      <div className="w-7 h-4 rounded bg-yellow-400/25" />
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
  isTimeUp = false,
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
      if (x >= rect.left - 12 && x <= rect.right + 12 && y >= rect.top - 24 && y <= rect.bottom + 24) {
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

  // Auto-scroll to show latest card
  useEffect(() => {
    if (!scrollRef.current) return;
    setTimeout(() => {
      scrollRef.current.scrollTo({ left: scrollRef.current.scrollWidth, behavior: 'smooth' });
    }, 100);
  }, [cards.length]);

  // Build year axis ticks from card years
  const yearTicks = useMemo(() => {
    if (groupedCards.length === 0) return [];
    const years = groupedCards.map(c => c.year);
    const minY = Math.floor(Math.min(...years) / 10) * 10 - 10;
    const maxY = Math.ceil(Math.max(...years) / 10) * 10 + 10;
    const ticks = [];
    for (let y = minY; y <= maxY; y += 10) ticks.push(y);
    return ticks;
  }, [groupedCards]);

  const totalZones = groupedCards.length + 1;
  const items = [];

  for (let i = 0; i < totalZones; i++) {
    items.push(
      <div key={`dz-${i}`} ref={el => (dropZoneRefs.current[i] = el)}>
        {activeZone === i ? (
          <GhostCard />
        ) : (
          <DropZone
            index={i}
            isActive={selectedZone === i && !isDragMode}
            isDragMode={isDragMode}
            onDrop={onPlaceCard}
            onHover={onSelectZone}
            isTimeUp={isTimeUp}
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
    <div className="w-full flex flex-col">
      {/* Year axis (only shown when cards exist) */}
      {yearTicks.length > 0 && (
        <div className="w-full overflow-hidden px-3 mb-1">
          <div className="flex flex-row items-start gap-0 justify-center" style={{ minWidth: 'max-content', margin: '0 auto' }}>
            {yearTicks.map(y => <YearTick key={y} year={y} />)}
          </div>
        </div>
      )}

      {/* Cards + drop zones */}
      <div
        ref={scrollRef}
        className="w-full overflow-x-auto"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        <div
          className="relative flex flex-row items-center mx-auto px-2"
          style={{ minWidth: 'max-content', gap: 0 }}
        >
          {/* Horizontal line behind cards */}
          <div
            className="absolute top-1/2 left-4 right-4 -translate-y-1/2 pointer-events-none rounded-full"
            style={{
              height: 2,
              background: isTimeUp
                ? 'linear-gradient(to right, rgba(239,68,68,0.1), rgba(239,68,68,0.5), rgba(239,68,68,0.1))'
                : 'linear-gradient(to right, rgba(250,204,21,0.05), rgba(250,204,21,0.35), rgba(250,204,21,0.05))',
              zIndex: 0,
            }}
          />
          {items}
        </div>
      </div>

      {/* Scroll hint */}
      {groupedCards.length > 3 && (
        <div className="flex justify-center mt-1">
          <span className="font-inter text-white/25" style={{ fontSize: 9 }}>← kaydır →</span>
        </div>
      )}
    </div>
  );
}