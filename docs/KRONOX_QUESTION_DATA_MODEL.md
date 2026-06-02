# Kronox Question Data Model Preparation

Codex155 prepares the Base44 data model for the next Kronox question dataset without changing current gameplay.

## Current Runtime Source

- Current gameplay still reads `Question.year`, `Question.category`, and `Question.type`.
- Solo and Online question selection were not changed in this preparation step.
- `Question.state` is documented for future active/passive filtering, but gameplay has not been switched to filter by `A` yet.

## Category Entity

`Category` is the stable lookup entity for future category IDs.

| category_id | name |
| ---: | --- |
| 1 | Chronicle |
| 2 | Flashback |
| 3 | Kült |
| 4 | Viral |
| 5 | Arena |
| 6 | Level Up |

The display record for category 3 is stored as `Kült` in the seed function and entity data.

## Seed Path

Use the admin-only Base44 function:

```text
POST /seedQuestionCategories
```

The function is repeatable:

- creates missing category rows,
- updates a mismatched category `name`,
- reports duplicates,
- does not delete duplicate rows or existing data.

Direct local insertion was not performed in this task because this workspace has no live Base44 database session.

## Question Future Fields

The `Question` entity now supports:

- `answer`: answer text such as `2007` or future month/year text.
- `question_numeric_id`: future numeric incremental source ID.
- `main_category_id`: future primary category ID referencing `Category.category_id`.
- `second_category_id`: optional secondary category ID.
- `third_category_id`: optional tertiary category ID.
- `sub_category`: optional free-text subcategory.
- `tag`: optional comma-separated free-text tags.
- `region`: optional geographic/cultural scope.
- `difficulty`: integer 1 to 5.
- `state`: `A` or `P`.

## Base44 `id` Note

Base44 already provides `Question.id` as the entity row identity, and current gameplay stores/compares that value. To avoid breaking existing selection, lobby state, history, and delete/update flows, the future numeric incremental dataset ID is stored as `question_numeric_id` in this transitional schema.

Do not overwrite runtime `Question.id` with imported numeric IDs until a separate gameplay migration is planned and tested.

## Not Changed In This Step

- No existing questions were deleted.
- No new question rows were imported.
- No Solo or Online question selection logic was changed.
- No category filtering logic was changed.
- No gameplay state or scoring behavior was changed.
