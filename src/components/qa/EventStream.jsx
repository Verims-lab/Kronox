import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal } from 'lucide-react';

const LOG_COLORS = {
  success: { text: '#4ade80', bg: 'rgba(74,222,128,0.08)', prefix: '✅' },
  error:   { text: '#f87171', bg: 'rgba(248,113,113,0.08)', prefix: '❌' },
  warn:    { text: '#facc15', bg: 'rgba(250,204,21,0.08)',  prefix: '⚠️' },
  info:    { text: '#60a5fa', bg: 'rgba(96,165,250,0.08)', prefix: 'ℹ️' },
  system:  { text: '#a78bfa', bg: 'rgba(167,139,250,0.08)', prefix: '⚡' },
};

function classifyLog(text) {
  if (text.startsWith('✅') || text.includes('PASS') || text.includes('doğru') || text.includes('başarılı')) return 'success';
  if (text.startsWith('❌') || text.includes('FAIL') || text.includes('ERROR') || text.includes('hata')) return 'error';
  if (text.startsWith('⚠️') || text.includes('uyar')) return 'warn';
  if (text.startsWith('ℹ️') || text.startsWith('📊') || text.startsWith('📐') || text.startsWith('📱')) return 'info';
  return 'system';
}

export default function EventStream({ logs = [], title = 'EVENT STREAM', maxHeight = 200 }) {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="rounded-2xl overflow-hidden"
      style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.3)' }}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.06]">
        <Terminal className="w-3.5 h-3.5 text-white/30" />
        <span className="font-inter text-[9px] uppercase tracking-widest text-white/30 flex-1">{title}</span>
        <div className="flex gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-red-500/50" />
          <div className="w-1.5 h-1.5 rounded-full bg-yellow-500/50" />
          <div className="w-1.5 h-1.5 rounded-full bg-green-500/50" />
        </div>
      </div>
      {/* Log body */}
      <div ref={scrollRef} className="overflow-y-auto px-3 py-2 space-y-0.5 font-mono"
        style={{ maxHeight, scrollbarWidth: 'none' }}>
        {logs.length === 0 ? (
          <p className="text-[10px] text-white/20 italic py-2">// simülasyon çalıştırıldığında olaylar burada görünür...</p>
        ) : (
          <AnimatePresence initial={false}>
            {logs.map((log, i) => {
              const type = classifyLog(log);
              const style = LOG_COLORS[type];
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.15 }}
                  className="flex gap-2 py-0.5 px-1.5 rounded text-[10px] leading-relaxed"
                  style={{ background: style.bg }}
                >
                  <span className="flex-shrink-0 text-white/20" style={{ minWidth: 40 }}>
                    {String(i + 1).padStart(3, '0')}
                  </span>
                  <span style={{ color: style.text }}>{log}</span>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}