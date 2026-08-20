import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Swords, Users, Shuffle, Target } from 'lucide-react';
import StandardTopBar from '@/components/layout/StandardTopBar';
import FriendSelectModal from '@/components/lobby/FriendSelectModal';
import IncomingInvitesPanel from '@/components/invites/IncomingInvitesPanel';
import PreGameHourglass from '@/components/lobby/PreGameHourglass';
import KronoxStatePanel from '@/components/ui/KronoxStatePanel';
import { sounds } from '@/lib/gameSounds';
import { getLeaderboardDiamondValue } from '@/lib/leaderboard';
import { getLobbySnapshot, leaveLobby, LOBBY_SNAPSHOT_SCOPES } from '@/lib/dbGateway/lobbyGateway';
import useRandomMatchmaking from '@/hooks/useRandomMatchmaking';
import {
  DUELLO_DISPLAY_NAME,
  SAME_QUESTION_DUEL_MODE,
  STANDARD_RANDOM_MODE,
} from '@/lib/onlineModeDisplay';

/**
 * Kronox Online — Challenge Screen (Codex591 redesign).
 *
 * Category selection is removed: every Online game now draws randomly from
 * the full active question bank. The screen offers two entry points into
 * the Pre-game Hourglass flow:
 *   • "Arkadaşını Davet Et" — pick one player (FriendSelectModal),
 *     then wait up to 60s for that player to accept.
 *   • "Online Kapış" — join the random matchmaking queue, wait up to 30s
 *     to be paired with another searching player.
 * Match found stays on this visual surface and hands the private backend
 * session to the direct-start coordinator. No waiting-room UI is mounted.
 */
