import React, { useState, useRef, useEffect } from 'react';
import { Bell, Check, X } from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';
import { useNavigate } from 'react-router-dom';
import { scrollToTop } from '../lib/scrollToTop';

const NotificationBell: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const isMobile = window.matchMedia('(max-width: 767px)').matches;
    if (!isMobile) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  const handleNotificationClick = (notification: { id: string }) => {
    markAsRead(notification.id);
    scrollToTop();
    navigate(`/notifications/${notification.id}`);
    setIsOpen(false);
  };

  const handleBellClick = () => {
    setIsOpen(!isOpen);
    if (typeof window.Notification !== 'undefined' && window.Notification.permission === 'default') {
      window.Notification.requestPermission();
    }
  };

  const recentNotifications = notifications.slice(0, 10);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={handleBellClick}
        className="relative p-2 rounded-lg text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
        aria-label="Notifications"
        aria-expanded={isOpen}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[1rem] h-4 px-0.5 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/60 z-[55] md:hidden"
            onClick={() => setIsOpen(false)}
            aria-hidden
          />
          <div className="fixed left-3 right-3 top-[7.5rem] z-[60] max-h-[min(70vh,22rem)] overflow-hidden flex flex-col bg-dark-card border border-dark-border rounded-xl shadow-2xl md:absolute md:left-auto md:right-0 md:top-full md:mt-2 md:w-96 md:max-h-96">
            <div className="p-3 sm:p-4 border-b border-dark-border flex items-center justify-between gap-2 shrink-0">
              <h3 className="text-base sm:text-lg font-bold text-white">Notifications</h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllAsRead}
                    className="text-xs text-neon-blue hover:text-neon-blue/80 transition-colors whitespace-nowrap"
                  >
                    Mark all read
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="md:hidden p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5"
                  aria-label="Close notifications"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 overscroll-contain">
              {recentNotifications.length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                  <Bell className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No notifications</p>
                </div>
              ) : (
                <div className="divide-y divide-dark-border">
                  {recentNotifications.map((notification) => (
                    <div
                      key={notification.id}
                      onClick={() => handleNotificationClick(notification)}
                      className={`p-3 sm:p-4 cursor-pointer hover:bg-dark-surface/80 transition-colors ${
                        !notification.read ? 'bg-neon-blue/5' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold text-white text-sm line-clamp-2 break-words">
                              {notification.title}
                            </h4>
                            {!notification.read && (
                              <span className="w-2 h-2 bg-neon-blue rounded-full shrink-0" />
                            )}
                          </div>
                          <p className="text-sm text-gray-300 line-clamp-2 break-words">
                            {notification.message}
                          </p>
                          <p className="text-xs text-gray-500 mt-1.5">
                            {(() => {
                              const date = new Date(notification.createdAt);
                              const now = new Date();
                              const diffMs = now.getTime() - date.getTime();
                              const diffMins = Math.floor(diffMs / 60000);
                              const diffHours = Math.floor(diffMs / 3600000);
                              const diffDays = Math.floor(diffMs / 86400000);
                              if (diffMins < 1) return 'Just now';
                              if (diffMins < 60) return `${diffMins}m ago`;
                              if (diffHours < 24) return `${diffHours}h ago`;
                              if (diffDays < 7) return `${diffDays}d ago`;
                              return date.toLocaleDateString();
                            })()}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            markAsRead(notification.id);
                          }}
                          className="shrink-0 w-7 h-7 rounded-full hover:bg-dark-border flex items-center justify-center transition-colors"
                          title="Mark as read"
                        >
                          <Check className="w-4 h-4 text-gray-400" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default NotificationBell;
