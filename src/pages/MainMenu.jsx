import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ScrollText, TimerReset, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { sounds } from '@/lib/gameSounds';
import { useAuth } from '@/lib/AuthContext';
import StandardTopBar from '@/components/layout/StandardTopBar';
import DailyWheelCard from '@/components/dailyWheel/DailyWheelCard';
import { DailyQuestV1Card } from '@/components/dailyWheel/DailyRewardsPanel';
import { useDailyWheel } from '@/hooks/useDailyWheel';
import { useDailyQuests } from '@/hooks/useDailyQuests';
import {
  getGuestLeaderboardOwnerKey,
  getLeaderboardDiamondValue,
  getLeaderboardOwnerKey,
  getLeaderboardSnapshotCacheKey,
  LEADERBOARD_FAST_SNAPSHOT_OPTIONS,
  LEADERBOARD_FETCH_LIMIT,
  LEADERBOARD_TOP_LIMIT,
  loadSoloLeaderboardSnapshot,
  setCachedSoloLeaderboardSnapshot,
} from '@/lib/leaderboard';
import { getCompletedGuestCredentialsPayload, isGuestOnboardingComplete } from '@/lib/guestProfile';
import { getUserJokerBalances } from '@/lib/jokerInventory';
import {
  buildSoloGameConfigForLevel,
  ensureSoloProgressBackfill,
  getSoloLevelCount,
  getSoloLevels,
  readSoloProgress,
} from '@/lib/soloLevels';
import { getDefaultSelectedLevel } from '@/lib/soloProgressHelpers';

// Local/project-approved visual assets only. No remote (https/http) asset URLs
// are used on Home — the no-remote-visual-assets Health contract scans this
// file and forbids new remote image references on approved visual surfaces.
const HOME_LOGO_SRC = '/assets/ui/kronox-logo-home.png';
const HOME_HOURGLASS_SRC = '/assets/ui/kronox-hourglass-home.png';
const HOME_BOTTOM_NAV_HEIGHT = '3.6rem';
const HOME_CTA_BALANCE_GAP = 'clamp(1rem, 3dvh, 2rem)';
const HOME_MIDDLE_STAGE_HEIGHT = 'clamp(14rem, 38dvh, 20rem)';

