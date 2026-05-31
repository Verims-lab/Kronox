import React, { useEffect, useMemo, useRef } from 'react';
import LevelMapNode from './LevelMapNode';

/**
 * Codex108 — Scrollable vertical adventure map for Solo levels.
 *
 *   • Level 1 sits at the BOTTOM. Progress goes UP. We achieve this by
 *     rendering levels in REVERSE order (high → low) inside a normal
 *     vertically-scrolling container. The user scrolls UP to see higher
 *     levels; scrolling all the way to the bottom shows Level 1.
 *   • Nodes alternate left / center / right horizontally so the path
 *     feels like a journey, not a stack.
 *   • Path SVG segments connect consecutive nodes.
 *   • Every 5 levels a "zone banner" announces a new theme/atmosphere
 *     (gradient + label). 4 zones cover levels 1–20.
 *   • On mount we auto-scroll the current level into view (centered).
 *
 * Props:
 *   levels                : Array<level>   — output of getSoloLevels(progress)
 *   selectedLevelNumber   : number
 *   onSelectLevel         : (level) => void
 *   bottomReservedPx      : number         — extra bottom padding so the
 *                                            Play button + BottomNav can't
 *                                            cover Level 1.
 */
const ZONES = [
  {
    range: [1, 5],
    title: 'Başlangıç Vadisi',
    subtitle: 'Zaman çizgisinin ilk adımları',
    accent: '#60a5fa', // blue
    gradient:
      'radial-gradient(ellipse at 50% 50%, rgba(59,130,246,0.18), transparent 70%)',
  },
  {
    range: [6, 10],
    title: 'Altın Ovalar',
    subtitle: 'Sıralama ustası olma yolunda',
    accent: '#facc15', // gold
    gradient:
      'radial-gradient(ellipse at 50% 50%, rgba(250,204,21,0.14), transparent 70%)',
  },
  {
    range: [11, 15],
    title: 'Mor Tepeler',
    subtitle: 'Yükselen zorluk dalgası',
    accent: '#a78bfa', // violet
    gradient:
      'radial-gradient(ellipse at 50% 50%, rgba(167,139,250,0.16), transparent 70%)',
  },
  {
    range: [16, 20],
    title: 'Kristal Zirve',
    subtitle: 'Efsanelere bir adım',
    accent: '#7dd3fc', // cyan
    gradient:
      'radial-gradient(ellipse at 50% 50%, rgba(125,211,252,0.16), transparent 70%)',
  },
];

function zoneIndexFor(levelNumber) {
  const idx = ZONES.findIndex(({ range }) => levelNumber >= range[0] && levelNumber <= range[1]);
  return idx === -1 ? ZONES.length - 1 : idx;
}

// Horizontal lane positions, alternating to create a "winding" path.
// Index = levelNumber % LANES.length. We keep amplitude small so wide
// phones don't stretch the path while small phones don't clip nodes.
const LANES = ['22%', '50%', '78%', '50%'];

