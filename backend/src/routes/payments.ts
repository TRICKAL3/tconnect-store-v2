import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { prisma } from '../lib/prisma';
import {
  getPaychanguSecret,
  getPaychanguCallbackApiBase,
  getFrontendBaseUrl as getPaychanguFrontendBaseUrl,
  isPlaceholderGuestEmail,
  paychanguVerifyPayment,
  parsePaychanguInitiateResponse,
  userMessageForPaychanguInitiateFailure,
} from '../lib/paychangu';
import {
  getPawapayApiToken,
  getPawapayCallbackApiBase,
  getFrontendBaseUrl,
  getPawapayReturnUrl,
  getPawapayCountry,
  isPawapayConfigured,
  pawapayInitiatePaymentPage,
  pawapayCheckDepositStatus,
  parsePawapayCallbackBody,
  isPawapayDepositCompleted,
} from '../lib/pawapay';
import { basicAdminAuth } from '../lib/adminAuth';
import {
  PAYCHANGU_CHECKOUT_ENABLED,
  PAWAPAY_CHECKOUT_ENABLED,
  MOBILE_MONEY_MAX_CHECKOUT_USD,
  CHECKOUT_UNAVAILABLE_MOBILE_MONEY,
} from '../lib/checkoutFlags';
import {
  fulfillPaychanguOrderPayment,
  fulfillPaychanguOrderByOrderId,
} from '../lib/paychanguFulfillment';
import { sendAdminOrderAlertEmail } from '../lib/email';
import { createUserNotification } from '../lib/userNotifications';

const router = Router();

const PAYCHANGU_API = 'https://api.paychangu.com';

async function clearSavedCartSnapshotForUser(userId: string | null | undefined) {
  if (!userId) return;
  try {
    await prisma.userCartSnapshot.deleteMany({ where: { userId } });
  } catch (e: unknown) {
    console.warn('[payments] cart snapshot not cleared:', e instanceof Error ? e.message : e);
  }
}

async function notifyAdminPawapayOrderPaid(order: {
  id: string;
  totalUsd: number;
  totalMwk: number;
  items: { length: number };
}) {
  try {
    await prisma.notification.create({
      data: {
        userId: null,
        type: 'order_created',
        title: 'New order (PawaPay paid)',
        message: `Order #${order.id.substring(0, 8)} paid via PawaPay — $${order.totalUsd.toFixed(2)} (${order.items.length} item${order.items.length > 1 ? 's' : ''})`,
        link: `/admin?tab=orders&orderId=${order.id}`,
      },
    });
    await sendAdminOrderAlertEmail({
      orderId: order.id,
      totalUsd: order.totalUsd,
      totalMwk: order.totalMwk,
      itemsCount: order.items.length,
      paymentMethod: 'pawapay',
    });
  } catch (e: unknown) {
    console.warn('[pawapay] admin notification failed:', e instanceof Error ? e.message : e);
  }
}

async function notifyUserPawapayOrderPaid(userId: string, orderId: string, totalUsd: number) {
  try {
    await createUserNotification({
      userId,
      type: 'order_received',
      title: 'Payment received',
      message: `Your mobile money payment for order #${orderId.substring(0, 8)} ($${totalUsd.toFixed(2)}) was confirmed. We will review your order shortly.`,
      link: '/orders',
    });
  } catch {
    /* ignore */
  }
}

async function cancelUnpaidPawapayOrder(depositId: string): Promise<void> {
  const payment = await prisma.paymentSubmission.findFirst({
    where: {
      method: 'pawapay',
      OR: [{ transactionId: depositId }, { transactionId: { startsWith: `${depositId}|` } }],
    },
    include: { order: true },
  });
  if (!payment?.order || payment.order.status !== 'awaiting_pawapay') return;
  await prisma.order.update({
    where: { id: payment.orderId },
    data: { status: 'cancelled' },
  });
  console.info('[pawapay] cancelled unpaid order', payment.orderId);
}

