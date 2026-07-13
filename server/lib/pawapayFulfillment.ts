import { prisma } from './prisma';
import {
  isPawapayDepositCompleted,
  pawapayCheckDepositStatus,
} from './pawapay';
import { roundUsd } from './wallet';
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
  } catch {
    /* ignore */
  }
}

async function notifyUserWalletTopUp(userId: string, amountUsd: number) {
  try {
    await createUserNotification({
      userId,
      type: 'wallet_topup',
      title: 'Wallet topped up',
      message: `$${amountUsd.toFixed(2)} was added to your Wallet.`,
      link: '/wallet',
    });
  } catch {
    /* ignore */
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

export async function cancelUnpaidPawapayOrder(depositId: string): Promise<void> {
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
}

export async function cancelFailedWalletTopUp(depositId: string): Promise<void> {
  const topUp = await prisma.walletTopUp.findUnique({ where: { depositId } });
  if (!topUp || topUp.status !== 'pending') return;
  await prisma.walletTopUp.update({
    where: { id: topUp.id },
    data: { status: 'failed' },
  });
}

async function fulfillWalletTopUp(depositId: string): Promise<{
  ok: boolean;
  reason?: string;
  userMessage?: string;
  walletCreditedUsd?: number;
}> {
  const topUp = await prisma.walletTopUp.findUnique({ where: { depositId } });
  if (!topUp) return { ok: false, reason: 'not_found' };

  if (topUp.status === 'completed') {
    return { ok: true, walletCreditedUsd: topUp.amountUsd };
  }

  const canRetryFulfill = topUp.status === 'pending' || topUp.status === 'cancelled';
  if (!canRetryFulfill) {
    return { ok: false, reason: `topup_${topUp.status}` };
  }

  const check = await pawapayCheckDepositStatus(depositId);
  if (!check.ok || !check.found || !check.deposit) {
    return { ok: false, reason: check.message || 'status_check_failed' };
  }

  if (!isPawapayDepositCompleted(check.deposit.status)) {
    if (check.deposit.status === 'FAILED') {
      await cancelFailedWalletTopUp(depositId);
    }
    return { ok: false, reason: `deposit_${check.deposit.status.toLowerCase()}` };
  }

  const paidMwk = Number(check.deposit.amount);
  if (!Number.isFinite(paidMwk) || paidMwk < topUp.amountMwk - 1) {
    return { ok: false, reason: 'amount_mismatch' };
  }

  const ref = check.deposit.providerTransactionId || null;

  await prisma.$transaction(async (tx) => {
    const current = await tx.walletTopUp.findUnique({ where: { depositId } });
    if (!current || (current.status !== 'pending' && current.status !== 'cancelled')) return;

    await tx.user.update({
      where: { id: current.userId },
      data: { walletBalanceUsd: { increment: current.amountUsd } },
    });

    await tx.walletTopUp.update({
      where: { id: current.id },
      data: {
        status: 'completed',
        completedAt: new Date(),
        pawapayRef: ref,
      },
    });

    await tx.walletTransaction.create({
      data: {
        userId: current.userId,
        type: 'topup',
        amountUsd: current.amountUsd,
        topUpId: current.id,
        description: `Wallet top-up via PawaPay ($${current.amountUsd.toFixed(2)})`,
      },
    });
  });

  await notifyUserWalletTopUp(topUp.userId, topUp.amountUsd);

  return { ok: true, walletCreditedUsd: topUp.amountUsd };
}

async function fulfillOrderPawapayDeposit(depositId: string): Promise<{
  ok: boolean;
  reason?: string;
  orderId?: string;
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

export type FulfillPawapayResult = {
  ok: boolean;
  kind?: 'wallet' | 'order';
  reason?: string;
  userMessage?: string;
  orderId?: string;
  walletCreditedUsd?: number;
};

/** Resolve wallet top-up or checkout order payment for a PawaPay depositId. */
export async function fulfillPawapayDeposit(depositId: string): Promise<FulfillPawapayResult> {
  const topUp = await prisma.walletTopUp.findUnique({ where: { depositId } });
  if (topUp) {
    const walletResult = await fulfillWalletTopUp(depositId);
    if (!walletResult.ok) {
      let userMessage = 'Payment could not be verified.';
      if (walletResult.reason === 'deposit_failed') {
        userMessage = 'Payment was not completed.';
      } else if (walletResult.reason?.startsWith('deposit_')) {
        userMessage = 'Payment is still processing. Please wait a moment and refresh.';
      }
      return { ok: false, kind: 'wallet', reason: walletResult.reason, userMessage };
    }
    return {
      ok: true,
      kind: 'wallet',
      walletCreditedUsd: roundUsd(walletResult.walletCreditedUsd ?? topUp.amountUsd),
    };
  }

  const orderResult = await fulfillOrderPawapayDeposit(depositId);
  if (!orderResult.ok) {
    return { ok: false, kind: 'order', reason: orderResult.reason };
  }
  return { ok: true, kind: 'order', orderId: orderResult.orderId };
}

export async function handlePawapayCallbackFailure(depositId: string): Promise<void> {
  const topUp = await prisma.walletTopUp.findUnique({ where: { depositId } });
  if (topUp) {
    await cancelFailedWalletTopUp(depositId);
    return;
  }
  await cancelUnpaidPawapayOrder(depositId);
}
