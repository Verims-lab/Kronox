import React from 'react';
import { ArrowDownToLine } from 'lucide-react';

const LINKS = [
  ['Integrity Snapshot', 'B1 ekonomi / idempotency salt okunur dry-run kanıtı'],
  ['Soru Kalite Raporu', 'B3 soru QA ve manuel içerik onayı'],
  ['Kronox Health Simulator', 'Hedefli Health grupları ve deployability'],
];

export default function ReleaseProofLinks() {
  const go = (title) => {
    const section = document.querySelector(`[data-admin-section-title="${title}"]`) || document.querySelector(`[data-admin-tool-title="${title}"]`);
    if (!section) return;
    const header = section.matches('button') ? section : section.querySelector('button[aria-expanded]');
    if (header?.getAttribute('aria-expanded') === 'false') header.click();
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  return <section className="rounded-xl border border-white/10 bg-black/10 p-3"><h3 className="text-xs font-extrabold text-cyan-100">Mevcut Kanıt Alanları</h3><div className="mt-2 space-y-1">{LINKS.map(([title, detail]) => <button key={title} type="button" onClick={() => go(title)} className="flex min-h-11 w-full items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-2 text-left"><ArrowDownToLine className="h-3.5 w-3.5 shrink-0 text-primary" /><span className="min-w-0"><strong className="block text-[10px] text-white">{title}</strong><span className="block text-[9px] text-muted-foreground">{detail}</span></span></button>)}</div></section>;
}