import React, { useCallback, useEffect, useState } from 'react';
import { Gem, Sparkles, Trophy } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import ScreenHeader from '@/components/layout/ScreenHeader';
import { ensureSoloProgressBackfill, getSoloLevelCount, readSoloProgress } from '@/lib/soloLevels';
import { summarizeSoloProgress } from '@/lib/soloProgressHelpers';
import { loadFriends } from '@/lib/friendsApi';
import {
  getLeaderboardDiamondValue,
  LEADERBOARD_FETCH_LIMIT,
  LEADERBOARD_TOP_LIMIT,
  rankSoloLeaderboardUsers,
  selectLeaderboardSections,
} from '@/lib/leaderboard';
import { isAdminUser } from '@/lib/admin';
import KronoxRankingSection from '@/components/leaderboard/KronoxRankingSection';

/**
 * Codex119 — Liderlik graceful fallback.
 *
 * The page keeps owning data fetching, but the "Kronox Sıralaması" section
 * UI was extracted to a small focused component (KronoxRankingSection).
 *
 * Fallback rules (when global ranking can't be produced):
 *   • Stat cards (Puan / Level / Elmas) stay visible from the user's own
 *     Solo progress source — the page never feels broken.
 *   • The ranking section shows a neutral "hazırlanıyor" placeholder,
 *     NOT a red error box. End users never see backend permission wording.
 *   • The user's OWN totalSoloScore is shown inside the placeholder so
 *     they always see their score on this screen.
 *   • Admins additionally see a small technical diagnostics line.
 *   • Retry button stays available.
 *
 * Solo scoring, progression, drag/drop, Timeline, QuestionCard,
 * GameLayout, invite/lobby/notification/tutorial logic — untouched.
 */
export default function LeaderboardPage() {
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [leaderboard, setLeaderboard] = useState({
    loading: false,
    loaded: false,
    error: '',
    rankedRows: [],
    topRows: [],
    currentUserRow: null,
    currentUserInTop: false,
    friendsOutsideTop: [],
    friendCount: 0,
    // Codex119 — own-score fallback always travels with the leaderboard
    // state so the placeholder block can render it without re-reading
    // progress in the child component.
    ownScoreFallback: { totalSoloScore: 0, currentLevel: 1 },
  });

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
      .finally(() => setAuthChecked(true));
  }, []);

  const loadLeaderboard = useCallback(async () => {
    if (!user?.email) return;

    // Codex119 — own-score fallback is computed from the user's own
    // progress source. It is set up-front so the placeholder block can
    // render the correct Puan even before the global call resolves
    // (and especially when it fails).
    const ownProgress = readSoloProgress(user);
    const ownSummary = summarizeSoloProgress(ownProgress, getSoloLevelCount());
    const ownScoreFallback = {
      totalSoloScore: ownSummary.totalSoloScore,
      currentLevel: ownSummary.currentLevel,
    };

    setLeaderboard((prev) => ({ ...prev, loading: true, error: '', ownScoreFallback }));
    try {
      const [users, friends] = await Promise.all([
        base44.entities.User.list('-updated_date', LEADERBOARD_FETCH_LIMIT),
        loadFriends(user.email).catch(() => []),
      ]);
      const readableUsers = Array.isArray(users) ? users : [];
      if (readableUsers.length === 0) {
        setLeaderboard({
          loading: false,
          loaded: true,
          error: '',
          rankedRows: [],
          topRows: [],
          currentUserRow: null,
          currentUserInTop: false,
          friendsOutsideTop: [],
          friendCount: 0,
          ownScoreFallback,
        });
        return;
      }
      const friendEmails = (friends || []).map((friend) => friend.friend_email).filter(Boolean);
      const rankedRows = rankSoloLeaderboardUsers(readableUsers, friendEmails, user);
      const sections = selectLeaderboardSections(rankedRows, user.email, LEADERBOARD_TOP_LIMIT);
      setLeaderboard({
        loading: false,
        loaded: true,
        error: '',
        rankedRows,
        ...sections,
        friendCount: friendEmails.length,
        ownScoreFallback,
      });
    } catch (err) {
      setLeaderboard({
        loading: false,
        loaded: true,
        error: err?.message || 'Sıralama verisi yüklenemedi.',
        rankedRows: [],
        topRows: [],
        currentUserRow: null,
        currentUserInTop: false,
        friendsOutsideTop: [],
        friendCount: 0,
        ownScoreFallback,
      });
    }
  }, [user]);

  useEffect(() => {
    if (authChecked && user?.email) {
      loadLeaderboard();
    }
  }, [authChecked, user?.email, loadLeaderboard]);

  const progress = readSoloProgress(user);
  const summary = summarizeSoloProgress(progress, getSoloLevelCount());
  const diamondValue = getLeaderboardDiamondValue(user);
  const isAdmin = isAdminUser(user);

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
          <p className="font-cinzel text-lg tracking-widest text-amber-200">Liderlik Tablosu</p>
          <p className="mt-2 font-inter text-xs text-blue-100/70 leading-relaxed">
            Solo puanın artık profilindeki ilerleme kaydından geliyor.
          </p>

          {/* Codex119 — stat cards always show the user's own values from
              the shared Solo summary, regardless of global ranking state. */}
          <div className="mt-4 grid grid-cols-3 gap-2">
            <StatTile icon={Trophy} label="Puan" value={summary.totalSoloScore} tint="#facc15" />
            <StatTile icon={Sparkles} label="Level" value={summary.currentLevel} tint="#60a5fa" />
            <StatTile icon={Gem} label="Elmas" value={diamondValue} tint="#7dd3fc" />
          </div>
        </div>

        <KronoxRankingSection
          authChecked={authChecked}
          user={user}
          leaderboard={leaderboard}
          onRetry={loadLeaderboard}
          isAdmin={isAdmin}
        />
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