import { useEffect, useRef, useState } from 'react';

/**
 * Native-style pull-to-refresh hook.
 * @param {Function} onRefresh - async function to call on pull
 * @param {Object} options
 * @param {number} options.threshold - px to pull before triggering (default 72)
 */
export function usePullToRefresh(onRefresh, { threshold = 72 } = {}) {
  const [pulling, setPulling] = useState(false);
  const [pullY, setPullY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onTouchStart = (e) => {
      // Only trigger if scrolled to top
      if (el.scrollTop > 0) return;
      startY.current = e.touches[0].clientY;
    };

    const onTouchMove = (e) => {
      if (startY.current === null) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy > 0 && el.scrollTop <= 0) {
        setPulling(true);
        setPullY(Math.min(dy * 0.45, threshold));
        e.preventDefault();
      }
    };

    const onTouchEnd = async () => {
      if (!pulling) return;
      if (pullY >= threshold) {
        setRefreshing(true);
        setPullY(0);
        setPulling(false);
        startY.current = null;
        await onRefresh();
        setRefreshing(false);
      } else {
        setPullY(0);
        setPulling(false);
        startY.current = null;
      }
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [onRefresh, pulling, pullY, threshold]);

  return { containerRef, pulling, pullY, refreshing };
}