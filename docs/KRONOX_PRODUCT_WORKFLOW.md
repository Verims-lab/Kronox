# Kronox Product Workflow

Status: Active product workflow contract.

This document is the current non-technical product flow map for Kronox. It
supersedes the old PDF-style workflow notes that referenced Codex040-era
behavior, login-first assumptions, old tutorial flows, old scoring copy, and
old category models.

Related contracts:

* `KRONOX_CORE_PROMPT.md`
* `KRONOX.md`
* `docs/KRONOX_TECHNICAL_FLOW.md`
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

# 1. Kronox Overview

Kronox is a mobile-first timeline card game. Players place event cards into the
right chronological position, learn before/after relationships, earn `Puan` /
`Kronox Puan`, collect Diamonds, and can play as a guest without a login wall.

Current primary surfaces:

* Ana Sayfa
* Solo Meydan Okuma
* Online Kapışma
* Mağaza
* Liderlik
* Profil
* Admin Ekranı for active admins only
* Health Center / simulator for release-risk proof

BottomNav has only:

* Ana Sayfa
* Liderlik
* Profil

Online is launched from Home. Online is not a BottomNav item.

---

# 2. User Types

Guest:

* can start without Google, Apple, or Email login
* receives an app-owned `GuestProfile`
* has a public username such as `KronoxUser####`
* can complete guided tutorial, profile setup, category setup, Solo, Home,
  Daily systems, and leaderboard projection where allowed
* can link an account later from Profile
* can tap `Hesabım Var` on the first-launch welcome to open the Profile
  account-connection card without provider buttons appearing on the welcome
  screen

Linked / registered user:

* signs in or links through Profile
* keeps username as public identity
* can use Profile account features, friends/invites, Online, Mağaza, Daily
  rewards, category preferences, and persistent economy/progress
* must see Apple wherever Google login is offered

Admin:

* is authorized by an active `AdminUser` row
* must have normalized email, active status, and `owner` or `admin` role
* can access Admin Ekranı and admin-only reports/tools
* is not authorized by request-body role, UI visibility, or hardcoded email

---

# 3. First-Time Onboarding Journey

Current first launch flow:

1. App opens.
2. App creates or verifies an app-owned `GuestProfile`.
3. Raw guest token is returned to the client once and kept client-side.
4. Server stores only `guest_token_hash`.
5. The first-launch welcome shows `Seviye 1` as the guided first Solo level
   start and `Hesabım Var` as a secondary route to Profile account connection.
6. Tutorial completion routes to profile setup.
7. Profile setup asks for username plus optional private age/gender.
8. Category selection loads current metadata.
9. Successful category completion marks onboarding complete.
10. User lands on Ana Sayfa.

Routing rules:

* `Eğitime Devam` appears only for true `tutorial_in_progress`.
* `Hesabım Var` is allowed only on the first-launch welcome and routes to the
  Profile account-connection card; Apple / Google / Email buttons stay in the
  existing Profile flow.
* `tutorial_completed` routes to profile setup.
* profile complete plus category pending routes to category selection.
* `onboarding_complete` routes to Ana Sayfa.
* stale tutorial state must not pull a player back from profile setup,
  category setup, or Home.

Firebase anonymous auth and Base44 anonymous auth are not the guest identity
model.

---

# 4. Guided Tutorial Journey

The old standalone tutorial is removed as the current onboarding product.
Current onboarding is a guided first Solo level inside the real game shell.

The guided tutorial teaches:

* dragging a card to the timeline
* before/after placement
* horizontal timeline movement
* time and `HAMLE`
* joker concepts
* first mistake / move impact

Tutorial behavior:

* welcome and pre-game explanation are shown before active play
* effective tutorial time pauses while explanation popups are visible
* popup reading should not unfairly consume time or moves
* hand/finger animations are tutorial-only visual hints
* hand/finger animations do not move the real card, spend inventory, score, or
  consume moves
* question 2 timeline swipe hint runs at least 3 seconds
* after the minimum duration, timeline/card interaction can stop the hint
* the hint auto-stops after 10 seconds if ignored
* tutorial joker demos do not spend real `UserJokerInventory`

