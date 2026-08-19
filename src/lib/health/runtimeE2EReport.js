import {
  RUNTIME_E2E_SCENARIOS,
  RUNTIME_E2E_EXECUTION_SCOPE,
  RUNTIME_E2E_SUITE_ID,
  getRuntimeE2EScenario,
} from './runtimeE2EScenarios.js';
import {
  classifyRuntimeE2ETarget,
  RUNTIME_E2E_TARGET_KIND,
} from './runtimeE2ECapabilities.js';

export const AUTOMATION_STATUS = Object.freeze({
  PASS: 'AUTOMATION_PASS',
  FAIL: 'AUTOMATION_FAIL',
  NOT_RUN: 'AUTOMATION_NOT_RUN',
  NOT_AUTOMATABLE: 'AUTOMATION_NOT_AUTOMATABLE',
  MANUAL_EXTERNAL: 'AUTOMATION_MANUAL_EXTERNAL',
});

export const AUTOMATION_COUNTER_KEYS = Object.freeze({
  [AUTOMATION_STATUS.PASS]: 'automationPassed',
  [AUTOMATION_STATUS.FAIL]: 'automationFailed',
  [AUTOMATION_STATUS.NOT_RUN]: 'automationNotRun',
  [AUTOMATION_STATUS.NOT_AUTOMATABLE]: 'automationNotAutomatable',
  [AUTOMATION_STATUS.MANUAL_EXTERNAL]: 'automationManualExternal',
});

export const BACKEND_PREFLIGHT_STATUS = Object.freeze({
  REACHABLE: 'REACHABLE',
  APP_NOT_FOUND: 'APP_NOT_FOUND',
  NOT_CONFIGURED: 'NOT_CONFIGURED',
  UNREACHABLE: 'UNREACHABLE',
  PROD_CUSTOM_DOMAIN_PREFLIGHT_UNSUPPORTED: 'PROD_CUSTOM_DOMAIN_PREFLIGHT_UNSUPPORTED',
  PROD_RUNTIME_PROBE_REQUIRED: 'PROD_RUNTIME_PROBE_REQUIRED',
  OBSERVATION_INCONCLUSIVE: 'OBSERVATION_INCONCLUSIVE',
  UNKNOWN: 'UNKNOWN',
});

export const RUNTIME_BACKEND_PROBE_STATUS = Object.freeze({
  NOT_REQUIRED: 'NOT_REQUIRED',
  NOT_RUN: 'NOT_RUN',
  REQUIRED: 'REQUIRED',
  CONNECTED: 'CONNECTED',
  FAILED: 'FAILED',
  NOT_OBSERVED: 'NOT_OBSERVED',
});

export const RUNTIME_E2E_PROOF_LEVEL = Object.freeze({
  UI_ONLY: 'UI_ONLY',
  SESSION_RESTORED: 'SESSION_RESTORED',
  BACKEND_RUNTIME_PROBE: 'BACKEND_RUNTIME_PROBE',
  BACKEND_CONNECTED: 'BACKEND_CONNECTED',
  MANUAL_EXTERNAL: 'MANUAL_EXTERNAL',
});

export const RUNTIME_E2E_PREFLIGHT_DEPENDENCY = Object.freeze({
  DIRECT: 'direct',
  RUNTIME_PROBE: 'runtime_probe',
  NOT_REQUIRED: 'not_required',
});

export const RUNTIME_SERVICE_CATEGORY = Object.freeze({
  APP_DOCUMENT: 'app_document',
  STATIC_ASSETS: 'static_assets',
  BASE44_API: 'base44_api',
  BASE44_FUNCTIONS: 'base44_functions',
  AUTH_OR_USER_BOOTSTRAP: 'auth_or_user_bootstrap',
  LEADERBOARD: 'leaderboard',
  DAILY_STATUS: 'daily_status',
  QUESTION_SERVICE: 'question_service',
  ONLINE_MATCHMAKING: 'online_matchmaking',
  UNKNOWN_EXTERNAL: 'unknown_external',
});

export const RUNTIME_ENDPOINT_CATEGORY = Object.freeze({
  AUTH_SESSION: 'auth_session',
  PROFILE_ENTITY: 'profile_entity',
  PRESENCE_ENTITY: 'presence_entity',
  SOCIAL_ENTITY: 'social_entity',
  LEADERBOARD_READ: 'leaderboard_read',
  DAILY_STATUS: 'daily_status',
  QUESTION_SERVICE: 'question_service',
  ONLINE_MATCHMAKING: 'online_matchmaking',
  ECONOMY_ENTITY: 'economy_entity',
  GAMEPLAY_ENTITY: 'gameplay_entity',
  BACKEND_FUNCTION: 'backend_function',
  ENTITY_REQUEST: 'entity_request',
  APP_API: 'app_api',
  UNKNOWN: 'unknown',
});

export function resolveRuntimePreflightStatus({
  productionCustomDomainMode = false,
  directBackendPreflightStatus = BACKEND_PREFLIGHT_STATUS.OBSERVATION_INCONCLUSIVE,
  canRunRuntimeProbes = false,
} = {}) {
  if (!productionCustomDomainMode) {
    return directBackendPreflightStatus === BACKEND_PREFLIGHT_STATUS.UNKNOWN
      ? BACKEND_PREFLIGHT_STATUS.OBSERVATION_INCONCLUSIVE
      : directBackendPreflightStatus;
  }
  if (
    directBackendPreflightStatus === BACKEND_PREFLIGHT_STATUS.REACHABLE
    || directBackendPreflightStatus === BACKEND_PREFLIGHT_STATUS.APP_NOT_FOUND
    || directBackendPreflightStatus === BACKEND_PREFLIGHT_STATUS.NOT_CONFIGURED
  ) {
    return directBackendPreflightStatus;
  }
  if (canRunRuntimeProbes) return BACKEND_PREFLIGHT_STATUS.PROD_RUNTIME_PROBE_REQUIRED;
  if (
    directBackendPreflightStatus === BACKEND_PREFLIGHT_STATUS.UNKNOWN
    || directBackendPreflightStatus === BACKEND_PREFLIGHT_STATUS.OBSERVATION_INCONCLUSIVE
    || directBackendPreflightStatus === BACKEND_PREFLIGHT_STATUS.PROD_RUNTIME_PROBE_REQUIRED
  ) {
    return BACKEND_PREFLIGHT_STATUS.PROD_CUSTOM_DOMAIN_PREFLIGHT_UNSUPPORTED;
  }
  return directBackendPreflightStatus;
}

export const RUNTIME_DIAGNOSTIC_CATEGORY = Object.freeze({
  BASE44_APP_NOT_FOUND: 'BASE44_APP_NOT_FOUND',
  BASE44_APP_CONFIG_MISSING: 'BASE44_APP_CONFIG_MISSING',
  BASE44_RUNTIME_ERROR: 'BASE44_RUNTIME_ERROR',
  ACTOR_BOOTSTRAP_CONFIG_FAILURE: 'ACTOR_BOOTSTRAP_CONFIG_FAILURE',
  AUTH_OR_USER_BOOTSTRAP_FAILED: 'AUTH_OR_USER_BOOTSTRAP_FAILED',
  BACKEND_5XX: 'BACKEND_5XX',
  BACKEND_PERMISSION_DENIED: 'BACKEND_PERMISSION_DENIED',
  BACKEND_CORS_BLOCKED: 'BACKEND_CORS_BLOCKED',
  FUNCTION_CALL_FAILED: 'FUNCTION_CALL_FAILED',
  UNHANDLED_PROMISE_REJECTION: 'UNHANDLED_PROMISE_REJECTION',
  BROWSER_EXTENSION_NOISE: 'BROWSER_EXTENSION_NOISE',
  BROWSER_RUNTIME_ERROR: 'BROWSER_RUNTIME_ERROR',
  NETWORK_REQUEST_FAILED: 'NETWORK_REQUEST_FAILED',
  BROWSER_CONSOLE_ERROR: 'BROWSER_CONSOLE_ERROR',
});

