=== KRONOX_CATEGORY_TAXONOMY.md ===

# Kronox Category Taxonomy

Status: active product contract.

---

# 1. Purpose

This document defines Kronox category taxonomy, category ID rules, status rules, and import boundary rules.

This is the canonical category source of truth.

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

* do not create competing live DB fields
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

# 3. Seed Categories

Seed categories:

| category_id | name      | Description                                              |
| ----------: | --------- | -------------------------------------------------------- |
|           1 | Chronicle | Tarihin önemli olayları ve dönemleri.                    |
|           2 | Flashback | Geçmişten hafızada kalan kültürel anlar.                 |
|           3 | Kült      | Kültleşmiş filmler, diziler, müzikler ve popüler kültür. |
|           4 | Viral     | İnternette yayılan viral olaylar ve dijital kültür.      |
|           5 | Arena     | Spor, rekabet ve unutulmaz karşılaşmalar.                |
|           6 | Level Up  | Oyun dünyası, teknoloji ve gelişim anları.               |

Seed path:

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

* Online category UI shows active categories only.
* Solo question decks use active categories only.
* Online start uses active selected categories only.
* Passive category data is preserved but not used in playable decks.
* Missing status may be treated as active only for backward-compatible seed/backfill.
* Seeded rows should carry explicit `status: "a"`.

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
* category ID maps to a seeded/known category
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