const getPaypalBaseUrl = () =>
  String(process.env.PAYPAL_MODE || '').trim().toLowerCase() === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';

const getPaypalAccessToken = async (): Promise<string> => {
  const clientId = String(process.env.PAYPAL_CLIENT_ID || '').trim();
  const clientSecret = String(process.env.PAYPAL_CLIENT_SECRET || '').trim();
  if (!clientId || !clientSecret) {
    throw new Error('PayPal credentials are not configured');
  }

  const tokenRes = await fetch(`${getPaypalBaseUrl()}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  const tokenData: any = await tokenRes.json();
  if (!tokenRes.ok || !tokenData?.access_token) {
    throw new Error(tokenData?.error_description || tokenData?.error || 'Failed to get PayPal access token');
  }

  return tokenData.access_token as string;
};

router.post('/paypal/create-order', async (req, res) => {
  try {
    const amount = Number(req.body?.amount);
    const currency = String(req.body?.currency || 'USD').toUpperCase();
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    const token = await getPaypalAccessToken();
    const createRes = await fetch(`${getPaypalBaseUrl()}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            amount: {
              currency_code: currency,
              value: amount.toFixed(2),
            },
          },
        ],
      }),
    });

    const createData: any = await createRes.json();
    if (!createRes.ok || !createData?.id) {
      return res.status(400).json({
        error: createData?.message || createData?.details?.[0]?.description || 'Failed to create PayPal order',
      });
    }

    return res.json({ id: createData.id });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || 'Failed to create PayPal order' });
  }
});

router.post('/paypal/capture-order', async (req, res) => {
  try {
    const orderId = String(req.body?.orderId || '').trim();
    if (!orderId) return res.status(400).json({ error: 'Missing PayPal orderId' });

    const token = await getPaypalAccessToken();
    const captureRes = await fetch(`${getPaypalBaseUrl()}/v2/checkout/orders/${orderId}/capture`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    const captureData: any = await captureRes.json();
    if (!captureRes.ok) {
      return res.status(400).json({
        error: captureData?.message || captureData?.details?.[0]?.description || 'Failed to capture PayPal order',
      });
    }

    return res.json(captureData);
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || 'Failed to capture PayPal order' });
  }
});

function normEmail(s: string) {
  return s.trim().toLowerCase();
}

/** Whether PayChangu mobile money checkout is configured. */
router.get('/paychangu/status', (_req, res) => {
  const secret = getPaychanguSecret();
  const apiBase = getPaychanguCallbackApiBase();
  res.json({
    enabled: PAYCHANGU_CHECKOUT_ENABLED && Boolean(secret) && Boolean(apiBase),
  });
});

/** Confirm PayChangu payment after customer returns from hosted checkout. */
router.get('/paychangu/verify', async (req, res) => {
  try {
    if (!PAYCHANGU_CHECKOUT_ENABLED) {
      return res.status(503).json({ ok: false, error: CHECKOUT_UNAVAILABLE_MOBILE_MONEY });
    }
    const orderId = String(req.query.orderId || '').trim();
    const txRef = String(req.query.txRef || req.query.tx_ref || '').trim();
    if (!orderId && !txRef) {
      return res.status(400).json({ ok: false, error: 'orderId or txRef required' });
    }
    const result = orderId
      ? await fulfillPaychanguOrderByOrderId(orderId)
      : await fulfillPaychanguOrderPayment(txRef);
    if (!result.ok) {
      return res.status(400).json({ ok: false, reason: result.reason, error: 'Payment could not be verified.' });
    }
    return res.json({ ok: true, orderId: result.orderId, alreadyFulfilled: result.alreadyFulfilled });
  } catch (e: unknown) {
    console.error('[paychangu] verify', e);
    return res.status(500).json({ ok: false, error: 'Verification failed' });
  }
});

