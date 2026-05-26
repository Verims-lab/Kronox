import React, { useEffect, useMemo, useState } from 'react';
import { Bell, BellOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  disableCurrentPushSubscription,
  enableGameInviteNotifications,
  getNotificationPermission,
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
};

function permissionLabel(permission) {
  if (permission === 'granted') return 'açık';
  if (permission === 'denied') return 'kapalı';
  if (permission === 'default') return 'sorulmadı';
  return 'desteklenmiyor';
}

export default function NotificationSettingsCard({ user }) {
  const [permission, setPermission] = useState(getNotificationPermission());
  const [support, setSupport] = useState(() => getPushSupportState());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    setPermission(getNotificationPermission());
    setSupport(getPushSupportState());
    registerKronoxServiceWorker();
  }, []);

  const canEnable = Boolean(user?.email && support.supported && permission !== 'denied');
  const helper = useMemo(() => {
    if (!user?.email) return 'Bildirimleri açmak için giriş yapmalısın.';
    if (!support.supported) return reasonText[support.reason] || 'Bildirimler bu cihazda desteklenmiyor.';
    if (permission === 'denied') return 'Bildirimler bu cihazda kapalı veya engellenmiş.';
    if (permission === 'granted') return 'Oyun davetlerinden telefon bildirimiyle haberdar olursun.';
    return 'Oyun davetlerinden haberdar ol.';
  }, [permission, support.reason, support.supported, user?.email]);

  const handleEnable = async () => {
    if (!canEnable || busy) return;
    setBusy(true);
    setMessage('');
    try {
      const result = await enableGameInviteNotifications();
      setPermission(result.permission || getNotificationPermission());
      setSupport(getPushSupportState());
      if (result.ok) {
        setMessage('Bildirimler açıldı. Oyun davetlerini kaçırmayacaksın.');
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
            Durum: {permissionLabel(permission)}
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          onClick={handleEnable}
          disabled={!canEnable || busy || permission === 'granted'}
          className="flex-1"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Bildirimleri Aç'}
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
