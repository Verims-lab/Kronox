import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

export default function DebugConsole() {
  const [visible, setVisible] = useState(false);
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    const originalLog = console.log;
    const originalError = console.error;
    
    const addLog = (type, args) => {
      const message = args.map(arg => 
        typeof arg === 'string' ? arg : JSON.stringify(arg)
      ).join(' ');
      setLogs(prev => [...prev, { type, message, timestamp: new Date().toLocaleTimeString() }].slice(-20));
    };

    console.log = (...args) => {
      addLog('log', args);
      originalLog(...args);
    };

    console.error = (...args) => {
      addLog('error', args);
      originalError(...args);
    };

    return () => {
      console.log = originalLog;
      console.error = originalError;
    };
  }, []);

  return (
    <>
      <button
        onClick={() => setVisible(!visible)}
        className="fixed bottom-20 right-4 z-50 w-10 h-10 rounded-full bg-primary/80 text-primary-foreground text-xs font-bold hover:bg-primary transition-all"
        style={{ pointerEvents: 'auto' }}
      >
        {visible ? '✕' : '◇'}
      </button>

      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-32 right-4 z-50 w-72 h-64 bg-card border border-border rounded-lg overflow-hidden shadow-2xl flex flex-col"
            style={{ pointerEvents: 'auto' }}
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-secondary/50">
              <span className="text-xs font-mono text-muted-foreground">Console</span>
              <button onClick={() => setVisible(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-3 h-3" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-2 py-2 font-mono text-xs space-y-1">
              {logs.length === 0 ? (
                <span className="text-muted-foreground">No logs yet...</span>
              ) : (
                logs.map((log, i) => (
                  <div key={i} className={log.type === 'error' ? 'text-destructive' : 'text-muted-foreground'}>
                    <span className="text-primary/60">[{log.timestamp}]</span> {log.message}
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}