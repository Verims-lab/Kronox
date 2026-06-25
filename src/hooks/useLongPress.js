import { useCallback, useRef } from 'react';

/**
 * Lightweight long-press / press-and-hold detector for touch + mouse.
 *
 * Fires `onLongPress(event)` once the pointer has been held for `delay` ms
 * without moving more than `moveTolerance` px. Vertical scroll cancels the
 * press (we track pointer movement), so list scrolling stays smooth and the
 * menu never opens accidentally during a normal swipe.
 *
 * Returns props to spread onto the target element.
 */
export default function useLongPress(onLongPress, { delay = 500, moveTolerance = 12 } = {}) {
  const timerRef = useRef(null);
  const startRef = useRef(null);
  const firedRef = useRef(false);

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    startRef.current = null;
  }, []);

  const start = useCallback((event) => {
    if (typeof onLongPress !== 'function') return;
    // Only react to primary touch / left mouse button.
    if (event.button !== undefined && event.button !== 0) return;
    const point = event.touches?.[0] || event;
    startRef.current = { x: point.clientX, y: point.clientY };
    firedRef.current = false;
    timerRef.current = setTimeout(() => {
      firedRef.current = true;
      onLongPress(event);
    }, delay);
  }, [onLongPress, delay]);

  const move = useCallback((event) => {
    if (!startRef.current) return;
    const point = event.touches?.[0] || event;
    const dx = Math.abs(point.clientX - startRef.current.x);
    const dy = Math.abs(point.clientY - startRef.current.y);
    if (dx > moveTolerance || dy > moveTolerance) clear();
  }, [clear, moveTolerance]);

  return {
    onTouchStart: start,
    onTouchMove: move,
    onTouchEnd: clear,
    onTouchCancel: clear,
    onMouseDown: start,
    onMouseMove: move,
    onMouseUp: clear,
    onMouseLeave: clear,
    onContextMenu: (event) => {
      // Prevent the native context menu on desktop long-press / right-click
      // so our custom menu owns the interaction.
      event.preventDefault();
    },
  };
}