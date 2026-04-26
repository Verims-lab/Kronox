import React, { useState, useEffect, useRef } from 'react';
import { Copy, CheckCheck } from 'lucide-react';

// Global log store — Game component buraya yazar, bu component okur
export const gameLogs = [];
export function addGameLog(msg) {
  const ts = new Date().toISOString().slice(11, 23);
  gameLogs.push(`[${ts}] ${msg}`);
  if (gameLogs.length > 100) gameLogs.shift();
}

export default function GameDebugLog() {
  const [copied, setCopied] = useState(false);
  const [count, setCount] = useState(0);

  // Poll log count so button badge updates
  useEffect(() => {
    const id = setInterval(() => setCount(gameLogs.length), 500);
    return () => clearInterval(id);
  }, []);

  const handleCopy = () => {
    const text = gameLogs.join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <button
      onClick={handleCopy}
      className="fixed bottom-20 right-3 z-50 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary/80 border border-border/60 text-xs font-inter text-muted-foreground hover:text-foreground hover:bg-secondary transition-all shadow-lg"
      style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
    >
      {copied
        ? <><CheckCheck className="w-3.5 h-3.5 text-emerald-400" /> Kopyalandı!</>
        : <><Copy className="w-3.5 h-3.5" /> Log ({count})</>
      }
    </button>
  );
}