# KRONOX

## PRODUCT IDENTITY

Kronox is a premium social timeline party game, not a SaaS dashboard, trivia site, admin panel, or generic web app.

Kronox should feel:
- social
- tactile
- reactive
- competitive
- energetic
- premium
- modern
- magical
- iconic
- emotionally rewarding

Core emotion:
**social tension + dopamine release**

Players should experience:
- anticipation
- confidence
- panic
- satisfaction
- embarrassment
- excitement

Kronox creates:
**party chaos through timeline placement.**

Kronox remains mobile portrait first. Gameplay stability, responsiveness, tactile feel, emotional feedback, and visual polish are still the product priorities, in that order.

---

# ART DIRECTION PIVOT

Kronox has pivoted away from the old dominant visual identity:
- neon cosmic
- purple sci-fi
- synthwave
- glow-heavy space UI
- thin futuristic outlines

The new visual direction is:
- premium fantasy mobile game
- polished arcade adventure
- collectible-card inspired
- magical portal energy
- blue/gold heroic UI
- tactile carved game surfaces
- game-store-quality presentation
- warm, iconic, readable, rewarding

New visuals must follow a fantasy portal / blue-gold / tactile mobile game language. Old purple cosmic assets and neon sci-fi styling should be phased out gradually, not removed in risky broad rewrites.

Migration must be incremental, isolated, and rollback-safe. Gameplay feel and stability matter more than visual experimentation.

---

# CORE EXPERIENCE PRINCIPLES

## Every Interaction Must Feel Tactile

Dragging, placing, revealing, and confirming should create physical feedback.

UI should feel:
- touchable
- carved
- pressurized
- magnetic
- responsive
- satisfying

Avoid:
- flat interactions
- static transitions
- dead clicks
- sterile behavior

---

## Feedback Trumps Decoration

Prioritize:
- motion clarity
- impact
- responsiveness
- emotional payoff

over excessive decoration or visual complexity.

---

## Wrong Answers Are Emotionally Valuable

Failures should feel:
- dramatic
- funny
- socially visible

Treat failures as memorable social moments, not sterile system errors.

---

# MOBILE VIEWPORT STANDARD

Kronox is primarily a mobile portrait game.

Home screen:
- must be exactly one viewport
- must not vertically scroll
- must not show top/bottom blank overscroll
- must adapt to different phone aspect ratios
- use 100dvh, safe-area env(), clamp(), and proportional positioning

Gameplay screens:
- should avoid page-level vertical scroll where possible
- timeline horizontal scrolling is allowed
- scrolling must be intentional and contained

Settings/Admin/Test screens:
- vertical scroll is allowed

Never apply global overflow hidden in a way that breaks gameplay, settings, admin, or test pages.

---

# VISUAL LANGUAGE

## Style

Premium fantasy arcade.
Modern mobile game.
Collectible-card inspired.
Readable, tactile, and heroic.

Kronox should look like crafted mobile game interface art, not assembled web components.

---

## Material Language

Use:
- carved stone frames
- gold-trimmed plates
- polished game-metal edges
- magical portal cores
- embossed icons
- collectible-card surfaces
- thick silhouettes
- layered bevel depth
- physical button pressure
- readable high-contrast labels

Avoid completely flat surfaces.

---

## Color Direction

Primary:
- royal blue
- electric blue

Accent:
- gold
- amber

Support:
- deep navy
- slate
- dark stone

Energy:
- cyan magical portal glow

Purple:
- allowed only as secondary/support atmosphere
- must not be the dominant identity

---

## Depth & Layering

Use:
- carved depth
- bevel highlights
- metal edge catches
- shadowed stone cavities
- layered collectible panels
- portal light behind or within surfaces
- controlled magical glow

Avoid:
- glow-only decoration
- generic gradients
- thin sci-fi outlines
- over-rendered effects that reduce clarity

---

## Buttons

Buttons should feel:
- carved
- plated
- pressurized
- physically clickable
- gold or blue energy accented
- responsive to state changes

