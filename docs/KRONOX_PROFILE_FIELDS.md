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
- `diamonds`: canonical persisted Elmas/Diamond balance. Header, Home, Solo,
  Online, Profile, and Liderlik surfaces read this through the shared Diamond
  economy helper. The field is never derived from Kronox Puan, Solo stars,
  Online score, or level.
- `starter_bonus_granted_at`: ISO timestamp proving the one-time +100 starter
  Diamond bonus has already been granted.
- `last_daily_diamond_reward_date`: UTC `YYYY-MM-DD` key for the latest +20
  daily login Diamond reward.
- `economy_updated_at`: ISO timestamp for the latest Diamond balance update.

## Diamond economy

Kronox now uses `User.diamonds` as the single canonical Diamond balance.
First app entry grants +100 once per user, and daily login grants +20 once per
UTC day. The helper records `DiamondTransaction` rows with durable
idempotency keys when the ledger is available.

Elmas must not be derived from Solo stars, Solo score, or completed levels.
