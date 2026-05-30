import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Play } from 'lucide-react';
import { sounds } from '@/lib/gameSounds';
import { base44 } from '@/api/base44Client';
import ScreenHeader from '@/components/layout/ScreenHeader';
import LevelMapPath from '@/components/solo/LevelMapPath';
import {
  buildSoloGameConfigForLevel,
  ensureSoloProgressBackfill,
  getSoloLevelCount,
  getSoloLevels,
  readSoloProgress,
} from '@/lib/soloLevels';
import { getDefaultSelectedLevel } from '@/lib/soloProgressHelpers';

/**
 * Codex108 — Solo entry is now a SCROLLABLE vertical adventure map.
 *
 *   - Level 1 sits at the bottom; progression goes upward.
 *   - On mount, the map auto-centers on the current level (so a Level 8
 *     player doesn't land on Level 1 or at the very top).
 *   - Per-user progress drives status (completed/current/locked) and stars.
 *   - Replay of completed levels is allowed (Play still works).
 *   - Locked levels: not selectable, Play is a no-op.
 *   - Every 5 levels announces a new zone/theme banner.
 *   - BottomNav stays visible here (we don't call setBottomNavHidden), so
 *     /game and /lobby visibility rules are preserved exactly.
 *
 * Game flow (10 cards / 120s / 8-mistake fail) is enforced inside Game.jsx
 * via the `soloLevel` field of route state — see `buildSoloGameConfigForLevel`.
 */
