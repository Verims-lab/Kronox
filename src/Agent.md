# AGENTS Guidelines for Kronox

This repository contains the **Kronox** project — a React/TypeScript web app built on the Base44 platform with a trivia/timeline game mechanic.

## 1. Project Specifications
- **Platform:** Base44 (Vite + React + TypeScript)
- **Language:** JavaScript/TypeScript (React 18+)
- **Build System:** Vite
- **Styling:** Tailwind CSS
- **State:** TanStack React Query + local React state
- **Animation:** Framer Motion

## 2. Architecture & Design Patterns
- **Pages:** `pages/` — top-level route components (lazy loaded).
- **Components:** `components/` — reusable UI components.
- **Hooks:** `hooks/` — custom React hooks for game state, actions, lobby sync, questions.
- **Entities:** `entities/` — Base44 JSON schema entities (Lobby, Question, GameRecord, LobbyMessage).
- **Functions:** `functions/` — Deno-based backend functions.
- **Unidirectional Data Flow:** State flows down via props; events flow up via callbacks.

## 3. Game Logic
- **Timeline mechanic:** Players place event cards on a chronological timeline. Drop zones appear between cards; correct placement = keep card.
- **Stacking:** Removed — every card is shown individually even if same year.
- **Turn-based:** `current_player_index` in Lobby entity rotates players.
- **Win condition:** First player to collect `win_card_count` cards wins.

## 4. Key Files
- `pages/Game.jsx` — Main game orchestrator.
- `hooks/useGameState.js` — All game state variables.
- `hooks/useGameActions.js` — Placement/turn logic.
- `hooks/useLobbySync.js` — Real-time Lobby sync.
- `components/game/Timeline.jsx` — Timeline UI + drop zones.
- `components/game/GameLayout.jsx` — Full game layout shell.

## 5. Android Agent Skills Recap

| Skill Folder | Purpose |
| ----------------------- | -------------------------------------------------- |
| `architecture/` | Clean architecture, ViewModels, and Data Layer. |
| `ui/` | Jetpack Compose best practices, Coil, Accessibility. |
| `performance/` | Auditing Compose and Gradle build performance. |
| `migration/` | XML to Compose migration. |
| `testing_and_automation/` | Unit/UI Testing setup, Emulator automation scripts. |
| `concurrency_and_networking/` | Coroutines fixes, Retrofit networking. |
| `build_and_tooling/` | Gradle Convention Plugins and Version Catalogs. |

---

When in doubt, refer to the specific agent skills in `.github/skills/` for deeper task-specific context!