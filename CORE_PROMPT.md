# KRONOX CORE PROMPT

## Repository
Verims-lab/Kronox

## Branch Workflow
- Work only on `codex` branch
- Never commit directly to `main`
- Use GitHub connector only
- Never use local temp repositories
- Never generate /private/tmp patch workflows unless explicitly requested

## GitHub Workflow
Codex must work only through GitHub connector on the `codex` branch.
Never use local-only commits, local temp folders, or patch files unless explicitly requested.
After work is complete, create or update a PR from `codex` to `main`.

## Current Visual Direction
Kronox visual direction is now premium fantasy mobile game, not neon cosmic or purple sci-fi.

Use:
- blue/gold magical portal language
- royal/electric blue energy
- gold/amber highlights
- carved stone frames
- polished game-metal trims
- collectible-card material feel
- magical cyan glow
- emblematic icons
- tactile mobile game surfaces

Avoid treating neon purple, cosmic starfields, synthwave cards, or thin sci-fi outlines as the dominant identity. Purple may remain only as secondary/support atmosphere.

## Safety Rules
Preserve:
- Offline Solo Challenge
- timeline architecture
- drag/drop architecture
- hit-testing
- placement validation
- online sync stability

Prefer:
- minimal isolated fixes
- additive changes
- rollback-safe implementations

Avoid:
- broad refactors
- architecture rewrites
- speculative optimization

Future visual prompts should be treated as visual-only unless explicitly stated. Do not touch gameplay, multiplayer, drag/drop, Timeline, useGameActions, useLobbySync, or backend functions during visual-only work.

## Online Multiplayer Rules
Online state authority:
- Lobby entity
- realtime subscriptions
- useLobbySync

Route state is bootstrap only.

## Output Requirements
After changes always return:
- changed files
- commit hash
- PR status
- build marker version

For UI or gameplay work, also include:
- whether the Health Simulator baseline was checked
- which suites are relevant to the change
- whether the change is expected to affect any critical suite
- what must be tested on a real phone
- remaining release risk

## Prompt Efficiency
Keep task responses concise.
Do not repeat KRONOX.md content back unless needed.
Prefer minimal implementation plans over long explanations.
Ask for clarification only if blocked.

## Code Quality
Before changing files:
- identify the smallest affected surface
- avoid touching unrelated files
- preserve existing naming and structure
- do not introduce new dependencies unless necessary

## Testing
For every change, run or update the most relevant test/simulation.
If tests cannot be run, explain why clearly.
Do not make tests fake-green.
Do not hide warnings or NOT_AUTOMATABLE release risk.

## UI Quality
For UI work:
- follow the premium fantasy arcade direction
- prioritize blue/gold readability
- use carved material depth and collectible-card surfaces
- make controls feel tactile and physically pressable
- avoid generic web/SaaS UI
- avoid generic Tailwind/card UI
- preserve mobile portrait behavior
- ensure no unwanted scroll/overscroll on Home or fixed game-like screens

## Visual Migration Safety Rules
- Visual migration must be incremental.
- Do not redesign all screens in one uncontrolled pass.
- Start with high-visibility surfaces.
- Preserve layout and functionality unless explicitly asked to change them.
- Visual-only tasks must not touch sync or gameplay logic.
- Do not change Timeline hit-testing during visual polish.
- Do not change multiplayer flow during reskin tasks.
- Preserve manual drag/drop architecture and placement validation.
- Keep migration rollback-safe.

## Reference Image Rule
Reference images are style direction only.
Do not copy exact composition unless explicitly instructed.
Do not invent missing asset filenames.
Use existing assets when available.
If assets are missing, create intentional placeholder-style surfaces and report missing assets clearly.
Never use broken image paths or remote image URLs for production surfaces unless already approved by project context.

## Health Simulator Workflow
Current baseline: Codex049, 107 cases, 89 PASS, 0 FAIL, 7 WARNING, 11 NOT_AUTOMATABLE, score 4, Not release-ready.

Interpretation:
- 0 FAIL does not mean production-ready.
- NOT_AUTOMATABLE critical checks remain real release risk.
- Real phone/WebView/PWA testing is still required for drag behavior and live Timeline geometry.

For visual-only tasks, run or request these suites when available:
- mobile_viewport
- visual_guardrails
- debug_hygiene
- performance_ux
- report_integrity

For gameplay, multiplayer, or mobile viewport tasks, run or request these critical suites when available:
- mobile_viewport
- timeline_hit_testing
- question_card_touch
- offline_solo
- multiplayer_authority
- route_bootstrap
- report_integrity

Do not change simulator cases just to improve score.
Do not convert NOT_AUTOMATABLE cases to PASS unless they are truly executed and verified.
Health Simulator cannot judge premium feeling, emotional payoff, art direction quality, or tactile satisfaction. Screenshots and human review are still required.

## Build Marker
Increment:
- Codex001
- Codex002
- Codex003
...
for significant gameplay/network/UI changes.

Docs-only changes do not require a build marker increment.