export default function SoloChallenge() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(null);
  // Codex110 — start with the localStorage mirror synchronously so a
  // returning player on the same device sees their real progress on the
  // very first paint, but TRACK whether we've also resolved the server
  // user. Until that flips true, the user has NOT explicitly chosen a
  // level yet, so the default selection follows progress. After it flips
  // true (or the user taps a node), selection is "sticky".
  const [progress, setProgress] = useState(() => readSoloProgress(null));
  const [progressLoaded, setProgressLoaded] = useState(false);
  const [userTouchedSelection, setUserTouchedSelection] = useState(false);

  // Pull the latest user + their persisted solo_progress.
  useEffect(() => {
    let cancelled = false;
    base44.auth.me()
      .then(async (u) => {
        if (cancelled) return;
        const normalizedProgress = await ensureSoloProgressBackfill(u || null);
        if (cancelled) return;
        setUser(u || null);
        setProgress(normalizedProgress);
        setProgressLoaded(true);
      })
      .catch(() => {
        if (cancelled) return;
        setUser(null);
        setProgress(readSoloProgress(null));
        setProgressLoaded(true);
      });
    return () => { cancelled = true; };
  }, []);

  // When Game finishes a level attempt it navigates back here with
  // location.state.soloResultApplied = true (after writing progress). We
  // re-read so the new stars/unlock state are reflected without a hard
  // reload. The state key is intentionally one-shot.
  useEffect(() => {
    if (!location.state?.soloResultApplied) return;
    // Reset the "user touched selection" flag so the freshly unlocked
    // level becomes the default focus again. This is the expected
    // behavior right after a pass: the screen should drop the player on
    // the NEXT level, not on whatever they last tapped before the run.
    setUserTouchedSelection(false);
    base44.auth.me()
      .then(async (u) => setProgress(await ensureSoloProgressBackfill(u || null)))
      .catch(() => setProgress(readSoloProgress(user)));
    // Clear the flag so re-entering this screen later doesn't keep refetching.
    navigate(location.pathname, { replace: true, state: {} });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state?.soloResultApplied]);

  const levels = useMemo(() => getSoloLevels(progress), [progress]);

  // Codex110 — Default selection uses the shared helper, which derives
  // the current playable level from BOTH persisted currentLevel AND the
  // highest-completed-level signal. This is the single source of truth.
  const defaultSelectedNumber = useMemo(
    () => getDefaultSelectedLevel(progress, getSoloLevelCount()),
    [progress],
  );

  const [selectedLevelNumber, setSelectedLevelNumber] = useState(defaultSelectedNumber);

  // Codex110 — Keep selection synced with progress UNLESS the user has
  // explicitly tapped a level. Once they tap, selection stays put even
  // if progress updates (e.g. background server fetch lands). After a
  // level attempt completes, the soloResultApplied effect clears the
  // "touched" flag so the new current level wins.
  useEffect(() => {
    if (userTouchedSelection) return;
    setSelectedLevelNumber(defaultSelectedNumber);
  }, [defaultSelectedNumber, userTouchedSelection]);

  const selectedLevel = levels.find((l) => l.levelNumber === selectedLevelNumber) || null;

  const handleSelectLevel = (level) => {
    if (!level.isPlayable) return;
    sounds.tap();
    setUserTouchedSelection(true);
    setSelectedLevelNumber(level.levelNumber);
  };

  const handlePlay = () => {
    if (!selectedLevel || !selectedLevel.isPlayable) return;
    sounds.tap();
    const config = buildSoloGameConfigForLevel(selectedLevel);
    navigate('/game', { state: config });
  };

  const playDisabled = !selectedLevel || !selectedLevel.isPlayable;

  // Reserved space for the floating Play button + BottomNav so Level 1
  // (rendered at the bottom of the scroll content) is never hidden.
  // 4rem BottomNav + 3.75rem Play + safe-area + padding ≈ 192px.
  const BOTTOM_RESERVED_PX = 192;

  return (
    <div
      className="flex min-h-screen flex-col text-white"
      style={{
        minHeight: '100dvh',
        background:
          'radial-gradient(ellipse at 50% 6%, rgba(59,130,246,0.22), transparent 50%), radial-gradient(ellipse at 50% 96%, rgba(34,211,238,0.10), transparent 55%), linear-gradient(180deg, #050b1c 0%, #0a1738 55%, #03060f 100%)',
        userSelect: 'none',
      }}
    >
      {/* chipValue=null on purpose — no real economy yet, no fake "1,250". */}
      <ScreenHeader
        title="Solo"
        showBack
        user={user}
        chipValue={null}
        onBack={() => navigate('/')}
      />

      {/* Scrollable map viewport — fills between ScreenHeader and the
          floating Play button. The map itself owns the scroll; the page
          body stays at viewport height so BottomNav doesn't drift. */}
      <div
        className="flex flex-1 flex-col"
        style={{
          paddingTop: 'calc(3.75rem + env(safe-area-inset-top))',
          minHeight: 0,
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="px-4 text-center"
        >
          <h2
            className="font-cinzel text-base font-black tracking-[0.22em]"
            style={{
              color: '#facc15',
              textShadow: '0 0 12px rgba(250,204,21,0.4), 0 2px 4px rgba(0,0,0,0.6)',
            }}
          >
            SOLO MACERA HARİTASI
          </h2>
          <p className="mt-0.5 font-inter text-[11px] text-blue-100/70">
            Aşağıdan yukarı tırman.
          </p>
        </motion.div>

        <div className="mt-2 flex flex-1" style={{ minHeight: 0 }}>
          <LevelMapPath
            levels={levels}
            selectedLevelNumber={selectedLevelNumber}
            onSelectLevel={handleSelectLevel}
            bottomReservedPx={BOTTOM_RESERVED_PX}
            focusLevelNumber={defaultSelectedNumber}
          />
        </div>
      </div>

      {/* Floating Play button — sits above BottomNav, never inside the
          scroll viewport. The gradient fade keeps the lowest map node
          visually readable behind it. */}
      <div
        className="fixed left-0 right-0 z-40 px-4"
        style={{
          bottom: 'calc(4rem + env(safe-area-inset-bottom))',
          paddingBottom: '0.5rem',
          background: 'linear-gradient(to top, #03060f 65%, rgba(3,6,15,0.6) 90%, transparent)',
        }}
      >
        <motion.button
          type="button"
          onClick={handlePlay}
          disabled={playDisabled}
          whileTap={playDisabled ? undefined : { scale: 0.97 }}
          animate={
            playDisabled
              ? undefined
              : {
                  boxShadow: [
                    '0 0 20px rgba(250,204,21,0.45), 0 4px 18px rgba(250,204,21,0.28)',
                    '0 0 36px rgba(250,204,21,0.75), 0 6px 30px rgba(250,204,21,0.42)',
                    '0 0 20px rgba(250,204,21,0.45), 0 4px 18px rgba(250,204,21,0.28)',
                  ],
                }
          }
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          className="mx-auto flex h-14 w-full max-w-md items-center justify-center gap-3 rounded-2xl font-bangers text-xl tracking-[0.28em] disabled:opacity-50"
          style={{
            background: playDisabled
              ? 'linear-gradient(135deg, #5a4a14 0%, #6b5318 50%, #4d3f10 100%)'
              : 'linear-gradient(135deg, #f5c400 0%, #facc15 50%, #e6b800 100%)',
            color: '#1a0a00',
          }}
          aria-label="Oyna"
        >
          <Play className="h-5 w-5" fill="#1a0a00" />
          {/* Codex110 — CTA label always derives from selectedLevel; falls
              back to the helper-computed default (current playable) until
              progress resolves. NEVER hard-coded to "LEVEL 1". */}
          {selectedLevel
            ? `LEVEL ${selectedLevel.levelNumber}`
            : progressLoaded
              ? `LEVEL ${defaultSelectedNumber}`
              : 'YÜKLENİYOR'}
        </motion.button>
      </div>
    </div>
  );
}
