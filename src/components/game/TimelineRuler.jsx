import React, { useMemo } from 'react';

/**
 * TimelineRuler — pure decorative layer, zero effect on drag/hit-testing.
 *
 * Receives the sorted card list and renders decade/5-year tick marks
 * that scroll in sync with the timeline content (same parent scroll container).
 * pointer-events: none on everything so touch never intercepts.
 */
export default function TimelineRuler({ cards = [], isDragMode = false }) {
  // Derive the year range from the card set, with sensible defaults
  const { minYear, maxYear } = useMemo(() => {
    if (!cards.length) return { minYear: 1900, maxYear: 2020 };
    const years = cards.map(c => c.year);
    const mn = Math.floor(Math.min(...years) / 10) * 10;
    const mx = Math.ceil(Math.max(...years) / 10) * 10;
    return { minYear: Math.min(mn, 1900), maxYear: Math.max(mx, 2020) };
  }, [cards]);

  // Build tick list: every 5 years
  const ticks = useMemo(() => {
    const list = [];
    for (let y = minYear; y <= maxYear; y += 5) {
      list.push({ year: y, isDecade: y % 10 === 0 });
    }
    return list;
  }, [minYear, maxYear]);

  if (!cards.length) return null;

  return (
    <div
      className="pointer-events-none select-none flex flex-row items-end"
      style={{
        paddingLeft: 12,
        paddingRight: 24,
        gap: 0,
        opacity: isDragMode ? 0.4 : 0.7,
        transition: 'opacity 0.3s ease',
      }}
    >
      {ticks.map(({ year, isDecade }) => (
        <div
          key={year}
          className="flex flex-col items-center flex-shrink-0"
          style={{ width: isDecade ? 56 : 28 }}
        >
          {/* Decade label */}
          {isDecade && (
            <span
              className="font-inter font-semibold tracking-wide"
              style={{
                fontSize: 9,
                color: 'rgba(250,204,21,0.55)',
                marginBottom: 2,
                whiteSpace: 'nowrap',
                letterSpacing: '0.05em',
              }}
            >
              {year}s
            </span>
          )}
          {/* Tick mark */}
          <div
            style={{
              width: 1,
              height: isDecade ? 8 : 4,
              background: isDecade
                ? 'rgba(250,204,21,0.4)'
                : 'rgba(255,255,255,0.18)',
              borderRadius: 1,
              marginBottom: 2,
            }}
          />
        </div>
      ))}
    </div>
  );
}