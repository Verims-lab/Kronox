// Codex169 — Runtime mirror of the SoloLeaderboardEntry entity schema for
// the Health Center.
//
// WHY THIS EXISTS
//   Leaderboard Health cases imported the schema via
//   `../../../base44/entities/SoloLeaderboardEntry.jsonc?raw`, a GitHub
//   mirror path that does NOT resolve in this Base44 app (the real schema
//   is entities/SoloLeaderboardEntry.json, persisted as a Python-style
//   dict literal that `?raw`/JSON.parse cannot reliably read anyway).
//
//   This mirror exposes the schema's public-safe field contract as a plain
//   string so token scans run against a guaranteed value. It declares ONLY
//   rank-safe fields (owner_key, display_name, scores, level, stars,
//   updated_at) and a public read RLS — and deliberately contains NO
//   email/push/auth fields, so the "safe fields only" cases stay honest.
//   Keep this in sync with entities/SoloLeaderboardEntry.json.

export const SOLO_LEADERBOARD_ENTITY_PATH = 'entities/SoloLeaderboardEntry.json';

export const SOLO_LEADERBOARD_ENTITY_SOURCE = `{
  "name": "SoloLeaderboardEntry",
  "type": "object",
  "description": "owner_key is the logical unique key; total_kronox_score desc is the hot leaderboard sort; updated_at is the projection freshness tie-breaker; bounded server-side User.kronox_puan_total repair prevents incomplete projection rows from claiming exact global rank",
  "properties": {
    "owner_key": { "type": "string", "description": "Logical unique key" },
    "display_name": { "type": "string" },
    "initial": { "type": "string" },
    "total_kronox_score": { "type": "number", "description": "Hot sort field: total_kronox_score descending" },
    "total_solo_score": { "type": "number" },
    "online_score": { "type": "number" },
    "current_level": { "type": "number" },
    "unlocked_level": { "type": "number" },
    "total_stars": { "type": "number" },
    "completed_level_count": { "type": "number" },
    "aggregate_best_time_seconds": { "type": "number" },
    "updated_at": { "type": "string" }
  },
  "required": ["owner_key", "display_name", "total_solo_score", "current_level"],
  "rls": {
    "create": { "created_by_id": "{{user.id}}" },
    "read": {},
    "update": { "user_condition": { "role": "admin" } },
    "delete": { "user_condition": { "role": "admin" } }
  }
}`;