Actionable buttons may pulse subtly, but the effect should read as charge/energy, not generic web animation.

The “PLACE CARD” button is a core gameplay mechanic, not a form submission.

Avoid:
- web CTA styling
- flat rectangles
- sterile form buttons
- generic Tailwind button surfaces

---

## Cards

Cards should feel:
- collectible
- framed
- emblematic
- layered
- tactile
- readable at mobile size

Card surfaces may use gold trim, carved frames, embossed icons, and portal-energy accents. They must not become noisy enough to obscure gameplay information.

---

## Timeline Design

Timeline should feel:
- dynamic
- alive
- reactive
- premium
- readable

Active drop zones should respond visually, but Timeline readability and placement clarity always win.

Do not sacrifice drag/drop hit-testing, manual geometry, scroll containment, or placement clarity for decoration.

Avoid:
- clutter
- excessive noise
- visual chaos
- overbuilt ornaments near drop targets

The timeline must remain readable during emotional chaos.

---

## Setup / Lobby Screens

Setup and lobby entry should feel exciting, not administrative.

Prefer:
- fantasy portal atmosphere
- blue/gold heroic framing
- tactile game buttons
- emblematic category or mode surfaces
- collectible-panel composition

Avoid:
- form-heavy first impressions
- dashboard aesthetics
- SaaS-style cards
- generic web menus

Players should feel emotionally invited into competition immediately.

The setup screen should communicate:
**“Get ready to challenge your friends.”**

---

# AVOID LIST

Avoid as dominant visual identity:
- neon cosmic style
- purple-only UI
- sci-fi thin-line panels
- synthwave cards
- starfield UI as the primary system
- glow-heavy space decoration

Avoid generally:
- enterprise dashboards
- admin-panel aesthetics
- generic SaaS visual patterns inside gameplay
- flat white cards
- rigid box-heavy layouts
- flat placeholder panels
- generic fantasy clipart
- low-quality AI-art-looking surfaces
- excessive hard borders
- over-rendered effects that reduce clarity or performance

---

# MOTION LANGUAGE

## Philosophy

Fast.
Responsive.
Spring-based.
Premium.
Tactile.
Juicy but not childish.

Animations should:
- support gameplay
- enhance emotional feedback
- improve physical feel
- reinforce carved/pressurized surfaces

Avoid:
- slow cinematic delays
- floaty animations
- excessive bounce
- cartoon energy

---

## Preferred Motion

Prefer:
- spring easing
- snap motion
- micro-bounce
- scale feedback
- directional movement
- impact reactions
- subtle blue/cyan energy charge
- gold highlight flickers on successful actions

Avoid:
- long fades
- generic CSS transitions
- random motion
- overuse of rotation
- glow spam

---

# GAME FEEL DETAILS

## Drag Feel

Cards should feel:
- smooth
- premium
- magnetic
- physically responsive

While dragged:
- slightly scale up
- gain elevation
- feel “held”

Ghost motion should feel:
- buttery smooth
- stable
- responsive

---

## Placement Feel

Successful placement is one of the most important interactions.

Placement should feel:
- impactful
- satisfying
- locked-in
- tactile

Use:
- magnetic slots
- placement bounce
- subtle impact feedback
- blue/cyan energy confirmation
- gold reward highlight when appropriate

Avoid:
- silent placement
- flat transitions

---

## Reveal Feel

### Correct Reveal

Should feel:
- satisfying
- rewarding
- clean dopamine burst
- heroic

### Wrong Reveal

Should feel:
- dramatic
- socially funny
- emotionally visible

Reveal sequences should feel:
- intentional
- energetic
- game-like

Avoid:
- sterile modals
- system-message feeling
- administrative UI behavior

---

# AUDIO

Audio should reinforce tactile feedback and emotional moments.

Prefer:
- subtle
- punchy
- modern
- premium audio

Avoid:
- retro arcade clichés
- noisy UI spam
- repetitive sounds
- excessive sound stacking

