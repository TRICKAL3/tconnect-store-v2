import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { ArrowLeft, Package, Clock, CheckCircle, XCircle, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { getApiBase, getAbsoluteImageUrl } from '../lib/getApiBase';
import {
  isVirtualCardOrderItem,
  parseVirtualCardDetailsList,
} from '../lib/virtualCardCodes';
import { parseUtilityBillCodes } from '../lib/utilityBillCodes';

const OrderHistory: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [visibleCodes, setVisibleCodes] = useState<Record<string, boolean>>({}); // Track which item's codes are visible

  const loadOrders = async () => {
    if (!user?.email) {
      console.log('⏳ [OrderHistory] No user email available', { 
        user, 
        hasUser: !!user, 
        hasEmail: !!user?.email,
        authLoading 
      });
      setLoading(false);
      setOrders([]);
      setError('User email not available. Please try signing out and signing back in.');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const API_BASE = getApiBase();
      const url = `${API_BASE}/orders/me?email=${encodeURIComponent(user.email)}`;
      console.log('📤 [OrderHistory] Fetching orders for:', user.email, 'from:', url);
      console.log('📤 [OrderHistory] API Base:', API_BASE);
      
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        // Don't include credentials to avoid CORS issues
      });
      console.log('📥 [OrderHistory] Response status:', res.status, res.statusText);
      
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data?.orders ?? []);
        const userNotFound = data?.userNotFound === true;
        console.log('✅ [OrderHistory] Orders loaded:', list.length, 'orders', userNotFound ? '(userNotFound)' : '');
        setOrders(list);
        setError(userNotFound ? 'Account not synced. Please sign out and sign back in to see your orders.' : null);
      } else {
        const errorText = await res.text();
        console.error('❌ [OrderHistory] Failed to load orders:', {
          status: res.status,
          statusText: res.statusText,
          error: errorText
        });
        setOrders([]);
        setError(`Failed to load orders: ${res.statusText}. Please try refreshing.`);
      }
    } catch (err: any) {
      console.error('❌ [OrderHistory] Error loading orders:', err);
      setOrders([]);
      setError(`Network error: ${err.message}. Please check your connection and try again.`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Wait for auth to finish loading
    if (authLoading) {
      console.log('⏳ [OrderHistory] Auth still loading...');
      setLoading(true);
      return;
    }

    loadOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.email, user, authLoading]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
      case 'fulfilled':
      case 'done':
        return <CheckCircle className="w-5 h-5 text-green-400" />;
      case 'rejected':
      case 'denied':
      case 'fail':
        return <XCircle className="w-5 h-5 text-red-400" />;
      case 'pending':
      default:
        return <Clock className="w-5 h-5 text-yellow-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
      case 'fulfilled':
      case 'done':
        return 'bg-green-400/20 text-green-400 border-green-400';
      case 'rejected':
      case 'denied':
      case 'fail':
        return 'bg-red-400/20 text-red-400 border-red-400';
      case 'pending':
      default:
        return 'bg-yellow-400/20 text-yellow-400 border-yellow-400';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'approved':
      case 'fulfilled':
      case 'done':
        return 'Done';
      case 'rejected':
      case 'denied':
      case 'fail':
        return 'Denied';
      case 'pending':
      default:
        return 'Pending';
    }
  };

  // Show loading while auth is initializing
  if (authLoading) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-400 mb-4">Loading...</div>
        </div>
      </div>
    );
  }

  // Show sign-in prompt if no user after auth has loaded
  if (!user) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400 mb-4">Please sign in to view your orders</p>
          <Link to="/signin" className="btn-cyber text-white px-6 py-3 rounded-lg inline-block">
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-bg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-8">
        {/* Mobile App Style Header */}
        <div className="flex items-center mb-4 md:mb-6 sticky top-0 bg-dark-bg z-10 py-3 md:py-0 md:relative">
          <Link to="/" className="inline-flex items-center text-gray-400 hover:text-neon-blue transition-colors mr-3">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-xl md:text-3xl font-bold text-white flex-1">Order History</h1>
          <button
            onClick={loadOrders}
            disabled={loading}
            className="ml-2 p-2 text-gray-400 hover:text-neon-blue transition-colors disabled:opacity-50"
            title="Refresh orders"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-4 bg-red-400/20 border border-red-400/30 rounded-lg text-red-300 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <div className="text-gray-400">Loading orders...</div>
          </div>
        ) : orders.length === 0 ? (
          <div className="card-dark p-8 rounded-2xl text-center">
            <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-400 text-lg mb-4">No orders yet</p>
            <Link to="/" className="btn-cyber text-white px-6 py-3 rounded-lg inline-block">
              Start Shopping
            </Link>
          </div>
        ) : (
          <div className="space-y-3 md:space-y-4">
            {orders.map((order) => (
              <div key={order.id} className="card-dark p-4 md:p-6 rounded-xl md:rounded-2xl border border-dark-border">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-3 md:mb-4 gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center flex-wrap gap-2 mb-2">
                      <Package className="w-4 h-4 md:w-5 md:h-5 text-neon-blue flex-shrink-0" />
                      <span className="text-white font-bold text-sm md:text-base truncate">Order #{order.id.slice(0, 8)}</span>
                      {getStatusIcon(order.status)}
                      <span
                        className={`px-2 md:px-3 py-0.5 md:py-1 rounded-full text-xs font-bold border flex-shrink-0 ${getStatusColor(
                          order.status
                        )}`}
                      >
                        {getStatusLabel(order.status || 'pending')}
                      </span>
                      {order.isExpired && order.status === 'pending' && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-gray-600 text-gray-300 border border-gray-500">
                          Expired
                        </span>
                      )}
                    </div>
                    {order.isExpired && order.status === 'pending' && (
                      <p className="text-gray-500 text-xs mt-1">Payment window closed. Create a new order to pay.</p>
                    )}
                    <p className="text-gray-400 text-xs md:text-sm">
                      {new Date(order.createdAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <div className="text-left md:text-right flex-shrink-0">
                    <div className="text-white font-bold text-base md:text-lg">
                      MWK {order.totalMwk?.toLocaleString()}
                    </div>
                    <div className="text-gray-400 text-xs md:text-sm">
                      ${order.totalUsd?.toFixed(2)} USD
                    </div>
                  </div>
                </div>

                <div className="border-t border-dark-border pt-3 md:pt-4 mt-3 md:mt-4">
                  <h3 className="text-gray-300 font-semibold mb-2 md:mb-3 text-sm md:text-base">Items:</h3>
                  <div className="space-y-2">
                    {order.items?.map((item: any, idx: number) => {
                      let codes = null;
                      let virtualCards: ReturnType<typeof parseVirtualCardDetailsList> = [];
                      const isVirtual = isVirtualCardOrderItem(item);
                      try {
                        const parsed = item.giftCardCodes
                          ? typeof item.giftCardCodes === 'string'
                            ? JSON.parse(item.giftCardCodes)
                            : item.giftCardCodes
                          : null;
                        if (isVirtual && parsed) {
                          virtualCards = parseVirtualCardDetailsList({ giftCardCodes: parsed });
                        } else if (item.type === 'utility-bill') {
                          codes = parseUtilityBillCodes(parsed);
                        } else if (!isVirtual) {
                          codes = parsed;
                        }
                      } catch (e) {
                        console.error('Failed to parse codes:', e);
                      }

                      // Only show codes/links if order is fulfilled/approved/done
                      const orderComplete = order.status === 'fulfilled' || order.status === 'approved' || order.status === 'done';

                      return (
                        <div key={idx} className="p-2 md:p-3 bg-dark-surface rounded-lg">
                          <div className="flex items-center space-x-2 md:space-x-3">
                            {getAbsoluteImageUrl(item.image) ? (
                              <img
                                src={getAbsoluteImageUrl(item.image)}
                                alt={item.name}
                                className="w-10 h-10 md:w-12 md:h-12 rounded object-cover flex-shrink-0"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                  if (e.currentTarget.nextElementSibling) {
                                    (e.currentTarget.nextElementSibling as HTMLElement).classList.remove('hidden');
                                  }
                                }}
                              />
                            ) : null}
                            <div className={`w-10 h-10 md:w-12 md:h-12 bg-dark-bg rounded flex items-center justify-center flex-shrink-0 ${getAbsoluteImageUrl(item.image) ? 'hidden' : ''}`}>
                              <span className="text-white text-xs md:text-sm">{item.name?.charAt(0).toUpperCase() || '?'}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-white font-medium text-sm md:text-base truncate">{item.name}</p>
                              <p className="text-gray-400 text-xs md:text-sm">
                                {item.type} • Qty: {item.quantity} • ${item.priceUsd?.toFixed(2)}
                              </p>
                            </div>
                          </div>
                          
                          {/* Gift Card Codes Section - Only show button when order is fulfilled */}
                          {!isVirtual && item.type === 'giftcard' && codes && codes.length > 0 && orderComplete && (
                            <div className="mt-3">
                              {!visibleCodes[`${order.id}-${idx}`] ? (
                                <button
                                  onClick={() => {
                                    setVisibleCodes({ ...visibleCodes, [`${order.id}-${idx}`]: true });
                                  }}
                                  className="w-full px-3 md:px-4 py-2 bg-yellow-400/20 border border-yellow-400/30 rounded-lg text-yellow-300 hover:bg-yellow-400/30 active:scale-95 transition-all flex items-center justify-center gap-2"
                                >
                                  <Eye className="w-4 h-4" />
                                  <span className="font-semibold text-sm md:text-base">View Redeem Codes</span>
                                </button>
                              ) : (
                                <div className="p-3 md:p-4 bg-yellow-400/10 border border-yellow-400/30 rounded-lg">
                                  <div className="flex items-center justify-between mb-2 md:mb-3">
                                    <div className="text-yellow-400 font-bold text-xs md:text-sm">🎁 Review Your Gift Card Codes:</div>
                                    <button
                                      onClick={() => {
                                        setVisibleCodes({ ...visibleCodes, [`${order.id}-${idx}`]: false });
                                      }}
                                      className="px-2 md:px-3 py-1 bg-dark-bg border border-yellow-400/30 rounded text-yellow-300 hover:bg-yellow-400/20 active:scale-95 transition-all flex items-center gap-1 text-xs"
                                    >
                                      <EyeOff className="w-3 h-3" />
                                      Hide
                                    </button>
                                  </div>
                                  <div className="space-y-2 md:space-y-3">
                                    {codes.map((code: any, codeIdx: number) => {
                                      // Handle both old format (string) and new format (object)
                                      const serialNumber = typeof code === 'object' ? code.serialNumber : null;
                                      const redeemCode = typeof code === 'object' ? code.redeemCode : code;
                                      const displaySerial = serialNumber || (typeof code === 'object' ? code : 'N/A');
                                      
                                      return (
                                        <div key={codeIdx} className="p-2 md:p-3 bg-dark-bg rounded border border-yellow-400/20">
                                          <div className="text-yellow-300 font-semibold text-xs mb-2">Gift Card #{codeIdx + 1}</div>
                                          <div className="space-y-2">
                                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                              <div className="flex-1 min-w-0">
                                                <div className="text-gray-400 text-xs mb-1">Serial Number:</div>
                                                <span className="font-mono text-yellow-300 text-xs md:text-sm break-all">{displaySerial}</span>
                                              </div>
                                              <button
                                                onClick={() => {
                                                  navigator.clipboard.writeText(displaySerial);
                                                  alert('Serial number copied to clipboard!');
                                                }}
                                                className="px-2 py-1.5 bg-yellow-400/20 text-yellow-300 rounded text-xs hover:bg-yellow-400/30 active:scale-95 transition-all flex-shrink-0"
                                              >
                                                Copy
                                              </button>
                                            </div>
                                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-2 border-t border-yellow-400/10">
                                              <div className="flex-1 min-w-0">
                                                <div className="text-gray-400 text-xs mb-1">Redeem Code:</div>
                                                <span className="font-mono text-yellow-300 text-xs md:text-sm break-all">{redeemCode}</span>
                                              </div>
                                              <button
                                                onClick={() => {
                                                  navigator.clipboard.writeText(redeemCode);
                                                  alert('Redeem code copied to clipboard!');
                                                }}
                                                className="px-2 py-1.5 bg-yellow-400/20 text-yellow-300 rounded text-xs hover:bg-yellow-400/30 active:scale-95 transition-all flex-shrink-0"
                                              >
                                                Copy
                                              </button>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                  <p className="text-yellow-300/70 text-xs mt-2 md:mt-3">
                                    Please save these codes securely. You can use the redeem code to redeem your gift cards.
                                  </p>
                                </div>
                              )}
                            </div>
                          )}
                          
                          {/* Utility bill — processing or token */}
                          {item.type === 'utility-bill' && (!codes || !codes.length) && order.status === 'pending' && (
                            <p className="text-amber-300/80 text-xs mt-3 px-1">
                              Payment received — your bill is being paid. The token will appear here shortly. Tap refresh above if needed.
                            </p>
                          )}
                          {item.type === 'utility-bill' && codes && codes.length > 0 && (
                            <div className="mt-3">
                              {!visibleCodes[`${order.id}-${idx}`] ? (
                                <button
                                  onClick={() => {
                                    setVisibleCodes({ ...visibleCodes, [`${order.id}-${idx}`]: true });
                                  }}
                                  className="w-full px-3 md:px-4 py-2 bg-amber-400/20 border border-amber-400/30 rounded-lg text-amber-300 hover:bg-amber-400/30 active:scale-95 transition-all flex items-center justify-center gap-2"
                                >
                                  <Eye className="w-4 h-4" />
                                  <span className="font-semibold text-sm md:text-base">View bill token</span>
                                </button>
                              ) : (
                                <div className="p-3 md:p-4 bg-amber-400/10 border border-amber-400/30 rounded-lg">
                                  <div className="text-amber-400 font-bold text-xs md:text-sm mb-2">⚡ Utility token</div>
                                  {codes.map((entry: any, ti: number) => (
                                    <div key={ti} className="p-2 bg-dark-bg rounded border border-amber-400/20 mb-2">
                                      <div className="text-gray-400 text-xs mb-1">Token / receipt</div>
                                      <div className="font-mono text-amber-200 text-sm break-all">{entry.token || entry.receipt || '—'}</div>
                                      {(entry.customerName || entry.biller) && (
                                        <p className="text-xs text-gray-500 mt-1">
                                          {entry.customerName && <span className="text-amber-300/90">{entry.customerName} · </span>}
                                          {entry.biller} · {entry.account}
                                          {entry.amountMwk ? ` · MWK ${Number(entry.amountMwk).toLocaleString()}` : ''}
                                        </p>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Virtual card — manage in My Cards */}
                          {isVirtual && orderComplete && (
                            <div className="mt-3 p-3 md:p-4 bg-neon-blue/10 border border-neon-blue/30 rounded-lg">
                              <p className="text-sm text-gray-300 mb-2">
                                Your TConnect virtual card is ready. View balance, status, and transactions in My Cards.
                              </p>
                              <Link
                                to="/profile#my-cards"
                                className="inline-flex items-center gap-2 text-sm font-semibold text-neon-blue hover:underline"
                              >
                                Click here to manage your card →
                              </Link>
                            </div>
                          )}

                          {/* Virtual Card Details */}
                          {isVirtual && virtualCards.length > 0 && orderComplete && (
                            <div className="mt-3">
                              {!visibleCodes[`${order.id}-${idx}`] ? (
                                <button
                                  onClick={() => {
                                    setVisibleCodes({ ...visibleCodes, [`${order.id}-${idx}`]: true });
                                  }}
                                  className="w-full px-3 md:px-4 py-2 bg-blue-400/20 border border-blue-400/30 rounded-lg text-blue-300 hover:bg-blue-400/30 active:scale-95 transition-all flex items-center justify-center gap-2"
                                >
                                  <Eye className="w-4 h-4" />
                                  <span className="font-semibold text-sm md:text-base">View Card Details</span>
                                </button>
                              ) : (
                                <div className="p-3 md:p-4 bg-blue-400/10 border border-blue-400/30 rounded-lg">
                                  <div className="flex items-center justify-between mb-2 md:mb-3">
                                    <div className="text-blue-400 font-bold text-xs md:text-sm">💳 Your Virtual Card:</div>
                                    <button
                                      onClick={() => {
                                        setVisibleCodes({ ...visibleCodes, [`${order.id}-${idx}`]: false });
                                      }}
                                      className="px-2 md:px-3 py-1 bg-dark-bg border border-blue-400/30 rounded text-blue-300 hover:bg-blue-400/20 active:scale-95 transition-all flex items-center gap-1 text-xs"
                                    >
                                      <EyeOff className="w-3 h-3" />
                                      Hide
                                    </button>
                                  </div>
                                  <div className="space-y-2 md:space-y-3">
                                    {virtualCards.map((card, linkIdx) => (
                                      <div key={linkIdx} className="p-2 md:p-3 bg-dark-bg rounded border border-blue-400/20">
                                        <div className="text-blue-300 font-semibold text-xs mb-2">
                                          Card #{linkIdx + 1}
                                        </div>
                                        <div className="space-y-2 text-xs md:text-sm">
                                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                            <div>
                                              <div className="text-gray-400 text-xs mb-1">Card number</div>
                                              <span className="font-mono text-blue-300 break-all">{card.cardNumber}</span>
                                            </div>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                navigator.clipboard.writeText(card.cardNumber);
                                                alert('Card number copied!');
                                              }}
                                              className="px-2 py-1.5 bg-blue-400/20 text-blue-300 rounded text-xs hover:bg-blue-400/30"
                                            >
                                              Copy
                                            </button>
                                          </div>
                                          <div className="flex flex-wrap gap-4 pt-2 border-t border-blue-400/10">
                                            <div>
                                              <div className="text-gray-400 text-xs mb-1">Expire date</div>
                                              <span className="font-mono text-blue-300">{card.expireDate}</span>
                                            </div>
                                            <div>
                                              <div className="text-gray-400 text-xs mb-1">CVV</div>
                                              <span className="font-mono text-blue-300">{card.cvv}</span>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                  <p className="text-blue-300/70 text-xs mt-2 md:mt-3">
                                    Save these details securely. Do not share your CVV.{' '}
                                    <Link to="/profile#my-cards" className="text-neon-blue hover:underline font-medium">
                                      Click here to manage your card
                                    </Link>
                                    .
                                  </p>
                                </div>
                              )}
                            </div>
                          )}
                          
                          {/* Show message if gift card but codes not available yet */}
                          {item.type === 'giftcard' && (!codes || codes.length === 0) && !orderComplete && (
                            <div className="mt-3 p-3 bg-gray-400/10 border border-gray-400/30 rounded-lg">
                              <p className="text-gray-400 text-xs">Gift card codes will be available after your order is fulfilled.</p>
                            </div>
                          )}
                          
                          {/* Show message if virtual card but links not available yet */}
                          {isVirtual && virtualCards.length === 0 && !orderComplete && (
                            <div className="mt-3 p-3 bg-gray-400/10 border border-gray-400/30 rounded-lg">
                              <p className="text-gray-400 text-xs">Card details will be available after your order is fulfilled.</p>
                            </div>
                          )}
                          {isVirtual && virtualCards.length === 0 && orderComplete && (
                            <div className="mt-3 p-3 bg-gray-400/10 border border-gray-400/30 rounded-lg">
                              <p className="text-gray-400 text-xs">Card details are being prepared. Contact support if this persists.</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default OrderHistory;
