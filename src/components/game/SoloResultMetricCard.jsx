import React from 'react';

/**
 * Vertical metric card for the redesigned Solo level-end screens.
 *
 * Layout (matches the success/failure reference screenshots):
 *
 *   ┌───────────────┐
 *   │     LABEL      │   ← uppercase, small, tinted
 *   │      (◯)       │   ← icon in a ringed circle
 *   │     VALUE      │   ← large numeric value
 *   │   footer(opt)  │   ← e.g. "Hız Bonusu +10 ⚡"
 *   └───────────────┘
 *
 * Presentational only. Colors are passed in so the same card serves both
 * the gold/blue success palette and the red/blue failure palette.
 */
export default function SoloResultMetricCard({
  icon: Icon,
  iconColor,
  iconFill,
  ringColor,
  label,
  labelColor = 'rgba(147,197,253,0.85)',
  value,
  valueColor = '#ffffff',
  footer,
  ariaLabel,
}) {
  return (
    <div
      className="flex flex-col items-center rounded-2xl px-2 py-3"
      style={{
        background: 'linear-gradient(180deg, rgba(20,32,66,0.75), rgba(8,16,40,0.9))',
        boxShadow: 'inset 0 0 0 1.5px rgba(96,165,250,0.28), 0 4px 14px rgba(2,6,23,0.4)',
        minHeight: 118,
      }}
      aria-label={ariaLabel || `${label}: ${value}`}
    >
      <span
        className="font-inter text-center"
        style={{
          color: labelColor,
          fontSize: '10.5px',
          fontWeight: 800,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          lineHeight: 1.2,
        }}
      >
        {label}
      </span>

      <div
        className="mt-2 flex items-center justify-center rounded-full shrink-0"
        style={{
          width: 40,
          height: 40,
          background: 'rgba(6,12,32,0.9)',
          boxShadow: `inset 0 0 0 2px ${ringColor}`,
        }}
      >
        <Icon
          className="w-[20px] h-[20px]"
          strokeWidth={2.4}
          style={{ color: iconColor, fill: iconFill || 'transparent' }}
        />
      </div>

      <span
        className="kronox-number mt-2 leading-none"
        style={{
          color: valueColor,
          fontSize: 'clamp(20px, 6.5vw, 26px)',
          letterSpacing: '0.02em',
        }}
      >
        {value}
      </span>

      {footer && <div className="mt-1.5">{footer}</div>}
    </div>
  );
}