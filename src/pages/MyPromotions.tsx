import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Tag, Clock, Gift } from 'lucide-react';
import { getApiBase } from '../lib/getApiBase';
import { useAuth } from '../context/AuthContext';

const formatDateTime = (value?: string) => {
  if (!value) return 'No end date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'No end date';
  return date.toLocaleString();
};

const MyPromotions: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [promotions, setPromotions] = useState<any[]>([]);

  useEffect(() => {
    const loadPromotions = async () => {
      setLoading(true);
      try {
        const API_BASE = getApiBase();
        const res = await fetch(`${API_BASE}/promotions`);
        if (!res.ok) throw new Error('Failed to load promotions');
        const data = await res.json();
        setPromotions(Array.isArray(data) ? data : []);
      } catch {
        setPromotions([]);
      } finally {
        setLoading(false);
      }
    };
    loadPromotions();
  }, []);

  if (!user) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-gray-300 mb-4">Sign in to view your promotions.</p>
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
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white mb-2">My Promotions</h1>
          <p className="text-gray-400">All active offers available to your account right now.</p>
        </div>

        {loading ? (
          <div className="text-gray-400">Loading promotions...</div>
        ) : promotions.length === 0 ? (
          <div className="card-dark p-6 rounded-xl border border-dark-border text-center">
            <Gift className="w-8 h-8 mx-auto text-gray-500 mb-2" />
            <p className="text-gray-300 mb-3">No active promotions at the moment.</p>
            <Link to="/giftcards" className="text-neon-blue hover:text-neon-purple transition-colors">
              Browse products
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {promotions.map((promo) => (
              <div key={promo.id} className="card-dark p-5 rounded-xl border border-dark-border">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                      <Tag className="w-4 h-4 text-neon-blue" />
                      {promo.name}
                    </h2>
                    <p className="text-sm text-gray-300 mt-1">{promo.description || 'Special offer available now.'}</p>
                    <div className="mt-3 text-xs text-gray-400 flex flex-wrap gap-3">
                      <span className="px-2 py-1 rounded bg-dark-surface border border-dark-border">{promo.type}</span>
                      {promo.discountPercent ? <span>{promo.discountPercent}% OFF</span> : null}
                      {promo.discountUsd ? <span>${Number(promo.discountUsd).toFixed(2)} OFF</span> : null}
                    </div>
                  </div>
                  <div className="text-right text-xs text-gray-400">
                    <div className="flex items-center gap-1 justify-end">
                      <Clock className="w-3 h-3" />
                      <span>Ends</span>
                    </div>
                    <div>{formatDateTime(promo.endsAt)}</div>
                  </div>
                </div>
                <div className="mt-4">
                  <Link to="/giftcards" className="btn-cyber px-4 py-2 text-white rounded-lg text-sm">
                    Shop this promo
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MyPromotions;
