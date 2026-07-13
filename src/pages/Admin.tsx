import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { getMwkAmountFromUsd } from '../utils/rates';
import AdminNotificationBell from '../components/AdminNotificationBell';
import { getApiBase } from '../lib/getApiBase';
import { fetchAdminUsers } from '../lib/adminUsers';
import {
  GIFTCARD_ADMIN_MIN_USD,
  GIFTCARD_ADMIN_MAX_USD,
  isGiftCardAdminPriceValid,
} from '../lib/giftCardPricing';
import {
  isVirtualCardOrderItem,
  normalizeVirtualCardFromStored,
  orderItemHasVirtualCardDetails,
} from '../lib/virtualCardCodes';
import PromotionsManager from '../components/admin/PromotionsManager';
import BlogsManager from '../components/admin/BlogsManager';
import AbandonedCartsManager from '../components/admin/AbandonedCartsManager';
import {
  Home,
  ShoppingBag,
  BarChart3,
  Package,
  DollarSign,
  FileText,
  Repeat,
  Users,
  Star,
  Receipt,
  Image,
  MessageSquare,
  ClipboardList,
  Megaphone,
  BookOpen,
  Bell,
  Search,
  MapPin,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Wallet,
  Plug,
  CreditCard,
  type LucideIcon,
} from 'lucide-react';

type AdminTab =
  | 'home'
  | 'orders'
  | 'products'
  | 'rates'
  | 'invoices'
  | 'users'
  | 'signins'
  | 'slides'
  | 'sales'
  | 'ttorders'
  | 'chats'
  | 'points'
  | 'spin'
  | 'receipts'
  | 'notifications'
  | 'manualorders'
  | 'promotions'
  | 'blogs'
  | 'carts';

type AdminSection = {
  id: Exclude<AdminTab, 'home'>;
  label: string;
  description: string;
  icon: LucideIcon;
};

type AdminRole = 'superadmin' | 'operations' | 'content' | 'support';

type HomeStats = {
  totalOrders: number;
  pendingOrders: number;
  activePromotions: number;
};

const ADMIN_SECTIONS: AdminSection[] = [
  { id: 'orders', label: 'Orders', description: 'Review and process customer orders', icon: ShoppingBag },
  { id: 'carts', label: 'Saved carts', description: 'Customers with items in cart (for follow-up)', icon: ShoppingCart },
  { id: 'sales', label: 'Sales Dashboard', description: 'Track revenue and business performance', icon: BarChart3 },
  { id: 'products', label: 'Products', description: 'Manage products, pricing, and stock', icon: Package },
  { id: 'rates', label: 'Rates', description: 'Update exchange and payout rates', icon: DollarSign },
  { id: 'invoices', label: 'Invoices', description: 'Issue and manage invoice records', icon: FileText },
  { id: 'ttorders', label: 'TT Orders', description: 'Handle telegraphic transfer requests', icon: Repeat },
  { id: 'users', label: 'Users', description: 'Manage user accounts and access', icon: Users },
  { id: 'signins', label: 'Recent Sign-ins', description: 'All users with locations — recent logins on top', icon: MapPin },
  { id: 'points', label: 'Points Portal', description: 'Administer points balances and rules', icon: Star },
  { id: 'spin', label: 'Spin Control', description: 'Spin history, stats, and bonus spins for users', icon: Sparkles },
  { id: 'receipts', label: 'Points Receipts', description: 'Track points redemption receipts', icon: Receipt },
  { id: 'slides', label: 'Slideshows', description: 'Control homepage slideshow content', icon: Image },
  { id: 'chats', label: 'Chats', description: 'Respond to live customer conversations', icon: MessageSquare },
  { id: 'manualorders', label: 'Manual Orders', description: 'Create orders manually for customers', icon: ClipboardList },
  { id: 'promotions', label: 'Promotions', description: 'Create and manage promo campaigns', icon: Megaphone },
  { id: 'blogs', label: 'Blogs', description: 'Publish and edit blog content', icon: BookOpen },
  { id: 'notifications', label: 'Send Notifications', description: 'Send announcements to users', icon: Bell },
];

const ROLE_LABELS: Record<AdminRole, string> = {
  superadmin: 'Super Admin',
  operations: 'Operations',
  content: 'Content Team',
  support: 'Support Team',
};

const ROLE_SECTION_ACCESS: Record<AdminRole, AdminSection['id'][]> = {
  superadmin: ADMIN_SECTIONS.map((s) => s.id),
  operations: ['orders', 'carts', 'sales', 'products', 'rates', 'invoices', 'ttorders', 'manualorders', 'promotions', 'spin'],
  content: ['products', 'slides', 'promotions', 'blogs', 'notifications'],
  support: ['orders', 'carts', 'users', 'signins', 'chats', 'points', 'spin', 'receipts', 'notifications'],
};

