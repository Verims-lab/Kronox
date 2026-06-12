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
const MAX_USER_JOKER_INVENTORY = 1e4;
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
const REPORT_BUILD_MARKER = "Codex322";
const REPORT_TEMPLATE_VERSION = "nine-section-email-v1";
const REPORT_TEMPLATE_LABEL = "nine-section-email-v1";
const REQUIRED_REPORT_SECTION_TITLES = Object.freeze([
  "Executive Summary",
  "Kategori Bazında Soru Havuzu",
  "Kategori Tercihleri",
  "Kategori Bazında Gösterim",
  "En Çok Gösterilen Sorular",
  "Az ya da Hiç Gösterilmeyen Sorular",
  "En Çok Yanlış Yapılan Sorular",
  "Joker Kullanımı Analizi",
  "Oynanma Zamanı ve Kullanım Ritmi"
]);
const REPORT_SECTION_HTML_MARKERS = Object.freeze([
  "--- Executive Summary ---",
  "--- Kategori Bazında Soru Havuzu ---",
  "--- Kategori Tercihleri ---",
  "--- Kategori Bazında Gösterim ---",
  "--- En Çok Gösterilen Sorular ---",
  "--- Az ya da Hiç Gösterilmeyen Sorular ---",
  "--- En Çok Yanlış Yapılan Sorular ---",
  "--- Joker Kullanımı Analizi ---",
  "--- Oynanma Zamanı ve Kullanım Ritmi ---"
]);
const REPORT_SECTION_HTML_MARKER_BY_TITLE = Object.freeze(Object.fromEntries(
  REQUIRED_REPORT_SECTION_TITLES.map((title, index) => [title, REPORT_SECTION_HTML_MARKERS[index]])
));
const REMOVED_REPORT_SECTION_TITLES = Object.freeze([
  "Rapor Şablonu",
  "Rapor Bölümleri",
  "Sistemdeki Soru Havuzu: Kategori / Zorluk Dağılımı",
  "Kategori ve Zorluk Bazında Kayıtlı Soru Sayısı",
  "Kategori Bazında Yıl Aralığı",
  "Kategori İçi Soru Analizi"
]);
const STRICTLY_DISALLOWED_REPORT_BODY_TITLES = Object.freeze([
  ...REMOVED_REPORT_SECTION_TITLES
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
  return STRICTLY_DISALLOWED_REPORT_BODY_TITLES.filter((title) => text.includes(title));
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
  const marker = REPORT_SECTION_HTML_MARKER_BY_TITLE[title] || `--- ${title} ---`;
  try {
    return `<!-- ${escapeHtml(marker)} -->${sectionHtml(title, renderBody())}`;
  } catch (error) {
    const reason = error instanceof Error ? error.message : "section_render_failed";
    console.error(`[${JOB_NAME}] section_render_failed`, title, reason);
    return `<!-- ${escapeHtml(marker)} -->${sectionHtml(title, sectionWarningHtml(`${title} bölümü oluşturulamadı; raporun kalan bölümleri devam ediyor.`))}`;
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
function summaryCardGrid(cards) {
  const rows = [];
  for (let index = 0; index < cards.length; index += 3) {
    const slice = cards.slice(index, index + 3);
    const cells = [
      ...slice.map((card) => summaryCard(card.label, card.value, card.helper)),
      ...Array.from({ length: Math.max(0, 3 - slice.length) }, () => `<td width="33.33%" style="padding:6px;">&nbsp;</td>`)
    ].join("");
    rows.push(`<tr>${cells}</tr>`);
  }
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:-6px 0 0;border-collapse:collapse;">${rows.join("")}</table>`;
}
function textBlockHtml(value) {
  return `<p style="margin:0 0 12px;color:#475569;font-size:12px;line-height:18px;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(value)}</p>`;
}
function tableCaptionHtml(value) {
  return `<p style="margin:14px 0 8px;color:#334155;font-size:13px;line-height:18px;font-weight:700;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(value)}</p>`;
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
  userJokerInventory = [],
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
  let shownEvents = 0;
  let answeredEvents = 0;
  let sportsShown = 0;
  const staleQuestionIds = /* @__PURE__ */ new Set();
  for (const event of events) {
    const qid = questionKey(event?.question_id);
    if (!qid) {
      missing.question_id += 1;
      continue;
    }
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
  const topShown = [...bucketList].filter((bucket) => bucket.shown_count > 0).sort(sortDesc("shown_count")).slice(0, 10);
  const topSubcategoryConcentration = getTopShownSubcategoryConcentration(topShown);
  const mostWrong = [...bucketList]
    .filter((bucket) => bucket.shown_count >= 3 && bucket.wrong_count > 0)
    .sort((a, b) => {
      const wrongDiff = (Number(b?.wrong_count) || 0) - (Number(a?.wrong_count) || 0);
      if (wrongDiff) return wrongDiff;
      const aAnswered = (Number(a?.correct_count) || 0) + (Number(a?.wrong_count) || 0);
      const bAnswered = (Number(b?.correct_count) || 0) + (Number(b?.wrong_count) || 0);
      const aRate = aAnswered ? (Number(a?.correct_count) || 0) / aAnswered : 1;
      const bRate = bAnswered ? (Number(b?.correct_count) || 0) / bAnswered : 1;
      if (aRate !== bRate) return aRate - bRate;
      return (Number(b?.shown_count) || 0) - (Number(a?.shown_count) || 0);
    })
    .slice(0, QUESTION_TABLE_LIMIT);
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
  const totalPreferenceSelections = categoryAnalytics.reduce((sum, row) => sum + (Number(row.selectedUserCount) || 0), 0);
  const cell = (value) => escapeHtml(value === null || value === undefined || value === "" ? "-" : value);
  const questionIdFor = (question) => questionKey(question?.id ?? question?.question_id);
  const categoryNameForQuestion = (question) => categoryLabel(getCategoryId(question), categoryMap);
  const dateLabel = (value) => {
    const raw = String(value || "").trim();
    if (!raw) return "Yok";
    return raw.length >= 10 ? raw.slice(0, 10) : raw;
  };
  const answeredForBucket = (bucket) => (Number(bucket?.correct_count) || 0) + (Number(bucket?.wrong_count) || 0);
  const correctRateForBucket = (bucket) => {
    const answered = answeredForBucket(bucket);
    return answered ? (Number(bucket?.correct_count) || 0) / answered : null;
  };

  const executiveCards = summaryCardGrid([
    { label: "Toplam Gösterim", value: String(shownEvents), helper: "Bu dönemde oyuncuya gösterilen soru sayısı" },
    { label: "Cevaplanan Soru", value: String(answeredEvents), helper: "Yerleştirme sonucu olan event sayısı" },
    { label: "Benzersiz Gösterilen Soru", value: String(shownQuestionIds.size), helper: "En az bir kez gösterilen farklı soru" },
    { label: "Aktif Soru Havuzu (Tüm Aktifler)", value: String(activeQuestions.length), helper: "Rapor anında aktif görünen tüm soru satırları" },
    { label: "Solo-Eligible Soru", value: String(soloEligibleQuestions.length), helper: "Aktif, yıl ve aktif kategori bilgisi kullanılabilir sorular" },
    { label: "Hiç Gösterilmeyen Aktif Soru", value: String(neverShown.length), helper: "Tüm aktif havuz içinde bu dönemde görünmeyenler" },
    { label: "Hiç Gösterilmeyen Solo-Eligible", value: String(neverShownSoloEligible.length), helper: "hiç gösterilmeyen Solo-eligible soru sayısı" },
    { label: "Runtime Projection", value: "Yeterli veri yok", helper: "Runtime projection: getQuestions diagnostics ile ölçülür; e-posta raporu canlı projection çağırmaz." },
    { label: "Ortalama Doğru Oranı", value: avgCorrectRate, helper: "Cevaplanmış eventler üzerinden" },
    { label: "Ortalama Cevap Süresi", value: avgResponse, helper: "Response time olan cevaplar üzerinden" }
  ]);

  const categoryPoolRows = categoryAnalyticsForReport.length ? categoryAnalyticsForReport.map((row) => [
    cell(`${row.categoryName} (#${row.categoryId})`),
    cell(row.activeQuestionCount),
    cell(row.difficultyCounts?.["1"] || 0),
    cell(row.difficultyCounts?.["2"] || 0),
    cell(row.difficultyCounts?.["3"] || 0),
    cell(row.difficultyCounts?.["4"] || 0),
    cell(row.difficultyCounts?.["5"] || 0),
    cell(row.difficultyCounts?.unknown || 0),
    cell(row.oldestYear ?? "-"),
    cell(row.newestYear ?? "-")
  ]) : [["Veri yok", "0", "0", "0", "0", "0", "0", "0", "-", "-"]];
  const categoryPoolHtml = [
    categoryAnalytics.length > CATEGORY_ANALYTICS_ROW_LIMIT ? textBlockHtml(`${CATEGORY_ANALYTICS_ROW_LIMIT}/${categoryAnalytics.length} kategori gösteriliyor.`) : "",
    tableHtml([
      "Kategori",
      "Toplam Soru",
      "Zorluk 1",
      "Zorluk 2",
      "Zorluk 3",
      "Zorluk 4",
      "Zorluk 5",
      "Zorluk Bilinmiyor",
      "En Eski Yıl",
      "En Yeni Yıl"
    ], categoryPoolRows, "Bu dönem için kategori soru havuzu verisi yok")
  ].join("");

  const categoryPreferenceRows = totalPreferenceSelections > 0
    ? categoryAnalyticsForReport.map((row) => [
      cell(row.categoryId),
      cell(row.categoryName),
      cell(row.selectedUserCount),
      cell(percent(row.selectedUserCount, totalPreferenceSelections))
    ])
    : [["-", "Bu dönem için kategori tercihi verisi yok", "0", "0%"]];
  const categoryPreferenceHtml = tableHtml([
    "Kategori ID",
    "Kategori",
    "Tercih Eden Kullanıcı",
    "Tercih Payı"
  ], categoryPreferenceRows, "Bu dönem için kategori tercihi verisi yok");

  const categoryExposureRows = categoryAnalyticsForReport.length ? categoryAnalyticsForReport.map((row) => [
    cell(row.categoryId),
    cell(row.categoryName),
    cell(row.activeQuestionCount),
    cell(row.shownCount),
    cell(row.uniqueShownQuestionCount),
    cell(row.answeredCount),
    cell(row.correctRate === null ? "Yeterli veri yok" : percent(row.correctRate, 1)),
    cell(row.avgResponseTimeMs ? formatMs(row.avgResponseTimeMs) : "-"),
    cell(percent(row.shownCount, shownEvents))
  ]) : [["-", "Veri yok", "0", "0", "0", "0", "Yeterli veri yok", "-", "0%"]];
  const concentrationGuardrailText = topSubcategoryConcentration.topShownSubcategoryTotal > 0
    ? `Not: En çok gösterilen kategori/subcategory (${topSubcategoryConcentration.topShownSubcategory}, ${percent(topSubcategoryConcentration.topShownSubcategoryCount, topSubcategoryConcentration.topShownSubcategoryTotal)}) dağılımı pool-proportional değildir diye otomatik varsayılmaz; dağılım Solo-eligible havuzla karşılaştırılmalıdır.`
    : "Not: En çok gösterilen kategori/subcategory dağılımı pool-proportional değildir diye otomatik varsayılmaz; dağılım Solo-eligible havuzla karşılaştırılmalıdır.";
  const categoryExposureHtml = [
    textBlockHtml(concentrationGuardrailText),
    tableHtml([
    "Kategori ID",
    "Kategori",
    "Aktif Soru",
    "Gösterim",
    "Benzersiz Gösterilen",
    "Cevaplanan",
    "Doğru %",
    "Ort. Süre",
    "Gösterim Payı"
    ], categoryExposureRows, "Bu dönem için kategori gösterim verisi yok")
  ].join("");

  const maxShown = Math.max(1, ...topShown.map((bucket) => Number(bucket.shown_count) || 0));
  const topShownRows = topShown.length ? topShown.map((bucket, index) => {
    const q = bucket.question || {};
    const shownCell = `${cell(bucket.shown_count)}${barHtml(Number(bucket.shown_count) || 0, maxShown, "#f59e0b", 96)}`;
    return [
      cell(index + 1),
      cell(questionKey(bucket.question_id)),
      cell(shortText(q.question, 90)),
      cell(questionYearLabel(bucket)),
      cell(questionCategoryLabel(bucket, categoryMap)),
      cell(questionSubCategoryLabel(bucket)),
      shownCell,
      cell(correctRateLabel(bucket)),
      cell(formatMs(avgResponseMs(bucket))),
      cell(bucket.swap_count || 0)
    ];
  }) : [["-", "Veri yok", "Bu dönem için gösterilen soru verisi yok", "-", "-", "-", "0", "Yeterli veri yok", "-", "0"]];
  const topShownHtml = tableHtml([
    "#",
    "Question ID",
    "Soru",
    "Yıl",
    "Kategori",
    "Alt Kategori",
    "Gösterim",
    "Doğru %",
    "Ort. Süre",
    "Swap"
  ], topShownRows, "Bu dönem için gösterilen soru verisi yok");

  const underusedRows = [];
  const underusedSeen = /* @__PURE__ */ new Set();
  for (const question of neverShownSoloEligible.slice(0, NEVER_SHOWN_SAMPLE_LIMIT)) {
    const id = questionIdFor(question);
    if (!id) continue;
    underusedSeen.add(id);
    underusedRows.push([
      cell(id),
      cell(shortText(question?.question, 90)),
      cell(getQuestionYear(question) ?? "-"),
      cell(categoryNameForQuestion(question)),
      cell(displayValue(question?.sub_category, "Bilinmiyor")),
      "0",
      "Yok",
      "Hiç gösterilmedi"
    ]);
  }
  if (underusedRows.length < NEVER_SHOWN_SAMPLE_LIMIT) {
    const lowShownLimit = Math.max(1, Math.ceil(Math.max(averageShowCount, 1) * 0.5));
    const lowShownBuckets = bucketList
      .filter((bucket) => bucket.question && bucket.shown_count > 0 && bucket.shown_count <= lowShownLimit && !underusedSeen.has(bucket.question_id) && isSoloEligibleQuestion(bucket.question, activeCategoryIds))
      .sort((a, b) => (Number(a?.shown_count) || 0) - (Number(b?.shown_count) || 0) || String(a?.question_id).localeCompare(String(b?.question_id)))
      .slice(0, NEVER_SHOWN_SAMPLE_LIMIT - underusedRows.length);
    for (const bucket of lowShownBuckets) {
      underusedRows.push([
        cell(bucket.question_id),
        cell(shortText(bucket.question?.question, 90)),
        cell(questionYearLabel(bucket)),
        cell(questionCategoryLabel(bucket, categoryMap)),
        cell(questionSubCategoryLabel(bucket)),
        cell(bucket.shown_count),
        cell(dateLabel(bucket.last_shown_at)),
        "Az gösterildi"
      ]);
    }
  }
  const underusedHtml = [
    textBlockHtml(`${neverShown.length} aktif soru ve ${neverShownSoloEligible.length} Solo-eligible soru bu dönemde hiç gösterilmedi. Liste, Solo-eligible hiç gösterilmeyenleri ve ardından düşük gösterim alanları önceliklendirir.`),
    tableHtml([
      "Question ID",
      "Soru",
      "Yıl",
      "Kategori",
      "Alt Kategori",
      "Gösterim",
      "Son Gösterim",
      "Not"
    ], underusedRows.length ? underusedRows : [["-", "Bu dönem için az ya da hiç gösterilmeyen soru yok", "-", "-", "-", "0", "-", "Veri yok"]], "Bu dönem için az ya da hiç gösterilmeyen soru yok")
  ].join("");

  const wrongRows = mostWrong.length ? mostWrong.map((bucket) => {
    const correctRate = correctRateForBucket(bucket);
    const note = correctRate !== null && correctRate <= 0.35
      ? "Çok yanıltıcı olabilir"
      : correctRate !== null && correctRate <= 0.5
        ? "Zor olabilir"
        : "Kontrol edilmeli";
    return [
      cell(bucket.question_id),
      cell(shortText(bucket.question?.question, 92)),
      cell(questionYearLabel(bucket)),
      cell(bucket.shown_count),
      cell(bucket.wrong_count),
      cell(correctRate === null ? "Yeterli veri yok" : percent(correctRate, 1)),
      cell(formatMs(avgResponseMs(bucket))),
      cell(note)
    ];
  }) : [["-", "Yeterli veri yok", "-", "0", "0", "Yeterli veri yok", "-", "Yeterli veri yok"]];
  const wrongHtml = tableHtml([
    "Question ID",
    "Soru",
    "Yıl",
    "Gösterim",
    "Yanlış",
    "Doğru %",
    "Ort. Süre",
    "Not"
  ], wrongRows, "Bu dönem için yeterli yanlış cevap verisi yok");

  const jokerUsageByType = /* @__PURE__ */ new Map();
  const jokerPurchaseByType = /* @__PURE__ */ new Map();
  const questionJokerByType = /* @__PURE__ */ new Map();
  const jokerUsageUsersByType = /* @__PURE__ */ new Map();
  const jokerPurchaseUsersByType = /* @__PURE__ */ new Map();
  const jokerLevelsByType = /* @__PURE__ */ new Map();
  const jokerOutcomeByType = /* @__PURE__ */ new Map();
  const rowUserKey = (row) => normalizeEmail(row?.user_email || row?.email || row?.userEmail) || String(row?.user_id || row?.userId || row?.created_by || "").trim();
  const ensureSet = (map, key) => {
    if (!map.has(key)) map.set(key, /* @__PURE__ */ new Set());
    return map.get(key);
  };
  const ensureArray = (map, key) => {
    if (!map.has(key)) map.set(key, []);
    return map.get(key);
  };
  for (const tx of jokerTransactions || []) {
    const type = normalizeJokerType(tx?.joker_type);
    if (!type) continue;
    const delta = Number(tx?.quantity_delta) || 0;
    const reason = String(tx?.reason || "").trim();
    const userKey = rowUserKey(tx);
    if (reason === "solo_use" || delta < 0) {
      incrementMap(jokerUsageByType, type, Math.max(1, Math.abs(delta)));
      if (userKey) ensureSet(jokerUsageUsersByType, type).add(userKey);
      const level = Number(tx?.level_id ?? tx?.level ?? tx?.metadata?.level_id ?? tx?.metadata?.level);
      if (Number.isFinite(level) && level > 0) ensureArray(jokerLevelsByType, type).push(level);
      const outcomeKnown = tx?.resulted_in_level_completion !== undefined || tx?.resulted_in_correct_answer !== undefined || tx?.metadata?.resulted_in_level_completion !== undefined || tx?.metadata?.resulted_in_correct_answer !== undefined;
      if (outcomeKnown) {
        const current = jokerOutcomeByType.get(type) || { known: 0, success: 0 };
        current.known += 1;
        if (tx?.resulted_in_level_completion === true || tx?.resulted_in_correct_answer === true || tx?.metadata?.resulted_in_level_completion === true || tx?.metadata?.resulted_in_correct_answer === true) current.success += 1;
        jokerOutcomeByType.set(type, current);
      }
    }
    if (reason === "market_purchase") {
      incrementMap(jokerPurchaseByType, type, Math.max(1, Math.abs(delta)));
      if (userKey) ensureSet(jokerPurchaseUsersByType, type).add(userKey);
    }
  }
  const jokerBreakdown = /* @__PURE__ */ new Map();
  for (const event of events) {
    const inferredType = eventType(event) === "swapped_out" || event?.was_swapped_out === true ? "card_swap" : "";
    if (!event?.joker_used && !event?.joker_type && !inferredType) continue;
    const type = normalizeJokerType(event?.joker_type || inferredType);
    incrementMap(questionJokerByType, type || "unknown");
    if (!type || type === "unknown") continue;
    const q = questionById.get(questionKey(event?.question_id));
    const category = categoryLabel(getCategoryId(q) || event?.category_id || "unknown", categoryMap);
    const difficulty = difficultyLabel(getQuestionDifficultyBucket(q));
    const key = `${type}:${category}:${difficulty}`;
    const current = jokerBreakdown.get(key) || { type, category, difficulty, usage: 0, answered: 0, correct: 0, completionKnown: 0, completed: 0 };
    current.usage += 1;
    if (eventType(event) === "answered") {
      current.answered += 1;
      if (event?.is_correct === true) current.correct += 1;
    }
    if (event?.resulted_in_level_completion === true || event?.resulted_in_level_completion === false) {
      current.completionKnown += 1;
      if (event?.resulted_in_level_completion === true) current.completed += 1;
    }
    jokerBreakdown.set(key, current);
  }
  const jokerTypes = [
    { type: "mistake_shield", name: "Kronokalkan" },
    { type: "card_swap", name: "Kart Değiştir" },
    { type: "time_freeze", name: "Zaman Dondur" }
  ];
  const inventoryByType = /* @__PURE__ */ new Map();
  const depletedUsersByType = /* @__PURE__ */ new Map();
  for (const row of userJokerInventory || []) {
    const type = normalizeJokerType(row?.joker_type);
    if (!type) continue;
    const quantity = Math.max(0, Number(row?.quantity) || 0);
    inventoryByType.set(type, (inventoryByType.get(type) || 0) + quantity);
    const userKey = rowUserKey(row);
    if (quantity <= 0 && userKey) ensureSet(depletedUsersByType, type).add(userKey);
  }
  const hasInventoryRows = (userJokerInventory || []).length > 0;
  const jokerSummaryRows = jokerTypes.map(({ type, name }) => {
    const ledgerUsage = jokerUsageByType.get(type) || 0;
    const eventUsage = questionJokerByType.get(type) || 0;
    const usage = ledgerUsage || eventUsage || 0;
    const levels = jokerLevelsByType.get(type) || [];
    const outcome = jokerOutcomeByType.get(type);
    const avgLevel = levels.length ? Math.round(levels.reduce((sum, value) => sum + value, 0) / levels.length * 10) / 10 : null;
    const note = usage
      ? outcome?.known ? "Outcome alanı kısmen mevcut" : "Başarı etkisi için outcome alanı eksik"
      : "Bu dönem kullanım verisi yok";
    return [
      cell(name),
      cell(type),
      cell(usage),
      cell(jokerPurchaseByType.get(type) || 0),
      cell(ledgerUsage || 0),
      cell(jokerUsageUsersByType.get(type)?.size || (usage ? "Yeterli veri yok" : 0)),
      cell(avgLevel === null ? "Yeterli veri yok" : avgLevel),
      cell(outcome?.known ? percent(outcome.success, outcome.known) : "Yeterli veri yok"),
      cell(note)
    ];
  });
  const jokerBreakdownRows = jokerBreakdown.size
    ? Array.from(jokerBreakdown.values())
      .sort((a, b) => b.usage - a.usage || a.type.localeCompare(b.type))
      .slice(0, 12)
      .map((row) => [
        cell(jokerDisplayName(row.type)),
        cell(row.category),
        cell(row.difficulty),
        cell(row.usage),
        cell(row.answered ? percent(row.correct, row.answered) : "Yeterli veri yok"),
        cell(row.completionKnown ? percent(row.completed, row.completionKnown) : "Yeterli veri yok"),
        cell(row.completionKnown ? "Completion alanı mevcut" : "resulted_in_level_completion eksik")
      ])
    : jokerTypes.map(({ name }) => [
      cell(name),
      "Veri yetersiz",
      "Veri yetersiz",
      "0",
      "Yeterli veri yok",
      "Yeterli veri yok",
      cell("QuestionAttemptEvent joker_type / kategori / zorluk / resulted_in_level_completion alanları eksik")
    ]);
  const jokerStockRows = jokerTypes.map(({ type, name }) => [
    cell(name),
    cell(hasInventoryRows ? inventoryByType.get(type) || 0 : "Yeterli veri yok"),
    cell(jokerPurchaseUsersByType.get(type)?.size || 0),
    cell(hasInventoryRows ? depletedUsersByType.get(type)?.size || 0 : "Yeterli veri yok"),
    cell((jokerPurchaseByType.get(type) || 0) ? `${jokerPurchaseByType.get(type)} satın alma` : "Yeterli veri yok"),
    cell(hasInventoryRows ? "UserJokerInventory current balance okundu" : "UserJokerInventory satırı yok veya erişilemedi")
  ]);
  const jokerHtml = [
    tableCaptionHtml("Joker Tipi Özeti"),
    tableHtml([
      "Joker",
      "Joker Type",
      "Kullanım",
      "Satın Alma",
      "Harcanan / Kullanılan",
      "Kullanıcı Sayısı",
      "Ortalama Kullanım Seviyesi",
      "Başarıya Etki",
      "Not"
    ], jokerSummaryRows, "Bu dönem için joker verisi yok"),
    tableCaptionHtml("Joker Kullanımı - Kategori / Zorluk Kırılımı"),
    tableHtml([
      "Joker",
      "Kategori",
      "Zorluk",
      "Kullanım",
      "Doğru %",
      "Level Tamamlama %",
      "Not"
    ], jokerBreakdownRows, "Bu dönem için joker kırılım verisi yok"),
    tableCaptionHtml("Joker Stok / Ekonomi Sinyali"),
    tableHtml([
      "Joker",
      "Toplam Mevcut Bakiye",
      "Satın Alan Kullanıcı",
      "Tükenen Kullanıcı",
      "Market Etkisi",
      "Not"
    ], jokerStockRows, "Bu dönem için joker stok verisi yok")
  ].join("");

  const dailyQuestClaims = (diamondTransactions || []).filter((tx) => String(tx?.source || "") === "daily_quest_reward").length;
  const marketDiamondSpends = (diamondTransactions || []).filter((tx) => String(tx?.source || "") === "market_purchase").length;
  const wheelClaims = (dailyWheelSpins || []).length;
  const makeTimeStats = () => ({
    shown: 0,
    answered: 0,
    correct: 0,
    responseMs: 0,
    responseCount: 0,
    sessionIds: /* @__PURE__ */ new Set(),
    attemptIds: /* @__PURE__ */ new Set()
  });
  const addTimeEvent = (stats, event) => {
    const type = eventType(event);
    if (type === "shown" || type === "replacement_shown") stats.shown += 1;
    if (type === "answered") {
      stats.answered += 1;
      if (event?.is_correct === true) stats.correct += 1;
      const responseMs = Math.max(0, Math.floor(safeNumber(event?.response_time_ms)));
      if (responseMs > 0) {
        stats.responseMs += responseMs;
        stats.responseCount += 1;
      }
    }
    if (event?.session_id) stats.sessionIds.add(String(event.session_id));
    if (event?.attempt_id) stats.attemptIds.add(String(event.attempt_id));
  };
  const hourBuckets = [
    { label: "00:00-03:59", start: 0, end: 3, stats: makeTimeStats() },
    { label: "04:00-07:59", start: 4, end: 7, stats: makeTimeStats() },
    { label: "08:00-11:59", start: 8, end: 11, stats: makeTimeStats() },
    { label: "12:00-15:59", start: 12, end: 15, stats: makeTimeStats() },
    { label: "16:00-19:59", start: 16, end: 19, stats: makeTimeStats() },
    { label: "20:00-23:59", start: 20, end: 23, stats: makeTimeStats() }
  ];
  const weekdayOrder = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];
  const weekdayStats = new Map(weekdayOrder.map((day) => [day, makeTimeStats()]));
  for (const event of events) {
    const stamp = eventTimestamp(event);
    const hour = Number(istanbulHourKey(stamp));
    const hourBucket = hourBuckets.find((bucket) => Number.isFinite(hour) && hour >= bucket.start && hour <= bucket.end);
    if (hourBucket) addTimeEvent(hourBucket.stats, event);
    const weekday = displayValue(istanbulWeekdayKey(stamp), "");
    const weekdayTitle = weekday ? weekday.charAt(0).toLocaleUpperCase("tr-TR") + weekday.slice(1) : "";
    if (weekdayStats.has(weekdayTitle)) addTimeEvent(weekdayStats.get(weekdayTitle), event);
  }
  const sessionLabel = (stats) => {
    if (stats.sessionIds.size) return String(stats.sessionIds.size);
    if (stats.attemptIds.size) return `${stats.attemptIds.size} attempt`;
    return "Yeterli veri yok";
  };
  const timeNote = (stats) => stats.sessionIds.size ? "session_id mevcut" : "QuestionAttemptEvent timestamp / attempt_id yaklaşımı";
  const hourRows = hourBuckets.map((bucket) => [
    cell(bucket.label),
    cell(sessionLabel(bucket.stats)),
    cell(bucket.stats.shown),
    cell(bucket.stats.answered),
    cell(bucket.stats.answered ? percent(bucket.stats.correct, bucket.stats.answered) : "Yeterli veri yok"),
    cell(bucket.stats.responseCount ? formatMs(Math.round(bucket.stats.responseMs / bucket.stats.responseCount)) : "-"),
    cell(timeNote(bucket.stats))
  ]);
  const dayRows = weekdayOrder.map((day) => {
    const stats = weekdayStats.get(day) || makeTimeStats();
    return [
      cell(day),
      cell(sessionLabel(stats)),
      cell(stats.shown),
      cell(stats.answered),
      cell(stats.answered ? percent(stats.correct, stats.answered) : "Yeterli veri yok"),
      cell(stats.responseCount ? formatMs(Math.round(stats.responseMs / stats.responseCount)) : "-"),
      cell(timeNote(stats))
    ];
  });
  const activeHourBuckets = hourBuckets.filter((bucket) => bucket.stats.shown || bucket.stats.answered);
  const peakHour = activeHourBuckets.length ? [...activeHourBuckets].sort((a, b) => b.stats.shown - a.stats.shown)[0] : null;
  const quietHour = activeHourBuckets.length ? [...activeHourBuckets].sort((a, b) => a.stats.shown - b.stats.shown)[0] : null;
  const bestCorrectHour = activeHourBuckets
    .filter((bucket) => bucket.stats.answered >= 3)
    .sort((a, b) => b.stats.correct / b.stats.answered - a.stats.correct / a.stats.answered)[0] || null;
  const slowestHour = activeHourBuckets
    .filter((bucket) => bucket.stats.responseCount > 0)
    .sort((a, b) => b.stats.responseMs / b.stats.responseCount - a.stats.responseMs / a.stats.responseCount)[0] || null;
  const activitySignalRows = [
    ["En yoğun saat aralığı", peakHour ? `${peakHour.label} (${peakHour.stats.shown} gösterim)` : "Yeterli veri yok", "QuestionAttemptEvent timestamp üzerinden"],
    ["En düşük saat aralığı", quietHour ? `${quietHour.label} (${quietHour.stats.shown} gösterim)` : "Yeterli veri yok", "Sessiz saat için daha fazla veri gerekebilir"],
    ["En yüksek doğru oranı zamanı", bestCorrectHour ? `${bestCorrectHour.label} (${percent(bestCorrectHour.stats.correct, bestCorrectHour.stats.answered)})` : "Yeterli veri yok", "En az 3 cevap olan saat bucket'ı aranır"],
    ["En uzun cevap süresi zamanı", slowestHour ? `${slowestHour.label} (${formatMs(Math.round(slowestHour.stats.responseMs / slowestHour.stats.responseCount))})` : "Yeterli veri yok", "Response time olan cevaplar üzerinden"],
    ["Bildirim / görev için önerilen zaman", peakHour ? `${peakHour.label} öncesi test edilebilir` : "Yeterli veri yok", `Daily Quest: ${dailyQuestClaims}; Daily Wheel: ${wheelClaims}; Market spend: ${marketDiamondSpends}`]
  ].map((row) => row.map(cell));
  const rhythmHtml = [
    textBlockHtml("Saat ve gün kırılımı Europe/Istanbul biçimlendirmesiyle hesaplanır. Kullanıcı yerel timezone'u ayrı yakalanmadığı için bu bölüm runtime/server zamanına yakınsama olarak okunmalıdır."),
    tableCaptionHtml("Saat Bazında Oynanma"),
    tableHtml([
      "Saat Aralığı",
      "Oturum / Başlangıç",
      "Gösterim",
      "Cevaplanan",
      "Doğru %",
      "Ort. Cevap Süresi",
      "Not"
    ], hourRows, "Bu dönem için saat bazlı oynanma verisi yok"),
    tableCaptionHtml("Gün Bazında Oynanma"),
    tableHtml([
      "Gün",
      "Oturum / Başlangıç",
      "Gösterim",
      "Cevaplanan",
      "Doğru %",
      "Ortalama Süre",
      "Not"
    ], dayRows, "Bu dönem için gün bazlı oynanma verisi yok"),
    tableCaptionHtml("Aktivite Sinyali"),
    tableHtml(["Sinyal", "Değer", "Yorum"], activitySignalRows, "Bu dönem için aktivite sinyali yok")
  ].join("");

  const reportSectionNames = [...REQUIRED_REPORT_SECTION_TITLES];
  const reportSections = [
    { title: "Executive Summary", textLines: [
      `Toplam gösterim: ${shownEvents}`,
      `Cevaplanan soru: ${answeredEvents}`,
      `Benzersiz gösterilen soru: ${shownQuestionIds.size}`,
      `Aktif soru havuzu: ${activeQuestions.length}`,
      `Solo-eligible soru: ${soloEligibleQuestions.length}`,
      `Hiç gösterilmeyen aktif soru: ${neverShown.length}`,
      `hiç gösterilmeyen Solo-eligible soru: ${neverShownSoloEligible.length}`,
      "Runtime Projection: getQuestions diagnostics ile ölçülür; e-posta raporu canlı projection çağırmaz.",
      `Ortalama doğru oranı: ${avgCorrectRate}`,
      `Ortalama cevap süresi: ${avgResponse}`
    ] },
    { title: "Kategori Bazında Soru Havuzu", textLines: [`${categoryAnalyticsForReport.length}/${categoryAnalytics.length} kategori satırı.`, `Aktif soru havuzu: ${activeQuestions.length}`] },
    { title: "Kategori Tercihleri", textLines: [`Aggregate tercih seçimi: ${totalPreferenceSelections || "Yeterli veri yok"}`] },
    { title: "Kategori Bazında Gösterim", textLines: [`Gösterim: ${shownEvents}`, `Kategori satırı: ${categoryAnalyticsForReport.length}`] },
    { title: "En Çok Gösterilen Sorular", textLines: topShown.length ? topShown.map(formatQuestionBucket) : ["Veri yok"] },
    { title: "Az ya da Hiç Gösterilmeyen Sorular", textLines: [`Hiç gösterilmeyen aktif soru: ${neverShown.length}`, `Hiç gösterilmeyen Solo-eligible soru: ${neverShownSoloEligible.length}`] },
    { title: "En Çok Yanlış Yapılan Sorular", textLines: mostWrong.length ? mostWrong.map(formatQuestionBucket) : ["Yeterli veri yok"] },
    { title: "Joker Kullanımı Analizi", textLines: [
      `JokerTransaction satırı: ${(jokerTransactions || []).length}`,
      `UserJokerInventory satırı: ${(userJokerInventory || []).length}`,
      `Joker event sinyali: ${Array.from(questionJokerByType.values()).reduce((sum, value) => sum + value, 0) || "Yeterli veri yok"}`
    ] },
    { title: "Oynanma Zamanı ve Kullanım Ritmi", textLines: [
      peakHour ? `En yoğun saat aralığı: ${peakHour.label}` : "Saat bazlı veri yetersiz",
      `Daily Quest: ${dailyQuestClaims}; Daily Wheel: ${wheelClaims}; Market spend: ${marketDiamondSpends}`
    ] }
  ];
  const htmlSections = [
    safeSectionHtml("Executive Summary", () => executiveCards),
    safeSectionHtml("Kategori Bazında Soru Havuzu", () => categoryPoolHtml),
    safeSectionHtml("Kategori Tercihleri", () => categoryPreferenceHtml),
    safeSectionHtml("Kategori Bazında Gösterim", () => categoryExposureHtml),
    safeSectionHtml("En Çok Gösterilen Sorular", () => topShownHtml),
    safeSectionHtml("Az ya da Hiç Gösterilmeyen Sorular", () => underusedHtml),
    safeSectionHtml("En Çok Yanlış Yapılan Sorular", () => wrongHtml),
    safeSectionHtml("Joker Kullanımı Analizi", () => jokerHtml),
    safeSectionHtml("Oynanma Zamanı ve Kullanım Ritmi", () => rhythmHtml)
  ].join("");
  const html = `<!doctype html>
<html>
<body style="margin:0;padding:0;background:#eef2f7;color:#111827;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f7;padding:22px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="760" cellpadding="0" cellspacing="0" style="width:760px;max-width:100%;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #dbe3ef;">
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
                  <p style="margin:0 0 6px;color:#334155;font-size:12px;line-height:18px;font-family:Arial,Helvetica,sans-serif;">Rapor kullanıcı takibi için değil, soru havuzu, kategori tercihi, gösterim dengesi, joker kullanımı ve oynanma ritmi kararları için üretilmiştir.</p>
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
    "",
    ...reportSections.flatMap((section) => [
      `--- ${section.title} ---`,
      ...(section.textLines.length ? section.textLines : ["Veri yetersiz"]),
      ""
    ]),
    "Bu rapor yalnızca admin kullanımı içindir.",
    "Rapor kullanıcı takibi için değil, soru havuzu ve oynanma ritmi kontrolü için üretilmiştir."
  ];
  const reportText = reportSections.map((section) => `--- ${section.title} ---\n${section.textLines.join("\n")}`).join("\n\n");
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
      runtimeProjectionSizeSource: "getQuestions diagnostics / projectionDiagnostics admin/Health path",
      templateVersion: REPORT_TEMPLATE_VERSION,
      reportTemplateMarker: REPORT_TEMPLATE_LABEL,
      categoryAnalyticsRowsAnalyzed: categoryAnalyticsForReport.length,
      legacyStaticInventorySectionsRemoved: true,
      nineSectionEmailReport: true,
      reportSectionCount: reportSectionNames.length,
      emailBodyMode: "nine_section_email_body",
      reportDeliveryMode: "email_body_only",
      removedReportSections: [...REMOVED_REPORT_SECTION_TITLES],
      disallowedReportSections: [...STRICTLY_DISALLOWED_REPORT_BODY_TITLES],
      bodyRemovedSectionsPresent,
      aggregatePreferenceSelectionsAnalyzed: totalPreferenceSelections,
      categoryExposureRowsAnalyzed: categoryAnalyticsForReport.length,
      reportSections: reportSectionNames,
      jokerLedgerRowsAnalyzed: (jokerTransactions || []).length,
      userJokerInventoryRowsAnalyzed: (userJokerInventory || []).length,
      questionJokerEventSignalCount: Array.from(questionJokerByType.values()).reduce((sum, value) => sum + value, 0),
      diamondEconomyRowsAnalyzed: (diamondTransactions || []).length,
      dailyWheelSpinRowsAnalyzed: (dailyWheelSpins || []).length,
      gameRecordRowsAnalyzed: (gameRecords || []).length,
      peakPlayHour: peakHour?.label || null,
      requiredSectionOrderValid: true,
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
    const rawUserJokerInventory = await safeListServiceEntity(base44, "UserJokerInventory", "-updated_at", MAX_USER_JOKER_INVENTORY);
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
      userJokerInventory: rawUserJokerInventory,
      diamondTransactions: filterRowsSince(rawDiamondTransactions, since),
      dailyWheelSpins: filterRowsSince(rawDailyWheelSpins, since),
      gameRecords: filterRowsSince(rawGameRecords, since),
      buildMarker: String(body?.buildMarker || REPORT_BUILD_MARKER)
    });
    const emailHtml = report.html;
    const emailText = report.text;
    const sentAt = (/* @__PURE__ */ new Date()).toISOString();
    const reportBuildMarker = String(body?.buildMarker || REPORT_BUILD_MARKER);
    const requiredBodySections = [...REQUIRED_REPORT_SECTION_TITLES];
    const missingBodySections = requiredBodySections.filter((section) => !emailHtml.includes(section));
    const sectionPositions = requiredBodySections.map((section) => emailHtml.indexOf(section));
    const requiredSectionOrderValid = sectionPositions.every((position, index) => position >= 0 && (index === 0 || position > sectionPositions[index - 1]));
    const renderedSectionHeaderCount = (emailHtml.match(/<h2 /g) || []).length;
    const reportSectionCount = Array.isArray(report.reportSections) ? report.reportSections.length : 0;
    const bodyContainsExactlyRequiredSections = missingBodySections.length === 0 && requiredSectionOrderValid && renderedSectionHeaderCount === requiredBodySections.length && reportSectionCount === requiredBodySections.length;
    const bodyDiagnostics = {
      reportBuildMarker,
      buildMarker: reportBuildMarker,
      templateVersion: REPORT_TEMPLATE_VERSION,
      emailBodyMode: "nine_section_email_body",
      reportDeliveryMode: "email_body_only",
      bodyContainsExecutiveSummary: emailHtml.includes("Executive Summary"),
      bodyContainsNineRequiredSections: missingBodySections.length === 0,
      bodyContainsExactlyRequiredSections,
      requiredSectionOrderValid,
      renderedSectionHeaderCount,
      reportSectionCount,
      requiredBodySections,
      missingBodySections,
      bodyRemovedSectionsPresent: report.bodyRemovedSectionsPresent,
      bodyLength: emailHtml.length,
      sentAt
    };
    if (!bodyDiagnostics.bodyContainsExecutiveSummary || !bodyContainsExactlyRequiredSections || emailHtml.length < 1000 || report.bodyRemovedSectionsPresent.length) {
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
