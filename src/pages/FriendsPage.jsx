import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Users, Inbox, Send, UserPlus } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import {
  loadFriends,
  loadIncomingRequests,
  loadOutgoingRequests,
  sendFriendRequest,
  acceptIncomingRequest,
  rejectIncomingRequest,
  cancelOutgoingRequest,
  removeFriend,
  normalizeEmail,
  getSafeFriendsErrorMessage,
  OPEN_INVITE_EXISTS_MESSAGE,
} from '@/lib/friendsApi';

import FriendListItem from '@/components/friends/FriendListItem';
import IncomingRequestItem from '@/components/friends/IncomingRequestItem';
import OutgoingRequestItem from '@/components/friends/OutgoingRequestItem';
import AddFriendForm from '@/components/friends/AddFriendForm';
import IncomingInvitesPanel from '@/components/invites/IncomingInvitesPanel';
import useFriendsRealtimeRefresh from '@/hooks/useFriendsRealtimeRefresh';
import useFriendPresence from '@/hooks/useFriendPresence';
import StandardTopBar from '@/components/layout/StandardTopBar';
import PullToRefresh from '@/components/mobile/PullToRefresh';
import { getLeaderboardDiamondValue } from '@/lib/leaderboard';

/**
 * Profile > Arkadaşlarım — Friends MVP.
 * Three sections: My Friends, Incoming Requests, Add Friend. Outgoing Requests
 * shown when present. All mutations refetch authoritative state (no risky
 * optimistic UI for relational data).
 */
