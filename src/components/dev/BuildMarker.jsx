import React, { useEffect, useState } from 'react';

const BUILD_MARKER = 'Codex020';

export default function BuildMarker() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setVisible(false), 1800);
    return () => window.clearTimeout(timeoutId);
  }, []);

  if (!visible) return null;

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        right: 'calc(0.75rem + env(safe-area-inset-right))',
        bottom: 'calc(0.75rem + env(safe-area-inset-bottom))',
        zIndex: 9999,
        padding: '0.25rem 0.55rem',
        borderRadius: '999px',
        background: 'rgba(0, 0, 0, 0.62)',
        color: '#facc15',
        fontSize: '11px',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        letterSpacing: '0',
        pointerEvents: 'none',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.22)',
      }}
    >
      {BUILD_MARKER}
    </div>
  );
}
