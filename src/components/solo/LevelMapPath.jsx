import React, { useLayoutEffect, useMemo, useRef } from 'react';
import LevelMapNode from './LevelMapNode';
import { getSoloMapSectionRange } from '@/lib/soloProgressHelpers';
import { attemptCenterSoloMap } from '@/lib/scrollSoloMapToLevel';

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
  // Codex121 — Admin gate for diagnostic logging. When true, the focus
  // helper logs a structured diagnostic for every attempt to the console
  // so we can see, on a real device, exactly which step failed (no
  // container, no node, layout not ready, applied but not centered…).
  // Default false → normal users see nothing.
  diagnosticsEnabled = false,
}) {
  // We render top → bottom in JSX, but display HIGH levels at the top and
  // LOW levels at the bottom. We achieve this by reversing the array.
  const ordered = useMemo(() => [...levels].slice().reverse(), [levels]);

  // Auto-scroll the current level into view on mount + whenever the
  // focus target changes.
  //
  // Codex121 ROOT-CAUSE FIX (continuation of Codex117/Codex120) —
  // previous attempts kept the focus math inline. On a real device the
  // scroll still landed at scrollTop=0 (the highest-zone banner)
  // because the inline effect couldn't tell whether the math actually
  // worked OR the fallback `scrollIntoView` ended up scrolling an
  // outer ancestor instead of our inner container.
  //
  // We now externalise the entire scroll into `attemptCenterSoloMap`
  // from `lib/scrollSoloMapToLevel.js`. That helper:
  //
  //   1. Finds the real scroll container via the stable DOM hook
  //      `[data-kx-solo-map-container="true"]` (not React refs).
  //   2. Finds the target node via `[data-kx-solo-level="N"]`.
  //   3. Computes the visible band MINUS the bottom CTA overlay so a
  //      centered node isn't hidden behind the floating Play button.
  //   4. Assigns `scrollTop` directly (smooth behavior temporarily
  //      disabled) so the jump can't be cancelled mid-animation.
  //   5. Verifies post-jump that the node sits inside the visible
  //      band; if not, returns a structured diagnostic so the rAF
  //      retry loop tries again.
  //
  // The diagnostic is logged to the console ONLY when the parent
  // passes `diagnosticsEnabled` (gated by admin upstream).
  const containerRef = useRef(null);
  // Codex110 — Prefer the explicit focus target the parent passed in.
  // It is computed via getCurrentPlayableLevel(progress) — the single
  // source of truth for "where the user should be looking right now".
  const currentLevelNumber =
    focusLevelNumber ||
    levels.find((l) => l.status === 'current')?.levelNumber ||
    [...levels].reverse().find((l) => l.isPlayable)?.levelNumber ||
    levels[0]?.levelNumber;

  // Codex120 — Section the focus level belongs to. Exposed as a data
  // attribute on the container so runtime / Health probes can verify
  // "map opened on the correct zone" without reading React state.
  const focusSectionRange = useMemo(
    () => (currentLevelNumber ? getSoloMapSectionRange(currentLevelNumber) : null),
    [currentLevelNumber],
  );

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || !currentLevelNumber) return undefined;
    const cancel = attemptCenterSoloMap({
      // Codex121 — pass the container itself as the root; the helper
      // first checks if it matches `[data-kx-solo-map-container]` and
      // returns it directly without re-querying the document.
      root: container,
      levelNumber: currentLevelNumber,
      // Bottom overlay = Play CTA + BottomNav stack the parent
      // reserves below the scroll viewport. The helper subtracts this
      // from the visible band so the focused node sits in the truly
      // visible region.
      bottomOverlayPx: bottomReservedPx,
      // ≈ 333ms total budget — enough for a WebView to settle layout
      // and for the async progress fetch tail to commit.
      maxFrames: 20,
      onDiagnostic: diagnosticsEnabled
        ? (diag) => {
            // Admin/dev only. Single-line label so it's easy to
            // grep in a real device console.
            // eslint-disable-next-line no-console
            console.info('[kronox.solo.focus]', diag);
          }
        : undefined,
    });
    return cancel;
    // Codex121 — Depend on the actual focus number AND the levels
    // reference so async progress loads always trigger a refocus.
    // Including `bottomReservedPx` covers the edge case where the
    // parent changes the reserved area between mounts.
  }, [currentLevelNumber, levels, bottomReservedPx, diagnosticsEnabled]);

  return (
    <div
      ref={containerRef}
      className="kx-contained-scroll relative w-full overflow-y-auto"
      style={{
        // Codex121 — Use viewport-anchored height instead of `100%`.
        // `100%` resolves against the parent's COMPUTED height, which on
        // some WebViews/Android browsers reports 0 during the first
        // commit because the parent uses `flex-1`+`min-height:0`. A
        // zero-height container means our focus math sees
        // `clientHeight === 0` and bails out, leaving scrollTop=0
        // (= top of reversed list = wrong zone). We instead compute the
        // height from the dvh viewport minus the fixed top header and
        // the reserved bottom overlay so the container always has a
        // real, non-zero height on first paint.
        //
        //   - 3.5rem = ScreenHeader content height (matches the
        //     `height: calc(3.5rem + env(safe-area-inset-top))` rule in
        //     components/layout/ScreenHeader).
        //   - 0.25rem extra padding from the parent's `paddingTop:
        //     calc(3.75rem + …)` already accounts for the ScreenHeader,
        //     so we subtract that exact amount.
        //   - The title block above (`SOLO MACERA HARİTASI` + tagline)
        //     is approx 3.5rem tall; we subtract it to keep the focus
        //     math honest.
        //   - The bottomReservedPx (Play CTA + BottomNav + safe-area)
        //     is also subtracted INSIDE the focus math via the
        //     `bottomOverlayPx` param, so we don't subtract it twice
        //     here — we just give the container its real CSS height
        //     down to the page bottom.
        height: 'calc(100dvh - 3.75rem - env(safe-area-inset-top) - 3.5rem)',
        // Honor older WebViews that don't grok `dvh`.
        minHeight: '300px',
        WebkitOverflowScrolling: 'touch',
        scrollBehavior: 'smooth',
        // Bottom padding so Level 1 (rendered last in DOM = at the bottom
        // of the scroll content) isn't hidden by Play button + BottomNav.
        paddingBottom: `${bottomReservedPx}px`,
        // Top padding so the highest-level zone banner has breathing room.
        paddingTop: '1rem',
      }}
      // Codex121 — Stable DOM hook for the scroll helper. Decouples the
      // scroll logic from React refs (which can desync after re-renders).
      data-kx-solo-map-container="true"
      // Codex120 — expose the focus level + its section range so runtime
      // checks (and Health probes) can verify "map opened on the correct
      // zone". Purely informational; no business logic depends on it.
      data-kx-focus-level={currentLevelNumber || ''}
      data-kx-focus-section={focusSectionRange ? `${focusSectionRange[0]}-${focusSectionRange[1]}` : ''}
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
                  // Codex121 — Stable DOM hook the scroll helper queries
                  // via `[data-kx-solo-level="N"]`. Decouples target
                  // lookup from the React refs map (which used to be
                  // populated by a callback ref and could go stale
                  // across re-renders / level swaps).
                  data-kx-solo-level={level.levelNumber}
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