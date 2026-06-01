# Kronox UI Assets

This folder contains production UI images and legacy/generated visual assets.
Do not assume that dropping a file here automatically wires it into the app;
runtime usage must be explicit in source.

## Current Runtime Notes

- The Home screen is currently CSS/motion-driven in `src/pages/MainMenu.jsx`.
- Home press feedback is CSS/framer-motion based, not a pressed-image swap.
- `public/kronox-sw.js` still pre-caches `kronox_hero_section_v1.webp`.
- Prefer WebP for production UI images.

## Cleanup Rules

- Keep assets only when source code, the service worker, or documentation
  intentionally references them.
- Remove old PNG/pressed-button variants when the active UI no longer imports
  them.
- Do not add Daily Quest assets while Günün Görevi remains paused.
