import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, AlertTriangle, ChevronDown, ChevronRight, Clock } from 'lucide-react';

function StatusBadge({ status, duration }) {
  const config = {
    PASS:  { icon: <CheckCircle2 className="w-3.5 h-3.5" />, color: '#4ade80', bg: 'rgba(74,222,128,0.12)', label: 'PASS' },
    FAIL:  { icon: <XCircle className="w-3.5 h-3.5" />, color: '#f87171', bg: 'rgba(248,113,113,0.12)', label: 'FAIL' },
    ERROR: { icon: <AlertTriangle className="w-3.5 h-3.5" />, color: '#facc15', bg: 'rgba(250,204,21,0.12)', label: 'ERR' },
  }[status] || { icon: null, color: '#ffffff40', bg: 'transparent', label: '?' };

  return (
    <div className="flex items-center gap-1.5 flex-shrink-0">
      {duration != null && (
        <span className="font-mono text-[9px] text-white/20 flex items-center gap-0.5">
          <Clock className="w-2.5 h-2.5" />{duration}ms
        </span>
      )}
      <span className="font-inter text-[9px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-1"
        style={{ color: config.color, background: config.bg }}>
        {config.icon}{config.label}
      </span>
    </div>
  );
}

export default function TestResultCard({ r, index }) {
  const [open, setOpen] = useState(false);
  const isPass = r.status === 'PASS';
  const hasDetail = !!(r.error || r.detail);

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.015 }}
      className="rounded-xl overflow-hidden"
      style={{
        border: `1px solid ${isPass ? 'rgba(74,222,128,0.15)' : 'rgba(248,113,113,0.2)'}`,
        background: isPass ? 'rgba(74,222,128,0.04)' : 'rgba(248,113,113,0.04)',
      }}
    >
      <button
        onClick={() => hasDetail && setOpen(o => !o)}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left"
        style={{ cursor: hasDetail ? 'pointer' : 'default' }}
      >
        {/* Left accent */}
        <div className="w-0.5 h-8 rounded-full flex-shrink-0"
          style={{ background: isPass ? '#4ade80' : '#f87171', opacity: 0.6 }} />

        <span className="font-mono text-[9px] text-white/20 flex-shrink-0 w-7">{String(index + 1).padStart(2, '0')}</span>
        <span className="flex-1 font-inter text-xs text-white/80 leading-snug">{r.name}</span>
        <StatusBadge status={r.status} duration={r.duration} />
        {hasDetail && (
          open
            ? <ChevronDown className="w-3 h-3 text-white/30 flex-shrink-0" />
            : <ChevronRight className="w-3 h-3 text-white/30 flex-shrink-0" />
        )}
      </button>

      <AnimatePresence>
        {open && hasDetail && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="border-t px-4 py-2 font-mono text-[10px] leading-relaxed"
            style={{
              borderColor: isPass ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)',
              background: isPass ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.25)',
              color: isPass ? '#86efac' : '#fca5a5',
            }}
          >
            {r.detail || r.error}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}