// Define SalesDashboard before Admin component to satisfy TypeScript
function SalesDashboard({ getAdminHeaders }: { getAdminHeaders: () => Record<string, string> }) {
  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [reportPeriod, setReportPeriod] = useState<'day' | 'week' | 'month'>('day');
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const load = async () => {
    setLoading(true);
    try {
      const [ordersRes, productsRes] = await Promise.all([
        fetch(`${getApiBase()}/orders`, { headers: getAdminHeaders() as HeadersInit }),
        fetch(`${getApiBase()}/products`, { headers: getAdminHeaders() as HeadersInit })
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

    const hasCustomRange = !!startDate || !!endDate;

    const periodOrders = completedOrders.filter(o => {
      const created = new Date(o.createdAt);

      // If a custom date range is selected, use that and ignore the quick period filter
      if (hasCustomRange) {
        if (startDate) {
          const start = new Date(startDate + 'T00:00:00');
          if (created < start) return false;
        }
        if (endDate) {
          const end = new Date(endDate + 'T23:59:59');
          if (created > end) return false;
        }
        return true;
      }

      // Default behaviour: use quick period (Today / Last 7 / Last 30)
      return created >= filterDate;
    });

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
      orders: periodOrders,
      revenueByType: Object.entries(revenueByType).map(([type, data]) => ({
        type: type.charAt(0).toUpperCase() + type.slice(1).replace('-', ' '),
        ...data
      })),
      dailySales: Object.values(dailySales).sort((a, b) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      )
    };
  }, [orders, reportPeriod, startDate, endDate]);

  const handleExport = () => {
    if (!salesData.orders || salesData.orders.length === 0) return;

    const headers = ['Order ID', 'Date', 'Status', 'Total USD', 'Total MWK', 'Items'];
    const rows = salesData.orders.map((o: any) => {
      const itemsSummary = (o.items || []).map((item: any) => `${item.name} x${item.quantity}`).join('; ');
      const date = o.createdAt ? new Date(o.createdAt).toISOString() : '';
      const totalUsd = typeof o.totalUsd === 'number' ? o.totalUsd.toFixed(2) : '';
      const totalMwk = typeof o.totalMwk === 'number' ? String(o.totalMwk) : '';
      return [o.id, date, o.status, totalUsd, totalMwk, itemsSummary];
    });

    const csvContent = [headers, ...rows]
      .map(row => row.map(field => `"${String(field ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;

    const rangeLabel =
      startDate || endDate
        ? `${startDate || 'start'}_to_${endDate || 'end'}`
        : reportPeriod;

    link.download = `tconnect-sales-${rangeLabel}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

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

      {/* Custom Date Range & Export */}
      <div className="flex flex-col md:flex-row md:items-end gap-3 mb-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">From date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-dark-surface border border-dark-border rounded px-3 py-2 text-gray-100 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">To date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-dark-surface border border-dark-border rounded px-3 py-2 text-gray-100 text-sm"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setStartDate('');
              setEndDate('');
            }}
            className="px-3 py-2 rounded-lg text-xs md:text-sm bg-dark-surface text-gray-300 border border-dark-border hover:bg-dark-card"
          >
            Clear dates
          </button>
          <button
            onClick={handleExport}
            disabled={!salesData.orders || salesData.orders.length === 0}
            className="px-4 py-2 rounded-lg text-xs md:text-sm font-semibold bg-emerald-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Export to Excel (CSV)
          </button>
        </div>
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
  const [activeTab, setActiveTab] = useState<AdminTab>('home');
  const [adminPass, setAdminPass] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState('');
  const [adminRole, setAdminRole] = useState<AdminRole>('superadmin');
  const [homeSearch, setHomeSearch] = useState('');
  const [homeStats, setHomeStats] = useState<HomeStats>({
    totalOrders: 0,
    pendingOrders: 0,
    activePromotions: 0,
  });
  const [statsLoading, setStatsLoading] = useState(false);
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

  const visibleSectionIds = useMemo(
    () => new Set<AdminSection['id']>(ROLE_SECTION_ACCESS[adminRole]),
    [adminRole]
  );

  const visibleSections = useMemo(
    () => ADMIN_SECTIONS.filter((section) => visibleSectionIds.has(section.id)),
    [visibleSectionIds]
  );

  const filteredSections = useMemo(() => {
    const q = homeSearch.trim().toLowerCase();
    if (!q) return visibleSections;
    return visibleSections.filter(
      (section) =>
        section.label.toLowerCase().includes(q) ||
        section.description.toLowerCase().includes(q)
    );
  }, [homeSearch, visibleSections]);

  useEffect(() => {
    if (activeTab !== 'home' && !visibleSectionIds.has(activeTab as AdminSection['id'])) {
      setActiveTab('home');
    }
  }, [activeTab, visibleSectionIds]);

  const loadHomeStats = async () => {
    if (!isAuthenticated) return;
    setStatsLoading(true);
    try {
      const headers = getAdminHeaders() as HeadersInit;
      const [ordersRes, promotionsRes] = await Promise.all([
        fetch(`${getApiBase()}/orders`, { headers }),
        fetch(`${getApiBase()}/promotions/all`, { headers }),
      ]);

      const [ordersData, promotionsData] = await Promise.all([
        ordersRes.ok ? ordersRes.json() : [],
        promotionsRes.ok ? promotionsRes.json() : [],
      ]);

      const orders = Array.isArray(ordersData) ? ordersData : [];
      const promotions = Array.isArray(promotionsData) ? promotionsData : [];

      setHomeStats({
        totalOrders: orders.length,
        pendingOrders: orders.filter((o: any) => o?.status === 'pending').length,
        activePromotions: promotions.filter((p: any) => p?.active !== false).length,
      });
    } catch {
      setHomeStats({
        totalOrders: 0,
        pendingOrders: 0,
        activePromotions: 0,
      });
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) loadHomeStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

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
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl md:text-5xl font-bold text-white holographic">Admin Dashboard</h1>
            <p className="text-gray-300 mt-2">Manage orders, products, rates, and payments.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dark-border bg-dark-surface">
              <ShieldCheck className="w-4 h-4 text-neon-blue" />
              <select
                value={adminRole}
                onChange={(e) => setAdminRole(e.target.value as AdminRole)}
                className="bg-transparent text-sm text-white focus:outline-none"
              >
                {Object.entries(ROLE_LABELS).map(([value, label]) => (
                  <option key={value} value={value} className="bg-dark-surface text-white">
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <AdminNotificationBell getAdminHeaders={getAdminHeaders} />
          </div>
        </div>

        <div className="card-dark p-2 mb-6">
          <div className="flex flex-wrap gap-2">
            {[{ id: 'home' as AdminTab, label: 'Home', icon: Home }, ...visibleSections].map((t) => {
              const Icon = t.icon;
              return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                  activeTab === t.id
                    ? 'bg-neon-blue text-white neon-glow'
                    : 'bg-dark-surface text-gray-300 hover:bg-dark-card border border-dark-border'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Icon className="w-4 h-4" />
                  {t.label}
                </span>
              </button>
              );
            })}
          </div>
        </div>

        <div className="card-dark p-6">
          {activeTab === 'home' && (
            <div>
              <div className="mb-5">
                <h2 className="text-xl font-bold text-white mb-2">Admin Home</h2>
                <p className="text-gray-400">Quick access to every section in your dashboard.</p>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                {[
                  { label: 'Total Orders', value: homeStats.totalOrders, accent: 'text-neon-blue' },
                  { label: 'Pending Orders', value: homeStats.pendingOrders, accent: 'text-yellow-400' },
                  { label: 'Active Promos', value: homeStats.activePromotions, accent: 'text-purple-400' },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-xl border border-dark-border bg-dark-surface p-4">
                    <p className="text-xs text-gray-400 mb-1">{stat.label}</p>
                    <p className={`text-2xl font-bold ${stat.accent}`}>
                      {statsLoading ? '...' : stat.value.toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mb-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <Link
                  to="/admin/dashboard"
                  className="flex items-center gap-3 p-4 rounded-xl border-2 border-amber-400/40 bg-amber-500/10 hover:bg-amber-500/20 transition-colors"
                >
                  <Package className="w-8 h-8 text-amber-400 shrink-0" />
                  <div>
                    <p className="font-bold text-white">TConnect Dashboard</p>
                    <p className="text-sm text-gray-400">
                      USDT inventory & MWK expense tracking — /admin/dashboard
                    </p>
                  </div>
                </Link>
                <Link
                  to="/admin/marketing"
                  className="flex items-center gap-3 p-4 rounded-xl border-2 border-purple-400/40 bg-purple-500/10 hover:bg-purple-500/20 transition-colors"
                >
                  <Megaphone className="w-8 h-8 text-purple-400 shrink-0" />
                  <div>
                    <p className="font-bold text-white">Marketing Funds</p>
                    <p className="text-sm text-gray-400">
                      Request & track marketing disbursements — /admin/marketing
                    </p>
                  </div>
                </Link>
                <Link
                  to="/admin/cards"
                  className="flex items-center gap-3 p-4 rounded-xl border-2 border-neon-blue/40 bg-neon-blue/10 hover:bg-neon-blue/20 transition-colors"
                >
                  <CreditCard className="w-8 h-8 text-neon-blue shrink-0" />
                  <div>
                    <p className="font-bold text-white">Card Updates</p>
                    <p className="text-sm text-gray-400">
                      Fulfill customer card refresh requests — /admin/cards
                    </p>
                  </div>
                </Link>
                <Link
                  to="/admin/reloadly"
                  className="flex items-center gap-3 p-4 rounded-xl border-2 border-cyan-400/40 bg-cyan-500/10 hover:bg-cyan-500/20 transition-colors"
                >
                  <Plug className="w-8 h-8 text-cyan-400 shrink-0" />
                  <div>
                    <p className="font-bold text-white">Reloadly</p>
                    <p className="text-sm text-gray-400">
                      Test gift cards & airtime API — /admin/reloadly
                    </p>
                  </div>
                </Link>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    value={homeSearch}
                    onChange={(e) => setHomeSearch(e.target.value)}
                    placeholder="Search sections..."
                    className="w-full bg-dark-surface border border-dark-border rounded-lg pl-10 pr-4 py-2 text-white text-sm focus:border-neon-blue focus:outline-none"
                  />
                </div>
                <button
                  onClick={loadHomeStats}
                  className="px-4 py-2 rounded-lg text-sm font-semibold bg-dark-surface text-gray-200 border border-dark-border hover:border-neon-blue transition-colors"
                >
                  Refresh stats
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredSections.map((section) => {
                  const Icon = section.icon;
                  return (
                    <button
                      key={section.id}
                      onClick={() => setActiveTab(section.id)}
                      className="text-left rounded-xl border border-dark-border bg-dark-surface hover:border-neon-blue hover:shadow-[0_0_12px_rgba(0,221,255,0.18)] transition-all p-4"
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-9 h-9 rounded-lg bg-neon-blue/15 text-neon-blue flex items-center justify-center">
                          <Icon className="w-5 h-5" />
                        </div>
                        <h3 className="text-white font-semibold">{section.label}</h3>
                      </div>
                      <p className="text-sm text-gray-400">{section.description}</p>
                    </button>
                  );
                })}
              </div>
              {filteredSections.length === 0 && (
                <div className="text-sm text-gray-400 mt-4">No section matches that search for this role.</div>
              )}
            </div>
          )}
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
          {activeTab === 'signins' && (
            <div>
              <h2 className="text-xl font-bold text-white mb-4">Recent Sign-ins</h2>
              <RecentSignInsManager getAdminHeaders={getAdminHeaders} />
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
          {activeTab === 'points' && (
            <div>
              <h2 className="text-xl font-bold text-white mb-4">TConnect Points Portal</h2>
              <PointsManager getAdminHeaders={getAdminHeaders} />
            </div>
          )}
          {activeTab === 'spin' && (
            <div>
              <h2 className="text-xl font-bold text-white mb-4">Spin Control</h2>
              <SpinAdminManager getAdminHeaders={getAdminHeaders} />
            </div>
          )}
          {activeTab === 'receipts' && (
            <div>
              <h2 className="text-xl font-bold text-white mb-4">Points Redemption Receipts</h2>
              <ReceiptsManager getAdminHeaders={getAdminHeaders} />
            </div>
          )}
          {activeTab === 'manualorders' && (
            <div>
              <h2 className="text-xl font-bold text-white mb-4">Manual Orders</h2>
              <ManualOrdersManager getAdminHeaders={getAdminHeaders} />
            </div>
          )}
          {activeTab === 'promotions' && (
            <div>
              <h2 className="text-xl font-bold text-white mb-4">Promotions</h2>
              <PromotionsManager getAdminHeaders={getAdminHeaders} />
            </div>
          )}
          {activeTab === 'blogs' && (
            <div>
              <h2 className="text-xl font-bold text-white mb-4">Blogs</h2>
              <BlogsManager getAdminHeaders={getAdminHeaders} />
            </div>
          )}
          {activeTab === 'carts' && (
            <div>
              <h2 className="text-xl font-bold text-white mb-4">Saved carts (abandoned checkout)</h2>
              <AbandonedCartsManager getAdminHeaders={getAdminHeaders} />
            </div>
          )}
          {activeTab === 'notifications' && (
            <div>
              <h2 className="text-xl font-bold text-white mb-4">Send Notifications</h2>
              <NotificationManager getAdminHeaders={getAdminHeaders} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ManualOrdersManager({ getAdminHeaders }: { getAdminHeaders: () => Record<string, string> }) {
  const [users, setUsers] = useState<any[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [customerSummary, setCustomerSummary] = useState<any | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [form, setForm] = useState({
    userId: '',
    items: [{ name: '', type: 'giftcard', price: '', quantity: 1 }],
    totalUsd: '',
    totalMwk: ''
  });

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const data = await fetchAdminUsers(getAdminHeaders, {
          search: userSearch.trim() || undefined,
          limit: userSearch.trim() ? 100 : 5000,
        });
        if (!cancelled) setUsers(data);
      } catch (e) {
        console.error('Failed to load users:', e);
        if (!cancelled) setUsers([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, userSearch.trim() ? 300 : 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [getAdminHeaders, userSearch]);

  useEffect(() => {
    if (!form.userId) {
      setCustomerSummary(null);
      return;
    }
    let cancelled = false;
    setSummaryLoading(true);
    (async () => {
      try {
        const res = await fetch(`${getApiBase()}/users/admin/summary/${form.userId}`, {
          headers: getAdminHeaders() as HeadersInit,
        });
        if (!res.ok) throw new Error('Failed to load customer');
        const data = await res.json();
        if (!cancelled) setCustomerSummary(data);
      } catch {
        if (!cancelled) setCustomerSummary(null);
      } finally {
        if (!cancelled) setSummaryLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [form.userId, getAdminHeaders]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.userId) {
      alert('Please select a user from the list (signed-up members only)');
      return;
    }
    const items = form.items
      .filter(i => (i.name || '').trim() && (Number(i.price) || 0) > 0 && (Number(i.quantity) || 0) > 0)
      .map(i => ({ name: (i.name || '').trim(), type: i.type || 'giftcard', category: 'general', price: Number(i.price) || 0, quantity: Number(i.quantity) || 1 }));
    if (items.length === 0) {
      alert('Add at least one item with name, price > 0, and quantity > 0');
      return;
    }
    const totalUsd = Number(form.totalUsd);
    const totalMwk = Number(form.totalMwk);
    if (!totalUsd || totalUsd <= 0 || !totalMwk || totalMwk <= 0) {
      alert('Enter valid total USD and total MWK');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${getApiBase()}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAdminHeaders() } as HeadersInit,
        body: JSON.stringify({
          adminCreateForUser: true,
          userId: form.userId,
          items,
          totalUsd,
          totalMwk: Math.round(totalMwk)
        })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const msg = err?.error || (res.status === 401 ? 'Unauthorized. Check admin password.' : `Error ${res.status}`);
        throw new Error(msg);
      }
      alert('Order created successfully. It will appear in the user\'s order history.');
      setForm({ userId: '', items: [{ name: '', type: 'giftcard', price: '', quantity: 1 }], totalUsd: '', totalMwk: '' });
    } catch (err: any) {
      alert(err.message || 'Failed to create order');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="text-gray-400 py-4">Loading users...</div>;
  }

  return (
    <div className="card-dark p-6">
      <h3 className="text-lg font-bold text-white mb-2">Create order for a member</h3>
      <p className="text-gray-400 text-sm mb-4">Select a user from the list of signed-up members. The order will appear in their order history.</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-gray-300 mb-2">Member (signed-up users)</label>
          <input
            type="text"
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
            placeholder="Search by email, phone, or username…"
            className="w-full px-4 py-2 mb-2 bg-dark-bg border border-dark-border rounded-lg text-white"
          />
          <select
            value={form.userId}
            onChange={(e) => setForm(prev => ({ ...prev, userId: e.target.value }))}
            required
            className="w-full px-4 py-2 bg-dark-bg border border-dark-border rounded-lg text-white"
          >
            <option value="">— Select a user —</option>
            {users.map((u: any) => (
              <option key={u.id} value={u.id}>
                {u.name || u.email || u.id}
                {u.email ? ` · ${u.email}` : ''}
                {u.phone ? ` · ${u.phone}` : ''}
              </option>
            ))}
          </select>
          {summaryLoading && form.userId && (
            <p className="text-gray-500 text-sm mt-2">Loading customer details…</p>
          )}
          {customerSummary && (
            <div className="mt-3 p-3 rounded-lg border border-neon-blue/30 bg-dark-bg text-sm space-y-1">
              <div className="text-white font-semibold">{customerSummary.name || 'Customer'}</div>
              <div className="text-neon-blue">{customerSummary.email}</div>
              {customerSummary.phone && <div className="text-gray-300">Phone: {customerSummary.phone}</div>}
              <div className="text-gray-300">
                Wallet: <span className="text-amber-300">${Number(customerSummary.walletBalanceUsd || 0).toFixed(2)}</span>
                {' · '}
                Points: {(customerSummary.pointsBalance ?? 0).toLocaleString()}
                {' · '}
                Orders: {customerSummary.orderCount ?? 0}
              </div>
              {(customerSummary.city || customerSummary.country) && (
                <div className="text-gray-400 text-xs">
                  Location: {[customerSummary.city, customerSummary.region, customerSummary.country].filter(Boolean).join(', ')}
                </div>
              )}
              {Array.isArray(customerSummary.recentOrders) && customerSummary.recentOrders.length > 0 && (
                <div className="pt-2 border-t border-dark-border mt-2">
                  <div className="text-gray-400 text-xs mb-1">Recent orders</div>
                  {customerSummary.recentOrders.map((o: any) => (
                    <div key={o.id} className="text-xs text-gray-300">
                      #{o.id.slice(0, 8)} · {o.status} · ${Number(o.totalUsd || 0).toFixed(2)} ·{' '}
                      {new Date(o.createdAt).toLocaleDateString()}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {users.length === 0 && !loading && (
            <p className="text-gray-500 text-sm mt-1">
              {userSearch.trim() ? 'No users match your search.' : 'No signed-up users yet.'}
            </p>
          )}
          {!userSearch.trim() && users.length >= 5000 && (
            <p className="text-amber-300 text-xs mt-1">Showing first 5,000 users — search to find others.</p>
          )}
        </div>
        <div>
          <label className="block text-sm text-gray-300 mb-2">Items</label>
          {form.items.map((item, idx) => (
            <div key={idx} className="flex flex-wrap gap-2 mb-2 items-center">
              <input
                type="text"
                value={item.name}
                onChange={(e) => {
                  const next = [...form.items];
                  next[idx] = { ...next[idx], name: e.target.value };
                  setForm(prev => ({ ...prev, items: next }));
                }}
                placeholder="Item name"
                className="flex-1 min-w-[120px] px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-white text-sm"
              />
              <select
                value={item.type}
                onChange={(e) => {
                  const next = [...form.items];
                  next[idx] = { ...next[idx], type: e.target.value };
                  setForm(prev => ({ ...prev, items: next }));
                }}
                className="px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-white text-sm"
              >
                <option value="giftcard">giftcard</option>
                <option value="crypto">crypto</option>
                <option value="wallet">Digital wallet (payments)</option>
                <option value="virtual-card">Virtual card (payments)</option>
                <option value="other">other</option>
              </select>
              <input
                type="number"
                step="0.01"
                min="0"
                value={item.price}
                onChange={(e) => {
                  const next = [...form.items];
                  next[idx] = { ...next[idx], price: e.target.value };
                  setForm(prev => ({ ...prev, items: next }));
                }}
                placeholder="Price USD"
                className="w-24 px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-white text-sm"
              />
              <input
                type="number"
                min="1"
                value={item.quantity}
                onChange={(e) => {
                  const next = [...form.items];
                  next[idx] = { ...next[idx], quantity: Number(e.target.value) || 1 };
                  setForm(prev => ({ ...prev, items: next }));
                }}
                className="w-16 px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-white text-sm"
              />
              {form.items.length > 1 && (
                <button
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }))}
                  className="text-red-400 hover:text-red-300 text-sm"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() => setForm(prev => ({ ...prev, items: [...prev.items, { name: '', type: 'giftcard', price: '', quantity: 1 }] }))}
            className="text-sm text-neon-blue hover:text-neon-purple"
          >
            + Add item
          </button>
        </div>
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="block text-sm text-gray-300 mb-1">Total USD</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.totalUsd}
              onChange={(e) => setForm(prev => ({ ...prev, totalUsd: e.target.value }))}
              className="w-32 px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-white"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-1">Total MWK</label>
            <input
              type="number"
              min="0"
              value={form.totalMwk}
              onChange={(e) => setForm(prev => ({ ...prev, totalMwk: e.target.value }))}
              className="w-32 px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-white"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="px-4 py-2 rounded-lg bg-neon-purple text-white font-medium disabled:opacity-50"
        >
          {submitting ? 'Creating...' : 'Create order for user'}
        </button>
      </form>
    </div>
  );
}

function NotificationManager({ getAdminHeaders }: { getAdminHeaders: () => Record<string, string> }) {
  const [users, setUsers] = useState<any[]>([]);
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({
    userEmail: '',
    userId: '',
    sendToAll: false,
    type: 'admin_message',
    title: '',
    message: '',
    link: ''
  });

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const data = await fetchAdminUsers(getAdminHeaders, { limit: 5000 });
        setUsers(data);
      } catch (error) {
        console.error('Failed to load users:', error);
      }
    };
    loadUsers();
  }, [getAdminHeaders]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.sendToAll && !form.userEmail && !form.userId) {
      alert('Please select a user or choose "Send to All Users"');
      return;
    }
    if (!form.title || !form.message) {
      alert('Title and message are required');
      return;
    }

    setSending(true);
    try {
      const payload: any = {
        type: form.type,
        title: form.title,
        message: form.message,
        link: form.link || null
      };

      if (form.sendToAll) {
        payload.sendToAll = true;
      } else if (form.userId) {
        payload.userId = form.userId;
      } else if (form.userEmail) {
        payload.userEmail = form.userEmail;
      }

      const res = await fetch(`${getApiBase()}/notifications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAdminHeaders()
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const result = await res.json();
        alert(form.sendToAll 
          ? `Notification sent to ${result.count || 'all'} users!`
          : 'Notification sent successfully!'
        );
        setForm({
          userEmail: '',
          userId: '',
          sendToAll: false,
          type: 'admin_message',
          title: '',
          message: '',
          link: ''
        });
      } else {
        const error = await res.json();
        alert(`Failed to send notification: ${error.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error('Failed to send notification:', error);
      alert(`Failed to send notification: ${error.message || 'Unknown error'}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="card-dark p-6">
        <h3 className="text-lg font-bold text-white mb-4">Send Notification</h3>
        <form onSubmit={handleSend} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-300 mb-2">Send To</label>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="radio"
                  checked={form.sendToAll}
                  onChange={(e) => setForm({ ...form, sendToAll: e.target.checked, userEmail: '', userId: '' })}
                  className="mr-2"
                />
                <span className="text-gray-300">All Users</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  checked={!form.sendToAll}
                  onChange={(e) => setForm({ ...form, sendToAll: !e.target.checked })}
                  className="mr-2"
                />
                <span className="text-gray-300">Specific User</span>
              </label>
            </div>
          </div>

          {!form.sendToAll && (
            <div>
              <label className="block text-sm text-gray-300 mb-2">User Email</label>
              <input
                type="email"
                value={form.userEmail}
                onChange={(e) => {
                  const email = e.target.value;
                  const lower = email.trim().toLowerCase();
                  setForm({ ...form, userEmail: email, userId: '' });
                  const user = users.find((u) => u.email.trim().toLowerCase() === lower);
                  if (user) {
                    setForm((prev) => ({ ...prev, userId: user.id }));
                  }
                }}
                placeholder="user@example.com"
                className="w-full px-4 py-2 bg-dark-surface border border-dark-border rounded-lg text-white"
                list="user-emails"
              />
              <datalist id="user-emails">
                {users.map(user => (
                  <option key={user.id} value={user.email} />
                ))}
              </datalist>
            </div>
          )}

          <div>
            <label className="block text-sm text-gray-300 mb-2">Type</label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              className="w-full px-4 py-2 bg-dark-surface border border-dark-border rounded-lg text-white"
            >
              <option value="admin_message">Admin Message</option>
              <option value="stock_update">Stock Update</option>
              <option value="promotion">Promotion</option>
              <option value="system_announcement">System Announcement</option>
              <option value="order_update">Order Update</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-2">Title *</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g., New Stock Available!"
              required
              className="w-full px-4 py-2 bg-dark-surface border border-dark-border rounded-lg text-white"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-2">Message *</label>
            <textarea
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              placeholder="Enter notification message..."
              required
              rows={4}
              className="w-full px-4 py-2 bg-dark-surface border border-dark-border rounded-lg text-white"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-2">Link (Optional)</label>
            <input
              type="text"
              value={form.link}
              onChange={(e) => setForm({ ...form, link: e.target.value })}
              placeholder="e.g., /giftcards, /crypto"
              className="w-full px-4 py-2 bg-dark-surface border border-dark-border rounded-lg text-white"
            />
            <p className="text-xs text-gray-500 mt-1">Users will be redirected to this link when they click the notification</p>
          </div>

          <button
            type="submit"
            disabled={sending}
            className="w-full btn-cyber text-white py-3 rounded-lg font-bold disabled:opacity-50"
          >
            {sending ? 'Sending...' : form.sendToAll ? 'Send to All Users' : 'Send Notification'}
          </button>
        </form>
      </div>

      <div className="card-dark p-6">
        <h3 className="text-lg font-bold text-white mb-4">Quick Templates</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => setForm({
              ...form,
              type: 'stock_update',
              title: 'New Stock Available!',
              message: 'We have new products in stock! Check out our latest collection.',
              link: '/giftcards'
            })}
            className="p-4 bg-dark-surface border border-dark-border rounded-lg text-left hover:border-neon-blue transition-colors"
          >
            <div className="font-bold text-white mb-1">Stock Update</div>
            <div className="text-sm text-gray-400">Notify about new products</div>
          </button>
          <button
            onClick={() => setForm({
              ...form,
              type: 'promotion',
              title: 'Special Promotion!',
              message: 'Limited time offer! Get amazing discounts on selected items.',
              link: '/'
            })}
            className="p-4 bg-dark-surface border border-dark-border rounded-lg text-left hover:border-neon-blue transition-colors"
          >
            <div className="font-bold text-white mb-1">Promotion</div>
            <div className="text-sm text-gray-400">Announce special offers</div>
          </button>
          <button
            onClick={() => setForm({
              ...form,
              type: 'system_announcement',
              title: 'System Maintenance',
              message: 'We will be performing scheduled maintenance. Service may be temporarily unavailable.',
              link: '/'
            })}
            className="p-4 bg-dark-surface border border-dark-border rounded-lg text-left hover:border-neon-blue transition-colors"
          >
            <div className="font-bold text-white mb-1">System Announcement</div>
            <div className="text-sm text-gray-400">Important system updates</div>
          </button>
          <button
            onClick={() => setForm({
              ...form,
              type: 'admin_message',
              title: 'Custom Message',
              message: '',
              link: ''
            })}
            className="p-4 bg-dark-surface border border-dark-border rounded-lg text-left hover:border-neon-blue transition-colors"
          >
            <div className="font-bold text-white mb-1">Custom Message</div>
            <div className="text-sm text-gray-400">Create your own message</div>
          </button>
        </div>
      </div>
    </div>
  );
}


type SpinHistoryRow = {
  id: string;
  userId: string | null;
  type: string;
  title: string;
  message: string;
  createdAt: string;
  user: { id: string; email: string; name: string } | null;
};

type SpinPrizeAdmin = {
  id: string;
  label: string;
  rewardType: string;
  points: number;
  productId: string | null;
  prizeAmountUsd?: number | null;
  weight: number;
  sortOrder: number;
  active: boolean;
  segmentKind?: 'no_win' | 'points_fixed' | 'custom';
  editable?: boolean;
  locked?: boolean;
  product?: { id: string; name: string; type: string; category: string; priceUsd: number } | null;
};

function spinPrizeMeaningLabel(p: SpinPrizeAdmin): string {
  if (p.rewardType === 'no_win') return 'No win';
  if (p.rewardType === 'points') return `${p.points} TConnect points`;
  if (p.rewardType === 'product' && p.product?.name) {
    const usd = p.prizeAmountUsd;
    if (usd != null && Number(usd) > 0) return `${p.product.name} ($${Number(usd)} USD)`;
    return p.product.name;
  }
  return 'Prize';
}

type SpinProductWinRow = {
  id: string;
  userId: string;
  productId: string;
  prizeLabel: string;
  status: string;
  orderId?: string | null;
  createdAt: string;
  user: { id: string; email: string; name: string };
  product: { id: string; name: string; type: string; category: string; priceUsd: number };
};

function SpinAdminManager({ getAdminHeaders }: { getAdminHeaders: () => Record<string, string> }) {
  const [items, setItems] = useState<SpinHistoryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [grantUserId, setGrantUserId] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [adminUsers, setAdminUsers] = useState<Array<{ id: string; email: string; name: string | null }>>([]);
  const [grantCount, setGrantCount] = useState(1);
  const [filter, setFilter] = useState('');
  const [prizes, setPrizes] = useState<SpinPrizeAdmin[]>([]);
  const [products, setProducts] = useState<Array<{ id: string; name: string; type: string; category: string; priceUsd: number }>>([]);
  const [pendingWins, setPendingWins] = useState<SpinProductWinRow[]>([]);
  const [prizesLoading, setPrizesLoading] = useState(false);
  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${getApiBase()}/spin/admin/history?limit=300`, {
        headers: getAdminHeaders() as HeadersInit,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Failed to load spin history (${res.status})`);
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load spin history');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const data = await fetchAdminUsers(getAdminHeaders, { limit: 5000 });
      setAdminUsers(data);
    } catch {
      setAdminUsers([]);
    }
  };

  const loadPrizes = async () => {
    setPrizesLoading(true);
    try {
      const res = await fetch(`${getApiBase()}/spin/admin/prizes`, { headers: getAdminHeaders() as HeadersInit });
      const data = await res.json().catch(() => []);
      if (res.ok) setPrizes(Array.isArray(data) ? data : []);
    } catch {
      setPrizes([]);
    } finally {
      setPrizesLoading(false);
    }
  };

  const loadProducts = async () => {
    try {
      const res = await fetch(`${getApiBase()}/products`, { headers: getAdminHeaders() as HeadersInit });
      const data = await res.json().catch(() => []);
      if (res.ok) setProducts(Array.isArray(data) ? data : []);
    } catch {
      setProducts([]);
    }
  };

  const loadPendingWins = async () => {
    try {
      const res = await fetch(`${getApiBase()}/spin/admin/product-wins?status=pending&limit=100`, {
        headers: getAdminHeaders() as HeadersInit,
      });
      const data = await res.json().catch(() => []);
      if (res.ok) setPendingWins(Array.isArray(data) ? data : []);
    } catch {
      setPendingWins([]);
    }
  };

  useEffect(() => {
    load();
    loadUsers();
    loadPrizes();
    loadProducts();
    loadPendingWins();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return adminUsers;
    return adminUsers.filter(
      (u) =>
        u.email.toLowerCase().includes(q) ||
        (u.name || '').toLowerCase().includes(q)
    );
  }, [adminUsers, userSearch]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (r) =>
        r.message.toLowerCase().includes(q) ||
        r.user?.email?.toLowerCase().includes(q) ||
        r.user?.name?.toLowerCase().includes(q) ||
        r.type.toLowerCase().includes(q)
    );
  }, [items, filter]);

  const activeWheelPrizes = useMemo(
    () => [...prizes.filter((p) => p.active)].sort((a, b) => a.sortOrder - b.sortOrder),
    [prizes]
  );
  const wheelReady =
    activeWheelPrizes.length === 9 &&
    activeWheelPrizes.filter((p) => p.segmentKind === 'no_win' || p.rewardType === 'no_win').length === 2 &&
    activeWheelPrizes.filter((p) => p.segmentKind === 'points_fixed').length === 5 &&
    activeWheelPrizes.filter((p) => p.segmentKind === 'custom').length === 2;
  const noWinSlices = useMemo(
    () => activeWheelPrizes.filter((p) => p.segmentKind === 'no_win' || p.rewardType === 'no_win'),
    [activeWheelPrizes]
  );
  const fixedSlices = useMemo(
    () => activeWheelPrizes.filter((p) => p.segmentKind === 'points_fixed'),
    [activeWheelPrizes]
  );
  const customSlices = useMemo(
    () => activeWheelPrizes.filter((p) => p.segmentKind === 'custom'),
    [activeWheelPrizes]
  );

  const stats = useMemo(() => {
    const spins = items.filter((i) => i.type === 'spin_attempt');
    const grants = items.filter((i) => i.type === 'spin_grant' || i.type === 'spin_bonus');
    const uniqueSpinners = new Set(spins.map((s) => s.userId).filter(Boolean)).size;
    const pointsWon = spins.reduce((sum, row) => {
      const m = row.message.match(/(\d+)\s+points/i);
      return sum + (m ? Number(m[1]) : 0);
    }, 0);
    return {
      spinRows: spins.length,
      grantRows: grants.length,
      uniqueSpinners,
      pointsWon,
    };
  }, [items]);

  const grantBonusSpins = async () => {
    if (!grantUserId) {
      alert('Select a user from the list.');
      return;
    }
    const spins = Math.min(5, Math.max(1, Math.floor(Number(grantCount))));
    if (!Number.isFinite(spins)) {
      alert('Spins must be between 1 and 5.');
      return;
    }
    try {
      const res = await fetch(`${getApiBase()}/spin/admin/grant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAdminHeaders() } as HeadersInit,
        body: JSON.stringify({ userId: grantUserId, spins }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Failed to grant spins (${res.status})`);
      alert(`Granted ${spins} extra spin${spins > 1 ? 's' : ''}. The user was notified in-app.`);
      setGrantUserId('');
      await load();
      await loadUsers();
    } catch (err: any) {
      alert(err?.message || 'Failed to grant spins');
    }
  };

  const savePrize = async (p: SpinPrizeAdmin) => {
    try {
      const res = await fetch(`${getApiBase()}/spin/admin/prizes/${p.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...getAdminHeaders() } as HeadersInit,
        body: JSON.stringify({
          label: p.rewardType === 'no_win' ? '' : p.label,
          rewardType: p.rewardType,
          points: p.points,
          productId: p.productId,
          prizeAmountUsd: p.rewardType === 'product' ? p.prizeAmountUsd : null,
          weight: p.weight,
          sortOrder: p.sortOrder,
          active: p.active,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Save failed');
      await loadPrizes();
    } catch (e: any) {
      alert(e?.message || 'Failed to save prize');
    }
  };

  const reshuffleWheel = async () => {
    if (!window.confirm('Reshuffle wheel? Green positions and prize letters change. Your 2 custom prizes stay.')) return;
    try {
      const res = await fetch(`${getApiBase()}/spin/admin/apply-nine-wheel`, {
        method: 'POST',
        headers: getAdminHeaders() as HeadersInit,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed');
      alert('Wheel reshuffled. Users will see the new layout.');
      await loadPrizes();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed');
    }
  };

  const fulfillWin = async (id: string) => {
    try {
      const res = await fetch(`${getApiBase()}/spin/admin/product-wins/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...getAdminHeaders() } as HeadersInit,
        body: JSON.stringify({ status: 'fulfilled' }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Update failed');
      }
      await loadPendingWins();
      await load();
    } catch (e: any) {
      alert(e?.message || 'Failed to mark fulfilled');
    }
  };

  const rowKind = (type: string) => {
    if (type === 'spin_grant' || type === 'spin_bonus') return 'Bonus grant';
    if (type === 'spin_attempt') return 'Spin';
    return type;
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-lg border border-dark-border bg-dark-surface p-4">
          <p className="text-xs text-gray-400 mb-1">Spins in list</p>
          <p className="text-2xl font-bold text-white">{stats.spinRows}</p>
        </div>
        <div className="rounded-lg border border-dark-border bg-dark-surface p-4">
          <p className="text-xs text-gray-400 mb-1">Unique players</p>
          <p className="text-2xl font-bold text-neon-blue">{stats.uniqueSpinners}</p>
        </div>
        <div className="rounded-lg border border-dark-border bg-dark-surface p-4">
          <p className="text-xs text-gray-400 mb-1">Points won (from messages)</p>
          <p className="text-2xl font-bold text-green-400">{stats.pointsWon}</p>
        </div>
        <div className="rounded-lg border border-dark-border bg-dark-surface p-4">
          <p className="text-xs text-gray-400 mb-1">Bonus grant events</p>
          <p className="text-2xl font-bold text-purple-300">{stats.grantRows}</p>
        </div>
      </div>

      <div className="rounded-xl border border-dark-border bg-dark-surface p-4 space-y-3">
        <h3 className="text-white font-semibold">Grant extra spins (today)</h3>
        <p className="text-sm text-gray-400">
          Base limit is 1 spin per day. Choose a user below and grant up to 5 bonus spins â€” they receive an in-app notification immediately.
        </p>
        <input
          value={userSearch}
          onChange={(e) => setUserSearch(e.target.value)}
          placeholder="Search users by email or nameâ€¦"
          className="w-full max-w-md px-3 py-2 rounded-lg bg-dark-bg border border-dark-border text-white text-sm focus:border-neon-blue focus:outline-none"
        />
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
          <div className="flex-1 min-w-0">
            <label className="block text-xs text-gray-400 mb-1">Select user</label>
            <select
              value={grantUserId}
              onChange={(e) => setGrantUserId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-dark-bg border border-dark-border text-white text-sm focus:border-neon-blue focus:outline-none"
            >
              <option value="">â€” Choose user â€”</option>
              {filteredUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.email} {u.name ? `(${u.name})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="w-full sm:w-28">
            <label className="block text-xs text-gray-400 mb-1">Spins (1â€“5)</label>
            <input
              type="number"
              min={1}
              max={5}
              value={grantCount}
              onChange={(e) => setGrantCount(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg bg-dark-bg border border-dark-border text-white text-sm focus:border-neon-blue focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={grantBonusSpins}
            className="px-4 py-2 rounded-lg bg-neon-blue text-white font-semibold hover:opacity-90"
          >
            Grant spins
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-neon-blue/30 bg-dark-surface p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-white font-semibold">Wheel prizes</h3>
          <button
            type="button"
            onClick={() => {
              loadPrizes();
              loadProducts();
            }}
            disabled={prizesLoading}
            className="text-sm cyber-border text-neon-blue px-3 py-1 rounded"
          >
            {prizesLoading ? 'Loadingâ€¦' : 'Reload'}
          </button>
        </div>
        <p className="text-sm text-gray-400">
          <strong className="text-gray-300">9 slices:</strong> 2 green no-win (no letter, random spots), 5 fixed points
          (325, 162, 82, 1, 10), 2 prizes you edit below.
        </p>
        {!wheelReady && <p className="text-sm text-amber-300">Wheel not ready — click Reshuffle.</p>}
        <button
          type="button"
          onClick={reshuffleWheel}
          className="text-sm px-4 py-2 rounded-lg bg-amber-600/30 border border-amber-500/50 text-amber-200 font-semibold"
        >
          Reshuffle wheel (green spots + letters)
        </button>

        <div className="rounded-lg border border-green-600/40 bg-green-950/20 p-3">
          <h4 className="text-green-400 text-sm font-semibold mb-2">Green — No win (locked)</h4>
          <ul className="text-xs text-gray-300 space-y-1">
            {noWinSlices.map((p) => (
              <li key={p.id}>Position #{p.sortOrder + 1} · weight {p.weight}</li>
            ))}
          </ul>
        </div>

        <div className="rounded-lg border border-dark-border bg-dark-bg/40 p-3">
          <h4 className="text-gray-300 text-sm font-semibold mb-2">Fixed points (locked)</h4>
          <table className="w-full text-xs">
            <tbody>
              {fixedSlices.map((p) => (
                <tr key={p.id}>
                  <td className="py-1 pr-3 text-gray-400">#{p.sortOrder + 1}</td>
                  <td className="py-1 pr-3 font-black text-amber-300">{p.label}</td>
                  <td className="py-1 text-white">{p.points} pts</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded-lg border border-neon-blue/40 p-3">
          <h4 className="text-neon-blue text-sm font-semibold mb-2">Your 2 prizes (edit + Save)</h4>
          <div className="overflow-x-auto rounded-lg border border-dark-border">
          <table className="w-full text-sm">
            <thead className="bg-dark-bg text-gray-400 text-xs text-left">
              <tr>
                <th className="px-2 py-2">#</th>
                <th className="px-2 py-2">Letter</th>
                <th className="px-2 py-2">Type</th>
                <th className="px-2 py-2">Prize</th>
                <th className="px-2 py-2">Weight</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-border">
              {customSlices.map((p) => (
                <tr key={p.id} className="bg-dark-bg/40">
                  <td className="px-2 py-2 text-gray-400 text-xs">{p.sortOrder + 1}</td>
                  <td className="px-2 py-2">
                    <input
                      value={p.label}
                      maxLength={2}
                      onChange={(e) =>
                        setPrizes((prev) =>
                          prev.map((x) =>
                            x.id === p.id
                              ? {
                                  ...x,
                                  label: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 2),
                                }
                              : x
                          )
                        )
                      }
                      className="w-12 px-2 py-1 rounded bg-dark-bg border border-dark-border text-white text-xs text-center font-black"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <select
                      value={p.rewardType}
                      onChange={(e) => {
                        const rt = e.target.value;
                        setPrizes((prev) =>
                          prev.map((x) =>
                            x.id === p.id
                              ? {
                                  ...x,
                                  rewardType: rt,
                                  points: rt === 'points' ? x.points || 25 : 0,
                                  productId: rt === 'product' ? x.productId : null,
                                }
                              : x
                          )
                        );
                      }}
                      className="max-w-[120px] px-2 py-1 rounded bg-dark-bg border border-dark-border text-white text-xs"
                    >
                      <option value="points">Points</option>
                      <option value="product">Product</option>
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    {p.rewardType === 'points' && (
                      <input
                        type="number"
                        min={1}
                        value={p.points || 0}
                        onChange={(e) =>
                          setPrizes((prev) =>
                            prev.map((x) =>
                              x.id === p.id ? { ...x, points: Math.max(0, Number(e.target.value)) } : x
                            )
                          )
                        }
                        className="w-20 px-2 py-1 rounded bg-dark-bg border border-dark-border text-white text-xs"
                      />
                    )}
                    {p.rewardType === 'product' && (
                      <div className="flex flex-wrap gap-1 items-center">
                        <select
                          value={p.productId || ''}
                          onChange={(e) =>
                            setPrizes((prev) =>
                              prev.map((x) =>
                                x.id === p.id ? { ...x, productId: e.target.value || null } : x
                              )
                            )
                          }
                          className="max-w-[160px] px-2 py-1 rounded bg-dark-bg border border-dark-border text-white text-xs"
                        >
                          <option value="">— product —</option>
                          {products.map((pr) => (
                            <option key={pr.id} value={pr.id}>
                              {pr.name}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min={0.01}
                          step={0.01}
                          title="Prize amount in USD"
                          value={p.prizeAmountUsd ?? ''}
                          onChange={(e) =>
                            setPrizes((prev) =>
                              prev.map((x) =>
                                x.id === p.id
                                  ? {
                                      ...x,
                                      prizeAmountUsd:
                                        e.target.value === '' ? null : Math.max(0, Number(e.target.value)),
                                    }
                                  : x
                              )
                            )
                          }
                          placeholder="USD"
                          className="w-16 px-2 py-1 rounded bg-dark-bg border border-amber-500/40 text-amber-100 text-xs"
                        />
                      </div>
                    )}
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="number"
                      min={0}
                      value={p.weight}
                      onChange={(e) =>
                        setPrizes((prev) =>
                          prev.map((x) =>
                            x.id === p.id ? { ...x, weight: Math.max(0, Number(e.target.value)) } : x
                          )
                        )
                      }
                      className="w-14 px-2 py-1 rounded bg-dark-bg border border-dark-border text-white text-xs"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <button type="button" onClick={() => savePrize(p)} className="text-xs text-neon-blue font-semibold">
                      Save
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-dark-border bg-dark-surface p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-white font-semibold">Pending product prizes</h3>
          <button type="button" onClick={loadPendingWins} className="text-sm cyber-border text-gray-300 px-3 py-1 rounded">
            Refresh
          </button>
        </div>
        <p className="text-sm text-gray-400">
          Product wins also create a <strong className="text-gray-300">pending order</strong> in Orders (when claimed or instant).
          Fulfill the order there (codes / card details). Use this list for spin-only tracking.
        </p>
        {pendingWins.length === 0 ? (
          <p className="text-gray-500 text-sm">No pending product wins.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-dark-border">
            <table className="w-full text-sm text-left">
              <thead className="bg-dark-bg text-gray-400 text-xs">
                <tr>
                  <th className="px-3 py-2">When</th>
                  <th className="px-3 py-2">User</th>
                  <th className="px-3 py-2">Product</th>
                  <th className="px-3 py-2">Prize label</th>
                  <th className="px-3 py-2">Order</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-border">
                {pendingWins.map((w) => (
                  <tr key={w.id} className="bg-dark-bg/30">
                    <td className="px-3 py-2 text-gray-300 whitespace-nowrap">
                      {new Date(w.createdAt).toLocaleString()}
                    </td>
                    <td className="px-3 py-2">
                      <div className="text-white">{w.user.email}</div>
                      <div className="text-xs text-gray-500">{w.user.name}</div>
                    </td>
                    <td className="px-3 py-2 text-gray-200">
                      {w.product.name}{' '}
                      <span className="text-gray-500 text-xs">
                        ({w.product.type})
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-300">{w.prizeLabel}</td>
                    <td className="px-3 py-2 text-xs font-mono text-sky-300">
                      {w.orderId ? `#${w.orderId.slice(0, 8)}` : 'Awaiting claim'}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => fulfillWin(w.id)}
                        className="text-xs px-2 py-1 rounded bg-green-600/30 text-green-300 border border-green-500/40"
                      >
                        Mark fulfilled
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search email, name, or message..."
          className="w-full sm:max-w-md px-3 py-2 rounded-lg bg-dark-surface border border-dark-border text-white text-sm focus:border-neon-blue focus:outline-none"
        />
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="cyber-border text-neon-blue px-4 py-2 rounded-lg text-sm hover:bg-neon-blue/10 disabled:opacity-50"
        >
          {loading ? 'Refreshingâ€¦' : 'Refresh history'}
        </button>
      </div>

      {error && (
        <div className="bg-red-400/20 border border-red-400/50 rounded-lg p-3 text-red-400 text-sm">{error}</div>
      )}

      {loading && items.length === 0 ? (
        <p className="text-gray-400 text-center py-8">Loading spin activityâ€¦</p>
      ) : filtered.length === 0 ? (
        <p className="text-gray-400 text-center py-8">No spin activity loaded yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-dark-border">
          <table className="w-full text-sm text-left">
            <thead className="bg-dark-bg text-gray-400 text-xs uppercase">
              <tr>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Activity</th>
                <th className="px-4 py-3">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-border">
              {filtered.map((row) => (
                <tr key={row.id} className="bg-dark-surface/80 hover:bg-dark-card/60">
                  <td className="px-4 py-3 text-gray-300 whitespace-nowrap">
                    {new Date(row.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-white font-medium">{row.user?.email || 'â€”'}</div>
                    {row.user?.name && <div className="text-gray-500 text-xs">{row.user.name}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${
                        row.type === 'spin_grant'
                          ? 'bg-purple-500/20 text-purple-300'
                          : 'bg-cyan-500/20 text-cyan-300'
                      }`}
                    >
                      {rowKind(row.type)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-300 max-w-md">{row.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-gray-500">
        Showing up to 300 recent events (spins, bonus grants, and notifications). Bonus spins from admin send one in-app notification per grant.
      </p>
    </div>
  );
}

function ReceiptsManager({ getAdminHeaders }: { getAdminHeaders: () => Record<string, string> }) {
  const [receipts, setReceipts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const loadReceipts = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${getApiBase()}/users/receipts`, { headers: getAdminHeaders() as HeadersInit });
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          throw new Error(text || `Failed to fetch receipts (${res.status})`);
        }
        const data = await res.json();
        setReceipts(Array.isArray(data) ? data : []);
      } catch (err: any) {
        setError(err.message || 'Failed to load receipts');
        console.error('Error loading receipts:', err);
      } finally {
        setLoading(false);
      }
    };
    loadReceipts();
  }, [getAdminHeaders]);

  const filteredReceipts = useMemo(() => {
    if (!searchTerm) return receipts;
    const term = searchTerm.toLowerCase();
    return receipts.filter((r: any) =>
      r.receiptId?.toLowerCase().includes(term) ||
      r.customerName?.toLowerCase().includes(term) ||
      r.email?.toLowerCase().includes(term) ||
      r.user?.email?.toLowerCase().includes(term) ||
      r.user?.name?.toLowerCase().includes(term)
    );
  }, [receipts, searchTerm]);

  const handleVerify = async (receiptId: string, verified: boolean) => {
    try {
      const res = await fetch(`${getApiBase()}/users/receipts/${receiptId}/verify`, {
        method: 'PATCH',
        headers: { ...getAdminHeaders(), 'Content-Type': 'application/json' } as HeadersInit,
        body: JSON.stringify({ verified })
      });
      if (!res.ok) throw new Error('Failed to update receipt');
      const updated = await res.json();
      setReceipts((prev) => prev.map((r) => (r.id === receiptId ? updated : r)));
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  if (loading) {
    return <div className="text-center py-8 text-gray-400">Loading receipts...</div>;
  }

  if (error) {
    return <div className="text-center py-8 text-red-400">Error: {error}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <input
          type="text"
          placeholder="Search by receipt ID, name, or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 px-4 py-2 bg-dark-surface border border-dark-border rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-neon-blue focus:border-neon-blue"
        />
        <div className="text-sm text-gray-400">
          Total Receipts: <span className="text-white font-bold">{receipts.length}</span>
        </div>
      </div>

      {filteredReceipts.length === 0 ? (
        <div className="text-center py-8 text-gray-400">No receipts found</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-dark-surface border-b border-dark-border">
                <th className="px-4 py-3 text-left text-sm font-semibold text-white">Receipt ID</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-white">Customer</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-white">Email</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-white">Points</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-white">USD Value</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-white">Order</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-white">Status</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-white">Created</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-white">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredReceipts.map((receipt: any) => (
                <tr key={receipt.id} className="border-b border-dark-border hover:bg-dark-surface/50">
                  <td className="px-4 py-3 text-sm text-gray-300 font-mono">{receipt.receiptId}</td>
                  <td className="px-4 py-3 text-sm text-white">{receipt.customerName}</td>
                  <td className="px-4 py-3 text-sm text-gray-300">{receipt.email}</td>
                  <td className="px-4 py-3 text-sm text-neon-green font-bold">{receipt.points.toLocaleString()}</td>
                  <td className="px-4 py-3 text-sm text-white">${receipt.usdValue.toFixed(2)}</td>
                  <td className="px-4 py-3 text-sm">
                    {receipt.order ? (
                      <span className="text-neon-blue">#{receipt.order.id.substring(0, 8)}</span>
                    ) : (
                      <span className="text-gray-500">Not used</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                      receipt.verified
                        ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                        : receipt.order
                        ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50'
                        : 'bg-gray-500/20 text-gray-400 border border-gray-500/50'
                    }`}>
                      {receipt.verified ? 'Verified' : receipt.order ? 'In Order' : 'Pending'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400">
                    {new Date(receipt.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {!receipt.verified && (
                      <button
                        onClick={() => handleVerify(receipt.id, true)}
                        className="px-3 py-1 bg-neon-green/20 text-neon-green border border-neon-green/50 rounded hover:bg-neon-green/30 text-xs font-semibold"
                      >
                        Verify
                      </button>
                    )}
                    {receipt.verified && (
                      <button
                        onClick={() => handleVerify(receipt.id, false)}
                        className="px-3 py-1 bg-red-500/20 text-red-400 border border-red-500/50 rounded hover:bg-red-500/30 text-xs font-semibold"
                      >
                        Unverify
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default Admin;

function ProductManager({ getAdminHeaders }: { getAdminHeaders: () => Record<string, string> }) {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [redeemInfo, setRedeemInfo] = useState('');
  const [form, setForm] = useState({
    name: '',
    category: '',
    type: 'giftcard',
    priceUsd: GIFTCARD_ADMIN_MIN_USD,
    image: '',
    description: '',
    inStock: true,
    featured: false,
    popular: false,
  });
  
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
      redeemInstructions = `How to Redeem Your ${cardName} Gift Card:\n\n1. Log in to your ${cardName} account or create a new account.\n2. Go to "Your Account" â†’ "Gift Cards" or "Payment Methods".\n3. Click on "Redeem a Gift Card" or "Apply Gift Card Balance".\n4. Enter the gift card code you received after purchase.\n5. Click "Apply to Your Balance" or "Add to Account".\n6. Your gift card balance will be added to your account instantly.\n7. You can use this balance during checkout for any purchase on ${cardName}.\n\nNote: Gift card codes are delivered instantly via email after payment confirmation. You can check your balance anytime in your account settings.`;
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
      console.log('ðŸ“¦ [Admin] Loading products from:', `${getApiBase()}/products`);
      const res = await fetch(`${getApiBase()}/products`);
      console.log('ðŸ“¥ [Admin] Products response status:', res.status);
      
      if (!res.ok) {
        throw new Error(`Failed to fetch products: ${res.status} ${res.statusText}`);
      }
      
      const data = await res.json();
      console.log('âœ… [Admin] Products loaded:', Array.isArray(data) ? data.length : 'not an array', data);
      
      if (Array.isArray(data)) {
        setProducts(data);
      } else {
        console.error('âŒ [Admin] Products data is not an array:', data);
        setProducts([]);
      }
    } catch (error: any) {
      console.error('âŒ [Admin] Error loading products:', error);
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

  const isSupabaseQuotaError = (msg: string) =>
    /exceed_cached_egress_quota|restricted.*violation|violations/i.test(msg);

  const uploadImage = async (): Promise<string | null> => {
    if (!imageFile) return null;
    setUploading(true);
    try {
      const fileExt = imageFile.name.split('.').pop();
      const fileName = `products/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const { data, error } = await supabase.storage.from('products').upload(fileName, imageFile, { upsert: false });
      if (error) {
        console.error('Supabase storage error:', error);
        if (isSupabaseQuotaError(error.message)) {
          alert(`Supabase quota exceeded. Upload is temporarily unavailable.\n\nUse "Image URL" below instead: paste a direct image link (e.g. from Imgur, or your own CDN). You can also contact Supabase support: https://supabase.help`);
        } else if (error.message.includes('Bucket') || error.message.includes('not found')) {
          alert(`Error: The 'products' bucket doesn't exist in Supabase Storage. Please create a public bucket named 'products' in your Supabase dashboard.`);
        } else if (error.message.includes('row-level security') || error.message.includes('RLS')) {
          alert(`Error: Storage policy blocking upload. Go to Supabase Dashboard â†’ Storage â†’ products bucket â†’ Policies â†’ Create a policy allowing INSERT for public or authenticated users.`);
        } else {
          alert(`Failed to upload image: ${error.message}`);
        }
        return null;
      }
      const { data: pub } = supabase.storage.from('products').getPublicUrl(data.path);
      return pub.publicUrl;
    } catch (error: any) {
      const msg = error?.message || '';
      if (isSupabaseQuotaError(msg)) {
        alert(`Supabase quota exceeded. Use "Image URL" in the form instead of uploading, or contact Supabase: https://supabase.help`);
      } else {
        alert(`Failed to upload image: ${msg || 'Unknown error'}. You can use "Image URL" instead of uploading.`);
      }
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
      // Image required for giftcards and virtual cards: either file upload OR image URL
      const hasImageUrl = form.image && String(form.image).trim().startsWith('http');
      if ((form.type === 'giftcard' || form.type === 'virtual-card') && !imageFile && !hasImageUrl) {
        alert('Please add an image: upload a file OR paste an Image URL (e.g. direct link to an image).');
        return;
      }
    }
    
    // Price validation: crypto has no catalog USD; gift cards & virtual cards use $1–$1000 suggested default
    if (form.type === 'giftcard' || form.type === 'virtual-card') {
      if (!isGiftCardAdminPriceValid(form.priceUsd)) {
        alert(
          `For ${form.type === 'virtual-card' ? 'virtual cards' : 'gift cards'}, enter a suggested default USD amount between $${GIFTCARD_ADMIN_MIN_USD} and $${GIFTCARD_ADMIN_MAX_USD}. Customers choose their own amount ($1–$1000) at checkout.`
        );
        return;
      }
    } else if (form.type !== 'crypto' && form.priceUsd <= 0) {
      alert('Please enter a valid price');
      return;
    }
    setUploading(true);
    try {
      let imageUrl = (form.image && String(form.image).trim().startsWith('http') ? form.image.trim() : '') || '';
      
      // Upload image only when user selected a file (not when using Image URL)
      if ((form.type === 'giftcard' || form.type === 'virtual-card') && imageFile) {
        console.log('Starting image upload...');
        const uploaded = await uploadImage();
        if (uploaded) imageUrl = uploaded;
        if (!imageUrl) {
          console.error('Image upload failed');
          setUploading(false);
          return;
        }
        if (uploaded) console.log('Image uploaded successfully:', imageUrl);
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
      
      setForm({
        name: '',
        category: '',
        type: form.type,
        priceUsd: form.type === 'giftcard' ? GIFTCARD_ADMIN_MIN_USD : 0,
        image: '',
        description: '',
        inStock: true,
        featured: false,
        popular: false,
      });
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
  const deleteProduct = async (id: string) => {
    try {
      const headers = getHeaders();
      const res = await fetch(`${getApiBase()}/products/${id}`, {
        method: 'DELETE',
        headers: headers as HeadersInit
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Server error: ${res.status}`);
      }
      await load();
      alert('Product deleted successfully');
    } catch (error: any) {
      console.error('Failed to delete product:', error);
      alert(`Failed to delete product: ${error.message || 'Unknown error'}`);
    }
  };

  const toggle = async (p: any, field: 'inStock'|'featured'|'popular') => {
    const body = { [field]: !p[field] } as any;
    await fetch(`${getApiBase()}/products/${p.id}`, { method: 'PUT', headers: getHeaders(), body: JSON.stringify(body) });
    await load();
  };

  const requiresImage = form.type === 'giftcard' || form.type === 'virtual-card';
  const requiresDetails = form.type === 'giftcard' || form.type === 'virtual-card' || form.type === 'wallet';
  const requiresRedeem = form.type === 'giftcard';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="px-4 py-2 rounded-lg bg-neon-blue text-white font-medium text-sm disabled:opacity-50"
        >
          {loading ? 'Refreshing…' : 'Refresh Products'}
        </button>
        <span className="text-sm text-gray-400">{products.length} product(s) loaded</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <select
          value={form.type}
          onChange={(e) => {
            const t = e.target.value;
            setForm((prev) => ({
              ...prev,
              type: t,
              category: '',
              name: '',
              priceUsd:
                (t === 'giftcard' || t === 'virtual-card') &&
                (!prev.priceUsd || prev.priceUsd < GIFTCARD_ADMIN_MIN_USD)
                  ? GIFTCARD_ADMIN_MIN_USD
                  : prev.priceUsd,
            }));
          }}
          className="px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white"
        >
          <option value="giftcard">Gift Card</option>
          <option value="crypto">Crypto</option>
          <option value="wallet">Digital wallets (payments)</option>
          <option value="virtual-card">Virtual cards (payments)</option>
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
          <div className="flex flex-col gap-1">
            <span className="text-gray-400 text-xs">
              {form.type === 'giftcard' || form.type === 'virtual-card'
                ? `Suggested default (USD): $${GIFTCARD_ADMIN_MIN_USD}–$${GIFTCARD_ADMIN_MAX_USD} · Customers pick $1–$1000 at checkout`
                : 'Price USD'}
            </span>
            <input
              type="number"
              min={form.type === 'giftcard' || form.type === 'virtual-card' ? GIFTCARD_ADMIN_MIN_USD : undefined}
              max={form.type === 'giftcard' || form.type === 'virtual-card' ? GIFTCARD_ADMIN_MAX_USD : undefined}
              step={form.type === 'giftcard' || form.type === 'virtual-card' ? 0.01 : 1}
              value={form.priceUsd || ''}
              onChange={(e) => setForm({ ...form, priceUsd: parseFloat(e.target.value) || 0 })}
              placeholder={
                form.type === 'giftcard' || form.type === 'virtual-card' ? 'Default amount (USD)' : 'Price USD'
              }
              className="px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white"
            />
          </div>
        )}
        
        {requiresImage && (
          <div className="md:col-span-2 space-y-3">
            <label className="block text-white text-sm font-medium">Product Image (required: upload file OR paste URL)</label>
            <input 
              type="url" 
              value={form.image} 
              onChange={(e) => setForm({ ...form, image: e.target.value })} 
              placeholder="Image URL (e.g. https://... if upload is unavailable)"
              className="block w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white placeholder-gray-500"
            />
            <div className="text-gray-400 text-xs">Or upload a file:</div>
            <input 
              type="file" 
              accept="image/*" 
              onChange={handleImageChange}
              className="block w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-neon-blue file:text-white hover:file:bg-neon-blue/80 file:cursor-pointer" 
            />
            {(imagePreview || (form.image && form.image.trim().startsWith('http'))) && (
              <div className="mt-3">
                <img src={imagePreview || form.image} alt="Preview" className="h-24 w-auto rounded-lg border border-dark-border object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
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
        disabled={uploading || (requiresImage && !imageFile && !(form.image && String(form.image).trim().startsWith('http')))} 
        className={`btn-cyber text-white px-6 py-3 rounded-lg ${(uploading || (requiresImage && !imageFile && !(form.image && String(form.image).trim().startsWith('http')))) ? 'opacity-50 cursor-not-allowed' : ''}`}
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
                    {p.type === 'giftcard'
                      ? `${p.type || 'unknown'} â€¢ ${p.category || 'uncategorized'} â€¢ ref. default $${p.priceUsd ?? 0} Â· buyer chooses $0â€“1000`
                      : `${p.type || 'unknown'} â€¢ ${p.category || 'uncategorized'} â€¢ $${p.priceUsd || 0}`}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      if (window.confirm(`Are you sure you want to delete "${p.name}"? This action cannot be undone.`)) {
                        deleteProduct(p.id);
                      }
                    }}
                    className="px-3 py-1 text-red-400 border border-red-400/30 rounded text-sm hover:bg-red-400/10 transition-colors"
                  >
                    Delete
                  </button>
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
  const [rates, setRates] = useState<any[]>([]);

  useEffect(() => {
    loadRates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadRates = async () => {
    try {
      const res = await fetch(`${getApiBase()}/rates`, { headers: getAdminHeaders() as HeadersInit });
      if (res.ok) {
        const data = await res.json();
        setRates(data);
      }
    } catch (error) {
      console.error('Failed to load rates:', error);
    } finally {
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${getApiBase()}/rates`, { 
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
        await loadRates(); // Reload rates to update chart
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

  // Prepare chart data
  const prepareChartData = () => {
    const dateMap: Record<string, { giftcard?: number; crypto?: number; wallet?: number; store_wallet?: number }> = {};
    
    rates.forEach((rate: any) => {
      const date = new Date(rate.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (!dateMap[date]) {
        dateMap[date] = {};
      }
      const rateType = rate.type as 'giftcard' | 'crypto' | 'wallet' | 'store_wallet';
      if (rateType === 'giftcard' || rateType === 'crypto' || rateType === 'wallet' || rateType === 'store_wallet') {
        dateMap[date][rateType] = rate.value;
      }
    });

    const sortedDates = Object.keys(dateMap).sort((a, b) => {
      return new Date(a).getTime() - new Date(b).getTime();
    });

    const chartData: any[] = [];
    let lastGiftcard: number | null = null;
    let lastCrypto: number | null = null;
    let lastWallet: number | null = null;
    let lastStoreWallet: number | null = null;

    sortedDates.forEach(date => {
      const dayData = dateMap[date];
      lastGiftcard = dayData.giftcard ?? lastGiftcard;
      lastCrypto = dayData.crypto ?? lastCrypto;
      lastWallet = dayData.wallet ?? lastWallet;
      lastStoreWallet = dayData.store_wallet ?? lastStoreWallet;

      chartData.push({
        date,
        giftcard: lastGiftcard,
        crypto: lastCrypto,
        wallet: lastWallet,
        store_wallet: lastStoreWallet,
      });
    });

    return chartData;
  };

  const chartData = prepareChartData();

  // Get current rates
  const getCurrentRate = (rateType: string) => {
    const typeRates = rates.filter((r: any) => r.type === rateType).sort((a: any, b: any) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    return typeRates.length > 0 ? typeRates[0].value : 0;
  };

  return (
    <div className="space-y-6">
      {/* Add Rate Form */}
      <div className="card-dark p-6 rounded-xl">
        <h3 className="text-xl font-bold text-white mb-4">Add New Rate</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <select value={type} onChange={(e) => setType(e.target.value)} className="px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white">
            <option value="giftcard">Gift Card</option>
            <option value="crypto">Cryptocurrency</option>
            <option value="wallet">Payments (digital wallets + virtual cards)</option>
            <option value="store_wallet">Store Wallet (top-up & balance MWK)</option>
          </select>
          <input type="number" value={value || ''} onChange={(e) => setValue(parseInt(e.target.value || '0', 10))} placeholder="MWK per USD" className="px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white" />
          <button disabled={saving} onClick={save} className="btn-cyber text-white px-6 py-3 rounded-lg">{saving ? 'Saving...' : 'Save Rate'}</button>
        </div>
        <p className="text-gray-400 text-sm mt-2">New entries become the latest rate for that type.</p>
      </div>

      {/* Current Rates */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card-dark p-4 rounded-xl">
          <div className="text-sm text-gray-400 mb-1">Gift Cards</div>
          <div className="text-2xl font-bold text-white">{getCurrentRate('giftcard').toLocaleString()} MWK/$1</div>
        </div>
        <div className="card-dark p-4 rounded-xl">
          <div className="text-sm text-gray-400 mb-1">Cryptocurrency</div>
          <div className="text-2xl font-bold text-white">{getCurrentRate('crypto').toLocaleString()} MWK/$1</div>
        </div>
        <div className="card-dark p-4 rounded-xl">
          <div className="text-sm text-gray-400 mb-1">Payments (digital wallets + virtual cards)</div>
          <div className="text-2xl font-bold text-white">{getCurrentRate('wallet').toLocaleString()} MWK/$1</div>
        </div>
        <div className="card-dark p-4 rounded-xl border border-amber-500/30">
          <div className="text-sm text-amber-200/90 mb-1">Store Wallet (account top-up)</div>
          <div className="text-2xl font-bold text-amber-300">{getCurrentRate('store_wallet').toLocaleString()} MWK/$1</div>
          <p className="text-xs text-gray-500 mt-1">Lower rate = cheaper top-up for customers</p>
        </div>
      </div>

      {/* Rate History Chart */}
      {chartData.length > 0 && (
        <div className="card-dark p-6 rounded-xl">
          <h3 className="text-xl font-bold text-white mb-4">Rate History Chart</h3>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis 
                dataKey="date" 
                stroke="#9CA3AF"
                style={{ fontSize: '12px' }}
              />
              <YAxis 
                stroke="#9CA3AF"
                style={{ fontSize: '12px' }}
                label={{ value: 'MWK per $1', angle: -90, position: 'insideLeft', style: { fill: '#9CA3AF' } }}
              />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                labelStyle={{ color: '#fff' }}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="giftcard" 
                stroke="#a855f7" 
                strokeWidth={2}
                name="Gift Cards"
                dot={{ fill: '#a855f7', r: 4 }}
              />
              <Line 
                type="monotone" 
                dataKey="crypto" 
                stroke="#eab308" 
                strokeWidth={2}
                name="Cryptocurrency"
                dot={{ fill: '#eab308', r: 4 }}
              />
              <Line 
                type="monotone" 
                dataKey="wallet" 
                stroke="#3b82f6" 
                strokeWidth={2}
                name="Payments (wallets)"
                dot={{ fill: '#3b82f6', r: 4 }}
              />
              <Line 
                type="monotone" 
                dataKey="store_wallet" 
                stroke="#f59e0b" 
                strokeWidth={2}
                name="Store Wallet"
                dot={{ fill: '#f59e0b', r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function adminOrderItemMeta(item: any): Record<string, any> {
  if (!item?.metadata) return {};
  try {
    const m = typeof item.metadata === 'string' ? JSON.parse(item.metadata) : item.metadata;
    return m && typeof m === 'object' && !Array.isArray(m) ? m : {};
  } catch {
    return {};
  }
}

function adminOrderItemHasCodes(item: any): boolean {
  if (!item?.giftCardCodes) return false;
  try {
    const c = typeof item.giftCardCodes === 'string' ? JSON.parse(item.giftCardCodes) : item.giftCardCodes;
    return Array.isArray(c) && c.length > 0;
  } catch {
    return false;
  }
}

function itemIsGiftOrVirtual(item: any): boolean {
  const t = String(item?.type || '').trim().toLowerCase();
  return t === 'giftcard' || t === 'virtual-card' || t === 'gift-card' || t === 'gift card';
}

function isGiftCardOrderItem(item: any): boolean {
  return itemIsGiftOrVirtual(item) && !isVirtualCardOrderItem(item);
}

function parseOrderItemCodes(item: any): any[] {
  if (!item?.giftCardCodes) return [];
  try {
    const c = typeof item.giftCardCodes === 'string' ? JSON.parse(item.giftCardCodes) : item.giftCardCodes;
    return Array.isArray(c) ? c : [];
  } catch {
    return [];
  }
}

function itemNeedsGiftCodesOrVirtualLinks(item: any) {
  if (isVirtualCardOrderItem(item)) return !orderItemHasVirtualCardDetails(item);
  if (isGiftCardOrderItem(item)) return !adminOrderItemHasCodes(item);
  return false;
}

function itemNeedsCryptoConfirm(item: any) {
  if (item?.type !== 'crypto') return false;
  const meta = adminOrderItemMeta(item);
  if (meta.adminDeliveryConfirmed) return false;
  return true;
}

function itemNeedsWalletConfirm(item: any) {
  return item?.type === 'wallet' && !adminOrderItemMeta(item).adminDeliveryConfirmed;
}

function orderLinesFulfillmentReady(order: any) {
  const items = order?.items || [];
  return items.every(
    (it: any) =>
      !itemNeedsGiftCodesOrVirtualLinks(it) && !itemNeedsCryptoConfirm(it) && !itemNeedsWalletConfirm(it)
  );
}

function OrdersManager({ getAdminHeaders }: { getAdminHeaders: () => Record<string, string> }) {
  const [orders, setOrders] = useState<any[]>([]);
  const [orderView, setOrderView] = useState<'new' | 'awaiting' | 'completed' | 'rejected'>('new');
  const [visibleOrdersCount, setVisibleOrdersCount] = useState(40);
  const [loading, setLoading] = useState(false);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [giftCardCodes, setGiftCardCodes] = useState<
    Array<{
      serialNumber?: string;
      redeemCode?: string;
      cardNumber?: string;
      expireDate?: string;
      cvv?: string;
    }>
  >([]);

  const reconcileAwaitingPawapay = async (orderList: any[]) => {
    const stuck = orderList.filter(
      (o) => o.status === 'awaiting_pawapay' && o.payment?.method === 'pawapay'
    );
    if (stuck.length === 0) return orderList;
    const headers = { 'Content-Type': 'application/json', ...getAdminHeaders() };
    for (const o of stuck) {
      try {
        await fetch(`${getApiBase()}/payments/pawapay/reconcile`, {
          method: 'POST',
          headers: headers as HeadersInit,
          body: JSON.stringify({ orderId: o.id }),
        });
      } catch {
        /* ignore per-order */
      }
    }
    const res = await fetch(`${getApiBase()}/orders`, { headers: getAdminHeaders() as HeadersInit });
    const data = await res.json();
    return Array.isArray(data) ? data : orderList;
  };

  const load = async (): Promise<any[]> => {
    setLoading(true);
    try {
      const headers = getAdminHeaders();
      const res = await fetch(`${getApiBase()}/orders`, { headers: headers as HeadersInit });
      const data = await res.json();
      let arr = Array.isArray(data) ? data : [];
      arr = await reconcileAwaitingPawapay(arr);
      setOrders(arr);
      return arr;
    } catch (error) {
      console.error('Failed to load orders:', error);
      setOrders([]);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const confirmPawapayPayment = async (orderId: string) => {
    const headers = { 'Content-Type': 'application/json', ...getAdminHeaders() };
    try {
      const res = await fetch(`${getApiBase()}/payments/pawapay/reconcile`, {
        method: 'POST',
        headers: headers as HeadersInit,
        body: JSON.stringify({ orderId }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        alert(data.error || 'Payment not confirmed yet. Customer may still be paying.');
        return;
      }
      await load();
      setOrderView('new');
      alert('PawaPay payment confirmed — order is now in New Orders.');
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed to confirm payment');
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  const setStatus = async (id: string, status: string) => {
    const headers = { 'Content-Type': 'application/json', ...getAdminHeaders() };
    try {
      const res = await fetch(`${getApiBase()}/orders/${id}/status`, {
        method: 'PATCH',
        headers: headers as HeadersInit,
        body: JSON.stringify({ status }),
      });
      let data: Record<string, unknown> = {};
      try {
        data = (await res.json()) as Record<string, unknown>;
      } catch {
        /* empty */
      }
      if (!res.ok) {
        alert(typeof data.error === 'string' ? data.error : `Failed to update order status (${res.status})`);
        return;
      }
      await load();
      if (status === 'approved') {
        alert('Order approved.');
      }
    } catch (error) {
      console.error('Failed to update order status:', error);
      alert('Failed to update order status');
    }
  };

  const openCodesModalForItem = (order: any, item: any) => {
    setSelectedOrder(order);
    setSelectedItem(item);
    const qty = Math.max(1, Number(item.quantity) || 1);
    const isVirtual = isVirtualCardOrderItem(item);
    const existing = parseOrderItemCodes(item);
    const initial = new Array(qty).fill(null).map((_, idx) => {
      const prev = existing[idx];
      if (isVirtual) {
        const normalized = normalizeVirtualCardFromStored(prev);
        return normalized
          ? { cardNumber: normalized.cardNumber, expireDate: normalized.expireDate, cvv: normalized.cvv }
          : { cardNumber: '', expireDate: '', cvv: '' };
      }
      if (prev && typeof prev === 'object') {
        return {
          serialNumber: String((prev as any).serialNumber || ''),
          redeemCode: String((prev as any).redeemCode || ''),
        };
      }
      return { serialNumber: '', redeemCode: '' };
    });
    setGiftCardCodes(initial);
    setShowCodeModal(true);
  };

  const mergeItemDeliveryMeta = async (orderId: string, itemId: string) => {
    const headers = { 'Content-Type': 'application/json', ...getAdminHeaders() };
    const res = await fetch(`${getApiBase()}/orders/${orderId}/items/${itemId}/metadata`, {
      method: 'PATCH',
      headers: headers as HeadersInit,
      body: JSON.stringify({
        merge: { adminDeliveryConfirmed: true, adminDeliveryConfirmedAt: new Date().toISOString() },
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error || `Failed (${res.status})`);
    }
    await load();
  };

  const saveCodes = async () => {
    if (!selectedOrder || !selectedItem) return;

    const isVirtualCard = isVirtualCardOrderItem(selectedItem);

    if (isVirtualCard) {
      if (
        giftCardCodes.some(
          (item) => !item.cardNumber?.trim() || !item.expireDate?.trim() || !item.cvv?.trim()
        )
      ) {
        alert('Please fill in card number, expiry date, and CVV for each virtual card');
        return;
      }
    } else {
      if (giftCardCodes.some((item) => !item.serialNumber?.trim() || !item.redeemCode?.trim())) {
        alert('Please fill in all serial numbers and redeem codes');
        return;
      }
    }

    const headers = { 'Content-Type': 'application/json', ...getAdminHeaders() };
    try {
      const patchRes = await fetch(`${getApiBase()}/orders/${selectedOrder.id}/items/${selectedItem.id}/codes`, {
        method: 'PATCH',
        headers: headers as HeadersInit,
        body: JSON.stringify({
          codes: isVirtualCard
            ? giftCardCodes.map((c) => ({
                cardNumber: (c.cardNumber || '').trim(),
                expireDate: (c.expireDate || '').trim(),
                cvv: (c.cvv || '').trim(),
              }))
            : giftCardCodes.map((c) => ({
                serialNumber: (c.serialNumber || '').trim(),
                redeemCode: (c.redeemCode || '').trim(),
              })),
        }),
      });
      if (!patchRes.ok) {
        const err = await patchRes.json().catch(() => ({}));
        throw new Error(err?.error || 'Failed to save codes');
      }

      const all = await load();
      const orderFresh = all.find((x) => x.id === selectedOrder.id);
      const next = orderFresh?.items?.find(
        (item: any) =>
          itemIsGiftOrVirtual(item) &&
          item.id !== selectedItem.id &&
          !adminOrderItemHasCodes(item)
      );

      if (next) {
        setSelectedOrder(orderFresh);
        setSelectedItem(next);
        const isNextV = isVirtualCardOrderItem(next);
        const q = Math.max(1, Number(next.quantity) || 1);
        setGiftCardCodes(
          new Array(q).fill(null).map(() =>
            isNextV ? { cardNumber: '', expireDate: '', cvv: '' } : { serialNumber: '', redeemCode: '' }
          )
        );
      } else {
        setShowCodeModal(false);
        setSelectedOrder(null);
        setSelectedItem(null);
        setGiftCardCodes([]);
      }
    } catch (error: any) {
      console.error('Failed to save codes/links:', error);
      alert(error?.message || 'Failed to save codes/links');
    }
  };

  const filteredOrders = orders.filter(o => {
    if (orderView === 'new') return o.status === 'pending';
    if (orderView === 'awaiting') return o.status === 'awaiting_pawapay';
    if (orderView === 'completed') return o.status === 'approved' || o.status === 'fulfilled' || o.status === 'done';
    if (orderView === 'rejected') return o.status === 'rejected' || o.status === 'denied' || o.status === 'fail';
    return true;
  });
  const visibleOrders = filteredOrders.slice(0, visibleOrdersCount);

  useEffect(() => {
    setVisibleOrdersCount(40);
  }, [orderView]);

  const newOrdersCount = orders.filter(o => o.status === 'pending').length;
  const awaitingPawapayCount = orders.filter(o => o.status === 'awaiting_pawapay').length;
  const completedOrdersCount = orders.filter(o => o.status === 'approved' || o.status === 'fulfilled' || o.status === 'done').length;
  const rejectedOrdersCount = orders.filter(o => o.status === 'rejected' || o.status === 'denied' || o.status === 'fail').length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="px-4 py-2 rounded-lg bg-neon-blue text-white font-medium text-sm disabled:opacity-50"
        >
          {loading ? 'Refreshing…' : 'Refresh Orders'}
        </button>
      </div>
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
        {awaitingPawapayCount > 0 && (
          <button
            onClick={() => setOrderView('awaiting')}
            className={`px-4 py-2 rounded-lg font-semibold transition-all ${
              orderView === 'awaiting'
                ? 'bg-amber-500 text-white'
                : 'bg-dark-surface text-gray-300 hover:bg-dark-card'
            }`}
          >
            Awaiting PawaPay ({awaitingPawapayCount})
          </button>
        )}
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
          <div className="text-xs text-gray-500">
            Showing {visibleOrders.length} of {filteredOrders.length} orders
          </div>
          {visibleOrders.map(o => (
            <div key={o.id} className="p-4 border border-dark-border rounded-lg bg-dark-surface">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="text-white font-semibold">Order #{o.id.slice(0, 8)}</div>
                  <div className="text-gray-300 text-sm mt-1">
                    <span className="text-white">{o.user?.name || 'Customer'}</span>
                    {o.user?.email && (
                      <>
                        {' · '}
                        <a href={`mailto:${o.user.email}`} className="text-neon-blue hover:underline">
                          {o.user.email}
                        </a>
                      </>
                    )}
                    {o.user?.phone && (
                      <span className="text-gray-400"> · {o.user.phone}</span>
                    )}
                  </div>
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
                    try {
                      metadata = item.metadata ? (typeof item.metadata === 'string' ? JSON.parse(item.metadata) : item.metadata) : null;
                    } catch (e) {
                      console.error('Failed to parse metadata/codes:', e);
                    }
                    const codes = parseOrderItemCodes(item);
                    const isGiftLike = itemIsGiftOrVirtual(item);
                    const isVirtual = isVirtualCardOrderItem(item);
                    
                    return (
                      <div key={item.id || `${idx}-${item.name || 'item'}`} className="text-gray-400 text-xs pl-3 border-l-2 border-dark-border">
                        <div className="font-semibold text-white">â€¢ {item.name} ({item.type}) x{item.quantity} - ${item.priceUsd?.toFixed(2)}</div>
                        
                        {/* Gift Card Codes */}
                        {isGiftCardOrderItem(item) && codes.length > 0 && (
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
                        
                        {/* Virtual Card Details */}
                        {isVirtual && codes.length > 0 && (
                          <div className="mt-2 ml-3 p-2 bg-dark-bg rounded border border-blue-400/30">
                            <div className="text-blue-400 font-bold mb-1">Card details:</div>
                            <div className="space-y-2">
                              {codes.map((raw: any, linkIdx: number) => {
                                const card = normalizeVirtualCardFromStored(raw);
                                if (!card) return null;
                                return (
                                  <div key={linkIdx} className="text-xs font-mono text-blue-300">
                                    <strong>#{linkIdx + 1}</strong> {card.cardNumber} · exp {card.expireDate} · CVV {card.cvv}
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
                              {metadata.coin && <div><strong>Coin:</strong> {String(metadata.coin)}</div>}
                              {metadata.amountUsd !== undefined && metadata.amountUsd !== null && (
                                <div><strong>Amount:</strong> ${metadata.amountUsd} USD</div>
                              )}
                              {metadata.deliveryMethod === 'binance_id' && metadata.binanceId && (
                                <div><strong>Delivery:</strong> Binance ID — {String(metadata.binanceId)}</div>
                              )}
                              {metadata.deliveryMethod === 'binance_email' && metadata.binanceEmail && (
                                <div><strong>Delivery:</strong> Binance email — {String(metadata.binanceEmail)}</div>
                              )}
                              {metadata.deliveryMethod === 'wallet' && (
                                <>
                                  {metadata.network && <div><strong>Network:</strong> {String(metadata.network)}</div>}
                                  {metadata.walletAddress && (
                                    <div className="break-all">
                                      <strong>Wallet:</strong> <span className="text-neon-blue">{String(metadata.walletAddress)}</span>
                                    </div>
                                  )}
                                </>
                              )}
                              {/* Legacy orders (exchange picker) */}
                              {!metadata.deliveryMethod && metadata.exchange && (
                                <div><strong>Exchange (legacy):</strong> {String(metadata.exchange)}</div>
                              )}
                              {!metadata.deliveryMethod && metadata.network && (
                                <div><strong>Network (legacy):</strong> {String(metadata.network)}</div>
                              )}
                              {!metadata.deliveryMethod && metadata.walletAddress && (
                                <div className="break-all">
                                  <strong>Wallet (legacy):</strong>{' '}
                                  <span className="text-neon-blue">{String(metadata.walletAddress)}</span>
                                </div>
                              )}
                              {!metadata.deliveryMethod && metadata.email && (
                                <div><strong>Email (legacy):</strong> {String(metadata.email)}</div>
                              )}
                              {!metadata.deliveryMethod && metadata.exchangeId && (
                                <div><strong>Exchange ID (legacy):</strong> {String(metadata.exchangeId)}</div>
                              )}
                              {metadata.notes && <div><strong>Notes:</strong> {String(metadata.notes)}</div>}
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

                        {orderView === 'new' && (
                          <div className="mt-3 ml-3 flex flex-wrap gap-2 items-center">
                            {isGiftLike && (
                              <button
                                type="button"
                                onClick={() => openCodesModalForItem(o, item)}
                                className="text-xs px-3 py-1.5 rounded-lg bg-yellow-500/20 border border-yellow-400/50 text-yellow-200 hover:bg-yellow-500/30 font-semibold"
                              >
                                {itemNeedsGiftCodesOrVirtualLinks(item)
                                  ? isVirtualCardOrderItem(item)
                                    ? 'Enter card details (this line)'
                                    : 'Enter codes (this line)'
                                  : isVirtualCardOrderItem(item)
                                    ? 'View / edit card details'
                                    : 'View / edit codes (this line)'}
                              </button>
                            )}
                            {itemNeedsCryptoConfirm(item) && (
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    await mergeItemDeliveryMeta(o.id, item.id);
                                  } catch (e: any) {
                                    alert(e?.message || 'Failed to update');
                                  }
                                }}
                                className="text-xs px-3 py-1.5 rounded-lg bg-neon-blue/20 border border-neon-blue/50 text-sky-200 hover:bg-neon-blue/30 font-semibold"
                              >
                                Confirm crypto sent (this line)
                              </button>
                            )}
                            {itemNeedsWalletConfirm(item) && (
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    await mergeItemDeliveryMeta(o.id, item.id);
                                  } catch (e: any) {
                                    alert(e?.message || 'Failed to update');
                                  }
                                }}
                                className="text-xs px-3 py-1.5 rounded-lg bg-green-500/20 border border-green-400/50 text-green-200 hover:bg-green-500/30 font-semibold"
                              >
                                Confirm wallet top-up (this line)
                              </button>
                            )}
                            {item.type === 'crypto' && adminOrderItemMeta(item).adminDeliveryConfirmed && (
                              <span className="text-[11px] uppercase tracking-wide text-green-400 font-semibold">Crypto line âœ“</span>
                            )}
                            {item.type === 'wallet' && adminOrderItemMeta(item).adminDeliveryConfirmed && (
                              <span className="text-[11px] uppercase tracking-wide text-green-400 font-semibold">Wallet line âœ“</span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {o.payment && (
                <div className="mb-3 p-2 bg-dark-bg rounded text-xs text-gray-400">
                  <div className="mb-1">
                    <span className="text-gray-500">Payment: </span>
                    {o.payment.method === 'pawapay' ? (
                      <span className="text-emerald-400 font-semibold">
                        PawaPay (mobile money)
                        {o.payment.popUrl?.includes('pawapayVerified') ? ' — paid ✓' : ''}
                      </span>
                    ) : o.payment.method === 'bank' ? (
                      <span className="text-neon-blue font-medium">Bank transfer</span>
                    ) : o.payment.method === 'points' ? (
                      <span className="text-purple-300 font-medium">TConnect Points</span>
                    ) : o.payment.method === 'paypal' ? (
                      <span className="text-sky-300 font-medium">PayPal</span>
                    ) : (
                      <span className="text-white">{o.payment.method || '—'}</span>
                    )}
                  </div>
                  <div>Sender: {o.payment.senderName}</div>
                  {o.payment.transactionId && (
                    <div>
                      {o.payment.method === 'pawapay' ? 'PawaPay ref' : 'Transaction ID'}:{' '}
                      {String(o.payment.transactionId).split('|')[0]}
                    </div>
                  )}
                  {o.payment.popUrl && o.payment.method !== 'pawapay' && o.payment.popUrl.startsWith('http') && (
                    <a href={o.payment.popUrl} target="_blank" rel="noreferrer" className="text-neon-blue hover:underline inline-block mt-1">
                      View Proof of Payment
                    </a>
                  )}
                </div>
              )}

              {orderView === 'awaiting' && o.payment?.method === 'pawapay' && (
                <div className="mt-3 p-3 rounded-lg border border-amber-500/40 bg-amber-500/10">
                  <p className="text-amber-200 text-sm mb-2">
                    Customer paid via PawaPay but this order has not been sent to New Orders yet. Click to check payment and release it to admin.
                  </p>
                  <button
                    type="button"
                    onClick={() => confirmPawapayPayment(o.id)}
                    className="text-sm px-4 py-2 rounded-lg bg-amber-500 text-black font-semibold hover:bg-amber-400"
                  >
                    Confirm PawaPay payment
                  </button>
                </div>
              )}

              {orderView === 'new' && (
                <div className="mt-3 space-y-2">
                  <p className="text-gray-500 text-xs">
                    Use the buttons on each line: gift cards need codes (each product separately), crypto and wallet each need their own confirmation.
                    When every line is done, mark the order fulfilled.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setStatus(o.id, 'approved')}
                      className="cyber-border text-green-400 px-4 py-2 rounded hover:bg-green-400/10 font-semibold"
                    >
                      âœ“ Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatus(o.id, 'rejected')}
                      className="cyber-border text-red-400 px-4 py-2 rounded hover:bg-red-400/10 font-semibold"
                    >
                      âœ— Reject
                    </button>
                    <button
                      type="button"
                      disabled={!orderLinesFulfillmentReady(o)}
                      title={
                        orderLinesFulfillmentReady(o)
                          ? 'All lines fulfilled'
                          : 'Complete every line first (codes / crypto / wallet confirmations)'
                      }
                      onClick={() => {
                        if (orderLinesFulfillmentReady(o)) setStatus(o.id, 'fulfilled');
                      }}
                      className={`cyber-border px-4 py-2 rounded font-semibold ${
                        orderLinesFulfillmentReady(o)
                          ? 'text-neon-blue hover:bg-neon-blue/10'
                          : 'text-gray-600 border-gray-700 cursor-not-allowed opacity-60'
                      }`}
                    >
                      Mark order fulfilled
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {visibleOrders.length < filteredOrders.length && (
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setVisibleOrdersCount((n) => n + 40)}
                className="w-full px-4 py-2 rounded-lg border border-dark-border bg-dark-surface text-gray-200 hover:bg-dark-card"
              >
                Load 40 more orders
              </button>
            </div>
          )}
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
              {isVirtualCardOrderItem(selectedItem) ? 'Enter virtual card details' : 'Enter gift card codes'} —{' '}
              {selectedItem.name}
            </h3>
            <p className="text-gray-300 text-sm mb-4">
              {isVirtualCardOrderItem(selectedItem)
                ? `Add card number, expiry date, and CVV for each unit (${selectedItem.quantity}).`
                : `Add serial + redeem for each unit (${selectedItem.quantity}) of this gift card — other products use their own buttons on the order.`}
            </p>
            <div className="space-y-4">
              {giftCardCodes.map((codeItem, idx) => (
                <div key={idx} className="p-3 bg-dark-surface rounded-lg border border-dark-border">
                  <div className={`font-semibold mb-3 ${isVirtualCardOrderItem(selectedItem) ? 'text-blue-400' : 'text-yellow-400'}`}>
                    {isVirtualCardOrderItem(selectedItem) ? `Virtual card #${idx + 1}` : `Gift card unit #${idx + 1}`}
                  </div>
                  <div className="space-y-3">
                    {isVirtualCardOrderItem(selectedItem) ? (
                      <>
                        <div>
                          <label className="block text-gray-300 text-sm mb-1">Card number</label>
                          <input
                            type="text"
                            inputMode="numeric"
                            autoComplete="off"
                            value={codeItem.cardNumber || ''}
                            onChange={(e) => {
                              const newCodes = [...giftCardCodes];
                              newCodes[idx] = { ...newCodes[idx], cardNumber: e.target.value };
                              setGiftCardCodes(newCodes);
                            }}
                            placeholder="4111 1111 1111 1111"
                            className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-white focus:border-neon-blue focus:outline-none font-mono text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-gray-300 text-sm mb-1">Expire date</label>
                          <input
                            type="text"
                            value={codeItem.expireDate || ''}
                            onChange={(e) => {
                              const newCodes = [...giftCardCodes];
                              newCodes[idx] = { ...newCodes[idx], expireDate: e.target.value };
                              setGiftCardCodes(newCodes);
                            }}
                            placeholder="MM/YY"
                            className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-white focus:border-neon-blue focus:outline-none font-mono text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-gray-300 text-sm mb-1">CVV</label>
                          <input
                            type="text"
                            inputMode="numeric"
                            autoComplete="off"
                            value={codeItem.cvv || ''}
                            onChange={(e) => {
                              const newCodes = [...giftCardCodes];
                              newCodes[idx] = { ...newCodes[idx], cvv: e.target.value };
                              setGiftCardCodes(newCodes);
                            }}
                            placeholder="123"
                            className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-white focus:border-neon-blue focus:outline-none font-mono text-sm"
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <label className="block text-gray-300 text-sm mb-1">Serial Number:</label>
                          <input
                            type="text"
                            value={codeItem.serialNumber || ''}
                            onChange={(e) => {
                              const newCodes = [...giftCardCodes];
                              newCodes[idx] = { ...newCodes[idx], serialNumber: e.target.value };
                              setGiftCardCodes(newCodes);
                            }}
                            placeholder={`Serial ${idx + 1}`}
                            className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-white focus:border-neon-blue focus:outline-none font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-gray-300 text-sm mb-1">Redeem Code:</label>
                          <input
                            type="text"
                            value={codeItem.redeemCode || ''}
                            onChange={(e) => {
                              const newCodes = [...giftCardCodes];
                              newCodes[idx] = { ...newCodes[idx], redeemCode: e.target.value };
                              setGiftCardCodes(newCodes);
                            }}
                            placeholder={`Redeem code ${idx + 1}`}
                            className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-white focus:border-neon-blue focus:outline-none font-mono"
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-6">
              <button
                type="button"
                onClick={saveCodes}
                disabled={
                  isVirtualCardOrderItem(selectedItem)
                    ? giftCardCodes.some(
                        (c) => !c.cardNumber?.trim() || !c.expireDate?.trim() || !c.cvv?.trim()
                      )
                    : giftCardCodes.some((c) => !c.serialNumber?.trim() || !c.redeemCode?.trim())
                }
                className="flex-1 bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
              >
                Save
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
  const [users, setUsers] = useState<any[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [form, setForm] = useState<any>({ 
    customer: '', 
    email: '', 
    serviceType: 'giftcard',
    items: [{ name: '', description: '', quantity: 1, priceUsd: 0 }],
    totalUsd: 0, 
    totalMwk: 0,
    notes: '',
    // Payment transfer specific fields
    currency: 'USD',
    rate: 0
  });
  const [loading, setLoading] = useState(false);
  const [previewInvoice, setPreviewInvoice] = useState<any>(null);
  
  // All major currencies
  const currencies = [
    { code: 'USD', name: 'US Dollar' },
    { code: 'EUR', name: 'Euro' },
    { code: 'GBP', name: 'British Pound' },
    { code: 'JPY', name: 'Japanese Yen' },
    { code: 'AUD', name: 'Australian Dollar' },
    { code: 'CAD', name: 'Canadian Dollar' },
    { code: 'CHF', name: 'Swiss Franc' },
    { code: 'CNY', name: 'Chinese Yuan' },
    { code: 'INR', name: 'Indian Rupee' },
    { code: 'ZAR', name: 'South African Rand' },
    { code: 'NGN', name: 'Nigerian Naira' },
    { code: 'KES', name: 'Kenyan Shilling' },
    { code: 'GHS', name: 'Ghanaian Cedi' },
    { code: 'TZS', name: 'Tanzanian Shilling' },
    { code: 'UGX', name: 'Ugandan Shilling' },
    { code: 'RWF', name: 'Rwandan Franc' },
    { code: 'ETB', name: 'Ethiopian Birr' },
    { code: 'AED', name: 'UAE Dirham' },
    { code: 'SAR', name: 'Saudi Riyal' },
    { code: 'BWP', name: 'Botswana Pula' },
    { code: 'ZMW', name: 'Zambian Kwacha' },
    { code: 'MZN', name: 'Mozambican Metical' }
  ];
  
  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${getApiBase()}/invoices`, { headers: getAdminHeaders() as HeadersInit });
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

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const data = await fetchAdminUsers(getAdminHeaders, {
          search: customerSearch.trim() || undefined,
          limit: customerSearch.trim() ? 100 : 5000,
        });
        if (!cancelled) setUsers(data);
      } catch (error) {
        console.error('Failed to load users for invoices:', error);
        if (!cancelled) setUsers([]);
      }
    }, customerSearch.trim() ? 300 : 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [getAdminHeaders, customerSearch]);
  
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
    
    // Recalculate totals
    if (form.serviceType === 'payment-transfer') {
      // For payment transfer: Total MWK = currency amount Ã— rate
      const currencyAmount = newItems.reduce((sum, item) => sum + (item.priceUsd || 0) * (item.quantity || 1), 0);
      const totalMwk = currencyAmount > 0 && form.rate > 0 ? Math.round(currencyAmount * form.rate) : 0;
      const totalUsd = currencyAmount; // Store currency amount in totalUsd for payment-transfer
      setForm({ ...form, items: newItems, totalUsd, totalMwk });
    } else {
      // For other services: use existing rate calculation
      const totalUsd = newItems.reduce((sum, item) => sum + (item.priceUsd || 0) * (item.quantity || 1), 0);
      let rateType: 'crypto' | 'giftcard' | 'wallet' = 'giftcard';
      if (form.serviceType === 'crypto') rateType = 'crypto';
      else if (form.serviceType === 'wallet' || form.serviceType === 'virtual-card') rateType = 'wallet';
      else if (form.serviceType === 'giftcard') rateType = 'giftcard';
      const totalMwk = totalUsd > 0 ? getMwkAmountFromUsd(totalUsd, rateType) : 0;
      setForm({ ...form, items: newItems, totalUsd, totalMwk });
    }
  };
  
  // Update currency or rate for payment-transfer
  const updatePaymentTransferFields = (field: string, value: any) => {
    const newForm = { ...form, [field]: value };
    if (field === 'rate' || field === 'currency') {
      // Recalculate total MWK when rate or currency changes
      if (newForm.serviceType === 'payment-transfer') {
        const currencyAmount = newForm.items.reduce((sum: number, item: any) => sum + (item.priceUsd || 0) * (item.quantity || 1), 0);
        const totalMwk = currencyAmount > 0 && newForm.rate > 0 ? Math.round(currencyAmount * newForm.rate) : 0;
        newForm.totalMwk = totalMwk;
      }
    }
    setForm(newForm);
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
    
    // Validate payment-transfer specific fields
    if (form.serviceType === 'payment-transfer') {
      if (!form.currency) {
        alert('Please select a currency');
        return;
      }
      if (!form.rate || form.rate <= 0) {
        alert('Please enter a valid exchange rate (rate must be greater than 0)');
        return;
      }
    }
    
    let totalUsd = form.items.reduce((sum: number, item: any) => sum + (item.priceUsd || 0) * (item.quantity || 1), 0);
    let totalMwk = form.totalMwk;
    
    if (form.serviceType === 'payment-transfer') {
      // For payment transfer: Total MWK = currency amount Ã— rate
      totalMwk = totalUsd > 0 && form.rate > 0 ? Math.round(totalUsd * form.rate) : 0;
    } else {
      // For other services: use existing rate calculation
      let rateType: 'crypto' | 'giftcard' | 'wallet' = 'giftcard';
      if (form.serviceType === 'crypto') rateType = 'crypto';
      else if (form.serviceType === 'wallet' || form.serviceType === 'virtual-card') rateType = 'wallet';
      else if (form.serviceType === 'giftcard') rateType = 'giftcard';
      totalMwk = totalUsd > 0 ? getMwkAmountFromUsd(totalUsd, rateType) : 0;
    }
    
    try {
      // Store currency and rate in items metadata for payment-transfer
      const itemsToStore = form.serviceType === 'payment-transfer' 
        ? form.items.map((item: any) => ({ ...item, currency: form.currency, rate: form.rate }))
        : form.items;
      
      const invoiceData = {
        customer: form.customer,
        email: form.email,
        serviceType: form.serviceType,
        items: JSON.stringify(itemsToStore),
        totalUsd,
        totalMwk,
        notes: form.notes || null,
        // Store currency and rate for payment-transfer
        ...(form.serviceType === 'payment-transfer' && {
          currency: form.currency,
          rate: form.rate
        })
      };
      
      console.log('Creating invoice with data:', invoiceData);
      
      const response = await fetch(`${getApiBase()}/invoices`, { 
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
        notes: '',
        currency: 'USD',
        rate: 0
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
    let totalMwk = invoice.totalMwk;
    let currency = 'USD';
    let rate = 0;
    
    // Handle payment-transfer invoices
    if (invoice.serviceType === 'payment-transfer') {
      // Get currency and rate from invoice metadata or first item
      if (invoice.currency && invoice.rate) {
        currency = invoice.currency;
        rate = invoice.rate;
      } else if (items.length > 0 && items[0].currency && items[0].rate) {
        currency = items[0].currency;
        rate = items[0].rate;
      }
      totalMwk = invoice.totalMwk || (totalUsd > 0 && rate > 0 ? Math.round(totalUsd * rate) : 0);
    } else {
      // For other services: use existing rate calculation
      let rateType: 'crypto' | 'giftcard' | 'wallet' = 'giftcard';
      if (invoice.serviceType === 'crypto') rateType = 'crypto';
      else if (invoice.serviceType === 'wallet' || invoice.serviceType === 'virtual-card') rateType = 'wallet';
      else if (invoice.serviceType === 'giftcard') rateType = 'giftcard';
      totalMwk = invoice.totalMwk || getMwkAmountFromUsd(totalUsd, rateType);
    }
    
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
              ${invoice.serviceType === 'payment-transfer' && currency && rate > 0 ? `
                <br/><strong>Currency:</strong> ${currency}
                <br/><strong>Exchange Rate:</strong> 1 ${currency} = ${rate.toLocaleString()} MWK
              ` : ''}
            </div>
          </div>
          
          <table class="items-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Description</th>
                <th>Qty</th>
                <th>Unit Price ${invoice.serviceType === 'payment-transfer' && currency ? `(${currency})` : '(USD)'}</th>
                <th>Total ${invoice.serviceType === 'payment-transfer' && currency ? `(${currency})` : '(USD)'}</th>
              </tr>
            </thead>
            <tbody>
              ${items.map((item: any) => `
                <tr>
                  <td>${item.name || '-'}</td>
                  <td>${item.description || '-'}</td>
                  <td>${item.quantity || 1}</td>
                  <td>${invoice.serviceType === 'payment-transfer' && currency ? `${currency} ` : '$'}${Number(item.priceUsd || 0).toFixed(2)}</td>
                  <td>${invoice.serviceType === 'payment-transfer' && currency ? `${currency} ` : '$'}${Number((item.priceUsd || 0) * (item.quantity || 1)).toFixed(2)}</td>
                </tr>
              `).join('')}
              <tr class="total-row">
                <td colspan="4" style="text-align: right;">Subtotal ${invoice.serviceType === 'payment-transfer' && currency ? `(${currency})` : '(USD)'}:</td>
                <td>${invoice.serviceType === 'payment-transfer' && currency ? `${currency} ` : '$'}${totalUsd.toFixed(2)}</td>
              </tr>
              ${invoice.serviceType === 'payment-transfer' && currency && rate > 0 ? `
                <tr class="total-row" style="background-color: #e8f4f8;">
                  <td colspan="4" style="text-align: right;">Exchange Rate (1 ${currency} = ${rate.toLocaleString()} MWK):</td>
                  <td></td>
                </tr>
              ` : ''}
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
            <div>
              <input 
                value={form.email} 
                onChange={(e) => {
                  const email = e.target.value;
                  setCustomerSearch(email);
                  const match = users.find(
                    (u) => u.email?.trim().toLowerCase() === email.trim().toLowerCase()
                  );
                  setForm({
                    ...form,
                    email,
                    customer: match?.name && !form.customer ? match.name : form.customer,
                  });
                }} 
                type="email"
                placeholder="Customer Email * (search members)" 
                className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white"
                list="invoice-user-emails"
              />
              <datalist id="invoice-user-emails">
                {users.map((user) => (
                  <option key={user.id} value={user.email}>
                    {user.name ? `${user.name}` : user.email}
                  </option>
                ))}
              </datalist>
            </div>
          </div>
          
          <div>
            <label className="block text-white text-sm mb-2">Service Type *</label>
            <select 
              value={form.serviceType} 
              onChange={(e) => {
                const newServiceType = e.target.value;
                setForm({ 
                  ...form, 
                  serviceType: newServiceType,
                  // Reset currency and rate when switching away from payment-transfer
                  ...(newServiceType !== 'payment-transfer' && { currency: 'USD', rate: 0 })
                });
                // Recalculate totals when service type changes
                if (newServiceType !== 'payment-transfer') {
                  const totalUsd = form.items.reduce((sum: number, item: any) => sum + (item.priceUsd || 0) * (item.quantity || 1), 0);
                  let rateType: 'crypto' | 'giftcard' | 'wallet' = 'giftcard';
                  if (newServiceType === 'crypto') rateType = 'crypto';
                  else if (newServiceType === 'wallet' || newServiceType === 'virtual-card') rateType = 'wallet';
                  else if (newServiceType === 'giftcard') rateType = 'giftcard';
                  const totalMwk = totalUsd > 0 ? getMwkAmountFromUsd(totalUsd, rateType) : 0;
                  setForm((prev: any) => ({ ...prev, totalUsd, totalMwk }));
                }
              }}
              className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white"
            >
              <option value="giftcard">Gift Card</option>
              <option value="crypto">Cryptocurrency</option>
            <option value="wallet">Digital wallet (payments rate)</option>
            <option value="virtual-card">Virtual card (payments rate)</option>
              <option value="payment-transfer">Payment Transfer</option>
            </select>
          </div>
          
          {/* Currency and Rate fields for Payment Transfer */}
          {form.serviceType === 'payment-transfer' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-white text-sm mb-2">Currency *</label>
                <select 
                  value={form.currency} 
                  onChange={(e) => updatePaymentTransferFields('currency', e.target.value)}
                  className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white"
                >
                  {currencies.map((curr) => (
                    <option key={curr.code} value={curr.code}>
                      {curr.code} - {curr.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-white text-sm mb-2">Exchange Rate (1 {form.currency} = ? MWK) *</label>
                <input 
                  type="number" 
                  step="0.01"
                  value={form.rate} 
                  onChange={(e) => updatePaymentTransferFields('rate', parseFloat(e.target.value || '0'))} 
                  placeholder="Enter rate (e.g., 1750.50)" 
                  className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white" 
                />
              </div>
            </div>
          )}
          
          <div>
            <label className="block text-white text-sm mb-2">
              Items / Products * 
              {form.serviceType === 'payment-transfer' && (
                <span className="text-gray-400 text-xs ml-2">(Amount in {form.currency})</span>
              )}
            </label>
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
                  placeholder={form.serviceType === 'payment-transfer' ? `Amount ${form.currency}` : 'Price USD'} 
                  className="col-span-2 px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white text-sm" 
                />
                <button 
                  onClick={() => removeItem(index)} 
                  className="col-span-1 px-3 py-2 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600"
                  disabled={form.items.length === 1}
                >
                  Ã—
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
              <label className="block text-white text-sm mb-2">
                {form.serviceType === 'payment-transfer' ? `Total ${form.currency}` : 'Total USD'}
              </label>
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
              {form.serviceType === 'payment-transfer' && form.rate > 0 && (
                <p className="text-gray-400 text-xs mt-1">
                  Rate: 1 {form.currency} = {form.rate.toLocaleString()} MWK
                </p>
              )}
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
              // Get currency for payment-transfer invoices
              const currency = i.serviceType === 'payment-transfer' 
                ? (i.currency || (items.length > 0 && items[0].currency) || 'USD')
                : null;
              const rate = i.serviceType === 'payment-transfer'
                ? (i.rate || (items.length > 0 && items[0].rate) || 0)
                : 0;
              return (
                <div key={i.id} className="p-4 border border-dark-border rounded-lg bg-dark-surface">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-white font-semibold">Invoice #{i.id}</div>
                      <div className="text-gray-400 text-sm">
                        {i.customer} â€¢ {i.email} â€¢ {i.serviceType || 'giftcard'}
                        {currency && rate > 0 && ` â€¢ ${currency} @ ${rate.toLocaleString()} MWK`}
                      </div>
                      <div className="text-gray-400 text-sm">
                        {currency ? `${currency} ${totalUsd.toFixed(2)}` : `$${totalUsd.toFixed(2)} USD`} â€¢ MWK {i.totalMwk?.toLocaleString() || '0'}
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
                Ã— Close
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


function formatUserLocation(row: {
  city?: string | null;
  region?: string | null;
  country?: string | null;
  lastLoginIp?: string | null;
  locationSource?: string | null;
}): string {
  const place = [row.city, row.region, row.country].filter(Boolean).join(', ');
  if (place) return place;
  if (row.lastLoginIp) return `IP ${row.lastLoginIp}`;
  return 'Unknown';
}

function locationAccuracyLabel(source?: string | null): string {
  if (source === 'gps') return 'GPS (accurate)';
  if (source === 'ip_approx') return 'IP approx.';
  return '—';
}

function RecentSignInsManager({ getAdminHeaders }: { getAdminHeaders: () => Record<string, string> }) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [total, setTotal] = useState(0);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: '5000' });
      if (search.trim()) params.set('search', search.trim());
      const res = await fetch(`${getApiBase()}/users/admin/recent-signins?${params}`, {
        headers: getAdminHeaders() as HeadersInit,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || `Failed (${res.status})`);
      }
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
      setTotal(Number(res.headers.get('X-Total-Count') || (Array.isArray(data) ? data.length : 0)));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load sign-ins');
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(load, search.trim() ? 300 : 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const withLocation = rows.filter((r) => r.city || r.country).length;
  const signedIn = rows.filter((r) => r.lastLoginAt).length;

  return (
    <div className="space-y-4">
      <div className="card-dark p-5 rounded-xl border border-neon-blue/30">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <MapPin className="w-5 h-5 text-neon-blue" />
          <div>
            <h3 className="text-lg font-bold text-white">All users &amp; sign-in locations</h3>
            <p className="text-sm text-gray-400">
              Every registered user is listed. Most recent sign-ins appear at the top.
            </p>
            <p className="text-xs text-amber-300/90 mt-2 max-w-3xl">
              IP-based location often shows Lilongwe or Blantyre for all of Malawi (mobile ISP routing).
              When customers allow &quot;Location&quot; in the browser, we store GPS city (e.g. Mzuzu) — labeled GPS (accurate).
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search email, name, city, country…"
              className="w-full pl-9 pr-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-white text-sm"
            />
          </div>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-neon-blue text-white text-sm font-medium disabled:opacity-50"
          >
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
        <div className="flex flex-wrap gap-4 mt-4 text-sm">
          <span className="text-gray-400">
            Users: <span className="text-white font-semibold">{rows.length}</span>
            {total > rows.length ? ` of ${total}` : ''}
          </span>
          <span className="text-gray-400">
            Signed in: <span className="text-white font-semibold">{signedIn}</span>
          </span>
          <span className="text-gray-400">
            With location: <span className="text-neon-blue font-semibold">{withLocation}</span>
          </span>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">{error}</div>
      )}

      {loading && rows.length === 0 ? (
        <p className="text-gray-400 text-sm">Loading users…</p>
      ) : rows.length === 0 ? (
        <p className="text-gray-400 text-sm">No users found.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-dark-border">
          <table className="w-full text-sm text-left">
            <thead className="bg-dark-bg text-gray-400">
              <tr>
                <th className="px-4 py-3">Last sign-in</th>
                <th className="px-4 py-3">Signed up</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Accuracy</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-border">
              {rows.map((r) => (
                <tr key={r.id} className="bg-dark-surface/80 hover:bg-dark-surface">
                  <td className="px-4 py-3 whitespace-nowrap">
                    {r.lastLoginAt ? (
                      <span className="text-green-300">{new Date(r.lastLoginAt).toLocaleString()}</span>
                    ) : (
                      <span className="text-gray-500">Not yet</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-400 whitespace-nowrap">
                    {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3 text-white font-medium">{r.name || '—'}</td>
                  <td className="px-4 py-3">
                    <a href={`mailto:${r.email}`} className="text-neon-blue hover:underline">
                      {r.email}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-gray-300">{r.phone || '—'}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 text-gray-200">
                      <MapPin className="w-3.5 h-3.5 text-neon-blue flex-shrink-0" />
                      {r.lastLoginAt ? formatUserLocation(r) : '— sign in to capture'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs whitespace-nowrap">
                    {r.lastLoginAt ? (
                      <span
                        className={
                          r.locationSource === 'gps'
                            ? 'text-green-400'
                            : 'text-amber-300'
                        }
                      >
                        {locationAccuracyLabel(r.locationSource)}
                      </span>
                    ) : (
                      <span className="text-gray-500">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function UsersManager({ getAdminHeaders }: { getAdminHeaders: () => Record<string, string> }) {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const walletHolders = useMemo(() => {
    return users
      .filter((u) => Number(u.walletBalanceUsd || 0) > 0.001)
      .sort((a, b) => Number(b.walletBalanceUsd || 0) - Number(a.walletBalanceUsd || 0));
  }, [users]);

  const totalWalletUsd = useMemo(
    () => walletHolders.reduce((s, u) => s + Number(u.walletBalanceUsd || 0), 0),
    [walletHolders]
  );
  
  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAdminUsers(getAdminHeaders, { limit: 5000 });
      setUsers(data);
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
  
  const updateRole = async (id: string, role: string) => {
    try {
      await fetch(`${getApiBase()}/users/${id}`, { method: 'PATCH', headers: ({ 'Content-Type': 'application/json', ...getAdminHeaders() } as HeadersInit), body: JSON.stringify({ role }) });
      await load();
    } catch (error) {
      console.error('Failed to update role:', error);
    }
  };
  
  const remove = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    try {
      await fetch(`${getApiBase()}/users/${id}`, { method: 'DELETE', headers: (getAdminHeaders() as HeadersInit) });
      await load();
    } catch (error) {
      console.error('Failed to delete user:', error);
    }
  };

  const testUpsert = async () => {
    try {
      const res = await fetch(`${getApiBase()}/users/upsert`, {
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
      <div className="card-dark p-5 rounded-xl border border-amber-500/40">
        <div className="flex items-center gap-2 mb-3">
          <Wallet className="w-5 h-5 text-amber-400" />
          <h3 className="text-lg font-bold text-white">Store Wallet balances</h3>
        </div>
        <p className="text-sm text-gray-400 mb-3">
          Users with a balance &gt; $0 among the loaded list (up to 5,000 accounts). Combined:{' '}
          <span className="text-amber-300 font-semibold">${totalWalletUsd.toFixed(2)} USD</span>
        </p>
        {loading ? (
          <p className="text-gray-500 text-sm">Loading…</p>
        ) : walletHolders.length === 0 ? (
          <p className="text-gray-500 text-sm">No balances in this batch.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-dark-border">
            <table className="w-full text-sm text-left">
              <thead className="bg-dark-bg text-gray-400">
                <tr>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2 text-right">Balance (USD)</th>
                  <th className="px-3 py-2 text-right">≈ MWK</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-border">
                {walletHolders.map((u) => {
                  const usd = Number(u.walletBalanceUsd || 0);
                  return (
                    <tr key={`w-${u.id}`} className="bg-dark-surface/80">
                      <td className="px-3 py-2 text-white">{u.email}</td>
                      <td className="px-3 py-2 text-gray-300">{u.name || '—'}</td>
                      <td className="px-3 py-2 text-right text-amber-300 font-semibold">${usd.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right text-gray-400">
                        {getMwkAmountFromUsd(usd, 'store_wallet').toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div className="text-gray-400">Total users loaded: {users.length}</div>
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
                <div className="text-gray-400 text-sm">
                  Name: {u.name || 'N/A'} · Role: {u.role || 'user'} · Points:{' '}
                  {(u.pointsBalance ?? 0).toLocaleString()} · Wallet:{' '}
                  <span className="text-amber-300">${Number(u.walletBalanceUsd || 0).toFixed(2)}</span>
                  {u.phone ? ` · Phone: ${u.phone}` : ''}
                </div>
                {(u.city || u.country || u.lastLoginAt || u.lastLoginIp) ? (
                  <div className="text-gray-500 text-xs mt-1">
                    Location:{' '}
                    {[u.city, u.region, u.country].filter(Boolean).join(', ') ||
                      (u.lastLoginIp ? `IP ${u.lastLoginIp}` : 'Not recorded yet')}
                    {u.lastLoginAt
                      ? ` · Last login ${new Date(u.lastLoginAt).toLocaleString()}`
                      : ' · Sign in required to capture location'}
                  </div>
                ) : (
                  <div className="text-gray-600 text-xs mt-1">
                    Location: not recorded yet — customer must sign in after this update
                  </div>
                )}
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
      console.log('ðŸ“¦ [TTOrders] Loading TT orders from:', `${getApiBase()}/ttorders`);
      const res = await fetch(`${getApiBase()}/ttorders`, { headers: getAdminHeaders() as HeadersInit });
      console.log('ðŸ“¥ [TTOrders] Response status:', res.status);
      
      if (!res.ok) {
        const errorText = await res.text();
        console.error('âŒ [TTOrders] Failed to load:', res.status, errorText);
        throw new Error(`Failed to load TT orders: ${res.status} ${res.statusText}`);
      }
      
      const data = await res.json();
      console.log('âœ… [TTOrders] Loaded', Array.isArray(data) ? data.length : 'non-array', 'orders');
      setOrders(Array.isArray(data) ? data : []);
    } catch (error: any) {
      console.error('âŒ [TTOrders] Error loading TT orders:', error);
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
      await fetch(`${getApiBase()}/ttorders/${id}/status`, {
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
      await fetch(`${getApiBase()}/ttorders/${id}`, {
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
      const res = await fetch(`${getApiBase()}/slides/all`, { headers: getAdminHeaders() });
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
      await fetch(`${getApiBase()}/slides`, { 
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
      await fetch(`${getApiBase()}/slides/${id}`, { 
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
      await fetch(`${getApiBase()}/slides/${id}`, { method: 'DELETE', headers: getAdminHeaders() });
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
                      Order: {slide.order} â€¢ {slide.active ? 'Active' : 'Inactive'} â€¢ {slide.cta && `CTA: ${slide.cta}`}
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
      const res = await fetch(`${getApiBase()}/chats/all`, { headers: getAdminHeaders() as HeadersInit });
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedChat?.id) {
      loadChatMessages(selectedChat.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChat?.id]);

  const refreshSelectedChat = () => {
    if (selectedChat?.id) {
      loadChatMessages(selectedChat.id);
    }
  };

  const loadChatMessages = async (chatId: string) => {
    try {
      const res = await fetch(`${getApiBase()}/chats/${chatId}`, { headers: getAdminHeaders() as HeadersInit });
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
      const res = await fetch(`${getApiBase()}/chats/${chatToJoin}/join`, {
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
          alert(`Error: The 'chat-images' bucket doesn't exist in Supabase Storage.\n\nPlease:\n1. Go to Supabase Dashboard â†’ Storage\n2. Create a new bucket named 'chat-images'\n3. Set it as public or create RLS policies allowing INSERT and SELECT for public or authenticated users.`);
        } else if (error.message.includes('row-level security') || error.message.includes('RLS')) {
          alert(`Error: Storage policy blocking upload.\n\nPlease:\n1. Go to Supabase Dashboard â†’ Storage â†’ chat-images bucket â†’ Policies\n2. Create a policy allowing INSERT and SELECT for public or authenticated users.`);
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

      const res = await fetch(`${getApiBase()}/chats/${selectedChat.id}/agent-message`, {
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
      const res = await fetch(`${getApiBase()}/chats/${chatId}/close`, {
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
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="px-3 py-1.5 rounded-lg bg-neon-blue text-white text-xs font-bold disabled:opacity-50"
          >
            {loading ? 'Refreshing…' : 'Refresh Chats'}
          </button>
        </div>
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
                <button
                  type="button"
                  onClick={refreshSelectedChat}
                  className="px-3 py-2 bg-dark-bg border border-dark-border text-gray-200 rounded-lg hover:border-neon-blue/50 text-sm"
                >
                  Refresh Messages
                </button>
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
                      Ã—
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
                    ðŸ“·
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

function PointsManager({ getAdminHeaders }: { getAdminHeaders: () => Record<string, string> }) {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [pointsToAdd, setPointsToAdd] = useState('');
  const [pointsReason, setPointsReason] = useState('');
  const [updating, setUpdating] = useState(false);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  const load = async (search?: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAdminUsers(getAdminHeaders, {
        search: search?.trim() || undefined,
        sort: 'points',
        limit: search?.trim() ? 100 : 5000,
      });
      setUsers(data);
    } catch (error: any) {
      console.error('Failed to load users:', error);
      setError(error.message || 'Failed to load users');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      load(searchTerm);
    }, searchTerm.trim() ? 300 : 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);

  const filteredUsers = users;

  const totalPoints = users.reduce((sum, user) => sum + (user.pointsBalance || 0), 0);
  const totalUsersWithPoints = users.filter(user => (user.pointsBalance || 0) > 0).length;

  const updateUserPoints = async (userId: string, points: number, reason: string) => {
    if (!points || points === 0) {
      alert('Please enter a valid number of points');
      return;
    }
    if (!reason.trim()) {
      alert('Please enter a reason for this points adjustment');
      return;
    }

    setUpdating(true);
    try {
      const res = await fetch(`${getApiBase()}/users/${userId}/points`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAdminHeaders() },
        body: JSON.stringify({
          points: parseInt(points.toString()),
          reason: reason.trim()
        })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Failed to update points');
      }

      await load(searchTerm);
      setEditingUser(null);
      setPointsToAdd('');
      setPointsReason('');
      alert('Points updated successfully!');
    } catch (error: any) {
      console.error('Failed to update points:', error);
      alert(`Failed to update points: ${error.message || 'Unknown error'}`);
    } finally {
      setUpdating(false);
    }
  };

  const resetAllPoints = async () => {
    if (
      !window.confirm(
        'Reset ALL user points balances to zero? This cannot be undone.'
      )
    ) {
      return;
    }
    if (
      !window.confirm(
        'Last chance: every account will lose their current points balance. Continue?'
      )
    ) {
      return;
    }

    setBulkActionLoading(true);
    try {
      const res = await fetch(`${getApiBase()}/users/points/bulk-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAdminHeaders() },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Failed to reset points');
      }
      await load(searchTerm);
      alert(
        `Reset complete. ${data.usersReset ?? 0} user(s) cleared (${(data.totalPointsRemoved ?? 0).toLocaleString()} points removed).`
      );
    } catch (error: any) {
      console.error('Failed to reset all points:', error);
      alert(`Failed to reset points: ${error.message || 'Unknown error'}`);
    } finally {
      setBulkActionLoading(false);
    }
  };

  const grantDollarToEveryone = async () => {
    if (
      !window.confirm(
        'Grant $1 worth of points (130 pts) to EVERY user account?'
      )
    ) {
      return;
    }

    setBulkActionLoading(true);
    try {
      const res = await fetch(`${getApiBase()}/users/points/bulk-grant-dollar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAdminHeaders() },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Failed to grant points');
      }
      await load(searchTerm);
      alert(
        `Grant complete. ${data.usersGranted ?? 0} user(s) received ${data.pointsPerUser ?? 130} points ($${data.usdValuePerUser ?? 1} each).`
      );
    } catch (error: any) {
      console.error('Failed to grant points to all users:', error);
      alert(`Failed to grant points: ${error.message || 'Unknown error'}`);
    } finally {
      setBulkActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card-dark p-4 border border-neon-blue/30">
          <div className="text-gray-400 text-sm mb-1">Total Points Issued</div>
          <div className="text-2xl font-bold text-neon-blue">{totalPoints.toLocaleString()}</div>
        </div>
        <div className="card-dark p-4 border border-neon-green/30">
          <div className="text-gray-400 text-sm mb-1">Users with Points</div>
          <div className="text-2xl font-bold text-neon-green">{totalUsersWithPoints}</div>
        </div>
        <div className="card-dark p-4 border border-purple-400/30">
          <div className="text-gray-400 text-sm mb-1">Points Value (USD)</div>
          <div className="text-2xl font-bold text-purple-400">
            ${((totalPoints / 1300) * 10).toFixed(2)}
          </div>
          <div className="text-xs text-gray-500 mt-1">1300 points = $10</div>
        </div>
      </div>

      {/* Bulk actions */}
      <div className="card-dark p-4 border border-amber-400/30">
        <h3 className="text-white font-semibold mb-3">Bulk actions</h3>
        <p className="text-gray-400 text-sm mb-4">
          Apply changes to every user account at once. Each action is logged in points transaction history.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={grantDollarToEveryone}
            disabled={bulkActionLoading || updating}
            className="px-4 py-2 bg-neon-green/20 border border-neon-green/50 text-neon-green rounded-lg text-sm font-semibold hover:bg-neon-green/30 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {bulkActionLoading ? 'Working...' : 'Grant $1 to Everyone (130 pts)'}
          </button>
          <button
            type="button"
            onClick={resetAllPoints}
            disabled={bulkActionLoading || updating}
            className="px-4 py-2 bg-red-500/20 border border-red-500/50 text-red-400 rounded-lg text-sm font-semibold hover:bg-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {bulkActionLoading ? 'Working...' : 'Reset All Balances to Zero'}
          </button>
        </div>
      </div>

      {/* Search */}
      <div>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by name or email (searches all accounts)..."
          className="w-full px-4 py-2 bg-dark-surface border border-dark-border rounded-lg text-white placeholder-gray-400"
        />
        {!searchTerm.trim() && users.length >= 5000 && (
          <p className="text-amber-300 text-xs mt-2">
            Showing top 5,000 accounts by points. Search to find any other user.
          </p>
        )}
      </div>

      {/* Users Table */}
      {loading ? (
        <div className="text-center py-8 text-gray-400">Loading users...</div>
      ) : error ? (
        <div className="text-center py-8 text-red-400">{error}</div>
      ) : filteredUsers.length === 0 ? (
        <div className="text-center py-8 text-gray-400">No users found</div>
      ) : (
        <div className="card-dark overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-dark-border">
                <th className="text-left p-4 text-white font-semibold">User</th>
                <th className="text-left p-4 text-white font-semibold">Email</th>
                <th className="text-right p-4 text-white font-semibold">Points Balance</th>
                <th className="text-right p-4 text-white font-semibold">USD Value</th>
                <th className="text-left p-4 text-white font-semibold">Member Since</th>
                <th className="text-center p-4 text-white font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => {
                const pointsValue = ((user.pointsBalance || 0) / 1300) * 10;
                return (
                  <tr key={user.id} className="border-b border-dark-border hover:bg-dark-surface/50">
                    <td className="p-4">
                      <div className="flex items-center space-x-3">
                        {user.avatarUrl ? (
                          <img src={user.avatarUrl} alt={user.name} className="w-10 h-10 rounded-full" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-neon-blue/20 flex items-center justify-center">
                            <span className="text-neon-blue font-bold">
                              {user.name?.charAt(0).toUpperCase() || 'U'}
                            </span>
                          </div>
                        )}
                        <div>
                          <div className="text-white font-medium">{user.name || 'Unknown'}</div>
                          <div className="text-gray-400 text-xs">{user.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-gray-300">{user.email}</td>
                    <td className="p-4 text-right">
                      <span className="text-neon-blue font-bold text-lg">
                        {(user.pointsBalance || 0).toLocaleString()}
                      </span>
                      <span className="text-gray-400 text-sm ml-1">pts</span>
                    </td>
                    <td className="p-4 text-right">
                      <span className="text-neon-green font-semibold">
                        ${pointsValue.toFixed(2)}
                      </span>
                    </td>
                    <td className="p-4 text-gray-400 text-sm">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="p-4">
                      {editingUser === user.id ? (
                        <div className="space-y-2 min-w-[200px]">
                          <input
                            type="number"
                            value={pointsToAdd}
                            onChange={(e) => setPointsToAdd(e.target.value)}
                            placeholder="Points to add/remove"
                            className="w-full px-2 py-1 bg-dark-surface border border-dark-border rounded text-white text-sm"
                          />
                          <input
                            type="text"
                            value={pointsReason}
                            onChange={(e) => setPointsReason(e.target.value)}
                            placeholder="Reason (required)"
                            className="w-full px-2 py-1 bg-dark-surface border border-dark-border rounded text-white text-sm"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => updateUserPoints(user.id, parseInt(pointsToAdd) || 0, pointsReason)}
                              disabled={updating || !pointsToAdd || !pointsReason.trim()}
                              className="px-3 py-1 bg-neon-blue text-white rounded text-xs font-semibold hover:bg-neon-blue/80 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {updating ? 'Saving...' : 'Save'}
                            </button>
                            <button
                              onClick={() => {
                                setEditingUser(null);
                                setPointsToAdd('');
                                setPointsReason('');
                              }}
                              className="px-3 py-1 bg-dark-surface border border-dark-border text-white rounded text-xs font-semibold hover:bg-dark-card"
                            >
                              Cancel
                            </button>
                          </div>
                          <div className="text-xs text-gray-500">
                            Use negative number to remove points (e.g., -100)
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingUser(user.id);
                            setPointsToAdd('');
                            setPointsReason('');
                          }}
                          className="px-3 py-1 bg-neon-blue/20 border border-neon-blue/50 text-neon-blue rounded text-xs font-semibold hover:bg-neon-blue/30"
                        >
                          Adjust Points
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Points System Info */}
      <div className="card-dark p-6 border border-neon-blue/30">
        <h3 className="text-white font-bold mb-4 flex items-center">
          <span className="text-2xl mr-2">🎁</span>
          TConnect Points — Terms &amp; Conditions
        </h3>
        <div className="space-y-2 text-gray-300 text-sm">
          <div className="flex items-start space-x-2">
            <span className="text-neon-green mt-0.5">✓</span>
            <span><strong>Earning:</strong> Users earn 2 points for every $10 spent on approved paid orders</span>
          </div>
          <div className="flex items-start space-x-2">
            <span className="text-neon-blue mt-0.5">✓</span>
            <span><strong>Redemption:</strong> 1300 points = $10 USD value at checkout</span>
          </div>
          <div className="flex items-start space-x-2">
            <span className="text-purple-400 mt-0.5">✓</span>
            <span><strong>Minimum balance:</strong> Users need at least 1,300 points ($10 value) before they can redeem</span>
          </div>
          <div className="flex items-start space-x-2">
            <span className="text-amber-300 mt-0.5">✓</span>
            <span><strong>Purchase requirement:</strong> Users must have more than $20 in approved TConnect store purchases before redeeming points — spin-only points cannot be saved up without real purchases</span>
          </div>
          <div className="flex items-start space-x-2">
            <span className="text-gray-400 mt-0.5">✓</span>
            <span><strong>Points expiry:</strong> Points do not expire, but redemption rules above always apply</span>
          </div>
        </div>
      </div>
    </div>
  );
}
