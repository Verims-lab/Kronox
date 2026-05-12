import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import TimelineCard from './TimelineCard.jsx';
import { motion, AnimatePresence } from 'framer-motion';

function DotSeparator() {
  return (
    <div className="flex items-center gap-1 flex-shrink-0 px-1">
      <div className="w-1.5 h-1.5 rounded-full bg-white/40" />
      <div className="w-1.5 h-1.5 rounded-full bg-white/25" />
    </div>
  );
}

function DropZone({ index, isActive, isDragMode, onSelect, isTimeUp }) {
  const borderColor = isTimeUp ? '#ef4444' : isActive ? '#facc15' : 'rgba(255,255,255,0.2)';
  const bgColor = isTimeUp ? 'rgba(239,68,68,0.06)' : isActive ? 'rgba(250,204,21,0.08)' : 'transparent';

  return (
    <div
      onClick={() => onSelect && onSelect(index)}
      className="flex-shrink-0 flex flex-col items-center justify-center cursor-pointer transition-all duration-200"
      style={{ width: isActive ? 80 : isDragMode ? 56 : 32, height: 108, position: 'relative' }}
    >
      <AnimatePresence>
        {isActive && !isTimeUp && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute -bottom-5 left-1/2 -translate-x-1/2"
            style={{ zIndex: 20 }}
          >
            <svg width="20" height="18" viewBox="0 0 20 18" fill="none">
              <path d="M10 0L0 18h20L10 0z" fill="#facc15" opacity="0.9" />
            </svg>
          </motion.div>
        )}
      </AnimatePresence>
      <div
        className="rounded-2xl transition-all duration-200 flex items-center justify-center"
        style={{
          width: isActive ? 72 : isDragMode ? 48 : 26,
          height: 100,
          border: `2px dashed ${borderColor}`,
          background: bgColor,
          boxShadow: isActive ? `0 0 16px rgba(250,204,21,0.3), inset 0 0 12px rgba(250,204,21,0.05)` : 'none',
        }}
      />
    </div>
  );
}

