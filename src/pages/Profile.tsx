import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { User, Settings, ArrowRight } from 'lucide-react';

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
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-white mb-6">My Profile</h1>

        {/* Profile summary */}
        <div className="card-dark p-6 rounded-2xl mb-6 border border-dark-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt="" className="w-14 h-14 rounded-full object-cover border-2 border-neon-blue/50" />
              ) : (
                <div className="w-14 h-14 rounded-full bg-dark-surface flex items-center justify-center border-2 border-neon-blue/50">
                  <User className="w-7 h-7 text-neon-blue" />
                </div>
              )}
              <div>
                <p className="text-lg font-semibold text-white">{user.name || 'User'}</p>
                <p className="text-sm text-gray-400 truncate">{user.email}</p>
              </div>
            </div>
            <Link
              to="/settings"
              className="flex items-center gap-2 text-neon-blue hover:text-neon-blue/80 font-medium text-sm"
            >
              <Settings className="w-4 h-4" />
              Account settings
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
