# Kronox Question Data Model

## Purpose

This document defines the Kronox question data model and runtime compatibility rules.

Question content must support:

* Solo gameplay
* Online gameplay
* active/passive lifecycle
* category taxonomy
* future imports
* timeline year compatibility
* security-safe gameplay projection

---

# 1. Runtime Source

Normal gameplay must load questions through authenticated backend access.

Expected function:

```text
POST /getQuestions
```

Rules:

* normal gameplay must not call `Question.list` directly
* unauthenticated access must not expose the question bank
* normal authenticated users receive only minimal playable projection
* `Question.state === "A"` is required for playable rows
* passive categories must be excluded from playable decks
* backend reads should be scoped by active category/status instead of
  reading a newest-row slice and filtering everything in memory
* when the active pool is larger than the gameplay projection cap,
  `/getQuestions` must sample before capping with pool-proportional fairness:
  category/subcategory shares should roughly follow the active eligible pool,
  not equal-count category balancing and not DB/order/newest-row slicing
* `/getQuestions` admin/Health diagnostics should expose the safe funnel:
  fetched active rows, normalized eligible rows, returned runtime projection,
  category/subcategory/year-band distributions, projection limit, and seed
* raw/admin metadata must not be returned to normal gameplay

---

# 2. Question Entity Fields

The `Question` entity keeps the intended new dataset fields:

```text
id
question
answer
main_category_id
second_category_id
third_category_id
sub_category
tag
region
difficulty
state
```

## Field Definitions

| Field                | Description                                                  |
| -------------------- | ------------------------------------------------------------ |
| `id`                 | unique incremental numeric question ID from imported dataset |
| `question`           | text shown on screen                                         |
| `answer`             | answer text, usually year or month/year text                 |
| `main_category_id`   | primary category ID referencing `Category.category_id`       |
| `second_category_id` | optional secondary category ID                               |
| `third_category_id`  | optional tertiary category ID                                |
| `sub_category`       | optional free-text subcategory                               |
| `tag`                | optional comma-separated free-text tags                      |
| `region`             | optional geographic/cultural scope                           |
| `difficulty`         | integer 1 to 5                                               |
| `state`              | `A` active/playable, `P` passive/not playable                |

---

# 3. Removed Legacy Fields

The following legacy fields should not be stored on the `Question` entity as primary data:

```text
year
category
type
media_url
icon_url
question_numeric_id
```

Runtime compatibility may still provide derived values where old gameplay code expects them.

---

# 4. Runtime Compatibility

Current gameplay may still compare timeline years using:

```text
question.year
card.year
```

Compatibility layer:

```text
src/lib/questionRuntimeAdapter.js
base44/functions/getQuestions/entry.ts
```

The compatibility layer derives runtime `year` from:

```text
Question.answer
```

Examples:

```text
2007 -> 2007
Ocak 2007 -> 2007
```

Rules:

* do not remove runtime `year` compatibility until gameplay is intentionally migrated
* do not re-add stored legacy `year` field without product/data decision
* invalid, missing, null, non-numeric, or approximate year values must be excluded from playable timeline decks
* runtime projection should include only minimal fields needed for gameplay
* runtime projection may include `sub_category` and `tag` only as gameplay-balance metadata, not as public full-bank exposure
* private `QuestionAttemptEvent` analytics may store question id, answer year,
  category, subcategory, and tag metadata for admin reports; those rows remain
  private/admin-only and are not a public question-bank projection
* admin question analytics reports must label all-active question pool,
  Solo-eligible pool, runtime projection diagnostics, unique shown questions,
  and never-shown counts separately when those metrics are available
* top-question/category/subcategory concentration flags are guardrails, not
  equal-count category requirements; they must be interpreted against the
  Solo-eligible/runtime pool proportions

---

# 5. State

Question state values:

```text
A = active/playable
P = passive/not playable
```

Rules:

* normal gameplay uses only `state === "A"`
* passive questions are preserved but not playable
* admin tooling may see passive rows if authorized
* imports should validate state

---

# 6. Category Reference

Category rules are defined in:

```text
docs/KRONOX_CATEGORY_TAXONOMY.md
```

Canonical internal category field:

```text
category_id
```

Question category references:

```text
main_category_id
second_category_id
third_category_id
```

These reference:

```text
Category.category_id
```

External import files may use:

```text
categoryid
```

Import tooling must normalize:

```text
categoryid -> category_id
```

Do not create a second live DB field for `categoryid`.

---

# 7. SubCategory Lookup Preparation

`SubCategory` exists as a future normalized lookup table.

Fields:

```text
id
main_category_1
main_category_2
name
status
description
```

Rules:

* `id` is the stable numeric SubCategory ID.
* `main_category_1` stores the primary `Category.category_id` reference.
* `main_category_2` optionally stores a secondary `Category.category_id`
  reference.
