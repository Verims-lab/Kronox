# KRONOX Full Audit - Package 1

Date: 2026-06-02
Branch audited: `Codex`
Local HEAD after fetch/fast-forward: `60194b73cb35e0be9453cfdb384c1bc22125896b`
Scope: audit only plus Package 2 implementation plan. No product logic was changed in this package.

## 1. Executive Summary

Kronox is not release-ready from an architecture/security/data-readiness standpoint, even though many recent feature-specific contracts are now present. The main issue is not that the app lacks helpers. The main issue is that several helpers are correct in isolation while runtime wiring, data access, docs, or Health proof still lag behind them.

Highest-priority Package 2 scope:

1. Secure question access: `base44/functions/getQuestions/entry.ts` is explicitly unauthenticated and uses service role to return up to 500 questions. `src/hooks/useOfflineQuestions.js` also falls back to direct public `Question.list`.
2. Fix Solo active-category integration: `src/lib/soloQuestionEngine.js` supports active category whitelists, but `src/pages/Game.jsx` omits `allowedMainCategoryIds`, so passive categories are not enforced in Solo runtime.
3. Resolve category naming drift before imports: product text says `categoryid`, while schema/code/docs use `category_id`.
4. Fix Online start filtering gaps: `base44/functions/startLobbyGame/entry.ts` can fall back to all year-window questions when selected category IDs yield no match, and does not currently filter question `state === 'A'` or Category status.
5. Harden online score idempotency around partial persistence: current flow updates `online_progress` before `OnlineMatchResult`; if result creation fails, duplicate protection becomes weaker.
6. Move or mirror the Solo Question Engine doc to the required public docs path: the tracked file exists at `src/docs/KRONOX_SOLO_QUESTION_ENGINE.md`, not `docs/KRONOX_SOLO_QUESTION_ENGINE.md`.
7. Clean stale Health monolith cases and false static proofs, especially around removed invite UI, old assets, and Solo deck wiring.
8. Decide Home asset truth: current `MainMenu.jsx` is CSS/motion driven and does not use the WebP home button/background assets named in product context.
9. Optimize leaderboard/data scale: leaderboard currently reads/projects/sorts up to 500 users via service role backend and fallback rows, with no indexed persisted rank strategy.
10. Add runtime proof checklist for invite/lobby, online scoring persistence, mobile/PWA safe-area, push, RLS, and two-account flows.

Package 1 created this report only. No broad fixes, schema changes, asset deletes, scoring changes, gameplay changes, or Health edits were made.

## 2. Git And Local State Audit

Commands run:

- `git branch --show-current` -> `Codex`
- `git status --short` -> clean before the report was created
- `git status` -> clean before the report was created
- `git remote -v` -> `origin https://github.com/Verims-lab/Kronox.git`
- `git fetch origin` -> remote `Codex` had advanced from `6e0b8d4` to `60194b7`
- `git merge --ff-only origin/Codex` -> fast-forwarded local `Codex`
- `git log --oneline --decorate -15` inspected after fetch/merge
- `git rev-parse HEAD` -> `60194b73cb35e0be9453cfdb384c1bc22125896b`
- `git rev-parse origin/Codex` -> `60194b73cb35e0be9453cfdb384c1bc22125896b`
- `git rev-list --left-right --count origin/Codex...HEAD` -> `0 0`
- `git diff --name-status origin/Codex...HEAD` -> no local-only diff
- `git diff --stat origin/Codex...HEAD` -> no local-only diff
- `git ls-files --others --exclude-standard` -> no untracked files

Local-only findings:

- No untracked docs.
- No untracked Health cases.
- No untracked assets.
- No local-only generated/cache/log files were visible through `git ls-files --others --exclude-standard`.
- No unpushed local commits after fast-forward.

Important docs finding:

- Required path `docs/KRONOX_SOLO_QUESTION_ENGINE.md` does not exist.
- Tracked file exists at `src/docs/KRONOX_SOLO_QUESTION_ENGINE.md`.
- That tracked file contains the expected 18-question and unique-year rules.
- This is a docs-path mismatch. It is not local-only work, but it can make audits, Health cases, and GitHub readers look in the wrong place.

## 3. Architecture Risk Map

### High Risk

1. **Question access security exposure**
   - `base44/functions/getQuestions/entry.ts` says `auth gerekmez` and uses `base44.asServiceRole.entities.Question.list('-created_date', 500)`.
   - `src/hooks/useOfflineQuestions.js` falls back to `base44.entities.Question.list('-created_date', 500)`.
   - `base44/entities/Question.jsonc` currently has public read RLS: `"read": {}`.
   - Product context says `getQuestions` must not expose all questions publicly without auth.

2. **Solo active-category enforcement is incomplete**
   - `src/lib/soloQuestionEngine.js` supports `allowedMainCategoryIds`.
   - `src/pages/Game.jsx` omits the whitelist and comments that active-category gating happens at the data layer.
   - The adapter does not consult Category rows, so passive categories can leak into Solo attempts if passive-category questions exist.

3. **Category field naming drift before import**
   - Product context says `categoryid`.
   - Current schema is `base44/entities/Category.jsonc` with `category_id`.
   - Current UI and seeds use `category_id`.
   - Import tooling and future data can drift unless one canonical field is chosen.

4. **Online start category filtering has a permissive fallback**
   - `base44/functions/startLobbyGame/entry.ts` returns all base filtered rows if selected category IDs find no match.
   - This prevents some 400s but can silently ignore selected categories.
   - It also does not apply question `state === 'A'` or Category active status.

