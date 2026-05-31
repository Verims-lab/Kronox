# Kronox Profile Fields

This note documents profile fields the app reads or writes so future schema
changes do not accidentally split source-of-truth behavior.

## User profile fields

- `hasCompletedTutorial`: profile-backed tutorial completion flag. Tutorial
  completion must not use device-only storage as the source of truth.
- `solo_progress`: user-specific Solo level progress and score summary. Solo,
  Profile, and Liderlik should read through the shared Solo helpers before
  displaying level, stars, or total score.
- `game_invite_notifications_enabled`: user preference for game invite push
  notifications. Backend push must skip recipients when this is `false`.

## Economy placeholders

Kronox does not have a complete Elmas economy yet. UI surfaces may display a
safe `0` placeholder unless a real profile/economy field exists, such as
`diamonds`, `diamondCount`, `diamond_count`, `elmas`, `elmasCount`,
`elmas_count`, `gems`, `gemCount`, `gem_count`, `economy.diamonds`,
`economy.elmas`, `wallet.diamonds`, or `wallet.elmas`.

Elmas must not be derived from Solo stars, Solo score, or completed levels.