const AUTOMATION_STATUSES = new Set(Object.values(AUTOMATION_STATUS));
const SETUP_GAP_STATUSES = new Set([
  AUTOMATION_STATUS.NOT_AUTOMATABLE,
  AUTOMATION_STATUS.MANUAL_EXTERNAL,
]);
const PRIVATE_KEY_PATTERN = /(?:password|secret|token|authorization|cookie|session|email|provider.?id|owner.?key|guest.?id|auth.?id|player.?key|actor.?key|storage.?state)/i;
const PRIVATE_TEXT_PATTERN = /\b(?:owner_key|guest_token|guest_id|provider_id|auth_id|internal_player_key|player_key)\b|\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const STACK_TRACE_PATTERN = /(?:\n|^)\s*at\s+[\w.$<>]+\s*\([^\n]+:\d+:\d+\)/g;
const STACK_TRACE_DETECT_PATTERN = /(?:\n|^)\s*at\s+[\w.$<>]+\s*\([^\n]+:\d+:\d+\)/;
const BROWSER_DIAGNOSTIC_LOG_PATTERN = /(?:\n|^)(?:Browser logs:|Call log:)[\s\S]*/i;
const LOCAL_PATH_PATTERN = /\/(?:Users|private\/var|var|tmp)\/[^\s"'<>]+/g;
const APP_NOT_FOUND_PATTERN = /(?:Base44[^\n]{0,120})?App not found|backend app not found/i;
const APP_CONFIG_PATTERN = /missing Base44 app (?:id|config)|VITE_BASE44_APP_ID[^\n]{0,80}(?:missing|required|undefined)|app[_ ]id[^\n]{0,80}(?:missing|required|undefined)/i;
const ACTOR_BOOTSTRAP_PATTERN = /(?:User auth check failed|guest|auth|bootstrap)[^\n]{0,160}App not found/i;
const BACKEND_SERVICE_CATEGORIES = new Set([
  RUNTIME_SERVICE_CATEGORY.BASE44_API,
  RUNTIME_SERVICE_CATEGORY.BASE44_FUNCTIONS,
  RUNTIME_SERVICE_CATEGORY.AUTH_OR_USER_BOOTSTRAP,
  RUNTIME_SERVICE_CATEGORY.LEADERBOARD,
  RUNTIME_SERVICE_CATEGORY.DAILY_STATUS,
  RUNTIME_SERVICE_CATEGORY.QUESTION_SERVICE,
  RUNTIME_SERVICE_CATEGORY.ONLINE_MATCHMAKING,
]);
const STATIC_RESOURCE_TYPES = new Set(['stylesheet', 'script', 'image', 'media', 'font']);

function nowIso() {
  return new Date().toISOString();
}

function sanitizeAbsoluteUrl(value) {
  try {
    const parsed = new URL(String(value));
    return `${parsed.origin}${parsed.pathname}`;
  } catch (_) {
    return String(value || '').split('?')[0].split('#')[0];
  }
}

function sanitizeRoute(value) {
  try {
    return new URL(String(value), 'https://runtime.invalid').pathname || '/';
  } catch (_) {
    return String(value || '').split('?')[0].split('#')[0];
  }
}

function sanitizeArtifactPath(value) {
  const normalized = String(value || '').replace(/\\/g, '/');
  const marker = normalized.indexOf('test-results/health-e2e/');
  return marker >= 0 ? normalized.slice(marker) : normalized.split('/').slice(-3).join('/');
}

function sanitizeText(value) {
  return String(value || '')
    .replace(/\u001B\[[0-?]*[ -/]*[@-~]/g, '')
    .replace(/\b(password|secret|token|authorization|cookie|session|email|provider.?id|owner.?key|guest.?id|auth.?id|player.?key|actor.?key|storage.?state)\s*[:=]\s*[^\s,;]+/gi, '$1=[REDACTED]')
    .replace(PRIVATE_TEXT_PATTERN, '[REDACTED]')
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [REDACTED]')
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[JWT_REDACTED]')
    .replace(/([?&](?:token|access_token|refresh_token|auth|authorization|session|guest_token|guest_id|owner_key)=)[^&\s#]+/gi, '$1[REDACTED]')
    .replace(STACK_TRACE_PATTERN, '\n[STACK_REDACTED]')
    .replace(BROWSER_DIAGNOSTIC_LOG_PATTERN, '\n[BROWSER_DIAGNOSTIC_REDACTED]')
    .replace(LOCAL_PATH_PATTERN, '[LOCAL_PATH_REDACTED]')
    .slice(0, 4000);
}

export function sanitizeAutomationValue(value, key = '') {
  if (value == null || typeof value === 'boolean' || typeof value === 'number') return value;
  if (PRIVATE_KEY_PATTERN.test(key)) return '[REDACTED]';
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => sanitizeAutomationValue(item));
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).slice(0, 120).map(([entryKey, entryValue]) => [
      entryKey,
      sanitizeAutomationValue(entryValue, entryKey),
    ]));
  }
  if (/route/i.test(key)) return sanitizeRoute(value);
  if (/(?:url|origin|baseUrl)/i.test(key)) return sanitizeAbsoluteUrl(value);
  if (/screenshot|trace|artifact/i.test(key)) return sanitizeArtifactPath(value);
  return sanitizeText(value);
}