---

# 5. Profile And Account Linking

Public identity is username only.

Current public identity:

* `username`
* default format: `KronoxUser####` / `KronoxUser#####`

Private profile fields:

* optional age
* optional gender

Age and gender are private. They must not affect scoring, leaderboard,
matchmaking, category weighting, Online question selection, or public
projection rows.

Legacy identity:

* `display_name` may exist as a compatibility mirror/projection.
* `display_name` / `Görünen Ad` is not a separate public editable field or a
  public leaderboard/API response identity field.

Account linking:

* belongs under Profile only
* Home does not show Google / Apple / Email login buttons
* Home does not show `Hesabını bağla` or secure-progress account-link cards
* the first-launch welcome may show `Hesabım Var` only as a route to Profile
  account connection, not as an inline provider/login surface
* linking merges safe user-beneficial guest progress/economy/categories once
* linking preserves guest Diamonds, Daily Wheel/Daily Quest same-day guards and
  reward history, leaderboard username identity, category preferences, and
  inventory where applicable
* provider IDs, email, raw guest token, raw `guest_id`, and `owner_key` must not
  become public identity

---

# 6. Category Selection

Category metadata loads for guests without login.

Category source of truth:

* current live `Category` rows
* current canonical taxonomy
* public-safe `getCategoryMetadata` for metadata-only reads

Metadata-only means category IDs, names, descriptions, and active/passive
status. It must not expose questions, answer years, user data, admin fields, or
the full question bank.

Guest category setup:

* loads current active category metadata
* can be completed without login
* uses `GuestProfile.selected_category_ids`
* fewer than 3 selections are advisory for guests
* empty guest selections mean all active Solo categories remain eligible
* final CTA routes to Ana Sayfa

Authenticated preferences:

* live under Profile > Profil Bilgileri > `Kategori seçimi`
* persist as `UserCategoryPreference`
* require at least 3 active valid selections when saving
* affect Solo only as soft weighting
* do not affect Online

Forbidden stale category contracts:

* hardcoded Chronicle / Flashback / Viral / Arena / Level Up fallback lists
* old original category IDs as a runtime maximum
* minimum 5 category preference rule
* SubCategory preference UI as current Settings product
* Online reading Solo preferences

Online category list is sorted by `category_id` ascending.

---

# 7. Home Flow

Ana Sayfa is the main return point after onboarding.

Home can show:

* Primary Solo entry: `OYNA` / dynamic `Seviye X`
* Secondary `ONLINE KAPIŞMA` entry
* Mağaza entry with the gold storefront icon style
* `Görevler` shortcut for Daily Quest in a centered popup
* `Çark` shortcut for Daily Wheel in a centered popup
* notification/invite access
* Diamond balance

Home's middle section is a three-part composition: left `Görevler`, centered
transparent hourglass artwork, and right `Çark`. The logo and hourglass remain
unboxed local assets over the dark blue Home background, and the Solo/Online CTA
stack keeps balanced vertical spacing between the hourglass and the fixed
BottomNav.

The Home primary Solo CTA reads the current/next playable level from the same
canonical Solo progress helpers used by the Solo level path, then starts that
resolved level directly in the game shell. The secondary Online CTA keeps
Online Home-owned and uses the same dimensions as the Solo CTA. Solo/Online
scoring, progression, rewards, and BottomNav ownership are unchanged.

Home must not show:

* Google login button
* Apple login button
* Email login button
* `Hesabını bağla` card
* secure-progress account-link card

Account linking remains Profile-only.

---

# 8. Solo Gameplay Flow

Solo is the primary single-player mode.

Current normal Solo:

* starts with 2 timeline anchor cards
* target total timeline cards: 7
* correct placements needed after anchors: 5
* max evaluated placement moves: 10
* timer: 180 seconds
* live UI shows remaining moves, e.g. `10 HAMLE`
* used moves = max moves - remaining moves

Special Solo starts at level 5 and every 5 levels after that. It keeps the
10-card timeline target, uses 13 evaluated placement moves as a mistake buffer,
shows remaining moves from `13 HAMLE`, and does not change scoring or rewards.

