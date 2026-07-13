import { Router } from 'express';
import {
  paychanguGetBillers,
  paychanguValidateBill,
  parseBillValidationSummary,
} from '../lib/paychanguBills';
import { PAYCHANGU_CHECKOUT_ENABLED } from '../lib/checkoutFlags';

const router = Router();

router.get('/billers', async (_req, res) => {
  if (!PAYCHANGU_CHECKOUT_ENABLED) {
    return res.status(503).json({ error: 'Utility bills are not available at the moment.' });
  }
  const result = await paychanguGetBillers();
  if (!result.ok) {
    return res.status(502).json({ error: result.message || 'Could not load billers.' });
  }
  return res.json({ billers: result.billers || [] });
});

router.post('/validate', async (req, res) => {
  if (!PAYCHANGU_CHECKOUT_ENABLED) {
    return res.status(503).json({ error: 'Utility bills are not available at the moment.' });
  }
  const biller = String(req.body?.biller || '').trim();
  const account = String(req.body?.account || '').trim();
  const accountType = String(req.body?.accountType || req.body?.account_type || '').trim();
  const amount = req.body?.amount != null ? String(req.body.amount).trim() : '';
  if (!biller || !account) {
    return res.status(400).json({ error: 'biller and account are required' });
  }
  const result = await paychanguValidateBill({
    biller,
    account,
    accountType: accountType || undefined,
    amount: amount || undefined,
  });
  if (!result.ok) {
    return res.status(400).json({ error: result.message || 'Could not validate bill.', details: result.data });
  }
  const data = result.data || {};
  const summary = parseBillValidationSummary(data, result.message);
  return res.json({
    ok: true,
    data,
    account,
    biller,
    message: result.message,
    ...summary,
  });
});

export default router;
