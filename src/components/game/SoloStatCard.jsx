import React from 'react';

/**
 * Codex164 — Shared stat card for the Solo result popups (success +
 * failure). One component → consistent typography, spacing, icon
 * placement, and label fitting across both popups.
 *
 * Layout (per target reference, Attachment 2):
 *
 *   ┌────────────────────────────┐
 *   │ ⓘ        LABEL LINE 1      │
 *   │ ⓘ        LABEL LINE 2 (opt)│
 *   │          VALUE             │
 *   │          FOOTER (opt)      │
 *   └────────────────────────────┘
 *
 *   • Icon sits in a circle on the left (vertically centered against the
 *     text stack), exactly like the success popup uses today.
 *   • Label is optional, uppercase, and two lines allowed when present
 *     (no horizontal truncation).
 *   • Value sits directly under the label with minimal vertical gap so it
 *     reads as one block (fixes the "value floats away from label"
 *     complaint in the brief).
 *   • Optional footer (e.g. "Puan", "Hata", "Maksimum Süre: 02:00", or
 *     the YENİ REKOR badge) sits right under the value.
 *
 * Sizing is identical to the previous individual implementations so
 * neither popup grows. Mobile safety:
 *   • minHeight is fixed → 4 cards stay aligned in the 2×2 grid.
 *   • Label uses overflow-wrap to never overflow the card horizontally.
 *   • Value is `clamp()`-sized so it scales down on very small phones.
 */
export default function SoloStatCard({
  icon: Icon,
  iconColor,
  iconRingColor,
  iconFill,
  iconBg = 'rgba(10,18,40,0.9)',
  cardBackground = 'linear-gradient(180deg, rgba(20,30,60,0.85), rgba(8,16,40,0.95))',
  cardBoxShadow = 'inset 0 0 0 1.5px rgba(96,165,250,0.22)',
  label,
  labelColor = 'rgba(199,210,234,0.78)',
  value,
  valueNode,
  valueColor = '#ffffff',
  footer,
  valueNudgeY = 0,
  footerMarginTop = 2,
}) {
  return (
    <div
      className="rounded-2xl px-3 py-2.5 flex items-center gap-2.5"
      style={{
        background: cardBackground,
        boxShadow: cardBoxShadow,
        minHeight: 92,
      }}
    >
      {/* Icon circle — identical size across all 4 cards in either popup */}
      <div
        className="flex items-center justify-center rounded-full shrink-0"
        style={{
          width: 42,
          height: 42,
          background: iconBg,
          boxShadow: `inset 0 0 0 2px ${iconRingColor}`,
        }}
      >
        <Icon
          className="w-[22px] h-[22px]"
          strokeWidth={2.4}
          style={{ color: iconColor, fill: iconFill || 'transparent' }}
        />
      </div>

      {/* Text stack — optional label (wraps), value, optional footer.
          min-w-0 lets the flex child shrink so wrapping kicks in instead
          of overflow. */}
      <div className="flex-1 min-w-0 flex flex-col">
        {label && (
          <span
            className="font-inter"
            style={{
              color: labelColor,
              fontSize: '10px',
              fontWeight: 700,
              letterSpacing: '0.08em',
              lineHeight: 1.15,
              // Allow two-line wrap when needed; never overflow horizontally.
              whiteSpace: 'normal',
              overflowWrap: 'anywhere',
              wordBreak: 'normal',
              textTransform: 'uppercase',
            }}
          >
            {label}
          </span>
        )}
        <span
          className="font-bangers leading-none"
          style={{
            color: valueColor,
            fontSize: 'clamp(20px, 6vw, 24px)',
            letterSpacing: '0.04em',
            textShadow: valueColor === '#ffffff' ? '0 1px 3px rgba(0,0,0,0.4)' : 'none',
            // Tight gap pulls the value visually close to the label,
            // fixing the "fazla kopuk" complaint.
            marginTop: 2,
            transform: valueNudgeY ? `translateY(${valueNudgeY}px)` : undefined,
            display: 'inline-flex',
            alignItems: 'center',
          }}
        >
          {valueNode || value}
        </span>
        {footer && (
          <div style={{ marginTop: footerMarginTop }}>{footer}</div>
        )}
      </div>
    </div>
  );
}
