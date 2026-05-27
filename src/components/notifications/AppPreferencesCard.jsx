import React, { useEffect, useState } from 'react';
import { Volume2, Vibrate, Smartphone, Info } from 'lucide-react';

/**
 * AppPreferencesCard — Codex096
 *
 * Profile → Ayarlar → Uygulama Ayarları block.
 * Purely presentational: shows safe app-level preference rows.
 *
 * IMPORTANT: This component does NOT mutate any real preference today.
 *  - Ses efektleri / Titreşim are marked "yakında" with a disabled control.
 *  - Hareket azaltma reads the system-level prefers-reduced-motion media
 *    query as a read-only status (no app override exists yet).
 *  - PWA install hint is informational only.
 *
 * Keep this file thin — when real preferences land, wire them here without
 * touching the SettingsPage layout.
 */

function useSystemReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduced(!!mq.matches);
    sync();
    mq.addEventListener?.('change', sync);
    return () => mq.removeEventListener?.('change', sync);
  }, []);
  return reduced;
}

function isStandalonePWA() {
  if (typeof window === 'undefined') return false;
  const mq = window.matchMedia?.('(display-mode: standalone)');
  // iOS Safari exposes navigator.standalone
  const iosStandalone = typeof navigator !== 'undefined' && navigator.standalone === true;
  return Boolean(mq?.matches || iosStandalone);
}

export default function AppPreferencesCard() {
  const reducedMotion = useSystemReducedMotion();
  const standalone = isStandalonePWA();

  return (
    <div
      className="rounded-2xl border p-4 space-y-3"
      style={{
        borderColor: 'rgba(120,170,255,0.22)',
        background: 'linear-gradient(180deg, rgba(30,41,75,0.38), rgba(8,13,30,0.72))',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 10px 24px rgba(2,6,23,0.22)',
      }}
    >
      <PrefRow
        icon={<Volume2 className="h-4 w-4" />}
        title="Ses efektleri"
        desc="Yakında: ses efektlerini açıp kapatabilirsin."
        rightSlot={<ComingSoonPill />}
      />
      <PrefRow
        icon={<Vibrate className="h-4 w-4" />}
        title="Titreşim"
        desc="Yakında: cihaz desteklediğinde titreşimi yönetebilirsin."
        rightSlot={<ComingSoonPill />}
      />
      <PrefRow
        icon={<Info className="h-4 w-4" />}
        title="Hareket azaltma"
        desc={
          reducedMotion
            ? 'Sistem ayarın açık — animasyonlar hafifletilecek.'
            : 'Sistem ayarın kapalı. Cihaz ayarlarından açabilirsin.'
        }
        rightSlot={
          <StatusPill
            tone={reducedMotion ? 'amber' : 'muted'}
            label={reducedMotion ? 'Açık' : 'Kapalı'}
          />
        }
      />
      <PrefRow
        icon={<Smartphone className="h-4 w-4" />}
        title="Ana ekrana ekle"
        desc={
          standalone
            ? 'Kronox bu cihazda yüklü uygulama olarak açık.'
            : 'Kronox’u ana ekrana ekleyerek daha iyi bildirim deneyimi alabilirsin.'
        }
        rightSlot={
          <StatusPill
            tone={standalone ? 'emerald' : 'muted'}
            label={standalone ? 'Yüklü' : 'Tarayıcı'}
          />
        }
      />
    </div>
  );
}

function PrefRow({ icon, title, desc, rightSlot }) {
  return (
    <div className="flex items-start gap-3">
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-amber-200"
        style={{
          background: 'linear-gradient(180deg, rgba(250,204,21,0.14), rgba(185,122,6,0.08))',
          boxShadow: 'inset 0 0 0 1px rgba(250,204,21,0.30)',
        }}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-inter text-sm font-bold text-foreground">{title}</p>
        {desc && <p className="font-inter text-[11px] text-muted-foreground">{desc}</p>}
      </div>
      {rightSlot && <div className="shrink-0">{rightSlot}</div>}
    </div>
  );
}

function ComingSoonPill() {
  return (
    <span
      className="rounded-full px-2 py-0.5 font-inter text-[10px] font-black uppercase tracking-widest text-blue-100/70"
      style={{
        background: 'rgba(120,170,255,0.10)',
        boxShadow: 'inset 0 0 0 1px rgba(120,170,255,0.30)',
      }}
    >
      Yakında
    </span>
  );
}

function StatusPill({ tone, label }) {
  const tones = {
    emerald: { bg: 'rgba(16,185,129,0.14)', ring: 'rgba(52,211,153,0.45)', fg: '#a7f3d0' },
    amber:   { bg: 'rgba(250,204,21,0.14)', ring: 'rgba(250,204,21,0.45)', fg: '#fde68a' },
    muted:   { bg: 'rgba(148,163,184,0.10)', ring: 'rgba(148,163,184,0.30)', fg: 'rgba(226,232,240,0.70)' },
  }[tone] || { bg: 'rgba(148,163,184,0.10)', ring: 'rgba(148,163,184,0.30)', fg: 'rgba(226,232,240,0.70)' };
  return (
    <span
      className="rounded-full px-2 py-0.5 font-inter text-[10px] font-black uppercase tracking-widest"
      style={{ background: tones.bg, color: tones.fg, boxShadow: `inset 0 0 0 1px ${tones.ring}` }}
    >
      {label}
    </span>
  );
}