/** Start hosted checkout for an existing order (no payment row yet). */
router.post('/paychangu/initiate', async (req, res) => {
  try {
    if (!PAYCHANGU_CHECKOUT_ENABLED) {
      return res.status(503).json({ error: CHECKOUT_UNAVAILABLE_MOBILE_MONEY });
    }
    const secret = getPaychanguSecret();
    if (!secret) {
      return res.status(503).json({ error: 'Online checkout is temporarily unavailable. Please try again later.' });
    }

    const apiBase = getPaychanguCallbackApiBase();
    if (!apiBase) {
      return res.status(503).json({
        error: 'Online checkout is not available from this environment yet.',
      });
    }

    const orderId = String(req.body?.orderId || '').trim();
    const customerEmail = String(req.body?.customerEmail || '').trim();
    const firstName = String(req.body?.firstName || '').trim() || 'Customer';
    const lastName = String(req.body?.lastName || '').trim();
    const currency = String(req.body?.currency || 'MWK').toUpperCase();
    if (!['MWK', 'USD'].includes(currency)) {
      return res.status(400).json({ error: 'currency must be MWK or USD' });
    }
    if (!orderId) return res.status(400).json({ error: 'orderId required' });
    if (!customerEmail) return res.status(400).json({ error: 'customerEmail required' });

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { payment: true, user: { select: { email: true } }, items: { select: { type: true } } },
    });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.items.some((item) => String(item.type || '').trim().toLowerCase() === 'virtual-card')) {
      await prisma.order.update({ where: { id: order.id }, data: { status: 'cancelled' } });
      return res.status(400).json({
        error: 'Virtual cards cannot be checked out with mobile money. Please use another payment method.',
      });
    }
    if (Number(order.totalUsd) > MOBILE_MONEY_MAX_CHECKOUT_USD) {
      await prisma.order.update({ where: { id: order.id }, data: { status: 'cancelled' } });
      return res.status(400).json({
        error: `Mobile money checkout is currently limited to $${MOBILE_MONEY_MAX_CHECKOUT_USD.toFixed(2)} max per order.`,
      });
    }
    if (order.payment) {
      return res.status(400).json({ error: 'Order already has a payment record' });
    }

    const ownerEmail = order.user?.email ? normEmail(order.user.email) : '';
    if (!isPlaceholderGuestEmail(order.user?.email) && ownerEmail && ownerEmail !== normEmail(customerEmail)) {
      return res.status(403).json({ error: 'Email does not match this order' });
    }

    const txRef = randomUUID();
    const amountStr =
      currency === 'USD'
        ? String(Number(Number(order.totalUsd).toFixed(2)))
        : String(Math.max(1, Math.round(Number(order.totalMwk))));

    const callbackUrl = `${apiBase}/payments/paychangu/callback`;
    const returnUrl = `${getPaychanguFrontendBaseUrl()}/checkout?paychangu=return&orderId=${encodeURIComponent(order.id)}`;
    const payload = {
      amount: amountStr,
      currency,
      tx_ref: txRef,
      first_name: firstName,
      last_name: lastName || undefined,
      email: customerEmail,
      callback_url: callbackUrl,
      return_url: returnUrl,
      meta: { orderId: order.id },
      customization: {
        title: 'TConnect Store',
        description: `Order ${order.id.slice(0, 8)}…`,
      },
    };

    const pcRes = await fetch(`${PAYCHANGU_API}/payment`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify(payload),
    });

    let pcJson: Record<string, unknown> = {};
    try {
      pcJson = (await pcRes.json()) as Record<string, unknown>;
    } catch {
      return res.status(502).json({ error: 'Could not reach payment service. Please try again.' });
    }

    if (!pcRes.ok || String(pcJson.status || '').toLowerCase() !== 'success') {
      console.error('[paychangu] initiate failed', pcRes.status, pcJson);
      return res.status(400).json({
        error: userMessageForPaychanguInitiateFailure(pcRes, pcJson),
        details: pcJson,
      });
    }

    const { checkoutUrl, txRef: returnedRef } = parsePaychanguInitiateResponse(pcJson);
    if (!checkoutUrl) {
      return res.status(502).json({ error: 'Could not open secure checkout. Please try again.' });
    }

    const finalTxRef = returnedRef || txRef;

    await prisma.paymentSubmission.create({
      data: {
        orderId: order.id,
        method: 'paychangu',
        bankName: 'TConnect Checkout',
        accountName: customerEmail,
        accountNumber: null,
        transactionId: finalTxRef,
        popUrl: null,
        senderName: [firstName, lastName].filter(Boolean).join(' ') || customerEmail,
      },
    });

    return res.json({ checkoutUrl, txRef: finalTxRef });
  } catch (e: unknown) {
    console.error('[payments] hosted checkout initiate', e);
    return res.status(500).json({ error: 'Checkout could not be started. Please try again.' });
  }
});

