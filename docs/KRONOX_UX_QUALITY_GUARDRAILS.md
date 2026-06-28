# Kronox UX Quality Guardrails

Status: AI-assisted UX audit guardrails.

This document adapts useful ideas from the Taste Skill project into Kronox-
specific rules for future Base44/Codex design prompts.

Source inspiration:

- https://github.com/Leonxlnx/taste-skill
- Reviewed areas: README, `design-taste-frontend`, `redesign-existing-projects`,
  `imagegen-frontend-mobile`, and the MIT license note.

This is adapted guidance, not vendored skill content. Do not copy external
`SKILL.md` files into Kronox. Use the ideas only after translating them into
Kronox product contracts.

## Purpose

Kronox UX work should reduce generic AI-looking UI while preserving the game:

- mobile-first timeline trivia
- dark navy fantasy/arcade identity
- blue/gold heroic surfaces with cyan energy where useful
- readable Turkish copy and numbers
- safe drag/drop, Online start, notifications, and profile/settings flows
- Base44 production path and current React/Tailwind stack

The goal is not to make Kronox look like a landing page. The goal is to make
Kronox feel more like a premium mobile game without breaking mechanics.

## Scope

Apply these guardrails to:

- Home and first-launch flows
- Solo gameplay, Solo map, result popups, and record congratulations
- Online setup, lobby, waiting, start, reconnect, and game screens
- Profile, Settings, Friends, Invites, and account-link entry points
- Leaderboard and public identity surfaces
- Admin/reporting screens when readability or operational clarity is affected
- Visual asset planning, screenshots, and reference-image workflows

## Non-Goals

Do not use UX polish tasks to start:

- a full visual redesign unless explicitly requested
- a framework, routing, Tailwind, or animation-library migration
- a new motion library by default
- a Base44 migration or adapter migration
- gameplay rule changes
- Solo/Online logic rewrites
- public question-bank exposure
- direct copying of external skill files

Visual polish must not touch critical gameplay reducers, question selection,
Base44 functions/entities, or Health code unless the task explicitly asks for it.

## Kronox Design Read

Read Kronox as:

```text
mobile-first social timeline trivia game for quick competitive sessions,
with a premium fantasy arcade language, leaning toward tactile blue/gold
game surfaces, high-contrast Turkish copy, restrained motion, and low-end
Android/WebView-safe performance.
```

Default UX dials for Kronox:

- Visual variance: medium-high inside game surfaces, low inside admin/reporting.
- Motion intensity: short, tactile, and state-driven.
- Density: compact but readable for mobile; avoid empty decorative panels.
- Asset weight: meaningful and optimized, never blocking gameplay startup.
- Privacy strictness: public username only.

## Visual Consistency Rules

Typography:

- Use clear hierarchy: screen title, section title, card title, helper text,
  button text, stat number, small label.
- Keep Turkish copy readable at small mobile widths.
- Important numbers must be unambiguous: rank, `HAMLE`, timer, Kronox Puan,
  Elmas, Seviye, streaks, and rewards.
- Prefer tabular or stable numeric treatment for repeated score/timer values.
- Do not rely on decorative type if it weakens gameplay clarity.

Color and accents:

- Keep dark navy/deep blue as the main base.
- Use gold/amber for reward, prestige, and primary game action.
- Use cyan/electric blue for magical energy and confirmation.
- Use red only for errors, wrong placement, destructive actions, or urgent
  warnings.
- Purple can support atmosphere but must not become the dominant identity.
- Avoid generic purple-blue startup gradients, glow spam, and random accent
  switching.

Surfaces and depth:

- Surfaces should feel tactile: carved panels, plated buttons, framed cards,
  and layered depth.
- Cards must communicate hierarchy or gameplay meaning, not exist only because
  AI design often defaults to cards.
- Keep corner radius, border weight, and shadow language consistent per screen.
- Use depth to guide the eye. Do not add depth near timeline drop targets if it
  makes placement ambiguous.

Timeline and gameplay cards:

- Timeline readability wins over decoration.
- Drop zones must stay visually distinct during drag.
- Active card text must fit long words without overlap.
- Wrong placement feedback must be visible and short, and must not insert wrong
  cards or lock drag state.
- Tutorial hands, hints, and highlights are visual-only unless gameplay rules
  explicitly say otherwise.

Profile, Settings, and list rows:

- Profile is the player identity/progress hub, not a plain account page.
- Settings is for privacy, account, and app preferences, not category gameplay
  selection.
- Profile > Profil Bilgileri owns username, optional private profile fields,
  and `Kategori seçimi`.
- List rows need consistent icon placement, label hierarchy, pressed/disabled
  states, and back navigation.
- BottomNav remains exactly `Ana Sayfa`, `Liderlik`, `Profil`.

Leaderboard:

- The current user row should be obvious and competitive.
- Only the user's own row may open profile settings.
- Public identity is username only.
- Do not render email, provider ID, owner_key, raw guest_id, or internal
  player_key.

## Motion And Performance Rules