Stars are based on used evaluated moves:

* 5-6 used moves = 3 stars
* 7-8 used moves = 2 stars
* 9-10 used moves = 1 star

Failure:

* 10 moves used and 7 total timeline cards not reached

Move consumption:

* only valid timeline placement evaluation consumes a move
* touch, slight drag, cancelled drag, invalid drop, tutorial hand animation,
  popup reading, and joker activation do not consume a move

Visible scoring language:

* `HAMLE`
* `Puan`
* `Kronox Puan`

`HATA` is legacy/internal and is not the current visible Solo scoring driver.

---

# 9. Joker Usage Flow

Current Solo jokers:

* Kart Değiştir
* Zaman Dondur
* Kronokalkan / Hata Affı

Move model:

* Kart Değiştir does not consume a move
* Zaman Dondur does not consume a move
* Kronokalkan protects one wrong valid placement from move decrement

Normal Solo:

* uses `UserJokerInventory`
* writes `JokerTransaction`
* has no free attempt-local joker fallback

Tutorial:

* joker demos are tutorial-only
* tutorial demos do not spend real inventory

Mağaza prices:

* Zaman Dondur = 40 Diamonds
* Kart Değiştir = 50 Diamonds
* Kronokalkan = 60 Diamonds

---

# 10. Online Challenge Flow

Online is separate from Solo.

Current Online flow:

1. User opens Online Kapışma from Home.
2. Category list loads from active current metadata.
3. Host selects categories.
4. Selected categories are stored as live `category_id` values.
5. Lobby is created or joined.
6. Invite/code joins are idempotent and merge into the shared lobby roster.
7. `startLobbyGame` reconciles accepted invitees, then builds one shared
   authoritative deck/current question for the final participant list.
8. All participants enter the same `/game?online=1&lobbyId=...` session from
   realtime status updates or the waiting-room poll fallback.
9. Game reads/refetches the persisted shared Online deck if route state or a
   missed realtime event arrives before the full payload is visible.

Online question rules:

* selected categories = 100% of Online pool
* difficulty 1 and 2 only
* no Solo category preferences
* no Solo 70/30 weighting
* no guest Solo projection
* no Solo move/star result model unless explicitly designed later

Online result scoring contributes to visible `Kronox Puan`, while the Online
component remains internally auditable.

---

# 11. Economy And Daily Systems

Diamonds / Elmas are separate from Kronox Puan.

Current Diamond sources and sinks:

* starter and login Diamond grants
* Daily Wheel V2 weighted Diamond / approved joker / Gift Box grants
* Daily Quest Diamond-only grants
* Mağaza Diamond spends

Daily Wheel:

* grants Diamonds, approved Solo jokers, or Gift Box rewards only
* grants no Kronox Puan
* does not affect leaderboard
* is separate from Daily Quest
* completed guests can claim once per UTC day through token-proven GuestProfile
* uses function-level same-day guard through `DailyWheelSpin`
* after spin completion, shows the wheel, the backend-selected reward line, and
  one disabled ad/video `ÇEVİR` repeat CTA; no fake ad reward flow is active

Daily Quest:

* grants Diamonds only
* grants no Kronox Puan
* does not affect leaderboard
* is separate from Daily Wheel
* completed guests can see, progress, and claim rewards through token-proven
  GuestProfile
* uses one canonical `solo_level_complete` `UserDailyQuestProgress` row and
  `claimDailyQuestReward`
* ignores stale/duplicate `DailyQuestDefinition` rows at runtime

Economy idempotency:

* `DiamondTransaction` has function-level idempotency guards
* `DailyWheelSpin` has function-level same-day guards
* DB/entity unique constraints are not repo-proven
* economy idempotency race risk is Medium / P1 hardening until platform unique
  constraints or live parallel proof exist

Economy ledgers and balances must not be cleared by question analytics reset.

---

# 12. Leaderboard Flow

Leaderboard displays unified `Kronox Puan`.

