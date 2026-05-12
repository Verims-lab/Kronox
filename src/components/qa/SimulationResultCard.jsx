import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import EventStream from './EventStream';

export default function SimulationResultCard({ scenarioKey, result }) {
  const [open, setOpen] = useState(false);
  const isPass = result.status === 'PASS';
  const isError = result.status === 'ERROR';

  const statusConfig = {
    PASS:  { icon: <CheckCircle2 className="w-4 h-4" />, color: '#4ade80', label: 'PASS' },
    FAIL:  { icon: <XCircle className="w-4 h-4" />, color: '#f87171', label: 'FAIL' },
    ERROR: { icon: <AlertTriangle className="w-4 h-4" />, color: '#facc15', label: 'ERROR' },
  }[result.status] || { icon: null, color: '#ffffff40', label: '?' };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className="rounded-2xl overflow-hidden"
      style={{
        border: `1px solid ${statusConfig.color}30`,
        background: isPass ? 'rgba(74,222,128,0.04)' : isError ? 'rgba(250,204,21,0.04)' : 'rgba(248,113,113,0.04)',
      }}
    >
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
      >
        <div style={{ color: statusConfig.color }}>{statusConfig.icon}</div>
        <div className="flex-1 min-w-0">
          <p className="font-inter text-xs font-semibold text-white/80 truncate">{scenarioKey}</p>
          {result.playerCount && (
            <span className="font-inter text-[10px] text-white/30">{result.playerCount} oyuncu</span>
          )}
        </div>
        <span className="font-inter text-[10px] font-bold px-2 py-0.5 rounded-lg"
          style={{ color: statusConfig.color, background: `${statusConfig.color}15` }}>
          {statusConfig.label}
        </span>
        {result.logs?.length > 0 && (
          open
            ? <ChevronDown className="w-3.5 h-3.5 text-white/30 flex-shrink-0" />
            : <ChevronRight className="w-3.5 h-3.5 text-white/30 flex-shrink-0" />
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="px-4 pb-4 border-t border-white/[0.06]"
          >
            <div className="pt-3">
              {result.logs?.length > 0 && (
                <EventStream logs={result.logs} title="SENARYO LOGU" maxHeight={180} />
              )}
              {result.error && (
                <p className="font-mono text-xs text-red-400 mt-2 px-2 py-1.5 rounded-lg bg-red-500/10">
                  {result.error}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}