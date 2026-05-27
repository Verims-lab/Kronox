import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import LobbyCreateJoinPanel from '@/components/lobby/LobbyCreateJoinPanel';
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
import { createGameInvites } from '@/lib/inviteApi';
import { debugLog, debugWarn } from '@/lib/debugLog';

export default function LobbyRoom() {
  const navigate = useNavigate();
  const location = useLocation();
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
  } = useLobbyRoomState();

  // New create signature: { maxPlayers, invitedEmails, selectedCategories }
  // from CreateLobbyInvitePanel.
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
  useEffect(() => {
    const joined = location.state?.joinedLobby;
    if (joined && !lobby) {
      setLobby(joined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

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