import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import TimelineCard from './TimelineCard.jsx';
import { motion, AnimatePresence } from 'framer-motion';
import { sounds } from '@/lib/gameSounds';
// Codex163 — Visual-only placement feedback overlay. Imported as a
// focused sibling component so Timeline's own logic stays untouched.
import PlacementFeedbackOverlay from './PlacementFeedbackOverlay.jsx';

function DropZone({ index, isActive, isDragMode, isMagnetic, isBeginnerHint, isGuidedTarget, onSelect, isTimeUp, isEdgePeek }) {
  const showBeginnerHint = Boolean(isBeginnerHint && isDragMode && !isActive && !isTimeUp);
  const showGuidedTarget = Boolean(isGuidedTarget && !isActive && !isTimeUp);
  // Resting "+" insertion slot: only when the timeline is idle (no drag, not
  // the selected zone, no hint). Drag-mode sizing/hit-testing is untouched —
  // this purely affects the at-rest visual so the empty gap reads as a
  // card-sized "kart buraya gelecek" target.
  const showPlusSlot = Boolean(!isDragMode && !isActive && !isTimeUp && !showBeginnerHint && !showGuidedTarget);
  // At-rest outer slots (the first and last drop zones) render as a narrow
  // peek so the opening viewport shows: partial slot · card · full slot ·
  // card · partial slot. Middle resting slots stay full card-sized. Visual
  // only — never affects drag sizing or hit-testing.
  const showEdgePeek = Boolean(showPlusSlot && isEdgePeek);
  // 'left' edge slot (before first card) reveals its right portion; 'right'
  // edge slot (after last card) reveals its left portion.
  const peekSide = isEdgePeek === 'right' ? 'right' : 'left';
  const restingWrapperWidth = showEdgePeek ? 40 : 80;
  const restingBoxWidth = 72;
  // Cyan timeline slot visual contract. Idle/drag-available/hovered states use
  // the unified cyan palette; active-selection (yellow), guided, beginner, and
  // time-up states keep their existing tokens (Health/tutorial depend on them).
  const isHovered = isMagnetic; // valid slot the dragged card is over
  const borderColor = isTimeUp
    ? '#ef4444'
    : isActive
      ? '#facc15'
      : showGuidedTarget
        ? 'rgba(250,204,21,0.98)'
      : showBeginnerHint
        ? 'rgba(125,211,252,0.78)'
        : isHovered
          ? '#55D8FF'
          : isDragMode
            ? 'rgba(85,216,255,0.52)'
            : 'rgba(167,196,229,0.36)';
  const bgColor = isTimeUp
    ? 'rgba(239,68,68,0.06)'
    : isActive
      ? 'rgba(250,204,21,0.14)'
      : showGuidedTarget
        ? 'rgba(250,204,21,0.16)'
      : showBeginnerHint
        ? 'rgba(56,189,248,0.08)'
        : isHovered
          ? 'rgba(85,216,255,0.09)'
          : isDragMode
            ? 'rgba(85,216,255,0.035)'
            : 'rgba(255,255,255,0.015)';

  return (
    <div
      onClick={() => { if (onSelect) { sounds.tap(); onSelect(index); } }}
      className={`flex-shrink-0 flex flex-col cursor-pointer ${showEdgePeek ? (peekSide === 'right' ? 'items-start' : 'items-end') : 'items-center'} justify-center`}
      style={{ width: isActive ? 88 : isMagnetic ? 70 : isDragMode ? 56 : showPlusSlot ? restingWrapperWidth : 32, height: 108, position: 'relative', transition: 'width 0.15s ease', overflow: showEdgePeek ? 'hidden' : 'visible' }}
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
          scale: isActive ? 1 : (isMagnetic || showBeginnerHint || showGuidedTarget) ? [1, showGuidedTarget ? 1.055 : showBeginnerHint ? 1.035 : 1.04, 1] : 1,
        }}
        transition={(isMagnetic || showBeginnerHint || showGuidedTarget) && !isActive ? { duration: showGuidedTarget ? 1.2 : showBeginnerHint ? 1.15 : 0.7, repeat: Infinity, ease: 'easeInOut' } : {}}
        className="rounded-2xl flex items-center justify-center"
        style={{
          width: isActive ? 80 : isMagnetic ? 62 : isDragMode ? 48 : showPlusSlot ? restingBoxWidth : 26,
          height: showPlusSlot && !isActive && !isMagnetic && !isDragMode ? 108 : 100,
          position: 'relative',
          borderRadius: 16,
          border: isHovered ? `2px solid ${borderColor}` : `2px dashed ${borderColor}`,
          background: bgColor,
          boxShadow: isActive
            ? `0 0 24px rgba(250,204,21,0.5), inset 0 0 16px rgba(250,204,21,0.08)`
            : showGuidedTarget
              ? `0 0 30px rgba(250,204,21,0.66), 0 0 54px rgba(250,204,21,0.28), inset 0 0 18px rgba(250,204,21,0.16)`
            : showBeginnerHint
              ? `0 0 16px rgba(56,189,248,0.34), inset 0 0 14px rgba(56,189,248,0.08)`
            : isHovered
              ? `0 0 14px rgba(85,216,255,0.34), inset 0 0 16px rgba(85,216,255,0.09)`
            : showPlusSlot
              ? `inset 0 0 12px rgba(85,216,255,0.025)`
              : 'none',
          transition: 'box-shadow 0.15s ease, border-color 0.15s ease, width 0.15s ease',
        }}
      >
        {(showPlusSlot || (isDragMode && !isActive && !isTimeUp)) && (
          <span
            aria-hidden="true"
            className="pointer-events-none select-none"
            style={{
              fontFamily: "'Inter', sans-serif",
              fontWeight: 700,
              fontSize: 17,
              lineHeight: 1,
              color: isHovered
                ? '#A7ECFF'
                : isDragMode
                  ? 'rgba(167,236,255,0.80)'
                  : 'rgba(255,255,255,0.42)',
              transform: isHovered ? 'scale(1.12)' : 'none',
              animation: isHovered ? 'slotPulse 1.1s ease-in-out infinite' : 'none',
              textShadow: '0 0 10px rgba(85,216,255,0.18)',
            }}
          >
            +
          </span>
        )}
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
          {showGuidedTarget && (
            <motion.div
              aria-hidden="true"
              data-kronox-guided-correct-target-slot="true"
              className="pointer-events-none rounded-2xl"
              initial={{ opacity: 0, scale: 0.86 }}
              animate={{ opacity: [0.32, 0.88, 0.32], scale: [0.9, 1.2, 0.9] }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
              style={{
                position: 'absolute',
                inset: '-5px',
                border: '1px solid rgba(250,204,21,0.76)',
                boxShadow: '0 0 28px rgba(250,204,21,0.52)',
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
  guidedTargetZone = null,
  onGuidedTargetSlotPosition,
  guidedScrollHintActive = false,
  onGuidedScrollHintInteraction,
  correctStreak = 0,
  soloYearOnlyCards = false,
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

  const notifyGuidedScrollHintInteraction = useCallback((event) => {
    if (!onGuidedScrollHintInteraction) return;
    onGuidedScrollHintInteraction(`timeline_${event?.type || 'interaction'}`);
  }, [onGuidedScrollHintInteraction]);

  useEffect(() => {
    if (!guidedScrollHintActive || isDragMode || reducedMotion) return undefined;
    const scroller = scrollRef.current;
    if (!scroller) return undefined;

    const maxScroll = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
    if (maxScroll < 6) return undefined;

    const originalScroll = Math.max(0, Math.min(maxScroll, scroller.scrollLeft));
    const amplitude = Math.max(12, Math.min(76, maxScroll / 2.5));
    const center = Math.max(amplitude, Math.min(maxScroll - amplitude, originalScroll + amplitude));
    const startTime = performance.now();
    let frameId = 0;

    const loop = (now) => {
      const progress = ((now - startTime) % 2400) / 2400;
      const wave = Math.sin((progress - 0.25) * Math.PI * 2);
      scroller.scrollLeft = Math.max(0, Math.min(maxScroll, center + wave * amplitude));
      frameId = requestAnimationFrame(loop);
    };

    frameId = requestAnimationFrame(loop);
    return () => {
      if (frameId) cancelAnimationFrame(frameId);
    };
  }, [guidedScrollHintActive, groupedCards.length, isDragMode, reducedMotion]);

  // Codex — Guided tutorial: make the correct target slot VISIBLE.
  // During the placement step the correct drop zone may be offscreen on a
  // narrow timeline. We auto-scroll it horizontally into the centre so the
  // user (and the animated hand) can clearly see the exact placement
  // location. Tutorial-only: gated by guidedTargetZone, never runs in
  // normal play, and never fights an active drag (isDragMode).
  useEffect(() => {
    if (guidedTargetZone == null || isDragMode) return undefined;
    const scroller = scrollRef.current;
    if (!scroller) return undefined;
    let frame = 0;
    const align = () => {
      const target = dropZoneRefs.current[guidedTargetZone];
      if (!target) return;
      const containerRect = scroller.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const targetWorldCX = (targetRect.left + targetRect.right) / 2 - containerRect.left + scroller.scrollLeft;
      const desired = targetWorldCX - scroller.clientWidth / 2;
      const maxScroll = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
      const next = Math.max(0, Math.min(maxScroll, desired));
      if (Math.abs(next - scroller.scrollLeft) > 2) {
        scroller.scrollTo({ left: next, behavior: 'smooth' });
      }
    };
    // Defer one frame so refs/layout are settled, then keep aligned if the
    // timeline reflows (e.g. a card was just placed).
    frame = requestAnimationFrame(align);
    return () => { if (frame) cancelAnimationFrame(frame); };
  }, [guidedTargetZone, isDragMode, groupedCards.length]);

  // Codex — Report the guided target slot's live viewport-center X/Y so the
  // tutorial hand (rendered by GameLayout) can move INTO the real correct
  // slot instead of assuming dead screen-center. Recomputed on scroll +
  // animation frames while the guided target is active so it stays glued to
  // the slot even as the auto-scroll above centres it. Tutorial-only and
  // visual-only — never touches hit-testing (which reads finger coords).
  useEffect(() => {
    if (!onGuidedTargetSlotPosition) return undefined;
    if (guidedTargetZone == null) {
      onGuidedTargetSlotPosition(null);
      return undefined;
    }
    const scroller = scrollRef.current;
    if (!scroller) return undefined;
    let frame = 0;
    let lastX = null;
    const report = () => {
      const target = dropZoneRefs.current[guidedTargetZone];
      if (target) {
        const rect = target.getBoundingClientRect();
        const cx = (rect.left + rect.right) / 2;
        const cy = (rect.top + rect.bottom) / 2;
        if (lastX === null || Math.abs(cx - lastX) > 1) {
          lastX = cx;
          onGuidedTargetSlotPosition({ centerX: cx, centerY: cy });
        }
      }
      frame = requestAnimationFrame(report);
    };
    frame = requestAnimationFrame(report);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      onGuidedTargetSlotPosition(null);
    };
  }, [guidedTargetZone, groupedCards.length, onGuidedTargetSlotPosition]);

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
    const isGuidedTarget = guidedTargetZone === i
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
            isGuidedTarget={isGuidedTarget}
            onSelect={onSelectZone}
            isTimeUp={isTimeUp}
            isEdgePeek={i === 0 ? 'left' : (i === totalZones - 1 ? 'right' : false)}
          />
        </div>
      )}
      </div>
    );

    if (i < groupedCards.length) {
      cardRowItems.push(
        <div key={`card-${i}`} ref={el => (cardItemRefs.current[i] = el)} className="flex flex-col items-center flex-shrink-0">
          <div className="flex flex-col items-center mb-0.5" style={{ height: 20 }}>
            {!soloYearOnlyCards && (
              <span className="kronox-timeline-number" style={{ fontSize: 13, color: '#facc15', lineHeight: 1 }}>
                {groupedCards[i].year}
              </span>
            )}
            {/* Timeline node — sits over the main line connecting each card. */}
            <div
              className="mt-auto"
              style={{
                width: 9,
                height: 9,
                borderRadius: '9999px',
                background: '#173763',
                border: '2px solid #7EA9D6',
              }}
            />
          </div>
          <TimelineCard
            card={groupedCards[i]}
            index={i}
            distanceFromCenter={isDragMode ? 0 : (cardDistances[i] ?? 0)}
            yearOnly={soloYearOnlyCards}
          />
        </div>
      );
    }
  }

  return (
    <div className="w-full flex flex-col" style={{ paddingBottom: 24 }}>
      {/* ── Outer scroll container — position:relative lets center-vignette overlay work ── */}
      <div className="relative w-full">
        <div
          ref={scrollRef}
          className="kronox-timeline-horizontal-scroll w-full overflow-x-auto"
          onPointerDown={onGuidedScrollHintInteraction ? notifyGuidedScrollHintInteraction : undefined}
          onTouchStart={onGuidedScrollHintInteraction ? notifyGuidedScrollHintInteraction : undefined}
          onWheel={onGuidedScrollHintInteraction ? notifyGuidedScrollHintInteraction : undefined}
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            WebkitOverflowScrolling: 'touch',
            touchAction: isDragMode ? 'none' : 'pan-x',
          }}
        >
          <div className="relative flex flex-col items-center" style={{ minWidth: '100%', width: 'max-content', paddingLeft: 18, paddingRight: 18 }}>
            {/* Codex163 — Placement feedback overlay (visual-only).
                Lives INSIDE the scroll content so it inherits the same
                horizontal translation as the cards/drop zones. */}
            <PlacementFeedbackOverlay
              feedbackKey={placementFeedback ? `${placementFeedback.result}:${placementFeedback.year}:${placementFeedback.key ?? ''}` : null}
              result={placementFeedback?.result || null}
              targetRect={feedbackTargetRect}
              reducedMotion={reducedMotion}
              correctStreak={correctStreak}
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
                    : 'rgba(126,169,214,0.62)',
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