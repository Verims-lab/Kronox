import React, { useState, useEffect, useRef } from 'react';
import { Copy, CheckCheck } from 'lucide-react';

// Global log store — Game component buraya yazar, bu component okur
export const gameLogs = [];
export function addGameLog(msg) {
  const ts = new Date().toISOString().slice(11, 23);
  gameLogs.push(`[${ts}] ${msg}`);
  if (gameLogs.length > 100) gameLogs.shift();
}

export function isGameDebugLogEnabled() {
  if (import.meta.env.DEV || import.meta.env.VITE_KRONOX_GAME_DEBUG === 'true') return true;
  if (typeof window === 'undefined') return false;

  try {
    const params = new URLSearchParams(window.location.search);
    return params.get('debug') === '1' || window.localStorage?.getItem('kronox_debug') === '1';
  } catch (_error) {
    return false;
  }
}

export default function GameDebugLog() {
  const debugEnabled = isGameDebugLogEnabled();
  const [copied, setCopied] = useState(false);
  const [count, setCount] = useState(0);
  const copiedTimerRef = useRef(null);

  // Poll log count so button badge updates only when the debug control is explicitly enabled.
  useEffect(() => {
    if (!debugEnabled) return undefined;
    const id = setInterval(() => setCount(gameLogs.length), 500);
    return () => clearInterval(id);
  }, [debugEnabled]);

  useEffect(() => () => {
    if (copiedTimerRef.current) {
      clearTimeout(copiedTimerRef.current);
    }
  }, []);

  if (!debugEnabled) return null;

  const handleCopy = () => {
    const text = gameLogs.join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      if (copiedTimerRef.current) {
        clearTimeout(copiedTimerRef.current);
      }
      copiedTimerRef.current = setTimeout(() => {
        setCopied(false);
        copiedTimerRef.current = null;
      }, 2000);
    });
  };

  return (
    <button
      onClick={handleCopy}
      className="fixed bottom-20 right-3 z-50 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary/80 border border-border/60 text-xs font-inter text-muted-foreground hover:text-foreground hover:bg-secondary transition-all shadow-lg"
      style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Oyun debug loglarını kopyala"
    >
      {copied
        ? <><CheckCheck className="w-3.5 h-3.5 text-emerald-400" /> Kopyalandı!</>
        : <><Copy className="w-3.5 h-3.5" /> Log ({count})</>
      }
    </button>
  );
}
