import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { getMwkAmountFromUsd } from '../utils/rates';

import { getApiBase } from '../lib/getApiBase';

const API_BASE = getApiBase();

// Define SalesDashboard before Admin component to satisfy TypeScript
function SalesDashboard({ getAdminHeaders }: { getAdminHeaders: () => Record<string, string> }) {
  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [reportPeriod, setReportPeriod] = useState<'day' | 'week' | 'month'>('day');
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [ordersRes, productsRes] = await Promise.all([
        fetch(`${API_BASE}/orders`, { headers: getAdminHeaders() as HeadersInit }),
        fetch(`${API_BASE}/products`, { headers: getAdminHeaders() as HeadersInit })
      ]);
      const ordersData = await ordersRes.json();
      const productsData = await productsRes.json();
      setOrders(Array.isArray(ordersData) ? ordersData : []);
      setProducts(Array.isArray(productsData) ? productsData : []);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  // Calculate sales metrics
  const salesData = useMemo(() => {
    const completedOrders = orders.filter(o => 
      o.status === 'approved' || o.status === 'fulfilled' || o.status === 'done'
    );
    
    const now = new Date();
    const filterDate = new Date();
    if (reportPeriod === 'day') {
      filterDate.setHours(0, 0, 0, 0);
    } else if (reportPeriod === 'week') {
      filterDate.setDate(now.getDate() - 7);
    } else if (reportPeriod === 'month') {
      filterDate.setMonth(now.getMonth() - 1);
    }

    const periodOrders = completedOrders.filter(o => 
      new Date(o.createdAt) >= filterDate
    );

    // Revenue by type
    const revenueByType: Record<string, { mwk: number; usd: number; count: number }> = {};
    periodOrders.forEach(order => {
      order.items?.forEach((item: any) => {
        if (!revenueByType[item.type]) {
          revenueByType[item.type] = { mwk: 0, usd: 0, count: 0 };
        }
        const itemMwk = order.totalMwk / order.items.length * item.quantity;
        revenueByType[item.type].mwk += itemMwk;
        revenueByType[item.type].usd += (item.priceUsd || 0) * item.quantity;
        revenueByType[item.type].count += item.quantity;
      });
    });

    // Daily sales for line chart
    const dailySales: Record<string, { date: string; mwk: number; count: number }> = {};
    periodOrders.forEach(order => {
      const date = new Date(order.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (!dailySales[date]) {
        dailySales[date] = { date, mwk: 0, count: 0 };
      }
      dailySales[date].mwk += order.totalMwk || 0;
      dailySales[date].count += 1;
    });

    const totalRevenueMWK = periodOrders.reduce((sum, o) => sum + (o.totalMwk || 0), 0);
    const totalRevenueUSD = periodOrders.reduce((sum, o) => sum + (o.totalUsd || 0), 0);
    const totalOrders = periodOrders.length;
    const pendingOrders = orders.filter(o => o.status === 'pending').length;

    return {
      totalRevenueMWK,
      totalRevenueUSD,
      totalOrders,
      pendingOrders,
      revenueByType: Object.entries(revenueByType).map(([type, data]) => ({
        type: type.charAt(0).toUpperCase() + type.slice(1).replace('-', ' '),
        ...data
      })),
      dailySales: Object.values(dailySales).sort((a, b) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      )
    };
  }, [orders, reportPeriod]);

  // Inventory summary
  const inventorySummary = useMemo(() => {
    const summary: Record<string, { total: number; inStock: number; featured: number; popular: number }> = {};
    products.forEach(p => {
      if (!summary[p.type]) {
        summary[p.type] = { total: 0, inStock: 0, featured: 0, popular: 0 };
      }
      summary[p.type].total += 1;
      if (p.inStock) summary[p.type].inStock += 1;
      if (p.featured) summary[p.type].featured += 1;
      if (p.popular) summary[p.type].popular += 1;
    });
    return Object.entries(summary).map(([type, data]) => ({
      type: type.charAt(0).toUpperCase() + type.slice(1).replace('-', ' '),
      ...data
    }));
  }, [products]);

  if (loading) {
    return <div className="text-gray-400 text-center py-8">Loading sales data...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setReportPeriod('day')}
          className={`px-4 py-2 rounded-lg font-semibold ${
            reportPeriod === 'day' ? 'bg-neon-blue text-white' : 'bg-dark-surface text-gray-300'
          }`}
        >
          Today
        </button>
        <button
          onClick={() => setReportPeriod('week')}
          className={`px-4 py-2 rounded-lg font-semibold ${
            reportPeriod === 'week' ? 'bg-neon-blue text-white' : 'bg-dark-surface text-gray-300'
          }`}
        >
          Last 7 Days
        </button>
        <button
          onClick={() => setReportPeriod('month')}
          className={`px-4 py-2 rounded-lg font-semibold ${
            reportPeriod === 'month' ? 'bg-neon-blue text-white' : 'bg-dark-surface text-gray-300'
          }`}
        >
          Last 30 Days
        </button>
      </div>

      {/* Revenue Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card-dark p-4 rounded-lg border border-neon-blue/30">
          <div className="text-gray-400 text-sm mb-1">Total Revenue (MWK)</div>
          <div className="text-2xl font-bold text-neon-blue">{salesData.totalRevenueMWK.toLocaleString()}</div>
          <div className="text-gray-500 text-xs mt-1">${salesData.totalRevenueUSD.toFixed(2)} USD</div>
        </div>
        <div className="card-dark p-4 rounded-lg border border-green-500/30">
          <div className="text-gray-400 text-sm mb-1">Completed Orders</div>
          <div className="text-2xl font-bold text-green-400">{salesData.totalOrders}</div>
          <div className="text-gray-500 text-xs mt-1">in this period</div>
        </div>
        <div className="card-dark p-4 rounded-lg border border-yellow-500/30">
          <div className="text-gray-400 text-sm mb-1">Pending Orders</div>
          <div className="text-2xl font-bold text-yellow-400">{salesData.pendingOrders}</div>
          <div className="text-gray-500 text-xs mt-1">awaiting review</div>
        </div>
        <div className="card-dark p-4 rounded-lg border border-purple-500/30">
          <div className="text-gray-400 text-sm mb-1">Avg Order Value</div>
          <div className="text-2xl font-bold text-purple-400">
            {salesData.totalOrders > 0 
              ? Math.round(salesData.totalRevenueMWK / salesData.totalOrders).toLocaleString()
              : '0'}
          </div>
          <div className="text-gray-500 text-xs mt-1">MWK per order</div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales Trend Chart */}
        <div className="card-dark p-6 rounded-lg">
          <h3 className="text-white font-bold mb-4">Sales Trend ({reportPeriod === 'day' ? 'Today' : reportPeriod === 'week' ? 'Last 7 Days' : 'Last 30 Days'})</h3>
          {salesData.dailySales.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={salesData.dailySales}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                <XAxis dataKey="date" stroke="#888" />
                <YAxis stroke="#888" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', color: '#fff' }}
                  formatter={(value: any) => [`MWK ${value.toLocaleString()}`, 'Revenue']}
                />
                <Legend />
                <Line type="monotone" dataKey="mwk" stroke="#00d4ff" strokeWidth={2} name="Revenue (MWK)" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-gray-400 text-center py-12">No sales data for selected period</div>
          )}
        </div>

        {/* Revenue by Product Type */}
        <div className="card-dark p-6 rounded-lg">
          <h3 className="text-white font-bold mb-4">Revenue by Product Type</h3>
          {salesData.revenueByType.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={salesData.revenueByType}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                <XAxis dataKey="type" stroke="#888" />
                <YAxis stroke="#888" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', color: '#fff' }}
                  formatter={(value: any) => [`MWK ${value.toLocaleString()}`, 'Revenue']}
                />
                <Bar dataKey="mwk" fill="#00d4ff" name="Revenue (MWK)" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-gray-400 text-center py-12">No revenue data for selected period</div>
          )}
        </div>
      </div>

      {/* Inventory Summary */}
      <div className="card-dark p-6 rounded-lg">
        <h3 className="text-white font-bold mb-4">Inventory Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {inventorySummary.map((item, idx) => (
            <div key={idx} className="bg-dark-surface p-4 rounded-lg border border-dark-border">
              <div className="text-neon-blue font-bold text-lg mb-2">{item.type}</div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Total:</span>
                  <span className="text-white font-semibold">{item.total}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">In Stock:</span>
                  <span className="text-green-400 font-semibold">{item.inStock}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Featured:</span>
                  <span className="text-yellow-400 font-semibold">{item.featured}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Popular:</span>
                  <span className="text-purple-400 font-semibold">{item.popular}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Revenue by Type Table */}
      <div className="card-dark p-6 rounded-lg">
        <h3 className="text-white font-bold mb-4">Revenue Breakdown</h3>
        {salesData.revenueByType.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-dark-border">
                  <th className="text-gray-300 pb-3">Product Type</th>
                  <th className="text-gray-300 pb-3">Revenue (MWK)</th>
                  <th className="text-gray-300 pb-3">Revenue (USD)</th>
                  <th className="text-gray-300 pb-3">Items Sold</th>
                </tr>
              </thead>
              <tbody>
                {salesData.revenueByType.map((item, idx) => (
                  <tr key={idx} className="border-b border-dark-border">
                    <td className="text-white py-3">{item.type}</td>
                    <td className="text-neon-blue font-semibold py-3">{Math.round(item.mwk).toLocaleString()}</td>
                    <td className="text-gray-300 py-3">${item.usd.toFixed(2)}</td>
                    <td className="text-gray-300 py-3">{item.count}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-neon-blue">
                  <td className="text-white font-bold py-3">Total</td>
                  <td className="text-neon-blue font-bold py-3">{Math.round(salesData.totalRevenueMWK).toLocaleString()}</td>
                  <td className="text-gray-300 font-bold py-3">${salesData.totalRevenueUSD.toFixed(2)}</td>
                  <td className="text-gray-300 font-bold py-3">
                    {salesData.revenueByType.reduce((sum, item) => sum + item.count, 0)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div className="text-gray-400 text-center py-8">No revenue data available</div>
        )}
      </div>
    </div>
  );
}

const Admin: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'orders' | 'products' | 'rates' | 'invoices' | 'users' | 'slides' | 'sales' | 'ttorders' | 'chats'>('orders');
  const [adminPass, setAdminPass] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState('');
  const ADMIN_PASSWORD = '09090808pP#';
  
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPass === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      setError('');
    } else {
      setError('Invalid password');
    }
  };

  // Store authentication state in a way managers can access
  React.useEffect(() => {
    if (isAuthenticated) {
      // Store in a way that getAdminHeaders functions can access
      (window as any).__adminAuthenticated = true;
    } else {
      (window as any).__adminAuthenticated = false;
    }
  }, [isAuthenticated]);

  const getAdminHeaders = (): Record<string, string> => {
    const headers: Record<string, string> = {};
    if (isAuthenticated) {
      headers['Authorization'] = 'Basic ' + btoa(ADMIN_PASSWORD);
    }
    return headers;
  };

  // Show password gate if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center px-4">
        <div className="card-dark p-8 w-full max-w-md">
          <div className="text-center mb-6">
            <h1 className="text-3xl md:text-4xl font-bold text-white holographic mb-2">Admin Panel</h1>
            <p className="text-gray-300 text-sm">Enter password to access</p>
          </div>
          {error && <div className="mb-4 text-red-400 text-sm text-center">{error}</div>}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-300 mb-1">Admin Password</label>
              <input 
                value={adminPass} 
                onChange={(e) => setAdminPass(e.target.value)} 
                type="password" 
                placeholder="Enter admin password"
                autoFocus
                className="w-full px-4 py-3 bg-dark-surface border border-dark-border rounded-lg text-white focus:border-neon-blue focus:outline-none" 
              />
            </div>
            <button type="submit" className="w-full btn-cyber text-white py-3 rounded-lg font-bold">
              Access Admin Panel
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-bg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl md:text-5xl font-bold text-white holographic">Admin Dashboard</h1>
          <p className="text-gray-300 mt-2">Manage orders, products, rates, and payments.</p>
        </div>

        <div className="card-dark p-2 mb-6">
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'orders', label: 'Orders' },
              { id: 'sales', label: 'Sales Dashboard' },
              { id: 'products', label: 'Products' },
              { id: 'rates', label: 'Rates' },
              { id: 'invoices', label: 'Invoices' },
              { id: 'ttorders', label: 'TT Orders' },
              { id: 'users', label: 'Users' },
              { id: 'slides', label: 'Slideshows' },
              { id: 'chats', label: 'Chats' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as any)}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                  activeTab === (t.id as any)
                    ? 'bg-neon-blue text-white neon-glow'
                    : 'bg-dark-surface text-gray-300 hover:bg-dark-card border border-dark-border'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="card-dark p-6">
          {activeTab === 'orders' && (
            <div>
              <h2 className="text-xl font-bold text-white mb-4">Recent Orders</h2>
              <OrdersManager getAdminHeaders={getAdminHeaders} />
            </div>
          )}
          {activeTab === 'products' && (
            <div>
              <h2 className="text-xl font-bold text-white mb-4">Products</h2>
              <ProductManager getAdminHeaders={getAdminHeaders} />
            </div>
          )}
          {activeTab === 'rates' && (
            <div>
              <h2 className="text-xl font-bold text-white mb-4">Rates</h2>
              <RatesManager getAdminHeaders={getAdminHeaders} />
            </div>
          )}
          {activeTab === 'invoices' && (
            <div>
              <h2 className="text-xl font-bold text-white mb-4">Invoices</h2>
              <InvoicesManager getAdminHeaders={getAdminHeaders} />
            </div>
          )}
          {activeTab === 'users' && (
            <div>
              <h2 className="text-xl font-bold text-white mb-4">Users</h2>
              <UsersManager getAdminHeaders={getAdminHeaders} />
            </div>
          )}
          {activeTab === 'slides' && (
            <div>
              <h2 className="text-xl font-bold text-white mb-4">Slideshows</h2>
              <SlidesManager getAdminHeaders={getAdminHeaders} />
            </div>
          )}
          {activeTab === 'sales' && (
            <div>
              <h2 className="text-xl font-bold text-white mb-4">Sales Dashboard</h2>
              <SalesDashboard getAdminHeaders={getAdminHeaders} />
            </div>
          )}
          {activeTab === 'ttorders' && (
            <div>
              <h2 className="text-xl font-bold text-white mb-4">TT Orders</h2>
              <TTOrdersManager getAdminHeaders={getAdminHeaders} />
            </div>
          )}
          {activeTab === 'chats' && (
            <div>
              <h2 className="text-xl font-bold text-white mb-4">Live Chats</h2>
              <ChatManager getAdminHeaders={getAdminHeaders} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Admin;

function ProductManager({ getAdminHeaders }: { getAdminHeaders: () => Record<string, string> }) {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [redeemInfo, setRedeemInfo] = useState('');
  const [form, setForm] = useState({ name: '', category: '', type: 'giftcard', priceUsd: 0, image: '', description: '', inStock: true, featured: false, popular: false });
  
  // Auto-generate gift card description and redemption instructions
  const generateGiftCardContent = (cardName: string, category: string): { description: string; redeemInfo: string } => {
    const name = cardName.toLowerCase().trim();
    const cat = category.toLowerCase();
    
    // Detect gift card type based on name patterns
    const isGaming = name.includes('steam') || name.includes('playstation') || name.includes('xbox') || name.includes('nintendo') || name.includes('epic') || name.includes('roblox') || name.includes('paysafe') || cat.includes('gaming');
    const isEntertainment = name.includes('netflix') || name.includes('spotify') || name.includes('disney') || name.includes('hulu') || name.includes('amazon prime') || cat.includes('entertainment');
    const isRetail = name.includes('amazon') || name.includes('walmart') || name.includes('target') || name.includes('ebay') || name.includes('best buy') || cat.includes('retail') || cat.includes('shopping');
    const isSoftware = name.includes('google') || name.includes('apple') || name.includes('microsoft') || name.includes('adobe') || cat.includes('software');
    const isFood = name.includes('uber eats') || name.includes('doordash') || name.includes('grubhub') || name.includes('starbucks') || name.includes('mcdonald');
    
    // Generate description based on detected type
    let description = '';
    if (isGaming) {
      description = `Get instant access to thousands of games, in-game purchases, subscriptions, and more with this ${cardName} gift card. Perfect for gamers of all levels, this digital gift card allows you to purchase games, downloadable content, expansion packs, and exclusive gaming items. Compatible with all ${cardName} platforms and can be used immediately after redemption.`;
    } else if (isEntertainment) {
      description = `Enjoy unlimited access to premium entertainment content with this ${cardName} gift card. Stream your favorite movies, TV shows, music, and exclusive content without interruptions. This digital gift card provides instant access to premium subscriptions and can be used for membership renewals or new subscriptions. Perfect for entertainment enthusiasts.`;
    } else if (isRetail) {
      description = `Shop for millions of products with this ${cardName} gift card. Use it to purchase electronics, clothing, home goods, books, and much more. This digital gift card offers flexibility and convenience, allowing you to buy anything you need from one of the world's largest online retailers. Instant delivery and immediate usability.`;
    } else if (isSoftware) {
      description = `Access premium software, apps, cloud services, and digital subscriptions with this ${cardName} gift card. Perfect for students, professionals, and tech enthusiasts who need the latest software tools and services. Use this gift card to purchase apps, subscriptions, cloud storage, and premium features across ${cardName}'s ecosystem.`;
    } else if (isFood) {
      description = `Order delicious meals, drinks, and treats with this ${cardName} gift card. Enjoy convenient food delivery, restaurant pickups, or in-store purchases. This digital gift card makes it easy to treat yourself or gift someone special with great food experiences. Use it for delivery fees, tips, and orders.`;
    } else {
      description = `Experience the convenience and flexibility of this ${cardName} digital gift card. Perfect for gifting or personal use, this gift card provides instant access to a wide range of products and services. Use it to make purchases, subscribe to services, or unlock premium features. Redeem instantly and start using your balance right away.`;
    }
    
    // Generate redemption instructions based on type
    let redeemInstructions = '';
    if (isGaming) {
      redeemInstructions = `How to Redeem Your ${cardName} Gift Card:\n\n1. Log in to your ${cardName} account or create a new account if you don't have one.\n2. Navigate to the "Redeem Code" or "Add Funds" section in your account settings.\n3. Enter the gift card code you received after purchase.\n4. Click "Redeem" or "Add to Account".\n5. Your balance will be immediately credited to your ${cardName} wallet.\n6. You can now use the balance to purchase games, in-game items, or subscriptions.\n\nNote: Gift card codes are valid for one-time use and expire according to ${cardName}'s terms and conditions. Codes are delivered instantly after payment confirmation.`;
    } else if (isEntertainment || isSoftware) {
      redeemInstructions = `How to Redeem Your ${cardName} Gift Card:\n\n1. Visit the ${cardName} website or open the ${cardName} app.\n2. Sign in to your account or create a new account.\n3. Go to "Account Settings" or "Payment Methods" section.\n4. Select "Redeem Gift Card" or "Add Gift Card".\n5. Enter the gift card code provided after your purchase.\n6. Click "Apply" or "Redeem" to add the balance to your account.\n7. Your credit will be instantly available for subscriptions or purchases.\n\nNote: Gift card codes are delivered immediately after payment confirmation. Codes can only be used once and are subject to ${cardName}'s terms of service.`;
    } else if (isRetail) {
      redeemInstructions = `How to Redeem Your ${cardName} Gift Card:\n\n1. Log in to your ${cardName} account or create a new account.\n2. Go to "Your Account" → "Gift Cards" or "Payment Methods".\n3. Click on "Redeem a Gift Card" or "Apply Gift Card Balance".\n4. Enter the gift card code you received after purchase.\n5. Click "Apply to Your Balance" or "Add to Account".\n6. Your gift card balance will be added to your account instantly.\n7. You can use this balance during checkout for any purchase on ${cardName}.\n\nNote: Gift card codes are delivered instantly via email after payment confirmation. You can check your balance anytime in your account settings.`;
    } else if (isFood) {
      redeemInstructions = `How to Redeem Your ${cardName} Gift Card:\n\n1. Open the ${cardName} app or visit their website.\n2. Sign in or create a new account.\n3. Go to "Payment" or "Gift Cards" in your account settings.\n4. Select "Add Gift Card" or "Redeem Code".\n5. Enter the gift card code received after purchase.\n6. Tap "Add" or "Redeem" to apply the balance.\n7. Your credit will be immediately available for orders and deliveries.\n\nNote: Gift card codes are delivered instantly after payment. You can use the balance for orders, delivery fees, and tips.`;
    } else {
      redeemInstructions = `How to Redeem Your ${cardName} Gift Card:\n\n1. Visit the ${cardName} website or open their official app.\n2. Sign in to your account or register for a new account.\n3. Navigate to your account settings or payment section.\n4. Find the "Redeem Gift Card" or "Add Gift Card" option.\n5. Enter the gift card code provided after your purchase.\n6. Click "Redeem" or "Apply" to add the balance to your account.\n7. Your credit will be instantly available for purchases.\n\nNote: Gift card codes are delivered immediately after payment confirmation. Please keep your code secure and redeem it as soon as possible.`;
    }
    
    return { description, redeemInfo: redeemInstructions };
  };
  
  const cryptoCoins = [
    { symbol: 'USDT', name: 'Tether USD' },
    { symbol: 'USDC', name: 'USD Coin' },
    { symbol: 'BUSD', name: 'Binance USD' },
    { symbol: 'BTC', name: 'Bitcoin' },
    { symbol: 'ETH', name: 'Ethereum' },
    { symbol: 'BNB', name: 'Binance Coin' },
    { symbol: 'ADA', name: 'Cardano' },
    { symbol: 'SOL', name: 'Solana' },
    { symbol: 'DOT', name: 'Polkadot' },
    { symbol: 'MATIC', name: 'Polygon' }
  ];

  // Use getAdminHeaders from parent
  const getHeaders = (): Record<string, string> => {
    return { 'Content-Type': 'application/json', ...getAdminHeaders() };
  };

  // Get unique categories from existing products based on type
  const getAvailableCategories = (type: string): string[] => {
    if (type === 'giftcard') {
      // Gift card categories
      const giftCardCategories = ['Gaming', 'Entertainment', 'Retail & Shopping', 'Software', 'Utilities'];
      // Also include any categories found in existing giftcard products
      const existingCategories = products
        .filter(p => p.type === 'giftcard' && p.category)
        .map(p => p.category)
        .filter((cat, index, arr) => arr.indexOf(cat) === index); // unique
      return Array.from(new Set([...giftCardCategories, ...existingCategories])).sort();
    } else if (type === 'wallet' || type === 'virtual-card') {
      // Get categories from existing wallet/virtual-card products
      const existingCategories = products
        .filter(p => (p.type === 'wallet' || p.type === 'virtual-card') && p.category)
        .map(p => p.category)
        .filter((cat, index, arr) => arr.indexOf(cat) === index); // unique
      // Default categories if none exist
      const defaultCategories = type === 'wallet' 
        ? ['Digital Wallet', 'Payment Wallet', 'Crypto Wallet'] 
        : ['Virtual Card', 'Prepaid Card', 'Debit Card'];
      return existingCategories.length > 0 ? existingCategories.sort() : defaultCategories;
    } else {
      // For crypto or other types
      const existingCategories = products
        .filter(p => p.type === type && p.category)
        .map(p => p.category)
        .filter((cat, index, arr) => arr.indexOf(cat) === index);
      return existingCategories.length > 0 ? existingCategories.sort() : [];
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      console.log('📦 [Admin] Loading products from:', `${API_BASE}/products`);
      const res = await fetch(`${API_BASE}/products`);
      console.log('📥 [Admin] Products response status:', res.status);
      
      if (!res.ok) {
        throw new Error(`Failed to fetch products: ${res.status} ${res.statusText}`);
      }
      
      const data = await res.json();
      console.log('✅ [Admin] Products loaded:', Array.isArray(data) ? data.length : 'not an array', data);
      
      if (Array.isArray(data)) {
        setProducts(data);
      } else {
        console.error('❌ [Admin] Products data is not an array:', data);
        setProducts([]);
      }
    } catch (error: any) {
      console.error('❌ [Admin] Error loading products:', error);
      setProducts([]);
      alert(`Failed to load products: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);
  
  // Reset category when type changes
  useEffect(() => {
    const availableCats = getAvailableCategories(form.type);
    if (availableCats.length > 0 && !availableCats.includes(form.category)) {
      setForm(prev => ({ ...prev, category: availableCats[0] }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.type, form.category, products]);
  
  // Auto-generate description and redeem info when gift card name or category changes
  useEffect(() => {
    if (form.type === 'giftcard' && form.name && form.category) {
      const { description, redeemInfo } = generateGiftCardContent(form.name, form.category);
      setForm(prev => ({ ...prev, description }));
      setRedeemInfo(redeemInfo);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.type, form.name, form.category]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadImage = async (): Promise<string | null> => {
    if (!imageFile) return null;
    setUploading(true);
    try {
      const fileExt = imageFile.name.split('.').pop();
      const fileName = `products/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const { data, error } = await supabase.storage.from('products').upload(fileName, imageFile, { upsert: false });
      if (error) {
        console.error('Supabase storage error:', error);
        if (error.message.includes('Bucket') || error.message.includes('not found')) {
          alert(`Error: The 'products' bucket doesn't exist in Supabase Storage. Please create a public bucket named 'products' in your Supabase dashboard.`);
        } else if (error.message.includes('row-level security') || error.message.includes('RLS')) {
          alert(`Error: Storage policy blocking upload. Go to Supabase Dashboard → Storage → products bucket → Policies → Create a policy allowing INSERT for public or authenticated users.`);
        } else {
          alert(`Failed to upload image: ${error.message}`);
        }
        return null;
      }
      const { data: pub } = supabase.storage.from('products').getPublicUrl(data.path);
      return pub.publicUrl;
    } catch (error: any) {
      console.error('Error uploading image:', error);
      alert(`Failed to upload image: ${error?.message || 'Unknown error'}. Please check that the 'products' bucket exists in Supabase Storage.`);
      return null;
    } finally {
      setUploading(false);
    }
  };

  const create = async () => {
    // Validation based on product type
    if (form.type === 'crypto') {
      if (!form.name) {
        alert('Please select a cryptocurrency');
        return;
      }
    } else {
      if (!form.name || !form.category) {
        alert('Please fill in all required fields: Name and Category');
        return;
      }
      // Image required for giftcards and virtual cards
      if ((form.type === 'giftcard' || form.type === 'virtual-card') && !imageFile) {
        alert('Please select an image file');
        return;
      }
    }
    
    // Price not required for crypto (prices fluctuate)
    if (form.type !== 'crypto' && form.priceUsd <= 0) {
      alert('Please enter a valid price');
      return;
    }
    setUploading(true);
    try {
      let imageUrl = form.image || '';
      
      // Upload image only for giftcards and virtual cards
      if ((form.type === 'giftcard' || form.type === 'virtual-card') && imageFile) {
        console.log('Starting image upload...');
        imageUrl = await uploadImage() || '';
        if (!imageUrl) {
          console.error('Image upload failed');
          setUploading(false);
          return;
        }
        console.log('Image uploaded successfully:', imageUrl);
      }
      
      // For crypto, set name to coin symbol if not set
      if (form.type === 'crypto' && !form.name) {
        setForm({ ...form, name: cryptoCoins[0].symbol });
      }
      
      const productData: any = {
        ...form,
        image: imageUrl,
        description: form.description || (form.type === 'wallet' ? redeemInfo : form.description),
        priceUsd: form.type === 'crypto' ? 0 : form.priceUsd // Crypto prices determined by market rate
      };
      
      // Add redeem info to description for giftcards
      if (form.type === 'giftcard' && redeemInfo) {
        productData.description = `${form.description}\n\nHow to Redeem:\n${redeemInfo}`;
      }
      
      console.log('Creating product with data:', productData);
      
      // Get API base dynamically
      const apiBase = getApiBase();
      const url = `${apiBase}/products`;
      const headers = getHeaders();
      
      console.log('API Base URL:', apiBase);
      console.log('Full URL:', url);
      console.log('Headers:', { ...headers, Authorization: headers.Authorization ? 'Basic ***' : 'none' });
      
      const response = await fetch(url, { 
        method: 'POST', 
        headers: headers, 
        body: JSON.stringify(productData) 
      });
      
      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText || `Server error: ${response.status}` };
        }
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }
      
      const result = await response.json();
      console.log('Product created successfully:', result);
      alert('Product created successfully!');
      
      setForm({ name: '', category: '', type: form.type, priceUsd: 0, image: '', description: '', inStock: true, featured: false, popular: false });
      setImageFile(null);
      setImagePreview('');
      setRedeemInfo('');
      
      // Reset file input
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
      
      await load();
    } catch (error: any) {
      console.error('Error creating product:', error);
      console.error('Error details:', {
        message: error?.message,
        name: error?.name,
        stack: error?.stack
      });
      
      // Check if it's a network error
      if (error?.message === 'Failed to fetch' || error?.name === 'TypeError') {
        const apiBase = getApiBase();
        alert(`Network error: Cannot reach backend at ${apiBase}. Please check:\n1. Backend is deployed and running\n2. CORS is configured correctly\n3. Check browser console for details`);
      } else {
        alert(`Failed to create product: ${error?.message || 'Unknown error'}. Check console for details.`);
      }
    } finally {
      setUploading(false);
    }
  };
  const toggle = async (p: any, field: 'inStock'|'featured'|'popular') => {
    const body = { [field]: !p[field] } as any;
    await fetch(`${API_BASE}/products/${p.id}`, { method: 'PUT', headers: getHeaders(), body: JSON.stringify(body) });
    await load();
  };

  const requiresImage = form.type === 'giftcard' || form.type === 'virtual-card';
  const requiresDetails = form.type === 'giftcard' || form.type === 'virtual-card' || form.type === 'wallet';
  const requiresRedeem = form.type === 'giftcard';

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value, category: '', name: '' })} className="px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white">
          <option value="giftcard">Gift Card</option>
          <option value="crypto">Crypto</option>
          <option value="wallet">Wallet</option>
          <option value="virtual-card">Virtual Card</option>
        </select>
        
        {form.type === 'crypto' ? (
          <select value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white">
            <option value="">Select Cryptocurrency</option>
            {cryptoCoins.map((coin) => (
              <option key={coin.symbol} value={coin.symbol}>{coin.symbol} - {coin.name}</option>
            ))}
          </select>
        ) : (
          <>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Product Name" className="px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white" />
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white">
              <option value="">Select Category</option>
              {getAvailableCategories(form.type).map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </>
        )}
        
        {form.type !== 'crypto' && (
          <input type="number" value={form.priceUsd} onChange={(e) => setForm({ ...form, priceUsd: parseFloat(e.target.value) || 0 })} placeholder="Price USD" className="px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white" />
        )}
        
        {requiresImage && (
          <div className="md:col-span-2">
            <label className="block text-white text-sm mb-2">Product Image (Required)</label>
            <input 
              type="file" 
              accept="image/*" 
              onChange={handleImageChange}
              className="block w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-neon-blue file:text-white hover:file:bg-neon-blue/80 file:cursor-pointer" 
            />
            {imagePreview && (
              <div className="mt-3">
                <img src={imagePreview} alt="Preview" className="h-24 w-auto rounded-lg border border-dark-border" />
              </div>
            )}
          </div>
        )}
        
        {requiresDetails && (
          <textarea 
            value={form.description} 
            onChange={(e) => setForm({ ...form, description: e.target.value })} 
            placeholder="Description / Details" 
            rows={3}
            className="md:col-span-2 px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white" 
          />
        )}
        
        {requiresRedeem && (
          <textarea 
            value={redeemInfo} 
            onChange={(e) => setRedeemInfo(e.target.value)} 
            placeholder="How to Redeem (instructions for customers)" 
            rows={3}
            className="md:col-span-2 px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white" 
          />
        )}
        
        <label className="flex items-center space-x-2 text-white"><input type="checkbox" checked={form.inStock} onChange={(e) => setForm({ ...form, inStock: e.target.checked })} /> <span>In Stock</span></label>
        {form.type === 'giftcard' && (
          <>
            <label className="flex items-center space-x-2 text-white"><input type="checkbox" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} /> <span>Featured</span></label>
            <label className="flex items-center space-x-2 text-white"><input type="checkbox" checked={form.popular} onChange={(e) => setForm({ ...form, popular: e.target.checked })} /> <span>Popular</span></label>
          </>
        )}
      </div>
      <button 
        onClick={create} 
        disabled={uploading || (requiresImage && !imageFile)} 
        className={`btn-cyber text-white px-6 py-3 rounded-lg ${(uploading || (requiresImage && !imageFile)) ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {uploading ? 'Uploading...' : 'Create Product'}
      </button>
      <div className="mt-6">
        <h3 className="text-white font-bold mb-3">Products ({products.length})</h3>
        {loading ? (
          <div className="text-center py-4">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-neon-blue mb-2"></div>
            <p className="text-gray-400">Loading products...</p>
          </div>
        ) : products.length === 0 ? (
          <div className="card-dark p-6 text-center">
            <p className="text-gray-400 mb-2">No products found</p>
            <p className="text-gray-500 text-sm">Create your first product using the form above</p>
          </div>
        ) : (
          <div className="space-y-2">
            {products.map((p) => (
              <div key={p.id} className="flex items-center justify-between p-3 border border-dark-border rounded-lg hover:border-neon-blue/50 transition-colors">
                <div className="flex-1">
                  <div className="text-white font-semibold">{p.name || 'Unnamed Product'}</div>
                  <div className="text-gray-400 text-sm">
                    {p.type || 'unknown'} • {p.category || 'uncategorized'} • ${p.priceUsd || 0}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => toggle(p, 'inStock')} className="cyber-border text-white px-3 py-1 rounded text-sm hover:neon-glow transition-all">
                    {p.inStock ? 'Set Out' : 'Set In'} Stock
                  </button>
                  {p.type === 'giftcard' && (
                    <>
                      <button onClick={() => toggle(p, 'featured')} className="cyber-border text-white px-3 py-1 rounded text-sm hover:neon-glow transition-all">
                        {p.featured ? 'Unfeature' : 'Feature'}
                      </button>
                      <button onClick={() => toggle(p, 'popular')} className="cyber-border text-white px-3 py-1 rounded text-sm hover:neon-glow transition-all">
                        {p.popular ? 'Unpopular' : 'Popular'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function RatesManager({ getAdminHeaders }: { getAdminHeaders: () => Record<string, string> }) {
  const [value, setValue] = useState<number>(0);
  const [type, setType] = useState('giftcard');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/rates`, { 
        method: 'POST', 
        headers: { ...{'Content-Type': 'application/json'}, ...getAdminHeaders() }, 
        body: JSON.stringify({ type, value: Math.round(value) }) 
      });
      if (res.ok) {
        alert('Rate saved successfully! The UI will update within 30 seconds.');
        // Force refresh rates cache in all open tabs
        if (typeof window !== 'undefined' && (window as any).refreshRates) {
          (window as any).refreshRates();
        }
        setValue(0); // Reset form
      } else {
        throw new Error(`Failed to save rate: ${res.statusText}`);
      }
    } catch (error: any) {
      console.error('Failed to save rate:', error);
      alert(`Failed to save rate: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <select value={type} onChange={(e) => setType(e.target.value)} className="px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white">
          <option value="giftcard">giftcard</option>
          <option value="crypto">crypto</option>
          <option value="wallet">wallet</option>
        </select>
        <input type="number" value={value || ''} onChange={(e) => setValue(parseInt(e.target.value || '0', 10))} placeholder="MWK per USD" className="px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white" />
        <button disabled={saving} onClick={save} className="btn-cyber text-white px-6 py-3 rounded-lg">{saving ? 'Saving...' : 'Save Rate'}</button>
      </div>
      <p className="text-gray-400 text-sm">New entries become the latest rate for that type.</p>
    </div>
  );
}

function OrdersManager({ getAdminHeaders }: { getAdminHeaders: () => Record<string, string> }) {
  const [orders, setOrders] = useState<any[]>([]);
  const [orderView, setOrderView] = useState<'new' | 'completed' | 'rejected'>('new');
  const [loading, setLoading] = useState(false);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [giftCardCodes, setGiftCardCodes] = useState<Array<{ serialNumber?: string; redeemCode?: string; activationLink?: string }>>([]);
  
  const load = async () => {
    setLoading(true);
    try {
      const headers = getAdminHeaders();
      const res = await fetch(`${API_BASE}/orders`, { headers: headers as HeadersInit });
      const data = await res.json();
      setOrders(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to load orders:', error);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };
  
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);
  
  const setStatus = async (id: string, status: string) => {
    const headers = { 'Content-Type': 'application/json', ...getAdminHeaders() };
    try {
      await fetch(`${API_BASE}/orders/${id}/status`, { method: 'PATCH', headers: headers as HeadersInit, body: JSON.stringify({ status }) });
      await load();
    } catch (error) {
      console.error('Failed to update order status:', error);
      alert('Failed to update order status');
    }
  };

  const handleFulfill = (order: any) => {
    // Check if order has gift card items without codes
    const giftCardItems = order.items?.filter((item: any) => item.type === 'giftcard' && !item.giftCardCodes);
    // Check if order has virtual card items without activation links
    const virtualCardItems = order.items?.filter((item: any) => item.type === 'virtual-card' && !item.giftCardCodes);
    
    if (giftCardItems && giftCardItems.length > 0) {
      // Show code entry modal for each gift card item
      setSelectedOrder(order);
      setSelectedItem(giftCardItems[0]);
      setGiftCardCodes(new Array(giftCardItems[0].quantity).fill(null).map(() => ({ serialNumber: '', redeemCode: '' })));
      setShowCodeModal(true);
    } else if (virtualCardItems && virtualCardItems.length > 0) {
      // Show activation link entry modal for each virtual card item
      setSelectedOrder(order);
      setSelectedItem(virtualCardItems[0]);
      setGiftCardCodes(new Array(virtualCardItems[0].quantity).fill(null).map(() => ({ activationLink: '' })));
      setShowCodeModal(true);
    } else {
      // No gift cards/virtual cards or all have codes/links, just fulfill
      setStatus(order.id, 'fulfilled');
    }
  };

  const saveCodes = async () => {
    if (!selectedOrder || !selectedItem) return;
    
    const isVirtualCard = selectedItem.type === 'virtual-card';
    
    // Validate all codes/links are filled
    if (isVirtualCard) {
      if (giftCardCodes.some(item => !item.activationLink || !item.activationLink.trim())) {
        alert('Please fill in all activation links');
        return;
      }
    } else {
      if (giftCardCodes.some(item => !item.serialNumber?.trim() || !item.redeemCode?.trim())) {
        alert('Please fill in all serial numbers and redeem codes');
        return;
      }
    }

    const headers = { 'Content-Type': 'application/json', ...getAdminHeaders() };
    try {
      await fetch(`${API_BASE}/orders/${selectedOrder.id}/items/${selectedItem.id}/codes`, {
        method: 'PATCH',
        headers: headers as HeadersInit,
        body: JSON.stringify({ 
          codes: isVirtualCard 
            ? giftCardCodes.map(c => ({ activationLink: c.activationLink.trim() }))
            : giftCardCodes.map(c => ({ 
                serialNumber: c.serialNumber.trim(), 
                redeemCode: c.redeemCode.trim() 
              }))
        })
      });

      // Check if there are more items without codes/links
      const remainingItems = selectedOrder.items?.filter((item: any) => 
        ((item.type === 'giftcard' || item.type === 'virtual-card') && 
        item.id !== selectedItem.id && 
        !item.giftCardCodes)
      );

      if (remainingItems && remainingItems.length > 0) {
        // Move to next item
        setSelectedItem(remainingItems[0]);
        const isNextVirtualCard = remainingItems[0].type === 'virtual-card';
        setGiftCardCodes(new Array(remainingItems[0].quantity).fill(null).map(() => 
          isNextVirtualCard 
            ? { activationLink: '' }
            : { serialNumber: '', redeemCode: '' }
        ));
      } else {
        // All codes/links entered, fulfill order
        setShowCodeModal(false);
        setSelectedOrder(null);
        setSelectedItem(null);
        await setStatus(selectedOrder.id, 'fulfilled');
        await load();
      }
    } catch (error) {
      console.error('Failed to save codes/links:', error);
      alert('Failed to save codes/links');
    }
  };

  const filteredOrders = orders.filter(o => {
    if (orderView === 'new') return o.status === 'pending';
    if (orderView === 'completed') return o.status === 'approved' || o.status === 'fulfilled' || o.status === 'done';
    if (orderView === 'rejected') return o.status === 'rejected' || o.status === 'denied' || o.status === 'fail';
    return true;
  });

  const newOrdersCount = orders.filter(o => o.status === 'pending').length;
  const completedOrdersCount = orders.filter(o => o.status === 'approved' || o.status === 'fulfilled' || o.status === 'done').length;
  const rejectedOrdersCount = orders.filter(o => o.status === 'rejected' || o.status === 'denied' || o.status === 'fail').length;

  return (
    <div className="space-y-4">
      {/* Order View Tabs */}
      <div className="flex gap-2 border-b border-dark-border pb-2">
        <button
          onClick={() => setOrderView('new')}
          className={`px-4 py-2 rounded-lg font-semibold transition-all ${
            orderView === 'new'
              ? 'bg-neon-blue text-white neon-glow'
              : 'bg-dark-surface text-gray-300 hover:bg-dark-card'
          }`}
        >
          New Orders ({newOrdersCount})
        </button>
        <button
          onClick={() => setOrderView('completed')}
          className={`px-4 py-2 rounded-lg font-semibold transition-all ${
            orderView === 'completed'
              ? 'bg-green-500 text-white'
              : 'bg-dark-surface text-gray-300 hover:bg-dark-card'
          }`}
        >
          Completed ({completedOrdersCount})
        </button>
        <button
          onClick={() => setOrderView('rejected')}
          className={`px-4 py-2 rounded-lg font-semibold transition-all ${
            orderView === 'rejected'
              ? 'bg-red-500 text-white'
              : 'bg-dark-surface text-gray-300 hover:bg-dark-card'
          }`}
        >
          Rejected ({rejectedOrdersCount})
        </button>
      </div>

      {/* Orders List */}
      {loading ? (
        <div className="text-gray-400 text-center py-8">Loading orders...</div>
      ) : filteredOrders.length > 0 ? (
        <div className="space-y-3">
          {filteredOrders.map(o => (
            <div key={o.id} className="p-4 border border-dark-border rounded-lg bg-dark-surface">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="text-white font-semibold">Order #{o.id.slice(0, 8)}</div>
                  <div className="text-gray-400 text-sm">
                    {new Date(o.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-neon-blue font-bold text-lg">MWK {o.totalMwk?.toLocaleString() || 0}</div>
                  <div className="text-gray-400 text-sm">${o.totalUsd?.toFixed(2)} USD</div>
                </div>
              </div>
              
              <div className="mb-3">
                <div className="text-gray-300 text-sm mb-2">Items ({o.items?.length || 0}):</div>
                <div className="space-y-2">
                  {o.items?.map((item: any, idx: number) => {
                    let metadata = null;
                    let codes = null;
                    try {
                      metadata = item.metadata ? (typeof item.metadata === 'string' ? JSON.parse(item.metadata) : item.metadata) : null;
                      codes = item.giftCardCodes ? (typeof item.giftCardCodes === 'string' ? JSON.parse(item.giftCardCodes) : item.giftCardCodes) : null;
                    } catch (e) {
                      console.error('Failed to parse metadata/codes:', e);
                    }
                    
                    return (
                      <div key={idx} className="text-gray-400 text-xs pl-3 border-l-2 border-dark-border">
                        <div className="font-semibold text-white">• {item.name} ({item.type}) x{item.quantity} - ${item.priceUsd?.toFixed(2)}</div>
                        
                        {/* Gift Card Codes */}
                        {item.type === 'giftcard' && codes && codes.length > 0 && (
                          <div className="mt-2 ml-3 p-2 bg-dark-bg rounded border border-yellow-400/30">
                            <div className="text-yellow-400 font-bold mb-1">Gift Card Codes:</div>
                            <div className="space-y-2">
                              {codes.map((code: any, codeIdx: number) => (
                                <div key={codeIdx} className="text-xs">
                                  <div className="font-mono text-yellow-300">
                                    <strong>#{codeIdx + 1}</strong> Serial: {code.serialNumber || code} | Redeem: {code.redeemCode || code}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* Virtual Card Activation Links */}
                        {item.type === 'virtual-card' && codes && codes.length > 0 && (
                          <div className="mt-2 ml-3 p-2 bg-dark-bg rounded border border-blue-400/30">
                            <div className="text-blue-400 font-bold mb-1">Activation Links:</div>
                            <div className="space-y-2">
                              {codes.map((link: any, linkIdx: number) => {
                                const activationLink = typeof link === 'object' ? link.activationLink : link;
                                return (
                                  <div key={linkIdx} className="text-xs">
                                    <div className="font-mono text-blue-300 break-all">
                                      <strong>#{linkIdx + 1}</strong> <a href={activationLink} target="_blank" rel="noopener noreferrer" className="hover:underline">{activationLink}</a>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        
                        {/* Crypto Order Details */}
                        {item.type === 'crypto' && metadata && (
                          <div className="mt-2 ml-3 p-2 bg-dark-bg rounded border border-neon-blue/30">
                            <div className="text-neon-blue font-bold mb-1">Crypto Order Details:</div>
                            <div className="space-y-1">
                              {metadata.coin && <div><strong>Coin:</strong> {metadata.coin}</div>}
                              {metadata.exchange && <div><strong>Exchange:</strong> {metadata.exchange}</div>}
                              {metadata.network && <div><strong>Network:</strong> {metadata.network}</div>}
                              {metadata.walletAddress && (
                                <div className="break-all">
                                  <strong>Wallet Address:</strong> <span className="text-neon-blue">{metadata.walletAddress}</span>
                                </div>
                              )}
                              {metadata.email && <div><strong>Email:</strong> {metadata.email}</div>}
                              {metadata.exchangeId && <div><strong>Exchange ID:</strong> {metadata.exchangeId}</div>}
                              {metadata.notes && <div><strong>Notes:</strong> {metadata.notes}</div>}
                              {metadata.amountUsd && <div><strong>Amount:</strong> ${metadata.amountUsd} USD</div>}
                            </div>
                          </div>
                        )}
                        
                        {/* Wallet Order Details */}
                        {item.type === 'wallet' && metadata && (
                          <div className="mt-2 ml-3 p-2 bg-dark-bg rounded border border-green-400/30">
                            <div className="text-green-400 font-bold mb-1">Wallet Top-up Details:</div>
                            <div className="space-y-1">
                              {metadata.walletName && <div><strong>Wallet:</strong> {metadata.walletName}</div>}
                              {metadata.walletEmail && (
                                <div className="break-all">
                                  <strong>Registered Email:</strong> <span className="text-green-400">{metadata.walletEmail}</span>
                                </div>
                              )}
                              {metadata.amountUsd && <div><strong>Amount:</strong> ${metadata.amountUsd} USD</div>}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {o.payment && (
                <div className="mb-3 p-2 bg-dark-bg rounded text-xs text-gray-400">
                  <div>Sender: {o.payment.senderName}</div>
                  {o.payment.transactionId && <div>Transaction ID: {o.payment.transactionId}</div>}
                  {o.payment.popUrl && (
                    <a href={o.payment.popUrl} target="_blank" rel="noreferrer" className="text-neon-blue hover:underline inline-block mt-1">
                      View Proof of Payment
                    </a>
                  )}
                </div>
              )}

              {orderView === 'new' && (
                <div className="mt-3 flex gap-2">
                  <button 
                    onClick={() => setStatus(o.id, 'approved')} 
                    className="cyber-border text-green-400 px-4 py-2 rounded hover:bg-green-400/10 font-semibold"
                  >
                    ✓ Approve
                  </button>
                  <button 
                    onClick={() => setStatus(o.id, 'rejected')} 
                    className="cyber-border text-red-400 px-4 py-2 rounded hover:bg-red-400/10 font-semibold"
                  >
                    ✗ Reject
                  </button>
                  <button 
                    onClick={() => handleFulfill(o)} 
                    className="cyber-border text-neon-blue px-4 py-2 rounded hover:bg-neon-blue/10 font-semibold"
                  >
                    ✓ Fulfill
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
        ) : (
          <div className="text-gray-400 text-center py-8">
            {orderView === 'new' && 'No new orders'}
            {orderView === 'completed' && 'No completed orders'}
            {orderView === 'rejected' && 'No rejected orders'}
          </div>
        )}

      {/* Gift Card Code Entry Modal */}
      {showCodeModal && selectedOrder && selectedItem && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-dark-bg border border-neon-blue rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-white font-bold text-lg mb-4">
              Enter Gift Card Codes - {selectedItem.name}
            </h3>
            <p className="text-gray-300 text-sm mb-4">
              Please enter {selectedItem.quantity} gift card code{selectedItem.quantity > 1 ? 's' : ''} for {selectedItem.name}
            </p>
            <div className="space-y-4">
              {giftCardCodes.map((codeItem, idx) => (
                <div key={idx} className="p-3 bg-dark-surface rounded-lg border border-dark-border">
                  <div className="text-yellow-400 font-semibold mb-3">Gift Card #{idx + 1}</div>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-gray-300 text-sm mb-1">Serial Number:</label>
                      <input
                        type="text"
                        value={codeItem.serialNumber}
                        onChange={(e) => {
                          const newCodes = [...giftCardCodes];
                          newCodes[idx] = { ...newCodes[idx], serialNumber: e.target.value };
                          setGiftCardCodes(newCodes);
                        }}
                        placeholder={`Enter serial number ${idx + 1}`}
                        className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-white focus:border-neon-blue focus:outline-none font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-300 text-sm mb-1">Redeem Code:</label>
                      <input
                        type="text"
                        value={codeItem.redeemCode}
                        onChange={(e) => {
                          const newCodes = [...giftCardCodes];
                          newCodes[idx] = { ...newCodes[idx], redeemCode: e.target.value };
                          setGiftCardCodes(newCodes);
                        }}
                        placeholder={`Enter redeem code ${idx + 1}`}
                        className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-white focus:border-neon-blue focus:outline-none font-mono"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-6">
              <button
                onClick={saveCodes}
                disabled={giftCardCodes.some(c => !c.serialNumber.trim() || !c.redeemCode.trim())}
                className="flex-1 bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
              >
                Save Codes
              </button>
              <button
                onClick={() => {
                  setShowCodeModal(false);
                  setSelectedOrder(null);
                  setSelectedItem(null);
                  setGiftCardCodes([]);
                }}
                className="px-4 py-2 bg-dark-surface border border-dark-border rounded-lg text-white hover:bg-dark-card transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InvoicesManager({ getAdminHeaders }: { getAdminHeaders: () => Record<string, string> }) {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [form, setForm] = useState<any>({ 
    customer: '', 
    email: '', 
    serviceType: 'giftcard',
    items: [{ name: '', description: '', quantity: 1, priceUsd: 0 }],
    totalUsd: 0, 
    totalMwk: 0,
    notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [previewInvoice, setPreviewInvoice] = useState<any>(null);
  
  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/invoices`, { headers: getAdminHeaders() as HeadersInit });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Server error: ${res.status}`);
      }
      const data = await res.json();
      console.log('Loaded invoices:', data);
      setInvoices(Array.isArray(data) ? data : []);
    } catch (error: any) {
      console.error('Failed to load invoices:', error);
      alert(`Failed to load invoices: ${error.message || 'Unknown error'}. Check console for details.`);
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  };
  
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);
  
  const addItem = () => {
    setForm({
      ...form,
      items: [...form.items, { name: '', description: '', quantity: 1, priceUsd: 0 }]
    });
  };
  
  const removeItem = (index: number) => {
    const newItems = form.items.filter((_: any, i: number) => i !== index);
    setForm({ ...form, items: newItems });
  };
  
  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...form.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setForm({ ...form, items: newItems });
    
    // Recalculate totals
    const totalUsd = newItems.reduce((sum, item) => sum + (item.priceUsd || 0) * (item.quantity || 1), 0);
    let rateType: 'crypto' | 'giftcard' | 'wallet' = 'giftcard';
    if (form.serviceType === 'crypto') rateType = 'crypto';
    else if (form.serviceType === 'wallet' || form.serviceType === 'virtual-card') rateType = 'wallet';
    else if (form.serviceType === 'giftcard') rateType = 'giftcard';
    else if (form.serviceType === 'tt-order' || form.serviceType === 'payment-transfer') rateType = 'giftcard'; // Default to giftcard rate for TT orders
    const totalMwk = totalUsd > 0 ? getMwkAmountFromUsd(totalUsd, rateType) : 0;
    setForm({ ...form, items: newItems, totalUsd, totalMwk });
  };
  
  
  const create = async () => {
    if (!form.customer || !form.email || form.items.length === 0) {
      alert('Please fill in customer name, email, and add at least one item');
      return;
    }
    
    // Validate that at least one item has a name and price
    const validItems = form.items.filter((item: any) => item.name && item.priceUsd > 0);
    if (validItems.length === 0) {
      alert('Please add at least one item with a name and price greater than 0');
      return;
    }
    
    const totalUsd = form.items.reduce((sum: number, item: any) => sum + (item.priceUsd || 0) * (item.quantity || 1), 0);
    let rateType: 'crypto' | 'giftcard' | 'wallet' = 'giftcard';
    if (form.serviceType === 'crypto') rateType = 'crypto';
    else if (form.serviceType === 'wallet' || form.serviceType === 'virtual-card') rateType = 'wallet';
    else if (form.serviceType === 'giftcard') rateType = 'giftcard';
    else if (form.serviceType === 'tt-order' || form.serviceType === 'payment-transfer') rateType = 'giftcard';
    const totalMwk = totalUsd > 0 ? getMwkAmountFromUsd(totalUsd, rateType) : form.totalMwk;
    
    try {
      const invoiceData = {
        customer: form.customer,
        email: form.email,
        serviceType: form.serviceType,
        items: JSON.stringify(form.items),
        totalUsd,
        totalMwk,
        notes: form.notes || null
      };
      
      console.log('Creating invoice with data:', invoiceData);
      
      const response = await fetch(`${API_BASE}/invoices`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json', ...getAdminHeaders() }, 
        body: JSON.stringify(invoiceData) 
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }
      
      const result = await response.json();
      console.log('Invoice created successfully:', result);
      
      setForm({ 
        customer: '', 
        email: '', 
        serviceType: 'giftcard',
        items: [{ name: '', description: '', quantity: 1, priceUsd: 0 }],
        totalUsd: 0, 
        totalMwk: 0,
        notes: ''
      });
      
      await load();
      alert('Invoice created successfully!');
    } catch (error: any) {
      console.error('Failed to create invoice:', error);
      alert(`Failed to create invoice: ${error.message || 'Unknown error'}. Check console for details.`);
    }
  };
  
  const viewInvoice = (invoice: any) => {
    const items = typeof invoice.items === 'string' ? JSON.parse(invoice.items) : invoice.items || [];
    setPreviewInvoice({ ...invoice, items });
  };
  
  const printInvoice = (invoice: any) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    const items = typeof invoice.items === 'string' ? JSON.parse(invoice.items) : invoice.items || [];
    const totalUsd = items.reduce((sum: number, item: any) => sum + (item.priceUsd || 0) * (item.quantity || 1), 0);
    let rateType: 'crypto' | 'giftcard' | 'wallet' = 'giftcard';
    if (invoice.serviceType === 'crypto') rateType = 'crypto';
    else if (invoice.serviceType === 'wallet' || invoice.serviceType === 'virtual-card') rateType = 'wallet';
    else if (invoice.serviceType === 'giftcard') rateType = 'giftcard';
    else if (invoice.serviceType === 'tt-order' || invoice.serviceType === 'payment-transfer') rateType = 'giftcard';
    const totalMwk = invoice.totalMwk || getMwkAmountFromUsd(totalUsd, rateType);
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Invoice ${invoice.id}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; color: #333; }
            .header { display: flex; justify-content: space-between; margin-bottom: 30px; border-bottom: 2px solid #000; padding-bottom: 20px; align-items: center; }
            .logo { max-height: 150px; max-width: 350px; object-fit: contain; }
            .company-info { text-align: right; font-size: 12px; }
            .invoice-details { margin: 30px 0; }
            .invoice-number { font-size: 20px; font-weight: bold; margin-bottom: 10px; }
            .customer-info { margin: 20px 0; }
            .items-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            .items-table th, .items-table td { border: 1px solid #ddd; padding: 10px; text-align: left; }
            .items-table th { background-color: #f4f4f4; }
            .total-row { font-weight: bold; background-color: #f4f4f4; }
            .payment-section { margin-top: 40px; padding: 20px; background-color: #f9f9f9; border: 1px solid #ddd; }
            .payment-section h3 { margin-top: 0; color: #00d4ff; }
            .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #666; }
            @media print { body { margin: 20px; } }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <img src="/tconnect_logo-removebg-preview.png" alt="TConnect Logo" class="logo" />
              <div style="margin-top: 10px; font-size: 11px; color: #666;">
                Development House, Blantyre, Third Floor, Office 307<br/>
                Email: contact@tconnect.store<br/>
                Phone: +265 997 40 75 98
              </div>
            </div>
            <div class="company-info">
              <div style="font-weight: bold; margin-bottom: 10px;">INVOICE</div>
              <div>Invoice #: ${invoice.id}</div>
              <div>Date: ${new Date(invoice.createdAt || Date.now()).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
            </div>
          </div>
          
          <div class="invoice-details" style="margin-top: 30px;">
            <div class="customer-info" style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
              <strong style="font-size: 14px;">Bill To:</strong><br/>
              <div style="margin-top: 5px;">
                ${invoice.customer}<br/>
                ${invoice.email}
              </div>
            </div>
            
            <div style="margin-bottom: 20px;">
              <strong>Service Type:</strong> ${invoice.serviceType?.charAt(0).toUpperCase() + invoice.serviceType?.slice(1).replace('-', ' ') || 'Gift Card'}
            </div>
          </div>
          
          <table class="items-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Description</th>
                <th>Qty</th>
                <th>Unit Price (USD)</th>
                <th>Total (USD)</th>
              </tr>
            </thead>
            <tbody>
              ${items.map((item: any) => `
                <tr>
                  <td>${item.name || '-'}</td>
                  <td>${item.description || '-'}</td>
                  <td>${item.quantity || 1}</td>
                  <td>$${Number(item.priceUsd || 0).toFixed(2)}</td>
                  <td>$${Number((item.priceUsd || 0) * (item.quantity || 1)).toFixed(2)}</td>
                </tr>
              `).join('')}
              <tr class="total-row">
                <td colspan="4" style="text-align: right;">Subtotal (USD):</td>
                <td>$${totalUsd.toFixed(2)}</td>
              </tr>
              <tr class="total-row">
                <td colspan="4" style="text-align: right;">Total (MWK):</td>
                <td>MWK ${totalMwk.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
          
          ${invoice.notes ? `<div style="margin: 20px 0;"><strong>Notes:</strong> ${invoice.notes}</div>` : ''}
          
          <div class="payment-section">
            <h3>Payment Instructions</h3>
            <p><strong>Bank Name:</strong> National Bank of Malawi</p>
            <p><strong>Account Name:</strong> TrickalHoldings</p>
            <p><strong>Account Number:</strong> 1011725615</p>
            <p><strong>Amount to Pay:</strong> MWK ${totalMwk.toLocaleString()}</p>
            <p style="margin-top: 15px;">
              <strong>Payment Instructions:</strong><br/>
              1. Transfer the exact amount: <strong>MWK ${totalMwk.toLocaleString()}</strong><br/>
              2. Use your name as the reference/comment<br/>
              3. Upload proof of payment (POP) when making payment<br/>
              4. Orders will be processed after payment confirmation
            </p>
          </div>
          
          <div class="footer">
            <p>Thank you for your business!</p>
            <p>TConnect Store - Your trusted digital marketplace</p>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 250);
  };
  
  return (
    <div className="space-y-6">
      <div className="card-dark p-6">
        <h3 className="text-white font-bold mb-4">Create New Invoice</h3>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input 
              value={form.customer} 
              onChange={(e) => setForm({ ...form, customer: e.target.value })} 
              placeholder="Customer Name *" 
              className="px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white" 
            />
            <input 
              value={form.email} 
              onChange={(e) => setForm({ ...form, email: e.target.value })} 
              type="email"
              placeholder="Customer Email *" 
              className="px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white" 
            />
          </div>
          
          <div>
            <label className="block text-white text-sm mb-2">Service Type *</label>
            <select 
              value={form.serviceType} 
              onChange={(e) => setForm({ ...form, serviceType: e.target.value })}
              className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white"
            >
              <option value="giftcard">Gift Card</option>
              <option value="crypto">Cryptocurrency</option>
              <option value="wallet">Digital Wallet</option>
              <option value="virtual-card">Virtual Card</option>
              <option value="tt-order">TT Order / Currency Exchange</option>
              <option value="payment-transfer">Payment Transfer</option>
              <option value="other">Other Service</option>
            </select>
          </div>
          
          <div>
            <label className="block text-white text-sm mb-2">Items / Products *</label>
            {form.items.map((item: any, index: number) => (
              <div key={index} className="grid grid-cols-12 gap-2 mb-2">
                <input 
                  value={item.name} 
                  onChange={(e) => updateItem(index, 'name', e.target.value)} 
                  placeholder="Item Name" 
                  className="col-span-3 px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white text-sm" 
                />
                <input 
                  value={item.description} 
                  onChange={(e) => updateItem(index, 'description', e.target.value)} 
                  placeholder="Description" 
                  className="col-span-4 px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white text-sm" 
                />
                <input 
                  type="number" 
                  value={item.quantity} 
                  onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value || '1', 10))} 
                  placeholder="Qty" 
                  className="col-span-2 px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white text-sm" 
                />
                <input 
                  type="number" 
                  step="0.01"
                  value={item.priceUsd} 
                  onChange={(e) => updateItem(index, 'priceUsd', parseFloat(e.target.value || '0'))} 
                  placeholder="Price USD" 
                  className="col-span-2 px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white text-sm" 
                />
                <button 
                  onClick={() => removeItem(index)} 
                  className="col-span-1 px-3 py-2 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600"
                  disabled={form.items.length === 1}
                >
                  ×
                </button>
              </div>
            ))}
            <button 
              onClick={addItem} 
              className="mt-2 px-4 py-2 bg-dark-surface border border-dark-border text-white rounded-lg hover:bg-dark-card"
            >
              + Add Item
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-white text-sm mb-2">Total USD</label>
              <input 
                type="number" 
                step="0.01"
                value={form.totalUsd} 
                readOnly
                className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white font-bold" 
              />
            </div>
            <div>
              <label className="block text-white text-sm mb-2">Total MWK</label>
              <input 
                type="number" 
                value={form.totalMwk} 
                readOnly
                className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white font-bold" 
              />
            </div>
          </div>
          
          <div>
            <label className="block text-white text-sm mb-2">Additional Notes (Optional)</label>
            <textarea 
              value={form.notes} 
              onChange={(e) => setForm({ ...form, notes: e.target.value })} 
              placeholder="Any additional information or terms..."
              rows={3}
              className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white" 
            />
          </div>
          
          <button 
            onClick={create} 
            disabled={!form.customer || !form.email || form.items.length === 0}
            className="btn-cyber text-white px-6 py-3 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Create Invoice
          </button>
        </div>
      </div>
      
      <div>
        <h3 className="text-white font-bold mb-4">Existing Invoices ({invoices.length})</h3>
        {loading ? (
          <p className="text-gray-400">Loading...</p>
        ) : Array.isArray(invoices) && invoices.length > 0 ? (
          <div className="space-y-2">
            {invoices.map((i) => {
              const items = typeof i.items === 'string' ? JSON.parse(i.items) : i.items || [];
              const totalUsd = items.reduce((sum: number, item: any) => sum + (item.priceUsd || 0) * (item.quantity || 1), 0);
              return (
                <div key={i.id} className="p-4 border border-dark-border rounded-lg bg-dark-surface">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-white font-semibold">Invoice #{i.id}</div>
                      <div className="text-gray-400 text-sm">
                        {i.customer} • {i.email} • {i.serviceType || 'giftcard'}
                      </div>
                      <div className="text-gray-400 text-sm">
                        ${totalUsd.toFixed(2)} USD • MWK {i.totalMwk?.toLocaleString() || '0'}
                      </div>
                      <div className="text-gray-500 text-xs mt-1">
                        {new Date(i.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => viewInvoice(i)} 
                        className="cyber-border text-white px-3 py-1 rounded text-sm"
                      >
                        View
                      </button>
                      <button 
                        onClick={() => printInvoice(i)} 
                        className="cyber-border text-neon-blue px-3 py-1 rounded text-sm"
                      >
                        Print
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-gray-400 text-center py-8">No invoices found</div>
        )}
      </div>
      
      {previewInvoice && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-bg border border-dark-border rounded-lg max-w-4xl w-full max-h-[90vh] overflow-auto p-6">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-white text-2xl font-bold">Invoice Preview</h2>
              <button 
                onClick={() => setPreviewInvoice(null)} 
                className="text-white hover:text-red-400"
              >
                × Close
              </button>
            </div>
            <button 
              onClick={() => printInvoice(previewInvoice)} 
              className="mb-4 btn-cyber text-white px-4 py-2 rounded-lg"
            >
              Print Invoice
            </button>
            <div className="bg-white text-black p-6 rounded" id="invoice-preview-content">
              {/* Invoice preview will be generated by printInvoice function */}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


function UsersManager({ getAdminHeaders }: { getAdminHeaders: () => Record<string, string> }) {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('Loading users from:', `${API_BASE}/users`);
      const res = await fetch(`${API_BASE}/users`, { headers: (getAdminHeaders() as HeadersInit) });
      console.log('Users response status:', res.status);
      if (!res.ok) {
        const errorText = await res.text();
        console.error('Failed to load users:', res.status, errorText);
        throw new Error(`Failed to load users: ${res.status} ${res.statusText}`);
      }
      const data = await res.json();
      console.log('Users loaded:', data.length, 'users');
      setUsers(Array.isArray(data) ? data : []);
    } catch (error: any) {
      console.error('Failed to load users:', error);
      setError(error.message || 'Failed to load users');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => { 
    load(); 
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  // Auto-refresh users every 5 seconds when on users tab
  useEffect(() => {
    const interval = setInterval(() => {
      load();
    }, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  const updateRole = async (id: string, role: string) => {
    try {
      await fetch(`${API_BASE}/users/${id}`, { method: 'PATCH', headers: ({ 'Content-Type': 'application/json', ...getAdminHeaders() } as HeadersInit), body: JSON.stringify({ role }) });
      await load();
    } catch (error) {
      console.error('Failed to update role:', error);
    }
  };
  
  const remove = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    try {
      await fetch(`${API_BASE}/users/${id}`, { method: 'DELETE', headers: (getAdminHeaders() as HeadersInit) });
      await load();
    } catch (error) {
      console.error('Failed to delete user:', error);
    }
  };
  
  const testUpsert = async () => {
    try {
      const res = await fetch(`${API_BASE}/users/upsert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: `test-${Date.now()}@example.com`,
          name: 'Test User',
          avatarUrl: null
        })
      });
      const data = await res.json();
      alert(`Test result: ${res.ok ? 'SUCCESS - User created!' : 'FAILED - ' + JSON.stringify(data)}`);
      await load();
    } catch (error: any) {
      alert(`Test failed: ${error.message}`);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-gray-400">Total users: {users.length}</div>
        <div className="flex gap-2">
          <button onClick={testUpsert} className="cyber-border text-green-400 px-4 py-2 rounded hover:bg-green-400/10 text-sm">
            Test API
          </button>
          <button onClick={load} disabled={loading} className="cyber-border text-neon-blue px-4 py-2 rounded hover:bg-neon-blue/10 disabled:opacity-50">
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>
      
      {error && (
        <div className="bg-red-400/20 border border-red-400/50 rounded-lg p-3 text-red-400 text-sm">
          {error}
        </div>
      )}
      
      {loading ? (
        <p className="text-gray-400">Loading...</p>
      ) : Array.isArray(users) && users.length > 0 ? (
        <div className="space-y-2">
          {users.map(u => (
            <div key={u.id} className="flex items-center justify-between p-3 border border-dark-border rounded-lg bg-dark-surface">
              <div>
                <div className="text-white font-semibold">{u.email}</div>
                <div className="text-gray-400 text-sm">Name: {u.name || 'N/A'} • Role: {u.role || 'user'}</div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => updateRole(u.id, 'user')} className={`cyber-border px-3 py-1 rounded text-xs ${u.role === 'user' ? 'bg-neon-blue/20 text-neon-blue' : 'text-white'}`}>User</button>
                <button onClick={() => updateRole(u.id, 'staff')} className={`cyber-border px-3 py-1 rounded text-xs ${u.role === 'staff' ? 'bg-yellow-400/20 text-yellow-400' : 'text-white'}`}>Staff</button>
                <button onClick={() => updateRole(u.id, 'admin')} className={`cyber-border px-3 py-1 rounded text-xs ${u.role === 'admin' ? 'bg-green-400/20 text-green-400' : 'text-white'}`}>Admin</button>
                <button onClick={() => remove(u.id)} className="cyber-border text-red-400 px-3 py-1 rounded text-xs hover:bg-red-400/10">Delete</button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-gray-400 text-center py-8">No users found</div>
      )}
    </div>
  );
}

function TTOrdersManager({ getAdminHeaders }: { getAdminHeaders: () => Record<string, string> }) {
  const [orders, setOrders] = useState<any[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'in-progress' | 'completed' | 'cancelled'>('all');
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      console.log('📦 [TTOrders] Loading TT orders from:', `${API_BASE}/ttorders`);
      const res = await fetch(`${API_BASE}/ttorders`, { headers: getAdminHeaders() as HeadersInit });
      console.log('📥 [TTOrders] Response status:', res.status);
      
      if (!res.ok) {
        const errorText = await res.text();
        console.error('❌ [TTOrders] Failed to load:', res.status, errorText);
        throw new Error(`Failed to load TT orders: ${res.status} ${res.statusText}`);
      }
      
      const data = await res.json();
      console.log('✅ [TTOrders] Loaded', Array.isArray(data) ? data.length : 'non-array', 'orders');
      setOrders(Array.isArray(data) ? data : []);
    } catch (error: any) {
      console.error('❌ [TTOrders] Error loading TT orders:', error);
      setOrders([]);
      alert(`Failed to load TT orders: ${error.message || 'Unknown error'}. Check console for details.`);
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  const updateStatus = async (id: string, status: string) => {
    try {
      await fetch(`${API_BASE}/ttorders/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...getAdminHeaders() },
        body: JSON.stringify({ status })
      });
      await load();
    } catch (error) {
      console.error('Failed to update TT order status:', error);
      alert('Failed to update status');
    }
  };

  const deleteOrder = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this TT order?')) return;
    try {
      await fetch(`${API_BASE}/ttorders/${id}`, {
        method: 'DELETE',
        headers: getAdminHeaders() as HeadersInit
      });
      await load();
    } catch (error) {
      console.error('Failed to delete TT order:', error);
      alert('Failed to delete order');
    }
  };

  const filteredOrders = orders.filter(order => {
    if (filter === 'all') return true;
    return order.status === filter;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30';
      case 'in-progress': return 'text-blue-400 bg-blue-400/10 border-blue-400/30';
      case 'completed': return 'text-green-400 bg-green-400/10 border-green-400/30';
      case 'cancelled': return 'text-red-400 bg-red-400/10 border-red-400/30';
      default: return 'text-gray-400 bg-gray-400/10 border-gray-400/30';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 mb-4">
        {['all', 'pending', 'in-progress', 'completed', 'cancelled'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f as any)}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              filter === f
                ? 'bg-neon-blue text-white neon-glow'
                : 'bg-dark-surface text-gray-300 hover:bg-dark-card border border-dark-border'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1).replace('-', ' ')}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-gray-400">Loading TT orders...</p>
      ) : filteredOrders.length > 0 ? (
        <div className="space-y-3">
          {filteredOrders.map((order) => (
            <div key={order.id} className="card-dark p-4 border border-dark-border rounded-lg">
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(order.status)}`}>
                      {order.status.replace('-', ' ').toUpperCase()}
                    </span>
                    <span className="text-white font-semibold">{order.orderType}</span>
                    {order.amount && (
                      <span className="text-neon-blue font-bold">
                        {order.currency || 'USD'} {parseFloat(order.amount).toLocaleString()}
                      </span>
                    )}
                  </div>
                  <div className="text-gray-300 text-sm space-y-1">
                    <div><strong className="text-white">Customer:</strong> {order.customerName}</div>
                    <div><strong className="text-white">Email:</strong> 
                      <a href={`mailto:${order.email}`} className="text-neon-blue hover:underline ml-1">
                        {order.email}
                      </a>
                    </div>
                    {order.phone && (
                      <div><strong className="text-white">Phone:</strong> 
                        <a href={`tel:${order.phone}`} className="text-neon-blue hover:underline ml-1">
                          {order.phone}
                        </a>
                      </div>
                    )}
                    <div className="mt-2">
                      <strong className="text-white">Details:</strong>
                      <p className="text-gray-400 mt-1 whitespace-pre-wrap">{order.details}</p>
                    </div>
                    <div className="text-gray-500 text-xs mt-2">
                      Created: {new Date(order.createdAt).toLocaleString()}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-2 ml-4">
                  <select
                    value={order.status}
                    onChange={(e) => updateStatus(order.id, e.target.value)}
                    className="px-3 py-1 bg-dark-surface border border-dark-border rounded text-white text-sm"
                  >
                    <option value="pending">Pending</option>
                    <option value="in-progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                  <button
                    onClick={() => deleteOrder(order.id)}
                    className="px-3 py-1 text-red-400 border border-red-400/30 rounded text-sm hover:bg-red-400/10"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-gray-400 text-center py-8">
          No TT orders found{filter !== 'all' ? ` with status: ${filter}` : ''}.
        </div>
      )}
    </div>
  );
}

function SlidesManager({ getAdminHeaders }: { getAdminHeaders: () => Record<string, string> }) {
  const [slides, setSlides] = useState<any[]>([]);
  const [form, setForm] = useState<any>({ title: '', subtitle: '', description: '', image: '', cta: '', ctaLink: '/', order: 0, active: true });
  const [editing, setEditing] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/slides/all`, { headers: getAdminHeaders() });
      const data = await res.json();
      setSlides(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to load slides:', error);
      setSlides([]);
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  const create = async () => {
    try {
      await fetch(`${API_BASE}/slides`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json', ...getAdminHeaders() }, 
        body: JSON.stringify(form) 
      });
      setForm({ title: '', subtitle: '', description: '', image: '', cta: '', ctaLink: '/', order: 0, active: true });
      await load();
    } catch (error) {
      console.error('Failed to create slide:', error);
    }
  };

  const update = async (id: string) => {
    try {
      await fetch(`${API_BASE}/slides/${id}`, { 
        method: 'PUT', 
        headers: { 'Content-Type': 'application/json', ...getAdminHeaders() }, 
        body: JSON.stringify(form) 
      });
      setEditing(null);
      setForm({ title: '', subtitle: '', description: '', image: '', cta: '', ctaLink: '/', order: 0, active: true });
      await load();
    } catch (error) {
      console.error('Failed to update slide:', error);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm('Delete this slide?')) return;
    try {
      await fetch(`${API_BASE}/slides/${id}`, { method: 'DELETE', headers: getAdminHeaders() });
      await load();
    } catch (error) {
      console.error('Failed to delete slide:', error);
    }
  };

  const startEdit = (slide: any) => {
    setEditing(slide.id);
    setForm({ ...slide });
  };

  const cancelEdit = () => {
    setEditing(null);
    setForm({ title: '', subtitle: '', description: '', image: '', cta: '', ctaLink: '/', order: 0, active: true });
  };

  return (
    <div className="space-y-6">
      <div className="card-dark p-4">
        <h3 className="text-white font-bold mb-4">{editing ? 'Edit Slide' : 'Create New Slide'}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Title *" className="px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white" />
          <input value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} placeholder="Subtitle" className="px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white" />
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description" rows={2} className="md:col-span-2 px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white" />
          <input value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} placeholder="Image URL or emoji *" className="px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white" />
          <input value={form.cta} onChange={(e) => setForm({ ...form, cta: e.target.value })} placeholder="Call to Action Text" className="px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white" />
          <input value={form.ctaLink} onChange={(e) => setForm({ ...form, ctaLink: e.target.value })} placeholder="CTA Link" className="px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white" />
          <input type="number" value={form.order} onChange={(e) => setForm({ ...form, order: parseInt(e.target.value || '0', 10) })} placeholder="Order (0, 1, 2...)" className="px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white" />
          <label className="flex items-center space-x-2 text-white">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
            <span>Active</span>
          </label>
        </div>
        <div className="flex gap-2 mt-4">
          {editing ? (
            <>
              <button onClick={() => update(editing)} className="btn-cyber text-white px-6 py-2 rounded-lg">Save Changes</button>
              <button onClick={cancelEdit} className="px-6 py-2 bg-dark-surface border border-dark-border rounded-lg text-white">Cancel</button>
            </>
          ) : (
            <button onClick={create} disabled={!form.title || !form.image} className="btn-cyber text-white px-6 py-2 rounded-lg disabled:opacity-50">Create Slide</button>
          )}
        </div>
      </div>

      <div>
        <h3 className="text-white font-bold mb-4">Existing Slides ({slides.length})</h3>
        {loading ? (
          <p className="text-gray-400">Loading...</p>
        ) : Array.isArray(slides) && slides.length > 0 ? (
          <div className="space-y-3">
            {slides.map((slide) => (
              <div key={slide.id} className="p-4 border border-dark-border rounded-lg">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-4xl">{slide.image}</span>
                      <div>
                        <div className="text-white font-semibold">{slide.title}</div>
                        {slide.subtitle && <div className="text-gray-400 text-sm">{slide.subtitle}</div>}
                        {slide.description && <div className="text-gray-400 text-sm mt-1">{slide.description}</div>}
                      </div>
                    </div>
                    <div className="text-gray-500 text-xs mt-2">
                      Order: {slide.order} • {slide.active ? 'Active' : 'Inactive'} • {slide.cta && `CTA: ${slide.cta}`}
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <button onClick={() => startEdit(slide)} className="cyber-border text-white px-3 py-1 rounded text-sm">Edit</button>
                    <button onClick={() => remove(slide.id)} className="cyber-border text-red-400 px-3 py-1 rounded text-sm">Delete</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-gray-400 text-center py-8">No slides found. Create one to get started.</div>
        )}
      </div>
    </div>
  );
}

function ChatManager({ getAdminHeaders }: { getAdminHeaders: () => Record<string, string> }) {
  const [chats, setChats] = useState<any[]>([]);
  const [selectedChat, setSelectedChat] = useState<any>(null);
  const [message, setMessage] = useState('');
  const [agentName, setAgentName] = useState('');
  const [showAgentNameModal, setShowAgentNameModal] = useState(false);
  const [chatToJoin, setChatToJoin] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'bot' | 'waiting' | 'active' | 'closed'>('all');

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/chats/all`, { headers: getAdminHeaders() as HeadersInit });
      const data = await res.json();
      setChats(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to load chats:', error);
      setChats([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    load();
    const interval = setInterval(load, 5000); // Poll every 5 seconds
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load selected chat messages
  useEffect(() => {
    if (selectedChat) {
      loadChatMessages(selectedChat.id);
      const interval = setInterval(() => loadChatMessages(selectedChat.id), 3000);
      return () => clearInterval(interval);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChat?.id]);

  const loadChatMessages = async (chatId: string) => {
    try {
      const res = await fetch(`${API_BASE}/chats/${chatId}`, { headers: getAdminHeaders() as HeadersInit });
      if (res.ok) {
        const chat = await res.json();
        setSelectedChat(chat);
      }
    } catch (error) {
      console.error('Failed to load chat messages:', error);
    }
  };

  const joinChat = async (chatId: string) => {
    // Show modal to enter agent name
    setChatToJoin(chatId);
    setShowAgentNameModal(true);
  };

  const confirmJoinChat = async () => {
    if (!agentName.trim() || !chatToJoin) return;
    
    try {
      const res = await fetch(`${API_BASE}/chats/${chatToJoin}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAdminHeaders() },
        body: JSON.stringify({ agentName: agentName.trim() })
      });
      if (res.ok) {
        const chat = await res.json();
        setSelectedChat(chat);
        setShowAgentNameModal(false);
        setChatToJoin(null);
        setAgentName('');
        await load();
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to join chat');
      }
    } catch (error) {
      console.error('Failed to join chat:', error);
      alert('Failed to join chat');
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      alert('Please select an image file');
    }
  };

  const uploadImage = async (): Promise<string | null> => {
    if (!imageFile) return null;
    setUploadingImage(true);
    try {
      const fileExt = imageFile.name.split('.').pop();
      const fileName = `chat/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const { data, error } = await supabase.storage.from('chat-images').upload(fileName, imageFile, { upsert: false });
      if (error) {
        console.error('Image upload error:', error);
        if (error.message.includes('Bucket') || error.message.includes('not found')) {
          alert(`Error: The 'chat-images' bucket doesn't exist in Supabase Storage.\n\nPlease:\n1. Go to Supabase Dashboard → Storage\n2. Create a new bucket named 'chat-images'\n3. Set it as public or create RLS policies allowing INSERT and SELECT for public or authenticated users.`);
        } else if (error.message.includes('row-level security') || error.message.includes('RLS')) {
          alert(`Error: Storage policy blocking upload.\n\nPlease:\n1. Go to Supabase Dashboard → Storage → chat-images bucket → Policies\n2. Create a policy allowing INSERT and SELECT for public or authenticated users.`);
        } else {
          alert(`Failed to upload image: ${error.message}`);
        }
        return null;
      }
      const { data: pub } = supabase.storage.from('chat-images').getPublicUrl(data.path);
      return pub.publicUrl;
    } catch (error: any) {
      console.error('Error uploading image:', error);
      alert(`Failed to upload image: ${error?.message || 'Unknown error'}. Please check that the 'chat-images' bucket exists in Supabase Storage.`);
      return null;
    } finally {
      setUploadingImage(false);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!message.trim() && !imageFile) || !selectedChat || sending || uploadingImage) return;

    setSending(true);
    try {
      let imageUrl = null;
      if (imageFile) {
        imageUrl = await uploadImage();
        if (!imageUrl) {
          setSending(false);
          return;
        }
      }

      const res = await fetch(`${API_BASE}/chats/${selectedChat.id}/agent-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAdminHeaders() },
        body: JSON.stringify({ 
          content: message.trim(),
          imageUrl,
          agentName: agentName || selectedChat.messages?.find((m: any) => m.senderType === 'agent')?.senderName || 'Support Agent'
        })
      });

      if (res.ok) {
        const updatedChat = await res.json();
        setSelectedChat(updatedChat);
        setMessage('');
        setImageFile(null);
        setImagePreview(null);
        await load();
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      alert('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const closeChat = async (chatId: string) => {
    if (!window.confirm('Close this chat?')) return;
    try {
      const res = await fetch(`${API_BASE}/chats/${chatId}/close`, {
        method: 'POST',
        headers: getAdminHeaders() as HeadersInit
      });
      if (res.ok) {
        await load();
        if (selectedChat?.id === chatId) {
          setSelectedChat(null);
        }
      }
    } catch (error) {
      console.error('Failed to close chat:', error);
      alert('Failed to close chat');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'bot': return 'text-blue-400 bg-blue-400/10 border-blue-400/30';
      case 'waiting': return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30';
      case 'active': return 'text-green-400 bg-green-400/10 border-green-400/30';
      case 'closed': return 'text-gray-400 bg-gray-400/10 border-gray-400/30';
      default: return 'text-gray-400 bg-gray-400/10 border-gray-400/30';
    }
  };

  const filteredChats = chats.filter(chat => {
    if (filter === 'all') return true;
    return chat.status === filter;
  });

  const waitingCount = chats.filter(c => c.status === 'waiting').length;
  const activeCount = chats.filter(c => c.status === 'active').length;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[calc(100vh-300px)]">
      {/* Chat List */}
      <div className="lg:col-span-1 bg-dark-surface rounded-lg border border-dark-border p-4 overflow-y-auto">
        <div className="flex gap-2 mb-4">
          {['all', 'waiting', 'active', 'closed'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f as any)}
              className={`px-3 py-1 rounded text-xs font-bold ${
                filter === f
                  ? 'bg-neon-blue text-white'
                  : 'bg-dark-bg text-gray-300 border border-dark-border'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
              {f === 'waiting' && waitingCount > 0 && ` (${waitingCount})`}
              {f === 'active' && activeCount > 0 && ` (${activeCount})`}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-gray-400 text-center py-8">Loading chats...</div>
        ) : filteredChats.length > 0 ? (
          <div className="space-y-2">
            {filteredChats.map((chat) => (
              <div
                key={chat.id}
                onClick={() => setSelectedChat(chat)}
                className={`p-3 rounded-lg border cursor-pointer transition-all ${
                  selectedChat?.id === chat.id
                    ? 'border-neon-blue bg-neon-blue/10'
                    : 'border-dark-border bg-dark-bg hover:border-dark-border/50'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`px-2 py-1 rounded text-xs font-bold border ${getStatusColor(chat.status)}`}>
                    {chat.status.toUpperCase()}
                  </span>
                  <span className="text-gray-500 text-xs">
                    {chat._count?.messages || 0} msgs
                  </span>
                </div>
                <div className="text-white font-semibold text-sm">
                  {chat.userName || chat.userEmail || 'Anonymous'}
                </div>
                {chat.userEmail && (
                  <div className="text-gray-400 text-xs">{chat.userEmail}</div>
                )}
                {chat.messages?.[0] && (
                  <div className="text-gray-500 text-xs mt-2 truncate">
                    {chat.messages[0].content}
                  </div>
                )}
                <div className="text-gray-600 text-xs mt-1">
                  {new Date(chat.updatedAt || chat.createdAt).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-gray-400 text-center py-8">No chats found</div>
        )}
      </div>

      {/* Chat View */}
      <div className="lg:col-span-2 bg-dark-surface rounded-lg border border-dark-border flex flex-col">
        {selectedChat ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-dark-border flex items-center justify-between">
              <div>
                <div className="text-white font-semibold">
                  {selectedChat.userName || selectedChat.userEmail || 'Anonymous'}
                </div>
                <div className="text-gray-400 text-sm">
                  {selectedChat.userEmail || 'No email provided'}
                </div>
              </div>
              <div className="flex gap-2">
                {selectedChat.status === 'waiting' && (
                  <button
                    onClick={() => joinChat(selectedChat.id)}
                    className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm font-semibold"
                  >
                    Join Chat
                  </button>
                )}
                {selectedChat.status !== 'closed' && (
                  <button
                    onClick={() => closeChat(selectedChat.id)}
                    className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 text-sm font-semibold"
                  >
                    Close
                  </button>
                )}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {selectedChat.messages?.map((msg: any) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.senderType === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[70%] rounded-lg p-3 ${
                      msg.senderType === 'user'
                        ? 'bg-neon-blue text-white'
                        : msg.senderType === 'agent'
                        ? 'bg-green-600 text-white'
                        : 'bg-dark-bg border border-neon-blue/30 text-gray-300'
                    }`}
                  >
                    <div className="text-xs font-semibold mb-1 opacity-80">
                      {msg.senderName || (msg.senderType === 'user' ? 'User' : 'Bot')}
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    {msg.imageUrl && (
                      <div className="mt-2">
                        <img 
                          src={msg.imageUrl} 
                          alt="Shared" 
                          className="max-w-full max-h-64 rounded-lg cursor-pointer hover:opacity-90"
                          onClick={() => window.open(msg.imageUrl, '_blank')}
                        />
                      </div>
                    )}
                    <p className="text-xs mt-1 opacity-70">
                      {new Date(msg.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Message Input */}
            {selectedChat.status !== 'closed' && (
              <form onSubmit={sendMessage} className="p-4 border-t border-dark-border">
                {imagePreview && (
                  <div className="mb-2 relative">
                    <img src={imagePreview} alt="Preview" className="max-h-32 rounded-lg" />
                    <button
                      type="button"
                      onClick={() => {
                        setImagePreview(null);
                        setImageFile(null);
                      }}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                    >
                      ×
                    </button>
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    className="hidden"
                    id="admin-chat-image-input"
                  />
                  <label
                    htmlFor="admin-chat-image-input"
                    className="bg-dark-bg border border-dark-border rounded-lg px-3 py-2 cursor-pointer hover:bg-dark-card transition-colors flex items-center"
                    title="Upload image"
                  >
                    📷
                  </label>
                  <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={selectedChat.status === 'waiting' ? 'Join chat to respond...' : 'Type your message...'}
                    disabled={selectedChat.status === 'waiting' || sending || uploadingImage}
                    className="flex-1 px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-white focus:border-neon-blue focus:outline-none disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={(!message.trim() && !imageFile) || sending || uploadingImage || selectedChat.status === 'waiting'}
                    className="bg-neon-blue text-white px-6 py-2 rounded-lg hover:bg-neon-blue/90 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                  >
                    {sending || uploadingImage ? '...' : 'Send'}
                  </button>
                </div>
              </form>
            )}
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400">
            Select a chat to view messages
          </div>
        )}
      </div>

      {/* Agent Name Modal */}
      {showAgentNameModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-dark-bg border border-neon-blue rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-white font-bold text-lg mb-4">Enter Your Name</h3>
            <p className="text-gray-300 text-sm mb-4">
              Please enter your name so the user knows who they're chatting with.
            </p>
            <input
              type="text"
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              placeholder="Your name (e.g., John)"
              autoFocus
              onKeyPress={(e) => e.key === 'Enter' && agentName.trim() && confirmJoinChat()}
              className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white focus:border-neon-blue focus:outline-none mb-4"
            />
            <div className="flex gap-2">
              <button
                onClick={confirmJoinChat}
                disabled={!agentName.trim()}
                className="flex-1 bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
              >
                Join Chat
              </button>
              <button
                onClick={() => {
                  setShowAgentNameModal(false);
                  setChatToJoin(null);
                  setAgentName('');
                }}
                className="px-4 py-2 bg-dark-surface border border-dark-border rounded-lg text-white hover:bg-dark-card"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
