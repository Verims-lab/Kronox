# Kronox UI Assets

This folder contains static UI image assets for Kronox.

Adding a file here does not automatically make it part of the app. Runtime usage must be explicit in source code, service worker cache lists, manifest references, or documentation.

---

## Current Runtime Notes

* The Home screen is currently CSS/motion-driven in `src/pages/MainMenu.jsx`.
* Home press feedback is CSS/Framer Motion based, not a pressed-image swap.
* Do not reintroduce old pressed-image button swap unless explicitly requested.
* Prefer WebP for production UI images.
* `kronox_hero_section_v1.webp` is intentionally kept because it is referenced by the service worker/pre-cache flow.

---

## Asset Cleanup Rules

Before deleting any asset, search references in:

* `src/`
* `public/`
* service worker files
* manifest files
* docs
* Health/static checks

Keep an asset only if at least one of these is true:

* it is imported or referenced by runtime source
* it is referenced by service worker or manifest
* it is part of the current accepted product UI
* it is intentionally documented as a kept asset
* it is needed for a near-term approved screen migration

Remove assets when:

* they are old generated mockups
* they belong to the old neon/cosmic identity and are unused
* they are duplicate variants with only case/name differences
* they are old pressed-button variants no longer used
* they are not referenced anywhere

---

## Current Cleanup Candidates

These files must be reference-checked before keeping or deleting:

* `Kronox-Cosmic_background.webp`
* `Kronox_Home_Fantasy_Background.webp`
* `Kronox_Home_Fantasy_background.webp`
* `Kronox_Home_Button_Online.webp`
* `Kronox_Home_Button_Solo.webp`
* `Kronox_Online_CTA_Join.webp`
* `Kronox_Online_CTA_Start.webp`
* `home-background-full.webp`
* `home-screen-final.webp`

Likely keep:

* `kronox_hero_section_v1.webp`

Reason:

* referenced by service worker/pre-cache flow.

---

## Naming Rules

Use clear, lowercase, hyphen-separated filenames for new assets.

Preferred:

```text
home-background.webp
online-cta-start.webp
solo-path-node.webp
```

Avoid future mixed-case duplicates such as:

```text
Kronox_Home_Fantasy_Background.webp
Kronox_Home_Fantasy_background.webp
```

Case-different duplicate names can create cross-platform bugs.

---

## Visual Direction

UI assets should follow the current Kronox visual identity:

* premium fantasy mobile game
* blue/gold heroic UI
* magical portal energy
* tactile carved surfaces
* collectible-card feeling
* readable mobile-first composition

Avoid:

* old neon cosmic dominance
* purple sci-fi as primary identity
* generic SaaS visuals
* generated mockup leftovers
* broken image paths
* remote image URLs for production UI

---

## Important

Do not add Daily Quest assets while Günün Görevi remains paused.

Do not keep unused generated mockups in this folder.

Do not assume Health PASS means an asset is actually used at runtime.