5. **Health has false confidence areas**
   - `simulationPanelSoloQuestionEngineCases.jsx` tests the engine but not the `Game.jsx` integration that supplies category whitelists.
   - `simulationPanelExtraCases.jsx` still imports old `CreateLobbyInvitePanel.jsx` raw source and contains stale old-flow contracts.
   - Static source checks sometimes prove token presence rather than runtime behavior.

6. **Large central components remain hard to reason about**
   - `src/pages/Game.jsx`: 1170 lines.
   - `src/components/game/simulationPanelExtraCases.jsx`: 2469 lines.
   - `src/pages/LobbyRoom.jsx`: 542 lines.
   - `src/components/lobby/OnlineChallengeScreen.jsx`: 419 lines.
   - This increases regression risk around timing, mode-specific state, and Health drift.

### Medium Risk

1. **Online score idempotency has partial-write exposure**
   - `src/lib/applyOnlineResult.js` updates `online_progress` through `updateMe` before creating `OnlineMatchResult`.
   - If audit row creation fails, visible score may change without durable result idempotency.
   - `lastMatchId` helps, and reconciliation exists, but there is no transaction.

2. **Diamond economy is best-effort idempotent, not strongly atomic**
   - `src/lib/diamondEconomy.js` checks guard fields and a transaction row, refreshes, then updates user and creates ledger.
   - Two devices can still race without a unique idempotency constraint or server transaction.
   - If ledger creation fails after `updateMe`, reward may be granted without a ledger row.

3. **Leaderboard scale is capped and service-role backed**
   - `base44/functions/getSoloLeaderboard/entry.ts` reads up to 500 users using service role and computes summaries.
   - `src/lib/leaderboard.js` also uses 500-row fallback limits.
   - No indexed persisted `kronox_puan_total` rank field is visible.

4. **User email projection in leaderboard may be too broad**
   - `getSoloLeaderboard` projects `user_email` despite comments about public-safe rows.
   - If leaderboard is public to authenticated users, this may leak private emails.

5. **Home product asset truth is inconsistent**
   - Product context says Home uses `Kronox_Home_Button_Solo.webp`, `Kronox_Home_Button_Online.webp`, and `Kronox_Home_Fantasy_background.webp`.
   - `src/pages/MainMenu.jsx` currently uses CSS gradients/motion CTAs and no external Home image assets.
   - Assets exist under `public/assets/ui`, but they appear unused by Home runtime.

6. **Backend error payloads can expose debug/internal details**
   - `updateLobbyGameState`, `startLobbyGame`, and `getQuestions` return debug objects or raw `error.message` in some paths.
   - Useful for dev, but needs production-safe gating.

### Low Risk / Cleanup

1. Old invite component `src/components/lobby/CreateLobbyInvitePanel.jsx` remains in the repo and is imported by Health raw-source tests, not active product flow.
2. `runTestSuite` still references legacy `Question.year`, `type`, and old categories in backend smoke tests.
3. Docs are mostly present but spread between `docs/` and `src/docs/`.
4. Some user-facing `Level` text remains in `src/components/leaderboard/KronoxRankingSection.jsx`; it may be visible and should be reviewed against the Seviye copy rule.
5. PWA manifest icons rely on remote Base44 media URLs instead of local offline-stable icon assets.

## 4. Performance And Scalability Audit

### Leaderboard

Current state:

- `src/lib/leaderboard.js` uses `LEADERBOARD_FETCH_LIMIT = 500` and top limit 10.
- `base44/functions/getSoloLeaderboard/entry.ts` reads `User.list('-updated_date', MAX_LIMIT)`, computes projections, then ranking helpers sort/shape client-side/server-side.
- Fallback uses `SoloLeaderboardEntry.list('-total_kronox_score', limit)`.
- Visible score helper is now unified in Profile and Leaderboard UI.

Risks:

- Top ranking and current-user rank do not scale if all candidate users must be read/projected.
- Sorting by updated date before projecting can miss high-score users outside the first 500 if the user base grows.
- Current user rank among all users cannot be proven from a top-500 updated-date slice.
- Email projection in rows may be unnecessary.

Package 2 recommendation:

- Add or use a persisted, indexed `kronox_puan_total` / `leaderboard_score` field for ranking.
- Update it when Solo best score changes and when Online score delta applies.
- Query top N by indexed score.
- Add a separate current-user rank strategy or backend rank function.
- Keep displayed score and rank sort key identical.
- Remove raw email from public leaderboard projection unless explicitly needed and authorized.

### Solo Question Selection

Current state:

- `src/lib/soloQuestionEngine.js` builds controlled 18-card decks with unique IDs and years.
- `src/pages/Game.jsx` builds the deck once at attempt start and stores `soloAttemptDeck`.
- Replay remount/reset creates a new attempt deck.
- `src/hooks/useOfflineQuestions.js` loads up to 500 questions.

Risks:

- Loads and filters a broad question pool client-side.
- Unique-year selection parses/uses runtime `year`; the new schema stores year in `answer`.
- No indexed normalized year field exists in `Question.jsonc`.
- Active category gating is not wired in Solo runtime.
- 500 questions can become too small or too big depending on dataset growth.

Package 2 recommendation:

- Add a non-destructive normalized `year` or `answer_year` field only after product approval, or add a backend projection function that filters by year/state/category server-side.
- Prefer backend query/filter for active state and categories, with a safe minimal payload to client.
- Pass active category whitelist to `buildSoloAttemptDeck` or move active-category filtering to a single backend data access layer.
- Add Health case that checks actual `Game.jsx` deck wiring, not only engine unit behavior.

