## Onboarding Phase 1 Implementation Note

Guest identity foundation uses the new `GuestProfile` entity plus
`createGuestProfile` backend function. Fresh app open without authenticated
Google / Apple / Email session should create or verify a GuestProfile without
blocking play or forcing login.

Implementation constraints:

* no Firebase
* no Base44 anonymous-auth dependency
* raw guest token stored only on client/local device
* DB stores `guest_token_hash`
* default username uses `KronoxUser####` / `KronoxUser#####`
* Profile > Ayarlar edits username and optional age/gender through
  server-authoritative `updateProfileSettings`; `display_name` mirrors username
  for legacy projections
* username uniqueness uses `username_normalized` for case-insensitive checks
* age/gender are private optional profile fields and never public leaderboard
  fields
* existing Google / Apple / Email login remains unchanged
* full account-link merge is a later phase and must be one-time,
  server-authoritative, idempotent, and audited
