import React, { useMemo, useState } from 'react';
import { Bug, Copy, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { buildSoloAttemptDeck, getSoloDeckDiagnostics } from '@/lib/soloQuestionEngine';
import { getSoloAttemptDeckSizeForLevel } from '@/lib/soloLevels';
import { getCacheInfo } from '@/lib/questionCache';

const FUNCTION_NAME = 'diagnoseSoloQuestionStartQuery';
const TARGET_CATEGORY_IDS = Object.freeze([6, 7, 8, 9, 11]);

function unwrapFunctionResponse(response) {
  if (response?.data?.data && typeof response.data.data === 'object') return response.data.data;
  if (response?.data && typeof response.data === 'object') return response.data;
  if (response && typeof response === 'object') return response;
  return {};
}

function errorMessageFromBody(body, fallback) {
  const code = String(body?.code || body?.error || '').trim();
  if (code === 'Admin access required') return 'Admin yetkisi gerekli.';
  if (code === 'Authentication required') return 'Oturum doğrulaması gerekli.';
  if (code) return `${fallback} (${code})`;
  return fallback;
}

function missingFunctionMessage(name) {
  return `${name} fonksiyonu bulunamadı veya deploy edilmemiş. Function name/path kontrol edilmeli.`;
}

function isNotFoundError(error) {
  const status = Number(error?.status || error?.response?.status || error?.statusCode);
  const message = String(error?.message || '').toLowerCase();
  return status === 404 || message.includes('status code 404') || message.includes('not found');
}

async function callAdminFunction(name, payload) {
  try {
    const response = await base44.functions.invoke(name, payload);
    const body = unwrapFunctionResponse(response);
    if (body?.ok === false) throw new Error(errorMessageFromBody(body, 'İşlem başarısız oldu.'));
    return body;
  } catch (invokeError) {
    try {
      const response = await base44.functions.fetch(`/${name}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => ({}));
      if (response.status === 404) throw new Error(missingFunctionMessage(name));
      if (response.status === 403) throw new Error('Admin yetkisi gerekli.');
      if (response.status === 401) throw new Error('Oturum doğrulaması gerekli.');
      if (!response.ok || body?.ok === false) {
        throw new Error(errorMessageFromBody(body, invokeError?.message || 'İşlem başarısız oldu.'));
      }
      return body;
    } catch (fetchError) {
      if (isNotFoundError(fetchError) || isNotFoundError(invokeError)) {
        throw new Error(missingFunctionMessage(name));
      }
      throw fetchError;
    }
  }
}

function normalizeCategoryId(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  const id = Math.trunc(numeric);
  return id > 0 ? String(id) : null;
}

function categoryKey(question) {
  return normalizeCategoryId(
    question?.main_category_id
      ?? question?.mainCategoryId
      ?? question?.category_id
      ?? question?.categoryId,
  ) || 'unknown';
}

function countByCategory(rows = []) {
  return (rows || []).reduce((acc, row) => {
    const key = categoryKey(row);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function difficultiesByCategory(rows = []) {
  return (rows || []).reduce((acc, row) => {
    const key = categoryKey(row);
    const difficulty = String(row?.difficulty ?? row?.Difficulty ?? 'unknown');
    if (!acc[key]) acc[key] = {};
    acc[key][difficulty] = (acc[key][difficulty] || 0) + 1;
    return acc;
  }, {});
}

function makeSeededRandom(seedText = 'solo-query-diagnostic') {
  let state = 2166136261;
  for (let index = 0; index < seedText.length; index += 1) {
    state ^= seedText.charCodeAt(index);
    state = Math.imul(state, 16777619);
  }
  return () => {
    state = (Math.imul(state >>> 0, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function hasCategory(distribution = {}, categoryId) {
  return Number(distribution?.[String(categoryId)] || 0) > 0;
}

function enrichUserWithDryRun(user, payload) {
  const levelNumber = Math.max(1, Math.trunc(Number(payload?.diagnosticInput?.levelNumber) || 1));
  const yearStart = Number.isFinite(Number(payload?.diagnosticInput?.yearStart)) ? Number(payload.diagnosticInput.yearStart) : 0;
  const yearEnd = Number.isFinite(Number(payload?.diagnosticInput?.yearEnd)) ? Number(payload.diagnosticInput.yearEnd) : new Date().getFullYear();
  const runtimeQuestions = Array.isArray(payload?.runtimeQuestions) ? payload.runtimeQuestions : [];
  const candidatePool = runtimeQuestions
    .filter((question) => question?.type === 'metin')
    .filter((question) => Number(question?.year) >= yearStart && Number(question?.year) <= yearEnd);
  const activeValidSelectedCategoryIds = Array.isArray(user?.activeValidSelectedCategoryIds)
    ? user.activeValidSelectedCategoryIds
    : [];
  const preferenceEnabled = activeValidSelectedCategoryIds.length >= 3;
  const random = makeSeededRandom(`${user?.userEmail || user?.userEmailMasked || 'user'}:${levelNumber}`);
  const result = buildSoloAttemptDeck({
    pool: candidatePool,
    allowedMainCategoryIds: payload?.activeCategoryIds || [],
    userSelectedCategoryIds: activeValidSelectedCategoryIds,
    userCategoryPreferenceAvailable: preferenceEnabled,
    userCategoryPreferenceFallbackReason: preferenceEnabled ? null : 'diagnostic_insufficient_or_missing_preferences',
    levelNumber,
    deckSize: getSoloAttemptDeckSizeForLevel(levelNumber),
    seedCount: 2,
    requireActiveCategoryWhitelist: true,
    random,
  });
  const deck = result?.ok ? result.deck : [];
  const deckCounts = countByCategory(deck);
  const deckDifficultyCounts = difficultiesByCategory(deck);
  const deckIds = deck.map((question) => question?.id).filter((id) => id !== undefined && id !== null);
  const categoryProof = { ...(user?.categoryProof || {}) };

  for (const id of TARGET_CATEGORY_IDS) {
    const existing = categoryProof[String(id)] || {};
    const presentInDryRunDeck = hasCategory(deckCounts, id);
    categoryProof[String(id)] = {
      ...existing,
      presentInDryRunDeck,
      removalReason: presentInDryRunDeck
        ? 'not_removed_selected_in_frontend_buildSoloAttemptDeck_dry_run'
        : (existing.removalReason === 'not_removed_before_deck_build'
          ? 'available_before_deck_build_but_not_selected_by_dry_run_hard_rules_or_soft_balance'
          : existing.removalReason),
    };
  }

  return {
    ...user,
    frontendDryRunUsesActualRuntimeDeckBuilder: true,
    finalDryRunDeckOk: Boolean(result?.ok),
    finalDryRunDeckFailureReason: result?.ok ? null : (result?.reason || 'unknown'),
    finalDryRunDeckFailureMessage: result?.ok ? null : (result?.message || ''),
    finalDryRunDeckCount: deck.length,
    finalDryRunDeckCountsByCategory: deckCounts,
    finalDryRunDeckQuestionIds: deckIds,
    finalDryRunDeckYears: deck.map((question) => question?.year).filter((year) => year !== undefined && year !== null),
    finalDryRunDeckDifficultiesByCategory: deckDifficultyCounts,
    finalDryRunDeckMeta: result?.meta || null,
    finalDryRunDeckDiagnostics: result?.ok ? getSoloDeckDiagnostics(result, { levelNumber }) : null,
    categoryProof,
  };
}

function buildCopyableDiagnostic(payload) {
  if (!payload?.ok) return null;
  const adminBrowserCacheInfo = getCacheInfo();
  const users = (Array.isArray(payload.users) ? payload.users : [])
    .map((user) => enrichUserWithDryRun(user, payload));
  const categoriesWithWarnings = users.flatMap((user) => (
    TARGET_CATEGORY_IDS
      .filter((id) => user?.categoryProof?.[String(id)]?.presentInGlobalLane === false
        || user?.categoryProof?.[String(id)]?.presentInGlobalDifficulty1 === false)
      .map((id) => ({
        userEmailMasked: user.userEmailMasked,
        categoryId: id,
        proof: user.categoryProof[String(id)],
      }))
  ));
  return {
    ...payload,
    adminBrowserCacheInfo,
    cacheDescriptor: {
      ...(payload.cacheDescriptor || {}),
      adminBrowserCacheInfo,
      cacheHit: Boolean(adminBrowserCacheInfo),
      cacheAgeMinutes: adminBrowserCacheInfo?.ageMinutes ?? null,
      staleCacheRejected: adminBrowserCacheInfo ? adminBrowserCacheInfo.isStale === true : null,
    },
    users,
    summary: {
      inspectedUserCount: users.length,
      ownerIncluded: users.some((user) => user.isOwnerRequestedAccount),
      preferenceUsersIncluded: payload.preferenceUsersIncluded,
      targetCategoryIds: TARGET_CATEGORY_IDS,
      warnings: categoriesWithWarnings,
      categories611AbsentBeforeDeckBuild: categoriesWithWarnings.length > 0,
      actualRuntimeDeckBuilderUsedForDryRun: true,
    },
  };
}

export default function SoloQuestionStartDiagnosticsTool() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [diagnostic, setDiagnostic] = useState(null);
  const [copied, setCopied] = useState(false);

  const diagnosticText = useMemo(
    () => (diagnostic ? JSON.stringify(diagnostic, null, 2) : ''),
    [diagnostic],
  );
  const warningCount = diagnostic?.summary?.warnings?.length || 0;

  const runDiagnostic = async () => {
    if (loading) return;
    setLoading(true);
    setError('');
    setCopied(false);
    try {
      const body = await callAdminFunction(FUNCTION_NAME, { levelNumber: 1 });
      setDiagnostic(buildCopyableDiagnostic(body));
    } catch (err) {
      setDiagnostic(null);
      setError(err?.message || 'Solo query diagnostiği çalıştırılamadı.');
    } finally {
      setLoading(false);
    }
  };

  const copyDiagnostic = async () => {
    if (!diagnosticText) return;
    try {
      await navigator.clipboard.writeText(diagnosticText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="rounded-2xl border border-cyan-300/25 bg-cyan-400/5 p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-cyan-300/25 bg-cyan-300/10 text-cyan-100">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bug className="h-4 w-4" />}
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <p className="font-inter text-sm font-semibold text-foreground">Solo Soru Motoru Query Diagnostiği</p>
            <p className="font-inter text-xs leading-relaxed text-muted-foreground">
              Owner ve 10 tercih kullanıcısı için gerçek getQuestions/Question query snapshot’ını ve frontend buildSoloAttemptDeck dry-run sonucunu üretir.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={loading}
              onClick={runDiagnostic}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {loading ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
              Query Diagnostiği Çalıştır
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!diagnosticText}
              onClick={copyDiagnostic}
              className="border-cyan-300/30 bg-cyan-300/10 text-cyan-50 hover:bg-cyan-300/15"
            >
              <Copy className="mr-2 h-3.5 w-3.5" />
              {copied ? 'Kopyalandı' : 'JSON Kopyala'}
            </Button>
          </div>
          {warningCount > 0 && (
            <p className="rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 font-inter text-xs font-semibold text-red-100">
              Kategori 6/7/8/9/11 için {warningCount} aday havuzu uyarısı var. JSON çıktısını inceleyin.
            </p>
          )}
          {diagnostic && warningCount === 0 && (
            <p className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 font-inter text-xs font-semibold text-emerald-100">
              Query snapshot’ında hedef kategoriler global ve difficulty-1 aday havuzlarında görünüyor; dry-run deck sonuçları JSON’a eklendi.
            </p>
          )}
          {error && (
            <p className="rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 font-inter text-xs font-semibold text-red-100">
              {error}
            </p>
          )}
          {diagnosticText && (
            <textarea
              readOnly
              value={diagnosticText}
              className="h-72 w-full resize-y rounded-xl border border-cyan-200/15 bg-slate-950/60 p-3 font-mono text-[11px] leading-5 text-cyan-50 outline-none"
              spellCheck={false}
              aria-label="Solo query diagnostic JSON"
            />
          )}
        </div>
      </div>
    </div>
  );
}
