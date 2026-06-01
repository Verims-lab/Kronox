import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Lock, Star } from 'lucide-react';

/**
 * Scrollable Solo "Seviye" path.
 *
 * Visual direction (matches the target Solo reference image):
 *   • Long vertical road, slim circular nodes alternating between two
 *     horizontal lanes so the path reads like an S-curve.
 *   • Dashed segment between consecutive nodes.
 *   • Locked nodes = subtle outlined circle with the number.
 *   • Completed nodes = outlined circle with the number + earned stars.
 *   • The current/next playable seviye is the visual hero: large yellow
 *     glowing disc with a "SIRADAKİ N. SEVİYE" pill to the side.
 *
 * Scrolling
 *   • Seviye 1 sits at the bottom of the scroll content; numbers grow
 *     upward as the user scrolls up.
 *   • On mount we auto-scroll the focused seviye into the centre of the
 *     viewport so a returning player doesn't land on Seviye 1 or at the
 *     very top.
 *
 * Performance
 *   • Catalog can be up to 1000 entries. We render a window of ~80 levels
 *     around the focus point so the DOM stays cheap while the perceived
 *     path is effectively infinite. The user can scroll, and when the
 *     focus point changes (e.g. after completing a level) the window
 *     re-anchors.
 */
const NODE_SIZE = 44;            // px — small node circles (per reference)
const HERO_NODE_SIZE = 64;       // px — highlighted "sıradaki" node
const ROW_HEIGHT = 84;           // px — vertical spacing between nodes
const VIEW_WINDOW = 80;          // how many levels to keep mounted at once

// Two-lane S-curve. The path snakes left-right between these two columns.
const LANE_LEFT = '34%';
const LANE_RIGHT = '66%';
function laneForLevel(levelNumber) {
  return levelNumber % 2 === 0 ? LANE_RIGHT : LANE_LEFT;
}

