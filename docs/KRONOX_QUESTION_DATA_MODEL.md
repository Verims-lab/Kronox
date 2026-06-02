# Kronox Question Data Model Preparation

Codex156 prepares the Base44 data model for the next Kronox question dataset without importing questions or changing gameplay rules.

## Current Runtime Source

- Current gameplay code still operates on runtime `year`, `category`, and `type` compatibility values.
- Those fields are no longer stored on the `Question` entity. They are supplied by the authenticated `getQuestions` fetch layer as minimal compatibility values.
- `year` is derived from `answer` by extracting the first 3- or 4-digit year, so answers like `2007` and `Ocak 2007` remain timeline-compatible.
- `category` defaults to `genel` and `type` defaults to `metin` until gameplay/category filtering is intentionally migrated.
- `Question.state === "A"` is required for playable rows returned to normal gameplay.
- Direct `Question` entity reads are admin-only. Normal gameplay must use `getQuestions` and must not call `Question.list` directly.

## Category Entity

`Category` is the stable lookup entity for future category IDs.

Canonical DB/runtime field: `category_id`.

External import files may use `categoryid`, but import tooling must normalize
that alias to `category_id` before writing rows. Do not create a second live
DB field.

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

## Question Fields

The `Question` entity keeps only the intended new dataset fields:

- `id`: unique incremental numeric question ID from the imported dataset.
- `question`: text shown on screen.
- `answer`: answer text such as `2007` or future month/year text.
- `main_category_id`: primary category ID referencing `Category.category_id`.
- `second_category_id`: optional secondary category ID.
- `third_category_id`: optional tertiary category ID.
- `sub_category`: optional free-text subcategory.
- `tag`: optional comma-separated free-text tags.
- `region`: optional geographic/cultural scope.
- `difficulty`: integer 1 to 5.
- `state`: `A` or `P`.

Removed legacy schema fields:

- `year`
- `category`
- `type`
- `media_url`
- `icon_url`
- `question_numeric_id`

## Runtime Compatibility Note

Current gameplay still compares timeline years using `question.year` and card `year`. The compatibility layer is:

- client: `src/lib/questionRuntimeAdapter.js`
- backend function: `base44/functions/getQuestions/entry.ts`

Do not remove the compatibility layer until Timeline/gameplay is intentionally migrated to read `answer` directly.

Security boundary:

- `getQuestions` requires an authenticated user.
- It returns only active playable rows and minimal runtime fields.
- It includes active category IDs so Solo can pass `allowedMainCategoryIds` into the deck engine.
- Raw question-bank metadata such as tags/subcategories/regions remains outside normal gameplay responses.

## Not Changed In This Step

- No existing questions were deleted.
- No new question rows were imported.
- No Solo or Online question selection rules were changed.
- No category filtering rules were changed.
- No gameplay state or scoring behavior was changed.
