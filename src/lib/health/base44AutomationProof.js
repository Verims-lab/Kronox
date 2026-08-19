const AUTOMATION_TYPES = new Set(['scheduled', 'entity', 'connector']);
const SCHEDULE_MODES = new Set(['recurring', 'one-time']);
const SCHEDULE_TYPES = new Set(['cron', 'simple']);
const REPEAT_UNITS = new Set(['minutes', 'hours', 'days', 'weeks', 'months']);
const ENTITY_EVENTS = new Set(['create', 'update', 'delete']);
const CLEANUP_NAME_PATTERN = /cleanup|delete|reset|duplicate|integrity|artifact/i;
const SAFE_AUTOMATION_MODES = new Set(['dry_run', 'report_only', 'read_only']);
const PRIVATE_LOG_IDENTIFIERS = [
  'email',
  'owner_key',
  'guest_id',
  'guest_token',
  'player_key',
  'actor_key',
  'auth_id',
  'provider_id',
  'subscriptionId',
  'privateKey',
  'VAPID_PRIVATE_KEY',
  'secret',
];

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function stripJsoncComments(source) {
  const value = String(source || '');
  let output = '';
  let inString = false;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    const next = value[index + 1];
    if (lineComment) {
      if (char === '\n') {
        lineComment = false;
        output += char;
      } else {
        output += ' ';
      }
      continue;
    }
    if (blockComment) {
      if (char === '*' && next === '/') {
        blockComment = false;
        output += '  ';
        index += 1;
      } else {
        output += char === '\n' ? '\n' : ' ';
      }
      continue;
    }
    if (inString) {
      output += char;
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      output += char;
      continue;
    }
    if (char === '/' && next === '/') {
      lineComment = true;
      output += '  ';
      index += 1;
      continue;
    }
    if (char === '/' && next === '*') {
      blockComment = true;
      output += '  ';
      index += 1;
      continue;
    }
    output += char;
  }
  return output;
}

function stripTrailingCommas(source) {
  const value = String(source || '');
  let output = '';
  let inString = false;
  let escaped = false;
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (inString) {
      output += char;
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      output += char;
      continue;
    }
    if (char === ',') {
      let lookahead = index + 1;
      while (/\s/.test(value[lookahead] || '')) lookahead += 1;
      if (value[lookahead] === '}' || value[lookahead] === ']') continue;
    }
    output += char;
  }
  return output;
}

export function parseJsonc(source) {
  return JSON.parse(stripTrailingCommas(stripJsoncComments(source)));
}

function isUtcTimestamp(value) {
  return typeof value === 'string' && value.endsWith('Z') && Number.isFinite(Date.parse(value));
}

function validateScheduledAutomation(automation, label, issues) {
  if (!SCHEDULE_MODES.has(automation.schedule_mode)) issues.push(`${label}: schedule_mode must be recurring or one-time`);
  if (!SCHEDULE_TYPES.has(automation.schedule_type)) issues.push(`${label}: schedule_type must be cron or simple`);
  if (automation.schedule_type === 'cron') {
    const fields = String(automation.cron_expression || '').trim().split(/\s+/).filter(Boolean);
    if (fields.length !== 5) issues.push(`${label}: cron_expression must use five fields`);
  }
  if (automation.schedule_type === 'simple' && automation.schedule_mode === 'one-time' && !isUtcTimestamp(automation.one_time_date)) {
    issues.push(`${label}: one_time_date must be a UTC timestamp`);
  }
  if (automation.schedule_type === 'simple' && automation.schedule_mode === 'recurring') {
    if (!REPEAT_UNITS.has(automation.repeat_unit)) issues.push(`${label}: repeat_unit is invalid`);
    if (['minutes', 'hours', 'days'].includes(automation.repeat_unit) && !(Number(automation.repeat_interval) > 0)) {
      issues.push(`${label}: repeat_interval must be positive`);
    }
    if (['days', 'weeks', 'months'].includes(automation.repeat_unit) && !/^\d{2}:\d{2}$/.test(String(automation.start_time || ''))) {
      issues.push(`${label}: start_time must use UTC HH:MM`);
    }
    if (automation.repeat_unit === 'weeks' && (!Array.isArray(automation.repeat_on_days) || !automation.repeat_on_days.length || automation.repeat_on_days.some((day) => !Number.isInteger(day) || day < 0 || day > 6))) {
      issues.push(`${label}: repeat_on_days must contain weekdays 0-6`);
    }
    if (automation.repeat_unit === 'months' && (!Number.isInteger(automation.repeat_on_day_of_month) || automation.repeat_on_day_of_month < 1 || automation.repeat_on_day_of_month > 31)) {
      issues.push(`${label}: repeat_on_day_of_month must be 1-31`);
    }
  }
  if (automation.ends_type === 'on' && !isUtcTimestamp(automation.ends_on_date)) issues.push(`${label}: ends_on_date must be a UTC timestamp`);
  if (automation.ends_type === 'after' && !(Number(automation.ends_after_count) > 0)) issues.push(`${label}: ends_after_count must be positive`);
}

