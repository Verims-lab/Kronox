import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

export default function TurnTimer({ onTimeUp, active, duration = 60 }) {
  const [seconds, setSeconds] = useState(duration);

  useEffect(() => {
    setSeconds(duration);
  }, [active, duration]);

  useEffect(() => {
    if (!active || duration === 0) return;
    if (seconds <= 0) {
      if (onTimeUp) onTimeUp();
      return;
    }
    const id = setTimeout(() => setSeconds(s => s - 1), 1000);
    return () => clearTimeout(id);
  }, [seconds, active, onTimeUp, duration]);

  if (duration === 0) return null;

  const pct = seconds / duration;
  const isUrgent = seconds <= duration * 0.25;
  const color = seconds > duration * 0.5 ? '#4ade80' : seconds > duration * 0.25 ? '#facc15' : '#f87171';
  const r = 16;
  const circ = 2 * Math.PI * r;

  return (
    <div className="flex items-center justify-center w-10 h-10 relative">
      <svg width="40" height="40" className="-rotate-90 absolute inset-0">
        <circle cx="20" cy="20" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
        <motion.circle
          cx="20" cy="20" r={r} fill="none"
          stroke={color} strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - pct)}
          transition={{ duration: 0.5 }}
        />
      </svg>
      <span
        className="font-bangers text-base tabular-nums relative z-10"
        style={{ color, lineHeight: 1 }}
      >
        {seconds}
      </span>
    </div>
  );
}