# Kronox Category Taxonomy

Status: Package 2 canonical category contract.

## Canonical Field

The internal DB/runtime category ID field is:

```text
category_id
```

External import files may use the alias `categoryid`. That alias must be normalized at the import boundary only:

```text
categoryid -> category_id
```

Do not create competing live DB fields. `Question.main_category_id`, `Question.second_category_id`, and `Question.third_category_id` reference `Category.category_id`.

## Seed Categories

| category_id | name |
| ---: | --- |
| 1 | Chronicle |
| 2 | Flashback |
| 3 | Kült |
| 4 | Viral |
| 5 | Arena |
| 6 | Level Up |

Seed path:

```text
POST /seedQuestionCategories
```

The seed function is admin-only and repeatable. It creates missing rows, updates missing names/descriptions, and does not delete rows.

## Status

`Category.status` controls visibility and gameplay eligibility:

- `a`: active
- `p`: passive

Current product rule:

- Online category UI shows active categories only.
- Solo question decks use active categories only.
- Online start uses active selected categories only.
- Passive category data is preserved but not used in playable decks.

Rows with missing status may be treated as active only as a backward-compatible seed/backfill fallback. Seeded rows should carry explicit `status: "a"`.

## Description

`Category.description` is optional display/help text for future category UI and admin tooling. It is not used for gameplay scoring.

## Import Boundary

CSV/import tooling should normalize:

- `categoryid` -> `category_id`
- category names -> fixed IDs only through the table above
- invalid category IDs -> import validation error

Runtime should read only the canonical `category_id` field.