The current Liderlik UI shows a centered trophy heading, global ranking rows,
and a fixed `Senin Sıran` card above BottomNav. The old top Puan/Seviye/Elmas
summary cards, old helper sentence, and removed friends empty area are not part
of the active Leaderboard screen.

Public identity:

* username
* safe username-based projection

Never visible in leaderboard:

* email
* provider IDs
* raw guest ID
* raw guest token
* `owner_key`
* internal player key

Completed guest users can open Liderlik and appear through safe public username
projection where the current leaderboard path supports it.

Daily Quest and Daily Wheel do not affect leaderboard.

---

# 13. Question Analytics / Reporting Flow

Question Analytics is admin/private reporting, not a public player surface.

Current report contract:

* `sendQuestionAnalyticsReportEmail`
* email-body-only
* no PDF report
* exactly 9 top-level sections when Health enforces the report contract
* includes global and category coverage
* includes anonymized per-player coverage with `User0001` style labels
* no email, provider UID, raw guest ID/token, owner key, internal player key,
  or username in per-player analytics output

Exposure model:

* same question across different players is acceptable
* same player seeing repeated questions too early is the real issue
* exposure is actual-shown-only
* candidate, buffered, reserved, and unused deck cards are not exposure
* Kart Değiştir replacement counts only when actually shown

Manual analytics reset clears only analytics/history tables:

* `QuestionAttemptEvent`
* `PlayerQuestionDailyExposure`
* `QuestionStatsProjection`
* `CategoryStatsProjection`

Optional reset:

* `PlayerQuestionExposure`, only when same-player anti-repeat memory should
  restart

---

# 14. Health / Release Workflow

Health Center is a release-risk dashboard, not a release stamp.

Status meaning:

* blocker/failure/error = must fix before release
* warning = automated/static risk that requires review
* manual required / not automatable = human, device, production, or platform
  proof
* not automatable does not reduce automated score like a failure
* critical manual gates keep `releaseReady=false` until accepted or completed
* 0 blockers alone does not mean release-ready

Report actions must use the current completed run:

* Copy Blocker JSON
* Copy Warning JSON
* Download JSON
* Copy Summary
* Last Run

Full release still requires manual proof for device gestures, two-account
Online, RLS/BOLA, Base44 deployment, push/VAPID, safe-area, native wrappers, and
low-end Android smoothness.

---

# 15. Manual Release Proof Checklist

Before release, verify at minimum:

* onboarding: guest creation, tutorial, profile setup, category setup, Home
* identity: username-only public display, Profile-only account linking
* category: guest metadata load, authenticated minimum 3 save, Online category
  sorting by `category_id`
* tutorial: no unfair time/move consumption; question 2 swipe hint timing
* Solo: 2 anchors, target 7 cards, 10 evaluated moves, HAMLE language, star
  rules by used moves
* jokers: inventory spend only in normal Solo, tutorial demos free, Market
  prices correct
* Online: selected categories 100%, difficulty 1/2, shared authoritative deck
* exposure: actual-shown-only writes and anonymized reports
* economy: Daily Wheel V2 no-Puan weighted rewards, Daily Quest Diamond-only,
  idempotency duplicate probes
* leaderboard: username-only public identity and matching Profile Puan
* analytics: 9-section email-body report, no PDF, no raw player identifiers
* security: AdminUser authorization, public function boundaries, VAPID secret
  handling, account deletion scope
* Health: blocker/warning/manual separation and newest completed run actions

Legacy/stale contracts that must not return as current truth:

* `HATA` as visible Solo scoring source
* `display_name` / `Görünen Ad` as public editable profile field
* old standalone tutorial
* login-first onboarding
* Home login buttons
* hardcoded Chronicle / Flashback / Viral / Arena / Level Up fallbacks
* minimum 5 category preference rule
* current SubCategory preference UI
* full question bank client exposure
* raw `Question.list` gameplay fallback
* Daily Quest granting Kronox Puan
* Daily Quest leaderboard impact
* Online using Solo preferences
* DB unique constraints as repo-proven economy truth

The uploaded `kronox-is-akisi.pdf` is a stale Codex040-era reference artifact.
It can be used for old document shape only and must be regenerated from current
source if a PDF deliverable is needed.
