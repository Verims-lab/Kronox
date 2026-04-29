import React, { useRef, useEffect, useState, useCallback } from 'react';
import TimelineCard from './TimelineCard';
import DropZone from './DropZone';

export default function Timeline({ cards = [], onPlaceCard, selectedZone, onSelectZone, isDragMode }) {
  // onPlaceCard is used for drag-drop; onSelectZone is used for touch-drag within timeline
  const sortedCards = cards && Array.isArray(cards) ? [...cards].sort((a, b) => a.year - b.year) : [];
  const scrollRef = useRef(null);
  const dropZoneRefs = useRef([]);

  // Touch drag state
  const [touchOverZone, setTouchOverZone] = useState(null);

  useEffect(() => {
    if (!scrollRef.current) return;
    if (selectedZone === 0) {
      scrollRef.current.scrollTo({ left: 0, behavior: 'smooth' });
    } else if (selectedZone === sortedCards.length) {
      scrollRef.current.scrollTo({ left: scrollRef.current.scrollWidth, behavior: 'smooth' });
    }
  }, [selectedZone, sortedCards.length]);

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
        {[...Array(sortedCards.length + 1)].map((_, i) => (
          <React.Fragment key={i}>
            <div ref={el => dropZoneRefs.current[i] = el}>
              <DropZone
                index={i}
                isActive={selectedZone === i || touchOverZone === i}
                onDrop={onPlaceCard || onSelectZone}
                isDragMode={isDragMode}
              />
            </div>
            {i < sortedCards.length && (
              <TimelineCard card={sortedCards[i]} index={i} compact={cards.length > 4} />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}