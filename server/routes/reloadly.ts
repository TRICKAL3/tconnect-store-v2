import { Router } from 'express';
import { basicAdminAuth } from '../lib/adminAuth';
import {
  getGiftCardRedeemCode,
  isReloadlyConfigured,
  isReloadlySandbox,
  listAirtimeOperators,
  listGiftCardCountries,
  listGiftCardProducts,
  orderGiftCard,
  reloadlyStatus,
  sendAirtimeTopup,
} from '../lib/reloadly';

const router = Router();

/** Public: whether Reloadly is wired (no secrets) */
router.get('/config', (_req, res) => {
  res.json({
    configured: isReloadlyConfigured(),
    sandbox: isReloadlySandbox(),
  });
});

router.use(basicAdminAuth);

/** Connection test + wallet balances */
router.get('/status', async (_req, res) => {
  try {
    const status = await reloadlyStatus();
    res.json(status);
  } catch (e: unknown) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Status check failed' });
  }
});

router.get('/gift-cards/countries', async (_req, res) => {
  try {
    const countries = await listGiftCardCountries();
    res.json({ countries });
  } catch (e: unknown) {
    res.status(502).json({ error: e instanceof Error ? e.message : 'Failed to load countries' });
  }
});

router.get('/gift-cards/products', async (req, res) => {
  try {
    const country = String(req.query.country || 'US').trim().toUpperCase();
    const page = Math.max(1, Number(req.query.page) || 1);
    const size = Math.min(100, Math.max(1, Number(req.query.size) || 30));
    const data = await listGiftCardProducts(country, size, page);
    res.json({ country, products: data.content ?? data });
  } catch (e: unknown) {
    res.status(502).json({ error: e instanceof Error ? e.message : 'Failed to load products' });
  }
});

router.post('/gift-cards/order', async (req, res) => {
  try {
    const body = req.body ?? {};
    const productId = Number(body.productId);
    const unitPrice = Number(body.unitPrice);
    const quantity = Math.max(1, Number(body.quantity) || 1);
    const countryCode = String(body.countryCode || 'US').trim().toUpperCase();
    const recipientEmail = String(body.recipientEmail || '').trim();
    const senderName = String(body.senderName || 'TConnect Store').trim();
    const customIdentifier = String(body.customIdentifier || `tconnect-test-${Date.now()}`).trim();

    if (!Number.isFinite(productId) || productId <= 0) {
      return res.status(400).json({ error: 'productId is required' });
    }
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
      return res.status(400).json({ error: 'unitPrice is required' });
    }
    if (!recipientEmail) {
      return res.status(400).json({ error: 'recipientEmail is required' });
    }

    const order = await orderGiftCard({
      productId,
      countryCode,
      quantity,
      unitPrice,
      customIdentifier,
      senderName,
      recipientEmail,
      recipientPhone: body.recipientPhone,
    });

    let redeemCode: unknown = null;
    const txId = Number((order as { transactionId?: number }).transactionId);
    if (Number.isFinite(txId) && txId > 0) {
      try {
        redeemCode = await getGiftCardRedeemCode(txId);
      } catch {
        redeemCode = null;
      }
    }

    res.json({ order, redeemCode });
  } catch (e: unknown) {
    res.status(502).json({ error: e instanceof Error ? e.message : 'Order failed' });
  }
});

router.get('/airtime/operators', async (req, res) => {
  try {
    const country = String(req.query.country || 'MW').trim().toUpperCase();
    const operators = await listAirtimeOperators(country);
    res.json({ country, operators });
  } catch (e: unknown) {
    res.status(502).json({ error: e instanceof Error ? e.message : 'Failed to load operators' });
  }
});

router.post('/airtime/topup', async (req, res) => {
  try {
    const body = req.body ?? {};
    const operatorId = body.operatorId;
    const amount = body.amount;
    const countryCode = String(body.countryCode || 'MW').trim().toUpperCase();
    const phoneNumber = String(body.phoneNumber || '').trim();
    const customIdentifier = String(body.customIdentifier || `tconnect-airtime-${Date.now()}`).trim();

    if (operatorId == null || operatorId === '') {
      return res.status(400).json({ error: 'operatorId is required' });
    }
    if (!phoneNumber) {
      return res.status(400).json({ error: 'phoneNumber is required' });
    }
    if (amount == null || amount === '') {
      return res.status(400).json({ error: 'amount is required' });
    }

    const result = await sendAirtimeTopup({
      operatorId,
      amount,
      useLocalAmount: body.useLocalAmount !== false,
      customIdentifier,
      recipientPhone: { countryCode, number: phoneNumber },
      recipientEmail: body.recipientEmail ? String(body.recipientEmail).trim() : undefined,
    });

    res.json({ result });
  } catch (e: unknown) {
    res.status(502).json({ error: e instanceof Error ? e.message : 'Top-up failed' });
  }
});

export default router;
