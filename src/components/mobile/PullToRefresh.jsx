import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';

const MAX_PULL_DISTANCE = 96;
const REFRESH_THRESHOLD = 68;

function getScrollableAncestor(target, boundary) {
  if (typeof window === 'undefined') return null;
  let node = target;
  while (node && node !== boundary && node !== document.body && node !== document.documentElement) {
    const style = window.getComputedStyle(node);
    const overflowY = style.overflowY;
    const canScroll = /(auto|scroll|overlay)/.test(overflowY) && node.scrollHeight > node.clientHeight;
    if (canScroll) return node;
    node = node.parentElement;
  }
  return document.scrollingElement || document.documentElement;
}

function isScrollTop(target, boundary) {
  const scrollable = getScrollableAncestor(target, boundary);
  if (!scrollable || scrollable === document.documentElement || scrollable === document.body) {
    return (window.scrollY || document.documentElement.scrollTop || 0) <= 2;
  }
  return scrollable.scrollTop <= 2;
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(Boolean(media.matches));
    update();
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, []);

  return reduced;
}

export default function PullToRefresh({
  children,
  className = '',
  disabled = false,
  onRefresh,
  refreshLabel = 'Yenileniyor...',
  pullLabel = 'Aşağı çekerek yenile',
  releaseLabel = 'Bırak ve yenile',
}) {
  const containerRef = useRef(null);
  const startYRef = useRef(0);
  const pullDistanceRef = useRef(0);
  const gestureActiveRef = useRef(false);
  const refreshRef = useRef(onRefresh);
  const disabledRef = useRef(disabled);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    refreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    disabledRef.current = disabled;
  }, [disabled]);

  const resetPull = useCallback(() => {
    pullDistanceRef.current = 0;
    gestureActiveRef.current = false;
    setPullDistance(0);
  }, []);

  const runRefresh = useCallback(async () => {
    if (typeof refreshRef.current !== 'function') {
      resetPull();
      return;
    }
    setRefreshing(true);
    try {
      await refreshRef.current();
    } finally {
      setRefreshing(false);
      resetPull();
    }
  }, [resetPull]);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return undefined;

    const handleTouchStart = (event) => {
      if (disabledRef.current || refreshing || event.touches.length !== 1) return;
      if (!isScrollTop(event.target, node)) return;
      startYRef.current = event.touches[0].clientY;
      gestureActiveRef.current = true;
      pullDistanceRef.current = 0;
    };

    const handleTouchMove = (event) => {
      if (!gestureActiveRef.current || disabledRef.current || refreshing || event.touches.length !== 1) return;
      const deltaY = event.touches[0].clientY - startYRef.current;
      if (deltaY <= 0) {
        resetPull();
        return;
      }
      if (!isScrollTop(event.target, node)) {
        resetPull();
        return;
      }
      const damped = Math.min(MAX_PULL_DISTANCE, Math.round(deltaY * 0.45));
      pullDistanceRef.current = damped;
      setPullDistance(damped);
      if (damped > 6 && event.cancelable) {
        event.preventDefault();
      }
    };

    const handleTouchEnd = () => {
      if (!gestureActiveRef.current || disabledRef.current || refreshing) {
        resetPull();
        return;
      }
      const shouldRefresh = pullDistanceRef.current >= REFRESH_THRESHOLD;
      if (shouldRefresh) {
        runRefresh();
        return;
      }
      resetPull();
    };

    node.addEventListener('touchstart', handleTouchStart, { passive: true });
    node.addEventListener('touchmove', handleTouchMove, { passive: false });
    node.addEventListener('touchend', handleTouchEnd, { passive: true });
    node.addEventListener('touchcancel', resetPull, { passive: true });
    return () => {
      node.removeEventListener('touchstart', handleTouchStart);
      node.removeEventListener('touchmove', handleTouchMove);
      node.removeEventListener('touchend', handleTouchEnd);
      node.removeEventListener('touchcancel', resetPull);
    };
  }, [refreshing, resetPull, runRefresh]);

  const statusText = refreshing ? refreshLabel : pullDistance >= REFRESH_THRESHOLD ? releaseLabel : pullLabel;
  const indicatorVisible = refreshing || pullDistance > 0;
  const indicatorStyle = useMemo(() => {
    const translateY = refreshing ? 0 : Math.max(-48, pullDistance - 58);
    const opacity = indicatorVisible ? 1 : 0;
    return {
      transform: `translate3d(-50%, ${translateY}px, 0)`,
      opacity,
      transition: reducedMotion ? 'none' : 'transform 160ms ease, opacity 120ms ease',
    };
  }, [indicatorVisible, pullDistance, reducedMotion, refreshing]);

  return (
    <div
      ref={containerRef}
      className={`relative ${className}`}
      data-kronox-pull-to-refresh="scoped"
      style={{ overscrollBehaviorY: 'contain', WebkitOverflowScrolling: 'touch' }}
    >
      <div
        className="pointer-events-none fixed left-1/2 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[75] flex min-h-10 items-center gap-2 rounded-full border border-amber-300/35 bg-slate-950/92 px-4 py-2 text-amber-50 shadow-[0_12px_28px_rgba(2,6,23,0.45),inset_0_1px_0_rgba(255,255,255,0.14)] backdrop-blur-md"
        style={indicatorStyle}
        role="status"
        aria-live="polite"
      >
        <RefreshCw
          className={`h-4 w-4 text-amber-200 ${refreshing && !reducedMotion ? 'animate-spin' : ''}`}
          aria-hidden="true"
        />
        <span className="font-inter text-xs font-black">{statusText}</span>
      </div>
      {children}
    </div>
  );
}
