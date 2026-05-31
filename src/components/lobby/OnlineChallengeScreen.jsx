import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, UserRound, Sparkles, Users } from 'lucide-react';
import ScreenHeader from '@/components/layout/ScreenHeader';
import OnlineCategoryCarousel from '@/components/lobby/OnlineCategoryCarousel';
import FriendSelectModal from '@/components/lobby/FriendSelectModal';
import IncomingInvitesPanel from '@/components/invites/IncomingInvitesPanel';
import ActiveLobbyCard from '@/components/lobby/ActiveLobbyCard';
import { ONLINE_CATEGORIES } from '@/lib/onlineCategories';
import { sounds } from '@/lib/gameSounds';
// Codex118 shared sources for Puan + Elmas (Header)
import { getSoloLevelCount, readSoloProgress } from '@/lib/soloLevels';
import { summarizeSoloProgress } from '@/lib/soloProgressHelpers';
import { getLeaderboardDiamondValue } from '@/lib/leaderboard';

/**
 * Kronox Online — Challenge Screen (Codex127).
 *
 * Single landing for "Arkadaşlarına Meydan Oku":
 *   • Top: shared ScreenHeader (Puan + Elmas + avatar).
 *   • Title + subtitle.
 *   • Horizontal category carousel (multi-select).
 *   • "Arkadaş Seç" trigger row that opens a popup.
 *   • Bottom CTA "Meydan Okumaya Başla" — disabled until ≥1 friend selected.
 *   • BottomNav rendered globally by AppShell.
 *
 * Layout contract: NO vertical scroll on the screen itself. Friend modal
 * scrolls internally. Header is fixed (via ScreenHeader). The CTA sits
 * above BottomNav with a safe-area-aware gap.
 *
 * Flow:
 *   tap CTA → onStartChallenge({ selectedCategories, selectedEmails }) →
 *   LobbyRoom creates the lobby AND sends invites in one shot. No extra
 *   friend-selection screen in between.
 *
 * Props:
 *   user
 *   loading            : parent is currently creating the lobby
 *   error              : parent's lobby creation error
 *   onStartChallenge({ selectedCategories, selectedEmails })
 *   onBackHome         : go to /
 *   onJoinOpenLobby    : optional "open code" path
 *   onGoFriends        : when user has no friends in modal
 */
