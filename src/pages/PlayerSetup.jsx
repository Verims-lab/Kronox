import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Clock, Users, Play, Plus, Minus, Layers, BookOpen, FlaskConical, Trophy, Sparkles } from 'lucide-react';

export default function PlayerSetup() {
  const navigate = useNavigate();
  const [playerCount, setPlayerCount] = useState(2);
  const [names, setNames] = useState(['', '', '', '']);
  const [selectedCategory, setSelectedCategory] = useState('karisik');

  const categories = [
  { value: 'karisik', label: 'Karışık', icon: Layers },
  { value: 'tarih', label: 'Tarih', icon: BookOpen },
  { value: 'bilim', label: 'Bilim', icon: FlaskConical },
  { value: 'spor', label: 'Spor', icon: Trophy },
  { value: 'sanat', label: 'Popüler Kültür', icon: Sparkles }];


  const handleStart = () => {
    const playerNames = names.slice(0, playerCount).map((n, i) => n.trim() || `Oyuncu ${i + 1}`);
    navigate('/game', { state: { playerNames, category: selectedCategory } });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
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
            {[2, 3, 4].map((n) =>
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
      </motion.div>
    </div>);

}