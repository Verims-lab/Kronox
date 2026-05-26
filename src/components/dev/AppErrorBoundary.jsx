/**
 * Codex085 — Top-level error boundary that catches render crashes ABOVE
 * the route renderer. If Game.jsx throws on first render, this boundary
 * catches it, pushes the error into the App-level diag bus, and shows a
 * visible fallback INSTEAD of a black screen.
 *
 * It is intentionally simple: no retry logic, no animations — just a
 * always-visible bright fallback so the user can return home and the
 * diagnostics overlay can show the captured error.
 */
import React from 'react';
import { pushAppDiag } from '@/lib/appDiagBus';

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    pushAppDiag({
      lastError: error?.message || String(error),
      lastErrorWhere: 'app_router',
    });
    // eslint-disable-next-line no-console
    console.error('[AppErrorBoundary] caught:', error, info);
  }

  reset = () => {
    this.setState({ error: null });
    pushAppDiag({ lastError: null, lastErrorWhere: null });
  };

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            minHeight: '100dvh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#0b1220',
            color: '#fef3c7',
            padding: 24,
            fontFamily: 'ui-monospace, monospace',
          }}
        >
          <div style={{ maxWidth: 480, textAlign: 'center' }}>
            <h1 style={{ color: '#facc15', fontSize: 22, marginBottom: 12 }}>
              Bir şeyler ters gitti
            </h1>
            <p style={{ fontSize: 14, opacity: 0.85, marginBottom: 16 }}>
              Ekran yüklenirken hata oluştu. Ana ekrana dönüp tekrar dene.
            </p>
            <pre
              style={{
                background: 'rgba(0,0,0,0.4)',
                border: '1px solid #f59e0b',
                color: '#fde68a',
                padding: 8,
                fontSize: 11,
                borderRadius: 6,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                marginBottom: 16,
                textAlign: 'left',
              }}
            >
              {this.state.error?.message || String(this.state.error)}
            </pre>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button
                onClick={() => { this.reset(); window.location.href = '/'; }}
                style={{
                  background: 'linear-gradient(180deg,#ffe066,#b97a06)',
                  color: '#1a1006',
                  fontWeight: 800,
                  padding: '10px 16px',
                  borderRadius: 8,
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Ana Ekrana Dön
              </button>
              <button
                onClick={this.reset}
                style={{
                  background: 'transparent',
                  color: '#fde68a',
                  fontWeight: 600,
                  padding: '10px 16px',
                  borderRadius: 8,
                  border: '1px solid #f59e0b',
                  cursor: 'pointer',
                }}
              >
                Yeniden Dene
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}