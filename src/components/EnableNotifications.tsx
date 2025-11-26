import React, { useState, useEffect } from 'react';
import { Bell, Check, X } from 'lucide-react';

const EnableNotifications: React.FC = () => {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [serviceWorkerRegistered, setServiceWorkerRegistered] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // Check notification permission
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }

    // Check if service worker is registered
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        setServiceWorkerRegistered(registrations.length > 0);
      });
    }

    // Show prompt if permission is default and service worker is not registered
    if (Notification.permission === 'default' && !serviceWorkerRegistered) {
      // Show after 3 seconds
      const timer = setTimeout(() => {
        setShowPrompt(true);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [serviceWorkerRegistered]);

  const registerServiceWorker = async () => {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        console.log('Service Worker registered:', registration);
        setServiceWorkerRegistered(true);
        return registration;
      } catch (error) {
        console.error('Service Worker registration failed:', error);
        return null;
      }
    }
    return null;
  };

  const enableNotifications = async () => {
    // First register service worker
    await registerServiceWorker();

    // Then request notification permission
    if ('Notification' in window) {
      const result = await Notification.requestPermission();
      setPermission(result);
      setShowPrompt(false);

      if (result === 'granted') {
        console.log('✅ Notifications enabled!');
        
        // Show a test notification
        if ('serviceWorker' in navigator) {
          const registration = await navigator.serviceWorker.ready;
          registration.showNotification('Notifications Enabled!', {
            body: 'You will now receive notifications even when the app is closed.',
            icon: '/tconnect_logo-removebg-preview.png',
            badge: '/tconnect_logo-removebg-preview.png',
            tag: 'notification-enabled',
            requireInteraction: false,
            silent: false,
            vibrate: [200, 100, 200]
          });
        }
      } else {
        alert('Notifications were blocked. Please enable them in your browser settings.');
      }
    }
  };

  const dismissPrompt = () => {
    setShowPrompt(false);
    // Don't show again for this session
    sessionStorage.setItem('notification-prompt-dismissed', 'true');
  };

  // Don't show if already dismissed this session
  useEffect(() => {
    if (sessionStorage.getItem('notification-prompt-dismissed') === 'true') {
      setShowPrompt(false);
    }
  }, []);

  // Don't show if already enabled
  if (permission === 'granted' && serviceWorkerRegistered) {
    return null;
  }

  if (!showPrompt) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 w-[calc(100%-2rem)] max-w-md md:left-auto md:transform-none md:right-4 z-50 animate-slide-up">
      <div className="bg-dark-surface border-2 border-neon-blue/50 rounded-xl p-6 shadow-2xl neon-glow">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <Bell className="w-8 h-8 text-neon-blue" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-white mb-2">
              Enable Notifications
            </h3>
            <p className="text-sm text-gray-300 mb-4">
              Get notified about orders, messages, and updates even when the app is closed. 
              Your phone will alert you with sound and vibration.
            </p>
            <div className="flex gap-2">
              <button
                onClick={enableNotifications}
                className="flex-1 px-4 py-2 bg-neon-blue hover:bg-neon-blue/90 text-white font-semibold rounded-lg transition-all active:scale-95"
              >
                Enable
              </button>
              <button
                onClick={dismissPrompt}
                className="px-4 py-2 bg-dark-card hover:bg-dark-border text-gray-300 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnableNotifications;

