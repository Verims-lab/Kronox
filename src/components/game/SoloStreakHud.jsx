import React, { useEffect } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Flame, Gem, TimerReset } from 'lucide-react';

const COPY = {
  streak2: ['Kombo x2', 'Temiz seri'],
  streak3: ['Alev Serisi', 'Seri yükseliyor'],
  streak4: ['Seri Ödülü', '+3 Elmas'],
  streak5: ['KRONOX SERİSİ!', '+5 Elmas'],
};

export default function SoloStreakHud({ streak = 0, feedback, onFeedbackDone }) {
  const reduced = useReducedMotion();
  useEffect(() => {
    if (!feedback) return undefined;
    const timer = window.setTimeout(() => onFeedbackDone?.(), reduced ? 900 : 1650);
    return () => window.clearTimeout(timer);
  }, [feedback, onFeedbackDone, reduced]);
  const Icon = feedback?.milestone === 'streak3' ? Flame : feedback?.milestone === 'streak5' ? TimerReset : Gem;
  const copy = COPY[feedback?.milestone] || [];
  const visualOnlyRewardMilestone = (feedback?.milestone === 'streak4' || feedback?.milestone === 'streak5')
    && (feedback?.rewardStatus === 'unsupported' || feedback?.rewardStatus === 'visual');
  const titleText = visualOnlyRewardMilestone
    ? (feedback?.milestone === 'streak5' ? 'KRONOX SERİSİ!' : 'Temiz Seri')
    : copy[0];
  const rewardText = feedback?.rewardStatus === 'failed'
    ? 'Ödül alınamadı'
    : feedback?.rewardStatus === 'pending'
      ? 'Ödül doğrulanıyor'
      : visualOnlyRewardMilestone
        ? 'Seri devam ediyor'
        : copy[1];
  return (
    <div className="pointer-events-none relative z-40 flex h-8 items-center justify-center" data-kronox-solo-streak-hud="true">
      {streak >= 2 && <div className="rounded-full border border-primary/45 bg-background/85 px-3 py-1 font-inter text-[11px] font-black text-primary shadow-[0_0_14px_rgba(250,204,21,0.22)]">{streak >= 5 ? 'Kronox Serisi' : streak >= 3 ? 'Alev Serisi' : `Kombo x${streak}`}</div>}
      <AnimatePresence>
        {feedback && <motion.div key={feedback.key} className="fixed left-1/2 z-[90] max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-2xl border border-primary/55 bg-background/95 px-5 py-3 text-center shadow-[0_0_28px_rgba(34,211,238,0.35),0_0_20px_rgba(250,204,21,0.28)]" style={{ top: 'max(16%, calc(env(safe-area-inset-top) + 4.5rem))', width: 'min(calc(100vw - 2rem), 20rem)' }} initial={{ opacity: 0, scale: reduced ? 1 : 0.82, y: reduced ? 0 : 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: reduced ? 1 : 1.06, y: reduced ? 0 : -8 }} transition={{ duration: reduced ? 0 : 0.28 }} role="status" aria-live="polite">
          {(feedback.milestone === 'streak4' || feedback.milestone === 'streak5') && [0, 1, 2].map((spark) => <motion.span key={spark} aria-hidden="true" className="absolute h-1.5 w-1.5 rotate-45 bg-accent" style={{ left: `${22 + spark * 28}%`, top: spark === 1 ? -5 : 8 }} animate={reduced ? { opacity: 1, y: 0 } : { opacity: [0, 1, 0], y: [4, -8] }} transition={{ duration: reduced ? 0 : 0.65, delay: reduced ? 0 : spark * 0.08 }} />)}
          <Icon className="mx-auto mb-1 h-5 w-5 text-primary" aria-hidden="true" />
          <p className="font-bebas text-xl text-foreground">{titleText}</p>
          <p className="font-inter text-xs font-bold text-accent">{rewardText}</p>
        </motion.div>}
      </AnimatePresence>
    </div>
  );
}
