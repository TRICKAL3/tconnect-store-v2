import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import { getApiBase } from '../lib/getApiBase';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  read: boolean;
  createdAt: string;
}

interface NotificationContextValue {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  markAsRead: (id: string) => Promise<void>;
  refreshNotifications: () => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const API_BASE = getApiBase();
  
  // Track previous state to detect new notifications
  const prevNotificationsRef = useRef<Notification[]>([]);
  const hasRequestedPermission = useRef(false);

  const fetchNotifications = useCallback(async () => {
    if (!user?.email) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/notifications?email=${encodeURIComponent(user.email)}`, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
        setUnreadCount(data.filter((n: Notification) => !n.read).length);
        return data;
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
    return [];
  }, [user?.email, API_BASE]);

  const fetchUnreadCount = useCallback(async () => {
    if (!user?.email) {
      setUnreadCount(0);
      return 0;
    }

    try {
      const res = await fetch(`${API_BASE}/notifications/unread-count?email=${encodeURIComponent(user.email)}`, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.count);
        return data.count;
      }
    } catch (error) {
      console.error('Failed to fetch unread count:', error);
    }
    return 0;
  }, [user?.email, API_BASE]);

  const refreshNotifications = useCallback(async () => {
    await fetchNotifications();
  }, [fetchNotifications]);

  const markAsRead = useCallback(async (id: string) => {
    if (!user?.email) return;

    try {
      const res = await fetch(`${API_BASE}/notifications/${id}/read`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email: user.email })
      });

      if (res.ok) {
        setNotifications(prev => 
          prev.map(n => n.id === id ? { ...n, read: true } : n)
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  }, [user?.email, API_BASE]);

  const markAllAsRead = useCallback(async () => {
    if (!user?.email) return;

    try {
      const res = await fetch(`${API_BASE}/notifications/mark-all-read`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email: user.email })
      });

      if (res.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  }, [user?.email, API_BASE]);

  // Play notification sound - using multiple methods for better compatibility
  const playNotificationSound = useCallback(() => {
    try {
      // Method 1: Try Web Audio API
      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        // Create a pleasant notification sound (two-tone beep)
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.3);
      } catch (audioError) {
        // Method 2: Fallback to HTML5 Audio with data URI
        const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OSfTQ8MT6fj8LZjHAY4kdfyzHksBSR3x/DdkEAKFF606euoVRQKRp/g8r5sIQUrgc7y2Yk2CBtpvfDkn00PDE+n4/C2YxwGOJHX8sx5LAUkd8fw3ZBAC');
        audio.volume = 0.5;
        audio.play().catch(() => {
          // If audio play fails, try creating a simple beep
          console.log('Audio playback not available');
        });
      }
    } catch (error) {
      console.error('Failed to play notification sound:', error);
    }
  }, []);

  // Detect iOS Safari
  const isIOS = useCallback(() => {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
           (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }, []);

  // Show browser notification - DISABLED on iOS, only use in-app notifications
  const showBrowserNotification = useCallback(async (notification: Notification) => {
    // Check if notification exists
    if (!notification || typeof notification !== 'object') {
      return;
    }
    
    // For iOS: Skip browser notifications entirely - just play sound and show in-app
    const isIOSDevice = isIOS();
    if (isIOSDevice) {
      // Only play sound for iOS - notifications will show in the bell dropdown
      playNotificationSound();
      return;
    }
    
    // For non-iOS devices: Show browser notifications
    if (typeof window.Notification !== 'undefined' && window.Notification.permission === 'granted') {
      try {
        const baseUrl = window.location.origin;
        // Store notification properties in local variables immediately
        const notificationId = notification.id || '';
        const notificationTitle = notification.title || 'Notification';
        const notificationMessage = notification.message || '';
        const notificationLink = notification.link || null;
        const notificationUrl = notificationLink 
          ? `${baseUrl}${notificationLink.startsWith('/') ? notificationLink : '/' + notificationLink}`
          : `${baseUrl}/notifications/${notificationId}`;
        
        // Try Service Worker for non-iOS devices
        if ('serviceWorker' in navigator) {
          try {
            const registration = await navigator.serviceWorker.ready;
            await registration.showNotification(notificationTitle, {
              body: notificationMessage,
              icon: '/tconnect_logo-removebg-preview.png',
              badge: '/tconnect_logo-removebg-preview.png',
              tag: notificationId,
              requireInteraction: false,
              silent: false,
              vibrate: [200, 100, 200],
              data: {
                url: notificationUrl,
                id: notificationId
              }
            });
            
            playNotificationSound();
            return;
          } catch (swError) {
            console.log('Service Worker notification failed, using regular notification:', swError);
          }
        }
        
        // Fallback to regular browser notification
        const finalUrl = notificationUrl;
        if (typeof window.Notification === 'undefined') {
          console.log('Notification API not available');
          return;
        }
        const browserNotification = new window.Notification(notificationTitle, {
          body: notificationMessage,
          icon: '/tconnect_logo-removebg-preview.png',
          badge: '/tconnect_logo-removebg-preview.png',
          tag: notificationId,
          requireInteraction: false,
          silent: false,
          data: {
            url: notificationUrl,
            id: notificationId
          }
        });

        playNotificationSound();

        browserNotification.onclick = function(event: Event) {
          try {
            if (event) {
              event.preventDefault();
            }
            window.focus();
            if (finalUrl) {
              window.location.href = finalUrl;
            }
            try {
              if (browserNotification && typeof browserNotification.close === 'function') {
                browserNotification.close();
              }
            } catch (e) {
              // Ignore
            }
          } catch (error) {
            console.error('Error in click handler:', error);
            try {
              if (browserNotification && typeof browserNotification.close === 'function') {
                browserNotification.close();
              }
            } catch (e) {
              // Ignore
            }
          }
        };

        // Auto-close after 8 seconds
        setTimeout(() => {
          try {
            browserNotification.close();
          } catch (e) {
            // Ignore
          }
        }, 8000);
      } catch (error) {
        console.error('Failed to show browser notification:', error);
      }
    }
  }, [playNotificationSound, isIOS]);

  // Request notification permission - better approach with user interaction
  useEffect(() => {
    if (!hasRequestedPermission.current && typeof window.Notification !== 'undefined') {
      // Only request if permission is default (not yet asked)
      if (window.Notification.permission === 'default') {
        // Request permission after a short delay or on user interaction
        const requestPermission = () => {
          hasRequestedPermission.current = true;
          window.Notification.requestPermission().then(permission => {
            console.log('🔔 Notification permission:', permission);
            if (permission === 'granted') {
              console.log('✅ Notifications enabled! You will receive alerts for new messages.');
            } else if (permission === 'denied') {
              console.log('❌ Notifications blocked. Please enable in browser settings.');
            }
          });
        };

        // Request on first user interaction (click, touch, etc.)
        const handleUserInteraction = () => {
          requestPermission();
          document.removeEventListener('click', handleUserInteraction);
          document.removeEventListener('touchstart', handleUserInteraction);
        };

        // Try to request immediately (works on some browsers)
        // Otherwise wait for user interaction
        setTimeout(() => {
          if (!hasRequestedPermission.current) {
            document.addEventListener('click', handleUserInteraction, { once: true });
            document.addEventListener('touchstart', handleUserInteraction, { once: true });
          }
        }, 2000);
      } else if (window.Notification.permission === 'granted') {
        console.log('✅ Notifications already enabled');
        hasRequestedPermission.current = true;
      }
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    if (user?.email) {
      fetchNotifications().then(data => {
        if (data) {
          prevNotificationsRef.current = data;
        }
      });
    } else {
      setNotifications([]);
      setUnreadCount(0);
      prevNotificationsRef.current = [];
    }
  }, [user?.email, fetchNotifications]);

  // Poll for new notifications every 10 seconds
  useEffect(() => {
    if (!user?.email) return;

    const interval = setInterval(async () => {
      const prevNotifications = prevNotificationsRef.current;
      const newNotifications = await fetchNotifications();
      
      if (newNotifications && prevNotifications.length > 0) {
        // Find truly new notifications (not in previous list)
        const newOnes = newNotifications.filter(
          (n: Notification) => !prevNotifications.some((pn: Notification) => pn.id === n.id) && !n.read
        );
        
        // Show browser notification for each new notification
        newOnes.forEach((notification: Notification) => {
          showBrowserNotification(notification);
        });
      }
      
      if (newNotifications) {
        prevNotificationsRef.current = newNotifications;
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [user?.email, fetchNotifications, showBrowserNotification]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        refreshNotifications,
        markAsRead,
        markAllAsRead
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
