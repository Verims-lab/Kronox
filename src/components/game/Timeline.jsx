import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import TimelineCard from './TimelineCard';
import DropZone from './DropZone';

export default function Timeline({ cards = [], onPlaceCard, selectedZone, onSelectZone, isDragMode, externalTouchX, externalTouchY, externalTouchEnd, onExternalZoneChange }) {
  // onPlaceCard is used for drag-drop; onSelectZone is used for touch-drag within timeline
  const sortedCards = cards && Array.isArray(cards) ? [...cards].sort((a, b) => a.year - b.year) : [];

  // Group consecutive cards with the same year into stacks for display
  // Each entry in groupedCards is the first card of that year + stackCount
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

  // Touch drag state
  const [touchOverZone, setTouchOverZone] = useState(null);

  // External touch (from QuestionCard drag) — coordinates piped in from Game.jsx
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

  useEffect(() => {
    if (!scrollRef.current) return;
    if (selectedZone === 0) {
      scrollRef.current.scrollTo({ left: 0, behavior: 'smooth' });
    } else if (selectedZone === groupedCards.length) {
      scrollRef.current.scrollTo({ left: scrollRef.current.scrollWidth, behavior: 'smooth' });
    }
  }, [selectedZone, groupedCards.length]);

  useEffect(() => {
    if (!scrollRef.current) return;
    const el = scrollRef.current;
    setTimeout(() => {
      el.scrollTo({ left: el.scrollWidth, behavior: 'smooth' });
    }, 50);
  }, [cards.length]);

  // Touch drag: find which drop zone the finger is over
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
    if (zone !== null) {
      onSelectZone(zone);
    }
  }, [onSelectZone, getZoneAtPoint]);

  return (
    <div className="w-full">
      <div
        ref={scrollRef}
        className="flex items-center justify-start gap-1 overflow-x-auto py-3 px-2"
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Drop zones and cards */}
        {[...Array(groupedCards.length + 1)].map((_, i) => (
          <React.Fragment key={i}>
            <div ref={el => dropZoneRefs.current[i] = el}>
              <DropZone
                index={i}
                isActive={selectedZone === i || touchOverZone === i}
                onDrop={onPlaceCard}
                onHover={onSelectZone}
                isDragMode={isDragMode}
              />
            </div>
            {i < groupedCards.length && (
              <TimelineCard card={groupedCards[i]} index={i} compact={cards.length > 4} />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}