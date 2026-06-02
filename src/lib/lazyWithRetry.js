import { lazy } from 'react';

/**
 * lazyWithRetry — resilient wrapper around React.lazy dynamic imports.
 *
 * "Failed to fetch dynamically imported module" happens when a new build is
 * deployed while the user has the old page open: the old lazy-chunk URLs
 * (hashed by the bundler) no longer exist on the server. The browser throws
 * a TypeError and the route is left blank.
 *
 * Fix:
 *   1. Retry the import once after a short delay (covers transient network
 *      blips).
 *   2. If it still fails, force a ONE-TIME full page reload so the user gets
 *      the fresh index.html with the new chunk URLs. A sessionStorage flag
 *      prevents an infinite reload loop if the chunk is genuinely broken.
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
        const alreadyReloaded = sessionStorage.getItem(reloadFlag) === '1';
        if (!alreadyReloaded) {
          sessionStorage.setItem(reloadFlag, '1');
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