import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Copy, ChevronDown, ChevronUp } from 'lucide-react';

export default function SoloQuestionDebugPanel({ payload }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const debugText = useMemo(() => {
    if (!payload) return '';
    try {
      return JSON.stringify(payload, null, 2);
    } catch {
      return '';
    }
  }, [payload]);

  if (!payload?.isDebugAllowed || !debugText) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(debugText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div
      className="fixed left-3 right-3 z-[70] mx-auto max-w-5xl rounded-lg border border-cyan-400/30 bg-slate-950/95 text-white shadow-2xl backdrop-blur"
      style={{ bottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
        <button
          type="button"
          className="flex min-h-9 items-center gap-2 rounded-md px-2 text-left font-inter text-sm font-semibold text-cyan-100"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          Solo Query Debug
          <span className="rounded-full border border-cyan-300/30 px-2 py-0.5 text-[11px] font-medium text-cyan-200/80">
            admin/owner
          </span>
        </button>
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" variant="outline" onClick={handleCopy} className="h-8 gap-2">
            <Copy className="h-3.5 w-3.5" />
            {copied ? 'Copied' : 'Copy Debug JSON'}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setOpen((value) => !value)} className="h-8">
            {open ? 'Hide' : 'Show'}
          </Button>
        </div>
      </div>
      {open && (
        <div className="border-t border-white/10 p-3">
          <textarea
            readOnly
            value={debugText}
            spellCheck={false}
            className="h-72 w-full resize-y rounded-md border border-white/10 bg-black/60 p-3 font-mono text-[11px] leading-relaxed text-cyan-50 outline-none"
          />
        </div>
      )}
    </div>
  );
}
