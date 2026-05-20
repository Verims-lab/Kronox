# KRONOX

## PRODUCT IDENTITY

Kronox is a premium social timeline party game, not a SaaS dashboard, trivia site, or admin panel.

Kronox should feel:
- social
- tactile
- reactive
- competitive
- energetic
- premium
- modern
- slightly futuristic
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

---

# CORE EXPERIENCE PRINCIPLES

## Every interaction must feel tactile

Dragging, placing, revealing, and confirming should create physical feedback.

UI should feel:
- touchable
- magnetic
- responsive
- satisfying

Avoid:
- flat interactions
- static transitions
- dead clicks
- sterile behavior

---

## Feedback trumps decoration

Prioritize:
- motion clarity
- impact
- responsiveness
- emotional payoff

over excessive decoration or visual complexity.

---

## MOBILE VIEWPORT STANDARD

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

## Wrong answers are emotionally valuable

Failures should feel:
- dramatic
- funny
- socially visible

Treat failures as memorable social moments, not sterile system errors.

---

# VISUAL LANGUAGE

## Style

Premium neon arcade.
Modern mobile game.
Clean but energetic.

---

## Color palette

- Dark purple / deep navy base
- Neon yellow accents
- Controlled glow usage
- Soft layered depth

---

## Avoid

Avoid:
- enterprise dashboards
- admin-panel aesthetics
- form-heavy layouts
- sterile modal systems
- generic SaaS visual patterns inside gameplay

Avoid:
- flat white cards
- excessive hard borders
- rigid box-heavy layouts

---

## Depth & layering

Use:
- soft shadows
- subtle depth
- ambient glows
- elevation changes
- opacity layering

Avoid completely flat surfaces.

---

## Borders

Prefer:
- glow
- depth
- lighting separation

over:
- thick outlines
- stroke-heavy UI

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

Avoid:
- slow cinematic delays
- floaty animations
- excessive bounce
- cartoon energy

---

## Preferred motion

Prefer:
- spring easing
- snap motion
- micro-bounce
- scale feedback
- glow pulses
- directional movement
- impact reactions

Avoid:
- long fades
- generic CSS transitions
- random motion
- overuse of rotation

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
- feel "held"

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
- glow pulse
- subtle impact feedback

Avoid:
- silent placement
- flat transitions

---

## Reveal Feel

### Correct reveal

Should feel:
- satisfying
- rewarding
- clean dopamine burst

### Wrong reveal

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

## Button Philosophy

Buttons should react to state changes.

Actionable buttons should pulse subtly.

The “PLACE CARD” button is a core gameplay mechanic — not a form submission.

---

## Timeline Design

Timeline should feel:
- dynamic
- alive
- reactive
- premium

Active drop zones should respond visually and glow subtly.

Avoid:
- clutter
- excessive noise
- visual chaos

The timeline must remain readable during emotional chaos.

Readability is always critical.

---

## Setup Screen

Setup should feel exciting, not administrative.

Avoid:
- form-heavy configuration screens
- dashboard aesthetics

Prefer:
- atmosphere
- motion
- ambient energy
- floating elements

Players should feel emotionally invited into competition immediately.

The setup screen should communicate:
**“Get ready to challenge your friends.”**

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

Avoid:
- expensive layout thrashing
- excessive blur filters
- unnecessary rerenders

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

Major multiplayer or synchronization fixes should increment the temporary build marker:

- Codex001
- Codex002
- Codex003

The marker should briefly appear on startup for deployment verification.

---

# GOLDEN RULE

Do not sacrifice gameplay feel for engineering convenience.

Do not sacrifice gameplay stability for visual experimentation.

Kronox succeeds or fails based on:
- tactile satisfaction
- emotional reactions
- multiplayer responsiveness
- timeline placement tension
