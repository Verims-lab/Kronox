=== KRONOX_CATEGORY_TAXONOMY.md ===

# Kronox Category Taxonomy

Status: active product contract.

---

# 1. Purpose

This document defines Kronox category taxonomy, category ID rules, status rules, and import boundary rules.

The live `Category` entity / current safe category metadata projection is the
canonical category source of truth for runtime category selection.

Question schema details are defined in:

```text
KRONOX_QUESTION_DATA_MODEL.md
```

---

# 2. Canonical Field

The internal DB/runtime category ID field is:

```text
category_id
```

External import files may use the alias:

```text
categoryid
```

Import tooling must normalize:

```text
categoryid -> category_id
```

Rules:

* Do not create competing live DB fields
* runtime should read only `category_id`
* imports may accept `categoryid` only as an external alias
* invalid category IDs must fail validation

Question category references:

```text
Question.main_category_id
Question.second_category_id
Question.third_category_id
```

These reference:

```text
Category.category_id
```

---

# 3. Current Category Source And Legacy Seeds

Runtime category selection source of truth is the live `Category` data exposed
through safe category metadata reads. First-time guest onboarding must load
current `Category` metadata directly or through `getCategoryMetadata`; it must
not render a stale hardcoded category array when the live read is empty or
unavailable.

`getCategoryMetadata` is public by design for guest onboarding and returns only
non-sensitive metadata from current active `Category` rows:
`category_id`, `name`, `description`, and `status`. It must not expose question
rows, answers, years, full-bank data, user data, admin/internal fields, passive
or deleted categories, or any stale hardcoded fallback array. Guest category
preference saving is a separate token-proven `GuestProfile` write.

The following original seed names are retained only as historical seed-helper
reference. They are not a UI fallback and must not appear in onboarding unless
matching active rows truly exist in the current category source of truth:

| category_id | name      | Description                                              |
| ----------: | --------- | -------------------------------------------------------- |
|           1 | Chronicle | Tarihin önemli olayları ve dönemleri.                    |
|           2 | Flashback | Geçmişten hafızada kalan kültürel anlar.                 |
|           3 | Kült      | Kültleşmiş filmler, diziler, müzikler ve popüler kültür. |
|           4 | Viral     | İnternette yayılan viral olaylar ve dijital kültür.      |
|           5 | Arena     | Spor, rekabet ve unutulmaz karşılaşmalar.                |
|           6 | Level Up  | Oyun dünyası, teknoloji ve gelişim anları.               |

Legacy seed path:

```text
POST /seedQuestionCategories
```

Seed function rules:

* admin-only
* repeatable
* creates missing rows
* updates missing names/descriptions
* backfills missing status
* does not delete rows
* does not break question/category relationships
* does not create duplicates intentionally

---

# 4. Status

`Category.status` controls visibility and gameplay eligibility.

Status values:

```text
a = active
p = passive
```

Rules:

* Online category UI shows active categories only from current metadata.
* Online `selected_category_ids` stores live `Category.category_id` values.
* Solo question decks use active categories only.
* Online start uses active selected categories only.
* Online start is server-authoritative through `startLobbyGame`: it persists a
  bounded shared `online_question_deck` on `Lobby`, chosen 100% from the
  selected active categories and difficulty 1/2 questions only. Online must not
  hydrate questions from Solo user preferences, Solo 70/30 weighting, or guest
  Solo question mode.
* Missing/invalid Online selected categories or failed Category metadata reads
  must clean-fail with a retryable/user-safe error or empty state; runtime must
  not substitute legacy category names or old seeded category IDs.
* Passive category data is preserved but not used in playable decks.
* Missing status may be treated as active only for backward-compatible seed/backfill.
* Seeded rows should carry explicit `status: "a"`.

Category preferences are optional personalization, not a gameplay gate:

* authenticated users with no saved `UserCategoryPreference` rows use all active categories
* authenticated users with empty or fewer than 3 active valid preferences use all active categories
* missing authentication uses the explicit capped `guest_gameplay_runtime`
  Solo projection and must not expose raw questions
* raw `Question.list` gameplay fallback is not allowed
* saved preferences become a soft Solo 70/30 weighting input only when at least
  3 active valid preferences exist
* selected-category preference lane uses difficulty 1 and 2; the all-active
  global fallback lane prefers difficulty 1 and broadens safely if short
* Settings save validation may still require 3 selections, but that validation
  must remain separate from Solo question loading
