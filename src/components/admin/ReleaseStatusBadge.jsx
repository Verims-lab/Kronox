import React from 'react';

const tones = {
  Engelli: 'border-red-400/30 bg-red-500/10 text-red-100',
  Harici: 'border-violet-400/30 bg-violet-500/10 text-violet-100',
  Manuel: 'border-amber-400/30 bg-amber-500/10 text-amber-100',
};

export default function ReleaseStatusBadge({ status }) {
  const tone = tones[status] || 'border-cyan-400/25 bg-cyan-500/10 text-cyan-100';
  return <span className={`shrink-0 rounded-full border px-2 py-1 text-[9px] font-extrabold ${tone}`}>{status}</span>;
}