export default function MainMenu() {
  const navigate = useNavigate();
  const { user: authUser, guestProfile, isLoadingAuth, authChecked } = useAuth();
  const [localUser, setLocalUser] = useState(authUser || null);
  const [localGuestProfile, setLocalGuestProfile] = useState(guestProfile || null);
  const [activeShortcut, setActiveShortcut] = useState(null);
  const [soloProgress, setSoloProgress] = useState(() => readSoloProgress(null));
  const [soloProgressLoaded, setSoloProgressLoaded] = useState(false);
  const user = localUser || authUser || null;
  const completedGuestProfile = !user && isGuestOnboardingComplete(localGuestProfile || guestProfile)
    ? (localGuestProfile || guestProfile)
    : null;
  const soloProgressPlayer = user || completedGuestProfile || null;
  // Resolved linked-or-guest rewards player. Completed guests remain valid
  // reward players (Daily Wheel / Daily Quest) without login; the shortcuts
  // and wheel status are gated by this resolved player, not by a logged-in
  // Base44 user only.
  const rewardsPlayer = user || completedGuestProfile || null;

  useEffect(() => { setLocalUser(authUser || null); }, [authUser]);
  useEffect(() => { setLocalGuestProfile(guestProfile || null); }, [guestProfile]);

  useEffect(() => {
    let cancelled = false;
    setSoloProgressLoaded(false);
    ensureSoloProgressBackfill(soloProgressPlayer)
      .then((normalizedProgress) => {
        if (cancelled) return;
        setSoloProgress(normalizedProgress || readSoloProgress(soloProgressPlayer));
        setSoloProgressLoaded(true);
      })
      .catch(() => {
        if (cancelled) return;
        setSoloProgress(readSoloProgress(soloProgressPlayer));
        setSoloProgressLoaded(true);
      });
    return () => { cancelled = true; };
  }, [soloProgressPlayer]);

  useEffect(() => {
    let cancelled = false;
    const warmMarket = () => {
      if (cancelled) return;
      import('./MarketPage').catch(() => null);
      import('./LeaderboardPage').catch(() => null);
      if (authUser?.email) {
        getUserJokerBalances(authUser, { ensureStarter: false }).catch(() => null);
      }
      const leaderboardOwnerKey = authUser?.email
        ? getLeaderboardOwnerKey(authUser.email)
        : getGuestLeaderboardOwnerKey(completedGuestProfile?.guest_id);
      if (leaderboardOwnerKey) {
        loadSoloLeaderboardSnapshot({
          limit: LEADERBOARD_FETCH_LIMIT,
          topLimit: LEADERBOARD_TOP_LIMIT,
          payload: completedGuestProfile ? getCompletedGuestCredentialsPayload(completedGuestProfile) : {},
          ...LEADERBOARD_FAST_SNAPSHOT_OPTIONS,
        })
          .then((snapshot) => {
            if (!cancelled) {
              setCachedSoloLeaderboardSnapshot(getLeaderboardSnapshotCacheKey(leaderboardOwnerKey), snapshot);
            }
          })
          .catch(() => null);
      }
    };
    if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(warmMarket, { timeout: 5000 });
      return () => {
        cancelled = true;
        window.cancelIdleCallback?.(id);
      };
    }
    const id = window.setTimeout(warmMarket, 1800);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [authUser, completedGuestProfile]);

  const diamonds = useMemo(
    () => getLeaderboardDiamondValue(user || completedGuestProfile),
    [completedGuestProfile, user],
  );

  // Lightweight ready-state signals for the Görevler/Çark shortcut badges.
  // These reuse the existing daily wheel/quest status hooks (server-owned
  // source of truth) purely to decide whether to render a small badge.
  const dailyWheel = useDailyWheel({ user, guestProfile: completedGuestProfile });
  const dailyQuests = useDailyQuests({ user, guestProfile: completedGuestProfile });
  // Ready badges only render for a resolved rewards player (linked-or-guest)
  // and never block first render on reward status.
  const wheelReady = Boolean(rewardsPlayer) && dailyWheel?.isAvailable === true;
  const questReady = useMemo(
    () => Boolean(rewardsPlayer) && (dailyQuests?.quests || []).some((quest) => quest?.status === 'completed'),
    [dailyQuests?.quests, rewardsPlayer],
  );
  const soloTotalLevels = getSoloLevelCount();
  const homeSoloLevelNumber = useMemo(
    () => getDefaultSelectedLevel(soloProgress, soloTotalLevels),
    [soloProgress, soloTotalLevels],
  );
  const homeSoloLevel = useMemo(() => {
    const levels = getSoloLevels(soloProgress);
    return levels.find((level) => level.levelNumber === homeSoloLevelNumber)
      || { levelNumber: homeSoloLevelNumber, isPlayable: true };
  }, [homeSoloLevelNumber, soloProgress]);
  const soloCtaDisabled = isLoadingAuth || !authChecked || !soloProgressLoaded || !homeSoloLevel?.isPlayable;

  useEffect(() => {
    if (!rewardsPlayer) return;
    if (activeShortcut) return;
    if (dailyWheel?.shouldAutoOpen !== true) return;
    setActiveShortcut('wheel');
  }, [activeShortcut, dailyWheel?.shouldAutoOpen, rewardsPlayer]);

  const handleSolo = useCallback(() => {
    if (soloCtaDisabled) return;
    sounds.tap();
    navigate('/game', { state: buildSoloGameConfigForLevel(homeSoloLevel) });
  }, [homeSoloLevel, navigate, soloCtaDisabled]);

  const handleOnline = () => {
    sounds.tap();
    if (!user) base44.auth.redirectToLogin('/');
    else navigate('/lobby');
  };

  const handleMarket = () => {
    navigate('/market');
  };

  const handleShortcut = (shortcut) => {
    sounds.tap();
    setActiveShortcut(shortcut);
  };

  const handleDailyWheelUserPatch = useCallback((patch) => {
    if (!patch || typeof patch !== 'object') return;
    if (user) {
      setLocalUser((current) => ({
        ...(current || user || {}),
        ...patch,
      }));
      return;
    }
    setLocalGuestProfile((current) => ({
      ...(current || completedGuestProfile || {}),
      ...patch,
    }));
  }, [completedGuestProfile, user]);

  return (
    <main
      className="fixed inset-0 w-full overflow-hidden text-white"
      style={{
        width: '100%',
        minHeight: '100dvh',
        height: '100dvh',
        maxHeight: '100dvh',
        overflow: 'hidden',
        overscrollBehavior: 'none',
        touchAction: 'manipulation',
        userSelect: 'none',
        contain: 'layout paint size',
        background:
          'radial-gradient(ellipse at 50% 30%, rgba(58, 137, 220, 0.22) 0%, rgba(25, 77, 139, 0.10) 34%, transparent 62%), linear-gradient(180deg, #061225 0%, #0A2346 46%, #0B2852 68%, #061225 100%)',
      }}
    >
      <StandardTopBar
        diamonds={diamonds}
        user={user}
        showMarket
        onMarket={handleMarket}
        onDiamondClick={handleMarket}
        variant="home"
      />

      <section
        className="absolute left-0 right-0 mx-auto flex w-full max-w-[28rem] flex-col items-center"
        style={{
          top: 'calc(env(safe-area-inset-top) + 4.1rem)',
          paddingLeft: 'calc(env(safe-area-inset-left) + 1.15rem)',
          paddingRight: 'calc(env(safe-area-inset-right) + 1.15rem)',
          bottom: `calc(env(safe-area-inset-bottom) + ${HOME_BOTTOM_NAV_HEIGHT})`,
        }}
        aria-label="Kronox Ana Sayfa"
      >
        <div className="flex min-h-0 w-full flex-1 flex-col items-center">
          <img
            src={HOME_LOGO_SRC}
            alt="Kronox"
            draggable="false"
            className="block select-none"
            style={{
              width: 'min(74.4vw, 336px)',
              height: 'auto',
              objectFit: 'contain',
              filter: 'drop-shadow(0 4px 10px rgba(0, 0, 0, 0.30)) drop-shadow(0 0 8px rgba(25, 130, 255, 0.16))',
            }}
          />

          <div
            className="relative mt-auto w-full"
            style={{
              height: HOME_MIDDLE_STAGE_HEIGHT,
              minHeight: 216,
            }}
          >
            <div
              className="absolute left-0 top-1/2 z-10 flex w-20 -translate-y-1/2 justify-center"
            >
              <HomeShortcut
                label="Görevler"
                icon={ScrollText}
                tone="cyan"
                ready={Boolean(rewardsPlayer && questReady)}
                onClick={() => handleShortcut('quests')}
              />
            </div>
            <HomeTimeArtifact />
            <div
              className="absolute right-0 top-1/2 z-10 flex w-20 -translate-y-1/2 justify-center"
            >
              <HomeShortcut
                label="Çark"
                icon={TimerReset}
                tone="gold"
                ready={Boolean(rewardsPlayer && wheelReady)}
                onClick={() => handleShortcut('wheel')}
              />
            </div>
          </div>

          <div
            className="flex w-full flex-col"
            style={{ gap: 14, marginTop: HOME_CTA_BALANCE_GAP, marginBottom: HOME_CTA_BALANCE_GAP }}
          >
            <HomeCTA
              variant="solo"
              primaryLabel="OYNA"
              secondaryLabel={soloProgressLoaded ? `Seviye ${homeSoloLevelNumber}` : 'Seviye hazırlanıyor'}
              onClick={handleSolo}
              disabled={soloCtaDisabled}
              ariaLabel={soloProgressLoaded ? `Oyna Seviye ${homeSoloLevelNumber}` : 'Solo seviyesi hazırlanıyor'}
            />
            <HomeCTA
              variant="online"
              label="ONLINE KAPIŞMA"
              onClick={handleOnline}
              ariaLabel="Online Kapışma"
            />
          </div>
        </div>
      </section>

      <HomeShortcutModal
        activeShortcut={activeShortcut}
        user={user}
        guestProfile={completedGuestProfile}
        onClose={() => {
          if (activeShortcut === 'wheel') dailyWheel?.markAutoPopupShown?.();
          setActiveShortcut(null);
        }}
        onUserUpdated={handleDailyWheelUserPatch}
      />
    </main>
  );
}

