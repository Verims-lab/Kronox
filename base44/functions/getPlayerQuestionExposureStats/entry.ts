/* global Deno */
import { createClientFromRequest } from "npm:@base44/sdk@0.8.34";

const MAX_STATS_LIMIT = 2500;
const VALID_MODES = new Set(["solo", "tutorial", "online"]);

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

function normalizeMode(value: unknown) {
  const mode = String(value || "solo").trim().toLowerCase();
  return VALID_MODES.has(mode) ? mode : "solo";
}

function normalizeLimit(value: unknown) {
  const limit = Math.trunc(Number(value) || 1000);
  return Math.max(1, Math.min(MAX_STATS_LIMIT, limit));
}

function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
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
    // Public guest reads are allowed only with guest_id + guest_token proof.
  }

  return verifyGuestPlayer(base44, body);
}

function publicStat(row: any) {
  return {
    question_id: String(row?.question_id || "").trim(),
    questionId: String(row?.question_id || "").trim(),
    category_id: Number.isFinite(Number(row?.category_id)) ? Number(row.category_id) : null,
    mode: normalizeMode(row?.mode),
    shown_count: Math.max(0, Math.trunc(Number(row?.shown_count) || 0)),
    shownCount: Math.max(0, Math.trunc(Number(row?.shown_count) || 0)),
    first_shown_at: row?.first_shown_at || null,
    last_shown_at: row?.last_shown_at || null,
    lastShownAt: row?.last_shown_at || null,
    last_role: row?.last_role || "",
    source: "PlayerQuestionExposure",
  };
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return json({ ok: false, error: "method_not_allowed" }, 405);
  }

  const base44 = createClientFromRequest(req);
  const body = await readBody(req);
  const mode = normalizeMode(body?.mode);
  const limit = normalizeLimit(body?.limit);
  const player = await resolvePlayer(base44, body);
  if (!player?.playerKey) {
    return json({
      ok: false,
      error: "player_identity_required",
      contract: {
        guestRequiresToken: true,
        playerKeyReturned: false,
      },
    }, 401);
  }

  const entity = serviceEntity(base44, "PlayerQuestionExposure");
  if (!entity?.filter) {
    return json({
      ok: true,
      rows: [],
      stats: [],
      warning: "PlayerQuestionExposure entity unavailable",
      contract: {
        table: "PlayerQuestionExposure",
        playerKeyReturned: false,
      },
    });
  }

  const rows = await entity
    .filter({ player_key: player.playerKey, mode, status: "active" }, "-last_shown_at", limit)
    .catch(() => []);
  const stats = (Array.isArray(rows) ? rows : [])
    .map(publicStat)
    .filter((row) => row.question_id);

  return json({
    ok: true,
    mode,
    count: stats.length,
    stats,
    rows: stats,
    contract: {
      table: "PlayerQuestionExposure",
      uniqueKey: "player_key + question_id + mode",
      playerKeyReturned: false,
      guestRequiresToken: true,
    },
  });
});
