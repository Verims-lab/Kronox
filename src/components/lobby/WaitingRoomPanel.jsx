import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Copy, Loader2, Users } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import StonePanel from '@/components/ui/StonePanel';
import GoldButton from '@/components/ui/GoldButton';
import { useWaitingRoomSync } from '@/hooks/useWaitingRoomSync';
import { summarizePlayers } from '@/lib/lobbyUtils';
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
  const [isStarting, setIsStarting] = useState(false);

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
    if (isStarting) return;
    setIsStarting(true);

    if (settingDebounceRef.current) {
      clearTimeout(settingDebounceRef.current);
      settingDebounceRef.current = null;
    }

    try {
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

      const response = await base44.functions.invoke('startLobbyGame', {
        lobbyId: startLobby.id,
        settings,
        playerName,
      });
      const result = response?.data;

      if (!result?.success || result?.error) {
        alert(result?.error || 'Oyun başlatılamadı. Tekrar deneyin.');
        debugWarn('[handleStart] authority start rejected:', result?.debug || result);
        return;
      }

      if (result.lobby) {
        setLobby(result.lobby);
      }

      debugLog('[handleStart] authority start success:', {
        lobbyId: startLobby.id,
        debug: result.debug || null,
        playersWrittenToLobby: summarizePlayers(result.lobby?.players || []),
      });

      navigate('/game', {
        state: {
          lobbyId: startLobby.id,
          online: true,
        }
      });
    } catch (err) {
      console.error('[handleStart] authority start failed:', err);
      alert('Oyun başlatılamadı: ' + err.message);
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center"
      style={{
        paddingTop: 'calc(4rem + env(safe-area-inset-top))',
        paddingBottom: 'calc(4rem + env(safe-area-inset-bottom))',
        background:
          'radial-gradient(ellipse at 50% 12%, rgba(59,130,246,0.32), transparent 42%), radial-gradient(ellipse at 50% 90%, rgba(34,211,238,0.12), transparent 50%), linear-gradient(180deg, #050b1c 0%, #0a1738 55%, #03060f 100%)',
      }}
    >
      <div
        ref={waitingScrollRef}
        className="w-full max-w-lg px-4 pb-4 space-y-4 flex-1 overflow-y-auto"
        style={{ overscrollBehavior: 'contain', transform: pullY > 0 ? `translateY(${pullY}px)` : undefined, transition: pullY === 0 ? 'transform 0.2s' : undefined }}
      >
        {refreshing && (
          <div className="flex justify-center py-1">
            <Loader2 className="w-4 h-4 text-amber-300 animate-spin" />
          </div>
        )}
        <div className="flex items-center justify-between">
          <h1
            className="font-cinzel text-xl font-black tracking-widest"
            style={{
              color: '#facc15',
              textShadow: '0 0 14px rgba(250,204,21,0.55), 0 2px 4px rgba(0,0,0,0.7)',
            }}
          >
            Lobi
          </h1>
          <button
            onClick={onLeave}
            className="text-xs font-inter text-blue-100/70 hover:text-destructive transition-colors px-3 py-2 rounded min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Lobiden ayrıl"
          >
            Ayrıl
          </button>
        </div>

        {/* Lobby code — demoted to a small fallback affordance. Invitations are
            now the primary join path, but the code is still useful for guests
            and as a manual fallback (Açık Lobiye Gir). */}
        <div className="text-center">
          <button
            onClick={onCopyCode}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 mx-auto min-h-[36px] justify-center"
            style={{
              borderRadius: 10,
              background: 'linear-gradient(180deg, rgba(30,41,75,0.75), rgba(10,18,38,0.85))',
              boxShadow:
                'inset 0 0 0 1px rgba(250,204,21,0.35), inset 0 1px 0 rgba(255,236,140,0.18)',
            }}
            aria-label="Yedek lobi kodunu kopyala"
          >
            <span className="font-inter text-[10px] uppercase tracking-widest text-blue-100/55">Yedek kod</span>
            <span
              className="font-cinzel text-sm font-black tracking-[0.2em]"
              style={{ color: '#facc15' }}
            >
              {lobby.code}
            </span>
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-amber-200/80" />}
          </button>
          {Array.isArray(lobby.invited_emails) && lobby.invited_emails.length > 0 ? (
            <p className="mt-2 font-inter text-xs text-blue-100/60">
              Davet edilen arkadaşların kabul ettiklerinde otomatik katılır.
            </p>
          ) : (
            <p className="mt-2 font-inter text-[11px] text-blue-100/45">
              Daveti kabul eden arkadaşların buraya katılır.
            </p>
          )}
        </div>

        {/* Players panel */}
        <StonePanel glow="portal" padding="p-4" className="space-y-3">
          <p className="font-inter text-[11px] uppercase tracking-widest text-blue-100/70 font-semibold flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" /> Oyuncular ({lobby.players?.length || 0})
          </p>
          <div className="space-y-2">
            {(lobby.players || []).map((p, i) => (
              <motion.div
                key={p.email || i}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                style={{
                  background: 'linear-gradient(180deg, rgba(20,32,68,0.85), rgba(8,14,32,0.92))',
                  boxShadow:
                    'inset 0 0 0 1px rgba(120,170,255,0.28), inset 0 1px 0 rgba(255,255,255,0.06), inset 0 -6px 8px rgba(0,0,0,0.35)',
                }}
              >
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center font-cinzel font-black text-sm"
                  style={{
                    background: i === 0
                      ? 'radial-gradient(circle at 35% 28%, #ffe066, #b97a06 70%)'
                      : 'radial-gradient(circle at 35% 28%, #60a5fa, #1e3a8a 70%)',
                    color: i === 0 ? '#1a1006' : '#ffffff',
                    boxShadow:
                      'inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -4px 6px rgba(0,0,0,0.35), 0 0 10px rgba(0,0,0,0.45)',
                  }}
                >
                  {p.name?.[0]?.toUpperCase()}
                </div>
                <span className="font-inter text-white/95 flex-1">{p.name}</span>
                {i === 0 && (
                  <span
                    className="text-[10px] font-inter font-black uppercase tracking-wider px-2 py-0.5 rounded-full"
                    style={{
                      background: 'linear-gradient(180deg, #ffe066, #b97a06)',
                      color: '#1a1006',
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4), 0 0 8px rgba(250,204,21,0.55)',
                    }}
                  >
                    Host
                  </span>
                )}
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" style={{ boxShadow: '0 0 8px rgba(52,211,153,0.7)' }} />
              </motion.div>
            ))}
          </div>
          {(lobby.players?.length || 0) < 2 && (
            <p className="font-inter text-xs text-blue-100/55 text-center pt-1">
              Oyun başlatmak için en az 2 oyuncu gerekli
            </p>
          )}
        </StonePanel>

        {isHost && (
          <StonePanel glow="gold" padding="p-4" className="space-y-3">
            <p className="font-inter text-[11px] uppercase tracking-widest text-amber-200/80 font-black">Oyun Ayarları</p>

            <div className="space-y-1.5">
              <p className="font-inter text-xs text-blue-100/70">Kategori</p>
              <div className="flex flex-wrap gap-1.5">
                {categories.map(c => (
                  <ChipButton
                    key={c.value}
                    active={settings.category === c.value}
                    onClick={() => handleSettingChange('category', c.value)}
                    ariaLabel={`${c.label} kategorisini seç`}
                  >
                    {c.label}
                  </ChipButton>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <p className="font-inter text-xs text-blue-100/70">Başlangıç Yılı</p>
                <div className="flex items-center gap-1">
                  <StepperButton onClick={() => handleSettingChange('year_start', Math.max(0, settings.year_start - 10))} ariaLabel="Başlangıç yılını azalt">−</StepperButton>
                  <span className="flex-1 text-center font-cinzel text-sm font-black text-amber-200">{settings.year_start}</span>
                  <StepperButton onClick={() => handleSettingChange('year_start', Math.min(settings.year_end - 10, settings.year_start + 10))} ariaLabel="Başlangıç yılını arttır">+</StepperButton>
                </div>
              </div>
              <div className="space-y-1.5">
                <p className="font-inter text-xs text-blue-100/70">Bitiş Yılı</p>
                <div className="flex items-center gap-1">
                  <StepperButton onClick={() => handleSettingChange('year_end', Math.max(settings.year_start + 10, settings.year_end - 10))} ariaLabel="Bitiş yılını azalt">−</StepperButton>
                  <span className="flex-1 text-center font-cinzel text-sm font-black text-amber-200">{settings.year_end}</span>
                  <StepperButton onClick={() => handleSettingChange('year_end', Math.min(new Date().getFullYear(), settings.year_end + 10))} ariaLabel="Bitiş yılını arttır">+</StepperButton>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="font-inter text-xs text-blue-100/70">Tur Süresi</p>
              <div className="flex gap-2">
                {[30, 60, 90, 120].map(s => (
                  <ChipButton
                    key={s}
                    active={settings.turn_duration === s}
                    onClick={() => handleSettingChange('turn_duration', s)}
                    ariaLabel={`${s} saniye tur süresi seç`}
                    className="flex-1"
                  >
                    {s}s
                  </ChipButton>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="font-inter text-xs text-blue-100/70">Kazanmak için kart sayısı</p>
              <div className="flex gap-2">
                {[5, 7, 10, 15].map(n => (
                  <ChipButton
                    key={n}
                    active={settings.win_card_count === n}
                    onClick={() => handleSettingChange('win_card_count', n)}
                    ariaLabel={`${n} kart ile kazanmak için seç`}
                    className="flex-1"
                  >
                    {n}
                  </ChipButton>
                ))}
              </div>
            </div>
          </StonePanel>
        )}

        {!isHost && (
          <StonePanel glow="portal" padding="p-4" className="space-y-2">
            <p className="font-inter text-[11px] uppercase tracking-widest text-blue-100/70 font-black">Oyun Ayarları</p>
            <div className="grid grid-cols-2 gap-2 text-xs font-inter text-blue-100/75">
              <span>Kategori: <span className="text-amber-200">{lobby.category}</span></span>
              <span>Tur süresi: <span className="text-amber-200">{lobby.turn_duration}s</span></span>
              <span>Yıllar: <span className="text-amber-200">{lobby.year_start}–{lobby.year_end}</span></span>
              <span>Kazanma: <span className="text-amber-200">{lobby.win_card_count} kart</span></span>
            </div>
            <p className="font-inter text-xs text-blue-100/55 text-center mt-2">Host oyunu başlatmasını bekliyor...</p>
          </StonePanel>
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
          <GoldButton
            variant="gold"
            size="lg"
            onClick={handleStart}
            disabled={!canStart || isStarting}
          >
            {isStarting ? (
              <span className="inline-flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                BAŞLATILIYOR
              </span>
            ) : `OYUNU BAŞLAT (${lobby.players?.length || 0} oyuncu)`}
          </GoldButton>
        </div>
      )}
    </div>
  );
}

function ChipButton({ active, onClick, ariaLabel, className = '', children }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-cinzel font-black transition-all min-h-[44px] ${className}`}
      style={{
        background: active
          ? 'linear-gradient(180deg, #ffe066 0%, #facc15 50%, #b97a06 100%)'
          : 'linear-gradient(180deg, rgba(30,41,75,0.92), rgba(10,18,38,0.96))',
        color: active ? '#1a1006' : '#cfe1ff',
        boxShadow: active
          ? 'inset 0 1px 0 rgba(255,255,255,0.45), inset 0 -6px 8px rgba(151,78,0,0.3), 0 0 12px rgba(250,204,21,0.55)'
          : 'inset 0 0 0 1px rgba(120,170,255,0.32), inset 0 1px 0 rgba(255,255,255,0.06), inset 0 -4px 6px rgba(0,0,0,0.35)',
      }}
      aria-label={ariaLabel}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}

function StepperButton({ onClick, ariaLabel, children }) {
  return (
    <button
      onClick={onClick}
      className="w-11 h-11 rounded-lg text-amber-200 text-base font-black flex items-center justify-center min-h-[44px] min-w-[44px]"
      style={{
        background: 'linear-gradient(180deg, rgba(30,41,75,0.92), rgba(10,18,38,0.96))',
        boxShadow:
          'inset 0 0 0 1px rgba(250,204,21,0.42), inset 0 1px 0 rgba(255,236,140,0.18), inset 0 -4px 6px rgba(0,0,0,0.4)',
      }}
      aria-label={ariaLabel}
    >
      {children}
    </button>
  );
}