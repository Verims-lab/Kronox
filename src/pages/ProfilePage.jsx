import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Users, Trophy, Sparkles, Gem, Settings, ChevronRight, LogOut, UserRound, LogIn } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { sounds } from '@/lib/gameSounds';
import { isAdminUser } from '@/lib/admin';
import ScreenHeader from '@/components/layout/ScreenHeader';
// Codex111 — Profile Level + Solo score read through the SAME shared
// progress/summary helpers the Solo Level Path and Leaderboard use.
// A stale `currentLevel` can no longer make Profile drift from Solo, and
// Puan/Level are real values from User.solo_progress rather than UI-only
// placeholders.
import { ensureSoloProgressBackfill, readSoloProgress, getSoloLevelCount } from '@/lib/soloLevels';
// Codex114 — Profile Level tile MUST share the same source of truth Solo
// uses. Importing getCurrentPlayableLevel on its own line keeps that
// contract self-evident from the import surface and matches the Health
// case `profile_level_uses_shared_helper`.
import { getCurrentPlayableLevel } from '@/lib/soloProgressHelpers';
import { summarizeSoloProgress } from '@/lib/soloProgressHelpers';
import { getLeaderboardDiamondValue } from '@/lib/leaderboard';

/**
 * ProfilePage — first-pass shell.
 * Sections: Arkadaşlarım, Stats (Puan / Level / Elmas), Ayarlar.
 *
 * Data note (placeholders vs real):
 *  - identity (name/email): REAL — from base44.auth.me()
 *  - friends count: PLACEHOLDER (0) — no friends system yet
 *  - puan/level: REAL — derived from User.solo_progress (shared with Solo
 *    Level Path and Leaderboard via summarizeSoloProgress / getCurrentPlayableLevel)
 *  - elmas: REAL when a profile/economy field exists, otherwise safe 0
 *    PLACEHOLDER. Never derived from stars, score, or completed levels.
 *  - admin badge: REAL — via isAdminUser()
 */
