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
  Gift,
  Smartphone,
  Wallet as WalletIcon,
} from 'lucide-react';
import { readResponseJson } from '../lib/parseResponseJson';
import { scrollToTop } from '../lib/scrollToTop';
import { useCart, cartLineKey } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { getMwkAmountFromUsd } from '../utils/rates';
import { getApiBase } from '../lib/getApiBase';
import { supabase } from '../lib/supabaseClient';
import { calculatePromotionResult, fetchActivePromotions, Promotion } from '../lib/promotions';
import {
  canPayWithTconnectPoints,
  canRedeemTconnectPoints,
  MIN_LIFETIME_PURCHASE_USD_FOR_POINTS,
  MIN_POINTS_BALANCE_FOR_CHECKOUT,
  POINTS_PER_USD,
  pointsRedemptionBlockReason,
} from '../lib/tconnectPoints';
import {
  walletCheckoutChargeUsd,
  walletCheckoutFeeUsd,
  WALLET_CHECKOUT_SURCHARGE_PERCENT,
} from '../lib/storeWallet';
import { parseUtilityBillCodes, type UtilityBillCode } from '../lib/utilityBillCodes';
import { extractBillCustomerName } from '../lib/utilityBillValidation';
import {
  UTILITY_BILL_SERVICE_FEE_PERCENT,
  utilityBillChargeFromMetadata,
} from '../lib/utilityBillFees';
import {
  MOBILE_MONEY_CHECKOUT_ENABLED,
  MOBILE_MONEY_MAX_CHECKOUT_USD,
  ACTIVE_MOBILE_MONEY_PROVIDER,
  PAWAPAY_CHECKOUT_ENABLED,
  WALLET_CHECKOUT_ENABLED,
} from '../lib/checkoutFlags';

declare global {
  interface Window {
    paypal?: {
      Buttons: (config: any) => { render: (selectorOrElement: string | HTMLElement) => Promise<void> };
    };
  }
}

/** Set to `true` when PayPal should show on checkout again. */
const CHECKOUT_PAYPAL_ENABLED = false;
const VIRTUAL_CARD_MIN_CHECKOUT_USD = 5;
const MOBILE_MONEY_ORDER_KEY = 'tconnect_mm_order';

