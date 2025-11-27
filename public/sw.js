// Service Worker for background notifications
// Version 4 - Fixed iOS notification variable error (completely defensive)
const CACHE_NAME = 'tconnect-notifications-v4';

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
  // Don't log event directly as it might contain notification reference
  console.log('Notification clicked');
  
  // iOS Safari compatibility - NEVER reference notification without checking first
  let urlToOpen = '/';
  
  try {
    // Safely check if event exists
    if (!event) {
      console.log('No event object');
      urlToOpen = '/';
    } else {
      // Try to get notification object safely
      let notificationObj = null;
      try {
        if (event.hasOwnProperty('notification')) {
          notificationObj = event.notification;
        }
      } catch (e) {
        // event.notification doesn't exist or can't be accessed
        console.log('Cannot access event.notification');
      }
      
      // If we got notification object, try to close it and get URL
      if (notificationObj) {
        try {
          if (typeof notificationObj.close === 'function') {
            notificationObj.close();
          }
        } catch (e) {
          console.log('Cannot close notification');
        }
        
        try {
          if (notificationObj.data && notificationObj.data.url) {
            urlToOpen = notificationObj.data.url;
          }
        } catch (e) {
          console.log('Cannot access notification data');
        }
      }
      
      // Fallback: try to get data from event directly (iOS Safari)
      if (urlToOpen === '/') {
        try {
          if (event.data && event.data.url) {
            urlToOpen = event.data.url;
          }
        } catch (e) {
          console.log('Cannot access event.data');
        }
      }
    }
  } catch (error) {
    console.error('Error in notification click handler:', error);
    // Continue with default URL
    urlToOpen = '/';
  }
  
  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then((clientList) => {
      // Check if there's already a window/tab open
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        // Focus existing window and navigate to the URL
        if ('focus' in client) {
          client.focus();
          // For iOS Safari, we need to send a message to navigate
          if ('postMessage' in client) {
            try {
              client.postMessage({
                type: 'navigate',
                url: urlToOpen
              });
            } catch (error) {
              console.error('Error posting message:', error);
            }
          }
          return;
        }
      }
      // If no window is open, open a new one
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    }).catch((error) => {
      console.error('Error handling notification click:', error);
      // Fallback: try to open window directly
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

