## PRODUCT IDENTITY

Kronox is a premium social timeline party game, not a SaaS dashboard, trivia site, or admin panel.

Kronox should feel: social, tactile, reactive, competitive, energetic, premium, modern, slightly futuristic, emotionally rewarding.

Core emotion: **social tension + dopamine release**

Players should experience: anticipation, confidence, panic, satisfaction, embarrassment, excitement.

---

## CORE EXPERIENCE PRINCIPLES

### Every interaction must feel tactile
Dragging, placing, revealing, and confirming should create physical feedback. UI should feel touchable, magnetic, responsive, and satisfying. Avoid flat interactions, static transitions, dead clicks, and sterile behavior.

### Feedback trumps decoration
Prioritize motion clarity, impact, responsiveness, and emotional payoff over excessive decoration or visual complexity.

### Wrong answers are emotionally valuable
Failures should feel dramatic, funny, and socially visible—not sterile errors. Treat them as memorable, playful moments that create reactions, not simple mistakes.

---

## VISUAL LANGUAGE

**Style:** Premium neon arcade, modern mobile game, clean but energetic.

**Color palette:**
- Dark purple / deep navy base
- Neon yellow accents
- Controlled glow usage
- Soft layered depth

**Avoid:** Flat white cards, enterprise styling, dashboard aesthetics, excessive hard borders.

**Depth & layering:** Use soft shadows, subtle depth, ambient glows, elevation changes, and opacity layering. Avoid completely flat surfaces and rigid boxes.

**Borders:** Prefer glow/depth/lighting separation over thick outlines and stroke-heavy UI.

---

## MOTION LANGUAGE

**Philosophy:** Fast, responsive, spring-based, premium, tactile, juicy but not childish.

Animations should support gameplay, enhance emotional feedback, and improve physical feel. Avoid slow cinematic delays, floaty animations, excessive bounce, and cartoon energy.

**Preferred:** Spring easing, snap motion, micro-bounce, scale feedback, glow pulses, directional movement, impact reactions.

**Avoid:** Long fades, generic CSS transitions, overuse of rotation, random motion.

---

## GAME FEEL DETAILS

### Drag Feel
Cards should feel smooth, premium, slightly magnetic, and physically responsive. While dragged: slightly scale up, gain elevation, feel "held." Ghost motion should be buttery smooth, stable, and responsive.

### Placement Feel
Successful placement is one of the most important interactions. It should feel impactful, satisfying, locked-in, and tactile. Use magnetic slots, placement bounce, glow pulse, and subtle impact feedback. Avoid silent placement and flat transitions.

### Reveal Feel
Correct reveal: satisfying, rewarding, clean dopamine burst.
Wrong reveal: dramatic, socially funny, emotionally visible.

The reveal sequence should feel intentional, energetic, and game-like—not modal, form-like, or system-message-like.

### Button Philosophy
Buttons should react to state changes and pulse subtly when actionable. The "PLACE CARD" button is a core gameplay action—treat it like a mechanic, not a form submission.

### Timeline Design
Timeline should feel dynamic, alive, reactive, and premium. Active drop zones should visually respond and glow subtly. Avoid cluttered visuals and excessive noise. Readability is critical.

### Setup Screen
Setup should feel exciting, not administrative. Avoid form-heavy, configuration-dashboard aesthetics. Prefer atmosphere, motion, ambient energy, and floating elements. Should emotionally communicate: "Get ready to challenge your friends."

---

## AUDIO

Audio should reinforce tactile feedback and support emotional moments. Prefer subtle, punchy, modern audio. Avoid retro arcade clichés, noisy UI sounds, and excessive sound spam.

---

## PERFORMANCE REQUIREMENTS

Performance is critical for mobile and lower-end Android devices.

- Prefer transform and opacity animations
- Avoid expensive layout thrashing, excessive blur filters, and unnecessary rerenders
- All animations must remain GPU-friendly

---

## TECHNICAL CONSTRAINTS

DO NOT rewrite drag architecture, refactor hit-testing, replace touch event systems, rewrite timeline logic, alter multiplayer architecture, modify synchronization, or introduce non-React concepts.

Current stack: React, Framer Motion, touch events, manual hit-testing, WebView/PWA.

Preserve existing working systems. Prefer additive polish over architectural rewrites.

---

## UX PRIORITIES

1. Clarity
2. Responsiveness
3. Tactile feel
4. Emotional payoff
5. Visual polish

Never sacrifice clarity for visual effects.

---

## EXPERIENCE GOAL

Players should constantly feel social tension, anticipation, tactile satisfaction, and emotional reactions. The game should feel highly replayable, socially entertaining, and fun to watch. Kronox creates "party chaos through timeline placement."
