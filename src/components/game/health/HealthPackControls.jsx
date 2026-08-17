import React from 'react';
import { Play } from 'lucide-react';
import { HEALTH_PACKS } from './healthCatalog';

export default function HealthPackControls({ running, onRunPack, lastRunsByPack }) {
  return (
    <div className="mb-3 rounded-md border border-white/10 bg-black/20 p-2">
      <div className="mb-2 text-[10px] font-bold uppercase tracking-wide text-white/45">Run packs</div>
      <div className="grid grid-cols-2 gap-1.5">
        {HEALTH_PACKS.map((pack) => {
          const last = lastRunsByPack?.[pack.id];
          return (
            <button
              key={pack.id}
              type="button"
              disabled={running}
              onClick={() => onRunPack(pack.id)}
              className="min-h-11 rounded-md border border-white/10 bg-white/[0.04] px-2 py-1.5 text-left disabled:opacity-45"
              aria-label={`Run ${pack.label} Health pack`}
            >
              <span className="flex items-center gap-1.5 text-[11px] font-semibold text-white"><Play className="h-3 w-3" />{pack.label}</span>
              <span className="mt-0.5 block truncate text-[9px] text-white/40">{last ? `${last.blockerSummary?.blockerCount || 0} blockers` : 'Not run'}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}