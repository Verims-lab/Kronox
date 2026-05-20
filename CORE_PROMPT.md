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

## UI Quality
For UI work:
- match existing Kronox visual language
- avoid generic Tailwind/card UI
- preserve mobile portrait behavior
- ensure no unwanted scroll/overscroll on Home

## Build Marker
Increment:
- Codex001
- Codex002
- Codex003
...
for significant gameplay/network/UI changes.
