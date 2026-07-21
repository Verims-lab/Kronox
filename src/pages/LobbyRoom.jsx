import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import LobbyCreateJoinPanel from '@/components/lobby/LobbyCreateJoinPanel';
import OnlineChallengeScreen from '@/components/lobby/OnlineChallengeScreen';
import WaitingRoomPanel from '@/components/lobby/WaitingRoomPanel';
import { useLobbyRoomState } from '@/hooks/useLobbyRoomState';
import {
  canStartLobby,
  deriveDisplayName,
  isGuestHost,
  isHost,
  normalizeCode,
  summarizePlayers,
  validatePlayerName,
} from '@/lib/lobbyUtils';
import {
  acceptGameInvite,
  createGameInvites,
  getLobbyStaleDiagnostics,
  isGameInviteExpired,
  isLobbyStale,
  rejectGameInvite,
} from '@/lib/inviteApi';
import { loadActiveLobbyForUser } from '@/lib/activeLobby';
import { generateUniqueLobbyCode } from '@/lib/lobbyCodeGuard';
import {
  createLobby,
  joinLobbyByCode,
  leaveLobby,
} from '@/lib/dbGateway/lobbyGateway';
import { debugLog, debugWarn } from '@/lib/debugLog';
import { setBottomNavHidden } from '@/lib/bottomNavVisibility';
import { getSafeNotificationActorName } from '@/lib/notificationIdentity';
import { isGuestOnboardingComplete } from '@/lib/guestProfile';
import { loadSocialSnapshot } from '@/lib/onlinePlayerSelection';

