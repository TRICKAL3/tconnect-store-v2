import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';

const Settings: React.FC = () => {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user?.email) {
      const loadProfile = async () => {
        try {
          const res = await fetch((process.env.REACT_APP_API_BASE || 'http://localhost:4000') + `/users/profile?email=${encodeURIComponent(user.email)}`);
          if (res.ok) {
            const profile = await res.json();
            setName(profile.name || '');
            setAvatarUrl(profile.avatarUrl || '');
          }
        } catch {}
      };
      loadProfile();
    }
  }, [user?.email]);

  const save = async () => {
    if (!user?.email) return;
    setSaving(true);
    await fetch((process.env.REACT_APP_API_BASE || 'http://localhost:4000') + '/users/upsert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: user.email, name, avatarUrl })
    });
    setSaving(false);
    // Reload page to refresh profile in context
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-dark-bg">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-white mb-6">Account Settings</h1>
        <div className="card-dark p-6 rounded-2xl space-y-4">
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


