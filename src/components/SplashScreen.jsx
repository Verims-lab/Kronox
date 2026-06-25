import React from 'react';
import { motion } from 'framer-motion';
import KronoxLoadingVideo from '@/components/loading/KronoxLoadingVideo';

export default function SplashScreen() {
  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center"
      style={{
        background: 'linear-gradient(to bottom, #0B1F3A 0%, #1E3A8A 100%)',
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {/* Transparent container — the splash gradient stays visible behind the
          centered Kronox loading animation. No opaque block behind it. */}
      <KronoxLoadingVideo maxWidthClassName="max-w-[80%]" style={{ maxHeight: '60vh' }} />
    </motion.div>
  );
}