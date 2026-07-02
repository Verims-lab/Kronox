import { useEffect, useRef } from 'react';

export const KRONOX_LOCKED_VIEWPORT_CONTENT = 'width=device-width, initial-scale=1, maximum-scale=1, minimum-scale=1, user-scalable=no, viewport-fit=cover';

function isEditableTarget(target) {
  if (typeof Element === 'undefined' || !(target instanceof Element)) return false;
  return Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));
}

function distanceBetweenTouches(a, b) {
  if (!a || !b) return Number.POSITIVE_INFINITY;
  const dx = Number(a.clientX || 0) - Number(b.clientX || 0);
  const dy = Number(a.clientY || 0) - Number(b.clientY || 0);
  return Math.sqrt((dx * dx) + (dy * dy));
}

export default function usePreventAppZoom() {
  const lastTouchEndRef = useRef(null);

  useEffect(() => {
    if (typeof document === 'undefined' || typeof window === 'undefined') return undefined;

    const viewportMetas = Array.from(document.querySelectorAll('meta[name="viewport"]'));
    const viewportMeta = viewportMetas[0] || document.createElement('meta');
    if (!viewportMetas.length) {
      viewportMeta.setAttribute('name', 'viewport');
      document.head.appendChild(viewportMeta);
    }
    viewportMeta.setAttribute('content', KRONOX_LOCKED_VIEWPORT_CONTENT);
    viewportMetas.slice(1).forEach((node) => node.remove());

    const root = document.getElementById('root');
    const isInsideApp = (target) => !root || !target || root.contains(target);

    const preventGestureZoom = (event) => {
      if (isInsideApp(event.target) && typeof event.preventDefault === 'function') {
        event.preventDefault();
      }
    };

    const preventMultiTouchZoom = (event) => {
      if (isInsideApp(event.target) && event.touches && event.touches.length > 1) {
        event.preventDefault();
      }
    };

    const preventWheelZoom = (event) => {
      if (isInsideApp(event.target) && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
      }
    };

    const preventDoubleClickZoom = (event) => {
      if (isEditableTarget(event.target)) return;
      preventGestureZoom(event);
    };

    const preventDoubleTapZoom = (event) => {
      if (!isInsideApp(event.target) || isEditableTarget(event.target)) return;
      if (!event.changedTouches || event.changedTouches.length !== 1 || event.touches?.length) return;

      const now = window.performance?.now?.() || Date.now();
      const touch = event.changedTouches[0];
      const lastTouchEnd = lastTouchEndRef.current;
      const isDoubleTap = lastTouchEnd
        && now - lastTouchEnd.time < 320
        && distanceBetweenTouches(touch, lastTouchEnd) < 28;

      if (isDoubleTap) {
        event.preventDefault();
        lastTouchEndRef.current = null;
        return;
      }

      lastTouchEndRef.current = {
        time: now,
        clientX: touch.clientX,
        clientY: touch.clientY,
      };
    };

    const nonPassiveCapture = { capture: true, passive: false };
    document.addEventListener('gesturestart', preventGestureZoom, nonPassiveCapture);
    document.addEventListener('gesturechange', preventGestureZoom, nonPassiveCapture);
    document.addEventListener('gestureend', preventGestureZoom, nonPassiveCapture);
    document.addEventListener('touchmove', preventMultiTouchZoom, nonPassiveCapture);
    document.addEventListener('touchend', preventDoubleTapZoom, nonPassiveCapture);
    document.addEventListener('dblclick', preventDoubleClickZoom, nonPassiveCapture);
    window.addEventListener('wheel', preventWheelZoom, nonPassiveCapture);

    return () => {
      document.removeEventListener('gesturestart', preventGestureZoom, nonPassiveCapture);
      document.removeEventListener('gesturechange', preventGestureZoom, nonPassiveCapture);
      document.removeEventListener('gestureend', preventGestureZoom, nonPassiveCapture);
      document.removeEventListener('touchmove', preventMultiTouchZoom, nonPassiveCapture);
      document.removeEventListener('touchend', preventDoubleTapZoom, nonPassiveCapture);
      document.removeEventListener('dblclick', preventDoubleClickZoom, nonPassiveCapture);
      window.removeEventListener('wheel', preventWheelZoom, nonPassiveCapture);
    };
  }, []);
}
