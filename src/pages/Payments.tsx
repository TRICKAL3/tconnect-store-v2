import React, { useState } from 'react';

import { getApiBase } from '../lib/getApiBase';

const API_BASE = getApiBase();

const Payments: React.FC = () => {
  const [formData, setFormData] = useState({
    customerName: '',
    email: '',
    phone: '',
    orderType: 'TT Transfer',
    amount: '',
    currency: 'USD',
    details: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.customerName || !formData.email || !formData.details) {
      alert('Please fill in customer name, email, and order details');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`${API_BASE}/ttorders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: formData.customerName,
          email: formData.email,
          phone: formData.phone || null,
          orderType: formData.orderType,
          amount: formData.amount ? parseFloat(formData.amount) : null,
          currency: formData.currency || null,
          details: formData.details
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      alert('Your order was submitted successfully! Admin will contact you shortly.');
      setFormData({
        customerName: '',
        email: '',
        phone: '',
        orderType: 'TT Transfer',
        amount: '',
        currency: 'USD',
        details: ''
      });
    } catch (error: any) {
      console.error('Error submitting TT order:', error);
      alert(`Failed to submit order: ${error.message || 'Unknown error'}. Please try again.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-bg">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-10">
          <h1 className="text-3xl md:text-5xl font-bold text-white mb-4 holographic">Payments & TT Orders</h1>
          <p className="text-base md:text-lg text-gray-300 max-w-3xl mx-auto">
            Place bulk requests for TT transfers, supplier payments, or currency purchases (USD, ZAR, CNY), vehicle purchases, and more.
          </p>
        </div>

        <div className="card-dark p-6 rounded-2xl">
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-white mb-2">Full Name *</label>
                <input
                  type="text"
                  required
                  value={formData.customerName}
                  onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                  placeholder="Your full name"
                  className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-white mb-2">Contact Email *</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="you@example.com"
                  className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-white mb-2">Phone Number</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+265 XXX XXX XXX"
                  className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-white mb-2">Order Type *</label>
                <select
                  required
                  value={formData.orderType}
                  onChange={(e) => setFormData({ ...formData, orderType: e.target.value })}
                  className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white"
                >
                  <option>TT Transfer</option>
                  <option>Payment to Supplier</option>
                  <option>Buy Currency (USD)</option>
                  <option>Buy Currency (ZAR)</option>
                  <option>Buy Currency (CNY/Yuan)</option>
                  <option>Vehicle Purchase Payment</option>
                  <option>Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-white mb-2">Amount</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="Amount"
                  className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-white mb-2">Currency</label>
                <select
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white"
                >
                  <option>USD</option>
                  <option>MWK</option>
                  <option>ZAR</option>
                  <option>CNY</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-white mb-2">Order Details *</label>
                <textarea
                  required
                  rows={6}
                  value={formData.details}
                  onChange={(e) => setFormData({ ...formData, details: e.target.value })}
                  placeholder="Describe your order in detail..."
                  className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-cyber px-6 py-3 text-white rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Order'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Payments;