export default function LobbyRoom() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user: authUser, guestProfile: authGuestProfile, authChecked } = useAuth();
  const initialJoinedLobby = useMemo(() => {
    const joined = location.state?.verifiedLobby || location.state?.joinedLobby;
    if (!joined?.id) return null;
    return isLobbyStale(joined) ? null : joined;
  }, [location.state]);
  const {
    user,
    mode,
    setMode,
    playerName,
    setPlayerName,
    joinCode,
    setJoinCode,
    lobby,
    setLobby,
    loading,
    setLoading,
    error,
    setError,
    nameError,
    setNameError,
    copied,
    setCopied,
    userChecked,
  } = useLobbyRoomState(initialJoinedLobby);
  const currentUser = authUser || user;
  const currentGuestProfile = !currentUser && isGuestOnboardingComplete(authGuestProfile) ? authGuestProfile : null;
  const currentActor = currentUser || currentGuestProfile;
  const currentUserChecked = Boolean(authChecked || userChecked);
  const queryInviteId = useMemo(
    () => new URLSearchParams(location.search).get('inviteId') || '',
    [location.search],
  );
  const [deepLinkInvite, setDeepLinkInvite] = useState(null);
  const [deepLinkMessage, setDeepLinkMessage] = useState('');
  const [deepLinkBusy, setDeepLinkBusy] = useState(false);
  const copiedTimerRef = useRef(null);

  // Codex131 — Active lobby auto-recovery. When the Online selection
  // screen is showing (no lobby, no deep-link), look up any pending
  // lobby the user already belongs to so we can surface an
  // "Aktif Lobi" return card without forcing them back into the
  // waiting room automatically.
  const [activeLobby, setActiveLobby] = useState(null);

  useEffect(() => {
    if (lobby || queryInviteId || !currentUser?.email) {
      setActiveLobby(null);
      return undefined;
    }
    let cancelled = false;
    loadActiveLobbyForUser(currentUser).then((found) => {
      if (!cancelled) setActiveLobby(found);
    });
    return () => { cancelled = true; };
  }, [currentUser?.email, lobby, queryInviteId]);

  const handleResumeActiveLobby = (target) => {
    if (!target) return;
    setActiveLobby(null);
    setLobby(target);
  };

  // Codex103 — BottomNav visibility within /lobby is state-aware:
  //   • mode=null + no lobby + no invite deep-link → Online seçim ekranı (VISIBLE)
  //   • mode=create / mode=join                    → lobi oluştur/katıl  (HIDDEN)
  //   • lobby present (waiting room)               → gerçek lobby        (HIDDEN)
  //   • invite deep-link present                   → davet akışı         (HIDDEN)
  // Other routes are unaffected — this signal only flips while /lobby is mounted.
  useLayoutEffect(() => {
    const isOnlineSelectionScreen =
      !lobby && !queryInviteId && (mode === null || mode === undefined);
    setBottomNavHidden(!isOnlineSelectionScreen);
  }, [mode, lobby, queryInviteId]);

  useEffect(() => {
    return () => setBottomNavHidden(false);
  }, []);

  useEffect(() => () => {
    if (copiedTimerRef.current) {
      window.clearTimeout(copiedTimerRef.current);
    }
  }, []);

  // Create signature: { maxPlayers, inviteTargets, invitedEmails }
  // forwarded by the OnlineChallengeScreen CTA (single-step lobby + invites).
  // playerName is derived from the authenticated user (no manual input).
  // For backwards-compat (e.g. if called with no payload), we fall back to playerName state.
  const handleCreate = async (payload = {}) => {
    const { maxPlayers, inviteTargets, invitedEmails } = payload || {};
    const derivedName = currentUser
      ? deriveDisplayName(currentUser)
      : (currentGuestProfile?.username || playerName || 'Oyuncu').trim();

    // Only validate when we have to (guest with no user). Authenticated users skip the regex
    // because their display name may legitimately contain spaces/punctuation we don't control.
    if (!currentUser && !currentGuestProfile) {
      const err = validatePlayerName(derivedName);
      if (err) {
        setNameError(err);
        throw new Error(err);
      }
    }

    setLoading(true);
    setError('');
    try {
      // Logical unique guard: query-before-create via findLobbyByCode lookup-only
      // mode so two lobbies never share the same live code.
      const code = await generateUniqueLobbyCode();
      // Codex591 — Online Kapışma no longer selects categories; startLobbyGame
      // always draws from the full active question bank.
      const lobbyPayload = { code, playerName: derivedName, maxPlayers };
      const createResponse = await createLobby(lobbyPayload);
      const newLobby = createResponse?.data?.lobby;
      if (!createResponse?.data?.ok || !newLobby?.id) {
        throw new Error(createResponse?.data?.error || 'Lobi oluşturulamadı.');
      }
      const targetCount = Array.isArray(inviteTargets) && inviteTargets.length
        ? inviteTargets.length
        : invitedEmails?.length || 0;
      debugLog('[LobbyRoom] created lobby:', { lobbyRef: newLobby.id, code: newLobby.code, status: newLobby.status, maxPlayers, invitedCount: targetCount });

      // Best-effort: create pending GameInvite rows for selected friends. A
      // partial failure does not abort lobby creation — the host can re-invite
      // later if any row failed. Errors surface via setError so the user knows.
      if ((Array.isArray(inviteTargets) && inviteTargets.length) || (Array.isArray(invitedEmails) && invitedEmails.length)) {
        try {
          const summary = await createGameInvites({
            host: currentActor,
            lobby: newLobby,
            toEmails: invitedEmails,
            inviteTargets,
            playerCount: maxPlayers,
          });
          debugLog('[LobbyRoom] invites created:', summary);
          if (summary.failed?.length) {
            setError(`${summary.failed.length} davet gönderilemedi. Lobi oluşturuldu, tekrar deneyebilirsin.`);
          }
        } catch (err) {
          debugWarn('[LobbyRoom] invite creation failed:', err?.message || err);
          setError('Davetler oluşturulamadı. Lobi yine de hazır.');
        }
      }

      return newLobby;
    } finally {
      setLoading(false);
    }
  };

  // Recipients accepting an invite land here with the joined lobby in route
  // state — hand it straight to the existing waiting-room render path.
  //
  // Codex130 — Stale lobby guard. If the joined lobby has been idle past
  // LOBBY_STALE_AFTER_MS (10 min) we DO NOT drop the user into the waiting
  // room; we surface a "Lobi süresi doldu" message instead so the user can
  // start a fresh challenge.
  useEffect(() => {
    const joined = location.state?.verifiedLobby || location.state?.joinedLobby;
    if (joined?.id && lobby?.id === joined.id) {
      debugLog('[LobbyRoom] route joined lobby used as initial authoritative lobby:', {
        lobbyId: joined.id,
        status: joined.status,
        playersCount: joined.players?.length || 0,
      });
      return;
    }
    if (joined && !lobby) {
      const staleDiagnostics = getLobbyStaleDiagnostics(joined);
      debugLog('[LobbyRoom] joined lobby stale check:', staleDiagnostics);
      if (isLobbyStale(joined)) {
        setError('Lobi süresi doldu. Yeni bir meydan okuma başlatabilirsin.');
        navigate('/lobby', { replace: true });
        return;
      }
      setLobby(joined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  useEffect(() => {
    if (!queryInviteId || !currentUser?.email || lobby) return undefined;
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
        if (invite.status === 'accepted' && invite.lobby_id) {
          const accepted = await acceptGameInvite(invite.id).catch(() => null);
          const acceptedLobby = accepted?.verifiedLobby || accepted?.joinedLobby || accepted?.lobby || null;
          if (!cancelled && acceptedLobby) {
            // Codex130 — Stale waiting lobby guard for deep-linked accepted invites.
            if (isLobbyStale(acceptedLobby)) {
              setDeepLinkInvite({ ...invite, status: 'expired' });
              setDeepLinkMessage('Lobi süresi doldu. Yeni bir meydan okuma başlatabilirsin.');
              return;
            }
            setLobby(acceptedLobby);
            navigate('/lobby', { replace: true, state: { joinedLobby: acceptedLobby } });
          }
          return;
        }
        setDeepLinkInvite(invite);
        setDeepLinkMessage(invite.status === 'pending'
          ? 'Davet hazır. Kabul edersen önce lobiye katılacaksın.'
          : `Bu davet artık ${invite.status}.`);
      } catch (err) {
        if (!cancelled) setDeepLinkMessage(err?.message || 'Davet kontrol edilemedi.');
      }
    };

    loadInvite();
    return () => { cancelled = true; };
  }, [currentUser?.email, lobby, navigate, queryInviteId, setLobby]);

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
      const res = await acceptGameInvite(deepLinkInvite.id);
      const verifiedLobby = res?.verifiedLobby || res?.joinedLobby || res?.lobby;
      if (verifiedLobby?.id) {
        setLobby(verifiedLobby);
        navigate('/lobby', { replace: true, state: { joinedLobby: verifiedLobby, verifiedLobby } });
      }
    } catch (err) {
      setDeepLinkMessage(err?.message || 'Davet kabul edilemedi.');
    } finally {
      setDeepLinkBusy(false);
    }
  };

  const handleDeepLinkDecline = async () => {
    if (!deepLinkInvite?.id || deepLinkBusy) return;
    setDeepLinkBusy(true);
    try {
      await rejectGameInvite(deepLinkInvite.id);
      setDeepLinkInvite({ ...deepLinkInvite, status: 'declined' });
      setDeepLinkMessage('Davet reddedildi.');
      navigate('/lobby', { replace: true });
    } catch (err) {
      setDeepLinkMessage(err?.message || 'Davet reddedilemedi.');
    } finally {
      setDeepLinkBusy(false);
    }
  };

  const handleJoin = async () => {
    const nameErr = validatePlayerName(playerName);
    if (nameErr) return setNameError(nameErr);
    const normalized = normalizeCode(joinCode);
    if (!normalized) return setError('Lobi kodu girin.');
    setLoading(true);
    setError('');

    debugLog('[LobbyRoom] join attempt rawCode:', JSON.stringify(joinCode), 'normalized:', normalized);

    try {
      const res = await joinLobbyByCode(normalized, playerName.trim());
      const result = res.data;

      debugLog('[LobbyRoom] join result:', JSON.stringify(result?.debug));
      debugLog('[LobbyRoom] join roster after backend append:', {
        lobbyId: result?.lobby?.id || null,
        existingPlayersCount: result?.debug?.existingPlayersCount ?? null,
        newPlayersCount: result?.lobby?.players?.length || 0,
        playerEmailsNames: summarizePlayers(result?.lobby?.players || []),
        updateSuccess: Boolean(result?.joined),
      });

      if (!result?.found) {
        setError('Lobi bulunamadı. Kod hatalı olabilir.');
        setLoading(false);
        return;
      }
      if (!result?.joinable) {
        setError('Bu lobi artık katılıma kapalı.');
        setLoading(false);
        return;
      }
      if (result?.error && !result?.joined) {
        setError('Lobi bulundu ama katılım başarısız oldu. Tekrar deneyin.');
        setLoading(false);
        return;
      }

      setLobby(result.lobby);
    } catch (e) {
      console.error('[LobbyRoom] handleJoin error:', e.message);
      setError('Katılım başarısız oldu: ' + e.message);
    }
    setLoading(false);
  };

  const handleLeave = async () => {
    if (!lobby) return;
    await leaveLobby(lobby.id);
    setLobby(null);
    setMode(null);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(lobby.code);
    setCopied(true);
    if (copiedTimerRef.current) {
      window.clearTimeout(copiedTimerRef.current);
    }
    copiedTimerRef.current = window.setTimeout(() => {
      setCopied(false);
      copiedTimerRef.current = null;
    }, 2000);
  };

  const lobbyIsHost = isHost(lobby, currentUser) || isGuestHost(lobby, currentGuestProfile, playerName);

  if (lobby) {
    return (
      <WaitingRoomPanel
        lobby={lobby}
        setLobby={setLobby}
        playerName={playerName}
        user={currentActor}
        isHost={lobbyIsHost}
        canStart={canStartLobby(lobby, currentActor, playerName)}
        onLeave={handleLeave}
        onCopyCode={handleCopyCode}
        copied={copied}
        navigate={navigate}
      />
    );
  }

  if (queryInviteId) {
    return (
      <DeepLinkedInvitePanel
        user={currentUser}
        userChecked={currentUserChecked}
        invite={deepLinkInvite}
        message={deepLinkMessage}
        busy={deepLinkBusy}
        onAccept={handleDeepLinkAccept}
        onDecline={handleDeepLinkDecline}
        onLogin={() => base44.auth.redirectToLogin(`/lobby?inviteId=${encodeURIComponent(queryInviteId)}`)}
        onBack={() => navigate('/lobby', { replace: true })}
      />
    );
  }

  // Codex591 — New online flow (no category selection):
  //   • mode === null  → OnlineChallengeScreen (Arkadaşını Davet Et / Rastgele
  //     Eşleş / kodla katıl). Both entry points route through the Pre-game
  //     Hourglass wait screen before landing in the real Lobby.
  //   • mode === 'join' → LobbyCreateJoinPanel ile kodla katıl ekranı.
  if (mode === 'join') {
    return (
      <LobbyCreateJoinPanel
        mode={mode}
        setMode={setMode}
        playerName={playerName}
        setPlayerName={setPlayerName}
        joinCode={joinCode}
        setJoinCode={setJoinCode}
        loading={loading}
        error={error}
        nameError={nameError}
        setNameError={setNameError}
        onCreate={handleCreate}
        onJoin={handleJoin}
        onBackHome={() => navigate('/')}
        onBackMode={() => {
          setMode(null);
          setError('');
        }}
        user={currentUser}
        onGoFriends={() => navigate('/friends')}
      />
    );
  }

  return (
    <OnlineChallengeScreen
      user={currentUser}
      guestProfile={currentGuestProfile}
      loading={loading}
      error={error}
      onCreateInviteLobby={({ inviteTargets }) => {
        // Codex591 — Online Kapışma: kategori seçimi yok, tek adımda lobi +
        // davet. maxPlayers = host + davet edilen oyuncular.
        const selectedTargets = Array.isArray(inviteTargets) ? inviteTargets : [];
        const maxPlayers = Math.min(4, Math.max(2, selectedTargets.length + 1));
        return handleCreate({ maxPlayers, inviteTargets: selectedTargets });
      }}
      onEnterLobby={(freshLobby) => setLobby(freshLobby)}
      onBackHome={() => navigate('/')}
      onJoinOpenLobby={() => setMode('join')}
      onGoFriends={() => navigate('/friends')}
      activeLobby={activeLobby}
      isActiveLobbyHost={Boolean(activeLobby?.current_actor_is_host)}
      onResumeActiveLobby={handleResumeActiveLobby}
    />
  );
}

