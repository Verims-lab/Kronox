# Kronox Product Workflow

Status: Active product workflow contract.

This document describes the current user-facing Kronox product flow. It is the
canonical workflow map for onboarding, identity, category selection, Solo,
Online, economy, leaderboard, analytics, Health, and release proof.

Related contracts:

* `KRONOX_CORE_PROMPT.md`
* `KRONOX.md`
* `docs/KRONOX_PROFILE_FIELDS.md`
* `docs/KRONOX_CATEGORY_TAXONOMY.md`
* `docs/KRONOX_SOLO_QUESTION_ENGINE.md`
* `docs/KRONOX_SCORING_RULES.md`
* `docs/KRONOX_ECONOMY_RULES.md`
* `docs/KRONOX_QUESTION_DATA_MODEL.md`
* `docs/KRONOX_SECURITY_DEPLOYMENT.md`
* `docs/KRONOX_MOBILE_VISUAL_GUARDRAILS.md`
* `docs/KRONOX_RELEASE_PROOF_CHECKLIST.md`

---

# 1. Product Shape

Kronox is a mobile-first timeline trivia game. The player places dated event
cards into a timeline, learns ordering by before/after context, earns visible
`Puan` / `Kronox Puan`, and can keep playing as a guest without forced login.

The first screen for a new unauthenticated player is not a marketing landing
page and not a provider-login wall. A portable app-owned guest profile is
created or verified, then the player enters the guided first Solo level.

Primary player surfaces:

* Ana Sayfa
* Solo
* Online Kapışma
* Mağaza
* Liderlik
* Profil
* Admin Ekranı for active admin/owner users only
* Health Center / simulator for release-risk proof

Bottom navigation remains narrow and stable:

* Ana Sayfa
* Liderlik
* Profil

Online is launched from Home, not from BottomNav.

---

# 2. First-Time Guest Flow

Current first-time flow:

1. App opens.
2. The app creates or verifies an app-owned `GuestProfile`.
3. No Google / Apple / Email login is required.
4. The player sees the guided first Solo level entry.
5. Starting the tutorial sets onboarding state to `tutorial_in_progress`.
6. The guided first Solo level teaches timeline placement, timer, moves, and
   joker concepts.
7. Completion advances the guest to profile setup.
8. Profile setup asks for public username plus optional private age/gender.
9. Category setup loads current safe `Category` metadata and lets the guest
   choose interests.
10. Successful category completion marks onboarding complete and routes to Ana
    Sayfa.

`Eğitime Devam` is valid only for a truly resumable guided level:

* `onboarding_status = tutorial_in_progress`
* tutorial is actually in progress
* no later profile/category/onboarding-complete state has been reached

Stale `tutorial_in_progress` must not pull a player back from profile setup,
category setup, or Ana Sayfa.

---

# 3. Guest Identity

Guest identity is app-owned through `GuestProfile`. Kronox does not use
Firebase anonymous auth or Base44 anonymous auth for the guest identity model.

Current public guest identity:

* `username`
* default `KronoxUser####` / `KronoxUser#####`

Private or internal identity values must not be displayed publicly:

* email
* Google ID
* Apple ID
* provider UID
* raw `guest_id`
* raw guest token
* `owner_key`
* internal player key

`display_name` is a legacy/projection mirror of `username`. It is not a
separate public editable identity and must not be presented as current product
copy such as `Görünen Ad`.

Guest account linking is optional and belongs under Profile. Home / Ana Sayfa
must not show Google, Apple, Email, `Hesabını bağla`, or progress-protection
account-link CTAs. A guest can keep playing without linking.

When a guest links to Google / Apple / Email from Profile, the merge path
preserves safe user-beneficial progress, economy, and category choices once,
without exposing provider IDs as public identity.

---

# 4. Profile Workflow

Profile is the user's identity, progress, settings, social, and account-linking
home.

Visible profile stats:

* `Puan` from the shared visible Kronox Puan helper
* `Seviye` from Solo progress
* `Elmas` from persisted Diamond balance
* `Joker Çantası` from `UserJokerInventory`

Editable profile fields:

* `username`
* optional `age`
* optional `gender`

`age` and `gender` are private profile fields. They must not affect scoring,
leaderboard, matchmaking, category weighting, Online question selection, or
public projections.

Authenticated users can edit `İlgi Alanlarım` under Profile / Settings. Those
rows are user-owned `UserCategoryPreference` rows and feed only Solo soft
weighting when enough active valid selections exist.

---

# 5. Guided First Solo Tutorial

