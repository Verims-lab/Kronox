import React, { useState } from 'react';
import { AlertCircle, Apple, Chrome, Mail } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const PROVIDER_ERROR_COPY = {
  apple: 'Apple ile giriş başlatılamadı. Base44 Authentication ayarlarında Apple sağlayıcısını etkinleştirip tekrar dene.',
  google: 'Google ile giriş başlatılamadı. Lütfen tekrar dene veya e-posta ile devam et.',
};

function safeErrorReason(error) {
  const message = String(error?.message || error || 'auth_start_failed').trim();
  return message.slice(0, 120);
}

export default function AuthProviderButtons({ fromUrl = '/', onBeforeStart, className = '' }) {
  const [error, setError] = useState('');

  const startProviderLogin = (provider) => {
    setError('');
    onBeforeStart?.();
    try {
      if (typeof base44.auth.loginWithProvider === 'function') {
        base44.auth.loginWithProvider(provider, fromUrl);
        return;
      }
      base44.auth.redirectToLogin(fromUrl);
    } catch (authError) {
      console.warn('[auth] provider login failed', {
        provider,
        reason: safeErrorReason(authError),
      });
      setError(PROVIDER_ERROR_COPY[provider] || 'Giriş başlatılamadı. Lütfen tekrar dene.');
    }
  };

  const startHostedLogin = () => {
    setError('');
    onBeforeStart?.();
    try {
      base44.auth.redirectToLogin(fromUrl);
    } catch (authError) {
      console.warn('[auth] hosted login failed', { reason: safeErrorReason(authError) });
      setError('Giriş ekranı açılamadı. Lütfen tekrar dene.');
    }
  };

  return (
    <div className={`w-full space-y-2 ${className}`}>
      <button
        type="button"
        onClick={() => startProviderLogin('apple')}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-white px-4 font-inter text-[12px] font-black text-slate-950 shadow-[0_10px_24px_rgba(0,0,0,0.25)] transition-transform active:scale-[0.98]"
        aria-label="Apple ile Giriş Yap"
      >
        <Apple className="h-4 w-4" />
        Apple ile Giriş Yap
      </button>

      <button
        type="button"
        onClick={() => startProviderLogin('google')}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-full px-4 font-inter text-[12px] font-black text-amber-100 shadow-[0_10px_24px_rgba(250,204,21,0.16)] transition-transform active:scale-[0.98]"
        style={{
          background: 'rgba(250,204,21,0.08)',
          boxShadow: 'inset 0 0 0 1px rgba(250,204,21,0.45), 0 10px 24px rgba(250,204,21,0.14)',
        }}
        aria-label="Google ile Giriş Yap"
      >
        <Chrome className="h-4 w-4" />
        Google ile Giriş Yap
      </button>

      <button
        type="button"
        onClick={startHostedLogin}
        className="mx-auto flex min-h-9 items-center justify-center gap-1.5 rounded-full px-3 font-inter text-[11px] font-bold text-blue-100/75 transition-colors hover:text-blue-50"
        aria-label="E-posta ile giriş yap veya diğer giriş yöntemlerini aç"
      >
        <Mail className="h-3.5 w-3.5" />
        E-posta ile devam et
      </button>

      {error && (
        <p
          className="flex items-start gap-1.5 rounded-xl px-3 py-2 font-inter text-[11px] font-semibold leading-snug text-red-100"
          style={{
            background: 'rgba(244,63,94,0.12)',
            boxShadow: 'inset 0 0 0 1px rgba(244,63,94,0.35)',
          }}
          role="alert"
        >
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
