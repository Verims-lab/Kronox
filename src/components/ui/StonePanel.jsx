import React from 'react';

/**
 * Premium fantasy "stone-framed" panel surface.
 * Carved slate plate with gold trim and royal-blue inner glow.
 * Used by lobby, waiting room, and any non-gameplay panel surface.
 *
 * Visual-only. No business logic.
 */
export default function StonePanel({
  children,
  className = '',
  glow = 'gold', // 'gold' | 'portal' | 'none'
  padding = 'p-4',
  as: Tag = 'div',
  style,
  ...rest
}) {
  const innerGlow =
    glow === 'portal'
      ? 'inset 0 0 24px rgba(59,130,246,0.22)'
      : glow === 'gold'
      ? 'inset 0 0 22px rgba(250,204,21,0.16)'
      : 'none';

  const ringColor =
    glow === 'portal' ? 'rgba(96,165,250,0.55)' : 'rgba(250,204,21,0.52)';

  return (
    <Tag
      className={`relative ${padding} ${className}`}
      style={{
        borderRadius: 18,
        background:
          'linear-gradient(180deg, rgba(30,41,75,0.96) 0%, rgba(18,24,48,0.98) 60%, rgba(8,12,28,1) 100%)',
        boxShadow: [
          `inset 0 0 0 1.5px ${ringColor}`,
          'inset 0 1px 0 rgba(255,255,255,0.10)',
          'inset 0 -14px 18px rgba(0,0,0,0.55)',
          innerGlow,
          '0 10px 22px rgba(2,6,23,0.55)',
        ]
          .filter(Boolean)
          .join(', '),
        ...style,
      }}
      {...rest}
    >
      {children}
    </Tag>
  );
}