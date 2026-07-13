import { prisma } from './prisma';
import { paychanguVerifyPayment } from './paychangu';
import { sendAdminOrderAlertEmail } from './email';
import { createUserNotification } from './userNotifications';

async function clearSavedCartSnapshotForUser(userId: string | null | undefined) {
  if (!userId) return;
  try {
    await prisma.userCartSnapshot.deleteMany({ where: { userId } });
  } catch {
    /* ignore */
  }
}

async function notifyAdminMobileMoneyOrderPaid(order: {
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
        title: 'New order (mobile money paid)',
        message: `Order #${order.id.substring(0, 8)} paid via mobile money — $${order.totalUsd.toFixed(2)} (${order.items.length} item${order.items.length > 1 ? 's' : ''})`,
        link: `/admin?tab=orders&orderId=${order.id}`,
      },
    });
    await sendAdminOrderAlertEmail({
      orderId: order.id,
      totalUsd: order.totalUsd,
      totalMwk: order.totalMwk,
      itemsCount: order.items.length,
      paymentMethod: 'paychangu',
    });
  } catch {
    /* ignore */
  }
}

async function notifyUserMobileMoneyOrderPaid(userId: string, orderId: string, totalUsd: number) {
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

function amountMatchesOrder(
  paidAmount: number,
  paidCurrency: string,
  order: { totalUsd: number; totalMwk: number }
): boolean {
  const cur = paidCurrency.toUpperCase();
  if (cur === 'MWK') {
    return Number.isFinite(paidAmount) && paidAmount >= Math.round(order.totalMwk) - 1;
  }
  if (cur === 'USD') {
    const expectedUsd = Number(Number(order.totalUsd).toFixed(2));
    return Number.isFinite(paidAmount) && paidAmount + 0.001 >= expectedUsd;
  }
  return false;
}

export async function fulfillPaychanguOrderPayment(
  txRef: string
): Promise<{ ok: boolean; reason?: string; orderId?: string; alreadyFulfilled?: boolean }> {
  const payment = await prisma.paymentSubmission.findFirst({
    where: {
      method: 'paychangu',
      OR: [{ transactionId: txRef }, { transactionId: { startsWith: `${txRef}|` } }],
    },
    include: { order: { include: { items: true } } },
  });
  if (!payment?.order) return { ok: false, reason: 'order_not_found' };

  const order = payment.order;
  if (order.status !== 'awaiting_pawapay' && order.status !== 'pending') {
    if (payment.popUrl?.includes('"paychanguVerified":true')) {
      return { ok: true, orderId: order.id, alreadyFulfilled: true };
    }
    return { ok: false, reason: 'order_not_awaiting_payment' };
  }

  if (payment.popUrl?.includes('"paychanguVerified":true') && order.status === 'pending') {
    return { ok: true, orderId: order.id, alreadyFulfilled: true };
  }

  const verified = await paychanguVerifyPayment(txRef);
  if (!verified.ok || !verified.data) {
    return { ok: false, reason: verified.message || 'payment_not_verified' };
  }

  const d = verified.data;
  const paidAmount = Number(d.amount);
  const paidCurrency = String(d.currency || '').toUpperCase();
  if (!amountMatchesOrder(paidAmount, paidCurrency, order)) {
    return { ok: false, reason: 'amount_mismatch' };
  }

  const reference = d.reference != null ? String(d.reference) : '';
  const popPayload = JSON.stringify({
    paychanguVerified: true,
    reference,
    verifiedAt: new Date().toISOString(),
  });

  await prisma.$transaction(async (tx) => {
    await tx.paymentSubmission.update({
      where: { orderId: payment.orderId },
      data: {
        popUrl: popPayload,
        transactionId: reference ? `${txRef}|${reference}` : txRef,
      },
    });
    if (order.status === 'awaiting_pawapay') {
      await tx.order.update({
        where: { id: order.id },
        data: { status: 'pending' },
      });
    }
  });

  await clearSavedCartSnapshotForUser(order.userId);
  if (order.status === 'awaiting_pawapay') {
    await notifyAdminMobileMoneyOrderPaid(order);
    if (order.userId) {
      await notifyUserMobileMoneyOrderPaid(order.userId, order.id, order.totalUsd);
    }
  }

  return { ok: true, orderId: order.id };
}

export async function fulfillPaychanguOrderByOrderId(
  orderId: string
): Promise<{ ok: boolean; reason?: string; orderId?: string; alreadyFulfilled?: boolean }> {
  const payment = await prisma.paymentSubmission.findFirst({
    where: { orderId, method: 'paychangu' },
  });
  if (!payment?.transactionId) return { ok: false, reason: 'payment_not_found' };
  const txRef = payment.transactionId.split('|')[0];
  return fulfillPaychanguOrderPayment(txRef);
}
