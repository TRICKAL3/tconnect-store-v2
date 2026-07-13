import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import { useAuth } from './AuthContext';
import { getApiBase } from '../lib/getApiBase';
import { cartAccountEmail } from '../lib/cartIdentity';

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

const POLL_MS = 7500;

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const API_BASE = getApiBase();

  const prevNotificationsRef = useRef<Notification[]>([]);
  const hasRequestedPermission = useRef(false);
  const spinPollPausedRef = useRef(false);

  const fetchNotifications = useCallback(async (): Promise<Notification[] | null> => {
    if (!user?.email) {
      setNotifications([]);
      setUnreadCount(0);
      return null;
    }

    setLoading(true);
    const emailQuery = encodeURIComponent(cartAccountEmail(user.email));

    try {
      const res = await fetch(`${API_BASE}/notifications?email=${emailQuery}`, {
        headers: { 'Content-Type': 'application/json' },
      });

      if (res.ok) {
        const data = await res.json();
        const list: Notification[] = Array.isArray(data) ? data : [];
        setNotifications(list);
        setUnreadCount(list.filter((n) => !n.read).length);
        return list;
      }
      const errText = await res.text().catch(() => '');
      console.warn('[notifications] fetch failed', res.status, errText.slice(0, 200));
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
    return null;
  }, [user?.email, API_BASE]);

  const refreshNotifications = useCallback(async () => {
    const list = await fetchNotifications();
    if (list) prevNotificationsRef.current = list;
  }, [fetchNotifications]);

  const markAsRead = useCallback(
    async (id: string) => {
      if (!user?.email) return;

      try {
        const res = await fetch(`${API_BASE}/notifications/${id}/read`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email: cartAccountEmail(user.email) }),
        });

        if (res.ok) {
          setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
          setUnreadCount((prev) => Math.max(0, prev - 1));
          prevNotificationsRef.current = prevNotificationsRef.current.map((n) =>
            n.id === id ? { ...n, read: true } : n
          );
        }
      } catch (error) {
        console.error('Failed to mark notification as read:', error);
      }
    },
    [user?.email, API_BASE]
  );

  const markAllAsRead = useCallback(async () => {
    if (!user?.email) return;

    try {
      const res = await fetch(`${API_BASE}/notifications/mark-all-read`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: cartAccountEmail(user.email) }),
      });

      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        setUnreadCount(0);
        prevNotificationsRef.current = prevNotificationsRef.current.map((n) => ({ ...n, read: true }));
      }
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  }, [user?.email, API_BASE]);

  const playNotificationSound = useCallback(() => {
    try {
      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);

        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.3);
      } catch {
        const audio = new Audio(
          'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OSfTQ8MT6fj8LZjHAY4kdfyzHksBSR3x/DdkEAKFF606euoVRQKRp/g8r5sIQUrgc7y2Yk2CBtpvfDkn00PDE+n4/C2YxwGOJHX8sx5LAUkd8fw3ZBAC'
        );
        audio.volume = 0.5;
        audio.play().catch(() => {});
      }
    } catch (error) {
      console.error('Failed to play notification sound:', error);
    }
  }, []);

  const isIOS = useCallback(() => {
    return (
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    );
  }, []);

  const showBrowserNotification = useCallback(
    async (notification: Notification) => {
      if (!notification || typeof notification !== 'object') {
        return;
      }

      const isIOSDevice = isIOS();
      if (isIOSDevice) {
        playNotificationSound();
        return;
      }

      if (
        typeof window.Notification !== 'undefined' &&
        window.Notification.permission === 'granted'
      ) {
        try {
          const baseUrl = window.location.origin;
          const notificationId = notification.id || '';
          const notificationTitle = notification.title || 'Notification';
          const notificationMessage = notification.message || '';
          const notificationLink = notification.link || null;
          const notificationUrl = notificationLink
            ? `${baseUrl}${notificationLink.startsWith('/') ? notificationLink : '/' + notificationLink}`
            : `${baseUrl}/notifications/${notificationId}`;

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
                  id: notificationId,
                },
              });

              playNotificationSound();
              return;
            } catch (swError) {
              console.log('Service Worker notification failed:', swError);
            }
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
              id: notificationId,
            },
          });

          playNotificationSound();

          const finalUrl = notificationUrl;
          browserNotification.onclick = function (event: Event) {
            try {
              event.preventDefault();
              window.focus();
              if (finalUrl) window.location.href = finalUrl;
              browserNotification.close();
            } catch {
              /* ignore */
            }
          };

          setTimeout(() => {
            try {
              browserNotification.close();
            } catch {
              /* ignore */
            }
          }, 8000);
        } catch (error) {
          console.error('Failed to show browser notification:', error);
        }
      }
    },
    [playNotificationSound, isIOS]
  );

  useEffect(() => {
    if (!hasRequestedPermission.current && typeof window.Notification !== 'undefined') {
      if (window.Notification.permission === 'default') {
        const requestPermission = () => {
          hasRequestedPermission.current = true;
          window.Notification.requestPermission();
        };

        const handleUserInteraction = () => {
          requestPermission();
          document.removeEventListener('click', handleUserInteraction);
          document.removeEventListener('touchstart', handleUserInteraction);
        };

        setTimeout(() => {
          if (!hasRequestedPermission.current) {
            document.addEventListener('click', handleUserInteraction, { once: true });
            document.addEventListener('touchstart', handleUserInteraction, { once: true });
          }
        }, 2000);
      } else if (window.Notification.permission === 'granted') {
        hasRequestedPermission.current = true;
      }
    }
  }, []);

  /** Hydrate + poll + tab focus refresh (fixes missed order alerts while idle). */
  useEffect(() => {
    if (!user?.email) {
      setNotifications([]);
      setUnreadCount(0);
      prevNotificationsRef.current = [];
      return;
    }

    let cancelled = false;
    /** DOM returns number; Node typings use Timer — keep loose for clearInterval. */
    const pollHandle: { current: number | null } = { current: null };

    const diffAndAlert = async (silent: boolean) => {
      if (spinPollPausedRef.current) return;

      const prevSnap = prevNotificationsRef.current;
      const nextList = await fetchNotifications();
      if (cancelled || nextList === null) return;

      if (!silent) {
        const prevIds = new Set(prevSnap.map((n) => n.id));
        const brandNew = nextList.filter((n) => !prevIds.has(n.id) && !n.read);
        brandNew.forEach((n) => {
          showBrowserNotification(n).catch(() => {});
        });
      }

      prevNotificationsRef.current = nextList;
    };

    const onSpinStarted = () => {
      spinPollPausedRef.current = true;
    };
    const onSpinFinished = () => {
      spinPollPausedRef.current = false;
      void diffAndAlert(false);
    };
    window.addEventListener('tconnect-spin-started', onSpinStarted);
    window.addEventListener('tconnect-spin-finished', onSpinFinished);

    void (async () => {
      await diffAndAlert(true);
      if (cancelled) return;
      pollHandle.current = window.setInterval(() => {
        void diffAndAlert(false);
      }, POLL_MS) as unknown as number;
    })();

    const onVisibility = () => {
      if (document.visibilityState === 'visible') void diffAndAlert(false);
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      if (pollHandle.current !== null) window.clearInterval(pollHandle.current);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('tconnect-spin-started', onSpinStarted);
      window.removeEventListener('tconnect-spin-finished', onSpinFinished);
    };
  }, [user?.email, user?.dbUserId, fetchNotifications, showBrowserNotification]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        refreshNotifications,
        markAsRead,
        markAllAsRead,
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
