import React, { Suspense } from 'react';
import { lazyWithRetry } from '@/lib/lazyWithRetry';

const AppDiagnostics = lazyWithRetry(
  () => import('@/components/dev/AppDiagnostics'),
  'AppDiagnostics',
);

function diagnosticsRequested() {
  if (typeof window === 'undefined') return false;
  try {
    if (new URLSearchParams(window.location.search).get('diag') === '1') return true;
  } catch { /* optional diagnostics */ }
  try { return window.localStorage?.getItem('kx_diag') === '1'; } catch { return false; }
}

export default function LazyAppDiagnostics({ currentUser }) {
  if (!diagnosticsRequested()) return null;
  return <Suspense fallback={null}><AppDiagnostics currentUser={currentUser} /></Suspense>;
}