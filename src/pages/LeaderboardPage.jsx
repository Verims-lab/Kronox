import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Trophy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
// Codex167 — Liderlik üst barı Home/Solo standardına hizalandı: ortada
// gerçek persisted Elmas + sağda notification bell. Profil/avatar üst
// bardan kaldırıldı (kullanıcı talebi). Ekran başlığı içerik alanında
// merkezi Liderlik markası olarak çizilir.
import StandardTopBar from '@/components/layout/StandardTopBar';
import { createParentRouteState } from '@/lib/NavigationStackContext';
import { useAuth } from '@/lib/AuthContext';
import { ensureSoloProgressBackfill, getSoloLevelCount, readSoloProgress } from '@/lib/soloLevels';
import { summarizeSoloProgress } from '@/lib/soloProgressHelpers';
import { getKronoxVisibleScore } from '@/lib/kronoxScore';
import {
  buildGuestSoloLeaderboardPayload,
  getCachedSoloLeaderboardSnapshot,
  getLeaderboardSnapshotCacheKey,
  getGuestLeaderboardOwnerKey,
  getLeaderboardDiamondValue,
  getLeaderboardOwnerKey,
  getPublicLeaderboardId,
  LEADERBOARD_ENRICHED_SNAPSHOT_OPTIONS,
  LEADERBOARD_FAST_SNAPSHOT_OPTIONS,
  LEADERBOARD_FETCH_LIMIT,
  LEADERBOARD_TOP_LIMIT,
  buildSoloLeaderboardPayload,
  loadSoloLeaderboardSnapshot,
  mergeLeaderboardAvatarFields,
  normalizeLeaderboardRank,
  publishSoloLeaderboardEntry,
  rankSoloLeaderboardEntries,
  selectLeaderboardSections,
  setCachedSoloLeaderboardSnapshot,
  toSoloLeaderboardEntry,
} from '@/lib/leaderboard';
import {
  getCompletedGuestCredentialsPayload,
  isGuestOnboardingComplete,
  syncGuestProfileProgress,
} from '@/lib/guestProfile';
import { sendFriendRequest } from '@/lib/friendsApi';
import { useToast } from '@/components/ui/use-toast';
import { isAdminUser, withAdminStatus } from '@/lib/admin';
import KronoxRankingSection from '@/components/leaderboard/KronoxRankingSection';
import PullToRefresh from '@/components/mobile/PullToRefresh';

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
  const rank = normalizeLeaderboardRank(publicRow?.rank) ?? normalizeLeaderboardRank(entry.rank);
  return {
    ...entry,
    rank,
    isCurrentUser: publicRow?.isCurrentUser === true || entry.isCurrentUser,
    isFriend: publicRow?.isFriend === true || entry.isFriend,
  };
}