const DEFAULT_CATEGORIES = ['flashback'];

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

  const toggleCategory = (id) => {
    setSelectedCategories((prev) => {
      if (prev.includes(id)) {
        if (prev.length <= 1) return prev; // keep at least one
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
      {/* Standard top bar (Puan + Elmas + avatar) */}
      <ScreenHeader
        showBack
        user={user}
        onBack={onBackHome}
        headerStats={{
          score: summarizeSoloProgress(readSoloProgress(user), getSoloLevelCount()).totalSoloScore,
          diamonds: getLeaderboardDiamondValue(user),
        }}
      />

      {/* Main content — no scroll. Header reserves ~3.5rem. BottomNav 4rem. */}
      <main
        className="flex-1 flex flex-col px-4"
        style={{
          paddingTop: 'calc(3.75rem + env(safe-area-inset-top))',
          paddingBottom: 'calc(4rem + env(safe-area-inset-bottom) + 8.5rem)', // BottomNav + CTA stack
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        {/* Codex131 — Active lobby card (host or member). Hidden when
            there is no pending lobby or it has gone stale. Lets the user
            jump back into the waiting room without losing state. */}
        {activeLobby && (
          <div className="mb-2">
            <ActiveLobbyCard
              lobby={activeLobby}
              isHost={isActiveLobbyHost}
              onResume={onResumeActiveLobby}
            />
          </div>
        )}

        {/* Incoming invites — surfaces only when there are any */}
        <IncomingInvitesPanel user={user} />

        {/* Title block */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="text-center mt-1 mb-3"
        >
          <h1
            className="font-cinzel text-xl sm:text-2xl font-black tracking-[0.18em]"
            style={{
              color: '#facc15',
              textShadow: '0 0 14px rgba(250,204,21,0.45), 0 2px 4px rgba(0,0,0,0.6)',
            }}
          >
            ARKADAŞLARINA MEYDAN OKU
          </h1>
          <p className="mt-1 font-inter text-[12px] text-blue-100/70">
            Kategorini seç, arkadaşlarını çağır, lobiye geç.
          </p>
        </motion.div>

        {/* Category carousel */}
        <SectionLabel icon={Sparkles} text="Kategori Seç" tail={
          <span className="font-inter text-[10px] font-black uppercase tracking-widest text-amber-200/90">
            {selectedCategories.length} seçili
          </span>
        }/>
        <div className="mt-2">
          <OnlineCategoryCarousel
            categories={ONLINE_CATEGORIES.map(({ id, label }) => ({ id, label }))}
            selectedIds={selectedCategories}
            onToggle={toggleCategory}
          />
        </div>

        {/* Friend select trigger */}
        <div className="mt-4">
          <SectionLabel icon={Users} text="Arkadaş Seç" tail={
            <span className="font-inter text-[10px] font-black uppercase tracking-widest text-amber-200/90">
              {selectedEmails.length}/3
            </span>
          }/>
          <FriendSelectTrigger
            count={selectedEmails.length}
            onOpen={() => { sounds.tap(); setFriendModalOpen(true); }}
          />
        </div>

        {error && (
          <p className="mt-3 rounded-xl px-3 py-2 font-inter text-[12px] text-rose-100/90"
            style={{ background: 'rgba(244,63,94,0.10)', boxShadow: 'inset 0 0 0 1px rgba(244,63,94,0.35)' }}>
            {error}
          </p>
        )}
      </main>

      {/* Floating CTA stack — above BottomNav */}
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
                '0 0 30px rgba(250,204,21,0.65), 0 6px 24px rgba(250,204,21,0.36)',
                '0 0 18px rgba(250,204,21,0.40), 0 4px 14px rgba(250,204,21,0.24)',
              ],
            }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
            className="w-full h-14 rounded-2xl font-bangers text-xl tracking-[0.24em] disabled:opacity-55"
            style={{
              background: ctaDisabled
                ? 'linear-gradient(135deg, #5a4a14 0%, #6b5318 50%, #4d3f10 100%)'
                : 'linear-gradient(135deg, #f5c400 0%, #facc15 50%, #e6b800 100%)',
              color: '#1a0a00',
            }}
            aria-label="Meydan Okumaya Başla"
          >
            {loading ? 'LOBİ AÇILIYOR...' : 'MEYDAN OKUMAYA BAŞLA'}
          </motion.button>
          <p
            className="mt-1.5 text-center font-inter text-[11px]"
            style={{ color: ctaDisabled && !loading ? 'rgba(252,211,77,0.85)' : 'rgba(207,224,255,0.55)' }}
          >
            {ctaDisabled && !loading
              ? 'En az 1 arkadaş seçmeden başlanamaz.'
              : loading ? 'Lobi oluşturuluyor...' : 'Lobi açılacak ve arkadaşlarına davet gidecek.'}
          </p>
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

function SectionLabel({ icon: Icon, text, tail }) {
  return (
    <div className="flex items-center justify-between px-0.5">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="h-3.5 w-3.5 text-amber-200/85" />}
        <p className="font-inter text-[10px] font-black uppercase tracking-[0.18em] text-blue-100/75">
          {text}
        </p>
      </div>
      {tail}
    </div>
  );
}

function FriendSelectTrigger({ count, onOpen }) {
  const empty = count === 0;
  return (
    <motion.button
      type="button"
      onClick={onOpen}
      whileTap={{ scale: 0.985 }}
      className="mt-2 w-full flex items-center gap-3 rounded-2xl p-3 text-left"
      style={{
        background: empty
          ? 'linear-gradient(180deg, rgba(30,41,75,0.92), rgba(10,16,36,0.96))'
          : 'linear-gradient(180deg, rgba(34,68,142,0.92), rgba(8,18,42,0.96))',
        boxShadow: empty
          ? 'inset 0 0 0 1.5px rgba(120,170,255,0.32), inset 0 1px 0 rgba(255,255,255,0.08)'
          : 'inset 0 0 0 1.5px rgba(250,204,21,0.75), inset 0 1px 0 rgba(255,255,255,0.10), 0 0 14px rgba(250,204,21,0.28)',
      }}
    >
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
        style={{
          background: empty
            ? 'radial-gradient(circle at 35% 28%, rgba(125,211,252,0.85), rgba(30,58,138,0.95) 75%)'
            : 'radial-gradient(circle at 35% 28%, #ffe066, #b97a06 75%)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4), 0 0 10px rgba(59,130,246,0.28)',
        }}
      >
        <UserRound className={empty ? 'h-5 w-5 text-blue-50' : 'h-5 w-5 text-amber-950'} strokeWidth={2.4} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-inter text-[14px] font-bold text-white">
          {empty ? 'Arkadaş seçin' : `${count} arkadaş seçildi`}
        </p>
        <p className="font-inter text-[11px] text-blue-100/65">
          1, 2 veya 3 arkadaş seçebilirsin
        </p>
      </div>
      <ChevronDown className="h-4 w-4 text-blue-100/60" />
    </motion.button>
  );
}