The old standalone tutorial is not the current onboarding product. Current
onboarding is a guided first Solo level launched from `/onboarding` into the
real game shell.

Current guided tutorial teaches:

* the 3-minute timer
* remaining `HAMLE`
* dragging a card into the correct timeline slot
* before/after ordering
* timeline swipe/scroll interaction
* Zaman Dondur
* Kart Değiştir
* Kronokalkan
* how a wrong evaluated placement affects moves/Puan

Tutorial time is effectively paused while instructional popups are visible.
Tutorial hand/finger hints are visual guidance only; they must not move the
real card, consume a move, trigger scoring, spend inventory, or block touch
input after their intended teaching moment.

Tutorial joker demos do not spend real `UserJokerInventory`.

The timer explanation opens before active play and shows `03:00`, not a
60-minute timer.

---

# 6. Category Selection Workflow

Current category metadata comes from live active `Category` rows, normally
through `getCategoryMetadata` or safe metadata reads.

Guest category setup:

* can load categories without login
* must use current active category metadata
* must not read raw `Question` rows
* must not expose the full question bank
* must not render stale hardcoded category fallback arrays
* may allow fewer than 3 selections as advisory guidance
* treats empty guest selections as all active Solo categories eligible
* completes with CTA text exactly `Ana Sayfa`

Authenticated category preferences:

* live under Profile / Settings / `İlgi Alanlarım`
* require at least 3 active valid selections when saving
* use all active categories for Solo when fewer than 3 valid preferences exist
* become a Solo-only soft 70/30 weighting input when at least 3 active valid
  selections exist
* do not affect Online question selection

Legacy category rules that are not current product behavior:

* old seed names such as Chronicle, Flashback, Viral, Arena, and Level Up are
  historical references only unless they exist as current active DB rows
* the original 1-6 category ID set is not a runtime maximum
* stale hardcoded category arrays are forbidden as onboarding, Online, or
  `getQuestions` fallback
* old `SubCategory` preference UI is not the current Settings product
* a "minimum 5 categories" requirement is not current; current authenticated
  preference save minimum is 3, while guest setup remains advisory

---

# 7. Home Workflow

Ana Sayfa is the main return point after onboarding. It must work for guests
and authenticated users.

Home can surface:

* Solo entry
* Online Kapışma
* Mağaza
* Daily Wheel / Günlük Ödüller
* Daily Quest panel
* notification/invite access
* Diamond balance

Home must not surface provider login/account-link buttons. Account linking is
Profile-only.

---

# 8. Solo Workflow

Solo is the primary single-player timeline game.

Current normal Solo rules:

* starts with 2 timeline anchor cards
* uses an 18-question attempt deck
* target is 7 correct timeline cards including anchors
* timer is 180 seconds
* visible limit is remaining `HAMLE`
* player has 10 evaluated placement moves
* fail occurs when 10 evaluated moves are used before reaching the target

Current special Solo rules:

* special levels start at level 10 and repeat every 5 levels
* use a 19-question attempt deck
* target is 10 correct timeline cards including anchors

Only valid evaluated placements consume a move. These do not consume a move:

* card touch
* drag start
* drag movement
* cancelled drag
* invalid drop
* tutorial hand animation
* popup reading time
* joker activation

Visible Solo result language uses `SÜRE`, `PUAN`, and `HAMLE`. `HATA` is a
legacy/internal term and must not be used as the current Solo result/stat label.

Star rules are based on used evaluated moves, not public error count.

---

# 9. Solo Joker Workflow

Current Solo jokers:

* Zaman Dondur
* Kart Değiştir
* Kronokalkan

Normal Solo joker use spends owned inventory and writes `JokerTransaction`.
`UserJokerInventory` is the current balance source. `JokerTransaction` is the
ledger/audit source.

Joker boundaries:

* tutorial demos do not spend inventory
* Online mode does not use Solo jokers
* Kart Değiştir replacement must be deck-safe and must not expose the full
  question bank
* Kronokalkan protects the next applicable wrong placement according to the
  Solo joker contract
* Zaman Dondur is a Solo gameplay effect only

Mağaza sells Solo jokers for Diamonds:

* Zaman Dondur = 40 Diamonds
* Kart Değiştir = 50 Diamonds
* Kronokalkan = 60 Diamonds

Purchases are server-authoritative and write both Diamond and joker ledgers.

---

# 10. Online Workflow

Online is separate from Solo preferences and Solo scoring rules.

Current Online question selection:

* host selects one or more active categories
* `Lobby.selected_category_ids` stores live `Category.category_id` values
* `startLobbyGame` creates the authoritative shared deck
* deck is selected 100% from lobby-selected active categories
* allowed difficulties are 1 and 2
* Game reads the persisted `online_question_deck`

