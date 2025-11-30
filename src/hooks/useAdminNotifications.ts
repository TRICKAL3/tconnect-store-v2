import React, { useState, useEffect, useCallback, useRef } from 'react';
import { getApiBase } from '../lib/getApiBase';

interface Notification {
  id: string;
  userId: string | null;
  type: string;
  title: string;
  message: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

export const useAdminNotifications = (getAdminHeaders: () => Record<string, string>) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const API_BASE = getApiBase();
  const prevNotificationsRef = useRef<Notification[]>([]);

  // Play notification sound
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
          console.log('Audio playback not available');
        });
      }
    } catch (error) {
      console.error('Failed to play notification sound:', error);
    }
  }, []);

  // Show browser notification for admin
  // Detect iOS Safari
  const isIOS = useCallback(() => {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
           (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }, []);

  const showBrowserNotification = useCallback(async (notification: Notification) => {
    // Check if notification exists
    if (!notification || typeof notification !== 'object') {
      return;
    }
    
    // For iOS: Skip browser notifications entirely - just play sound
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
          : `${baseUrl}/admin`;
        
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
          browserNotification.close();
        }, 8000);
      } catch (error) {
        console.error('Failed to show browser notification:', error);
      }
    }
  }, [playNotificationSound, isIOS]);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/notifications`, {
        headers: getAdminHeaders() as HeadersInit
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
    return null;
  }, [API_BASE, getAdminHeaders]);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/notifications/unread-count`, {
        headers: getAdminHeaders() as HeadersInit
      });

      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.count);
      }
    } catch (error) {
      console.error('Failed to fetch unread count:', error);
    }
  }, [API_BASE, getAdminHeaders]);

  const markAsRead = useCallback(async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/notifications/${id}/read`, {
        method: 'PATCH',
        headers: getAdminHeaders() as HeadersInit
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
  }, [API_BASE, getAdminHeaders]);

  const markAllAsRead = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/notifications/mark-all-read`, {
        method: 'PATCH',
        headers: getAdminHeaders() as HeadersInit
      });

      if (res.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  }, [API_BASE, getAdminHeaders]);

  useEffect(() => {
    fetchNotifications().then(data => {
      if (data && Array.isArray(data)) {
        prevNotificationsRef.current = data;
      }
    });
  }, [fetchNotifications]);

  // Request notification permission for admin
  useEffect(() => {
    if (typeof window.Notification !== 'undefined' && window.Notification.permission === 'default') {
      // Request permission after a short delay
      setTimeout(() => {
        window.Notification.requestPermission().then(permission => {
          console.log('🔔 Admin notification permission:', permission);
        });
      }, 2000);
    }
  }, []);

  // Poll for new notifications every 10 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      const prevNotifications = prevNotificationsRef.current;
      const newNotifications = await fetchNotifications();
      await fetchUnreadCount();
      
      if (newNotifications && Array.isArray(newNotifications) && prevNotifications.length > 0) {
        // Find truly new notifications (not in previous list)
        const newOnes = newNotifications.filter(
          (n: Notification) => !prevNotifications.some((pn: Notification) => pn.id === n.id) && !n.read
        );
        
        // Show browser notification and play sound for each new notification
        newOnes.forEach((notification: Notification) => {
          showBrowserNotification(notification);
        });
      }
      
      if (newNotifications && Array.isArray(newNotifications)) {
        prevNotificationsRef.current = newNotifications;
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [fetchNotifications, fetchUnreadCount, showBrowserNotification]);

  return {
    notifications,
    unreadCount,
    loading,
    refreshNotifications: fetchNotifications,
    markAsRead,
    markAllAsRead
  };
};

