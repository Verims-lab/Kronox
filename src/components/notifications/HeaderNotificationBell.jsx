// components/notifications/HeaderNotificationBell.jsx
// Shared header notification bell + dropdown panel.
//
// Visual: small bell icon that mirrors the avatar's circular gold style
// in ScreenHeader. A small red/gold badge with the unread count sits on
// the top-right of the bell. Tapping opens a popup with two sections:
//
//    A) Friend Requests  →  tap item navigates to /friends
//    B) Game Invites     →  tap item accepts (lobby-first) via the
//                            existing acceptGameInvite flow.
//
// When no user is signed in, Home still renders a visual bell affordance while
// keeping notification data/hooks inert through the null-user hook path.
//
// Health note: this is purely additive UI. It does NOT replace the
// existing foreground GameInviteNotifier toast — both work side by
// side. The bell is an extra discovery surface.

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Loader2, RefreshCcw, Users } from 'lucide-react';
import { useHeaderNotifications } from '@/hooks/useHeaderNotifications';
import {
  formatBadgeCount,
  formatRemaining,
  getGameInviteRemainingMs,
} from '@/lib/headerNotifications';
import { getSafeNotificationActorName } from '@/lib/notificationIdentity';
import { sounds } from '@/lib/gameSounds';

export default function HeaderNotificationBell({ user, variant = 'default' }) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);
  const isHomeVariant = variant === 'home';
  const {
    friendRequests,
    gameInvites,
    totalCount,
    loading,
    error,
    refresh,
    openFriendRequests,
    openGameInvite,
  } = useHeaderNotifications(user);

  // Close on outside click / Esc.
  useEffect(() => {
    if (!open) return undefined;
    const onClick = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('touchstart', onClick, { passive: true });
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('touchstart', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!user) {
    return (
      <button
        type="button"
        onClick={() => sounds.tap()}
        className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-amber-200 active:scale-95 transition-transform"
        style={{
          background: 'rgba(7, 21, 47, 0.82)',
          border: '1px solid rgba(255, 201, 40, 0.45)',
          boxShadow: '0 0 16px rgba(85,216,255,0.10), inset 0 0 0 1px rgba(255,255,255,0.04)',
        }}
        aria-label="Bildirimler"
      >
        <Bell className="h-5 w-5" strokeWidth={2.6} />
      </button>
    );
  }

  const badgeLabel = formatBadgeCount(totalCount);

  const handleToggle = () => {
    sounds.tap();
    setOpen((v) => !v);
    if (!open) refresh();
  };

  const handleFriendItem = () => {
    setOpen(false);
    openFriendRequests();
  };

  const handleInviteItem = async (invite) => {
    setOpen(false);
    await openGameInvite(invite);
  };

  return (
    <div ref={wrapperRef} className="relative" data-kx-header-notification-bell="true">
      <motion.button
        type="button"
        onClick={handleToggle}
        whileTap={{ scale: 0.92 }}
        transition={{ type: 'spring', stiffness: 520, damping: 24 }}
        className={`relative flex shrink-0 items-center justify-center rounded-full ${isHomeVariant ? 'h-11 w-11 text-amber-200' : 'h-10 w-10 text-amber-950'}`}
        style={{
          background: isHomeVariant
            ? 'rgba(7, 21, 47, 0.82)'
            : 'radial-gradient(circle at 35% 28%, #ffe066, #b97a06 70%)',
          border: isHomeVariant ? '1px solid rgba(255, 201, 40, 0.45)' : undefined,
          boxShadow: isHomeVariant
            ? '0 0 16px rgba(85,216,255,0.10), inset 0 0 0 1px rgba(255,255,255,0.04)'
            : '0 0 12px rgba(250,204,21,0.40), inset 0 1px 0 rgba(255,255,255,0.45), inset 0 -4px 6px rgba(140,80,8,0.55)',
        }}
        aria-label={badgeLabel ? `Bildirimler (${badgeLabel})` : 'Bildirimler'}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Bell className="h-5 w-5" strokeWidth={2.6} />
        {badgeLabel && (
          <span
            data-kx-header-notification-badge="true"
            className="kronox-number absolute -right-1 -top-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1 text-[10px]"
            style={{
              background: 'linear-gradient(180deg,#ef4444,#b91c1c)',
              color: '#fff7ed',
              boxShadow: '0 0 8px rgba(239,68,68,0.55), inset 0 1px 0 rgba(255,255,255,0.35)',
            }}
          >
            {badgeLabel}
          </span>
        )}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            role="dialog"
            aria-label="Bildirimler"
            className="absolute right-0 mt-2 w-[min(20rem,calc(100vw-1.5rem))] rounded-2xl overflow-hidden"
            style={{
              background: 'linear-gradient(180deg, rgba(20,30,58,0.98), rgba(4,8,22,0.99))',
              boxShadow: 'inset 0 0 0 1px rgba(250,204,21,0.35), 0 18px 38px rgba(2,6,23,0.55)',
              zIndex: 120,
            }}
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
              <p className="font-cinzel text-[12px] font-black tracking-[0.18em] text-amber-200">
                BİLDİRİMLER
              </p>
              <button
                type="button"
                onClick={refresh}
                className="flex h-7 w-7 items-center justify-center rounded-full text-blue-100/70 hover:text-amber-200"
                aria-label="Yenile"
              >
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto">
              {error && (
                <div className="px-3 py-2 text-[12px] text-rose-200">
                  {error}
                  <button
                    type="button"
                    onClick={refresh}
                    className="ml-2 underline text-rose-100"
                  >
                    Tekrar dene
                  </button>
                </div>
              )}

              {/* Friend Requests */}
              <Section title="Arkadaşlık İstekleri" count={friendRequests.length}>
                {friendRequests.length === 0 ? null : friendRequests.map((row) => (
                  <FriendRequestItem
                    key={row.id}
                    row={row}
                    onOpen={handleFriendItem}
                  />
                ))}
              </Section>

              {/* Game Invites */}
              <Section title="Oyun Davetleri" count={gameInvites.length}>
                {gameInvites.length === 0 ? null : gameInvites.map((row) => (
                  <GameInviteItem
                    key={row.id}
                    row={row}
                    onOpen={() => handleInviteItem(row)}
                  />
                ))}
              </Section>

              {!loading && totalCount === 0 && !error && (
                <p className="px-3 py-6 text-center font-inter text-[12px] text-blue-100/65">
                  Yeni bildirimin yok.
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Section({ title, count, children }) {
  if (!children || (Array.isArray(children) && children.length === 0)) return null;
  return (
    <div className="px-1 py-1">
      <div className="flex items-center justify-between px-2 py-1">
        <p className="font-inter text-[10px] font-black uppercase tracking-[0.16em] text-blue-100/65">
          {title}
        </p>
        <span className="kronox-number text-[10px] text-amber-200/85">{count}</span>
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function FriendRequestItem({ row, onOpen }) {
  const display = getSafeNotificationActorName(row?.from_name, 'Bir kullanıcı');
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full text-left rounded-xl px-2 py-2 hover:bg-white/5"
      data-kx-notif-friend-request="true"
    >
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10">
          <Users className="h-4 w-4 text-amber-200" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-inter text-[13px] font-bold text-white truncate">{display}</p>
          <p className="font-inter text-[11px] text-blue-100/70 truncate">
            Arkadaşlık isteği gönderdi
          </p>
        </div>
        <span className="font-inter text-[11px] font-black text-amber-200">Aç</span>
      </div>
    </button>
  );
}

function GameInviteItem({ row, onOpen }) {
  const display = getSafeNotificationActorName(row?.from_name, 'Bir arkadaşın');
  const remaining = formatRemaining(getGameInviteRemainingMs(row));
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full text-left rounded-xl px-2 py-2 hover:bg-white/5"
      data-kx-notif-game-invite="true"
    >
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
          style={{ background: 'radial-gradient(circle at 35% 28%, #ffe066, #b97a06 75%)' }}>
          <Bell className="h-4 w-4 text-amber-950" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-inter text-[13px] font-bold text-white truncate">{display}</p>
          <p className="font-inter text-[11px] text-blue-100/70 truncate">
            Oyun daveti{remaining ? ` • ${remaining}` : ''}
          </p>
        </div>
        <span className="font-inter text-[11px] font-black text-amber-200">Lobiye Git</span>
      </div>
    </button>
  );
}
