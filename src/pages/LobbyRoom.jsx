import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import LobbyCreateJoinPanel from '@/components/lobby/LobbyCreateJoinPanel';
import OnlineChallengeScreen from '@/components/lobby/OnlineChallengeScreen';
import WaitingRoomPanel from '@/components/lobby/WaitingRoomPanel';
import { useLobbyRoomState } from '@/hooks/useLobbyRoomState';
import {
  buildPlayerPayload,
  canStartLobby,
  deriveDisplayName,
  generateCode,
  isGuestHost,
  isHost,
  normalizeCode,
  removePlayerByIdentity,
  summarizePlayers,
  validatePlayerName,
} from '@/lib/lobbyUtils';
import {
  acceptGameInvite,
  createGameInvites,
  getLobbyStaleDiagnostics,
  isGameInviteExpired,
  isLobbyStale,
  LOBBY_STALE_AFTER_MS,
  rejectGameInvite,
} from '@/lib/inviteApi';
import { loadActiveLobbyForUser } from '@/lib/activeLobby';
import { debugLog, debugWarn } from '@/lib/debugLog';
import { setBottomNavHidden } from '@/lib/bottomNavVisibility';

export default function LobbyRoom() {
  const navigate = useNavigate();
  const location = useLocation();
  const initialJoinedLobby = useMemo(() => {
    const joined = location.state?.joinedLobby;
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
  const queryInviteId = useMemo(
    () => new URLSearchParams(location.search).get('inviteId') || '',
    [location.search],
  );
  const [deepLinkInvite, setDeepLinkInvite] = useState(null);
  const [deepLinkMessage, setDeepLinkMessage] = useState('');
  const [deepLinkBusy, setDeepLinkBusy] = useState(false);

  // Codex131 — Active lobby auto-recovery. When the Online selection
  // screen is showing (no lobby, no deep-link), look up any pending
  // lobby the user already belongs to so we can surface an
  // "Aktif Lobi" return card without forcing them back into the
  // waiting room automatically.
  const [activeLobby, setActiveLobby] = useState(null);

  useEffect(() => {
    if (lobby || queryInviteId || !user?.email) {
      setActiveLobby(null);
      return undefined;
    }
    let cancelled = false;
    loadActiveLobbyForUser(user).then((found) => {
      if (!cancelled) setActiveLobby(found);
    });
    return () => { cancelled = true; };
  }, [user?.email, lobby, queryInviteId]);

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

  // Create signature: { maxPlayers, invitedEmails, selectedCategories }
  // forwarded by the OnlineChallengeScreen CTA (single-step lobby + invites).
  // playerName is derived from the authenticated user (no manual input).
  // For backwards-compat (e.g. if called with no payload), we fall back to playerName state.
  const handleCreate = async (payload = {}) => {
    const { maxPlayers, invitedEmails, selectedCategories } = payload || {};
    const derivedName = user
      ? deriveDisplayName(user)
      : (playerName && playerName.trim()) || '';

    // Only validate when we have to (guest with no user). Authenticated users skip the regex
    // because their display name may legitimately contain spaces/punctuation we don't control.
    if (!user) {
      const err = validatePlayerName(derivedName);
      if (err) return setNameError(err);
    }

    setLoading(true);
    setError('');
    const code = normalizeCode(generateCode());
    const { identity, player } = buildPlayerPayload(user, derivedName);
    const createdAt = new Date();

    const lobbyPayload = {
      code,
      host_email: identity.email,
      host_name: derivedName,
      players: [player],
      status: 'waiting',
      category: 'karisik',
      year_start: 1900,
      year_end: 2020,
      turn_duration: 60,
      win_card_count: 10,
      created_at: createdAt.toISOString(),
      last_activity_at: createdAt.toISOString(),
      expires_at: new Date(createdAt.getTime() + LOBBY_STALE_AFTER_MS).toISOString(),
    };
    // Optional metadata — inert; authority logic does not read these yet.
    if (typeof maxPlayers === 'number') lobbyPayload.max_players = maxPlayers;
    if (Array.isArray(invitedEmails) && invitedEmails.length) {
      lobbyPayload.invited_emails = invitedEmails;
    }
    // Codex091 — persist Online category multi-select on the Lobby so
    // startLobbyGame can filter the question pool by category_ids. Stored
    // as a stable top-level field (not nested under settings) to stay
    // compatible with the existing flat Lobby shape.
    // Fallback: if nothing was forwarded (old code path / direct call),
    // leave the field absent → startLobbyGame falls back to single-category
    // behavior (lobby.category) just like old lobbies do.
    if (Array.isArray(selectedCategories) && selectedCategories.length > 0) {
      lobbyPayload.selected_category_ids = [...selectedCategories];
    }

    const newLobby = await base44.entities.Lobby.create(lobbyPayload);
    debugLog('[LobbyRoom] created lobby id:', newLobby.id, 'code:', newLobby.code, 'status:', newLobby.status, 'host:', newLobby.host_email, 'maxPlayers:', maxPlayers, 'invitedCount:', invitedEmails?.length || 0);

    // Best-effort: create pending GameInvite rows for selected friends. A
    // partial failure does not abort lobby creation — the host can re-invite
    // later if any row failed. Errors surface via setError so the user knows.
    if (Array.isArray(invitedEmails) && invitedEmails.length) {
      try {
        const summary = await createGameInvites({
          host: user,
          lobby: newLobby,
          toEmails: invitedEmails,
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

    setLobby(newLobby);
    setLoading(false);
  };

  // Recipients accepting an invite land here with the joined lobby in route
  // state — hand it straight to the existing waiting-room render path.
  //
  // Codex130 — Stale lobby guard. If the joined lobby has been idle past
  // LOBBY_STALE_AFTER_MS (10 min) we DO NOT drop the user into the waiting
  // room; we surface a "Lobi süresi doldu" message instead so the user can
  // start a fresh challenge.
  useEffect(() => {
    const joined = location.state?.joinedLobby;
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
    if (!queryInviteId || !user?.email || lobby) return undefined;
    let cancelled = false;
    setDeepLinkMessage('Davet kontrol ediliyor...');
    setDeepLinkInvite(null);

    const loadInvite = async () => {
      try {
        const invite = await base44.entities.GameInvite.get(queryInviteId);
        if (cancelled) return;
        const myEmail = String(user.email || '').toLowerCase();
        const toEmail = String(invite?.to_email || '').toLowerCase();
        if (!invite || toEmail !== myEmail) {
          setDeepLinkMessage('Bu davet bulunamadı veya sana ait değil.');
          return;
        }
        if (invite.status === 'pending' && isGameInviteExpired(invite)) {
          await base44.entities.GameInvite.update(invite.id, {
            status: 'expired',
            expired_at: new Date().toISOString(),
          }).catch(() => null);
          setDeepLinkInvite({ ...invite, status: 'expired' });
          setDeepLinkMessage('Davetin süresi doldu. Yeni bir davet iste.');
          return;
        }
        if (invite.status === 'accepted' && invite.lobby_id) {
          const acceptedLobby = await base44.entities.Lobby.get(invite.lobby_id).catch(() => null);
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
  }, [lobby, navigate, queryInviteId, setLobby, user?.email]);

  const handleDeepLinkAccept = async () => {
    if (!deepLinkInvite?.id || deepLinkBusy) return;
    setDeepLinkBusy(true);
    setDeepLinkMessage('');
    try {
      if (isGameInviteExpired(deepLinkInvite)) {
        await base44.entities.GameInvite.update(deepLinkInvite.id, {
          status: 'expired',
          expired_at: new Date().toISOString(),
        }).catch(() => null);
        setDeepLinkInvite({ ...deepLinkInvite, status: 'expired' });
        setDeepLinkMessage('Davetin süresi doldu. Yeni bir davet iste.');
        return;
      }
      const res = await acceptGameInvite(deepLinkInvite.id);
      if (res?.lobby?.id) {
        setLobby(res.lobby);
        navigate('/lobby', { replace: true, state: { joinedLobby: res.lobby } });
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
      const res = await base44.functions.invoke('findLobbyByCode', {
        code: normalized,
        playerName: playerName.trim(),
      });
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
    const lobbyIsHost = isHost(lobby, user) || isGuestHost(lobby, user, playerName);
    if (lobbyIsHost) {
      await base44.entities.Lobby.delete(lobby.id);
    } else {
      await base44.entities.Lobby.update(lobby.id, {
        players: removePlayerByIdentity(lobby.players, {
          email: user?.email,
          name: playerName,
        })
      });
    }
    setLobby(null);
    setMode(null);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(lobby.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const lobbyIsHost = isHost(lobby, user) || isGuestHost(lobby, user, playerName);

  if (lobby) {
    return (
      <WaitingRoomPanel
        lobby={lobby}
        setLobby={setLobby}
        playerName={playerName}
        user={user}
        isHost={lobbyIsHost}
        canStart={canStartLobby(lobby, user, playerName)}
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
        user={user}
        userChecked={userChecked}
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

  // Codex127 — New online flow:
  //   • mode === null  → OnlineChallengeScreen (kategori + arkadaş popup + CTA).
  //     Tek bir CTA ile lobi oluşturma + davet gönderme yapılır. Eski ayrı
  //     arkadaş seçim ekranı akıştan çıkarıldı (legacy panel dosyası kalır,
  //     ama burada referans verilmez).
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
        user={user}
        onGoFriends={() => navigate('/friends')}
      />
    );
  }

  return (
    <OnlineChallengeScreen
      user={user}
      loading={loading}
      error={error}
      onStartChallenge={({ selectedCategories, selectedEmails }) => {
        // Codex127 — Tek adımda lobi + davet. maxPlayers = host + invited.
        const invitedEmails = Array.isArray(selectedEmails) ? selectedEmails : [];
        const maxPlayers = Math.min(4, Math.max(2, invitedEmails.length + 1));
        handleCreate({
          maxPlayers,
          invitedEmails,
          selectedCategories,
        });
      }}
      onBackHome={() => navigate('/')}
      onJoinOpenLobby={() => setMode('join')}
      onGoFriends={() => navigate('/friends')}
      activeLobby={activeLobby}
      isActiveLobbyHost={Boolean(activeLobby && user && activeLobby.host_email === user.email)}
      onResumeActiveLobby={handleResumeActiveLobby}
    />
  );
}

function DeepLinkedInvitePanel({ user, userChecked, invite, message, busy, onAccept, onDecline, onLogin, onBack }) {
  const display = invite?.from_name?.trim() || invite?.from_email || 'Bir arkadaşın';
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