function diagnosticFingerprint(value) {
  const normalized = sanitizeText(value).toLowerCase().replace(/\d+/g, '#').slice(0, 500);
  let hash = 2166136261;
  for (let index = 0; index < normalized.length; index += 1) {
    hash ^= normalized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `diag-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function classifyRuntimeServiceRequest(requestUrl, configuredBaseUrl, resourceType = '') {
  try {
    const request = new URL(String(requestUrl));
    const configured = new URL(String(configuredBaseUrl));
    const pathname = request.pathname.toLowerCase();
    const type = String(resourceType || '').toLowerCase();
    const sameOrigin = request.origin === configured.origin;

    if (type === 'document') return RUNTIME_SERVICE_CATEGORY.APP_DOCUMENT;
    if (STATIC_RESOURCE_TYPES.has(type) || /\.(?:css|js|mjs|png|jpe?g|gif|webp|svg|ico|woff2?|ttf|mp4|webm|mp3)(?:$|\/)/i.test(pathname)) {
      return RUNTIME_SERVICE_CATEGORY.STATIC_ASSETS;
    }
    if (/getquestions|question(?:s|bootstrap)?/.test(pathname)) return RUNTIME_SERVICE_CATEGORY.QUESTION_SERVICE;
    if (/randommatchmaking|matchmaking|matchmakingqueue|queue\/(?:join|leave)|findmatch/.test(pathname)) return RUNTIME_SERVICE_CATEGORY.ONLINE_MATCHMAKING;
    if (/leaderboard|ranking/.test(pathname)) return RUNTIME_SERVICE_CATEGORY.LEADERBOARD;
    if (/dailywheel|daily[-_/]?(?:status|calendar|quest|goal|streak)/.test(pathname)) return RUNTIME_SERVICE_CATEGORY.DAILY_STATUS;
    if (/createguestprofile|guestprofile|playerprofile|userprofile|auth|currentuser|user\/me|\/me(?:\/|$)/.test(pathname)) {
      return RUNTIME_SERVICE_CATEGORY.AUTH_OR_USER_BOOTSTRAP;
    }
    if (/\/functions?\//.test(pathname)) return RUNTIME_SERVICE_CATEGORY.BASE44_FUNCTIONS;
    if (/\/api\//.test(pathname) || /base44/i.test(request.hostname)) return RUNTIME_SERVICE_CATEGORY.BASE44_API;
    if (sameOrigin && (type === 'xhr' || type === 'fetch')) return RUNTIME_SERVICE_CATEGORY.BASE44_API;
    return RUNTIME_SERVICE_CATEGORY.UNKNOWN_EXTERNAL;
  } catch (_) {
    return RUNTIME_SERVICE_CATEGORY.UNKNOWN_EXTERNAL;
  }
}

export function classifyRuntimeEndpointCategory(requestUrl) {
  try {
    const pathname = new URL(String(requestUrl)).pathname.toLowerCase();
    if (/getquestions|question(?:s|bootstrap)?/.test(pathname)) return RUNTIME_ENDPOINT_CATEGORY.QUESTION_SERVICE;
    if (/randommatchmaking|matchmaking|matchmakingqueue|queue\/(?:join|leave)|findmatch/.test(pathname)) {
      return RUNTIME_ENDPOINT_CATEGORY.ONLINE_MATCHMAKING;
    }
    if (/leaderboard|ranking/.test(pathname)) return RUNTIME_ENDPOINT_CATEGORY.LEADERBOARD_READ;
    if (/dailywheel|daily[-_/]?(?:status|calendar|quest|goal|streak)/.test(pathname)) {
      return RUNTIME_ENDPOINT_CATEGORY.DAILY_STATUS;
    }
    if (/auth|currentuser|user\/me|\/me(?:\/|$)/.test(pathname)) return RUNTIME_ENDPOINT_CATEGORY.AUTH_SESSION;
    if (/presence/.test(pathname)) return RUNTIME_ENDPOINT_CATEGORY.PRESENCE_ENTITY;
    if (/notification|gameinvite|friendrequest|friendship|friend/.test(pathname)) {
      return RUNTIME_ENDPOINT_CATEGORY.SOCIAL_ENTITY;
    }
    if (/guestprofile|playerprofile|userprofile|\/entities\/user(?:\/|$)/.test(pathname)) {
      return RUNTIME_ENDPOINT_CATEGORY.PROFILE_ENTITY;
    }
    if (/diamond|joker|hint|inventory|transaction/.test(pathname)) return RUNTIME_ENDPOINT_CATEGORY.ECONOMY_ENTITY;
    if (/solo|lobby|matchresult|questionattempt|exposure/.test(pathname)) {
      return RUNTIME_ENDPOINT_CATEGORY.GAMEPLAY_ENTITY;
    }
    if (/\/functions?\//.test(pathname)) return RUNTIME_ENDPOINT_CATEGORY.BACKEND_FUNCTION;
    if (/\/entities?\//.test(pathname)) return RUNTIME_ENDPOINT_CATEGORY.ENTITY_REQUEST;
    if (/\/api\//.test(pathname)) return RUNTIME_ENDPOINT_CATEGORY.APP_API;
    return RUNTIME_ENDPOINT_CATEGORY.UNKNOWN;
  } catch (_) {
    return RUNTIME_ENDPOINT_CATEGORY.UNKNOWN;
  }
}

export function buildRuntimePermissionDiagnostic({
  scenarioId = 'runtime_preflight',
  requestUrl,
  configuredBaseUrl,
  resourceType = '',
  method = 'GET',
  status = 403,
} = {}) {
  const serviceCategory = classifyRuntimeServiceRequest(requestUrl, configuredBaseUrl, resourceType);
  const endpointCategory = classifyRuntimeEndpointCategory(requestUrl);
  const numericStatus = Number(status);
  const statusClass = Number.isFinite(numericStatus) ? `${Math.floor(numericStatus / 100)}xx` : 'unknown';
  const requestMethod = String(method || 'GET').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 10) || 'GET';
  const safeScenario = /^[a-z0-9._-]+$/i.test(String(scenarioId || ''))
    ? String(scenarioId)
    : 'runtime_unknown';
  const readAction = requestMethod === 'GET' || requestMethod === 'HEAD';
  const entityMutation = [
    RUNTIME_ENDPOINT_CATEGORY.PROFILE_ENTITY,
    RUNTIME_ENDPOINT_CATEGORY.PRESENCE_ENTITY,
    RUNTIME_ENDPOINT_CATEGORY.SOCIAL_ENTITY,
    RUNTIME_ENDPOINT_CATEGORY.ECONOMY_ENTITY,
    RUNTIME_ENDPOINT_CATEGORY.GAMEPLAY_ENTITY,
    RUNTIME_ENDPOINT_CATEGORY.ENTITY_REQUEST,
  ].includes(endpointCategory);
  const actionVerb = readAction ? 'read' : entityMutation ? 'mutate' : 'invoke';
  const actionLabel = `${actionVerb} ${endpointCategory.replace(/_/g, ' ')}`;
  return sanitizeAutomationValue({
    diagnosticCategory: RUNTIME_DIAGNOSTIC_CATEGORY.BACKEND_PERMISSION_DENIED,
    critical: true,
    scenario: safeScenario,
    serviceCategory,
    statusClass,
    endpointCategory,
    actionLabel,
    fingerprint: diagnosticFingerprint(`${safeScenario}|${serviceCategory}|${endpointCategory}|${requestMethod}|${statusClass}`),
    summary: 'A backend request was denied by authorization or data-access policy.',
  });
}

export function isRuntimeBackendServiceCategory(category) {
  return BACKEND_SERVICE_CATEGORIES.has(category);
}

export function recordRuntimeServiceObservation(summary, category, outcome, status = null) {
  const current = summary[category] || { requests: 0, responses: 0, failures: 0, statusClasses: {} };
  if (outcome === 'REQUEST') current.requests += 1;
  if (outcome === 'RESPONSE') {
    current.responses += 1;
    if (Number.isFinite(Number(status))) {
      const statusClass = `${Math.floor(Number(status) / 100)}xx`;
      current.statusClasses[statusClass] = (current.statusClasses[statusClass] || 0) + 1;
    }
  }
  if (outcome === 'FAILED') current.failures += 1;
  summary[category] = current;
  return summary;
}

export function runtimeServiceSummaryUnavailableReason(summary = {}) {
  const backendObserved = Object.entries(summary).some(([category, value]) => (
    isRuntimeBackendServiceCategory(category)
    && ((value?.requests || 0) > 0 || (value?.responses || 0) > 0 || (value?.failures || 0) > 0)
  ));
  return backendObserved ? null : 'No classified backend requests observed during preflight window.';
}

const SERVICE_ALIASES = Object.freeze({
  base_app: RUNTIME_SERVICE_CATEGORY.BASE44_API,
  actor_bootstrap: RUNTIME_SERVICE_CATEGORY.AUTH_OR_USER_BOOTSTRAP,
  profile: RUNTIME_SERVICE_CATEGORY.BASE44_API,
  daily_wheel: RUNTIME_SERVICE_CATEGORY.DAILY_STATUS,
});

export function summarizeRuntimeBackendEvidence(summary = {}, preferredCategories = []) {
  const preferred = [...new Set(preferredCategories.map((category) => SERVICE_ALIASES[category] || category))]
    .filter((category) => isRuntimeBackendServiceCategory(category));
  const specificPreferred = preferred.filter((category) => (
    category !== RUNTIME_SERVICE_CATEGORY.BASE44_API
    && category !== RUNTIME_SERVICE_CATEGORY.BASE44_FUNCTIONS
  ));
  const domainSpecificPreferred = specificPreferred.filter((category) => (
    category !== RUNTIME_SERVICE_CATEGORY.AUTH_OR_USER_BOOTSTRAP
  ));
  const candidates = preferred.length
    ? (domainSpecificPreferred.length ? domainSpecificPreferred : specificPreferred.length ? specificPreferred : preferred)
    : Object.keys(summary).filter((category) => isRuntimeBackendServiceCategory(category));
  let responseFallback = null;
  let requestOnlyFallback = null;
  for (const category of candidates) {
    const entry = summary[category];
    if (!entry) continue;
    const successfulStatusClass = ['2xx', '3xx'].find((statusClass) => (entry.statusClasses?.[statusClass] || 0) > 0);
    if (successfulStatusClass) {
      return {
        observed: true,
        successful: true,
        category,
        statusClass: successfulStatusClass,
        safeSummary: `Observed a successful ${category} runtime response.`,
      };
    }
    if (!responseFallback && ((entry.responses || 0) > 0 || (entry.failures || 0) > 0)) {
      const statusClass = Object.keys(entry.statusClasses || {})[0] || (entry.failures ? 'network_failure' : 'unknown');
      responseFallback = {
        observed: true,
        successful: false,
        category,
        statusClass,
        safeSummary: `Observed ${category} runtime traffic without a successful response.`,
      };
    }
    if (!requestOnlyFallback && (entry.requests || 0) > 0) {
      requestOnlyFallback = {
        observed: true,
        successful: false,
        category,
        statusClass: 'no_response',
        safeSummary: `Observed a ${category} runtime request, but no response or request failure before the scenario ended.`,
      };
    }
  }
  return responseFallback || requestOnlyFallback || {
    observed: false,
    successful: false,
    category: null,
    statusClass: null,
    safeSummary: 'No classified backend response was observed during this scenario.',
  };
}

export function classifyRuntimeDiagnostic(value) {
  if (
    value
    && typeof value === 'object'
    && Object.values(RUNTIME_DIAGNOSTIC_CATEGORY).includes(value.category)
    && typeof value.critical === 'boolean'
  ) {
    return {
      category: value.category,
      critical: value.critical,
      summary: sanitizeText(value.summary || 'A classified browser diagnostic was observed.'),
      nextAction: sanitizeText(value.nextAction || 'Inspect the affected runtime scenario.'),
      fingerprint: sanitizeText(value.fingerprint || diagnosticFingerprint(value.summary || value.category)),
    };
  }
  const rawText = typeof value === 'string' ? value : value?.summary || value?.message || JSON.stringify(value || '');
  const hasRawStackTrace = STACK_TRACE_DETECT_PATTERN.test(String(rawText || ''));
  const text = sanitizeText(rawText);
  const fingerprint = diagnosticFingerprint(text);
  if (ACTOR_BOOTSTRAP_PATTERN.test(text)) {
    return {
      category: RUNTIME_DIAGNOSTIC_CATEGORY.ACTOR_BOOTSTRAP_CONFIG_FAILURE,
      critical: true,
      summary: 'Guest/auth bootstrap failed because the configured Base44 app was not found.',
      nextAction: 'Configure VITE_BASE44_APP_ID or approved app_id bootstrap and verify the target app.',
      fingerprint,
    };
  }
  if (APP_NOT_FOUND_PATTERN.test(text)) {
    return {
      category: RUNTIME_DIAGNOSTIC_CATEGORY.BASE44_APP_NOT_FOUND,
      critical: true,
      summary: 'The configured Base44 app was not found.',
      nextAction: 'Verify VITE_BASE44_APP_ID/app_id and the configured app base URL.',
      fingerprint,
    };
  }
  if (APP_CONFIG_PATTERN.test(text)) {
    return {
      category: RUNTIME_DIAGNOSTIC_CATEGORY.BASE44_APP_CONFIG_MISSING,
      critical: true,
      summary: 'Required Base44 app configuration is missing.',
      nextAction: 'Set VITE_BASE44_APP_ID or provide app_id through approved runtime bootstrap.',
      fingerprint,
    };
  }
  if (/User auth check failed|auth check failed|actor bootstrap failed/i.test(text)) {
    return {
      category: RUNTIME_DIAGNOSTIC_CATEGORY.AUTH_OR_USER_BOOTSTRAP_FAILED,
      critical: true,
      summary: 'The auth or user-bootstrap check failed.',
      nextAction: 'Inspect the safe auth/bootstrap service category and isolated actor setup.',
      fingerprint,
    };
  }
  if (/\[Base44 SDK Error\]|Base44 SDK[^\n]{0,80}(?:error|failed)/i.test(text)) {
    return {
      category: RUNTIME_DIAGNOSTIC_CATEGORY.BASE44_RUNTIME_ERROR,
      critical: true,
      summary: 'The Base44 SDK reported a runtime failure.',
      nextAction: 'Inspect the safe service category/status and deployed app configuration.',
      fingerprint,
    };
  }
  if (/unhandled (?:promise )?rejection|unhandledrejection/i.test(text)) {
    return {
      category: RUNTIME_DIAGNOSTIC_CATEGORY.UNHANDLED_PROMISE_REJECTION,
      critical: true,
      summary: 'An unhandled promise rejection was observed.',
      nextAction: 'Inspect the retained trace and the affected runtime service category.',
      fingerprint,
    };
  }
  if (hasRawStackTrace) {
    return {
      category: RUNTIME_DIAGNOSTIC_CATEGORY.BROWSER_RUNTIME_ERROR,
      critical: true,
      summary: 'A browser runtime error with a stack trace was observed; the stack was removed.',
      nextAction: 'Inspect the retained trace and reproduce the affected scenario without exposing the raw stack.',
      fingerprint,
    };
  }
  if (/cors|cross-origin request blocked|blocked by access-control-allow-origin/i.test(text)) {
    return {
      category: RUNTIME_DIAGNOSTIC_CATEGORY.BACKEND_CORS_BLOCKED,
      critical: true,
      summary: 'A backend request was blocked by the browser CORS policy.',
      nextAction: 'Verify the production custom-domain API/CORS configuration.',
      fingerprint,
    };
  }
  if (/permission denied|forbidden|\b403\b|row.level security|rls/i.test(text)) {
    return {
      category: RUNTIME_DIAGNOSTIC_CATEGORY.BACKEND_PERMISSION_DENIED,
      critical: true,
      summary: 'A backend request was denied by authorization or data-access policy.',
      nextAction: 'Verify the isolated actor permissions without exposing actor identity.',
      fingerprint,
    };
  }
  if (/function(?: call| invocation)? failed|failed to invoke|functions?\/[^\s]+[^\n]{0,80}(?:failed|error)/i.test(text)) {
    return {
      category: RUNTIME_DIAGNOSTIC_CATEGORY.FUNCTION_CALL_FAILED,
      critical: true,
      summary: 'A backend function call failed.',
      nextAction: 'Inspect the safe function service category and retained trace.',
      fingerprint,
    };
  }
  if (/\b5\d\d\b|internal server error|bad gateway|service unavailable|gateway timeout/i.test(text)) {
    return {
      category: RUNTIME_DIAGNOSTIC_CATEGORY.BACKEND_5XX,
      critical: true,
      summary: 'A backend service returned a server-side failure.',
      nextAction: 'Inspect the safe service/status summary and server-side logs.',
      fingerprint,
    };
  }
  if (/chrome-extension:|moz-extension:|devtools|favicon\.ico|resizeobserver loop/i.test(text)) {
    return {
      category: RUNTIME_DIAGNOSTIC_CATEGORY.BROWSER_EXTENSION_NOISE,
      critical: false,
      summary: 'Non-product browser or extension noise was observed.',
      nextAction: 'No product action is required unless the message reproduces without browser extensions.',
      fingerprint,
    };
  }
  if (/request failed|networkerror|failed to fetch|net::/i.test(text)) {
    return {
      category: RUNTIME_DIAGNOSTIC_CATEGORY.NETWORK_REQUEST_FAILED,
      critical: false,
      summary: 'A browser network request failed.',
      nextAction: 'Inspect the redacted service summary and rerun against the intended environment.',
      fingerprint,
    };
  }
  return {
    category: RUNTIME_DIAGNOSTIC_CATEGORY.BROWSER_CONSOLE_ERROR,
    critical: false,
    summary: 'A browser console error was observed.',
    nextAction: 'Inspect the affected scenario and its retained trace when available.',
    fingerprint,
  };
}

export function summarizeRuntimeConsoleErrors(values = []) {
  const items = [];
  const seen = new Set();
  for (const value of values || []) {
    const diagnostic = classifyRuntimeDiagnostic(value);
    const key = `${diagnostic.category}:${diagnostic.summary}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(diagnostic);
    if (items.length >= 20) break;
  }
  return {
    observedCount: Array.isArray(values) ? values.length : 0,
    summaryCount: items.length,
    criticalCount: items.filter((item) => item.critical).length,
    categories: items.reduce((counts, item) => ({
      ...counts,
      [item.category]: (counts[item.category] || 0) + 1,
    }), {}),
    items,
  };
}

