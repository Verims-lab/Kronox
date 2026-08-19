import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import OnlineChallengeScreen from '@/components/lobby/OnlineChallengeScreen';
import DirectOnlineMatchScreen from '@/components/online/DirectOnlineMatchScreen';
import { useAuth } from '@/lib/AuthContext';
import { createLobby, leaveLobby } from '@/lib/dbGateway/lobbyGateway';
import { setBottomNavHidden } from '@/lib/bottomNavVisibility';
import { isGuestOnboardingComplete } from '@/lib/guestProfile';
import { deriveDisplayName } from '@/lib/lobbyUtils';
import {
  acceptGameInvite,
  createGameInvites,
  isGameInviteExpired,
  isLobbyStale,
  rejectGameInvite,
} from '@/lib/inviteApi';
import { generateUniqueLobbyCode } from '@/lib/lobbyCodeGuard';
import { getSafeNotificationActorName } from '@/lib/notificationIdentity';
import { navigateToOnlineGame } from '@/lib/onlineGameNavigation';
import { loadSocialSnapshot } from '@/lib/onlinePlayerSelection';

function routeMatch(location) {
  const joined = location.state?.verifiedLobby || location.state?.joinedLobby || null;
  if (joined?.id && !isLobbyStale(joined)) {
    return { lobbyRef: joined.id, initialLobby: joined, source: 'accepted_invite' };
  }
  const lobbyRef = location.state?.lobbyId || '';
  return lobbyRef ? { lobbyRef, source: 'accepted_invite' } : null;
}

export default function OnlinePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, guestProfile, authChecked } = useAuth();
  const completedGuest = !user && isGuestOnboardingComplete(guestProfile) ? guestProfile : null;
  const actor = user || completedGuest;
  const playerName = user ? deriveDisplayName(user) : completedGuest?.username || 'Oyuncu';
  const initialMatch = useMemo(() => routeMatch(location), [location]);
  const [match, setMatch] = useState(initialMatch);
  const [creating, setCreating] = useState(false);
  const queryInviteId = useMemo(
    () => new URLSearchParams(location.search).get('inviteId') || '',
    [location.search],
  );
  const [deepLinkInvite, setDeepLinkInvite] = useState(null);
  const [deepLinkMessage, setDeepLinkMessage] = useState('');
  const [deepLinkBusy, setDeepLinkBusy] = useState(false);

  useLayoutEffect(() => {
    setBottomNavHidden(Boolean(match || queryInviteId));
    return () => setBottomNavHidden(false);
  }, [match, queryInviteId]);

  useEffect(() => {
    if (initialMatch?.lobbyRef) setMatch(initialMatch);
  }, [initialMatch]);

  const handleMatchFound = useCallback((nextMatch) => {
    if (!nextMatch?.lobbyRef) return;
    setMatch(nextMatch);
  }, []);

  const handleGameReady = useCallback((lobby, evidence) => {
    const moved = navigateToOnlineGame(navigate, lobby, {
      currentUser: actor,
      playerName,
      replace: true,
      handoffEvidence: evidence,
    });
    if (!moved) setMatch(null);
  }, [actor, navigate, playerName]);

  const handleCreateInviteMatch = useCallback(async ({ inviteTargets }) => {
    const selectedTargets = Array.isArray(inviteTargets) ? inviteTargets.slice(0, 1) : [];
    if (!selectedTargets.length || !actor) throw new Error('invite_target_required');
    setCreating(true);
    let created = null;
    try {
      const code = await generateUniqueLobbyCode();
      const response = await createLobby({ code, playerName, maxPlayers: 2 });
      created = response?.data?.lobby;
      if (!response?.data?.ok || !created?.id) throw new Error('match_create_failed');
      const summary = await createGameInvites({
        host: actor,
        lobby: created,
        inviteTargets: selectedTargets,
        playerCount: 2,
      });
      if (Number(summary?.created || 0) < 1) throw new Error('invite_create_failed');
      return created;
    } catch (error) {
      if (created?.id) await leaveLobby(created.id).catch(() => null);
      throw error;
    } finally {
      setCreating(false);
    }
  }, [actor, playerName]);

  useEffect(() => {
    if (!queryInviteId || !user?.email || match) return undefined;
    let cancelled = false;
    setDeepLinkMessage('Davet kontrol ediliyor...');
    setDeepLinkInvite(null);

    const loadInvite = async () => {
      try {
        const snapshot = await loadSocialSnapshot();
        const invite = (snapshot?.incomingGameInvites || []).find((row) => row?.id === queryInviteId) || null;
        if (cancelled) return;
        if (!invite || invite?.recipient_is_self !== true) {
          setDeepLinkMessage('Bu davet bulunamadı veya sana ait değil.');
          return;
        }
        if (invite.status === 'pending' && isGameInviteExpired(invite)) {
          setDeepLinkInvite({ ...invite, status: 'expired' });
          setDeepLinkMessage('Davetin süresi doldu. Yeni bir davet iste.');
          return;
        }
        if (invite.status === 'accepted') {
          const accepted = await acceptGameInvite(invite.id).catch(() => null);
          const joined = accepted?.verifiedLobby || accepted?.joinedLobby || accepted?.lobby || null;
          if (!cancelled && joined?.id && !isLobbyStale(joined)) {
            setMatch({ lobbyRef: joined.id, initialLobby: joined, source: 'accepted_invite' });
            navigate('/online', { replace: true, state: { joinedLobby: joined, verifiedLobby: joined } });
          }
          return;
        }
        setDeepLinkInvite(invite);
        setDeepLinkMessage(invite.status === 'pending' ? 'Davet hazır.' : 'Bu davet artık geçerli değil.');
      } catch {
        if (!cancelled) setDeepLinkMessage('Davet kontrol edilemedi. Lütfen tekrar dene.');
      }
    };

    void loadInvite();
    return () => { cancelled = true; };
  }, [match, navigate, queryInviteId, user?.email]);

  const handleDeepLinkAccept = async () => {
    if (!deepLinkInvite?.id || deepLinkBusy) return;
    setDeepLinkBusy(true);
    setDeepLinkMessage('');
    try {
      if (isGameInviteExpired(deepLinkInvite)) {
        setDeepLinkInvite({ ...deepLinkInvite, status: 'expired' });
        setDeepLinkMessage('Davetin süresi doldu. Yeni bir davet iste.');
        return;
      }
      const response = await acceptGameInvite(deepLinkInvite.id);
      const joined = response?.verifiedLobby || response?.joinedLobby || response?.lobby;
      if (!joined?.id || isLobbyStale(joined)) throw new Error('accepted_match_missing');
      setMatch({ lobbyRef: joined.id, initialLobby: joined, source: 'accepted_invite' });
      navigate('/online', { replace: true, state: { joinedLobby: joined, verifiedLobby: joined } });
    } catch {
      setDeepLinkMessage('Davet kabul edilemedi. Lütfen tekrar dene.');
    } finally {
      setDeepLinkBusy(false);
    }
  };

  const handleDeepLinkDecline = async () => {
    if (!deepLinkInvite?.id || deepLinkBusy) return;
    setDeepLinkBusy(true);
    try {
      await rejectGameInvite(deepLinkInvite.id);
      navigate('/online', { replace: true });
    } catch {
      setDeepLinkMessage('Davet reddedilemedi. Lütfen tekrar dene.');
    } finally {
      setDeepLinkBusy(false);
    }
  };

  if (match?.lobbyRef) {
    return (
      <DirectOnlineMatchScreen
        match={match}
        onGameReady={handleGameReady}
        onBack={() => { setMatch(null); navigate('/online', { replace: true }); }}
      />
    );
  }

  if (queryInviteId) {
    return (
      <DirectInvitePanel
        user={user}
        userChecked={authChecked}
        invite={deepLinkInvite}
        message={deepLinkMessage}
        busy={deepLinkBusy}
        onAccept={handleDeepLinkAccept}
        onDecline={handleDeepLinkDecline}
        onLogin={() => base44.auth.redirectToLogin(`/online?inviteId=${encodeURIComponent(queryInviteId)}`)}
        onBack={() => navigate('/online', { replace: true })}
      />
    );
  }

  return (
    <OnlineChallengeScreen
      user={user}
      guestProfile={completedGuest}
      loading={creating}
      onCreateInviteMatch={handleCreateInviteMatch}
      onMatchFound={handleMatchFound}
      onBackHome={() => navigate('/')}
      onGoFriends={() => navigate('/friends')}
    />
  );
}

