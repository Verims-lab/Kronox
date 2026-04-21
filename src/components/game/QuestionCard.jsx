import React from 'react';
import { motion } from 'framer-motion';
import { HelpCircle } from 'lucide-react';

export default function QuestionCard({ question }) {
  return (
    <motion.div
      initial={{ rotateY: 180, opacity: 0 }}
      animate={{ rotateY: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 200, damping: 20 }}
      className="relative flex flex-col items-center justify-center 
        w-full max-w-xs mx-auto p-5 rounded-xl
        border-2 border-primary/50 bg-gradient-to-br from-primary/15 to-primary/5
        shadow-xl shadow-primary/20"
    >
      <div className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-primary flex items-center justify-center shadow-lg">
        <HelpCircle className="w-5 h-5 text-primary-foreground" />
      </div>
      <p className="font-inter text-foreground text-center text-sm leading-relaxed">
        {question}
      </p>
      <div className="mt-3 text-primary/40 text-xs font-cinzel tracking-widest">
        KRONOS
      </div>
    </motion.div>
  );
}