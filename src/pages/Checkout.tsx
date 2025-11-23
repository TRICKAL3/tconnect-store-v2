import React, { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CreditCard, Shield, CheckCircle, Building2, Gift, Download } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { getMwkAmountFromUsd } from '../utils/rates';
import { getApiBase } from '../lib/getApiBase';
import { supabase } from '../lib/supabaseClient';

const Checkout: React.FC = () => {
  const { state, dispatch } = useCart();
  const { user } = useAuth();
  const [paymentMethod, setPaymentMethod] = useState<'bank' | 'card' | 'points'>('bank');
  const [selectedPointsPackage, setSelectedPointsPackage] = useState<650 | 1300 | null>(null);
  const [pointsReceiptFile, setPointsReceiptFile] = useState<File | null>(null);
  const [pointsReceiptId, setPointsReceiptId] = useState<string | null>(null);
  
  // Handle payment method change
  const handlePaymentMethodChange = (method: 'bank' | 'card' | 'points') => {
    setPaymentMethod(method);
    if (method !== 'points') {
      setSelectedPointsPackage(null);
      setPointsReceiptFile(null);
    }
  };
  const [isProcessing, setIsProcessing] = useState(false);
  const [orderComplete, setOrderComplete] = useState(false);
  const [senderName, setSenderName] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [popFile, setPopFile] = useState<File | null>(null);
  const [pointsBalance, setPointsBalance] = useState(0);

  const itemMwk = (type: 'giftcard' | 'crypto' | 'wallet' | 'virtual-card', usd: number) => {
    // Digital wallets & cards (wallet and virtual-card) use wallet rate
    const rateType = (type === 'wallet' || type === 'virtual-card') ? 'wallet' : type === 'crypto' ? 'crypto' : 'giftcard';
    return getMwkAmountFromUsd(usd, rateType);
  };

  const totalMwk = useMemo(() => {
    return state.items.reduce((sum, item) => sum + itemMwk(item.type as any, item.price) * item.quantity, 0);
  }, [state.items]);

  // Fetch user points balance
  useEffect(() => {
    const fetchPoints = async () => {
      if (user?.email) {
        try {
          const API_BASE = getApiBase();
          const res = await fetch(`${API_BASE}/users/profile?email=${encodeURIComponent(user.email)}`);
          if (res.ok) {
            const data = await res.json();
            setPointsBalance(data.pointsBalance || 0);
          }
        } catch (error) {
          console.error('Failed to fetch points:', error);
        }
      }
    };
    fetchPoints();
  }, [user]);

  // Points packages: 650 points = $5, 1300 points = $10
  const pointsPackages = [
    { points: 650, usd: 5 },
    { points: 1300, usd: 10 }
  ];

  // Calculate final totals based on payment method
  const finalTotalUsd = useMemo(() => {
    if (paymentMethod === 'points' && selectedPointsPackage) {
      const packageUsd = selectedPointsPackage === 650 ? 5 : 10;
      return Math.max(0, state.total - packageUsd);
    }
    return state.total;
  }, [paymentMethod, selectedPointsPackage, state.total]);

  const finalTotalMwk = useMemo(() => {
    if (paymentMethod === 'points' && selectedPointsPackage) {
      const packageUsd = selectedPointsPackage === 650 ? 5 : 10;
      const discountRatio = packageUsd / state.total;
      return state.items.reduce((sum, item) => {
        const itemUsd = item.price * item.quantity;
        const itemDiscount = itemUsd * discountRatio;
        const finalItemUsd = Math.max(0, itemUsd - itemDiscount);
        return sum + itemMwk(item.type as any, finalItemUsd / item.quantity) * item.quantity;
      }, 0);
    }
    return totalMwk;
  }, [paymentMethod, selectedPointsPackage, state.items, state.total, totalMwk]);

  // Generate points redemption receipt
  const generatePointsReceipt = async () => {
    if (!selectedPointsPackage || !user) return;
    
    const packageUsd = selectedPointsPackage === 650 ? 5 : 10;
    const receiptId = `PTS-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`;
    
    // Record receipt in database
    try {
      const API_BASE = getApiBase();
      const userResponse = await fetch(`${API_BASE}/users/profile?email=${encodeURIComponent(user.email)}`);
      if (!userResponse.ok) {
        throw new Error('Failed to fetch user info');
      }
      const userData = await userResponse.json();
      
      const receiptResponse = await fetch(`${API_BASE}/users/receipts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiptId,
          userId: userData.id,
          customerName: user.name || user.email,
          email: user.email,
          points: selectedPointsPackage,
          usdValue: packageUsd
        })
      });
      
      if (!receiptResponse.ok) {
        const error = await receiptResponse.json();
        throw new Error(error.error || 'Failed to record receipt');
      }
      
      // Store receipt ID for order submission
      setPointsReceiptId(receiptId);
      console.log('✅ Receipt recorded:', receiptId);
    } catch (error: any) {
      console.error('Error recording receipt:', error);
      alert(`Failed to record receipt: ${error.message}\n\nPlease try again.`);
      return;
    }
    
    const receiptWindow = window.open('', '_blank');
    if (!receiptWindow) return;

    const receiptHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Points Redemption Receipt</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; color: #333; }
            .header { display: flex; justify-content: space-between; margin-bottom: 30px; border-bottom: 2px solid #000; padding-bottom: 20px; }
            .logo { max-height: 100px; max-width: 250px; object-fit: contain; }
            .receipt-details { margin: 30px 0; }
            .info-row { margin: 10px 0; }
            .info-label { font-weight: bold; display: inline-block; width: 150px; }
            .package-box { background: #f0f0f0; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #666; }
            @media print { body { margin: 20px; } }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <img src="/tconnect_logo-removebg-preview.png" alt="TConnect Logo" class="logo" />
            </div>
            <div>
              <div style="font-weight: bold; font-size: 20px; margin-bottom: 10px;">POINTS REDEMPTION RECEIPT</div>
              <div>Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
              <div>Time: ${new Date().toLocaleTimeString()}</div>
            </div>
          </div>
          
          <div class="receipt-details">
            <div class="info-row">
              <span class="info-label">Customer Name:</span>
              <span>${user.name || user.email}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Email:</span>
              <span>${user.email}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Receipt ID:</span>
              <span>${receiptId}</span>
            </div>
          </div>

          <div class="package-box">
            <h3 style="margin-top: 0;">Redemption Package</h3>
            <div class="info-row">
              <span class="info-label">Points Redeemed:</span>
              <span style="font-size: 24px; font-weight: bold; color: #00d4ff;">${selectedPointsPackage.toLocaleString()} points</span>
            </div>
            <div class="info-row">
              <span class="info-label">USD Value:</span>
              <span style="font-size: 20px; font-weight: bold; color: #00ff88;">$${packageUsd.toFixed(2)}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Redemption Rate:</span>
              <span>1300 points = $10 USD</span>
            </div>
          </div>

          <div style="margin: 30px 0; padding: 15px; background: #fff3cd; border-left: 4px solid #ffc107;">
            <strong>Important:</strong> Please save this receipt and upload it during checkout to complete your points redemption order.
          </div>

          <div class="footer">
            <p>This is a points redemption receipt for TConnect Store</p>
            <p>Points will be deducted upon order approval</p>
            <p>Thank you for using TConnect Points!</p>
          </div>
        </body>
      </html>
    `;

    receiptWindow.document.write(receiptHtml);
    receiptWindow.document.close();
    setTimeout(() => {
      receiptWindow.print();
    }, 250);
  };

  const handleCheckout = async () => {
    // Validate required fields
    if (paymentMethod === 'bank' && !senderName) {
      alert('Please enter your sender name');
      return;
    }
    if (paymentMethod === 'points') {
      if (!selectedPointsPackage) {
        alert('Please select a points package');
        return;
      }
      if (!pointsReceiptFile) {
        alert('Please upload your points redemption receipt');
        return;
      }
      // If there's a remainder, require bank transfer details
      if (finalTotalUsd > 0 && !senderName) {
        alert('Please enter your sender name for the remaining bank transfer amount');
        return;
      }
    }
    // Note: POP is recommended but not blocking if upload fails

    setIsProcessing(true);
    try {
      let popUrl: string | null = null;
      let receiptUrl: string | null = null;
      
      // Upload points receipt if paying with points
      if (paymentMethod === 'points' && pointsReceiptFile) {
        try {
          const path = `receipts/points/${Date.now()}-${pointsReceiptFile.name}`;
          const { data, error } = await supabase.storage.from('receipts').upload(path, pointsReceiptFile, { upsert: false });
          if (error) {
            console.error('Points receipt upload error:', error);
            alert(`Failed to upload points receipt: ${error.message}\n\nPlease try again.`);
            setIsProcessing(false);
            return;
          } else {
            const { data: pub } = supabase.storage.from('receipts').getPublicUrl(data.path);
            receiptUrl = pub.publicUrl;
            console.log('Points receipt uploaded successfully:', receiptUrl);
          }
        } catch (uploadError: any) {
          console.error('Points receipt upload exception:', uploadError);
          alert(`Error uploading points receipt: ${uploadError.message}\n\nPlease try again.`);
          setIsProcessing(false);
          return;
        }
      }
      
      // Upload bank POP if paying with bank
      if (popFile) {
        try {
          const path = `receipts/${Date.now()}-${popFile.name}`;
          const { data, error } = await supabase.storage.from('receipts').upload(path, popFile, { upsert: false });
          if (error) {
            console.error('POP upload error:', error);
            if (error.message.includes('Bucket') || error.message.includes('not found')) {
              alert(`The 'receipts' bucket doesn't exist in Supabase Storage.\n\nPlease:\n1. Go to Supabase Dashboard → Storage\n2. Create a new bucket named 'receipts'\n3. Set it as public or create RLS policies\n\nYour order can still be submitted without POP.`);
            } else if (error.message.includes('row-level security') || error.message.includes('RLS')) {
              alert(`Storage policy blocking upload.\n\nPlease:\n1. Go to Supabase Dashboard → Storage → receipts bucket → Policies\n2. Create a policy allowing INSERT for public or authenticated users\n\nYour order can still be submitted without POP.`);
            } else {
              alert(`Failed to upload proof of payment: ${error.message}\n\nYour order can still be submitted. You can upload POP later by contacting support.`);
            }
            // Continue without POP URL - order can still be created
            popUrl = null;
          } else {
            const { data: pub } = supabase.storage.from('receipts').getPublicUrl(data.path);
            popUrl = pub.publicUrl;
            console.log('POP uploaded successfully:', popUrl);
          }
        } catch (uploadError: any) {
          console.error('POP upload exception:', uploadError);
          alert(`Error uploading POP: ${uploadError.message}\n\nYour order can still be submitted without POP.`);
          popUrl = null;
        }
      }
      const totalMwkInt = Math.round(finalTotalMwk);
      const API_BASE = getApiBase();
      const url = `${API_BASE}/orders`;
      
      console.log('🛒 [Checkout] Submitting order to:', url);
      console.log('🛒 [Checkout] Order data:', {
        itemsCount: state.items.length,
        totalUsd: state.total,
        totalMwk: totalMwkInt,
        userEmail: user?.email
      });
      
      const requestBody: any = {
        items: state.items,
        totalUsd: finalTotalUsd,
        totalMwk: Math.round(finalTotalMwk),
        userEmail: user?.email,
        paymentMethod: paymentMethod,
      };

      // Add points redemption info if paying with points
      if (paymentMethod === 'points' && selectedPointsPackage) {
        requestBody.pointsUsed = selectedPointsPackage;
        requestBody.pointsReceiptUrl = receiptUrl;
        requestBody.pointsReceiptId = pointsReceiptId; // Include receipt ID for verification
        
        // If there's a remainder, include bank payment info
        if (finalTotalUsd > 0 && senderName) {
          requestBody.payment = {
            bankName: 'National Bank of Malawi',
            accountName: 'TrickalHoldings',
            accountNumber: '1011725615',
            transactionId,
            popUrl,
            senderName
          };
        }
      }

      // Add bank payment info if paying with bank only
      if (paymentMethod === 'bank') {
        requestBody.payment = {
          bankName: 'National Bank of Malawi',
          accountName: 'TrickalHoldings',
          accountNumber: '1011725615',
          transactionId,
          popUrl,
          senderName
        };
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      
      console.log('📥 [Checkout] Response status:', response.status);

      const orderData = await response.json();

      if (!response.ok) {
        throw new Error(orderData.error || 'Failed to create order');
      }

      console.log('Order created successfully:', orderData);
      
      // Clear cart only after successful order creation
      dispatch({ type: 'CLEAR_CART' });
      setOrderComplete(true);
    } catch (e: any) {
      console.error('Checkout error:', e);
      alert(e.message || 'Failed to complete order. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (state.items.length === 0 && !orderComplete) {
    return (
      <div className="min-h-screen bg-dark-bg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <h1 className="text-3xl font-bold text-white mb-4 holographic">
              Your cart is empty
            </h1>
            <p className="text-xl text-gray-300 mb-8">
              Add some items to your cart before checking out.
            </p>
            <Link
              to="/giftcards"
              className="btn-cyber px-8 py-3 text-lg"
            >
              Browse Gift Cards
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (orderComplete) {
    return (
      <div className="min-h-screen bg-dark-bg">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <div className="w-24 h-24 bg-neon-green/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-12 h-12 text-neon-green" />
            </div>
            <h1 className="text-4xl font-bold text-white mb-4 holographic">
              Order Submitted Successfully! ✅
            </h1>
            <p className="text-xl text-gray-300 mb-4">
              Your order has been received and is now <strong className="text-yellow-400">pending</strong> review.
            </p>
            <p className="text-lg text-gray-400 mb-8">
              Track your order status in <strong className="text-neon-blue">My Orders</strong>. You'll receive your digital items once the order is approved.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/orders"
                className="btn-cyber px-8 py-3 text-lg"
              >
                Go to My Orders
              </Link>
              <Link
                to="/"
                className="cyber-border px-8 py-3 text-lg"
              >
                Back to Home
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-bg pb-24 md:pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-8">
        {/* Mobile App Style Header */}
        <div className="flex items-center mb-4 md:mb-8 sticky top-0 bg-dark-bg z-10 py-3 md:py-0 md:relative">
          <Link
            to="/cart"
            className="flex items-center text-gray-300 hover:text-neon-blue transition-colors duration-200 mr-3"
          >
            <ArrowLeft className="w-5 h-5 md:w-6 md:h-6" />
          </Link>
          <h1 className="text-xl md:text-3xl font-bold text-white holographic flex-1">
            Checkout
          </h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-12">
          {/* Order Summary */}
          <div className="order-2 lg:order-1">
            <div className="card-dark p-4 md:p-8 rounded-xl md:rounded-2xl mb-4 md:mb-8">
              <h2 className="text-lg md:text-2xl font-bold text-white mb-4 md:mb-6 flex items-center">
                <Shield className="w-5 h-5 md:w-6 md:h-6 mr-2 md:mr-3 text-neon-blue" />
                Order Summary
              </h2>

              <div className="space-y-3 md:space-y-4 mb-4 md:mb-6">
                {state.items.map((item) => (
                  <div key={item.id} className="flex items-center space-x-3 md:space-x-4 p-3 md:p-4 bg-dark-surface rounded-lg">
                    {item.image && (item.image.startsWith('http') || item.image.startsWith('/')) ? (
                      <img 
                        src={item.image} 
                        alt={item.name}
                        className="w-12 h-12 md:w-14 md:h-14 rounded-lg object-cover flex-shrink-0"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          if (e.currentTarget.nextElementSibling) {
                            (e.currentTarget.nextElementSibling as HTMLElement).classList.remove('hidden');
                          }
                        }}
                      />
                    ) : null}
                    <div className={`w-12 h-12 md:w-14 md:h-14 bg-dark-bg rounded-lg flex items-center justify-center flex-shrink-0 ${item.image && (item.image.startsWith('http') || item.image.startsWith('/')) ? 'hidden' : ''}`}>
                      <span className="text-lg md:text-xl text-white">{item.name.charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm md:text-lg font-medium text-white truncate">{item.name}</h3>
                      <p className="text-xs md:text-sm text-gray-400">
                        {item.category} • Qty: {item.quantity}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-xs md:text-sm text-gray-400">${(item.price * item.quantity).toFixed(2)}</div>
                      <div className="text-sm md:text-lg font-semibold text-neon-blue">MWK {(
                        itemMwk(item.type as any, item.price) * item.quantity
                      ).toLocaleString()}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Points Balance Display */}
              {user && pointsBalance > 0 && (
                <div className="border-t border-dark-border pt-4 mb-4">
                  <div className="text-sm text-gray-400 mb-1">Your TConnect Points</div>
                  <div className="text-lg font-bold text-neon-blue">{pointsBalance.toLocaleString()} pts</div>
                  <div className="text-xs text-gray-500">1300 points = $10 USD</div>
                </div>
              )}

              <div className="border-t border-dark-border pt-4 space-y-1">
                <div className="flex justify-between text-sm font-medium">
                  <span className="text-gray-400">Subtotal (USD)</span>
                  <span className="text-gray-300">${state.total.toFixed(2)}</span>
                </div>
                {paymentMethod === 'points' && selectedPointsPackage && (
                  <div className="flex justify-between text-sm font-medium text-neon-green">
                    <span>Points Discount ({selectedPointsPackage === 650 ? '$5' : '$10'})</span>
                    <span>-${(selectedPointsPackage === 650 ? 5 : 10).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-semibold">
                  <span className="text-white">Total (MWK)</span>
                  <span className="text-neon-blue">MWK {Math.round(finalTotalMwk).toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Payment Methods */}
            <div className="card-dark p-4 md:p-8 rounded-xl md:rounded-2xl">
              <h2 className="text-lg md:text-2xl font-bold text-white mb-4 md:mb-6 flex items-center">
                <CreditCard className="w-5 h-5 md:w-6 md:h-6 mr-2 md:mr-3 text-neon-blue" />
                Payment Method
              </h2>

              <div className="space-y-3 md:space-y-4">
                <div
                  className={`p-3 md:p-4 rounded-lg border-2 cursor-pointer transition-all duration-300 active:scale-95 ${
                    paymentMethod === 'bank'
                      ? 'border-neon-blue bg-neon-blue/10'
                      : 'border-dark-border hover:border-neon-blue/50'
                  }`}
                  onClick={() => handlePaymentMethodChange('bank')}
                >
                  <div className="flex items-center space-x-3 md:space-x-4">
                    <div className="w-10 h-10 md:w-12 md:h-12 bg-neon-blue/20 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-5 h-5 md:w-6 md:h-6 text-neon-blue" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base md:text-lg font-semibold text-white">Bank Transfer</h3>
                      <p className="text-xs md:text-sm text-gray-400">Direct bank transfer - No fees</p>
                    </div>
                  </div>
                </div>

                <div
                  className={`p-3 md:p-4 rounded-lg border-2 transition-all duration-300 relative ${
                    paymentMethod === 'card'
                      ? 'border-purple-400/50 bg-purple-400/5'
                      : 'border-dark-border opacity-60'
                  }`}
                  style={{ cursor: 'not-allowed' }}
                >
                  <div className="flex items-center space-x-3 md:space-x-4">
                    <div className="w-10 h-10 md:w-12 md:h-12 bg-purple-400/20 rounded-lg flex items-center justify-center flex-shrink-0">
                      <CreditCard className="w-5 h-5 md:w-6 md:h-6 text-purple-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base md:text-lg font-semibold text-white">Bank Card</h3>
                        <span className="px-2 py-0.5 bg-purple-400/20 border border-purple-400/50 rounded text-xs font-semibold text-purple-400">
                          Coming Soon
                        </span>
                      </div>
                      <p className="text-xs md:text-sm text-gray-400">Pay with Visa, Mastercard, or other bank cards</p>
                    </div>
                  </div>
                </div>

                {/* Pay with Points Option */}
                {user && pointsBalance >= 650 && (
                  <div
                    className={`p-3 md:p-4 rounded-lg border-2 cursor-pointer transition-all duration-300 active:scale-95 ${
                      paymentMethod === 'points'
                        ? 'border-neon-green bg-neon-green/10'
                        : 'border-dark-border hover:border-neon-green/50'
                    }`}
                    onClick={() => handlePaymentMethodChange('points')}
                  >
                    <div className="flex items-center space-x-3 md:space-x-4">
                      <div className="w-10 h-10 md:w-12 md:h-12 bg-neon-green/20 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Gift className="w-5 h-5 md:w-6 md:h-6 text-neon-green" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base md:text-lg font-semibold text-white">Pay with Points</h3>
                        <p className="text-xs md:text-sm text-gray-400">Redeem your TConnect Points (650 or 1300 points packages)</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Checkout Form */}
          <div className="order-1 lg:order-2">
            <div className="card-dark p-4 md:p-8 rounded-xl md:rounded-2xl">
              <h2 className="text-lg md:text-2xl font-bold text-white mb-4 md:mb-6 flex items-center">
                <CreditCard className="w-5 h-5 md:w-6 md:h-6 mr-2 md:mr-3 text-neon-blue" />
                Payment Details
              </h2>

              <div className="space-y-4 md:space-y-6">
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    className="w-full px-4 py-3.5 md:py-3 bg-dark-surface border border-dark-border rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-neon-blue focus:border-neon-blue text-base"
                    placeholder="your@email.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Full Name
                  </label>
                  <input
                    type="text"
                    className="w-full px-4 py-3.5 md:py-3 bg-dark-surface border border-dark-border rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-neon-blue focus:border-neon-blue text-base"
                    placeholder="John Doe"
                  />
                </div>

                {paymentMethod === 'bank' && (
                  <div className="space-y-4">
                    <div className="bg-neon-blue/10 border border-neon-blue/30 rounded-lg p-3 md:p-4 mb-4">
                      <h3 className="text-base md:text-lg font-semibold text-neon-blue mb-3">Bank Transfer Details</h3>
                      <div className="space-y-2 text-xs md:text-sm">
                        <div className="flex justify-between items-start">
                          <span className="text-gray-400">Bank Name:</span>
                          <span className="text-white font-medium text-right ml-2">National Bank of Malawi</span>
                        </div>
                        <div className="flex justify-between items-start">
                          <span className="text-gray-400">Account Name:</span>
                          <span className="text-white font-medium text-right ml-2">TrickalHoldings</span>
                        </div>
                        <div className="flex justify-between items-start">
                          <span className="text-gray-400">Account Number:</span>
                          <span className="text-white font-medium text-right ml-2">1011725615</span>
                        </div>
                      </div>
                      <div className="mt-3 md:mt-4 pt-3 md:pt-4 border-t border-neon-blue/20">
                        <p className="text-xs text-gray-300 leading-relaxed">
                          <strong className="text-white">Payment Instructions:</strong><br />
                          1. Transfer the exact amount: <strong className="text-neon-blue">MWK {totalMwk.toLocaleString()}</strong><br />
                          2. Use your name as the reference/comment<br />
                          3. Upload proof of payment (POP) below<br />
                          4. Orders will be processed after payment confirmation
                        </p>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-white mb-2">Sender Full Name (as on bank account) *</label>
                      <input
                        value={senderName}
                        onChange={(e) => setSenderName(e.target.value)}
                        required
                        className="w-full px-4 py-3.5 md:py-3 bg-dark-surface border border-dark-border rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-neon-blue focus:border-neon-blue text-base"
                        placeholder="Enter your full name as it appears on your bank account"
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-white mb-2">Transaction ID (optional)</label>
                        <input
                          value={transactionId}
                          onChange={(e) => setTransactionId(e.target.value)}
                          className="w-full px-4 py-3.5 md:py-3 bg-dark-surface border border-dark-border rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-neon-blue focus:border-neon-blue text-base"
                          placeholder="NBM Ref..."
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-white mb-2">Proof of Payment (POP) <span className="text-gray-500">(Recommended)</span></label>
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          onChange={(e) => setPopFile(e.target.files?.[0] || null)}
                          className="w-full text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-neon-blue file:text-white hover:file:bg-neon-blue/80 text-sm"
                        />
                        <p className="text-xs text-gray-400 mt-1">Upload screenshot or PDF of your bank transfer receipt</p>
                      </div>
                    </div>
                  </div>
                )}

                {paymentMethod === 'card' && (
                  <div className="bg-purple-400/10 border border-purple-400/30 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <CreditCard className="w-5 h-5 text-purple-400" />
                      <h3 className="text-lg font-semibold text-purple-400">Bank Card Payment Coming Soon</h3>
                    </div>
                    <p className="text-gray-300 text-sm">
                      We're working on adding bank card payment options. For now, please use bank transfer to complete your order.
                    </p>
                  </div>
                )}

                {paymentMethod === 'points' && (
                  <div className="space-y-4">
                    <div className="bg-neon-green/10 border border-neon-green/30 rounded-lg p-4">
                      <h3 className="text-base md:text-lg font-semibold text-neon-green mb-3 flex items-center">
                        <Gift className="w-5 h-5 mr-2" />
                        Select Points Package
                      </h3>
                      <p className="text-xs md:text-sm text-gray-300 mb-4">
                        Choose a points redemption package. You'll receive a receipt to download and upload.
                      </p>
                      
                      <div className="grid grid-cols-2 gap-3">
                        {pointsPackages.map((pkg) => {
                          const canAfford = pointsBalance >= pkg.points;
                          const isSelected = selectedPointsPackage === pkg.points;
                          return (
                            <button
                              key={pkg.points}
                              onClick={() => setSelectedPointsPackage(pkg.points as 650 | 1300)}
                              disabled={!canAfford}
                              className={`p-3 md:p-4 rounded-lg border-2 transition-all ${
                                isSelected
                                  ? 'border-neon-green bg-neon-green/20'
                                  : canAfford
                                  ? 'border-dark-border hover:border-neon-green/50 bg-dark-surface'
                                  : 'border-dark-border opacity-50 cursor-not-allowed bg-dark-surface'
                              }`}
                            >
                              <div className="text-center">
                                <div className="text-lg md:text-xl font-bold text-neon-green mb-1">
                                  {pkg.points.toLocaleString()}
                                </div>
                                <div className="text-xs md:text-sm text-gray-300">points</div>
                                <div className="text-sm md:text-base font-semibold text-white mt-2">
                                  ${pkg.usd.toFixed(2)} USD
                                </div>
                                {!canAfford && (
                                  <div className="text-xs text-red-400 mt-1">Insufficient</div>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      {selectedPointsPackage && (
                        <div className="mt-4 space-y-3">
                          {finalTotalUsd > 0 && (
                            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                              <p className="text-xs md:text-sm text-yellow-400">
                                <strong>Note:</strong> Your order total (${state.total.toFixed(2)}) exceeds the points package value (${(selectedPointsPackage === 650 ? 5 : 10).toFixed(2)}). 
                                You'll need to pay the remaining <strong>MWK {Math.round(finalTotalMwk).toLocaleString()}</strong> via bank transfer.
                              </p>
                            </div>
                          )}
                          
                          <button
                            onClick={generatePointsReceipt}
                            className="w-full py-2 px-4 bg-neon-green/20 border border-neon-green/50 rounded-lg text-neon-green font-semibold hover:bg-neon-green/30 transition-all flex items-center justify-center space-x-2"
                          >
                            <Download className="w-4 h-4" />
                            <span>Generate & Download Receipt</span>
                          </button>
                          
                          <div>
                            <label className="block text-sm font-medium text-white mb-2">
                              Upload Points Redemption Receipt *
                            </label>
                            <input
                              type="file"
                              accept="image/*,application/pdf"
                              onChange={(e) => setPointsReceiptFile(e.target.files?.[0] || null)}
                              className="w-full text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-neon-green file:text-white hover:file:bg-neon-green/80 text-sm"
                            />
                            <p className="text-xs text-gray-400 mt-1">
                              Upload the receipt you downloaded above
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Show bank transfer details if there's a remainder */}
                    {selectedPointsPackage && finalTotalUsd > 0 && (
                      <div className="space-y-4">
                        <div className="bg-neon-blue/10 border border-neon-blue/30 rounded-lg p-3 md:p-4">
                          <h3 className="text-base md:text-lg font-semibold text-neon-blue mb-3">Pay Remaining Amount via Bank Transfer</h3>
                          <div className="space-y-2 text-xs md:text-sm mb-3">
                            <div className="flex justify-between items-start">
                              <span className="text-gray-400">Bank Name:</span>
                              <span className="text-white font-medium text-right ml-2">National Bank of Malawi</span>
                            </div>
                            <div className="flex justify-between items-start">
                              <span className="text-gray-400">Account Name:</span>
                              <span className="text-white font-medium text-right ml-2">TrickalHoldings</span>
                            </div>
                            <div className="flex justify-between items-start">
                              <span className="text-gray-400">Account Number:</span>
                              <span className="text-white font-medium text-right ml-2">1011725615</span>
                            </div>
                            <div className="flex justify-between items-start mt-2">
                              <span className="text-gray-400">Amount to Pay:</span>
                              <span className="text-neon-blue font-bold text-right ml-2">MWK {Math.round(finalTotalMwk).toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-white mb-2">Sender Full Name (as on bank account) *</label>
                          <input
                            value={senderName}
                            onChange={(e) => setSenderName(e.target.value)}
                            required
                            className="w-full px-4 py-3.5 md:py-3 bg-dark-surface border border-dark-border rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-neon-blue focus:border-neon-blue text-base"
                            placeholder="Enter your full name as it appears on your bank account"
                          />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-white mb-2">Transaction ID (optional)</label>
                            <input
                              value={transactionId}
                              onChange={(e) => setTransactionId(e.target.value)}
                              className="w-full px-4 py-3.5 md:py-3 bg-dark-surface border border-dark-border rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-neon-blue focus:border-neon-blue text-base"
                              placeholder="NBM Ref..."
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-white mb-2">Proof of Payment (POP) <span className="text-gray-500">(Recommended)</span></label>
                            <input
                              type="file"
                              accept="image/*,application/pdf"
                              onChange={(e) => setPopFile(e.target.files?.[0] || null)}
                              className="w-full text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-neon-blue file:text-white hover:file:bg-neon-blue/80 text-sm"
                            />
                            <p className="text-xs text-gray-400 mt-1">Upload screenshot or PDF of your bank transfer receipt</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="bg-neon-blue/10 border border-neon-blue/30 rounded-lg p-3 md:p-4">
                  <h3 className="text-xs md:text-sm font-semibold text-neon-blue mb-2">
                    Security Notice
                  </h3>
                  <p className="text-xs md:text-sm text-gray-300">
                    All transactions are secured with 256-bit SSL encryption. 
                    Your payment information is never stored on our servers.
                  </p>
                </div>

                {/* Mobile: Sticky Bottom Button */}
                <div className="block md:hidden fixed bottom-0 left-0 right-0 bg-dark-bg border-t border-dark-border p-4 z-50 safe-area-inset-bottom">
                  <button
                    onClick={handleCheckout}
                    disabled={
                      isProcessing || 
                      (paymentMethod === 'bank' && !senderName) ||
                      (paymentMethod === 'points' && (!selectedPointsPackage || !pointsReceiptFile || (finalTotalUsd > 0 && !senderName)))
                    }
                    className={`w-full py-4 px-6 rounded-xl font-bold text-base transition-all duration-300 flex items-center justify-center space-x-3 ${
                      isProcessing || 
                      (paymentMethod === 'bank' && !senderName) ||
                      (paymentMethod === 'points' && (!selectedPointsPackage || !pointsReceiptFile))
                        ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                        : 'btn-cyber text-white active:scale-95'
                    }`}
                  >
                    {isProcessing ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        <span>Submitting...</span>
                      </>
                    ) : (
                      <>
                        <CreditCard className="w-5 h-5" />
                        <span>Submit - MWK {Math.round(finalTotalMwk).toLocaleString()}</span>
                      </>
                    )}
                  </button>
                  {paymentMethod === 'bank' && !senderName && (
                    <p className="text-xs text-red-400 text-center mt-2">
                      Please enter your sender name (required)
                    </p>
                  )}
                  {paymentMethod === 'points' && (!selectedPointsPackage || !pointsReceiptFile || (finalTotalUsd > 0 && !senderName)) && (
                    <p className="text-xs text-red-400 text-center mt-2">
                      {!selectedPointsPackage ? 'Please select a points package' : !pointsReceiptFile ? 'Please upload your receipt' : 'Please enter sender name for remaining amount'}
                    </p>
                  )}
                </div>

                {/* Desktop: Regular Button */}
                <div className="hidden md:block">
                  <button
                    onClick={handleCheckout}
                    disabled={
                      isProcessing || 
                      (paymentMethod === 'bank' && !senderName) ||
                      (paymentMethod === 'points' && (!selectedPointsPackage || !pointsReceiptFile || (finalTotalUsd > 0 && !senderName)))
                    }
                    className={`w-full py-4 px-6 rounded-xl font-bold text-lg transition-all duration-300 flex items-center justify-center space-x-3 ${
                      isProcessing || 
                      (paymentMethod === 'bank' && !senderName) ||
                      (paymentMethod === 'points' && (!selectedPointsPackage || !pointsReceiptFile))
                        ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                        : 'btn-cyber text-white hover:scale-105'
                    }`}
                  >
                    {isProcessing ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        <span>Submitting Order...</span>
                      </>
                    ) : (
                      <>
                        <CreditCard className="w-5 h-5" />
                        <span>Submit Order - MWK {Math.round(finalTotalMwk).toLocaleString()}</span>
                      </>
                    )}
                  </button>
                  {paymentMethod === 'bank' && !senderName && (
                    <p className="text-sm text-red-400 text-center mt-2">
                      Please enter your sender name (required)
                    </p>
                  )}
                  {paymentMethod === 'points' && (!selectedPointsPackage || !pointsReceiptFile || (finalTotalUsd > 0 && !senderName)) && (
                    <p className="text-sm text-red-400 text-center mt-2">
                      {!selectedPointsPackage ? 'Please select a points package' : !pointsReceiptFile ? 'Please upload your receipt' : 'Please enter sender name for remaining amount'}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Checkout;
