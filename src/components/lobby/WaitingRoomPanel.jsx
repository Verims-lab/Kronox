import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Copy, Loader2, Users } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { useWaitingRoomSync } from '@/hooks/useWaitingRoomSync';
import { summarizePlayers } from '@/lib/lobbyUtils';
import { buildInitialOnlineGameState } from '@/lib/onlineGameStart';
import { debugLog, debugWarn } from '@/lib/debugLog';

const categories = [
  { value: 'karisik', label: 'Karışık' },
  { value: 'tarih', label: 'Tarih' },
  { value: 'bilim', label: 'Bilim' },
  { value: 'spor', label: 'Spor' },
  { value: 'sanat', label: 'Sanat' },
];

export default function WaitingRoomPanel({ lobby, setLobby, playerName, user, isHost, canStart, onLeave, onCopyCode, copied, navigate }) {
  const {
    startDebug,
    isDebugVisible,
    waitingScrollRef,
    pullY,
    refreshing,
  } = useWaitingRoomSync({ lobby, setLobby, playerName, user, isHost, navigate });

  const [settings, setSettings] = useState({
    category: lobby.category,
    year_start: lobby.year_start,
    year_end: lobby.year_end,
    turn_duration: lobby.turn_duration,
    win_card_count: lobby.win_card_count,
  });

  const prevLobbyId = useRef(lobby.id);
  useEffect(() => {
    if (lobby.id !== prevLobbyId.current) return;
    setSettings({
      category: lobby.category,
      year_start: lobby.year_start,
      year_end: lobby.year_end,
      turn_duration: lobby.turn_duration,
      win_card_count: lobby.win_card_count,
    });
  }, [lobby.category, lobby.year_start, lobby.year_end, lobby.turn_duration, lobby.win_card_count, lobby.id]);

  const settingDebounceRef = useRef(null);

  useEffect(() => () => {
    if (settingDebounceRef.current) clearTimeout(settingDebounceRef.current);
  }, []);

  const handleSettingChange = (key, value) => {
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    clearTimeout(settingDebounceRef.current);
    settingDebounceRef.current = setTimeout(() => {
      base44.entities.Lobby.update(lobby.id, { [key]: value }).catch(() => {});
    }, 300);
  };

  const handleStart = async () => {
    const latestLobby = await base44.entities.Lobby.get(lobby.id).catch((err) => {
      debugWarn('[handleStart] latest lobby fetch failed, using local lobby:', err.message);
      return null;
    });
    const startLobby = latestLobby || lobby;
    const startPlayers = Array.isArray(startLobby.players) ? startLobby.players : [];

    debugLog('[handleStart] latest roster before start:', {
      lobbyId: startLobby.id,
      localPlayersCount: lobby.players?.length || 0,
      fetchedPlayersCount: startPlayers.length,
      players: summarizePlayers(startPlayers),
    });

    if (startPlayers.length < 2) {
      alert('Oyun başlatmak için en az 2 oyuncu gerekli');
      return;
    }

    const allQuestions = await base44.entities.Question.list('-created_date', 200);
    const initialState = buildInitialOnlineGameState({
      players: startPlayers,
      questions: allQuestions,
      settings,
    });

    if (!initialState.ok) {
      alert(initialState.message);
      return;
    }

    const { playersWithCards, updateData } = initialState;
    debugLog('[handleStart] lobbyId:', lobby.id, 'playerCount:', playersWithCards.length, 'status:', updateData.status, 'current_player_index:', updateData.current_player_index, 'current_question_id:', updateData.current_question_id, 'used_count:', updateData.used_question_ids.length, 'players:', playersWithCards.map(p => p.name));
    debugLog('[handleStart] start payload roster:', {
      lobbyId: startLobby.id,
      playersCountUsedForGameStart: playersWithCards.length,
      playersWrittenToLobby: summarizePlayers(playersWithCards),
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
        <div className="flex items-center justify-between">
          <h1 className="font-cinzel text-xl text-primary tracking-widest">Lobi</h1>
          <button onClick={onLeave} className="text-xs font-inter text-muted-foreground hover:text-destructive transition-colors px-3 py-2 rounded min-h-[44px] min-w-[44px] flex items-center justify-center" aria-label="Lobiden ayrıl">
            Ayrıl
          </button>
        </div>

        <div className="text-center space-y-1">
          <p className="font-inter text-xs text-muted-foreground">Lobi Kodu</p>
          <button onClick={onCopyCode} className="flex items-center gap-2 mx-auto bg-secondary/50 border border-border/50 rounded-xl px-6 py-3 hover:bg-secondary transition-all min-h-[44px] min-w-[44px] justify-center" aria-label="Lobi kodunu kopyala">
            <span className="font-cinzel text-2xl font-bold text-primary tracking-[0.3em]">{lobby.code}</span>
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
          </button>
          <p className="font-inter text-xs text-muted-foreground/60">Arkadaşlarına bu kodu ver</p>
        </div>

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

        {isHost && (
          <div className="space-y-3 border border-border/30 rounded-xl p-4 bg-secondary/10">
            <p className="font-inter text-xs text-muted-foreground font-semibold uppercase tracking-wider">Oyun Ayarları</p>

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
      </div>

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
