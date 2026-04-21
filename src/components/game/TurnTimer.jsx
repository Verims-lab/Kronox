import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Timer } from 'lucide-react';

export default function TurnTimer({ onTimeUp, active, duration = 60 }) {
  const [seconds, setSeconds] = useState(duration);

  useEffect(() => {
    setSeconds(duration);
  }, [active, duration]);

  useEffect(() => {
    if (!active || duration === 0) return;
    if (seconds <= 0) {
      onTimeUp();
      return;
    }
    const id = setTimeout(() => setSeconds(s => s - 1), 1000);
    return () => clearTimeout(id);
  }, [seconds, active, onTimeUp, duration]);

  // Süresiz mod — timer gösterme
  if (duration === 0) return null;

  const pct = seconds / duration;
  const color = seconds > duration * 0.33 ? '#c9a227' : seconds > duration * 0.17 ? '#f97316' : '#ef4444';
  const r = 20;
  const circ = 2 * Math.PI * r;

  return (
    <div className="flex items-center gap-2">
      <svg width="52" height="52" className="-rotate-90">
        <circle cx="26" cy="26" r={r} fill="none" stroke="hsl(var(--border))" strokeWidth="4" />
        <motion.circle
          cx="26" cy="26" r={r} fill="none"
          stroke={color} strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - pct)}
          transition={{ duration: 0.4 }}
        />
      </svg>
      <span
        className="font-cinzel font-bold text-lg tabular-nums"
        style={{ color, minWidth: '2ch' }}
      >
        {seconds}
      </span>
      <Timer className="w-4 h-4 text-muted-foreground" />
    </div>
  );
}