Online must not:

* use Solo `UserCategoryPreference` rows
* use Solo 70/30 preference weighting
* use guest Solo question mode
* fall back to old category seed names or `Lobby.category`
* inherit Solo move/star result rules unless explicitly documented later

Online result scoring contributes to the same visible `Kronox Puan` language,
but the Online score component remains internally separate for auditability.

---

# 11. Economy Workflow

Diamonds / Elmas are separate from `Kronox Puan`.

Diamond sources and sinks:

* starter/login grants are Diamond economy events
* Daily Wheel grants Diamonds only
* Daily Quest grants Diamonds only
* Mağaza purchases spend Diamonds

Daily Quest:

* is active in the Home `Günlük Ödüller` panel
* uses admin-managed `DailyQuestDefinition`
* writes user-owned `UserDailyQuestProgress`
* grants through `claimDailyQuestReward`
* writes `DiamondTransaction.source = daily_quest_reward`
* does not grant Kronox Puan
* does not affect leaderboard sorting or rank

Daily Wheel:

* is separate from Daily Quest
* grants Diamonds only
* does not grant Kronox Puan
* does not affect leaderboard sorting or rank

Economy ledgers and current balances must remain separate from question
analytics reset workflows.

---

# 12. Leaderboard Workflow

Leaderboard displays unified `Kronox Puan`.

Current public-safe identity:

* `username`
* safe display projection based on username
* never email/provider IDs/internal owner keys

The historical `SoloLeaderboardEntry` name remains a projection name; visible
`total_kronox_score` is unified Kronox Puan, not Solo-only public score.

Profile Puan and current-user leaderboard row Puan must match.

Daily Quest and Daily Wheel do not affect leaderboard.

---

# 13. Question Analytics Workflow

Question Analytics is an admin/private reporting workflow, not a public player
surface.

Current report contract:

* `sendQuestionAnalyticsReportEmail`
* manual/admin-triggered
* email body report
* no public PDF report
* exactly 9 top-level report sections
* active raw history source is `QuestionAttemptEvent`
* anonymous per-player coverage can use `User0001` style labels
* no email, provider UID, raw guest ID/token, owner key, internal player key, or
  username in per-player analytics output

Manual reset clears only question analytics/report history tables:

* `QuestionAttemptEvent`
* `PlayerQuestionDailyExposure`
* `QuestionStatsProjection`
* `CategoryStatsProjection`

Optional reset:

* `PlayerQuestionExposure`

Clearing `PlayerQuestionExposure` resets the same-player anti-repeat memory.

Do not delete question pool, categories, users, guest profiles, category
preferences, joker inventory, economy ledgers, Daily Wheel/Daily Quest rows,
leaderboard, score, or level progress as part of question analytics reset.

---

# 14. Health And Release Workflow

Health Center is a release-risk dashboard, not a release stamp.

Health PASS means a static/simulated case executed and verified its limited
contract. Health PASS does not prove:

* real device gestures
* two-account Online behavior
* backend Base44 deployment
* RLS/BOLA behavior
* push delivery
* App Store / Play Console wrapper quality
* low-end Android smoothness

Manual Required / NOT_AUTOMATABLE gates do not reduce automated score, but they
keep `releaseReady=false` until proof is collected or accepted.

Release operators should use:

* Copy Blocker JSON for real blockers only
* Copy Warning JSON for warning-only entries
* Copy Summary for compact report context
* Download JSON for the full completed report
* the newest completed Last Run only

Full Health is intentionally not a substitute for manual proof.

---

# 15. Legacy Contracts That Must Not Return As Current Product Truth

The following are legacy, historical, or forbidden as current product behavior:

* `HATA` as visible current Solo scoring/result source
* `display_name` / `Görünen Ad` as separate public editable identity
* old standalone tutorial as current onboarding
* Chronicle / Flashback / Viral / Arena / Level Up as hardcoded active fallback
* original 1-6 categories as a runtime maximum
* minimum 5 category preferences
* current Settings `SubCategory` preference UI
* Google / Apple / Email login CTAs on Home
* Firebase anonymous auth
* Base44 anonymous auth as the guest identity model
* raw client `Question.list` gameplay fallback
* full question-bank exposure to guest or normal gameplay clients
* Daily Quest granting Kronox Puan
* Daily Quest affecting leaderboard
* Online using Solo preferences
* old fixed 10-card Solo deck without joker buffer
* public error-count based Solo stars

