import React from 'react';

/**
 * Shared KRONOX wordmark used on the Home screen and reused on other
 * screens (e.g. Join Lobby) so the brand identity stays consistent.
 *
 * The final "X" is split into two gold accent chevrons to mimic the
 * reference logo, while "KRONO" uses the cool white tone. clamp() keeps
 * the size identical across phones and desktop browsers without media
 * queries. Pass `fontSize` to scale it down on secondary screens.
 */
export default function KronoxWordmark({ fontSize = 'clamp(36px, 11vw, 60px)' }) {
  return (
    <div
      className="flex items-center justify-center"
      style={{
        gap: 'clamp(10px, 2.6vw, 16px)',
        fontFamily: 'var(--font-cinzel)',
        fontWeight: 900,
        fontSize,
        lineHeight: 1,
      }}
      aria-label="KRONOX"
    >
      <span
        style={{
          color: '#f1f4ff',
          letterSpacing: '0.34em',
          paddingRight: '0.34em',
          textShadow: '0 2px 12px rgba(0,0,0,0.55)',
        }}
      >
        KRONO
      </span>
      <KronoxSplitX size={fontSize} />
    </div>
  );
}

/**
 * Gold "X" composed of two diagonal bars with a small split at the centre,
 * matching the reference logo crop. `size` mirrors the wordmark font-size
 * so the X scales with the rest of the logotype on every viewport.
 */
function KronoxSplitX({ size }) {
  return (
    <span
      aria-hidden="true"
      style={{
        position: 'relative',
        display: 'inline-block',
        width: `calc(${size} * 0.78)`,
        height: size,
        filter: 'drop-shadow(0 0 8px rgba(250,204,21,0.55))',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: '6%',
          left: 0,
          width: '46%',
          height: '14%',
          background: '#facc15',
          transformOrigin: '0% 50%',
          transform: 'rotate(54deg)',
          borderRadius: '2px',
        }}
      />
      <span
        style={{
          position: 'absolute',
          bottom: '6%',
          left: 0,
          width: '46%',
          height: '14%',
          background: '#facc15',
          transformOrigin: '0% 50%',
          transform: 'rotate(-54deg)',
          borderRadius: '2px',
        }}
      />
      <span
        style={{
          position: 'absolute',
          top: '6%',
          right: 0,
          width: '46%',
          height: '14%',
          background: '#facc15',
          transformOrigin: '100% 50%',
          transform: 'rotate(-54deg)',
          borderRadius: '2px',
        }}
      />
      <span
        style={{
          position: 'absolute',
          bottom: '6%',
          right: 0,
          width: '46%',
          height: '14%',
          background: '#facc15',
          transformOrigin: '100% 50%',
          transform: 'rotate(54deg)',
          borderRadius: '2px',
        }}
      />
    </span>
  );
}