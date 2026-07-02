import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Medal, RefreshCw, Trophy, UserRound } from 'lucide-react';
import useLongPress from '@/hooks/useLongPress';
import LeaderboardRowActionMenu from '@/components/leaderboard/LeaderboardRowActionMenu';
import { resolveProfileAvatar } from '@/lib/avatarOptions';
import { normalizeLeaderboardRank } from '@/lib/leaderboard';

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
 *                        currentUserInTop, ownScoreRow,
 *                        ownScoreFallback: { totalKronoxScore,
 *                        totalSoloScore, currentLevel } }
 *   onRetry          : () => void
 *   isAdmin          : boolean — gates the technical diagnostic line
 *   onCurrentUserRowOpenSettings : () => void — own row only
 *   onAddFriend      : async (playerName) => void — long-press friend add
 */
export default function KronoxRankingSection({
  authChecked,
  user,
  leaderboard,
  onRetry,
  isAdmin,
  onCurrentUserRowOpenSettings,
  onAddFriend,
}) {
  // Long-press friend-add menu. A row is "addable" when it is not the
  // current user and not already a friend. The menu only ever receives the
  // safe public displayName — no email or internal identifier.
  const [menuRow, setMenuRow] = useState(null);
  const [menuBusy, setMenuBusy] = useState(false);

  const handleLongPress = useCallback((row) => {
    if (!row || row.isCurrentUser || row.isFriend) return;
    if (typeof onAddFriend !== 'function') return;
    setMenuRow(row);
  }, [onAddFriend]);

  const closeMenu = useCallback(() => {
    if (menuBusy) return;
    setMenuRow(null);
  }, [menuBusy]);

  const handleMenuAddFriend = useCallback(async () => {
    if (!menuRow || typeof onAddFriend !== 'function') return;
    setMenuBusy(true);
    try {
      await onAddFriend(menuRow.displayName);
      setMenuRow(null);
    } finally {
      setMenuBusy(false);
    }
  }, [menuRow, onAddFriend]);

  const canAddFriend = (row) => Boolean(
    typeof onAddFriend === 'function' && row && !row.isCurrentUser && !row.isFriend,
  );

  const hasRows = leaderboard.topRows.length > 0;
  const currentTopRow = leaderboard.topRows.find((row) => row.isCurrentUser) || null;
  const stickyMyRankRow = user
    ? (
      leaderboard.currentUserRow ||
      currentTopRow ||
      (leaderboard.ownScoreRow ? { ...leaderboard.ownScoreRow, rank: null, isCurrentUser: true } : null)
    )
    : null;
  const waitingForLeaderboard = Boolean(user && !leaderboard.loaded && !leaderboard.error);

  return (
    <section className="leaderboard-panel">
      <h2 className="leaderboard-section-title">
        <Medal aria-hidden="true" />
        <span>Kronox Sıralaması</span>
      </h2>

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
        <div className="leaderboard-list">
          {leaderboard.topRows.map((row) => (
            <LeaderboardRow
              key={row.id}
              row={row}
              onOpenSettings={onCurrentUserRowOpenSettings}
              onLongPress={canAddFriend(row) ? handleLongPress : undefined}
            />
          ))}
        </div>
      )}

      {stickyMyRankRow && (
        <div className="my-rank-sticky">
          <MyRankCard
            row={stickyMyRankRow}
            onOpenSettings={onCurrentUserRowOpenSettings}
          />
        </div>
      )}

      <LeaderboardRowActionMenu
        open={Boolean(menuRow)}
        playerName={menuRow?.displayName || ''}
        busy={menuBusy}
        onAddFriend={handleMenuAddFriend}
        onClose={closeMenu}
      />
    </section>
  );
}

function LeaderboardAvatar({ row }) {
  const avatar = resolveProfileAvatar(row);
  const [photoFailed, setPhotoFailed] = useState(false);

  useEffect(() => {
    setPhotoFailed(false);
  }, [avatar.url]);

  const showPhoto = avatar.type === 'photo' && avatar.url && !photoFailed;
  const initial = String(row?.initial || row?.displayName || 'K')
    .charAt(0)
    .toLocaleUpperCase('tr-TR');

  if (showPhoto) {
    return (
      <img
        src={avatar.url}
        alt=""
        className="leaderboard-avatar"
        draggable={false}
        aria-hidden="true"
        onError={() => setPhotoFailed(true)}
      />
    );
  }

  return (
    <div className="leaderboard-avatar leaderboard-avatar--default" aria-hidden="true">
      <span className="leaderboard-avatar-letter">{initial}</span>
    </div>
  );
}

function ScoreBlock({ row }) {
  return (
    <div className="shrink-0 text-right">
      <p className="leaderboard-score">{row.summary.totalKronoxScore}</p>
      <p className="leaderboard-score-label">Puan</p>
    </div>
  );
}

function MyRankCard({ row, onOpenSettings }) {
  const displayRank = normalizeLeaderboardRank(row.rank);
  const rankText = displayRank !== null ? `#${displayRank}` : '—';
  const content = (
    <>
      <div className="leaderboard-rank">{rankText}</div>
      <LeaderboardAvatar row={row} />
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <span className="my-rank-label">Senin sıran</span>
          <span className="my-rank-you-badge">SEN</span>
        </div>
        <p className="leaderboard-name">{row.displayName}</p>
      </div>
      <ScoreBlock row={row} />
    </>
  );

  if (typeof onOpenSettings === 'function') {
    return (
      <button
        type="button"
        onClick={onOpenSettings}
        aria-label="Profil ayarlarını aç"
        className="my-rank-card w-full appearance-none text-left transition-transform active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/70"
      >
        {content}
      </button>
    );
  }

  return <div className="my-rank-card">{content}</div>;
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

function LeaderboardRow({ row, compact = false, emphasis = false, onOpenSettings, onLongPress }) {
  const isHighlighted = row.isCurrentUser || emphasis;
  const canOpenSettings = row.isCurrentUser && typeof onOpenSettings === 'function';
  const canLongPress = !row.isCurrentUser && typeof onLongPress === 'function';
  const longPressProps = useLongPress(canLongPress ? () => onLongPress(row) : null);
  const displayRank = normalizeLeaderboardRank(row.rank);
  const rankText = displayRank !== null ? `#${displayRank}` : '—';
  const className = [
    'leaderboard-row',
    compact ? 'leaderboard-row--compact' : '',
    isHighlighted ? 'leaderboard-row--highlighted' : '',
    canOpenSettings
      ? 'w-full cursor-pointer appearance-none text-left transition-transform active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/70'
      : '',
    canLongPress ? 'cursor-pointer select-none' : '',
  ].filter(Boolean).join(' ');
  const content = (
    <>
      <div className="leaderboard-rank">
        {rankText}
      </div>
      <LeaderboardAvatar row={row} />
      <div className="min-w-0 flex-1 self-center">
        <div className="flex min-w-0 items-center gap-1.5">
          <p className="leaderboard-name">{row.displayName}</p>
          {row.isCurrentUser && <Badge text="Sen" tone="gold" />}
          {row.isFriend && <Badge text="Arkadaş" tone="cyan" />}
        </div>
      </div>
      <ScoreBlock row={row} />
    </>
  );

  if (canOpenSettings) {
    return (
      <button
        type="button"
        onClick={onOpenSettings}
        aria-label="Profil ayarlarını aç"
        className={className}
      >
        {content}
      </button>
    );
  }

  return (
    <div
      className={className}
      {...(canLongPress ? longPressProps : {})}
    >
      {content}
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
