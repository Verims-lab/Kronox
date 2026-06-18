# Kronox Question Media Assets

This folder is for optional static media/support files only. Current core
gameplay must work without public question images.

## Current Contract

- Do not store the full question bank in public assets.
- Do not store question text, answer years, correct answers, raw answers, or
  full `Question` rows in public assets.
- No raw `Question.list` fallback may depend on this folder.
- Question selection uses server/projection-safe paths, not public asset dumps.
- No per-player exposure data, PlayerQuestionExposure rows, or
  PlayerQuestionDailyExposure rows belong in public assets.
- Question Analytics remains a private/admin email-body report, not a public PDF or public asset.
- Per-player analytics must be anonymized with User0001-style labels when shown
  in admin reports.
- No email, provider UID, raw guest_id, owner_key, internal player_key, tokens,
  or other PII/internal IDs may appear in public question assets.

## Media Rules

- Optional media should use WebP, lowercase hyphenated filenames, and
  mobile-friendly file sizes.
- Missing media must fall back gracefully without broken image paths.
- Media must not obscure question text or hurt drag/drop performance.
- Do not use hotlinked images, remote placeholder URLs, or generated mockup
  leftovers for production gameplay.

## Security

- No secrets, tokens, auth headers, private keys, admin emails,
  `VAPID_PRIVATE_KEY`, GuestProfile tokens/hashes, service-role details, answer
  keys, debug exports, or analytics dumps may live here.
