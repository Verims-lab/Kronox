import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import TimelineCard from './TimelineCard.jsx';
import { motion, AnimatePresence } from 'framer-motion';
import { sounds } from '@/lib/gameSounds';
// Codex163 — Visual-only placement feedback overlay. Imported as a
// focused sibling component so Timeline's own logic stays untouched.
import PlacementFeedbackOverlay from './PlacementFeedbackOverlay.jsx';

function DotSeparator() {
  return (
    <div className="flex items-center gap-1 flex-shrink-0 px-1">
      <div className="w-1.5 h-1.5 rounded-full bg-white/40" />
      <div className="w-1.5 h-1.5 rounded-full bg-white/25" />
    </div>
  );
}

function DropZone({ index, isActive, isDragMode, isMagnetic, isBeginnerHint, onSelect, isTimeUp }) {
  const showBeginnerHint = Boolean(isBeginnerHint && isDragMode && !isActive && !isTimeUp);
  const borderColor = isTimeUp
    ? '#ef4444'
    : isActive
      ? '#facc15'
      : showBeginnerHint
        ? 'rgba(125,211,252,0.78)'
        : isMagnetic
          ? 'rgba(250,204,21,0.55)'
          : 'rgba(255,255,255,0.2)';
  const bgColor = isTimeUp
    ? 'rgba(239,68,68,0.06)'
    : isActive
      ? 'rgba(250,204,21,0.14)'
      : showBeginnerHint
        ? 'rgba(56,189,248,0.08)'
        : isMagnetic
          ? 'rgba(250,204,21,0.05)'
          : 'transparent';

  return (
    <div
      onClick={() => { if (onSelect) { sounds.tap(); onSelect(index); } }}
      className="flex-shrink-0 flex flex-col items-center justify-center cursor-pointer"
      style={{ width: isActive ? 88 : isMagnetic ? 70 : isDragMode ? 56 : 32, height: 108, position: 'relative', transition: 'width 0.15s ease' }}
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
      <motion.div
        animate={{
          scale: isActive ? 1 : (isMagnetic || showBeginnerHint) ? [1, showBeginnerHint ? 1.035 : 1.04, 1] : 1,
        }}
        transition={(isMagnetic || showBeginnerHint) && !isActive ? { duration: showBeginnerHint ? 1.15 : 0.7, repeat: Infinity, ease: 'easeInOut' } : {}}
        className="rounded-2xl flex items-center justify-center"
        style={{
          width: isActive ? 80 : isMagnetic ? 62 : isDragMode ? 48 : 26,
          height: 100,
          position: 'relative',
          border: `2px dashed ${borderColor}`,
          background: bgColor,
          boxShadow: isActive
            ? `0 0 24px rgba(250,204,21,0.5), inset 0 0 16px rgba(250,204,21,0.08)`
            : showBeginnerHint
              ? `0 0 16px rgba(56,189,248,0.34), inset 0 0 14px rgba(56,189,248,0.08)`
            : isMagnetic
              ? `0 0 12px rgba(250,204,21,0.25)`
              : 'none',
          transition: 'box-shadow 0.15s ease, border-color 0.15s ease, width 0.15s ease',
        }}
      >
        <AnimatePresence>
          {showBeginnerHint && (
            <motion.div
              aria-hidden="true"
              className="pointer-events-none rounded-2xl"
              initial={{ opacity: 0, scale: 0.86 }}
              animate={{ opacity: [0.18, 0.45, 0.18], scale: [0.9, 1.12, 0.9] }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 1.15, repeat: Infinity, ease: 'easeInOut' }}
              style={{
                position: 'absolute',
                inset: '-4px',
                border: '1px solid rgba(125,211,252,0.42)',
                boxShadow: '0 0 18px rgba(56,189,248,0.26)',
              }}
            />
          )}
        </AnimatePresence>
      </motion.div>
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
  // Codex163 — Visual-only placement feedback.
  // `placementFeedback` is shaped { result: 'correct'|'wrong', year, key }
  // and is consumed by PlacementFeedbackOverlay. It never affects sort,
  // hit-testing, or which cards are rendered.
  placementFeedback = null,
  beginnerPlacementHintZone = null,
}) {
  const sortedCards = useMemo(
    () => Array.isArray(cards) ? [...cards].sort((a, b) => a.year - b.year) : [],
    [cards]
  );
  const groupedCards = useMemo(() => sortedCards.map(c => ({ ...c, stackCount: 1 })), [sortedCards]);

  const scrollRef = useRef(null);
  const autoScrollRaf = useRef(null);
  const [activeZone, setActiveZone] = useState(null);
  // Codex163 — last drop-zone index captured at finger-lift time. We use
  // it to position the wrong-placement flash on the slot the user
  // actually dropped on. Stored in a ref + state mirror so the overlay
  // re-renders when the captured rect should update.
  const lastDropZoneRef = useRef(null);
  const [feedbackTargetRect, setFeedbackTargetRect] = useState(null);
  // Codex163 — Respect prefers-reduced-motion for shake/drift.
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const handler = (e) => setReducedMotion(e.matches);
    if (mq.addEventListener) mq.addEventListener('change', handler);
    else if (mq.addListener) mq.addListener(handler);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', handler);
      else if (mq.removeListener) mq.removeListener(handler);
    };
  }, []);
  // Card center distances from viewport center — stored in state, updated on scroll
  // (only N card positions, cheap to compute)
  const cardItemRefs = useRef([]);
  const [cardDistances, setCardDistances] = useState([]);

  const updateCardDistances = useCallback(() => {
    const scroll = scrollRef.current;
    if (!scroll) return;
    const vw = scroll.getBoundingClientRect().width;
    const viewportCenterX = scroll.scrollLeft + vw / 2;
    const dists = cardItemRefs.current.map((el) => {
      if (!el) return 0;
      const elRect = el.getBoundingClientRect();
      const containerRect = scroll.getBoundingClientRect();
      const elWorldCX = (elRect.left + elRect.right) / 2 - containerRect.left + scroll.scrollLeft;
      // Normalize: 0 = at center, 1 = one full viewport width away
      return Math.abs(elWorldCX - viewportCenterX) / (vw / 2);
    });
    setCardDistances(dists);
  }, []);

  // Update distances on scroll (passive, no drag impact)
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateCardDistances, { passive: true });
    updateCardDistances();
    return () => el.removeEventListener('scroll', updateCardDistances);
  }, [updateCardDistances, groupedCards.length]);

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
    if (zone !== activeZone && zone !== null) sounds.tick();
    setActiveZone(zone);
    if (onZoneChange) onZoneChange(zone);
  }, [dragClientX, dragClientY, isDragMode, getZoneAtClientX, startAutoScroll, stopAutoScroll, onZoneChange]);

  // ─── Process drag end (finger lift) ──────────────────────────────
  useEffect(() => {
    if (!dragEndEvent) return;
    stopAutoScroll();
    const zone = getZoneAtClientX(dragEndEvent.clientX);
    setActiveZone(null);
    // Codex163 — remember the drop zone purely so the visual feedback
    // overlay can find the right slot if this placement turns out
    // wrong. This does NOT influence onPlaceCard / placement logic.
    if (zone !== null) lastDropZoneRef.current = zone;
    if (zone !== null && onPlaceCard) { sounds.snap(); onPlaceCard(zone); }
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

  // Codex163 — Compute the overlay target rect whenever a new feedback
  // event arrives. Correct → find the just-inserted card by year in the
  // sorted timeline. Wrong → use the last drop zone the user released
  // on. Coordinates are relative to the scroll container's offsetParent
  // (the positioned `.relative.w-full` wrapper) so the overlay tracks
  // horizontal scroll without us having to listen to scroll events.
  useEffect(() => {
    if (!placementFeedback || !placementFeedback.result) {
      setFeedbackTargetRect(null);
      return;
    }
    const scroller = scrollRef.current;
    if (!scroller) return;
    const containerRect = scroller.getBoundingClientRect();

    let targetEl = null;
    if (placementFeedback.result === 'correct') {
      // sortedCards is the same array used to render cardItemRefs.
      const idx = sortedCards.findIndex((c) => c.year === placementFeedback.year);
      if (idx >= 0) targetEl = cardItemRefs.current[idx] || null;
    } else if (placementFeedback.result === 'wrong') {
      const zoneIdx = lastDropZoneRef.current;
      if (zoneIdx != null) targetEl = dropZoneRefs.current[zoneIdx] || null;
    }
    if (!targetEl) {
      setFeedbackTargetRect(null);
      return;
    }
    const r = targetEl.getBoundingClientRect();
    setFeedbackTargetRect({
      // Coordinates are relative to the scroll container (which is the
      // overlay's positioning parent). Add scrollLeft so the overlay
      // stays glued to the slot if the user scrolls during the flash.
      left: r.left - containerRect.left + scroller.scrollLeft,
      top: r.top - containerRect.top,
      width: r.width,
      height: r.height,
    });
  }, [placementFeedback, sortedCards]);

  // ─── Render ──────────────────────────────────────────────────────
  const displayActiveZone = isDragMode ? activeZone : null;
  const totalZones = groupedCards.length + 1;
  const cardRowItems = [];

  for (let i = 0; i < totalZones; i++) {
    const isThisActive = displayActiveZone === i;
    const isBeginnerHint = isDragMode
      && beginnerPlacementHintZone === i
      && displayActiveZone !== i
      && selectedZone !== i
      && !isTimeUp;
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
            isMagnetic={isDragMode && (activeZone === i - 1 || activeZone === i || activeZone === i + 1) && displayActiveZone !== i}
            isBeginnerHint={isBeginnerHint}
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
        <div key={`card-${i}`} ref={el => (cardItemRefs.current[i] = el)} className="flex flex-col items-center flex-shrink-0">
          <div className="flex flex-col items-center mb-0.5" style={{ height: 20 }}>
            <span className="font-inter font-semibold" style={{ fontSize: 11, color: '#facc15', lineHeight: 1 }}>
              {groupedCards[i].year}
            </span>
            <div className="w-px h-2 mt-0.5" style={{ background: '#facc15' }} />
          </div>
          <TimelineCard
            card={groupedCards[i]}
            index={i}
            distanceFromCenter={isDragMode ? 0 : (cardDistances[i] ?? 0)}
          />
        </div>
      );
      cardRowItems.push(<DotSeparator key={`dot-after-${i}`} />);
    }
  }

  return (
    <div className="w-full flex flex-col" style={{ paddingBottom: 24 }}>
      {/* ── Outer scroll container — position:relative lets center-vignette overlay work ── */}
      <div className="relative w-full">
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
          <div className="relative flex flex-col" style={{ minWidth: 'max-content', paddingLeft: 12, paddingRight: 24 }}>
            {/* Codex163 — Placement feedback overlay (visual-only).
                Lives INSIDE the scroll content so it inherits the same
                horizontal translation as the cards/drop zones. */}
            <PlacementFeedbackOverlay
              feedbackKey={placementFeedback ? `${placementFeedback.result}:${placementFeedback.year}:${placementFeedback.key ?? ''}` : null}
              result={placementFeedback?.result || null}
              targetRect={feedbackTargetRect}
              reducedMotion={reducedMotion}
            />
            {/* Ruler removed — no atmospheric era labels */}

            <div className="relative flex flex-row items-center" style={{ gap: 0 }}>
              {/* Timeline horizontal line */}
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

        {/* ── Center-focus vignette: fades edges, highlights center viewport ── */}
        {/* pointer-events:none — absolutely no effect on touch or hit-testing */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(to right, rgba(11,31,58,0.55) 0%, transparent 22%, transparent 78%, rgba(11,31,58,0.55) 100%)',
            zIndex: 2,
            transition: 'opacity 0.3s ease',
            opacity: isDragMode ? 0.3 : 1,
          }}
        />
        {/* Soft center beam — subtle warm glow in the middle third */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse 40% 60% at 50% 60%, rgba(250,204,21,0.04) 0%, transparent 100%)',
            zIndex: 1,
          }}
        />
      </div>
    </div>
  );
}
