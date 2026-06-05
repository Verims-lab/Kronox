import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { requireAdmin } from '../_shared/adminAuth.ts';

const JOB_NAME = 'sendQuestionAnalyticsReportEmail';
const MAX_EVENTS = 5000;
const MAX_QUESTIONS = 5000;
const MAX_CATEGORIES = 1000;
const NEVER_SHOWN_SAMPLE_LIMIT = 20;
const PERIOD_OPTIONS = new Set([1, 7, 30]);
const REPORT_BUILD_MARKER = 'Codex200';

function json(payload: unknown, status = 200) {
  return Response.json(payload, { status });
}

function normalizeEmail(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

async function readBody(req: Request) {
  try {
    return await req.json();
  } catch (_error) {
    return {};
  }
}

function clampPeriodDays(value: unknown) {
  const number = Number(value);
  if (PERIOD_OPTIONS.has(number)) return number;
  return 7;
}

function eventTimestamp(event: any) {
  return String(event?.answered_at || event?.shown_at || event?.created_at || '');
}

function eventType(event: any) {
  return String(event?.event_type || (event?.answered_at ? 'answered' : 'shown')).trim();
}

function safeNumber(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function questionKey(value: unknown) {
  return String(value ?? '').trim();
}

function shortText(value: unknown, limit = 72) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return '(metin yok)';
  return text.length > limit ? `${text.slice(0, limit - 3)}...` : text;
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function displayValue(value: unknown, fallback = 'Bilinmiyor') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function percent(part: number, total: number) {
  if (!total) return '0%';
  return `${Math.round((part / total) * 1000) / 10}%`;
}

function formatMs(ms: number) {
  if (!ms) return '-';
  return `${Math.round(ms / 100) / 10}s`;
}

function getQuestionYear(question: any) {
  const year = Number(question?.year ?? question?.answer_year ?? question?.answer);
  return Number.isFinite(year) ? year : null;
}

function periodLabel(periodDays: number) {
  return `Son ${periodDays} Gün`;
}

function formatIstanbulTimestamp(date = new Date()) {
  try {
    return new Intl.DateTimeFormat('tr-TR', {
      timeZone: 'Europe/Istanbul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch (_error) {
    return date.toISOString();
  }
}

function isActiveQuestion(question: any) {
  return String(question?.state || 'A').toUpperCase() === 'A';
}

function isSportsLike(values: unknown[]) {
  const text = values.map((value) => String(value || '').toLowerCase()).join(' ');
  return [
    'spor',
    'sport',
    'futbol',
    'football',
    'basket',
    'tenis',
    'tennis',
    'olimp',
    'olymp',
    'formula',
    'f1',
  ].some((token) => text.includes(token));
}

function getBucket(map: Map<string, any>, id: string, question: any = null) {
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
      last_shown_at: '',
      last_answered_at: '',
    });
  }
  const bucket = map.get(id);
  if (question && !bucket.question) bucket.question = question;
  return bucket;
}

function sortDesc(field: string) {
  return (a: any, b: any) => (Number(b?.[field]) || 0) - (Number(a?.[field]) || 0);
}

function buildCategoryMap(categories: any[]) {
  const map = new Map<string, string>();
  for (const category of categories || []) {
    const id = String(category?.category_id ?? category?.id ?? '').trim();
    if (!id) continue;
    map.set(id, String(category?.name || `Kategori ID: ${id}`));
  }
  return map;
}

function categoryLabel(categoryId: unknown, categoryMap: Map<string, string>) {
  const id = String(categoryId ?? '').trim();
  if (!id || id === 'unknown') return 'Bilinmiyor';
  return categoryMap.get(id) || `Kategori ID: ${id}`;
}

function questionCategoryLabel(bucket: any, categoryMap: Map<string, string>) {
  const q = bucket?.question || {};
  return categoryLabel(q.main_category_id ?? bucket?.category_id, categoryMap);
}

function questionSubCategoryLabel(bucket: any) {
  const q = bucket?.question || {};
  return displayValue(q.sub_category || bucket?.sub_category);
}

function questionYearLabel(bucket: any) {
  const q = bucket?.question || {};
  return getQuestionYear(q) ?? bucket?.answer_year ?? 'Yok';
}

function correctRateLabel(bucket: any) {
  const answered = (Number(bucket?.correct_count) || 0) + (Number(bucket?.wrong_count) || 0);
  return answered ? percent(Number(bucket?.correct_count) || 0, answered) : 'Yeterli veri yok';
}

function avgResponseMs(bucket: any) {
  return bucket?.response_count ? Math.round(bucket.total_response_time_ms / bucket.response_count) : 0;
}

function barHtml(value: number, max: number, color = '#f5b301', width = 120) {
  const pct = max > 0 ? Math.max(0, Math.min(100, Math.round((value / max) * 100))) : 0;
  return `<div style="width:${width}px;background:#eef2f7;border-radius:6px;height:8px;overflow:hidden;">
    <div style="width:${pct}%;background:${color};border-radius:6px;height:8px;line-height:8px;">&nbsp;</div>
  </div>`;
}

function badgeHtml(label: string, tone: 'ok' | 'warn' | 'risk') {
  const palette = {
    ok: ['#dcfce7', '#166534'],
    warn: ['#fef3c7', '#92400e'],
    risk: ['#fee2e2', '#991b1b'],
  }[tone];
  return `<span style="display:inline-block;padding:3px 8px;border-radius:999px;background:${palette[0]};color:${palette[1]};font-size:11px;font-weight:700;">${escapeHtml(label)}</span>`;
}

function sectionHtml(title: string, body: string) {
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

function emptyStateHtml(message: string) {
  return `<p style="margin:0;padding:12px 14px;background:#f8fafc;border:1px dashed #cbd5e1;border-radius:10px;color:#475569;font-size:13px;line-height:20px;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(message)}</p>`;
}

function tableHtml(headers: string[], rows: string[][], emptyMessage: string) {
  if (!rows.length) return emptyStateHtml(emptyMessage);
  const headerHtml = headers.map((header) => `<th align="left" style="padding:9px 8px;border-bottom:1px solid #dbe3ef;background:#f1f5f9;color:#334155;font-size:11px;line-height:15px;text-transform:uppercase;letter-spacing:.04em;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(header)}</th>`).join('');
  const rowsHtml = rows.map((row) => `<tr>${row.map((cell) => `<td valign="top" style="padding:9px 8px;border-bottom:1px solid #eef2f7;color:#111827;font-size:12px;line-height:17px;font-family:Arial,Helvetica,sans-serif;">${cell}</td>`).join('')}</tr>`).join('');
  return `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">${headerHtml ? `<tr>${headerHtml}</tr>` : ''}${rowsHtml}</table>`;
}

function summaryCard(label: string, value: string | number, helper: string) {
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

function buildReport({
  periodDays,
  events,
  questions,
  categories,
  buildMarker,
}: {
  periodDays: number;
  events: any[];
  questions: any[];
  categories: any[];
  buildMarker: string;
}) {
  const categoryMap = buildCategoryMap(categories);
  const questionById = new Map<string, any>();
  const activeQuestions = [];
  for (const question of questions) {
    const id = questionKey(question?.id ?? question?.question_id);
    if (!id) continue;
    questionById.set(id, question);
    if (isActiveQuestion(question)) activeQuestions.push(question);
  }

  const buckets = new Map<string, any>();
  const categoryBuckets = new Map<string, any>();
  const missing = {
    question_id: 0,
    answer_year: 0,
    sub_category_or_tags: 0,
    outcome: 0,
  };
  const questionsMissingMetadata = activeQuestions.filter((question) => !question?.sub_category || !question?.tag).length;
  let shownEvents = 0;
  let answeredEvents = 0;
  let sportsShown = 0;
  const uniqueAttempts = new Set<string>();

  for (const event of events) {
    const qid = questionKey(event?.question_id);
    if (!qid) {
      missing.question_id += 1;
      continue;
    }
    if (event?.attempt_id) uniqueAttempts.add(String(event.attempt_id));
    const q = questionById.get(qid) || null;
    const bucket = getBucket(buckets, qid, q);
    const type = eventType(event);
    const isShown = type === 'shown' || type === 'replacement_shown';
    const isAnswered = type === 'answered';
    const isSwap = type === 'swapped_out' || event?.was_swapped_out === true;
    const categoryId = event?.category_id ?? q?.main_category_id ?? 'unknown';
    const subCategory = event?.sub_category || q?.sub_category || 'unknown';
    const tag = event?.tags || q?.tag || '';
    const answerYear = safeNumber(event?.answer_year ?? getQuestionYear(q), NaN);

    bucket.category_id = categoryId;
    bucket.sub_category = subCategory;
    bucket.answer_year = Number.isFinite(answerYear) ? answerYear : bucket.answer_year;
    if (!Number.isFinite(answerYear)) missing.answer_year += 1;
    if (!subCategory || subCategory === 'unknown' || !tag) missing.sub_category_or_tags += 1;
    if (isAnswered && event?.is_correct !== true && event?.is_correct !== false) missing.outcome += 1;

    if (isShown) {
      shownEvents += 1;
      bucket.shown_count += 1;
      const shownAt = String(event?.shown_at || event?.created_at || '');
      if (shownAt && shownAt > bucket.last_shown_at) bucket.last_shown_at = shownAt;
      const categoryKey = `${categoryId} / ${subCategory}`;
      const categoryBucket = categoryBuckets.get(categoryKey) || {
        category_id: categoryId,
        sub_category: subCategory,
        shown_count: 0,
        correct_count: 0,
        wrong_count: 0,
      };
      categoryBucket.shown_count += 1;
      categoryBuckets.set(categoryKey, categoryBucket);
      if (isSportsLike([subCategory, tag, categoryId, q?.category])) sportsShown += 1;
    }
    if (isAnswered) {
      answeredEvents += 1;
      const answeredAt = String(event?.answered_at || '');
      if (answeredAt && answeredAt > bucket.last_answered_at) bucket.last_answered_at = answeredAt;
      if (event?.is_correct === true) bucket.correct_count += 1;
      if (event?.is_correct === false) bucket.wrong_count += 1;
      const responseMs = Math.max(0, Math.floor(safeNumber(event?.response_time_ms)));
      if (responseMs > 0) {
        bucket.total_response_time_ms += responseMs;
        bucket.response_count += 1;
      }
      const categoryKey = `${categoryId} / ${subCategory}`;
      const categoryBucket = categoryBuckets.get(categoryKey);
      if (categoryBucket) {
        if (event?.is_correct === true) categoryBucket.correct_count += 1;
        if (event?.is_correct === false) categoryBucket.wrong_count += 1;
      }
    }
    if (isSwap) bucket.swap_count += 1;
  }

  const bucketList = [...buckets.values()];
  const shownQuestionIds = new Set(bucketList.filter((bucket) => bucket.shown_count > 0).map((bucket) => bucket.question_id));
  const neverShown = activeQuestions.filter((question) => !shownQuestionIds.has(questionKey(question?.id ?? question?.question_id)));
  const topShown = [...bucketList].sort(sortDesc('shown_count')).slice(0, 20);
  const topShownMax = Math.max(1, ...topShown.map((bucket) => Number(bucket.shown_count) || 0));
  const mostWrong = [...bucketList]
    .filter((bucket) => bucket.shown_count >= 3 && bucket.wrong_count > 0)
    .sort(sortDesc('wrong_count'))
    .slice(0, 20);
  const easy = [...bucketList]
    .filter((bucket) => bucket.shown_count >= 3 && (bucket.correct_count + bucket.wrong_count) >= 3)
    .sort((a, b) => {
      const ar = a.correct_count / Math.max(1, a.correct_count + a.wrong_count);
      const br = b.correct_count / Math.max(1, b.correct_count + b.wrong_count);
      return br - ar;
    })
    .slice(0, 20);
  const slow = [...bucketList]
    .filter((bucket) => bucket.response_count > 0)
    .sort((a, b) => (b.total_response_time_ms / b.response_count) - (a.total_response_time_ms / a.response_count))
    .slice(0, 20);
  const categoryRows = [...categoryBuckets.values()]
    .sort(sortDesc('shown_count'))
    .slice(0, 30);
  const categoryMax = Math.max(1, ...categoryRows.map((row) => Number(row.shown_count) || 0));
  const totalCorrect = bucketList.reduce((sum, bucket) => sum + (Number(bucket.correct_count) || 0), 0);
  const totalWrong = bucketList.reduce((sum, bucket) => sum + (Number(bucket.wrong_count) || 0), 0);
  const answeredTotal = totalCorrect + totalWrong;
  const avgCorrectRate = answeredTotal ? percent(totalCorrect, answeredTotal) : 'Yeterli veri yok';
  const totalResponseMs = bucketList.reduce((sum, bucket) => sum + (Number(bucket.total_response_time_ms) || 0), 0);
  const totalResponseCount = bucketList.reduce((sum, bucket) => sum + (Number(bucket.response_count) || 0), 0);
  const avgResponse = totalResponseCount ? formatMs(Math.round(totalResponseMs / totalResponseCount)) : 'Yeterli veri yok';
  const averageShowCount = shownQuestionIds.size ? Math.round((shownEvents / shownQuestionIds.size) * 10) / 10 : 0;
  const generatedAt = formatIstanbulTimestamp();
  const period = periodLabel(periodDays);
  const topShownShare = topShown[0]?.shown_count && shownEvents ? topShown[0].shown_count / shownEvents : 0;
  const sportsShare = shownEvents ? sportsShown / shownEvents : 0;

  const insightRows = [];
  if (shownEvents === 0) {
    insightRows.push(['OK', 'ok', 'Bu dönem için yeterli oynanış verisi yok. Birkaç Solo oyun oynandıktan sonra raporu yeniden oluşturun.']);
  } else {
    insightRows.push(['OK', 'ok', `${shownEvents} gösterim ve ${answeredEvents} cevap event'i analiz edildi.`]);
  }
  if (neverShown.length > 0) {
    insightRows.push(['Dikkat', 'warn', `${neverShown.length} aktif soru bu dönemde hiç gösterilmedi.`]);
  }
  if (topShownShare >= 0.15) {
    insightRows.push(['Risk', 'risk', `En çok gösterilen soru dönem gösterimlerinin ${percent(topShown[0].shown_count, shownEvents)} kadarını oluşturuyor.`]);
  }
  if (sportsShare >= 0.35) {
    insightRows.push(['Dikkat', 'warn', `Spor benzeri içeriklerin payı ${percent(sportsShown, shownEvents)}.`]);
  }
  if (questionsMissingMetadata > 0 || missing.answer_year > 0 || missing.sub_category_or_tags > 0) {
    insightRows.push(['Dikkat', 'warn', 'Bazı soru/event satırlarında yıl, kategori, alt kategori veya tag metadata eksik.']);
  }

  const summaryCards = [
    summaryCard('Toplam gösterim', shownEvents, 'Bu dönemde oyuncuya gösterilen soru sayısı'),
    summaryCard('Cevaplanan soru', answeredEvents, 'Yerleştirme sonucu olan event sayısı'),
    summaryCard('Benzersiz gösterilen soru', shownQuestionIds.size, 'En az bir kez gösterilen farklı soru'),
    summaryCard('Aktif soru havuzu', activeQuestions.length, 'Rapor anında aktif görünen soru sayısı'),
    summaryCard('Hiç gösterilmeyen aktif soru', neverShown.length, 'Bu dönemde hiç görünmeyen aktif sorular'),
    summaryCard('Ortalama doğru oranı', avgCorrectRate, 'Cevaplanmış eventler üzerinden'),
    summaryCard('Ortalama cevap süresi', avgResponse, 'Response time olan cevaplar üzerinden'),
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
    escapeHtml(bucket.swap_count),
  ]);

  const neverShownSample = neverShown.slice(0, NEVER_SHOWN_SAMPLE_LIMIT);
  const neverShownRows = neverShownSample.map((question) => [
    escapeHtml(`#${questionKey(question?.id ?? question?.question_id)}`),
    escapeHtml(shortText(question?.question, 100)),
    escapeHtml(getQuestionYear(question) ?? 'Yok'),
    escapeHtml(categoryLabel(question?.main_category_id, categoryMap)),
    escapeHtml(displayValue(question?.sub_category)),
    'Yok',
  ]);

  const wrongRows = mostWrong.map((bucket) => {
    const answered = bucket.correct_count + bucket.wrong_count;
    const correctRate = answered ? bucket.correct_count / answered : 0;
    const note = correctRate <= 0.5 ? 'Zor olabilir' : 'Kontrol edilmeli';
    return [
      escapeHtml(`#${bucket.question_id}`),
      escapeHtml(shortText(bucket.question?.question, 100)),
      escapeHtml(questionYearLabel(bucket)),
      escapeHtml(bucket.shown_count),
      escapeHtml(bucket.wrong_count),
      escapeHtml(correctRateLabel(bucket)),
      escapeHtml(formatMs(avgResponseMs(bucket))),
      escapeHtml(note),
    ];
  });

  const easyRows = easy.map((bucket) => [
    escapeHtml(`#${bucket.question_id}`),
    escapeHtml(shortText(bucket.question?.question, 100)),
    escapeHtml(questionYearLabel(bucket)),
    escapeHtml(bucket.shown_count),
    escapeHtml(correctRateLabel(bucket)),
    escapeHtml(formatMs(avgResponseMs(bucket))),
    'Çok kolay olabilir',
  ]);

  const slowRows = slow.map((bucket) => [
    escapeHtml(`#${bucket.question_id}`),
    escapeHtml(shortText(bucket.question?.question, 100)),
    escapeHtml(questionYearLabel(bucket)),
    escapeHtml(bucket.shown_count),
    escapeHtml(formatMs(avgResponseMs(bucket))),
    escapeHtml(correctRateLabel(bucket)),
  ]);

  const categoryTableRows = categoryRows.map((row) => {
    const answered = row.correct_count + row.wrong_count;
    const share = percent(row.shown_count, shownEvents);
    return [
      escapeHtml(categoryLabel(row.category_id, categoryMap)),
      escapeHtml(displayValue(row.sub_category)),
      escapeHtml(row.shown_count),
      escapeHtml(share),
      escapeHtml(answered ? percent(row.correct_count, answered) : 'Yeterli veri yok'),
      barHtml(row.shown_count, categoryMax, '#0ea5e9'),
    ];
  });

  const warningRows = [
    ['Events missing question_id', missing.question_id],
    ['Events missing answer_year', missing.answer_year],
    ['Events missing category/sub_category', missing.sub_category_or_tags],
    ['Questions missing metadata', questionsMissingMetadata],
    ['Events without outcome', missing.outcome],
    ['Projection limitation', 'QuestionStatsProjection refresh remains manual via aggregateQuestionStats.'],
    ['Manual proof limitation', 'Canlı e-posta teslimatı, RLS ve yüksek hacimli analytics yazımı manuel doğrulama gerektirir.'],
  ].map(([label, value]) => [
    escapeHtml(label),
    escapeHtml(value),
  ]);

  const insightHtml = `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
    ${insightRows.map(([label, tone, message]) => `<tr>
      <td valign="top" style="padding:8px 0;width:86px;">${badgeHtml(String(label), tone as 'ok' | 'warn' | 'risk')}</td>
      <td valign="top" style="padding:8px 0;color:#111827;font-size:13px;line-height:20px;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(message)}</td>
    </tr>`).join('')}
  </table>`;

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
              <p style="margin:4px 0 0;color:#cbd5e1;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;">Oluşturma zamanı: ${escapeHtml(generatedAt)} · Build: ${escapeHtml(buildMarker || 'Bilinmiyor')}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:18px;background:#ffffff;">
              ${sectionHtml('Executive Summary', `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>${summaryCards.slice(0, 3).join('')}</tr>
                <tr>${summaryCards.slice(3, 6).join('')}</tr>
                <tr>${summaryCards.slice(6).join('')}</tr>
              </table>`)}
              ${sectionHtml('Key Insights / Risk Flags', insightHtml)}
              ${sectionHtml('En Çok Gösterilen Sorular', tableHtml(
    ['#', 'Question ID', 'Soru', 'Yıl', 'Kategori', 'Alt kategori', 'Gösterim', 'Doğru %', 'Ort. süre', 'Swap'],
    topShownRows,
    'Bu dönemde gösterilen soru verisi yok.',
  ))}
              ${sectionHtml('Az veya Hiç Gösterilmeyen Sorular', `
                <p style="margin:0 0 12px;color:#334155;font-size:13px;line-height:20px;font-family:Arial,Helvetica,sans-serif;">Toplam ${escapeHtml(neverShown.length)} aktif soru bu dönemde hiç gösterilmedi. ${neverShown.length > NEVER_SHOWN_SAMPLE_LIMIT ? 'İlk 20 örnek aşağıdadır.' : ''}</p>
                ${tableHtml(['Question ID', 'Soru', 'Yıl', 'Kategori', 'Alt kategori', 'Son gösterim'], neverShownRows, 'Hiç gösterilmeyen aktif soru bulunmadı.')}
              `)}
              ${sectionHtml('En Çok Yanlış Yapılan Sorular', tableHtml(
    ['Question ID', 'Soru', 'Yıl', 'Gösterim', 'Yanlış', 'Doğru %', 'Ort. süre', 'Not'],
    wrongRows,
    'Yeterli örneklem yok.',
  ))}
              ${sectionHtml('Çok Kolay Görünen Sorular', tableHtml(
    ['Question ID', 'Soru', 'Yıl', 'Gösterim', 'Doğru %', 'Ort. süre', 'Not'],
    easyRows,
    'Yeterli örneklem yok.',
  ))}
              ${sectionHtml('En Uzun Sürede Cevaplanan Sorular', tableHtml(
    ['Question ID', 'Soru', 'Yıl', 'Gösterim', 'Ort. süre', 'Doğru %'],
    slowRows,
    'Cevap süresi verisi yok.',
  ))}
              ${sectionHtml('Kategori ve Alt Kategori Dağılımı', tableHtml(
    ['Kategori', 'Alt kategori', 'Gösterim', 'Pay', 'Doğru %', 'Dağılım'],
    categoryTableRows,
    'Kategori / alt kategori dağılım verisi yok.',
  ))}
              ${sectionHtml('Veri Kalitesi Uyarıları', tableHtml(['Kontrol', 'Durum'], warningRows, 'Veri kalitesi uyarısı yok.'))}
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

  const topTextRows = topShown.length
    ? topShown.map((bucket, index) => `${index + 1}. #${bucket.question_id} | ${shortText(bucket.question?.question, 100)} | yıl=${questionYearLabel(bucket)} | kategori=${questionCategoryLabel(bucket, categoryMap)} | gösterim=${bucket.shown_count} | doğru=${correctRateLabel(bucket)} | süre=${formatMs(avgResponseMs(bucket))}`)
    : ['Bu dönemde gösterilen soru verisi yok.'];
  const neverTextRows = neverShownSample.length
    ? neverShownSample.map((question, index) => `${index + 1}. #${questionKey(question?.id ?? question?.question_id)} | ${shortText(question?.question, 100)} | yıl=${getQuestionYear(question) ?? 'Yok'} | kategori=${categoryLabel(question?.main_category_id, categoryMap)} | alt=${displayValue(question?.sub_category)}`)
    : ['Hiç gösterilmeyen aktif soru bulunmadı.'];
  const textLines = [
    'Kronox Soru Analiz Raporu',
    `Dönem: ${period}`,
    `Oluşturma zamanı: ${generatedAt}`,
    `Build: ${buildMarker || 'Bilinmiyor'}`,
    '',
    '--- Executive Summary ---',
    `Toplam gösterim: ${shownEvents}`,
    `Cevaplanan soru: ${answeredEvents}`,
    `Benzersiz gösterilen soru: ${shownQuestionIds.size}`,
    `Aktif soru havuzu: ${activeQuestions.length}`,
    `Hiç gösterilmeyen aktif soru: ${neverShown.length}`,
    `Ortalama doğru oranı: ${avgCorrectRate}`,
    `Ortalama cevap süresi: ${avgResponse}`,
    '',
    '--- Key Insights / Risk Flags ---',
    ...insightRows.map(([label, _tone, message]) => `${label}: ${message}`),
    '',
    '--- En Çok Gösterilen Sorular ---',
    ...topTextRows,
    '',
    '--- Az veya Hiç Gösterilmeyen Sorular ---',
    `Toplam hiç gösterilmeyen aktif soru: ${neverShown.length}`,
    ...neverTextRows,
    '',
    '--- En Çok Yanlış Yapılan Sorular ---',
    ...(wrongRows.length ? mostWrong.map((bucket) => `#${bucket.question_id} | ${shortText(bucket.question?.question, 100)} | yanlış=${bucket.wrong_count} | doğru=${correctRateLabel(bucket)}`) : ['Yeterli örneklem yok.']),
    '',
    '--- Çok Kolay Görünen Sorular ---',
    ...(easyRows.length ? easy.map((bucket) => `#${bucket.question_id} | ${shortText(bucket.question?.question, 100)} | doğru=${correctRateLabel(bucket)}`) : ['Yeterli örneklem yok.']),
    '',
    '--- En Uzun Sürede Cevaplanan Sorular ---',
    ...(slowRows.length ? slow.map((bucket) => `#${bucket.question_id} | ${shortText(bucket.question?.question, 100)} | süre=${formatMs(avgResponseMs(bucket))} | doğru=${correctRateLabel(bucket)}`) : ['Cevap süresi verisi yok.']),
    '',
    '--- Kategori ve Alt Kategori Dağılımı ---',
    ...(categoryRows.length ? categoryRows.map((row) => `${categoryLabel(row.category_id, categoryMap)} / ${displayValue(row.sub_category)} | gösterim=${row.shown_count} | pay=${percent(row.shown_count, shownEvents)}`) : ['Kategori / alt kategori dağılım verisi yok.']),
    '',
    '--- Veri Kalitesi Uyarıları ---',
    ...warningRows.map(([label, value]) => `${label}: ${value}`),
    '',
    'Bu rapor yalnızca admin kullanımı içindir.',
    'Rapor kullanıcı takibi için değil, soru dengesi ve soru kalitesi kontrolü için üretilmiştir.',
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
      neverShownActiveQuestions: neverShown.length,
      sportsShown,
    },
  };
}

async function writeJobLog(base44: any, user: any, result: string, metadata: Record<string, unknown>) {
  try {
    await base44.asServiceRole.entities.AdminMaintenanceLog.create({
      action: `admin:${JOB_NAME}`,
      job_name: JOB_NAME,
      admin_email: normalizeEmail(user?.email),
      target_email: normalizeEmail(user?.email),
      result,
      retention_status: 'active',
      metadata,
      created_at: new Date().toISOString(),
    });
  } catch (_error) {}
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405);
    const base44 = createClientFromRequest(req);
    const admin = await requireAdmin(base44);
    if (admin.response) return admin.response;

    const body = await readBody(req);
    const periodDays = clampPeriodDays(body?.periodDays);
    const recipient = normalizeEmail(body?.recipientEmail || admin.user?.email);
    if (!recipient) return json({ ok: false, error: 'Report recipient is required' }, 400);

    const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString();
    const rawEvents = await base44.asServiceRole.entities.QuestionAttemptEvent.list('-created_at', MAX_EVENTS).catch(() => []);
    const events = rawEvents.filter((event: any) => eventTimestamp(event) >= since);
    const rawQuestions = await base44.asServiceRole.entities.Question.list('-created_date', MAX_QUESTIONS).catch(() => []);
    const rawCategories = await base44.asServiceRole.entities.Category.list('-created_date', MAX_CATEGORIES).catch(() => []);
    const report = buildReport({
      periodDays,
      events,
      questions: rawQuestions,
      categories: rawCategories,
      buildMarker: String(body?.buildMarker || REPORT_BUILD_MARKER),
    });
    const subject = `Kronox Soru Analiz Raporu — ${periodLabel(periodDays)}`;

    try {
      await base44.integrations.Core.SendEmail({
        from_name: 'Kronox',
        to: recipient,
        subject,
        body: report.html,
        html: report.html,
        text: report.text,
        body_text: report.text,
      });
    } catch (mailError) {
      const reason = mailError instanceof Error ? mailError.message : 'send failed';
      await writeJobLog(base44, admin.user, 'email_failed', { periodDays, recipient, reason });
      return json({ ok: false, error: 'email_failed' }, 502);
    }

    const summary = {
      ok: true,
      jobName: JOB_NAME,
      periodDays,
      recipient,
      ...report.summary,
    };
    await writeJobLog(base44, admin.user, 'success', summary);
    return json(summary);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[${JOB_NAME}] failed`, message);
    return json({ ok: false, error: 'report_failed' }, 500);
  }
});
