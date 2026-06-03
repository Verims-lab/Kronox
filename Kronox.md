# KRONOX

## Purpose

This document defines the product identity, visual language, game feel, and UX principles of Kronox.

Operational rules, branch workflow, test expectations, Health rules, build marker rules, and output requirements are defined separately in:

```text
KRONOX_CORE_PROMPT.md
```

Do not duplicate workflow rules here.

---

# Product Identity

Kronox is a premium social timeline party game.

Kronox is not:

* a SaaS dashboard
* a trivia website
* an admin panel
* a generic web app
* a flat quiz interface

Kronox should feel:

* social
* tactile
* reactive
* competitive
* energetic
* premium
* modern
* magical
* iconic
* emotionally rewarding

Core emotion:

```text
social tension + dopamine release
```

Players should experience:

* anticipation
* confidence
* panic
* satisfaction
* embarrassment
* excitement

Kronox creates:

```text
party chaos through timeline placement
```

Kronox succeeds or fails based on:

* tactile satisfaction
* emotional reactions
* multiplayer responsiveness
* timeline placement tension
* trustworthy scoring
* stable mobile gameplay

---

# Product Priorities

Kronox priorities, in order:

1. Clarity
2. Responsiveness
3. Tactile feel
4. Emotional payoff
5. Visual polish

Never sacrifice clarity for decoration.

Never sacrifice gameplay stability for visual experimentation.

Never sacrifice timeline placement readability for visual effects.

Never sacrifice mobile performance for heavy UI decoration.

---

# Visual Direction

Kronox has moved away from the old dominant visual identity:

* neon cosmic
* purple sci-fi
* synthwave
* glow-heavy space UI
* thin futuristic outlines

The current direction is:

* premium fantasy mobile game
* polished arcade adventure
* collectible-card inspired
* magical portal energy
* blue/gold heroic UI
* tactile carved game surfaces
* game-store-quality presentation
* warm, iconic, readable, rewarding

Old purple cosmic assets and neon sci-fi styling should be phased out gradually, not removed through risky broad rewrites.

Purple may remain only as secondary/support atmosphere.
Purple must not be the dominant identity.

---

# Visual Language

## Core Style

Use:

* premium fantasy arcade UI
* modern mobile game presentation
* collectible-card inspired surfaces
* magical portal atmosphere
* blue/gold heroic framing
* tactile carved panels
* readable high-contrast text
* iconic, emblematic UI elements

Avoid:

* generic web cards
* SaaS dashboard UI
* admin-panel aesthetics
* flat white cards
* rigid form-heavy layouts
* low-quality fantasy clipart
* thin sci-fi outlines
* glow-only decoration

Kronox should look like crafted mobile game interface art, not assembled web components.

---

# Color Direction

Primary colors:

* royal blue
* electric blue

Accent colors:

* gold
* amber

Support colors:

* deep navy
* slate
* dark stone

Energy color:

* cyan magical portal glow

Purple:

* allowed only as secondary/support atmosphere
* must not dominate screens

Use color to improve readability, hierarchy, and emotional feedback.

---

# Material Language

Use:

* carved stone frames
* gold-trimmed plates
* polished game-metal edges
* magical portal cores
* embossed icons
* collectible-card surfaces
* thick silhouettes
* layered bevel depth
* physical button pressure
* readable high-contrast labels

Avoid completely flat surfaces.

Surfaces should feel touchable, weighted, and crafted.

---

# Depth And Layering

Use:

* carved depth
* bevel highlights
* metal edge catches
* shadowed stone cavities
* layered collectible panels
* portal light behind or within surfaces
* controlled magical glow

Avoid:

* excessive blur
* glow spam
* noisy decoration
* over-rendered effects that reduce clarity
* visual effects near drop zones that hurt placement readability

Depth should support gameplay, not compete with it.

---

# Mobile Viewport Standard

Kronox is mobile portrait first.

Home screen:

* must fit exactly one viewport
* must not vertically scroll
* must not show top/bottom blank overscroll
* must adapt to different phone aspect ratios
* should use `100dvh`, safe-area `env()`, `clamp()`, and proportional positioning where appropriate

Gameplay screens:

* should avoid page-level vertical scroll where possible
* timeline horizontal scrolling is allowed
* scrolling must be intentional and contained

Solo map:

