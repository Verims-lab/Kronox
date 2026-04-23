import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Clock, Users, Play, Layers, BookOpen, FlaskConical, Trophy, Sparkles, CalendarRange, Timer, Globe, FileDown, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function PlayerSetup() {
  const navigate = useNavigate();
  const [playerCount, setPlayerCount] = useState(1);
  const [downloadingDoc, setDownloadingDoc] = useState(false);
  const [names, setNames] = useState(['', '', '', '']);
  const [selectedCategory, setSelectedCategory] = useState('karisik');
  const [yearStart, setYearStart] = useState(1900);
  const [yearEnd, setYearEnd] = useState(2020);
  const [turnDuration, setTurnDuration] = useState(60); // 0 = süresiz

  const categories = [
  { value: 'karisik', label: 'Karışık', icon: Layers },
  { value: 'tarih', label: 'Tarih', icon: BookOpen },
  { value: 'bilim', label: 'Bilim', icon: FlaskConical },
  { value: 'spor', label: 'Spor', icon: Trophy },
  { value: 'sanat', label: 'Popüler Kültür', icon: Sparkles }];


  const handleDownloadDoc = async () => {
    setDownloadingDoc(true);
    try {
      const res = await base44.functions.fetch('/generateTechDoc', { method: 'POST' });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'kronos-teknik-dokuman.pdf';
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloadingDoc(false);
    }
  };

  const handleStart = () => {
    const playerNames = names.slice(0, playerCount).map((n, i) => n.trim() || `Oyuncu ${i + 1}`);
    navigate('/game', { state: { playerNames, category: selectedCategory, yearStart, yearEnd, turnDuration } });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center" style={{ padding: '1.5rem', paddingTop: 'calc(1.5rem + env(safe-area-inset-top))', paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}>
      {/* Decorative: only visible on desktop */}
      <div className="hidden md:block fixed left-0 top-0 bottom-0 w-1/3 bg-gradient-to-r from-primary/5 to-transparent pointer-events-none" />
      <div className="hidden md:block fixed right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-primary/5 to-transparent pointer-events-none" />
      {/* Background decorative elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-48 h-48 bg-primary/3 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-md space-y-8">
        
        {/* Logo */}
        <div className="text-center space-y-3">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
            className="w-16 h-16 mx-auto border-2 border-primary/40 rounded-full flex items-center justify-center">
            
            <Clock className="w-8 h-8 text-primary" />
          </motion.div>
          <h1 className="font-cinzel text-4xl font-bold text-primary tracking-wider">KRONOS

          </h1>
          <p className="font-inter text-muted-foreground text-sm">
            Zaman Çizgisi Kart Oyunu
          </p>
        </div>

        {/* Player count */}
        <div className="space-y-3">
          <label className="font-inter text-sm text-muted-foreground flex items-center gap-2">
            <Users className="w-4 h-4" />
            Oyuncu Sayısı
          </label>
          <div className="flex items-center justify-center gap-3">
            {[1, 2, 3, 4].map((n) =>
            <button
              key={n}
              onClick={() => setPlayerCount(n)}
              className={`
                  w-14 h-14 rounded-xl border-2 font-cinzel text-2xl font-bold transition-all duration-150
                  ${playerCount === n ?
              'border-primary bg-primary/15 text-primary' :
              'border-border/50 bg-secondary/30 text-muted-foreground hover:border-primary/40 hover:text-foreground'}
                `}>
              
                {n}
              </button>
            )}
          </div>
        </div>

        {/* Category selection */}
        <div className="space-y-3">
          <label className="font-inter text-sm text-muted-foreground flex items-center gap-2">
            <Layers className="w-4 h-4" />
            Kategori
          </label>
          <div className="grid grid-cols-3 gap-2">
            {categories.map(({ value, label, icon: Icon }) =>
            <button
              key={value}
              onClick={() => setSelectedCategory(value)}
              className={`
                  flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border-2
                  font-inter text-xs font-medium transition-all duration-150
                  ${selectedCategory === value ?
              'border-primary bg-primary/15 text-primary' :
              'border-border/50 bg-secondary/30 text-muted-foreground hover:border-primary/40 hover:text-foreground'}
                `}>
              
                <Icon className="w-4 h-4" />
                {label}
              </button>
            )}
          </div>
        </div>

        {/* Year range */}
        <div className="space-y-3">
          <label className="font-inter text-sm text-muted-foreground flex items-center gap-2">
            <CalendarRange className="w-4 h-4" />
            Yıl Aralığı
          </label>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <p className="font-inter text-xs text-muted-foreground/70 text-center">Başlangıç</p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setYearStart(y => Math.max(0, y - 10))}
                  className="w-8 h-8 rounded-lg border border-border/50 bg-secondary/30 text-muted-foreground hover:border-primary/40 hover:text-foreground transition-all text-sm font-bold"
                >−</button>
                <span className="flex-1 text-center font-cinzel text-base font-bold text-foreground">
                  {yearStart}
                </span>
                <button
                  onClick={() => setYearStart(y => Math.min(yearEnd - 10, y + 10))}
                  className="w-8 h-8 rounded-lg border border-border/50 bg-secondary/30 text-muted-foreground hover:border-primary/40 hover:text-foreground transition-all text-sm font-bold"
                >+</button>
              </div>
            </div>
            <div className="space-y-1">
              <p className="font-inter text-xs text-muted-foreground/70 text-center">Bitiş</p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setYearEnd(y => Math.max(yearStart + 10, y - 10))}
                  className="w-8 h-8 rounded-lg border border-border/50 bg-secondary/30 text-muted-foreground hover:border-primary/40 hover:text-foreground transition-all text-sm font-bold"
                >−</button>
                <span className="flex-1 text-center font-cinzel text-base font-bold text-foreground">
                  {yearEnd}
                </span>
                <button
                  onClick={() => setYearEnd(y => Math.min(new Date().getFullYear(), y + 10))}
                  className="w-8 h-8 rounded-lg border border-border/50 bg-secondary/30 text-muted-foreground hover:border-primary/40 hover:text-foreground transition-all text-sm font-bold"
                >+</button>
              </div>
            </div>
          </div>
          <p className="font-inter text-xs text-muted-foreground/60 text-center">
            {yearStart} – {yearEnd} yılları arası sorular
          </p>
        </div>

        {/* Turn duration */}
        <div className="space-y-3">
          <label className="font-inter text-sm text-muted-foreground flex items-center gap-2">
            <Timer className="w-4 h-4" />
            Tur Süresi
          </label>
          <div className="flex gap-2 flex-wrap">
            {[0, 10, 20, 30, 60].map((s) => (
              <button
                key={s}
                onClick={() => setTurnDuration(s)}
                className={`
                  flex-1 min-w-[3.5rem] py-2 rounded-xl border-2 font-cinzel text-sm font-bold transition-all duration-150
                  ${turnDuration === s
                    ? 'border-primary bg-primary/15 text-primary'
                    : 'border-border/50 bg-secondary/30 text-muted-foreground hover:border-primary/40 hover:text-foreground'}
                `}
              >
                {s === 0 ? '∞' : `${s}s`}
              </button>
            ))}
          </div>
          <p className="font-inter text-xs text-muted-foreground/60 text-center">
            {turnDuration === 0 ? 'Süresiz — istediğin kadar düşün' : `Her tur ${turnDuration} saniye`}
          </p>
        </div>

        {/* Player names */}
        <div className="space-y-3">
          {Array.from({ length: playerCount }).map((_, i) =>
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}>
            
              <Input
              placeholder={`Oyuncu ${i + 1} İsmi`}
              value={names[i]}
              onChange={(e) => {
                const newNames = [...names];
                newNames[i] = e.target.value;
                setNames(newNames);
              }}
              className="bg-secondary/50 border-border/50 font-inter text-foreground placeholder:text-muted-foreground/50 h-12" />
            
            </motion.div>
          )}
        </div>

        {/* Start button */}
        <motion.div
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}>
          
          <Button
            onClick={handleStart}
            size="lg"
            className="w-full h-14 bg-primary text-primary-foreground hover:bg-primary/90 font-cinzel text-lg tracking-wider gap-2">
            
            <Play className="w-5 h-5" />
            OYUNU BAŞLAT
          </Button>
        </motion.div>

        {/* Online lobby button */}
        <motion.div
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}>
          <Button
            onClick={() => navigate('/lobby')}
            size="lg"
            variant="outline"
            className="w-full h-12 font-cinzel tracking-wider gap-2 border-primary/40 text-primary hover:bg-primary/10">
            <Globe className="w-5 h-5" />
            ÇEVRİMİÇİ OYUN
          </Button>
        </motion.div>

        {/* Tech doc download */}
        <button
          onClick={handleDownloadDoc}
          disabled={downloadingDoc}
          className="w-full flex items-center justify-center gap-2 py-2 font-inter text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
        >
          {downloadingDoc
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : <FileDown className="w-3.5 h-3.5" />
          }
          Teknik Dökümanı İndir (PDF)
        </button>


      </motion.div>
    </div>);

}