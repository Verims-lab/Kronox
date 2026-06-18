import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, Users, Swords } from 'lucide-react';
import StandardTopBar from '@/components/layout/StandardTopBar';
import OnlineCategoryCarousel from '@/components/lobby/OnlineCategoryCarousel';
import FriendSelectModal from '@/components/lobby/FriendSelectModal';
import IncomingInvitesPanel from '@/components/invites/IncomingInvitesPanel';
import ActiveLobbyCard from '@/components/lobby/ActiveLobbyCard';
import { decorateOnlineCategory } from '@/lib/onlineCategories';
import { loadActiveCategories } from '@/lib/userCategoryPreferences';
import { sounds } from '@/lib/gameSounds';
import { getLeaderboardDiamondValue } from '@/lib/leaderboard';

/**
 * Kronox Online — Challenge Screen (Codex159 redesign).
 *
 * Matches the new target visual:
 *   • StandardTopBar (back arrow + centered diamond chip + bell) — NO avatar.
 *   • Title block: sword icon + "ONLINE KAPIŞMA" framed by gold star
 *     accents, with subtitle "Arkadaşlarını davet et, tarihe meydan oku!".
 *   • Compact, horizontally-scrollable category cards driven from the
 *     current Category metadata. Each card shows a name + small description.
 *     Load failures show a retryable error instead of stale fallback categories.
 *   • Big "ARKADAŞ SEÇ" panel with a dropdown-style trigger that opens
 *     the friend selection popup.
 *   • Bottom CTA "DAVET ET" — disabled until ≥1 friend selected. CTA
 *     hands the same { selectedCategories, selectedEmails } payload to
 *     the parent so lobby creation and invite flow are unchanged.
 *
 * Selection state for both categories AND friends is preserved here in
 * parent React state — neither is dropped before being passed to the
 * lobby start callback.
 */
const DEFAULT_CATEGORIES = [];

