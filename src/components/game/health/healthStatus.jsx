// Kronox Health Center — Status constants & result helpers (Codex123 split).
//
// SCOPE
//   Single source of truth for the status enum, status order, status look
//   metadata, persistence key, and the small result-object factories used
//   across the runner, report builder, and case files.
//
// HONESTY CONTRACTS PRESERVED
//   - Status enum values are unchanged (PASS / FAIL / WARNING / BLOCKED /
//     NOT_AUTOMATABLE / ERROR). No new statuses, no renames.
//   - sanitizeForReport keeps its defensive behavior — JSON-incompatible
//     values are stringified, never crashing the report export.
//   - safeRender keeps its defensive behavior for UI rendering.

import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Info,
  ShieldAlert,
  XCircle,
} from 'lucide-react';

export const STATUS = {
  PASS: 'PASS',
  FAIL: 'FAIL',
  WARNING: 'WARNING',
  BLOCKED: 'BLOCKED',
  NOT_AUTOMATABLE: 'NOT_AUTOMATABLE',
  ERROR: 'ERROR',
};

export const STATUS_ORDER = [
  STATUS.FAIL,
  STATUS.ERROR,
  STATUS.BLOCKED,
  STATUS.NOT_AUTOMATABLE,
  STATUS.WARNING,
  STATUS.PASS,
];

export const LAST_RUN_KEY = 'kronox_health_simulator_last_run_v1';

export const STATUS_LOOK = {
  [STATUS.PASS]: { Icon: CheckCircle2, color: '#4ade80', bg: 'rgba(74,222,128,0.10)', label: 'Pass' },
  [STATUS.FAIL]: { Icon: XCircle, color: '#fb7185', bg: 'rgba(251,113,133,0.13)', label: 'Fail' },
  [STATUS.WARNING]: { Icon: AlertTriangle, color: '#facc15', bg: 'rgba(250,204,21,0.12)', label: 'Warning' },
  [STATUS.BLOCKED]: { Icon: Ban, color: '#fb923c', bg: 'rgba(251,146,60,0.13)', label: 'Blocked' },
  [STATUS.NOT_AUTOMATABLE]: { Icon: Info, color: '#93c5fd', bg: 'rgba(147,197,253,0.12)', label: 'Not Automatable' },
  [STATUS.ERROR]: { Icon: ShieldAlert, color: '#f43f5e', bg: 'rgba(244,63,94,0.16)', label: 'Error' },
};

export function result(status, reason, extra = {}) {
  return { status, reason, ...extra };
}

export const pass = (reason, extra) => result(STATUS.PASS, reason, extra);
export const fail = (reason, extra) => result(STATUS.FAIL, reason, extra);
export const warning = (reason, extra) => result(STATUS.WARNING, reason, extra);
export const blocked = (reason, extra) => result(STATUS.BLOCKED, reason, extra);
export const notAutomatable = (reason, extra) => result(STATUS.NOT_AUTOMATABLE, reason, extra);

// Strip values that can't survive JSON serialization (functions, Symbols,
// Module namespaces, circular refs). The Health Simulator must never crash
// Settings because a case returned a weird value.
export function sanitizeForReport(value, seen = new WeakSet()) {
  if (value === null || value === undefined) return value;
  const type = typeof value;
  if (type === 'string' || type === 'number' || type === 'boolean') return value;
  if (type === 'function') return `[function ${value.name || 'anonymous'}]`;
  if (type === 'symbol') return value.toString();
  if (type === 'bigint') return value.toString();
  if (type !== 'object') return String(value);
  if (seen.has(value)) return '[circular]';
  seen.add(value);
  if (Array.isArray(value)) return value.map((item) => sanitizeForReport(item, seen));
  // Module namespace objects have Symbol.toStringTag === 'Module' and throw
  // on primitive coercion; coerce them to a clear marker instead of
  // recursing.
  try {
    if (value[Symbol.toStringTag] === 'Module') return '[module namespace]';
  } catch (_) {
    return '[unstringifiable object]';
  }
  const out = {};
  for (const key of Object.keys(value)) {
    try {
      out[key] = sanitizeForReport(value[key], seen);
    } catch (err) {
      out[key] = `[unreadable: ${err?.message || 'error'}]`;
    }
  }
  return out;
}

export function safeRender(value) {
  if (value === null || value === undefined) return '—';
  const type = typeof value;
  if (type === 'string') return value;
  if (type === 'number' || type === 'boolean' || type === 'bigint') return String(value);
  if (type === 'symbol') return value.toString();
  if (type === 'function') return `[function ${value.name || 'anonymous'}]`;
  try {
    return JSON.stringify(value);
  } catch (_) {
    return '[unstringifiable]';
  }
}