* `status` supports `A` active and `P` passive.
* `Question` currently still uses the existing free-text `sub_category` field.
* Do not add `sub_category_id` or migrate Question rows until a later explicit
  mapping task.

---

# 8. User Category Preferences

Users can select active main `Category` interests under Settings.

Preference storage:

```text
UserCategoryPreference
```

Fields:

```text
id
user_id
category_id
status
created_date
updated_date
```

Rules:

* Preferences are stored per authenticated user.
* `category_id` stores the stable `Category.category_id` value.
* Settings shows active `Category.status = A/a` options and hides passive
  `Category.status = P/p` rows.
* Minimum selection count is 3.
* There is no maximum selection count.
* Preferences do not yet affect question selection.
* A future task may apply preferences as soft weighting, not hard filtering.
* First-time onboarding preference selection is not implemented yet; Settings
  is the only preference UI in this phase.
* `SubCategory` still exists for future normalized question metadata, but
  Settings preference selection currently uses main `Category`, not
  `SubCategory`.
* Existing `UserSubCategoryPreference` rows, if any, are left untouched until a
  later migration decision.

---

# 9. Difficulty

Difficulty is an integer:

```text
1
2
3
4
5
```

Current phase:

* easy questions may use `difficulty = 1`
* future Solo question engine may use difficulty for level progression
* future Online may use difficulty for match balance

Rules:

* difficulty must be present for imported questions
* invalid difficulty should fail import validation
* current gameplay must not silently assume all missing difficulty is valid

---

# 10. Subcategory / Tag / Region

These fields support future content control.

## sub_category

Used for human-readable subcategory classification.

Examples:

```text
film
TV series
music
pop culture
football
basketball
technology
gaming
```

## tag

Comma-separated free-text tags.

Examples:

```text
world cup, football, sports
internet, viral, meme
music, pop, 2000s
```

## region

Optional geographic/cultural scope.

Examples:

```text
global
turkey
europe
usa
```

Rules:

* these fields are not required for current gameplay
* normal gameplay projection should not expose unnecessary metadata
* future admin/import tooling may use them
* future Solo deck design may use them for category/subcategory balance

---

# 9. Gameplay Projection

Normal gameplay projection should include only minimal runtime fields.

Expected playable projection may include:

```text
id
question
answer
year
main_category_id
category
type
difficulty
state
```

Rules:

* include compatibility fields only if gameplay needs them
* do not expose raw full-bank metadata unnecessarily
* do not expose passive/unpublished rows
* do not expose admin-only fields
* enforce auth before returning gameplay data
* when capping the protected gameplay projection, use deterministic
  pool-proportional sampling and shuffle the final projection so early DB
  order, newest rows, or early category IDs cannot dominate runtime play
* admin/Health diagnostics may expose aggregate projection counts, such as
  fetched/returned totals and category/subcategory/year-band distributions,
  but must not expose the full raw question bank

---

# 10. Import Boundary

Future import tooling should validate:

* required fields exist
* `id` is unique
* `question` is non-empty
* `answer` contains a valid timeline year where required
* `main_category_id` references an existing Category
* `second_category_id` / `third_category_id` reference existing Category if present
* `difficulty` is 1–5
* `state` is A or P
* `categoryid` alias is normalized to `category_id`
* invalid category IDs fail validation

No import should create unknown categories silently.

---

# 11. Security Boundary

Security rules:

* `getQuestions` requires authenticated user
* normal user receives minimal playable projection
* full-bank/admin access requires admin authorization
* direct `Question` entity reads should not expose full bank to public users
* client must not fall back to direct `Question.list`

If code and this document conflict, fix the code or document the known risk explicitly.

---

# 12. SEO/GEO Public Projection

Codex183 adds `QuestionPublicProjection` as the SEO/GEO-ready public-safe
content boundary.

Rules:

* raw `Question` rows remain protected gameplay/admin data
* public pages must not read the raw full question bank
* `QuestionPublicProjection` rows are opt-in and controlled by
  `public_visibility`
* public projection fields may include:
  * `question_id`
  * `canonical_slug`
  * `title`
  * `description`
  * `seo_title`
  * `seo_description`
  * `source_name`
  * `source_url`
  * `category_id`
  * `sub_category`
  * `locale`
  * `structured_data_type`
  * `structured_data_json`
* hidden/internal gameplay metadata must not be copied into public rows unless
  the product explicitly approves it
* adding public pages is separate from this schema; this document only defines
  the data boundary

---

# 13. Not In Scope

This document does not define:

* scoring rules
* Diamond economy
* Online lobby lifecycle
* drag/drop behavior
* Solo level map UI
* category visual design

Relevant docs:

```text
KRONOX_SCORING_RULES.md
KRONOX_ECONOMY_RULES.md
KRONOX_CATEGORY_TAXONOMY.md
KRONOX_SOLO_QUESTION_ENGINE.md
KRONOX_SECURITY_DEPLOYMENT.md
```
