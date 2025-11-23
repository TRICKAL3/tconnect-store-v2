import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getApiBase } from '../lib/getApiBase';
import { Gift, ShoppingCart } from 'lucide-react';
import { Link } from 'react-router-dom';

const Settings: React.FC = () => {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [pointsBalance, setPointsBalance] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user?.email) {
      const loadProfile = async () => {
        try {
          const API_BASE = getApiBase();
          const res = await fetch(`${API_BASE}/users/profile?email=${encodeURIComponent(user.email)}`);
          if (res.ok) {
            const profile = await res.json();
            setName(profile.name || '');
            setAvatarUrl(profile.avatarUrl || '');
            setPointsBalance(profile.pointsBalance || 0);
          }
        } catch {}
      };
      loadProfile();
    }
  }, [user?.email]);

  const save = async () => {
    if (!user?.email) return;
    setSaving(true);
    const API_BASE = getApiBase();
    await fetch(`${API_BASE}/users/upsert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: user.email, name, avatarUrl })
    });
    setSaving(false);
    // Reload page to refresh profile in context
    window.location.reload();
  };

  const pointsValue = (pointsBalance / 1300) * 10; // 1300 points = $10

  return (
    <div className="min-h-screen bg-dark-bg">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-white mb-6">Account Settings</h1>
        
        {/* TConnect Points Section */}
        <div className="card-dark p-6 rounded-2xl mb-6 border border-neon-blue/30">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <Gift className="w-8 h-8 text-neon-blue" />
              <div>
                <h2 className="text-xl font-bold text-white">TConnect Points</h2>
                <p className="text-sm text-gray-400">Your loyalty rewards balance</p>
              </div>
            </div>
          </div>
          
          <div className="bg-dark-surface rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-gray-400 text-sm mb-1">Points Balance</div>
                <div className="text-3xl font-bold text-neon-blue">{pointsBalance.toLocaleString()}</div>
                <div className="text-gray-500 text-xs mt-1">≈ ${pointsValue.toFixed(2)} USD value</div>
              </div>
              <div className="text-right">
                <div className="text-gray-400 text-sm mb-1">Redemption Rate</div>
                <div className="text-lg font-semibold text-neon-green">1300 pts = $10</div>
              </div>
            </div>
          </div>

          <div className="bg-neon-blue/10 border border-neon-blue/30 rounded-lg p-4 mb-4">
            <h3 className="text-white font-semibold mb-2 flex items-center">
              <ShoppingCart className="w-4 h-4 mr-2" />
              How to Redeem Points
            </h3>
            <ol className="text-sm text-gray-300 space-y-1 list-decimal list-inside">
              <li>Add items to your cart</li>
              <li>Go to checkout</li>
              <li>Check "Use Points" to apply your points discount</li>
              <li>Your points will be automatically deducted from the order total</li>
            </ol>
          </div>

          <Link
            to="/cart"
            className="block w-full text-center py-3 px-4 bg-neon-blue hover:bg-neon-blue/80 text-white font-semibold rounded-lg transition-colors"
          >
            Start Shopping with Points
          </Link>

          <div className="mt-4 pt-4 border-t border-dark-border">
            <div className="text-xs text-gray-500 space-y-1">
              <div><strong>Earning Points:</strong> Earn 2 points for every $10 spent on approved orders</div>
              <div><strong>Points Expiry:</strong> Points never expire</div>
            </div>
          </div>
        </div>

        {/* Account Settings */}
        <div className="card-dark p-6 rounded-2xl space-y-4">
          <h2 className="text-xl font-bold text-white mb-4">Account Information</h2>
          <div>
            <label className="block text-sm text-gray-300 mb-1">Email</label>
            <input value={user?.email || ''} disabled className="w-full px-4 py-3 bg-dark-surface border border-dark-border rounded-lg text-gray-400" />
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-1">Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="w-full px-4 py-3 bg-dark-surface border border-dark-border rounded-lg text-white" />
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-1">Avatar URL</label>
            <input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://..." className="w-full px-4 py-3 bg-dark-surface border border-dark-border rounded-lg text-white" />
          </div>
          <button disabled={saving} onClick={save} className={`px-6 py-3 rounded-lg font-bold ${saving ? 'bg-gray-600 text-gray-300' : 'btn-cyber text-white'}`}>{saving ? 'Saving...' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
};

export default Settings;


