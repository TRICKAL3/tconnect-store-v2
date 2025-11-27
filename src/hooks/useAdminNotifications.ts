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
  const showBrowserNotification = useCallback(async (notification: Notification) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const baseUrl = window.location.origin;
        const notificationUrl = notification.link 
          ? `${baseUrl}${notification.link.startsWith('/') ? notification.link : '/' + notification.link}`
          : `${baseUrl}/admin`;
        
        // Try to use Service Worker for background notifications
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
            
            // Play custom sound
            playNotificationSound();
            return;
          } catch (swError) {
            console.log('Service Worker notification failed, using regular notification:', swError);
          }
        }
        
        // Fallback to regular notification
        // Use stored variables - NEVER reference 'notification' parameter here
        const browserNotification = new Notification(notificationTitle, {
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

        // Play custom sound
        playNotificationSound();

        // Handle click on notification
        // Store notificationUrl in closure to avoid scope issues on iOS
        // NEVER reference 'notification' parameter inside onclick handler
        const finalNotificationUrl = notificationUrl || '/';
        
        browserNotification.onclick = (event) => {
          try {
            if (event) {
              event.preventDefault();
            }
            window.focus();
            // Use stored URL - never reference 'notification' here
            if (finalNotificationUrl) {
              window.location.href = finalNotificationUrl;
            }
            if (browserNotification && typeof browserNotification.close === 'function') {
              browserNotification.close();
            }
          } catch (error) {
            // Don't log error with 'notification' in message
            console.error('Error handling click:', error);
            // Fallback: just close the notification if possible
            try {
              if (browserNotification && typeof browserNotification.close === 'function') {
                browserNotification.close();
              }
            } catch (closeError) {
              // Don't log error with 'notification' in message
              console.error('Error closing:', closeError);
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
  }, [playNotificationSound]);

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
    if ('Notification' in window && Notification.permission === 'default') {
      // Request permission after a short delay
      setTimeout(() => {
        Notification.requestPermission().then(permission => {
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