* may scroll vertically inside the intended map area
* top bar and bottom nav behavior must stay stable

Settings/Admin/Test screens:

* vertical scroll is allowed

Never apply global overflow rules that break gameplay, settings, admin, or test pages.

---

# Standard Screen Structure

Where applicable, screens should share a consistent structure:

## Top Bar

Use a standard top area pattern:

* diamond display
* notification bell
* back arrow where needed
* no unnecessary profile/avatar icon on screens where bottom nav already provides Profile access

The top bar should be stable across mobile, PWA, and web mobile viewport.

## Bottom Navigation

The main bottom navigation should be consistent:

* Ana Sayfa
* Liderlik
* Profil

Bottom nav should have consistent:

* height
* icon size
* active/passive state
* spacing
* safe-area behavior

## Fixed Screens

Fixed game-like screens should not accidentally scroll.

Examples:

* Home
* Online main screen, if designed as fixed
* modal/popup-heavy game result screens

## Scroll Screens

Only the intended content area should scroll.

Examples:

* Solo map path
* Settings/Admin/Test pages
* long reports

---

# Typography

Typography must feel premium, readable, and game-like.

Use clear hierarchy:

* main title
* section title
* card title
* helper text
* button text
* stat number
* small label

Avoid:

* random font weights
* accidental italic text
* overly thin text
* cramped labels
* unreadable decorative fonts
* inconsistent all-caps usage

Important Turkish copy should remain readable on mobile.

---

# Number Readability

Numbers must be highly readable across the whole app.

Important:

* the digit `7` must not look like `1`
* score, level, timer, rank, mistake count, and diamond values must be clear
* stat numbers should use a font/style where digits are distinguishable
* timer values should remain compact and readable

Use consistent numeric styling for:

* Kronox Puan
* Elmas
* Seviye
* leaderboard rank
* timer
* mistake count
* speed bonus
* result popup stats

---

# Copy And Terminology

Use Turkish user-facing terminology consistently.

Preferred visible terms:

* Seviye
* Puan
* Kronox Puan
* Elmas
* Liderlik
* Ana Sayfa
* Profil
* Online Kapışma
* Solo Meydan Okuma

Avoid visible user-facing `Level` except where it is part of a category name such as:

```text
Level Up
```

Internal code identifiers may remain English.

User-facing errors should be Turkish, clear, and safe.

Do not expose developer/internal error language to normal users.

---

# Buttons

Buttons should feel:

* carved
* plated
* pressurized
* physically clickable
* gold or blue energy accented
* responsive to state changes

Buttons should not feel like generic web CTAs.

Avoid:

* flat rectangles
* sterile form buttons
* generic Tailwind button surfaces
* weak pressed states
* unclear disabled states

Actionable buttons may pulse subtly, but the effect should read as magical charge or game energy, not generic web animation.

Pressed feedback matters.

---

# Cards

Cards should feel:

* collectible
* framed
* emblematic
* layered
* tactile
* readable at mobile size

Use:

* gold trim
* carved frames
* embossed icons
* portal-energy accents
* clear text hierarchy

Avoid:

* noisy surfaces
* over-decorated frames
* effects that hide question text
* tiny unreadable labels

Cards must support gameplay clarity first.

---

# Timeline Design

The timeline is the heart of Kronox.

Timeline should feel:

* dynamic
* alive
* reactive
* premium
* readable

Active drop zones should respond visually.

However:

* Timeline readability always wins.
* Placement clarity always wins.
* Manual hit-testing stability always wins.
* Scroll containment always wins.

Avoid:

* clutter
* excessive noise
* overbuilt ornaments near drop targets
* visual chaos during drag
* effects that make drop zones ambiguous

The timeline must remain readable during emotional chaos.

---

# Drag Feel

Dragging should feel:

* smooth
* premium
* magnetic
* physically responsive

While dragged, cards may:

* slightly scale up
* gain elevation
* feel “held”
* use smooth ghost motion

Ghost motion should feel:

* buttery
* stable
* responsive

Do not break drag/drop architecture for visual polish.

---

# Placement Feel

Successful placement is one of the most important interactions in Kronox.

Placement should feel:

* impactful
* satisfying
* locked-in
* tactile

Use:

* magnetic slot feeling
* placement bounce
* subtle impact feedback
* blue/cyan energy confirmation
* gold reward highlight where appropriate