function DeepLinkedInvitePanel({ user, userChecked, invite, message, busy, onAccept, onDecline, onLogin, onBack }) {
  const display = getSafeNotificationActorName(invite?.from_name, 'Bir arkadaşın');
  const isPending = invite?.status === 'pending';
  const isExpired = invite?.status === 'expired';
  return (
    <div
      className="min-h-screen flex items-center justify-center px-5 text-white"
      style={{
        paddingTop: 'calc(4rem + env(safe-area-inset-top))',
        paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))',
        background:
          'radial-gradient(ellipse at 50% 16%, rgba(59,130,246,0.34), transparent 42%), linear-gradient(180deg, #050b1c 0%, #0a1738 58%, #03060f 100%)',
      }}
    >
      <div
        className="w-full max-w-md rounded-3xl p-5 space-y-4"
        style={{
          background: 'linear-gradient(180deg, rgba(30,41,75,0.96), rgba(6,10,24,0.98))',
          boxShadow: 'inset 0 0 0 1.5px rgba(250,204,21,0.34), 0 18px 38px rgba(2,6,23,0.55)',
        }}
      >
        <div className="text-center space-y-1">
          <p className="font-cinzel text-xl font-black tracking-widest text-amber-200">Oyun Daveti</p>
          <p className="font-inter text-sm text-blue-100/70">
            {isExpired ? 'Bu davetin süresi dolmuş.' : `${display} seni Kronox oyununa davet etti.`}
          </p>
        </div>

        <p className="rounded-2xl px-3 py-2 text-center font-inter text-xs text-blue-100/75"
          style={{ background: 'rgba(59,130,246,0.10)', boxShadow: 'inset 0 0 0 1px rgba(96,165,250,0.22)' }}>
          {!userChecked ? 'Oturum kontrol ediliyor...' : !user ? 'Devam etmek için giriş yapmalısın.' : message}
        </p>

        {!user ? (
          <button type="button" onClick={onLogin} disabled={!userChecked}
            className="w-full rounded-2xl py-3 font-inter text-sm font-black text-amber-950 disabled:opacity-50"
            style={{ background: 'linear-gradient(180deg,#ffe066,#b97a06)' }}>
            Giriş Yap
          </button>
        ) : isPending ? (
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={onDecline} disabled={busy}
              className="rounded-2xl py-3 font-inter text-sm font-black text-blue-100 disabled:opacity-50"
              style={{ background: 'rgba(148,163,184,0.12)', boxShadow: 'inset 0 0 0 1px rgba(148,163,184,0.28)' }}>
              Reddet
            </button>
            <button type="button" onClick={onAccept} disabled={busy}
              className="rounded-2xl py-3 font-inter text-sm font-black text-amber-950 disabled:opacity-50"
              style={{ background: 'linear-gradient(180deg,#ffe066,#b97a06)' }}>
              {busy ? 'Katılıyor...' : 'Lobiye Katıl'}
            </button>
          </div>
        ) : (
          <button type="button" onClick={onBack}
            className="w-full rounded-2xl py-3 font-inter text-sm font-black text-blue-100"
            style={{ background: 'rgba(59,130,246,0.14)', boxShadow: 'inset 0 0 0 1px rgba(96,165,250,0.28)' }}>
            Online Ekranına Dön
          </button>
        )}
      </div>
    </div>
  );
}
