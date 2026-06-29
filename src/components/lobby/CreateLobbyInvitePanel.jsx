import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Check,
  Crown,
  Loader2,
  AlertCircle,
  Users,
  UserPlus,
} from 'lucide-react';
import GoldButton from '@/components/ui/GoldButton';
import { sounds } from '@/lib/gameSounds';
import IncomingInvitesPanel from '@/components/invites/IncomingInvitesPanel';
import { loadOnlinePlayerSelection } from '@/lib/onlinePlayerSelection';
import { PRESENCE_REFRESH_MS } from '@/lib/presence';
import KronoxAvatar from '@/components/profile/KronoxAvatar';

/**
 * New create-lobby/invite screen shown when the user taps
 * "Meydan Okumaya Başla" → mode === 'create'.
 *
 * - No player-name input. Identity comes from the authenticated user.
 * - Player count chooser: 2 / 3 / 4 (default 2). Invite cap = count - 1.
 * - Player list comes from backend-owned Online player selection.
 * - Selected player count auto-trims (with a visible toast) if user reduces count.
 * - Invite delivery is wired through pending GameInvite rows when LobbyRoom
 *   creates the lobby. Opaque target refs are forwarded so recipient email
 *   resolution stays backend-owned.
 *
 * Props:
 *   user             — authenticated user (already loaded by useLobbyRoomState)
 *   loading          — true while the parent is creating the lobby
 *   error            — string error from the parent
 *   onCreate({ maxPlayers, inviteTargets }) — parent creates the lobby
 *   onBackMode       — go back to the lobby landing (category screen)
 *   onGoFriends      — navigate to Profile > Friends so the user can add some
 */
