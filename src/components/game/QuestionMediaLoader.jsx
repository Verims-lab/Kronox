import React from 'react';
import { motion } from 'framer-motion';

export default function QuestionMediaLoader() {
  return (
    <motion.div
      className="w-full aspect-[3/4] rounded-2xl overflow-hidden relative"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Dark gradient background */}
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(135deg, #0B1F3A 0%, #2D1B4E 50%, #1a0f2e 100%)',
        }}
      />

      {/* Animated glow orbs */}
      <motion.div
        className="absolute inset-0 flex items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        {/* Center pulse */}
        <motion.div
          className="absolute w-32 h-32 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(250,204,21,0.15) 0%, transparent 70%)',
          }}
          animate={{
            scale: [1, 1.4, 1],
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{
            duration: 2.4,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />

        {/* Rotating neon accent */}
        <motion.div
          className="absolute w-20 h-20 rounded-full border border-primary/40"
          animate={{
            rotate: 360,
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: 'linear',
          }}
        />

        {/* Kronox-branded loader text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          <motion.div
            className="text-center"
            animate={{ y: [0, -4, 0] }}
            transition={{
              duration: 1.8,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          >
            <p className="font-bangers text-primary text-lg tracking-widest">KRONOX</p>
            <p className="font-inter text-white/40 text-xs mt-2 tracking-wide">Görsel hazırlanıyor...</p>
          </motion.div>
        </div>
      </motion.div>

      {/* Shimmer overlay */}
      <motion.div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.05) 50%, transparent 100%)',
        }}
        animate={{
          x: ['-100%', '100%'],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
    </motion.div>
  );
}