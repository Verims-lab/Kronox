import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, Users, Swords } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import StandardTopBar from '@/components/layout/StandardTopBar';
import OnlineCategoryCarousel from '@/components/lobby/OnlineCategoryCarousel';
import FriendSelectModal from '@/components/lobby/FriendSelectModal';
import IncomingInvitesPanel from '@/components/invites/IncomingInvitesPanel';
import ActiveLobbyCard from '@/components/lobby/ActiveLobbyCard';
import { ONLINE_CATEGORIES } from '@/lib/onlineCategories';
import { filterActiveCategories } from '@/lib/categoryFilters';
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
 *     Category DB lookup table (status === "a" only). Each card shows a
 *     name + small description. Falls back to the static taxonomy if the
 *     DB has not been seeded yet so the screen is never empty.
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
const DEFAULT_CATEGORIES = ['chronicle'];

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

  // Codex159 — Pull categories from the DB lookup table and keep only
  // status === "a" rows via the shared filter helper. Rows missing
  // status are treated as active for backward compatibility (see
  // lib/categoryFilters.js). If the DB query fails or returns nothing,
  // we fall back to the static taxonomy so the screen never breaks.
  useEffect(() => {
    let cancelled = false;
    base44.entities.Category
      .list('category_id', 50)
      .then((rows) => {
        if (cancelled) return;
        const active = filterActiveCategories(rows || []);
        if (active.length === 0) { setDbCategories(null); return; }
        setDbCategories(active);
      })
      .catch(() => { if (!cancelled) setDbCategories(null); });
    return () => { cancelled = true; };
  }, []);

  // Map DB rows → carousel items. We key by the static ONLINE_CATEGORIES
  // id (Chronicle=1, Flashback=2, Kült=3, Viral=4, Arena=5, Level Up=6)
  // so existing icons/colors and the downstream `selected_category_ids`
  // contract in startLobbyGame keep working untouched.
  const carouselCategories = useMemo(() => {
    const STATIC_BY_DB_ID = {
      1: ONLINE_CATEGORIES.find((c) => c.id === 'chronicle'),
      2: ONLINE_CATEGORIES.find((c) => c.id === 'flashback'),
      3: ONLINE_CATEGORIES.find((c) => c.id === 'kult'),
      4: ONLINE_CATEGORIES.find((c) => c.id === 'viral'),
      5: ONLINE_CATEGORIES.find((c) => c.id === 'arena'),
      6: ONLINE_CATEGORIES.find((c) => c.id === 'level_up'),
    };
    if (Array.isArray(dbCategories) && dbCategories.length > 0) {
      return dbCategories
        .map((row) => {
          const stat = STATIC_BY_DB_ID[row.category_id];
          if (!stat) return null;
          return {
            id: stat.id,
            label: (row.name || stat.label).toUpperCase(),
            description: row.description || '',
          };
        })
        .filter(Boolean);
    }
    // Fallback — static taxonomy with short tags.
    const STATIC_DESC = {
      chronicle: 'Genel',
      flashback: 'Yakın tarih',
      kult: 'Film/Dizi/Pop',
      viral: 'Sosyal medya',
      arena: 'Spor',
      level_up: 'Oyun',
    };
    return ONLINE_CATEGORIES.map(({ id, label }) => ({
      id, label, description: STATIC_DESC[id] || '',
    }));
  }, [dbCategories]);

  const toggleCategory = (id) => {
    setSelectedCategories((prev) => {
      if (prev.includes(id)) {
        if (prev.length <= 1) return prev; // keep at least one selected
        return prev.filter((x) => x !== id);
      }
      return [...prev, id];
    });
  };

  const ctaDisabled = selectedEmails.length === 0 || loading;

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
          paddingTop: 'calc(3.5rem + env(safe-area-inset-top))',
          paddingBottom: 'calc(4rem + env(safe-area-inset-bottom) + 6.5rem)', // BottomNav + CTA
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

        {/* Category carousel — compact cards, DB-driven (active only) */}
        <div className="mt-3">
          <OnlineCategoryCarousel
            categories={carouselCategories}
            selectedIds={selectedCategories}
            onToggle={toggleCategory}
          />
        </div>

        {/* Friend select panel */}
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

      {/* Bottom CTA — "DAVET ET" */}
      <div
        className="fixed left-0 right-0 z-40 px-4 pointer-events-none"
        style={{
          bottom: 'calc(4rem + env(safe-area-inset-bottom))',
          paddingBottom: '0.5rem',
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
                '0 0 30px rgba(250,204,21,0.65), 0 6px 24px rgba(250,204,21,0.40)',
                '0 0 18px rgba(250,204,21,0.40), 0 4px 14px rgba(250,204,21,0.24)',
              ],
            }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
            className="relative w-full h-14 rounded-2xl font-inter text-lg font-black tracking-[0.22em] disabled:opacity-55 flex items-center justify-center"
            style={{
              background: ctaDisabled
                ? 'linear-gradient(135deg, #5a4a14 0%, #6b5318 50%, #4d3f10 100%)'
                : 'linear-gradient(180deg, #ffd84a 0%, #f5c400 55%, #e0ad00 100%)',
              color: '#1a0a00',
              boxShadow: ctaDisabled
                ? 'inset 0 1px 0 rgba(255,255,255,0.16)'
                : 'inset 0 1px 0 rgba(255,255,255,0.55), inset 0 -3px 0 rgba(120,75,0,0.35), 0 8px 22px rgba(0,0,0,0.45)',
            }}
            aria-label="Davet Et"
          >
            <span>{loading ? 'LOBİ AÇILIYOR...' : 'DAVET ET'}</span>
            {!loading && (
              <Swords
                className="absolute"
                style={{ right: '1.25rem', width: 22, height: 22, color: '#1a0a00' }}
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
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: 0.05 }}
      className="mt-3 rounded-2xl p-4"
      style={{
        background: 'linear-gradient(180deg, rgba(20,32,68,0.85), rgba(8,14,32,0.95))',
        boxShadow:
          'inset 0 0 0 1.5px rgba(120,170,255,0.32), inset 0 1px 0 rgba(255,255,255,0.08), 0 8px 18px rgba(2,6,23,0.45)',
      }}
    >
      {/* Center icon + heading */}
      <div className="flex flex-col items-center text-center">
        <Users
          className="mb-1.5"
          style={{ width: 26, height: 26, color: '#60a5fa', filter: 'drop-shadow(0 0 8px rgba(96,165,250,0.55))' }}
          strokeWidth={2.2}
        />
        <p
          className="font-cinzel font-black"
          style={{
            color: '#f1f4ff',
            fontSize: 'clamp(15px, 4.4vw, 18px)',
            letterSpacing: '0.18em',
          }}
        >
          ARKADAŞ SEÇ
        </p>
        <p className="mt-1 font-inter text-[12px] text-blue-100/70 leading-snug">
          Meydan okumak istediğin<br />arkadaşını seç
        </p>
      </div>

      {/* Dropdown-style trigger */}
      <button
        type="button"
        onClick={onOpen}
        className="mt-3 w-full flex items-center justify-between rounded-xl px-4 py-3 text-left"
        style={{
          background: 'rgba(8,14,32,0.75)',
          boxShadow: 'inset 0 0 0 1px rgba(120,170,255,0.30)',
        }}
        aria-label="Arkadaş seç"
      >
        <span className="font-inter text-[14px] text-blue-100/75">
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