import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell, BellOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  disableCurrentPushSubscription,
  enableGameInviteNotifications,
  getNotificationPermission,
  getPushChainDiagnostics,
  getPushSupportState,
  registerKronoxServiceWorker,
} from '@/lib/notificationApi';

const reasonText = {
  unsupported_environment: 'Bu ortam bildirimleri desteklemiyor.',
  insecure_context: 'Bildirimler için HTTPS veya kurulu PWA ortamı gerekiyor.',
  notification_api_missing: 'Bu cihazda Notification API yok.',
  service_worker_missing: 'Bu cihazda service worker desteği yok.',
  push_manager_missing: 'Bu tarayıcı Web Push desteklemiyor.',
  missing_vapid_public_key: 'Bildirim anahtarı henüz yapılandırılmamış.',
  permission_denied: 'Bildirim izni bu cihazda kapalı.',
  permission_default: 'Bildirim izni henüz verilmedi.',
  no_subscription: 'Bu cihazda aktif bildirim aboneliği yok.',
  no_browser_subscription: 'Bu cihazda aktif push aboneliği yok.',
  no_saved_subscription: 'Bu cihazın bildirim aboneliği Kronox hesabına kayıtlı değil.',
  saved_subscription_endpoint_mismatch: 'Bu cihazdaki abonelik kaydı eski görünüyor.',
  ready: 'Bildirim zinciri hazır.',
};

function permissionLabel(permission) {
  if (permission === 'granted') return 'açık';
  if (permission === 'denied') return 'kapalı';
  if (permission === 'default') return 'sorulmadı';
  return 'desteklenmiyor';
}

function subscriptionLabel(diagnostics) {
  if (!diagnostics) return 'kontrol ediliyor';
  const reason = diagnostics.detailReason || diagnostics.reason;
  if (diagnostics.hasActiveSubscription) return 'aktif';
  if (reason === 'missing_vapid_public_key') return 'anahtar eksik';
  if (reason === 'no_browser_subscription') return 'cihaz aboneliği yok';
  if (reason === 'no_saved_subscription') return 'hesap kaydı yok';
  if (reason === 'saved_subscription_endpoint_mismatch') return 'yenileme gerekli';
  if (reason === 'no_subscription') return 'abonelik yok';
  if (reason === 'permission_default') return 'izin bekliyor';
  if (reason === 'permission_denied') return 'izin kapalı';
  return 'hazır değil';
}

