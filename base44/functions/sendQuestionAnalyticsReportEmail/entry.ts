/* global Deno */
import { createClientFromRequest } from "npm:@base44/sdk@0.8.25";

// Settings invokes functions.invoke("sendQuestionAnalyticsReportEmail", payload).
//
// IMPORTANT (stale-deploy incident): this callable report function must NOT
// use a local shared admin-auth import. That broken runtime path can fail
// deployment and leave Base44 serving a stale build. The DB-backed AdminUser
// guard below is INLINED so this function deploys cleanly while enforcing the
// AdminUser source-of-truth contract: owner/admin role, active status, and
// rejection of unauthenticated, non-admin, or disabled callers.
const JOB_NAME = "sendQuestionAnalyticsReportEmail";
const MAX_EVENTS = 5e3;
const MAX_QUESTIONS = 5e3;
const MAX_CATEGORIES = 1e3;
const MAX_USER_CATEGORY_PREFERENCES = 1e4;
const NEVER_SHOWN_SAMPLE_LIMIT = 15;
const QUESTION_TABLE_LIMIT = 15;
const EASY_QUESTION_TABLE_LIMIT = 10;
const CATEGORY_QUESTION_SAMPLE_LIMIT = 5;
const CATEGORY_ANALYTICS_ROW_LIMIT = 50;
const REGISTERED_QUESTION_POOL_ROW_LIMIT = 250;
const CATEGORY_FAIRNESS_SIGNAL_LIMIT = 20;
const STALE_REFERENCE_SAMPLE_LIMIT = 20;
const PERIOD_OPTIONS = /* @__PURE__ */ new Set([1, 7, 30]);
const REPORT_BUILD_MARKER = "Codex293";
const REPORT_TEMPLATE_VERSION = "static-pool-v2";
const REPORT_TEMPLATE_LABEL = "Rapor Şablonu: static-pool-v2";
const DIFFICULTY_CHART_BUCKETS = [
  ["1", "Zorluk 1", "#2563eb"],
  ["2", "Zorluk 2", "#16a34a"],
  ["3", "Zorluk 3", "#eab308"],
  ["4", "Zorluk 4", "#ea580c"],
  ["5", "Zorluk 5", "#dc2626"],
  ["unknown", "Bilinmiyor", "#64748b"]
];
function json(payload, status = 200) {
  return Response.json(payload, { status });
}
function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}
async function readBody(req) {
  try {
    return await req.json();
  } catch (_error) {
    return {};
  }
}
function clampPeriodDays(value) {
  const number = Number(value);
  if (PERIOD_OPTIONS.has(number)) return number;
  return 7;
}
function eventTimestamp(event) {
  return String(event?.answered_at || event?.shown_at || event?.created_at || "");
}
function eventType(event) {
  return String(event?.event_type || (event?.answered_at ? "answered" : "shown")).trim();
}
function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}
function questionKey(value) {
  return String(value ?? "").trim();
}
function shortText(value, limit = 72) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return "(metin yok)";
  return text.length > limit ? `${text.slice(0, limit - 3)}...` : text;
}
function escapeHtml(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function displayValue(value, fallback = "Bilinmiyor") {
  const text = String(value ?? "").trim();
  return text || fallback;
}
function percent(part, total) {
  if (!total) return "0%";
  return `${Math.round(part / total * 1e3) / 10}%`;
}
function formatMs(ms) {
  if (!ms) return "-";
  return `${Math.round(ms / 100) / 10}s`;
}
function getQuestionYear(question) {
  const year = Number(question?.year ?? question?.answer_year ?? question?.answer);
  return Number.isFinite(year) ? year : null;
}
function getQuestionDifficultyBucket(question) {
  const numeric = Number(question?.difficulty ?? question?.Difficulty);
  if (Number.isInteger(numeric) && numeric >= 1 && numeric <= 5) return String(numeric);
  return "unknown";
}
function difficultyLabel(difficultyBucket) {
  return difficultyBucket === "unknown" ? "Bilinmiyor" : String(difficultyBucket || "Bilinmiyor");
}
function periodLabel(periodDays) {
  return `Son ${periodDays} Gün`;
}
function formatIstanbulTimestamp(date = /* @__PURE__ */ new Date()) {
  try {
    return new Intl.DateTimeFormat("tr-TR", {
      timeZone: "Europe/Istanbul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  } catch (_error) {
    return date.toISOString();
  }
}
function isActiveQuestion(question) {
  return String(question?.state || "A").toUpperCase() === "A";
}
function isActiveCategory(category) {
  const status = String(category?.status ?? category?.state ?? "active").trim().toLowerCase();
  return ["active", "a", "aktif"].includes(status);
}
function getCategoryId(question) {
  const raw = question?.main_category_id ?? question?.category_id ?? question?.categoryId ?? question?.categoryid ?? question?.category ?? question?.cat;
  const numeric = Number(raw);
  if (Number.isFinite(numeric) && numeric > 0) return String(Math.trunc(numeric));
  const text = String(raw ?? "").trim();
  return text || null;
}
function buildActiveCategoryIdSet(categories) {
  const ids = /* @__PURE__ */ new Set();
  for (const category of categories || []) {
    if (!isActiveCategory(category)) continue;
    const raw = category?.category_id ?? category?.id;
    const numeric = Number(raw);
    const id = Number.isFinite(numeric) && numeric > 0 ? String(Math.trunc(numeric)) : String(raw ?? "").trim();
    if (id) ids.add(id);
  }
  return ids;
}
function isSoloEligibleQuestion(question, activeCategoryIds) {
  if (!isActiveQuestion(question)) return false;
  if (getQuestionYear(question) === null) return false;
  const categoryId = getCategoryId(question);
  if (!categoryId) return false;
  if (activeCategoryIds.size > 0 && !activeCategoryIds.has(categoryId)) return false;
  return true;
}
function isActiveCategoryPreference(preference) {
  const status = String(preference?.status ?? "A").trim().toUpperCase();
  return status === "A";
}
function getPreferenceCategoryId(preference) {
  const raw = preference?.category_id ?? preference?.categoryId;
  const numeric = Number(raw);
  if (Number.isFinite(numeric) && numeric > 0) return String(Math.trunc(numeric));
  const text = String(raw ?? "").trim();
  return text || null;
}
function getPreferenceOwnerKey(preference) {
  return normalizeEmail(preference?.user_email) || String(preference?.user_id || preference?.created_by_id || preference?.created_by || "").trim();
}
function getTopShownSubcategoryConcentration(topShown) {
  const groups = /* @__PURE__ */ new Map();
  let total = 0;
  for (const bucket of topShown || []) {
    const category = String(bucket?.category_id ?? bucket?.question?.main_category_id ?? "unknown");
    const subCategory = String(bucket?.sub_category || bucket?.question?.sub_category || "unknown");
    const key = `${category} / ${subCategory}`;
    const shownCount = Number(bucket?.shown_count) || 0;
    total += shownCount;
    const current = groups.get(key) || { key, category, subCategory, shownCount: 0 };
    current.shownCount += shownCount;
    groups.set(key, current);
  }
  const top = Array.from(groups.values()).sort((a, b) => b.shownCount - a.shownCount || a.key.localeCompare(b.key))[0] || null;
  return {
    topShownSubcategory: top?.key || "Yeterli veri yok",
    topShownSubcategoryShare: top && total ? top.shownCount / total : 0,
    topShownSubcategoryCount: top?.shownCount || 0,
    topShownSubcategoryTotal: total,
    concentrationThreshold: 0.6
  };
}
function isSportsLike(values) {
  const text = values.map((value) => String(value || "").toLowerCase()).join(" ");
  return [
    "spor",
    "sport",
    "futbol",
    "football",
    "basket",
    "tenis",
    "tennis",
    "olimp",
    "olymp",
    "formula",
    "f1"
  ].some((token) => text.includes(token));
}
function getBucket(map, id, question = null) {
  if (!map.has(id)) {
    map.set(id, {
      question_id: id,
      question,
      shown_count: 0,
      correct_count: 0,
      wrong_count: 0,
      swap_count: 0,
      total_response_time_ms: 0,
      response_count: 0,
      last_shown_at: "",
      last_answered_at: ""
    });
  }
  const bucket = map.get(id);
  if (question && !bucket.question) bucket.question = question;
  return bucket;
}
function sortDesc(field) {
  return (a, b) => (Number(b?.[field]) || 0) - (Number(a?.[field]) || 0);
}
function buildCategoryMap(categories) {
  const map = /* @__PURE__ */ new Map();
  for (const category of categories || []) {
    const id = String(category?.category_id ?? category?.id ?? "").trim();
    const name = String(category?.name || (id ? `Kategori ID: ${id}` : "")).trim();
    const label = isActiveCategory(category) ? (name || `Kategori ID: ${id}`) : `${name || `Kategori ID: ${id}`} (pasif kategori)`;
    if (id) map.set(id, label);
    if (name) map.set(name, label);
  }
  return map;
}
function numericCategorySort(a, b) {
  const an = Number(a);
  const bn = Number(b);
  if (Number.isFinite(an) && Number.isFinite(bn) && an !== bn) return an - bn;
  return a.localeCompare(b, "tr");
}
function categoryLabel(categoryId, categoryMap) {
  const id = String(categoryId ?? "").trim();
  if (!id || id === "unknown") return "Unknown / unmapped";
  return categoryMap.get(id) || `Unknown / unmapped (Kategori ID: ${id})`;
}
function questionCategoryLabel(bucket, categoryMap) {
  const q = bucket?.question || {};
  return categoryLabel(getCategoryId(q) ?? bucket?.category_id, categoryMap);
}
function questionSubCategoryLabel(bucket) {
  const q = bucket?.question || {};
  return displayValue(q.sub_category || bucket?.sub_category);
}
function questionYearLabel(bucket) {
  const q = bucket?.question || {};
  return getQuestionYear(q) ?? bucket?.answer_year ?? "Yok";
}
function correctRateLabel(bucket) {
  const answered = (Number(bucket?.correct_count) || 0) + (Number(bucket?.wrong_count) || 0);
  return answered ? percent(Number(bucket?.correct_count) || 0, answered) : "Yeterli veri yok";
}
function avgResponseMs(bucket) {
  return bucket?.response_count ? Math.round(bucket.total_response_time_ms / bucket.response_count) : 0;
}
function formatQuestionBucket(bucket) {
  if (!bucket) return "Yeterli veri yok";
  const question = bucket.question || {};
  return `#${bucket.question_id} · ${shortText(question.question, 54)} · ${questionYearLabel(bucket)} · ${bucket.shown_count} gösterim · ${correctRateLabel(bucket)} doğru`;
}
function formatQuestionSample(question) {
  if (!question) return "";
  return `#${questionKey(question?.id ?? question?.question_id)} · ${shortText(question?.question, 54)} · ${getQuestionYear(question) ?? "Yıl yok"}`;
}
function barHtml(value, max, color = "#f5b301", width = 120) {
  const pct = max > 0 ? Math.max(0, Math.min(100, Math.round(value / max * 100))) : 0;
  return `<div style="width:${width}px;background:#eef2f7;border-radius:6px;height:8px;overflow:hidden;">
    <div style="width:${pct}%;background:${color};border-radius:6px;height:8px;line-height:8px;">&nbsp;</div>
  </div>`;
}
function difficultyDistributionBarHtml(difficultyCounts = {}, total = 0) {
  const safeTotal = Math.max(0, Number(total) || 0);
  if (!safeTotal) {
    return `<span style="display:inline-block;color:#64748b;font-size:11px;line-height:15px;font-family:Arial,Helvetica,sans-serif;">Veri yok</span>`;
  }
  const activeBuckets = DIFFICULTY_CHART_BUCKETS
    .map(([key, label, color]) => ({
      key,
      label,
      color,
      count: Math.max(0, Number(difficultyCounts?.[key]) || 0)
    }))
    .filter((bucket) => bucket.count > 0);
  if (!activeBuckets.length) {
    return `<span style="display:inline-block;color:#64748b;font-size:11px;line-height:15px;font-family:Arial,Helvetica,sans-serif;">Veri yok</span>`;
  }
  const cells = activeBuckets.map((bucket) => {
    const width = Math.max(4, Math.round(bucket.count / safeTotal * 160));
    return `<td width="${width}" bgcolor="${bucket.color}" title="${escapeHtml(`${bucket.label}: ${bucket.count}`)}" style="height:12px;line-height:12px;font-size:0;background-color:${bucket.color};border-right:1px solid #ffffff;">&nbsp;</td>`;
  }).join("");
  const legend = activeBuckets.map((bucket) => `<span style="display:inline-block;margin:3px 6px 0 0;color:#334155;font-size:10px;line-height:14px;font-family:Arial,Helvetica,sans-serif;"><span style="display:inline-block;width:8px;height:8px;background-color:${bucket.color};vertical-align:middle;margin-right:3px;">&nbsp;</span>${escapeHtml(bucket.key === "unknown" ? "?" : bucket.key)}:${escapeHtml(bucket.count)}</span>`).join("");
  return `<table role="presentation" cellpadding="0" cellspacing="0" width="160" style="width:160px;border-collapse:collapse;background-color:#e2e8f0;"><tr>${cells}</tr></table><div style="margin-top:2px;">${legend}</div>`;
}
function badgeHtml(label, tone) {
  const palette = {
    ok: ["#dcfce7", "#166534"],
    warn: ["#fef3c7", "#92400e"],
    risk: ["#fee2e2", "#991b1b"]
  }[tone];
  return `<span style="display:inline-block;padding:3px 8px;border-radius:999px;background:${palette[0]};color:${palette[1]};font-size:11px;font-weight:700;">${escapeHtml(label)}</span>`;
}
function sectionHtml(title, body) {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;background:#ffffff;">
      <tr>
        <td style="padding:14px 18px;background:#f8fafc;border-bottom:1px solid #e5e7eb;">
          <h2 style="margin:0;color:#0f172a;font-size:18px;line-height:24px;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(title)}</h2>
        </td>
      </tr>
      <tr><td style="padding:16px 18px;">${body}</td></tr>
    </table>`;
}
function emptyStateHtml(message) {
  return `<p style="margin:0;padding:12px 14px;background:#f8fafc;border:1px dashed #cbd5e1;border-radius:10px;color:#475569;font-size:13px;line-height:20px;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(message)}</p>`;
}
function sectionWarningHtml(message) {
  return `<p style="margin:0;padding:12px 14px;background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;color:#9a3412;font-size:13px;line-height:20px;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(message)}</p>`;
}
function safeSectionHtml(title, renderBody) {
  try {
    return sectionHtml(title, renderBody());
  } catch (error) {
    const reason = error instanceof Error ? error.message : "section_render_failed";
    console.error(`[${JOB_NAME}] section_render_failed`, title, reason);
    return sectionHtml(title, sectionWarningHtml(`${title} bölümü oluşturulamadı; raporun kalan bölümleri devam ediyor.`));
  }
}
function tableHtml(headers, rows, emptyMessage) {
  if (!rows.length) return emptyStateHtml(emptyMessage);
  const headerHtml = headers.map((header) => `<th align="left" style="padding:9px 8px;border-bottom:1px solid #dbe3ef;background:#f1f5f9;color:#334155;font-size:11px;line-height:15px;text-transform:uppercase;letter-spacing:.04em;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(header)}</th>`).join("");
  const rowsHtml = rows.map((row) => `<tr>${row.map((cell) => `<td valign="top" style="padding:9px 8px;border-bottom:1px solid #eef2f7;color:#111827;font-size:12px;line-height:17px;font-family:Arial,Helvetica,sans-serif;">${cell}</td>`).join("")}</tr>`).join("");
  return `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">${headerHtml ? `<tr>${headerHtml}</tr>` : ""}${rowsHtml}</table>`;
}
function summaryCard(label, value, helper) {
  return `<td valign="top" width="33.33%" style="padding:6px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:12px;background:#f8fafc;">
      <tr><td style="padding:12px;">
        <p style="margin:0 0 6px;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:.04em;font-weight:700;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(label)}</p>
        <p style="margin:0 0 4px;color:#0f172a;font-size:24px;line-height:30px;font-weight:800;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(value)}</p>
        <p style="margin:0;color:#64748b;font-size:12px;line-height:17px;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(helper)}</p>
      </td></tr>
    </table>
  </td>`;
}
function htmlLineList(values, emptyMessage = "Yeterli veri yok") {
  if (!values.length) return escapeHtml(emptyMessage);
  return values.map((value) => escapeHtml(value)).join("<br>");
}
function buildCategoryAnalytics({
  categories,
  questions,
  activeQuestions,
  soloEligibleQuestions,
  bucketList,
  categoryPreferences,
  categoryMap
}) {
  const totalQuestionsByCategory = /* @__PURE__ */ new Map();
  const activeQuestionsByCategory = /* @__PURE__ */ new Map();
  const soloEligibleByCategory = /* @__PURE__ */ new Map();
  const bucketsByCategory = /* @__PURE__ */ new Map();
  const selectedUsersByCategory = /* @__PURE__ */ new Map();
  const activeCategoryIds = buildActiveCategoryIdSet(categories);
  const seenActivePreferenceKeys = /* @__PURE__ */ new Set();
  const duplicateActivePreferenceKeys = /* @__PURE__ */ new Set();
  const categoryIds = /* @__PURE__ */ new Set();
  for (const category of categories || []) {
    const id = String(category?.category_id ?? category?.id ?? "").trim();
    if (id) categoryIds.add(id);
  }
  for (const question of questions || []) {
    const id = getCategoryId(question) || "unknown";
    categoryIds.add(id);
    totalQuestionsByCategory.set(id, (totalQuestionsByCategory.get(id) || 0) + 1);
  }
  for (const question of activeQuestions || []) {
    const id = getCategoryId(question) || "unknown";
    categoryIds.add(id);
    const rows = activeQuestionsByCategory.get(id) || [];
    rows.push(question);
    activeQuestionsByCategory.set(id, rows);
  }
  for (const question of soloEligibleQuestions || []) {
    const id = getCategoryId(question) || "unknown";
    categoryIds.add(id);
    const rows = soloEligibleByCategory.get(id) || [];
    rows.push(question);
    soloEligibleByCategory.set(id, rows);
  }
  for (const bucket of bucketList || []) {
    const id = getCategoryId(bucket?.question) || String(bucket?.category_id ?? "unknown").trim() || "unknown";
    categoryIds.add(id);
    const rows = bucketsByCategory.get(id) || [];
    rows.push(bucket);
    bucketsByCategory.set(id, rows);
  }
  for (const preference of categoryPreferences || []) {
    if (!isActiveCategoryPreference(preference)) continue;
    const categoryId = getPreferenceCategoryId(preference);
    const ownerKey = getPreferenceOwnerKey(preference);
    if (!categoryId || !ownerKey) continue;
    if (!activeCategoryIds.has(categoryId)) continue;
    const preferenceKey = `${ownerKey}:${categoryId}`;
    if (seenActivePreferenceKeys.has(preferenceKey)) duplicateActivePreferenceKeys.add(preferenceKey);
    seenActivePreferenceKeys.add(preferenceKey);
    categoryIds.add(categoryId);
    const users = selectedUsersByCategory.get(categoryId) || /* @__PURE__ */ new Set();
    users.add(ownerKey);
    selectedUsersByCategory.set(categoryId, users);
  }
  return Array.from(categoryIds).sort(numericCategorySort).map((categoryId) => {
    const activeRows = activeQuestionsByCategory.get(categoryId) || [];
    const soloRows = soloEligibleByCategory.get(categoryId) || [];
    const buckets = bucketsByCategory.get(categoryId) || [];
    const shownBuckets = buckets.filter((bucket) => Number(bucket?.shown_count) > 0);
    const shownQuestionIds = new Set(shownBuckets.map((bucket) => String(bucket.question_id)));
    const neverShownActive = activeRows.filter((question) => !shownQuestionIds.has(questionKey(question?.id ?? question?.question_id)));
    const neverShownSoloEligible = soloRows.filter((question) => !shownQuestionIds.has(questionKey(question?.id ?? question?.question_id)));
    const topShown = [...shownBuckets].sort(sortDesc("shown_count")).slice(0, CATEGORY_QUESTION_SAMPLE_LIMIT);
    const lowShown = [...shownBuckets].sort((a, b) => (Number(a?.shown_count) || 0) - (Number(b?.shown_count) || 0) || String(a?.question_id).localeCompare(String(b?.question_id))).slice(0, CATEGORY_QUESTION_SAMPLE_LIMIT);
    const difficultyCounts = {
      "1": 0,
      "2": 0,
      "3": 0,
      "4": 0,
      "5": 0,
      unknown: 0
    };
    const registeredDifficultyStats = /* @__PURE__ */ new Map();
    const activeYears = [];
    for (const question of activeRows) {
      const difficultyBucket = getQuestionDifficultyBucket(question);
      difficultyCounts[difficultyBucket] = (difficultyCounts[difficultyBucket] || 0) + 1;
      const difficultyStats = registeredDifficultyStats.get(difficultyBucket) || {
        difficultyLevel: difficultyLabel(difficultyBucket),
        questionCount: 0,
        oldestYear: null,
        newestYear: null
      };
      difficultyStats.questionCount += 1;
      const year = getQuestionYear(question);
      if (year !== null) {
        activeYears.push(year);
        difficultyStats.oldestYear = difficultyStats.oldestYear === null ? year : Math.min(difficultyStats.oldestYear, year);
        difficultyStats.newestYear = difficultyStats.newestYear === null ? year : Math.max(difficultyStats.newestYear, year);
      }
      registeredDifficultyStats.set(difficultyBucket, difficultyStats);
    }
    const oldestYear = activeYears.length ? Math.min(...activeYears) : null;
    const newestYear = activeYears.length ? Math.max(...activeYears) : null;
    const registeredQuestionPoolRows = [
      {
        difficultyLevel: "Toplam",
        questionCount: activeRows.length,
        oldestYear,
        newestYear
      },
      ...["1", "2", "3", "4", "5", "unknown"]
        .map((bucket) => registeredDifficultyStats.get(bucket))
        .filter((row) => row && row.questionCount > 0)
    ];
    const shownCount = shownBuckets.reduce((sum, bucket) => sum + (Number(bucket?.shown_count) || 0), 0);
    const answeredCount = buckets.reduce((sum, bucket) => sum + (Number(bucket?.correct_count) || 0) + (Number(bucket?.wrong_count) || 0), 0);
    const correctCount = buckets.reduce((sum, bucket) => sum + (Number(bucket?.correct_count) || 0), 0);
    const totalResponseMs = buckets.reduce((sum, bucket) => sum + (Number(bucket?.total_response_time_ms) || 0), 0);
    const responseCount = buckets.reduce((sum, bucket) => sum + (Number(bucket?.response_count) || 0), 0);
    return {
      categoryId,
      categoryName: categoryLabel(categoryId, categoryMap),
      totalQuestionCount: totalQuestionsByCategory.get(categoryId) || 0,
      activeQuestionCount: activeRows.length,
      difficultyCounts,
      oldestYear,
      newestYear,
      registeredQuestionPoolRows,
      soloEligibleQuestionCount: soloRows.length,
      selectedUserCount: selectedUsersByCategory.get(categoryId)?.size || 0,
      shownCount,
      answeredCount,
      uniqueShownQuestionCount: shownBuckets.length,
      neverShownActiveCount: neverShownActive.length,
      neverShownSoloEligibleCount: neverShownSoloEligible.length,
      correctRate: answeredCount ? correctCount / answeredCount : null,
      avgResponseTimeMs: responseCount ? Math.round(totalResponseMs / responseCount) : 0,
      topShown,
      lowShown,
      neverShownSample: neverShownActive.slice(0, CATEGORY_QUESTION_SAMPLE_LIMIT),
      duplicateActivePreferenceCount: duplicateActivePreferenceKeys.size
    };
  });
}
function buildCategoryFairnessSignals(categoryAnalytics, totalShownEvents) {
  const signals = [];
  for (const row of categoryAnalytics || []) {
    if (row.activeQuestionCount >= 5 && row.shownCount === 0) {
      signals.push({
        tone: "Dikkat",
        categoryId: row.categoryId,
        categoryName: row.categoryName,
        value: `${row.activeQuestionCount} aktif soru / 0 gösterim`,
        note: "Kategori havuzda var ama bu dönemde gösterim almamış."
      });
    }
    if (row.selectedUserCount > 0 && row.shownCount === 0) {
      signals.push({
        tone: "Dikkat",
        categoryId: row.categoryId,
        categoryName: row.categoryName,
        value: `${row.selectedUserCount} tercih eden kullanıcı / 0 gösterim`,
        note: "Tercih edilen kategori bu dönemde hiç gösterim almamış."
      });
    }
    if (row.activeQuestionCount >= 5 && row.neverShownActiveCount >= Math.max(5, Math.ceil(row.activeQuestionCount * 0.5))) {
      signals.push({
        tone: "Sinyal",
        categoryId: row.categoryId,
        categoryName: row.categoryName,
        value: `${row.neverShownActiveCount}/${row.activeQuestionCount} hiç gösterilmeyen aktif soru`,
        note: "Kategori içinde geniş bir bölüm bu dönemde hiç dolaşıma girmemiş."
      });
    }
    const topShown = row.topShown?.[0]?.shown_count || 0;
    if (row.shownCount >= 5 && topShown / Math.max(1, row.shownCount) >= 0.5) {
      signals.push({
        tone: "Sinyal",
        categoryId: row.categoryId,
        categoryName: row.categoryName,
        value: `${percent(topShown, row.shownCount)} tek soru payı`,
        note: "Kategori gösterimi birkaç soruda yoğunlaşmış olabilir."
      });
    }
    if (row.activeQuestionCount >= 10 && totalShownEvents > 0 && row.shownCount / totalShownEvents < 0.02) {
      signals.push({
        tone: "Sinyal",
        categoryId: row.categoryId,
        categoryName: row.categoryName,
        value: `${percent(row.shownCount, totalShownEvents)} gösterim payı`,
        note: "Aktif soru sayısı olan kategori düşük gösterim payı almış."
      });
    }
  }
  return signals.slice(0, CATEGORY_FAIRNESS_SIGNAL_LIMIT);
}
function buildReport({
  periodDays,
  events,
  questions,
  categories,
  categoryPreferences,
  buildMarker
}) {
  const categoryMap = buildCategoryMap(categories);
  const activeCategoryIds = buildActiveCategoryIdSet(categories);
  const questionById = /* @__PURE__ */ new Map();
  const activeQuestions = [];
  for (const question of questions) {
    const id = questionKey(question?.id ?? question?.question_id);
    if (!id) continue;
    questionById.set(id, question);
    if (isActiveQuestion(question)) activeQuestions.push(question);
  }
  const soloEligibleQuestions = activeQuestions.filter((question) => isSoloEligibleQuestion(question, activeCategoryIds));
  const buckets = /* @__PURE__ */ new Map();
  const missing = {
    question_id: 0,
    deleted_or_missing_question: 0,
    answer_year: 0,
    sub_category_or_tags: 0,
    outcome: 0
  };
  const questionsMissingMetadata = activeQuestions.filter((question) => !question?.sub_category || !question?.tag).length;
  let shownEvents = 0;
  let answeredEvents = 0;
  let sportsShown = 0;
  const uniqueAttempts = /* @__PURE__ */ new Set();
  const staleQuestionIds = /* @__PURE__ */ new Set();
  for (const event of events) {
    const qid = questionKey(event?.question_id);
    if (!qid) {
      missing.question_id += 1;
      continue;
    }
    if (event?.attempt_id) uniqueAttempts.add(String(event.attempt_id));
    const q = questionById.get(qid) || null;
    if (!q) {
      missing.deleted_or_missing_question += 1;
      if (staleQuestionIds.size < STALE_REFERENCE_SAMPLE_LIMIT) staleQuestionIds.add(qid);
      continue;
    }
    const bucket = getBucket(buckets, qid, q);
    const type = eventType(event);
    const isShown = type === "shown" || type === "replacement_shown";
    const isAnswered = type === "answered";
    const isSwap = type === "swapped_out" || event?.was_swapped_out === true;
    const eventCategoryId = getCategoryId({
      main_category_id: event?.category_id,
      category_id: event?.category_id,
      category: event?.category,
      cat: event?.cat
    });
    const categoryId = getCategoryId(q) || eventCategoryId || "unknown";
    const subCategory = event?.sub_category || q?.sub_category || "unknown";
    const tag = event?.tags || q?.tag || "";
    const answerYear = safeNumber(event?.answer_year ?? getQuestionYear(q), NaN);
    bucket.category_id = categoryId;
    bucket.sub_category = subCategory;
    bucket.answer_year = Number.isFinite(answerYear) ? answerYear : bucket.answer_year;
    if (!Number.isFinite(answerYear)) missing.answer_year += 1;
    if (!subCategory || subCategory === "unknown" || !tag) missing.sub_category_or_tags += 1;
    if (isAnswered && event?.is_correct !== true && event?.is_correct !== false) missing.outcome += 1;
    if (isShown) {
      shownEvents += 1;
      bucket.shown_count += 1;
      const shownAt = String(event?.shown_at || event?.created_at || "");
      if (shownAt && shownAt > bucket.last_shown_at) bucket.last_shown_at = shownAt;
      if (isSportsLike([subCategory, tag, categoryId, q?.category])) sportsShown += 1;
    }
    if (isAnswered) {
      answeredEvents += 1;
      const answeredAt = String(event?.answered_at || "");
      if (answeredAt && answeredAt > bucket.last_answered_at) bucket.last_answered_at = answeredAt;
      if (event?.is_correct === true) bucket.correct_count += 1;
      if (event?.is_correct === false) bucket.wrong_count += 1;
      const responseMs = Math.max(0, Math.floor(safeNumber(event?.response_time_ms)));
      if (responseMs > 0) {
        bucket.total_response_time_ms += responseMs;
        bucket.response_count += 1;
      }
    }
    if (isSwap) bucket.swap_count += 1;
  }
  const bucketList = [...buckets.values()];
  const shownQuestionIds = new Set(bucketList.filter((bucket) => bucket.shown_count > 0).map((bucket) => bucket.question_id));
  const neverShown = activeQuestions.filter((question) => !shownQuestionIds.has(questionKey(question?.id ?? question?.question_id)));
  const neverShownSoloEligible = soloEligibleQuestions.filter((question) => !shownQuestionIds.has(questionKey(question?.id ?? question?.question_id)));
  const topShown = [...bucketList].sort(sortDesc("shown_count")).slice(0, QUESTION_TABLE_LIMIT);
  const topShownMax = Math.max(1, ...topShown.map((bucket) => Number(bucket.shown_count) || 0));
  const mostWrong = [...bucketList].filter((bucket) => bucket.shown_count >= 3 && bucket.wrong_count > 0).sort(sortDesc("wrong_count")).slice(0, QUESTION_TABLE_LIMIT);
  const easy = [...bucketList].filter((bucket) => bucket.shown_count >= 3 && bucket.correct_count + bucket.wrong_count >= 3).sort((a, b) => {
    const ar = a.correct_count / Math.max(1, a.correct_count + a.wrong_count);
    const br = b.correct_count / Math.max(1, b.correct_count + b.wrong_count);
    return br - ar;
  }).slice(0, EASY_QUESTION_TABLE_LIMIT);
  const slow = [...bucketList].filter((bucket) => bucket.response_count > 0).sort((a, b) => b.total_response_time_ms / b.response_count - a.total_response_time_ms / a.response_count).slice(0, QUESTION_TABLE_LIMIT);
  const categoryAnalytics = buildCategoryAnalytics({
    categories,
    questions,
    activeQuestions,
    soloEligibleQuestions,
    bucketList,
    categoryPreferences,
    categoryMap
  });
  const categoryAnalyticsForReport = categoryAnalytics.slice(0, CATEGORY_ANALYTICS_ROW_LIMIT);
  const categoryFairnessSignals = buildCategoryFairnessSignals(categoryAnalytics, shownEvents);
  const totalCorrect = bucketList.reduce((sum, bucket) => sum + (Number(bucket.correct_count) || 0), 0);
  const totalWrong = bucketList.reduce((sum, bucket) => sum + (Number(bucket.wrong_count) || 0), 0);
  const answeredTotal = totalCorrect + totalWrong;
  const avgCorrectRate = answeredTotal ? percent(totalCorrect, answeredTotal) : "Yeterli veri yok";
  const totalResponseMs = bucketList.reduce((sum, bucket) => sum + (Number(bucket.total_response_time_ms) || 0), 0);
  const totalResponseCount = bucketList.reduce((sum, bucket) => sum + (Number(bucket.response_count) || 0), 0);
  const avgResponse = totalResponseCount ? formatMs(Math.round(totalResponseMs / totalResponseCount)) : "Yeterli veri yok";
  const averageShowCount = shownQuestionIds.size ? Math.round(shownEvents / shownQuestionIds.size * 10) / 10 : 0;
  const generatedAt = formatIstanbulTimestamp();
  const period = periodLabel(periodDays);
  const topShownShare = topShown[0]?.shown_count && shownEvents ? topShown[0].shown_count / shownEvents : 0;
  const topSubcategoryConcentration = getTopShownSubcategoryConcentration(topShown);
  const sportsShare = shownEvents ? sportsShown / shownEvents : 0;
  const insightRows = [];
  if (shownEvents === 0) {
    insightRows.push(["OK", "ok", "Bu dönem için yeterli oynanış verisi yok. Birkaç Solo oyun oynandıktan sonra raporu yeniden oluşturun."]);
  } else {
    insightRows.push(["OK", "ok", `${shownEvents} gösterim ve ${answeredEvents} cevap event'i analiz edildi.`]);
  }
  if (neverShown.length > 0) {
    insightRows.push(["Dikkat", "warn", `${neverShown.length} aktif soru bu dönemde hiç gösterilmedi.`]);
  }
  if (missing.deleted_or_missing_question > 0) {
    insightRows.push(["Dikkat", "warn", `Bazı eski analiz kayıtları artık mevcut olmayan sorulara referans verdiği için rapora dahil edilmedi. Etkilenen event sayısı: ${missing.deleted_or_missing_question}.`]);
  }
  if (topShownShare >= 0.15) {
    insightRows.push(["Risk", "risk", `En çok gösterilen soru dönem gösterimlerinin ${percent(topShown[0].shown_count, shownEvents)} kadarını oluşturuyor.`]);
  }
  if (topSubcategoryConcentration.topShownSubcategoryShare >= topSubcategoryConcentration.concentrationThreshold) {
    insightRows.push(["Dikkat", "warn", `En çok gösterilenler listesinde ${topSubcategoryConcentration.topShownSubcategory} grubu ${percent(topSubcategoryConcentration.topShownSubcategoryCount, topSubcategoryConcentration.topShownSubcategoryTotal)} paya ulaştı. Bu pool-proportional değildir diye otomatik varsayılmaz; dağılım Solo-eligible havuzla karşılaştırılmalıdır.`]);
  }
  if (sportsShare >= 0.35) {
    insightRows.push(["Dikkat", "warn", `Spor benzeri içeriklerin payı ${percent(sportsShown, shownEvents)}.`]);
  }
  if (activeQuestions.length > 0) {
    insightRows.push(["OK", "ok", `Aktif soru havuzu tüm aktif Question satırlarıdır; Solo-eligible havuz bu raporda ${soloEligibleQuestions.length} olarak ayrıca gösterilir. Runtime projection boyutu getQuestions diagnostics ile ölçülür.`]);
  }
  if (questionsMissingMetadata > 0 || missing.answer_year > 0 || missing.sub_category_or_tags > 0) {
    insightRows.push(["Dikkat", "warn", "Bazı soru/event satırlarında yıl, kategori, alt kategori veya tag metadata eksik."]);
  }
  if (categoryAnalytics.some((row) => row.selectedUserCount > 0)) {
    insightRows.push(["OK", "ok", "Kategori tercih dağılımı aktif UserCategoryPreference satırlarından benzersiz kullanıcı sayısı olarak rapora eklendi."]);
  }
  const summaryCards = [
    summaryCard("Toplam gösterim", shownEvents, "Bu dönemde oyuncuya gösterilen soru sayısı"),
    summaryCard("Cevaplanan soru", answeredEvents, "Yerleştirme sonucu olan event sayısı"),
    summaryCard("Benzersiz gösterilen soru", shownQuestionIds.size, "En az bir kez gösterilen farklı soru"),
    summaryCard("Aktif soru havuzu (tüm aktifler)", activeQuestions.length, "Rapor anında aktif görünen tüm soru satırları"),
    summaryCard("Solo-eligible soru", soloEligibleQuestions.length, "Aktif, yıl ve aktif kategori bilgisi kullanılabilir sorular"),
    summaryCard("Hiç gösterilmeyen aktif soru", neverShown.length, "Tüm aktif havuz içinde bu dönemde görünmeyenler"),
    summaryCard("Hiç gösterilmeyen Solo-eligible", neverShownSoloEligible.length, "Solo-eligible havuz içinde bu dönemde görünmeyenler"),
    summaryCard("Runtime projection", "Health/admin", "getQuestions diagnostics ile ölçülür; e-posta raporu canlı projection çağırmaz"),
    summaryCard("Ortalama doğru oranı", avgCorrectRate, "Cevaplanmış eventler üzerinden"),
    summaryCard("Ortalama cevap süresi", avgResponse, "Response time olan cevaplar üzerinden")
  ];
  const topShownRows = topShown.map((bucket, index) => [
    escapeHtml(index + 1),
    escapeHtml(`#${bucket.question_id}`),
    escapeHtml(shortText(bucket.question?.question, 100)),
    escapeHtml(questionYearLabel(bucket)),
    escapeHtml(questionCategoryLabel(bucket, categoryMap)),
    escapeHtml(questionSubCategoryLabel(bucket)),
    `${escapeHtml(bucket.shown_count)}<br>${barHtml(bucket.shown_count, topShownMax)}`,
    escapeHtml(correctRateLabel(bucket)),
    escapeHtml(formatMs(avgResponseMs(bucket))),
    escapeHtml(bucket.swap_count)
  ]);
  const neverShownSample = neverShown.slice(0, NEVER_SHOWN_SAMPLE_LIMIT);
  const neverShownRows = neverShownSample.map((question) => [
    escapeHtml(`#${questionKey(question?.id ?? question?.question_id)}`),
    escapeHtml(shortText(question?.question, 100)),
    escapeHtml(getQuestionYear(question) ?? "Yok"),
    escapeHtml(categoryLabel(getCategoryId(question), categoryMap)),
    escapeHtml(displayValue(question?.sub_category)),
    "Yok"
  ]);
  const wrongRows = mostWrong.map((bucket) => {
    const answered = bucket.correct_count + bucket.wrong_count;
    const correctRate = answered ? bucket.correct_count / answered : 0;
    const note = correctRate <= 0.5 ? "Zor olabilir" : "Kontrol edilmeli";
    return [
      escapeHtml(`#${bucket.question_id}`),
      escapeHtml(shortText(bucket.question?.question, 100)),
      escapeHtml(questionYearLabel(bucket)),
      escapeHtml(bucket.shown_count),
      escapeHtml(bucket.wrong_count),
      escapeHtml(correctRateLabel(bucket)),
      escapeHtml(formatMs(avgResponseMs(bucket))),
      escapeHtml(note)
    ];
  });
  const easyRows = easy.map((bucket) => [
    escapeHtml(`#${bucket.question_id}`),
    escapeHtml(shortText(bucket.question?.question, 100)),
    escapeHtml(questionYearLabel(bucket)),
    escapeHtml(bucket.shown_count),
    escapeHtml(correctRateLabel(bucket)),
    escapeHtml(formatMs(avgResponseMs(bucket))),
    "Çok kolay olabilir"
  ]);
  const slowRows = slow.map((bucket) => [
    escapeHtml(`#${bucket.question_id}`),
    escapeHtml(shortText(bucket.question?.question, 100)),
    escapeHtml(questionYearLabel(bucket)),
    escapeHtml(bucket.shown_count),
    escapeHtml(formatMs(avgResponseMs(bucket))),
    escapeHtml(correctRateLabel(bucket))
  ]);
  const hasQuestionRows = questions.length > 0;
  const categoryPoolRows = hasQuestionRows ? categoryAnalyticsForReport.map((row) => [
    escapeHtml(row.categoryId === "unknown" ? row.categoryName : `${row.categoryName} (#${row.categoryId})`),
    escapeHtml(row.activeQuestionCount),
    escapeHtml(row.difficultyCounts?.["1"] || 0),
    escapeHtml(row.difficultyCounts?.["2"] || 0),
    escapeHtml(row.difficultyCounts?.["3"] || 0),
    escapeHtml(row.difficultyCounts?.["4"] || 0),
    escapeHtml(row.difficultyCounts?.["5"] || 0),
    escapeHtml(row.difficultyCounts?.unknown || 0),
    escapeHtml(row.oldestYear ?? "-"),
    escapeHtml(row.newestYear ?? "-")
  ]) : [];
  const categoryDifficultyChartRows = hasQuestionRows ? categoryAnalyticsForReport.map((row) => {
    const difficultyCounts = row.difficultyCounts || {};
    return [
      escapeHtml(row.categoryId === "unknown" ? row.categoryName : `${row.categoryName} (#${row.categoryId})`),
      escapeHtml(row.activeQuestionCount),
      escapeHtml(difficultyCounts["1"] || 0),
      escapeHtml(difficultyCounts["2"] || 0),
      escapeHtml(difficultyCounts["3"] || 0),
      escapeHtml(difficultyCounts["4"] || 0),
      escapeHtml(difficultyCounts["5"] || 0),
      escapeHtml(difficultyCounts.unknown || 0),
      difficultyDistributionBarHtml(difficultyCounts, row.activeQuestionCount)
    ];
  }) : [];
  const registeredQuestionPoolRows = hasQuestionRows ? categoryAnalytics
    .flatMap((row) => row.registeredQuestionPoolRows.map((detail) => [
      escapeHtml(row.categoryId === "unknown" ? row.categoryName : `${row.categoryName} (#${row.categoryId})`),
      escapeHtml(detail.difficultyLevel),
      escapeHtml(detail.questionCount),
      escapeHtml(detail.oldestYear ?? "Yok"),
      escapeHtml(detail.newestYear ?? "Yok")
    ]))
    .slice(0, REGISTERED_QUESTION_POOL_ROW_LIMIT) : [];
  const categoryYearRangeRows = hasQuestionRows ? categoryAnalyticsForReport.map((row) => [
    escapeHtml(row.categoryId === "unknown" ? row.categoryName : `${row.categoryName} (#${row.categoryId})`),
    escapeHtml(row.activeQuestionCount),
    escapeHtml(row.oldestYear ?? "Yok"),
    escapeHtml(row.newestYear ?? "Yok")
  ]) : [];
  const totalPreferenceSelections = categoryAnalytics.reduce((sum, row) => sum + (Number(row.selectedUserCount) || 0), 0);
  const categoryPreferenceRows = categoryAnalyticsForReport.map((row) => [
    escapeHtml(row.categoryId),
    escapeHtml(row.categoryName),
    escapeHtml(row.selectedUserCount),
    escapeHtml(totalPreferenceSelections ? percent(row.selectedUserCount, totalPreferenceSelections) : "0%")
  ]);
  const categoryExposureRows = categoryAnalyticsForReport.map((row) => [
    escapeHtml(row.categoryId),
    escapeHtml(row.categoryName),
    escapeHtml(row.activeQuestionCount),
    escapeHtml(row.shownCount),
    escapeHtml(row.uniqueShownQuestionCount),
    escapeHtml(row.answeredCount),
    escapeHtml(row.correctRate === null ? "Yeterli veri yok" : percent(row.correctRate, 1)),
    escapeHtml(formatMs(row.avgResponseTimeMs)),
    escapeHtml(percent(row.shownCount, shownEvents))
  ]);
  const categoryInternalRows = categoryAnalyticsForReport.map((row) => [
    escapeHtml(row.categoryId),
    escapeHtml(row.categoryName),
    htmlLineList(row.topShown.map(formatQuestionBucket), "Bu kategoride gösterim yok."),
    htmlLineList(row.lowShown.map(formatQuestionBucket), "Bu kategoride az gösterilmiş soru yok."),
    htmlLineList(row.neverShownSample.map(formatQuestionSample), row.neverShownActiveCount ? "Örnek yok." : "Hiç gösterilmeyen aktif soru yok."),
    escapeHtml(row.neverShownActiveCount)
  ]);
  const categoryFairnessSignalRows = categoryFairnessSignals.map((signal) => [
    escapeHtml(signal.tone),
    escapeHtml(signal.categoryId),
    escapeHtml(signal.categoryName),
    escapeHtml(signal.value),
    escapeHtml(signal.note)
  ]);
  const reportChecklistRows = [
    ["Soru Havuzu", "Var", `Statik Question tablosu; ${activeQuestions.length} aktif soru.`],
    ["Kategori/Zorluk Dağılımı Grafiği", "Var", `Sistemdeki Soru Havuzu: Kategori / Zorluk Dağılımı bölümü ${categoryDifficultyChartRows.length} kategori satırı gösterir.`],
    ["Kategori/Zorluk Detayı", "Var", `Question tablosundan ${registeredQuestionPoolRows.length} özet satırı.`],
    ["Kategori Yıl Aralığı", "Var", "En eski/en yeni yıl statik kategori havuzundan hesaplanır."],
    ["Kategori Tercihleri", "Var", "Aggregate UserCategoryPreference; kullanıcı kimliği gösterilmez."],
    ["Kategori Gösterimleri", "Var", "Rapor dönemi QuestionAttemptEvent verisi; statik havuzdan ayrıdır."],
    ["Kategori İçi Analiz", "Var", `Kategori örnekleri ${CATEGORY_QUESTION_SAMPLE_LIMIT} satırla sınırlı.`],
    ["Detay Sorular", "Var", `Uzun tablolar ${QUESTION_TABLE_LIMIT}/${NEVER_SHOWN_SAMPLE_LIMIT}/${EASY_QUESTION_TABLE_LIMIT} satırla sınırlı.`],
    ["Tamamlanma İşareti", "Var", "E-postanın sonunda Rapor Tamamlandı görünmelidir; görünmüyorsa clipping/truncation şüphesi oluşur."]
  ].map(([section, status, note]) => [
    escapeHtml(section),
    escapeHtml(status),
    escapeHtml(note)
  ]);
  const warningRows = [
    ["Events missing question_id", missing.question_id],
    ["Deleted / missing question events ignored", missing.deleted_or_missing_question],
    ["Deleted / missing question sample", Array.from(staleQuestionIds).join(", ") || "Yok"],
    ["Category analytics rows rendered", `${categoryAnalyticsForReport.length}/${categoryAnalytics.length}`],
    ["Events missing answer_year", missing.answer_year],
    ["Events missing category/sub_category", missing.sub_category_or_tags],
    ["Questions missing metadata", questionsMissingMetadata],
    ["Events without outcome", missing.outcome],
    ["Projection limitation", "QuestionStatsProjection refresh remains manual via aggregateQuestionStats."],
    ["Manual proof limitation", "Canlı e-posta teslimatı, RLS ve yüksek hacimli analytics yazımı manuel doğrulama gerektirir."]
  ].map(([label, value]) => [
    escapeHtml(label),
    escapeHtml(value)
  ]);
  const insightHtml = `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
    ${insightRows.map(([label, tone, message]) => `<tr>
      <td valign="top" style="padding:8px 0;width:86px;">${badgeHtml(String(label), tone)}</td>
      <td valign="top" style="padding:8px 0;color:#111827;font-size:13px;line-height:20px;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(message)}</td>
    </tr>`).join("")}
  </table>`;
  const reportSectionNames = [
    "Executive Summary",
    "Key Insights / Risk Flags",
    "Sistemdeki Soru Havuzu: Kategori / Zorluk Dağılımı",
    "Rapor Bölümleri",
    "Kategori Bazında Soru Havuzu",
    "Kategori ve Zorluk Bazında Kayıtlı Soru Sayısı",
    "Kategori Bazında Yıl Aralığı",
    "Kategori Tercihleri",
    "Kategori Bazında Gösterim",
    "Kategori Denge Sinyalleri",
    "Kategori İçi Soru Analizi",
    "En Çok Gösterilen Sorular",
    "Az veya Hiç Gösterilmeyen Sorular",
    "En Çok Yanlış Yapılan Sorular",
    "Çok Kolay Görünen Sorular",
    "En Uzun Sürede Cevaplanan Sorular",
    "Veri Kalitesi Uyarıları",
    "Rapor Tamamlandı"
  ];
  const htmlSections = [
    safeSectionHtml("Executive Summary", () => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>${summaryCards.slice(0, 3).join("")}</tr>
      <tr>${summaryCards.slice(3, 6).join("")}</tr>
      <tr>${summaryCards.slice(6, 9).join("")}</tr>
      <tr>${summaryCards.slice(9).join("")}</tr>
    </table>`),
    safeSectionHtml("Key Insights / Risk Flags", () => insightHtml),
    safeSectionHtml("Rapor Şablonu", () => `
      <p style="margin:0;color:#334155;font-size:13px;line-height:20px;font-family:Arial,Helvetica,sans-serif;">
        ${escapeHtml(REPORT_TEMPLATE_LABEL)} · Build marker: ${escapeHtml(buildMarker || "Bilinmiyor")}
      </p>
      <p style="margin:8px 0 0;color:#64748b;font-size:12px;line-height:18px;font-family:Arial,Helvetica,sans-serif;">
        Bu işaret görünmüyorsa gerçek e-posta eski/deploy edilmemiş bir report template kullanıyor demektir.
      </p>
    `),
    safeSectionHtml("Sistemdeki Soru Havuzu: Kategori / Zorluk Dağılımı", () => `
      <p style="margin:0 0 12px;color:#334155;font-size:13px;line-height:20px;font-family:Arial,Helvetica,sans-serif;">
        Bu bölüm gösterim dağılımı değildir; doğrudan Question tablosundaki aktif kayıtları sayan statik soru havuzu grafiğidir. Gösterilmiş ve hiç gösterilmemiş sorular birlikte sayılır. Dağılım sütunu e-posta uyumlu inline HTML/CSS stacked bar kullanır; JavaScript chart içermez.
      </p>
      <p style="margin:0 0 12px;color:#475569;font-size:12px;line-height:18px;font-family:Arial,Helvetica,sans-serif;">
        Kaynak: Question tablosu, aktif kayıtlar. Gösterim verilerinden bağımsızdır. Toplam aktif kayıtlı soru: ${escapeHtml(activeQuestions.length)}
      </p>
      ${tableHtml(
        ["Kategori", "Toplam", "Zorluk 1", "Zorluk 2", "Zorluk 3", "Zorluk 4", "Zorluk 5", "Bilinmiyor", "Dağılım"],
        categoryDifficultyChartRows,
        "Question tablosunda aktif soru yok."
      )}
    `),
    safeSectionHtml("Rapor Bölümleri", () => tableHtml(
      ["Bölüm", "Durum", "Not"],
      reportChecklistRows,
      "Rapor bölüm listesi hazırlanamadı."
    )),
    safeSectionHtml("Kategori Bazında Soru Havuzu", () => tableHtml(
      ["Kategori", "Toplam Soru", "Zorluk 1", "Zorluk 2", "Zorluk 3", "Zorluk 4", "Zorluk 5", "Zorluk Bilinmiyor", "En Eski Yıl", "En Yeni Yıl"],
      categoryPoolRows,
      "Question tablosunda soru yok."
    )),
    safeSectionHtml("Kategori ve Zorluk Bazında Kayıtlı Soru Sayısı", () => `
      <p style="margin:0 0 12px;color:#334155;font-size:13px;line-height:20px;font-family:Arial,Helvetica,sans-serif;">
        Kategori Bazında Kayıtlı Soru Havuzu detayıdır. Kaynak doğrudan Question tablosundaki aktif kayıtlar; gösterilmiş ve hiç gösterilmemiş sorular birlikte sayılır.
      </p>
      ${tableHtml(
        ["Kategori", "Zorluk Seviyesi", "Sistemdeki Soru Sayısı", "En Eski Yıl", "En Yeni Yıl"],
        registeredQuestionPoolRows,
        "Question tablosunda aktif soru yok."
      )}
    `),
    safeSectionHtml("Kategori Bazında Yıl Aralığı", () => tableHtml(
      ["Kategori", "Aktif Soru", "En Eski Yıl", "En Yeni Yıl"],
      categoryYearRangeRows,
      "Question tablosunda aktif soru yok."
    )),
    safeSectionHtml("Kategori Tercihleri", () => tableHtml(
      ["Kategori ID", "Kategori", "Tercih eden kullanıcı", "Tercih payı"],
      categoryPreferenceRows,
      "Kategori tercih verisi henüz yok."
    )),
    safeSectionHtml("Kategori Bazında Gösterim", () => tableHtml(
      ["Kategori ID", "Kategori", "Aktif soru", "Gösterim", "Benzersiz gösterilen", "Cevaplanan", "Doğru %", "Ort. süre", "Gösterim payı"],
      categoryExposureRows,
      "Kategori bazında gösterim verisi yok."
    )),
    safeSectionHtml("Kategori Denge Sinyalleri", () => tableHtml(
      ["Sinyal", "Kategori ID", "Kategori", "Değer", "Not"],
      categoryFairnessSignalRows,
      "Belirgin kategori denge sinyali yok."
    )),
    safeSectionHtml("Kategori İçi Soru Analizi", () => tableHtml(
      ["Kategori ID", "Kategori", "Fazla sorulan", "Az sorulan", "Hiç sorulmayan örnek", "Hiç sorulmayan sayı"],
      categoryInternalRows,
      "Kategori içi soru analizi için veri yok."
    )),
    safeSectionHtml("En Çok Gösterilen Sorular", () => tableHtml(
      ["#", "Question ID", "Soru", "Yıl", "Kategori", "Alt kategori", "Gösterim", "Doğru %", "Ort. süre", "Swap"],
      topShownRows,
      "Bu dönemde gösterilen soru verisi yok."
    )),
    safeSectionHtml("Az veya Hiç Gösterilmeyen Sorular", () => `
      <p style="margin:0 0 12px;color:#334155;font-size:13px;line-height:20px;font-family:Arial,Helvetica,sans-serif;">Toplam ${escapeHtml(neverShown.length)} aktif soru bu dönemde hiç gösterilmedi. Aktif soru havuzu tüm aktif satırları ifade eder; Solo-eligible hiç gösterilmeyen sayı ${escapeHtml(neverShownSoloEligible.length)}. Runtime projection boyutu getQuestions Health/admin diagnostics ile ayrıca ölçülür. ${neverShown.length > NEVER_SHOWN_SAMPLE_LIMIT ? `İlk ${NEVER_SHOWN_SAMPLE_LIMIT} örnek aşağıdadır.` : ""}</p>
      ${tableHtml(["Question ID", "Soru", "Yıl", "Kategori", "Alt kategori", "Son gösterim"], neverShownRows, "Hiç gösterilmeyen aktif soru bulunmadı.")}
    `),
    safeSectionHtml("En Çok Yanlış Yapılan Sorular", () => tableHtml(
      ["Question ID", "Soru", "Yıl", "Gösterim", "Yanlış", "Doğru %", "Ort. süre", "Not"],
      wrongRows,
      "Yeterli örneklem yok."
    )),
    safeSectionHtml("Çok Kolay Görünen Sorular", () => tableHtml(
      ["Question ID", "Soru", "Yıl", "Gösterim", "Doğru %", "Ort. süre", "Not"],
      easyRows,
      "Yeterli örneklem yok."
    )),
    safeSectionHtml("En Uzun Sürede Cevaplanan Sorular", () => tableHtml(
      ["Question ID", "Soru", "Yıl", "Gösterim", "Ort. süre", "Doğru %"],
      slowRows,
      "Cevap süresi verisi yok."
    )),
    safeSectionHtml("Veri Kalitesi Uyarıları", () => tableHtml(["Kontrol", "Durum"], warningRows, "Veri kalitesi uyarısı yok.")),
    safeSectionHtml("Rapor Tamamlandı", () => `
      <p style="margin:0 0 12px;color:#065f46;font-size:14px;line-height:22px;font-family:Arial,Helvetica,sans-serif;font-weight:700;">Bu rapor tüm bölümleriyle tamamlandı.</p>
      <p style="margin:0 0 12px;color:#334155;font-size:13px;line-height:20px;font-family:Arial,Helvetica,sans-serif;">Bu bölümü görmüyorsanız e-posta istemcisi clipping/truncation yapmış olabilir.</p>
      ${tableHtml(
        ["Kontrol", "Değer"],
        [
          ["Oluşturma zamanı", escapeHtml(generatedAt)],
          ["Dönem", escapeHtml(period)],
          ["Build", escapeHtml(buildMarker || "Bilinmiyor")],
          ["Bölüm sayısı", escapeHtml(reportSectionNames.length)],
          ["Silinmiş/eksik soru referansları", escapeHtml(missing.deleted_or_missing_question)]
        ],
        "Tamamlama bilgisi yok."
      )}
    `)
  ].join("");
  const html = `<!doctype html>
<html>
<body style="margin:0;padding:0;background:#eef2f7;color:#111827;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f7;padding:22px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="720" cellpadding="0" cellspacing="0" style="width:720px;max-width:100%;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #dbe3ef;">
          <tr>
            <td style="padding:24px;background:#0b1736;color:#ffffff;">
              <h1 style="margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:26px;line-height:32px;color:#ffffff;">Kronox Soru Analiz Raporu</h1>
              <p style="margin:0;color:#facc15;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:20px;">Dönem: ${escapeHtml(period)}</p>
              <p style="margin:4px 0 0;color:#cbd5e1;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;">Oluşturma zamanı: ${escapeHtml(generatedAt)} · Build: ${escapeHtml(buildMarker || "Bilinmiyor")}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:18px;background:#ffffff;">
              ${htmlSections}
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px;background:#f8fafc;border-radius:12px;border:1px solid #e5e7eb;">
                <tr><td style="padding:16px 18px;">
                  <p style="margin:0 0 6px;color:#334155;font-size:12px;line-height:18px;font-family:Arial,Helvetica,sans-serif;">Bu rapor yalnızca admin kullanımı içindir.</p>
                  <p style="margin:0 0 6px;color:#334155;font-size:12px;line-height:18px;font-family:Arial,Helvetica,sans-serif;">Rapor kullanıcı takibi için değil, soru dengesi ve soru kalitesi kontrolü için üretilmiştir.</p>
                  <p style="margin:0;color:#64748b;font-size:12px;line-height:18px;font-family:Arial,Helvetica,sans-serif;">Canlı e-posta teslimatı, RLS ve yüksek hacimli analytics yazımı manuel doğrulama gerektirir.</p>
                </td></tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  const topTextRows = topShown.length ? topShown.map((bucket, index) => `${index + 1}. #${bucket.question_id} | ${shortText(bucket.question?.question, 100)} | yıl=${questionYearLabel(bucket)} | kategori=${questionCategoryLabel(bucket, categoryMap)} | gösterim=${bucket.shown_count} | doğru=${correctRateLabel(bucket)} | süre=${formatMs(avgResponseMs(bucket))}`) : ["Bu dönemde gösterilen soru verisi yok."];
  const neverTextRows = neverShownSample.length ? neverShownSample.map((question, index) => `${index + 1}. #${questionKey(question?.id ?? question?.question_id)} | ${shortText(question?.question, 100)} | yıl=${getQuestionYear(question) ?? "Yok"} | kategori=${categoryLabel(getCategoryId(question), categoryMap)} | alt=${displayValue(question?.sub_category)}`) : ["Hiç gösterilmeyen aktif soru bulunmadı."];
  const categoryPoolTextRows = hasQuestionRows ? categoryAnalyticsForReport.map((row) => `${row.categoryId} | ${row.categoryName}: aktif=${row.activeQuestionCount}, zorluk1=${row.difficultyCounts?.["1"] || 0}, zorluk2=${row.difficultyCounts?.["2"] || 0}, zorluk3=${row.difficultyCounts?.["3"] || 0}, zorluk4=${row.difficultyCounts?.["4"] || 0}, zorluk5=${row.difficultyCounts?.["5"] || 0}, zorluk_bilinmiyor=${row.difficultyCounts?.unknown || 0}, en_eski_yıl=${row.oldestYear ?? "-"}, en_yeni_yıl=${row.newestYear ?? "-"}`) : ["Question tablosunda soru yok."];
  const categoryDifficultyChartTextRows = hasQuestionRows ? categoryAnalyticsForReport.map((row) => `${row.categoryId} | ${row.categoryName}: toplam=${row.activeQuestionCount}, zorluk1=${row.difficultyCounts?.["1"] || 0}, zorluk2=${row.difficultyCounts?.["2"] || 0}, zorluk3=${row.difficultyCounts?.["3"] || 0}, zorluk4=${row.difficultyCounts?.["4"] || 0}, zorluk5=${row.difficultyCounts?.["5"] || 0}, bilinmiyor=${row.difficultyCounts?.unknown || 0}`) : ["Question tablosunda aktif soru yok."];
  const registeredQuestionPoolTextRows = hasQuestionRows ? categoryAnalytics
    .flatMap((row) => row.registeredQuestionPoolRows.map((detail) => `${row.categoryId} | ${row.categoryName} | zorluk=${detail.difficultyLevel} | sistemdeki_soru=${detail.questionCount} | en_eski_yıl=${detail.oldestYear ?? "Yok"} | en_yeni_yıl=${detail.newestYear ?? "Yok"}`))
    .slice(0, REGISTERED_QUESTION_POOL_ROW_LIMIT) : ["Question tablosunda aktif soru yok."];
  const categoryYearRangeTextRows = hasQuestionRows ? categoryAnalyticsForReport.map((row) => `${row.categoryId} | ${row.categoryName}: aktif=${row.activeQuestionCount}, en_eski_yıl=${row.oldestYear ?? "Yok"}, en_yeni_yıl=${row.newestYear ?? "Yok"}`) : ["Question tablosunda aktif soru yok."];
  const categoryPreferenceTextRows = categoryAnalytics.length ? categoryAnalyticsForReport.map((row) => `${row.categoryId} | ${row.categoryName}: tercih eden kullanıcı=${row.selectedUserCount}, tercih payı=${totalPreferenceSelections ? percent(row.selectedUserCount, totalPreferenceSelections) : "0%"}`) : ["Kategori tercih verisi henüz yok."];
  const categoryExposureTextRows = categoryAnalytics.length ? categoryAnalyticsForReport.map((row) => `${row.categoryId} | ${row.categoryName}: aktif=${row.activeQuestionCount}, gösterim=${row.shownCount}, benzersiz gösterilen=${row.uniqueShownQuestionCount}, cevaplanan=${row.answeredCount}, doğru=${row.correctRate === null ? "Yeterli veri yok" : percent(row.correctRate, 1)}, ortalama süre=${formatMs(row.avgResponseTimeMs)}, gösterim payı=${percent(row.shownCount, shownEvents)}`) : ["Kategori bazında gösterim verisi yok."];
  const categoryInternalTextRows = categoryAnalytics.length ? categoryAnalyticsForReport.map((row) => [
    `${row.categoryId} | ${row.categoryName}:`,
    `  Fazla sorulan: ${row.topShown.map(formatQuestionBucket).join(" | ") || "Bu kategoride gösterim yok."}`,
    `  Az sorulan: ${row.lowShown.map(formatQuestionBucket).join(" | ") || "Bu kategoride az gösterilmiş soru yok."}`,
    `  Hiç sorulmayan (${row.neverShownActiveCount}): ${row.neverShownSample.map(formatQuestionSample).join(" | ") || (row.neverShownActiveCount ? "Örnek yok." : "Hiç gösterilmeyen aktif soru yok.")}`
  ].join("\n")) : ["Kategori içi soru analizi için veri yok."];
  const categoryFairnessSignalTextRows = categoryFairnessSignals.length ? categoryFairnessSignals.map((signal) => `${signal.tone} | ${signal.categoryId} | ${signal.categoryName}: ${signal.value} — ${signal.note}`) : ["Belirgin kategori denge sinyali yok."];
  const reportChecklistTextRows = reportChecklistRows.map((row) => row.map((cell) => String(cell).replace(/<[^>]+>/g, "")).join(" | "));
  const textLines = [
    "Kronox Soru Analiz Raporu",
    `Dönem: ${period}`,
    `Oluşturma zamanı: ${generatedAt}`,
    `Build: ${buildMarker || "Bilinmiyor"}`,
    "",
    "--- Executive Summary ---",
    `Toplam gösterim: ${shownEvents}`,
    `Cevaplanan soru: ${answeredEvents}`,
    `Benzersiz gösterilen soru: ${shownQuestionIds.size}`,
    `Aktif soru havuzu (tüm aktifler): ${activeQuestions.length}`,
    `Solo-eligible soru havuzu: ${soloEligibleQuestions.length}`,
    `Hiç gösterilmeyen aktif soru: ${neverShown.length}`,
    `Hiç gösterilmeyen Solo-eligible soru: ${neverShownSoloEligible.length}`,
    "Runtime projection size: Health/admin getQuestions diagnostics ile ölçülür",
    `Top shown subcategory concentration: ${topSubcategoryConcentration.topShownSubcategory} (${percent(topSubcategoryConcentration.topShownSubcategoryCount, topSubcategoryConcentration.topShownSubcategoryTotal)})`,
    `Ortalama doğru oranı: ${avgCorrectRate}`,
    `Ortalama cevap süresi: ${avgResponse}`,
    "",
    "--- Key Insights / Risk Flags ---",
    ...insightRows.map(([label, _tone, message]) => `${label}: ${message}`),
    "",
    "--- Rapor Şablonu ---",
    REPORT_TEMPLATE_LABEL,
    `Build marker: ${buildMarker || "Bilinmiyor"}`,
    "",
    "--- Sistemdeki Soru Havuzu: Kategori / Zorluk Dağılımı ---",
    "Kaynak: Question tablosundaki aktif kayıtlar; gösterilmiş ve hiç gösterilmemiş sorular birlikte sayılır. Bu bölüm gösterim dağılımı değildir; HTML gövdede Dağılım sütunu email-safe stacked bar olarak render edilir.",
    `Toplam aktif kayıtlı soru: ${activeQuestions.length}`,
    ...categoryDifficultyChartTextRows,
    "",
    "--- Rapor Bölümleri ---",
    ...reportChecklistTextRows,
    "",
    "--- Kategori Bazında Soru Havuzu ---",
    ...categoryPoolTextRows,
    "",
    "--- Kategori ve Zorluk Bazında Kayıtlı Soru Sayısı ---",
    "Kategori Bazında Kayıtlı Soru Havuzu | Kaynak: Question tablosundaki aktif kayıtlar; gösterilmiş ve hiç gösterilmemiş sorular birlikte sayılır.",
    ...registeredQuestionPoolTextRows,
    "",
    "--- Kategori Bazında Yıl Aralığı ---",
    ...categoryYearRangeTextRows,
    "",
    "--- Kategori Tercihleri ---",
    ...categoryPreferenceTextRows,
    "",
    "--- Kategori Bazında Gösterim ---",
    ...categoryExposureTextRows,
    "",
    "--- Kategori İçi Soru Analizi ---",
    ...categoryInternalTextRows,
    "",
    "--- Kategori Denge Sinyalleri ---",
    ...categoryFairnessSignalTextRows,
    "",
    "--- En Çok Gösterilen Sorular ---",
    ...topTextRows,
    "",
    "--- Az veya Hiç Gösterilmeyen Sorular ---",
    `Toplam hiç gösterilmeyen aktif soru: ${neverShown.length}`,
    `Toplam hiç gösterilmeyen Solo-eligible soru: ${neverShownSoloEligible.length}`,
    `Silinmiş/eksik soruya referans veren ve rapordan çıkarılan event sayısı: ${missing.deleted_or_missing_question}`,
    `Silinmiş/eksik soru örnekleri: ${Array.from(staleQuestionIds).join(", ") || "Yok"}`,
    ...neverTextRows,
    "",
    "--- En Çok Yanlış Yapılan Sorular ---",
    ...wrongRows.length ? mostWrong.map((bucket) => `#${bucket.question_id} | ${shortText(bucket.question?.question, 100)} | yanlış=${bucket.wrong_count} | doğru=${correctRateLabel(bucket)}`) : ["Yeterli örneklem yok."],
    "",
    "--- Çok Kolay Görünen Sorular ---",
    ...easyRows.length ? easy.map((bucket) => `#${bucket.question_id} | ${shortText(bucket.question?.question, 100)} | doğru=${correctRateLabel(bucket)}`) : ["Yeterli örneklem yok."],
    "",
    "--- En Uzun Sürede Cevaplanan Sorular ---",
    ...slowRows.length ? slow.map((bucket) => `#${bucket.question_id} | ${shortText(bucket.question?.question, 100)} | süre=${formatMs(avgResponseMs(bucket))} | doğru=${correctRateLabel(bucket)}`) : ["Cevap süresi verisi yok."],
    "",
    "--- Veri Kalitesi Uyarıları ---",
    ...warningRows.map(([label, value]) => `${label}: ${value}`),
    "",
    "--- Rapor Tamamlandı ---",
    "Bu rapor tüm bölümleriyle tamamlandı.",
    "Bu bölümü görmüyorsanız e-posta istemcisi clipping/truncation yapmış olabilir.",
    `Oluşturma zamanı: ${generatedAt}`,
    `Dönem: ${period}`,
    `Build: ${buildMarker || "Bilinmiyor"}`,
    `Bölüm sayısı: ${reportSectionNames.length}`,
    `Silinmiş/eksik soru referansları: ${missing.deleted_or_missing_question}`,
    "",
    "Bu rapor yalnızca admin kullanımı içindir.",
    "Rapor kullanıcı takibi için değil, soru dengesi ve soru kalitesi kontrolü için üretilmiştir."
  ];
  return {
    html,
    text: textLines.join('\n'),
    summary: {
      totalEvents: events.length,
      shownEvents,
      answeredEvents,
      uniqueShownQuestions: shownQuestionIds.size,
      activeQuestionPoolSize: activeQuestions.length,
      activeQuestionPoolMeaning: "all active Question.state=A rows visible to the report query; not necessarily Solo-eligible or runtime-projected",
      soloEligibleQuestionPoolSize: soloEligibleQuestions.length,
      neverShownActiveQuestions: neverShown.length,
      neverShownSoloEligibleQuestions: neverShownSoloEligible.length,
      staleQuestionReferenceEvents: missing.deleted_or_missing_question,
      staleQuestionReferenceSample: Array.from(staleQuestionIds),
      staleQuestionReferenceHandling: "ignored_with_diagnostic_count",
      runtimeProjectionSizeAvailable: false,
      runtimeProjectionSize: null,
      runtimeProjectionSizeSource: "getQuestions projectionDiagnostics admin/Health path",
      topShownSubcategory: topSubcategoryConcentration.topShownSubcategory,
      topShownSubcategoryShare: topSubcategoryConcentration.topShownSubcategoryShare,
      templateVersion: REPORT_TEMPLATE_VERSION,
      reportTemplateMarker: REPORT_TEMPLATE_LABEL,
      categoryDifficultyChartRowsRendered: categoryDifficultyChartRows.length,
      categoryDifficultyChartSource: "Question.list static active rows by category and difficulty",
      categoryDifficultyChartRenderer: "email_safe_inline_html_css_stacked_bar",
      categoryPoolRowsRendered: categoryPoolRows.length,
      categoryPoolSource: "Question.list static current DB rows",
      registeredQuestionPoolRowsRendered: registeredQuestionPoolRows.length,
      registeredQuestionPoolSource: "Question.list active registered rows by category difficulty year range",
      categoryYearRangeRowsRendered: categoryYearRangeRows.length,
      reportSectionCount: reportSectionNames.length,
      reportCompletionMarker: "Rapor Tamamlandı",
      clippingDiagnosis: "If the received email omits Rapor Tamamlandı, suspect email client clipping/truncation.",
      categoryPreferenceRowsRendered: categoryPreferenceRows.length,
      categoryExposureRowsRendered: categoryExposureRows.length,
      categoryFairnessSignalCount: categoryFairnessSignals.length,
      reportSections: [
        "Executive Summary",
        "Key Insights / Risk Flags",
        "Rapor Şablonu",
        "Sistemdeki Soru Havuzu: Kategori / Zorluk Dağılımı",
        "Rapor Bölümleri",
        "Kategori Bazında Soru Havuzu",
        "Kategori ve Zorluk Bazında Kayıtlı Soru Sayısı",
        "Kategori Bazında Kayıtlı Soru Havuzu",
        "Kategori Bazında Yıl Aralığı",
        "Kategori Tercihleri",
        "Kategori Bazında Gösterim",
        "Kategori İçi Soru Analizi",
        "Kategori Denge Sinyalleri",
        "Rapor Tamamlandı"
      ],
      categoryAnalytics: categoryAnalytics.map((row) => ({
        categoryId: row.categoryId,
        categoryName: row.categoryName,
        totalQuestionCount: row.totalQuestionCount,
        activeQuestionCount: row.activeQuestionCount,
        difficultyCounts: row.difficultyCounts,
        oldestYear: row.oldestYear,
        newestYear: row.newestYear,
        registeredQuestionPoolRows: row.registeredQuestionPoolRows,
        soloEligibleQuestionCount: row.soloEligibleQuestionCount,
        selectedUserCount: row.selectedUserCount,
        shownCount: row.shownCount,
        answeredCount: row.answeredCount,
        uniqueShownQuestionCount: row.uniqueShownQuestionCount,
        neverShownActiveCount: row.neverShownActiveCount,
        neverShownSoloEligibleCount: row.neverShownSoloEligibleCount,
        avgResponseTimeMs: row.avgResponseTimeMs
      })),
      sportsShown
    }
  };
}
// ── Inlined DB-backed AdminUser guard (no local _shared import) ──────────
// Mirrors functions/_shared/adminAuth.ts requireAdmin contract.
function isActiveAdminRole(role) {
  const value = String(role || "").trim().toLowerCase();
  return value === 'owner' || value === 'admin';
}
function isActiveStatus(status) {
  return String(status || "").trim().toLowerCase() === "active";
}
const ADMIN_EMAIL_FIELDS = ["email", "Email", "user_email", "admin_email"];
const ADMIN_ROLE_FIELDS = ["role", "Role", "user_role"];
const ADMIN_STATUS_FIELDS = ["status", "Status"];
function readAdminField(row, candidates) {
  for (const field of candidates) {
    if (row && Object.prototype.hasOwnProperty.call(row, field)) return row[field];
  }
  return undefined;
}
async function getAdminAuthorization(base44, user) {
  const email = normalizeEmail(user?.email);
  if (!email) return { isAdmin: false, row: null, role: "", reason: "no_auth_email" };
  const adminEntity = base44?.asServiceRole?.entities?.AdminUser;
  if (!adminEntity?.filter) return { isAdmin: false, row: null, role: "", reason: "lookup_error" };
  let rows = [];
  for (const field of ADMIN_EMAIL_FIELDS) {
    try {
      const result = await adminEntity.filter({ [field]: email }, "-updated_at", 10);
      if (Array.isArray(result) && result.length > 0) { rows = result; break; }
    } catch (_error) { /* try next candidate field */ }
  }
  const exactEmailRows = (rows || [])
    .map((candidate) => ({
      candidate,
      email: normalizeEmail(readAdminField(candidate, ADMIN_EMAIL_FIELDS)),
      role: String(readAdminField(candidate, ADMIN_ROLE_FIELDS) || "").trim().toLowerCase(),
      status: String(readAdminField(candidate, ADMIN_STATUS_FIELDS) || "").trim().toLowerCase(),
    }))
    .filter((candidate) => candidate.email === email);
  const activeRow = exactEmailRows.find(
    (candidate) => isActiveStatus(candidate.status) && isActiveAdminRole(candidate.role),
  ) || null;
  return {
    isAdmin: Boolean(activeRow),
    row: activeRow?.candidate || null,
    role: activeRow?.role || "",
    reason: activeRow ? "active_admin_match" : "admin_user_not_found",
  };
}
async function requireAdmin(base44) {
  try {
    const user = await base44.auth.me();
    if (!user?.email) return { response: json({ ok: false, error: "Authentication required" }, 401) };
    const authorization = await getAdminAuthorization(base44, user);
    if (!authorization.isAdmin) return { response: json({ ok: false, error: "Admin access required" }, 403) };
    return { user, admin: authorization.row, adminRole: authorization.role };
  } catch (_error) {
    return { response: json({ ok: false, error: "Authentication required" }, 401) };
  }
}
async function writeJobLog(base44, user, result, metadata) {
  try {
    await base44.asServiceRole.entities.AdminMaintenanceLog.create({
      action: `admin:${JOB_NAME}`,
      job_name: JOB_NAME,
      admin_email: normalizeEmail(user?.email),
      target_email: normalizeEmail(metadata?.recipientEmail || metadata?.recipient || user?.email),
      result,
      retention_status: "active",
      metadata,
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    });
  } catch (_error) {
  }
}
function safeErrorReason(error) {
  const raw = error instanceof Error ? error.message : String(error || "send failed");
  return String(raw || "send failed").split("\n")[0].slice(0, 180);
}
Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);
    const base44 = createClientFromRequest(req);
    const admin = await requireAdmin(base44);
    if (admin.response) return admin.response;
    const body = await readBody(req);
    const periodDays = clampPeriodDays(body?.periodDays);
    const requestedByEmail = normalizeEmail(admin.user?.email);
    const requestedRecipientEmail = normalizeEmail(body?.recipientEmail);
    if (!requestedByEmail) return json({ ok: false, error: "Report requester is required" }, 400);
    if (requestedRecipientEmail && requestedRecipientEmail !== requestedByEmail) {
      return json({
        ok: false,
        error: "recipient_override_not_allowed",
        requestedBy: requestedByEmail,
        requestedRecipientEmail,
        adminAuthorized: true
      }, 400);
    }
    const recipient = requestedByEmail;
    const recipientEmail = recipient;
    const recipientSource = requestedRecipientEmail ? "body_recipient_self" : "authenticated_admin";
    const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1e3).toISOString();
    const rawEvents = await base44.asServiceRole.entities.QuestionAttemptEvent.list("-created_at", MAX_EVENTS).catch(() => []);
    const events = rawEvents.filter((event) => eventTimestamp(event) >= since);
    const rawQuestions = await base44.asServiceRole.entities.Question.list("-created_date", MAX_QUESTIONS).catch(() => []);
    const rawCategories = await base44.asServiceRole.entities.Category.list("-created_date", MAX_CATEGORIES).catch(() => []);
    const rawCategoryPreferences = await base44.asServiceRole.entities.UserCategoryPreference.list("-updated_date", MAX_USER_CATEGORY_PREFERENCES).catch(() => []);
    const report = buildReport({
      periodDays,
      events,
      questions: rawQuestions,
      categories: rawCategories,
      categoryPreferences: rawCategoryPreferences,
      buildMarker: String(body?.buildMarker || REPORT_BUILD_MARKER)
    });
    const emailHtml = report.html;
    const emailText = report.text;
    const sentAt = (/* @__PURE__ */ new Date()).toISOString();
    const reportBuildMarker = String(body?.buildMarker || REPORT_BUILD_MARKER);
    const bodyDiagnostics = {
      reportBuildMarker,
      buildMarker: reportBuildMarker,
      templateVersion: REPORT_TEMPLATE_VERSION,
      bodyContainsStaticPoolSection: emailHtml.includes("Sistemdeki Soru Havuzu: Kategori / Zorluk Dağılımı"),
      bodyContainsTemplateMarker: emailHtml.includes(REPORT_TEMPLATE_LABEL),
      bodyContainsQuestionSourceMarker: emailHtml.includes("Kaynak: Question tablosu"),
      bodyContainsActiveQuestionCountMarker: emailHtml.includes("Toplam aktif kayıtlı soru"),
      bodyLength: emailHtml.length,
      sentAt
    };
    if (!bodyDiagnostics.bodyContainsStaticPoolSection || !bodyDiagnostics.bodyContainsTemplateMarker || !bodyDiagnostics.bodyContainsQuestionSourceMarker) {
      await writeJobLog(base44, admin.user, "body_validation_failed", { periodDays, requestedBy: requestedByEmail, recipientEmail, adminAuthorized: true, emailDispatchStatus: "not_sent", ...bodyDiagnostics });
      return json({ ok: false, error: "report_body_missing_static_pool_section", requestedBy: requestedByEmail, recipientEmail, adminAuthorized: true, emailDispatchStatus: "not_sent", ...bodyDiagnostics }, 500);
    }
    const subject = `Kronox Soru Analiz Raporu — ${periodLabel(periodDays)}`;
    let emailResult = null;
    try {
      emailResult = await base44.integrations.Core.SendEmail({
        from_name: "Kronox",
        to: recipient,
        subject,
        body: emailHtml,
        html: emailHtml,
        text: emailText,
        body_text: emailText
      });
      if (emailResult?.ok === false) {
        throw new Error(emailResult?.error || emailResult?.message || "send failed");
      }
    } catch (mailError) {
      const reason = safeErrorReason(mailError);
      const failedDiagnostics = {
        requestedBy: requestedByEmail,
        recipientEmail,
        recipientSource,
        adminAuthorized: true,
        emailDispatchStatus: "failed",
        sendEmailOk: false,
        safeErrorReason: reason,
        ...bodyDiagnostics
      };
      await writeJobLog(base44, admin.user, "email_failed", { periodDays, ...failedDiagnostics });
      return json({ ok: false, error: "email_failed", ...failedDiagnostics }, 502);
    }
    const emailProviderMessageId = String(emailResult?.id || emailResult?.messageId || emailResult?.message_id || "").trim() || null;
    const summary = {
      ok: true,
      jobName: JOB_NAME,
      periodDays,
      requestedBy: requestedByEmail,
      recipientEmail,
      recipientSource,
      adminAuthorized: true,
      emailDispatchStatus: "sent",
      sendEmailOk: true,
      emailProviderMessageId,
      ...bodyDiagnostics,
      ...report.summary
    };
    await writeJobLog(base44, admin.user, "success", summary);
    return json(summary);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`[${JOB_NAME}] failed`, message);
    return json({ ok: false, error: "report_failed" }, 500);
  }
});
