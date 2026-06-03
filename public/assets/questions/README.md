# Kronox Question Card Media Assets

This directory is reserved for optional static image assets that may be used by Kronox question cards in the future.

Current Kronox core gameplay does not require question images.

---

## Current Status

Question card media is optional.

The current Kronox question data model does not use these legacy fields as primary stored `Question` fields:

* `media_url`
* `year`
* `category`
* `type`
* `icon_url`

Canonical question model is documented in:

```text
docs/KRONOX_QUESTION_DATA_MODEL.md
```

Current gameplay must work without question images.

If a question image is missing, the card must use the normal Kronox fallback visual treatment and must not show a broken image path.

---

## File Organization

Store optional question card images here with descriptive lowercase filenames.

Example:

```text
/public/assets/questions/
  walt-disney-sirketi-kurulus.webp
  msn-messenger.webp
  gangnam-style.webp
  nokia-3310.webp
```

---

## Recommended Specs

* Preferred format: WebP
* PNG/JPG may be used only if WebP is unavailable
* Recommended aspect ratio: 16:9
* Recommended minimum resolution: 640×360px
* Target file size: under 200KB where possible
* Naming: lowercase, hyphen-separated, descriptive
* Avoid remote image URLs for production gameplay cards

---

## Future Media Support

If question-card media becomes active again, do not reintroduce legacy schema fields casually.

Do not add these legacy fields back to `Question` without a product/data-model decision:

* `media_url`
* `year`
* `category`
* `type`
* `icon_url`

Preferred future approach:

* keep the canonical `Question` schema clean
* add a dedicated optional media field only after product approval
* or use a separate `QuestionMedia` mapping if richer media support is needed
* ensure normal gameplay projection remains minimal and secure

---

## Runtime Requirements

If media support is enabled later:

* missing images must fall back gracefully
* broken image paths must not appear in UI
* images must be mobile/PWA friendly
* images must not hurt drag/drop performance
* images must not obscure question text
* images must follow the Kronox premium fantasy mobile game direction

---

## Important Rules

This folder is for static assets only.

Do not use:

* runtime image generation
* external hotlinked images
* Unsplash placeholders
* remote placeholder URLs
* broken production paths

No current gameplay flow should depend on this folder unless media support is explicitly reintroduced.
