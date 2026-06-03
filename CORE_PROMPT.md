# KRONOX CORE PROMPT

## Purpose

This file defines the working rules for Codex and AI Coder when making changes to the Kronox repository.

Kronox product identity and visual language are defined separately in the Product Identity document.
Do not duplicate the full visual identity here. For visual/UI work, read and follow the Product Identity document.

---

# Repository

Repository:

```text
Verims-lab/Kronox
```

---

# Branch / GitHub Workflow

## Codex Workflow

Codex must work on the `Codex` branch unless explicitly told otherwise.

Rules:

* Never commit directly to `main`.
* Never leave completed work only in a local branch.
* Never finish a task without pushing the final work to GitHub `Codex` branch.
* Use GitHub connector/workflow.
* Do not use local temp repositories.
* Do not create `/private/tmp` patch workflows unless explicitly requested.
* If a PR is needed, create or update a PR from `Codex` to `main`.

Before reporting complete, Codex must verify:

```bash
git status --short
git rev-parse HEAD
git rev-parse origin/Codex
git rev-list --left-right --count origin/Codex...HEAD
```

Expected:

```text
local HEAD equals origin/Codex
ahead/behind 0 0
```

If push fails, do not say the task is complete. Report the exact push error.

## AI Coder Workflow

AI Coder must clearly report:

* which branch/environment was changed
* which files changed
* whether changes were pushed or deployed
* whether there are local-only or untracked files

For visual/UI work, AI Coder should keep diffs small and avoid touching gameplay, backend, multiplayer sync, or shared logic unless explicitly requested.

---

# Required Context Before Work

Before making changes, read and follow:

1. `KRONOX_CORE_PROMPT.md`
2. Kronox Product Identity / Visual Identity document
3. Any task-specific docs relevant to the change

Permanent project docs should live under:

```text
docs/
```

`src/docs/` should be used only if the app needs to import/read the document at runtime.

If a document exists in `src/docs/` but is expected in `docs/`, fix or report the mismatch.

Do not repeat full documentation content in task responses. Summarize only what matters.

If docs and code conflict:

* do not guess silently
* report the conflict
* either align the code to docs or update docs to match the accepted product decision

---

# Task Scope Classification

At the start of every task, classify the task as one or more of:

* Visual-only
* Gameplay
* Multiplayer / realtime
* Backend / security
* Data model / DB
* Scoring / economy
* Health / tests
* Docs-only
* Cleanup / refactor

The scope controls safety:

* Visual-only tasks must not touch gameplay or backend logic.
* Gameplay tasks must protect drag/drop, timeline validation, scoring, and Solo stability.
* Multiplayer tasks must protect Lobby authority, subscriptions, invites, and online scoring.
* Backend/security tasks must not weaken auth, RLS, or service-role boundaries.
* Data model tasks must be additive and migration-safe unless explicitly approved.
* Docs-only tasks do not require a build marker increment.

---

# Product Safety Rules

Preserve:

* Offline Solo Challenge
* Online multiplayer stability
* timeline architecture
* drag/drop architecture
* manual hit-testing
* placement validation
* `useGameActions`
* `useLobbySync`
* realtime Lobby synchronization
* question/category relationships
* unified Kronox Puan system
* Diamond economy rules
* GameInvite lifecycle and 10-minute TTL

Prefer:

* minimal isolated fixes
* additive changes
* rollback-safe implementations
* explicit guards
* safe fallbacks
* clear error handling

Avoid:

* broad refactors
* speculative optimization
* architecture rewrites
* shared gameplay rewrites
* multiplayer architecture resets
* changing unrelated files
* hiding Health warnings
* fake-green tests

---

# Visual Work Safety

For visual-only work:

Do not touch:

* backend functions
* multiplayer sync
* Lobby state logic
* Timeline hit-testing
* drag/drop architecture
* placement validation
* scoring
* question selection
* `useGameActions`
* `useLobbySync`
* `Game.jsx` unless the visual task explicitly requires it

Visual changes must be:

* incremental
* isolated
* mobile-first
* rollback-safe
* aligned with the Product Identity document

Reference images are style direction unless explicitly stated as pixel/layout target.

Do not invent asset filenames.
Use existing assets when available.
If assets are missing, create intentional placeholder-style surfaces and report missing assets clearly.
Never use broken image paths or unapproved remote image URLs for production surfaces.

---

# Gameplay Safety

The following systems are high-risk:

* `Game.jsx`
* `useGameActions`
* `useOfflineQuestions`
* `Timeline`
* `DropZone`
* `QuestionCard`
* placement validation logic
* question selection logic
* drag/touch event lifecycle
* auto-scroll logic

Rules:

* Do not casually rewrite drag architecture.
* Do not refactor hit-testing unless the task is specifically about hit-testing.
* Do not replace touch event systems unless explicitly approved.
* Do not change timeline validation while doing visual polish.
* Do not change scoring while doing UI fixes.
* Do not re-randomize questions mid-game unless the task explicitly requires question engine changes.