const INVITE_WAIT_MS = 60 * 1000;
const INVITE_POLL_MS = 2500;
export default function OnlineChallengeScreen({
  user,
  guestProfile = null,
  loading,
  onCreateInviteMatch,
  onMatchFound,
  onBackHome,
  onGoFriends,
}) {
  const [screen, setScreen] = useState('select'); // select | invite-wait | random-wait | duel-wait
  const [friendModalOpen, setFriendModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [screenError, setScreenError] = useState('');
  const [inviteSession, setInviteSession] = useState(null);
  const random = useRandomMatchmaking(STANDARD_RANDOM_MODE);
  const duel = useRandomMatchmaking(SAME_QUESTION_DUEL_MODE);
  const handedOffRef = useRef('');

  useEffect(() => {
    const match = screen === 'random-wait'
      ? { state: random, mode: STANDARD_RANDOM_MODE }
      : screen === 'duel-wait'
        ? { state: duel, mode: SAME_QUESTION_DUEL_MODE }
        : null;
    if (!match || match.state.phase !== 'matched' || !match.state.lobbyRef) return;
    const key = `${match.mode}:${match.state.lobbyRef}`;
    if (handedOffRef.current === key) return;
    handedOffRef.current = key;
    onMatchFound?.({
      lobbyRef: match.state.lobbyRef,
      queueMode: match.mode,
      source: match.mode === SAME_QUESTION_DUEL_MODE ? 'duello' : 'online_kapis',
      diagnostics: match.state.diagnostics,
    });
  }, [duel.lobbyRef, duel.phase, onMatchFound, random.lobbyRef, random.phase, screen]);

  const handleConfirmInvite = async (targets) => {
    setScreenError('');
    setCreating(true);
    try {
      const session = await onCreateInviteMatch?.({ inviteTargets: targets });
      if (session) {
        setInviteSession(session);
        setScreen('invite-wait');
      }
    } catch {
      setScreenError('Davet gönderilemedi. Lütfen tekrar dene.');
    } finally {
      setCreating(false);
    }
  };

  // Invite mode: poll the private backend session until the invited player joins.
  useEffect(() => {
    if (screen !== 'invite-wait' || !inviteSession?.id) return undefined;
    let cancelled = false;
    let tickPending = false;
    const tick = async () => {
      if (cancelled || tickPending) return;
      tickPending = true;
      try {
        const res = await getLobbySnapshot({ lobbyId: inviteSession.id, scope: LOBBY_SNAPSHOT_SCOPES.WAITING_ROOM });
        const fresh = res?.data?.lobby;
        if (!cancelled && fresh && (fresh.players?.length || fresh.player_count || 0) > 1) {
          onMatchFound?.({ lobbyRef: fresh.id, initialLobby: fresh, source: 'friend_invite' });
        }
      } catch { /* transient poll errors are ignored; next tick retries */ }
      finally { tickPending = false; }
    };
    const intervalId = window.setInterval(tick, INVITE_POLL_MS);
    return () => { cancelled = true; window.clearInterval(intervalId); };
  }, [screen, inviteSession, onMatchFound]);

  const handleInviteTimeoutOrCancel = async () => {
    if (inviteSession?.id) await leaveLobby(inviteSession.id).catch(() => null);
    setInviteSession(null);
    setScreen('select');
  };

  const handleStartRandom = () => {
    sounds.tap();
    setScreenError('');
    setScreen('random-wait');
    random.start();
  };

  const handleStartDuel = () => {
    sounds.tap();
    setScreenError('');
    setScreen('duel-wait');
    duel.start();
  };

  const handleRandomCancel = async () => {
    const cancelled = await random.cancel();
    if (!cancelled) return;
    setScreenError('');
    setScreen('select');
  };

  const handleDuelCancel = async () => {
    const cancelled = await duel.cancel();
    if (!cancelled) return;
    setScreenError('');
    setScreen('select');
  };

  const handleRandomTimeout = () => {
    void random.resolveTimeout();
  };

  const handleDuelTimeout = () => {
    void duel.resolveTimeout();
  };

  // Codex593 — Named ctaDisabled state per CTA. Neither button is ever
  // gated by social/friend/player-list load state — only by an in-flight
  // invite-session action, so Online Kapış always stays available
  // even if the manual invite player list failed to load.
  const ctaDisabledInvite = loading || creating;
  const ctaDisabledRandom = loading || creating;
  const ctaDisabledDuel = loading || creating;

  if (screen === 'invite-wait') {
    return (
      <PreGameHourglass
        testId="online-invite-waiting-screen"
        cancelTestId="online-invite-waiting-cancel"
        title="Rakip aranıyor"
        subtitle="Davet ettiğin oyuncunun katılması bekleniyor."
        durationMs={INVITE_WAIT_MS}
        onTimeout={handleInviteTimeoutOrCancel}
        onCancel={handleInviteTimeoutOrCancel}
      />
    );
  }

  if (screen === 'random-wait') {
    return (
      <PreGameHourglass
        testId="online-kapis-search-screen"
        cancelTestId="online-kapis-search-cancel"
        title="Rakip Aranıyor"
        subtitle="30 saniye içinde eşleşme aranıyor."
        expiresAt={random.expiresAt}
        durationMs={30 * 1000}
        phase={random.phase}
        errorMessage={screenError || random.errorMessage}
        errorCategory={random.errorCategory}
        diagnostics={random.diagnostics}
        onTimeout={handleRandomTimeout}
        onCancel={handleRandomCancel}
        onRetry={() => { setScreenError(''); void random.start(); }}
      />
    );
  }

  if (screen === 'duel-wait') {
    return (
      <PreGameHourglass
        testId="duello-search-screen"
        cancelTestId="duello-search-cancel"
        title="Rakip aranıyor"
        subtitle="30 saniye içinde Duello rakibi aranıyor."
        expiresAt={duel.expiresAt}
        durationMs={30 * 1000}
        phase={duel.phase}
        errorMessage={screenError || duel.errorMessage}
        errorCategory={duel.errorCategory}
        diagnostics={duel.diagnostics}
        onTimeout={handleDuelTimeout}
        onCancel={handleDuelCancel}
        onRetry={() => { setScreenError(''); void duel.start(); }}
      />
    );
  }

  return (
    <div
      data-testid="online-screen"
      className="kx-a1-screen kx-a1-online fixed inset-0 flex flex-col text-white"
      style={{
        background:
          'radial-gradient(ellipse at 50% 8%, rgba(59,130,246,0.30), transparent 48%), radial-gradient(ellipse at 50% 96%, rgba(34,211,238,0.12), transparent 55%), linear-gradient(180deg, #050b1c 0%, #0a1738 55%, #03060f 100%)',
        userSelect: 'none',
        overflow: 'hidden',
        overscrollBehavior: 'none',
      }}
    >
      <StandardTopBar
        showBack
        user={user}
        onBack={onBackHome}
        diamonds={getLeaderboardDiamondValue(user)}
      />

      <main
        className="flex-1 flex flex-col px-4 overflow-y-auto"
        style={{
          paddingTop: 'calc(3.25rem + env(safe-area-inset-top))',
          paddingBottom: 'calc(4rem + env(safe-area-inset-bottom) + 1.5rem)',
        }}
      >
        <IncomingInvitesPanel user={user} />

        <TitleBlock />

        <div className="mt-5 space-y-3">
          <ModeButton
            testId="online-invite-entry"
            icon={Users}
            label="Arkadaşını Davet Et"
            ariaLabel="Arkadaşını Davet Et"
            hint="Seçtiğin oyuncuya 60 saniye davet."
            disabled={ctaDisabledInvite}
            onClick={() => { sounds.tap(); setFriendModalOpen(true); }}
          />
          <ModeButton
            testId="online-kapis-entry"
            icon={Shuffle}
            label="Online Kapış"
            ariaLabel="Online Kapış"
            hint="30 saniyede rastgele bir rakip bul."
            disabled={ctaDisabledRandom}
            onClick={handleStartRandom}
          />
          <ModeButton
            testId="duello-entry"
            icon={Target}
            label={DUELLO_DISPLAY_NAME}
            ariaLabel="Duello — Duelloya Başla"
            hint="Aynı soruda rakibinden hızlı ve doğru ol."
            helper="2 oyuncu · 10 kart hedefi · Rastgele rakip"
            action="Duelloya Başla"
            disabled={ctaDisabledDuel}
            onClick={handleStartDuel}
          />
        </div>

        {screenError && (
          <div className="mt-3">
            <KronoxStatePanel
              compact
              title={screenError}
              message="Diğer Online seçeneklerini kullanmaya devam edebilirsin."
              onAction={screenError === 'Eşleşme bulunamadı.'
                ? handleStartRandom
                : screenError === 'Duello eşleşmesi bulunamadı.'
                  ? handleStartDuel
                  : () => { setScreenError(''); setFriendModalOpen(true); }}
            />
          </div>
        )}

      </main>

      <FriendSelectModal
        open={friendModalOpen}
        onClose={() => setFriendModalOpen(false)}
        user={user}
        guestProfile={guestProfile}
        maxSelection={1}
        initialSelectedTargets={[]}
        onConfirm={handleConfirmInvite}
        onGoFriends={onGoFriends}
      />
    </div>
  );
}

/* --------------------------- Title block --------------------------- */

function TitleBlock() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="text-center mt-1"
    >
      <div className="flex justify-center mb-1.5">
        <Swords
          className="text-white/95"
          style={{ width: 22, height: 22, filter: 'drop-shadow(0 0 8px rgba(250,204,21,0.45))' }}
          strokeWidth={2.2}
        />
      </div>
      <div className="flex items-center justify-center gap-2.5">
        <DecorStar />
        <h1
          className="font-cinzel font-black"
          style={{
            color: '#f1f4ff',
            fontSize: 'clamp(17px, 5.2vw, 22px)',
            letterSpacing: '0.16em',
            textShadow: '0 0 14px rgba(250,204,21,0.30), 0 2px 4px rgba(0,0,0,0.6)',
          }}
        >
          ONLINE KAPIŞMA
        </h1>
        <DecorStar />
      </div>
      <div className="mx-auto mt-1.5" style={{
        height: 1,
        width: 'min(70%, 240px)',
        background: 'linear-gradient(90deg, transparent, rgba(250,204,21,0.55), transparent)',
      }} />
      <p className="mt-1.5 font-inter text-[12px] text-blue-100/75">
        Tüm kategorilerden rastgele sorular
      </p>
    </motion.div>
  );
}