async function handlePaychanguCallback(req: Request, res: Response) {
  const frontend = getPaychanguFrontendBaseUrl();
  const fail = (reason: string) =>
    res.redirect(302, `${frontend}/checkout?paychangu=failed&reason=${encodeURIComponent(reason)}`);

  const txRef = String(
    (req.query as Record<string, unknown>).tx_ref ||
      (req.query as Record<string, unknown>).txRef ||
      (req.body as Record<string, unknown>)?.tx_ref ||
      ''
  ).trim();
  if (!txRef) return fail('missing_tx_ref');

  const result = await fulfillPaychanguOrderPayment(txRef);
  if (!result.ok || !result.orderId) {
    return fail(result.reason || 'payment_not_verified');
  }

  return res.redirect(
    302,
    `${frontend}/checkout?paychangu=success&orderId=${encodeURIComponent(result.orderId)}`
  );
}

router.get('/paychangu/callback', (req, res) => {
  void handlePaychanguCallback(req, res).catch((err) => {
    console.error('[paychangu] callback', err);
    const frontend = getPaychanguFrontendBaseUrl();
    res.redirect(302, `${frontend}/checkout?paychangu=failed&reason=callback_error`);
  });
});

router.post('/paychangu/callback', (req, res) => {
  void handlePaychanguCallback(req, res).catch((err) => {
    console.error('[paychangu] callback', err);
    const frontend = getPaychanguFrontendBaseUrl();
    res.redirect(302, `${frontend}/checkout?paychangu=failed&reason=callback_error`);
  });
});

/** Whether PawaPay mobile-money checkout is configured on this deployment. */
router.get('/pawapay/status', (_req, res) => {
  res.json({
    enabled: isPawapayConfigured(),
    mode: String(process.env.PAWAPAY_MODE || 'live').trim().toLowerCase(),
    country: getPawapayCountry(),
  });
});

