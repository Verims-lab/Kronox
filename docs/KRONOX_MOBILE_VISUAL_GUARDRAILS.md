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
  Tapping any tab opens that tab root, never a cached/sticky subpage. Profile
  subpages, Friends, Settings, Admin, Market, Daily, and similar main-tab
  subpages use a top-left back arrow with explicit parent/root fallback; the
  top-right remains reserved for notifications/actions.
* Reduced motion keeps functional feedback without relying on long animations.
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
* Solo `before_after` onboarding levels keep `ÖNCESİ` and `SONRASI` as fully
  visible/readable full slot shapes around the centered reference card on
  mobile; the regular timeline edge-peek treatment must not clip these two
  teaching slots.
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

## Health Boundary

Health may statically verify that the guardrails and source hooks exist, but it
must keep real mobile/device/store validation as manual or NOT_AUTOMATABLE
until actual runtime proof is captured.
Static heavy blur/glow token counts may remain WARNING as source risk only;
low-end Android smoothness belongs in the manual proof list.
