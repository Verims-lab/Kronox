# Kronox Mobile Visual Guardrails

Status: Active manual visual/platform release gate.

This document is intentionally concise. It records the mobile/PWA/iOS/Android
checks that source code and static Health cannot honestly prove alone.

## Universal Mobile Web

* Verify 320px width, common iPhone widths, Android Chrome widths, tablet, and
  foldable/resizable layouts.
* No horizontal page overflow on Home, Game, Solo map, Profile, Settings,
  Friends, Liderlik, Market, Daily Wheel, Daily Quest Management, Privacy, and
  Health Center.
* Use safe-area padding around top bars, bottom CTAs, sheets, and BottomNav.
* Touch targets stay reachable and readable with system font scaling.
* Keyboard focus does not hide form actions or trap scroll.
* Pull-to-refresh/overscroll guards are scoped to the relevant container or
  active gameplay drag only.
* Reduced motion keeps functional feedback without relying on long animations.
* Loading/error/retry states must be local to the affected section when possible
  so one slow data source does not blank an entire screen.
* First-time guest onboarding uses the actual Solo gameplay surface for the
  guided first level. The guidance overlay must not capture drag/drop touches,
  must fit small portrait screens, and must resume cleanly if the app closes
  during tutorial/profile/category setup.
* Solo gameplay shows the remaining move counter as `10 HAMLE`, `9 HAMLE`,
  etc.; result popups show `HAMLE` instead of `HATA`.
* Manual mobile proof must confirm touch, slight drag, invalid drop, tutorial
  hand/finger animation, tutorial popups, and joker activation do not decrement
  the remaining move counter.
* Online gameplay loading must wait on Lobby shared deck readiness
  (`online_question_deck` + `current_question_id`), not on the Solo
  `getQuestions`/cache path. A missing Online deck should show retry/back-to-lobby
  recovery rather than an indefinite question-loading screen.

## PWA

* Direct URL routes load correctly in installed/standalone and browser modes.
* Service worker/cache updates do not leave stale question/runtime bundles after
  a question-set or function contract change.
* Push notification UI is feature-detected and remains optional; in-app invite
  flow must work without push.
* Offline UI is shown only for real offline or failed fetch plus no usable
  cache, not for an empty cache while online.

## iOS

* Final App Store icon proof is the exported IPA / `WixOneApp.app`, not only
  source PNGs.
* `npm run check:ios-icons` is required before archive upload, but App Store
  Connect validation remains the final proof.
* Safari/PWA drag, safe-area, keyboard, home-indicator, and back navigation
  behavior require real-device proof.
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
