// Codex121 — Bulletproof Solo Adventure Map scroll helper.
//
// WHY THIS FILE EXISTS
//   The previous Codex117/Codex120 attempts moved the math into the
//   correct shape (getBoundingClientRect + useLayoutEffect + rAF retry)
//   but the live runtime still landed the scroll at scrollTop=0 — i.e.
//   the top of the reversed list, i.e. the "KRİSTAL ZİRVE 16-20" zone.
//
//   Possible runtime failure modes that the inline effect couldn't
//   defend against on a real WebView:
//
//     1. The scroll container's `clientHeight` is briefly 0 at the
//        moment the effect fires (flex layout settling). A finite rAF
//        loop bails out and the fallback `scrollIntoView` is invoked,
//        which the browser can resolve to an OUTER scrollable ancestor
//        (page-level) — that scrolls the page, not our container, so
//        our container stays at scrollTop=0.
//     2. A bottom fixed CTA covers the lower portion of the viewport,
//        so even when the math centers on the node, the visible viewport
//        (minus the CTA overlay) still shows mostly the wrong zone.
//     3. React schedules another commit (async progress load) right
//        after the focus jump and the browser keeps scrollTop=0 because
//        the inner content briefly reflowed.
//
//   This module isolates the scroll into a single pure function that
//   the React effect can call multiple times. The function:
//
//     • finds the target node via a stable `data-kx-solo-level` attribute
//       (not via the React refs map, which can desync after re-renders),
//     • measures container + node + the safe viewport (minus the bottom
//       CTA overlay) using getBoundingClientRect,
//     • derives a clamped scrollTop and ASSIGNS IT, even when smooth
//       scroll is in effect (we toggle to 'auto' for the jump),
//     • verifies the target is actually inside the visible band after
//       the jump and returns a structured diagnostic.
//
//   The caller (LevelMapPath) decides retry policy + when to log.

/**
 * Find the scroll container that owns the Solo map.
 * Returns the element (the `<div ref={containerRef}>` in LevelMapPath)
 * or null if the map isn't mounted.
 */
function findSoloMapContainer(root) {
  if (!root) return null;
  // Prefer a stable hook attribute we render on the container so the
  // function is decoupled from the React ref.
  if (root.matches && root.matches('[data-kx-solo-map-container="true"]')) return root;
  if (root.querySelector) {
    return root.querySelector('[data-kx-solo-map-container="true"]');
  }
  return null;
}

/**
 * Find the target level node inside the container.
 * Uses `data-kx-solo-level="<n>"` which we render alongside each node.
 */
function findLevelNode(container, levelNumber) {
  if (!container || typeof container.querySelector !== 'function') return null;
  return container.querySelector(`[data-kx-solo-level="${levelNumber}"]`);
}

/**
 * Compute the visible band of the container, subtracting any bottom
 * overlay (the floating Play CTA + BottomNav). `bottomOverlayPx` lets
 * the caller declare how many pixels at the bottom are "covered".
 */
function visibleBand(container, bottomOverlayPx = 0) {
  const rect = container.getBoundingClientRect();
  return {
    top: rect.top,
    bottom: rect.bottom - Math.max(0, bottomOverlayPx),
    height: Math.max(0, rect.bottom - rect.top - Math.max(0, bottomOverlayPx)),
    rect,
  };
}

/**
 * Is the node currently centered inside the visible band (with tolerance)?
 */
function isNodeCentered(container, node, bottomOverlayPx, tolerancePx = 32) {
  const band = visibleBand(container, bottomOverlayPx);
  if (band.height <= 0) return false;
  const nodeRect = node.getBoundingClientRect();
  const bandCenter = band.top + band.height / 2;
  const nodeCenter = nodeRect.top + nodeRect.height / 2;
  return Math.abs(nodeCenter - bandCenter) <= tolerancePx;
}

/**
 * Center `node` inside the visible band of `container`. Returns true
 * when the math could be applied (layout is ready), false when it must
 * be retried (clientHeight or rect height was zero).
 */
function applyCenterScroll(container, node, bottomOverlayPx) {
  const ch = container.clientHeight;
  if (ch === 0) return false;
  const band = visibleBand(container, bottomOverlayPx);
  if (band.height <= 0) return false;
  const nodeRect = node.getBoundingClientRect();
  if (nodeRect.height === 0) return false;

  // The visible band is `band` — we want the node's center to sit at
  // the center of the band. Compute the delta in container-local
  // coordinates, then assign scrollTop. Clamp to [0, scrollHeight - ch].
  const containerRect = container.getBoundingClientRect();
  const bandCenter = band.top + band.height / 2;
  const nodeCenter = nodeRect.top + nodeRect.height / 2;
  const delta = nodeCenter - bandCenter; // positive => need to scroll DOWN to bring node up
  const maxScroll = Math.max(0, container.scrollHeight - ch);
  const next = Math.min(maxScroll, Math.max(0, container.scrollTop + delta));

  // Suspend CSS smooth scrolling for the jump so it lands instantly.
  const previousBehavior = container.style.scrollBehavior;
  container.style.scrollBehavior = 'auto';
  container.scrollTop = next;
  // Restore on the next frame so subsequent user scrolls keep their
  // smooth feel.
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => {
      container.style.scrollBehavior = previousBehavior || '';
    });
  } else {
    container.style.scrollBehavior = previousBehavior || '';
  }
  // Touch a debug-only field so we can spot stale state in the wild.
  container.__kxLastScrollSet = {
    levelNumber: node.getAttribute('data-kx-solo-level'),
    scrollTop: next,
    containerRectTop: containerRect.top,
    nodeRectTop: nodeRect.top,
    bandTop: band.top,
    bandBottom: band.bottom,
    bottomOverlayPx,
    appliedAt: Date.now(),
  };
  return true;
}