function withCurrentTotalKronoxScore(row, totalKronoxScore) {
  if (!row?.isCurrentUser) return row;
  const safeScore = Number.isFinite(Number(totalKronoxScore))
    ? Math.max(0, Math.floor(Number(totalKronoxScore)))
    : 0;
  return {
    ...row,
    summary: {
      ...row.summary,
      totalKronoxScore: safeScore,
    },
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
 *   • The ranking section shows the user's persisted public projection when
 *     remote leaderboard rows are still warming up.
 *   • Empty or loading states show a neutral "hazırlanıyor" placeholder,
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
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user: authUser, guestProfile, authChecked: contextAuthChecked } = useAuth();
  const [user, setUser] = useState(null);
  const [localGuestProfile, setLocalGuestProfile] = useState(guestProfile || null);
  const [authChecked, setAuthChecked] = useState(false);
  const [leaderboard, setLeaderboard] = useState({
    loading: false,
    refreshing: false,
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
  const friendInvitePendingTargetsRef = useRef(new Set());
  const leaderboardRequestSeqRef = useRef(0);

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
    setUser(authUser || null);
    setAuthChecked(true);
    Promise.resolve()
      .then(() => withAdminStatus(authUser))
      .then(async (adminCheckedUser) => {
        const normalizedProgress = await ensureSoloProgressBackfill(adminCheckedUser);
        if (!cancelled) setUser({ ...adminCheckedUser, solo_progress: normalizedProgress });
      })
      .catch(() => {});
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
    const leaderboardPlayer = user || completedGuestProfile;
    const totalKronoxScore = getKronoxVisibleScore(leaderboardPlayer, { soloProgress: currentProgress });
    const currentPayload = {
      ...(user?.email
        ? buildSoloLeaderboardPayload(user, currentProgress)
        : buildGuestSoloLeaderboardPayload(completedGuestProfile, currentProgress)),
      total_kronox_score: totalKronoxScore,
    };
    const ownSummary = summarizeSoloProgress(currentProgress, getSoloLevelCount());
    const ownScoreFallback = {
      totalKronoxScore: getKronoxVisibleScore(user || completedGuestProfile, { soloProgress: currentProgress }),
      totalSoloScore: ownSummary.totalSoloScore,
      currentLevel: ownSummary.currentLevel,
    };

    const requestId = leaderboardRequestSeqRef.current + 1;
    leaderboardRequestSeqRef.current = requestId;
    const guestPayload = completedGuestProfile
      ? getCompletedGuestCredentialsPayload(completedGuestProfile)
      : null;
    const cacheKey = getLeaderboardSnapshotCacheKey(currentOwnerKey);

    const applySnapshot = (snapshot, extraFriendKeys = new Set(), options = {}) => {
      if (leaderboardRequestSeqRef.current !== requestId) return false;
      const friendKeys = new Set([
        ...(snapshot.friendUserKeys || []),
        ...extraFriendKeys,
      ]);
      const friendAvatarByLeaderboardId = options.friendAvatarByLeaderboardId instanceof Map
        ? options.friendAvatarByLeaderboardId
        : new Map();
      const currentLeaderboardId = getPublicLeaderboardId(currentOwnerKey);
      const withAvatarParity = (publicRow) => {
        const publicId = String(publicRow?.leaderboard_id || publicRow?.leaderboardId || publicRow?.id || '').trim();
        let nextRow = publicId && friendAvatarByLeaderboardId.has(publicId)
          ? mergeLeaderboardAvatarFields(publicRow, friendAvatarByLeaderboardId.get(publicId))
          : publicRow;
        if (publicRow?.isCurrentUser === true || (currentLeaderboardId && publicId === currentLeaderboardId)) {
          nextRow = mergeLeaderboardAvatarFields(nextRow, currentPayload);
        }
        if (publicId && friendAvatarByLeaderboardId.has(publicId)) {
          nextRow = { ...nextRow, isFriend: true };
        }
        return nextRow;
      };
      const topRows = (snapshot.topRows || [])
        .map((row) => hydrateLeaderboardRow(withAvatarParity(row), friendKeys, currentOwnerKey))
        .map((row) => withCurrentTotalKronoxScore(row, totalKronoxScore))
        .filter((row) => row.id);
      const currentUserRow = snapshot.currentUserRow
        ? withCurrentTotalKronoxScore(
          hydrateLeaderboardRow(withAvatarParity(snapshot.currentUserRow), friendKeys, currentOwnerKey),
          totalKronoxScore,
        )
        : null;
      const friendsOutsideTop = (snapshot.friendsOutsideTop || [])
        .map((row) => hydrateLeaderboardRow(withAvatarParity(row), friendKeys, currentOwnerKey))
        .map((row) => withCurrentTotalKronoxScore(row, totalKronoxScore))
        .filter((row) => row.id);
      let rankedRows = (snapshot.rows || [])
        .map((row) => hydrateLeaderboardRow(withAvatarParity(row), friendKeys, currentOwnerKey))
        .map((row) => withCurrentTotalKronoxScore(row, totalKronoxScore))
        .filter((row) => row.id);
      let sections = {
        topRows,
        currentUserRow,
        currentUserInTop: Boolean(snapshot.currentUserInTop),
        friendsOutsideTop,
      };
      if (!sections.topRows.length && rankedRows.length) {
        rankedRows = rankSoloLeaderboardEntries(snapshot.rows, friendKeys, currentOwnerKey)
          .map((row) => withCurrentTotalKronoxScore(row, totalKronoxScore));
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
          refreshing: Boolean(options.refreshing),
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
        return true;
      }
      setLeaderboard({
        loading: false,
        refreshing: Boolean(options.refreshing),
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
      return true;
    };

    const cachedSnapshot = getCachedSoloLeaderboardSnapshot(cacheKey);
    if (cachedSnapshot) {
      applySnapshot(cachedSnapshot, new Set(), { refreshing: true });
    } else {
      setLeaderboard((prev) => ({
        ...prev,
        loading: true,
        refreshing: false,
        error: '',
        ownScoreFallback,
      }));
    }

    try {
      const snapshot = await loadSoloLeaderboardSnapshot({
        limit: LEADERBOARD_FETCH_LIMIT,
        topLimit: LEADERBOARD_TOP_LIMIT,
        payload: guestPayload || {},
        ...LEADERBOARD_FAST_SNAPSHOT_OPTIONS,
      });
      setCachedSoloLeaderboardSnapshot(cacheKey, snapshot);
      if (!applySnapshot(snapshot)) return;
      publishOwnLeaderboardProjectionInBackground(user, currentProgress);

      // Keep first paint on the projection-only fast path. Accepted-friend
      // badges and friend avatars arrive in a second sanitized backend
      // snapshot; the page never reads private User/FriendRequest rows.
      if (user?.email) {
        try {
          const enrichedSnapshot = await loadSoloLeaderboardSnapshot({
            limit: LEADERBOARD_FETCH_LIMIT,
            topLimit: LEADERBOARD_TOP_LIMIT,
            payload: guestPayload || {},
            ...LEADERBOARD_ENRICHED_SNAPSHOT_OPTIONS,
          });
          if (leaderboardRequestSeqRef.current !== requestId) return;
          setCachedSoloLeaderboardSnapshot(cacheKey, enrichedSnapshot);
          applySnapshot(enrichedSnapshot);
        } catch (enrichmentError) {
          console.warn('[leaderboard] sanitized friend enrichment unavailable', enrichmentError?.message || 'unknown');
        }
      }

    } catch (err) {
      const ownScoreRow = toSoloLeaderboardEntry(currentPayload, new Set(), currentOwnerKey);
      setLeaderboard((prev) => {
        if (prev.loaded && (prev.topRows.length || prev.currentUserRow || prev.ownScoreRow)) {
          return {
            ...prev,
            loading: false,
            refreshing: false,
            error: '',
            ownScoreFallback,
          };
        }
        return {
          loading: false,
          refreshing: false,
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
        };
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
  // Codex148 — Explicit Solo component score contract. Public ranking rows
  // show unified Kronox Puan; Solo summary remains separate for progression
  // and technical Health contracts.
  const soloLeaderboardScore = summary.totalSoloScore;
  const completedGuestProfile = !user && isGuestOnboardingComplete(localGuestProfile || guestProfile)
    ? (localGuestProfile || guestProfile)
    : null;
  let diamondValue = getLeaderboardDiamondValue(user);
  if (!user && completedGuestProfile) {
    diamondValue = getLeaderboardDiamondValue(completedGuestProfile);
  }
  const isAdmin = isAdminUser(user);
  const leaderboardPlayer = user || completedGuestProfile;
  const openCurrentUserProfileSettings = useCallback(() => {
    navigate('/profile/edit', {
      state: {
        ...createParentRouteState('leaderboard', '/leaderboard'),
        source: 'leaderboard_self_row',
      },
    });
  }, [navigate]);

  // Long-press → "Arkadaş ekle". Reuses the existing friend-request flow with
  // the row's safe public username as the target. The backend resolves the
  // username server-side; the target email is never exposed to the client.
  const handleAddFriendFromLeaderboard = useCallback(async (playerName) => {
    if (!user?.email) {
      toast({ title: 'Önce giriş yapmalısın.', variant: 'destructive' });
      throw new Error('auth_required');
    }
    const username = String(playerName || '').trim();
    if (!username) {
      toast({ title: 'Geçersiz oyuncu.', variant: 'destructive' });
      throw new Error('invalid_target');
    }
    const usernameKey = username.toLowerCase();
    if (friendInvitePendingTargetsRef.current.has(usernameKey)) {
      toast({ title: 'İstek gönderiliyor.' });
      return null;
    }
    friendInvitePendingTargetsRef.current.add(usernameKey);
    try {
      const data = await sendFriendRequest({ me: user, target: username });
      // The backend owns existing-state outcomes. Current deployed code returns
      // typed lifecycle errors for open/expired duplicates; alreadyPending is
      // kept only for older function responses.
      if (data?.alreadyPending) {
        toast({ title: data.message || 'Bu kişiye gönderilmiş açık davet var.' });
      } else {
        toast({ title: `${username} kullanıcısına arkadaşlık isteği gönderildi.` });
      }
      // Refresh so the row picks up its "Arkadaş" badge once accepted.
      await loadLeaderboard();
      return data;
    } catch (err) {
      const lifecycleWarning = ['OPEN_INVITE_EXISTS', 'EXPIRED_INVITE_REQUIRES_DELETE'].includes(err?.code);
      toast({ title: err?.message || 'İstek gönderilemedi.', variant: lifecycleWarning ? undefined : 'destructive' });
      throw err;
    } finally {
      friendInvitePendingTargetsRef.current.delete(usernameKey);
    }
  }, [user, toast, loadLeaderboard]);

  return (
    <div
      className="leaderboard-page text-white"
      style={{
        userSelect: 'none',
      }}
    >
      <StandardTopBar diamonds={diamondValue} user={user} />

      <PullToRefresh onRefresh={loadLeaderboard} disabled={!leaderboardPlayer}>
        <div className="mx-auto w-full max-w-md px-4 pt-16 mt-2 space-y-3">
          <header className="leaderboard-heading" aria-label="Liderlik">
            <div className="leaderboard-trophy" aria-hidden="true">
              <Trophy strokeWidth={2.4} />
            </div>
            <h1 className="leaderboard-title">LİDERLİK</h1>
          </header>

          <KronoxRankingSection
            authChecked={authChecked}
            user={leaderboardPlayer}
            leaderboard={leaderboard}
            soloLeaderboardScore={soloLeaderboardScore}
            onRetry={loadLeaderboard}
            isAdmin={isAdmin}
            onCurrentUserRowOpenSettings={openCurrentUserProfileSettings}
            onAddFriend={handleAddFriendFromLeaderboard}
          />
        </div>
      </PullToRefresh>
    </div>
  );
}
