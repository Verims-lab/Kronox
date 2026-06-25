import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import GoldButton from '@/components/ui/GoldButton';
import ScreenHeader from '@/components/layout/ScreenHeader';
import KronoxWordmark from '@/components/ui/KronoxWordmark';

/**
 * Codex127 — Slimmed-down panel.
 *
 * After the new OnlineChallengeScreen took over the landing + create
 * flow, this panel only renders the "join via code" mode now. The
 * legacy landing + create-invite code paths are removed from the active
 * flow; this file no longer references either of those former panels.
 *
 * Props (unchanged for compatibility):
 *   mode === 'join' is the only supported render path; other modes
 *   render nothing (parent should pick a different component).
 */
export default function LobbyCreateJoinPanel({
  mode,
  setMode,
  playerName,
  setPlayerName,
  joinCode,
  setJoinCode,
  loading,
  error,
  nameError,
  setNameError,
  onJoin,
  onBackMode,
  user,
}) {
  if (mode !== 'join') return null;

  return (
    <div
      className="min-h-screen bg-background flex flex-col items-center justify-center px-6"
      style={{
        paddingTop: 'calc(5rem + env(safe-area-inset-top))',
        paddingBottom: 'calc(5rem + env(safe-area-inset-bottom))',
        background:
          'radial-gradient(ellipse at 50% 18%, rgba(59,130,246,0.34), transparent 42%), radial-gradient(ellipse at 50% 90%, rgba(34,211,238,0.14), transparent 50%), linear-gradient(180deg, #050b1c 0%, #0a1738 55%, #03060f 100%)',
      }}
    >
      <ScreenHeader
        title="Lobiye Katıl"
        showBack
        user={user}
        showProfile={false}
        onBack={onBackMode || (() => setMode(null))}
      />
      <div className="w-full max-w-md space-y-7">
        <div className="flex flex-col items-center text-center space-y-3">
          <KronoxWordmark fontSize="clamp(30px, 9vw, 46px)" />
          <p className="font-inter text-blue-100/70 text-sm">Lobi koduyla katıl</p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4 rounded-2xl p-5"
          style={{
            background:
              'linear-gradient(180deg, rgba(30,41,75,0.95) 0%, rgba(14,22,46,0.98) 70%, rgba(6,10,24,1) 100%)',
            boxShadow:
              'inset 0 0 0 1.5px rgba(120,170,255,0.4), inset 0 1px 0 rgba(255,255,255,0.1), inset 0 -14px 18px rgba(0,0,0,0.55), 0 0 24px rgba(59,130,246,0.22), 0 12px 24px rgba(2,6,23,0.55)',
          }}
        >
          <div className="space-y-1">
            <Input
              placeholder="Oyuncu İsminiz"
              value={playerName}
              maxLength={15}
              onChange={(e) => { setPlayerName(e.target.value); setNameError(''); }}
              className={`h-12 bg-slate-900/60 border-blue-400/30 text-white placeholder:text-blue-200/50 font-inter ${nameError ? 'border-destructive' : ''}`}
            />
            {nameError && <p className="font-inter text-xs text-destructive pl-1">{nameError}</p>}
          </div>
          <Input
            placeholder="Lobi Kodu (örn: ABC123)"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            maxLength={6}
            className="h-12 bg-slate-900/60 border-blue-400/30 text-amber-200 placeholder:text-blue-200/50 font-inter font-bold tracking-widest text-center text-lg uppercase"
          />
          {error && <p className="text-destructive text-sm font-inter text-center">{error}</p>}
          <GoldButton variant="gold" size="lg" onClick={onJoin} disabled={loading}>
            {loading ? 'Yükleniyor...' : 'KATIL'}
          </GoldButton>
          <Button
            onClick={onBackMode || (() => setMode(null))}
            variant="ghost"
            className="w-full gap-2 text-blue-100/70 hover:text-white hover:bg-white/5"
          >
            <ArrowLeft className="w-4 h-4" /> Geri
          </Button>
        </motion.div>
      </div>
    </div>
  );
}