export function summarizeRuntimeNetworkErrors(values = []) {
  const methods = [...new Set((values || []).map((item) => String(item?.method || 'UNKNOWN').toUpperCase()))].slice(0, 10);
  return {
    observedCount: Array.isArray(values) ? values.length : 0,
    summaryCount: methods.length,
    items: methods.map((method) => ({
      category: RUNTIME_DIAGNOSTIC_CATEGORY.NETWORK_REQUEST_FAILED,
      method,
      summary: 'A browser network request failed; request URL and raw error were omitted.',
    })),
  };
}

function emptyCounters() {
  return {
    automationPassed: 0,
    automationFailed: 0,
    automationNotRun: 0,
    automationNotAutomatable: 0,
    automationManualExternal: 0,
  };
}

export function buildAutomationCounters(results = []) {
  return results.reduce((counts, result) => {
    const key = AUTOMATION_COUNTER_KEYS[result?.status] || AUTOMATION_COUNTER_KEYS[AUTOMATION_STATUS.NOT_RUN];
    counts[key] += 1;
    return counts;
  }, emptyCounters());
}

function notRunSteps(scenario) {
  return scenario.steps.map((item) => ({
    ...item,
    status: AUTOMATION_STATUS.NOT_RUN,
    actual: 'Not executed.',
    route: null,
    durationMs: null,
    failureCategory: null,
    screenshotPath: null,
    tracePath: null,
  }));
}

