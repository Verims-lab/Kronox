import React from 'react';
import { Loader2, Medal, RefreshCw, Trophy, UserRound, Users } from 'lucide-react';

/**
 * Codex119 — "Kronox Sıralaması" section.
 *
 * Extracted from pages/LeaderboardPage.jsx so the new fallback UX lives in
 * one focused, testable file. NO business logic, NO data fetching: the
 * page still owns leaderboard state and passes it down.
 *
 * Fallback contract (per brief):
 *  • If global ranking fails, do NOT show the scary red/purple error box.
 *  • Do NOT expose backend permission language to end users.
 *  • Always show the user's own visible Puan + a friendly "Genel sıran:
 *    Hazırlanıyor". Public ranking rows use their current backend score
 *    projection without exposing separate user-facing score systems.
 *  • Keep the retry button.
 *  • Admin/dev sees the technical reason in a small diagnostics block.
 *  • Never invent fake users/ranks/friends.
 *
 * Props:
 *   authChecked      : boolean
 *   user             : current user (or null)
 *   leaderboard      : { loading, loaded, error, topRows, currentUserRow,
 *                        currentUserInTop, friendsOutsideTop, friendCount,
 *                        ownScoreRow, ownScoreFallback: { totalKronoxScore,
 *                        totalSoloScore, currentLevel } }
 *   onRetry          : () => void
 *   isAdmin          : boolean — gates the technical diagnostic line
 */
