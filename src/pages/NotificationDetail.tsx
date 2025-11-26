import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Check, Clock } from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';
import { getApiBase } from '../lib/getApiBase';

const NotificationDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { notifications, markAsRead } = useNotifications();
  const [notification, setNotification] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      const found = notifications.find(n => n.id === id);
      if (found) {
        setNotification(found);
        // Mark as read when viewing
        if (!found.read) {
          markAsRead(found.id);
        }
        setLoading(false);
      } else {
        // If not in local state, try to fetch from API
        const fetchNotification = async () => {
          try {
            const API_BASE = getApiBase();
            // We'll need to get user email from auth context
            // For now, just show not found
            setLoading(false);
          } catch (error) {
            console.error('Failed to fetch notification:', error);
            setLoading(false);
          }
        };
        fetchNotification();
      }
    }
  }, [id, notifications, markAsRead]);

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (!notification) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Notification Not Found</h2>
          <Link to="/" className="text-neon-blue hover:underline">Go Home</Link>
        </div>
      </div>
    );
  }

  const date = new Date(notification.createdAt);
  const formattedDate = date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <div className="min-h-screen bg-dark-bg">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Button */}
        <button
          onClick={() => navigate(-1)}
          className="mb-6 flex items-center text-neon-blue hover:text-neon-blue/80 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back
        </button>

        {/* Notification Card */}
        <div className="card-dark p-6 md:p-8">
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl md:text-3xl font-bold text-white">
                  {notification.title}
                </h1>
                {!notification.read && (
                  <span className="px-3 py-1 bg-neon-blue/20 text-neon-blue text-xs font-bold rounded-full border border-neon-blue/30">
                    New
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-400">
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  <span>{formattedDate}</span>
                </div>
                <span className="px-2 py-1 bg-dark-surface rounded text-xs">
                  {notification.type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </span>
              </div>
            </div>
            {!notification.read && (
              <button
                onClick={() => markAsRead(notification.id)}
                className="flex items-center gap-2 px-4 py-2 bg-neon-blue/20 hover:bg-neon-blue/30 text-neon-blue rounded-lg transition-colors border border-neon-blue/30"
              >
                <Check className="w-4 h-4" />
                <span className="text-sm font-semibold">Mark as Read</span>
              </button>
            )}
          </div>

          {/* Divider */}
          <div className="border-t border-dark-border my-6"></div>

          {/* Message Content */}
          <div className="prose prose-invert max-w-none">
            <p className="text-lg text-gray-300 leading-relaxed whitespace-pre-wrap">
              {notification.message}
            </p>
          </div>

          {/* Action Button */}
          {notification.link && (
            <div className="mt-8 pt-6 border-t border-dark-border">
              <Link
                to={notification.link}
                className="inline-block px-6 py-3 bg-neon-blue hover:bg-neon-blue/90 text-white font-semibold rounded-lg transition-all hover:scale-105 active:scale-95 neon-glow"
              >
                View Details
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NotificationDetail;