### Online Lobby / Invite

Current state:

- `src/lib/gameInviteSelectors.js` and `src/lib/notificationViewModel.js` centralize active invite derivation.
- `GameInviteNotifier` is mounted in `App.jsx`, subscribes to `GameInvite`, uses view model, and visual dismiss does not mutate persisted invite state.
- `useHeaderNotifications` and `IncomingInvitesPanel` have merge/preserve logic.

Risks:

- Multiple surfaces still fetch and subscribe independently, although shared selectors reduce drift.
- Runtime flicker still requires two-account proof.
- `startLobbyGame` fallback can start with wrong question categories instead of surfacing a clean content/setup error.
- Lobby start 400 needs runtime reproduction and payload-contract tracing.

Package 2 recommendation:

- Add a small shared invite store/hook if duplicate fetch/subscription behavior remains.
- Add explicit start-lobby payload contract tests against `startLobbyGame`.
- Keep route-state authoritative lobby bootstrap, but add runtime trace event review.

### Category Loading

Current state:

- `src/components/lobby/OnlineChallengeScreen.jsx` reads `Category.list('category_id', 50)`.
- `src/lib/categoryFilters.js` filters status `a`, hides `p`, missing status as active.
- `base44/functions/seedQuestionCategories/entry.ts` seeds six categories with status `a` and descriptions.

Risks:

- Naming drift: `category_id` vs `categoryid`.
- Static legacy `src/lib/onlineCategories.js` still carries taxonomy/config and may duplicate DB category truth.
- Category status is enforced in Online UI, but not in Online start backend or Solo deck runtime.

Package 2 recommendation:

- Decide canonical field name and update import docs/Health accordingly.
- Centralize category ID mapping, active status, and display names.
- Apply active category filtering in backend start/question selection paths.

### Assets / UI Performance

Current state:

- `MainMenu.jsx` uses CSS gradients and motion CTAs.
- `public/assets/ui` contains several WebP files totaling about 1.8 MB.
- Some local assets appear unused by runtime.
- Manifest icons use remote media URLs.

Risks:

- Unused image assets increase repo and deployment weight.
- Remote manifest icons can weaken offline/PWA readiness.
- Heavy animations and image use still need device performance proof.

Package 2 recommendation:

- Build an asset reference map before deleting.
- Either update Home to use approved WebP assets or update docs/Health to declare CSS/motion Home as product truth.
- Move PWA icons to local committed assets.
- Add reduced-motion checks around motion-heavy surfaces.

## 5. DB And Data Model Audit

### User / Profile

Current state:

- `online_progress.score` contributes to visible Kronox Puan.
- Solo score remains in `solo_progress` summary.
- `src/lib/kronoxScore.js` computes visible score as Solo component plus Online component.
- Diamond balance field is `diamonds` through `src/lib/diamondEconomy.js`.
- Admin checks use role/is_admin/permissions and env allowlist in backend functions.

Risks:

- No clearly persisted indexed `kronox_puan_total` field for leaderboard scale.
- Old users with missing `diamonds`, `starter_bonus_granted_at`, or `last_daily_diamond_reward_date` rely on bootstrap helpers and null-safe UI.
- Admin role and env allowlist are split; backend checks must stay server-side.

Package 2 changes:

- Add or plan indexed leaderboard score projection.
- Add migration/backfill plan for old user economy and score fields.
- Keep all admin-only backend functions guarded server-side.

### Category

Current state:

- Entity: `base44/entities/Category.jsonc`.
- Fields: `category_id`, `name`, `status`, `description`.
- Six seed rows are defined in `base44/functions/seedQuestionCategories/entry.ts`.
- UI active list uses `status === 'a'`.

Risks:

- Product request now says `categoryid`, schema uses `category_id`.
- Category rows are public readable; likely acceptable for taxonomy.
- Active/passive status is not uniformly enforced outside UI.

Package 2 changes:

- Decide `category_id` vs `categoryid` before importing questions.
- Add a safe idempotent seed/backfill verification path.
- Enforce category status in all question access paths.

### Question

Current state:

- Entity: `base44/entities/Question.jsonc`.
- Fields: `id`, `question`, `answer`, `main_category_id`, `second_category_id`, `third_category_id`, `sub_category`, `tag`, `region`, `difficulty`, `state`.
- Required: `id`, `question`, `answer`, `main_category_id`, `difficulty`, `state`.
- RLS currently allows public read.
- Runtime adapters derive legacy `year`, `category`, `type`, `media_url`.

Risks:

- Public read conflicts with question-bank protection.
- No normalized/index-friendly year field exists for large datasets.
- `state` has `A/P`, but backend start path does not filter it.
- Health/backend smoke tests still expect legacy `year`, `type`, and old category values in places.

Package 2 changes:

- Require auth or a backend function for question access.
- Return minimal runtime-safe fields.
- Add server-side active/state/category/year filtering.
- Update stale backend Health smoke tests to new schema.

### Solo Progress / Attempts

Current state:

- Solo progress is stored in `User.solo_progress`.
- Helpers in `src/lib/soloLevels.js` and `src/lib/soloProgressHelpers.js` compute summaries and unlocks.
- Attempt deck is held in runtime state, not persisted as a durable attempt entity.

Risks:

