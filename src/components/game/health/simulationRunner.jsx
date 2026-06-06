// Kronox Health Center — Case runner (Codex123 split).
//
// SCOPE
//   Executes a single Health case, captures durations, and converts thrown
//   errors into a STATUS.ERROR result. Also exposes the run-meta and
//   environment capture helpers SimulationPanel uses to build a report.
//
// CONTRACT PRESERVED
//   - Same per-case shape: { ...caseMeta, status, reason, durationMs, ... }.
//   - Same error path: a thrown case produces STATUS.ERROR with message
//     and stack — never crashes the simulator.
//   - sanitizeForReport keeps defensive serialization of returned values.

import { STATUS, sanitizeForReport } from './healthStatus';
import buildMarkerSource from '../../dev/BuildMarker.jsx?raw';

export function extractBuildMarker() {
  const explicitMarker = buildMarkerSource.match(/BUILD_MARKER\s*=\s*['"`]([^'"`]+)['"`]/)?.[1];
  if (explicitMarker) return explicitMarker;

  const fallbackMarkers = Array.from(buildMarkerSource.matchAll(/Codex\d+/g)).map(match => match[0]);
  return fallbackMarkers[fallbackMarkers.length - 1] || 'unknown';
}

export function captureEnvironment() {
  const win = typeof window !== 'undefined' ? window : {};
  const doc = typeof document !== 'undefined' ? document : {};
  const nav = typeof navigator !== 'undefined' ? navigator : {};
  const ua = nav.userAgent || 'unknown';
  const touchSupport = Boolean(('ontouchstart' in win) || (nav.maxTouchPoints || 0) > 0);
  const viewport = { width: Number(win.innerWidth || 0), height: Number(win.innerHeight || 0) };
  const standalone = Boolean(
    win.matchMedia?.('(display-mode: standalone)')?.matches ||
    win.matchMedia?.('(display-mode: fullscreen)')?.matches ||
    nav.standalone === true,
  );
  const mobileLike = /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || (touchSupport && viewport.width < 820);

  return {
    route: win.location?.pathname || 'unknown',
    timestamp: new Date().toISOString(),
    deviceType: standalone ? 'pwa_or_webview' : mobileLike ? 'mobile_browser' : 'desktop_web',
    viewport,
    dpr: Number(win.devicePixelRatio || 1),
    userAgent: ua,
    touchSupport,
    maxTouchPoints: nav.maxTouchPoints || 0,
    standalone,
    safeAreaSupport: typeof CSS !== 'undefined' ? Boolean(CSS.supports?.('padding-top: env(safe-area-inset-top)')) : false,
    reducedMotion: Boolean(win.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches),
    networkOnline: nav.onLine !== false,
    visibilityState: doc.visibilityState || 'unknown',
    memory: performance?.memory ? {
      jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
      totalJSHeapSize: performance.memory.totalJSHeapSize,
      usedJSHeapSize: performance.memory.usedJSHeapSize,
    } : null,
    performanceObserverTypes: typeof PerformanceObserver !== 'undefined'
      ? (PerformanceObserver.supportedEntryTypes || [])
      : [],
  };
}

export function createRunMeta(casePlan = []) {
  const buildMarker = extractBuildMarker();
  return {
    runId: `KRONOX-${Date.now().toString(36).toUpperCase()}`,
    startedAt: new Date().toISOString(),
    buildMarker,
    build: {
      marker: buildMarker,
      branch: 'Codex',
      viteMode: import.meta.env.MODE,
      viteDev: Boolean(import.meta.env.DEV),
      viteProd: Boolean(import.meta.env.PROD),
      gitSha: import.meta.env.VITE_GIT_SHA || null,
    },
    casePlan,
  };
}

// Execute a single case object: { suiteId, suiteName, id, name, run, ... }.
// Returns a normalized result with durationMs. NEVER throws — any case
// error becomes STATUS.ERROR with reason + stack so the simulator can
// keep running the remaining cases.
export async function executeCase(testCase) {
  const started = performance.now();
  // Strip the function ref so it never ends up in serialised report data.
  const { run, ...caseMeta } = testCase;
  try {
    const raw = await run();
    const finished = performance.now();
    const safe = sanitizeForReport(raw || {});
    return {
      ...caseMeta,
      ...(safe && typeof safe === 'object' ? safe : { status: STATUS.ERROR, reason: 'Case returned a non-object result.' }),
      durationMs: Math.round(finished - started),
    };
  } catch (error) {
    const finished = performance.now();
    return {
      ...caseMeta,
      status: STATUS.ERROR,
      reason: (error && error.message) ? String(error.message) : 'Unknown case error',
      stack: error?.stack ? String(error.stack) : null,
      durationMs: Math.round(finished - started),
    };
  }
}