function HomeShortcut({ label, icon: Icon, tone, ready = false, onClick }) {
  const isGold = tone === 'gold';
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-w-0 flex-col items-center justify-center gap-2 text-center active:scale-95"
      style={{ touchAction: 'manipulation' }}
      aria-label={label}
    >
      <span
        className="relative grid place-items-center rounded-full"
        style={{
          width: 44,
          height: 44,
          borderRadius: '50%',
          background: 'linear-gradient(160deg, #102A4A 0%, #071A33 100%)',
          border: '1px solid rgba(85, 216, 255, 0.42)',
          color: isGold ? '#FFC928' : '#55D8FF',
          // Inactive = subtle, non-glowing. Ready = a soft accent glow ring.
          boxShadow: ready
            ? (isGold
              ? '0 0 16px rgba(255, 201, 40, 0.28), inset 0 0 0 1px rgba(255,255,255,0.05)'
              : '0 0 16px rgba(85, 216, 255, 0.26), inset 0 0 0 1px rgba(255,255,255,0.05)')
            : 'inset 0 0 0 1px rgba(255,255,255,0.05)',
        }}
      >
        <Icon className="h-5 w-5" strokeWidth={2.35} />
        {ready && (
          <span
            aria-hidden="true"
            className="absolute"
            style={{
              top: -1,
              right: -1,
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: '#FFC928',
              boxShadow: '0 0 8px rgba(255, 201, 40, 0.55)',
            }}
          />
        )}
      </span>
      <span
        className="leading-none"
        style={{
          fontFamily: '"Inter", sans-serif',
          fontWeight: 600,
          fontSize: 11,
          color: '#F4F7FB',
          letterSpacing: '0',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </span>
    </button>
  );
}

function HomeTimeArtifact() {
  // Static, single-file illustrated centerpiece per the Home spec: an ornate
  // gold hourglass. It must float directly on the Home background — NO
  // container, panel, dark block, glow plate, or tinted backdrop behind it.
  // The local PNG has real alpha transparency; keep rendering normal and avoid
  // filters/backdrops that could create a rectangular shadow block around it.
  return (
    <div
      className="absolute left-1/2 top-1/2 grid -translate-x-1/2 -translate-y-1/2 place-items-center"
      aria-hidden="true"
      style={{ width: 'min(86.4vw, 360px)', height: '100%' }}
    >
      <img
        src={HOME_HOURGLASS_SRC}
        alt=""
        draggable="false"
        loading="eager"
        className="relative block h-full w-full select-none object-contain"
        style={{
          backgroundColor: 'transparent',
          filter: 'none',
        }}
      />
    </div>
  );
}

function HomeCTA({ variant, label, primaryLabel, secondaryLabel, onClick, ariaLabel, disabled = false }) {
  const isSolo = variant === 'solo';
  // Primary and secondary CTAs share the same box model so their dimensions
  // cannot drift while each keeps its own visual variant.
  const baseStyle = {
    appearance: 'none',
    height: 74,
    minHeight: 74,
    width: '100%',
    padding: '0 1.15rem',
    borderRadius: 22,
    boxSizing: 'border-box',
    touchAction: 'manipulation',
    opacity: disabled ? 0.72 : 1,
  };
  const variantStyle = isSolo
    ? {
      border: '0.12rem solid #FFE27A',
      background: 'linear-gradient(180deg, #FFD95A 0%, #FFC72C 45%, #F4B400 100%)',
      boxShadow: '0 0 1rem rgba(255, 199, 44, 0.45)',
      cursor: disabled ? 'default' : 'pointer',
    }
    : {
      border: '0.12rem solid #73E6FF',
      background: 'linear-gradient(180deg, #42D7FF 0%, #17BCE8 50%, #009FD1 100%)',
      boxShadow: '0 0 1rem rgba(66, 215, 255, 0.35)',
      cursor: 'pointer',
    };
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      whileTap={{ y: 2, scale: 0.985 }}
      transition={{ type: 'spring', stiffness: 620, damping: 26, mass: 0.7 }}
      className="relative flex items-center justify-center text-center"
      style={{ ...baseStyle, ...variantStyle }}
      aria-label={ariaLabel}
    >
      {isSolo ? (
        <span className="flex min-w-0 flex-col items-center justify-center" style={{ lineHeight: 1 }}>
          <span
            style={{
              fontFamily: '"Montserrat", sans-serif',
              fontSize: 'clamp(1.45rem, 7.2vw, 2rem)',
              fontWeight: 600,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: '#1B1B1B',
            }}
          >
            {primaryLabel}
          </span>
          <span
            style={{
              marginTop: 6,
              fontFamily: '"Montserrat", sans-serif',
              fontSize: 'clamp(0.72rem, 3.2vw, 0.92rem)',
              fontWeight: 500,
              letterSpacing: '0',
              color: '#3D3200',
            }}
          >
            {secondaryLabel}
          </span>
        </span>
      ) : (
        <span
          className="min-w-0 truncate"
          style={{
            fontFamily: '"Montserrat", sans-serif',
            fontSize: 'clamp(1.45rem, 7.2vw, 2rem)',
            lineHeight: 1,
            fontWeight: 600,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: '#FFFFFF',
          }}
        >
          {label}
        </span>
      )}
    </motion.button>
  );
}