export function createNotRunAutomationReport(buildMarker = 'unknown') {
  const scenarios = RUNTIME_E2E_SCENARIOS.map((scenario) => ({
    scenarioId: scenario.scenarioId,
    scenarioTitle: scenario.title,
    requiredCapabilities: scenario.requiredCapabilities,
    optionalCapabilities: scenario.optionalCapabilities,
    capabilityStatus: [],
    executionScope: scenario.executionScope,
    backendDependent: scenario.executionScope === RUNTIME_E2E_EXECUTION_SCOPE.BACKEND_DEPENDENT,
    uiOnly: scenario.executionScope === RUNTIME_E2E_EXECUTION_SCOPE.UI_ONLY,
    backendServices: scenario.backendServices,
    preflightDecision: 'NOT_RUN',
    proofLevel: scenario.executionScope === RUNTIME_E2E_EXECUTION_SCOPE.UI_ONLY
      ? RUNTIME_E2E_PROOF_LEVEL.UI_ONLY
      : RUNTIME_E2E_PROOF_LEVEL.BACKEND_RUNTIME_PROBE,
    backendEvidence: summarizeRuntimeBackendEvidence(),
    preflightDependency: scenario.executionScope === RUNTIME_E2E_EXECUTION_SCOPE.UI_ONLY
      ? RUNTIME_E2E_PREFLIGHT_DEPENDENCY.NOT_REQUIRED
      : RUNTIME_E2E_PREFLIGHT_DEPENDENCY.DIRECT,
    blockReason: 'No runtime automation report has been imported or executed.',
    status: AUTOMATION_STATUS.NOT_RUN,
    statusReason: 'No runtime automation report has been imported or executed.',
    durationMs: null,
    failureCategory: null,
    actual: 'No runtime automation report has been imported or executed.',
    steps: notRunSteps(scenario),
    consoleErrorSummary: summarizeRuntimeConsoleErrors(),
    criticalConsoleErrors: [],
    consoleErrors: [],
    networkErrors: [],
    relatedFiles: [],
    safeReproductionSteps: [],
    safeSetupInstructions: scenario.manualFallback,
    nextAction: scenario.manualFallback,
    screenshotPath: null,
    tracePath: null,
  }));
  return {
    type: 'KRONOX_RUNTIME_E2E_AUTOMATION_REPORT',
    version: 2,
    suiteId: RUNTIME_E2E_SUITE_ID,
    runId: null,
    generatedAt: nowIso(),
    startedAt: null,
    finishedAt: null,
    buildMarker,
    targetKind: null,
    productionCustomDomainMode: false,
    configuredBaseUrl: null,
    pageUrl: null,
    pageOrigin: null,
    appRoute: null,
    preflight: null,
    directBackendPreflightStatus: null,
    runtimeBackendProbeStatus: RUNTIME_BACKEND_PROBE_STATUS.NOT_RUN,
    preflightStatusReason: 'Runtime preflight has not run.',
    serviceSummary: {},
    serviceSummaryUnavailableReason: 'Runtime preflight has not run.',
    backendProofLevel: RUNTIME_E2E_PROOF_LEVEL.UI_ONLY,
    homeVisible: false,
    authenticatedOrStoredSession: false,
    canRunRuntimeProbes: false,
    preflightLimitations: [],
    environment: null,
    capabilitySummary: {},
    criticalConsoleErrorCount: 0,
    backendAvailable: false,
    appConfigAvailable: false,
    base44AppReachable: false,
    executionEvidence: null,
    counts: buildAutomationCounters(scenarios),
    scenarios,
  };
}

function normalizeStep(step, definition) {
  const status = AUTOMATION_STATUSES.has(step?.status) ? step.status : AUTOMATION_STATUS.NOT_RUN;
  return sanitizeAutomationValue({
    ...definition,
    ...step,
    id: definition?.id || step?.id || 'unknown-step',
    title: definition?.title || step?.title || 'Unnamed step',
    status,
    actual: step?.actual || (status === AUTOMATION_STATUS.NOT_RUN ? 'Not executed.' : ''),
    route: step?.route || null,
    durationMs: Number.isFinite(Number(step?.durationMs)) ? Number(step.durationMs) : null,
    failureCategory: step?.failureCategory || null,
    screenshotPath: step?.screenshotPath || null,
    tracePath: step?.tracePath || null,
  });
}

function meaningfulOrigin(value) {
  return /^https?:\/\/[^/]+/i.test(String(value || ''));
}

export function hasRealAutomationEvidence(report, result) {
  const evidence = result?.executionEvidence || report?.executionEvidence;
  const definition = getRuntimeE2EScenario(result?.scenarioId);
  const requiredSteps = (definition?.steps || []).filter((item) => item.required !== false);
  const completedRequiredSteps = (result?.steps || []).filter((item) => (
    requiredSteps.some((required) => required.id === item.id)
    && item.status === AUTOMATION_STATUS.PASS
    && Number.isFinite(Number(item.durationMs))
  ));
  const baseEvidence = Boolean(
    report?.runId
    && report?.startedAt
    && report?.finishedAt
    && evidence?.executionId
    && evidence?.browserName
    && meaningfulOrigin(report?.pageOrigin || evidence?.pageOrigin || evidence?.baseUrlOrigin)
    && completedRequiredSteps.length === requiredSteps.length,
  );
  if (!baseEvidence) return false;
  if (definition?.executionScope !== RUNTIME_E2E_EXECUTION_SCOPE.BACKEND_DEPENDENT) return true;
  if (result?.scenarioId === 'runtime_e2e.app_bootstrap_guest_home') {
    const sessionRestored = result?.proofLevel === RUNTIME_E2E_PROOF_LEVEL.SESSION_RESTORED
      && Boolean(report?.homeVisible || report?.preflight?.homeVisible)
      && Boolean(report?.authenticatedOrStoredSession || report?.preflight?.authenticatedOrStoredSession);
    if (sessionRestored) return true;
  }
  if (result?.scenarioId !== 'runtime_e2e.duello_two_context_runtime_sync') {
    return result?.proofLevel === RUNTIME_E2E_PROOF_LEVEL.BACKEND_CONNECTED
      && result?.backendEvidence?.observed === true
      && result?.backendEvidence?.successful === true;
  }
  return evidence?.contextCount >= 2
    && evidence?.deterministicPairing === true
    && evidence?.deterministicClaimFixture === true
    && result?.authorityEvidence?.singleAcceptedClaim === true
    && result?.authorityEvidence?.snapshotReconciled === true;
}

