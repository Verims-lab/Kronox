import React from 'react';
import { motion } from 'framer-motion';

function MiniBar({ value, max, color }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
      <motion.div
        className="h-full rounded-full"
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        style={{ background: color }}
      />
    </div>
  );
}

function Gauge({ value, label, color, unit = '%' }) {
  const pct = Math.min(100, value);
  const radius = 24;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct / 100);

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-14 h-14 flex items-center justify-center">
        <svg width="56" height="56" viewBox="0 0 56 56" className="absolute inset-0 -rotate-90">
          <circle cx="28" cy="28" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
          <motion.circle
            cx="28" cy="28" r={radius}
            fill="none" stroke={color} strokeWidth="4"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            strokeLinecap="round"
          />
        </svg>
        <span className="font-cinzel text-xs font-bold" style={{ color }}>{value}{unit}</span>
      </div>
      <span className="font-inter text-[9px] text-white/40 text-center leading-tight max-w-[56px]">{label}</span>
    </div>
  );
}

function StatCard({ label, value, subValue, color, barMax }) {
  return (
    <div className="flex flex-col gap-1.5 p-3 rounded-xl"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="flex justify-between items-baseline">
        <span className="font-inter text-[9px] uppercase tracking-widest text-white/30">{label}</span>
        {subValue && <span className="font-inter text-[9px] text-white/25">{subValue}</span>}
      </div>
      <span className="font-cinzel text-xl font-bold" style={{ color }}>{value}</span>
      {barMax !== undefined && (
        <MiniBar value={typeof value === 'string' ? parseInt(value) : value} max={barMax} color={color} />
      )}
    </div>
  );
}

export default function MetricsBoard({ metrics }) {
  const {
    passCount = 0, failCount = 0, total = 0,
    avgDuration = 0, successRate = 0, lastSuite = '—',
  } = metrics || {};

  return (
    <div className="space-y-3">
      <p className="font-inter text-[9px] uppercase tracking-widest text-white/30 px-1">Gameplay Metrikleri</p>

      {/* Gauges */}
      <div className="flex justify-around px-2 py-3 rounded-2xl"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <Gauge value={successRate} label="Başarı Oranı"
          color={successRate >= 90 ? '#4ade80' : successRate >= 70 ? '#facc15' : '#f87171'} />
        <Gauge value={Math.min(100, Math.round((passCount / Math.max(1, total)) * 100))} label="Test Kapsamı" color="#a78bfa" />
        <Gauge value={Math.max(0, 100 - Math.round((avgDuration / 5000) * 100))} label="Hız Skoru" color="#60a5fa" />
        <Gauge value={failCount === 0 ? 100 : Math.max(0, 100 - failCount * 10)} label="Kararlılık" color="#facc15" />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-2">
        <StatCard label="Toplam" value={total} color="rgba(255,255,255,0.7)" barMax={120} />
        <StatCard label="Başarılı" value={passCount} color="#4ade80" barMax={total || 1} />
        <StatCard label="Başarısız" value={failCount} color={failCount > 0 ? '#f87171' : '#4ade80'} barMax={total || 1} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <StatCard label="Ort. Süre" value={`${avgDuration}ms`} subValue="son çalışma" color="#60a5fa" />
        <StatCard label="Son Suite" value={lastSuite.toUpperCase()} color="#a78bfa" />
      </div>
    </div>
  );
}