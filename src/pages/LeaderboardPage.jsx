import React, { useEffect, useState } from 'react';
import { Sparkles, Star, Trophy, Users } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import ScreenHeader from '@/components/layout/ScreenHeader';
import { getSoloLevelCount, readSoloProgress } from '@/lib/soloLevels';
import { summarizeSoloProgress } from '@/lib/soloProgressHelpers';

/**
 * Codex111 — Solo score-aware Leaderboard shell.
 *
 * We show REAL user-specific Solo totals from User.solo_progress, but we do
 * NOT fake friend/global ranks. Cross-user ranking needs a server-side
 * aggregation function or a dedicated leaderboard entity.
 */
export default function LeaderboardPage() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then((u) => setUser(u || null)).catch(() => setUser(null));
  }, []);

  const progress = readSoloProgress(user);
  const summary = summarizeSoloProgress(progress, getSoloLevelCount());

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

      <div className="mx-auto w-full max-w-md px-4 mt-2 space-y-3">
        <div
          className="rounded-2xl p-5 text-center"
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
            Solo puanın artık profilindeki ilerleme kaydından geliyor.
          </p>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <StatTile icon={Trophy} label="Puan" value={summary.totalSoloScore} tint="#facc15" />
            <StatTile icon={Sparkles} label="Level" value={summary.currentLevel} tint="#60a5fa" />
            <StatTile icon={Star} label="Yıldız" value={summary.totalStars} tint="#7dd3fc" />
          </div>
        </div>

        <div
          className="rounded-2xl p-4"
          style={{
            background: 'linear-gradient(180deg, rgba(30,41,75,0.72), rgba(10,16,36,0.88))',
            boxShadow: 'inset 0 0 0 1.5px rgba(120,170,255,0.24), 0 10px 20px rgba(2,6,23,0.42)',
          }}
        >
          <div className="flex items-start gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-amber-200"
              style={{
                background: 'linear-gradient(180deg, rgba(250,204,21,0.16), rgba(185,122,6,0.10))',
                boxShadow: 'inset 0 0 0 1px rgba(250,204,21,0.42)',
              }}
            >
              <Users className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="font-inter text-sm font-black text-white">Arkadaş Sıralaması</p>
              <p className="mt-1 font-inter text-[11px] leading-relaxed text-blue-100/70">
                Arkadaşlarınla yarışmak için onları davet et. Gerçek arkadaş
                skorları hazır olunca burada puana göre sıralanacak.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatTile({ icon: Icon, label, value, tint }) {
  return (
    <div
      className="rounded-2xl p-3 text-center"
      style={{
        background: 'linear-gradient(180deg, rgba(255,255,255,0.07), rgba(255,255,255,0.035))',
        boxShadow: `inset 0 0 0 1px ${tint}55`,
      }}
    >
      <Icon className="mx-auto h-4 w-4" style={{ color: tint }} />
      <p className="mt-1 font-bangers text-xl leading-none tracking-wider" style={{ color: tint }}>
        {value}
      </p>
      <p className="mt-1 font-inter text-[9px] font-black uppercase tracking-widest text-blue-100/60">
        {label}
      </p>
    </div>
  );
}
