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

function publicProgress(row: any) {
  const targetValue = Math.max(1, normalizeNumber(row?.target_value, 1));
  const progressValue = Math.min(targetValue, normalizeNumber(row?.progress_value, 0));
  return {
    id: row?.id || null,
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

async function findProgress(base44: any, email: string, body: any) {
  const progressId = String(body?.progressId || body?.progress_id || '').trim();
  if (progressId) {
    const row = await base44.asServiceRole.entities.UserDailyQuestProgress.get(progressId).catch(() => null);
    return normalizeEmail(row?.user_email) === email ? row : null;
  }
  const questKey = String(body?.questKey || body?.quest_key || '').trim();
  const questDate = String(body?.questDate || body?.quest_date || utcDateKey()).slice(0, 10);
  if (!questKey) return null;
  const rows = await base44.asServiceRole.entities.UserDailyQuestProgress
    .filter({ user_email: email, quest_date: questDate, quest_key: questKey }, '-created_at', 1)
    .catch(() => []);
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function findDiamondTransaction(base44: any, email: string, idempotencyKey: string) {
  const rows = await base44.asServiceRole.entities.DiamondTransaction
    .filter({ user_email: email, idempotency_key: idempotencyKey }, '-created_at', 1)
    .catch(() => []);
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function createDiamondTransaction(base44: any, payload: Record<string, unknown>) {
  const existing = await findDiamondTransaction(base44, String(payload.user_email || ''), String(payload.idempotency_key || ''));
  if (existing) return existing;
  return base44.asServiceRole.entities.DiamondTransaction.create(payload);
}

async function markProgressClaimed(base44: any, row: any, claimedAt: string, tx: any) {
  if (!row?.id) return row;
  if (String(row?.status || '') === 'claimed' && row?.claimed_at) return row;
  return base44.asServiceRole.entities.UserDailyQuestProgress.update(row.id, {
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
    const progress = await findProgress(base44, email, body);
    if (!progress?.id) {
      return json({ ok: false, code: 'daily_quest_not_found', error: 'Günlük görev bulunamadı.' }, 404);
    }

    const questDate = String(progress.quest_date || '').slice(0, 10);
    const todayKey = utcDateKey();
    if (questDate !== todayKey) {
      return json({ ok: false, code: 'daily_quest_not_claimable_today', error: 'Bu görev bugün için alınamaz.' }, 409);
    }

    const targetValue = Math.max(1, normalizeNumber(progress.target_value, 1));
    const progressValue = Math.min(targetValue, normalizeNumber(progress.progress_value, 0));
    if (progressValue < targetValue || String(progress.status || '') === 'active') {
      return json({ ok: false, code: 'daily_quest_not_completed', error: 'Görev henüz tamamlanmadı.' }, 409);
    }

    const rewardDiamonds = Math.max(1, normalizeNumber(progress.reward_diamonds, 1));
    const idempotencyKey = buildClaimIdempotencyKey(email, questDate, String(progress.quest_key || progress.id));
    const existingTx = await findDiamondTransaction(base44, email, idempotencyKey);
    const timestamp = new Date().toISOString();
    const nextAvailableAt = nextUtcMidnightIso(todayKey);

    if (existingTx) {
      const claimedProgress = await markProgressClaimed(base44, progress, progress.claimed_at || existingTx.created_at || timestamp, existingTx);
      const latestUser = await base44.auth.me().catch(() => user);
      return json({
        ok: true,
        alreadyClaimed: true,
        source: DAILY_QUEST_REWARD_SOURCE,
        quest: publicProgress(claimedProgress),
        rewardDiamonds: normalizeNumber(existingTx.amount, rewardDiamonds),
        diamondBalanceAfter: normalizeNumber(existingTx.balance_after ?? latestUser?.diamonds),
        idempotencyKey,
        transactionId: existingTx.id || null,
        userPatch: {
          diamonds: normalizeNumber(existingTx.balance_after ?? latestUser?.diamonds),
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

    await base44.asServiceRole.entities.User.update(latestUser.id || user.id, userPatch);

    let tx: any = null;
    try {
      tx = await createDiamondTransaction(base44, {
        user_email: email,
        amount: rewardDiamonds,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        source: DAILY_QUEST_REWARD_SOURCE,
        direction: 'earn',
        related_entity_type: RELATED_ENTITY_TYPE,
        related_entity_id: progress.id,
        idempotency_key: idempotencyKey,
        metadata: {
          questProgressId: progress.id,
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
      await base44.asServiceRole.entities.User.update(latestUser.id || user.id, {
        diamonds: balanceBefore,
        economy_updated_at: timestamp,
      }).catch(() => null);
      console.error('[claimDailyQuestReward] ledger create failed', error?.message || error);
      return json({ ok: false, code: 'daily_quest_ledger_failed', error: 'Görev ödülü kaydedilemedi. Lütfen tekrar dene.' }, 500);
    }

    const claimedProgress = await markProgressClaimed(base44, progress, timestamp, tx);

    return json({
      ok: true,
      alreadyClaimed: false,
      source: DAILY_QUEST_REWARD_SOURCE,
      quest: publicProgress(claimedProgress),
      rewardDiamonds,
      diamondBalanceBefore: balanceBefore,
      diamondBalanceAfter: balanceAfter,
      idempotencyKey,
      transactionId: tx?.id || null,
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
      error: 'Günlük görev ödülü alınamadı. Lütfen tekrar dene.',
    }, 500);
  }
});
