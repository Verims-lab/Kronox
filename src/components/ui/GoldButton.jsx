import React from 'react';
import { motion } from 'framer-motion';

/**
 * Premium fantasy CTA button.
 * Two variants: 'gold' (primary action) and 'portal' (secondary/portal-energy).
 * Carved metal silhouette with bevel highlight + drop shadow.
 *
 * Visual-only. Owns no business logic. Forwards onClick / disabled.
 */
export default function GoldButton({
  children,
  onClick,
  disabled,
  variant = 'gold', // 'gold' | 'portal'
  size = 'md', // 'md' | 'lg'
  type = 'button',
  ariaLabel,
  className = '',
  style,
  icon: Icon,
}) {
  const isPortal = variant === 'portal';
  const height = size === 'lg' ? 58 : 48;

  const surface = isPortal
    ? 'linear-gradient(180deg, #4f9cff 0%, #2563eb 48%, #0e3a8a 100%)'
    : 'linear-gradient(180deg, #ffe066 0%, #facc15 48%, #b97a06 100%)';

  const baseShadow = isPortal
    ? '0 0 22px rgba(59,130,246,0.55), 0 9px 0 rgba(8,18,42,0.85), 0 18px 24px rgba(0,0,0,0.7)'
    : '0 0 22px rgba(250,204,21,0.55), 0 9px 0 rgba(70,42,8,0.92), 0 18px 24px rgba(0,0,0,0.7)';

  const innerBevel = isPortal
    ? 'inset 0 1px 0 rgba(255,255,255,0.6), inset 0 -10px 12px rgba(8,18,42,0.45)'
    : 'inset 0 1px 0 rgba(255,255,255,0.74), inset 0 -10px 12px rgba(151,78,0,0.34)';

  const textColor = isPortal ? '#ffffff' : '#1a1006';
  const textShadow = isPortal
    ? '0 1px 0 rgba(0,0,0,0.4), 0 0 12px rgba(143,205,255,0.55)'
    : '0 1px 0 rgba(255,236,140,0.5)';

  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      whileTap={disabled ? undefined : { scale: 0.955, y: 4 }}
      transition={{ type: 'spring', stiffness: 620, damping: 24 }}
      className={`relative flex w-full items-center justify-center gap-2 border-0 bg-transparent font-cinzel font-black ${className}`}
      style={{
        height,
        fontSize: size === 'lg' ? 15 : 14,
        letterSpacing: 0,
        color: textColor,
        textShadow,
        opacity: disabled ? 0.45 : 1,
        clipPath: 'polygon(8% 0, 92% 0, 100% 50%, 92% 100%, 8% 100%, 0 50%)',
        background: surface,
        boxShadow: `${baseShadow}, ${innerBevel}`,
        ...style,
      }}
    >
      {/* Inner highlight ridge */}
      <span
        className="pointer-events-none absolute inset-[4px]"
        aria-hidden="true"
        style={{
          clipPath: 'polygon(7% 0, 93% 0, 100% 50%, 93% 100%, 7% 100%, 0 50%)',
          boxShadow: isPortal
            ? 'inset 0 0 0 1px rgba(190,225,255,0.4), inset 0 11px 12px rgba(255,255,255,0.18)'
            : 'inset 0 0 0 1px rgba(255,255,255,0.32), inset 0 11px 12px rgba(255,255,255,0.26)',
        }}
      />
      {Icon && <Icon className="relative z-10 h-5 w-5" strokeWidth={2.6} />}
      <span className="relative z-10">{children}</span>
    </motion.button>
  );
}