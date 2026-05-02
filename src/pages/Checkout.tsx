import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  CreditCard,
  Wallet,
  CheckCircle,
  Copy,
  Check,
  ChevronRight,
  ChevronLeft,
  Building2,
  MessageCircle,
  Mail,
} from 'lucide-react';
import { useCart, cartLineKey } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { getMwkAmountFromUsd } from '../utils/rates';
import { getApiBase } from '../lib/getApiBase';
import { supabase } from '../lib/supabaseClient';
import { calculatePromotionResult, fetchActivePromotions, Promotion } from '../lib/promotions';

declare global {
  interface Window {
    paypal?: {
      Buttons: (config: any) => { render: (selectorOrElement: string | HTMLElement) => Promise<void> };
    };
  }
}

async function parsePaypalBackendJson(
  res: Response,
  action: string
): Promise<{ data: Record<string, any> }> {
  const text = await res.text();
  if (!text || text.trimStart().startsWith('<')) {
    throw new Error(
      `${action}: backend returned HTML, not JSON. Start the API (npm run local) and match REACT_APP_API_BASE to it.`
    );
  }
  let data: Record<string, any>;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`${action}: invalid JSON (${res.status}). ${text.slice(0, 120)}`);
  }
  return { data };
}

const Checkout: React.FC = () => {
  const { state, dispatch, clearPersistedCart } = useCart();
  const { user } = useAuth();
  const location = useLocation();
  const [isProcessing, setIsProcessing] = useState(false);
  const [orderComplete, setOrderComplete] = useState(false);
  const [senderName, setSenderName] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [popFile, setPopFile] = useState<File | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [step, setStep] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState<'bank' | 'cardLink' | 'paypal' | null>(null);
  const [showCardContactMessage, setShowCardContactMessage] = useState(false);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [paypalSdkReady, setPaypalSdkReady] = useState(false);
  const [paypalSdkError, setPaypalSdkError] = useState<string | null>(null);
  const [paypalMessage, setPaypalMessage] = useState<string | null>(null);
  const paypalContainerRef = useRef<HTMLDivElement | null>(null);
  const paypalRenderedRef = useRef(false);
  const paypalMockMode = process.env.REACT_APP_PAYPAL_MOCK === 'true';
  const totalSteps = paymentMethod === 'bank' ? 3 : 2;

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      alert('Could not copy. Please select and copy manually.');
    }
  };

  const bankDetails = {
    bankName: 'National Bank of Malawi',
    accountName: 'TrickalHoldings',
    accountNumber: '1011725615',
  };

  const itemMwk = (type: 'giftcard' | 'crypto' | 'wallet' | 'virtual-card', usd: number) => {
    // Digital wallets & cards (wallet and virtual-card) use wallet rate
    const rateType = (type === 'wallet' || type === 'virtual-card') ? 'wallet' : type === 'crypto' ? 'crypto' : 'giftcard';
    return getMwkAmountFromUsd(usd, rateType);
  };

  const totalMwk = useMemo(() => {
    return state.items.reduce((sum, item) => sum + itemMwk(item.type as any, item.price) * item.quantity, 0);
  }, [state.items]);
  const promoResult = useMemo(() => calculatePromotionResult(state.items, promotions), [state.items, promotions]);
  const discountedTotalMwk = useMemo(() => {
    if (state.total <= 0) return totalMwk;
    return totalMwk * (promoResult.finalTotalUsd / state.total);
  }, [promoResult.finalTotalUsd, state.total, totalMwk]);

  // Show success when returning from card POP submit
  useEffect(() => {
    if ((location.state as any)?.orderSubmitted) {
      setOrderComplete(true);
    }
  }, [location.state]);

  // Scroll to top when order completes or component mounts
  useEffect(() => {
    // Scroll immediately on mount
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // Scroll when order completes (with delay to ensure DOM is updated)
    if (orderComplete) {
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 100);
    }
  }, [orderComplete]);

  useEffect(() => {
    fetchActivePromotions().then(setPromotions).catch(() => setPromotions([]));
  }, []);

  useEffect(() => {
    if (!(paymentMethod === 'paypal' && step === 2)) {
      paypalRenderedRef.current = false;
    }
  }, [paymentMethod, step]);

  const finalTotalUsd = promoResult.finalTotalUsd;
  const finalTotalMwk = discountedTotalMwk;
  const paypalFeeUsd = useMemo(() => Number((finalTotalUsd * 0.2).toFixed(2)), [finalTotalUsd]);
  const paypalTotalUsd = useMemo(() => Number((finalTotalUsd + paypalFeeUsd).toFixed(2)), [finalTotalUsd, paypalFeeUsd]);
  const paypalTotalMwk = useMemo(() => finalTotalMwk * 1.2, [finalTotalMwk]);

  const handlePayByCardLink = () => {
    setPaymentMethod('cardLink');
    setShowCardContactMessage(true);
  };

  const createOrderRecord = useCallback(
    async (
      method: 'bank' | 'paypal',
      payment: Record<string, any> | null,
      totals?: { totalUsd?: number; totalMwk?: number }
    ) => {
      const API_BASE = getApiBase();
      const response = await fetch(`${API_BASE}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: state.items,
          totalUsd: totals?.totalUsd ?? finalTotalUsd,
          totalMwk: Math.round(totals?.totalMwk ?? finalTotalMwk),
          userEmail: user?.email,
          paymentMethod: method,
          promotionsApplied: promoResult.appliedPromotions,
          promotionDiscountUsd: promoResult.totalDiscountUsd,
          ...(payment ? { payment } : {}),
        }),
      });

      const orderData = await response.json();
      if (!response.ok) throw new Error(orderData.error || 'Failed to create order');
      return orderData;
    },
    [
      state.items,
      finalTotalUsd,
      finalTotalMwk,
      user?.email,
      promoResult.appliedPromotions,
      promoResult.totalDiscountUsd,
    ]
  );

  const waitForPaypalReady = useCallback(
    (timeoutMs = 15000) =>
      new Promise<boolean>((resolve) => {
        if (timeoutMs <= 0) return resolve(Boolean(window.paypal?.Buttons));

        const start = Date.now();
        const tick = () => {
          if (window.paypal?.Buttons) return resolve(true);
          if (Date.now() - start > timeoutMs) return resolve(false);
          window.setTimeout(tick, 50);
        };
        tick();
      }),
    []
  );

  const loadPaypalSdk = useCallback(async (): Promise<{ ok: boolean; detail?: string }> => {
    const clientId = (process.env.REACT_APP_PAYPAL_CLIENT_ID || '').trim();
    if (!clientId) {
      return {
        ok: false,
        detail: 'PayPal is not configured: set REACT_APP_PAYPAL_CLIENT_ID and rebuild the frontend (CRA bakes env at build time).',
      };
    }

    if (await waitForPaypalReady(0)) return { ok: true };

    let existing = document.getElementById('paypal-sdk-script') as HTMLScriptElement | null;

    if (!existing) {
      existing = document.createElement('script');
      existing.id = 'paypal-sdk-script';
      existing.async = true;
      existing.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=USD&intent=capture&components=buttons`;
      existing.onerror = () => {
        // surfaced below after wait timeout
      };
      document.body.appendChild(existing);
    }

    const ready = await waitForPaypalReady();
    if (!ready) {
      return {
        ok: false,
        detail:
          'PayPal JS SDK did not expose window.paypal.Buttons. Usually: wrong/mismatched client id, blocked network, or hosting blocks third-party scripts. Open DevTools → Network and check the paypal.com/sdk/js request.',
      };
    }

    return { ok: true };
  }, [waitForPaypalReady]);

  const handleCheckout = async () => {
    if (!senderName) {
      alert('Please enter your sender name');
      return;
    }

    setIsProcessing(true);
    try {
      let popUrl: string | null = null;
      
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
      const orderData = await createOrderRecord('bank', {
          bankName: 'National Bank of Malawi',
          accountName: 'TrickalHoldings',
          accountNumber: '1011725615',
          transactionId,
          popUrl,
          senderName
      });

      console.log('Order created successfully:', orderData);
      
      // Clear cart (browser + DB snapshot) after successful order creation
      await clearPersistedCart();
      setOrderComplete(true);
      
      // Scroll to top on mobile after order completion
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e: any) {
      console.error('Checkout error:', e);
      alert(e.message || 'Failed to complete order. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMockPaypalSuccess = async () => {
    try {
      setIsProcessing(true);
      setPaypalMessage(null);
      const fakeTxn = `MOCK-PAYPAL-${Date.now()}`;
      await createOrderRecord('paypal', {
        method: 'paypal',
        transactionId: fakeTxn,
        senderName: user?.name || user?.email || 'Mock PayPal User',
        accountName: user?.email || 'mock-paypal@test.local',
        paypalBaseAmountUsd: Number(finalTotalUsd.toFixed(2)),
        paypalFeeUsd,
        paypalChargedUsd: paypalTotalUsd,
      }, {
        totalUsd: paypalTotalUsd,
        totalMwk: paypalTotalMwk,
      });
      await clearPersistedCart();
      setOrderComplete(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e: any) {
      setPaypalMessage(e?.message || 'Mock PayPal simulation failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    if (!(paymentMethod === 'paypal' && step === 2)) return;
    if (paypalMockMode) {
      setPaypalSdkReady(true);
      setPaypalSdkError(null);
      return;
    }

    let cancelled = false;
    let hostRef: HTMLDivElement | null = null;

    const run = async () => {
      setPaypalSdkError(null);
      setPaypalMessage(null);
      paypalRenderedRef.current = false;

      for (let i = 0; i < 60 && !cancelled && !paypalContainerRef.current; i++) {
        await new Promise((r) => setTimeout(r, 50));
      }
      if (cancelled) return;

      const host = paypalContainerRef.current;
      hostRef = host;
      if (!host) {
        setPaypalSdkReady(false);
        setPaypalSdkError('PayPal area did not render. Reload this page.');
        return;
      }

      host.innerHTML = '';

      setIsProcessing(true);
      const sdk = await loadPaypalSdk();
      if (cancelled) return;

      setPaypalSdkReady(sdk.ok);
      setIsProcessing(false);

      if (!sdk.ok || !window.paypal?.Buttons) {
        setPaypalSdkError(sdk.detail || 'Failed to load PayPal.');
        return;
      }

      try {
        await window.paypal
          .Buttons({
            style: {
              layout: 'vertical',
              shape: 'rect',
              label: 'paypal',
              tagline: false,
            },
            createOrder: async () => {
              const API_BASE = getApiBase();
              const res = await fetch(`${API_BASE}/payments/paypal/create-order`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount: paypalTotalUsd, currency: 'USD' }),
              });
              const { data } = await parsePaypalBackendJson(res, 'create-order');
              if (!res.ok || !data?.id) {
                throw new Error(data?.error || `Create order failed (${res.status})`);
              }
              return data.id;
            },
            onApprove: async (paypalData: { orderID: string }) => {
              try {
                setIsProcessing(true);
                const API_BASE = getApiBase();
                const captureRes = await fetch(`${API_BASE}/payments/paypal/capture-order`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ orderId: paypalData.orderID }),
                });
                const { data: captureData } = await parsePaypalBackendJson(
                  captureRes,
                  'capture-order'
                );
                if (!captureRes.ok)
                  throw new Error(captureData?.error || 'Failed to capture PayPal payment');

                const payerName =
                  captureData?.payer?.name?.given_name || user?.name || user?.email || 'PayPal User';
                const captureId =
                  captureData?.purchase_units?.[0]?.payments?.captures?.[0]?.id ||
                  paypalData.orderID;

                await createOrderRecord(
                  'paypal',
                  {
                    method: 'paypal',
                    transactionId: captureId,
                    senderName: payerName,
                    accountName: captureData?.payer?.email_address || 'PayPal',
                    paypalBaseAmountUsd: Number(finalTotalUsd.toFixed(2)),
                    paypalFeeUsd,
                    paypalChargedUsd: paypalTotalUsd,
                  },
                  {
                    totalUsd: paypalTotalUsd,
                    totalMwk: paypalTotalMwk,
                  }
                );

                await clearPersistedCart();
                setOrderComplete(true);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              } catch (e: any) {
                setPaypalMessage(e?.message || 'Payment or order creation failed.');
              } finally {
                setIsProcessing(false);
              }
            },
            onError: (err: unknown) => {
              const detail =
                err && typeof err === 'object' && err !== null && 'message' in err
                  ? String((err as { message?: string }).message || err)
                  : typeof err === 'string'
                  ? err
                  : JSON.stringify(err);
              console.error('[PayPal SDK onError]', err);
              setPaypalMessage(
                `PayPal error: ${detail}. If sandbox vs live mismatches your keys, fix PAYPAL_MODE and credentials on the backend, then restart the API.`
              );
            },
            onCancel: () => setPaypalMessage('PayPal was cancelled.'),
          })
          .render(host);
        paypalRenderedRef.current = true;
      } catch (e: any) {
        console.error('[PayPal] init/render failed', e);
        setPaypalSdkError(e?.message || 'Failed to initialize PayPal (render).');
        setPaypalSdkReady(false);
      } finally {
        setIsProcessing(false);
      }
    };

    run();
    return () => {
      cancelled = true;
      paypalRenderedRef.current = false;
      if (hostRef) hostRef.innerHTML = '';
    };
  }, [
    paymentMethod,
    step,
    paypalMockMode,
    finalTotalUsd,
    paypalFeeUsd,
    paypalTotalMwk,
    paypalTotalUsd,
    user?.email,
    user?.name,
    dispatch,
    createOrderRecord,
    loadPaypalSdk,
  ]);

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
    <div className="min-h-screen bg-dark-bg pb-28 md:pb-12">
      <div className="max-w-lg mx-auto px-4 sm:px-6 py-6 md:py-10">
        <div className="flex items-center justify-between mb-6 md:mb-8">
          <Link
            to="/cart"
            className="flex items-center text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5 mr-1" />
            <span className="text-sm">Cart</span>
          </Link>
          <span className="text-xs text-gray-500">Step {step} of {totalSteps}</span>
        </div>

        {/* Step progress dots */}
        <div className="flex justify-center gap-2 mb-8">
          {Array.from({ length: totalSteps }, (_, i) => i + 1).map((s) => (
            <div
              key={s}
              className={`h-1.5 rounded-full transition-all ${s <= step ? 'bg-neon-blue w-6' : 'bg-dark-border w-1.5'}`}
            />
          ))}
        </div>

        <div className="card-dark rounded-2xl p-6 md:p-8 min-h-[320px]">
          {/* Step 1: Order summary + total + payment method choice */}
          {step === 1 && (
            <>
              <h2 className="text-lg font-semibold text-white mb-4">Order summary</h2>
              <div className="space-y-3 mb-4 max-h-48 overflow-y-auto">
                {state.items.map((item) => (
                  <div key={cartLineKey(item)} className="flex items-center gap-3 py-2 border-b border-dark-border last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{item.name}</p>
                      <p className="text-xs text-gray-400">Qty {item.quantity} · MWK {(itemMwk(item.type as any, item.price) * item.quantity).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-between font-semibold pt-2 mb-6">
                <span className="text-white">Total (MWK)</span>
                <span className="text-neon-blue">MWK {Math.round(finalTotalMwk).toLocaleString()}</span>
              </div>
              <p className="text-xs text-gray-500 mb-3">
                PayPal charges +20% in USD at checkout.
              </p>
              {promoResult.totalDiscountUsd > 0 && (
                <p className="text-xs text-neon-green mb-4">
                  Promotion discount applied: ${promoResult.totalDiscountUsd.toFixed(2)}
                </p>
              )}
              <p className="text-sm text-gray-400 mb-3">How do you want to pay?</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => { setPaymentMethod('bank'); setStep(2); }}
                  className="p-4 rounded-xl border-2 border-neon-blue/50 bg-neon-blue/10 hover:bg-neon-blue/20 flex items-center gap-3 text-left"
                >
                  <Building2 className="w-8 h-8 text-neon-blue flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-white">Bank transfer</p>
                    <p className="text-xs text-gray-400">NBM · Copy details & pay</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={handlePayByCardLink}
                  className="p-4 rounded-xl border-2 border-dark-border hover:border-neon-blue/50 hover:bg-neon-blue/10 flex items-center gap-3 text-left"
                >
                  <CreditCard className="w-8 h-8 text-neon-blue flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-white">Card by Link</p>
                    <p className="text-xs text-gray-400">Support sends manual payment link</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => { setPaymentMethod('paypal'); setStep(2); setShowCardContactMessage(false); }}
                  className="p-4 rounded-xl border-2 border-dark-border hover:border-neon-blue/50 hover:bg-neon-blue/10 flex items-center gap-3 text-left sm:col-span-2"
                >
                  <Wallet className="w-8 h-8 text-neon-blue flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-white">PayPal</p>
                    <p className="text-xs text-gray-400">
                      PayPal balance · or pay as guest with card (via PayPal)
                    </p>
                  </div>
                </button>
              </div>

              {showCardContactMessage && (
                <div className="mt-4 p-4 rounded-xl bg-neon-blue/10 border border-neon-blue/30">
                  <p className="text-gray-200 mb-4">
                    For <strong className="text-white">Card by Link</strong>, contact support and they will send you a manual payment link.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Link
                      to="/"
                      className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-neon-blue text-white font-medium hover:opacity-90"
                    >
                      <MessageCircle className="w-5 h-5" />
                      Open live chat
                    </Link>
                    <a
                      href="mailto:support@tconnectstore.com"
                      className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-dark-border text-gray-200 hover:bg-dark-surface font-medium"
                    >
                      <Mail className="w-5 h-5" />
                      Email support
                    </a>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCardContactMessage(false)}
                    className="mt-3 text-sm text-gray-400 hover:text-white"
                  >
                    Back
                  </button>
                </div>
              )}
            </>
          )}

          {/* Step 2: Bank details + instructions + name */}
          {step === 2 && paymentMethod === 'bank' && (
            <>
              <p className="text-sm text-gray-400 mb-2">Bank transfer · National Bank of Malawi</p>
              <p className="text-amber-400/90 text-xs font-medium mb-4 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
                Transfer the <strong>exact amount</strong> only. Sending a different amount may delay or cancel your order.
              </p>

              <div className="space-y-3 mb-4">
                <div className="flex items-center justify-between gap-2 p-3 bg-dark-surface rounded-xl">
                  <div>
                    <p className="text-xs text-gray-400">Amount (pay exactly this)</p>
                    <p className="text-lg font-bold text-neon-blue">MWK {Math.round(finalTotalMwk).toLocaleString()}</p>
                  </div>
                  <button type="button" onClick={() => copyToClipboard(String(Math.round(finalTotalMwk)), 'amount')} className="flex-shrink-0 p-2 rounded-lg bg-neon-blue/20 text-neon-blue hover:bg-neon-blue/30">
                    {copiedField === 'amount' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <div className="flex items-center justify-between gap-2 p-3 bg-dark-surface rounded-xl">
                  <div className="min-w-0">
                    <p className="text-xs text-gray-400">Account number</p>
                    <p className="text-white font-semibold truncate">{bankDetails.accountNumber}</p>
                  </div>
                  <button type="button" onClick={() => copyToClipboard(bankDetails.accountNumber, 'account')} className="flex-shrink-0 p-2 rounded-lg bg-neon-blue/20 text-neon-blue hover:bg-neon-blue/30">
                    {copiedField === 'account' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <div className="flex items-center justify-between gap-2 p-3 bg-dark-surface rounded-xl">
                  <div className="min-w-0">
                    <p className="text-xs text-gray-400">Account name</p>
                    <p className="text-white font-semibold truncate">{bankDetails.accountName}</p>
                  </div>
                  <button type="button" onClick={() => copyToClipboard(bankDetails.accountName, 'accountName')} className="flex-shrink-0 p-2 rounded-lg bg-neon-blue/20 text-neon-blue hover:bg-neon-blue/30">
                    {copiedField === 'accountName' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <div className="flex items-center justify-between gap-2 p-3 bg-dark-surface rounded-xl">
                  <div className="min-w-0">
                    <p className="text-xs text-gray-400">Bank name</p>
                    <p className="text-white truncate">{bankDetails.bankName}</p>
                  </div>
                  <button type="button" onClick={() => copyToClipboard(bankDetails.bankName, 'bank')} className="flex-shrink-0 p-2 rounded-lg bg-neon-blue/20 text-neon-blue hover:bg-neon-blue/30">
                    {copiedField === 'bank' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <div className="flex items-center justify-between gap-2 p-3 bg-dark-surface rounded-xl">
                  <div className="min-w-0">
                    <p className="text-xs text-gray-400">Reference (use your name)</p>
                    <p className="text-white truncate">{senderName || '— Enter below —'}</p>
                  </div>
                  <button type="button" onClick={() => copyToClipboard(senderName || '', 'ref')} disabled={!senderName.trim()} className="flex-shrink-0 p-2 rounded-lg bg-neon-blue/20 text-neon-blue hover:bg-neon-blue/30 disabled:opacity-40 disabled:cursor-not-allowed">
                    {copiedField === 'ref' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => copyToClipboard(`Amount: MWK ${Math.round(finalTotalMwk).toLocaleString()}\nAccount number: ${bankDetails.accountNumber}\nAccount name: ${bankDetails.accountName}\nBank: ${bankDetails.bankName}\nReference: ${senderName || 'Your name'}`, 'all')}
                className="w-full py-2.5 rounded-xl border border-neon-blue/50 text-neon-blue hover:bg-neon-blue/10 flex items-center justify-center gap-2 text-sm font-medium mb-4"
              >
                {copiedField === 'all' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copiedField === 'all' ? 'Copied' : 'Copy all details'}
              </button>

              <label className="block text-sm text-gray-300 mb-1.5">Your name (as on bank account) — use as reference</label>
              <input
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                className="w-full px-4 py-3 bg-dark-surface border border-dark-border rounded-xl text-white placeholder-gray-500 focus:ring-2 focus:ring-neon-blue focus:border-neon-blue text-base"
                placeholder="e.g. John Banda"
              />
              <p className="text-xs text-gray-500 mt-3">Copy each field into your bank app → Pay the exact amount → Next for POP & submit</p>
            </>
          )}

          {step === 2 && paymentMethod === 'paypal' && (
            <>
              <p className="text-sm text-gray-300 mb-2">Pay with PayPal</p>
              <div className="text-xs text-gray-400 mb-4 space-y-1">
                <p>Base amount: <span className="text-white">${finalTotalUsd.toFixed(2)} USD</span></p>
                <p>PayPal surcharge (20%): <span className="text-amber-300">+${paypalFeeUsd.toFixed(2)} USD</span></p>
                <p className="font-semibold text-neon-blue">Total charged: ${paypalTotalUsd.toFixed(2)} USD</p>
              </div>
              <div className="p-4 rounded-xl bg-dark-surface border border-dark-border">
                {paypalMockMode && (
                  <div className="mb-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                    <p className="text-xs text-amber-300 mb-2">
                      PayPal mock mode is enabled for local testing. This simulates a successful PayPal payment.
                    </p>
                    <button
                      type="button"
                      onClick={handleMockPaypalSuccess}
                      disabled={isProcessing}
                      className="px-4 py-2 rounded-lg bg-neon-blue text-white text-sm font-semibold hover:opacity-90 disabled:opacity-60"
                    >
                      {isProcessing ? 'Simulating...' : 'Simulate PayPal success'}
                    </button>
                  </div>
                )}
                {!paypalSdkReady && !paypalSdkError && (
                  <p className="text-sm text-gray-400">Loading PayPal checkout...</p>
                )}
                {!paypalMockMode && paypalSdkError && <p className="text-sm text-red-400">{paypalSdkError}</p>}
                {!paypalMockMode && <div ref={paypalContainerRef} />}
              </div>
              {paypalMessage && <p className="text-xs text-amber-400 mt-3">{paypalMessage}</p>}
            </>
          )}

          {/* Step 3: POP (trans ID or screenshot) + Submit */}
          {step === 3 && paymentMethod === 'bank' && (
            <>
              <p className="text-sm text-gray-400 mb-2">Proof of payment</p>
              <p className="text-amber-400/90 text-xs font-medium mb-4 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
                You have <strong>1 hour</strong> from when you place the order to complete payment. After that the order expires and you’ll need to create a new one.
              </p>
              <div className="space-y-4 mb-4">
                <div>
                  <label className="block text-sm text-gray-300 mb-1.5">Transaction ID (optional)</label>
                  <input
                    value={transactionId}
                    onChange={(e) => setTransactionId(e.target.value)}
                    className="w-full px-4 py-3 bg-dark-surface border border-dark-border rounded-xl text-white placeholder-gray-500 focus:ring-2 focus:ring-neon-blue text-base"
                    placeholder="e.g. NBM reference"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-1.5">Proof of payment (screenshot or PDF)</label>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => setPopFile(e.target.files?.[0] || null)}
                    className="w-full text-gray-400 text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:bg-neon-blue/20 file:text-neon-blue"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500">Pay exactly MWK {Math.round(finalTotalMwk).toLocaleString()} then submit below.</p>
            </>
          )}
        </div>

        {/* Bottom actions */}
        <div className="flex gap-3 mt-6 fixed bottom-0 left-0 right-0 p-4 bg-dark-bg border-t border-dark-border md:relative md:flex md:mt-8 md:p-0 md:bg-transparent md:border-0">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => { setStep((s) => s - 1); if (step === 2) setPaymentMethod(null); }}
              className="flex-1 md:flex-none px-5 py-3.5 rounded-xl border border-dark-border text-gray-300 hover:bg-dark-surface flex items-center justify-center gap-2"
            >
              <ChevronLeft className="w-5 h-5" />
              Back
            </button>
          ) : (
            <div className="flex-1 md:flex-none" />
          )}
          {paymentMethod === 'bank' && step === 2 ? (
            <button
              type="button"
              onClick={() => setStep(3)}
              disabled={!senderName.trim()}
              className="flex-[2] md:flex-none px-6 py-3.5 rounded-xl btn-cyber text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
              <ChevronRight className="w-5 h-5" />
            </button>
          ) : paymentMethod === 'bank' && step === 3 ? (
            <button
              onClick={handleCheckout}
              disabled={isProcessing}
              className={`flex-[2] md:flex-none px-6 py-3.5 rounded-xl font-semibold flex items-center justify-center gap-2 ${
                isProcessing
                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  : 'btn-cyber text-white'
              }`}
            >
              {isProcessing ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                  Submitting...
                </>
              ) : (
                <>
                  <CreditCard className="w-5 h-5" />
                  Place order
                </>
              )}
            </button>
          ) : (
            <div className="flex-[2] md:flex-none" />
          )}
        </div>
        {step === 2 && paymentMethod === 'bank' && !senderName.trim() && (
          <p className="text-xs text-red-400 text-center mt-2 md:mt-3">Enter your name to continue</p>
        )}
      </div>
    </div>
  );
};

export default Checkout;
