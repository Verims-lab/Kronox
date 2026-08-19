# Kronox Mobile Visual Guardrails

Status: Active manual visual/platform release gate.

This document is intentionally concise. It records the mobile/PWA/iOS/Android
checks that source code and static Health cannot honestly prove alone.

## Universal Mobile Web

* Verify 320px width, common iPhone widths, Android Chrome widths, tablet, and
  foldable/resizable layouts.
* No horizontal page overflow on Home, Game, Solo map, Profile, Settings,
  Friends, Liderlik, Market, Daily Calendar / Streak, Daily Wheel, Daily Quest
  Management, Privacy, and Health Center.
* Use safe-area padding around top bars, bottom CTAs, sheets, and BottomNav.
* Touch targets stay reachable and readable with system font scaling.
* Keyboard focus does not hide form actions or trap scroll.
* In-app pinch/page zoom is disabled globally by the app shell: viewport scale
  remains 1 across Home, Game, Solo map, Liderlik, Profile, Market, Admin,
  Health, Daily Wheel, Daily Quest, and routed modal surfaces.
* The zoom guard targets scale gestures only. It must not block one-finger card
  drag, timeline horizontal scroll/auto-scroll, normal page/panel scroll,
  BottomNav taps, form inputs, or modal actions.
* Pull-to-refresh/overscroll guards are scoped to the relevant container or
  active gameplay drag only.
* BottomNav visible tabs are exactly `Ana Sayfa`, `Liderlik`, and `Profil`.
  Tapping any tab opens that tab root, never a cached/sticky subpage. The active
  tab is derived only from the committed route pathname; rapid taps and browser
  back/forward cannot maintain a separate optimistic tab state. Lazy route
  loading replaces prior page content with the route loading shell, so Home,
  Liderlik, or Profil content is never visible under another tab highlight.
  Profile subpages, Friends, Settings, Admin, Market, Daily, and similar main-tab
  subpages use a top-left back arrow with explicit parent/root fallback; the
  top-right remains reserved for notifications/actions.
* Home is bounded by `100dvh`, safe-area insets, and the known BottomNav height.
  Its content column may scroll vertically inside those bounds at 320px-class
  heights, but must keep both primary CTAs reachable above the three-tab nav
  and must never introduce horizontal overflow.
* Reduced motion keeps functional feedback without relying on long animations.
* A1 visual polish uses shared navy/cyan/gold depth, tactile press states, and finite decorative motion only. Panels, cards, and modals must remain readable, width-bounded, safe-area-aware, and free of new gesture-blocking overlays at 320/360/390px.
* Liderlik keeps the exact root token `className="leaderboard-page text-white"`. The scoped `.leaderboard-page` CSS owns its deep-navy background, radial blue glow, vertical dark-blue gradient, safe areas, centered trophy badge, and gold `LİDERLİK` title; A1 card polish stays inside that root.
* A2 state policy: global errors are reserved for page-blocking failures; optional failures stay inside their section, empty states are not errors, loading does not flash empty content, and retry actions reload only the affected section where possible.
* Public error, empty, and loading surfaces use short Turkish copy and never render raw backend errors, stack traces, emails, guest tokens, owner/player keys, provider IDs, or internal row identifiers. Online random matchmaking remains available when the invite/player list fails or is empty.
* Loading/error/retry states must be local to the affected section when possible
  so one slow data source does not blank an entire screen.
* Health Center report actions, case details, copy buttons, clipboard fallback
  textarea, manual proof details, and raw JSON preview must fit 320px-class
  mobile widths without horizontal page overflow.
* Daily Calendar / Streak at `/daily` must fit 320px-class screens with no
  horizontal panning: header, month calendar, legend, task rows, and streak
  reward panel all shrink within the viewport while normal vertical scrolling
  remains available.
* First-time guest onboarding uses the actual Solo gameplay surface for the real
  level-type first Solo level. The guidance overlay must not capture drag/drop touches,
  must fit small portrait screens, and must resume cleanly if the app closes
  during tutorial/profile/category setup.
