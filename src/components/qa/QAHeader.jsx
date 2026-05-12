import React from 'react';
import { motion } from 'framer-motion';
import { FlaskConical, Activity, Cpu, Shield } from 'lucide-react';

export default function QAHeader({ healthScore, totalTests, lastRunTime }) {
  const healthColor = healthScore >= 90 ? '#4ade80' : healthScore >= 70 ? '#facc15' : '#f87171';
  const healthLabel = healthScore >= 90 ? 'SAĞLIKLI' : healthScore >= 70 ? 'UYARI' : 'KRİTİK';

  return (
    <div className="flex-shrink-0 px-4 pt-4 pb-3">
      {/* Title row */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(250,204,21,0.1)', border: '1px solid rgba(250,204,21,0.3)' }}>
            <FlaskConical className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="font-cinzel text-lg text-primary tracking-widest">QA LABORATORY</h1>
            <p className="font-inter text-[10px] text-white/40 tracking-wider uppercase">Kronox Gameplay Simulation Center</p>
          </div>
        </div>

        {/* Live health score */}
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-1.5">
            <motion.div
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: healthColor }}
            />
            <span className="font-inter text-[10px] font-semibold tracking-widest" style={{ color: healthColor }}>
              {healthLabel}
            </span>
          </div>
          <span className="font-cinzel text-2xl font-bold" style={{ color: healthColor }}>
            {healthScore}<span className="text-sm text-white/30">%</span>
          </span>
          <span className="font-inter text-[9px] text-white/30">Sistem Sağlığı</span>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { icon: <Activity className="w-3 h-3" />, label: 'Test Senaryosu', value: totalTests },
          { icon: <Cpu className="w-3 h-3" />, label: 'Simülasyon', value: '53' },
          { icon: <Shield className="w-3 h-3" />, label: 'Son Çalışma', value: lastRunTime || '—' },
        ].map((s, i) => (
          <div key={i} className="rounded-xl px-3 py-2 flex flex-col gap-0.5"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="flex items-center gap-1 text-white/40">
              {s.icon}
              <span className="font-inter text-[9px] uppercase tracking-widest">{s.label}</span>
            </div>
            <span className="font-cinzel text-base text-white/80">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}