export function backendPreflightBlock(report, result) {
  const definition = getRuntimeE2EScenario(result?.scenarioId);
  if (definition?.executionScope !== RUNTIME_E2E_EXECUTION_SCOPE.BACKEND_DEPENDENT) return null;
  const evidence = result?.executionEvidence || report?.executionEvidence;
  const preflightStatus = report?.preflight?.status || evidence?.backendPreflight?.status;
  const diagnostics = summarizeRuntimeConsoleErrors([
    ...(result?.consoleErrors || []),
    ...(result?.consoleErrorSummary?.items || []),
    result?.actual,
  ]);
  const appNotFound = diagnostics.items.some((item) => (
    item.category === RUNTIME_DIAGNOSTIC_CATEGORY.BASE44_APP_NOT_FOUND
    || item.category === RUNTIME_DIAGNOSTIC_CATEGORY.ACTOR_BOOTSTRAP_CONFIG_FAILURE
  ));
  if (preflightStatus === BACKEND_PREFLIGHT_STATUS.APP_NOT_FOUND || appNotFound) {
    return {
      category: 'BACKEND_PREFLIGHT_APP_NOT_FOUND',
      actual: 'Backend-dependent scenario was not accepted: the configured Base44 app was not found.',
      expected: 'A reachable configured Base44 app before backend-dependent browser steps run.',
    };
  }
  if (preflightStatus === BACKEND_PREFLIGHT_STATUS.NOT_CONFIGURED) {
    return {
      category: 'BACKEND_PREFLIGHT_NOT_CONFIGURED',
      actual: 'Backend-dependent scenario was not accepted: Base44 app configuration is missing.',
      expected: 'Configured Base44 app identity before backend-dependent browser steps run.',
    };
  }
  if (preflightStatus === BACKEND_PREFLIGHT_STATUS.UNREACHABLE) {
    return {
      category: `BACKEND_PREFLIGHT_${preflightStatus}`,
      actual: `Backend-dependent scenario was not accepted: backend preflight is ${preflightStatus}.`,
      expected: 'Backend preflight status REACHABLE before backend-dependent browser steps run.',
    };
  }
  if (result?.backendEvidence?.observed === true && result?.backendEvidence?.successful === false) {
    if (result.backendEvidence.statusClass === 'no_response') {
      return {
        category: 'BACKEND_RUNTIME_RESPONSE_NOT_OBSERVED',
        actual: `Backend-dependent scenario was not accepted: a ${result.backendEvidence.category || 'backend'} request was observed, but no response or request failure was observed before the scenario ended.`,
        expected: 'A successful classified backend response during the scenario, or a precise setup gap when the request remains pending.',
      };
    }
    return {
      category: 'BACKEND_RUNTIME_RESPONSE_UNSUCCESSFUL',
      actual: `Backend-dependent scenario was not accepted: ${result.backendEvidence.category || 'backend'} traffic completed without a successful response (${result.backendEvidence.statusClass || 'unknown'}).`,
      expected: 'A successful classified backend response during the scenario.',
    };
  }
  const sessionRestored = result?.scenarioId === 'runtime_e2e.app_bootstrap_guest_home'
    && result?.proofLevel === RUNTIME_E2E_PROOF_LEVEL.SESSION_RESTORED
    && Boolean(report?.homeVisible || report?.preflight?.homeVisible)
    && Boolean(report?.authenticatedOrStoredSession || report?.preflight?.authenticatedOrStoredSession);
  const backendConnected = result?.proofLevel === RUNTIME_E2E_PROOF_LEVEL.BACKEND_CONNECTED
    && result?.backendEvidence?.observed === true
    && result?.backendEvidence?.successful === true;
  const runtimeProbeStatus = new Set([
    BACKEND_PREFLIGHT_STATUS.PROD_CUSTOM_DOMAIN_PREFLIGHT_UNSUPPORTED,
    BACKEND_PREFLIGHT_STATUS.PROD_RUNTIME_PROBE_REQUIRED,
  ]);
  if (runtimeProbeStatus.has(preflightStatus) && !sessionRestored && !backendConnected) {
    return {
      category: 'BACKEND_RUNTIME_PROBE_NOT_OBSERVED',
      actual: 'Backend-dependent scenario was not accepted: production direct preflight is limited and no successful scenario backend response was observed.',
      expected: 'Successful scenario-level backend evidence, or explicit SESSION_RESTORED proof for App bootstrap only.',
    };
  }
  if (preflightStatus === BACKEND_PREFLIGHT_STATUS.REACHABLE && !sessionRestored && !backendConnected) {
    return {
      category: 'BACKEND_RUNTIME_EVIDENCE_MISSING',
      actual: 'Backend-dependent scenario was not accepted: direct reachability does not replace scenario-level backend evidence.',
      expected: 'A successful classified backend response during the scenario.',
    };
  }
  if (preflightStatus && preflightStatus !== BACKEND_PREFLIGHT_STATUS.REACHABLE && !runtimeProbeStatus.has(preflightStatus)) {
    return {
      category: `BACKEND_PREFLIGHT_${preflightStatus}`,
      actual: `Backend-dependent scenario was not accepted: backend preflight is ${preflightStatus}.`,
      expected: 'A supported direct preflight or an allowed production scenario runtime probe.',
    };
  }
  return null;
}