function DirectInvitePanel({ user, userChecked, invite, message, busy, onAccept, onDecline, onLogin, onBack }) {
  const display = getSafeNotificationActorName(invite?.from_name, 'Bir arkadaşın');
  const isPending = invite?.status === 'pending';
  return (
    <div className="min-h-screen flex items-center justify-center px-5 text-white" style={{ background: '#050b1c' }}>
      <section className="w-full max-w-md rounded-2xl p-5 space-y-4" style={{ background: '#111d3d', boxShadow: 'inset 0 0 0 1px rgba(250,204,21,0.34)' }}>
        <header className="text-center space-y-1">
          <h1 className="font-cinzel text-xl font-black tracking-widest text-amber-200">Oyun Daveti</h1>
          <p className="font-inter text-sm text-blue-100/70">{display} seni Online Kapış'a davet etti.</p>
        </header>
        <p className="rounded-xl px-3 py-2 text-center font-inter text-xs text-blue-100/75" style={{ background: 'rgba(59,130,246,0.10)' }}>
          {!userChecked ? 'Oturum kontrol ediliyor...' : !user ? 'Devam etmek için giriş yapmalısın.' : message}
        </p>
        {!user ? (
          <button type="button" onClick={onLogin} disabled={!userChecked} className="w-full rounded-xl py-3 font-inter text-sm font-black text-amber-950 disabled:opacity-50" style={{ background: '#facc15' }}>Giriş Yap</button>
        ) : isPending ? (
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={onDecline} disabled={busy} className="rounded-xl py-3 font-inter text-sm font-black text-blue-100 disabled:opacity-50" style={{ background: 'rgba(148,163,184,0.12)' }}>Reddet</button>
            <button type="button" onClick={onAccept} disabled={busy} className="rounded-xl py-3 font-inter text-sm font-black text-amber-950 disabled:opacity-50" style={{ background: '#facc15' }}>{busy ? 'Katılıyor...' : 'Kabul Et'}</button>
          </div>
        ) : (
          <button type="button" onClick={onBack} className="w-full rounded-xl py-3 font-inter text-sm font-black text-blue-100" style={{ background: 'rgba(59,130,246,0.14)' }}>Online Ekranına Dön</button>
        )}
      </section>
    </div>
  );
}
