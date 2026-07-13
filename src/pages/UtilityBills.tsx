import React, { useEffect, useMemo, useState } from 'react';

import { Link, useNavigate } from 'react-router-dom';

import { ArrowLeft, Zap, Loader2, Smartphone } from 'lucide-react';

import { getApiBase } from '../lib/getApiBase';

import { readResponseJson } from '../lib/parseResponseJson';

import { useCart } from '../context/CartContext';

import { useAuth } from '../context/AuthContext';

import { withCartLineId } from '../lib/cartTypes';

import { getMwkAmountFromUsd } from '../utils/rates';

import { MOBILE_MONEY_MAX_CHECKOUT_USD } from '../lib/checkoutFlags';
import { extractBillCustomerName, extractBillAmountMwk } from '../lib/utilityBillValidation';
import {
  UTILITY_BILL_SERVICE_FEE_PERCENT,
  utilityBillChargeMwk,
  utilityBillServiceFeeMwk,
} from '../lib/utilityBillFees';



type Biller = {

  biller_id: string;

  name: string;

  type?: string;

  account_type_required?: boolean;

  validation_required?: boolean;

  input?: { label?: string; placeholder?: string };

};



const UtilityBills: React.FC = () => {

  const { dispatch } = useCart();

  const { user } = useAuth();

  const navigate = useNavigate();

  const [billers, setBillers] = useState<Biller[]>([]);

  const [loading, setLoading] = useState(true);

  const [billerId, setBillerId] = useState('');

  const [account, setAccount] = useState('');

  const [accountType, setAccountType] = useState<'MEMBER' | 'GROUP'>('MEMBER');

  const [amountMwk, setAmountMwk] = useState('');

  const [customerName, setCustomerName] = useState('');

  const [validating, setValidating] = useState(false);

  const [message, setMessage] = useState<string | null>(null);

  const [validated, setValidated] = useState<Record<string, unknown> | null>(null);
  const [validatedCustomerName, setValidatedCustomerName] = useState<string | null>(null);



  const selected = useMemo(

    () => billers.find((b) => b.biller_id === billerId) || null,

    [billers, billerId]

  );



  useEffect(() => {

    fetch(`${getApiBase()}/utility-bills/billers`)

      .then((res) => res.json().catch(() => ({})))

      .then((data) => {

        const list = Array.isArray(data?.billers) ? data.billers : [];

        setBillers(list);

        if (list[0]?.biller_id) setBillerId(String(list[0].biller_id));

      })

      .catch(() => setBillers([]))

      .finally(() => setLoading(false));

  }, []);



  const resolvedAmountMwk = useMemo(() => {

    const fromField = Number(amountMwk);

    if (Number.isFinite(fromField) && fromField > 0) return Math.round(fromField);

    const fromValidate = Number((validated as any)?.amount ?? (validated as any)?.balance ?? 0);

    if (Number.isFinite(fromValidate) && fromValidate > 0) return Math.round(fromValidate);

    return 0;

  }, [amountMwk, validated]);



  const serviceFeeMwk = useMemo(
    () => utilityBillServiceFeeMwk(resolvedAmountMwk),
    [resolvedAmountMwk]
  );

  const totalChargeMwk = useMemo(
    () => utilityBillChargeMwk(resolvedAmountMwk),
    [resolvedAmountMwk]
  );

  const priceUsd = useMemo(() => {
    if (!totalChargeMwk) return 0;
    const mwkPerUsd = getMwkAmountFromUsd(1, 'wallet');
    return Number((totalChargeMwk / mwkPerUsd).toFixed(2));
  }, [totalChargeMwk]);



  const handleValidate = async () => {

    if (!billerId || !account.trim()) {

      setMessage('Choose a biller and enter the account / meter number.');

      return;

    }

    setValidating(true);

    setMessage(null);

    setValidated(null);
    setValidatedCustomerName(null);

    try {

      const res = await fetch(`${getApiBase()}/utility-bills/validate`, {

        method: 'POST',

        headers: { 'Content-Type': 'application/json' },

        body: JSON.stringify({

          biller: billerId,

          account: account.trim(),

          accountType: selected?.account_type_required ? accountType : undefined,

          amount: amountMwk.trim() || undefined,

          billerName: selected?.name,

        }),

      });

      const data = await readResponseJson<{
        ok?: boolean;
        data?: Record<string, unknown>;
        customerName?: string | null;
        amountMwk?: number | null;
        message?: string;
        error?: string;
      }>(res);

      if (!res.ok || !data.ok) {

        throw new Error(data.error || 'Could not validate bill.');

      }

      const payload = data.data || {};
      const name =
        (typeof data.customerName === 'string' && data.customerName.trim()) ||
        extractBillCustomerName(payload, data.message) ||
        extractBillCustomerName(payload);
      setValidated(payload);
      setValidatedCustomerName(name);
      if (name) setCustomerName(name);
      const suggestedAmount = data.amountMwk ?? extractBillAmountMwk(payload);
      if (suggestedAmount && !amountMwk.trim()) setAmountMwk(String(suggestedAmount));
      setMessage(
        name
          ? `Validated: ${name}. Tap Pay with mobile money to continue.`
          : 'Bill validated. Tap Pay with mobile money to continue.'
      );

    } catch (e: unknown) {

      setMessage(e instanceof Error ? e.message : 'Validation failed');

    } finally {

      setValidating(false);

    }

  };



  const handlePayNow = () => {

    if (!user?.email) {

      setMessage('Please sign in to pay a utility bill.');

      navigate('/signin', { state: { from: '/utility-bills' } });

      return;

    }

    if (!validated) {
      setMessage('Tap Validate bill first so we can show the meter account name.');
      return;
    }

    if (!resolvedAmountMwk || priceUsd <= 0) {

      setMessage('Enter or validate the bill amount first.');

      return;

    }

    if (priceUsd > MOBILE_MONEY_MAX_CHECKOUT_USD + 0.001) {

      setMessage(`Utility bills must be $${MOBILE_MONEY_MAX_CHECKOUT_USD} or less for mobile money checkout.`);

      return;

    }

    const meterName =
      validatedCustomerName ||
      extractBillCustomerName(validated) ||
      customerName.trim() ||
      undefined;

    const item = withCartLineId({

      id: `utility-${billerId}-${account.trim()}`,

      name: meterName
        ? `${selected?.name || billerId} · ${account.trim()} · ${meterName}`
        : `${selected?.name || billerId} · ${account.trim()}`,

      price: priceUsd,

      category: 'utilities',

      type: 'utility-bill',

      quantity: 1,

      metadata: {

        biller: billerId,

        account: account.trim(),

        accountType: selected?.account_type_required ? accountType : undefined,

        customerName: meterName,

        amountMwk: resolvedAmountMwk,

        serviceFeeMwk,

        totalChargeMwk,

        validated,

      },

    });

    dispatch({ type: 'CLEAR_CART' });

    dispatch({ type: 'ADD_ITEM', payload: item });

    navigate('/checkout', { state: { utilityCheckout: true } });

  };



  return (

    <div className="min-h-screen bg-dark-bg">

      <div className="max-w-2xl mx-auto px-4 py-6">

        <div className="flex items-center gap-3 mb-6">

          <Link to="/" className="text-gray-400 hover:text-neon-blue">

            <ArrowLeft className="w-5 h-5" />

          </Link>

          <h1 className="text-2xl font-bold text-white flex items-center gap-2">

            <Zap className="w-6 h-6 text-amber-400" />

            Utility bills

          </h1>

        </div>



        <p className="text-gray-400 text-sm mb-6">

          Pay ESCOM, water, MASM, MRA and more with mobile money. A {UTILITY_BILL_SERVICE_FEE_PERCENT}% service fee
          applies. Your token appears right after payment in{' '}

          <Link to="/orders" className="text-neon-blue hover:underline">

            Order History

          </Link>

          .

        </p>



        {loading ? (

          <div className="text-gray-400 flex items-center gap-2">

            <Loader2 className="w-4 h-4 animate-spin" /> Loading billers…

          </div>

        ) : (

          <div className="card-dark p-5 rounded-xl border border-dark-border space-y-4">

            <div>

              <label className="text-sm text-gray-300 block mb-1">Biller</label>

              <select

                value={billerId}

                onChange={(e) => {

                  setBillerId(e.target.value);

                  setValidated(null);

                }}

                className="w-full px-3 py-2.5 rounded-lg bg-dark-surface border border-dark-border text-white"

              >

                {billers.map((b) => (

                  <option key={b.biller_id} value={b.biller_id}>

                    {b.name}

                  </option>

                ))}

              </select>

            </div>



            <div>

              <label className="text-sm text-gray-300 block mb-1">

                {selected?.input?.label || 'Account / meter number'}

              </label>

              <input

                value={account}

                onChange={(e) => setAccount(e.target.value)}

                placeholder={selected?.input?.placeholder || 'Enter account number'}

                className="w-full px-3 py-2.5 rounded-lg bg-dark-surface border border-dark-border text-white"

              />

            </div>



            {selected?.account_type_required && (

              <div>

                <label className="text-sm text-gray-300 block mb-1">Account type</label>

                <select

                  value={accountType}

                  onChange={(e) => setAccountType(e.target.value as 'MEMBER' | 'GROUP')}

                  className="w-full px-3 py-2.5 rounded-lg bg-dark-surface border border-dark-border text-white"

                >

                  <option value="MEMBER">Member</option>

                  <option value="GROUP">Group</option>

                </select>

              </div>

            )}



            <div>

              <label className="text-sm text-gray-300 block mb-1">Amount (MWK)</label>

              <input

                value={amountMwk}

                onChange={(e) => setAmountMwk(e.target.value)}

                placeholder="e.g. 10000"

                className="w-full px-3 py-2.5 rounded-lg bg-dark-surface border border-dark-border text-white"

              />

            </div>



            <div>

              <label className="text-sm text-gray-300 block mb-1">Your name (optional)</label>

              <input

                value={customerName}

                onChange={(e) => setCustomerName(e.target.value)}

                className="w-full px-3 py-2.5 rounded-lg bg-dark-surface border border-dark-border text-white"

              />

            </div>



            {validated && (
              <div className="p-4 rounded-xl border-2 border-green-500/40 bg-green-500/10 space-y-3">
                <p className="text-green-300 text-xs font-bold uppercase tracking-wide">
                  Confirm this is your meter
                </p>
                <div className="flex justify-between gap-3 text-sm">
                  <span className="text-gray-400 shrink-0">Biller</span>
                  <span className="text-white text-right">{selected?.name || billerId}</span>
                </div>
                <div className="flex justify-between gap-3 text-sm">
                  <span className="text-gray-400 shrink-0">{selected?.input?.label || 'Meter'}</span>
                  <span className="text-white font-mono text-right">{account.trim()}</span>
                </div>
                {validatedCustomerName ? (
                  <div className="pt-2 border-t border-green-500/20">
                    <p className="text-xs text-gray-400 mb-1">Account holder name</p>
                    <p className="text-amber-200 text-lg font-bold leading-snug">{validatedCustomerName}</p>
                    <p className="text-xs text-green-300/80 mt-2">
                      If this name is wrong, check your meter number before paying.
                    </p>
                  </div>
                ) : (
                  <p className="text-amber-300 text-xs">
                    PayChangu did not return a name for this meter. Double-check your number before paying.
                  </p>
                )}
              </div>
            )}

            {resolvedAmountMwk > 0 && (
              <div className="p-4 rounded-xl border border-dark-border bg-dark-surface/60 text-sm space-y-2">
                <div className="flex justify-between gap-3 text-gray-300">
                  <span>Bill amount</span>
                  <span className="text-white">MWK {resolvedAmountMwk.toLocaleString()}</span>
                </div>
                <div className="flex justify-between gap-3 text-gray-300">
                  <span>Service fee ({UTILITY_BILL_SERVICE_FEE_PERCENT}%)</span>
                  <span className="text-white">MWK {serviceFeeMwk.toLocaleString()}</span>
                </div>
                <div className="flex justify-between gap-3 pt-2 border-t border-dark-border font-semibold">
                  <span className="text-gray-200">You pay</span>
                  <span className="text-neon-blue">
                    MWK {totalChargeMwk.toLocaleString()} · ≈ ${priceUsd.toFixed(2)} USD
                  </span>
                </div>
              </div>
            )}



            {message && <p className="text-sm text-amber-200">{message}</p>}



            <div className="flex flex-col sm:flex-row gap-3">

              <button

                type="button"

                onClick={handleValidate}

                disabled={validating}

                className="flex-1 py-3 rounded-xl border border-neon-blue/50 text-neon-blue font-semibold hover:bg-neon-blue/10 disabled:opacity-50"

              >

                {validating ? 'Validating…' : 'Validate bill'}

              </button>

              <button

                type="button"

                onClick={handlePayNow}

                className="flex-1 py-3 rounded-xl bg-green-600 text-white font-semibold hover:bg-green-500 flex items-center justify-center gap-2"

              >

                <Smartphone className="w-4 h-4" />

                Pay with mobile money

              </button>

            </div>



            <p className="text-xs text-gray-500 text-center">

              Mobile money only · goes straight to checkout (not cart)

            </p>

          </div>

        )}

      </div>

    </div>

  );

};



export default UtilityBills;


