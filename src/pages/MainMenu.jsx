import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Clock3, ScrollText, Swords, TimerReset, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { sounds } from '@/lib/gameSounds';
import { useAuth } from '@/lib/AuthContext';
import StandardTopBar from '@/components/layout/StandardTopBar';
import DailyWheelCard from '@/components/dailyWheel/DailyWheelCard';
import { DailyQuestV1Card } from '@/components/dailyWheel/DailyRewardsPanel';
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

const HOME_LOGO_SRC = '/assets/ui/kronox-logo-home.png';
const HOME_HOURGLASS_SRC = 'https://base44.app/api/apps/6a05b47e401bb23c2f21a522/files/mp/public/6a05b47e401bb23c2f21a522/b19153430_kronox-hourglass-home-v2.png';

export default function MainMenu() {
  const navigate = useNavigate();
  const { user: authUser, guestProfile } = useAuth();
  const [localUser, setLocalUser] = useState(authUser || null);
  const [localGuestProfile, setLocalGuestProfile] = useState(guestProfile || null);
  const [activeShortcut, setActiveShortcut] = useState(null);
  const user = localUser || authUser || null;
  const completedGuestProfile = !user && isGuestOnboardingComplete(localGuestProfile || guestProfile)
    ? (localGuestProfile || guestProfile)
    : null;

  useEffect(() => { setLocalUser(authUser || null); }, [authUser]);
  useEffect(() => { setLocalGuestProfile(guestProfile || null); }, [guestProfile]);

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

  const handleSolo = () => {
    sounds.tap();
    navigate('/solo');
  };

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
          bottom: 'calc(env(safe-area-inset-bottom) + 4.15rem)',
          paddingLeft: 'calc(env(safe-area-inset-left) + 1.15rem)',
          paddingRight: 'calc(env(safe-area-inset-right) + 1.15rem)',
        }}
        aria-label="Kronox Ana Sayfa"
      >
        <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-between gap-3">
          <img
            src={HOME_LOGO_SRC}
            alt="Kronox"
            draggable="false"
            className="block select-none"
            style={{
              width: 'min(62vw, 280px)',
              height: 'auto',
              objectFit: 'contain',
              filter: 'drop-shadow(0 4px 10px rgba(0, 0, 0, 0.30)) drop-shadow(0 0 8px rgba(25, 130, 255, 0.16))',
            }}
          />

          <div className="grid w-full items-center gap-1" style={{ gridTemplateColumns: '4.75rem minmax(0, 1fr) 4.75rem' }}>
            <div className="relative z-10">
              <HomeShortcut
                label="Görevler"
                icon={ScrollText}
                tone="cyan"
                onClick={() => handleShortcut('quests')}
              />
            </div>
            <HomeTimeArtifact />
            <div className="relative z-10">
              <HomeShortcut
                label="Çark"
                icon={TimerReset}
                tone="gold"
                onClick={() => handleShortcut('wheel')}
              />
            </div>
          </div>

          <div className="flex w-full flex-col gap-3">
            <HomeCTA
              icon={Clock3}
              label="SOLO MEYDAN OKUMA"
              onClick={handleSolo}
              ariaLabel="Solo Meydan Okuma"
              primary
            />
            <HomeCTA
              icon={Swords}
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
        onClose={() => setActiveShortcut(null)}
        onUserUpdated={handleDailyWheelUserPatch}
      />
    </main>
  );
}

function HomeShortcut({ label, icon: Icon, tone, onClick }) {
  const isGold = tone === 'gold';
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-w-0 flex-col items-center justify-center gap-1.5 text-center font-inter active:scale-95"
      style={{ touchAction: 'manipulation' }}
      aria-label={label}
    >
      <span
        className="relative grid h-11 w-11 place-items-center rounded-full"
        style={{
          background: 'linear-gradient(160deg, #102A4A 0%, #071A33 100%)',
          border: `1px solid ${isGold ? 'rgba(255, 201, 40, 0.46)' : 'rgba(85, 216, 255, 0.42)'}`,
          color: isGold ? '#FFC928' : '#55D8FF',
          boxShadow: isGold
            ? '0 0 14px rgba(255, 201, 40, 0.12), inset 0 0 0 1px rgba(255,255,255,0.05)'
            : '0 0 14px rgba(85, 216, 255, 0.10), inset 0 0 0 1px rgba(255,255,255,0.05)',
        }}
      >
        <Icon className="h-5 w-5" strokeWidth={2.35} />
      </span>
      <span className="text-[11px] font-bold leading-none text-blue-50">{label}</span>
    </button>
  );
}

