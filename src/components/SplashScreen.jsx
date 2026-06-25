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
        // Match the pre-React splash + index.html body background exactly so
        // there is no color burst when React mounts over the pre-splash.
        background: 'radial-gradient(circle at 50% 30%, #1a0a3a 0%, #0a0e2e 55%, #050716 100%)',
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {/* Transparent container — the dark gradient stays visible behind the
          centered Kronox loading animation. No opaque block, no yellow. */}
      <KronoxLoadingVideo maxWidthClassName="max-w-[82vw]" style={{ maxHeight: '60vh' }} />
    </motion.div>
  );
}