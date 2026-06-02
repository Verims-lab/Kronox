import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { getPushSupportState } from '@/lib/notificationApi';

/**
 * NotificationDeploymentHint — Codex096
 *
 * Shown only when push infrastructure (VAPID) is missing.
 *  - Normal users: friendly one-liner "Bildirim altyapısı henüz yapılandırılmamış."
 *  - Admin users (isAdmin prop): also reveals the exact missing env/secret names
 *    so the operator knows what to set in production.
 *
 * No fetch, no mutation, no leakage of secret values — names only.
 */
export default function NotificationDeploymentHint({ isAdmin }) {
  const support = getPushSupportState();
  if (support.reason !== 'missing_vapid_public_key') return null;

  return (
    <div
      className="rounded-2xl border p-3 space-y-2"
      style={{
        borderColor: 'rgba(250,204,21,0.30)',
        background: 'rgba(250,204,21,0.06)',
        boxShadow: 'inset 0 0 0 1px rgba(250,204,21,0.18)',
      }}
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-300 mt-0.5" />
        <p className="font-inter text-xs text-amber-100">
          Bildirim altyapısı henüz yapılandırılmamış. Bildirimler bu sürümde açılamaz.
        </p>
      </div>

      {isAdmin && (
        <div
          className="rounded-xl p-2.5 space-y-1"
          style={{
            background: 'rgba(8,13,30,0.55)',
            boxShadow: 'inset 0 0 0 1px rgba(250,204,21,0.20)',
          }}
        >
          <p className="font-inter text-[10px] font-black uppercase tracking-widest text-amber-200/80">
            Admin — eksik yapılandırma
          </p>
          <ul className="font-mono text-[11px] leading-relaxed text-blue-100/80">
            <li>• VITE_KRONOX_VAPID_PUBLIC_KEY (build env)</li>
            <li>• VAPID_PUBLIC_KEY (server secret)</li>
            <li>• VAPID_PRIVATE_KEY (server secret)</li>
            <li>• VAPID_SUBJECT (server secret, örn. mailto:support@kronox.app)</li>
          </ul>
          <p className="font-inter text-[10px] text-blue-100/55">
            Anahtar çiftini bir kez üret, ardından üç sunucu secret’ı ve eşleşen public key’i build env olarak ayarla. KRONOX_* isimleri eski kurulumlarla uyum için kabul edilir.
          </p>
        </div>
      )}
    </div>
  );
}
