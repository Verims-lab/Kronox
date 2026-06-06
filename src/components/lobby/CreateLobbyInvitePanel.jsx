import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Check,
  Crown,
  Loader2,
  AlertCircle,
  Users,
  UserRound,
  UserPlus,
} from 'lucide-react';
import GoldButton from '@/components/ui/GoldButton';
import { sounds } from '@/lib/gameSounds';
import { loadFriends, normalizeEmail } from '@/lib/friendsApi';
import IncomingInvitesPanel from '@/components/invites/IncomingInvitesPanel';

/**
 * New create-lobby/invite screen shown when the user taps
 * "Meydan Okumaya Başla" → mode === 'create'.
 *
 * - No player-name input. Identity comes from the authenticated user.
 * - Player count chooser: 2 / 3 / 4 (default 2). Invite cap = count - 1.
 * - Friends list comes from Friendship entity via loadFriends().
 * - Selected friend count auto-trims (with a visible toast) if user reduces count.
 * - Invite delivery is NOT wired yet — selected emails are passed to LobbyRoom
 *   as informational metadata that the host can use later. The lobby itself is
 *   still created exactly the same way it was before.
 *
 * Props:
 *   user             — authenticated user (already loaded by useLobbyRoomState)
 *   loading          — true while the parent is creating the lobby
 *   error            — string error from the parent
 *   onCreate({ maxPlayers, invitedEmails }) — parent creates the lobby
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
  const [selectedEmails, setSelectedEmails] = useState([]);
  const [friends, setFriends] = useState([]);
  const [friendsLoading, setFriendsLoading] = useState(true);
  const [friendsError, setFriendsError] = useState('');
  const [autoTrimNote, setAutoTrimNote] = useState('');

  /* ---------------- load friends once user is known ---------------- */
  useEffect(() => {
    let cancelled = false;
    if (!user?.email) { setFriendsLoading(false); return; }
    setFriendsLoading(true);
    loadFriends(user.email)
      .then((rows) => { if (!cancelled) setFriends(rows || []); })
      .catch((err) => { if (!cancelled) setFriendsError(err?.message || 'Arkadaşlar yüklenemedi.'); })
      .finally(() => { if (!cancelled) setFriendsLoading(false); });
    return () => { cancelled = true; };
  }, [user?.email]);

  const inviteCap = Math.max(0, maxPlayers - 1);

  /* ---------------- auto-trim selection when cap decreases ---------------- */
  useEffect(() => {
    if (selectedEmails.length > inviteCap) {
      const trimmed = selectedEmails.slice(0, inviteCap);
      const dropped = selectedEmails.length - trimmed.length;
      setSelectedEmails(trimmed);
      setAutoTrimNote(
        dropped === 1
          ? '1 arkadaş seçimden çıkarıldı (yeni oyuncu sayısına göre).'
          : `${dropped} arkadaş seçimden çıkarıldı (yeni oyuncu sayısına göre).`,
      );
      const timer = window.setTimeout(() => setAutoTrimNote(''), 2400);
      return () => window.clearTimeout(timer);
    }
  }, [inviteCap, selectedEmails]);

  /* ---------------- selection helpers ---------------- */
  const toggleFriend = (email) => {
    const normalized = normalizeEmail(email);
    if (!normalized) return;
    setSelectedEmails((prev) => {
      if (prev.includes(normalized)) {
        sounds.tick();
        return prev.filter((e) => e !== normalized);
      }
      if (prev.length >= inviteCap) {
        // cap reached — surface a brief inline message but never throw
        sounds.tick();
        setAutoTrimNote(`En fazla ${inviteCap} arkadaş seçebilirsin (${maxPlayers} kişi için).`);
        window.setTimeout(() => setAutoTrimNote(''), 2200);
        return prev;
      }
      sounds.tap();
      return [...prev, normalized];
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
      invitedEmails: [...selectedEmails],
      selectedCategories: Array.isArray(selectedCategories) ? [...selectedCategories] : undefined,
    });
  };

  const userIdentity = useMemo(() => {
    const display = user?.full_name?.trim() || user?.email?.split('@')[0] || 'Oyuncu';
    const email = user?.email || '';
    return { display, email, initial: (display || '?').charAt(0).toUpperCase() };
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
          text="Arkadaşlarını Davet Et"
          tail={
            <span className="font-inter text-[10px] font-black uppercase tracking-widest text-amber-200/90">
              {selectedEmails.length} / {inviteCap} seçildi
            </span>
          }
        />

        {friendsLoading ? (
          <FriendsSkeleton />
        ) : friendsError ? (
          <ErrorHint text={friendsError} />
        ) : friends.length === 0 ? (
          <EmptyFriends onGoFriends={onGoFriends} />
        ) : (
          <ul className="space-y-2">
            {friends.map((f) => {
              const email = normalizeEmail(f.friend_email);
              const isSelected = selectedEmails.includes(email);
              const disabled = !isSelected && selectedEmails.length >= inviteCap;
              return (
                <FriendInviteRow
                  key={f.id}
                  friend={f}
                  selected={isSelected}
                  disabled={disabled}
                  onToggle={() => toggleFriend(email)}
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
            disabled={selectedEmails.length === 0}
            onClick={handleCreate}
            selectedCount={selectedEmails.length}
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
          ? 'Oyuna başlamak için en az 1 arkadaş seç.'
          : `${selectedCount} / ${inviteCap} arkadaş seçildi — davetler oluşturulacak.`}
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

function SelfCard({ display, email, initial }) {
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
      <div
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
        style={{
          background: 'radial-gradient(circle at 35% 28%, #ffe066, #b97a06 70%)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.45), 0 0 14px rgba(250,204,21,0.5)',
        }}
      >
        <span className="font-bangers text-2xl text-amber-950">{initial}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 min-w-0">
          <Crown className="h-4 w-4 shrink-0 text-amber-300" />
          <p className="truncate font-cinzel text-base tracking-wider text-white">{display}</p>
        </div>
        {email && <p className="truncate font-inter text-[11px] text-blue-100/65">{email}</p>}
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

function FriendInviteRow({ friend, selected, disabled, onToggle }) {
  const display = friend.friend_name?.trim() || friend.friend_email;
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
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
          style={{
            background: selected
              ? 'radial-gradient(circle at 35% 28%, #93c5fd, #1d4ed8 75%)'
              : 'radial-gradient(circle at 35% 28%, #ffe066, #b97a06 70%)',
            boxShadow: selected
              ? 'inset 0 1px 0 rgba(255,255,255,0.35), 0 0 10px rgba(59,130,246,0.35)'
              : 'inset 0 1px 0 rgba(255,255,255,0.4), 0 0 10px rgba(250,204,21,0.35)',
          }}
        >
          <UserRound className={selected ? 'h-5 w-5 text-blue-950' : 'h-5 w-5 text-amber-950'} strokeWidth={2.6} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-inter text-sm font-bold text-white">{display}</p>
          {friend.friend_name && (
            <p className="truncate font-inter text-[11px] text-blue-100/60">{friend.friend_email}</p>
          )}
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
    <div className="space-y-2">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-14 rounded-2xl"
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

function EmptyFriends({ onGoFriends }) {
  return (
    <div
      className="rounded-2xl px-4 py-5 text-center"
      style={{
        background: 'linear-gradient(180deg, rgba(30,41,75,0.7), rgba(10,16,36,0.85))',
        boxShadow: 'inset 0 0 0 1.5px rgba(120,170,255,0.30), inset 0 1px 0 rgba(255,255,255,0.06)',
      }}
    >
      <UserPlus className="mx-auto h-7 w-7 text-amber-300" />
      <p className="mt-2 font-cinzel text-base tracking-wider text-white">Henüz arkadaşın yok</p>
      <p className="mt-1 font-inter text-[12px] text-blue-100/65">
        Profil → <span className="text-amber-200/90 font-bold">Arkadaşlarım</span> üzerinden e-posta ile arkadaş ekleyebilirsin.
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
