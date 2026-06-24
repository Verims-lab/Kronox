import React, { useCallback, useEffect, useState } from 'react';
import { Gem, Sparkles, Trophy } from 'lucide-react';
// Codex167 — Liderlik üst barı Home/Solo standardına hizalandı: ortada
// gerçek persisted Elmas + sağda notification bell. Profil/avatar üst
// bardan kaldırıldı (kullanıcı talebi). Title "Liderlik Tablosu" zaten
// ekran içeriğinde duruyor.
import StandardTopBar from '@/components/layout/StandardTopBar';
import { useAuth } from '@/lib/AuthContext';
import { ensureSoloProgressBackfill, getSoloLevelCount, readSoloProgress } from '@/lib/soloLevels';
import { summarizeSoloProgress } from '@/lib/soloProgressHelpers';
import { getKronoxVisibleScore } from '@/lib/kronoxScore';
import {
  buildGuestSoloLeaderboardPayload,
  getFriendLeaderboardKeys,
  getGuestLeaderboardOwnerKey,
  getLeaderboardDiamondValue,
  getLeaderboardOwnerKey,
  LEADERBOARD_FETCH_LIMIT,
  LEADERBOARD_TOP_LIMIT,
  buildSoloLeaderboardPayload,
  loadSoloLeaderboardSnapshot,
  publishSoloLeaderboardEntry,
  rankSoloLeaderboardEntries,
  selectLeaderboardSections,
  toSoloLeaderboardEntry,
} from '@/lib/leaderboard';
import {
  getCompletedGuestCredentialsPayload,
  isGuestOnboardingComplete,
  syncGuestProfileProgress,
} from '@/lib/guestProfile';
import { loadFriends } from '@/lib/friendsApi';
import { isAdminUser, withAdminStatus } from '@/lib/admin';
import KronoxRankingSection from '@/components/leaderboard/KronoxRankingSection';
import PullToRefresh from '@/components/mobile/PullToRefresh';
// Phase 3 — Codex123 UI consolidation. Profile + Leaderboard now share
// one StatTile. Compact variant matches the previous lighter look used
// inside the Liderlik summary hero card. Data sources unchanged.
import KronoxStatTile from '@/components/ui/KronoxStatTile';

function publishOwnLeaderboardProjectionInBackground(user, currentProgress) {
  if (!user?.email) {
    syncGuestProfileProgress({ soloProgress: currentProgress }).catch((error) => {
      console.warn('[leaderboard] guest projection sync failed', error?.message || 'unknown');
    });
    return;
  }
  publishSoloLeaderboardEntry(user, currentProgress).catch((error) => {
    console.warn('[leaderboard] background projection publish failed', error?.message || 'unknown');
  });
}