export default function OnlineChallengeScreen({
  user,
  loading,
  error,
  onStartChallenge,
  onBackHome,
  onJoinOpenLobby,
  onGoFriends,
  activeLobby,
  isActiveLobbyHost,
  onResumeActiveLobby,
}) {
  const [selectedCategories, setSelectedCategories] = useState(DEFAULT_CATEGORIES);
  const [selectedEmails, setSelectedEmails] = useState([]);
  const [friendModalOpen, setFriendModalOpen] = useState(false);
  const [dbCategories, setDbCategories] = useState(null);
  const [categoryLoading, setCategoryLoading] = useState(true);
  const [categoryLoadError, setCategoryLoadError] = useState('');

  // Online category selection uses current Category metadata only. If metadata
  // cannot be loaded, the UI shows a retry/error and does not create a lobby
  // with stale category ids.
  const loadOnlineCategories = useCallback(() => {
    let cancelled = false;
    setCategoryLoading(true);
    setCategoryLoadError('');
    loadActiveCategories({ limit: 1000 })
      .then((rows) => {
        if (cancelled) return;
        const active = (Array.isArray(rows) ? rows : [])
          .slice()
          .sort((a, b) => (Number(a.category_id) || 0) - (Number(b.category_id) || 0));
        setDbCategories(active);
        const activeIds = new Set(active
          .map((row) => Number(row.category_id))
          .filter(Number.isFinite));
        setSelectedCategories((current) => {
          const valid = (Array.isArray(current) ? current : [])
            .map((id) => Number(id))
            .filter((id) => activeIds.has(id));
          if (valid.length > 0) return valid;
          const first = active.find((row) => Number.isFinite(Number(row.category_id)));
          return first ? [Number(first.category_id)] : [];
        });
        if (active.length === 0) {
          setCategoryLoadError('Kategori listesi yüklenemedi. Lütfen tekrar dene.');
        }
      })
      .catch(() => {
        if (cancelled) return;
        setDbCategories([]);
        setSelectedCategories([]);
        setCategoryLoadError('Kategori listesi yüklenemedi. Lütfen tekrar dene.');
      })
      .finally(() => {
        if (!cancelled) setCategoryLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    return loadOnlineCategories();
  }, [loadOnlineCategories]);

  const carouselCategories = useMemo(() => {
    if (Array.isArray(dbCategories) && dbCategories.length > 0) {
      return dbCategories.map((row, index) => decorateOnlineCategory(row, index));
    }
    return [];
  }, [dbCategories]);

  const toggleCategory = (id) => {
    const numericId = Number(id);
    if (!Number.isFinite(numericId)) return;
    setSelectedCategories((prev) => {
      if (prev.includes(numericId)) {
        if (prev.length <= 1) return prev; // keep at least one selected
        return prev.filter((x) => x !== numericId);
      }
      return [...prev, numericId];
    });
  };

  const ctaDisabled = selectedEmails.length === 0 || loading || categoryLoading || selectedCategories.length === 0;

  const handleStart = () => {
    if (ctaDisabled) return;
    sounds.tap();
    onStartChallenge?.({
      selectedCategories: [...selectedCategories],
      selectedEmails: [...selectedEmails],
    });
  };

  return (
    <div
      className="fixed inset-0 flex flex-col text-white"
      style={{
        background:
          'radial-gradient(ellipse at 50% 8%, rgba(59,130,246,0.30), transparent 48%), radial-gradient(ellipse at 50% 96%, rgba(34,211,238,0.12), transparent 55%), linear-gradient(180deg, #050b1c 0%, #0a1738 55%, #03060f 100%)',
        userSelect: 'none',
        overflow: 'hidden',
        overscrollBehavior: 'none',
      }}
    >
      {/* Top bar: back + diamond + bell (no avatar) */}
      <StandardTopBar
        showBack
        user={user}
        onBack={onBackHome}
        diamonds={getLeaderboardDiamondValue(user)}
      />

      <main
        className="flex-1 flex flex-col px-4"
        style={{
          // Codex160 — Tighter top/bottom reservation: header band stays
          // identical, bottom reservation = BottomNav (4rem) + CTA stack
          // (smaller now ~5.25rem). This frees real vertical space the
          // friend-panel needs without ever overlapping the yellow CTA.
          paddingTop: 'calc(3.25rem + env(safe-area-inset-top))',
          paddingBottom: 'calc(4rem + env(safe-area-inset-bottom) + 5.25rem)',
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        {activeLobby && (
          <div className="mb-2">
            <ActiveLobbyCard
              lobby={activeLobby}
              isHost={isActiveLobbyHost}
              onResume={onResumeActiveLobby}
            />
          </div>
        )}

        <IncomingInvitesPanel user={user} />

        {/* Title block — sword icon + gold stars + ornamental rule */}
        <TitleBlock />

        {/* Category carousel — compact cards, DB-driven (active only,
            sorted by category_id ASC). */}
        <div className="mt-2.5">
          <OnlineCategoryCarousel
            categories={carouselCategories}
            selectedIds={selectedCategories}
            onToggle={toggleCategory}
          />
        </div>
        {categoryLoadError && (
          <div className="mt-2 rounded-xl px-3 py-2 font-inter text-[12px] text-amber-100/90"
            style={{ background: 'rgba(245,158,11,0.10)', boxShadow: 'inset 0 0 0 1px rgba(245,158,11,0.35)' }}>
            <p>{categoryLoadError}</p>
            <button
              type="button"
              onClick={loadOnlineCategories}
              className="mt-2 min-h-8 rounded-lg border border-white/15 px-3 py-1 text-[11px] font-black text-blue-100"
            >
              Tekrar Dene
            </button>
          </div>
        )}

        {/* Friend select panel — moved closer to the carousel so the
            panel never crowds the bottom CTA. */}
        <FriendSelectPanel
          count={selectedEmails.length}
          onOpen={() => { sounds.tap(); setFriendModalOpen(true); }}
        />

        {error && (
          <p className="mt-3 rounded-xl px-3 py-2 font-inter text-[12px] text-rose-100/90"
            style={{ background: 'rgba(244,63,94,0.10)', boxShadow: 'inset 0 0 0 1px rgba(244,63,94,0.35)' }}>
            {error}
          </p>
        )}
      </main>

      {/* Bottom CTA — "DAVET ET". Codex160: slightly shorter (h-12) so
          the panel above keeps clean breathing room and we never push
          into BottomNav even on small phones. */}
      <div
        className="fixed left-0 right-0 z-40 px-4 pointer-events-none"
        style={{
          bottom: 'calc(4rem + env(safe-area-inset-bottom))',
          paddingBottom: '0.4rem',
        }}
      >
        <div className="mx-auto max-w-md pointer-events-auto">
          <motion.button
            type="button"
            onClick={handleStart}
            disabled={ctaDisabled}
            whileTap={ctaDisabled ? undefined : { scale: 0.97 }}
            animate={ctaDisabled ? undefined : {
              boxShadow: [
                '0 0 18px rgba(250,204,21,0.40), 0 4px 14px rgba(250,204,21,0.24)',
                '0 0 28px rgba(250,204,21,0.60), 0 6px 22px rgba(250,204,21,0.36)',
                '0 0 18px rgba(250,204,21,0.40), 0 4px 14px rgba(250,204,21,0.24)',
              ],
            }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
            className="relative w-full h-12 rounded-2xl font-inter text-base font-black tracking-[0.22em] disabled:opacity-55 flex items-center justify-center"
            style={{
              background: ctaDisabled
                ? 'linear-gradient(135deg, #5a4a14 0%, #6b5318 50%, #4d3f10 100%)'
                : 'linear-gradient(180deg, #ffd84a 0%, #f5c400 55%, #e0ad00 100%)',
              color: '#1a0a00',
              boxShadow: ctaDisabled
                ? 'inset 0 1px 0 rgba(255,255,255,0.16)'
                : 'inset 0 1px 0 rgba(255,255,255,0.55), inset 0 -3px 0 rgba(120,75,0,0.35), 0 8px 20px rgba(0,0,0,0.45)',
            }}
            aria-label="Davet Et"
          >
            <span>{loading ? 'LOBİ AÇILIYOR...' : 'DAVET ET'}</span>
            {!loading && (
              <Swords
                className="absolute"
                style={{ right: '1.1rem', width: 20, height: 20, color: '#1a0a00' }}
                strokeWidth={2.2}
              />
            )}
          </motion.button>
          {!loading && (
            <p
              className="mt-1.5 text-center font-inter text-[11px]"
              style={{ color: ctaDisabled ? 'rgba(252,211,77,0.85)' : 'rgba(207,224,255,0.55)' }}
            >
              {ctaDisabled
                ? 'En az 1 arkadaş seçmeden başlanamaz.'
                : 'Lobi açılacak ve arkadaşlarına davet gidecek.'}
            </p>
          )}
          {onJoinOpenLobby && (
            <button
              type="button"
              onClick={() => { sounds.tap(); onJoinOpenLobby(); }}
              className="mt-1 mx-auto block font-inter text-[12px] font-bold text-blue-100/70 hover:text-blue-100"
            >
              veya kodla katıl
            </button>
          )}
        </div>
      </div>

      {/* Friend select popup */}
      <FriendSelectModal
        open={friendModalOpen}
        onClose={() => setFriendModalOpen(false)}
        user={user}
        initialSelectedEmails={selectedEmails}
        onConfirm={(emails) => setSelectedEmails(emails)}
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
      {/* Crossed swords icon above title */}
      <div className="flex justify-center mb-1.5">
        <Swords
          className="text-white/95"
          style={{ width: 22, height: 22, filter: 'drop-shadow(0 0 8px rgba(250,204,21,0.45))' }}
          strokeWidth={2.2}
        />
      </div>
      {/* Title row: ◆────  ONLINE KAPIŞMA  ────◆ */}
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
      {/* Thin gold rule below */}
      <div className="mx-auto mt-1.5" style={{
        height: 1,
        width: 'min(70%, 240px)',
        background: 'linear-gradient(90deg, transparent, rgba(250,204,21,0.55), transparent)',
      }} />
      <p className="mt-1.5 font-inter text-[12px] text-blue-100/75">
        Arkadaşlarını davet et, tarihe meydan oku!
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

/* ----------------------- Friend select panel ----------------------- */

function FriendSelectPanel({ count, onOpen }) {
  // Codex160 — visual correction:
  //   • Heading is Inter (NOT Cinzel italic) for a clean, upright look.
  //   • Panel padding tightened so the whole block is a touch shorter
  //     and never crowds the bottom CTA.
  //   • Subtitle/typography spacing matches the target reference.
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: 0.05 }}
      className="mt-2.5 rounded-2xl px-4 pt-3 pb-3.5"
      style={{
        background: 'linear-gradient(180deg, rgba(20,32,68,0.85), rgba(8,14,32,0.95))',
        boxShadow:
          'inset 0 0 0 1.5px rgba(120,170,255,0.32), inset 0 1px 0 rgba(255,255,255,0.08), 0 8px 18px rgba(2,6,23,0.45)',
      }}
    >
      {/* Center icon + heading */}
      <div className="flex flex-col items-center text-center">
        <Users
          className="mb-1"
          style={{ width: 24, height: 24, color: '#60a5fa', filter: 'drop-shadow(0 0 8px rgba(96,165,250,0.55))' }}
          strokeWidth={2.2}
        />
        {/* Upright Inter (not Cinzel) — fixes the previous italic feel. */}
        <p
          className="font-inter"
          style={{
            color: '#f1f4ff',
            fontSize: 'clamp(14px, 4vw, 16px)',
            fontWeight: 800,
            letterSpacing: '0.16em',
            fontStyle: 'normal',
          }}
        >
          ARKADAŞ SEÇ
        </p>
        <p className="mt-0.5 font-inter text-[11.5px] text-blue-100/70 leading-snug">
          Meydan okumak istediğin<br />arkadaşını seç
        </p>
      </div>

      {/* Dropdown-style trigger */}
      <button
        type="button"
        onClick={onOpen}
        className="mt-2.5 w-full flex items-center justify-between rounded-xl px-3.5 py-2.5 text-left"
        style={{
          background: 'rgba(8,14,32,0.75)',
          boxShadow: 'inset 0 0 0 1px rgba(120,170,255,0.30)',
        }}
        aria-label="Arkadaş seç"
      >
        <span className="font-inter text-[13.5px] text-blue-100/75">
          {count === 0
            ? 'Arkadaş seç...'
            : count === 1 ? '1 arkadaş seçildi'
            : `${count} arkadaş seçildi`}
        </span>
        <ChevronDown className="h-5 w-5 text-blue-100/60" strokeWidth={2.4} />
      </button>
    </motion.div>
  );
}