function DecorStar() {
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-block',
        width: 8,
        height: 8,
        background: '#facc15',
        transform: 'rotate(45deg)',
        boxShadow: '0 0 8px rgba(250,204,21,0.65)',
      }}
    />
  );
}

/* ----------------------------- Mode button ---------------------------- */

function ModeButton({ icon: Icon, label, ariaLabel, hint, helper, action, disabled, onClick, testId }) {
  return (
    <motion.button
      type="button"
      data-testid={testId}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel || label}
      whileTap={disabled ? undefined : { scale: 0.98 }}
      className="kx-a1-panel kx-a1-pressable w-full flex items-center gap-4 rounded-2xl px-4 py-4 text-left disabled:opacity-55"
      style={{
        background: 'linear-gradient(180deg, rgba(20,32,68,0.85), rgba(8,14,32,0.95))',
        boxShadow: 'inset 0 0 0 1.5px rgba(120,170,255,0.32), inset 0 1px 0 rgba(255,255,255,0.08), 0 8px 18px rgba(2,6,23,0.45)',
      }}
    >
      <span
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
        style={{ background: 'rgba(250,204,21,0.12)', boxShadow: 'inset 0 0 0 1px rgba(250,204,21,0.40)' }}
      >
        <Icon style={{ width: 22, height: 22, color: '#facc15' }} strokeWidth={2.2} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-inter text-[15px] font-black tracking-wide text-white">{label}</span>
        <span className="block mt-0.5 font-inter text-[12px] text-blue-100/65">{hint}</span>
        {helper && <span className="mt-1 block font-inter text-[10px] font-semibold text-cyan-200/70">{helper}</span>}
        {action && <span className="mt-1.5 block font-inter text-[11px] font-black text-amber-200">{action}</span>}
      </span>
    </motion.button>
  );
}