Avoid:

* silent placement
* flat transitions
* delayed feedback
* overlong animations

Correct placement should feel rewarding.

Wrong placement should feel visible and emotionally meaningful.

---

# Correct / Wrong Feedback

## Correct Feedback

Correct placement should feel:

* satisfying
* rewarding
* clean
* heroic
* like a dopamine burst

Use:

* green/blue/cyan confirmation
* gold highlight
* short pulse
* tactile snap

## Wrong Feedback

Wrong placement should feel:

* dramatic
* socially funny
* emotionally visible
* memorable

Use:

* red feedback
* shake
* short rejection motion
* clear visual state

Wrong feedback must be visual-only unless the gameplay rule says otherwise.

Wrong cards must not be inserted into the timeline.

Wrong feedback must not lock drag state.

---

# Popups And Result Screens

Popups should not feel like sterile system dialogs.

They should feel:

* game-like
* rewarding
* clear
* tactile
* visually aligned with Kronox fantasy UI

Solo success/failure result popups should have consistent:

* title hierarchy
* star area
* stat boxes
* icons
* time format
* score format
* mistake count format
* speed bonus format
* button layout

Result screens should clearly communicate:

* success/failure
* earned score
* time used
* mistakes
* speed bonus
* next action

Failure screens should still feel emotional and motivating, not empty or administrative.

---

# Icons

Icons should feel consistent.

Use:

* emblematic fantasy/mobile game icons
* clear silhouettes
* readable sizes
* consistent placement
* gold/blue/cyan/red feedback language where appropriate

Important icon groups:

* diamond
* notification bell
* back arrow
* profile
* timer
* star
* mistake/error
* speed bonus
* category icons

Avoid mixing too many unrelated icon styles.

---

# Setup / Lobby Screens

Setup and lobby screens should feel exciting, not administrative.

Players should feel:

```text
Get ready to challenge your friends.
```

Prefer:

* fantasy portal atmosphere
* blue/gold heroic framing
* tactile game buttons
* emblematic category surfaces
* collectible-panel composition
* clear waiting state
* obvious player readiness

Avoid:

* form-heavy first impressions
* dashboard aesthetics
* plain web panels
* unclear waiting states
* weak start-game feedback

Online multiplayer must feel:

* immediate
* alive
* synchronized
* socially reactive

Players should never feel:

* disconnected
* uncertain whose turn it is
* visually desynced
* stuck without feedback

Turn ownership must be obvious within 1 second.

---

# Leaderboard And Profile Feel

Profile and Leaderboard are part of the game world, not utility pages.

They should feel:

* premium
* competitive
* readable
* reward-driven
* consistent with the main game UI

Profile should clearly show:

* Kronox Puan
* Seviye
* Elmas
* progress
* friend/social access where relevant

Leaderboard should clearly show:

* rank
* player identity
* Kronox Puan
* current user position
* competitive status

Leaderboard and Profile score values must feel visually aligned and must use the same product language.

---

# Motion Language

Motion philosophy:

* fast
* responsive
* spring-based
* premium
* tactile
* juicy but not childish

Animations should:

* support gameplay
* enhance emotional feedback
* improve physical feel
* reinforce carved/pressurized surfaces

Prefer:

* spring easing
* snap motion
* micro-bounce
* scale feedback
* directional movement
* impact reactions
* subtle blue/cyan energy charge
* gold highlight flickers on successful actions

Avoid:

* slow cinematic delays
* floaty animations
* excessive bounce
* cartoon energy
* long fades
* random motion
* glow spam

Motion must never make gameplay unclear.

---

# Reduced Motion

Respect reduced motion where possible.

For reduced-motion users:

* reduce shake
* reduce drift
* reduce repeated pulsing
* avoid aggressive scale/rotation
* keep color/state feedback
* keep gameplay clarity

Reduced motion should not remove essential feedback.

---

# Audio

Audio should reinforce tactile feedback and emotional moments.

Prefer audio that is:

* subtle
* punchy
* modern
* premium
* short

Avoid:

* retro arcade clichés
* noisy UI spam
* repetitive sounds
* excessive sound stacking

Silence is also part of emotional rhythm.

---

# Performance Requirements

Performance is critical, especially for:

* mobile devices
* lower-end Android devices
* WebView/PWA environments

