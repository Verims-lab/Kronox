# Kronox Category Assets

Optional static category images may live here. This folder is not the active category source of truth and must not be used as a runtime fallback list.

## Current Contract

- Current category source of truth is the DB/current canonical taxonomy.
- Runtime category metadata must come from current active `Category` rows or
  `getCategoryMetadata`.
- `getCategoryMetadata` returns metadata only: category_id, name, description,
  and status.
- Guest users can load categories without login.
- Category preferences are Solo-only soft weighting when enough active valid
  preferences exist.
- Online is separate, does not use Solo preferences, and its category list is
  sorted by category_id ASC.
- No questions, answers, years, full question bank, admin-only fields, user data,
  or analytics data belong in category assets.

## Stale Fallback Guard

- Do not reintroduce stale hardcoded category fallback arrays.
- Forbidden stale fallback examples: Chronicle, Flashback, Viral, Arena,
  Level Up.
- Those names may appear only as explicit historical/forbidden examples or when
  the current source of truth truly contains matching active rows.

## Asset Rules

- Prefer WebP, square images, lowercase hyphenated filenames, and small
  mobile-friendly files.
- Missing images must fall back to the current UI/icon treatment without broken
  image paths.

## Security

- No secrets, tokens, auth headers, private keys, admin emails, internal IDs,
  `VAPID_PRIVATE_KEY`, GuestProfile tokens/hashes, service-role details, or
  private category-management notes may live in public category assets.