* Home / Ana Sayfa stays a clean play surface: no Google / Apple / email login
  buttons and no `Hesabını bağla` / progress-protection account-link card.
  Guest account linking belongs under Profile. The first-launch welcome may
  show a secondary `Hesabım Var` route into that Profile flow, but provider
  buttons must not appear on the welcome screen.
* Profile > Profil Bilgileri may show the current player's read-only/copyable
  `Kullanıcı ID`; the row must fit 320px-class screens without becoming an
  editable field or leaking private/internal IDs elsewhere.
* Solo gameplay shows the remaining move counter as `10 HAMLE`, `9 HAMLE`,
  etc. on onboarding and normal levels and `13 HAMLE`, `12 HAMLE`, etc. on
  special levels; result popups show `HAMLE` instead of `HATA`.
* Solo and Mağaza display the Time Freeze joker as `Zamanı Dondur`; its icon
  color is `#e31717`. Store `İpucu` package icons use the in-game yellow
  hammer treatment, not a bulb or generic sparkle icon.
* Home `Çark` shortcut keeps the same outer circular shortcut size while the
  inner mini wheel artwork is 30% larger, centered, and unclipped.
* Solo `before_after` onboarding levels keep `ÖNCESİ` and `SONRASI` as fully
  visible/readable full slot shapes around the centered reference card on
  mobile; the regular timeline edge-peek treatment must not clip these two
  teaching slots.
* The Level 1 start popup video is the local
  `/assets/tutorials/Seviye1tutorial.mp4` asset rendered inside the existing
  mobile-safe video slot; title/copy are `Önce mi, Sonra mı` and
  `Kartı doğru tarafa sürükle`. The video takes 70% of the popup height in a
  portrait slot, autoplays muted, loops, plays inline on mobile, preloads
  metadata only while open, hides native controls, starts from the beginning on open, and
  pauses/resets on close. `ANLADIM` is the primary bottom action, and the
  effective timer remains paused until the popup is closed.
* The Solo-only streak HUD stays compact above gameplay content at 320/360/390px, is width-bounded to the viewport/safe area, uses pointer-events-none feedback, never covers drag/timeline/Joker/Hint/timer/progress controls, uses finite transform/opacity motion, and removes translation/spark animation under reduced motion. Online renders no streak HUD. Levels 1-6 and fail-closed guest milestones may show the same visual milestones only with explicit non-reward copy; no Diamond reward title/value may imply an applied grant when none occurred.
* Solo drop slots in `before_after`, `timeline_basic`, and normal timeline are
  static: no blinking, pulsing, flashing, shimmering, or pre-drop correct-slot
  guidance. Drag-over feedback is allowed only while actively dragging over a
  slot and must remain non-blinking.
* Manual mobile proof must confirm touch, slight drag, invalid drop, tutorial
  hand/finger animation, tutorial popups, and joker activation do not decrement
  the remaining move counter.
* Guided tutorial question 2 timeline swipe hand must remain visual-only:
  visible for at least 3 seconds, stopped by timeline/card interaction after
  that minimum, and stopped automatically by 10 seconds if ignored.
* Heavy blur/glow styling is release-gated by real performance proof: on a
  low-end Android device or emulator, open Health Center, guided tutorial, and
  gameplay states that use the strongest blur/glow overlays and confirm scroll
  plus animation smoothness.
* Gameplay/tutorial source should stay within the Health static heavy
  blur/glow token cap so low-end Android proof starts from a lighter baseline.
* Online gameplay loading must wait on Lobby shared deck readiness
  (`online_question_deck` + `current_question_id`), not on the Solo
  `getQuestions`/cache path. A missing Online deck should show retry/back-to-lobby
  recovery rather than an indefinite question-loading screen.
* Solo/Online question preparation uses the shared visual-only Kronox hourglass
  loader for normal preparation. The loader must be lightweight, safe-area
  aware, and must not add artificial wait, minimum display duration, or block
  gameplay start. Retry/back controls belong only to recovery/error fallback
  states, not the normal preparation visual.
* Store Diamond-spend purchase popups are centered safe-area-aware modals,
  not bottom sheets behind BottomNav: width `min(92vw, 34rem)`, max-height
  bounded by `100dvh` minus safe areas, internal vertical scroll if needed,
  and the purchase CTA remains tappable.

## PWA