Prefer:

* transform animations
* opacity animations
* GPU-friendly rendering
* restrained glows
* scoped effects
* lightweight icon systems
* optimized images

Avoid:

* expensive layout thrashing
* excessive blur filters
* unnecessary rerenders
* heavy glow stacks
* large unoptimized assets
* scroll jank
* animation loops without purpose

All animations must remain performant.

Visual polish must not make the game feel slower.

---

# PWA / WebView Expectations

Kronox should behave well in:

* mobile browser
* installed PWA
* WebView-like environments
* desktop browser mobile viewport

Important:

* safe-area must be respected
* top/bottom bars must not clip
* bottom nav must avoid home indicator collision
* fixed screens should not rubber-band unexpectedly
* keyboard should not crush input flows
* PWA icons/assets should be reliable

Runtime device proof is still required for final release confidence.

---

# Accessibility Principles

Kronox is visual and tactile, but it should still be usable.

Use:

* readable contrast
* clear labels
* meaningful button states
* reasonable tap targets
* aria labels for icon-only controls
* feedback that is not color-only where possible
* reduced-motion support

Avoid:

* tiny tap targets
* low contrast text
* icon-only actions without labels
* color-only critical feedback
* hidden focus traps in popups

Accessibility should support speed and clarity, not make the game feel slower.

---

# Avoid List

Avoid as dominant identity:

* neon cosmic style
* purple-only UI
* sci-fi thin-line panels
* synthwave cards
* starfield UI as the primary system
* glow-heavy space decoration

Avoid generally:

* enterprise dashboards
* admin-panel aesthetics
* generic SaaS visual patterns inside gameplay
* flat white cards
* rigid box-heavy layouts
* flat placeholder panels
* generic fantasy clipart
* low-quality AI-art-looking surfaces
* excessive hard borders
* over-rendered effects
* effects that reduce clarity or performance
* generic web modals
* sterile form-heavy experiences

---

# Incremental Visual Migration

Visual migration must be:

* incremental
* isolated
* rollback-safe

Start with high-visibility surfaces.

Preserve layout and functionality unless explicitly asked to change them.

Visual reskin work must not touch gameplay, multiplayer, Timeline, DropZone, QuestionCard, useGameActions, useLobbySync, or backend functions unless explicitly requested.

Old purple/neon assets may remain temporarily while screens are migrated.

Do not remove old assets in broad sweeps unless reference checks prove they are unused.

---

# Reference Image Rule

Reference images are style direction unless explicitly stated as exact layout target.

If the user says “birebir” or “exactly like this,” then match:

* composition
* size
* spacing
* typography feel
* icon placement
* colors
* visual hierarchy

If the user does not ask for exact copy, use the image as direction and preserve product stability.

Do not invent missing asset filenames.

Do not use broken image paths.

Do not use remote image URLs for production surfaces unless already approved.

---

# Screen-Level Visual Standards

## Home

Home should feel:

* iconic
* premium
* immediate
* one-screen
* no-scroll

Home should clearly lead to:

* Online Kapışma
* Solo Meydan Okuma

## Solo Map

Solo map should feel like a journey.

Use:

* path/road feeling
* visible multiple levels
* clear current/next level
* readable Seviye labels
* controlled scroll

Future levels should show their level numbers.

## Online Main

Online main should feel like preparing for a challenge.

Use:

* compact active categories
* clear friend selection
* tactile invite/start button
* readable selected state
* stable no-scroll layout if designed as fixed

## Lobby Waiting

Lobby waiting should feel alive and social.

Use:

* clear waiting state
* player readiness
* invite status
* start clarity
* no sterile admin layout

## Profile

Profile should feel like the player’s identity and progress hub.

Use:

* clear stat tiles
* premium profile card
* social entry points
* consistent top/bottom bars

## Leaderboard

Leaderboard should feel competitive and rewarding.

Use:

* clear ranks
* strong current user row
* readable Kronox Puan
* consistent stat display
* no unnecessary profile icon in top bar if bottom nav covers Profile

---

# Final Principle

Kronox is a game of tension and release.

Every visual, motion, sound, and interaction should support:

* timeline tension
* social pressure
* confident placement
* dramatic mistakes
* satisfying success
* fast replay desire

Do not make Kronox feel like software.

Make it feel like a premium mobile game.
