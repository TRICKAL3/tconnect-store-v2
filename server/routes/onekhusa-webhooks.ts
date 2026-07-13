import { Router } from 'express';
import { verifyWebhookSignature } from '../lib/onekhusa';

const router = Router();

// Collections webhook handler (Request To Pay, etc.)
router.post('/collections', async (req: any, res) => {
  try {
    const eventCodeHeader =
      (req.headers['x-onekhusa-webhook-event'] as string) || '';
    const signatureHeader =
      (req.headers['x-onekhusa-webhook-signature'] as string) || '';

    if (!eventCodeHeader || !signatureHeader) {
      console.warn('⚠️ [OneKhusa Webhook] Missing headers');
      return res.status(400).json({ error: 'Missing webhook headers' });
    }

    const isValid = await verifyWebhookSignature(
      eventCodeHeader,
      signatureHeader
    );
    if (!isValid) {
      console.warn(
        '⚠️ [OneKhusa Webhook] Invalid signature for event:',
        eventCodeHeader
      );
      return res.status(400).json({ error: 'Invalid webhook signature' });
    }

    const payload = req.body || {};
    console.log('📩 [OneKhusa Webhook] Event:', eventCodeHeader, payload);

    res.status(200).send('acknowledged');
  } catch (error: any) {
    console.error('❌ [OneKhusa Webhook] Error handling webhook:', error);
    res
      .status(500)
      .json({ error: error.message || 'Failed to handle webhook' });
  }
});

export default router;
