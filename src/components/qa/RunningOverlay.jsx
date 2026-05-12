import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';

export default function RunningOverlay({ visible, label, progress, subtitle }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center"
          style={{ background: 'rgba(5,7,22,0.92)', backdropFilter: 'blur(8px)' }}
        >
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.85, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="w-80 rounded-3xl p-7 space-y-5 shadow-2xl"
            style={{
              background: 'linear-gradient(160deg, #0f1428 0%, #0a0f23 100%)',
              border: '1px solid rgba(250,204,21,0.25)',
              boxShadow: '0 0 60px rgba(250,204,21,0.12)',
            }}
          >
            {/* Icon */}
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="relative w-16 h-16">
                <motion.div
                  className="absolute inset-0 rounded-full"
                  animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0, 0.4] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  style={{ background: 'rgba(250,204,21,0.2)' }}
                />
                <div className="absolute inset-0 rounded-full border border-primary/20 bg-primary/8 flex items-center justify-center">
                  <Loader2 className="w-7 h-7 animate-spin text-primary" />
                </div>
              </div>
              <div>
                <p className="font-cinzel text-base text-primary font-bold tracking-widest">
                  SİMÜLASYON
                </p>
                <p className="font-inter text-sm text-white/70 mt-1">{label}</p>
                {subtitle && (
                  <p className="font-inter text-[10px] text-white/30 mt-0.5">{subtitle}</p>
                )}
              </div>
            </div>

            {/* Progress */}
            <div className="space-y-2">
              <div className="flex justify-between font-inter text-xs text-white/30">
                <span>İlerleme</span>
                <span className="font-cinzel text-primary font-bold">{progress}%</span>
              </div>
              <div className="w-full h-2.5 rounded-full overflow-hidden"
                style={{ background: 'rgba(255,255,255,0.06)' }}>
                <motion.div
                  className="h-full rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.25 }}
                  style={{ background: 'linear-gradient(to right, #f59e0b, #facc15)' }}
                />
              </div>
            </div>
            <p className="font-inter text-[10px] text-white/20 text-center">
              Lütfen bekleyin — tamamlanana kadar çıkmayın.
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}