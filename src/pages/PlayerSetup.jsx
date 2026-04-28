import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Clock, Users, Play, Globe, LogIn, LogOut } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function PlayerSetup() {
  const navigate = useNavigate();
  const [playerCount, setPlayerCount] = useState(1);
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(u => setUser(u || null)).catch(() => setUser(null));
  }, []);
  const [names, setNames] = useState(['', '', '', '']);
  const [selectedCategory, setSelectedCategory] = useState('karisik');
  const [yearStart, setYearStart] = useState(1900);
  const [yearEnd, setYearEnd] = useState(2020);
  const [turnDuration, setTurnDuration] = useState(60);

  const handleStart = () => {
    const playerNames = names.slice(0, playerCount).map((n, i) => n.trim() || `Oyuncu ${i + 1}`);
    navigate('/game', { 
      state: { playerNames, category: selectedCategory, yearStart, yearEnd, turnDuration } 
    });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6" 
      style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top))', paddingBottom: 'calc(5rem + env(safe-area-inset-bottom))' }}>
      
      <div className="w-full max-w-md space-y-8">
        
        {/* Logo */}
        <div className="text-center space-y-3">
          <div className="w-16 h-16 mx-auto border-2 border-primary/40 rounded-full flex items-center justify-center">
            <Clock className="w-8 h-8 text-primary" />
          </div>
          <h1 className="font-cinzel text-4xl font-bold text-primary tracking-wider">KRONOS</h1>
          <p className="font-inter text-muted-foreground text-sm">Zaman Çizgisi Kart Oyunu</p>
        </div>

        {/* Player count */}
        <div className="space-y-3">
          <label className="font-inter text-sm text-muted-foreground flex items-center gap-2">
            <Users className="w-4 h-4" />
            Oyuncu Sayısı
          </label>
          <div className="flex items-center justify-center gap-3">
            {[1, 2, 3, 4].map((n) => (
              <button
                key={n}
                onClick={() => setPlayerCount(n)}
                className={`w-14 h-14 rounded-xl border-2 font-cinzel text-2xl font-bold transition-all duration-150
                  ${playerCount === n 
                    ? 'border-primary bg-primary/15 text-primary' 
                    : 'border-border/50 bg-secondary/30 text-muted-foreground hover:border-primary/40'}
                `}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Category selection */}
        <div className="space-y-3">
          <label className="font-inter text-sm text-muted-foreground">Kategori</label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { value: 'karisik', label: 'Karışık' },
              { value: 'tarih', label: 'Tarih' },
              { value: 'bilim', label: 'Bilim' },
              { value: 'spor', label: 'Spor' },
              { value: 'sanat', label: 'Sanat' },
            ].map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setSelectedCategory(value)}
                className={`p-2 rounded-xl border-2 font-inter text-xs font-medium transition-all
                  ${selectedCategory === value 
                    ? 'border-primary bg-primary/15 text-primary' 
                    : 'border-border/50 bg-secondary/30 text-muted-foreground hover:border-primary/40'}
                `}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Year range */}
        <div className="space-y-3">
          <label className="font-inter text-sm text-muted-foreground">Yıl Aralığı</label>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <p className="font-inter text-xs text-muted-foreground text-center">Başlangıç</p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setYearStart(y => Math.max(0, y - 10))}
                  className="w-8 h-8 rounded-lg border border-border/50 bg-secondary/30 text-sm font-bold hover:bg-secondary"
                >−</button>
                <span className="flex-1 text-center font-cinzel font-bold">{yearStart}</span>
                <button
                  onClick={() => setYearStart(y => Math.min(yearEnd - 10, y + 10))}
                  className="w-8 h-8 rounded-lg border border-border/50 bg-secondary/30 text-sm font-bold hover:bg-secondary"
                >+</button>
              </div>
            </div>
            <div className="space-y-1">
              <p className="font-inter text-xs text-muted-foreground text-center">Bitiş</p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setYearEnd(y => Math.max(yearStart + 10, y - 10))}
                  className="w-8 h-8 rounded-lg border border-border/50 bg-secondary/30 text-sm font-bold hover:bg-secondary"
                >−</button>
                <span className="flex-1 text-center font-cinzel font-bold">{yearEnd}</span>
                <button
                  onClick={() => setYearEnd(y => Math.min(new Date().getFullYear(), y + 10))}
                  className="w-8 h-8 rounded-lg border border-border/50 bg-secondary/30 text-sm font-bold hover:bg-secondary"
                >+</button>
              </div>
            </div>
          </div>
        </div>

        {/* Turn duration */}
        <div className="space-y-3">
          <label className="font-inter text-sm text-muted-foreground">Tur Süresi</label>
          <div className="flex gap-2 flex-wrap">
            {[0, 10, 20, 30, 60].map((s) => (
              <button
                key={s}
                onClick={() => setTurnDuration(s)}
                className={`flex-1 min-w-[3.5rem] py-2 rounded-xl border-2 font-cinzel text-sm font-bold transition-all
                  ${turnDuration === s
                    ? 'border-primary bg-primary/15 text-primary'
                    : 'border-border/50 bg-secondary/30 text-muted-foreground hover:border-primary/40'}
                `}
              >
                {s === 0 ? '∞' : `${s}s`}
              </button>
            ))}
          </div>
        </div>

        {/* Player names */}
        <div className="space-y-3">
          {Array.from({ length: playerCount }).map((_, i) => (
            <Input
              key={i}
              placeholder={`Oyuncu ${i + 1} İsmi`}
              value={names[i]}
              onChange={(e) => {
                const newNames = [...names];
                newNames[i] = e.target.value;
                setNames(newNames);
              }}
              className="bg-secondary/50 border-border/50 h-12"
            />
          ))}
        </div>

        {/* Buttons */}
        <Button onClick={handleStart} size="lg" className="w-full h-14 bg-primary text-primary-foreground font-cinzel text-lg tracking-wider gap-2">
          <Play className="w-5 h-5" />
          OYUNU BAŞLAT
        </Button>

        <Button onClick={() => navigate('/lobby')} size="lg" variant="outline" className="w-full h-12 font-cinzel tracking-wider gap-2">
          <Globe className="w-5 h-5" />
          ÇEVRİMİÇİ OYUN
        </Button>

        {/* Auth section */}
        <div className="border-t border-border/30 pt-4">
          {user ? (
            <div className="flex items-center justify-between">
              <p className="font-inter text-xs text-muted-foreground">
                Giriş: <span className="text-foreground">{user.full_name || user.email}</span>
              </p>
              <button
                onClick={() => base44.auth.logout('/')}
                className="font-inter text-xs text-muted-foreground hover:text-destructive flex items-center gap-1 transition-colors"
              >
                <LogOut className="w-3 h-3" />
                Çıkış
              </button>
            </div>
          ) : (
            <Button
              onClick={() => base44.auth.redirectToLogin(window.location.pathname + window.location.search)}
              variant="ghost"
              className="w-full font-inter text-sm text-primary hover:text-primary gap-2"
            >
              <LogIn className="w-4 h-4" />
              Google ile Giriş Yap
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}