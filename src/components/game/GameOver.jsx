import React from 'react';
import { motion } from 'framer-motion';
import { Trophy, RotateCcw, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function GameOver({ winner, onRestart }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-md p-6"
    >
      <div className="text-center space-y-6 max-w-sm">
        <motion.div
          animate={{ rotate: [0, -10, 10, -10, 0], scale: [1, 1.2, 1] }}
          transition={{ duration: 1, repeat: Infinity, repeatDelay: 2 }}
        >
          <Trophy className="w-20 h-20 text-primary mx-auto" />
        </motion.div>

        <div>
          <h1 className="font-cinzel text-3xl font-bold text-primary mb-2">
            Tebrikler!
          </h1>
          <p className="font-inter text-foreground text-lg">
            <span className="font-bold text-primary">{winner}</span> oyunu kazandı!
          </p>
        </div>

        <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm">
          <Clock className="w-4 h-4" />
          <span>10 kartı ilk tamamlayan oyuncu</span>
        </div>

        <Button
          onClick={onRestart}
          size="lg"
          className="bg-primary text-primary-foreground hover:bg-primary/90 font-cinzel gap-2"
        >
          <RotateCcw className="w-4 h-4" />
          Yeni Oyun
        </Button>
      </div>
    </motion.div>
  );
}