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
 *   • "Duello" — join the same-question duel queue for a direct match.
 * Match found stays on this visual surface and hands the private backend
 * session to the direct-start coordinator. No waiting-room UI is mounted.
 */
const INVITE_WAIT_MS = 60 * 1000;
const INVITE_POLL_MS = 2500;
const ONLINE_DISPLAY_FONT = '"Barlow Condensed", "Arial Narrow", sans-serif';
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

        <div
          className="mt-4 grid"
          style={{ gap: 'clamp(0.65rem, 1.8dvh, 0.85rem)' }}
        >
          <ModeButton
            testId="online-invite-entry"
            icon={Users}
            label="Arkadaşını Davet Et"
            ariaLabel="Arkadaşını Davet Et"
            disabled={ctaDisabledInvite}
            onClick={() => { sounds.tap(); setFriendModalOpen(true); }}
          />
          <ModeButton
            testId="online-kapis-entry"
            icon={Shuffle}
            label="Online Kapış"
            ariaLabel="Online Kapış"
            disabled={ctaDisabledRandom}
            onClick={handleStartRandom}
          />
          <ModeButton
            testId="duello-entry"
            icon={Target}
            label={DUELLO_DISPLAY_NAME}
            ariaLabel="Duello — Duelloya Başla"
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
          style={{
            color: '#F4F7FB',
            fontFamily: ONLINE_DISPLAY_FONT,
            fontSize: 'clamp(1.55rem, 6.5vw, 2rem)',
            fontWeight: 800,
            letterSpacing: 0,
            lineHeight: 1,
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

function ModeButton({ icon: Icon, label, ariaLabel, action, disabled, onClick, testId }) {
  return (
    <motion.button
      type="button"
      data-testid={testId}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel || label}
      whileTap={disabled ? undefined : { scale: 0.98 }}
      className="kx-a1-pressable w-full flex items-center text-left disabled:opacity-55"
      style={{
        gap: 'clamp(0.8rem, 3.5vw, 1rem)',
        padding: 'clamp(0.8rem, 2.4dvh, 1rem) clamp(0.9rem, 4vw, 1.15rem)',
        minHeight: 'clamp(4.35rem, 10dvh, 5.15rem)',
        borderRadius: 'clamp(0.65rem, 3vw, 0.9rem)',
        background: '#102A4A',
        border: '0.0625rem solid #55D8FF3D',
        boxShadow: 'inset 0 0.0625rem 0 rgba(255,255,255,0.04), 0 0.65rem 1.25rem rgba(2,6,23,0.26)',
      }}
    >
      <span
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
        style={{ background: 'rgba(250,204,21,0.12)', boxShadow: 'inset 0 0 0 1px rgba(250,204,21,0.40)' }}
      >
        <Icon style={{ width: 22, height: 22, color: '#facc15' }} strokeWidth={2.2} />
      </span>
      <span className="min-w-0 flex-1">
        <span
          className="block"
          style={{
            color: '#F4F7FB',
            fontFamily: ONLINE_DISPLAY_FONT,
            fontSize: 'clamp(1.1rem, 5vw, 1.35rem)',
            fontWeight: 700,
            letterSpacing: 0,
            lineHeight: 1.05,
          }}
        >
          {label}
        </span>
        {action && (
          <span
            className="mt-2 inline-flex items-center justify-center"
            style={{
              width: 'fit-content',
              minHeight: 'clamp(1.9rem, 5dvh, 2.2rem)',
              padding: '0.32rem clamp(0.7rem, 3vw, 0.9rem)',
              borderRadius: '0.5rem',
              background: '#FFC928',
              color: '#081327',
              fontFamily: ONLINE_DISPLAY_FONT,
              fontSize: 'clamp(0.9rem, 4vw, 1.02rem)',
              fontWeight: 700,
              letterSpacing: 0,
              lineHeight: 1,
              boxShadow: '0 0.25rem 0.55rem rgba(2,6,23,0.22)',
            }}
          >
            {action}
          </span>
        )}
      </span>
    </motion.button>
  );
}
