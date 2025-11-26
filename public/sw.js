// Service Worker for background notifications
const CACHE_NAME = 'tconnect-notifications-v1';

// Install event - cache resources
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// Handle push notifications
self.addEventListener('push', (event) => {
  console.log('Push notification received:', event);
  
  let notificationData = {
    title: 'TConnect Store',
    body: 'You have a new notification',
    icon: '/tconnect_logo-removebg-preview.png',
    badge: '/tconnect_logo-removebg-preview.png',
    tag: 'tconnect-notification',
    requireInteraction: false,
    silent: false
  };

  if (event.data) {
    try {
      const data = event.data.json();
      notificationData = {
        title: data.title || notificationData.title,
        body: data.message || data.body || notificationData.body,
        icon: data.icon || notificationData.icon,
        badge: data.badge || notificationData.badge,
        tag: data.id || data.tag || notificationData.tag,
        data: {
          url: data.url || data.link || '/',
          id: data.id
        },
        requireInteraction: false,
        silent: false
      };
    } catch (e) {
      notificationData.body = event.data.text() || notificationData.body;
    }
  }

  event.waitUntil(
    self.registration.showNotification(notificationData.title, {
      body: notificationData.body,
      icon: notificationData.icon,
      badge: notificationData.badge,
      tag: notificationData.tag,
      data: notificationData.data,
      requireInteraction: false,
      silent: false,
      vibrate: [200, 100, 200] // Vibration pattern for mobile
    })
  );
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then((clientList) => {
      // Check if there's already a window/tab open with the target URL
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      // If no window is open, open a new one
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Background sync for checking notifications
self.addEventListener('sync', (event) => {
  if (event.tag === 'check-notifications') {
    event.waitUntil(
      fetch('/api/notifications/check')
        .then(response => response.json())
        .then(data => {
          if (data.hasNew) {
            self.registration.showNotification('TConnect Store', {
              body: data.message,
              icon: '/tconnect_logo-removebg-preview.png',
              badge: '/tconnect_logo-removebg-preview.png',
              tag: 'new-notification',
              requireInteraction: false,
              silent: false,
              vibrate: [200, 100, 200]
            });
          }
        })
        .catch(err => console.error('Background sync error:', err))
    );
  }
});

// Periodic background sync (if supported)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'check-notifications-periodic') {
    event.waitUntil(
      fetch('/api/notifications/check')
        .then(response => response.json())
        .then(data => {
          if (data.hasNew) {
            self.registration.showNotification('TConnect Store', {
              body: data.message,
              icon: '/tconnect_logo-removebg-preview.png',
              badge: '/tconnect_logo-removebg-preview.png',
              tag: 'new-notification',
              requireInteraction: false,
              silent: false,
              vibrate: [200, 100, 200]
            });
          }
        })
        .catch(err => console.error('Periodic sync error:', err))
    );
  }
});