export default function CreateLobbyInvitePanel({
  user,
  loading,
  error,
  selectedCategories,
  onCreate,
  onBackMode,
  onGoFriends,
}) {
  const [maxPlayers, setMaxPlayers] = useState(2);
  const [selectedTargets, setSelectedTargets] = useState([]);
  const [players, setPlayers] = useState([]);
  const [playersLoading, setPlayersLoading] = useState(true);
  const [playersError, setPlayersError] = useState('');
  const [autoTrimNote, setAutoTrimNote] = useState('');

  /* ---------------- load selectable players once user is known ---------------- */
  useEffect(() => {
    let cancelled = false;
    if (!user?.email) {
      setPlayers([]);
      setPlayersLoading(false);
      setPlayersError('');
      return undefined;
    }
    const refresh = async ({ showLoading = false } = {}) => {
      if (cancelled) return;
      if (showLoading) setPlayersLoading(true);
      setPlayersError('');
      try {
        const rows = await loadOnlinePlayerSelection();
        if (!cancelled) setPlayers(rows || []);
      } catch (err) {
        if (!cancelled) setPlayersError(err?.message || 'Oyuncular yüklenemedi.');
      } finally {
        if (!cancelled && showLoading) setPlayersLoading(false);
      }
    };
    const refreshIfVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    refresh({ showLoading: true });
    const intervalId = window.setInterval(refreshIfVisible, PRESENCE_REFRESH_MS);
    document.addEventListener('visibilitychange', refreshIfVisible);
    window.addEventListener('focus', refreshIfVisible);
    window.addEventListener('online', refreshIfVisible);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', refreshIfVisible);
      window.removeEventListener('focus', refreshIfVisible);
      window.removeEventListener('online', refreshIfVisible);
    };
  }, [user?.email]);

  const inviteCap = Math.max(0, maxPlayers - 1);

  /* ---------------- auto-trim selection when cap decreases ---------------- */
  useEffect(() => {
    if (selectedTargets.length > inviteCap) {
      const trimmed = selectedTargets.slice(0, inviteCap);
      const dropped = selectedTargets.length - trimmed.length;
      setSelectedTargets(trimmed);
      setAutoTrimNote(
        dropped === 1
          ? '1 oyuncu seçimden çıkarıldı (yeni oyuncu sayısına göre).'
          : `${dropped} oyuncu seçimden çıkarıldı (yeni oyuncu sayısına göre).`,
      );
      const timer = window.setTimeout(() => setAutoTrimNote(''), 2400);
      return () => window.clearTimeout(timer);
    }
  }, [inviteCap, selectedTargets]);

  /* ---------------- selection helpers ---------------- */
  const togglePlayer = (targetRef) => {
    if (!targetRef) return;
    setSelectedTargets((prev) => {
      if (prev.includes(targetRef)) {
        sounds.tick();
        return prev.filter((ref) => ref !== targetRef);
      }
      if (prev.length >= inviteCap) {
        // cap reached — surface a brief inline message but never throw
        sounds.tick();
        setAutoTrimNote(`En fazla ${inviteCap} oyuncu seçebilirsin (${maxPlayers} kişi için).`);
        window.setTimeout(() => setAutoTrimNote(''), 2200);
        return prev;
      }
      sounds.tap();
      return [...prev, targetRef];
    });
  };

  const pickCount = (n) => {
    sounds.tap();
    setMaxPlayers(n);
  };

  const handleCreate = () => {
    sounds.tap();
    // Codex091 — forward the chosen category ids from the Online landing
    // so LobbyRoom can persist them on the Lobby row. Defensive fallback:
    // if nothing was forwarded, leave undefined and let LobbyRoom apply
    // the safe default.
    onCreate({
      maxPlayers,
      inviteTargets: [...selectedTargets],
      selectedCategories: Array.isArray(selectedCategories) ? [...selectedCategories] : undefined,
    });
  };

  const userIdentity = useMemo(() => {
    const display = user?.username?.trim() || user?.public_username?.trim() || user?.full_name?.trim() || 'Oyuncu';
    return { display, profile: user };
  }, [user]);

  /* ---------------- render ---------------- */
  return (
    <div
      className="min-h-screen w-full text-white"
      style={{
        paddingTop: 'calc(4rem + env(safe-area-inset-top))',
        paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))',
        background:
          'radial-gradient(ellipse at 50% 12%, rgba(59,130,246,0.30), transparent 45%), radial-gradient(ellipse at 50% 92%, rgba(34,211,238,0.10), transparent 55%), linear-gradient(180deg, #050b1c 0%, #0a1738 55%, #03060f 100%)',
        userSelect: 'none',
      }}
    >
      <div className="mx-auto w-full max-w-md px-4 space-y-5">
        {/* Header */}
        <Header onBackMode={onBackMode} />

        {/* Incoming game invites addressed to me — renders nothing when empty */}
        <IncomingInvitesPanel user={user} />

        {/* You — current user */}
        <SectionLabel icon={Crown} text="Sen" />
        <SelfCard {...userIdentity} />

        {/* Player count */}
        <SectionLabel icon={Users} text="Oyuncu Sayısı" />
        <PlayerCountSelector value={maxPlayers} onChange={pickCount} />

        {/* Friends */}
        <SectionLabel
          icon={UserPlus}
          text="Oyuncu Seç"
          tail={
            <span className="font-inter text-[10px] font-black uppercase tracking-widest text-amber-200/90">
              {selectedTargets.length} / {inviteCap} seçildi
            </span>
          }
        />

        {playersLoading && players.length === 0 ? (
          <FriendsSkeleton />
        ) : playersError && players.length === 0 ? (
          <ErrorHint text={playersError} />
        ) : players.length === 0 ? (
          <EmptyPlayers onGoFriends={onGoFriends} />
        ) : (
          <ul className="space-y-2">
            {players.map((player) => {
              const isSelected = selectedTargets.includes(player.target_ref);
              const disabled = !isSelected && selectedTargets.length >= inviteCap;
              return (
                <FriendInviteRow
                  key={player.target_ref}
                  player={player}
                  selected={isSelected}
                  disabled={disabled}
                  onToggle={() => togglePlayer(player.target_ref)}
                />
              );
            })}
          </ul>
        )}

        {/* Inline auto-trim / cap message */}
        <AnimatePresence>
          {autoTrimNote && (
            <motion.p
              key="trim"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="rounded-xl px-3 py-2 font-inter text-[12px] text-amber-100/90"
              style={{
                background: 'rgba(250,204,21,0.08)',
                boxShadow: 'inset 0 0 0 1px rgba(250,204,21,0.32)',
              }}
            >
              {autoTrimNote}
            </motion.p>
          )}
        </AnimatePresence>

        {/* Lobby creation error */}
        {error && <ErrorHint text={error} />}

        {/* CTA — disabled until at least 1 friend selected */}
        <div className="pt-1">
          <CreateInviteCta
            loading={loading}
            disabled={selectedTargets.length === 0}
            onClick={handleCreate}
            selectedCount={selectedTargets.length}
            inviteCap={inviteCap}
          />
        </div>
      </div>
    </div>
  );
}

