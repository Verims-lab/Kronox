import { base44 } from '@/api/base44Client';
import { normalizeEmail } from '@/lib/friendsApi';

const SERVICE_WORKER_URL = '/kronox-sw.js';
const VAPID_PUBLIC_KEY = import.meta.env.VITE_KRONOX_VAPID_PUBLIC_KEY || '';

export function getNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return window.Notification.permission;
}

export function getPushSupportState() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return { supported: false, reason: 'unsupported_environment' };
  }
  if (!window.isSecureContext && window.location.hostname !== 'localhost') {
    return { supported: false, reason: 'insecure_context' };
  }
  if (!('Notification' in window)) {
    return { supported: false, reason: 'notification_api_missing' };
  }
  if (!('serviceWorker' in navigator)) {
    return { supported: false, reason: 'service_worker_missing' };
  }
  if (!('PushManager' in window)) {
    return { supported: false, reason: 'push_manager_missing' };
  }
  if (!VAPID_PUBLIC_KEY) {
    return { supported: false, reason: 'missing_vapid_public_key' };
  }
  return { supported: true, reason: 'supported' };
}

export async function registerKronoxServiceWorker() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register(SERVICE_WORKER_URL, { scope: '/' });
  } catch (error) {
    console.warn('[notifications] service worker registration failed:', error?.message || error);
    return null;
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export function serializePushSubscription(subscription) {
  const json = subscription?.toJSON?.() || {};
  return {
    endpoint: json.endpoint || subscription?.endpoint || '',
    keys_p256dh: json.keys?.p256dh || '',
    keys_auth: json.keys?.auth || '',
  };
}

export async function savePushSubscriptionRecord(subscription, permission = 'granted') {
  const user = await base44.auth.me();
  const userEmail = normalizeEmail(user?.email);
  if (!userEmail) throw new Error('Bildirimleri açmak için giriş yapmalısın.');

  const serialized = serializePushSubscription(subscription);
  if (!serialized.endpoint || !serialized.keys_p256dh || !serialized.keys_auth) {
    throw new Error('Bildirim aboneliği eksik oluşturuldu.');
  }

  const payload = {
    user_email: userEmail,
    endpoint: serialized.endpoint,
    keys_p256dh: serialized.keys_p256dh,
    keys_auth: serialized.keys_auth,
    permission,
    status: 'active',
    user_agent: navigator.userAgent || '',
    last_seen_at: new Date().toISOString(),
  };

  const existing = await base44.entities.PushSubscription.filter(
    { user_email: userEmail, endpoint: serialized.endpoint },
    '-created_date',
    1,
  );

  if (existing?.[0]?.id) {
    return base44.entities.PushSubscription.update(existing[0].id, payload);
  }
  return base44.entities.PushSubscription.create(payload);
}

export async function disableCurrentPushSubscription() {
  const registration = await navigator.serviceWorker?.ready;
  const subscription = await registration?.pushManager?.getSubscription?.();
  if (!subscription) return { disabled: false, reason: 'no_subscription' };

  const { endpoint } = serializePushSubscription(subscription);
  await subscription.unsubscribe();

  const user = await base44.auth.me().catch(() => null);
  const userEmail = normalizeEmail(user?.email);
  if (userEmail && endpoint) {
    const existing = await base44.entities.PushSubscription.filter(
      { user_email: userEmail, endpoint },
      '-created_date',
      5,
    ).catch(() => []);
    await Promise.all((existing || []).map((row) =>
      base44.entities.PushSubscription.update(row.id, {
        status: 'disabled',
        permission: getNotificationPermission(),
        disabled_at: new Date().toISOString(),
      }).catch(() => null),
    ));
  }

  return { disabled: true };
}

export async function enableGameInviteNotifications() {
  const support = getPushSupportState();
  if (!support.supported) return { ok: false, permission: getNotificationPermission(), ...support };

  const permission = await window.Notification.requestPermission();
  if (permission !== 'granted') {
    return { ok: false, permission, reason: permission === 'denied' ? 'permission_denied' : 'permission_default' };
  }

  const registration = await registerKronoxServiceWorker();
  const readyRegistration = registration || await navigator.serviceWorker.ready;
  let subscription = await readyRegistration.pushManager.getSubscription();

  if (!subscription) {
    subscription = await readyRegistration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  const record = await savePushSubscriptionRecord(subscription, permission);
  return { ok: true, permission, subscription: serializePushSubscription(subscription), record };
}