- No durable attempt history or deck replay audit.
- Current deck once-per-attempt behavior is runtime state based; refresh mid-attempt behavior needs manual proof.
- Local recent history exists in localStorage; user scoping should remain monitored.

Package 2 changes:

- Consider `SoloAttempt` / `SoloLevelProgress` only after current runtime is stable.
- In Package 2, focus on wiring and Health proof rather than new persistence unless needed.

### Online Match / Lobby / Invite

Current state:

- Lobby state is in `Lobby`.
- Invite state is in `GameInvite`.
- Per-user scoring idempotency is in `OnlineMatchResult`.
- `updateLobbyGameState` validates authenticated player action, stale revision, active turn, player identity, used question IDs, and winner constraints.

Risks:

- `OnlineMatchResult` is created after `User.online_progress` update.
- `startLobbyGame` uses service role for questions and permissive fallback.
- Some backend error responses expose debug payloads.
- Start 400 issue requires payload-level runtime proof.

Package 2 changes:

- Add safer online scoring transaction ordering or backend apply function.
- Tighten question selection in `startLobbyGame`.
- Gate debug details by admin/dev mode.

### Diamond Economy

Current state:

- Canonical balance: `diamonds`.
- Starter: +100.
- Daily login: +20 UTC day.
- Ledger entity: `DiamondTransaction`.
- Helper checks guard fields and idempotency key before grant.

Risks:

- No strong DB uniqueness/transaction is visible.
- Ledger creation can fail after balance update.
- Multi-device duplicate prevention remains best effort.

Package 2 changes:

- Add backend function or unique-idempotency transaction pattern if Base44 supports it.
- Add admin diagnostic for ledger-missing-but-guarded states.

## 6. Scoring And Timing Audit

### Solo Scoring

Observed code:

- Solo rules in `src/lib/soloProgressHelpers.js` and `src/lib/soloLevels.js`.
- `src/pages/Game.jsx` uses `cardTarget = soloLevel.cardCount ?? 10`, `maxMistakes = soloLevel.maxMistakes ?? 8`, `totalTime = soloLevel.totalTimeSeconds ?? 120`.
- Success/failure result goes through `SoloLevelResult`.

Risks:

- Core scoring appears centralized, but `Game.jsx` owns many transition states and effects.
- Result persistence and popup calculations are coupled inside `Game.jsx`.
- Manual proof still needed for timeout, max mistakes, replay delta, next level, and refresh behavior.

Package 2 fixes:

- Add focused integration Health that verifies actual `Game.jsx` Solo result payload fields, not only helper tokens.
- Consider extracting Solo attempt controller later.

### Solo Deck

Observed code:

- `buildSoloAttemptDeck` enforces deck size 18, unique IDs, unique years, active questions, and optional active category whitelist.
- `Game.jsx` builds deck once and stores it.

Mismatch:

- Active category whitelist is omitted in `Game.jsx`.
- Health proves the engine can filter categories when given a whitelist, but does not prove actual runtime supplies one.

Package 2 fix:

- Load active categories once and pass numeric active `main_category_id` set into Solo deck build, or move this into question fetch so Solo only receives active rows.

### Online Scoring

Observed code:

- `src/lib/onlineRanking.js` implements +15 win, -6 loss, time bonus, checkpoint floor, and no draw scoring.
- `src/lib/applyOnlineResult.js` applies current user's result, refreshes auth state, publishes leaderboard, and creates `OnlineMatchResult`.
- `src/pages/Game.jsx` uses player-own elapsed seconds and failure copy `Puan kaydedilemedi. Tekrar dene.`

Risks:

- Partial write if user score update succeeds but result creation fails.
- Current client appears responsible for applying its own result; two-account runtime proof is still required for both winner and loser.
- Backend winner determination and lobby completion remain split across client/backend paths.

Package 2 fixes:

- Prefer a backend transactional function for online score application if Base44 supports it.
- At minimum, add a safe recovery diagnostic and stronger Health for score-applied-with-audit-row consistency.

### Timing

Observed code:

- Solo elapsed uses `overallSeconds` and `soloLevelTotalSeconds`.
- Online winner bonus uses per-player elapsed helpers and not total lobby duration.

Risks:

- `Game.jsx` has several timer/cleanup effects; unmount/route-change cleanup needs manual proof.
- Online per-player elapsed must be verified with two accounts and refresh/reopen scenarios.

Package 2 fixes:

- Add runtime/manual test checklist and optional debug markers for elapsed source.

## 7. Gameplay Flow Audit

### Solo

Working architecture observed:

- Home -> `/solo` -> `SoloChallenge` -> `LevelMapPath`.
- `LevelMapPath` scrolls inner content and renders future level numbers.
- Current focus uses shared progress helpers.
- `Game.jsx` renders `SoloLevelResult` instead of generic `GameOver` for Solo level mode.

Risks:

- User-facing `Level` copy still appears in `src/components/leaderboard/KronoxRankingSection.jsx`.
- Current level label/viewport flip needs real screenshot proof.
- Drag/drop visual changes were not audited deeply due scope; should be manual smoked.

### Online

Working architecture observed:

- Home Online CTA navigates to `/lobby`.
- `OnlineChallengeScreen` reads active categories from DB and supports friend popup selection.
- Invite notifier, header, and Online pending list use shared selectors/view model.
- `acceptGameInvite` returns lobby payload and `LobbyRoom` uses route state bootstrap.

Risks:

- Recent lobby start 400 needs direct runtime reproduction and backend payload trace.
- `startLobbyGame` category fallback can hide content-tagging errors.
- Friend selection and start double-click behavior require runtime proof.

