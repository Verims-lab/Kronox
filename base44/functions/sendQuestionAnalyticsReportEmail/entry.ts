/* global Deno */
import { createClientFromRequest } from "npm:@base44/sdk@0.8.25";

// Admin Ekranı invokes functions.invoke("sendQuestionAnalyticsReportEmail", payload).
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
const MAX_JOKER_TRANSACTIONS = 5e3;
const MAX_DIAMOND_TRANSACTIONS = 5e3;
const MAX_DAILY_WHEEL_SPINS = 5e3;
const MAX_GAME_RECORDS = 5e3;
const NEVER_SHOWN_SAMPLE_LIMIT = 15;
const QUESTION_TABLE_LIMIT = 15;
const EASY_QUESTION_TABLE_LIMIT = 10;
const CATEGORY_QUESTION_SAMPLE_LIMIT = 5;
const CATEGORY_ANALYTICS_ROW_LIMIT = 50;
const REGISTERED_QUESTION_POOL_ROW_LIMIT = 250;
const CATEGORY_FAIRNESS_SIGNAL_LIMIT = 20;
const STALE_REFERENCE_SAMPLE_LIMIT = 20;
const PERIOD_OPTIONS = /* @__PURE__ */ new Set([1, 7, 30]);
const REPORT_BUILD_MARKER = "Codex318";
const REPORT_TEMPLATE_VERSION = "product-intel-email-v3";
const REPORT_TEMPLATE_LABEL = "product-intel-email-v3";
const REMOVED_REPORT_SECTION_TITLES = Object.freeze([
  "Rapor Şablonu",
  "Rapor Bölümleri",
  "Sistemdeki Soru Havuzu: Kategori / Zorluk Dağılımı",
  "Kategori ve Zorluk Bazında Kayıtlı Soru Sayısı",
  "Kategori Bazında Yıl Aralığı",
  "Kategori İçi Soru Analizi"
]);
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
function rowTimestamp(row) {
  return String(row?.claimed_at || row?.created_at || row?.created_date || row?.updated_at || row?.updated_date || "");
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
function formatSeconds(seconds) {
  const value = Number(seconds);
  if (!Number.isFinite(value) || value <= 0) return "-";
  if (value < 60) return `${Math.round(value)} sn`;
  return `${Math.round(value / 6) / 10} dk`;
}
function istanbulHourKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  try {
    return new Intl.DateTimeFormat("tr-TR", {
      timeZone: "Europe/Istanbul",
      hour: "2-digit",
      hour12: false
    }).format(date);
  } catch (_error) {
    return String(date.getUTCHours()).padStart(2, "0");
  }
}
function istanbulWeekdayKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  try {
    return new Intl.DateTimeFormat("tr-TR", {
      timeZone: "Europe/Istanbul",
      weekday: "long"
    }).format(date);
  } catch (_error) {
    return ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"][date.getUTCDay()];
  }
}
function incrementMap(map, key, amount = 1) {
  if (!key) return;
  map.set(key, (map.get(key) || 0) + amount);
}
function topMapEntries(map, limit = 3) {
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]), "tr"))
    .slice(0, limit);
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
function slugifyFilename(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[ığ]/g, "g")
    .replace(/[ü]/g, "u")
    .replace(/[ş]/g, "s")
    .replace(/[ö]/g, "o")
    .replace(/[ç]/g, "c")
    .replace(/[^\w]+/g, "-")
    .replace(/^-+|-+$/g, "") || "rapor";
}
function stripHtml(value) {
  return String(value ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h1|h2|h3)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .trim();
}
function findRemovedReportSections(value) {
  const text = String(value || "");
  return REMOVED_REPORT_SECTION_TITLES.filter((title) => text.includes(title));
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
  // Top shown subcategory concentration: generic product signal, not a hardcoded category label.
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
function normalizeJokerType(value) {
  const raw = String(value || "").trim();
  const lower = raw.toLowerCase();
  if (lower === "swapcard" || lower === "card-swap" || lower === "kart_degis" || lower === "kart-degis") return "card_swap";
  if (lower === "shield" || lower === "kronokalkan") return "mistake_shield";
  if (lower === "timefreeze" || lower === "time-freeze" || lower === "zaman_dondur" || lower === "zaman-dondur") return "time_freeze";
  return lower;
}
function jokerDisplayName(value) {
  const type = normalizeJokerType(value);
  if (type === "mistake_shield") return "Kronokalkan";
  if (type === "card_swap") return "Kart Değiştir";
  if (type === "time_freeze") return "Zaman Dondur";
  return displayValue(value, "Bilinmeyen joker");
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
  jokerTransactions = [],
  diamondTransactions = [],
  dailyWheelSpins = [],
  gameRecords = [],
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
    bucket.tag = tag;
    bucket.difficulty_bucket = getQuestionDifficultyBucket(q);
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
  const mostWrong = [...bucketList].filter((bucket) => bucket.shown_count >= 3 && bucket.wrong_count > 0).sort(sortDesc("wrong_count")).slice(0, QUESTION_TABLE_LIMIT);
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
  const insightLines = insightRows.slice(0, 6).map(([label, _tone, message]) => `${label}: ${message}`);
  const totalPreferenceSelections = categoryAnalytics.reduce((sum, row) => sum + (Number(row.selectedUserCount) || 0), 0);
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
  const questionTypeBuckets = /* @__PURE__ */ new Map();
  for (const bucket of bucketList) {
    if (!bucket.shown_count) continue;
    const q = bucket.question || {};
    const category = questionCategoryLabel(bucket, categoryMap);
    const subCategory = displayValue(q.sub_category || bucket.sub_category);
    const tag = displayValue(q.tag || bucket.tag, "tag yok");
    const difficulty = difficultyLabel(bucket.difficulty_bucket || getQuestionDifficultyBucket(q));
    const key = `${category} / ${subCategory} / zorluk ${difficulty}`;
    const current = questionTypeBuckets.get(key) || {
      key,
      category,
      subCategory,
      tag,
      difficulty,
      shown: 0,
      correct: 0,
      wrong: 0,
      responseMs: 0,
      responseCount: 0
    };
    current.shown += Number(bucket.shown_count) || 0;
    current.correct += Number(bucket.correct_count) || 0;
    current.wrong += Number(bucket.wrong_count) || 0;
    current.responseMs += Number(bucket.total_response_time_ms) || 0;
    current.responseCount += Number(bucket.response_count) || 0;
    questionTypeBuckets.set(key, current);
  }
  const questionTypeRows = Array.from(questionTypeBuckets.values()).map((row) => ({
    ...row,
    answered: row.correct + row.wrong,
    correctRate: row.correct + row.wrong ? row.correct / (row.correct + row.wrong) : null,
    avgMs: row.responseCount ? Math.round(row.responseMs / row.responseCount) : 0
  }));
  const bestQuestionTypes = questionTypeRows
    .filter((row) => row.answered >= 3 && row.correctRate >= 0.5 && row.correctRate <= 0.85)
    .sort((a, b) => b.answered - a.answered || b.correctRate - a.correctRate)
    .slice(0, 5);
  const tooHardQuestionTypes = questionTypeRows
    .filter((row) => row.answered >= 3 && row.correctRate !== null && row.correctRate <= 0.45)
    .sort((a, b) => b.wrong - a.wrong || a.correctRate - b.correctRate)
    .slice(0, 5);
  const tooEasyQuestionTypes = questionTypeRows
    .filter((row) => row.answered >= 3 && row.correctRate !== null && row.correctRate >= 0.9)
    .sort((a, b) => b.correctRate - a.correctRate || b.answered - a.answered)
    .slice(0, 3);
  const typeRowLabel = (row) => `${row.key} · gösterim=${row.shown} · cevap=${row.answered} · doğru=${row.correctRate === null ? "Yeterli veri yok" : percent(row.correctRate, 1)} · süre=${formatMs(row.avgMs)} · tag=${row.tag}`;

  const jokerUsageByType = /* @__PURE__ */ new Map();
  const jokerPurchaseByType = /* @__PURE__ */ new Map();
  const questionJokerByType = /* @__PURE__ */ new Map();
  for (const tx of jokerTransactions || []) {
    const type = normalizeJokerType(tx?.joker_type);
    if (!type) continue;
    const delta = Number(tx?.quantity_delta) || 0;
    const reason = String(tx?.reason || "").trim();
    if (reason === "solo_use" || delta < 0) incrementMap(jokerUsageByType, type, Math.max(1, Math.abs(delta)));
    if (reason === "market_purchase") incrementMap(jokerPurchaseByType, type, Math.max(1, Math.abs(delta)));
  }
  for (const event of events) {
    if (!event?.joker_used && !event?.joker_type) continue;
    const type = normalizeJokerType(event?.joker_type);
    incrementMap(questionJokerByType, type || "unknown");
  }
  const jokerLines = [];
  if (!jokerTransactions.length && !questionJokerByType.size) {
    jokerLines.push("Joker analytics data insufficient: JokerTransaction ve QuestionAttemptEvent joker alanlarında bu dönem için ölçülebilir kullanım bulunamadı.");
  } else {
    const usage = topMapEntries(jokerUsageByType, 5).map(([type, count]) => `${jokerDisplayName(type)}: ${count} solo kullanım`).join("; ") || "Solo kullanım ledger satırı yok.";
    const purchases = topMapEntries(jokerPurchaseByType, 5).map(([type, count]) => `${jokerDisplayName(type)}: ${count} market_purchase`).join("; ") || "Mağaza joker satın alma ledger satırı yok.";
    const eventUsage = topMapEntries(questionJokerByType, 5).map(([type, count]) => `${jokerDisplayName(type)}: ${count} soru event sinyali`).join("; ") || "QuestionAttemptEvent içinde joker sinyali yok.";
    jokerLines.push(`Joker ledger özeti: ${usage}`);
    jokerLines.push(`Mağaza sonrası joker akışı: ${purchases}`);
    jokerLines.push(`Soru eventlerindeki joker işareti: ${eventUsage}`);
  }
  jokerLines.push("Joker kullanımının level tamamlama, cevap doğruluğu veya devam etme etkisini kesin ölçmek için JokerTransaction üzerinde session_id, attempt_id, level_id, card_index, effect_success, resulted_in_correct_answer ve resulted_in_level_completion alanları gerekir.");

  const eventHours = /* @__PURE__ */ new Map();
  const eventWeekdays = /* @__PURE__ */ new Map();
  for (const event of events) {
    const stamp = eventTimestamp(event);
    incrementMap(eventHours, istanbulHourKey(stamp));
    incrementMap(eventWeekdays, istanbulWeekdayKey(stamp));
  }
  const peakHours = topMapEntries(eventHours, 3);
  const peakWeekdays = topMapEntries(eventWeekdays, 3);
  const dailyQuestClaims = (diamondTransactions || []).filter((tx) => String(tx?.source || "") === "daily_quest_reward").length;
  const marketDiamondSpends = (diamondTransactions || []).filter((tx) => String(tx?.source || "") === "market_purchase").length;
  const wheelClaims = (dailyWheelSpins || []).length;
  const rhythmLines = [
    peakHours.length ? `En yoğun saat pencereleri (Europe/Istanbul): ${peakHours.map(([hour, count]) => `${hour}:00 (${count} event)`).join(", ")}.` : "Saat bazlı oynanma sinyali için yeterli timestamp yok.",
    peakWeekdays.length ? `En yoğun günler: ${peakWeekdays.map(([day, count]) => `${day} (${count} event)`).join(", ")}.` : "Gün bazlı oynanma sinyali için yeterli timestamp yok.",
    `Günlük görev claim sinyali: ${dailyQuestClaims}; Günlük Çark claim sinyali: ${wheelClaims}; Mağaza diamond spend sinyali: ${marketDiamondSpends}.`,
    "Push bildirim zamanı için bu sinyaller yalnızca yön gösterir; timezone/user local time ayrımı ayrıca yakalanmalıdır."
  ];

  const gameDurations = (gameRecords || [])
    .map((record) => Number(record?.duration_seconds))
    .filter((value) => Number.isFinite(value) && value > 0);
  const avgGameDuration = gameDurations.length
    ? gameDurations.reduce((sum, value) => sum + value, 0) / gameDurations.length
    : 0;
  const retentionLines = [
    `QuestionAttemptEvent attempt_id sayısı: ${uniqueAttempts.size || "Yeterli veri yok"}.`,
    gameDurations.length ? `Legacy GameRecord ortalama süre örneği: ${formatSeconds(avgGameDuration)} (${gameDurations.length} kayıt).` : "Oturum süresi için güncel session event veya kullanılabilir GameRecord örneği yok.",
    mostWrong.length ? `En çok yanlış yapılan soru sayısı sinyali: ${mostWrong.length}; zorluk sıçraması veya arka arkaya zor kart riski manuel incelenmeli.` : "Arka arkaya başarısızlık veya çıkış noktası için yeterli event yok.",
    "Daha uzun oynama analizi için session_id, ended_at, duration_ms, levels_attempted, levels_completed, exit_reason ve next-level CTA click eventleri gerekir."
  ];

  const algorithmLines = [
    shownEvents ? `${shownEvents} gösterimden ${shownQuestionIds.size} benzersiz soru dolaşıma girdi; ortalama tekrar yoğunluğu ${averageShowCount}.` : "Solo algoritması için bu dönemde gösterim yok.",
    neverShownSoloEligible.length ? `${neverShownSoloEligible.length} Solo-eligible soru hiç gösterilmedi; rotation/exposure limitleri ve kategori havuzu genişliği izlenmeli.` : "Solo-eligible havuzda hiç gösterilmeyen soru sinyali bu dönem düşük.",
    topShownShare >= 0.15 ? `En çok gösterilen soru dönem gösterimlerinin ${percent(topShown[0].shown_count, shownEvents)} payını aldı; aynı soru/category/difficulty tekrar limiti değerlendirilmeli.` : "Tek soruya aşırı yığılma sinyali belirgin değil.",
    categoryFairnessSignals.length ? `Kategori denge sinyali: ${categoryFairnessSignals[0].categoryName} - ${categoryFairnessSignals[0].value}.` : "Kategori bazlı belirgin dolaşım riski yok.",
    "No-login/no-preference kullanıcılar all active categories ile devam etmeli; seçili kategori filtresi boş veya zayıf havuz üretirse offline/no-cache diye etiketlenmemeli."
  ];
  const questionTypeQualityLines = [
    bestQuestionTypes.length ? `İyi meydan okuma veren tipler: ${bestQuestionTypes.map(typeRowLabel).join(" | ")}` : "İyi performans gösteren soru tipi için yeterli cevap örneklemi yok.",
    tooHardQuestionTypes.length ? `Zor/review gereken tipler: ${tooHardQuestionTypes.map(typeRowLabel).join(" | ")}` : "Aşırı zor görünen tip için yeterli örneklem yok.",
    tooEasyQuestionTypes.length ? `Çok kolay görünen tipler: ${tooEasyQuestionTypes.map(typeRowLabel).join(" | ")}` : "Aşırı kolay görünen tip için yeterli örneklem yok.",
    questionsMissingMetadata ? `${questionsMissingMetadata} aktif soruda sub_category veya tag eksik; doğru soru tipi öğrenimi için metadata tamamlanmalı.` : "Soru tipi metadata eksiği belirgin değil."
  ];
  const topRisks = [
    neverShownSoloEligible.length ? `Solo havuzda ${neverShownSoloEligible.length} soru hiç dolaşıma girmedi.` : "",
    topShownShare >= 0.15 ? `En çok gösterilen soru payı ${percent(topShown[0].shown_count, shownEvents)}.` : "",
    tooHardQuestionTypes.length ? "Bazı soru tiplerinde doğru oranı düşük; zorluk eğrisi ve içerik kalitesi kontrol edilmeli." : "",
    !jokerTransactions.length ? "Joker kullanım ledger verisi karar için yetersiz." : "",
    !gameDurations.length ? "Oturum süresi/çıkış nedeni instrumentation eksik." : ""
  ].filter(Boolean);
  const recommendedActions = [
    neverShownSoloEligible.length || topShownShare >= 0.15
      ? "High / Algorithm: Aynı category/difficulty tekrar limitini ve hiç gösterilmeyen Solo-eligible soru rotasyonunu ölçen exposure guard ekle."
      : "Medium / Algorithm: Mevcut all-category fallback ve seçili kategori filtre davranışını runtime diagnostics ile izlemeye devam et.",
    tooHardQuestionTypes.length
      ? "High / Content: Düşük doğru oranlı soru tiplerini editorial review kuyruğuna al; ilk seviyelerde arka arkaya zor kartı azalt."
      : "Medium / Content: Tag/sub_category metadata tamlığını koru ve soru tipi bazlı örneklem büyüdükçe kalite eşiklerini netleştir.",
    jokerTransactions.length
      ? "Medium / Economy/Jokers: Joker kullanımını level completion ve sonraki oyun devamı ile ilişkilendirecek event alanlarını ekle."
      : "High / Economy/Jokers: Joker kullanım outcome alanları olmadan fiyat/denge kararı verme; önce instrumentation ekle.",
    peakHours.length
      ? "Medium / Engagement/Retention: Push ve Daily Quest hatırlatmalarını yoğun saatlerden önce test et; sessiz saat varsayımını kullanıcı timezone verisiyle doğrula."
      : "Low / Engagement/Retention: Oynanma zamanı sinyali için timestamp coverage ve timezone bilgisini güçlendir.",
    "High / Instrumentation: session_id, is_guest, selected_category_source, exit_reason, duration_ms ve joker outcome alanlarını QuestionAttemptEvent/JokerTransaction/Session event akışına ekle."
  ];
  const missingInstrumentationRows = [
    events.some((event) => event?.session_id) ? "" : "QuestionAttemptEvent.session_id yok; session length ve retention bağlamı sınırlı.",
    events.some((event) => event?.is_guest === true || event?.is_guest === false) ? "" : "QuestionAttemptEvent.is_guest yok; guest vs logged-in karşılaştırması yapılamıyor.",
    events.some((event) => event?.selected_category_source) ? "" : "selected_category_source yok; user_preferences / all_categories_guest / all_categories_no_preferences ayrımı ölçülemiyor.",
    events.some((event) => event?.exit_reason) ? "" : "exit_reason yok; drop-off ve offline/no-cache ayrımı raporda kesinleşmiyor.",
    jokerTransactions.some((tx) => tx?.resulted_in_level_completion || tx?.resulted_in_correct_answer) ? "" : "JokerTransaction outcome alanları yok; jokerin başarı/retention etkisi ölçülemiyor.",
    gameDurations.length ? "" : "Güncel session duration event akışı yok; GameRecord legacy ve yeterli olmayabilir."
  ].filter(Boolean);

  const executiveSummaryRows = [
    `Dönem özeti: ${shownEvents} gösterim, ${answeredEvents} cevap, ${shownQuestionIds.size} benzersiz gösterilen soru.`,
    `Doğru oranı: ${avgCorrectRate}; ortalama cevap süresi: ${avgResponse}.`,
    `Solo-eligible havuz: ${soloEligibleQuestions.length}; hiç gösterilmeyen Solo-eligible soru: ${neverShownSoloEligible.length}.`,
    topRisks.length ? `Top riskler: ${topRisks.slice(0, 3).join(" | ")}` : "Top risk: Bu dönem için kritik ürün sinyali yok; örneklem büyüdükçe tekrar bakılmalı.",
    `Önerilen ilk aksiyon: ${recommendedActions[0]}`
  ];
  const contentActionLines = [
    mostWrong.length
      ? `Review kuyruğu: ${mostWrong.slice(0, 5).map(formatQuestionBucket).join(" | ")}`
      : "Review kuyruğu için yeterli yanlış cevap örneklemi yok.",
    neverShownSoloEligible.length
      ? `Dolaşıma girmeyen Solo-eligible örnekler: ${neverShownSoloEligible.slice(0, 5).map(formatQuestionSample).filter(Boolean).join(" | ")}`
      : "Solo-eligible havuzda bu dönem belirgin never-shown örnek listesi yok.",
    categoryFairnessSignals.length
      ? `Kategori denge aksiyonu: ${categoryFairnessSignals.slice(0, 3).map((signal) => `${signal.categoryName}: ${signal.value} (${signal.note})`).join(" | ")}`
      : "Kategori denge aksiyonu için bu dönem kritik sinyal yok.",
    tooHardQuestionTypes.length
      ? "Düşük doğru oranlı soru tipleri ilk seviyelerde azaltılmalı veya editorial review ile yeniden yazılmalı."
      : "Zorluk ayarı için daha fazla cevap örneklemi toplanmalı.",
    questionsMissingMetadata
      ? `${questionsMissingMetadata} aktif soruda sub_category/tag eksiği var; içerik kalitesi raporu için metadata tamamlanmalı.`
      : "İçerik metadata eksikliği belirgin değil."
  ];
  const reportSectionNames = [
    "Yönetici Özeti",
    "Genel Kullanım Özeti",
    "Solo Soru Algoritması İçin Sinyaller",
    "Doğru Soru Tiplerini Öğrenme / İçerik Kalitesi",
    "Joker Kullanımı Analizi",
    "Oynanma Zamanı ve Kullanım Ritmi",
    "Daha Uzun Oynama / Retention Sinyalleri",
    "Soru / İçerik Aksiyonları",
    "Önerilen Aksiyonlar",
    "Data Quality / Eksik Ölçüm"
  ];
  const reportSections = [
    { title: "Yönetici Özeti", lines: executiveSummaryRows },
    { title: "Genel Kullanım Özeti", lines: [
      `Toplam event: ${events.length}`,
      `Toplam gösterim: ${shownEvents}`,
      `Cevaplanan soru: ${answeredEvents}`,
      `Benzersiz gösterilen soru: ${shownQuestionIds.size}`,
      `Aktif soru havuzu: ${activeQuestions.length}`,
      `Solo-eligible soru havuzu: ${soloEligibleQuestions.length}`,
      `Hiç gösterilmeyen aktif soru: ${neverShown.length}`,
      `Silinmiş/eksik soru referansı nedeniyle çıkarılan event: ${missing.deleted_or_missing_question}`,
      `Kategori tercihi olan aggregate seçim sayısı: ${totalPreferenceSelections}`,
      ...insightLines
    ] },
    { title: "Solo Soru Algoritması İçin Sinyaller", lines: algorithmLines },
    { title: "Doğru Soru Tiplerini Öğrenme / İçerik Kalitesi", lines: questionTypeQualityLines },
    { title: "Joker Kullanımı Analizi", lines: jokerLines },
    { title: "Oynanma Zamanı ve Kullanım Ritmi", lines: rhythmLines },
    { title: "Daha Uzun Oynama / Retention Sinyalleri", lines: retentionLines },
    { title: "Soru / İçerik Aksiyonları", lines: contentActionLines },
    { title: "Önerilen Aksiyonlar", lines: recommendedActions },
    { title: "Data Quality / Eksik Ölçüm", lines: [
      ...warningRows.map(([label, value]) => `${stripHtml(label)}: ${stripHtml(value)}`),
      ...(missingInstrumentationRows.length ? missingInstrumentationRows : ["Bu dönem için kritik eksik ölçüm sinyali yok."])
    ] }
  ];
  const htmlList = (items) => `<ul style="margin:0;padding-left:18px;color:#111827;font-size:13px;line-height:20px;font-family:Arial,Helvetica,sans-serif;">
    ${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
  </ul>`;
  const summaryCardsHtml = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 12px;border-collapse:collapse;">
    <tr>
      ${summaryCard("Gösterim", String(shownEvents), `${shownQuestionIds.size} benzersiz soru`)}
      ${summaryCard("Cevap", String(answeredEvents), `Doğru oranı ${avgCorrectRate}`)}
      ${summaryCard("Solo Havuz", String(soloEligibleQuestions.length), `${neverShownSoloEligible.length} hiç gösterilmedi`)}
    </tr>
  </table>`;
  const htmlSections = [
    summaryCardsHtml,
    ...reportSections.map((section) => safeSectionHtml(section.title, () => htmlList(section.lines.length ? section.lines : ["Veri yetersiz"])))
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
              <p style="margin:4px 0 0;color:#cbd5e1;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;">Oluşturma zamanı: ${escapeHtml(generatedAt)} · Build: ${escapeHtml(buildMarker || "Bilinmiyor")} · Template: ${escapeHtml(REPORT_TEMPLATE_VERSION)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:18px;background:#ffffff;">
              ${htmlSections}
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px;background:#f8fafc;border-radius:12px;border:1px solid #e5e7eb;">
                <tr><td style="padding:16px 18px;">
                  <p style="margin:0 0 6px;color:#334155;font-size:12px;line-height:18px;font-family:Arial,Helvetica,sans-serif;">Bu rapor yalnızca admin kullanımı içindir.</p>
                  <p style="margin:0 0 6px;color:#334155;font-size:12px;line-height:18px;font-family:Arial,Helvetica,sans-serif;">Rapor kullanıcı takibi için değil, soru dengesi, içerik kalitesi, joker kullanımı ve oynanma ritmi kararları için üretilmiştir.</p>
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
  const textLines = [
    "Kronox Soru Analiz Raporu",
    `Dönem: ${period}`,
    `Oluşturma zamanı: ${generatedAt}`,
    `Build: ${buildMarker || "Bilinmiyor"}`,
    `Template: ${REPORT_TEMPLATE_VERSION}`,
    "",
    ...reportSections.flatMap((section) => [
      `--- ${section.title} ---`,
      ...(section.lines.length ? section.lines : ["Veri yetersiz"]),
      ""
    ]),
    "Bu rapor yalnızca admin kullanımı içindir.",
    "Rapor kullanıcı takibi için değil, soru dengesi ve soru kalitesi kontrolü için üretilmiştir."
  ];
  const reportText = reportSections.map((section) => `--- ${section.title} ---\n${section.lines.join("\n")}`).join("\n\n");
  const bodyRemovedSectionsPresent = findRemovedReportSections(`${html}\n${textLines.join("\n")}`);
  return {
    html,
    text: textLines.join('\n'),
    reportSections,
    reportText,
    period,
    generatedAt,
    buildMarker,
    bodyRemovedSectionsPresent,
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
      categoryAnalyticsRowsAnalyzed: categoryAnalyticsForReport.length,
      staticInventorySectionsRemoved: true,
      productIntelligenceReport: true,
      reportSectionCount: reportSectionNames.length,
      emailBodyMode: "full_product_intelligence_email",
      reportDeliveryMode: "email_body_only",
      removedReportSections: [...REMOVED_REPORT_SECTION_TITLES],
      bodyRemovedSectionsPresent,
      aggregatePreferenceSelectionsAnalyzed: totalPreferenceSelections,
      categoryExposureRowsAnalyzed: categoryAnalyticsForReport.length,
      categoryFairnessSignalCount: categoryFairnessSignals.length,
      reportSections: reportSectionNames,
      productIntelligenceSections: reportSectionNames,
      questionTypeSignalCount: questionTypeRows.length,
      bestQuestionTypeSignalCount: bestQuestionTypes.length,
      difficultQuestionTypeSignalCount: tooHardQuestionTypes.length,
      jokerLedgerRowsAnalyzed: (jokerTransactions || []).length,
      questionJokerEventSignalCount: Array.from(questionJokerByType.values()).reduce((sum, value) => sum + value, 0),
      diamondEconomyRowsAnalyzed: (diamondTransactions || []).length,
      dailyWheelSpinRowsAnalyzed: (dailyWheelSpins || []).length,
      gameRecordRowsAnalyzed: (gameRecords || []).length,
      peakPlayHourCount: peakHours.length,
      missingInstrumentation: missingInstrumentationRows,
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
async function safeListServiceEntity(base44, entityName, order, limit) {
  try {
    const entity = base44?.asServiceRole?.entities?.[entityName];
    if (!entity?.list) return [];
    const rows = await entity.list(order, limit);
    return Array.isArray(rows) ? rows : [];
  } catch (_error) {
    return [];
  }
}
function filterRowsSince(rows, since) {
  return (rows || []).filter((row) => {
    const stamp = rowTimestamp(row);
    return stamp ? stamp >= since : false;
  });
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
    const rawJokerTransactions = await safeListServiceEntity(base44, "JokerTransaction", "-created_at", MAX_JOKER_TRANSACTIONS);
    const rawDiamondTransactions = await safeListServiceEntity(base44, "DiamondTransaction", "-created_at", MAX_DIAMOND_TRANSACTIONS);
    const rawDailyWheelSpins = await safeListServiceEntity(base44, "DailyWheelSpin", "-claimed_at", MAX_DAILY_WHEEL_SPINS);
    const rawGameRecords = await safeListServiceEntity(base44, "GameRecord", "-created_date", MAX_GAME_RECORDS);
    const report = buildReport({
      periodDays,
      events,
      questions: rawQuestions,
      categories: rawCategories,
      categoryPreferences: rawCategoryPreferences,
      jokerTransactions: filterRowsSince(rawJokerTransactions, since),
      diamondTransactions: filterRowsSince(rawDiamondTransactions, since),
      dailyWheelSpins: filterRowsSince(rawDailyWheelSpins, since),
      gameRecords: filterRowsSince(rawGameRecords, since),
      buildMarker: String(body?.buildMarker || REPORT_BUILD_MARKER)
    });
    const emailHtml = report.html;
    const emailText = report.text;
    const sentAt = (/* @__PURE__ */ new Date()).toISOString();
    const reportBuildMarker = String(body?.buildMarker || REPORT_BUILD_MARKER);
    const requiredBodySections = [
      "Yönetici Özeti",
      "Genel Kullanım Özeti",
      "Solo Soru Algoritması İçin Sinyaller",
      "Doğru Soru Tiplerini Öğrenme / İçerik Kalitesi",
      "Joker Kullanımı Analizi",
      "Oynanma Zamanı ve Kullanım Ritmi",
      "Daha Uzun Oynama / Retention Sinyalleri",
      "Soru / İçerik Aksiyonları",
      "Önerilen Aksiyonlar",
      "Data Quality / Eksik Ölçüm"
    ];
    const missingBodySections = requiredBodySections.filter((section) => !emailHtml.includes(section));
    const bodyDiagnostics = {
      reportBuildMarker,
      buildMarker: reportBuildMarker,
      templateVersion: REPORT_TEMPLATE_VERSION,
      emailBodyMode: "full_product_intelligence_email",
      reportDeliveryMode: "email_body_only",
      bodyContainsExecutiveSummary: emailHtml.includes("Yönetici Özeti"),
      bodyContainsProductIntelligenceSections: missingBodySections.length === 0,
      missingBodySections,
      bodyRemovedSectionsPresent: report.bodyRemovedSectionsPresent,
      bodyLength: emailHtml.length,
      sentAt
    };
    if (!bodyDiagnostics.bodyContainsExecutiveSummary || missingBodySections.length || emailHtml.length < 1000 || report.bodyRemovedSectionsPresent.length) {
      await writeJobLog(base44, admin.user, "body_validation_failed", { periodDays, requestedBy: requestedByEmail, recipientEmail, adminAuthorized: true, emailDispatchStatus: "not_sent", ...bodyDiagnostics });
      return json({ ok: false, error: "report_body_validation_failed", requestedBy: requestedByEmail, recipientEmail, adminAuthorized: true, emailDispatchStatus: "not_sent", ...bodyDiagnostics }, 500);
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