* guided guest onboarding recommends at least 3 category selections after the
  first Solo level, but fewer selections or skip must not block Ana Sayfa; an
  empty guest category list means all active categories remain eligible
* empty preferences must not produce an empty question pool or
  offline/no-cache error
* `Game.jsx` filters saved preferences through
  `getValidActiveSelectedCategoryIds(preferences, activeCategories)` before
  passing them to the Solo deck builder
* Online category selection remains separate and unaffected
* `/getQuestions` must derive its runtime active category whitelist from
  active `Category` rows, not from an obsolete hardcoded seed ID subset
* runtime active-category checks accept the live status aliases currently seen
  in DB/report code: blank/missing, `a`, `active`, and `aktif`; passive rows
  remain excluded
* first-time guest onboarding category selection can load safe category
  metadata without login through current `Category` rows or the
  `getCategoryMetadata` callable; it must not read `Question` rows or expose the
  question bank
* stale hardcoded category fallbacks are forbidden for onboarding category
  selection; if the current category source cannot be loaded, the UI must show a
  visible retry/error state instead of rendering legacy seed names
* stale hardcoded category fallbacks are also forbidden for Online category
  selection and `/getQuestions`; Category read failure must not manufacture
  seeded IDs
* a category with active rows and Solo-eligible questions must not be excluded
  merely because its ID was added after the original six seed categories
* `category_id` normalization accepts any positive live DB category id; seed
  IDs are not a maximum boundary
* `Question.main_category_id`, `second_category_id`, and `third_category_id`
  must not declare an enum capped to the original 1-6 seed set; they reference
  any positive live `Category.category_id`

---

# 5. Description

`Category.description` is optional display/help text.

Uses:

* future category UI
* admin tooling
* tooltips/explanations
* import review
* content management

Rules:

* description is not used for scoring
* description is not a gameplay filter
* description may be empty for non-seeded future categories, but seeded categories should have non-empty descriptions

---

# 6. Category Scope

## 1. Chronicle

Scope:

* history
* historic events
* inventions
* political/social milestones
* world events
* important dated moments

## 2. Flashback

Scope:

* nostalgic cultural moments
* past everyday culture
* memorable older trends
* retro media/culture moments

## 3. Kült

Scope:

* film
* TV series
* music
* pop culture

Important rule:

```text
Games should not be included in Kült.
```

Games belong under `Level Up` unless product later changes this rule.

## 4. Viral

Scope:

* internet culture
* memes
* viral moments
* social media events
* digital culture milestones

## 5. Arena

Scope:

* sports
* competition
* tournaments
* matches
* athletes
* major sporting moments

## 6. Level Up

Scope:

* games
* gaming culture
* technology
* digital platforms
* major product/platform launches
* development/progress moments

---

# 7. Import Boundary

CSV/import tooling should normalize:

```text
categoryid -> category_id
```

Import validation should check:

* category ID exists
* category ID is numeric
* category ID maps to a positive live `Category.category_id`
* `main_category_id` is valid
* secondary/tertiary category IDs are valid if present
* invalid category IDs fail validation
* category name mismatch does not silently create a new category
* external aliases do not become live DB fields

---

# 8. Runtime Rules

Runtime should use:

```text
category_id
```

Playable question selection should respect:

```text
Category.status === "a"
Question.state === "A"
```

Online UI:

* show active categories only
* sort active categories by `category_id` ascending
* preserve selected category IDs for online game start

Solo deck:

* use active categories only
* exclude passive category questions
* pass or derive active category whitelist before deck creation

Online start:

* use selected active categories
* do not silently fall back to all categories if selected categories have no questions
* return clean content error if selected active categories cannot produce enough playable questions

---

# 9. Health Coverage Expectations

Health should cover:

```text
category_entity_declares_status_field
category_entity_declares_description_field
category_seed_rows_all_active
category_seed_rows_have_description
category_seed_backfills_missing_status_and_description
online_categories_active_only
online_categories_sorted_by_category_id
solo_deck_uses_active_categories_only
online_start_uses_active_selected_categories_only
categoryid_alias_normalized_at_import_boundary
no_competing_live_categoryid_field
```

Rules:

* do not fake PASS
* do not only test UI
* runtime question selection paths must also respect category status

---

# 10. Do Not Change Without Product Decision

Do not change without explicit product decision:

* seeded category IDs
* seeded category names
* `category_id` canonical DB/runtime field
* `categoryid` as import-only alias
* Kült excluding games
* passive categories being excluded from playable decks
* active category sort by category ID
