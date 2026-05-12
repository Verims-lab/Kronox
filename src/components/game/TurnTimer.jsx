import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { sounds } from '@/lib/gameSounds';

export default function TurnTimer({ onTimeUp, active, duration = 60, size = 'md' }) {
  const [seconds, setSeconds] = useState(duration);
  const prevSeconds = useRef(duration);

  useEffect(() => {
    setSeconds(duration);
    prevSeconds.current = duration;
  }, [active, duration]);

  useEffect(() => {
    if (!active || duration === 0) return;
    if (seconds <= 0) { if (onTimeUp) onTimeUp(); return; }

    // Urgency tick — last 25% of time
    const isUrgentPhase = seconds <= Math.ceil(duration * 0.25);
    if (isUrgentPhase && prevSeconds.current !== seconds) {
      sounds.urgencyTick();
    }
    prevSeconds.current = seconds;

    const id = setTimeout(() => setSeconds(s => s - 1), 1000);
    return () => clearTimeout(id);
  }, [seconds, active, onTimeUp, duration]);

  if (duration === 0) return null;

  const pct = seconds / duration;
  const isUrgent = seconds <= Math.ceil(duration * 0.25);
  const color = seconds > duration * 0.5 ? '#4ade80' : seconds > duration * 0.25 ? '#facc15' : '#f87171';
  const dim = size === 'lg' ? 52 : 40;
  const cx = dim / 2;
  const r = size === 'lg' ? 21 : 16;
  const sw = size === 'lg' ? 3.5 : 3;
  const circ = 2 * Math.PI * r;

  return (
    <motion.div
      className="flex items-center justify-center relative"
      style={{ width: dim, height: dim }}
      animate={isUrgent ? { scale: [1, 1.08, 1] } : { scale: 1 }}
      transition={isUrgent ? { duration: 0.5, repeat: Infinity, ease: 'easeInOut' } : {}}
    >
      {/* Urgent glow ring */}
      {isUrgent && (
        <motion.div
          className="absolute inset-0 rounded-full pointer-events-none"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 0.5, repeat: Infinity }}
          style={{
            boxShadow: `0 0 12px 4px rgba(248,113,113,0.5)`,
            borderRadius: '50%',
          }}
        />
      )}
      <svg width={dim} height={dim} className="-rotate-90 absolute inset-0">
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={sw} />
        <motion.circle
          cx={cx} cy={cx} r={r} fill="none"
          stroke={color} strokeWidth={sw}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - pct)}
          transition={{ duration: 0.5 }}
        />
      </svg>
      <span
        className={`font-bangers tabular-nums relative z-10 ${size === 'lg' ? 'text-lg' : 'text-base'}`}
        style={{ color, lineHeight: 1 }}
      >
        {seconds}
      </span>
    </motion.div>
  );
}