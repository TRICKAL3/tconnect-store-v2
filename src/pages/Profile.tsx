import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { User, Settings, ArrowRight, Sparkles, ChevronRight } from 'lucide-react';
import MyCardsSection from '../components/MyCardsSection';

const Profile: React.FC = () => {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400 mb-4">Sign in to view your profile.</p>
          <Link to="/signin" className="btn-cyber px-6 py-3 text-white rounded-lg font-semibold">
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-bg">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-white mb-6">My Profile</h1>

        <div className="card-dark p-5 sm:p-6 rounded-2xl mb-6 border border-dark-border">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4 min-w-0">
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt="" className="w-14 h-14 shrink-0 rounded-full object-cover border-2 border-neon-blue/50" />
              ) : (
                <div className="w-14 h-14 shrink-0 rounded-full bg-dark-surface flex items-center justify-center border-2 border-neon-blue/50">
                  <User className="w-7 h-7 text-neon-blue" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-lg font-semibold text-white truncate">{user.name || 'User'}</p>
                <p className="text-sm text-gray-400 break-all leading-snug mt-0.5">{user.email}</p>
              </div>
            </div>
            <Link
              to="/settings"
              className="flex items-center justify-center gap-2 w-full sm:w-auto shrink-0 px-4 py-2.5 rounded-xl border border-neon-blue/25 bg-neon-blue/10 text-neon-blue hover:bg-neon-blue/20 font-medium text-sm transition-colors"
            >
              <Settings className="w-4 h-4 shrink-0" />
              <span>Account settings</span>
              <ArrowRight className="w-4 h-4 shrink-0 sm:inline" />
            </Link>
          </div>
        </div>

        <div id="my-cards" className="card-dark p-6 rounded-2xl mb-6 border border-dark-border scroll-mt-24">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-4">My Cards</h2>
          <MyCardsSection userEmail={user.email} userName={user.name || 'User'} />
        </div>

        <div className="card-dark p-6 rounded-2xl mb-6 border border-dark-border">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-4">Spin</h2>
          <div className="space-y-2">
            <Link
              to="/spin"
              className="flex items-center justify-between gap-3 rounded-xl border border-dark-border bg-dark-surface/50 px-4 py-4 text-white hover:border-neon-blue/50 hover:bg-dark-surface transition-colors"
            >
              <span className="flex items-center gap-3 min-w-0">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-500/15 text-purple-300">
                  <Sparkles className="w-5 h-5" />
                </span>
                <span className="min-w-0">
                  <span className="block font-semibold">Spin to Win</span>
                  <span className="block text-xs text-gray-500 truncate">Daily spin, points, and prizes</span>
                </span>
              </span>
              <ChevronRight className="w-5 h-5 shrink-0 text-gray-500" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