export default function LevelMapPath({
  levels,
  selectedLevelNumber,
  onSelectLevel,
  bottomReservedPx = 192,
  // Codex110 — Explicit focus target from the parent (computed via the
  // shared helper getCurrentPlayableLevel). When provided, this wins over
  // the internal `find(status === 'current')` heuristic, so the parent's
  // single-source-of-truth definition of "current playable" is always
  // what we scroll to. Falling back keeps backward compat.
  focusLevelNumber,
}) {
  // We render top → bottom in JSX, but display HIGH levels at the top and
  // LOW levels at the bottom. We achieve this by reversing the array.
  const ordered = useMemo(() => [...levels].slice().reverse(), [levels]);

  // Auto-scroll the current level into view on mount + whenever it
  // changes (e.g. after a pass unlocks the next one).
  //
  // Codex117 ROOT-CAUSE FIX — the previous implementation read
  // `node.offsetTop` on the per-level node element. That node is
  // `position: absolute` inside a `position: relative` 128px row, so
  // `offsetParent` is the row itself — `offsetTop` is just ~64px (the
  // `top: 50%` inside the row), NOT the position within the scroll
  // container. Result: `scrollTop` was always clamped near 0 and the
  // user landed at the TOP of the reversed list — i.e. the highest
  // levels' zone ("KRİSTAL ZİRVE 16–20") — regardless of which level
  // we asked to focus. This was the actual cause of "CTA shows Level 10
  // but the visible map block is 16–20".
  //
  // Fix: use `getBoundingClientRect()` for both the node and the
  // scroll container. That gives viewport-relative coordinates that
  // don't depend on offsetParent. The math is then:
  //
  //   targetScrollTop = container.scrollTop
  //                   + (nodeRect.top - containerRect.top)
  //                   - container.clientHeight / 2
  //                   + nodeRect.height / 2
  //
  // We keep Codex109's resilience: defer to rAF, retry once if layout
  // isn't ready, and fall back to scrollIntoView({block:'center'}) as
  // last resort.
  const containerRef = useRef(null);
  const nodeRefs = useRef({});
  // Codex110 — Prefer the explicit focus target the parent passed in.
  // It is computed via getCurrentPlayableLevel(progress) — the single
  // source of truth for "where the user should be looking right now".
  const currentLevelNumber =
    focusLevelNumber ||
    levels.find((l) => l.status === 'current')?.levelNumber;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const target =
      (focusLevelNumber && levels.find((l) => l.levelNumber === focusLevelNumber)) ||
      levels.find((l) => l.status === 'current') ||
      [...levels].reverse().find((l) => l.isPlayable) ||
      levels[0];
    if (!target) return;

    const focus = () => {
      const node = nodeRefs.current[target.levelNumber];
      if (!node) return false;
      const ch = container.clientHeight;
      if (ch === 0) return false; // layout not ready yet
      // Codex117 — bounding-rect math (see comment above).
      const containerRect = container.getBoundingClientRect();
      const nodeRect = node.getBoundingClientRect();
      const offset =
        container.scrollTop
        + (nodeRect.top - containerRect.top)
        - ch / 2
        + nodeRect.height / 2;
      const maxScroll = Math.max(0, container.scrollHeight - ch);
      container.scrollTop = Math.min(maxScroll, Math.max(0, offset));
      return true;
    };

    // Try immediately on next frame; if layout still isn't ready, retry
    // once after 80ms which is enough for a WebView to settle.
    const raf = requestAnimationFrame(() => {
      if (!focus()) {
        const t = window.setTimeout(() => {
          if (!focus()) {
            // Last-resort: rely on the browser's own centering.
            const node = nodeRefs.current[target.levelNumber];
            if (node && node.scrollIntoView) {
              node.scrollIntoView({ block: 'center', inline: 'nearest' });
            }
          }
        }, 80);
        // store id on container so cleanup can clear
        container.__kxFocusTimer = t;
      }
    });
    return () => {
      cancelAnimationFrame(raf);
      if (container.__kxFocusTimer) window.clearTimeout(container.__kxFocusTimer);
    };
  }, [levels.length, currentLevelNumber]);

  return (
    <div
      ref={containerRef}
      className="kx-contained-scroll relative w-full overflow-y-auto"
      style={{
        // The scroll viewport fills the available vertical space; the
        // parent (SoloChallenge) controls min/max height via flex.
        height: '100%',
        WebkitOverflowScrolling: 'touch',
        scrollBehavior: 'smooth',
        // Bottom padding so Level 1 (rendered last in DOM = at the bottom
        // of the scroll content) isn't hidden by Play button + BottomNav.
        paddingBottom: `${bottomReservedPx}px`,
        // Top padding so the highest-level zone banner has breathing room.
        paddingTop: '1rem',
      }}
      aria-label="Solo Level Path"
    >
      {/* Path lane container — full width, with nodes absolutely centered
          per row. We render normal flow rows; the SVG connectors live
          inside each row so they scale with the row spacing. */}
      <div className="relative mx-auto w-full max-w-md px-4">
        {ordered.map((level, displayIndex) => {
          const zoneIdx = zoneIndexFor(level.levelNumber);
          const zone = ZONES[zoneIdx];
          // Show a zone banner ABOVE the FIRST level of each zone as it
          // appears in our reversed (top-down) DOM. Because DOM is
          // reversed, that's the HIGHEST level number of the zone.
          const isZoneBoundary =
            level.levelNumber === zone.range[1] ||
            displayIndex === 0; // always show at top of scroll
          const leftPct = LANES[level.levelNumber % LANES.length];

          // Connector to the next-displayed node (which is the level just
          // BELOW this one in the player's journey). Skip on the very last
          // displayed row (= Level 1 at the bottom).
          const isLastDisplayed = displayIndex === ordered.length - 1;
          const nextLevel = !isLastDisplayed ? ordered[displayIndex + 1] : null;
          const nextLeftPct = nextLevel
            ? LANES[nextLevel.levelNumber % LANES.length]
            : null;

          return (
            <div key={level.levelNumber} className="relative">
              {isZoneBoundary && (
                <ZoneBanner zone={zone} levelNumber={level.levelNumber} />
              )}

              <div
                className="relative"
                style={{ height: '128px' }}
              >
                {/* Connector SVG drawn from this node down to the next */}
                {nextLevel && (
                  <PathConnector
                    fromLeft={leftPct}
                    toLeft={nextLeftPct}
                    accent={ZONES[zoneIndexFor(level.levelNumber)].accent}
                    dimmed={!level.isPlayable && !nextLevel.isPlayable}
                  />
                )}
                <div
                  ref={(el) => {
                    if (el) nodeRefs.current[level.levelNumber] = el;
                  }}
                  className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
                  style={{ left: leftPct }}
                >
                  <LevelMapNode
                    level={level}
                    selected={level.levelNumber === selectedLevelNumber}
                    onSelect={() => onSelectLevel(level)}
                  />
                </div>
              </div>
            </div>
          );
        })}

        {/* Footer hint at the very bottom (under Level 1) */}
        <div className="mt-2 text-center font-inter text-[10px] font-black uppercase tracking-[0.28em] text-blue-100/40">
          Yolculuk başlıyor ▼
        </div>
      </div>
    </div>
  );
}

