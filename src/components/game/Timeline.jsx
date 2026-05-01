import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import TimelineCard from './TimelineCard';
import DropZone from './DropZone';
import { Clock } from 'lucide-react';

// Mini preview card shown inline while dragging
function PreviewCard({ compact }) {
  return (
    <div className={`flex-shrink-0 flex flex-col items-center justify-center
      ${compact ? 'w-14 h-16' : 'w-20 h-20'}
      rounded-lg border-2 border-dashed border-primary bg-primary/20
      shadow-lg shadow-primary/30 animate-pulse`}
    >
      <Clock className={`${compact ? 'w-4 h-4' : 'w-5 h-5'} text-primary/70 mb-1`} />
      <span className={`font-cinzel font-bold text-primary/70 ${compact ? 'text-xs' : 'text-sm'}`}>?</span>
    </div>
  );
}

export default function Timeline({ cards = [], onPlaceCard, selectedZone, onSelectZone, isDragMode, externalTouchX, externalTouchY, externalTouchEnd, onExternalZoneChange }) {
  const sortedCards = cards && Array.isArray(cards) ? [...cards].sort((a, b) => a.year - b.year) : [];

  // Group consecutive cards with the same year into stacks
  const groupedCards = React.useMemo(() => {
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

  // Determine which zone to highlight/preview
  const activeZone = touchOverZone !== null ? touchOverZone : (isDragMode ? selectedZone : null);

  // External touch (from QuestionCard drag)
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

  // Auto-scroll
  useEffect(() => {
    if (!scrollRef.current) return;
    const el = scrollRef.current;
    setTimeout(() => {
      el.scrollTo({ left: el.scrollWidth, behavior: 'smooth' });
    }, 50);
  }, [cards.length]);

  const compact = cards.length > 4;

  // Build the rendered list: interleave dropzones, cards, and preview
  // When dragging (isDragMode || touchOverZone != null), show preview card at activeZone
  const items = [];
  const totalZones = groupedCards.length + 1;

  for (let i = 0; i < totalZones; i++) {
    // Drop zone hit area (invisible, only for detection)
    items.push(
      <div
        key={`dz-${i}`}
        ref={el => dropZoneRefs.current[i] = el}
        className="relative flex-shrink-0"
      >
        {/* Show preview card inline at this position when hovered */}
        {activeZone === i ? (
          <PreviewCard compact={compact} />
        ) : (
          <DropZone
            index={i}
            isActive={selectedZone === i && !isDragMode}
            onDrop={onPlaceCard}
            onHover={onSelectZone}
            isDragMode={isDragMode}
          />
        )}
      </div>
    );

    if (i < groupedCards.length) {
      items.push(
        <TimelineCard key={`card-${i}`} card={groupedCards[i]} index={i} compact={compact} />
      );
    }
  }

  const handleTouchMove = useCallback((e) => {
    if (!onSelectZone) return;
    const touch = e.touches[0];
    const zone = getZoneAtPoint(touch.clientX, touch.clientY);
    setTouchOverZone(zone);
  }, [onSelectZone, getZoneAtPoint]);

  const handleTouchEnd = useCallback((e) => {
    if (!onSelectZone) return;
    const touch = e.changedTouches[0];
    const zone = getZoneAtPoint(touch.clientX, touch.clientY);
    setTouchOverZone(null);
    if (zone !== null) onSelectZone(zone);
  }, [onSelectZone, getZoneAtPoint]);

  return (
    <div className="w-full">
      <div
        ref={scrollRef}
        className="flex items-center justify-start gap-1 overflow-x-auto py-3 px-2"
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {items}
      </div>
    </div>
  );
}