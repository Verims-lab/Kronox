import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Clock, Users, Plus, LogIn, ArrowLeft, Copy, Check, Loader2 } from 'lucide-react';
import LobbyChat from '@/components/lobby/LobbyChat';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars (0/O, 1/I)
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

const normalizeCode = (code) =>
  String(code || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[^\w]/g, '');

const summarizeLobbyPlayers = (players = []) =>
  players.map((p, index) => ({
    index,
    email: p?.email || null,
    name: p?.name || null,
    cardCount: Array.isArray(p?.cards) ? p.cards.length : 0,
  }));

export default function LobbyRoom() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [mode, setMode] = useState(null); // 'create' | 'join'
  const [playerName, setPlayerName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [lobby, setLobby] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [nameError, setNameError] = useState('');

  const validateName = (name) => {
    const trimmed = name.trim();
    if (trimmed.length < 3) return 'Lütfen en az 3 karakter girişi yapınız';
    if (trimmed.length > 15) return 'Lütfen en fazla 15 karakter girişi yapınız';
    if (!/^[a-zA-Z0-9çğıöşüÇĞİÖŞÜ]+$/.test(trimmed)) return 'Lütfen yalnızca harf ve rakam girişi yapınız';
    return '';
  };
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    base44.auth.me().then(u => {
      if (u) setUser(u);
    }).catch(() => {});
  }, []);

  // Subscription is handled inside WaitingRoom once lobby is set

  const handleCreate = async () => {
    const err = validateName(playerName);
    if (err) return setNameError(err);
    setLoading(true);
    setError('');
    const code = normalizeCode(generateCode());
    const me = user || { email: `guest_${Date.now()}@kronos.local`, full_name: playerName };
    const newLobby = await base44.entities.Lobby.create({
      code,
      host_email: me.email,
      host_name: playerName.trim(),
      players: [{ email: me.email, name: playerName.trim(), ready: true, cards: [] }],
      status: 'waiting',
      category: 'karisik',
      year_start: 1900,
      year_end: 2020,
      turn_duration: 60,
      win_card_count: 10,
    });
    console.log('[LobbyRoom] created lobby id:', newLobby.id, 'code:', newLobby.code, 'status:', newLobby.status, 'host:', newLobby.host_email);
    setLobby(newLobby);
    setLoading(false);
  };

  const handleJoin = async () => {
    const nameErr = validateName(playerName);
    if (nameErr) return setNameError(nameErr);
    const normalized = normalizeCode(joinCode);
    if (!normalized) return setError('Lobi kodu girin.');
    setLoading(true);
    setError('');

    console.log('[LobbyRoom] join attempt rawCode:', JSON.stringify(joinCode), 'normalized:', normalized);

    try {
      // Single backend call: find lobby by code AND append player atomically via service role.
      // Direct Lobby.filter() and Lobby.update() are both blocked by RLS for non-members.
      const res = await base44.functions.invoke('findLobbyByCode', {
        code: normalized,
        playerName: playerName.trim(),
      });
      const result = res.data;

      console.log('[LobbyRoom] join result:', JSON.stringify(result?.debug));
      console.log('[LobbyRoom] join roster after backend append:', {
        lobbyId: result?.lobby?.id || null,
        existingPlayersCount: result?.debug?.existingPlayersCount ?? null,
        newPlayersCount: result?.lobby?.players?.length || 0,
        playerEmailsNames: summarizeLobbyPlayers(result?.lobby?.players || []),
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
    const me = user || {};
    const isHost = lobby.host_email === me.email || lobby.players?.[0]?.name === (lobby.host_name || lobby.players?.[0]?.name);
    if (lobby.host_email === (user?.email || '')) {
      await base44.entities.Lobby.delete(lobby.id);
    } else {
      await base44.entities.Lobby.update(lobby.id, {
        players: lobby.players.filter(p => p.name !== playerName)
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

  const isHost = lobby && user && lobby.host_email === user.email;
  const isGuestHost = lobby && !user && lobby.players?.[0]?.name === playerName;
  const canStart = (isHost || isGuestHost) && lobby?.players?.length >= 2;

  if (lobby) {
    return <WaitingRoom
      lobby={lobby}
      setLobby={setLobby}
      playerName={playerName}
      user={user}
      isHost={isHost || isGuestHost}
      canStart={canStart}
      onLeave={handleLeave}
      onCopyCode={handleCopyCode}
      copied={copied}
      navigate={navigate}
    />;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6"
      style={{ paddingTop: 'calc(5rem + env(safe-area-inset-top))', paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}>
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 mx-auto border-2 border-primary/40 rounded-full flex items-center justify-center">
            <Clock className="w-7 h-7 text-primary" />
          </div>
          <h1 className="font-cinzel text-3xl font-bold text-primary tracking-wider">KRONOX</h1>
          <p className="font-inter text-muted-foreground text-sm">Çevrimiçi Lobi</p>
        </div>

        {!mode && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
            <Button onClick={() => setMode('create')} size="lg" className="w-full h-14 bg-primary text-primary-foreground font-cinzel tracking-wider gap-2">
              <Plus className="w-5 h-5" /> LOBİ OLUŞTUR
            </Button>
            <Button onClick={() => setMode('join')} size="lg" variant="outline" className="w-full h-14 font-cinzel tracking-wider gap-2">
              <LogIn className="w-5 h-5" /> LOBİYE KATIL
            </Button>
            <Button onClick={() => navigate('/')} variant="ghost" className="w-full gap-2 text-muted-foreground">
              <ArrowLeft className="w-4 h-4" /> Tek Oyuncuya Dön
            </Button>
          </motion.div>
        )}

        {mode && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="space-y-1">
              <Input
                placeholder="Oyuncu İsminiz"
                value={playerName}
                maxLength={15}
                onChange={e => { setPlayerName(e.target.value); setNameError(''); }}
                className={`h-12 bg-secondary/50 border-border/50 font-inter ${nameError ? 'border-destructive' : ''}`}
              />
              {nameError && <p className="font-inter text-xs text-destructive pl-1">{nameError}</p>}
            </div>
            {mode === 'join' && (
              <Input
                placeholder="Lobi Kodu (örn: ABC123)"
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase())}
                maxLength={6}
                className="h-12 bg-secondary/50 border-border/50 font-inter font-bold tracking-widest text-center text-lg uppercase"
              />
            )}
            {error && <p className="text-destructive text-sm font-inter text-center">{error}</p>}
            <Button
              onClick={mode === 'create' ? handleCreate : handleJoin}
              disabled={loading}
              size="lg"
              className="w-full h-12 bg-primary text-primary-foreground font-cinzel tracking-wider"
            >
              {loading ? 'Yükleniyor...' : mode === 'create' ? 'LOBİ OLUŞTUR' : 'KATIL'}
            </Button>
            <Button onClick={() => { setMode(null); setError(''); }} variant="ghost" className="w-full gap-2 text-muted-foreground">
              <ArrowLeft className="w-4 h-4" /> Geri
            </Button>
          </motion.div>
        )}
      </div>
    </div>
  );
}

function WaitingRoom({ lobby, setLobby, playerName, user, isHost, canStart, onLeave, onCopyCode, copied, navigate }) {
  const [startDebug, setStartDebug] = useState({
    subscribedLobbyId: lobby?.id || null,
    localLobbyStatus: lobby?.status || null,
    lastEventAt: null,
    lastEventStatus: null,
    lastEventLobbyId: null,
    shouldNavigateToGame: false,
    navigateCalled: false,
    currentPathname: window.location.pathname,
    currentUserEmail: user?.email || null,
    currentPlayerName: playerName || null,
    source: null,
    error: null,
  });

  const refreshLobby = useCallback(async () => {
    if (!lobby?.id) return;
    const fresh = await base44.entities.Lobby.get(lobby.id);
    if (fresh) setLobby(fresh);
  }, [lobby?.id, setLobby]);

  const { containerRef: waitingScrollRef, pullY, refreshing } = usePullToRefresh(refreshLobby);

  // Non-host: subscribe to lobby and navigate to /game when host starts
  const playerNameRef = useRef(playerName);
  const userRef = useRef(user);
  const hasNavigatedToGameRef = useRef(false);
  const rejoinAttemptRef = useRef(false);
  useEffect(() => { playerNameRef.current = playerName; }, [playerName]);
  useEffect(() => { userRef.current = user; }, [user]);

  useEffect(() => {
    setStartDebug(prev => ({
      ...prev,
      subscribedLobbyId: lobby?.id || null,
      localLobbyStatus: lobby?.status || null,
      currentPathname: window.location.pathname,
      currentUserEmail: user?.email || null,
      currentPlayerName: playerName || null,
    }));
  }, [lobby?.id, lobby?.status, user?.email, playerName]);

  useEffect(() => {
    console.log('[WaitingRoom] rendered roster:', {
      lobbyId: lobby?.id || null,
      subscriptionPlayersCount: lobby?.players?.length || 0,
      renderedPlayersCount: lobby?.players?.length || 0,
      renderedPlayerNames: (lobby?.players || []).map(p => p?.name),
      renderedPlayerEmails: (lobby?.players || []).map(p => p?.email),
      isHost,
    });
  }, [lobby?.id, lobby?.players, isHost]);

  const isDebugVisible = !isHost && (import.meta.env.DEV || user?.role === 'admin');

  const navigateToOnlineGame = useCallback((nextLobby, source) => {
    const targetLobbyId = nextLobby?.id || lobby?.id;
    if (!targetLobbyId || hasNavigatedToGameRef.current) return;

    hasNavigatedToGameRef.current = true;
    const nextDebug = {
      subscribedLobbyId: lobby?.id || null,
      localLobbyStatus: nextLobby?.status || lobby?.status || null,
      lastEventAt: new Date().toISOString(),
      lastEventStatus: nextLobby?.status || null,
      lastEventLobbyId: targetLobbyId,
      shouldNavigateToGame: true,
      navigateCalled: true,
      currentPathname: window.location.pathname,
      currentUserEmail: userRef.current?.email || null,
      currentPlayerName: playerNameRef.current || null,
      source,
      error: null,
    };
    console.log('[WaitingRoom] start debug:', nextDebug);
    setStartDebug(nextDebug);

    navigate('/game', {
      state: {
        lobbyId: targetLobbyId,
        online: true,
      }
    });
  }, [lobby?.id, lobby?.status, navigate]);

  useEffect(() => {
    if (!lobby?.id) return;

    const registrationDebug = {
      lobbyId: lobby.id,
      timestamp: new Date().toISOString(),
      playerName: playerNameRef.current,
      userEmail: userRef.current?.email || null,
    };
    console.log('[WaitingRoom] subscription registered:', registrationDebug);
    setStartDebug(prev => ({
      ...prev,
      subscribedLobbyId: lobby.id,
      localLobbyStatus: lobby.status,
      currentPathname: window.location.pathname,
      currentUserEmail: userRef.current?.email || null,
      currentPlayerName: playerNameRef.current || null,
      source: 'subscription-registered',
      error: null,
    }));

    const unsub = base44.entities.Lobby.subscribe((event) => {
      const eventType = event?.type || event?.eventType || 'update';
      const updatedLobby = event?.data || event;
      const receivedLobbyId = updatedLobby?.id || event?.id;
      const status = updatedLobby?.status;
      const playerCount = updatedLobby?.players?.length || 0;

      console.log('[WaitingRoom] subscription event:', {
        eventType,
        receivedLobbyId,
        status,
        playerCount,
        players: summarizeLobbyPlayers(updatedLobby?.players || []),
        current_question_id: updatedLobby?.current_question_id || null,
        current_player_index: updatedLobby?.current_player_index ?? null,
      });

      if (receivedLobbyId !== lobby.id) return;

      if (eventType === 'delete') {
        setLobby(null);
        return;
      }

      // Always update lobby state (player list, settings changes, etc.)
      setLobby(updatedLobby);

      const currentUser = userRef.current;
      const currentPlayerName = playerNameRef.current?.trim();

      // Determine host: by email (authenticated) or by being first player / host_name (guest)
      const hostEmail = updatedLobby?.host_email || '';
      const isAuthHost = currentUser?.email && currentUser.email === hostEmail;
      const isGuestHost = !currentUser?.email && (
        currentPlayerName === updatedLobby?.host_name ||
        currentPlayerName === updatedLobby?.players?.[0]?.name
      );
      const isCurrentUserHost = isAuthHost || isGuestHost;
      const shouldNavigate = !isCurrentUserHost && (status === 'starting' || status === 'in_game');

      const debugData = {
        subscribedLobbyId: lobby.id,
        localLobbyStatus: updatedLobby?.status || lobby.status || null,
        lastEventAt: new Date().toISOString(),
        lastEventStatus: status || null,
        lastEventLobbyId: receivedLobbyId || null,
        shouldNavigateToGame: shouldNavigate,
        navigateCalled: false,
        currentPathname: window.location.pathname,
        currentUserEmail: currentUser?.email || null,
        currentPlayerName,
        source: `subscription:${eventType}`,
        error: null,
      };

      console.log('[WaitingRoom] navigation decision:', {
        shouldNavigate,
        currentPathname: window.location.pathname,
        navigateCalled: false,
        status,
        isHost: isCurrentUserHost,
        playerName: currentPlayerName,
        userEmail: currentUser?.email || null,
        hostEmail,
      });
      console.log('[WaitingRoom] start debug:', debugData);
      setStartDebug(debugData);

      // Non-host navigates when game starts
      if (shouldNavigate) {
        navigateToOnlineGame(updatedLobby, 'subscription');
      }
    });

    return () => unsub();
  }, [lobby?.id, lobby?.status, navigateToOnlineGame, setLobby]);

  useEffect(() => {
    if (!lobby?.id || lobby.status !== 'waiting') return undefined;

    const intervalId = window.setInterval(async () => {
      if (hasNavigatedToGameRef.current) return;

      try {
        const fresh = await base44.entities.Lobby.get(lobby.id);
        if (!fresh) return;

        const currentPlayers = lobby.players || [];
        const freshPlayers = fresh.players || [];
        const rosterChanged =
          currentPlayers.length !== freshPlayers.length ||
          JSON.stringify(summarizeLobbyPlayers(currentPlayers)) !== JSON.stringify(summarizeLobbyPlayers(freshPlayers));

        console.log('[WaitingRoom] roster poll:', {
          lobbyId: lobby.id,
          rosterChanged,
          localPlayersCount: currentPlayers.length,
          fetchedPlayersCount: freshPlayers.length,
          fetchedPlayerNames: freshPlayers.map(p => p?.name),
          fetchedPlayerEmails: freshPlayers.map(p => p?.email),
        });

        if (rosterChanged) {
          setLobby(fresh);
        }
      } catch (err) {
        console.warn('[WaitingRoom] roster poll failed:', {
          lobbyId: lobby.id,
          error: err.message,
        });
      }
    }, 2000);

    return () => window.clearInterval(intervalId);
  }, [lobby?.id, lobby?.players, lobby.status, setLobby]);

  useEffect(() => {
    const currentEmail = user?.email;
    const currentName = playerName?.trim();
    const roster = lobby?.players || [];
    const isCurrentPlayerVisible = currentEmail
      ? roster.some(p => p?.email === currentEmail)
      : roster.some(p => p?.name === currentName);

    if (isCurrentPlayerVisible) {
      rejoinAttemptRef.current = false;
    }

    if (!lobby?.id || lobby.status !== 'waiting' || isCurrentPlayerVisible || rejoinAttemptRef.current) {
      return;
    }

    rejoinAttemptRef.current = true;
    console.warn('[WaitingRoom] current player missing from waiting roster, reasserting join:', {
      lobbyId: lobby.id,
      code: lobby.code,
      currentUserEmail: currentEmail || null,
      currentPlayerName: currentName || null,
      rosterCount: roster.length,
      roster: summarizeLobbyPlayers(roster),
    });

    base44.functions.invoke('findLobbyByCode', {
      code: lobby.code,
      playerName: currentName,
    }).then((res) => {
      const updatedLobby = res?.data?.lobby;
      console.log('[WaitingRoom] rejoin assertion result:', {
        lobbyId: updatedLobby?.id || lobby.id,
        joined: Boolean(res?.data?.joined),
        playersCount: updatedLobby?.players?.length || 0,
        players: summarizeLobbyPlayers(updatedLobby?.players || []),
      });
      if (updatedLobby) {
        const updatedRoster = updatedLobby.players || [];
        const isVisibleAfterRejoin = currentEmail
          ? updatedRoster.some(p => p?.email === currentEmail)
          : updatedRoster.some(p => p?.name === currentName);
        if (!isVisibleAfterRejoin) rejoinAttemptRef.current = false;
        setLobby(updatedLobby);
      }
    }).catch((err) => {
      console.warn('[WaitingRoom] rejoin assertion failed:', {
        lobbyId: lobby.id,
        error: err.message,
      });
      rejoinAttemptRef.current = false;
    });
  }, [lobby?.id, lobby?.status, lobby?.players, lobby?.code, playerName, user?.email, setLobby]);

  useEffect(() => {
    if (!lobby?.id || isHost) return undefined;

    const pollStartedAt = new Date().toISOString();
    console.log('[WaitingRoom] start fallback polling registered:', {
      lobbyId: lobby.id,
      timestamp: pollStartedAt,
      playerName: playerNameRef.current,
      userEmail: userRef.current?.email || null,
    });

    const intervalId = window.setInterval(async () => {
      if (hasNavigatedToGameRef.current) return;

      try {
        const fresh = await base44.entities.Lobby.get(lobby.id);
        const status = fresh?.status;
        const shouldNavigate = status === 'starting' || status === 'in_game';
        const pollDebug = {
          subscribedLobbyId: lobby.id,
          localLobbyStatus: fresh?.status || lobby.status || null,
          lastEventAt: new Date().toISOString(),
          lastEventStatus: status || null,
          lastEventLobbyId: fresh?.id || null,
          shouldNavigateToGame: shouldNavigate,
          navigateCalled: false,
          currentPathname: window.location.pathname,
          currentUserEmail: userRef.current?.email || null,
          currentPlayerName: playerNameRef.current || null,
          source: 'poll',
          error: null,
        };

        console.log('[WaitingRoom] start fallback poll:', pollDebug);
        setStartDebug(pollDebug);

        if (fresh) setLobby(fresh);
        if (shouldNavigate) navigateToOnlineGame(fresh, 'poll');
      } catch (err) {
        const pollErrorDebug = {
          subscribedLobbyId: lobby.id,
          localLobbyStatus: lobby.status || null,
          lastEventAt: new Date().toISOString(),
          lastEventStatus: null,
          lastEventLobbyId: null,
          shouldNavigateToGame: false,
          navigateCalled: false,
          currentPathname: window.location.pathname,
          currentUserEmail: userRef.current?.email || null,
          currentPlayerName: playerNameRef.current || null,
          source: 'poll',
          error: err.message,
        };
        console.log('[WaitingRoom] start fallback poll error:', pollErrorDebug);
        setStartDebug(pollErrorDebug);
      }
    }, 1500);

    return () => window.clearInterval(intervalId);
  }, [isHost, lobby?.id, lobby?.status, navigateToOnlineGame, setLobby]);

  // settings, lobby prop'undan türetilir — dışarıdan gelen güncellemeler (subscription) yansısın
  const [settings, setSettings] = useState({
    category: lobby.category,
    year_start: lobby.year_start,
    year_end: lobby.year_end,
    turn_duration: lobby.turn_duration,
    win_card_count: lobby.win_card_count,
  });

  // Lobby subscription'dan gelen değişiklikleri settings'e yansıt (host olmayan için)
  const prevLobbyId = useRef(lobby.id);
  useEffect(() => {
    if (lobby.id !== prevLobbyId.current) return; // farklı lobi — skip
    setSettings({
      category: lobby.category,
      year_start: lobby.year_start,
      year_end: lobby.year_end,
      turn_duration: lobby.turn_duration,
      win_card_count: lobby.win_card_count,
    });
  }, [lobby.category, lobby.year_start, lobby.year_end, lobby.turn_duration, lobby.win_card_count]);

  // DB yazma debounce — hızlı tıklamada flood önlenir
  const settingDebounceRef = useRef(null);

  const categories = [
    { value: 'karisik', label: 'Karışık' },
    { value: 'tarih', label: 'Tarih' },
    { value: 'bilim', label: 'Bilim' },
    { value: 'spor', label: 'Spor' },
    { value: 'sanat', label: 'Sanat' },
  ];

  const handleSettingChange = (key, value) => {
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    // Debounce: ardışık hızlı tıklamalarda tek DB yazma
    clearTimeout(settingDebounceRef.current);
    settingDebounceRef.current = setTimeout(() => {
      base44.entities.Lobby.update(lobby.id, { [key]: value }).catch(() => {});
    }, 300);
  };

  const handleStart = async () => {
    const latestLobby = await base44.entities.Lobby.get(lobby.id).catch((err) => {
      console.warn('[handleStart] latest lobby fetch failed, using local lobby:', err.message);
      return null;
    });
    const startLobby = latestLobby || lobby;
    const startPlayers = Array.isArray(startLobby.players) ? startLobby.players : [];

    console.log('[handleStart] latest roster before start:', {
      lobbyId: startLobby.id,
      localPlayersCount: lobby.players?.length || 0,
      fetchedPlayersCount: startPlayers.length,
      players: summarizeLobbyPlayers(startPlayers),
    });

    if (startPlayers.length < 2) {
      alert('Oyun başlatmak için en az 2 oyuncu gerekli');
      return;
    }

    // Soruları çek ve filtrele
    const allQuestions = await base44.entities.Question.list('-created_date', 200);
    const filtered = allQuestions
      .filter(q => q.type === 'metin')
      .filter(q => q.year >= settings.year_start && q.year <= settings.year_end)
      .filter(q => settings.category === 'karisik' || q.category === settings.category);
    
    if (filtered.length === 0) {
      alert('Soru bulunamadı');
      return;
    }

    // Fisher-Yates shuffle — sonsuz döngü riski yok
    const shuffled = [...filtered];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // Sırayla soru dağıt: her oyuncuya 2 kart + 1 aktif soru
    const neededCount = startPlayers.length * 2 + 1;
    if (shuffled.length < neededCount) {
      alert(`Yeterli soru yok. Gerekli: ${neededCount}, mevcut: ${shuffled.length}`);
      return;
    }

    let cursor = 0;
    const used = new Set();

    const playersWithCards = startPlayers.map(p => {
      const cards = [];
      for (let i = 0; i < 2; i++) {
        const q = shuffled[cursor++];
        cards.push({ id: q.id, year: q.year, question: q.question, type: q.type, media_url: q.media_url });
        used.add(q.id);
      }
      return { ...p, cards };
    });

    const firstQ = shuffled[cursor];
    used.add(firstQ.id);
    
    const updateData = {
      status: 'starting',
      current_question_id: firstQ.id,
      used_question_ids: [...used],
      current_player_index: 0,
      players: playersWithCards
    };

    console.log('[handleStart] lobbyId:', lobby.id, 'playerCount:', playersWithCards.length, 'status:', updateData.status, 'current_player_index:', updateData.current_player_index, 'current_question_id:', updateData.current_question_id, 'used_count:', updateData.used_question_ids.length, 'players:', playersWithCards.map(p => p.name));
    console.log('[handleStart] start payload roster:', {
      lobbyId: startLobby.id,
      playersCountUsedForGameStart: playersWithCards.length,
      playersWrittenToLobby: summarizeLobbyPlayers(playersWithCards),
      cardsInitializedForEachPlayer: playersWithCards.map(p => ({
        email: p.email,
        name: p.name,
        cardCount: p.cards?.length || 0,
      })),
    });

    await base44.entities.Lobby.update(startLobby.id, updateData);
    navigate('/game', {
      state: {
        lobbyId: startLobby.id,
        online: true,
      }
    });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center"
      style={{ paddingTop: 'calc(4rem + env(safe-area-inset-top))', paddingBottom: 'calc(4rem + env(safe-area-inset-bottom))' }}>
      <div
        ref={waitingScrollRef}
        className="w-full max-w-lg px-4 pb-4 space-y-4 flex-1 overflow-y-auto"
        style={{ overscrollBehavior: 'contain', transform: pullY > 0 ? `translateY(${pullY}px)` : undefined, transition: pullY === 0 ? 'transform 0.2s' : undefined }}
      >
        {refreshing && (
          <div className="flex justify-center py-1">
            <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
          </div>
        )}
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="font-cinzel text-xl text-primary tracking-widest">Lobi</h1>
          <button onClick={onLeave} className="text-xs font-inter text-muted-foreground hover:text-destructive transition-colors px-3 py-2 rounded min-h-[44px] min-w-[44px] flex items-center justify-center" aria-label="Lobiden ayrıl">
            Ayrıl
          </button>
        </div>

        {/* Lobby Code */}
        <div className="text-center space-y-1">
          <p className="font-inter text-xs text-muted-foreground">Lobi Kodu</p>
          <button onClick={onCopyCode} className="flex items-center gap-2 mx-auto bg-secondary/50 border border-border/50 rounded-xl px-6 py-3 hover:bg-secondary transition-all min-h-[44px] min-w-[44px] justify-center" aria-label="Lobi kodunu kopyala">
            <span className="font-cinzel text-2xl font-bold text-primary tracking-[0.3em]">{lobby.code}</span>
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
          </button>
          <p className="font-inter text-xs text-muted-foreground/60">Arkadaşlarına bu kodu ver</p>
        </div>

        {/* Players */}
        <div className="space-y-2">
          <p className="font-inter text-xs text-muted-foreground flex items-center gap-1">
            <Users className="w-3 h-3" /> Oyuncular ({lobby.players?.length || 0})
          </p>
          <div className="space-y-2">
            {(lobby.players || []).map((p, i) => (
              <motion.div
                key={p.email || i}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-3 bg-secondary/30 border border-border/30 rounded-xl px-4 py-3"
              >
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center font-cinzel text-primary font-bold text-sm">
                  {p.name?.[0]?.toUpperCase()}
                </div>
                <span className="font-inter text-foreground flex-1">{p.name}</span>
                {i === 0 && <span className="text-xs font-inter text-primary bg-primary/10 px-2 py-0.5 rounded-full">Host</span>}
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              </motion.div>
            ))}
          </div>
          {(lobby.players?.length || 0) < 2 && (
            <p className="font-inter text-xs text-muted-foreground/60 text-center">
              Oyun başlatmak için en az 2 oyuncu gerekli
            </p>
          )}
        </div>

        {/* Settings (host only) */}
        {isHost && (
          <div className="space-y-3 border border-border/30 rounded-xl p-4 bg-secondary/10">
            <p className="font-inter text-xs text-muted-foreground font-semibold uppercase tracking-wider">Oyun Ayarları</p>

            {/* Category */}
            <div className="space-y-1">
              <p className="font-inter text-xs text-muted-foreground">Kategori</p>
              <div className="flex flex-wrap gap-1.5">
                {categories.map(c => (
                  <button
                    key={c.value}
                    onClick={() => handleSettingChange('category', c.value)}
                    className={`px-3 py-1 rounded-lg border text-xs font-inter transition-all min-h-[44px] min-w-[44px] ${settings.category === c.value ? 'border-primary bg-primary/15 text-primary' : 'border-border/50 bg-secondary/30 text-muted-foreground'}`}
                    aria-label={`${c.label} kategorisini seç`}
                    aria-pressed={settings.category === c.value}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Year range */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <p className="font-inter text-xs text-muted-foreground">Başlangıç Yılı</p>
                <div className="flex items-center gap-1">
                  <button onClick={() => handleSettingChange('year_start', Math.max(0, settings.year_start - 10))} className="w-10 h-10 rounded-lg border border-border/50 bg-secondary/30 text-muted-foreground text-sm font-bold flex items-center justify-center min-h-[44px] min-w-[44px]" aria-label="Başlangıç yılını azalt">−</button>
                  <span className="flex-1 text-center font-cinzel text-sm font-bold text-foreground">{settings.year_start}</span>
                  <button onClick={() => handleSettingChange('year_start', Math.min(settings.year_end - 10, settings.year_start + 10))} className="w-10 h-10 rounded-lg border border-border/50 bg-secondary/30 text-muted-foreground text-sm font-bold flex items-center justify-center min-h-[44px] min-w-[44px]" aria-label="Başlangıç yılını arttır">+</button>
                </div>
              </div>
              <div className="space-y-1">
                <p className="font-inter text-xs text-muted-foreground">Bitiş Yılı</p>
                <div className="flex items-center gap-1">
                  <button onClick={() => handleSettingChange('year_end', Math.max(settings.year_start + 10, settings.year_end - 10))} className="w-10 h-10 rounded-lg border border-border/50 bg-secondary/30 text-muted-foreground text-sm font-bold flex items-center justify-center min-h-[44px] min-w-[44px]" aria-label="Bitiş yılını azalt">−</button>
                  <span className="flex-1 text-center font-cinzel text-sm font-bold text-foreground">{settings.year_end}</span>
                  <button onClick={() => handleSettingChange('year_end', Math.min(new Date().getFullYear(), settings.year_end + 10))} className="w-10 h-10 rounded-lg border border-border/50 bg-secondary/30 text-muted-foreground text-sm font-bold flex items-center justify-center min-h-[44px] min-w-[44px]" aria-label="Bitiş yılını arttır">+</button>
                </div>
              </div>
            </div>

            {/* Turn duration */}
            <div className="space-y-1">
              <p className="font-inter text-xs text-muted-foreground">Tur Süresi</p>
              <div className="flex gap-2">
                {[30, 60, 90, 120].map(s => (
                  <button
                    key={s}
                    onClick={() => handleSettingChange('turn_duration', s)}
                    className={`flex-1 py-1.5 rounded-lg border text-xs font-cinzel font-bold transition-all min-h-[44px] min-w-[44px] ${settings.turn_duration === s ? 'border-primary bg-primary/15 text-primary' : 'border-border/50 bg-secondary/30 text-muted-foreground'}`}
                    aria-label={`${s} saniye tur süresi seç`}
                    aria-pressed={settings.turn_duration === s}
                  >
                    {s}s
                  </button>
                ))}
              </div>
            </div>

            {/* Win cards */}
            <div className="space-y-1">
              <p className="font-inter text-xs text-muted-foreground">Kazanmak için kart sayısı</p>
              <div className="flex gap-2">
                {[5, 7, 10, 15].map(n => (
                  <button
                    key={n}
                    onClick={() => handleSettingChange('win_card_count', n)}
                    className={`flex-1 py-1.5 rounded-lg border text-xs font-cinzel font-bold transition-all min-h-[44px] min-w-[44px] ${settings.win_card_count === n ? 'border-primary bg-primary/15 text-primary' : 'border-border/50 bg-secondary/30 text-muted-foreground'}`}
                    aria-label={`${n} kart ile kazanmak için seç`}
                    aria-pressed={settings.win_card_count === n}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Non-host sees settings read-only */}
        {!isHost && (
          <div className="border border-border/30 rounded-xl p-4 bg-secondary/10 space-y-2">
            <p className="font-inter text-xs text-muted-foreground font-semibold uppercase tracking-wider">Oyun Ayarları</p>
            <div className="grid grid-cols-2 gap-2 text-xs font-inter text-muted-foreground">
              <span>Kategori: <span className="text-foreground">{lobby.category}</span></span>
              <span>Tur süresi: <span className="text-foreground">{lobby.turn_duration}s</span></span>
              <span>Yıllar: <span className="text-foreground">{lobby.year_start}–{lobby.year_end}</span></span>
              <span>Kazanma: <span className="text-foreground">{lobby.win_card_count} kart</span></span>
            </div>
            <p className="font-inter text-xs text-muted-foreground/60 text-center mt-2">Host oyunu başlatmasını bekliyor...</p>
          </div>
        )}

        {isDebugVisible && (
          <div className="border border-yellow-500/40 bg-yellow-500/10 rounded-lg p-3 space-y-2">
            <p className="font-inter text-[11px] text-yellow-300 font-semibold uppercase tracking-wider">Online Start Debug</p>
            <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-[10px] text-yellow-100 break-all">
              <span className="text-yellow-300/80">subscribed lobby id</span><span>{startDebug.subscribedLobbyId || 'null'}</span>
              <span className="text-yellow-300/80">local lobby status</span><span>{startDebug.localLobbyStatus || 'null'}</span>
              <span className="text-yellow-300/80">last event at</span><span>{startDebug.lastEventAt || 'null'}</span>
              <span className="text-yellow-300/80">last event status</span><span>{startDebug.lastEventStatus || 'null'}</span>
              <span className="text-yellow-300/80">last event lobby id</span><span>{startDebug.lastEventLobbyId || 'null'}</span>
              <span className="text-yellow-300/80">shouldNavigateToGame</span><span>{String(startDebug.shouldNavigateToGame)}</span>
              <span className="text-yellow-300/80">navigate called</span><span>{String(startDebug.navigateCalled)}</span>
              <span className="text-yellow-300/80">current pathname</span><span>{startDebug.currentPathname || 'null'}</span>
              <span className="text-yellow-300/80">current user email</span><span>{startDebug.currentUserEmail || 'null'}</span>
              <span className="text-yellow-300/80">current player name</span><span>{startDebug.currentPlayerName || 'null'}</span>
              <span className="text-yellow-300/80">source</span><span>{startDebug.source || 'null'}</span>
              <span className="text-yellow-300/80">error</span><span>{startDebug.error || 'null'}</span>
            </div>
          </div>
        )}

        {/* Chat */}
        <LobbyChat lobbyId={lobby.id} playerName={playerName} />
      </div>

      {/* Start button (host only) */}
      {isHost && (
        <div className="w-full max-w-lg px-4 pt-2" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
          <Button
            onClick={handleStart}
            disabled={!canStart}
            size="lg"
            className="w-full h-12 bg-primary text-primary-foreground font-cinzel tracking-wider disabled:opacity-30"
          >
            OYUNU BAŞLAT ({lobby.players?.length || 0} oyuncu)
          </Button>
        </div>
      )}
    </div>
  );
}