function normalizeScenarioResult(report, result = {}) {
  const definition = getRuntimeE2EScenario(result.scenarioId);
  if (!definition) return null;
  const suppliedSteps = Array.isArray(result.steps) ? result.steps : [];
  let steps = definition.steps.map((item) => normalizeStep(
    suppliedSteps.find((step) => step?.id === item.id),
    item,
  ));
  let status = AUTOMATION_STATUSES.has(result.status) ? result.status : AUTOMATION_STATUS.NOT_RUN;
  let actual = result.actual || '';
  let failureCategory = result.failureCategory || null;
  let failedStepId = result.failedStepId || null;
  let failedStepTitle = result.failedStepTitle || null;
  let expected = result.expected || null;
  const uiOnly = definition.executionScope === RUNTIME_E2E_EXECUTION_SCOPE.UI_ONLY;
  const backendDependent = !uiOnly;
  const proofLevel = Object.values(RUNTIME_E2E_PROOF_LEVEL).includes(result.proofLevel)
    ? result.proofLevel
    : uiOnly
      ? RUNTIME_E2E_PROOF_LEVEL.UI_ONLY
      : result.status === AUTOMATION_STATUS.MANUAL_EXTERNAL
        ? RUNTIME_E2E_PROOF_LEVEL.MANUAL_EXTERNAL
        : RUNTIME_E2E_PROOF_LEVEL.BACKEND_RUNTIME_PROBE;
  const backendEvidence = result.backendEvidence || summarizeRuntimeBackendEvidence();
  const preflightDependency = Object.values(RUNTIME_E2E_PREFLIGHT_DEPENDENCY).includes(result.preflightDependency)
    ? result.preflightDependency
    : uiOnly
      ? RUNTIME_E2E_PREFLIGHT_DEPENDENCY.NOT_REQUIRED
      : report.productionCustomDomainMode
        ? RUNTIME_E2E_PREFLIGHT_DEPENDENCY.RUNTIME_PROBE
        : RUNTIME_E2E_PREFLIGHT_DEPENDENCY.DIRECT;
  const backendBlock = backendPreflightBlock(report, result);
  if (status === AUTOMATION_STATUS.PASS && backendBlock) {
    status = AUTOMATION_STATUS.NOT_AUTOMATABLE;
    actual = backendBlock.actual;
    failureCategory = backendBlock.category;
    failedStepId = 'backend-preflight';
    failedStepTitle = 'Backend reachability preflight';
    expected = backendBlock.expected;
    steps = steps.map((item) => ({
      ...item,
      status: AUTOMATION_STATUS.NOT_AUTOMATABLE,
      failureCategory: backendBlock.category,
      actual: backendBlock.actual,
    }));
  }
  if (status === AUTOMATION_STATUS.PASS && !hasRealAutomationEvidence(report, { ...result, steps })) {
    status = AUTOMATION_STATUS.FAIL;
    actual = 'PASS rejected: real browser execution evidence is incomplete.';
    failureCategory = 'MISSING_EXECUTION_EVIDENCE';
    failedStepId = 'runtime-evidence-gate';
    failedStepTitle = 'Real browser execution evidence';
    expected = 'A completed run, meaningful page origin, browser identity, and timed PASS evidence for every required step.';
  }
  const consoleErrorSummary = summarizeRuntimeConsoleErrors([
    ...(result.consoleErrors || []),
    ...(result.consoleErrorSummary?.items || []),
  ]);
  const failedStep = steps.find((item) => item.status === AUTOMATION_STATUS.FAIL);
  const networkErrorSummary = summarizeRuntimeNetworkErrors(result.networkErrors || []);
  const screenshotPath = result.screenshotPath || failedStep?.screenshotPath || null;
  const tracePath = result.tracePath || failedStep?.tracePath || null;
  const statusWasDemoted = result.status === AUTOMATION_STATUS.PASS && status !== AUTOMATION_STATUS.PASS;
  const statusReason = (statusWasDemoted ? actual : result.statusReason) || actual || (
    status === AUTOMATION_STATUS.PASS
      ? uiOnly && !report.backendAvailable
        ? 'Browser-only UI assertions passed; backend was unavailable and this is not backend proof.'
        : 'All required runtime steps passed.'
      : 'Scenario did not complete.'
  );
  return sanitizeAutomationValue({
    ...result,
    scenarioId: definition.scenarioId,
    scenarioTitle: definition.title,
    requiredCapabilities: definition.requiredCapabilities,
    optionalCapabilities: definition.optionalCapabilities,
    capabilityStatus: result.capabilityStatus || [],
    executionScope: definition.executionScope,
    backendDependent,
    uiOnly,
    backendServices: definition.backendServices,
    preflightDecision: result.preflightDecision || 'NOT_RECORDED',
    proofLevel,
    backendEvidence,
    preflightDependency,
    blockReason: status === AUTOMATION_STATUS.PASS ? null : (result.blockReason || actual || null),
    status,
    statusReason,
    durationMs: result.durationMs != null && Number.isFinite(Number(result.durationMs))
      ? Number(result.durationMs)
      : null,
    failureCategory,
    failedStepId,
    failedStepTitle,
    expected,
    actual,
    steps,
    executionEvidence: report.executionEvidence,
    consoleErrorSummary,
    criticalConsoleErrors: consoleErrorSummary.items.filter((item) => item.critical),
    consoleErrors: consoleErrorSummary.items,
    networkErrorSummary,
    networkErrors: networkErrorSummary.items,
    relatedFiles: result.relatedFiles || [],
    safeReproductionSteps: result.safeReproductionSteps || definition.steps.map((item) => item.action),
    safeSetupInstructions: result.safeSetupInstructions || definition.manualFallback,
    nextAction: result.nextAction || definition.manualFallback,
    screenshotPath,
    tracePath,
  });
}

export function normalizeRuntimeE2EReport(input, buildMarker = 'unknown') {
  if (!input || typeof input !== 'object') return createNotRunAutomationReport(buildMarker);
  const evidence = input.executionEvidence || null;
  const rawPreflight = input.preflight || evidence?.backendPreflight || null;
  const preflightConsoleSummary = summarizeRuntimeConsoleErrors(rawPreflight?.consoleErrors || []);
  const safePreflight = rawPreflight ? sanitizeAutomationValue({
    ...rawPreflight,
    consoleErrorSummary: preflightConsoleSummary,
    consoleErrors: preflightConsoleSummary.items,
  }) : null;
  const configuredBaseUrl = input.configuredBaseUrl || evidence?.configuredBaseUrl || safePreflight?.configuredBaseUrl || null;
  const targetKind = input.targetKind
    || input.environment?.targetKind
    || safePreflight?.targetKind
    || (configuredBaseUrl ? classifyRuntimeE2ETarget(configuredBaseUrl) : null);
  const explicitProductionMode = input.productionCustomDomainMode
    ?? input.environment?.productionCustomDomainMode
    ?? safePreflight?.productionCustomDomainMode;
  const productionCustomDomainMode = explicitProductionMode == null
    ? targetKind === RUNTIME_E2E_TARGET_KIND.PRODUCTION_CUSTOM_DOMAIN
    : Boolean(explicitProductionMode);
  const reportedDirectBackendPreflightStatus = input.directBackendPreflightStatus
    || safePreflight?.directBackendPreflightStatus
    || safePreflight?.status
    || null;
  const directBackendPreflightStatus = productionCustomDomainMode && (
    reportedDirectBackendPreflightStatus === BACKEND_PREFLIGHT_STATUS.UNKNOWN
    || reportedDirectBackendPreflightStatus === BACKEND_PREFLIGHT_STATUS.OBSERVATION_INCONCLUSIVE
  )
    ? BACKEND_PREFLIGHT_STATUS.PROD_CUSTOM_DOMAIN_PREFLIGHT_UNSUPPORTED
    : reportedDirectBackendPreflightStatus;
  const resolvedPreflightStatus = resolveRuntimePreflightStatus({
    productionCustomDomainMode,
    directBackendPreflightStatus,
    canRunRuntimeProbes: Boolean(input.canRunRuntimeProbes ?? safePreflight?.canRunRuntimeProbes),
  });
  const preflight = safePreflight ? {
    ...safePreflight,
    status: resolvedPreflightStatus,
    targetKind,
    productionCustomDomainMode,
    directBackendPreflightStatus,
  } : null;
  const runtimeBackendProbeStatus = input.runtimeBackendProbeStatus
    || preflight?.runtimeBackendProbeStatus
    || RUNTIME_BACKEND_PROBE_STATUS.NOT_RUN;
  const backendAvailable = input.backendAvailable ?? (
    directBackendPreflightStatus === BACKEND_PREFLIGHT_STATUS.REACHABLE
    || runtimeBackendProbeStatus === RUNTIME_BACKEND_PROBE_STATUS.CONNECTED
  );
  const appConfigAvailable = input.appConfigAvailable ?? Boolean(preflight?.appConfigAvailable);
  const base44AppReachable = input.base44AppReachable ?? (
    Boolean(preflight?.base44AppReachable)
    || runtimeBackendProbeStatus === RUNTIME_BACKEND_PROBE_STATUS.CONNECTED
  );
  const serviceSummary = input.serviceSummary || preflight?.serviceSummary || {};
  const serviceSummaryUnavailableReason = input.serviceSummaryUnavailableReason
    || preflight?.serviceSummaryUnavailableReason
    || runtimeServiceSummaryUnavailableReason(serviceSummary);
  const permissionDiagnostics = input.permissionDiagnostics || preflight?.permissionDiagnostics || [];
  const homeVisible = Boolean(input.homeVisible ?? preflight?.homeVisible);
  const authenticatedOrStoredSession = Boolean(
    input.authenticatedOrStoredSession ?? preflight?.authenticatedOrStoredSession,
  );
  const canRunRuntimeProbes = Boolean(input.canRunRuntimeProbes ?? preflight?.canRunRuntimeProbes);
  const backendProofLevel = input.backendProofLevel
    || preflight?.backendProofLevel
    || (backendAvailable ? RUNTIME_E2E_PROOF_LEVEL.BACKEND_CONNECTED : RUNTIME_E2E_PROOF_LEVEL.UI_ONLY);
  const safeEvidence = evidence ? {
    ...evidence,
    preflight,
    backendPreflight: preflight,
    environment: input.environment || evidence.environment || null,
    capabilitySummary: input.capabilitySummary || evidence.capabilitySummary || {},
  } : null;
  const shell = sanitizeAutomationValue({
    ...input,
    type: 'KRONOX_RUNTIME_E2E_AUTOMATION_REPORT',
    version: 2,
    suiteId: RUNTIME_E2E_SUITE_ID,
    buildMarker: input.buildMarker || buildMarker,
    targetKind,
    productionCustomDomainMode,
    configuredBaseUrl,
    pageUrl: input.pageUrl || preflight?.pageUrl || evidence?.pageUrl || null,
    pageOrigin: input.pageOrigin || preflight?.pageOrigin || evidence?.pageOrigin || null,
    appRoute: input.appRoute || preflight?.appRoute || evidence?.appRoute || null,
    preflight,
    directBackendPreflightStatus,
    runtimeBackendProbeStatus,
    preflightStatusReason: input.preflightStatusReason || preflight?.preflightStatusReason || null,
    serviceSummary,
    serviceSummaryUnavailableReason,
    permissionDiagnostics,
    backendProofLevel,
    homeVisible,
    authenticatedOrStoredSession,
    canRunRuntimeProbes,
    preflightLimitations: input.preflightLimitations || preflight?.preflightLimitations || [],
    environment: input.environment || evidence?.environment || null,
    capabilitySummary: input.capabilitySummary || evidence?.capabilitySummary || {},
    backendAvailable,
    appConfigAvailable,
    base44AppReachable,
    executionEvidence: safeEvidence,
  });
  const suppliedResults = Array.isArray(input.scenarios) ? input.scenarios : [];
  const scenarios = RUNTIME_E2E_SCENARIOS.map((definition) => normalizeScenarioResult(
    shell,
    suppliedResults.find((item) => item?.scenarioId === definition.scenarioId) || {
      scenarioId: definition.scenarioId,
      status: AUTOMATION_STATUS.NOT_RUN,
      actual: 'Scenario was not included in this run.',
    },
  ));
  const criticalConsoleErrorCount = preflightConsoleSummary.criticalCount
    + scenarios.reduce((count, scenario) => count + (scenario.consoleErrorSummary?.criticalCount || 0), 0);
  return {
    ...shell,
    criticalConsoleErrorCount,
    scenarios,
    counts: buildAutomationCounters(scenarios),
  };
}

