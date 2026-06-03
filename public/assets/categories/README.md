# Kronox Category Image Assets

Static category images for Kronox category cards live here.

These assets are optional. If a category image is missing, the app should fall back to the current UI/icon treatment without broken image paths.

## Current Categories

| File | Category |
| --- | --- |
| `chronicle.webp` | Chronicle |
| `flashback.webp` | Flashback |
| `kult.webp` | Kült |
| `viral.webp` | Viral |
| `arena.webp` | Arena |
| `level-up.webp` | Level Up |

## Specs

- Recommended size: 400×400px or larger
- Recommended ratio: 1:1 square
- Preferred format: WebP
- PNG/JPG may be used only if WebP is unavailable
- Images should work with `object-fit: cover`
- Keep file sizes small for mobile/PWA performance

## Visual Direction

Category images should follow the current Kronox visual identity:

- premium fantasy mobile game
- blue/gold heroic UI
- magical portal energy
- tactile collectible-card feeling
- readable, iconic category mood

Avoid:

- old neon cosmic dominance
- generic Unsplash/photo placeholders
- SaaS/dashboard visuals
- broken remote image URLs

## Important

Do not add category images that introduce new category names.

Canonical category definitions live in:

```text
docs/KRONOX_CATEGORY_TAXONOMY.md