export default function KronoxRankingSection({ authChecked, user, leaderboard, onRetry, isAdmin }) {
  const hasRows = leaderboard.topRows.length > 0;
  const showOwnRank = leaderboard.currentUserRow && !leaderboard.currentUserInTop;
  const topRowIds = new Set(leaderboard.topRows.map((row) => row.id));
  const ownScoreAlreadyInTop = Boolean(leaderboard.ownScoreRow && topRowIds.has(leaderboard.ownScoreRow.id));
  const showOwnScorePending = !leaderboard.currentUserRow && leaderboard.ownScoreRow && !ownScoreAlreadyInTop;
  const showFriendRows = leaderboard.friendsOutsideTop.length > 0;
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
            Tüm oyuncular arasında Kronox sıralaman.
          </p>
        </div>
      </div>

      {!authChecked || leaderboard.loading || waitingForLeaderboard ? (
        <LoadingState />
      ) : !user ? (
        <EmptyState
          icon={UserRound}
          title="Giriş gerekli"
          text="Kronox sıralamasında yerini görmek için giriş yap."
        />
      ) : leaderboard.error ? (
        <RankingPreparingState
          ownScore={leaderboard.ownScoreFallback}
          onRetry={onRetry}
          isAdmin={isAdmin}
          backendReason={leaderboard.error}
        />
      ) : !hasRows ? (
        <RankingPreparingState
          ownScore={leaderboard.ownScoreFallback}
          onRetry={onRetry}
          isAdmin={isAdmin}
          backendReason=""
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

          {showOwnScorePending && (
            <div className="pt-2">
              <p className="mb-2 px-1 font-inter text-[10px] font-black uppercase tracking-widest text-amber-200/80">
                Senin Puanın
              </p>
              <LeaderboardRow row={{ ...leaderboard.ownScoreRow, rank: null, isCurrentUser: true }} emphasis />
              <p className="mt-1 px-1 font-inter text-[10px] leading-relaxed text-blue-100/55">
                Genel sıran public tabloya yazıldığında netleşecek.
              </p>
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
              <p
                className="rounded-xl px-3 py-3 font-inter text-[11px] leading-relaxed text-blue-100/62"
                style={{
                  background: 'rgba(255,255,255,0.045)',
                  boxShadow: 'inset 0 0 0 1px rgba(125,211,252,0.14)',
                }}
              >
                {friendEmptyCopy}
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function LoadingState() {
  return (
    <div
      className="mt-4 flex items-center justify-center gap-2 rounded-xl px-3 py-4 font-inter text-xs font-bold text-blue-100/70"
      style={{ background: 'rgba(255,255,255,0.045)' }}
    >
      <Loader2 className="h-4 w-4 animate-spin text-amber-200" />
      Sıralama yükleniyor…
    </div>
  );
}

/**
 * Codex119 — Friendly neutral placeholder shown when:
 *  - the global ranking call failed (permission, network, etc.), OR
 *  - the call succeeded but returned 0 user rows.
 *
 * NO red/destructive color. NO backend/permission wording. NO fake rows.
 * The user's OWN score stays visible so the screen never feels broken.
 * Admins see a small extra line with the technical reason (when present).
 */
function RankingPreparingState({ ownScore, onRetry, isAdmin, backendReason }) {
  const scoreSource = ownScore?.totalKronoxScore ?? ownScore?.totalSoloScore;
  const score = Number.isFinite(Number(scoreSource))
    ? Math.max(0, Math.floor(Number(scoreSource)))
    : 0;
  const level = Number.isFinite(Number(ownScore?.currentLevel))
    ? Math.max(1, Math.floor(Number(ownScore.currentLevel)))
    : 1;

  return (
    <div
      className="mt-4 rounded-xl p-4"
      style={{
        background: 'linear-gradient(180deg, rgba(59,130,246,0.10), rgba(30,41,75,0.18))',
        boxShadow: 'inset 0 0 0 1px rgba(125,211,252,0.22)',
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-amber-200"
          style={{
            background: 'rgba(250,204,21,0.10)',
            boxShadow: 'inset 0 0 0 1px rgba(250,204,21,0.35)',
          }}
        >
          <Trophy className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="font-inter text-xs font-black text-white">
            Kronox sıralaması hazırlanıyor.
          </p>
          <p className="mt-1 font-inter text-[11px] leading-relaxed text-blue-100/70">
            Puanın kaydedildi. Kısa süre içinde sıralamada görünecek.
          </p>
        </div>
      </div>

      <div
        className="mt-3 grid grid-cols-2 gap-2 rounded-xl px-3 py-2.5"
        style={{
          background: 'rgba(255,255,255,0.045)',
          boxShadow: 'inset 0 0 0 1px rgba(125,211,252,0.18)',
        }}
      >
        <div>
          <p className="font-inter text-[10px] font-black uppercase tracking-widest text-blue-100/55">
            Senin Puanın
          </p>
          <p className="kronox-number mt-0.5 text-lg leading-none text-amber-200">{score}</p>
        </div>
        <div className="text-right">
          <p className="font-inter text-[10px] font-black uppercase tracking-widest text-blue-100/55">
            Genel Sıran
          </p>
          <p className="mt-0.5 font-inter text-[12px] font-black text-blue-100/85">
            Hazırlanıyor
          </p>
        </div>
      </div>

      <p className="mt-2 font-inter text-[10px] leading-relaxed text-blue-100/55">
        Seviye <span className="kronox-number">{level}</span> — ilerlemen kaydediliyor.
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

      {/*
        Codex119 — Admin-only diagnostics block. End users never see backend
        wording. Admins still need the technical reason (permission gate,
        empty list, network error) to debug, so it lives here as a small,
        unobtrusive footnote. Hidden when the reason is empty.
      */}
      {isAdmin && backendReason ? (
        <div
          className="mt-3 rounded-lg px-2.5 py-2 font-inter text-[10px] leading-relaxed text-amber-100/75"
          style={{
            background: 'rgba(250,204,21,0.06)',
            boxShadow: 'inset 0 0 0 1px rgba(250,204,21,0.20)',
          }}
        >
          <span className="font-black uppercase tracking-widest text-amber-200/90">
            Admin tanılama:
          </span>{' '}
          {String(backendReason).slice(0, 240)}
        </div>
      ) : null}
    </div>
  );
}

function EmptyState({ icon: Icon, title, text }) {
  return (
    <div
      className="mt-4 rounded-xl px-3 py-4 text-center"
      style={{
        background: 'rgba(255,255,255,0.045)',
        boxShadow: 'inset 0 0 0 1px rgba(125,211,252,0.14)',
      }}
    >
      <Icon className="mx-auto h-5 w-5 text-amber-200/80" />
      <p className="mt-2 font-inter text-xs font-black text-white">{title}</p>
      <p className="mt-1 font-inter text-[11px] leading-relaxed text-blue-100/62">{text}</p>
    </div>
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
      <div className="kronox-number w-8 shrink-0 text-center text-lg leading-none" style={{ color: rankColor }}>
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
          <p className="truncate font-inter text-xs font-black text-white">{row.displayName}</p>
          {row.isCurrentUser && <Badge text="Sen" tone="gold" />}
          {row.isFriend && <Badge text="Arkadaş" tone="cyan" />}
        </div>
        <p className="mt-0.5 font-inter text-[10px] text-blue-100/55">
          Seviye <span className="kronox-number">{row.summary.currentLevel}</span>
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="kronox-number text-lg leading-none text-amber-200">{row.summary.totalKronoxScore}</p>
        <p className="font-inter text-[9px] font-black uppercase tracking-wider text-blue-100/45">Puan</p>
      </div>
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