## 8. Runtime Error Handling And User-Facing Failure States

Findings:

- Native `alert(` was not found in active source during search.
- User-facing retry/error patterns exist in several surfaces.
- `WaitingRoomPanel` stores and shows `startError`.
- `Game.jsx` uses `setError` and fallback UI for game loading failures.
- Error boundaries exist: `AppErrorBoundary`, `GameRenderErrorBoundary`, `SimulationPanelErrorBoundary`.

Risks:

- Backend functions sometimes return raw `error.message` and debug objects.
- `getQuestions` returns `{ error: error.message }` on 500.
- `updateLobbyGameState` returns detailed debug data for validation failures.
- Some console errors are useful but need production gating review.
- Critical flows need visible recovery: scoring persist retry, invite accept retry, lobby start retry, question load retry.

Package 2 fixes:

- Add controlled error shape helper for backend functions.
- Gate debug payloads behind admin/dev flag.
- Add Health cases for user-visible retry on question load, lobby start, invite accept, score persist.

## 9. State Management Consistency

Findings:

- Score visible source is centralized in `src/lib/kronoxScore.js`.
- Diamonds are centralized in `src/lib/diamondEconomy.js`.
- Invite filtering is centralized in `gameInviteSelectors` and `notificationViewModel`.
- Lobby state uses route state plus fetch/subscription hooks.

Risks:

- Some data still exists in multiple places: lobby route state, backend lobby, subscriptions, local active lobby card, and localStorage/session-like history.
- Online score visible UI depends on refreshed auth user state plus leaderboard publish.
- Diamond grant runs during auth bootstrap and can update user while other components read stale initial user.
- Category truth is split between DB `Category`, `src/lib/onlineCategories.js`, and selected static IDs.

Package 2 fixes:

- Define source-of-truth table in docs for each product domain.
- Add integration Health for refresh/back navigation/reopen behavior where static proof can only be partial.

## 10. Idempotency, Double Click, And Race Conditions

High-risk flows:

1. Online scoring: partial write between `updateMe` and `OnlineMatchResult.create`.
2. Diamond grants: no visible DB unique constraint around idempotency key.
3. Lobby start: host double click can call `startLobbyGame` multiple times unless UI/backend status transition fully guards it.
4. Invite send: duplicate invite prevention needs runtime proof.
5. Friend request accept/reject: not deeply audited in Package 1; should be included in RLS/manual probes.

Existing protections:

- Online scoring checks existing `OnlineMatchResult`.
- Diamond helper checks guard fields and ledger before and after refresh.
- `updateLobbyGameState` uses state revision and action validation.
- GameInvite selector/actionability filters terminal statuses.

Package 2 fixes:

- Add backend-level idempotency keys where possible.
- Add disabled/loading guards and backend duplicate guards for start/send actions.
- Add race-condition Health cases as NOT_AUTOMATABLE unless there is a real harness.

## 11. Authorization, RLS, And Service-Role Blast Radius

Findings:

- `generateTechDoc` has server-side admin guard.
- Spotify functions are removed; VAPID keys are env/config based.
- Admin email is not hardcoded in active admin helper.
- `runTestSuite` has admin guard.
- `updateLobbyGameState` authenticates user and validates player membership/turn.

Risks:

- `getQuestions` is unauthenticated and service-role backed.
- `Question` entity public read allows direct public reads if SDK entity access is available.
- `getSoloLeaderboard` uses service role and may expose `user_email`.
- Several service-role functions need least-privilege review.
- Client admin UI gating must remain non-authoritative.

Package 2 fixes:

- Lock down question read access and replace client direct fallback.
- Review service-role functions one by one for auth, role, player-membership, and output minimization.
- Add release checklist for RLS probes: wrong user cannot see/mutate invite/friend/lobby/profile/diamond data.

## 12. Mobile/PWA Runtime Readiness

Findings:

- Home uses `100dvh`, safe-area insets, fixed no-scroll layout.
- Solo path reserves bottom space and scrolls inner map.
- Admin/Health safe-area work appears represented in Health suites.
- Manifest still points icons to remote media URLs.

Risks:

- `100dvh` behavior still varies across iOS/Android WebView; runtime proof needed.
- PWA icons/notification assets should be local for offline reliability.
- Keyboard/input behavior was not deeply audited.
- Health cannot prove notch/home-indicator correctness without screenshots/device tests.

Package 2 fixes:

- Add a mobile manual proof checklist to docs.
- Use Browser/Playwright screenshots for narrow/desktop where possible.
- Move PWA icon assets local if product approves.

## 13. Accessibility, Reduced Motion, Tap Targets

Findings:

- Home CTAs have `aria-label` and motion `whileTap`.
- Notification and many icon buttons use accessible components, but full audit not complete.
- Reduced-motion coverage is not obvious in all motion-heavy flows.
- Drag/drop accessibility remains a runtime/manual area.

Risks:

- Timeline placement may rely heavily on color/animation.
- Motion-heavy path and Home may not respect `prefers-reduced-motion`.
- Some compact leaderboard/profile rows may have small tap targets or semantic gaps.

Package 2 fixes:

- Add reduced-motion helper/contract around Framer Motion variants.
- Add manual accessibility checklist for tap targets, screen reader labels, and color+icon feedback.

## 14. Observability And Diagnostics

Findings:

- Debug helpers exist (`src/lib/debugLog.js`).
- Invite lifecycle has diagnostic concepts in selector/view model.
- Build marker file documents recent changes.
- Backend functions log errors with clear prefixes.

