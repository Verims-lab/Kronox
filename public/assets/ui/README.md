# Kronox UI Assets

Static UI images for Kronox may live here. Adding a file here does not automatically make it part of the app; runtime usage must be explicit in source, manifest, service worker cache lists, or docs.

## Current Contract

- Kronox is mobile-first; UI assets must fit portrait phone layouts and safe
  areas before desktop polish.
- Current onboarding teaching is the real level-type first Solo level with
  level-start popups.
- Legacy tutorial hand/finger assets are support-only unless explicitly wired.
- Tutorial overlays and UI images must not block touch input, drag/drop, or
  timeline hit testing.
- Heavy blur/glow effects should be limited and must stay safe for low-end
  Android performance.
- Current visible UI terminology is `HAMLE`, `Puan` / `Kronox Puan`, and
  `Kullanıcı Adı`.
- Do not present `Görünen Ad` / `display_name` as current public identity.
- Do not use `HATA` as the current Solo result/stat label.
- Home / Ana Sayfa must not show Google / Apple / Email login options; account linking belongs under Profile.

## Runtime Notes

- Home is currently a local-asset + CSS/motion composition in
  `src/pages/MainMenu.jsx`: `kronox-logo-home.png` is the centered transparent
  logo and `kronox-hourglass-home.png` is the centered hourglass visual.
- Home logo/hourglass assets must sit directly on the dark blue Home
  background; do not wrap them in visible cards, panels, capsules, or colored
  containers.
- The Home middle section must stay balanced as left `Görevler`, centered
  transparent hourglass, and right `Çark`. The local hourglass PNG must keep a
  real alpha channel; runtime code must not rely on a black-background screen
  blend workaround or add image filters that create a rectangular shadow block.
- The Home CTA stack keeps its shared button dimensions and internal gap; only
  its stack position is balanced so the hourglass-to-Solo and
  Online-to-BottomNav gaps read as equivalent.
- The primary Home CTA is `OYNA` / dynamic `Seviye X`, sourced from the same
  Solo progress helpers as the Solo level path, and direct-starts that resolved
  Solo level. The secondary Home CTA is `ONLINE KAPIŞMA`, remains Home-owned,
  and uses the same dimensions as the primary CTA.
- `Görevler` and `Çark` open centered popups from Home; they must not behave as
  bottom sheets or page-like first-render panels.
- Home press feedback is CSS/Framer Motion based, not a pressed-image swap.
- `kronox_hero_section_v1.webp` is kept because it is referenced by the service
  worker/pre-cache flow.
- Prefer WebP, lowercase hyphenated filenames, and small mobile-friendly files.

## Security

- No secrets, tokens, auth headers, private keys, admin emails, internal IDs,
  `VAPID_PRIVATE_KEY`, GuestProfile tokens/hashes, or service-role details may
  live in public UI assets.
- Do not use remote image URLs, hotlinked placeholders, or broken production
  paths.