export default function LevelMapPath({
  levels,
  focusLevelNumber,
  onSelectLevel,
  bottomReservedPx = 96,
}) {
  // We render top → bottom in JSX, but display HIGH levels at the top and
  // LOW levels at the bottom.
  const totalCount = levels.length;
  const focus = Math.max(1, Math.min(totalCount, Number(focusLevelNumber) || 1));

  // Windowed slice around the focus point. Always includes the focus level
  // plus ~half the window on each side.
  const [windowCenter, setWindowCenter] = useState(focus);
  useEffect(() => { setWindowCenter(focus); }, [focus]);

  const { windowed, windowStart, windowEnd } = useMemo(() => {
    const half = Math.floor(VIEW_WINDOW / 2);
    const start = Math.max(1, windowCenter - half);
    const end = Math.min(totalCount, start + VIEW_WINDOW - 1);
    const adjStart = Math.max(1, end - VIEW_WINDOW + 1);
    const slice = levels.slice(adjStart - 1, end);
    // Reverse for top-down DOM rendering.
    return {
      windowed: [...slice].reverse(),
      windowStart: adjStart,
      windowEnd: end,
    };
  }, [levels, windowCenter, totalCount]);

  // Auto-scroll the focus level into the centre of the viewport on mount
  // and whenever the focus changes (e.g. after a level attempt).
  const containerRef = useRef(null);
  const focusedNodeRef = useRef(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const node = focusedNodeRef.current;
    if (!container || !node) return;

    let rafId = 0;
    const settle = () => {
      const containerRect = container.getBoundingClientRect();
      const nodeRect = node.getBoundingClientRect();
      if (container.clientHeight === 0) {
        rafId = requestAnimationFrame(settle);
        return;
      }
      const visibleHeight = container.clientHeight - bottomReservedPx;
      const delta = nodeRect.top - containerRect.top - visibleHeight / 2 + nodeRect.height / 2;
      container.scrollTop = Math.max(0, container.scrollTop + delta);
    };
    rafId = requestAnimationFrame(settle);
    return () => cancelAnimationFrame(rafId);
  }, [focus, windowStart, windowEnd, bottomReservedPx]);

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-y-auto kx-contained-scroll"
      style={{
        flex: 1,
        minHeight: 0,
        WebkitOverflowScrolling: 'touch',
        scrollBehavior: 'smooth',
        paddingTop: '1rem',
        paddingBottom: `${bottomReservedPx}px`,
      }}
      aria-label="Solo Seviye Yolu"
    >
      <div
        className="relative mx-auto w-full"
        style={{ maxWidth: '28rem' }}
      >
        {/* Headroom hint when there are still locked levels above the window */}
        {windowEnd < totalCount && (
          <div className="mb-3 text-center font-inter text-[10px] uppercase tracking-[0.28em] text-blue-100/45">
            ▲ Daha fazla seviye yukarıda
          </div>
        )}

        {windowed.map((level, displayIdx) => {
          const isFocus = level.levelNumber === focus;
          const isLast = displayIdx === windowed.length - 1;
          // The next-displayed level (in DOM order) is the one BELOW the
          // current one in the player's journey.
          const nextLevel = !isLast ? windowed[displayIdx + 1] : null;
          return (
            <PathRow
              key={level.levelNumber}
              level={level}
              nextLevel={nextLevel}
              isFocus={isFocus}
              focusedNodeRef={isFocus ? focusedNodeRef : null}
              onSelect={() => onSelectLevel(level)}
            />
          );
        })}

        {/* Bottom hint — only when the window starts at Level 1 */}
        {windowStart === 1 && (
          <div className="mt-3 text-center font-inter text-[10px] uppercase tracking-[0.28em] text-blue-100/45">
            Yolculuk başlıyor ▼
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────── */
/*  Row + connector                                                    */
/* ─────────────────────────────────────────────────────────────────── */

function PathRow({ level, nextLevel, isFocus, focusedNodeRef, onSelect }) {
  const fromLeft = laneForLevel(level.levelNumber);
  const toLeft = nextLevel ? laneForLevel(nextLevel.levelNumber) : null;

  return (
    <div className="relative" style={{ height: `${ROW_HEIGHT}px` }}>
      {/* Dashed S-curve connector down to the next-displayed node */}
      {nextLevel && (
        <PathConnector fromLeft={fromLeft} toLeft={toLeft} />
      )}

      {/* Node, positioned on its lane */}
      <div
        ref={focusedNodeRef || undefined}
        className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{ left: fromLeft }}
      >
        {isFocus ? (
          <CurrentSeviyeNode level={level} onSelect={onSelect} laneSide={fromLeft === LANE_LEFT ? 'left' : 'right'} />
        ) : (
          <SmallSeviyeNode level={level} onSelect={onSelect} />
        )}
      </div>
    </div>
  );
}

/**
 * Dashed connector between two consecutive node centres. Drawn as an SVG
 * cubic curve so the path feels like a soft S-curve, not a straight zig-zag.
 */
function PathConnector({ fromLeft, toLeft }) {
  const fromX = pctToNum(fromLeft);
  const toX = pctToNum(toLeft);
  // Cubic control points pulled toward the middle vertically so the line
  // bows nicely between lanes.
  const c1x = fromX;
  const c1y = 70;
  const c2x = toX;
  const c2y = 30 + 100; // travels into the next row below
  return (
    <svg
      aria-hidden="true"
      className="absolute"
      style={{
        left: 0,
        right: 0,
        // Extend the SVG into the next row so the connector reaches the
        // next node's centre.
        top: '50%',
        height: `${ROW_HEIGHT}px`,
        width: '100%',
        pointerEvents: 'none',
        overflow: 'visible',
      }}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      <path
        d={`M ${fromX} 0 C ${c1x} ${c1y}, ${c2x} ${c2y - 100}, ${toX} 100`}
        fill="none"
        stroke="rgba(148,170,210,0.45)"
        strokeWidth="1.4"
        strokeDasharray="3 5"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────────── */
/*  Nodes                                                              */
/* ─────────────────────────────────────────────────────────────────── */

/**
 * Small node for locked + completed seviyeler. Outlined circle, slim,
 * carries the number and (when completed) earned stars below it.
 */
function SmallSeviyeNode({ level, onSelect }) {
  const { levelNumber, status, stars } = level;
  const isLocked = status === 'locked';
  const isCompleted = status === 'completed';

  return (
    <motion.button
      type="button"
      onClick={isLocked ? undefined : onSelect}
      disabled={isLocked}
      whileTap={isLocked ? undefined : { scale: 0.92 }}
      className="relative flex flex-col items-center disabled:cursor-not-allowed"
      style={{ touchAction: 'manipulation' }}
      aria-label={`${levelNumber}. Seviye${isLocked ? ' (kilitli)' : isCompleted ? ' (tamamlandı)' : ''}`}
    >
      <div
        className="flex items-center justify-center rounded-full font-inter font-bold"
        style={{
          width: `${NODE_SIZE}px`,
          height: `${NODE_SIZE}px`,
          fontSize: '15px',
          background: 'rgba(12,22,48,0.85)',
          color: isLocked ? 'rgba(226,232,240,0.55)' : '#f1f5ff',
          boxShadow: isCompleted
            ? 'inset 0 0 0 1.5px rgba(250,204,21,0.55), 0 0 8px rgba(250,204,21,0.18)'
            : 'inset 0 0 0 1.5px rgba(148,170,210,0.55)',
        }}
      >
        {isLocked ? <Lock className="h-4 w-4" strokeWidth={2.4} /> : <span>{levelNumber}</span>}
      </div>

      {/* Stars below completed nodes (always visible — small, no clutter) */}
      {isCompleted && (
        <div className="mt-1 flex items-center gap-0.5" aria-label={`${stars} yıldız`}>
          {[1, 2, 3].map((i) => {
            const filled = i <= stars;
            return (
              <Star
                key={i}
                className="h-2.5 w-2.5"
                strokeWidth={1.8}
                style={{
                  color: filled ? '#facc15' : 'rgba(226,232,240,0.25)',
                  fill: filled ? '#facc15' : 'transparent',
                }}
              />
            );
          })}
        </div>
      )}
    </motion.button>
  );
}

/**
 * Hero node — the "SIRADAKİ N. SEVİYE" highlight that matches the target
 * reference. Yellow glowing disc with a side pill announcing "SIRADAKİ
 * N. SEVİYE". Pill flips to the opposite lane side so it never falls off
 * screen on either lane.
 */
function CurrentSeviyeNode({ level, onSelect, laneSide }) {
  const pillSide = laneSide === 'left' ? 'right' : 'left';
  return (
    <div className="relative flex items-center" style={{ height: `${HERO_NODE_SIZE}px` }}>
      <motion.button
        type="button"
        onClick={onSelect}
        whileTap={{ scale: 0.96 }}
        animate={{
          boxShadow: [
            '0 0 0 4px rgba(250,204,21,0.18), 0 0 24px rgba(250,204,21,0.55), inset 0 2px 0 rgba(255,255,255,0.55), inset 0 -8px 10px rgba(140,80,8,0.5)',
            '0 0 0 6px rgba(250,204,21,0.28), 0 0 40px rgba(250,204,21,0.85), inset 0 2px 0 rgba(255,255,255,0.55), inset 0 -8px 10px rgba(140,80,8,0.5)',
            '0 0 0 4px rgba(250,204,21,0.18), 0 0 24px rgba(250,204,21,0.55), inset 0 2px 0 rgba(255,255,255,0.55), inset 0 -8px 10px rgba(140,80,8,0.5)',
          ],
        }}
        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
        className="relative flex items-center justify-center rounded-full font-bangers"
        style={{
          width: `${HERO_NODE_SIZE}px`,
          height: `${HERO_NODE_SIZE}px`,
          fontSize: '26px',
          background: 'radial-gradient(circle at 35% 28%, #ffe066, #b97a06 75%)',
          color: '#231405',
          touchAction: 'manipulation',
        }}
        aria-label={`Sıradaki ${level.levelNumber}. Seviye — Oyna`}
      >
        {level.levelNumber}
      </motion.button>

      {/* Side pill — "SIRADAKİ / N. SEVİYE" */}
      <div
        className="absolute flex flex-col items-start justify-center gap-0"
        style={{
          [pillSide]: `calc(100% + 14px)`,
          minWidth: '108px',
          padding: '0.45rem 0.75rem',
          borderRadius: '12px',
          background: 'rgba(12,22,48,0.92)',
          boxShadow: 'inset 0 0 0 1.5px rgba(250,204,21,0.65), 0 0 14px rgba(250,204,21,0.18)',
          pointerEvents: 'none',
        }}
        aria-hidden="true"
      >
        <span
          className="font-inter text-[9px] font-black uppercase tracking-[0.22em]"
          style={{ color: 'rgba(250,204,21,0.85)' }}
        >
          Sıradaki
        </span>
        <span
          className="font-inter text-[13px] font-black tracking-[0.06em]"
          style={{ color: '#facc15' }}
        >
          {level.levelNumber}. SEVİYE
        </span>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────── */
/*  Helpers                                                            */
/* ─────────────────────────────────────────────────────────────────── */

function pctToNum(pct) {
  const n = Number(String(pct).replace('%', ''));
  return Number.isFinite(n) ? n : 50;
}