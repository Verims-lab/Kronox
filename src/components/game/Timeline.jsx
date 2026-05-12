import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import TimelineCard from './TimelineCard.jsx';
import { motion, AnimatePresence } from 'framer-motion';


// Separator noktalar kartlar arasında
function DotSeparator() {
  return (
    <div className="flex items-center gap-1 flex-shrink-0 px-1">
      <div className="w-1.5 h-1.5 rounded-full bg-white/40" />
      <div className="w-1.5 h-1.5 rounded-full bg-white/25" />
    </div>
  );
}

// Drop zone — sarı kesik çizgili kutu, ok animasyonu
function DropZone({ index, isActive, isDragMode, onSelect, isTimeUp, refProp }) {
  const highlighted = isActive;
  const borderColor = isTimeUp ? '#ef4444' : highlighted ? '#facc15' : 'rgba(255,255,255,0.2)';
  const bgColor = isTimeUp ? 'rgba(239,68,68,0.06)' : highlighted ? 'rgba(250,204,21,0.08)' : 'transparent';

  return (
    <div
      ref={refProp}
      onClick={() => onSelect && onSelect(index)}
      className="flex-shrink-0 flex flex-col items-center justify-center cursor-pointer transition-all duration-200"
      style={{
        width: highlighted ? 80 : isDragMode ? 56 : 32,
        height: 108,
        position: 'relative',
      }}
    >
      {/* Aşağıdan gelen ok — sadece highlighted ve timeup değilken */}
      <AnimatePresence>
        {highlighted && !isTimeUp && (
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
          width: highlighted ? 72 : isDragMode ? 48 : 26,
          height: 100,
          border: `2px dashed ${borderColor}`,
          background: bgColor,
          boxShadow: highlighted ? `0 0 16px rgba(250,204,21,0.3), inset 0 0 12px rgba(250,204,21,0.05)` : 'none',
        }}
      />
    </div>
  );
}

// Ghost kutu — sürükleme sırasında aktif zone'da gösterilir
function GhostCard() {
  return (
    <motion.div
      initial={{ scale: 0.85, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="flex-shrink-0 flex flex-col items-center justify-center rounded-2xl"
      style={{
        width: 80,
        height: 108,
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
  externalTouchX,
  externalTouchY,
  externalTouchEnd,
  onExternalZoneChange,
  isTimeUp = false,
}) {
  const sortedCards = useMemo(
    () => Array.isArray(cards) ? [...cards].sort((a, b) => a.year - b.year) : [],
    [cards]
  );

  // Her kart ayrı gösterilir — stacking yok
  const groupedCards = useMemo(() => sortedCards.map(c => ({ ...c, stackCount: 1 })), [sortedCards]);

  const scrollRef = useRef(null);
  const dropZoneRefs = useRef([]);
  const [touchOverZone, setTouchOverZone] = useState(null);

  const activeZone = isDragMode
    ? (touchOverZone !== null ? touchOverZone : selectedZone)
    : null;

  const getZoneAtPoint = useCallback((x, y) => {
    // Önce tam isabet
    for (let i = 0; i < dropZoneRefs.current.length; i++) {
      const el = dropZoneRefs.current[i];
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (x >= rect.left - 24 && x <= rect.right + 24 && y >= rect.top - 60 && y <= rect.bottom + 60) {
        return i;
      }
    }
    // Yatay en yakın zone'u bul (y ekseni esnekse)
    let closest = null;
    let minDist = Infinity;
    for (let i = 0; i < dropZoneRefs.current.length; i++) {
      const el = dropZoneRefs.current[i];
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      const cx = (rect.left + rect.right) / 2;
      const dist = Math.abs(x - cx);
      if (dist < minDist) { minDist = dist; closest = i; }
    }
    return minDist < 80 ? closest : null;
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

  // Kart sayısı değişince scroll'u sola sıfırla — tüm kartlar görünsün
  const prevCardCount = useRef(cards.length);
  useEffect(() => {
    if (!scrollRef.current) return;
    if (prevCardCount.current !== cards.length) {
      prevCardCount.current = cards.length;
      // Kısa gecikme sonrası scroll'u en sola al ki yeni yerleşen kart görünsün
      setTimeout(() => {
        if (scrollRef.current) scrollRef.current.scrollLeft = 0;
      }, 50);
    }
  }, [cards.length]);

  const totalZones = groupedCards.length + 1;

  // Build card row items — yıl etiketi her kartın ÜSTÜNDE
  const cardRowItems = [];
  for (let i = 0; i < totalZones; i++) {
    const isThisActive = activeZone === i;
    cardRowItems.push(
      <div key={`dz-${i}`} ref={el => (dropZoneRefs.current[i] = el)}>
        {isThisActive ? (
          // ghost card — yıl etiketi yok
          <div className="flex flex-col items-center">
            <div style={{ height: 20 }} />
            <GhostCard />
          </div>
        ) : (
          // drop zone — yıl etiketi yok
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
      // Kart + yıl etiketi üstte
      cardRowItems.push(
        <div key={`card-${i}`} className="flex flex-col items-center flex-shrink-0">
          {/* Yıl etiketi — kartın tam üstünde */}
          <div className="flex flex-col items-center mb-0.5" style={{ height: 20 }}>
            <span className="font-inter font-semibold" style={{ fontSize: 11, color: '#facc15', lineHeight: 1 }}>
              {groupedCards[i].year}
            </span>
            <div className="w-px h-2 mt-0.5" style={{ background: '#facc15' }} />
          </div>
          <TimelineCard
            card={groupedCards[i]}
            index={i}
          />
        </div>
      );
      cardRowItems.push(<DotSeparator key={`dot-after-${i}`} />);
    }
  }

  return (
    <div className="w-full flex flex-col" style={{ paddingBottom: 24 }}>
      {/* Scroll container */}
      <div
        ref={scrollRef}
        className="w-full overflow-x-auto"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch',
          touchAction: isDragMode ? 'none' : 'pan-x',
        }}
      >
        <div
          className="relative flex flex-col"
          style={{ minWidth: 'max-content', paddingLeft: 12, paddingRight: 24 }}
        >
          {/* Timeline line + cards row */}
          <div className="relative flex flex-row items-center" style={{ gap: 0 }}>
            {/* Horizontal line */}
            <div
              className="absolute left-0 right-0 pointer-events-none"
              style={{
                top: 20 + 54, // yıl label yüksekliği + kartın yarısı
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