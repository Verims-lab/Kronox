import { lazy } from 'react';

const STALE_CHUNK_ERROR_PATTERNS = [
  /failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /loading chunk \d+ failed/i,
  /importing a module script failed/i,
  /invalid or unexpected token/i,
  /unexpected token '<'/i,
];

function isRecoverableLazyChunkError(error) {
  const name = String(error?.name || '');
  const message = String(error?.message || error || '');
  const stack = String(error?.stack || '');
  const haystack = `${name}\n${message}\n${stack}`;
  return STALE_CHUNK_ERROR_PATTERNS.some((pattern) => pattern.test(haystack));
}

async function clearStaleBrowserAssets() {
  if (typeof window === 'undefined') return;

  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister().catch(() => false)));
    }
  } catch {
    // Best-effort cache recovery only; the import error remains the source of truth.
  }

  try {
    if ('caches' in window) {
      const keys = await window.caches.keys();
      await Promise.all(keys.map((key) => window.caches.delete(key).catch(() => false)));
    }
  } catch {
    // Ignore cache API failures; reload can still recover the fresh index/chunk graph.
  }
}

function hasReloadedForChunk(reloadFlag) {
  try {
    return sessionStorage.getItem(reloadFlag) === '1';
  } catch {
    return false;
  }
}

function markReloadedForChunk(reloadFlag) {
  try {
    sessionStorage.setItem(reloadFlag, '1');
  } catch {
    // If sessionStorage is unavailable, still allow the one recovery reload.
  }
}

/**
 * lazyWithRetry — resilient wrapper around React.lazy dynamic imports.
 *
 * "Failed to fetch dynamically imported module" happens when a new build is
 * deployed while the user has the old page open: the old lazy-chunk URLs
 * (hashed by the bundler) no longer exist on the server. Some hosts/WebViews
 * instead return HTML or stale bytes for a JS chunk; the browser then surfaces
 * `SyntaxError: Invalid or unexpected token` during lazy route evaluation.
 *
 * Fix:
 *   1. Retry the import once after a short delay (covers transient network
 *      blips).
 *   2. If the lazy chunk still fails with a recoverable fetch/evaluation
 *      signature, clear stale browser assets and force a ONE-TIME full page
 *      reload so the user gets the fresh index.html with the new chunk URLs.
 *      A sessionStorage flag prevents an infinite reload loop if the chunk is
 *      genuinely broken.
 */
export function lazyWithRetry(importFn, chunkKey = 'chunk') {
  return lazy(async () => {
    const reloadFlag = `kx-chunk-reloaded:${chunkKey}`;
    try {
      return await importFn();
    } catch (err) {
      // One retry after a brief pause for transient failures.
      try {
        await new Promise((r) => setTimeout(r, 400));
        return await importFn();
      } catch (err2) {
        const alreadyReloaded = hasReloadedForChunk(reloadFlag);
        if (!alreadyReloaded && isRecoverableLazyChunkError(err2)) {
          markReloadedForChunk(reloadFlag);
          await clearStaleBrowserAssets();
          window.location.reload();
          // Return a never-resolving promise so React keeps the Suspense
          // fallback up until the reload takes over.
          return new Promise(() => {});
        }
        // Already tried a reload — surface the error to the boundary.
        throw err2;
      }
    }
  });
}