Risks:

- Raw debug payloads can reach normal users.
- Production logs may include emails/lobby IDs; useful but privacy-sensitive.
- Online scoring/invite/lobby start need event correlation for root cause.
- Health report cannot substitute for runtime logs.

Package 2 fixes:

- Centralize safe debug logging with redaction policy.
- Add admin-only diagnostic views for recent invite/lobby/scoring errors.
- Make build marker aligned with actual code changes only.

## 15. Data Migration And Backfill Safety

Findings:

- Category seed is idempotent by lookup/update/create and preserves explicit passive statuses.
- Solo progress helpers include backfill/self-healing.
- Diamond bootstrap handles missing fields.
- Question schema cleanup is complete at entity definition level.

Risks:

- Existing DB rows may lack category `status`/`description`.
- Existing users may lack `diamonds`, `online_progress`, or `solo_progress` fields.
- No visible migration uniqueness for DiamondTransaction idempotency keys.
- If category seed runs repeatedly with changed names, it may update names/descriptions but should not unintentionally alter `status`.

Package 2 fixes:

- Add migration/backfill dry-run report for Category/User/Question readiness.
- Document exactly which migrations are destructive vs additive.
- Never run destructive cleanup without an export/recovery plan.

## 16. Offline And Fallback Behavior

Findings:

- `useOfflineQuestions` has backend function load and direct entity fallback.
- Push notification missing VAPID is best-effort and in-app invite remains available.
- Question cache exists in `src/lib/questionCache.js`.

Risks:

- Direct Question entity fallback is a security exposure.
- If backend question fetch fails after Question RLS is tightened, Solo may fail unless a safe cached projection path is kept.
- Offline mode with new question schema needs runtime proof.

Package 2 fixes:

- Replace direct public fallback with authenticated cached minimal projection.
- Add clear user-facing question-load failure and retry.
- Keep push best-effort fallback.

## 17. Asset Pipeline, Bundle Size, And Image Hygiene

Observed asset candidates:

- `public/assets/ui/Kronox_Home_Button_Solo.webp`
- `public/assets/ui/Kronox_Home_Button_Online.webp`
- `public/assets/ui/Kronox_Home_Fantasy_background.webp`
- `public/assets/ui/home-background-full.webp`
- `public/assets/ui/home-screen-final.webp`
- `public/assets/ui/Kronox_Online_CTA_Start.webp`
- `public/assets/ui/Kronox_Online_CTA_Join.webp`
- `public/assets/ui/Kronox-Cosmic_background.webp`
- `public/assets/ui/kronox_hero_section_v1.webp`

Findings:

- `MainMenu.jsx` does not use the Home button/background WebPs.
- `kronox_hero_section_v1.webp` is referenced by `public/sw.js`.
- Health monolith still references old/stale asset names like `Kronox_Home_Fantasy_Background.png`.

Package 2 fixes:

- Generate an exact asset reference table.
- Remove only unused assets after confirming no external/deployment dependency.
- Update stale Health asset cases or update Home runtime to use approved assets.

## 18. Internationalization And Turkish Copy

Findings:

- Most visible score copy uses `Puan` / `Kronox Puan`.
- Profile and Leaderboard stats use `Seviye`.
- `src/components/leaderboard/KronoxRankingSection.jsx` still contains visible `Level {level}` and `Level {row.summary.currentLevel}` strings.
- Category name `Level Up` is valid as a category name and should remain.

Risks:

- User-facing `Level` strings can violate the Solo Seviye rule.
- Some backend error messages use ASCII Turkish without diacritics, while product examples include Turkish copy.

Package 2 fixes:

- Review visible UI only and replace `Level` with `Seviye` where it is not a category/name/internal doc.
- Add Health check that excludes technical docs/category names but catches visible UI leakage.

## 19. Dependency And Package Hygiene

Findings:

- `package.json` has many UI/runtime dependencies.
- Scripts available: `dev`, `build`, `lint`, `lint:fix`, `typecheck`, `preview`.
- No npm Health runner script exists.
- `@stripe/*`, `react-quill`, `react-leaflet`, `three`, `recharts`, and several Radix packages may be unused or future-facing, but this was not proven in Package 1.

Risks:

- Unused dependencies increase bundle size and security surface.
- `npm audit` was not run in Package 1 because it was not part of the requested test run and may require network.

Package 2 fixes:

- Run dependency usage audit.
- Run `npm audit` or equivalent with network approval if requested.
- Remove unused packages only after import/reference proof.

## 20. API And Function Contract Audit

High-priority contracts:

- `getQuestions`: currently no auth, raw broad question list, raw error message.
- `startLobbyGame`: validates host and players, but selected-category filtering has permissive fallback and no active state/category filter.
- `updateLobbyGameState`: strong player/revision validation, but debug payloads are returned to clients.
- `acceptGameInvite`: returns lobby payload and has recipient/error contracts, but runtime proof required.
- `sendGameInvitePush`: best effort, missing VAPID should not break invite.
- `getSoloLeaderboard`: auth required, but service-role projection and email exposure require review.

Package 2 fixes:

- Define request/response schemas for each critical function.
- Add frontend handling for 400/401/403/409/410/500 with user-friendly copy.
- Add Health for response shape drift.

## 21. Test Coverage And Health Audit

Current Health structure:

- Modular registry exists in `src/components/game/simulationPanelCaseRegistry.jsx`.
- Large legacy file `simulationPanelExtraCases.jsx` remains imported.
- Many new suite files exist for scoring, category, security, diamond, notification, leaderboard, and Solo.