function CreateInviteCta({ loading, disabled, onClick, selectedCount, inviteCap }) {
  // Shallow handler that ignores clicks when disabled (no surprise alerts).
  const handleClick = () => { if (!disabled && !loading) onClick(); };
  return (
    <div className="space-y-2">
      <div style={{ opacity: disabled ? 0.55 : 1, pointerEvents: disabled || loading ? 'none' : 'auto', transition: 'opacity 0.2s' }}>
        <GoldButton variant="gold" size="lg" onClick={handleClick} disabled={loading || disabled}>
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Lobi Oluşturuluyor…
            </span>
          ) : (
            'LOBİ OLUŞTUR VE DAVET ET'
          )}
        </GoldButton>
      </div>
      <p
        className="text-center font-inter text-[11px]"
        style={{ color: disabled ? 'rgba(252,211,77,0.85)' : 'rgba(207,224,255,0.55)' }}
      >
        {disabled
          ? 'Oyuna başlamak için en az 1 oyuncu seç.'
          : `${selectedCount} / ${inviteCap} oyuncu seçildi — davetler oluşturulacak.`}
      </p>
      {!disabled && (
        <p className="text-center font-inter text-[11px] text-amber-200/75">
          Davet gönderildikten sonra 10 dakika içinde kabul edilmezse süresi dolar.
        </p>
      )}
    </div>
  );
}

/* =================================================================== */
/*                           Sub-components                            */
/* =================================================================== */

function Header({ onBackMode }) {
  return (
    <div className="relative pt-2">
      <button
        type="button"
        onClick={() => { sounds.tap(); onBackMode?.(); }}
        className="absolute -top-1 left-0 flex h-9 w-9 items-center justify-center rounded-full text-blue-100/70"
        style={{
          background: 'rgba(10,16,36,0.6)',
          boxShadow: 'inset 0 0 0 1px rgba(120,170,255,0.30)',
        }}
        aria-label="Geri"
      >
        <ArrowLeft className="h-4 w-4" />
      </button>
      <div className="text-center">
        <p className="font-inter text-[12px] text-blue-100/65">
          Partini topla. Meydan okumayı başlat.
        </p>
      </div>
    </div>
  );
}

function SectionLabel({ icon: Icon, text, tail }) {
  return (
    <div className="flex items-center justify-between px-1">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="h-3.5 w-3.5 text-amber-200/80" />}
        <p className="font-inter text-[10px] font-black uppercase tracking-[0.18em] text-blue-100/75">
          {text}
        </p>
      </div>
      {tail}
    </div>
  );
}