- Prefer transform and opacity for animation.
- Avoid layout-heavy animation, repeated blur loops, and large glowing stacks.
- Keep gameplay motion short, tactile, and responsive.
- Avoid animation that changes hit-testing, scroll ownership, or drag/drop
  geometry.
- Respect reduced-motion preferences where practical while preserving essential
  feedback through color/state changes.
- Low-end Android/WebView smoothness is a release proof concern, not something
  static Health can prove.
- Do not introduce GSAP, Motion, or another library unless a future task
  explicitly approves the dependency and validates bundle/performance impact.

## Mobile Interaction Rules

- Primary touch targets should be comfortable for thumbs.
- Fixed gameplay screens must not accidentally page-scroll.
- Scrollable areas must be intentional and scoped.
- Back navigation must be obvious on subroutes and sheets.
- Loading states should preserve surrounding layout rather than blanking the
  whole screen.
- Empty states should explain what can happen next without generic filler copy.
- Error states should be Turkish, actionable, and safe.
- Disabled and pressed states must be visible.
- Icon-only controls require accessible names.
- Sheets, modals, and popups must not trap or hide essential actions behind the
  keyboard, notch, home indicator, or Android navigation bar.

## Privacy And Safety UI Rules

- Public identity is username only.
- Do not expose email, provider ID, owner_key, raw guest_id, internal
  player_key, raw guest token, answer years, correct answers, or full question
  bank content in public UI.
- Destructive actions require confirmation and clear consequences.
- Admin/reporting screens can be utilitarian, but must remain readable and must
  not leak private identifiers in normal public flows.
- Health Check is a contract guard. It is not release proof.

## Asset And Reference Workflow

- Use screenshots and generated references as direction unless the user asks
  for exact matching.
- For exact-match reference tasks, match composition, spacing, hierarchy, copy
  placement, and color while preserving product contracts.
- Generated mobile references should be app-native and readable, not phone-
  sized websites.
- Assets must be optimized and dimensioned. Do not load heavy decorative art in
  the critical gameplay startup path.
- Use transparent logo assets where transparency is intended. Avoid fake
  transparency baked into dark rectangles.

## Base44 Prompt Insertion Block

```text
UX QUALITY GUARDRAILS
Kronox is a mobile-first social timeline trivia game, not a landing page or
SaaS dashboard. Preserve the existing React/Tailwind/Base44 stack and current
product contracts. Improve only the requested surface. Do not start a full
redesign, add a motion library, change gameplay rules, expose question-bank
data, or touch Base44 functions/entities unless explicitly requested.

Design read: premium fantasy arcade mobile game, dark navy base, blue/gold
heroic UI, cyan energy, tactile card surfaces, readable Turkish copy, strong
numbers, thumb-safe controls, and low-end Android/WebView-safe performance.

Gameplay clarity wins: timeline drop zones, drag/drop hit-testing, HAMLE
counts, Online start/reconnect, and notifications must stay stable. Prefer
transform/opacity motion, clear loading/empty/error states, visible pressed and
disabled states, username-only public identity, and no private IDs in public UI.
```

## Codex Prompt Insertion Block

```text
UX AUDIT / FIX RULES
Before editing, inspect the existing screen and state owner. Keep changes
focused and reviewable. Preserve current routes, BottomNav, Base44 production
path, Solo/Online separation, profile/settings ownership, and Health contract
intent. Do not perform a broad visual rewrite.

Audit for generic AI UI: inconsistent accents, unreadable numbers, cramped
Turkish copy, weak pressed/disabled/loading/error states, card spam, glow spam,
touch targets that feel small, public private-ID leaks, and animation that
risks drag/drop, scroll, or WebView performance.

Fix only the requested issue. Use existing components/helpers where possible.
Do not add GSAP or a new motion library by default. Static checks are useful,
but final mobile/device/gameplay confidence still requires manual proof.
```

## Health Candidate Cases

High-signal future Health ideas:

- Profile/Settings route ownership stays intact: `Profil Bilgileri`,
  `Arkadaşlarım`, `Ayarlar`, privacy, and account deletion stay on their
  intended screens.
- BottomNav visible tabs remain `Ana Sayfa`, `Liderlik`, `Profil`; Online is
  Home CTA-owned.
- Solo and Online question cards share long-word fit protection without
  exposing raw question bank data.
- Timeline visual changes preserve drag/drop hit-test contracts and do not
  add layout-heavy animation around drop zones.
- Public Leaderboard, lobby, invite, notification, and profile surfaces never
  render private identifiers.
- Visual updates do not introduce full redesign markers in focused tasks.
- Heavy animation/blur/glow is absent from gameplay-critical paths unless a
  manual performance proof gate is documented.
- Loading, empty, error, disabled, and pressed states exist for Profile,
  Settings, Friends, Invites, Online lobby, and Leaderboard flows.
- Asset additions include dimensions/optimization notes and do not load large
  decorative art before first gameplay interaction.

Do not treat these candidates as implemented Health unless a future task adds
the actual cases.