const PAYPAL_DISABLED_MESSAGE =
  'PayPal is not available at the moment. Please choose bank transfer or card by link, or contact support.';
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
  const [completedOrderId, setCompletedOrderId] = useState<string | null>(null);
  const [completedHadUtility, setCompletedHadUtility] = useState(false);
  const [completedUtilityTokens, setCompletedUtilityTokens] = useState<UtilityBillCode[]>([]);
  const [senderName, setSenderName] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [popFile, setPopFile] = useState<File | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [step, setStep] = useState(1);
  const checkoutAnchorRef = useRef<HTMLDivElement>(null);
  const [paymentMethod, setPaymentMethod] = useState<
    'bank' | 'cardLink' | 'paypal' | 'points' | 'mobile_money' | 'wallet' | null
  >(null);
  const [mobileMoneyReady, setMobileMoneyReady] = useState(MOBILE_MONEY_CHECKOUT_ENABLED);
  const [mobileMoneyMessage, setMobileMoneyMessage] = useState<string | null>(null);
  const [momoOperators, setMomoOperators] = useState<Array<{ name: string; ref_id: string; short_code: string }>>([]);
  const [momoOperatorRefId, setMomoOperatorRefId] = useState('');
  const [momoMobile, setMomoMobile] = useState('');
  const [pointsBalance, setPointsBalance] = useState(0);
  const [lifetimePurchaseUsd, setLifetimePurchaseUsd] = useState(0);
  const [walletBalanceUsd, setWalletBalanceUsd] = useState(0);
  const [showCardContactMessage, setShowCardContactMessage] = useState(false);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [paypalSdkReady, setPaypalSdkReady] = useState(false);
  const [paypalSdkError, setPaypalSdkError] = useState<string | null>(null);
  const [paypalMessage, setPaypalMessage] = useState<string | null>(null);
  const paypalContainerRef = useRef<HTMLDivElement | null>(null);
  const paypalRenderedRef = useRef(false);
  const paypalMockMode = process.env.REACT_APP_PAYPAL_MOCK === 'true';
  const isUtilityOnlyCheckout = useMemo(
    () =>
      state.items.length > 0 &&
      state.items.every((item) => String(item.type || '').trim().toLowerCase() === 'utility-bill'),
    [state.items]
  );
  const utilityCheckoutMode = useMemo(() => {
    const fromState = Boolean((location.state as { utilityCheckout?: boolean } | null)?.utilityCheckout);
    return fromState || isUtilityOnlyCheckout;
  }, [location.state, isUtilityOnlyCheckout]);
  const totalSteps = utilityCheckoutMode ? 1 : paymentMethod === 'bank' ? 3 : 2;

  /** PayPal disabled: send user back to payment method choice (e.g. deep link to PayPal step). */
  useEffect(() => {
    if (!CHECKOUT_PAYPAL_ENABLED && paymentMethod === 'paypal') {
      setPaymentMethod(null);
      setStep(1);
    }
  }, [paymentMethod]);

  useEffect(() => {
    if (
      (!MOBILE_MONEY_CHECKOUT_ENABLED && paymentMethod === 'mobile_money') ||
      (!WALLET_CHECKOUT_ENABLED && paymentMethod === 'wallet')
    ) {
      setPaymentMethod(null);
      setStep(1);
    }
  }, [paymentMethod]);

  useEffect(() => {
    if (!utilityCheckoutMode || !MOBILE_MONEY_CHECKOUT_ENABLED || state.items.length === 0) return;
    setPaymentMethod('mobile_money');
    setStep(2);
  }, [utilityCheckoutMode, state.items.length]);

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
    return state.items.reduce((sum, item) => {
      if (item.type === 'utility-bill' && item.metadata?.amountMwk) {
        const { totalChargeMwk } = utilityBillChargeFromMetadata(
          item.metadata as Record<string, unknown>
        );
        return sum + totalChargeMwk * item.quantity;
      }
      return sum + itemMwk(item.type as any, item.price) * item.quantity;
    }, 0);
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

  useEffect(() => {
    if (!orderComplete) return;
    scrollToTop();
  }, [orderComplete]);

  useEffect(() => {
    checkoutAnchorRef.current?.scrollIntoView({ behavior: 'auto', block: 'start' });
  }, [step]);

  useEffect(() => {
    if (!orderComplete || !completedHadUtility || !completedOrderId || completedUtilityTokens.length) return;
    if (!user?.email) return;
    let cancelled = false;
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    (async () => {
      for (let attempt = 0; attempt < 16; attempt++) {
        if (cancelled) return;
        if (attempt > 0) await sleep(2500);
        try {
          const verifyRes = await fetch(
            `${getApiBase()}/payments/paychangu/mobile-money/verify?orderId=${encodeURIComponent(completedOrderId)}`
          );
          const verifyData = await readResponseJson<{ utilityTokens?: UtilityBillCode[] }>(verifyRes);
          if (verifyData.utilityTokens?.length) {
            setCompletedUtilityTokens(verifyData.utilityTokens);
            return;
          }
          const res = await fetch(
            `${getApiBase()}/orders/me?email=${encodeURIComponent(user.email)}`
          );
          if (!res.ok) continue;
          const data = await res.json();
          const list = Array.isArray(data) ? data : data?.orders ?? [];
          const order = list.find((o: { id: string }) => o.id === completedOrderId);
          if (!order?.items) continue;
          const tokens = order.items.flatMap((item: { type?: string; giftCardCodes?: unknown }) =>
            item.type === 'utility-bill' ? parseUtilityBillCodes(item.giftCardCodes) : []
          );
          if (tokens.length) {
            setCompletedUtilityTokens(tokens);
            return;
          }
        } catch {
          /* retry */
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orderComplete, completedHadUtility, completedOrderId, completedUtilityTokens.length, user?.email]);

  useEffect(() => {
    fetchActivePromotions().then(setPromotions).catch(() => setPromotions([]));
  }, []);

  const refreshMobileMoneyStatus = useCallback(() => {
    const path =
      ACTIVE_MOBILE_MONEY_PROVIDER === 'paychangu'
        ? '/payments/paychangu/status'
        : '/payments/pawapay/status';
    fetch(`${getApiBase()}${path}`)
      .then((res) => res.json().catch(() => ({})))
      .then((data) => setMobileMoneyReady(Boolean(data?.enabled)))
      .catch(() => setMobileMoneyReady(false));
  }, []);

  useEffect(() => {
    refreshMobileMoneyStatus();
  }, [refreshMobileMoneyStatus]);

  useEffect(() => {
    if (step === 1) refreshMobileMoneyStatus();
  }, [step, refreshMobileMoneyStatus]);

  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const pcStatus = (q.get('paychangu') || '').trim();
    const pcOrderId = (q.get('orderId') || sessionStorage.getItem(MOBILE_MONEY_ORDER_KEY) || '').trim();
    if (pcStatus === 'failed') {
      const reason = q.get('reason') || 'payment_failed';
      const msg =
        reason === 'payment_not_verified'
          ? 'Payment was not completed. You can try mobile money checkout again.'
          : 'Mobile money payment could not be confirmed. If you paid, contact support with your receipt.';
      setMobileMoneyMessage(msg);
      alert(msg);
      window.history.replaceState({}, '', '/checkout');
      return;
    }
    if (pcStatus !== 'success' && pcStatus !== 'return') return;
    if (!pcOrderId) return;

    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    let cancelled = false;
    (async () => {
      setIsProcessing(true);
      setMobileMoneyMessage('Confirming your mobile money payment…');
      try {
        let lastError = 'Payment could not be verified.';
        const maxAttempts = pcStatus === 'success' ? 1 : 8;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          if (cancelled) return;
          if (attempt > 0) {
            setMobileMoneyMessage(`Still confirming payment… (${attempt + 1}/${maxAttempts})`);
            await sleep(2500);
          }
          const res = await fetch(
            `${getApiBase()}/payments/paychangu/verify?orderId=${encodeURIComponent(pcOrderId)}`
          );
          const data = await readResponseJson<{ ok?: boolean; orderId?: string; error?: string; reason?: string }>(res);
          if (res.ok && data.ok) {
            if (cancelled) return;
            sessionStorage.removeItem(MOBILE_MONEY_ORDER_KEY);
            setCompletedOrderId(data.orderId || pcOrderId);
            setCompletedHadUtility(state.items.some((i) => i.type === 'utility-bill'));
            await clearPersistedCart();
            setOrderComplete(true);
            setMobileMoneyMessage(null);
            window.history.replaceState({}, '', '/checkout');
            scrollToTop();
            return;
          }
          lastError = data.error || 'Payment could not be verified. If you paid, contact support.';
          if (pcStatus === 'success' || attempt === maxAttempts - 1) {
            throw new Error(lastError);
          }
        }
      } catch (e: unknown) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : 'Payment verification failed';
          setMobileMoneyMessage(msg);
          alert(msg);
        }
      } finally {
        if (!cancelled) setIsProcessing(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [location.search, clearPersistedCart]);

  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const depositId = (q.get('depositId') || '').trim();
    if (!depositId || !PAWAPAY_CHECKOUT_ENABLED) return;

    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const retryableReason = (reason?: string) => {
      if (!reason) return false;
      const r = reason.toLowerCase();
      return (
        r.startsWith('deposit_processing') ||
        r.startsWith('deposit_pending') ||
        r.startsWith('deposit_submitted') ||
        r.startsWith('deposit_in_progress') ||
        r === 'status_check_failed'
      );
    };

    let cancelled = false;
    (async () => {
      setIsProcessing(true);
      setMobileMoneyMessage('Confirming your mobile money payment…');
      try {
        let lastError = 'Payment could not be verified.';
        const maxAttempts = 8;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          if (cancelled) return;
          if (attempt > 0) {
            setMobileMoneyMessage(`Still confirming payment… (${attempt + 1}/${maxAttempts})`);
            await sleep(2500);
          }
          const res = await fetch(
            `${getApiBase()}/payments/pawapay/verify?depositId=${encodeURIComponent(depositId)}`
          );
          const data = await readResponseJson<{ ok?: boolean; error?: string; reason?: string }>(res);
          if (res.ok && data.ok) {
            if (cancelled) return;
            await clearPersistedCart();
            setOrderComplete(true);
            setMobileMoneyMessage(null);
            window.history.replaceState({}, '', '/checkout');
            scrollToTop();
            return;
          }
          lastError =
            data.error ||
            (data.reason === 'deposit_failed'
              ? 'Payment was not completed. Your order was not sent to admin — you can checkout again.'
              : 'Payment could not be verified. If you paid, contact support with your receipt.');
          if (!retryableReason(data.reason) || attempt === maxAttempts - 1) {
            throw new Error(lastError);
          }
        }
      } catch (e: unknown) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : 'Payment verification failed';
          setMobileMoneyMessage(msg);
          alert(msg);
        }
      } finally {
        if (!cancelled) setIsProcessing(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [location.search, clearPersistedCart]);

  useEffect(() => {
    const loadProfile = async () => {
      if (!user?.email) {
        setPointsBalance(0);
        setLifetimePurchaseUsd(0);
        setWalletBalanceUsd(0);
        return;
      }
      try {
        const res = await fetch(`${getApiBase()}/users/profile?email=${encodeURIComponent(user.email)}`);
        if (!res.ok) return;
        const profile = await res.json();
        setPointsBalance(Number(profile?.pointsBalance || 0));
        setLifetimePurchaseUsd(Number(profile?.lifetimePurchaseUsd || 0));
        setWalletBalanceUsd(Number(profile?.walletBalanceUsd || 0));
      } catch {
        /* ignore */
      }
    };
    loadProfile();
    const onWallet = () => loadProfile();
    window.addEventListener('tconnect-wallet-updated', onWallet);
    return () => window.removeEventListener('tconnect-wallet-updated', onWallet);
  }, [user?.email]);

  useEffect(() => {
    if (!(paymentMethod === 'paypal' && step === 2)) {
      paypalRenderedRef.current = false;
    }
  }, [paymentMethod, step]);

  const finalTotalUsd = promoResult.finalTotalUsd;
  const finalTotalMwk = discountedTotalMwk;
  const hasVirtualCardInCart = useMemo(
    () => state.items.some((item) => String(item.type || '').trim().toLowerCase() === 'virtual-card'),
    [state.items]
  );
  const hasUnderMinVirtualCard = useMemo(
    () =>
      state.items.some(
        (item) =>
          String(item.type || '').trim().toLowerCase() === 'virtual-card' &&
          Number(item.price) < VIRTUAL_CARD_MIN_CHECKOUT_USD
      ),
    [state.items]
  );
  const mobileMoneyWithinLimit = finalTotalUsd <= MOBILE_MONEY_MAX_CHECKOUT_USD + 0.0001;
  const mobileMoneyAllowedForCart = mobileMoneyWithinLimit;

  useEffect(() => {
    if (step !== 2 || paymentMethod !== 'mobile_money' || !MOBILE_MONEY_CHECKOUT_ENABLED) return;
    fetch(`${getApiBase()}/payments/paychangu/operators`)
      .then((res) => res.json().catch(() => ({})))
      .then((data) => {
        const ops = Array.isArray(data?.operators) ? data.operators : [];
        setMomoOperators(ops);
        if (ops.length && !momoOperatorRefId) {
          setMomoOperatorRefId(String(ops[0].ref_id || ''));
        }
      })
      .catch(() => setMomoOperators([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, paymentMethod]);
  const paypalFeeUsd = useMemo(() => Number((finalTotalUsd * 0.2).toFixed(2)), [finalTotalUsd]);
  const paypalTotalUsd = useMemo(() => Number((finalTotalUsd + paypalFeeUsd).toFixed(2)), [finalTotalUsd, paypalFeeUsd]);
  const paypalTotalMwk = useMemo(() => finalTotalMwk * 1.2, [finalTotalMwk]);
  const pointsNeeded = useMemo(() => Math.ceil(finalTotalUsd * POINTS_PER_USD), [finalTotalUsd]);
  const meetsMinPointsBalance = canPayWithTconnectPoints(pointsBalance);
  const meetsPurchaseRequirement = lifetimePurchaseUsd > MIN_LIFETIME_PURCHASE_USD_FOR_POINTS;
  const hasEnoughPointsForOrder = pointsBalance >= pointsNeeded;
  const canCheckoutWithPoints =
    canRedeemTconnectPoints(pointsBalance, lifetimePurchaseUsd) && hasEnoughPointsForOrder;
  const pointsBlockReason = pointsRedemptionBlockReason(pointsBalance, lifetimePurchaseUsd);
  const walletFeeUsd = useMemo(() => walletCheckoutFeeUsd(finalTotalUsd), [finalTotalUsd]);
  const walletTotalUsd = useMemo(() => walletCheckoutChargeUsd(finalTotalUsd), [finalTotalUsd]);
  const hasEnoughWallet = walletBalanceUsd >= walletTotalUsd - 0.001;
  const walletBalanceMwk = useMemo(
    () => getMwkAmountFromUsd(walletBalanceUsd, 'store_wallet'),
    [walletBalanceUsd]
  );
  const walletTotalMwk = useMemo(
    () => getMwkAmountFromUsd(walletTotalUsd, 'store_wallet'),
    [walletTotalUsd]
  );

  const handlePayByCardLink = () => {
    setPaymentMethod('cardLink');
    setShowCardContactMessage(true);
  };

  const handleMobileMoneyCheckout = async () => {
    if (!user?.email) {
      alert('Please sign in to pay with mobile money.');
      return;
    }
    if (!MOBILE_MONEY_CHECKOUT_ENABLED) {
      alert('Mobile money checkout is not available at the moment. Please use bank transfer, card link, or points.');
      return;
    }
    if (!mobileMoneyReady) {
      alert('Mobile money is not ready yet. Check payment settings on the server and refresh this page.');
      refreshMobileMoneyStatus();
      return;
    }
    if (!mobileMoneyWithinLimit) {
      alert(
        `Mobile money checkout is currently limited to $${MOBILE_MONEY_MAX_CHECKOUT_USD.toFixed(2)} max per order.`
      );
      return;
    }
    const mobile = momoMobile.trim().replace(/\s/g, '');
    if (!mobile || !momoOperatorRefId) {
      alert('Enter your mobile number and choose Airtel or TNM.');
      return;
    }
    const digits = mobile.replace(/\D/g, '');
    if (digits.length < 9) {
      alert('Enter a valid Malawi mobile number (9 digits), e.g. 0991234567.');
      return;
    }
    setIsProcessing(true);
    setMobileMoneyMessage(null);
    try {
      const orderPaymentMethod =
        ACTIVE_MOBILE_MONEY_PROVIDER === 'paychangu' ? 'paychangu' : 'pawapay';
      const orderData = await createOrderRecord(orderPaymentMethod, null);
      sessionStorage.setItem(MOBILE_MONEY_ORDER_KEY, orderData.id);

      if (ACTIVE_MOBILE_MONEY_PROVIDER === 'paychangu') {
        const nameParts = (user.name || '').trim().split(/\s+/).filter(Boolean);
        const firstName = nameParts[0] || user.email.split('@')[0] || 'Customer';
        const lastName = nameParts.slice(1).join(' ');
        const res = await fetch(`${getApiBase()}/payments/paychangu/mobile-money/charge`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: orderData.id,
            customerEmail: user.email,
            firstName,
            lastName,
            mobile,
            operatorRefId: momoOperatorRefId,
          }),
        });
        const data = await readResponseJson<{ ok?: boolean; chargeId?: string; error?: string; message?: string }>(res);
        if (!res.ok || !data.ok) {
          throw new Error(data.error || 'Could not start mobile money payment.');
        }
        setMobileMoneyMessage(data.message || 'Check your phone and approve the payment prompt…');
        const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
        for (let attempt = 0; attempt < 24; attempt++) {
          await sleep(attempt === 0 ? 2000 : 3000);
          setMobileMoneyMessage(
            attempt === 0
              ? 'Waiting for approval on your phone…'
              : `Still waiting… (${attempt + 1}/24) — approve the prompt on your phone`
          );
          const verifyRes = await fetch(
            `${getApiBase()}/payments/paychangu/mobile-money/verify?orderId=${encodeURIComponent(orderData.id)}`
          );
          const verifyData = await readResponseJson<{
            ok?: boolean;
            orderId?: string;
            pending?: boolean;
            error?: string;
            utilityTokens?: UtilityBillCode[];
          }>(verifyRes);
          if (verifyRes.ok && verifyData.ok) {
            sessionStorage.removeItem(MOBILE_MONEY_ORDER_KEY);
            setCompletedOrderId(verifyData.orderId || orderData.id);
            const hadUtility = state.items.some((i) => i.type === 'utility-bill');
            setCompletedHadUtility(hadUtility);
            if (verifyData.utilityTokens?.length) {
              setCompletedUtilityTokens(verifyData.utilityTokens);
            }
            await clearPersistedCart();
            setOrderComplete(true);
            setMobileMoneyMessage(null);
            setIsProcessing(false);
            scrollToTop();
            return;
          }
          if (!verifyData.pending && !verifyRes.ok && attempt > 2) {
            throw new Error(verifyData.error || 'Payment was not confirmed.');
          }
        }
        throw new Error('Payment timed out. If you approved on your phone, check Order History shortly.');
        return;
      }

      const res = await fetch(`${getApiBase()}/payments/pawapay/initiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: orderData.id,
          customerEmail: user.email,
          customerName: user.name || user.email.split('@')[0] || 'Customer',
        }),
      });
      const data = await readResponseJson<{ redirectUrl?: string; error?: string }>(res);
      if (!res.ok || !data.redirectUrl) {
        throw new Error(data.error || 'Could not open mobile money payment.');
      }
      window.location.href = data.redirectUrl;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Mobile money checkout failed';
      setMobileMoneyMessage(msg);
      alert(msg);
      setIsProcessing(false);
    }
  };

  const createOrderRecord = useCallback(
    async (
      method: 'bank' | 'paypal' | 'points' | 'paychangu' | 'pawapay' | 'wallet',
      payment: Record<string, any> | null,
      totals?: { totalUsd?: number; totalMwk?: number },
      extras?: { pointsUsed?: number; pointsReceiptUrl?: string; pointsReceiptId?: string }
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
          prismaUserId: user?.dbUserId ?? undefined,
          paymentMethod: method,
          ...(extras?.pointsUsed ? { pointsUsed: extras.pointsUsed } : {}),
          ...(extras?.pointsReceiptUrl ? { pointsReceiptUrl: extras.pointsReceiptUrl } : {}),
          ...(extras?.pointsReceiptId ? { pointsReceiptId: extras.pointsReceiptId } : {}),
          promotionsApplied: promoResult.appliedPromotions,
          promotionDiscountUsd: promoResult.totalDiscountUsd,
          ...(payment ? { payment } : {}),
          ...(method === 'wallet'
            ? { cartSubtotalUsd: finalTotalUsd, totalUsd: walletTotalUsd }
            : {}),
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
      user?.dbUserId,
      promoResult.appliedPromotions,
      promoResult.totalDiscountUsd,
      walletTotalUsd,
      finalTotalUsd,
    ]
  );

  const handleWalletCheckout = async () => {
    if (!WALLET_CHECKOUT_ENABLED) {
      alert('Wallet checkout is not available at the moment. Please use bank transfer, card link, or points.');
      return;
    }
    if (!user?.email) {
      alert('Sign in to pay with Wallet.');
      return;
    }
    if (!hasEnoughWallet) {
      alert(
        `Wallet balance is $${walletBalanceUsd.toFixed(2)}. You need $${walletTotalUsd.toFixed(2)} (includes ${WALLET_CHECKOUT_SURCHARGE_PERCENT}% fee). Add money in Wallet first.`
      );
      return;
    }
    setIsProcessing(true);
    try {
      await createOrderRecord(
        'wallet',
        {
          method: 'wallet',
          senderName: user.name || user.email,
          accountName: 'TConnect Wallet',
        },
        { totalUsd: walletTotalUsd, totalMwk: walletTotalMwk }
      );
      await clearPersistedCart();
      window.dispatchEvent(new Event('tconnect-wallet-updated'));
      setOrderComplete(true);
      scrollToTop();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Wallet checkout failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePointsCheckout = async () => {
    if (!user?.email) {
      alert('Please sign in again to use points.');
      return;
    }
    if (!canRedeemTconnectPoints(pointsBalance, lifetimePurchaseUsd)) {
      alert(
        pointsBlockReason ||
          `You need more than $${MIN_LIFETIME_PURCHASE_USD_FOR_POINTS} in approved TConnect purchases and at least ${MIN_POINTS_BALANCE_FOR_CHECKOUT.toLocaleString()} points ($10 value) before you can pay with points.`
      );
      return;
    }
    if (!hasEnoughPointsForOrder) {
      alert('Not enough points for this order total.');
      return;
    }
    setIsProcessing(true);
    try {
      let resolvedUserId = user.dbUserId;
      if (!resolvedUserId) {
        const profileRes = await fetch(`${getApiBase()}/users/profile?email=${encodeURIComponent(user.email)}`);
        if (profileRes.ok) {
          const profile = await profileRes.json().catch(() => ({}));
          resolvedUserId = typeof profile?.id === 'string' ? profile.id : undefined;
        }
      }
      const receiptId = `PTS-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      const API_BASE = getApiBase();
      const receiptRes = await fetch(`${API_BASE}/users/receipts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiptId,
          userId: resolvedUserId,
          customerName: user.name || user.email,
          email: user.email,
          points: pointsNeeded,
          usdValue: Number(finalTotalUsd.toFixed(2)),
        }),
      });
      if (!receiptRes.ok) {
        const err = await receiptRes.json().catch(() => ({}));
        throw new Error(err?.error || 'Failed to create points receipt');
      }

      await createOrderRecord(
        'points',
        {
          method: 'points',
          senderName: user.name || user.email,
          accountName: 'TConnect Points',
          transactionId: receiptId,
        },
        undefined,
        {
          pointsUsed: pointsNeeded,
          pointsReceiptUrl: `points-receipt:${receiptId}`,
          pointsReceiptId: receiptId,
        }
      );
      await clearPersistedCart();
      setOrderComplete(true);
      scrollToTop();
    } catch (e: any) {
      alert(e?.message || 'Failed to complete points checkout');
    } finally {
      setIsProcessing(false);
    }
  };

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
      scrollToTop();
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
      scrollToTop();
    } catch (e: any) {
      setPaypalMessage(e?.message || 'Mock PayPal simulation failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    if (!CHECKOUT_PAYPAL_ENABLED || !(paymentMethod === 'paypal' && step === 2)) return;
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
                scrollToTop();
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
              {completedHadUtility ? 'Payment confirmed!' : 'Order Submitted Successfully! ✅'}
            </h1>
            {completedOrderId && (
              <p className="text-sm text-gray-500 mb-4 font-mono">
                Order #{completedOrderId.substring(0, 8)}
              </p>
            )}
            {completedHadUtility ? (
              <>
                {completedUtilityTokens.length > 0 ? (
                  <div className="max-w-md mx-auto text-left mb-8 p-5 rounded-xl bg-amber-400/10 border border-amber-400/30">
                    <p className="text-amber-300 font-bold mb-3 text-center">Your utility token</p>
                    {completedUtilityTokens.map((entry, i) => (
                      <div key={i} className="p-3 bg-dark-bg rounded-lg border border-amber-400/20 mb-2">
                        <div className="font-mono text-amber-200 text-lg break-all text-center">
                          {entry.token || entry.receipt}
                        </div>
                        {(entry.customerName || entry.biller) && (
                          <p className="text-xs text-gray-500 mt-2 text-center">
                            {entry.customerName && (
                              <span className="text-amber-300/90 block mb-1">{entry.customerName}</span>
                            )}
                            {entry.biller} · {entry.account}
                            {entry.amountMwk ? ` · MWK ${Number(entry.amountMwk).toLocaleString()}` : ''}
                          </p>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(String(entry.token || entry.receipt || ''));
                            alert('Token copied!');
                          }}
                          className="mt-3 w-full py-2 rounded-lg bg-amber-400/20 text-amber-200 text-sm font-semibold hover:bg-amber-400/30"
                        >
                          Copy token
                        </button>
                      </div>
                    ))}
                    <p className="text-xs text-gray-500 text-center mt-2">
                      Saved in <Link to="/orders" className="text-neon-blue hover:underline">Order History</Link> too.
                    </p>
                  </div>
                ) : (
                  <>
                    <p className="text-xl text-gray-300 mb-4">
                      Payment received — paying your bill now. Your token will appear here in a moment…
                    </p>
                    <p className="text-lg text-gray-400 mb-8 flex items-center justify-center gap-2">
                      <span className="inline-block w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                      Processing bill payment
                    </p>
                  </>
                )}
              </>
            ) : (
              <>
                <p className="text-xl text-gray-300 mb-4">
                  Your order has been received and is now <strong className="text-yellow-400">pending</strong> review.
                </p>
                <p className="text-lg text-gray-400 mb-8">
                  Track your order status in <strong className="text-neon-blue">My Orders</strong>. You'll receive your digital items once the order is approved.
                </p>
              </>
            )}
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
    <div className="min-h-screen bg-dark-bg pb-8 md:pb-12">
      <div ref={checkoutAnchorRef} className="max-w-lg mx-auto px-4 sm:px-6 py-6 md:py-10 scroll-mt-20">
        <div className="flex items-center justify-between mb-6 md:mb-8">
          <Link
            to={utilityCheckoutMode ? '/utility-bills' : '/cart'}
            className="flex items-center text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5 mr-1" />
            <span className="text-sm">{utilityCheckoutMode ? 'Utility bills' : 'Cart'}</span>
          </Link>
          <span className="text-xs text-gray-500">
            Step {utilityCheckoutMode ? 1 : step} of {totalSteps}
          </span>
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
              {CHECKOUT_PAYPAL_ENABLED && (
                <p className="text-xs text-gray-500 mb-3">
                  PayPal charges +20% in USD at checkout.
                </p>
              )}
              {promoResult.totalDiscountUsd > 0 && (
                <p className="text-xs text-neon-green mb-4">
                  Promotion discount applied: ${promoResult.totalDiscountUsd.toFixed(2)}
                </p>
              )}
              {hasUnderMinVirtualCard && (
                <p className="text-xs text-amber-300 mb-4">
                  Virtual cards require at least ${VIRTUAL_CARD_MIN_CHECKOUT_USD.toFixed(2)} per item.
                </p>
              )}
              {utilityCheckoutMode ? (
                <p className="text-sm text-green-300 mb-4 p-3 rounded-lg bg-green-500/10 border border-green-500/30">
                  Utility bills are paid with <strong>mobile money only</strong>. Confirm below to approve payment on your phone.
                </p>
              ) : (
                <p className="text-sm text-gray-400 mb-3">How do you want to pay?</p>
              )}
              {!utilityCheckoutMode && (
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
                {MOBILE_MONEY_CHECKOUT_ENABLED ? (
                  <button
                    type="button"
                    disabled={!mobileMoneyAllowedForCart}
                    onClick={() => {
                      if (!mobileMoneyAllowedForCart) return;
                      setPaymentMethod('mobile_money');
                      setStep(2);
                      setShowCardContactMessage(false);
                    }}
                    className={`p-4 rounded-xl border-2 flex items-center gap-3 text-left ${
                      mobileMoneyAllowedForCart
                        ? 'border-dark-border hover:border-green-500/60 hover:bg-green-500/10'
                        : 'border-dark-border opacity-60 cursor-not-allowed'
                    }`}
                  >
                    <Smartphone className="w-8 h-8 text-green-400 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-white">Mobile money</p>
                      <p className="text-xs text-gray-400">
                        {mobileMoneyWithinLimit
                          ? 'Airtel Money / TNM Mpamba · up to $10'
                          : `Unavailable above $${MOBILE_MONEY_MAX_CHECKOUT_USD.toFixed(2)} total`}
                      </p>
                    </div>
                  </button>
                ) : (
                  <div
                    className="p-4 rounded-xl border-2 border-dashed border-dark-border bg-dark-surface/50 flex items-center gap-3 text-left opacity-90"
                    role="note"
                  >
                    <Smartphone className="w-8 h-8 flex-shrink-0 text-gray-500" />
                    <div>
                      <p className="font-semibold text-gray-400">Mobile money</p>
                      <p className="text-xs text-amber-300/95 mt-0.5">
                        {MOBILE_MONEY_CHECKOUT_ENABLED
                          ? 'Setting up — refresh shortly or use bank transfer, card link, or points.'
                          : 'Not available at the moment. Please use bank transfer, card link, or points.'}
                      </p>
                    </div>
                  </div>
                )}
                {WALLET_CHECKOUT_ENABLED ? (
                  <button
                    type="button"
                    disabled={!user?.email || !hasEnoughWallet}
                    onClick={() => {
                      if (!hasEnoughWallet) return;
                      setPaymentMethod('wallet');
                      setStep(2);
                      setShowCardContactMessage(false);
                    }}
                    className={`p-4 rounded-xl border-2 flex items-center gap-3 text-left ${
                      hasEnoughWallet
                        ? 'border-dark-border hover:border-amber-500/60 hover:bg-amber-500/10'
                        : 'border-dark-border opacity-60 cursor-not-allowed'
                    }`}
                  >
                    <WalletIcon className="w-8 h-8 text-amber-400 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-white">Wallet</p>
                      <p className="text-xs text-gray-400">
                        Balance ${walletBalanceUsd.toFixed(2)} (MWK {walletBalanceMwk.toLocaleString()})
                        {hasEnoughWallet ? ' — enough' : ` — need $${walletTotalUsd.toFixed(2)} incl. ${WALLET_CHECKOUT_SURCHARGE_PERCENT}% fee`}
                      </p>
                      {!hasEnoughWallet && user?.email && (
                        <Link to="/wallet" className="text-xs text-amber-300 hover:underline mt-0.5 inline-block">
                          Add money to Wallet
                        </Link>
                      )}
                    </div>
                  </button>
                ) : (
                  <div
                    className="p-4 rounded-xl border-2 border-dashed border-dark-border bg-dark-surface/50 flex items-center gap-3 text-left opacity-90"
                    role="note"
                  >
                    <WalletIcon className="w-8 h-8 flex-shrink-0 text-gray-500" />
                    <div>
                      <p className="font-semibold text-gray-400">Wallet</p>
                      <p className="text-xs text-amber-300/95 mt-0.5">
                        Under construction. Please use bank transfer, mobile money, card link, or points.
                      </p>
                    </div>
                  </div>
                )}
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
                  disabled={!meetsPurchaseRequirement || !meetsMinPointsBalance}
                  onClick={() => {
                    if (!meetsPurchaseRequirement || !meetsMinPointsBalance) return;
                    setPaymentMethod('points');
                    setStep(2);
                    setShowCardContactMessage(false);
                  }}
                  className={`p-4 rounded-xl border-2 flex items-center gap-3 text-left sm:col-span-2 ${
                    meetsPurchaseRequirement && meetsMinPointsBalance
                      ? 'border-dark-border hover:border-purple-400/70 hover:bg-purple-500/10'
                      : 'border-dark-border opacity-60 cursor-not-allowed'
                  }`}
                >
                  <Gift className="w-8 h-8 text-purple-300 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-white">TConnect Points</p>
                    {!meetsPurchaseRequirement ? (
                      <p className="text-xs text-amber-300/90">
                        Need more than ${MIN_LIFETIME_PURCHASE_USD_FOR_POINTS} in approved TConnect purchases
                        (yours: ${lifetimePurchaseUsd.toFixed(2)})
                      </p>
                    ) : meetsMinPointsBalance ? (
                      <p className="text-xs text-gray-400">
                        Order needs {pointsNeeded.toLocaleString()} pts —{' '}
                        {hasEnoughPointsForOrder ? 'you have enough' : 'not enough for this total'}
                      </p>
                    ) : (
                      <p className="text-xs text-amber-300/90">
                        Need at least {MIN_POINTS_BALANCE_FOR_CHECKOUT.toLocaleString()} pts ($10) in your balance to
                        use points at checkout
                      </p>
                    )}
                  </div>
                </button>
                {CHECKOUT_PAYPAL_ENABLED ? (
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentMethod('paypal');
                      setStep(2);
                      setShowCardContactMessage(false);
                    }}
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
                ) : (
                  <div
                    className="p-4 rounded-xl border-2 border-dashed border-dark-border bg-dark-surface/50 flex items-center gap-3 text-left sm:col-span-2 cursor-not-allowed opacity-90"
                    role="note"
                    aria-label="PayPal unavailable"
                  >
                    <Wallet className="w-8 h-8 text-gray-500 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-gray-400">PayPal</p>
                      <p className="text-xs text-amber-300/95 leading-relaxed">{PAYPAL_DISABLED_MESSAGE}</p>
                    </div>
                  </div>
                )}
              </div>
              )}

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

          {step === 2 && paymentMethod === 'mobile_money' && (
            <div className="card-dark p-5 rounded-xl border border-green-500/30 bg-green-500/5">
              <h2 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-green-400" />
                {utilityCheckoutMode ? 'Pay utility bill' : 'Mobile money'}
              </h2>
              {utilityCheckoutMode && state.items[0] && (() => {
                const meta = state.items[0].metadata as Record<string, unknown> | undefined;
                const meterAccount = meta?.account != null ? String(meta.account) : '';
                const meterName =
                  (meta?.customerName != null ? String(meta.customerName) : '') ||
                  extractBillCustomerName(meta?.validated as Record<string, unknown> | undefined) ||
                  '';
                const { billMwk, serviceFeeMwk, totalChargeMwk } = utilityBillChargeFromMetadata(meta);
                return (
                  <div className="mb-4 p-4 rounded-xl border-2 border-amber-400/40 bg-amber-400/10 text-sm">
                    <p className="text-amber-300 text-xs font-bold uppercase mb-3">Confirm before you pay</p>
                    {meterAccount && (
                      <div className="flex justify-between gap-2 mb-2">
                        <span className="text-gray-400">Meter / account</span>
                        <span className="text-white font-mono">{meterAccount}</span>
                      </div>
                    )}
                    {meterName ? (
                      <div className="mb-2">
                        <p className="text-gray-400 text-xs mb-1">Account holder name</p>
                        <p className="text-amber-100 text-lg font-bold">{meterName}</p>
                      </div>
                    ) : (
                      <p className="text-amber-200/90 text-xs mb-2">
                        Name not available — verify your meter number on the utility bills page.
                      </p>
                    )}
                    <div className="pt-2 border-t border-amber-400/20 space-y-1 text-xs">
                      <div className="flex justify-between gap-2 text-gray-400">
                        <span>Bill amount</span>
                        <span className="text-gray-200">MWK {billMwk.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between gap-2 text-gray-400">
                        <span>Service fee ({UTILITY_BILL_SERVICE_FEE_PERCENT}%)</span>
                        <span className="text-gray-200">MWK {serviceFeeMwk.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between gap-2 font-semibold text-amber-100">
                        <span>You pay</span>
                        <span>MWK {totalChargeMwk.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                );
              })()}
              <p className="text-sm text-gray-300 mb-2">
                Pay <strong className="text-white">MWK {Math.round(finalTotalMwk).toLocaleString()}</strong> with Airtel or TNM.
              </p>
              {!mobileMoneyAllowedForCart && (
                <p className="text-xs text-amber-300 mb-2">
                  Mobile money checkout is currently limited to ${MOBILE_MONEY_MAX_CHECKOUT_USD.toFixed(2)} max per order.
                </p>
              )}
              <label className="block text-sm text-gray-300 mb-1 mt-3">Network</label>
              <div className="grid grid-cols-2 gap-2 mb-3">
                {momoOperators.map((op) => (
                  <button
                    key={op.ref_id}
                    type="button"
                    onClick={() => setMomoOperatorRefId(op.ref_id)}
                    className={`py-2.5 px-3 rounded-lg border text-sm font-medium ${
                      momoOperatorRefId === op.ref_id
                        ? 'border-green-400 bg-green-500/20 text-white'
                        : 'border-dark-border text-gray-300 hover:border-green-500/50'
                    }`}
                  >
                    {op.name}
                  </button>
                ))}
              </div>
              <label className="block text-sm text-gray-300 mb-1">Mobile number</label>
              <input
                type="tel"
                value={momoMobile}
                onChange={(e) => setMomoMobile(e.target.value)}
                placeholder="0991234567"
                className="w-full mb-1 px-3 py-2.5 rounded-lg bg-dark-surface border border-dark-border text-white"
              />
              <p className="text-xs text-gray-500 mb-3">Use 9 digits (e.g. 099… or 088…). Do not include +265.</p>
              {mobileMoneyMessage && <p className="text-sm text-amber-200 mb-2">{mobileMoneyMessage}</p>}
              <button
                type="button"
                disabled={isProcessing || !mobileMoneyAllowedForCart || !momoMobile.trim() || !momoOperatorRefId}
                onClick={handleMobileMoneyCheckout}
                className="w-full py-3 rounded-xl bg-green-600 text-white font-bold hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing ? 'Waiting for phone approval…' : 'Pay with mobile money'}
              </button>
            </div>
          )}

          {step === 2 && paymentMethod === 'wallet' && (
            <div className="card-dark p-5 rounded-xl border border-amber-500/30 bg-amber-500/5">
              <h2 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                <WalletIcon className="w-5 h-5 text-amber-400" />
                Pay with Wallet
              </h2>
              <p className="text-sm text-gray-300">
                Your balance: <strong className="text-amber-300">${walletBalanceUsd.toFixed(2)} USD</strong>
                <span className="text-gray-500"> (MWK {walletBalanceMwk.toLocaleString()})</span>
              </p>
              <p className="text-sm text-gray-300 mt-1">
                Subtotal: <strong className="text-white">${finalTotalUsd.toFixed(2)}</strong>
              </p>
              <p className="text-sm text-gray-300 mt-1">
                Wallet fee ({WALLET_CHECKOUT_SURCHARGE_PERCENT}%):{' '}
                <span className="text-amber-300">+${walletFeeUsd.toFixed(2)} USD</span>
              </p>
              <p className="text-sm text-white font-semibold mt-2">
                Charged from Wallet: ${walletTotalUsd.toFixed(2)} USD
                <span className="text-gray-400 font-normal"> (MWK {walletTotalMwk.toLocaleString()})</span>
              </p>
            </div>
          )}

          {step === 2 && paymentMethod === 'points' && (
            <>
              <p className="text-sm text-gray-300 mb-2">Pay with TConnect Points</p>
              <div className="p-4 rounded-xl bg-dark-surface border border-purple-400/30 space-y-2">
                <p className="text-sm text-gray-300">
                  Required points: <span className="text-white font-bold">{pointsNeeded.toLocaleString()}</span>
                </p>
                <p className="text-sm text-gray-300">
                  Your balance: <span className="text-purple-300 font-bold">{pointsBalance.toLocaleString()}</span>
                </p>
                <p className="text-sm text-gray-300">
                  Approved purchases:{' '}
                  <span className="text-white font-semibold">${lifetimePurchaseUsd.toFixed(2)}</span>
                  <span className="text-gray-500 text-xs"> (need &gt; ${MIN_LIFETIME_PURCHASE_USD_FOR_POINTS})</span>
                </p>
                {pointsBlockReason && (
                  <p className="text-xs text-amber-300">{pointsBlockReason}</p>
                )}
                {meetsPurchaseRequirement && meetsMinPointsBalance && !hasEnoughPointsForOrder && (
                  <p className="text-xs text-red-400">You need more points to cover this order total.</p>
                )}
              </div>
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

          {step === 2 && paymentMethod === 'paypal' && CHECKOUT_PAYPAL_ENABLED && (
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

          {/* Step actions — in-flow so Next sits right below content on mobile */}
          <div className="flex flex-col gap-2 mt-6 pt-5 border-t border-dark-border">
            {step === 2 && paymentMethod === 'bank' && !senderName.trim() && (
              <p className="text-xs text-red-400 text-center">Enter your name to continue</p>
            )}
            <div className="flex gap-3">
              {step > 1 ? (
                <button
                  type="button"
                  onClick={() => {
                    setStep((s) => s - 1);
                    if (step === 2) setPaymentMethod(null);
                  }}
                  className="flex-1 md:flex-none px-5 py-3 rounded-xl border border-dark-border text-gray-300 hover:bg-dark-surface flex items-center justify-center gap-2 min-h-[48px]"
                >
                  <ChevronLeft className="w-5 h-5" />
                  Back
                </button>
              ) : (
                <div className="hidden md:block md:flex-none" />
              )}
              {paymentMethod === 'bank' && step === 2 ? (
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  disabled={!senderName.trim()}
                  className="flex-[2] md:flex-none px-6 py-3 rounded-xl btn-cyber text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed min-h-[48px]"
                >
                  Next
                  <ChevronRight className="w-5 h-5" />
                </button>
              ) : paymentMethod === 'bank' && step === 3 ? (
                <button
                  onClick={handleCheckout}
                  disabled={isProcessing}
                  className={`flex-[2] md:flex-none px-6 py-3 rounded-xl font-semibold flex items-center justify-center gap-2 min-h-[48px] ${
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
              ) : paymentMethod === 'points' && step === 2 ? (
                <button
                  onClick={handlePointsCheckout}
                  disabled={isProcessing || !canCheckoutWithPoints}
                  className={`flex-[2] md:flex-none px-6 py-3 rounded-xl font-semibold flex items-center justify-center gap-2 min-h-[48px] ${
                    isProcessing || !canCheckoutWithPoints
                      ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                      : 'bg-purple-600 text-white hover:bg-purple-700'
                  }`}
                >
                  {isProcessing ? 'Processing...' : 'Place order with points'}
                </button>
              ) : paymentMethod === 'wallet' && step === 2 ? (
                <button
                  onClick={handleWalletCheckout}
                  disabled={isProcessing || !hasEnoughWallet}
                  className={`flex-[2] md:flex-none px-6 py-3 rounded-xl font-semibold flex items-center justify-center gap-2 min-h-[48px] ${
                    isProcessing || !hasEnoughWallet
                      ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                      : 'bg-amber-600 text-white hover:bg-amber-500'
                  }`}
                >
                  {isProcessing ? 'Processing...' : 'Place order with Wallet'}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Checkout;
