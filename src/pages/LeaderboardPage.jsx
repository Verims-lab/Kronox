import React, { useEffect, useState } from 'react';
import { Trophy } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import ScreenHeader from '@/components/layout/ScreenHeader';

/**
 * Codex102 — Leaderboard placeholder.
 *
 * Brief explicitly says: no fake economy / fake values. We do NOT have a
 * global leaderboard backend yet, so this screen renders the standardized
 * header + a clearly labeled "coming soon" empty state. When the real
 * leaderboard backend lands, the body can be replaced without touching
 * the header/nav layout contract.
 */
export default function LeaderboardPage() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then((u) => setUser(u || null)).catch(() => setUser(null));
  }, []);

  return (
    <div
      className="min-h-screen bg-background text-white"
      style={{
        paddingTop: 'calc(4rem + env(safe-area-inset-top))',
        paddingBottom: 'calc(5rem + env(safe-area-inset-bottom))',
        background:
          'radial-gradient(ellipse at 50% 12%, rgba(59,130,246,0.30), transparent 45%), linear-gradient(180deg, #050b1c 0%, #0a1738 55%, #03060f 100%)',
        userSelect: 'none',
      }}
    >
      <ScreenHeader title="Liderlik" user={user} />

      <div className="mx-auto w-full max-w-md px-4 mt-2">
        <div
          className="rounded-2xl p-6 text-center"
          style={{
            background: 'linear-gradient(180deg, rgba(30,41,75,0.9), rgba(10,16,36,0.95))',
            boxShadow: 'inset 0 0 0 1.5px rgba(120,170,255,0.30), 0 12px 24px rgba(2,6,23,0.5)',
          }}
        >
          <div
            className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full"
            style={{
              background: 'radial-gradient(circle at 35% 28%, #ffe066, #b97a06 70%)',
              boxShadow: '0 0 18px rgba(250,204,21,0.55), inset 0 1px 0 rgba(255,255,255,0.45)',
            }}
          >
            <Trophy className="h-7 w-7 text-amber-950" strokeWidth={2.4} />
          </div>
          <p className="font-cinzel text-lg tracking-widest text-amber-200">
            Liderlik Tablosu
          </p>
          <p className="mt-2 font-inter text-xs text-blue-100/70 leading-relaxed">
            Küresel sıralama yakında. Şimdilik kendi rekorlarını
            <br />
            Ayarlar &rsaquo; En İyi 5 Rekorun bölümünden görebilirsin.
          </p>
        </div>
      </div>
    </div>
  );
}