function SelfCard({ display, profile }) {
  return (
    <div
      className="rounded-2xl p-3 flex items-center gap-3"
      style={{
        background:
          'linear-gradient(180deg, rgba(30,41,75,0.95) 0%, rgba(14,22,46,0.98) 70%, rgba(6,10,24,1) 100%)',
        boxShadow:
          'inset 0 0 0 1.5px rgba(250,204,21,0.45), inset 0 1px 0 rgba(255,255,255,0.08), 0 0 18px rgba(250,204,21,0.18), 0 8px 16px rgba(2,6,23,0.5)',
      }}
    >
      <KronoxAvatar profile={profile} initial={display} size={48} className="shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 min-w-0">
          <Crown className="h-4 w-4 shrink-0 text-amber-300" />
          <p className="truncate font-cinzel text-base tracking-wider text-white">{display}</p>
        </div>
        <p className="truncate font-inter text-[11px] text-blue-100/65">Sen</p>
      </div>
      <span
        className="rounded-full px-2 py-0.5 font-inter text-[10px] font-black text-amber-950"
        style={{ background: 'linear-gradient(180deg,#ffe066,#b97a06)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.45)' }}
      >
        HOST
      </span>
    </div>
  );
}

function PlayerCountSelector({ value, onChange }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {[2, 3, 4].map((n) => {
        const active = n === value;
        return (
          <motion.button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            whileTap={{ scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 520, damping: 24 }}
            className="rounded-2xl py-3 text-center"
            style={{
              background: active
                ? 'linear-gradient(180deg, rgba(250,204,21,0.18), rgba(185,122,6,0.10))'
                : 'linear-gradient(180deg, rgba(30,41,75,0.9), rgba(10,16,36,0.95))',
              boxShadow: active
                ? 'inset 0 0 0 1.5px rgba(250,204,21,0.85), inset 0 1px 0 rgba(255,255,255,0.18), 0 0 18px rgba(250,204,21,0.45), 0 8px 18px rgba(2,6,23,0.55)'
                : 'inset 0 0 0 1.5px rgba(120,170,255,0.28), inset 0 1px 0 rgba(255,255,255,0.06), 0 6px 12px rgba(2,6,23,0.45)',
            }}
            aria-pressed={active}
            aria-label={`${n} kişilik lobi`}
          >
            <p
              className="kronox-number text-3xl leading-none"
              style={{
                color: active ? '#ffe066' : '#cfe0ff',
                textShadow: active ? '0 0 12px rgba(250,204,21,0.55)' : 'none',
              }}
            >
              {n}
            </p>
            <p className="mt-1 font-inter text-[10px] font-black uppercase tracking-widest text-blue-100/75">
              Kişi
            </p>
          </motion.button>
        );
      })}
    </div>
  );
}

function FriendInviteRow({ player, selected, disabled, onToggle }) {
  const display = player?.username || player?.display_name || 'Oyuncu';
  const isOnline = Boolean(player?.online);
  return (
    <motion.li layout>
      <motion.button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        whileTap={{ scale: disabled ? 1 : 0.985 }}
        transition={{ type: 'spring', stiffness: 540, damping: 26 }}
        className="w-full flex items-center gap-3 rounded-2xl p-3 text-left transition-opacity"
        style={{
          opacity: disabled ? 0.5 : 1,
          background: selected
            ? 'linear-gradient(180deg, rgba(34,68,142,0.92), rgba(8,18,42,0.96))'
            : 'linear-gradient(180deg, rgba(30,41,75,0.9), rgba(10,16,36,0.95))',
          boxShadow: selected
            ? 'inset 0 0 0 1.5px rgba(96,165,250,0.85), inset 0 1px 0 rgba(255,255,255,0.12), 0 0 18px rgba(59,130,246,0.45), 0 8px 16px rgba(2,6,23,0.5)'
            : 'inset 0 0 0 1.5px rgba(120,170,255,0.28), inset 0 1px 0 rgba(255,255,255,0.06), 0 6px 12px rgba(2,6,23,0.45)',
        }}
        aria-pressed={selected}
      >
        <div className="relative shrink-0">
          <KronoxAvatar profile={player} initial={display} size={40} />
          <span
            aria-hidden="true"
            className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full"
            style={{
              background: isOnline ? '#22c55e' : '#ef4444',
              boxShadow: isOnline
                ? '0 0 6px rgba(34,197,94,0.65), 0 0 0 2px rgba(10,16,36,0.95)'
                : '0 0 6px rgba(239,68,68,0.38), 0 0 0 2px rgba(10,16,36,0.95)',
            }}
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-inter text-sm font-bold text-white">{display}</p>
          <p className="truncate font-inter text-[11px]" style={{ color: isOnline ? '#34d399' : '#f87171' }}>
            {player?.status_label || (isOnline ? 'Çevrimiçi' : 'Çevrim dışı')} · {player?.badge_label || (player?.relation === 'friend' ? 'Arkadaş' : 'Oyuncu')}
          </p>
        </div>
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
          style={{
            background: selected
              ? 'linear-gradient(180deg,#ffe066,#b97a06)'
              : 'rgba(255,255,255,0.05)',
            boxShadow: selected
              ? 'inset 0 1px 0 rgba(255,255,255,0.5), 0 0 10px rgba(250,204,21,0.55)'
              : 'inset 0 0 0 1px rgba(255,255,255,0.18)',
          }}
        >
          {selected ? <Check className="h-4 w-4 text-amber-950" strokeWidth={3.2} /> : null}
        </span>
      </motion.button>
    </motion.li>
  );
}