function HomeShortcutModal({ activeShortcut, user, guestProfile, onClose, onUserUpdated }) {
  const isWheel = activeShortcut === 'wheel';
  const isQuests = activeShortcut === 'quests';
  return (
    <AnimatePresence>
      {(isWheel || isQuests) && (
        <motion.div
          className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-950/58 px-4 py-6 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-label={isWheel ? 'Çark' : 'Görevler'}
          onClick={onClose}
        >
          <motion.div
            className="w-full max-w-[24rem] rounded-[22px] p-3"
            initial={{ y: 10, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 8, opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            onClick={(event) => event.stopPropagation()}
            style={{
              maxHeight: 'calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 3rem)',
              overflowY: 'auto',
              border: '1px solid rgba(85, 216, 255, 0.26)',
              background: 'linear-gradient(180deg, rgba(16,38,75,0.98), rgba(6,18,37,0.98))',
              boxShadow: '0 24px 52px rgba(0,0,0,0.50), inset 0 0 0 1px rgba(255,255,255,0.05)',
            }}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="font-inter text-sm font-black text-white">{isWheel ? 'Çark' : 'Görevler'}</h2>
              <button
                type="button"
                onClick={onClose}
                className="grid h-9 w-9 place-items-center rounded-full text-blue-100/80 active:scale-95"
                style={{ background: 'rgba(255,255,255,0.06)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.12)' }}
                aria-label="Kapat"
              >
                <X className="h-4 w-4" strokeWidth={2.4} />
              </button>
            </div>
            {isWheel ? (
              <DailyWheelCard
                user={user}
                guestProfile={guestProfile}
                onUserUpdated={onUserUpdated}
                compact
                openClaimedResultOnMount
                onResultClose={onClose}
              />
            ) : (
              <DailyQuestV1Card
                user={user}
                guestProfile={guestProfile}
                onUserUpdated={onUserUpdated}
              />
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