function GhostCard() {
  return (
    <motion.div
      initial={{ scale: 0.85, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="flex-shrink-0 flex flex-col items-center justify-center rounded-2xl"
      style={{
        width: 80, height: 108,
        border: '2px dashed #facc15',
        background: 'rgba(250,204,21,0.06)',
        boxShadow: '0 0 20px rgba(250,204,21,0.25)',
      }}
    >
      <div className="w-10 h-2 rounded-full bg-yellow-400/20 mb-2" />
      <div className="w-8 h-2 rounded-full bg-yellow-400/15 mb-3" />
      <div className="w-12 h-4 rounded bg-yellow-400/20" />
    </motion.div>
  );
}

export default function Timeline({
  cards = [],
  onPlaceCard,
  selectedZone,
  onSelectZone,
  isDragMode,
  // World-coordinate drag props
  dragClientX,   // raw touch clientX (viewport)
  dragClientY,   // raw touch clientY (viewport)
  dragEndEvent,  // { clientX, clientY } on finger lift
  onZoneChange,  // called with zone index or null during drag
  isTimeUp = false,
  // expose scrollRef to parent for ghost card positioning
  scrollRefCallback,
}) {
  const sortedCards = useMemo(
    () => Array.isArray(cards) ? [...cards].sort((a, b) => a.year - b.year) : [],
    [cards]
  );
  const groupedCards = useMemo(() => sortedCards.map(c => ({ ...c, stackCount: 1 })), [sortedCards]);

  const scrollRef = useRef(null);
  const autoScrollRaf = useRef(null);
  const [activeZone, setActiveZone] = useState(null);

  // Expose scroll ref to parent (for ghost card offset)
  useEffect(() => {
    if (scrollRefCallback) scrollRefCallback(scrollRef);
  }, [scrollRefCallback]);

  // ─── World-coordinate hit testing ────────────────────────────────────
  // Drop zones are measured in WORLD space: worldX = rect.left + scrollLeft - containerLeft
  // This stays stable even as scrollLeft changes during auto-scroll.
  const dropZoneRefs = useRef([]);

  const getZoneAtClientX = useCallback((clientX) => {
    const scroll = scrollRef.current;
    if (!scroll) return null;
    const containerRect = scroll.getBoundingClientRect();
    // Convert finger viewport X to world X (relative to scroll content start)
    const worldX = clientX - containerRect.left + scroll.scrollLeft;

    let closest = null;
    let minDist = Infinity;

    for (let i = 0; i < dropZoneRefs.current.length; i++) {
      const el = dropZoneRefs.current[i];
      if (!el) continue;
      const elRect = el.getBoundingClientRect();
      // Convert element center to world X
      const elWorldCX = (elRect.left + elRect.right) / 2 - containerRect.left + scroll.scrollLeft;
      const dist = Math.abs(worldX - elWorldCX);
      if (dist < minDist) { minDist = dist; closest = i; }
    }
    return minDist < 120 ? closest : null;
  }, []);

  // ─── Auto-scroll with requestAnimationFrame ───────────────────────
  const stopAutoScroll = useCallback(() => {
    if (autoScrollRaf.current) {
      cancelAnimationFrame(autoScrollRaf.current);
      autoScrollRaf.current = null;
    }
  }, []);

  const startAutoScroll = useCallback((direction) => {
    stopAutoScroll();
    const step = () => {
      if (!scrollRef.current) return;
      scrollRef.current.scrollLeft += direction * 10;
      autoScrollRaf.current = requestAnimationFrame(step);
    };
    autoScrollRaf.current = requestAnimationFrame(step);
  }, [stopAutoScroll]);

  // ─── Process drag move ────────────────────────────────────────────
  useEffect(() => {
    if (dragClientX == null || !isDragMode) {
      setActiveZone(null);
      stopAutoScroll();
      return;
    }

    // Edge auto-scroll
    const scroll = scrollRef.current;
    if (scroll) {
      const rect = scroll.getBoundingClientRect();
      const edgeSize = 80;
      if (dragClientX < rect.left + edgeSize) {
        startAutoScroll(-1);
      } else if (dragClientX > rect.right - edgeSize) {
        startAutoScroll(1);
      } else {
        stopAutoScroll();
      }
    }

    const zone = getZoneAtClientX(dragClientX);
    setActiveZone(zone);
    if (onZoneChange) onZoneChange(zone);
  }, [dragClientX, dragClientY, isDragMode, getZoneAtClientX, startAutoScroll, stopAutoScroll, onZoneChange]);

  // ─── Process drag end (finger lift) ──────────────────────────────
  useEffect(() => {
    if (!dragEndEvent) return;
    stopAutoScroll();
    const zone = getZoneAtClientX(dragEndEvent.clientX);
    setActiveZone(null);
    if (zone !== null && onPlaceCard) onPlaceCard(zone);
  }, [dragEndEvent, getZoneAtClientX, onPlaceCard, stopAutoScroll]);

  // Stop auto-scroll when drag mode ends
  useEffect(() => {
    if (!isDragMode) {
      stopAutoScroll();
      setActiveZone(null);
    }
  }, [isDragMode, stopAutoScroll]);

  // Cleanup on unmount
  useEffect(() => () => stopAutoScroll(), [stopAutoScroll]);

  // Reset scroll on new card placed
  const prevCardCount = useRef(cards.length);
  useEffect(() => {
    if (!scrollRef.current) return;
    if (prevCardCount.current !== cards.length) {
      prevCardCount.current = cards.length;
      setTimeout(() => { if (scrollRef.current) scrollRef.current.scrollLeft = 0; }, 50);
    }
  }, [cards.length]);

  // ─── Render ──────────────────────────────────────────────────────
  const displayActiveZone = isDragMode ? activeZone : null;
  const totalZones = groupedCards.length + 1;
  const cardRowItems = [];

  for (let i = 0; i < totalZones; i++) {
    const isThisActive = displayActiveZone === i;
    cardRowItems.push(
      <div key={`dz-${i}`} ref={el => (dropZoneRefs.current[i] = el)}>
        {isThisActive ? (
          <div className="flex flex-col items-center">
            <div style={{ height: 20 }} />
            <GhostCard />
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <div style={{ height: 20 }} />
            <DropZone
              index={i}
              isActive={selectedZone === i && !isDragMode}
              isDragMode={isDragMode}
              onSelect={onSelectZone}
              isTimeUp={isTimeUp}
            />
          </div>
        )}
      </div>
    );

    if (i < groupedCards.length) {
      cardRowItems.push(<DotSeparator key={`dot-${i}`} />);
      cardRowItems.push(
        <div key={`card-${i}`} className="flex flex-col items-center flex-shrink-0">
          <div className="flex flex-col items-center mb-0.5" style={{ height: 20 }}>
            <span className="font-inter font-semibold" style={{ fontSize: 11, color: '#facc15', lineHeight: 1 }}>
              {groupedCards[i].year}
            </span>
            <div className="w-px h-2 mt-0.5" style={{ background: '#facc15' }} />
          </div>
          <TimelineCard card={groupedCards[i]} index={i} />
        </div>
      );
      cardRowItems.push(<DotSeparator key={`dot-after-${i}`} />);
    }
  }

  return (
    <div className="w-full flex flex-col" style={{ paddingBottom: 24 }}>
      <div
        ref={scrollRef}
        className="w-full overflow-x-auto"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch',
          // Allow pan-x normally; disable only vertical scroll during drag to avoid page scroll
          touchAction: isDragMode ? 'none' : 'pan-x',
        }}
      >
        <div className="relative flex flex-col" style={{ minWidth: 'max-content', paddingLeft: 12, paddingRight: 24 }}>
          <div className="relative flex flex-row items-center" style={{ gap: 0 }}>
            <div
              className="absolute left-0 right-0 pointer-events-none"
              style={{
                top: 20 + 54,
                height: 2,
                background: isTimeUp
                  ? 'linear-gradient(to right, rgba(239,68,68,0.15), rgba(239,68,68,0.6), rgba(239,68,68,0.15))'
                  : 'linear-gradient(to right, rgba(250,204,21,0.05), rgba(250,204,21,0.4), rgba(250,204,21,0.05))',
                zIndex: 0,
              }}
            />
            {cardRowItems}
          </div>
        </div>
      </div>
    </div>
  );
}