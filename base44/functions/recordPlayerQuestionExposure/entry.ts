/* global Deno */
import { createClientFromRequest } from "npm:@base44/sdk@0.8.25";

const VALID_MODES = new Set(["solo", "tutorial", "online"]);
const VALID_ROLES = new Set(["anchor", "playable", "replacement", "tutorial", "unknown"]);
const MAX_EVENT_KEYS_PER_ROW = 60;

function json(payload: unknown, status = 200) {
  return Response.json(payload, { status });
}

async function readBody(req: Request) {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function normalizeMode(value: unknown) {
  const mode = String(value || "solo").trim().toLowerCase();
  return VALID_MODES.has(mode) ? mode : "solo";
}

function normalizeRole(value: unknown) {
  const role = String(value || "unknown").trim().toLowerCase();
  return VALID_ROLES.has(role) ? role : "unknown";
}

function normalizeQuestionId(value: unknown) {
  return String(value || "").trim().slice(0, 120);
}

function normalizeCategoryId(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.trunc(number) : null;
}

function nowIso() {
  return new Date().toISOString();
}

function dateBucket(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return nowIso().slice(0, 10);
  return date.toISOString().slice(0, 10);
}

function fnvOwnerKey(prefix: "u" | "g", value: unknown) {
  const text = String(value || "").trim().toLowerCase();
  if (!text) return "";
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `${prefix}_${(hash >>> 0).toString(36)}`;
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function sha256Base64Url(input: string) {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return bytesToBase64Url(new Uint8Array(digest));
}

async function hashGuestToken(guestId: string, guestToken: string) {
  return sha256Base64Url(`kronox_guest_v1:${guestId}:${guestToken}`);
}

function serviceEntity(base44: any, name: string) {
  return base44?.asServiceRole?.entities?.[name] || null;
}

async function verifyGuestPlayer(base44: any, body: any) {
  const guestId = String(body?.guest_id || "").trim();
  const guestToken = String(body?.guest_token || "").trim();
  if (!guestId || !guestToken) return null;

  const entity = serviceEntity(base44, "GuestProfile");
  if (!entity?.filter) return null;
  const rows = await entity.filter({ guest_id: guestId }, "-updated_at", 5).catch(() => []);
  const row = Array.isArray(rows) ? rows[0] : null;
  const expectedHash = String(row?.guest_token_hash || "");
  if (!row || !expectedHash) return null;

  const providedHash = await hashGuestToken(guestId, guestToken);
  if (providedHash !== expectedHash) return null;
  return {
    playerKey: String(row?.owner_key || fnvOwnerKey("g", guestId)).trim(),
    playerType: "guest",
  };
}

async function resolvePlayer(base44: any, body: any) {
  try {
    const user = await base44.auth.me();
    const email = normalizeEmail(user?.email || user?.user_email);
    if (email) {
      return {
        playerKey: String(user?.owner_key || fnvOwnerKey("u", email)).trim(),
        playerType: "registered",
      };
    }
  } catch {
    // Guests are verified below with app-owned guest credentials.
  }

  return verifyGuestPlayer(base44, body);
}

function readEventKeys(row: any) {
  const values = Array.isArray(row?.metadata?.event_keys) ? row.metadata.event_keys : [];
  return values.map((value: unknown) => String(value || "").trim()).filter(Boolean);
}

function appendEventKey(row: any, eventKey: string) {
  const keys = readEventKeys(row);
  if (eventKey && !keys.includes(eventKey)) keys.push(eventKey);
  return keys.slice(-MAX_EVENT_KEYS_PER_ROW);
}

async function findOne(entity: any, filters: Record<string, unknown>, sort = "-updated_at") {
  if (!entity?.filter) return null;
  const rows = await entity.filter(filters, sort, 5).catch(() => []);
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function upsertExposureRow(entity: any, payload: any) {
  const existing = await findOne(entity, { exposure_key: payload.exposure_key });
  const eventKey = String(payload.last_event_key || "").trim();
  if (existing?.id && eventKey && readEventKeys(existing).includes(eventKey)) {
    return { row: existing, duplicate: true };
  }

  const currentCount = Math.max(0, Math.trunc(Number(existing?.shown_count) || 0));
  const mergedMetadata = {
    ...(existing?.metadata && typeof existing.metadata === "object" ? existing.metadata : {}),
    actualShownOnly: true,
    bufferedQuestionsCounted: false,
    event_keys: appendEventKey(existing, eventKey),
  };

  if (existing?.id) {
    const updated = await entity.update(existing.id, {
      ...payload,
      first_shown_at: existing.first_shown_at || payload.first_shown_at,
      shown_count: currentCount + 1,
      metadata: mergedMetadata,
    });
    return { row: updated, duplicate: false };
  }

  const created = await entity.create({
    ...payload,
    shown_count: 1,
    metadata: {
      actualShownOnly: true,
      bufferedQuestionsCounted: false,
      event_keys: eventKey ? [eventKey] : [],
    },
  });
  return { row: created, duplicate: false };
}

async function upsertDailyRow(entity: any, payload: any, duplicate: boolean) {
  const existing = await findOne(entity, { daily_exposure_key: payload.daily_exposure_key });
  const currentCount = Math.max(0, Math.trunc(Number(existing?.shown_count) || 0));
  if (existing?.id) {
    if (duplicate) return existing;
    return entity.update(existing.id, {
      ...payload,
      first_shown_at: existing.first_shown_at || payload.first_shown_at,
      shown_count: currentCount + 1,
      metadata: {
        ...(existing?.metadata && typeof existing.metadata === "object" ? existing.metadata : {}),
        actualShownOnly: true,
        bufferedQuestionsCounted: false,
      },
    });
  }
  if (duplicate) return null;
  return entity.create({
    ...payload,
    shown_count: 1,
    metadata: {
      actualShownOnly: true,
      bufferedQuestionsCounted: false,
    },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return json({ ok: false, error: "method_not_allowed" }, 405);
  }

  const base44 = createClientFromRequest(req);
  const body = await readBody(req);
  const player = await resolvePlayer(base44, body);
  if (!player?.playerKey) {
    return json({
      ok: false,
      error: "player_identity_required",
      contract: {
        guestRequiresToken: true,
        rawGuestTokenStoredServerSide: false,
      },
    }, 401);
  }

  const questionId = normalizeQuestionId(body?.question_id ?? body?.questionId);
  if (!questionId) {
    return json({ ok: false, error: "question_id_required" }, 400);
  }

  const mode = normalizeMode(body?.mode);
  const role = normalizeRole(body?.role ?? body?.last_role);
  const shownAt = String(body?.shown_at || body?.shownAt || nowIso());
  const dateUtc = dateBucket(shownAt);
  const categoryId = normalizeCategoryId(body?.category_id ?? body?.categoryId ?? body?.main_category_id);
  const attemptId = String(body?.attempt_id || body?.attemptId || "").trim().slice(0, 160);
  const shownSequence = Math.max(0, Math.trunc(Number(body?.shown_sequence ?? body?.placement_index) || 0));
  const eventKey = String(
    body?.event_key ||
    body?.event_id ||
    ["player_question_exposure", mode, attemptId, questionId, role, shownSequence].filter(Boolean).join(":"),
  ).trim().slice(0, 260);

  const exposureEntity = serviceEntity(base44, "PlayerQuestionExposure");
  const dailyEntity = serviceEntity(base44, "PlayerQuestionDailyExposure");
  if (!exposureEntity?.filter || !exposureEntity?.create || !exposureEntity?.update || !dailyEntity?.filter || !dailyEntity?.create || !dailyEntity?.update) {
    return json({
      ok: false,
      error: "player_question_exposure_entity_unavailable",
      contract: {
        requiredEntities: ["PlayerQuestionExposure", "PlayerQuestionDailyExposure"],
      },
    }, 500);
  }

  const exposureKey = `player_question_exposure:${player.playerKey}:${mode}:${questionId}`;
  const dailyExposureKey = `player_question_daily_exposure:${dateUtc}:${player.playerKey}:${mode}:${questionId}`;
  const basePayload = {
    player_key: player.playerKey,
    player_type: player.playerType,
    question_id: questionId,
    category_id: categoryId,
    mode,
    first_shown_at: shownAt,
    last_shown_at: shownAt,
    last_attempt_id: attemptId,
    last_role: role,
    last_source: String(body?.source || "").trim().slice(0, 80),
    last_event_key: eventKey,
    last_shown_sequence: shownSequence,
    status: "active",
    created_at: shownAt,
    updated_at: nowIso(),
  };

  const exposureResult = await upsertExposureRow(exposureEntity, {
    ...basePayload,
    exposure_key: exposureKey,
  });
  await upsertDailyRow(dailyEntity, {
    daily_exposure_key: dailyExposureKey,
    date_utc: dateUtc,
    ...basePayload,
  }, exposureResult.duplicate);

  return json({
    ok: true,
    duplicate: exposureResult.duplicate,
    recorded: !exposureResult.duplicate,
    mode,
    role,
    contract: {
      entity: "PlayerQuestionExposure",
      dailyEntity: "PlayerQuestionDailyExposure",
      uniqueKey: "player_key + question_id + mode",
      dailyUniqueKey: "date_utc + player_key + question_id + mode",
      actualShownOnly: true,
      bufferedQuestionsCounted: false,
      playerKeyReturned: false,
      rawGuestTokenStoredServerSide: false,
    },
  });
});