function validateEntityAutomation(automation, label, issues) {
  if (!String(automation.entity_name || '').trim()) issues.push(`${label}: entity_name is required`);
  if (!Array.isArray(automation.event_types) || !automation.event_types.length || automation.event_types.some((event) => !ENTITY_EVENTS.has(event))) {
    issues.push(`${label}: event_types must contain create, update, or delete`);
  }
}

function validateConnectorAutomation(automation, label, issues) {
  const integration = String(automation.integration_type || '').trim();
  const events = Array.isArray(automation.events) ? automation.events.filter(Boolean) : [];
  if (!integration) issues.push(`${label}: integration_type is required`);
  if (!events.length) issues.push(`${label}: connector events are required`);
  if (['slack', 'slackbot'].includes(integration) && !isPlainObject(automation.trigger_conditions)) {
    issues.push(`${label}: Slack connector automations require trigger_conditions`);
  }
  if (integration === 'googledrive' && events.some((event) => ['file', 'file.update', 'file.trash', 'file.untrash', 'file.delete'].includes(event)) && !String(automation.resource_id || '').trim()) {
    issues.push(`${label}: file-scoped Google Drive events require resource_id`);
  }
}

export function validateFunctionManifest(path, source) {
  const issues = [];
  let config = null;
  try {
    config = parseJsonc(source);
  } catch (error) {
    return { path, config: null, automations: [], issues: [`${path}: invalid JSONC (${error?.message || 'parse failed'})`] };
  }
  if (!isPlainObject(config)) issues.push(`${path}: root must be an object`);
  if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(String(config?.name || ''))) issues.push(`${path}: function name is missing or invalid`);
  if (config?.entry !== 'entry.ts' && config?.entry !== 'entry.js') issues.push(`${path}: entry must be entry.ts or entry.js`);
  if (config?.automations != null && !Array.isArray(config.automations)) issues.push(`${path}: automations must be an array`);

  const automations = Array.isArray(config?.automations) ? config.automations : [];
  const names = new Set();
  automations.forEach((automation, index) => {
    const label = `${path} automation[${index}]`;
    if (!isPlainObject(automation)) {
      issues.push(`${label}: automation must be an object`);
      return;
    }
    const name = String(automation.name || '').trim();
    if (!name) issues.push(`${label}: name is required`);
    else if (names.has(name)) issues.push(`${label}: duplicate automation name ${name}`);
    else names.add(name);
    if (!AUTOMATION_TYPES.has(automation.type)) issues.push(`${label}: type must be scheduled, entity, or connector`);
    if (automation.function_args != null && !isPlainObject(automation.function_args)) issues.push(`${label}: function_args must be an object`);
    if (automation.is_active != null && typeof automation.is_active !== 'boolean') issues.push(`${label}: is_active must be boolean`);
    if (automation.type === 'scheduled') validateScheduledAutomation(automation, label, issues);
    if (automation.type === 'entity') validateEntityAutomation(automation, label, issues);
    if (automation.type === 'connector') validateConnectorAutomation(automation, label, issues);
  });
  return { path, config, automations, issues };
}

function normalizePath(path) {
  const value = String(path || '').replaceAll('\\', '/');
  const marker = value.indexOf('base44/functions/');
  return marker >= 0 ? value.slice(marker) : value;
}

