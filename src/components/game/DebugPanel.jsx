import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronDown } from 'lucide-react';

const logs = [];

// Intercept console.log
const originalLog = console.log;
console.log = (...args) => {
  originalLog(...args);
  const msg = args.map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
  ).join(' ');
  logs.push({ time: new Date().toLocaleTimeString(), msg, type: 'log' });
  if (logs.length > 50) logs.shift();
};

export default function DebugPanel() {
  const [open, setOpen] = useState(false);
  const [displayLogs, setDisplayLogs] = useState([]);

  useEffect(() => {
    const interval = setInterval(() => {
      setDisplayLogs([...logs]);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-20 right-4 w-10 h-10 rounded-full bg-primary/80 text-primary-foreground flex items-center justify-center text-xs font-bold z-40"
      >
        LOG
      </button>
    );
  }

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      className="fixed bottom-0 left-0 right-0 max-h-64 bg-background border-t border-border rounded-t-2xl z-40 flex flex-col"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-center justify-between p-3 border-b border-border">
        <p className="text-xs font-inter font-bold text-muted-foreground">CONSOLE ({displayLogs.length})</p>
        <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto space-y-1 p-3 font-mono text-xs text-foreground/80">
        {displayLogs.map((log, i) => (
          <div key={i} className="text-muted-foreground">
            <span className="text-primary/60">[{log.time}]</span> {log.msg}
          </div>
        ))}
      </div>
    </motion.div>
  );
}