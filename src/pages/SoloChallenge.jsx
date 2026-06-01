import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import StandardTopBar from '@/components/layout/StandardTopBar';
import LevelMapPath from '@/components/solo/LevelMapPath';
import {
  buildSoloGameConfigForLevel,
  ensureSoloProgressBackfill,
  getSoloLevelCount,
  getSoloLevels,
  readSoloProgress,
} from '@/lib/soloLevels';
import { getDefaultSelectedLevel } from '@/lib/soloProgressHelpers';
import { getLeaderboardDiamondValue } from '@/lib/leaderboard';

/**
 * Solo "Seviye Yolu" — scrollable progression path.
 *
 * Layout
 *   • StandardTopBar (fixed, safe-area aware): back arrow + diamond chip +
 *     notification bell. Same component used by Home so the visual rhythm
 *     is identical across the app shell.
 *   • Title + tagline block right under the top bar.
 *   • LevelMapPath occupies the rest of the viewport and owns the scroll.
 *     The current/next "SIRADAKİ" seviye is highlighted; tapping it starts
 *     the level immediately. There is NO bottom CTA — the highlighted
 *     node itself is the action.
 *   • Global BottomNav (App.jsx) stays fixed at the bottom; we reserve
 *     space for it inside LevelMapPath so Seviye 1 is never hidden.
 *
 * Data
 *   • The catalog supports up to 1000 levels (see lib/soloLevels). The
 *     map only mounts a window around the focused level so DOM stays
 *     light even at very high level numbers.
 *   • Progress persistence is unchanged; we still rely on
 *     readSoloProgress / ensureSoloProgressBackfill / buildSoloGameConfigForLevel.
 */
export default function SoloChallenge() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [progress, setProgress] = useState(() => readSoloProgress(null));

  useEffect(() => {
    let cancelled = false;
    base44.auth.me()
      .then(async (u) => {
        if (cancelled) return;
        const normalized = await ensureSoloProgressBackfill(u || null);
        if (cancelled) return;
        setUser(u || null);
        setProgress(normalized);
      })
      .catch(() => {
        if (cancelled) return;
        setUser(null);
        setProgress(readSoloProgress(null));
      });
    return () => { cancelled = true; };
  }, []);

  // After a level attempt, refresh progress and clear the one-shot flag.
  useEffect(() => {
    if (!location.state?.soloResultApplied) return;
    base44.auth.me()
      .then(async (u) => setProgress(await ensureSoloProgressBackfill(u || null)))
      .catch(() => setProgress(readSoloProgress(user)));
    navigate(location.pathname, { replace: true, state: {} });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state?.soloResultApplied]);

  const levels = useMemo(() => getSoloLevels(progress), [progress]);
  const totalLevels = getSoloLevelCount();
  const focusLevel = useMemo(
    () => getDefaultSelectedLevel(progress, totalLevels),
    [progress, totalLevels],
  );

  // Tapping a node = play that seviye directly (no separate Play CTA).
  // Locked nodes ignore the tap (handled inside LevelMapPath).
  const handleSelectLevel = (level) => {
    if (!level || !level.isPlayable) return;
    const config = buildSoloGameConfigForLevel(level);
    navigate('/game', { state: config });
  };

  // Reserve space for the global BottomNav + a small breathing buffer so
  // the bottom-most node in the scroll viewport stays visible.
  const BOTTOM_RESERVED_PX = 96;

  return (
    <div
      className="flex flex-col text-white"
      style={{
        height: '100dvh',
        minHeight: '100dvh',
        background:
          'radial-gradient(ellipse at 50% 6%, rgba(59,130,246,0.22), transparent 50%), radial-gradient(ellipse at 50% 96%, rgba(34,211,238,0.10), transparent 55%), linear-gradient(180deg, #050b1c 0%, #0a1738 55%, #03060f 100%)',
        userSelect: 'none',
        overflow: 'hidden',
      }}
    >
      {/* Fixed top bar — shared with Home */}
      <StandardTopBar
        showBack
        onBack={() => navigate('/')}
        diamonds={getLeaderboardDiamondValue(user)}
        user={user}
      />

      {/* Title block. Sits right under the top bar; the scrollable map
          starts immediately below. */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="px-4 text-center"
        style={{
          paddingTop: 'calc(3.5rem + env(safe-area-inset-top))',
          paddingBottom: '0.5rem',
        }}
      >
        {/* Title — light/elegant per the reference. NOT bold/heavy. */}
        <h2
          className="font-inter"
          style={{
            color: '#f1f5ff',
            fontSize: 'clamp(15px, 4.4vw, 18px)',
            fontWeight: 400,
            letterSpacing: '0.32em',
            textShadow: '0 1px 2px rgba(0,0,0,0.45)',
          }}
        >
          SOLO MEYDAN OKUMA
        </h2>
        <div className="mt-1.5 flex items-center justify-center gap-2" aria-hidden="true">
          <span
            style={{
              display: 'block',
              height: 1,
              width: '36px',
              background: 'linear-gradient(90deg, transparent, rgba(250,204,21,0.65), transparent)',
            }}
          />
          <span
            style={{
              display: 'block',
              width: 7,
              height: 7,
              background: '#facc15',
              transform: 'rotate(45deg)',
              boxShadow: '0 0 6px rgba(250,204,21,0.55)',
            }}
          />
          <span
            style={{
              display: 'block',
              height: 1,
              width: '36px',
              background: 'linear-gradient(90deg, transparent, rgba(250,204,21,0.65), transparent)',
            }}
          />
        </div>
        {/* Subtitle — clean, light, single elegant line per reference. */}
        <p
          className="mt-2 font-inter"
          style={{
            fontSize: 'clamp(11px, 3vw, 13px)',
            fontWeight: 400,
            letterSpacing: '0.01em',
            color: 'rgba(199,210,234,0.78)',
          }}
        >
          Kendini geliştir, seviyeni yükselt, zirveye ulaş!
        </p>
      </motion.div>

      {/* Scrollable map area — bottom of this flex column. Bottom-nav is
          rendered globally by App.jsx; LevelMapPath reserves space for it. */}
      <div
        className="flex flex-1 flex-col"
        style={{
          minHeight: 0,
          paddingBottom: 'calc(3.5rem + env(safe-area-inset-bottom))', // BottomNav reserve
        }}
      >
        <LevelMapPath
          levels={levels}
          focusLevelNumber={focusLevel}
          onSelectLevel={handleSelectLevel}
          bottomReservedPx={BOTTOM_RESERVED_PX}
        />
      </div>
    </div>
  );
}