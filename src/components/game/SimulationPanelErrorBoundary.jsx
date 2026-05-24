import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

/**
 * Hard guard for the Kronox Health Simulator render path.
 *
 * Settings must NEVER crash because a simulator case, raw source import, or
 * report-render path throws. The simulator is a release-risk dashboard; the
 * dashboard itself must not become a release risk for the Settings route.
 *
 * Caught render-time errors are surfaced inside the boundary as a clear,
 * non-crashing error card. They are still HONEST — they do not silently pass,
 * they explicitly say the simulator failed to render and ask for a retry.
 */
export default class SimulationPanelErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error: error || new Error('Unknown simulator render error') };
  }

  componentDidCatch(error) {
    // Surface to console once so the developer still sees the original stack
    // while keeping the UI alive. Intentionally not using debugLog so this
    // also appears in production diagnostics.
    // eslint-disable-next-line no-console
    console.error('[SimulationPanel] render boundary caught:', error);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;

    const message = this.state.error?.message
      ? String(this.state.error.message)
      : 'Simulator failed to render.';

    return (
      <div
        className="fixed inset-0 z-[100] bg-black/82 text-white"
        style={{ padding: 'calc(1rem + env(safe-area-inset-top)) 1rem calc(1rem + env(safe-area-inset-bottom))' }}
      >
        <div className="mx-auto flex h-full w-full max-w-md flex-col items-stretch justify-center gap-4">
          <div className="rounded-lg border border-rose-400/40 bg-rose-500/10 p-4 text-rose-100">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-rose-300" />
              <div className="min-w-0 flex-1">
                <p className="font-inter text-sm font-bold">Kronox Health Simulator crashed.</p>
                <p className="mt-1 font-inter text-xs text-rose-100/80">
                  Settings was protected by an error boundary. The simulator dashboard itself failed
                  to render but the rest of the app is safe to use.
                </p>
                <pre className="mt-3 max-h-48 overflow-auto rounded bg-black/40 p-2 text-[11px] leading-relaxed text-rose-100/80">
                  {message}
                </pre>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={this.reset}
              className="inline-flex items-center gap-2 rounded-md border border-white/20 bg-white/[0.06] px-3 py-2 font-inter text-xs font-semibold text-white"
            >
              Retry
            </button>
            <button
              type="button"
              onClick={() => { this.reset(); this.props.onClose?.(); }}
              className="inline-flex items-center gap-2 rounded-md border border-white/20 bg-white/[0.06] px-3 py-2 font-inter text-xs font-semibold text-white"
            >
              <X className="h-3.5 w-3.5" />
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }
}