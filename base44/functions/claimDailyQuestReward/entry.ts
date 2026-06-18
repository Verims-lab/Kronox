/* global Deno */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const DAILY_QUEST_REWARD_SOURCE = 'daily_quest_reward';
const RELATED_ENTITY_TYPE = 'daily_quest';
const DAY_MS = 24 * 60 * 60 * 1000;

function json(payload: unknown, status = 200) {
  return Response.json(payload, { status });
}

function normalizeEmail(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function normalizeNumber(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : fallback;
}

function utcDateKey(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

function nextUtcMidnightIso(dateKey: string) {
  const start = Date.parse(`${dateKey}T00:00:00.000Z`);
  return new Date(start + DAY_MS).toISOString();
}

function buildClaimIdempotencyKey(email: string, dateKey: string, questKey: string) {
  return `daily_quest_reward:${email}:${dateKey}:${questKey}`;
}

function rowId(row: any) {
  return row?.id || row?._id || null;
}

function progressEntity(base44: any) {
  // Runtime/deployability contract: Daily Quest claim binds
  // entities.UserDailyQuestProgress. The progress row's RLS update rule is
  // owner-scoped (data.user_email == user.email) with NO admin clause, so
  // updates must run as the authenticated owner. We therefore prefer the
  // authenticated-user client (which satisfies owner RLS) and only fall back
  // to the service-role client when the auth client is unavailable. This
  // mirrors recordDailyQuestProgress, the proven working progress writer.
  const authEntity = base44?.entities ? base44.entities.UserDailyQuestProgress : null;
  const serviceEntity = base44?.asServiceRole?.entities ? base44.asServiceRole.entities.UserDailyQuestProgress : null;
  return authEntity || serviceEntity;
}

function publicProgress(row: any) {
  const targetValue = Math.max(1, normalizeNumber(row?.target_value, 1));
  const progressValue = Math.min(targetValue, normalizeNumber(row?.progress_value, 0));
  return {
    id: rowId(row),
    questKey: String(row?.quest_key || ''),
    questDate: String(row?.quest_date || ''),
    title: String(row?.title || row?.quest_key || ''),
    description: String(row?.description || ''),
    questType: String(row?.quest_type || ''),
    progressValue,
    targetValue,
    rewardDiamonds: Math.max(1, normalizeNumber(row?.reward_diamonds, 1)),
    status: String(row?.status || (progressValue >= targetValue ? 'completed' : 'active')),
    completedAt: row?.completed_at || null,
    claimedAt: row?.claimed_at || null,
  };
}


async function findProgressById(base44: any, email: string, progressId: string) {
  const entity = progressEntity(base44);
  if (!entity || !progressId) return null;
  if (typeof entity.get === 'function') {
    const row = await entity.get(progressId).catch(() => null);
    if (rowId(row) && normalizeEmail(row?.user_email) === email) return row;
  }
  if (typeof entity.filter === 'function') {
    for (const field of ['id', '_id']) {
      const rows = await entity.filter({ [field]: progressId }, '-created_at', 1).catch(() => []);
      const row = Array.isArray(rows) && rows.length ? rows[0] : null;
      if (rowId(row) && normalizeEmail(row?.user_email) === email) return row;
    }
  }
  return null;
}

async function findProgress(base44: any, email: string, body: any) {
  const progressId = String(body?.progressId || body?.progress_id || '').trim();
  if (progressId) {
    const row = await findProgressById(base44, email, progressId);
    if (rowId(row)) return row;
  }
  const questKey = String(body?.questKey || body?.quest_key || '').trim();
  const questDate = String(body?.questDate || body?.quest_date || utcDateKey()).slice(0, 10);
  if (!questKey) return null;
  const rows = await progressEntity(base44)
    .filter({ user_email: email, quest_date: questDate, quest_key: questKey }, '-created_at', 1)
    .catch(() => []);
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

function diamondTransactionEntity(base44: any) {
  // DiamondTransaction RLS create is owner-scoped
  // (created_by_id == user.id AND data.user_email == user.email) with NO admin
  // clause, so the ledger row must be created by the authenticated owner.
  // Prefer the auth client; fall back to service role only if unavailable.
  const authEntity = base44?.entities ? base44.entities.DiamondTransaction : null;
  const serviceEntity = base44?.asServiceRole?.entities ? base44.asServiceRole.entities.DiamondTransaction : null;
  return authEntity || serviceEntity;
}

async function findDiamondTransaction(base44: any, email: string, idempotencyKey: string) {
  const rows = await diamondTransactionEntity(base44)
    .filter({ user_email: email, idempotency_key: idempotencyKey }, '-created_at', 1)
    .catch(() => []);
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function createDiamondTransaction(base44: any, payload: Record<string, unknown>) {
  const email = normalizeEmail(payload.user_email);
  const idempotencyKey = String(payload.idempotency_key || '').trim();
  if (!email || !idempotencyKey) return null;
  const existing = await findDiamondTransaction(base44, email, idempotencyKey);
  if (existing) return existing;
  const created = await diamondTransactionEntity(base44).create({
    ...payload,
    user_email: email,
    idempotency_key: idempotencyKey,
  });
  const confirmed = await findDiamondTransaction(base44, email, idempotencyKey);
  return confirmed || created;
}

async function markProgressClaimed(base44: any, row: any, claimedAt: string, tx: any) {
  const id = rowId(row);
  if (!id) return row;
  if (String(row?.status || '') === 'claimed' && row?.claimed_at) return row;
  return progressEntity(base44).update(id, {
    status: 'claimed',
    claimed_at: claimedAt,
    updated_at: claimedAt,
    metadata: {
      ...(row?.metadata && typeof row.metadata === 'object' ? row.metadata : {}),
      claimTransactionId: tx?.id || null,
      claimSource: DAILY_QUEST_REWARD_SOURCE,
      noKronoxPuan: true,
      noLeaderboardImpact: true,
    },
  });
}

async function reconcileVisibleDiamondBalance(base44: any, user: any, balanceAfter: number, timestamp: string) {
  const currentBalance = normalizeNumber(user?.diamonds, 0);
  const nextBalance = Math.max(currentBalance, balanceAfter);
  if (user?.id && nextBalance !== currentBalance) {
    await base44.asServiceRole.entities.User.update(user.id, {
      diamonds: nextBalance,
      economy_updated_at: timestamp,
    }).catch(() => null);
  }
  return nextBalance;
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method !== 'POST') {
      return json({ ok: false, code: 'method_not_allowed', error: 'Bu işlem desteklenmiyor.' }, 405);
    }

    const base44 = createClientFromRequest(req);
    let user: any = null;
    try {
      user = await base44.auth.me();
    } catch {
      return json({ ok: false, code: 'unauthenticated', error: 'Günlük görev ödülü için giriş yapmalısın.' }, 401);
    }
    const email = normalizeEmail(user?.email);
    if (!email || !user?.id) {
      return json({ ok: false, code: 'unauthenticated', error: 'Günlük görev ödülü için giriş yapmalısın.' }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const progressStore = progressEntity(base44);
    if (!progressStore?.filter || !progressStore?.update) {
      return json({ ok: false, code: 'daily_quest_entities_missing', error: 'Günlük görev kayıtları hazır değil.' }, 500);
    }
    let progress = await findProgress(base44, email, body);
    if (!rowId(progress)) {
      return json({ ok: false, code: 'daily_quest_not_found', error: 'Günlük görev bulunamadı.' }, 404);
    }

    const questDate = String(progress.quest_date || '').slice(0, 10);
    const todayKey = utcDateKey();
    if (questDate !== todayKey) {
      return json({ ok: false, code: 'daily_quest_not_claimable_today', error: 'Bu görev bugün için alınamaz.' }, 409);
    }

    const targetValue = Math.max(1, normalizeNumber(progress.target_value, 1));
    const progressValue = Math.min(targetValue, normalizeNumber(progress.progress_value, 0));
    // Requirement 5 — Accept a claim whenever progress_value >= target_value.
    // The UI shows "Al" at 1/1, so we must NOT reject just because the row's
    // status field is still "active" (the progress write may have reached
    // target without persisting the status flip). Completion is finalized
    // here during claim rather than requiring the frontend to update status.
    if (progressValue < targetValue) {
      return json({ ok: false, code: 'daily_quest_not_completed', error: 'Görev henüz tamamlanmadı.' }, 409);
    }
    // Finalize completion if the row reached its target but was never flipped
    // to a completed/claimed status. Best-effort; failure here does not block
    // the grant since progressValue >= targetValue already proves completion.
    if (String(progress.status || '') === 'active' && !progress.completed_at) {
      const completionTimestamp = new Date().toISOString();
      const finalized = await progressStore.update(rowId(progress), {
        status: 'completed',
        completed_at: completionTimestamp,
        updated_at: completionTimestamp,
      }).catch(() => null);
      if (finalized && rowId(finalized)) progress = finalized;
      else {
        progress.status = 'completed';
        progress.completed_at = completionTimestamp;
      }
    }

    const rewardDiamonds = Math.max(1, normalizeNumber(progress.reward_diamonds, 1));
    const idempotencyKey = buildClaimIdempotencyKey(email, questDate, String(progress.quest_key || rowId(progress)));
    const existingTx = await findDiamondTransaction(base44, email, idempotencyKey);
    const timestamp = new Date().toISOString();
    const nextAvailableAt = nextUtcMidnightIso(todayKey);

    if (existingTx) {
      const claimedProgress = await markProgressClaimed(base44, progress, progress.claimed_at || existingTx.created_at || timestamp, existingTx);
      const latestUser = await base44.auth.me().catch(() => user);
      const diamondBalanceAfter = await reconcileVisibleDiamondBalance(
        base44,
        latestUser,
        normalizeNumber(existingTx.balance_after ?? latestUser?.diamonds),
        timestamp,
      );
      return json({
        ok: true,
        alreadyClaimed: true,
        source: DAILY_QUEST_REWARD_SOURCE,
        quest: publicProgress(claimedProgress),
        rewardDiamonds: normalizeNumber(existingTx.amount, rewardDiamonds),
        diamondBalanceAfter,
        questStatus: 'claimed',
        idempotencyKey,
        transactionId: existingTx.id || null,
        userPatch: {
          diamonds: diamondBalanceAfter,
          daily_quest_last_claim_at: claimedProgress.claimed_at || existingTx.created_at || timestamp,
          daily_quest_last_claim_date: questDate,
          daily_quest_next_available_at: nextAvailableAt,
        },
      });
    }

    if (String(progress.status || '') === 'claimed' || progress.claimed_at) {
      return json({ ok: false, code: 'daily_quest_already_claimed', error: 'Bu görev ödülü zaten alındı.' }, 409);
    }

    const latestUser = await base44.auth.me().catch(() => user);
    const balanceBefore = normalizeNumber(latestUser?.diamonds, 0);
    const balanceAfter = balanceBefore + rewardDiamonds;
    const claimCount = normalizeNumber(latestUser?.daily_quest_claim_count, 0) + 1;
    const userPatch = {
      diamonds: balanceAfter,
      daily_quest_last_claim_at: timestamp,
      daily_quest_last_claim_date: questDate,
      daily_quest_next_available_at: nextAvailableAt,
      daily_quest_claim_count: claimCount,
      economy_updated_at: timestamp,
    };

    // Grant the diamonds on the canonical balance source FIRST. This is the
    // visible reward and matches the proven Daily Wheel claim order.
    await base44.asServiceRole.entities.User.update(latestUser.id || user.id, userPatch);

    // Write the DiamondTransaction ledger row. Some Base44 runtimes enforce
    // RLS create rules even for service-role writes, which can deny this
    // append-only ledger. The diamonds were already granted above, so a
    // ledger denial must NOT roll back the grant or fail the claim — the
    // reward must reach the user. We record ledgerError for diagnostics
    // (same best-effort contract used by claimDailyWheelReward).
    let tx: any = null;
    let ledgerError: string | null = null;
    try {
      tx = await createDiamondTransaction(base44, {
        user_email: email,
        amount: rewardDiamonds,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        source: DAILY_QUEST_REWARD_SOURCE,
        direction: 'earn',
        related_entity_type: RELATED_ENTITY_TYPE,
        related_entity_id: rowId(progress),
        idempotency_key: idempotencyKey,
        metadata: {
          questProgressId: rowId(progress),
          questKey: progress.quest_key,
          questDate,
          questType: progress.quest_type,
          source: DAILY_QUEST_REWARD_SOURCE,
          grantsDiamondsOnly: true,
          noKronoxPuan: true,
          noLeaderboardImpact: true,
          clientRewardIgnored: true,
        },
        created_at: timestamp,
        description: 'daily_quest_reward',
      });
    } catch (error) {
      ledgerError = String(error?.message || error);
      console.error('[claimDailyQuestReward] ledger create failed (grant kept)', ledgerError);
    }

    // Mark the quest claimed only after the reward grant succeeded.
    const claimedProgress = await markProgressClaimed(base44, progress, timestamp, tx);

    return json({
      ok: true,
      alreadyClaimed: false,
      source: DAILY_QUEST_REWARD_SOURCE,
      quest: publicProgress(claimedProgress),
      rewardDiamonds,
      diamondBalanceBefore: balanceBefore,
      diamondBalanceAfter: balanceAfter,
      questStatus: 'claimed',
      idempotencyKey,
      transactionId: tx?.id || null,
      ledgerError,
      userPatch,
      grantsDiamondsOnly: true,
      noKronoxPuan: true,
      noLeaderboardImpact: true,
    });
  } catch (error) {
    console.error('[claimDailyQuestReward] failed', error?.message || error);
    return json({
      ok: false,
      code: 'daily_quest_claim_failed',
      error: 'Ödül alınamadı. Tekrar dene.',
      debugError: String(error?.message || error),
    }, 500);
  }
});