/**
 * Public — scroll the Solo Adventure Map container so the level node
 * for `levelNumber` is centered inside the viewport band (minus the
 * fixed bottom CTA overlay).
 *
 * Returns a structured diagnostic object that the caller (or admin
 * logger) can inspect. Importantly, never throws — failures are
 * surfaced via `ok: false` so the React effect can retry.
 *
 * @param {HTMLElement|null} root - any ancestor of the map (typically
 *   document or the page root). The function walks down to the actual
 *   scroll container via `[data-kx-solo-map-container="true"]`.
 * @param {number} levelNumber - the level whose node should be centered.
 * @param {number} bottomOverlayPx - height of the fixed bottom CTA +
 *   BottomNav stack that overlays the container. Subtracted from the
 *   visible band so the node doesn't get hidden behind the CTA.
 */
export function scrollSoloMapToLevel(root, levelNumber, bottomOverlayPx = 0) {
  const container = findSoloMapContainer(root || (typeof document !== 'undefined' ? document : null));
  const diag = {
    ok: false,
    reason: '',
    levelNumber,
    bottomOverlayPx,
    containerFound: Boolean(container),
    nodeFound: false,
    scrollTopBefore: null,
    scrollTopAfter: null,
    clientHeight: null,
    scrollHeight: null,
    nodeCenteredAfter: null,
  };
  if (!container) {
    diag.reason = 'no_container';
    return diag;
  }
  diag.scrollTopBefore = container.scrollTop;
  diag.clientHeight = container.clientHeight;
  diag.scrollHeight = container.scrollHeight;

  const node = findLevelNode(container, levelNumber);
  diag.nodeFound = Boolean(node);
  if (!node) {
    diag.reason = 'no_node';
    return diag;
  }

  const applied = applyCenterScroll(container, node, bottomOverlayPx);
  diag.scrollTopAfter = container.scrollTop;
  if (!applied) {
    diag.reason = 'layout_not_ready';
    return diag;
  }
  diag.nodeCenteredAfter = isNodeCentered(container, node, bottomOverlayPx);
  diag.ok = true;
  diag.reason = diag.nodeCenteredAfter ? 'centered' : 'applied_but_not_centered';
  return diag;
}

/**
 * Repeatedly attempt `scrollSoloMapToLevel` across animation frames
 * until the node is centered (or the attempt budget is exhausted).
 * Honest about the contract: returns a cancel function the caller
 * MUST run on unmount to avoid running scroll on a torn-down DOM.
 *
 * @param {Object} opts
 * @param {HTMLElement|null} opts.root
 * @param {number} opts.levelNumber
 * @param {number} opts.bottomOverlayPx
 * @param {number} [opts.maxFrames=20] — ≈ 333ms at 60fps; enough for a
 *   WebView to settle layout AND for the async progress fetch tail.
 * @param {(diag: object) => void} [opts.onDiagnostic] — admin/dev hook.
 *   Called at most once per attempt with the structured diag object.
 */
export function attemptCenterSoloMap({ root, levelNumber, bottomOverlayPx, maxFrames = 20, onDiagnostic }) {
  if (!Number.isFinite(Number(levelNumber))) return () => {};
  let cancelled = false;
  let rafId = 0;
  let frames = 0;
  const tick = () => {
    if (cancelled) return;
    const diag = scrollSoloMapToLevel(root, levelNumber, bottomOverlayPx);
    try { onDiagnostic && onDiagnostic({ ...diag, frame: frames }); } catch (_e) { /* ignore */ }
    // Success only when we both applied the scroll AND verified the
    // node sits inside the visible band. Otherwise keep retrying.
    if (diag.ok && diag.nodeCenteredAfter) return;
    frames += 1;
    if (frames >= maxFrames) return;
    if (typeof requestAnimationFrame === 'function') {
      rafId = requestAnimationFrame(tick);
    }
  };
  if (typeof requestAnimationFrame === 'function') {
    rafId = requestAnimationFrame(tick);
  } else {
    tick();
  }
  return () => {
    cancelled = true;
    if (rafId && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(rafId);
  };
}