Silence is also part of the emotional rhythm.

---

# UX PRIORITIES

Priority order:

1. Clarity
2. Responsiveness
3. Tactile feel
4. Emotional payoff
5. Visual polish

Never sacrifice clarity for visual effects.

---

# PERFORMANCE REQUIREMENTS

Performance is critical, especially for:
- mobile devices
- lower-end Android devices
- WebView/PWA environments

Prefer:
- transform animations
- opacity animations
- GPU-friendly rendering
- restrained glows
- scoped effects

Avoid:
- expensive layout thrashing
- excessive blur filters
- unnecessary rerenders
- heavy glow stacks on low-end Android

All animations must remain performant.

---

# TECHNICAL CONSTRAINTS

Current stack:
- React
- Framer Motion
- touch events
- manual hit-testing
- WebView/PWA

Preserve existing working systems.

Prefer:
- additive polish
- isolated fixes
- rollback-safe changes

over:
- architectural rewrites

Do not casually:
- rewrite drag architecture
- refactor hit-testing
- replace touch event systems
- rewrite timeline logic
- rewrite multiplayer synchronization systems

Visual reskin work must not touch gameplay, multiplayer, Timeline, DropZone, QuestionCard, useGameActions, useLobbySync, or backend functions unless explicitly requested.

---

# ONLINE STATE AUTHORITY

Online multiplayer state authority must always come from:
- Lobby entity
- realtime subscriptions
- useLobbySync

Do not rely on stale route-state snapshots for gameplay state.

After Game mount:
- route state is bootstrapping only
- live game state must come from Lobby subscription updates

Avoid duplicated local state that can diverge from Lobby state.

---

# SHARED SYSTEM WARNING

The following systems are shared between offline and online gameplay and are considered high-risk:

- useGameActions
- Game.jsx
- useOfflineQuestions
- Timeline
- DropZone
- QuestionCard
- placement validation logic
- question selection logic

Changes to these systems can unintentionally break stable offline gameplay.

Prefer isolated online patches over shared-system rewrites.

---

# ONLINE MULTIPLAYER FEEL

Online multiplayer should feel:
- immediate
- alive
- synchronized
- socially reactive

Players should never feel:
- disconnected
- uncertain whose turn it is
- visually desynced
- stuck waiting without feedback

Realtime clarity is more important than visual effects.

Turn ownership must always be obvious within 1 second.

---

# DEBUGGING PHILOSOPHY

When fixing multiplayer issues:
- prefer temporary debug instrumentation
- expose realtime state visibly when necessary
- add minimal reversible logs
- identify exact source of desync before refactoring

Do not perform speculative architecture rewrites.

---

# RELEASE SAFETY

Every multiplayer-related change must be tested with:
- 2 real devices
- reconnect test
- refresh test
- host leave test
- duplicate question test
- turn sync test
- game start synchronization test

Offline Solo Challenge must be smoke-tested after every multiplayer change.

Current Health Simulator baseline can show zero FAIL cases and still not be release-ready when critical mobile/timeline checks remain NOT_AUTOMATABLE. Real phone/WebView testing remains required for drag behavior and live Timeline geometry.

---

# FIX STRATEGY

Prefer:
- small isolated patches
- additive fixes
- explicit guards
- safe fallbacks
- rollback-friendly changes

Avoid:
- broad rewrites
- multiplayer architecture resets
- shared gameplay refactors
- speculative optimization

Protect stable systems first.

---

# BUILD MARKER RULE

Major multiplayer, synchronization, gameplay, or significant UI fixes should increment the temporary build marker:

- Codex001
- Codex002
- Codex003

The marker should briefly appear on startup for deployment verification.

Docs-only changes do not require a build marker increment.

---

# GOLDEN RULE

Do not sacrifice gameplay feel for engineering convenience.

Do not sacrifice gameplay stability for visual experimentation.

Kronox succeeds or fails based on:
- tactile satisfaction
- emotional reactions
- multiplayer responsiveness
- timeline placement tension
