import React from 'react';
import { motion } from 'framer-motion';
import { Trophy, RotateCcw, Share2, Timer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDuration } from './GameOverTimer';

export default function GameOver({ winner, onRestart, durationSeconds, winCardCount, isSinglePlayer }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md p-6"
      style={{ background: 'radial-gradient(ellipse at 50% 30%, #1a2a6e88 0%, #07091fcc 100%)' }}
    >
      <motion.div
        initial={{ scale: 0.7, opacity: 0, y: 40 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 22, delay: 0.1 }}
        className="w-full max-w-xs rounded-3xl overflow-hidden shadow-2xl"
        style={{ background: 'linear-gradient(160deg, #12185e 0%, #0a0e2e 100%)', border: '2px solid rgba(255,193,7,0.5)' }}
      >
        {/* Header */}
        <div className="relative pt-10 pb-6 px-6 text-center" style={{ background: 'linear-gradient(180deg, rgba(255,193,7,0.12) 0%, transparent 100%)' }}>
          <motion.div
            animate={{ rotate: [0, -8, 8, -8, 0], scale: [1, 1.15, 1] }}
            transition={{ duration: 1.2, repeat: Infinity, repeatDelay: 2 }}
            className="w-20 h-20 mx-auto mb-4 flex items-center justify-center"
          >
            <Trophy className="w-20 h-20 text-primary" />
          </motion.div>

          <h1 className="font-bangers text-4xl text-primary tracking-wider mb-1">Tebrikler!</h1>
          <p className="font-inter text-white/80 text-base">
            {isSinglePlayer ? 'Zaman ustası oldun!' : (
              <><span className="text-primary font-bold">{winner}</span> kazandı!</>
            )}
          </p>

          {durationSeconds != null && (
            <div className="flex items-center justify-center gap-2 mt-3 text-white/60 text-sm font-inter">
              <Timer className="w-4 h-4 text-primary" />
              <span>{formatDuration(durationSeconds)}</span>
            </div>
          )}

          <div className="mt-3 font-inter text-sm text-white/50">
            {winCardCount || 10}/10 doğru sıraladın.
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-3 px-6 pb-8">
          <Button
            onClick={onRestart}
            className="flex-1 h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-bangers text-xl tracking-wider gap-2 rounded-2xl"
          >
            <RotateCcw className="w-5 h-5" />
            Tekrar Oyna
          </Button>
          <button
            onClick={() => {
              if (navigator.share) {
                navigator.share({ title: 'Kronos', text: `${winCardCount || 10} kartı doğru sıraladım!` });
              }
            }}
            className="w-12 h-12 rounded-2xl flex items-center justify-center border-2 border-white/20 bg-white/10 text-white hover:bg-white/20 transition-colors"
          >
            <Share2 className="w-5 h-5" />
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}