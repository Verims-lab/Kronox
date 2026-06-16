import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Copy, Loader2, Users, Hourglass } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import StonePanel from '@/components/ui/StonePanel';
import GoldButton from '@/components/ui/GoldButton';
import { useWaitingRoomSync } from '@/hooks/useWaitingRoomSync';
import { navigateToOnlineGame } from '@/lib/onlineGameNavigation';
import { summarizePlayers } from '@/lib/lobbyUtils';
import { debugLog, debugWarn } from '@/lib/debugLog';
import { pushAppDiag } from '@/lib/appDiagBus';

// Codex131 — Lobby simplification:
//   "Oyun Ayarları" host panel and the non-host settings summary were
//   removed. Category selection happens on the Online screen (persisted as
//   lobby.selected_category_ids at create time). All other game config
//   (year window, turn duration, win card count) reuses the lobby's
//   existing values or backend defaults — there is no in-lobby edit UI.
export default function WaitingRoomPanel({ lobby, setLobby, playerName, user, isHost, canStart, onLeave, onCopyCode, copied, navigate }) {
  const {
    startDebug,
    isDebugVisible,
    waitingScrollRef,
    pullY,
    refreshing,
  } = useWaitingRoomSync({ lobby, setLobby, playerName, user, isHost, navigate });

  const [isStarting, setIsStarting] = useState(false);
  // Codex165 — Kronox-style inline error replaces the native browser alert.
  // Whatever string we put in startError is rendered as a rose-tinted toast
  // panel above the BAŞLAT button so the host gets honest, non-blocking
  // feedback. Cleared every time we re-enter handleStart so a previous
  // failure never leaks into a new attempt.
  const [startError, setStartError] = useState('');

  const handleStart = async () => {
    if (isStarting) return;
    setIsStarting(true);
    setStartError('');

    // Codex085 — App-level diag: record that the host pressed Start.
    pushAppDiag({
      startActionFired: true,
      startActionReturned: false,
      startLobbyId: lobby?.id || null,
      startLobbyStatus: lobby?.status || null,
      startLobbyRevision: lobby?.state_revision ?? null,
      startSource: null,
      lastError: null,
      lastErrorWhere: null,
    });

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
        setStartError('Oyun başlatmak için en az 2 oyuncu gerekli.');
        return;
      }

      // Codex131 — No `settings` payload. Backend startLobbyGame reads
      // category / year window / turn / win-card from the persisted lobby
      // (including the Online multi-select selected_category_ids).
      const response = await base44.functions.invoke('startLobbyGame', {
        lobbyId: startLobby.id,
        playerName,
      }).catch((err) => {
        // Codex165 — Surface backend's safe error message instead of an
        // axios "status code 400" string. Base44 SDK throws on non-2xx;
        // err.response.data carries the JSON body { error, code, debug }.
        const data = err?.response?.data;
        const safeMsg = data?.error || err?.message || 'Oyun başlatılamadı.';
        debugWarn('[handleStart] startLobbyGame request failed:', { status: err?.response?.status, data });
        return { data: { success: false, error: safeMsg, debug: data?.debug || null } };
      });
      const result = response?.data;

      if (!result?.success || result?.error) {
        setStartError(result?.error || 'Oyun başlatılamadı. Lobi bilgileri eksik veya güncel değil.');
        debugWarn('[handleStart] authority start rejected:', result?.debug || result);
        return;
      }

      // Codex083 — Host bootstrap must use the SAME live server state that
      // Player 2 receives via subscription. Relying on `result.lobby` alone
      // proved unreliable on the host (black screen on /game). We always
      // re-fetch the authoritative Lobby row after startLobbyGame succeeds
      // and only fall back to the function response if the re-fetch fails.
      let liveStartedLobby = null;
      try {
        liveStartedLobby = await base44.entities.Lobby.get(startLobby.id);
      } catch (fetchErr) {
        debugWarn('[handleStart] post-start Lobby.get failed, falling back to function response:', fetchErr.message);
      }
      const startedLobby = liveStartedLobby || result.lobby || startLobby;
      const startedHasGameState = Boolean(
        startedLobby?.id &&
        startedLobby?.current_question_id &&
        Array.isArray(startedLobby?.online_question_deck) &&
        startedLobby.online_question_deck.length > 0 &&
        Array.isArray(startedLobby?.players) &&
        startedLobby.players.length >= 2,
      );

      if (!startedHasGameState) {
        setStartError('Oyun destesi hazırlanamadı. Lütfen tekrar dene.');
        debugWarn('[handleStart] started lobby missing shared Online deck:', {
          lobbyId: startedLobby?.id || startLobby.id,
          current_question_id: startedLobby?.current_question_id || null,
          deckCount: startedLobby?.online_question_deck?.length || 0,
          playerCount: startedLobby?.players?.length || 0,
          status: startedLobby?.status || null,
        });
        return;
      }

      if (startedLobby) {
        setLobby(startedLobby);
      }

      const usedSource = liveStartedLobby ? 'live-refetch' : (result.lobby ? 'function-response' : 'pre-start-fallback');

      debugLog('[handleStart] authority start success:', {
        lobbyId: startLobby.id,
        debug: result.debug || null,
        usedSource,
        startedHasGameState,
        startedStatus: startedLobby?.status || null,
        startedCurrentQuestionId: startedLobby?.current_question_id || null,
        startedOnlineDeckCount: startedLobby?.online_question_deck?.length || 0,
        playersWrittenToLobby: summarizePlayers(startedLobby?.players || []),
      });

      // Codex085 — App-level diag: record that startLobbyGame returned and
      // capture the lobby identity we are about to navigate with.
      pushAppDiag({
        startActionReturned: true,
        startLobbyId: startedLobby?.id || null,
        startLobbyStatus: startedLobby?.status || null,
        startLobbyRevision: startedLobby?.state_revision ?? null,
        startSource: usedSource,
      });

      const navigated = navigateToOnlineGame(navigate, startedLobby, {
        currentUser: user,
        playerName,
      });
      if (!navigated) {
        pushAppDiag({
          lastError: 'navigateToOnlineGame returned false (missing lobby id/code)',
          lastErrorWhere: 'handle_start',
        });
        setStartError('Oyun başlatıldı ancak lobi bilgisi eksik. Lütfen tekrar deneyin.');
      }
    } catch (err) {
      console.error('[handleStart] authority start failed:', err);
      pushAppDiag({
        lastError: err?.message || String(err),
        lastErrorWhere: 'handle_start',
      });
      setStartError(err?.message ? `Oyun başlatılamadı: ${err.message}` : 'Oyun başlatılamadı. Lütfen tekrar deneyin.');
    } finally {
      // Codex165 — Always release the button so the host can retry after
      // a backend 400/timeout. "BAŞLATILIYOR" never gets stuck.
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
          {(() => {
            // Codex099 — show invited friends who haven't joined yet as
            // "bekleniyor" rows. Pure derivation from existing lobby fields,
            // no extra fetch, no mutation, no notification logic touched.
            const invited = Array.isArray(lobby.invited_emails) ? lobby.invited_emails : [];
            const joinedEmails = new Set(
              (lobby.players || [])
                .map((p) => String(p?.email || '').toLowerCase())
                .filter(Boolean),
            );
            const pendingEmails = invited
              .map((e) => String(e || '').toLowerCase())
              .filter((e) => e && !joinedEmails.has(e));
            if (pendingEmails.length === 0) return null;
            return (
              <div className="space-y-1.5 pt-1">
                <p className="font-inter text-[10px] uppercase tracking-widest text-blue-100/55 font-black flex items-center gap-1">
                  <Hourglass className="w-3 h-3" /> Bekleniyor ({pendingEmails.length})
                </p>
                {pendingEmails.map((email) => (
                  <div
                    key={email}
                    className="flex items-center gap-3 rounded-xl px-3 py-2"
                    style={{
                      background: 'linear-gradient(180deg, rgba(20,32,68,0.45), rgba(8,14,32,0.55))',
                      boxShadow: 'inset 0 0 0 1px rgba(120,170,255,0.18)',
                    }}
                  >
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center"
                      style={{
                        background: 'rgba(148,163,184,0.18)',
                        boxShadow: 'inset 0 0 0 1px rgba(148,163,184,0.30)',
                      }}
                    >
                      <Hourglass className="w-3.5 h-3.5 text-blue-100/60" />
                    </div>
                    <span className="font-inter text-[12px] text-blue-100/70 flex-1 truncate">{email}</span>
                    <span
                      className="rounded-full px-2 py-0.5 font-inter text-[9px] font-black uppercase tracking-widest"
                      style={{
                        background: 'rgba(250,204,21,0.08)',
                        color: '#fde68a',
                        boxShadow: 'inset 0 0 0 1px rgba(250,204,21,0.30)',
                      }}
                    >
                      Davet edildi
                    </span>
                  </div>
                ))}
              </div>
            );
          })()}
          {(lobby.players?.length || 0) < 2 && (
            <p className="font-inter text-xs text-blue-100/55 text-center pt-1">
              Oyun başlatmak için en az 2 oyuncu gerekli
            </p>
          )}
        </StonePanel>

        {/* Codex099 — Online soru mantığı bilgilendirmesi. Üründe bilinçli
            karar: iki oyuncuya farklı sorular gelir. UI'da bunu kısa ve
            sade bir not olarak açıklıyoruz; gerçek soru seçim akışı
            korunuyor. */}
        <p
          className="font-inter text-[11px] text-blue-100/55 text-center px-2 py-1.5 rounded-xl"
          style={{
            background: 'rgba(59,130,246,0.06)',
            boxShadow: 'inset 0 0 0 1px rgba(120,170,255,0.18)',
          }}
        >
          Sorular rastgele gelir — hız ve bilgi kadar şans da oyunun parçasıdır.
        </p>

        {/* Codex131 — In-lobby "Oyun Ayarları" panel removed.
            Category selection happens on the Online screen; all other
            game config reuses persisted lobby values. Non-host sees a
            simple waiting message instead of a settings summary. */}
        {!isHost && (
          <StonePanel glow="portal" padding="p-3" className="text-center">
            <p className="font-inter text-xs text-blue-100/70">
              Host oyunu başlatmasını bekliyor...
            </p>
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
          {/* Codex165 — Kronox-style inline error replaces native alert.
              Non-blocking, dismissible-by-retry, honest copy from backend
              when available. */}
          {startError && (
            <div
              role="alert"
              className="mb-2 rounded-xl px-3 py-2 font-inter text-[12px] text-rose-100/95"
              style={{
                background: 'rgba(244,63,94,0.10)',
                boxShadow: 'inset 0 0 0 1px rgba(244,63,94,0.40)',
              }}
            >
              {startError}
            </div>
          )}
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

// Codex131 — Legacy chip/stepper helpers were removed alongside the in-lobby
// settings panel they powered. No other call sites existed.