export default function ProfilePage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.auth.me()
      .then(async (u) => {
        if (!u) {
          setUser(null);
          return;
        }
        const normalizedProgress = await ensureSoloProgressBackfill(u);
        setUser({ ...u, solo_progress: normalizedProgress });
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const isAdmin = isAdminUser(user);

  const goSettings = () => { sounds.tap(); navigate('/settings'); };
  const handleLogin = () => { sounds.tap(); base44.auth.redirectToLogin('/profile'); };
  const handleLogout = () => { sounds.tap(); base44.auth.logout('/'); };

  // Codex111 — Profile stats use the shared Solo summary. The Level tile
  // stays identical to Solo's CTA and self-heals from completed-level data.
  const soloProgress = useMemo(() => readSoloProgress(user), [user]);
  const soloSummary = useMemo(
    () => summarizeSoloProgress(soloProgress, getSoloLevelCount()),
    [soloProgress],
  );
  const profileLevel = useMemo(
    () => getCurrentPlayableLevel(soloProgress, getSoloLevelCount()),
    [soloProgress],
  );

  // Codex116 — Stats tiles match Liderlik 3-card row: Puan / Level / Elmas.
  //   Puan  → REAL — soloSummary.totalSoloScore (totalSoloScore from
  //           User.solo_progress, see summarizeSoloProgress).
  //   Level → REAL — getCurrentPlayableLevel(soloProgress) (same source
  //           Solo Level Path uses).
  //   Elmas → REAL when a profile/economy field exists, otherwise a safe
  //           0 PLACEHOLDER. Never derived from Yıldız, score, or
  //           completed levels. No economy yet — do NOT wire this to any
  //           wallet/economy entity until a real backend exists.
  // Yıldız tile is intentionally NOT in Profile stats anymore (moved out
  // per product decision). totalSoloScore from soloSummary is still used,
  // so the shared solo progress source stays intact.
  const diamondValue = getProfileDiamondValue(user); // PLACEHOLDER 0 when no economy yet
  const stats = [
    { id: 'puan',  label: 'Puan',  value: soloSummary.totalSoloScore, icon: Trophy,   tint: 'gold' },
    { id: 'level', label: 'Level', value: profileLevel, icon: Sparkles, tint: 'portal' },
    { id: 'elmas', label: 'Elmas', value: diamondValue, icon: Gem, tint: 'cyan' },
  ];

  return (
    <div
      className="min-h-screen bg-background text-white"
      style={{
        paddingTop: 'calc(4rem + env(safe-area-inset-top))',
        paddingBottom: 'calc(5rem + env(safe-area-inset-bottom))',
        background:
          'radial-gradient(ellipse at 50% 12%, rgba(59,130,246,0.30), transparent 45%), radial-gradient(ellipse at 50% 92%, rgba(34,211,238,0.10), transparent 55%), linear-gradient(180deg, #050b1c 0%, #0a1738 55%, #03060f 100%)',
        userSelect: 'none',
      }}
    >
      <ScreenHeader title="Profil" user={user} />
      <div className="mx-auto w-full max-w-md px-4 space-y-5">

        {/* Identity card */}
        <IdentityCard
          loading={loading}
          user={user}
          isAdmin={isAdmin}
          onLogin={handleLogin}
          onLogout={handleLogout}
        />

        {/* Stats: Puan / Level / Elmas — single horizontal row matching
            Liderlik. Puan/Level are real solo_progress values; Elmas is a
            PLACEHOLDER tile (0) when no economy backend exists. Yıldız is
            intentionally NOT shown here anymore. */}
        <Section label="İstatistikler">
          <div className="grid grid-cols-3 gap-2">
            {stats.map((s) => (
              <StatTile key={s.id} {...s} />
            ))}
          </div>
        </Section>

        {/* Arkadaşlarım */}
        <Section label="Sosyal">
          <RowCard
            icon={<Users className="w-4 h-4" />}
            title="Arkadaşlarım"
            desc="Arkadaş ekle, davet et, birlikte oyna"
            onClick={() => { sounds.tap(); navigate('/friends'); }}
          />
        </Section>

        {/* Ayarlar — moves under Profile */}
        <Section label="Hesap">
          <RowCard
            icon={<Settings className="w-4 h-4" />}
            title="Ayarlar"
            desc={isAdmin ? 'Hesap, yardım ve admin araçları' : 'Hesap ve yardım'}
            onClick={goSettings}
          />
        </Section>
      </div>
    </div>
  );
}

/* ---------------- Internal helpers ---------------- */

// Codex116 — Read real diamond/economy value from the user profile when one
// of the recognized fields exists; otherwise return a safe 0 PLACEHOLDER.
// IMPORTANT: never derive this from Yıldız, score, or completed levels —
// no economy yet means the UI must not invent a balance. Mirror of
// Leaderboard's getLeaderboardDiamondValue so both surfaces agree.
function getProfileDiamondValue(user) {
  return getLeaderboardDiamondValue(user);
}

/* ---------------- Internal components ---------------- */

function IdentityCard({ loading, user, isAdmin, onLogin, onLogout }) {
  const displayName = user?.full_name || (user?.email ? user.email.split('@')[0] : 'Misafir Oyuncu');
  const initial = (displayName || '?').trim().charAt(0).toUpperCase();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 320, damping: 26 }}
      className="rounded-2xl p-4"
      style={{
        background:
          'linear-gradient(180deg, rgba(30,41,75,0.95) 0%, rgba(14,22,46,0.98) 70%, rgba(6,10,24,1) 100%)',
        boxShadow:
          'inset 0 0 0 1.5px rgba(120,170,255,0.35), inset 0 1px 0 rgba(255,255,255,0.10), inset 0 -14px 18px rgba(0,0,0,0.55), 0 0 24px rgba(59,130,246,0.22), 0 12px 24px rgba(2,6,23,0.55)',
      }}
    >
      <div className="flex items-center gap-3">
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full"
          style={{
            background: 'radial-gradient(circle at 35% 28%, #ffe066, #b97a06 70%)',
            boxShadow:
              '0 0 22px rgba(250,204,21,0.55), inset 0 1px 0 rgba(255,255,255,0.45), inset 0 -6px 8px rgba(140,80,8,0.55)',
          }}
        >
          {user ? (
            <span className="font-bangers text-2xl text-amber-950">{initial}</span>
          ) : (
            <UserRound className="h-7 w-7 text-amber-950" strokeWidth={2.6} />
          )}
        </div>

        <div className="min-w-0 flex-1">
          {loading ? (
            <div className="space-y-2">
              <div className="h-3 w-32 rounded bg-white/10 animate-pulse" />
              <div className="h-2.5 w-48 rounded bg-white/5 animate-pulse" />
            </div>
          ) : user ? (
            <>
              <div className="flex items-center gap-2 min-w-0">
                <p className="truncate font-cinzel text-base tracking-wider text-white">{displayName}</p>
                {isAdmin && (
                  <span
                    className="shrink-0 rounded-md px-1.5 py-[1px] font-inter text-[9px] font-black uppercase tracking-widest"
                    style={{
                      color: '#231405',
                      background: 'linear-gradient(180deg,#ffe066,#b97a06)',
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.5), 0 0 8px rgba(250,204,21,0.5)',
                    }}
                  >
                    Admin
                  </span>
                )}
              </div>
              {user.email && (
                <p className="truncate font-inter text-[11px] text-blue-100/70">{user.email}</p>
              )}
            </>
          ) : (
            <>
              <p className="font-cinzel text-base tracking-wider text-white">Misafir Oyuncu</p>
              <p className="font-inter text-[11px] text-blue-100/70">Giriş yaparak ilerlemeni kaydet</p>
            </>
          )}
        </div>

        {!loading && (user ? (
          <button
            type="button"
            onClick={onLogout}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white/60 hover:text-white"
            aria-label="Çıkış yap"
          >
            <LogOut className="h-5 w-5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={onLogin}
            className="flex h-10 items-center gap-1 rounded-full px-3 font-inter text-[12px] font-black text-amber-100"
            style={{
              background: 'linear-gradient(180deg, rgba(250,204,21,0.18), rgba(185,122,6,0.12))',
              boxShadow: 'inset 0 0 0 1px rgba(250,204,21,0.55), 0 0 12px rgba(250,204,21,0.30)',
            }}
            aria-label="Giriş yap"
          >
            <LogIn className="h-4 w-4" /> Giriş
          </button>
        ))}
      </div>
    </motion.div>
  );
}

