import React, { useCallback, useEffect, useState } from 'react';
import { Gem, Loader2, Medal, RefreshCw, Sparkles, Trophy, UserRound, Users } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import ScreenHeader from '@/components/layout/ScreenHeader';
import { ensureSoloProgressBackfill, getSoloLevelCount, readSoloProgress } from '@/lib/soloLevels';
import { summarizeSoloProgress } from '@/lib/soloProgressHelpers';
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

/**
 * Codex117 — Public-safe Solo leaderboard shell.
 *
 * We show REAL user-specific Solo totals from User.solo_progress and mirror
 * them into SoloLeaderboardEntry rows that expose only public-safe rank data.
 * If the global table is still finalizing, the user's own score row remains
 * visible without inventing ranks.
 * Elmas stays economy-owned: if no real profile/economy field exists yet, it
 * shows a safe 0 placeholder and never derives from stars or Solo score.
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

    setLeaderboard((prev) => ({ ...prev, loading: true, error: '' }));
    const currentProgress = readSoloProgress(user);
    const currentOwnerKey = getLeaderboardOwnerKey(user.email);
    const currentPayload = buildSoloLeaderboardPayload(user, currentProgress);

    try {
      const [publishedRow, rows, friends] = await Promise.all([
        publishSoloLeaderboardEntry(user, currentProgress).catch(() => null),
        loadSoloLeaderboardEntries(LEADERBOARD_FETCH_LIMIT),
        loadFriends(user.email).catch(() => []),
      ]);
      const friendEmails = (friends || []).map((friend) => friend.friend_email).filter(Boolean);
      const friendKeys = getFriendLeaderboardKeys(friendEmails);
      const readableRows = Array.isArray(rows) ? [...rows] : [];
      const ownPublicRow = publishedRow || currentPayload;
      if (ownPublicRow?.owner_key && !readableRows.some((row) => row?.owner_key === ownPublicRow.owner_key)) {
        readableRows.push(ownPublicRow);
      }
      const rankedRows = rankSoloLeaderboardEntries(readableRows, friendKeys, currentOwnerKey);
      const sections = selectLeaderboardSections(rankedRows, currentOwnerKey, LEADERBOARD_TOP_LIMIT);
      const ownScoreRow = sections.currentUserRow || toSoloLeaderboardEntry(currentPayload, friendKeys, currentOwnerKey);

      if (rankedRows.length === 0) {
        setLeaderboard({
          loading: false,
          loaded: true,
          error: '',
          rankedRows: [],
          topRows: [],
          currentUserRow: null,
          currentUserInTop: false,
          friendsOutsideTop: [],
          ownScoreRow,
          rankFinalizing: true,
          friendCount: 0,
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
            <StatTile icon={Gem} label="Elmas" value={diamondValue} tint="#7dd3fc" />
          </div>
        </div>

        <LeaderboardSection
          authChecked={authChecked}
          user={user}
          leaderboard={leaderboard}
          onRetry={loadLeaderboard}
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

function LeaderboardSection({ authChecked, user, leaderboard, onRetry }) {
  const hasRows = leaderboard.topRows.length > 0;
  const showOwnRank = leaderboard.currentUserRow && !leaderboard.currentUserInTop;
  const showFriendRows = leaderboard.friendsOutsideTop.length > 0;
  const showOwnScoreFallback = !hasRows && leaderboard.ownScoreRow;
  const waitingForLeaderboard = Boolean(user && !leaderboard.loaded && !leaderboard.error);
  const friendEmptyCopy = leaderboard.friendCount > 0
    ? 'Arkadaşların puan aldıkça burada görünecek.'
    : 'Arkadaşlarını davet et, sıralamada yarışın.';

  return (
    <section
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
          <Medal className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="font-inter text-sm font-black text-white">Kronox Sıralaması</p>
          <p className="mt-1 font-inter text-[11px] leading-relaxed text-blue-100/70">
            Tüm oyuncular arasında puanına göre sıralaman.
          </p>
        </div>
      </div>

      {!authChecked || leaderboard.loading || waitingForLeaderboard ? (
        <div className="mt-4 flex items-center justify-center gap-2 rounded-xl px-3 py-4 font-inter text-xs font-bold text-blue-100/70"
          style={{ background: 'rgba(255,255,255,0.045)' }}>
          <Loader2 className="h-4 w-4 animate-spin text-amber-200" />
          Sıralama yükleniyor…
        </div>
      ) : !user ? (
        <EmptyLeaderboardState
          icon={UserRound}
          title="Giriş gerekli"
          text="Kronox sıralamasında yerini görmek için giriş yap."
        />
      ) : showOwnScoreFallback ? (
        <PendingLeaderboardState row={leaderboard.ownScoreRow} onRetry={onRetry} />
      ) : leaderboard.error ? (
        <PendingLeaderboardState onRetry={onRetry} />
      ) : !hasRows ? (
        <EmptyLeaderboardState
          icon={Trophy}
          title="Henüz sıralama verisi yok"
          text="Solo puan alan gerçek oyuncular burada görünecek."
        />
      ) : (
        <div className="mt-4 space-y-2">
          {leaderboard.topRows.map((row) => (
            <LeaderboardRow key={row.id} row={row} />
          ))}

          {showOwnRank && (
            <div className="pt-2">
              <p className="mb-2 px-1 font-inter text-[10px] font-black uppercase tracking-widest text-amber-200/80">
                Senin Sıran
              </p>
              <LeaderboardRow row={leaderboard.currentUserRow} emphasis />
            </div>
          )}

          <div className="pt-3">
            <div className="mb-2 flex items-center gap-2 px-1">
              <Users className="h-3.5 w-3.5 text-cyan-200" />
              <p className="font-inter text-[10px] font-black uppercase tracking-widest text-cyan-100/80">
                Arkadaşların
              </p>
            </div>
            {showFriendRows ? (
              <div className="space-y-2">
                {leaderboard.friendsOutsideTop.map((row) => (
                  <LeaderboardRow key={`friend-${row.id}`} row={row} compact />
                ))}
              </div>
            ) : (
              <p className="rounded-xl px-3 py-3 font-inter text-[11px] leading-relaxed text-blue-100/62"
                style={{
                  background: 'rgba(255,255,255,0.045)',
                  boxShadow: 'inset 0 0 0 1px rgba(125,211,252,0.14)',
                }}>
                {friendEmptyCopy}
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function LeaderboardRow({ row, compact = false, emphasis = false }) {
  const isHighlighted = row.isCurrentUser || emphasis;
  const rankColor = row.rank <= 3 ? '#facc15' : '#93c5fd';
  const rankText = Number.isFinite(Number(row.rank)) ? `#${row.rank}` : '—';

  return (
    <div
      className={`flex items-center gap-2 rounded-xl ${compact ? 'px-2.5 py-2' : 'px-3 py-2.5'}`}
      style={{
        background: isHighlighted
          ? 'linear-gradient(180deg, rgba(250,204,21,0.16), rgba(37,99,235,0.14))'
          : 'rgba(255,255,255,0.055)',
        boxShadow: isHighlighted
          ? 'inset 0 0 0 1px rgba(250,204,21,0.46), 0 0 14px rgba(250,204,21,0.12)'
          : 'inset 0 0 0 1px rgba(125,211,252,0.16)',
      }}
    >
      <div className="w-8 shrink-0 text-center font-bangers text-lg leading-none" style={{ color: rankColor }}>
        {rankText}
      </div>
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-bangers text-base text-amber-950"
        style={{
          background: row.isCurrentUser
            ? 'radial-gradient(circle at 35% 28%, #ffe066, #b97a06 70%)'
            : 'radial-gradient(circle at 35% 28%, #dbeafe, #60a5fa 70%)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.45)',
        }}
      >
        {row.initial}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <p className="truncate font-inter text-xs font-black text-white">
            {row.displayName}
          </p>
          {row.isCurrentUser && <Badge text="Sen" tone="gold" />}
          {row.isFriend && <Badge text="Arkadaş" tone="cyan" />}
        </div>
        <p className="mt-0.5 font-inter text-[10px] text-blue-100/55">
          Level {row.summary.currentLevel}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="font-bangers text-lg leading-none text-amber-200">
          {row.summary.totalSoloScore}
        </p>
        <p className="font-inter text-[9px] font-black uppercase tracking-wider text-blue-100/45">
          Puan
        </p>
      </div>
    </div>
  );
}

function PendingLeaderboardState({ row = null, onRetry }) {
  return (
    <div className="mt-4 space-y-3">
      <div className="rounded-xl px-3 py-3"
        style={{
          background: 'rgba(250,204,21,0.10)',
          boxShadow: 'inset 0 0 0 1px rgba(250,204,21,0.26)',
        }}>
        <p className="font-inter text-xs font-black text-amber-100">
          Kronox sıralaması hazırlanıyor.
        </p>
        <p className="mt-1 font-inter text-[11px] leading-relaxed text-amber-100/72">
          Puanın kaydedildi. Kısa süre içinde sıralamada görünecek.
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 font-inter text-[11px] font-black text-amber-950"
          style={{
            background: 'linear-gradient(180deg,#ffe066,#b97a06)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.45), 0 0 10px rgba(250,204,21,0.30)',
          }}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Tekrar Dene
        </button>
      </div>
      {row && (
        <div>
          <p className="mb-2 px-1 font-inter text-[10px] font-black uppercase tracking-widest text-amber-200/80">
            Senin Puanın
          </p>
          <LeaderboardRow row={{ ...row, rank: null, isCurrentUser: true }} emphasis />
        </div>
      )}
    </div>
  );
}

function Badge({ text, tone }) {
  const isGold = tone === 'gold';
  return (
    <span
      className="shrink-0 rounded-full px-1.5 py-0.5 font-inter text-[8px] font-black uppercase tracking-wider"
      style={{
        color: isGold ? '#fef3c7' : '#cffafe',
        background: isGold ? 'rgba(250,204,21,0.16)' : 'rgba(34,211,238,0.14)',
        boxShadow: `inset 0 0 0 1px ${isGold ? 'rgba(250,204,21,0.38)' : 'rgba(34,211,238,0.32)'}`,
      }}
    >
      {text}
    </span>
  );
}

function EmptyLeaderboardState({ icon: Icon, title, text }) {
  return (
    <div className="mt-4 rounded-xl px-3 py-4 text-center"
      style={{
        background: 'rgba(255,255,255,0.045)',
        boxShadow: 'inset 0 0 0 1px rgba(125,211,252,0.14)',
      }}>
      <Icon className="mx-auto h-5 w-5 text-amber-200/80" />
      <p className="mt-2 font-inter text-xs font-black text-white">{title}</p>
      <p className="mt-1 font-inter text-[11px] leading-relaxed text-blue-100/62">{text}</p>
    </div>
  );
}
