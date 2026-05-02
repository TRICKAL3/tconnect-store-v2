import { Router } from 'express';

const router = Router();

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

export default router;