False positive / false negative risks:

- Solo engine Health tests pure helper but not live `Game.jsx` category whitelist wiring.
- Some runtime-only checks are static and should remain NOT_AUTOMATABLE.
- Old Health monolith still references removed `CreateLobbyInvitePanel` and old assets.
- `runTestSuite` backend tests still use legacy question shape.
- Health can pass while runtime product proof is missing for two-account scoring, invite flicker, mobile safe-area, push, RLS, and online start.

Missing cases:

- `getQuestions` requires auth and minimal projection.
- Solo `Game.jsx` passes active-category whitelist or uses filtered data source.
- `startLobbyGame` filters question state/category status and does not silently bypass selected categories.
- Leaderboard does not leak raw emails.
- Diamond grant ledger and balance cannot diverge silently.
- PWA manifest icons are local/offline-safe or explicitly documented.
- Visible `Level` copy absent outside category/internal docs.

## 22. Dead Code, Unused UI, And Unused Asset Cleanup List

### Likely safe after verification

- `src/components/lobby/CreateLobbyInvitePanel.jsx`
  - Appears not active in LobbyRoom flow.
  - Still imported by Health raw-source monolith, so Health cleanup must happen first.

- Old Home asset Health references inside `simulationPanelExtraCases.jsx`
  - Product says no pressed asset swap.
  - Needs replacement with current Home truth.

- Spotify active functions
  - Already removed from active function folders.
  - Only docs/Health references remain intentionally.

### Needs verification before delete

- Home WebP assets under `public/assets/ui`
  - Product context says these are current, but runtime does not use them.
  - Decide product truth before delete or wiring.

- `src/pages/PlayerSetup.jsx`
  - Appears old/local flow related, but route usage must be checked before deletion.

- Unused large dependencies
  - Requires import graph and build impact audit.

### Keep

- `public/assets/ui/kronox_hero_section_v1.webp`
  - Referenced by service worker notification icon/badge.

- `src/lib/onlineCategories.js`
  - Still used for static online category mapping/metadata.
  - Should be merged with DB category truth later, not deleted blindly.

## 23. Docs Audit

Docs found in `docs/`:

- `docs/KRONOX_DATA_MODEL_AUDIT.md`
- `docs/KRONOX_DATA_MODEL_IMPLEMENTATION_PLAN.md`
- `docs/KRONOX_ECONOMY_RULES.md`
- `docs/KRONOX_MOBILE_VISUAL_GUARDRAILS.md`
- `docs/KRONOX_PROFILE_FIELDS.md`
- `docs/KRONOX_QUESTION_DATA_MODEL.md`
- `docs/KRONOX_SCORING_RULES.md`
- `docs/KRONOX_SECURITY_DEPLOYMENT.md`

Docs found outside `docs/`:

- `src/docs/KRONOX_SOLO_QUESTION_ENGINE.md`

Missing/mismatched:

- `docs/KRONOX_SOLO_QUESTION_ENGINE.md` is missing from the expected docs folder.
- No dedicated `docs/KRONOX_INVITE_LOBBY_LIFECYCLE.md` was found during the audit pass.
- No dedicated `docs/KRONOX_CATEGORY_TAXONOMY.md` was found; category details are in question/data docs and code.
- No dedicated `docs/KRONOX_HEALTH_CENTER_ARCHITECTURE.md` was found.

Contradictions:

- Solo Question Engine doc says caller supplies active category whitelist; `Game.jsx` omits it.
- Product context says category field `categoryid`; schema/docs use `category_id`.
- Product context says Home WebP assets are runtime assets; `MainMenu.jsx` is CSS/motion-only.

Package 2 docs plan:

- Move/copy Solo Question Engine doc to `docs/` and keep `src/docs` mirror only if the app imports it.
- Add category taxonomy/status doc or merge into question data doc.
- Add invite/lobby lifecycle doc if not covered elsewhere.
- Update Home asset docs/Health based on final product truth.
- Add Health Center architecture doc if monolith cleanup proceeds.

## 24. Release Readiness And Manual Proof Checklist

Static Health cannot prove these items:

1. Two-account Online score persistence for winner and loser.
2. Duplicate reopen/refresh online scoring idempotency.
3. Invite banner dismiss vs header/Online pending invite state.
4. Invite accept from banner/header/Online list and stable lobby join.
5. Host lobby start after accepted invite, including recent 400.
6. Real mobile safe-area/notch/home-indicator layout.
7. PWA install/notification behavior with VAPID configured.
8. RLS probes for wrong-user invite/friend/lobby/profile mutation.
9. Diamond daily reward multi-device duplicate race.
10. Drag/drop accessibility and reduced-motion runtime feel.
11. Solo deck replay/refresh behavior.
12. Leaderboard current-user row matching profile after online score change.

These should remain NOT_AUTOMATABLE unless a real harness is added.

## 25. Package 2 Implementation Plan

### Package 2A - Safe Fixes And Cleanup

Priority: P0/P1
Risk: low to medium
Blast radius: docs, Health, copy, dead-code references, small wiring fixes.

1. Create or move `docs/KRONOX_SOLO_QUESTION_ENGINE.md`.
   - Expected files: `docs/KRONOX_SOLO_QUESTION_ENGINE.md`, possibly `src/docs/...` mirror notes.
   - Tests: `git diff --check`, docs Health if present.