export default function NotificationSettingsCard({ user, isAdmin = false }) {
  const [permission, setPermission] = useState(getNotificationPermission());
  const [support, setSupport] = useState(() => getPushSupportState());
  const [diagnostics, setDiagnostics] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const refreshDiagnostics = useCallback(async () => {
    setPermission(getNotificationPermission());
    setSupport(getPushSupportState());
    registerKronoxServiceWorker();
    const result = await getPushChainDiagnostics().catch(() => null);
    setDiagnostics(result);
    return result;
  }, []);

  useEffect(() => {
    refreshDiagnostics();
  }, [refreshDiagnostics, user?.email]);

  const canEnable = Boolean(
    user?.email
      && support.supported
      && permission !== 'denied'
      && !diagnostics?.hasActiveSubscription,
  );
  const helper = useMemo(() => {
    if (!user?.email) return 'Bildirimleri açmak için giriş yapmalısın.';
    if (!support.supported) return reasonText[support.reason] || 'Bildirimler bu cihazda desteklenmiyor.';
    if (permission === 'denied') return 'Bildirimler bu cihazda kapalı veya engellenmiş.';
    if (permission === 'granted' && diagnostics && !diagnostics.hasActiveSubscription) {
      return reasonText[diagnostics.detailReason] || reasonText[diagnostics.reason] || 'Bildirim izni açık ama cihaz aboneliği yenilenmeli.';
    }
    if (permission === 'granted') return 'Oyun davetlerinden telefon bildirimiyle haberdar olursun.';
    return 'Oyun davetlerinden haberdar ol.';
  }, [diagnostics, permission, support.reason, support.supported, user?.email]);

  const handleEnable = async () => {
    if (!canEnable || busy) return;
    setBusy(true);
    setMessage('');
    try {
      const result = await enableGameInviteNotifications();
      setPermission(result.permission || getNotificationPermission());
      const nextDiagnostics = await refreshDiagnostics();
      if (result.ok) {
        setMessage(nextDiagnostics?.hasActiveSubscription
          ? 'Bildirimler açıldı. Oyun davetlerini kaçırmayacaksın.'
          : 'İzin alındı, ama abonelik kaydı doğrulanamadı. Tekrar dene.');
      } else {
        setMessage(reasonText[result.reason] || 'Bildirimler açılamadı.');
      }
    } catch (error) {
      setMessage(error?.message || 'Bildirimler açılamadı.');
      setPermission(getNotificationPermission());
    } finally {
      setBusy(false);
    }
  };

  const handleDisable = async () => {
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      await disableCurrentPushSubscription();
      setPermission(getNotificationPermission());
      await refreshDiagnostics();
      setMessage('Bu cihazdaki Kronox bildirim aboneliği kapatıldı.');
    } catch (error) {
      setMessage(error?.message || 'Bildirim aboneliği kapatılamadı.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="rounded-2xl border p-4 space-y-3"
      style={{
        borderColor: 'rgba(250,204,21,0.28)',
        background: 'linear-gradient(180deg, rgba(30,41,75,0.38), rgba(8,13,30,0.72))',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 10px 24px rgba(2,6,23,0.22)',
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{
            background: permission === 'granted'
              ? 'linear-gradient(180deg,#ffe066,#b97a06)'
              : 'rgba(148,163,184,0.12)',
            boxShadow: 'inset 0 0 0 1px rgba(250,204,21,0.25)',
          }}
        >
          {permission === 'granted'
            ? <Bell className="h-5 w-5 text-amber-950" />
            : <BellOff className="h-5 w-5 text-blue-100/75" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-inter text-sm font-bold text-foreground">Oyun Daveti Bildirimleri</p>
          <p className="font-inter text-xs text-muted-foreground">{helper}</p>
          <p className="mt-1 font-inter text-[11px] text-amber-200/80">
            Durum: {permissionLabel(permission)} · Abonelik: {subscriptionLabel(diagnostics)}
          </p>
          {isAdmin && diagnostics?.savedSubscription?.checked && (
            <p className="mt-1 font-inter text-[10px] text-blue-100/55">
              Aktif kayıt: {diagnostics.savedSubscription.activeCount} · Cihaz: {diagnostics.displayMode}
            </p>
          )}
          {isAdmin && diagnostics && (
            <div className="mt-2 rounded-xl border border-blue-200/10 bg-slate-950/25 px-2.5 py-2 font-mono text-[10px] leading-relaxed text-blue-100/60">
              <p>Admin tanılama: {diagnostics.reason}{diagnostics.detailReason && diagnostics.detailReason !== diagnostics.reason ? ` / ${diagnostics.detailReason}` : ''}</p>
              <p>SW: {diagnostics.serviceWorker?.active ? 'active' : diagnostics.serviceWorker?.registered ? 'registered' : 'missing'} · PushManager: {diagnostics.pushManager?.supported ? 'yes' : 'no'}</p>
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          onClick={handleEnable}
          disabled={!canEnable || busy}
          className="flex-1"
        >
          {busy
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : permission === 'granted'
              ? 'Aboneliği Yenile'
              : 'Bildirimleri Aç'}
        </Button>
        {permission === 'granted' && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleDisable}
            disabled={busy}
            className="flex-1"
          >
            Kapat
          </Button>
        )}
      </div>

      {message && (
        <p className="font-inter text-xs text-blue-100/75">{message}</p>
      )}
    </div>
  );
}
