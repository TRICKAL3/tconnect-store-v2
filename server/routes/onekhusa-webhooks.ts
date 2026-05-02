import { Router } from 'express';
import { prisma } from '../lib/prisma';
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

    // Verify webhook via OneKhusa API
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

    // Handle Request To Pay success for wallet top-ups (Generate TAN flow)
    if (eventCodeHeader === 'payrequest.success') {
      const meta = payload.metaData || payload.metadata || {};
      const referenceNumber =
        meta.referenceNumber || payload.referenceNumber || null;
      const transactionAmount = payload.transactionAmount;

      if (!referenceNumber) {
        console.warn(
          '⚠️ [OneKhusa Webhook] payrequest.success without referenceNumber'
        );
      } else {
        const tx = await prisma.walletTransaction.findFirst({
          where: {
            externalRef: referenceNumber,
            type: 'topup',
            status: 'pending',
          },
          include: { wallet: true },
        });

        if (!tx) {
          console.warn(
            '⚠️ [OneKhusa Webhook] No pending wallet transaction for reference:',
            referenceNumber
          );
        } else {
          const amountMinor =
            typeof transactionAmount === 'number'
              ? Math.round(transactionAmount)
              : tx.amount;

          await prisma.$transaction(async (client) => {
            await client.wallet.update({
              where: { id: tx.walletId },
              data: {
                balance: {
                  increment: amountMinor,
                },
              },
            });

            await client.walletTransaction.update({
              where: { id: tx.id },
              data: {
                status: 'completed',
                metadata: JSON.stringify({
                  ...((tx.metadata && JSON.parse(tx.metadata)) || {}),
                  webhook: payload,
                }),
              },
            });
          });

          console.log(
            '✅ [OneKhusa Webhook] Wallet top-up completed for reference:',
            referenceNumber
          );
        }
      }
    }

    // Handle direct payment to merchant account (no TAN – user sends money with reference WALLET-<email>)
    if (eventCodeHeader === 'payment.success') {
      const txnRef = payload.transactionReferenceNumber;
      const amount = payload.transactionAmount;
      const description = payload.transactionDescription || '';

      if (!txnRef || amount == null) {
        console.warn(
          '⚠️ [OneKhusa Webhook] payment.success missing transactionReferenceNumber or amount'
        );
      } else {
        // Idempotency: already processed?
        const existing = await prisma.walletTransaction.findFirst({
          where: { externalRef: txnRef, type: 'topup' },
        });
        if (existing) {
          console.log(
            '⏭️ [OneKhusa Webhook] payment.success already processed:',
            txnRef
          );
        } else {
          const match = description.match(/WALLET-([^\s]+)/i);
          const email = match ? match[1].trim() : null;
          if (!email) {
            console.warn(
              '⚠️ [OneKhusa Webhook] payment.success no WALLET-<email> in description:',
              description
            );
          } else {
            const user = await prisma.user.findUnique({ where: { email } });
            if (!user) {
              console.warn(
                '⚠️ [OneKhusa Webhook] payment.success unknown email:',
                email
              );
            } else {
              const amountMinor = Math.round(Number(amount));
              if (amountMinor <= 0) {
                console.warn(
                  '⚠️ [OneKhusa Webhook] payment.success invalid amount:',
                  amount
                );
              } else {
                let wallet = await prisma.wallet.findFirst({
                  where: { userId: user.id, currency: 'MWK' },
                });
                if (!wallet) {
                  wallet = await prisma.wallet.create({
                    data: {
                      userId: user.id,
                      currency: 'MWK',
                      balance: 0,
                    },
                  });
                }

                await prisma.$transaction(async (client) => {
                  await client.wallet.update({
                    where: { id: wallet!.id },
                    data: { balance: { increment: amountMinor } },
                  });
                  await client.walletTransaction.create({
                    data: {
                      walletId: wallet!.id,
                      type: 'topup',
                      amount: amountMinor,
                      status: 'completed',
                      externalRef: txnRef,
                      metadata: JSON.stringify({
                        source: 'direct_payment',
                        transactionDescription: description,
                        webhook: payload,
                      }),
                    },
                  });
                });

                console.log(
                  '✅ [OneKhusa Webhook] Direct wallet top-up for',
                  email,
                  'amount:',
                  amountMinor
                );
              }
            }
          }
        }
      }
    }

    res.status(200).send('acknowledged');
  } catch (error: any) {
    console.error('❌ [OneKhusa Webhook] Error handling webhook:', error);
    res
      .status(500)
      .json({ error: error.message || 'Failed to handle webhook' });
  }
});

export default router;

