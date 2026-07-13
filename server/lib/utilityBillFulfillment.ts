import { prisma } from './prisma';
import {
  paychanguPayBill,
  resolveUtilityBillTokenAfterPay,
  isMerchantBillReference,
  extractBillCustomerName,
} from './paychanguBills';
import { createUserNotification } from './userNotifications';
import { sendOrderFulfilledEmail } from './email';
import { grantUtilityBillSpinBonus } from './spinGrants';

type BillMeta = {
  biller?: string;
  account?: string;
  accountType?: string;
  customerName?: string;
  amountMwk?: number;
  validated?: Record<string, unknown>;
};

function parseMeta(raw: string | null | undefined): BillMeta {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as BillMeta;
  } catch {
    return {};
  }
}

export type UtilityBillTokenInfo = {
  token: string;
  biller?: string;
  account?: string;
  amountMwk?: number;
  customerName?: string;
};

function readExistingToken(raw: string | null | undefined): UtilityBillTokenInfo | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    const list = Array.isArray(parsed) ? parsed : [parsed];
    const entry = list[0] as Record<string, unknown> | undefined;
    const token = entry?.token ?? entry?.receipt;
    if (token != null && String(token).trim() && !isMerchantBillReference(String(token))) {
      return {
        token: String(token).trim(),
        biller: entry?.biller != null ? String(entry.biller) : undefined,
        account: entry?.account != null ? String(entry.account) : undefined,
        amountMwk: entry?.amountMwk != null ? Number(entry.amountMwk) : undefined,
        customerName: entry?.customerName != null ? String(entry.customerName) : undefined,
      };
    }
  } catch {
    /* ignore */
  }
  return null;
}

/** After customer payment, pay utility bills via PayChangu and store tokens on order items. */
export async function tryFulfillUtilityBillItems(orderId: string): Promise<{
  fulfilled: boolean;
  tokens: UtilityBillTokenInfo[];
}> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true, user: true },
  });
  if (!order) return { fulfilled: false, tokens: [] };

  const utilityItems = order.items.filter(
    (i) => String(i.type || '').trim().toLowerCase() === 'utility-bill'
  );
  if (!utilityItems.length) return { fulfilled: false, tokens: [] };

  let allPaid = true;
  const tokens: UtilityBillTokenInfo[] = [];

  for (const item of utilityItems) {
    const existing = readExistingToken(item.giftCardCodes);
    if (existing) {
      tokens.push(existing);
      continue;
    }

    const meta = parseMeta(item.metadata);
    if (!meta.biller || !meta.account) {
      allPaid = false;
      continue;
    }

    const reference = `TC-${order.id.slice(0, 8)}-${item.id.slice(0, 6)}`;
    const validatedName = extractBillCustomerName(meta.validated);
    const payerName = meta.customerName || validatedName || order.user?.name || undefined;

    let storedEntry: Record<string, unknown> | null = null;
    if (item.giftCardCodes) {
      try {
        const parsed = JSON.parse(item.giftCardCodes) as unknown;
        storedEntry = (Array.isArray(parsed) ? parsed[0] : parsed) as Record<string, unknown>;
      } catch {
        storedEntry = null;
      }
    }
    const alreadyPaid = Boolean(storedEntry?.reference || storedEntry?.raw || storedEntry?.paidAt);

    let payData: Record<string, unknown> | null = null;
    if (!alreadyPaid) {
      const result = await paychanguPayBill({
        biller: meta.biller,
        account: meta.account,
        amount: meta.amountMwk ? String(Math.round(meta.amountMwk)) : undefined,
        customerName: payerName,
        accountType: meta.accountType,
        reference,
      });

      if (!result.ok || !result.data) {
        console.error('[utility-bill] pay failed', orderId, item.id, result.message);
        try {
          await prisma.notification.create({
            data: {
              userId: null,
              type: 'order_created',
              title: 'Utility bill pay failed',
              message: `Order #${orderId.substring(0, 8)} — ${meta.biller} ${meta.account}: ${result.message || 'bill pay failed'}`,
              link: `/admin?tab=orders&orderId=${orderId}`,
            },
          });
        } catch {
          /* ignore */
        }
        allPaid = false;
        continue;
      }
      payData = result.data;
    } else {
      payData = (storedEntry?.raw as Record<string, unknown> | undefined) || {};
    }

    const token = await resolveUtilityBillTokenAfterPay(payData, reference);
    if (!token) {
      console.error('[utility-bill] no ESCOM token from PayChangu', orderId, item.id);
      allPaid = false;
      continue;
    }

    const tokenInfo: UtilityBillTokenInfo = {
      token,
      biller: meta.biller,
      account: meta.account,
      amountMwk: meta.amountMwk,
      customerName: payerName || validatedName || undefined,
    };
    tokens.push(tokenInfo);
    await prisma.orderItem.update({
      where: { id: item.id },
      data: {
        giftCardCodes: JSON.stringify([
          {
            ...tokenInfo,
            reference,
            paidAt: storedEntry?.paidAt || new Date().toISOString(),
            raw: payData,
          },
        ]),
      },
    });
  }

  if (!allPaid || tokens.length < utilityItems.length) {
    if (tokens.length && order.userId) {
      try {
        await createUserNotification({
          userId: order.userId,
          type: 'order_received',
          title: 'Utility bill processing',
          message: `Part of order #${order.id.substring(0, 8)} is still processing. Check Order History for updates.`,
          link: '/orders',
        });
      } catch {
        /* ignore */
      }
    }
    return { fulfilled: false, tokens };
  }

  await prisma.order.update({
    where: { id: orderId },
    data: { status: 'fulfilled' },
  });

  if (order.userId) {
    try {
      await createUserNotification({
        userId: order.userId,
        type: 'order_fulfilled',
        title: 'Utility bill paid',
        message: `Your utility bill order #${order.id.substring(0, 8)} is complete. View your token in Order History.`,
        link: '/orders',
      });
    } catch {
      /* ignore */
    }
    try {
      await grantUtilityBillSpinBonus(order.userId, order.id);
    } catch (e) {
      console.error('[utility-bill] spin bonus grant failed', orderId, e);
    }
  }

  try {
    const email = order.user?.email;
    if (email) {
      await sendOrderFulfilledEmail({
        orderId: order.id,
        orderNumber: order.id.slice(0, 8),
        userEmail: email,
        userName: order.user?.name || 'Customer',
        totalUsd: order.totalUsd,
        totalMwk: order.totalMwk,
        items: utilityItems.map((i) => ({
          name: i.name,
          quantity: i.quantity,
          priceUsd: i.priceUsd,
          type: i.type,
          giftCardCodes: i.giftCardCodes || undefined,
        })),
      });
    }
  } catch {
    /* ignore */
  }

  return { fulfilled: true, tokens };
}

export async function getUtilityTokensForOrder(orderId: string): Promise<UtilityBillTokenInfo[]> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });
  if (!order) return [];
  const out: UtilityBillTokenInfo[] = [];
  for (const item of order.items) {
    if (String(item.type || '').trim().toLowerCase() !== 'utility-bill') continue;
    const existing = readExistingToken(item.giftCardCodes);
    if (existing) out.push(existing);
  }
  return out;
}
