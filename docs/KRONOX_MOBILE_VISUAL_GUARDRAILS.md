# Kronox Mobile And Visual Guardrails

Kronox is a tactile mobile timeline game. Mobile stability and game feel are part of the product, not implementation details.

## Viewport Rules

- Home and gameplay must use a locked viewport based on `100dvh`, with `100vh` only as a fallback.
- Home must remain exactly one viewport and must not vertically scroll.
- Gameplay should avoid page-level vertical scroll. Timeline horizontal scroll is allowed and must stay contained inside the timeline scroller.
- Settings, admin, test, and setup screens may vertically scroll when content requires it.
- Safe areas belong at the screen or fixed chrome level with `env(safe-area-inset-*)`; avoid global body padding that creates hidden extra scroll.

## Overscroll Rules

- Do not add global `overflow: hidden` to `html` or `body` as a shortcut.
- Use scoped viewport locks only for Home and gameplay.
- Use contained scroll behavior for intentional local scrollers.
- During gameplay drag, the page itself should not move; only the timeline may pan horizontally when intended.

## Visual And Motion Rules

- Gameplay UI should feel like premium mobile game interface art, not SaaS panels.
- Prefer transform and opacity animation. Avoid repeated large blurs, layout-thrashing effects, and stacked heavy glows on low-end Android.
- Keep glow restrained: use it to communicate action, turn ownership, placement, and feedback.
- Do not add a new design system framework or generic enterprise component layer.

## Work Separation Rules

- Do not polish UI while fixing multiplayer sync unless explicitly requested.
- Do not change multiplayer sync while doing visual polish unless explicitly requested.
- Do not change Timeline hit-testing, DropZone geometry, drag/drop architecture, placement validation, or question selection during viewport or visual cleanup.
- Future AI patches should prefer isolated additive changes and should name exactly which high-risk gameplay surfaces are intentionally untouched.