async function fulfillPawapayDeposit(depositId: string): Promise<{
  ok: boolean;
  orderId?: string;
  reason?: string;
}> {
  const payment = await prisma.paymentSubmission.findFirst({
    where: {
      method: 'pawapay',
      OR: [{ transactionId: depositId }, { transactionId: { startsWith: `${depositId}|` } }],
    },
    include: { order: true },
  });
  if (!payment?.order) return { ok: false, reason: 'order_not_found' };

  if (payment.popUrl && payment.popUrl.includes('"pawapayVerified":true')) {
    if (payment.order.status === 'awaiting_pawapay') {
      const order = await prisma.order.update({
        where: { id: payment.orderId },
        data: { status: 'pending' },
        include: { items: true },
      });
      await clearSavedCartSnapshotForUser(order.userId);
      await notifyAdminPawapayOrderPaid(order);
      if (order.userId) {
        await notifyUserPawapayOrderPaid(order.userId, order.id, order.totalUsd);
      }
    }
    return { ok: true, orderId: payment.orderId };
  }

  const check = await pawapayCheckDepositStatus(depositId);
  if (!check.ok || !check.found || !check.deposit) {
    return { ok: false, reason: check.message || 'status_check_failed' };
  }

  if (!isPawapayDepositCompleted(check.deposit.status)) {
    if (check.deposit.status === 'FAILED') {
      await cancelUnpaidPawapayOrder(depositId);
    }
    return { ok: false, reason: `deposit_${check.deposit.status.toLowerCase()}` };
  }

  const paidAmount = Number(check.deposit.amount);
  const expected = Math.round(payment.order.totalMwk);
  if (!Number.isFinite(paidAmount) || paidAmount < expected - 1) {
    return { ok: false, reason: 'amount_mismatch' };
  }

  const popPayload = JSON.stringify({
    pawapayVerified: true,
    depositId,
    providerTransactionId: check.deposit.providerTransactionId || null,
    verifiedAt: new Date().toISOString(),
  });

  const refSuffix = check.deposit.providerTransactionId
    ? `|${check.deposit.providerTransactionId}`
    : '';

  await prisma.paymentSubmission.update({
    where: { orderId: payment.orderId },
    data: {
      popUrl: popPayload,
      transactionId: `${depositId}${refSuffix}`,
      bankName: 'PawaPay (mobile money)',
    },
  });

  if (payment.order.status === 'awaiting_pawapay') {
    const order = await prisma.order.update({
      where: { id: payment.orderId },
      data: { status: 'pending' },
      include: { items: true },
    });
    await clearSavedCartSnapshotForUser(order.userId);
    await notifyAdminPawapayOrderPaid(order);
    if (order.userId) {
      await notifyUserPawapayOrderPaid(order.userId, order.id, order.totalUsd);
    }
  }

  return { ok: true, orderId: payment.orderId };
}

/** Start PawaPay Payment Page for an existing order (no payment row yet). */
router.post('/pawapay/initiate', async (req, res) => {
  try {
    if (!PAWAPAY_CHECKOUT_ENABLED) {
      return res.status(503).json({ error: CHECKOUT_UNAVAILABLE_MOBILE_MONEY });
    }
    if (!isPawapayConfigured()) {
      return res.status(503).json({
        error: 'Mobile money checkout is temporarily unavailable. Please try again later.',
      });
    }

    const orderId = String(req.body?.orderId || '').trim();
    const customerEmail = String(req.body?.customerEmail || '').trim();
    const customerName = String(req.body?.customerName || '').trim() || 'Customer';
    if (!orderId) return res.status(400).json({ error: 'orderId required' });
    if (!customerEmail) return res.status(400).json({ error: 'customerEmail required' });

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { payment: true, user: { select: { email: true } } },
    });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.payment) {
      return res.status(400).json({ error: 'Order already has a payment record' });
    }

    const ownerEmail = order.user?.email ? normEmail(order.user.email) : '';
    if (!isPlaceholderGuestEmail(order.user?.email) && ownerEmail && ownerEmail !== normEmail(customerEmail)) {
      return res.status(403).json({ error: 'Email does not match this order' });
    }

    const depositId = randomUUID();
    const amountMwk = Math.max(1, Math.round(Number(order.totalMwk)));
    const returnCfg = getPawapayReturnUrl();
    if (!returnCfg.url) {
      return res.status(503).json({
        error: returnCfg.error || 'Mobile money return URL is not configured.',
      });
    }
    const returnUrl = returnCfg.url;
    const reason = `TConnect order ${order.id.slice(0, 8)}`;

    const started = await pawapayInitiatePaymentPage({
      depositId,
      returnUrl,
      amountMwk,
      reason,
      country: getPawapayCountry(),
      orderId: order.id,
    });

    if (!started.ok || !started.redirectUrl) {
      console.error('[pawapay] initiate failed', {
        message: started.message,
        mode: process.env.PAWAPAY_MODE,
        http: (started.raw as { status?: number })?.status,
      });
      await prisma.order.update({ where: { id: order.id }, data: { status: 'cancelled' } });
      return res.status(400).json({
        error: started.message || 'Could not start mobile money payment. Please try again.',
      });
    }

    await prisma.paymentSubmission.create({
      data: {
        orderId: order.id,
        method: 'pawapay',
        bankName: 'PawaPay (mobile money)',
        accountName: customerEmail,
        accountNumber: null,
        transactionId: depositId,
        popUrl: null,
        senderName: customerName,
      },
    });

    return res.json({
      redirectUrl: started.redirectUrl,
      depositId,
      status: started.status,
    });
  } catch (e: unknown) {
    console.error('[pawapay] initiate', e);
    return res.status(500).json({ error: 'Mobile money checkout could not be started.' });
  }
});