function hydrateLeaderboardRow(publicRow, friendKeys, currentOwnerKey) {
  const entry = toSoloLeaderboardEntry(publicRow, friendKeys, currentOwnerKey);
  const rank = Number.isFinite(Number(publicRow?.rank))
    ? Math.max(1, Math.floor(Number(publicRow.rank)))
    : entry.rank;
  return {
    ...entry,
    rank: Number.isFinite(Number(rank)) ? rank : null,
    isCurrentUser: publicRow?.isCurrentUser === true || entry.isCurrentUser,
    isFriend: publicRow?.isFriend === true || entry.isFriend,
  };
}

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
 *   • Stat cards (Puan / Seviye / Elmas) stay visible from the user's own
 *     persisted sources — Puan is visible Kronox Puan, Seviye is Solo.
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
  const { user: authUser, guestProfile, authChecked: contextAuthChecked } = useAuth();
  const [user, setUser] = useState(null);
  const [localGuestProfile, setLocalGuestProfile] = useState(guestProfile || null);
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
    let cancelled = false;
    if (!contextAuthChecked) {
      setAuthChecked(false);
      return () => { cancelled = true; };
    }
    if (!authUser?.email) {
      setUser(null);
      setAuthChecked(true);
      return () => { cancelled = true; };
    }
    (async () => {
      try {
        const adminCheckedUser = await withAdminStatus(authUser);
        const normalizedProgress = await ensureSoloProgressBackfill(adminCheckedUser);
        if (!cancelled) setUser({ ...adminCheckedUser, solo_progress: normalizedProgress });
      } catch {
        if (!cancelled) setUser(authUser || null);
      } finally {
        if (!cancelled) setAuthChecked(true);
      }
    })();
    return () => { cancelled = true; };
  }, [authUser, contextAuthChecked]);

  useEffect(() => {
    setLocalGuestProfile(guestProfile || null);
  }, [guestProfile]);

  const loadLeaderboard = useCallback(async () => {
    const completedGuestProfile = !user && isGuestOnboardingComplete(localGuestProfile || guestProfile)
      ? (localGuestProfile || guestProfile)
      : null;
    if (!user?.email && !completedGuestProfile) return;

    // Codex150 — own-score fallback and ranking rows use visible Kronox
    // Puan. Solo and Online storage remain separate, but the row score
    // shown and sorted here must match Profile/Header Puan.
    const currentProgress = readSoloProgress(user);
    const currentOwnerKey = user?.email
      ? getLeaderboardOwnerKey(user.email)
      : getGuestLeaderboardOwnerKey(completedGuestProfile?.guest_id);
    const currentPayload = user?.email
      ? buildSoloLeaderboardPayload(user, currentProgress)
      : buildGuestSoloLeaderboardPayload(completedGuestProfile, currentProgress);
    const ownSummary = summarizeSoloProgress(currentProgress, getSoloLevelCount());
    const ownScoreFallback = {
      totalKronoxScore: getKronoxVisibleScore(user, { soloProgress: currentProgress }),
      totalSoloScore: ownSummary.totalSoloScore,
      currentLevel: ownSummary.currentLevel,
    };
    if (!user?.email) {
      ownScoreFallback.totalKronoxScore = currentPayload.total_kronox_score;
    }

    setLeaderboard((prev) => ({ ...prev, loading: true, error: '', ownScoreFallback }));
    try {
      const normalizedUserEmail = String(user?.email || user?.user_email || '').trim().toLowerCase();
      const guestPayload = completedGuestProfile
        ? getCompletedGuestCredentialsPayload(completedGuestProfile)
        : null;
      const [snapshot, acceptedFriends] = await Promise.all([
        loadSoloLeaderboardSnapshot({
          limit: LEADERBOARD_FETCH_LIMIT,
          topLimit: LEADERBOARD_TOP_LIMIT,
          payload: guestPayload || {},
        }),
        normalizedUserEmail ? loadFriends(normalizedUserEmail).catch(() => []) : Promise.resolve([]),
      ]);
      const acceptedFriendKeys = getFriendLeaderboardKeys(
        (acceptedFriends || []).map((friend) => friend.friend_email),
      );
      const friendKeys = new Set([
        ...(snapshot.friendUserKeys || []),
        ...acceptedFriendKeys,
      ]);
      const topRows = (snapshot.topRows || [])
        .map((row) => hydrateLeaderboardRow(row, friendKeys, currentOwnerKey))
        .filter((row) => row.id);
      const currentUserRow = snapshot.currentUserRow
        ? hydrateLeaderboardRow(snapshot.currentUserRow, friendKeys, currentOwnerKey)
        : null;
      const friendsOutsideTop = (snapshot.friendsOutsideTop || [])
        .map((row) => hydrateLeaderboardRow(row, friendKeys, currentOwnerKey))
        .filter((row) => row.id);
      let rankedRows = (snapshot.rows || [])
        .map((row) => hydrateLeaderboardRow(row, friendKeys, currentOwnerKey))
        .filter((row) => row.id);
      let sections = {
        topRows,
        currentUserRow,
        currentUserInTop: Boolean(snapshot.currentUserInTop),
        friendsOutsideTop,
      };
      if (!sections.topRows.length && rankedRows.length) {
        rankedRows = rankSoloLeaderboardEntries(snapshot.rows, friendKeys, currentOwnerKey);
        sections = selectLeaderboardSections(rankedRows, currentOwnerKey, LEADERBOARD_TOP_LIMIT);
      }
      const ownScoreRow = sections.currentUserRow || toSoloLeaderboardEntry(currentPayload, friendKeys, currentOwnerKey);
      const friendCount = Math.max(snapshot.friendCount || 0, friendKeys.size);

      if (sections.topRows.length === 0 && rankedRows.length === 0) {
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
          friendCount,
          ownScoreFallback,
          rankConfidence: snapshot.rankConfidence || '',
          rankScope: snapshot.rankScope || '',
        });
        publishOwnLeaderboardProjectionInBackground(user, currentProgress);
        return;
      }
      setLeaderboard({
        loading: false,
        loaded: true,
        error: '',
        rankedRows,
        ...sections,
        ownScoreRow,
        rankFinalizing: Boolean(sections.currentUserRow && !Number.isFinite(Number(sections.currentUserRow.rank))),
        friendCount,
        ownScoreFallback,
        rankConfidence: snapshot.rankConfidence || '',
        rankScope: snapshot.rankScope || '',
      });
      publishOwnLeaderboardProjectionInBackground(user, currentProgress);
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
  }, [guestProfile, localGuestProfile, user]);

  useEffect(() => {
    const completedGuestProfile = !user && isGuestOnboardingComplete(localGuestProfile || guestProfile)
      ? (localGuestProfile || guestProfile)
      : null;
    if (authChecked && (user?.email || completedGuestProfile)) {
      loadLeaderboard();
    }
  }, [authChecked, guestProfile, loadLeaderboard, localGuestProfile, user]);

  const progress = readSoloProgress(user);
  const summary = summarizeSoloProgress(progress, getSoloLevelCount());
  // Codex148 — Explicit Solo component score contract. The stat card and
  // public ranking rows show unified Kronox Puan; Solo summary remains
  // separate for progression and technical Health contracts.
  const soloLeaderboardScore = summary.totalSoloScore;
  const visibleKronoxPuan = getKronoxVisibleScore(user, { soloProgress: progress });
  const completedGuestProfile = !user && isGuestOnboardingComplete(localGuestProfile || guestProfile)
    ? (localGuestProfile || guestProfile)
    : null;
  let diamondValue = getLeaderboardDiamondValue(user);
  if (!user && completedGuestProfile) {
    diamondValue = getLeaderboardDiamondValue(completedGuestProfile);
  }
  const isAdmin = isAdminUser(user);
  const leaderboardPlayer = user || completedGuestProfile;

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
      <StandardTopBar diamonds={diamondValue} user={user} />

      <PullToRefresh onRefresh={loadLeaderboard} disabled={!leaderboardPlayer}>
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
              <KronoxStatTile icon={Sparkles} label="Seviye" value={summary.currentLevel} tintHex="#60a5fa" variant="compact" />
              <KronoxStatTile icon={Gem} label="Elmas" value={diamondValue} tintHex="#7dd3fc" variant="compact" />
            </div>
          </div>

          <KronoxRankingSection
            authChecked={authChecked}
            user={leaderboardPlayer}
            leaderboard={leaderboard}
            soloLeaderboardScore={soloLeaderboardScore}
            onRetry={loadLeaderboard}
            isAdmin={isAdmin}
          />
        </div>
      </PullToRefresh>
    </div>
  );
}
