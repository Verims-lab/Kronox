import React, { useCallback, useEffect, useState } from 'react';
import { Gem, Sparkles, Trophy } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import ScreenHeader from '@/components/layout/ScreenHeader';
import { ensureSoloProgressBackfill, getSoloLevelCount, readSoloProgress } from '@/lib/soloLevels';
import { summarizeSoloProgress } from '@/lib/soloProgressHelpers';
import { getKronoxVisibleScore } from '@/lib/kronoxScore';
import { loadFriends } from '@/lib/friendsApi';
import {
  getLeaderboardDiamondValue,
  getLeaderboardOwnerKey,
  getFriendLeaderboardKeys,
  LEADERBOARD_FETCH_LIMIT,
  LEADERBOARD_TOP_LIMIT,
  buildSoloLeaderboardPayload,
  loadSoloLeaderboardEntries,
  publishSoloLeaderboardEntry,
  rankSoloLeaderboardEntries,
  selectLeaderboardSections,
  toSoloLeaderboardEntry,
} from '@/lib/leaderboard';
import { isAdminUser } from '@/lib/admin';
import KronoxRankingSection from '@/components/leaderboard/KronoxRankingSection';
// Phase 3 — Codex123 UI consolidation. Profile + Leaderboard now share
// one StatTile. Compact variant matches the previous lighter look used
// inside the Liderlik summary hero card. Data sources unchanged.
import KronoxStatTile from '@/components/ui/KronoxStatTile';

/**
 * Codex117/Codex119/Codex150 — Public-safe Kronox leaderboard with
 * graceful fallback.
 *
 * We show REAL user-specific Kronox Puan from User.solo_progress +
 * User.online_progress and mirror it into SoloLeaderboardEntry rows that
 * expose only public-safe rank data.
 * The page owns data fetching; the "Kronox Sıralaması" UI lives in the
 * focused KronoxRankingSection component.
 *
 * Fallback rules:
 *   • Stat cards (Puan / Level / Elmas) stay visible from the user's own
 *     persisted sources — Puan is visible Kronox Puan, Level is Solo.
 *   • The ranking section shows a neutral "hazırlanıyor" placeholder,
 *     NOT a red error box. End users never see backend permission wording.
 *   • The user's OWN visible Kronox Puan is shown inside the placeholder
 *     so Online score changes are visible even while global ranking loads.
 *   • Admins additionally see a small technical diagnostics line.
 *   • Retry button stays available.
 *   • No private full User row ranking dependency, fake users, or raw emails.
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
    ownScoreRow: null,
    rankFinalizing: false,
    friendCount: 0,
    // Codex119 — own-score fallback always travels with the leaderboard
    // state so the placeholder block can render it without re-reading
    // progress in the child component.
    ownScoreFallback: { totalKronoxScore: 0, totalSoloScore: 0, currentLevel: 1 },
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

    // Codex150 — own-score fallback and ranking rows use visible Kronox
    // Puan. Solo and Online storage remain separate, but the row score
    // shown and sorted here must match Profile/Header Puan.
    const currentProgress = readSoloProgress(user);
    const currentOwnerKey = getLeaderboardOwnerKey(user.email);
    const currentPayload = buildSoloLeaderboardPayload(user, currentProgress);
    const ownSummary = summarizeSoloProgress(currentProgress, getSoloLevelCount());
    const ownScoreFallback = {
      totalKronoxScore: getKronoxVisibleScore(user, { soloProgress: currentProgress }),
      totalSoloScore: ownSummary.totalSoloScore,
      currentLevel: ownSummary.currentLevel,
    };

    setLeaderboard((prev) => ({ ...prev, loading: true, error: '', ownScoreFallback }));
    try {
      const [publishedRow, rows, friends] = await Promise.all([
        publishSoloLeaderboardEntry(user, currentProgress).catch(() => null),
        loadSoloLeaderboardEntries(LEADERBOARD_FETCH_LIMIT),
        loadFriends(user.email).catch(() => []),
      ]);
      const friendEmails = (friends || []).map((friend) => friend.friend_email).filter(Boolean);
      const friendKeys = getFriendLeaderboardKeys(friendEmails);
      const readableRows = Array.isArray(rows) ? [...rows] : [];
      if (publishedRow?.owner_key) {
        const ownIndex = readableRows.findIndex((row) => row?.owner_key === publishedRow.owner_key);
        if (ownIndex >= 0) {
          readableRows[ownIndex] = publishedRow;
        } else {
          readableRows.push(publishedRow);
        }
      }
      const rankedRows = rankSoloLeaderboardEntries(readableRows, friendKeys, currentOwnerKey);
      const sections = selectLeaderboardSections(rankedRows, currentOwnerKey, LEADERBOARD_TOP_LIMIT);
      const ownScoreRow = sections.currentUserRow || toSoloLeaderboardEntry(publishedRow || currentPayload, friendKeys, currentOwnerKey);

      if (rankedRows.length === 0) {
        const ownPendingRow = ownScoreRow
          ? [{ ...ownScoreRow, rank: null, isCurrentUser: true }]
          : [];
        setLeaderboard({
          loading: false,
          loaded: true,
          error: '',
          rankedRows: [],
          topRows: ownPendingRow,
          currentUserRow: null,
          currentUserInTop: false,
          friendsOutsideTop: [],
          ownScoreRow,
          rankFinalizing: true,
          friendCount: 0,
          ownScoreFallback,
        });
        return;
      }
      setLeaderboard({
        loading: false,
        loaded: true,
        error: '',
        rankedRows,
        ...sections,
        ownScoreRow,
        rankFinalizing: false,
        friendCount: friendEmails.length,
        ownScoreFallback,
      });
    } catch (err) {
      const ownScoreRow = toSoloLeaderboardEntry(currentPayload, new Set(), currentOwnerKey);
      setLeaderboard({
        loading: false,
        loaded: true,
        error: err?.message || 'Sıralama kaynağı hazırlanıyor.',
        rankedRows: [],
        topRows: [],
        currentUserRow: null,
        currentUserInTop: false,
        friendsOutsideTop: [],
        ownScoreRow,
        rankFinalizing: true,
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
  // Codex148 — Explicit Solo component score contract. The stat card and
  // public ranking rows show unified Kronox Puan; Solo summary remains
  // separate for progression and technical Health contracts.
  const soloLeaderboardScore = summary.totalSoloScore;
  const visibleKronoxPuan = getKronoxVisibleScore(user, { soloProgress: progress });
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
            Kronox Puanın Solo ve Online sonuçlarınla güncellenir.
          </p>

          {/* Codex119 — stat cards always show the user's own values from
              the shared visible Kronox Puan + Solo level sources,
              regardless of global ranking state. */}
          <div className="mt-4 grid grid-cols-3 gap-2">
            <KronoxStatTile icon={Trophy} label="Puan" value={visibleKronoxPuan} tintHex="#facc15" variant="compact" />
            <KronoxStatTile icon={Sparkles} label="Level" value={summary.currentLevel} tintHex="#60a5fa" variant="compact" />
            <KronoxStatTile icon={Gem} label="Elmas" value={diamondValue} tintHex="#7dd3fc" variant="compact" />
          </div>
        </div>

        <KronoxRankingSection
          authChecked={authChecked}
          user={user}
          leaderboard={leaderboard}
          soloLeaderboardScore={soloLeaderboardScore}
          onRetry={loadLeaderboard}
          isAdmin={isAdmin}
        />
      </div>
    </div>
  );
}
