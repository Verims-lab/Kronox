import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Clock, LogIn, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

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
  onCreate,
  onJoin,
  onBackHome,
  onBackMode,
}) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6"
      style={{ paddingTop: 'calc(5rem + env(safe-area-inset-top))', paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}>
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 mx-auto border-2 border-primary/40 rounded-full flex items-center justify-center">
            <Clock className="w-7 h-7 text-primary" />
          </div>
          <h1 className="font-cinzel text-3xl font-bold text-primary tracking-wider">KRONOX</h1>
          <p className="font-inter text-muted-foreground text-sm">Çevrimiçi Lobi</p>
        </div>

        {!mode && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
            <Button onClick={() => setMode('create')} size="lg" className="w-full h-14 bg-primary text-primary-foreground font-cinzel tracking-wider gap-2">
              <Plus className="w-5 h-5" /> LOBİ OLUŞTUR
            </Button>
            <Button onClick={() => setMode('join')} size="lg" variant="outline" className="w-full h-14 font-cinzel tracking-wider gap-2">
              <LogIn className="w-5 h-5" /> LOBİYE KATIL
            </Button>
            <Button onClick={onBackHome} variant="ghost" className="w-full gap-2 text-muted-foreground">
              <ArrowLeft className="w-4 h-4" /> Tek Oyuncuya Dön
            </Button>
          </motion.div>
        )}

        {mode && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="space-y-1">
              <Input
                placeholder="Oyuncu İsminiz"
                value={playerName}
                maxLength={15}
                onChange={e => { setPlayerName(e.target.value); setNameError(''); }}
                className={`h-12 bg-secondary/50 border-border/50 font-inter ${nameError ? 'border-destructive' : ''}`}
              />
              {nameError && <p className="font-inter text-xs text-destructive pl-1">{nameError}</p>}
            </div>
            {mode === 'join' && (
              <Input
                placeholder="Lobi Kodu (örn: ABC123)"
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase())}
                maxLength={6}
                className="h-12 bg-secondary/50 border-border/50 font-inter font-bold tracking-widest text-center text-lg uppercase"
              />
            )}
            {error && <p className="text-destructive text-sm font-inter text-center">{error}</p>}
            <Button
              onClick={mode === 'create' ? onCreate : onJoin}
              disabled={loading}
              size="lg"
              className="w-full h-12 bg-primary text-primary-foreground font-cinzel tracking-wider"
            >
              {loading ? 'Yükleniyor...' : mode === 'create' ? 'LOBİ OLUŞTUR' : 'KATIL'}
            </Button>
            <Button onClick={onBackMode || (() => { setMode(null); })} variant="ghost" className="w-full gap-2 text-muted-foreground">
              <ArrowLeft className="w-4 h-4" /> Geri
            </Button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
