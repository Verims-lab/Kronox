export const ADAPTIVE_POLLER_DEFAULTS = Object.freeze({
  minDelayMs: 1800,
  maxDelayMs: 12000,
  backoffFactor: 1.8,
});

function clampDelay(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.floor(number) : fallback;
}

/**
 * @param {{
 *   task?: (source: string) => unknown | Promise<unknown>,
 *   minDelayMs?: number,
 *   maxDelayMs?: number,
 *   backoffFactor?: number,
 *   onError?: (error: unknown, source: string, failureCount: number) => void,
 *   windowObject?: any,
 *   documentObject?: any,
 * }} [options]
 */
export function createAdaptivePoller({
  task,
  minDelayMs = ADAPTIVE_POLLER_DEFAULTS.minDelayMs,
  maxDelayMs = ADAPTIVE_POLLER_DEFAULTS.maxDelayMs,
  backoffFactor = ADAPTIVE_POLLER_DEFAULTS.backoffFactor,
  onError,
  windowObject,
  documentObject,
} = {}) {
  if (typeof task !== 'function') throw new TypeError('adaptive poller requires a task');

  const targetWindow = windowObject ?? globalThis.window;
  const targetDocument = documentObject ?? globalThis.document;
  const minimum = clampDelay(minDelayMs, ADAPTIVE_POLLER_DEFAULTS.minDelayMs);
  const maximum = Math.max(minimum, clampDelay(maxDelayMs, ADAPTIVE_POLLER_DEFAULTS.maxDelayMs));
  const factor = Math.max(1, Number(backoffFactor) || ADAPTIVE_POLLER_DEFAULTS.backoffFactor);
  let active = false;
  let inFlight = false;
  let timerId = null;
  let failureCount = 0;

  const clearTimer = () => {
    if (timerId === null || !targetWindow?.clearTimeout) return;
    targetWindow.clearTimeout(timerId);
    timerId = null;
  };

  const nextDelay = () => Math.min(maximum, Math.round(minimum * (factor ** failureCount)));

  const schedule = (delay = nextDelay()) => {
    if (!active || !targetWindow?.setTimeout) return;
    clearTimer();
    timerId = targetWindow.setTimeout(() => {
      timerId = null;
      void run('poll');
    }, Math.max(0, delay));
  };

  const run = async (source = 'poll') => {
    if (!active || inFlight) return false;
    if (source === 'poll' && targetDocument?.visibilityState === 'hidden') {
      schedule(minimum);
      return false;
    }

    inFlight = true;
    try {
      await task(source);
      failureCount = 0;
      return true;
    } catch (error) {
      failureCount += 1;
      onError?.(error, source, failureCount);
      return false;
    } finally {
      inFlight = false;
      schedule();
    }
  };

  const handleFocus = () => { void run('window-focus'); };
  const handleOnline = () => { void run('network-online'); };
  const handleVisibility = () => {
    if (targetDocument?.visibilityState === 'visible') void run('visibility-refresh');
  };

  return {
    start({ immediate = false } = {}) {
      if (active) return;
      active = true;
      targetWindow?.addEventListener?.('focus', handleFocus);
      targetWindow?.addEventListener?.('online', handleOnline);
      targetDocument?.addEventListener?.('visibilitychange', handleVisibility);
      if (immediate) void run('initial');
      else schedule(minimum);
    },
    stop() {
      if (!active) return;
      active = false;
      clearTimer();
      targetWindow?.removeEventListener?.('focus', handleFocus);
      targetWindow?.removeEventListener?.('online', handleOnline);
      targetDocument?.removeEventListener?.('visibilitychange', handleVisibility);
    },
    trigger(source = 'manual') {
      return run(source);
    },
    getState() {
      return { active, inFlight, failureCount, nextDelayMs: nextDelay() };
    },
  };
}
