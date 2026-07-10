import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Play } from 'lucide-react';
import { sounds } from '@/lib/gameSounds';

export default function SoloLevelStartTutorialPopup({
  open = false,
  config = null,
  onClose,
}) {
  const [videoFailed, setVideoFailed] = useState(false);
  const videoRef = useRef(null);
  const videoSrc = typeof config?.videoSrc === 'string' ? config.videoSrc.trim() : '';
  const showVideo = Boolean(videoSrc && !videoFailed);

  useEffect(() => {
    setVideoFailed(false);
  }, [videoSrc, open]);

  useEffect(() => {
    const video = videoRef.current;
    if (!open || !showVideo || !video) return undefined;
    try {
      video.pause();
      video.currentTime = 0;
      video.muted = true;
      video.loop = true;
      video.controls = false;
      const playPromise = video.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => null);
      }
    } catch {
      // Muted inline autoplay should work; rejection is non-fatal.
    }
    return () => {
      try {
        video.pause();
        video.currentTime = 0;
      } catch {
        // Video cleanup is best-effort.
      }
    };
  }, [open, showVideo, videoSrc]);

  const handleClose = useCallback(() => {
    try { sounds.tap(); } catch { /* optional */ }
    const video = videoRef.current;
    try {
      video?.pause?.();
      if (video) video.currentTime = 0;
    } catch {
      // Close should never be blocked by media cleanup.
    }
    if (onClose) onClose(config);
  }, [config, onClose]);

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
            className="relative flex w-full max-w-[min(26rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-[28px] px-5 pb-5 pt-5"
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ type: 'spring', stiffness: 250, damping: 24 }}
            style={{
              height: 'min(86dvh, 42rem)',
              background: 'linear-gradient(180deg, rgba(9,31,66,0.98), rgba(5,14,34,0.98))',
              border: '1.5px solid rgba(255,201,40,0.86)',
              boxShadow: '0 22px 60px rgba(0,0,0,0.52), inset 0 1px 0 rgba(255,255,255,0.08), 0 0 22px rgba(56,189,248,0.20)',
            }}
          >
            <button
              type="button"
              aria-label="Eğitim penceresini kapat"
              onClick={handleClose}
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
              className="mb-4 mt-9 flex w-full min-h-0 items-center justify-center rounded-2xl"
              data-kronox-solo-level-start-tutorial-video-placeholder="true"
              data-kronox-solo-level-start-tutorial-video-height="70%"
              data-kronox-solo-level-start-tutorial-video-orientation="portrait"
              style={{
                height: '70%',
                aspectRatio: '9 / 16',
                background: 'linear-gradient(135deg, rgba(12,28,58,0.94), rgba(4,12,30,0.96))',
                border: '1px solid rgba(85,216,255,0.24)',
                boxShadow: 'inset 0 0 24px rgba(85,216,255,0.06)',
              }}
            >
              {showVideo ? (
                <video
                  ref={videoRef}
                  className="h-full w-full rounded-2xl"
                  data-kronox-solo-level-start-tutorial-video="true"
                  src={videoSrc}
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="auto"
                  controls={false}
                  aria-label={config.videoLabel || config.title || 'Eğitim videosu'}
                  onError={() => setVideoFailed(true)}
                  onLoadedMetadata={(event) => {
                    try { event.currentTarget.currentTime = 0; } catch { /* best-effort */ }
                  }}
                  style={{
                    objectFit: 'cover',
                    background: 'transparent',
                  }}
                />
              ) : (
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
              )}
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
            <button
              type="button"
              onClick={handleClose}
              className="mt-auto min-h-12 w-full rounded-2xl px-5 py-3 font-inter text-base font-black tracking-[0.18em] text-slate-950 transition-transform active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-200"
              data-kronox-solo-level-start-tutorial-understood="true"
              style={{
                background: 'linear-gradient(180deg, #FFE26A, #FFC928 58%, #E7A900)',
                border: '1px solid rgba(255,248,189,0.8)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.52), 0 10px 22px rgba(0,0,0,0.36), 0 0 18px rgba(250,204,21,0.28)',
              }}
            >
              ANLADIM
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
