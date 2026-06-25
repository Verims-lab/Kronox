import React from 'react';
import { motion } from 'framer-motion';

export default function SplashScreen() {
  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center"
      role="status"
      aria-live="polite"
      aria-label="Kronox yükleniyor"
      style={{
        // Match the pre-React splash + index.html body background exactly so
        // there is no color burst when React mounts over the pre-splash.
        background: 'radial-gradient(circle at 50% 30%, #1a0a3a 0%, #0a0e2e 55%, #050716 100%)',
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <span
        className="block h-12 w-12 animate-spin rounded-full"
        aria-hidden="true"
        style={{
          border: '3px solid rgba(148,163,184,0.25)',
          borderTopColor: 'rgba(148,163,184,0.85)',
        }}
      />
    </motion.div>
  );
}