export default function FriendsPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [friends, setFriends] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const successTimerRef = useRef(null);
  const { getPresenceForFriend } = useFriendPresence(friends, {
    enabled: authChecked && Boolean(user?.email),
  });

  const showSuccessMessage = useCallback((message, durationMs) => {
    if (successTimerRef.current) {
      window.clearTimeout(successTimerRef.current);
    }
    setSuccessMsg(message);
    successTimerRef.current = window.setTimeout(() => {
      setSuccessMsg('');
      successTimerRef.current = null;
    }, durationMs);
  }, []);

  useEffect(() => () => {
    if (successTimerRef.current) {
      window.clearTimeout(successTimerRef.current);
    }
  }, []);

  useEffect(() => {
    base44.auth.me()
      .then((u) => setUser(u || null))
      .catch(() => setUser(null))
      .finally(() => setAuthChecked(true));
  }, []);

  const refresh = useCallback(async (email) => {
    if (!email) return;
    setLoading(true);
    setLoadError('');
    try {
      const [f, inc, out] = await Promise.all([
        loadFriends(email),
        loadIncomingRequests(email),
        loadOutgoingRequests(email),
      ]);
      setFriends(f);
      setIncoming(inc);
      setOutgoing(out);
    } catch (err) {
      // Codex571 — Never show raw backend/SDK errors (e.g. "Rate limit
      // exceeded") on the Friends screen; always a safe Turkish message.
      setLoadError(getSafeFriendsErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authChecked && user?.email) refresh(user.email);
    if (authChecked && !user) setLoading(false);
  }, [authChecked, user, refresh]);

  // Codex088 — Realtime refresh so the sender's UI updates when the
  // recipient accepts on another device. Combines FriendRequest entity
  // subscription + visibility/focus reload + light polling fallback.
  useFriendsRealtimeRefresh({
    enabled: authChecked && !!user?.email,
    myEmail: user?.email,
    refresh,
  });

  /* ---- mutation handlers — always refetch after success ---- */
  const handleSend = async (target) => {
    // Codex087 — sendFriendRequest may resolve with {emailSent:false} when
    // the FriendRequest was created but the email notification failed.
    // We must not throw in that case (the request itself succeeded), but
    // we should surface a soft warning so the sender knows.
    //
    // Codex129 — Be honest about the actual outcome:
    //   • emailSent=true  → "isteği gönderildi, e-posta da iletildi"
    //   • emailSent=false + recipientRegistered=true → "isteği oluşturuldu,
    //     e-posta gönderilemedi. Uygulamada görecek."
    //   • emailSent=false + recipientRegistered!=true → "isteği oluşturuldu.
    //     Alıcı Kronox'a kayıtlı değilse e-posta iletilemez; kayıt olursa
    //     uygulamada görecek."
    const result = await sendFriendRequest({ me: user, target });
    await refresh(user.email);
    if (result) {
      let msg = null;
      if (result.alreadyPending) {
        msg = OPEN_INVITE_EXISTS_MESSAGE;
      } else if (result.emailSent === true) {
        msg = 'Arkadaşlık isteği gönderildi ve e-posta iletildi.';
      } else if (result.recipientRegistered === true) {
        msg = 'İstek oluşturuldu. E-posta gönderilemedi ancak alıcı uygulamada görecek.';
      } else {
        msg = 'İstek oluşturuldu. Alıcı Kronox\'a kayıtlı değilse e-posta iletilemez; kayıt olduğunda uygulamada görecek.';
      }
      showSuccessMessage(msg, 5200);
    }
    return result;
  };
  const handleAccept = async (req) => {
    // Codex080: acceptIncomingRequest accepts either id or full row object.
    // On success the FriendRequest is flipped to 'accepted' and the normalized
    // loadFriends will pick it up from both sides — both users see each other.
    await acceptIncomingRequest(req);
    setLoadError('');
    showSuccessMessage('Arkadaşlık isteği kabul edildi.', 2200);
    await refresh(user.email);
  };
  const handleReject = async (req) => {
    await rejectIncomingRequest(req.id);
    await refresh(user.email);
  };
  const handleCancel = async (req) => {
    await cancelOutgoingRequest(req.id);
    await refresh(user.email);
  };
  const handleRemove = async (friendEmail) => {
    // Codex571 — Rate-limit-safe delete: remove the row optimistically and
    // do NOT trigger a full list reload (loadFriends + loadIncoming +
    // loadOutgoing) after every single delete. Deleting many friends back
    // to back previously fired 3 extra reads per delete, which could hit
    // the backend rate limit. A single removeFriend call per delete, with
    // local state update, keeps deleting many friends safe.
    const target = normalizeEmail(friendEmail);
    const previousFriends = friends;
    setFriends((current) => current.filter((f) => normalizeEmail(f.friend_email) !== target));
    try {
      await removeFriend(friendEmail);
    } catch (err) {
      setFriends(previousFriends);
      throw err;
    }
  };

  /* ---- render ---- */
  if (!authChecked) {
    return <CenteredLoader />;
  }

  if (!user) {
    return (
      <PageShell>
        <div className="rounded-2xl p-6 text-center"
          style={{
            background: 'linear-gradient(180deg, rgba(30,41,75,0.9), rgba(10,16,36,0.95))',
            boxShadow: 'inset 0 0 0 1.5px rgba(120,170,255,0.30), 0 8px 16px rgba(2,6,23,0.5)',
          }}>
          <Users className="mx-auto h-8 w-8 text-amber-300" />
          <p className="mt-3 font-cinzel text-base tracking-wider text-white">Giriş gerekli</p>
          <p className="mt-1 font-inter text-xs text-blue-100/70">
            Arkadaşlarını görmek için önce giriş yap.
          </p>
          <button
            type="button"
            onClick={() => base44.auth.redirectToLogin('/friends')}
            className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 font-inter text-sm font-black text-amber-950"
            style={{
              background: 'linear-gradient(180deg,#ffe066,#b97a06)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.45), 0 0 12px rgba(250,204,21,0.45)',
            }}
          >
            Giriş Yap
          </button>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PullToRefresh onRefresh={() => refresh(user.email)} disabled={!user?.email}>
        <div className="space-y-5">
          <StandardTopBar showBack onBack={() => navigate('/profile')} diamonds={getLeaderboardDiamondValue(user)} user={user} />
          {/* Header subtitle */}
          <p className="font-inter text-xs text-blue-100/60 px-1">
            Arkadaşlarını yönet, davet et, isteklerini gör.
          </p>

          {loadError && (
            <p className="rounded-xl px-3 py-2 font-inter text-xs text-rose-100/90"
              style={{ background: 'rgba(244,63,94,0.10)', boxShadow: 'inset 0 0 0 1px rgba(244,63,94,0.35)' }}>
              {loadError}
            </p>
          )}

          {successMsg && (
            <p className="rounded-xl px-3 py-2 font-inter text-xs font-bold text-emerald-100"
              style={{ background: 'rgba(16,185,129,0.12)', boxShadow: 'inset 0 0 0 1px rgba(16,185,129,0.45)' }}>
              {successMsg}
            </p>
          )}

          {/* Pending GAME invites (separate from friend requests) */}
          <IncomingInvitesPanel user={user} />

          {/* Incoming */}
          <Section icon={Inbox} label="Gelen İstekler" badge={incoming.length}>
            {loading ? <RowSkeleton /> : incoming.length === 0 ? (
              <EmptyHint text="Şu an bekleyen istek yok." />
            ) : (
              <div className="space-y-2">
                {incoming.map((req) => (
                  <IncomingRequestItem
                    key={req.id}
                    request={req}
                    onAccept={handleAccept}
                    onReject={handleReject}
                  />
                ))}
              </div>
            )}
          </Section>

          {/* My Friends */}
          <Section icon={Users} label="Arkadaşlarım" badge={friends.length}>
            {loading ? <RowSkeleton /> : friends.length === 0 ? (
              <EmptyHint text="Henüz arkadaşın yok. Aşağıdan e-posta veya kullanıcı adı ile ekleyebilirsin." />
            ) : (
              <div className="space-y-2">
                {friends.map((f) => (
                  <FriendListItem
                    key={f.id}
                    friend={f}
                    presence={getPresenceForFriend(f)}
                    onRemove={handleRemove}
                  />
                ))}
              </div>
            )}
          </Section>

          {/* Add Friend */}
          <Section icon={UserPlus} label="Arkadaş Ekle">
            <AddFriendForm onSubmit={handleSend} />
          </Section>

          {/* Outgoing (only when present) */}
          {outgoing.length > 0 && (
            <Section icon={Send} label="Giden İstekler" badge={outgoing.length}>
              <div className="space-y-2">
                {outgoing.map((req) => (
                  <OutgoingRequestItem key={req.id} request={req} onCancel={handleCancel} />
                ))}
              </div>
            </Section>
          )}
        </div>
      </PullToRefresh>
    </PageShell>
  );
}

/* ---------------- helpers ---------------- */

function PageShell({ children }) {
  return (
    <div
      className="min-h-screen bg-background text-white"
      style={{
        paddingTop: 'calc(4rem + env(safe-area-inset-top))',
        paddingBottom: 'calc(5rem + env(safe-area-inset-bottom))',
        background:
          'radial-gradient(ellipse at 50% 12%, rgba(59,130,246,0.28), transparent 45%), radial-gradient(ellipse at 50% 92%, rgba(34,211,238,0.10), transparent 55%), linear-gradient(180deg, #050b1c 0%, #0a1738 55%, #03060f 100%)',
      }}
    >
      <div className="mx-auto w-full max-w-md px-4 space-y-5">
        {children}
      </div>
    </div>
  );
}

function Section({ icon: Icon, label, badge, children }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="h-3.5 w-3.5 text-amber-200/80" />}
          <p className="font-inter text-[10px] font-black uppercase tracking-[0.18em] text-blue-100/70">
            {label}
          </p>
        </div>
        {typeof badge !== 'undefined' && badge > 0 && (
          <span
            className="rounded-full px-2 py-0.5 font-inter text-[10px] font-black text-amber-200"
            style={{ background: 'rgba(250,204,21,0.10)', boxShadow: 'inset 0 0 0 1px rgba(250,204,21,0.35)' }}
          >
            {badge}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function EmptyHint({ text }) {
  return (
    <div
      className="rounded-2xl px-4 py-5 text-center"
      style={{
        background: 'linear-gradient(180deg, rgba(30,41,75,0.55), rgba(10,16,36,0.65))',
        boxShadow: 'inset 0 0 0 1px rgba(120,170,255,0.18)',
      }}
    >
      <p className="font-inter text-xs text-blue-100/65">{text}</p>
    </div>
  );
}

function RowSkeleton() {
  return (
    <div className="space-y-2">
      {[0, 1].map((i) => (
        <div
          key={i}
          className="h-14 rounded-2xl"
          style={{
            background: 'linear-gradient(90deg, rgba(255,255,255,0.04), rgba(255,255,255,0.08), rgba(255,255,255,0.04))',
            backgroundSize: '200% 100%',
            animation: 'kx-skeleton 1.2s linear infinite',
          }}
        />
      ))}
      <style>{`@keyframes kx-skeleton { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>
    </div>
  );
}

function CenteredLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="w-6 h-6 text-primary animate-spin" />
    </div>
  );
}