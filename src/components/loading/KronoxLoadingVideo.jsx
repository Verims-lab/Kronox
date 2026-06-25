import React, { useRef, useState } from 'react';

/**
 * KronoxLoadingVideo — shared autoplay loading animation.
 *
 * Premium, flash-free loading visual:
 *   - The video is invisible (opacity 0) until it reaches a usable ready
 *     state (loadeddata/canplay), then fades in over the dark background.
 *     This prevents the empty-black/white pop and the "centered box" look.
 *   - The container background is transparent so the surrounding Kronox dark
 *     gradient shows through — no rectangle, border, or card.
 *   - On error it renders a clean dark spinner, never yellow/white.
 *
 * Safe inside the iOS/Android Base44 WebView wrapper:
 *   - muted + playsInline → autoplay allowed on mobile
 *   - preload="auto" → starts buffering immediately, never blocks the app
 *   - object-contain → never crops/stretches the logo/hourglass
 */
const KRONOX_LOADING_VIDEO_URL =
  'https://media.base44.com/videos/public/6a05b47e401bb23c2f21a522/e9163c6c6_ApplicationLoading.mp4';

export default function KronoxLoadingVideo({
  className = '',
  style = {},
  maxWidthClassName = 'max-w-[75vw]',
}) {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const videoRef = useRef(null);

  if (failed) {
    return (
      <div className={`flex items-center justify-center ${className}`} style={style}>
        <span
          className="block h-10 w-10 animate-spin rounded-full"
          style={{
            border: '3px solid rgba(148,163,184,0.25)',
            borderTopColor: 'rgba(148,163,184,0.85)',
          }}
        />
      </div>
    );
  }

  return (
    <video
      ref={videoRef}
      src={KRONOX_LOADING_VIDEO_URL}
      autoPlay
      muted
      loop
      playsInline
      preload="auto"
      onLoadedData={() => setReady(true)}
      onCanPlay={() => setReady(true)}
      onError={() => setFailed(true)}
      className={`h-auto w-full ${maxWidthClassName} object-contain ${className}`}
      style={{
        background: 'transparent',
        opacity: ready ? 1 : 0,
        transition: 'opacity 0.45s ease',
        ...style,
      }}
    />
  );
}