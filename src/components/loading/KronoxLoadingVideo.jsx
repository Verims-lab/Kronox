import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';

/**
 * KronoxLoadingVideo — shared autoplay loading animation.
 *
 * Plays the Kronox loading video (muted, looping, inline) and falls back to a
 * lightweight spinner if playback fails or the video can't load. Designed to
 * be safe inside the iOS/Android Base44 WebView wrapper:
 *   - muted + playsInline → autoplay allowed on mobile
 *   - preload="auto" → starts buffering immediately but never blocks the app
 *   - object-contain → never crops/stretches the logo/hourglass
 *
 * The container is transparent; whatever sits behind it (splash gradient or
 * the question loading background) stays visible.
 */
const KRONOX_LOADING_VIDEO_URL =
  'https://media.base44.com/videos/public/6a05b47e401bb23c2f21a522/fa1380024_LoadingKronox.mp4';

export default function KronoxLoadingVideo({
  className = '',
  style = {},
  maxWidthClassName = 'max-w-[75%]',
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className={`flex items-center justify-center ${className}`} style={style}>
        <Loader2 className="h-9 w-9 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <video
      src={KRONOX_LOADING_VIDEO_URL}
      autoPlay
      muted
      loop
      playsInline
      preload="auto"
      onError={() => setFailed(true)}
      className={`h-auto w-full ${maxWidthClassName} object-contain bg-transparent ${className}`}
      style={{ background: 'transparent', ...style }}
    />
  );
}