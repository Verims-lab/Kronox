# KRONOX CORE PROMPT

## Repository
Verims-lab/Kronox

## Branch Workflow
- Work only on `codex` branch
- Never commit directly to `main`
- Use GitHub connector only
- Never use local temp repositories
- Never generate /private/tmp patch workflows unless explicitly requested

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

## Build Marker
Increment:
- Codex001
- Codex002
- Codex003
...
for significant gameplay/network/UI changes.