function FriendsSkeleton() {
  return (
    <div
      className="space-y-2"
      role="status"
      aria-live="polite"
      aria-label="Oyuncular yükleniyor"
    >
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-14 rounded-2xl"
          aria-hidden="true"
          style={{
            background:
              'linear-gradient(90deg, rgba(255,255,255,0.04), rgba(255,255,255,0.08), rgba(255,255,255,0.04))',
            backgroundSize: '200% 100%',
            animation: 'kx-skeleton 1.2s linear infinite',
          }}
        />
      ))}
      <style>{`@keyframes kx-skeleton { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>
    </div>
  );
}

function EmptyPlayers({ onGoFriends }) {
  return (
    <div
      className="rounded-2xl px-4 py-5 text-center"
      style={{
        background: 'linear-gradient(180deg, rgba(30,41,75,0.7), rgba(10,16,36,0.85))',
        boxShadow: 'inset 0 0 0 1.5px rgba(120,170,255,0.30), inset 0 1px 0 rgba(255,255,255,0.06)',
      }}
    >
      <UserPlus className="mx-auto h-7 w-7 text-amber-300" />
      <p className="mt-2 font-cinzel text-base tracking-wider text-white">Oyuncu bulunamadı</p>
      <p className="mt-1 font-inter text-[12px] text-blue-100/65">
        Çevrimiçi oyuncu veya arkadaş görünmüyor.
      </p>
      <button
        type="button"
        onClick={() => { sounds.tap(); onGoFriends?.(); }}
        className="mt-3 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 font-inter text-xs font-black text-amber-950"
        style={{
          background: 'linear-gradient(180deg,#ffe066,#b97a06)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.45), 0 0 12px rgba(250,204,21,0.45)',
        }}
      >
        Arkadaşlarım sayfasına git
      </button>
      <p className="mt-3 font-inter text-[11px] text-blue-100/55">
        Arkadaş eklemek istemiyorsan da lobiyi oluşturup kodla davet edebilirsin.
      </p>
    </div>
  );
}

function ErrorHint({ text }) {
  return (
    <div
      className="flex items-start gap-2 rounded-xl px-3 py-2"
      style={{ background: 'rgba(244,63,94,0.10)', boxShadow: 'inset 0 0 0 1px rgba(244,63,94,0.35)' }}
    >
      <AlertCircle className="h-4 w-4 text-rose-300 flex-shrink-0 mt-0.5" />
      <p className="font-inter text-xs text-rose-100/90">{text}</p>
    </div>
  );
}
