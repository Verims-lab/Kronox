import React from 'react';
import { Button } from '@/components/ui/button';

/**
 * Codex084 — Tiny error boundary so a render crash inside the online game
 * cannot appear as a "black screen". The user always gets a visible message
 * + a Back button instead of an empty viewport.
 *
 * Strict scope:
 *   - UI-only. No mutations, no authority logic.
 *   - Reports through onError so the diagnostics overlay can show the
 *     real error string.
 */
export default class GameRenderErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    this.props.onError?.(error, info);
    // eslint-disable-next-line no-console
    console.error('[GameRenderErrorBoundary] caught render crash:', error, info);
  }

  handleReset = () => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.error) {
      const message = this.state.error?.message || String(this.state.error);
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-6">
          <div className="text-center space-y-4 max-w-sm">
            <p className="font-cinzel text-lg text-destructive font-black">
              Oyun ekranı yüklenemedi
            </p>
            <p className="font-inter text-xs text-muted-foreground break-words">
              {message}
            </p>
            <div className="flex flex-col gap-2">
              <Button onClick={this.handleReset} className="w-full">Tekrar Dene</Button>
              {this.props.onBackHome && (
                <Button onClick={this.props.onBackHome} variant="outline" className="w-full">
                  Ana Menüye Dön
                </Button>
              )}
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}