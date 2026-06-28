# Kronox Visual Asset Readiness

Status: asset pipeline readiness note.

This document prepares Kronox for higher-quality visual assets without starting a visual redesign. This pass makes no full visual redesign.

## Current Direction

Kronox is mobile portrait first with a premium fantasy arcade direction:
blue/gold heroic UI, tactile card/game surfaces, magical portal energy, and
readable high-contrast gameplay. Visual polish must not hurt clarity,
timeline placement, drag/drop, or mobile performance.

## Asset Areas

| Area | Current readiness | Risk | Recommendation |
| --- | --- | --- | --- |
| Card art/backgrounds | Repo/public assets exist; no full art pipeline | large images can slow mobile gameplay | Use WebP/AVIF where supported; provide fixed dimensions and low-cost fallback |
| Home/hero visuals | Current UI uses web assets and layered CSS | heavy blur/glow can dominate identity | Keep blue/gold fantasy identity; avoid old purple cosmic dominance |
| App Store / Play Store screenshots | Release proof docs exist | screenshots can drift from live build | Capture from real device/build after every visual milestone |
| Icon/splash | Icon checks exist for iOS alpha | generated wrapper output remains manual proof | Keep `npm run check:ios-icons`; verify final IPA/AAB assets manually |
| Responsive sizes | Mobile guardrail docs exist | high-density assets may overflow or blur | Store 1x/2x or responsive variants with explicit dimensions |
| Lazy loading | Partial, asset-specific | loading large art during drag/drop can jank | Lazy-load non-gameplay decorative assets; preload critical gameplay assets |
| Naming/folders | Public asset READMEs exist | unclear ownership invites stale files | Use feature-oriented names: `solo-card-bg-v1.webp`, `online-lobby-frame-v1.webp` |
| Fallback behavior | Not uniform | missing asset can produce broken UI | Prefer CSS color/frame fallback and alt text where relevant |
| CDN/storage | Not needed at current small scale | future asset growth can bloat repo/build | Reassess when large seasonal/cosmetic assets land |

## Folder Guidance

```text
public/assets/ui/            shared UI frames, buttons, background surfaces
public/assets/categories/    category thumbnails/icons only, not source-of-truth data
public/assets/questions/     media/support files only, never full question bank
public/assets/icons/         app and PWA icons
public/assets/store/         future screenshot/source assets if added
```

Forbidden in public assets:

- secrets, tokens, auth headers, private keys
- raw guest IDs/tokens, provider IDs, owner keys, internal player keys
- emails or private user data
- full question bank, answer years, correct answers
- admin-only reports or analytics exports

## Performance Rules

- Do not load large decorative art before first interactive gameplay.
- Gameplay drag/drop must not wait on image decode or expensive layout.
- Use stable width/height or aspect-ratio to avoid layout shift.
- Avoid stacking many blurred/glowing layers on mobile.
- Prefer preloading only the assets needed for the next visible screen.
- Keep Health/admin/report visuals lightweight; they are utility surfaces.

## UX Quality Asset Rules

- Treat visual references as direction unless the task explicitly asks for an
  exact match.
- Mobile reference frames must feel app-native, not like desktop landing pages
  squeezed into a phone.
- Asset choices must support the current blue/gold fantasy arcade language and
  must not reintroduce purple cosmic/neon dominance as the primary identity.
- Logo and emblem assets that need transparency must ship with real alpha, not
  dark rectangles pretending to be transparent.
- Use images, textures, and decorative marks only when they improve hierarchy,
  reward, atmosphere, or comprehension. Avoid decorative clutter around
  timeline drop zones and game-critical hit targets.
- Compress large assets and keep runtime exports separate from any future
  source art. Prefer WebP/AVIF where supported, with a safe fallback for
  wrappers/browsers that need it.
- Do not place large new art, noise overlays, or blur-heavy atmospheres on the
  critical app-start or game-start path without a documented manual mobile
  performance proof gate.
- Screenshots used for store or prompt references must avoid private IDs,
  emails, raw guest identifiers, internal keys, and full question-bank content.

## Store Screenshot Readiness

Before store capture:

- Use real device or store-equivalent wrapper build.
- Capture Home, Solo gameplay, Online lobby, Leaderboard, Profile, and one
  reward/economy moment.
- Confirm safe area, notch, home indicator, and Android navigation behavior.
- Confirm screenshots do not expose private IDs or test emails.
- Confirm copy matches current product: HAMLE, Puan/Kronox Puan, username-only.

## Future Asset Pipeline

When higher-quality assets are introduced:

1. Add source asset and optimized runtime export together.
2. Document ownership and intended feature/screen.
3. Verify mobile size, decode cost, and fallback path.
4. Run `npm run build` and visual/manual mobile proof.
5. Avoid redesigning all screens in the same change.