function Section({ label, children }) {
  return (
    <div className="space-y-2">
      <p className="font-inter text-[10px] text-blue-100/60 font-black uppercase tracking-[0.18em] px-1">
        {label}
      </p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function StatTile({ label, value, icon: Icon, tint }) {
  const tints = {
    gold:   { glow: 'rgba(250,204,21,0.35)',  ring: 'rgba(250,204,21,0.55)',  fg: '#facc15' },
    portal: { glow: 'rgba(59,130,246,0.40)',  ring: 'rgba(96,165,250,0.55)',  fg: '#60a5fa' },
    cyan:   { glow: 'rgba(34,211,238,0.40)',  ring: 'rgba(125,211,252,0.55)', fg: '#7dd3fc' },
  }[tint] || { glow: 'rgba(255,255,255,0.2)', ring: 'rgba(255,255,255,0.3)', fg: '#fff' };

  return (
    <div
      className="rounded-2xl p-3 flex flex-col items-center justify-center gap-1"
      style={{
        background: 'linear-gradient(180deg, rgba(30,41,75,0.9), rgba(10,16,36,0.95))',
        boxShadow: `inset 0 0 0 1.5px ${tints.ring}, inset 0 1px 0 rgba(255,255,255,0.08), 0 0 18px ${tints.glow}, 0 8px 16px rgba(2,6,23,0.5)`,
        minHeight: 86,
      }}
    >
      <Icon className="w-4 h-4" style={{ color: tints.fg }} />
      <p className="font-bangers text-xl leading-none tracking-wider" style={{ color: tints.fg, textShadow: `0 0 10px ${tints.glow}` }}>
        {value}
      </p>
      <p className="font-inter text-[10px] font-black uppercase tracking-widest text-blue-100/70">
        {label}
      </p>
    </div>
  );
}

function RowCard({ icon, title, desc, badge, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full flex items-center gap-3 p-4 rounded-2xl text-left transition-all disabled:opacity-70"
      style={{
        background: 'linear-gradient(180deg, rgba(30,41,75,0.9), rgba(10,16,36,0.95))',
        boxShadow:
          'inset 0 0 0 1.5px rgba(120,170,255,0.32), inset 0 1px 0 rgba(255,255,255,0.08), 0 0 16px rgba(59,130,246,0.18), 0 8px 16px rgba(2,6,23,0.45)',
      }}
    >
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-amber-200"
        style={{
          background: 'linear-gradient(180deg, rgba(250,204,21,0.16), rgba(185,122,6,0.10))',
          boxShadow: 'inset 0 0 0 1px rgba(250,204,21,0.45)',
        }}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-inter text-sm font-bold text-white truncate">{title}</p>
        {desc && <p className="font-inter text-[11px] text-blue-100/70 truncate">{desc}</p>}
      </div>
      {typeof badge !== 'undefined' && (
        <span
          className="rounded-full px-2 py-0.5 font-inter text-[10px] font-black text-amber-200"
          style={{ background: 'rgba(250,204,21,0.10)', boxShadow: 'inset 0 0 0 1px rgba(250,204,21,0.35)' }}
        >
          {badge}
        </span>
      )}
      {!disabled && <ChevronRight className="w-4 h-4 text-white/40" />}
    </button>
  );
}