/** Admin: confirm a paid PawaPay order stuck in awaiting_pawapay (same as verify, requires admin auth). */
router.post('/pawapay/reconcile', basicAdminAuth, async (req, res) => {
  try {
    const orderId = String(req.body?.orderId || '').trim();
    const depositId = String(req.body?.depositId || '').trim();
    let targetDepositId = depositId;

    if (!targetDepositId && orderId) {
      const payment = await prisma.paymentSubmission.findFirst({
        where: { orderId, method: 'pawapay' },
      });
      if (!payment?.transactionId) {
        return res.status(404).json({ error: 'No PawaPay payment found for this order' });
      }
      targetDepositId = String(payment.transactionId).split('|')[0].trim();
    }

    if (!targetDepositId) {
      return res.status(400).json({ error: 'orderId or depositId required' });
    }

    const result = await fulfillPawapayDeposit(targetDepositId);
    if (!result.ok) {
      return res.status(400).json({
        error: 'Payment not confirmed yet',
        reason: result.reason || 'verification_failed',
      });
    }
    return res.json({ ok: true, orderId: result.orderId, message: 'payment_confirmed' });
  } catch (e: unknown) {
    console.error('[pawapay] reconcile', e);
    return res.status(500).json({ error: 'Reconcile failed' });
  }
});

/** After customer returns from Payment Page — verify deposit and confirm order. */
router.get('/pawapay/verify', async (req, res) => {
  try {
    const depositId = String(req.query.depositId || '').trim();
    if (!depositId) return res.status(400).json({ error: 'depositId required' });

    const result = await fulfillPawapayDeposit(depositId);
    if (!result.ok) {
      const reason = result.reason || 'verification_failed';
      let error = 'Payment could not be verified.';
      if (reason === 'deposit_failed') {
        error = 'Payment was not completed. No order was submitted to admin.';
      } else if (reason.startsWith('deposit_')) {
        error = 'Payment is still processing or was cancelled. Please try again if you did not pay.';
      }
      return res.status(400).json({ error, reason });
    }
    return res.json({ ok: true, orderId: result.orderId, message: 'payment_confirmed' });
  } catch (e: unknown) {
    console.error('[pawapay] verify', e);
    return res.status(500).json({ error: 'Verification failed' });
  }
});

/** Server-to-server deposit callback from PawaPay dashboard. */
router.post('/pawapay/callback', async (req, res) => {
  try {
    const parsed = parsePawapayCallbackBody(req.body);
    if (!parsed) {
      return res.status(400).json({ error: 'invalid_callback' });
    }

    console.info('[pawapay] deposit callback', parsed.depositId, parsed.status);

    if (parsed.status === 'COMPLETED') {
      await fulfillPawapayDeposit(parsed.depositId);
    } else if (parsed.status === 'FAILED') {
      await cancelUnpaidPawapayOrder(parsed.depositId);
    }

    return res.status(200).send('acknowledged');
  } catch (e: unknown) {
    console.error('[pawapay] callback error', e);
    return res.status(500).json({ error: 'callback_error' });
  }
});

/** Refund callbacks (required in PawaPay dashboard; logged for now). */
router.post('/pawapay/refund-callback', async (req, res) => {
  try {
    const body = req.body as Record<string, unknown>;
    console.info('[pawapay] refund callback', body?.refundId ?? body?.depositId ?? body);
    return res.status(200).send('acknowledged');
  } catch (e: unknown) {
    console.error('[pawapay] refund callback error', e);
    return res.status(500).json({ error: 'callback_error' });
  }
});

export default router;
