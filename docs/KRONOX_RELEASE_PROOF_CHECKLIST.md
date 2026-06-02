# Kronox Release Proof Checklist

This checklist captures proofs that static Health cannot honestly automate.
Do not mark these as PASS without a real harness or a recorded manual run.

## Two-Account Invite And Lobby

- User A sends an Online invite to User B.
- User B sees the invite after the toast/banner disappears.
- Header badge and Online pending list still show the invite.
- User B accepts from banner, header, and Online pending list in separate runs.
- The exact clicked invite opens the correct lobby.
- User A can start the accepted lobby without a 400.
- Both users navigate to game.
- No 3-4 second lobby flicker/drop loop appears.

## Online Scoring Persistence

- Winner gets +15 base plus individual-time bonus when applicable.
- Loser gets -6 with checkpoint floor.
- Result popup shows persisted score result.
- Profile, header/top stat, and Leaderboard current row show the same Kronox Puan.
- Refresh/reopen completed lobby does not double apply.
- Missing elapsed time gives winner +15 only.

## Solo Question Engine

- Solo attempt starts with an 18-question deck.
- The deck has 18 unique years.
- Passive-category questions are excluded.
- Win at 10 correct placements.
- Fail at 8 mistakes.
- Timeout fails the level.
- Replay creates a new deck.

## Diamond Economy

- First authenticated entry grants +100 once.
- Same day daily login grants +20 once.
- First day can total 120.
- Refresh/reopen does not duplicate.
- Two-device duplicate prevention must be manually probed unless a backend unique transaction harness exists.

## Mobile/PWA

- Home is no-scroll and safe-area aware.
- Online main screen is no-scroll where intended.
- Solo map scrolls only the map area.
- Drag/drop does not cause page scroll.
- Bottom nav and home indicator do not cover content.
- PWA manifest/icons and push behavior work on a real installed device.

## RLS And Backend Security

- Unauthenticated `getQuestions` returns 401.
- Normal authenticated users cannot fetch raw/full question-bank metadata.
- Admin-only functions reject unauthenticated users with 401.
- Admin-only functions reject non-admin users with 403.
- Wrong user cannot accept/mutate another user's GameInvite.
- Wrong user cannot see/mutate another user's FriendRequest.
- Non-player cannot mutate Lobby game state.
- Push subscription cannot be updated by another user.

## Accessibility And Motion

- Main tap targets are comfortable on small phones.
- Icon-only buttons have labels/tooltips where needed.
- Reduced-motion mode does not produce excessive animation.
- Correct/wrong feedback is not color-only in critical paths.