* Direct URL routes load correctly in installed/standalone and browser modes.
* Browser/PWA/WebView zoom prevention is web-owned in `index.html` plus the
  root app-shell zoom guard; native Android/iOS wrapper files are not edited
  for this contract.
* Service worker/cache updates do not leave stale question/runtime bundles after
  a question-set or function contract change.
* Push notification UI is feature-detected and remains optional; in-app invite
  flow must work without push.
* Friend/game invite notifications must stay readable and actionable until the
  user acts, the row reaches a terminal status, the invite expires, or the
  source is confirmed invalid; transient empty refreshes must not collapse the
  visible notification.
* Terminal lobby-accept notifications must not fill the mobile viewport: historical accepts are not replayed on bootstrap, fresh accepts collapse into one summary per batch/lobby, and the shared visible toast stack is capped at four.
* Explicit test artifacts and stale accepted rows are suppressed non-destructively; notification text remains username-only and never renders private identifiers.
* Offline UI is shown only for real offline or failed fetch plus no usable
  cache, not for an empty cache while online.

## iOS

* Final App Store icon proof is the exported IPA / `WixOneApp.app`, not only
  source PNGs.
* `npm run check:ios-icons` is required before archive upload, but App Store
  Connect validation remains the final proof.
* Safari/PWA drag, safe-area, keyboard, home-indicator, and back navigation
  behavior require real-device proof, including pinch/double-tap zoom rejection
  and preserved Solo drag/timeline scroll.
* Privacy URL and App Store privacy answers must match the live app behavior.

## Android

* Android wrapper edge-to-edge behavior, status/navigation bar handling, back
  button behavior, orientation, tablet/foldable resizability, and Play Console
  quality warnings require AAB/device/Play proof.
* Web/PWA source checks do not prove native wrapper behavior.
* Push and installability must be checked on a real Android device or emulator
  using the actual release wrapper/channel.

## Paket B2 — Mobile/WebView Runtime Performance

* Normal Home startup must not eagerly evaluate Admin, Health Simulator, opt-in diagnostics, or the full Daily Wheel visual implementation. Route/modal demand boundaries use the shared resilient lazy-chunk loader.
* Route/modal timers, polling loops, visibility/focus listeners, body scroll locks, media playback, confetti, and delayed visual callbacks must stop or restore their previous state on close/unmount.
* Online waiting reads must suppress overlapping polls and ignore stale async completions after cancel or route change.
* Large tutorial media is route/popup scoped and uses metadata preload; muted, inline, looped autoplay behavior remains unchanged while the popup is open.
* Infinite decorative animation must provide a static reduced-motion state. Finite reward/waiting/streak effects must not leave a half-finished overlay.
* Daily status badges remain post-paint and concurrent identical actor/day reads are deduped without changing server authority or cache invalidation.
* These optimizations must preserve 320/360/390px containment, safe areas, A1 visual quality, gameplay ordering, scoring, economy, Daily, Online, and Solo rules.

## Release Gate UI Boundary

* The former Admin `Yayın Hazırlığı / Release Readiness` checklist panel is removed to reduce static UI clutter.
* Release readiness is tracked through guarded HealthCenter Release Gate, Security, Deployability, and Full packs plus canonical release-proof documentation.
* Production deployment, real Android/iOS/WebView devices, RLS/multi-account isolation, platform indexes, production VAPID secrets, and store/release evidence remain manual/external proof.
* No Admin or public UI panel may imply release completion without attached proof.

## Paket B6 — Health Automation Mobile Boundary

* Grouped Health pack controls, latest-run summary, proof-quality metrics, owner/action cards, report actions, and case details must remain usable at 320/360/390px.
* Health run progress is local and finite; closing the panel cancels visible progress and prevents stale UI updates.
* On-demand Admin execution is implemented. Scheduled/continuous device monitoring remains external and must not be shown as automated proof.

## Health Boundary

Health may statically verify that the guardrails and source hooks exist, but it
must keep real mobile/device/store validation as manual or NOT_AUTOMATABLE
until actual runtime proof is captured.
Static heavy blur/glow token counts may remain WARNING as source risk only;
low-end Android smoothness belongs in the manual proof list.