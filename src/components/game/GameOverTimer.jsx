import { useEffect, useRef } from 'react';

/**
 * Overall oyun süresini ölçer.
 * onTick: her saniye çağrılır (geçen saniye sayısı)
 * active: false olunca durur
 */
export default function GameOverTimer({ active, onTick }) {
  const startRef = useRef(Date.now());
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!active) {
      clearInterval(intervalRef.current);
      return;
    }
    startRef.current = Date.now();
    intervalRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startRef.current) / 1000);
      onTick(elapsed);
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [active]);

  return null;
}

export function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s} saniye`;
  return `${m} dak ${s} saniye`;
}
