import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Clock, Users, Plus, LogIn, ArrowLeft, Copy, Check } from 'lucide-react';

function generateCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export default function LobbyRoom() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [mode, setMode] = useState(null); // 'create' | 'join'
  const [playerName, setPlayerName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [lobby, setLobby] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const unsubRef = useRef(null);

  useEffect(() => {
    base44.auth.me().then(u => {
      if (u) setUser(u);
    }).catch(() => {});
  }, []);

  // Subscribe to lobby changes
  useEffect(() => {
    if (!lobby?.id) return;
    
    const unsub = base44.entities.Lobby.subscribe((event) => {
      if (event.id !== lobby.id) return;
      
      if (event.type === 'delete') {
        setLobby(null);
        setMode(null);
        setError('Lobi kapatıldı.');
        return;
      }
      
      setLobby(event.data);
      
      // If host started the game — only non-hosts navigate via subscription
      // Host navigates directly in handleStart with playersWithCards
      const isCurrentUserHost = event.data.host_email === (user?.email || '');
      const isGuestCurrentHost = !user && event.data.players?.[0]?.name === playerName.trim();
      if (event.data.status === 'starting' && !isCurrentUserHost && !isGuestCurrentHost) {
        navigate('/game', {
          state: {
            playerNames: event.data.players.map(p => p.name),
            initialPlayers: event.data.players,
            category: event.data.category,
            yearStart: event.data.year_start,
            yearEnd: event.data.year_end,
            turnDuration: event.data.turn_duration,
            winCardCount: event.data.win_card_count,
            lobbyId: event.data.id,
            myPlayerName: playerName.trim(),
          }
        });
      }
    });
    
    unsubRef.current = unsub;
    return () => {
      if (unsubRef.current) unsubRef.current();
    };
  }, [lobby?.id, playerName, navigate]);

  const handleCreate = async () => {
    if (!playerName.trim()) return setError('İsim girin.');
    setLoading(true);
    setError('');
    const code = generateCode();
    const me = user || { email: `guest_${Date.now()}@kronos.local`, full_name: playerName };
    const newLobby = await base44.entities.Lobby.create({
      code,
      host_email: me.email,
      host_name: playerName.trim(),
      players: [{ email: me.email, name: playerName.trim(), ready: true }],
      status: 'waiting',
      category: 'karisik',
      year_start: 1900,
      year_end: 2020,
      turn_duration: 60,
      win_card_count: 10,
    });
    setLobby(newLobby);
    setLoading(false);
  };

  const handleJoin = async () => {
    if (!playerName.trim()) return setError('İsim girin.');
    if (!joinCode.trim()) return setError('Lobi kodu girin.');
    setLoading(true);
    setError('');
    const results = await base44.entities.Lobby.filter({ code: joinCode.trim().toUpperCase(), status: 'waiting' });
    if (!results || results.length === 0) {
      setError('Lobi bulunamadı veya zaten başladı.');
      setLoading(false);
      return;
    }
    const found = results[0];
    const me = user || { email: `guest_${Date.now()}@kronos.local`, full_name: playerName };
    const alreadyIn = found.players?.some(p => p.email === me.email);
    if (!alreadyIn) {
      const updated = await base44.entities.Lobby.update(found.id, {
        players: [...(found.players || []), { email: me.email, name: playerName.trim(), ready: true }]
      });
      setLobby(updated);
    } else {
      setLobby(found);
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
      style={{ paddingTop: 'calc(1.5rem + env(safe-area-inset-top))', paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}>
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 mx-auto border-2 border-primary/40 rounded-full flex items-center justify-center">
            <Clock className="w-7 h-7 text-primary" />
          </div>
          <h1 className="font-cinzel text-3xl font-bold text-primary tracking-wider">KRONOS</h1>
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
            <Input
              placeholder="Oyuncu İsminiz"
              value={playerName}
              onChange={e => setPlayerName(e.target.value)}
              className="h-12 bg-secondary/50 border-border/50 font-inter"
            />
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
  const [settings, setSettings] = useState({
    category: lobby.category,
    year_start: lobby.year_start,
    year_end: lobby.year_end,
    turn_duration: lobby.turn_duration,
    win_card_count: lobby.win_card_count,
  });

  const categories = [
    { value: 'karisik', label: 'Karışık' },
    { value: 'tarih', label: 'Tarih' },
    { value: 'bilim', label: 'Bilim' },
    { value: 'spor', label: 'Spor' },
    { value: 'sanat', label: 'Sanat' },
  ];

  const handleSettingChange = async (key, value) => {
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    await base44.entities.Lobby.update(lobby.id, { [key]: value });
  };

  const handleStart = async () => {
    // Pick first question
    const allQuestions = await base44.entities.Question.list('-created_date', 200);
    console.log('[LobbyRoom] handleStart - Total questions loaded:', allQuestions.length);
    
    const filtered = allQuestions
      .filter(q => q.type === 'metin')
      .filter(q => q.year >= settings.year_start && q.year <= settings.year_end)
      .filter(q => settings.category === 'karisik' || q.category === settings.category);
    
    console.log('[LobbyRoom] Filtered questions:', filtered.length);
    
    if (filtered.length === 0) {
      alert('Soru bulunamadı');
      return;
    }
    
    // Deal 2 cards to each player
    const used = new Set();
    const playersWithCards = lobby.players.map(p => {
      const cards = [];
      for (let i = 0; i < 2; i++) {
        let q;
        do {
          q = filtered[Math.floor(Math.random() * filtered.length)];
        } while (used.has(q.id) && used.size < filtered.length);
        
        if (!used.has(q.id)) {
          cards.push({ id: q.id, year: q.year, question: q.question, type: q.type, media_url: q.media_url });
          used.add(q.id);
        }
      }
      return { ...p, cards };
    });
    
    const available = filtered.filter(q => !used.has(q.id));
    const firstQ = available[Math.floor(Math.random() * available.length)];
    used.add(firstQ.id);
    
    console.log('[LobbyRoom] Selected first question:', firstQ.id, firstQ.question);
    
    const updateData = { 
      status: 'starting',
      current_question_id: firstQ.id,
      used_question_ids: [...used],
      current_player_index: 0,
      players: playersWithCards
    };
    console.log('[LobbyRoom] Updating lobby with:', { 
      cards_per_player: 2, 
      total_players: playersWithCards.length,
      first_player_cards: playersWithCards[0]?.cards?.map(c => ({ id: c.id, year: c.year })) || []
    });
    
    const updatedLobby = await base44.entities.Lobby.update(lobby.id, updateData);
    console.log('[LobbyRoom] Lobby updated response:', {
      players: updatedLobby.players?.length,
      first_player_cards_from_response: updatedLobby.players?.[0]?.cards?.map(c => ({ id: c.id, year: c.year })) || []
    });
    
    // Navigate immediately with playersWithCards
    console.log('[LobbyRoom] Navigating to /game with initialPlayers:', playersWithCards.map(p => ({ name: p.name, cards: p.cards?.length || 0 })));
    navigate('/game', {
      state: {
        playerNames: playersWithCards.map(p => p.name),
        initialPlayers: playersWithCards,
        category: settings.category,
        yearStart: settings.year_start,
        yearEnd: settings.year_end,
        turnDuration: settings.turn_duration,
        winCardCount: settings.win_card_count,
        lobbyId: lobby.id,
        myPlayerName: playerName.trim(),
      }
    });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center"
      style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top))', paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
      <div className="w-full max-w-lg px-4 pb-4 space-y-4 flex-1 overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={onLeave} className="text-muted-foreground">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-cinzel text-xl text-primary tracking-widest">KRONOS</h1>
          <div className="w-9" />
        </div>

        {/* Lobby Code */}
        <div className="text-center space-y-1">
          <p className="font-inter text-xs text-muted-foreground">Lobi Kodu</p>
          <button onClick={onCopyCode} className="flex items-center gap-2 mx-auto bg-secondary/50 border border-border/50 rounded-xl px-6 py-2 hover:bg-secondary transition-all">
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
                    className={`px-3 py-1 rounded-lg border text-xs font-inter transition-all ${settings.category === c.value ? 'border-primary bg-primary/15 text-primary' : 'border-border/50 bg-secondary/30 text-muted-foreground'}`}
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
                  <button onClick={() => handleSettingChange('year_start', Math.max(0, settings.year_start - 10))} className="w-7 h-7 rounded-lg border border-border/50 bg-secondary/30 text-muted-foreground text-sm font-bold">−</button>
                  <span className="flex-1 text-center font-cinzel text-sm font-bold text-foreground">{settings.year_start}</span>
                  <button onClick={() => handleSettingChange('year_start', Math.min(settings.year_end - 10, settings.year_start + 10))} className="w-7 h-7 rounded-lg border border-border/50 bg-secondary/30 text-muted-foreground text-sm font-bold">+</button>
                </div>
              </div>
              <div className="space-y-1">
                <p className="font-inter text-xs text-muted-foreground">Bitiş Yılı</p>
                <div className="flex items-center gap-1">
                  <button onClick={() => handleSettingChange('year_end', Math.max(settings.year_start + 10, settings.year_end - 10))} className="w-7 h-7 rounded-lg border border-border/50 bg-secondary/30 text-muted-foreground text-sm font-bold">−</button>
                  <span className="flex-1 text-center font-cinzel text-sm font-bold text-foreground">{settings.year_end}</span>
                  <button onClick={() => handleSettingChange('year_end', Math.min(new Date().getFullYear(), settings.year_end + 10))} className="w-7 h-7 rounded-lg border border-border/50 bg-secondary/30 text-muted-foreground text-sm font-bold">+</button>
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
                    className={`flex-1 py-1.5 rounded-lg border text-xs font-cinzel font-bold transition-all ${settings.turn_duration === s ? 'border-primary bg-primary/15 text-primary' : 'border-border/50 bg-secondary/30 text-muted-foreground'}`}
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
                    className={`flex-1 py-1.5 rounded-lg border text-xs font-cinzel font-bold transition-all ${settings.win_card_count === n ? 'border-primary bg-primary/15 text-primary' : 'border-border/50 bg-secondary/30 text-muted-foreground'}`}
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