function ZoneBanner({ zone, levelNumber }) {
  return (
    <div
      className="relative my-3 overflow-hidden rounded-2xl px-4 py-2.5"
      style={{
        background: `linear-gradient(180deg, rgba(20,28,55,0.85), rgba(6,10,24,0.95)), ${zone.gradient}`,
        boxShadow: `inset 0 0 0 1.5px ${hexToRgba(zone.accent, 0.45)}, 0 0 18px ${hexToRgba(zone.accent, 0.18)}`,
      }}
      data-kx-solo-zone={`${zone.range[0]}-${zone.range[1]}`}
      data-kx-solo-zone-level={levelNumber}
    >
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <p
            className="font-cinzel text-sm font-black tracking-[0.22em]"
            style={{ color: zone.accent, textShadow: `0 0 10px ${hexToRgba(zone.accent, 0.5)}` }}
          >
            {zone.title}
          </p>
          <p className="font-inter text-[10px] text-blue-100/65">{zone.subtitle}</p>
        </div>
        <span
          className="shrink-0 rounded-full px-2 py-0.5 font-inter text-[10px] font-black tracking-widest"
          style={{
            color: zone.accent,
            background: hexToRgba(zone.accent, 0.10),
            boxShadow: `inset 0 0 0 1px ${hexToRgba(zone.accent, 0.45)}`,
          }}
        >
          {zone.range[0]}–{zone.range[1]}
        </span>
      </div>
    </div>
  );
}

function PathConnector({ fromLeft, toLeft, accent, dimmed }) {
  // We draw a subtle curved dashed line connecting the centers of two
  // consecutive level circles. Using SVG keeps it crisp on all DPRs and
  // doesn't trap touch events (pointer-events: none on the SVG).
  return (
    <svg
      aria-hidden="true"
      className="absolute inset-0 h-full w-full"
      style={{ pointerEvents: 'none' }}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      <path
        d={`M ${pctToNum(fromLeft)} 50 Q 50 75 ${pctToNum(toLeft)} 100`}
        fill="none"
        stroke={hexToRgba(accent, dimmed ? 0.25 : 0.55)}
        strokeWidth="1.2"
        strokeDasharray="2 3"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

// Helpers — kept inline because they're tiny and only used here.
function pctToNum(pct) {
  const n = Number(String(pct).replace('%', ''));
  return Number.isFinite(n) ? n : 50;
}
function hexToRgba(hex, alpha) {
  // Accepts #rgb / #rrggbb. Falls back to white when parsing fails.
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return `rgba(255,255,255,${alpha})`;
  let h = m[1];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}