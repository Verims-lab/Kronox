import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Play } from 'lucide-react';
import { sounds } from '@/lib/gameSounds';
import { base44 } from '@/api/base44Client';
import ScreenHeader from '@/components/layout/ScreenHeader';
import LevelPathRow from '@/components/solo/LevelPathRow';
import {
  buildSoloGameConfigForLevel,
  getSoloLevels,
  readSoloProgress,
} from '@/lib/soloLevels';

/**
 * Codex106 — Solo entry = vertical Level Path.
 *
 *   - No category select; the screen opens directly on the level list.
 *   - Per-user progress drives status (completed/current/locked) and stars.
 *   - Replay of completed levels is allowed (Play still works).
 *   - Locked levels: not selectable, Play is a no-op.
 *   - BottomNav stays visible here (we don't call setBottomNavHidden), so
 *     /game and /lobby visibility rules are preserved exactly.
 *   - No page scroll: the column shrinks/grows around a flexible middle.
 *
 * Game flow (10 cards / 120s / 8-mistake fail) is enforced inside Game.jsx
 * via the `soloLevel` field of route state — see `buildSoloGameConfigForLevel`.
 */
export default function SoloChallenge() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [progress, setProgress] = useState(() => readSoloProgress(null));

  // Pull the latest user + their persisted solo_progress.
  useEffect(() => {
    let cancelled = false;
    base44.auth.me()
      .then((u) => {
        if (cancelled) return;
        setUser(u || null);
        setProgress(readSoloProgress(u || null));
      })
      .catch(() => {
        if (cancelled) return;
        setUser(null);
        setProgress(readSoloProgress(null));
      });
    return () => { cancelled = true; };
  }, []);

  // When Game finishes a level attempt it navigates back here with
  // location.state.soloResultApplied = true (after writing progress). We
  // re-read so the new stars/unlock state are reflected without a hard
  // reload. The state key is intentionally one-shot.
  useEffect(() => {
    if (!location.state?.soloResultApplied) return;
    base44.auth.me()
      .then((u) => setProgress(readSoloProgress(u || null)))
      .catch(() => setProgress(readSoloProgress(user)));
    // Clear the flag so re-entering this screen later doesn't keep refetching.
    navigate(location.pathname, { replace: true, state: {} });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state?.soloResultApplied]);

  const levels = useMemo(() => getSoloLevels(progress), [progress]);

  const initialSelectedNumber = useMemo(() => {
    const current = levels.find((l) => l.status === 'current');
    if (current) return current.levelNumber;
    const firstPlayable = levels.find((l) => l.isPlayable);
    return firstPlayable?.levelNumber ?? 1;
  }, [levels]);

  const [selectedLevelNumber, setSelectedLevelNumber] = useState(initialSelectedNumber);

  // Keep the selection in sync when progress refreshes (e.g. after a level
  // is passed and the next one unlocks → jump selection to the new current).
  useEffect(() => {
    setSelectedLevelNumber(initialSelectedNumber);
  }, [initialSelectedNumber]);

  const selectedLevel = levels.find((l) => l.levelNumber === selectedLevelNumber) || null;

  const handleSelectLevel = (level) => {
    if (!level.isPlayable) return;
    sounds.tap();
    setSelectedLevelNumber(level.levelNumber);
  };

  const handlePlay = () => {
    if (!selectedLevel || !selectedLevel.isPlayable) return;
    sounds.tap();
    const config = buildSoloGameConfigForLevel(selectedLevel);
    navigate('/game', { state: config });
  };

  const playDisabled = !selectedLevel || !selectedLevel.isPlayable;

  return (
    <div
      className="fixed inset-0 flex flex-col text-white"
      style={{
        background:
          'radial-gradient(ellipse at 50% 6%, rgba(59,130,246,0.22), transparent 50%), radial-gradient(ellipse at 50% 96%, rgba(34,211,238,0.10), transparent 55%), linear-gradient(180deg, #050b1c 0%, #0a1738 55%, #03060f 100%)',
        userSelect: 'none',
        overscrollBehavior: 'none',
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

      <div
        className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col px-4"
        style={{
          paddingTop: 'calc(3.75rem + env(safe-area-inset-top))',
          paddingBottom: 'calc(9rem + env(safe-area-inset-bottom))',
          minHeight: 0,
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="text-center"
        >
          <h2
            className="font-cinzel text-lg font-black tracking-[0.22em]"
            style={{
              color: '#facc15',
              textShadow: '0 0 12px rgba(250,204,21,0.4), 0 2px 4px rgba(0,0,0,0.6)',
            }}
          >
            SOLO MEYDAN OKUMA
          </h2>
          <p className="mt-1 font-inter text-[12px] text-blue-100/70">
            Zamanı sırala, tarihe hükmet.
          </p>
        </motion.div>

        <div className="mt-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-amber-200/20" />
          <span className="font-inter text-[10px] font-black tracking-[0.28em] text-amber-200/80">
            LEVEL PATH
          </span>
          <div className="h-px flex-1 bg-amber-200/20" />
        </div>

        <div className="mt-3 flex flex-1 flex-col" style={{ minHeight: 0 }}>
          <div className="my-auto flex flex-col gap-1.5">
            {levels.map((level) => (
              <LevelPathRow
                key={level.levelNumber}
                level={level}
                selected={level.levelNumber === selectedLevelNumber}
                onSelect={() => handleSelectLevel(level)}
              />
            ))}
          </div>
        </div>
      </div>

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
          OYNA
        </motion.button>
      </div>
    </div>
  );
}