function HomeTimeArtifact() {
  // Static, single-file illustrated centerpiece per the Home spec:
  // an ornate gold + navy hourglass resting on a glowing zodiac clock-ring.
  // Kept intentionally static (no coded animation) with only a controlled
  // radial glow behind it so it anchors the page without competing with the
  // logo or the main CTA buttons.
  return (
    <div
      className="relative mx-auto grid place-items-center"
      aria-hidden="true"
      style={{ width: 'min(72vw, 300px)', height: 'min(40dvh, 300px)', minHeight: 180 }}
    >
      <div
        className="pointer-events-none absolute rounded-full"
        style={{
          width: '86%',
          height: '86%',
          background:
            'radial-gradient(circle at 50% 46%, rgba(255,201,40,0.22) 0%, rgba(85,216,255,0.10) 40%, transparent 68%)',
          filter: 'blur(2px)',
        }}
      />
      <img
        src={HOME_HOURGLASS_SRC}
        alt=""
        draggable="false"
        loading="eager"
        className="relative block h-full w-full select-none object-contain"
        style={{
          // Radial alpha mask feathers the solid-navy image edges into the
          // Home gradient so there is no visible rectangular seam.
          WebkitMaskImage:
            'radial-gradient(ellipse 68% 72% at 50% 50%, #000 58%, transparent 82%)',
          maskImage:
            'radial-gradient(ellipse 68% 72% at 50% 50%, #000 58%, transparent 82%)',
          filter:
            'drop-shadow(0 12px 24px rgba(0, 0, 0, 0.34)) drop-shadow(0 0 18px rgba(255, 201, 40, 0.14))',
        }}
      />
    </div>
  );
}

function HomeCTA({ icon: Icon, label, onClick, ariaLabel, primary = false }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ y: 2, scale: 0.985 }}
      transition={{ type: 'spring', stiffness: 620, damping: 26, mass: 0.7 }}
      className="relative flex w-full items-center text-amber-950"
      style={{
        appearance: 'none',
        height: 'clamp(56px, 9dvh, 70px)',
        padding: '0 1rem 0 1.05rem',
        borderRadius: 18,
        border: primary ? '1px solid rgba(255, 227, 109, 0.78)' : '1px solid rgba(255, 201, 40, 0.52)',
        background: primary
          ? 'linear-gradient(180deg, #FFE36D 0%, #FFC928 52%, #E4A600 100%)'
          : 'linear-gradient(180deg, #FFD955 0%, #F4BD12 56%, #C98C05 100%)',
        boxShadow: primary
          ? '0 7px 0 #A97400, 0 12px 24px rgba(0, 0, 0, 0.26), 0 0 16px rgba(255, 201, 40, 0.20), inset 0 1px 0 rgba(255,255,255,0.62)'
          : '0 5px 0 #8D6200, 0 10px 20px rgba(0, 0, 0, 0.24), 0 0 10px rgba(255, 201, 40, 0.12), inset 0 1px 0 rgba(255,255,255,0.48)',
        color: '#101827',
        touchAction: 'manipulation',
      }}
      aria-label={ariaLabel}
    >
      <Icon className="h-6 w-6 shrink-0" strokeWidth={2.5} />
      <span
        aria-hidden="true"
        className="mx-3 shrink-0"
        style={{
          width: 1.5,
          height: '54%',
          background: 'rgba(16, 24, 39, 0.42)',
          borderRadius: 1,
        }}
      />
      <span
        className="min-w-0 flex-1 truncate text-left"
        style={{
          fontFamily: "'Barlow Condensed', var(--font-inter)",
          fontSize: 22,
          lineHeight: 1,
          fontStyle: 'italic',
          fontWeight: 800,
          letterSpacing: '0',
        }}
      >
        {label}
      </span>
      <ChevronRight className="h-6 w-6 shrink-0" strokeWidth={2.7} />
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
          className="fixed inset-0 z-[140] flex items-end justify-center bg-slate-950/58 px-4 pb-4 pt-20 backdrop-blur-sm"
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
            initial={{ y: 24, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 18, opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            onClick={(event) => event.stopPropagation()}
            style={{
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