Offline Solo must be smoke-tested after any shared gameplay or multiplayer change.

---

# Online Multiplayer Rules

Online multiplayer state authority must come from:

* Lobby entity
* realtime subscriptions
* `useLobbySync`

Route state is bootstrap only.

After game mount:

* route state must not be the long-term gameplay authority
* live state must come from Lobby subscription/fetch
* avoid duplicated local state that can diverge from Lobby state

For multiplayer fixes:

* identify the exact source of desync before refactoring
* prefer temporary debug instrumentation when needed
* keep debug instrumentation reversible
* preserve invite/lobby lifecycle
* preserve GameInvite 10-minute TTL
* preserve host/player authorization

Required multiplayer manual proof before release:

* 2 real devices
* reconnect test
* refresh test
* host leave test
* duplicate question test
* turn sync test
* game start synchronization test

---

# Unified Kronox Puan Rules

Kronox has one visible score system.

Rules:

* Do not create separate visible Solo Puan and Online Puan.
* Solo score and Online score must contribute to the same visible Kronox Puan.
* Profile, Header, Home, Solo, Online, and Leaderboard must read the same visible score source/helper.
* Leaderboard displayed score and ranking score must match.
* Online win/loss deltas must persist to the unified Kronox Puan total.
* Online result popup must show actual persisted score/delta, not preview-only data.

Do not change scoring values unless explicitly requested.

---

# Solo Question Engine Rules

Solo question selection must follow current product rules:

* Each Solo attempt uses an 18-question deck.
* Player needs 10 correct placements to win.
* Player fails at 8 mistakes or timeout.
* The 18-question deck must have 18 unique question IDs.
* The 18-question deck must have 18 unique years.
* Duplicate years are not allowed in the same Solo attempt.
* Attempt deck is created once at attempt start.
* No mid-game rerandomization.
* Replay creates a new deck.
* Only active questions and active categories should be used.
* Passive category questions must not appear.

If there are not enough valid questions with unique years, return a clean user-facing error.
Do not silently start with fewer than 18 questions or duplicate years.

---

# Category Rules

Current category model must support:

* category id field according to the accepted schema
* name
* status
* description

Status values:

```text
"a" = active
"p" = passive
```

Rules:

* Existing fixed categories should be active unless intentionally changed.
* Passive categories should not appear in UI category lists.
* Question/category relationships must not be broken.
* If external import format differs from internal schema naming, normalize at the import boundary.
* Do not create competing live category id fields without a migration decision.

---

# Diamond Economy Rules

Diamond economy rules:

* New user starter reward: +100 once
* Daily login reward: +20 once/day
* First day may total 120
* Future extensions may include wheel, rewarded ads, quests, or purchases

Rules:

* Do not change reward amounts unless explicitly requested.
* Do not derive diamonds from score, stars, or level.
* Visible Elmas surfaces must read the persisted diamond balance source/helper.
* Diamond reward idempotency must be protected as much as the platform allows.
* Multi-device duplicate reward risk must remain visible unless runtime-proven.

Daily Quest / Günün Görevi is currently paused. Do not implement it unless explicitly requested.

---

# Security Rules

Never expose secrets in source.

Do not hardcode:

* API keys
* VAPID private/public keys
* admin personal emails
* service tokens
* provider secrets

Backend functions must:

* authenticate where required
* authorize by role/player/owner where required
* avoid broad service-role outputs
* return safe error messages
* avoid leaking raw debug payloads to normal users

Question bank access:

* must not expose all questions publicly
* must not allow unauthenticated full-bank reads
* should return minimal gameplay-safe projections
* must respect active question/category rules where applicable

Admin access:

* must be role/config based
* must not rely on hardcoded personal email in committed source
* client-side admin UI gating is not enough for backend authorization

---

# DB / Data Model Rules

DB changes should be:

* additive by default
* migration-safe
* idempotent
* backward-compatible where possible

Before DB/schema changes:

* identify existing rows that may lack new fields
* define safe backfill behavior
* avoid duplicate seed rows
* preserve existing IDs/names unless explicitly migrating them
* document destructive migrations separately and do not run them without approval

For scale-sensitive features like Leaderboard:

* avoid fetching/sorting broad user lists client-side
* prefer persisted/index-friendly score/rank fields
* ensure displayed score and rank sort score match
* avoid exposing unnecessary private user fields

---

# Code Quality

Before changing files:

* identify the smallest affected surface
* search current references
* understand existing naming and structure
* avoid unrelated files
* avoid new dependencies unless necessary
* keep functions cohesive
* centralize repeated calculations/helpers
* avoid spaghetti duplication
* do not leave dead code behind if safely removable

For cleanup:

* delete only with reference proof
* report every deleted file/asset
* do not delete assets referenced by service worker, manifest, or external deployment paths
* clean stale Health cases together with removed code

---

# Error Handling

Avoid native browser `alert()` for product errors.

Use Kronox-style:

* toast
* inline error
* modal
* retryable error block

Critical flows must recover cleanly:

* question loading
* lobby start
* invite accept
* scoring persistence
* diamond reward
* backend 400/401/403/409/410/500 responses

Loading buttons must not remain stuck after failure.

User-facing errors should be Turkish, clear, and safe.

Backend debug details should be gated or redacted.

---

# Health Simulator Rules

Health is release-risk intelligence, not production proof.

Rules:

* Do not change Health cases just to improve score.
* Do not fake PASS.
* Do not hide warnings.
* Do not convert NOT_AUTOMATABLE to PASS unless the behavior was truly executed and verified.
* Runtime/manual cases must remain NOT_AUTOMATABLE unless a real harness proves them.
* Static checks must not claim runtime proof.
* Health should match current architecture, not old removed flows.

Health cannot judge:

* premium feeling
* emotional payoff
* art direction quality
* tactile satisfaction
* real device drag behavior
* live Timeline geometry
* real two-account RLS behavior
* push delivery on device

Those require screenshots, real device tests, or backend probes.

---

# Testing Requirements

For every change, run the smallest relevant test set.

Always try:

```bash
git diff --check
npm run lint
npm run build
```

If tests cannot run, explain exactly why.

For visual-only tasks, run or request relevant suites when available:

* mobile_viewport
* visual_guardrails
* visual_composition_regression
* debug_hygiene
* performance_ux
* report_integrity

For gameplay tasks:

* mobile_viewport
* timeline_hit_testing
* question_card_touch
* offline_solo
* game_rules
* placement_feedback_animation
* solo_question_engine_health
* report_integrity

For multiplayer tasks:

* multiplayer_authority
* waiting_room_start
* online_challenge_flow
* invite_lifecycle
* game_invite_lifecycle_v2
* notification_lifecycle_health
* lobby_simplification
* online_match_result_health
* report_integrity

For scoring/economy tasks:

* scoring_contract
* online_score_completion_health
* online_score_visible_puan_health
* unified_kronox_score_health
* diamond_economy_health
* leaderboard_health
* profile_economy

For backend/security tasks:

* backend_security_health
* security_cleanup_health
* admin_authorization_hardening
* question_schema_preparation_health
* data_model_health
* persistence_contract_health

For docs-only tasks:

* `git diff --check`
* docs-related Health if available
* no build marker increment required

---

# Manual / Runtime Proof Requirements

Some risks cannot be proven by static Health.

Keep these visible until actually tested:

* real phone/WebView/PWA drag behavior
* Timeline live DOM geometry
* no page scroll during drag
* mobile safe-area/notch/home indicator
* PWA push notification delivery
* two-account invite lifecycle
* two-account online scoring persistence
* RLS cross-user read/write probes
* Diamond duplicate reward race
* leaderboard runtime rank correctness
* backend auth 401/403 probes

If not tested, report:

```text
Manual/runtime proof: not performed
Remaining release risk: yes
```

---

# Build Marker Rule

Increment the temporary build marker for significant:

* gameplay changes
* multiplayer changes
* synchronization changes
* backend/security changes
* data model changes
* significant UI changes

Docs-only changes do not require a build marker increment.

Use the next marker after the current marker.
Do not reset marker numbering.

Report the marker version in the final response.

---

# Output Requirements

After every change, report:

1. Task scope classification
2. Files changed
3. What changed
4. What was intentionally not changed
5. Tests run
6. Health suites run or skipped
7. Build result
8. Build marker version
9. Manual/runtime proof performed or not
10. Remaining release risk
11. Commit hash
12. Push/PR status

For Codex specifically, also report:

* branch
* `git status --short`
* `git rev-parse HEAD`
* `git rev-parse origin/Codex`
* ahead/behind status

For UI/gameplay work, also include:

* whether mobile portrait behavior was affected
* what must be checked on a real phone
* whether critical suites are expected to be affected

For docs work, include:

* final doc path
* whether file is tracked
* whether any old duplicate doc path remains
* whether docs and code now agree

---

# Prompt Efficiency

Keep implementation responses concise.

Do not repeat this file or Product Identity content back unless needed.

Prefer:

* short implementation plan
* exact changed files
* exact risks
* exact test results

Ask for clarification only if blocked by a real decision.

---

# Golden Rules

Do not sacrifice gameplay feel for engineering convenience.

Do not sacrifice gameplay stability for visual experimentation.

Do not sacrifice security for convenience.

Do not sacrifice data correctness for UI speed.

Kronox succeeds or fails based on:

* tactile satisfaction
* emotional reactions
* multiplayer responsiveness
* timeline placement tension
* trustworthy scoring
* stable mobile gameplay
