import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Play } from 'lucide-react';
import { sounds } from '@/lib/gameSounds';

export default function SoloLevelStartTutorialPopup({
  open = false,
  config = null,
  onClose,
}) {
  if (!config) return null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[88] flex items-center justify-center px-4 py-8"
          data-kronox-solo-level-start-tutorial-popup="true"
          data-kronox-solo-level-start-tutorial-key={config.key}
          role="dialog"
          aria-modal="true"
          aria-label={config.title || 'Solo eğitim'}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          style={{
            background: 'radial-gradient(circle at 50% 34%, rgba(20,86,155,0.28), rgba(3,8,22,0.84) 58%, rgba(3,8,22,0.92) 100%)',
            backdropFilter: 'blur(7px)',
          }}
        >
          <motion.div
            className="relative w-full max-w-[min(26rem,calc(100vw-2rem))] overflow-hidden rounded-[28px] px-5 pb-6 pt-5"
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ type: 'spring', stiffness: 250, damping: 24 }}
            style={{
              background: 'linear-gradient(180deg, rgba(9,31,66,0.98), rgba(5,14,34,0.98))',
              border: '1.5px solid rgba(255,201,40,0.86)',
              boxShadow: '0 22px 60px rgba(0,0,0,0.52), inset 0 1px 0 rgba(255,255,255,0.08), 0 0 22px rgba(56,189,248,0.20)',
            }}
          >
            <button
              type="button"
              aria-label="Eğitim penceresini kapat"
              onClick={() => {
                try { sounds.tap(); } catch { /* optional */ }
                if (onClose) onClose(config);
              }}
              className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300/70"
              style={{
                background: 'rgba(15,31,61,0.9)',
                border: '1px solid rgba(167,196,229,0.42)',
                color: '#F8FAFC',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 0 14px rgba(85,216,255,0.10)',
              }}
            >
              <X className="h-5 w-5" strokeWidth={2.5} />
            </button>

            <div
              className="mb-5 mt-9 flex aspect-video w-full items-center justify-center rounded-2xl"
              data-kronox-solo-level-start-tutorial-video-placeholder="true"
              style={{
                background: 'linear-gradient(135deg, rgba(12,28,58,0.94), rgba(4,12,30,0.96))',
                border: '1px solid rgba(85,216,255,0.24)',
                boxShadow: 'inset 0 0 24px rgba(85,216,255,0.06)',
              }}
            >
              <div className="flex flex-col items-center gap-2 text-center">
                <span
                  className="flex h-12 w-12 items-center justify-center rounded-full"
                  style={{
                    color: '#0A1023',
                    background: 'linear-gradient(180deg, #FFE26A, #FFC928 58%, #E7A900)',
                    boxShadow: '0 0 18px rgba(250,204,21,0.32)',
                  }}
                >
                  <Play className="h-6 w-6" fill="currentColor" strokeWidth={2.5} />
                </span>
                <span className="font-inter text-xs font-semibold text-slate-300">
                  {config.videoLabel || 'Eğitim videosu hazırlanıyor'}
                </span>
              </div>
            </div>

            <div className="space-y-2 text-center">
              <h2
                className="text-2xl font-black uppercase text-white"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 0 }}
              >
                {config.title}
              </h2>
              <p className="mx-auto max-w-[22rem] font-inter text-sm font-semibold leading-relaxed text-slate-300">
                {config.copy}
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
