import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Users, Play, Globe, LogIn, LogOut, Settings } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function PlayerSetup() {
  const navigate = useNavigate();
  const [playerCount, setPlayerCount] = useState(1);
  const [user, setUser] = useState(null);
  const [names, setNames] = useState(['', '', '', '']);
  const [selectedCategory, setSelectedCategory] = useState('karisik');
  const [yearStart, setYearStart] = useState(1900);
  const [yearEnd, setYearEnd] = useState(2020);
  const [turnDuration, setTurnDuration] = useState(60);
  const [nameErrors, setNameErrors] = useState([]);

  useEffect(() => {
    base44.auth.me().then((u) => setUser(u || null)).catch(() => setUser(null));
  }, []);

  const validateName = (name) => {
    const trimmed = name.trim();
    if (trimmed.length < 3) return 'En az 3 karakter';
    if (trimmed.length > 15) return 'En fazla 15 karakter';
    if (!/^[a-zA-Z0-9çğıöşüÇĞİÖŞÜ]+$/.test(trimmed)) return 'Yalnızca harf ve rakam';
    return '';
  };

  const handleStart = () => {
    const errors = Array.from({ length: playerCount }).map((_, i) => validateName(names[i]));
    setNameErrors(errors);
    if (errors.some((e) => e)) return;
    const playerNames = names.slice(0, playerCount).map((n) => n.trim());
    navigate('/game', {
      state: { playerNames, category: selectedCategory, yearStart, yearEnd, turnDuration }
    });
  };

  const categories = [
  { value: 'karisik', label: 'Karışık', emoji: '🎲' },
  { value: 'tarih', label: 'Tarih', emoji: '🏰' },
  { value: 'bilim', label: 'Bilim', emoji: '🔬' },
  { value: 'spor', label: 'Spor', emoji: '⚽' },
  { value: 'sanat', label: 'Sanat', emoji: '🎨' }];


  return (
    <div className="min-h-screen flex flex-col items-center justify-start px-5 pt-safe pb-safe"
    style={{
      paddingTop: 'calc(1.5rem + env(safe-area-inset-top))',
      paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))',
      background: 'linear-gradient(to bottom, #0B1F3A 0%, #1E3A8A 100%)',
      minHeight: '100vh'
    }}>
      
      {/* Top row */}
      <div className="w-full flex items-center justify-between mb-6">
        <button
          onClick={() => navigate('/settings')}
          className="w-10 h-10 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-white/70">
          
          <Settings className="w-5 h-5" />
        </button>

        {/* Logo */}
        <h1 className="pr-8 h-16 object-contain"

        style={{ textShadow: '0 0 20px rgba(255,193,7,0.7), 0 4px 0 rgba(120,80,0,0.8), 0 2px 15px rgba(255,193,7,0.5)' }}>
          
          KRONOX
        </h1>

        {/* Crown / score placeholder */}
        




        
      </div>

      <div className="w-full max-w-md space-y-5">

        {/* Player count */}
        <div className="space-y-2">
          <label className="font-inter text-sm text-white/60 flex items-center gap-2">
            <Users className="w-4 h-4" />
            Oyuncu Sayısı
          </label>
          <div className="flex gap-2">
            {[1, 2, 3, 4].map((n) =>
            <button
              key={n}
              onClick={() => setPlayerCount(n)}
              className={`flex-1 h-12 rounded-2xl border-2 font-bangers text-2xl transition-all duration-150
                  ${playerCount === n ?
              'border-primary bg-primary/20 text-primary shadow-lg shadow-primary/30' :
              'border-white/20 bg-white/5 text-white/50 hover:border-white/40'}
                `}>
              
                {n}
              </button>
            )}
          </div>
        </div>

        {/* Category */}
        <div className="space-y-2">
          <label className="font-inter text-sm text-white/60">Kategori</label>
          <div className="grid grid-cols-3 gap-2">
            {categories.map(({ value, label, emoji }) =>
            <button
              key={value}
              onClick={() => setSelectedCategory(value)}
              className={`py-2 px-2 rounded-2xl border-2 transition-all flex flex-col items-center gap-0.5
                  ${selectedCategory === value ?
              'border-primary bg-primary/20 text-primary' :
              'border-white/20 bg-white/5 text-white/50 hover:border-white/40'}
                `}>
              
                <span className="text-xl">{emoji}</span>
                <span className="font-inter text-xs font-semibold">{label}</span>
              </button>
            )}
          </div>
        </div>

        {/* Year range */}
        <div className="space-y-2">
          <label className="font-inter text-sm text-white/60">Yıl Aralığı</label>
          <div className="grid grid-cols-2 gap-3">
            {[
            { label: 'Başlangıç', val: yearStart, set: (v) => setYearStart(Math.max(0, Math.min(yearEnd - 10, v))), step: 10 },
            { label: 'Bitiş', val: yearEnd, set: (v) => setYearEnd(Math.max(yearStart + 10, Math.min(new Date().getFullYear(), v))), step: 10 }].
            map(({ label, val, set, step }) =>
            <div key={label} className="space-y-1">
                <p className="font-inter text-xs text-white/40 text-center">{label}</p>
                <div className="flex items-center gap-1">
                  <button onClick={() => set(val - step)}
                className="w-8 h-9 rounded-xl bg-white/10 border border-white/20 font-bold text-white/70 hover:bg-white/20 flex items-center justify-center">
                    −
                  </button>
                  <div className="flex-1 text-center font-bangers text-lg text-white">{val}</div>
                  <button onClick={() => set(val + step)}
                className="w-8 h-9 rounded-xl bg-white/10 border border-white/20 font-bold text-white/70 hover:bg-white/20 flex items-center justify-center">
                    +
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Turn duration */}
        <div className="space-y-2">
          <label className="font-inter text-sm text-white/60">Tur Süresi</label>
          <div className="flex gap-2">
            {[0, 10, 30, 60].map((s) =>
            <button
              key={s}
              onClick={() => setTurnDuration(s)}
              className={`flex-1 h-10 rounded-2xl border-2 font-bangers text-lg transition-all
                  ${turnDuration === s ?
              'border-primary bg-primary/20 text-primary' :
              'border-white/20 bg-white/5 text-white/50 hover:border-white/40'}
                `}>
              
                {s === 0 ? '∞' : `${s}s`}
              </button>
            )}
          </div>
        </div>

        {/* Player names */}
        <div className="space-y-2">
          {Array.from({ length: playerCount }).map((_, i) =>
          <div key={i}>
              <Input
              placeholder={`Oyuncu ${i + 1} İsmi`}
              value={names[i]}
              maxLength={15}
              onKeyDown={(e) => {if (e.key === 'Enter') handleStart();}}
              onChange={(e) => {
                const newNames = [...names];
                newNames[i] = e.target.value;
                setNames(newNames);
                if (nameErrors[i]) {
                  const errs = [...nameErrors];
                  errs[i] = '';
                  setNameErrors(errs);
                }
              }}
              className={`h-12 rounded-2xl bg-white/10 border-white/20 text-white placeholder:text-white/30 font-inter
                  ${nameErrors[i] ? 'border-red-400' : ''}
                `} />
            
              {nameErrors[i] && <p className="font-inter text-xs text-red-400 pl-2 mt-0.5">{nameErrors[i]}</p>}
            </div>
          )}
        </div>

        {/* Buttons */}
        <button
          onClick={handleStart}
          className="w-full h-14 rounded-2xl font-bangers text-2xl tracking-wider bg-primary text-primary-foreground shadow-xl shadow-primary/40 hover:bg-primary/90 active:scale-95 transition-all flex items-center justify-center gap-2">
          
          <Play className="w-5 h-5" />
          OYUNU BAŞLAT
        </button>

        <button
          onClick={() => navigate('/lobby')}
          className="w-full h-12 rounded-2xl font-bangers text-xl tracking-wider text-white active:scale-95 transition-all flex items-center justify-center gap-2"
          style={{ background: 'linear-gradient(135deg, #5b2d8e, #7c3abf)', boxShadow: '0 4px 20px rgba(124,58,191,0.4)' }}>
          
          <Globe className="w-5 h-5" />
          ÇEVRİMİÇİ OYUN
        </button>

        {/* Auth */}
        <div className="pt-1">
          {user ?
          <div className="flex items-center justify-between px-1">
              <p className="font-inter text-xs text-white/40">
                {user.full_name || user.email}
              </p>
              <button
              onClick={() => base44.auth.logout('/')}
              className="font-inter text-xs text-white/30 hover:text-red-400 flex items-center gap-1 transition-colors">
              
                <LogOut className="w-3 h-3" />
                Çıkış
              </button>
            </div> :

          <button
            onClick={() => base44.auth.redirectToLogin('/')}
            className="w-full font-inter text-sm text-white/50 hover:text-primary flex items-center justify-center gap-2 py-2 transition-colors">
            
              <LogIn className="w-4 h-4" />
              Google ile Giriş Yap
            </button>
          }
        </div>
      </div>
    </div>);

}