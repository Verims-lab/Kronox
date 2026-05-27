self.__KRONOX_SW_VERSION = 'Codex098';

function resolveSameOriginTarget(targetUrl) {
  try {
    const target = new URL(targetUrl || '/lobby', self.location.origin);
    if (target.origin !== self.location.origin) return `${self.location.origin}/lobby`;
    return target.href;
  } catch (_error) {
    return `${self.location.origin}/lobby`;
  }
}

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (_error) {
    payload = {};
  }

  const title = payload.title || 'Kronox';
  const body = payload.body || 'Yeni bir Kronox oyun davetin var.';
  const data = payload.data || {};
  const targetUrl = data.targetUrl || '/lobby';

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: data.icon || '/assets/ui/kronox_hero_section_v1.webp',
      badge: data.badge || '/assets/ui/kronox_hero_section_v1.webp',
      tag: data.inviteId ? `kronox-invite-${data.inviteId}` : 'kronox-invite',
      renotify: true,
      data: {
        ...data,
        targetUrl,
      },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification?.data?.targetUrl || '/lobby';
  const target = resolveSameOriginTarget(targetUrl);

  event.waitUntil((async () => {
    const clientsList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const sameOriginClients = clientsList.filter((client) => new URL(client.url).origin === self.location.origin);

    for (const client of sameOriginClients) {
      if ('focus' in client) {
        await client.focus();
        if ('navigate' in client) return client.navigate(target);
        return undefined;
      }
    }

    if (self.clients.openWindow) {
      return self.clients.openWindow(target);
    }
    return undefined;
  })());
});
