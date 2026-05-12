import React, { useMemo } from 'react';

/**
 * TimelineRuler — atmospheric era hints, NOT a proportional ruler.
 *
 * Shows soft floating era labels based on the actual year range of cards
 * on the player's timeline. Labels are decoupled from slot positions —
 * they appear as ambient context, not precise scale markers.
 *
 * pointer-events: none everywhere. Zero effect on drag / hit-testing.
 */

// Era definitions — purely atmospheric, not mathematically spaced
const ERA_DEFINITIONS = [
  { label: 'Erken Çağ',       from: 0,    to: 1800 },
  { label: '19. Yüzyıl',      from: 1800, to: 1900 },
  { label: 'Erken Modern',    from: 1900, to: 1930 },
  { label: 'Savaş Dönemi',    from: 1930, to: 1950 },
  { label: 'Savaş Sonrası',   from: 1950, to: 1965 },
  { label: 'Uzay Çağı',       from: 1965, to: 1980 },
  { label: 'Dijital Başlangıç', from: 1980, to: 1995 },
  { label: 'İnternet Çağı',   from: 1995, to: 2005 },
  { label: 'Sosyal Medya',    from: 2005, to: 2015 },
  { label: 'Modern',          from: 2015, to: 9999 },
];

function getEraForYear(year) {
  return ERA_DEFINITIONS.find(e => year >= e.from && year < e.to)?.label ?? '';
}

export default function TimelineRuler({ cards = [], isDragMode = false }) {
  // Derive which eras are actually represented in the current card set
  const eraSegments = useMemo(() => {
    if (!cards.length) return [];

    // Build a deduplicated ordered list of era transitions
    const segments = [];
    let lastEra = null;
    const sorted = [...cards].sort((a, b) => a.year - b.year);

    sorted.forEach((card) => {
      const era = getEraForYear(card.year);
      if (era && era !== lastEra) {
        segments.push({ label: era, year: card.year });
        lastEra = era;
      }
    });

    return segments;
  }, [cards]);

  if (!cards.length || eraSegments.length === 0) return null;

  return (
    <div
      className="pointer-events-none select-none"
      style={{
        paddingLeft: 12,
        paddingRight: 24,
        paddingBottom: 4,
        opacity: isDragMode ? 0.2 : 1,
        transition: 'opacity 0.4s ease',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 0,
        // This row is purely decorative — its width doesn't need to match cards exactly
        minWidth: 'max-content',
      }}
    >
      {eraSegments.map((seg, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginRight: i < eraSegments.length - 1 ? 16 : 0,
          }}
        >
          {/* Soft divider dot — only between segments */}
          {i > 0 && (
            <div style={{
              width: 3,
              height: 3,
              borderRadius: '50%',
              background: 'rgba(250,204,21,0.25)',
              marginRight: 6,
              flexShrink: 0,
            }} />
          )}
          <span
            style={{
              fontSize: 9,
              fontFamily: 'var(--font-inter)',
              fontWeight: 500,
              color: 'rgba(250,204,21,0.45)',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
              lineHeight: 1,
            }}
          >
            {seg.label}
          </span>
        </div>
      ))}
    </div>
  );
}