2. Replace visible `Level` copy with `Seviye` where user-facing.
   - Expected files: `src/components/leaderboard/KronoxRankingSection.jsx`, Health copy cases.
   - Do not alter category name `Level Up`.

3. Update stale Health contracts.
   - Remove/replace old `CreateLobbyInvitePanel` and pressed asset assumptions from active Health.
   - Expected files: modular Health suites and registry overrides.
   - Do not add large cases to `simulationPanelExtraCases.jsx`.

4. Resolve Home asset truth.
   - Either wire current WebP assets into `MainMenu.jsx` or update docs/Health to CSS/motion Home.
   - Do not reintroduce pressed image swap.

5. Add exact asset reference map and remove only proven unused assets.
   - Expected files: docs/report plus asset deletes only after proof.

### Package 2B - Security And Data Access

Priority: P0
Risk: medium to high
Blast radius: question loading, Solo/Online start, backend function contracts.

1. Secure `getQuestions`.
   - Add server-side auth.
   - Return minimal normalized runtime projection.
   - Remove direct public `Question.list` fallback from `useOfflineQuestions`.
   - Revisit `Question` RLS public read.

2. Tighten service-role outputs.
   - Review `getSoloLeaderboard` email projection.
   - Gate debug payloads in backend functions.

3. Add safe response contracts for 400/401/403/409/410/500.
   - Ensure UI shows Turkish user-friendly messages and retry where needed.

### Package 2C - Question, Category, And Online Start Correctness

Priority: P0/P1
Risk: medium
Blast radius: question fetch/start flows, no scoring change.

1. Decide `category_id` vs `categoryid`.
   - Update schema/import docs/Health once.
   - Avoid dual competing fields.

2. Enforce active question and category filtering.
   - Solo: pass active category whitelist into `buildSoloAttemptDeck` or provide pre-filtered rows.
   - Online start: filter `Question.state === 'A'` and active Category status server-side.

3. Remove permissive selected-category bypass in `startLobbyGame`.
   - If selected categories yield no questions, return controlled content error.
   - Do not silently start with wrong categories.

4. Add normalized year/index strategy.
   - If schema change is approved, add `year`/`answer_year` for server-side filtering.
   - Otherwise implement robust backend projection.

### Package 2D - Unified Score, Leaderboard, And Economy Hardening

Priority: P1
Risk: medium
Blast radius: profile/leaderboard/online scoring/economy.

1. Persist/index leaderboard score.
   - Add/update `kronox_puan_total` / `leaderboard_score`.
   - Update after Solo and Online changes.
   - Use for rank sort and display.

2. Harden online scoring idempotency.
   - Prefer backend apply function or create durable idempotency before/with score update.
   - Add reconciliation diagnostic for score-without-result and result-without-score.

3. Harden diamond economy idempotency.
   - Add backend grant function or unique transaction key if supported.
   - Add diagnostic for ledger failure after balance update.

### Package 2E - Invite/Lobby Runtime Stabilization

Priority: P1
Risk: medium
Blast radius: invite/lobby only.

1. Reproduce recent lobby start 400.
   - Log payload and backend validation reason.
   - Fix contract mismatch if found.

2. Add double-click guards for start/send invite.
   - Backend and UI.

3. Run two-account manual proof.
   - Invite banner/header/Online list.
   - Accept from each entry point.
   - Stable lobby join.

### Package 2F - Mobile, Accessibility, Observability, Release Proof

Priority: P1/P2
Risk: low to medium
Blast radius: UI/layout/docs.

1. Add reduced-motion support audit/fixes.
2. Add local PWA icon assets.
3. Add admin-only diagnostics with redaction.
4. Create `docs/KRONOX_RELEASE_PROOF_CHECKLIST.md`.
5. Run Browser screenshots for Home/Solo/Leaderboard/Admin where possible.

## 26. Do Not Touch Safety List For Package 2

- Do not change Solo scoring math.
- Do not change Online scoring amounts.
- Do not add draw/tie scoring.
- Do not mutate Solo progress from Online games.
- Do not change GameInvite TTL from 10 minutes.
- Do not reintroduce old lobby settings panel.
- Do not reintroduce old friend-selection screen.
- Do not reintroduce pressed PNG/WebP asset swap.
- Do not implement Daily Quest.
- Do not refactor drag/drop, Timeline, QuestionCard, or GameLayout unless a specific audited bug requires it.
- Do not delete assets/components without reference proof.
- Do not convert runtime/manual proof cases to fake static PASS.
- Do not perform destructive DB migrations without export/recovery plan.

## 27. Open Questions

1. Should the canonical Category field be `category_id` or `categoryid` for the new import?
2. Should Home use the committed WebP mock assets, or is the CSS/motion Home now the accepted product truth?
3. Should question access allow authenticated users to fetch a broad pool, or must all question selection happen through backend filtered attempts?
4. Does Base44 support unique constraints or transactional writes for `OnlineMatchResult` and `DiamondTransaction` idempotency?
5. Should leaderboard expose any email-like identifier, or only display names/avatar initials?
6. Should `year` become a first-class indexed field again for performance while `answer` remains display text?
7. Which Health suites should become runtime/manual release checklists instead of static source checks?

## 28. Package 1 Test Plan

Package 1 changed only this audit document. Required checks after report creation:

- `git diff --check`
- `npm run lint`
- `npm run build`

Health runner note:

- `package.json` has no CLI Health script.
- Focused/full Health appears to be in-app Health Center only, so Package 1 can document that Health was not run from terminal unless a separate app/browser run is performed.