function issueStepFor(result) {
  return (result?.steps || []).find((step) => step.status === AUTOMATION_STATUS.FAIL)
    || (result?.steps || []).find((step) => step.id === result?.failedStepId)
    || (result?.steps || []).find((step) => SETUP_GAP_STATUSES.has(step.status))
    || null;
}

function buildAutomationIssueJson(report, scenarioId, setupGapOnly = false) {
  const normalized = normalizeRuntimeE2EReport(report, report?.buildMarker);
  const result = normalized.scenarios.find((item) => item.scenarioId === scenarioId);
  const isFailure = result?.status === AUTOMATION_STATUS.FAIL;
  const isSetupGap = SETUP_GAP_STATUSES.has(result?.status);
  if (!result || (setupGapOnly ? !isSetupGap : !isFailure && !isSetupGap)) return null;
  const issueStep = issueStepFor(result);
  return sanitizeAutomationValue({
    type: isFailure ? 'KRONOX_RUNTIME_E2E_AUTOMATION_FAILURE' : 'KRONOX_RUNTIME_E2E_AUTOMATION_SETUP_GAP',
    runId: normalized.runId,
    generatedAt: normalized.generatedAt,
    buildMarker: normalized.buildMarker,
    suiteId: RUNTIME_E2E_SUITE_ID,
    configuredBaseUrl: normalized.configuredBaseUrl,
    pageOrigin: normalized.pageOrigin,
    preflight: normalized.preflight,
    scenarioId: result.scenarioId,
    scenarioTitle: result.scenarioTitle,
    status: result.status,
    requiredCapabilities: result.requiredCapabilities,
    capabilityStatus: result.capabilityStatus,
    preflightDecision: result.preflightDecision,
    proofLevel: result.proofLevel,
    backendEvidence: result.backendEvidence,
    preflightDependency: result.preflightDependency,
    blockReason: result.blockReason,
    failedStepId: issueStep?.id || result.failedStepId || null,
    failedStepTitle: issueStep?.title || result.failedStepTitle || null,
    failureCategory: result.failureCategory || (isSetupGap ? 'AUTOMATION_SETUP_GAP' : 'UNCLASSIFIED_AUTOMATION_FAILURE'),
    expected: issueStep?.expected || result.expected || null,
    actual: issueStep?.actual || result.actual || null,
    route: issueStep?.route || result.route || null,
    selector: issueStep?.selector || result.selector || null,
    screenshotPath: issueStep?.screenshotPath || result.screenshotPath || null,
    tracePath: issueStep?.tracePath || result.tracePath || null,
    consoleErrorSummary: result.consoleErrorSummary,
    criticalConsoleErrors: result.criticalConsoleErrors,
    networkErrorSummary: result.networkErrorSummary,
    networkErrors: result.networkErrors || [],
    relatedFiles: result.relatedFiles || [],
    safeReproductionSteps: result.safeReproductionSteps || [],
    safeSetupInstructions: result.safeSetupInstructions,
    nextAction: result.nextAction || 'Inspect the scenario setup and rerun it in isolation.',
  });
}

export function buildAutomationFailureJson(report, scenarioId) {
  return buildAutomationIssueJson(report, scenarioId, false);
}

export function buildAutomationSetupGapJson(report, scenarioId) {
  return buildAutomationIssueJson(report, scenarioId, true);
}

export function buildAllAutomationFailuresJson(report) {
  const normalized = normalizeRuntimeE2EReport(report, report?.buildMarker);
  return {
    type: 'KRONOX_RUNTIME_E2E_AUTOMATION_ISSUES',
    runId: normalized.runId,
    generatedAt: normalized.generatedAt,
    buildMarker: normalized.buildMarker,
    suiteId: RUNTIME_E2E_SUITE_ID,
    failures: normalized.scenarios
      .filter((item) => item.status === AUTOMATION_STATUS.FAIL)
      .map((item) => buildAutomationFailureJson(normalized, item.scenarioId)),
    setupGaps: normalized.scenarios
      .filter((item) => SETUP_GAP_STATUSES.has(item.status))
      .map((item) => buildAutomationSetupGapJson(normalized, item.scenarioId)),
  };
}

export function buildAllAutomationSetupGapsJson(report) {
  const normalized = normalizeRuntimeE2EReport(report, report?.buildMarker);
  return {
    type: 'KRONOX_RUNTIME_E2E_AUTOMATION_SETUP_GAPS',
    runId: normalized.runId,
    generatedAt: normalized.generatedAt,
    buildMarker: normalized.buildMarker,
    suiteId: RUNTIME_E2E_SUITE_ID,
    setupGaps: normalized.scenarios
      .filter((item) => SETUP_GAP_STATUSES.has(item.status))
      .map((item) => buildAutomationSetupGapJson(normalized, item.scenarioId)),
  };
}

export function buildFullAutomationReportJson(report) {
  return normalizeRuntimeE2EReport(report, report?.buildMarker);
}