function functionNameFromPath(path) {
  return normalizePath(path).match(/^base44\/functions\/([^/]+)\//)?.[1] || '';
}

function sourceHandlesAutomationArgs(source, args) {
  const value = String(source || '');
  if (!Object.keys(args || {}).length) return true;
  const readsArgs = /(?:body|payload)(?:\?\.)?\.args|\{\s*args\s*\}\s*=/.test(value);
  return readsArgs && Object.keys(args).every((key) => value.includes(key));
}

function extractConsoleCalls(source) {
  const value = String(source || '');
  const calls = [];
  const startPattern = /console\.(?:log|info|warn|error|debug)\s*\(/g;
  let match;
  while ((match = startPattern.exec(value)) !== null) {
    let depth = 1;
    let inString = '';
    let escaped = false;
    let index = startPattern.lastIndex;
    for (; index < value.length && depth > 0; index += 1) {
      const char = value[index];
      if (inString) {
        if (escaped) escaped = false;
        else if (char === '\\') escaped = true;
        else if (char === inString) inString = '';
        continue;
      }
      if (char === '"' || char === "'" || char === '`') {
        inString = char;
        continue;
      }
      if (char === '(') depth += 1;
      else if (char === ')') depth -= 1;
    }
    calls.push(value.slice(match.index, index));
    startPattern.lastIndex = index;
  }
  return calls;
}

function stripJavaScriptStrings(source) {
  return String(source || '').replace(/(['"`])(?:\\.|(?!\1)[^\\])*\1/gs, '');
}

export function auditBase44AutomationSurface(manifestSources = {}, entrySources = {}) {
  const manifests = Object.entries(manifestSources).map(([path, source]) => validateFunctionManifest(normalizePath(path), source));
  const entriesByName = new Map(Object.entries(entrySources).map(([path, source]) => [functionNameFromPath(path), { path: normalizePath(path), source: String(source || '') }]));
  const manifestIssues = manifests.flatMap((item) => {
    const pathName = functionNameFromPath(item.path);
    const configuredName = String(item.config?.name || '');
    return [
      ...item.issues,
      ...(configuredName && pathName !== configuredName ? [`${item.path}: configured name must match directory ${pathName}`] : []),
      ...(pathName && !entriesByName.has(pathName) ? [`${item.path}: matching entry source is missing`] : []),
    ];
  });
  const automationRecords = manifests.flatMap((manifest) => manifest.automations.map((automation) => ({
    functionName: String(manifest.config?.name || functionNameFromPath(manifest.path)),
    manifestPath: manifest.path,
    automation,
  })));
  const argumentIssues = [];
  const cleanupAutomationIssues = [];
  automationRecords.forEach((record) => {
    const entry = entriesByName.get(record.functionName);
    const label = `${record.manifestPath}:${record.automation.name || 'unnamed'}`;
    if (!entry) argumentIssues.push(`${label}: matching entry source is missing`);
    else if (!sourceHandlesAutomationArgs(entry.source, record.automation.function_args)) argumentIssues.push(`${label}: entry.ts does not validate configured function_args`);
    if (CLEANUP_NAME_PATTERN.test(`${record.functionName} ${record.automation.name || ''}`) && record.automation.is_active !== false) {
      const args = record.automation.function_args || {};
      const mode = String(args.mode || args.action || '').toLowerCase();
      if (!SAFE_AUTOMATION_MODES.has(mode) || args.execute === true || args.cleanup === true || args.destructive === true) {
        cleanupAutomationIssues.push(`${label}: cleanup/integrity automation must be disabled or explicitly dry-run/report-only`);
      }
    }
  });

  const waitUntilIssues = [];
  const privateLogIssues = [];
  for (const [path, sourceValue] of Object.entries(entrySources)) {
    const pathLabel = normalizePath(path);
    const source = String(sourceValue || '');
    if (/\bwaitUntil\s*\(/.test(source)) waitUntilIssues.push(`${pathLabel}: waitUntil requires manual criticality review`);
    extractConsoleCalls(source).forEach((call) => {
      const codeOnly = stripJavaScriptStrings(call);
      const identifiers = PRIVATE_LOG_IDENTIFIERS.filter((identifier) => new RegExp(`\\b${identifier}\\b`, 'i').test(codeOnly));
      if (identifiers.length || /[,\s]payload\s*\)/.test(codeOnly)) {
        privateLogIssues.push(`${pathLabel}: console call includes ${identifiers.join(', ') || 'raw payload'}`);
      }
    });
  }

  return {
    manifestCount: manifests.length,
    entryCount: entriesByName.size,
    automationCount: automationRecords.length,
    activeAutomationCount: automationRecords.filter((record) => record.automation.is_active !== false).length,
    manifestIssues,
    argumentIssues,
    cleanupAutomationIssues,
    waitUntilIssues,
    privateLogIssues,
    manifests,
    automationRecords,
  };
}
