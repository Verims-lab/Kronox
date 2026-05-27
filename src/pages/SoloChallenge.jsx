import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Play } from 'lucide-react';
import { sounds } from '@/lib/gameSounds';
import { base44 } from '@/api/base44Client';
import ScreenHeader from '@/components/layout/ScreenHeader';
import LevelPathRow from '@/components/solo/LevelPathRow';
import { buildSoloGameConfigForLevel, getSoloLevels } from '@/lib/soloLevels';

/**
 * Codex106 — Solo entry screen is now a vertical Level Path.
 *
 * Behavior summary (full rationale lives in lib/soloLevels.js):
 *   - No category select. The screen opens directly on the level list.
 *   - Each level row shows: number, title, stars (0–3), state.
 *   - Completed levels are dimmed but replayable (so users can chase 3⭐).
 *   - The lowest non-completed level is "current" (amber-glow row).
 *   - Locked levels show a lock icon and cannot be selected.
 *   - Header: back (left) · chip slot (center-right, hidden if no real
 *     economy) · avatar (right) — via ScreenHeader.
 *   - BottomNav stays visible on this screen (no setBottomNavHidden here),
 *     so the existing /game + /lobby visibility rules are preserved.
 *   - Layout fits the viewport: header (top), level list (middle, hosts its
 *     own internal scroll only if absolutely needed via min-h-0), Play
 *     button + BottomNav (bottom). The page itself does not scroll.
 *   - Play maps the selected level to the *existing* solo game route state
 *     (playerNames/category/yearStart/yearEnd/turnDuration) — Game.jsx,
 *     drag/drop, Timeline, QuestionCard and question generation are
 *     untouched.
 *
 * Backlog (intentionally not done now): real persistent level progress,
 * final star scoring algorithm, real diamond/chip economy, per-level
 * question pools, deeper animations.
 */
export default function SoloChallenge() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  // Level list is computed once per mount from local progress storage.
  // Reading on every render would be wasteful and could flicker if storage
  // is mutated mid-render in a future iteration.
  const levels = useMemo(() => getSoloLevels(), []);

  // Selected level defaults to the "current" row, falling back to the first
  // playable row, falling back to level 1 — never null so Play always has
  // something to act on (but Play still no-ops on locked).
  const initialSelectedNumber = useMemo(() => {
    const current = levels.find((l) => l.status === 'current');
    if (current) return current.levelNumber;
    const firstPlayable = levels.find((l) => l.isPlayable);
    return firstPlayable?.levelNumber ?? 1;
  }, [levels]);

  const [selectedLevelNumber, setSelectedLevelNumber] = useState(initialSelectedNumber);
  const selectedLevel = levels.find((l) => l.levelNumber === selectedLevelNumber) || null;

  useEffect(() => {
    base44.auth.me().then((u) => setUser(u || null)).catch(() => setUser(null));
  }, []);

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
      {/* Standardized header — chip is intentionally null (no fake economy). */}
      <ScreenHeader
        title="Solo"
        showBack
        user={user}
        chipValue={null}
        onBack={() => navigate('/')}
      />

      {/*
        Main column. We use a flex column with min-h-0 on the scrollable
        middle slot so the level list can shrink on small phones without
        pushing the Play button under the BottomNav.

        Spacing buffers:
          - pt: header height + 0.25rem breathing room
          - pb: Play button height (≈4.5rem) + BottomNav (≈4rem) + safe area
      */}
      <div
        className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col px-4"
        style={{
          paddingTop: 'calc(3.75rem + env(safe-area-inset-top))',
          paddingBottom: 'calc(9rem + env(safe-area-inset-bottom))',
          minHeight: 0,
        }}
      >
        {/* Section title */}
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

        {/* Divider with "LEVEL PATH" label */}
        <div className="mt-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-amber-200/20" />
          <span className="font-inter text-[10px] font-black tracking-[0.28em] text-amber-200/80">
            LEVEL PATH
          </span>
          <div className="h-px flex-1 bg-amber-200/20" />
        </div>

        {/*
          Level list. flex-1 + min-h-0 + overflow-hidden makes the list
          claim available vertical space without forcing the page to scroll.
          On very tiny phones the row gap is small (gap-1.5) so 8 rows still
          fit; on large phones the extra space stays as breathing room
          above/below — list is centered via mt-auto/mb-auto on the wrapper.
        */}
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

      {/*
        Sticky Play CTA — sits ABOVE the global BottomNav (which is ~4rem
        tall + safe area). We don't hide BottomNav here per the brief.
      */}
      <div
        className="fixed left-0 right-0 z-40 px-4"
        style={{
          bottom: 'calc(4rem + env(safe-area-inset-bottom))',
          paddingBottom: '0.5rem',
          background:
            'linear-gradient(to top, #03060f 65%, rgba(3,6,15,0.6) 90%, transparent)',
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