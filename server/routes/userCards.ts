import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { basicAdminAuth } from '../lib/adminAuth';
import { ensureVirtualCardTables } from '../lib/ensureVirtualCardTables';
import { backfillVirtualCardsForUser, extractVirtualCardCredentials, provisionVirtualCardsForOrder } from '../lib/virtualCardProvisioning';
import { sendAdminCardRefreshRequestEmail } from '../lib/email';

const router = Router();

router.use(async (_req, _res, next) => {
  try {
    await ensureVirtualCardTables(prisma);
    next();
  } catch (e) {
    next(e);
  }
});

const VIRTUAL_CARD_STATUSES = ['pending', 'active', 'frozen', 'expired', 'closed'] as const;
const VIRTUAL_CARD_TXN_STATUSES = ['completed', 'pending', 'declined'] as const;

function normEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function resolveUserByEmail(emailRaw: string) {
  const email = normEmail(emailRaw);
  if (!email) return null;
  return prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    select: { id: true, email: true, name: true },
  });
}

function serializeCard(card: {
  id: string;
  label: string;
  cardType?: string | null;
  cardLast4: string | null;
  balanceUsd: number;
  cardValueUsd?: number;
  totalFeesUsd?: number;
  totalSpendingsUsd?: number;
  initialBalanceUsd: number | null;
  currency: string;
  status: string;
  swypeCardId: string | null;
  activationUrl: string | null;
  userNotes: string | null;
  lastSyncedAt: Date | null;
  updateRequestedAt?: Date | null;
  orderId: string | null;
  createdAt: Date;
  updatedAt: Date;
  order?: { id: string; createdAt: Date } | null;
  orderItem?: { image: string | null; giftCardCodes?: string | null } | null;
  unitIndex?: number;
  transactions?: Array<{
    id: string;
    type: string;
    amountUsd: number;
    feeUsd?: number;
    totalUsd?: number | null;
    merchant: string | null;
    status: string;
    occurredAt: Date;
    swypeTxnId: string | null;
    notes: string | null;
    createdAt: Date;
  }>;
}) {
  const unitIndex = card.unitIndex ?? 0;
  const cardDetails = extractVirtualCardCredentials(card.orderItem?.giftCardCodes, unitIndex);

  return {
    id: card.id,
    label: card.label,
    cardType: card.cardType ?? 'TConnect',
    cardLast4: card.cardLast4,
    balanceUsd: card.balanceUsd,
    cardValueUsd: card.cardValueUsd ?? card.initialBalanceUsd ?? 0,
    totalFeesUsd: card.totalFeesUsd ?? 0,
    totalSpendingsUsd: card.totalSpendingsUsd ?? 0,
    initialBalanceUsd: card.initialBalanceUsd,
    currency: card.currency,
    status: card.status,
    swypeCardId: card.swypeCardId,
    activationUrl: card.activationUrl,
    userNotes: card.userNotes,
    lastSyncedAt: card.lastSyncedAt,
    updateRequestedAt: card.updateRequestedAt ?? null,
    orderId: card.orderId,
    orderNumber: card.orderId ? card.orderId.slice(0, 8).toUpperCase() : null,
    orderDate: card.order?.createdAt ?? card.createdAt,
    imageUrl: card.orderItem?.image ?? null,
    cardDetails,
    createdAt: card.createdAt,
    updatedAt: card.updatedAt,
    transactions: (card.transactions ?? []).map((t) => {
      const fee = t.feeUsd ?? 0;
      const amt = Math.abs(t.amountUsd);
      const total = t.totalUsd ?? amt + fee;
      return {
        id: t.id,
        type: t.type,
        amountUsd: t.amountUsd,
        feeUsd: fee,
        totalUsd: total,
        merchant: t.merchant,
        status: t.status,
        occurredAt: t.occurredAt instanceof Date ? t.occurredAt.toISOString() : t.occurredAt,
        swypeTxnId: t.swypeTxnId,
        notes: t.notes,
        createdAt: t.createdAt,
      };
    }),
  };
}

function isAwaitingUserRefresh(card: {
  updateRequestedAt: Date | null;
  lastSyncedAt: Date | null;
}): boolean {
  return Boolean(
    card.updateRequestedAt &&
      (!card.lastSyncedAt || card.lastSyncedAt < card.updateRequestedAt)
  );
}

function parseIncomingTxn(raw: Record<string, unknown>) {
  const amount = Number(raw.amountUsd) || 0;
  const fee = Number(raw.feeUsd) || 0;
  const total = raw.totalUsd != null ? Number(raw.totalUsd) : amount + fee;
  const occurred = raw.occurredAt ? new Date(String(raw.occurredAt)) : new Date();
  const txnStatus =
    typeof raw.status === 'string' &&
    VIRTUAL_CARD_TXN_STATUSES.includes(raw.status as (typeof VIRTUAL_CARD_TXN_STATUSES)[number])
      ? raw.status
      : 'completed';
  const txnType =
    typeof raw.type === 'string' && String(raw.type).trim()
      ? String(raw.type).trim().toLowerCase()
      : 'purchase';
  return {
    type: txnType,
    amountUsd: amount,
    feeUsd: fee,
    totalUsd: Number.isFinite(total) ? total : amount + fee,
    merchant: typeof raw.merchant === 'string' ? raw.merchant.trim() : null,
    status: txnStatus,
    occurredAt: Number.isNaN(occurred.getTime()) ? new Date() : occurred,
    swypeTxnId:
      typeof raw.swypeTxnId === 'string' && raw.swypeTxnId.trim() ? raw.swypeTxnId.trim() : null,
    notes:
      typeof raw.location === 'string' && raw.location.trim()
        ? raw.location.trim()
        : typeof raw.notes === 'string' && raw.notes.trim()
          ? raw.notes.trim()
          : null,
  };
}

/** Append or update transactions by swypeTxnId — never wipe existing history. */
async function mergeCardTransactions(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  cardId: string,
  incoming: Record<string, unknown>[]
): Promise<{ added: number; updated: number }> {
  let added = 0;
  let updated = 0;
  if (incoming.length === 0) return { added, updated };

  const existingRows = await tx.userVirtualCardTransaction.findMany({
    where: { cardId },
    select: { id: true, swypeTxnId: true },
  });
  const idBySwype = new Map<string, string>();
  for (const row of existingRows) {
    if (row.swypeTxnId) idBySwype.set(row.swypeTxnId, row.id);
  }

  for (const raw of incoming) {
    const data = parseIncomingTxn(raw);
    if (!data.merchant && data.amountUsd === 0 && data.totalUsd === 0) continue;
    if (data.swypeTxnId && idBySwype.has(data.swypeTxnId)) {
      await tx.userVirtualCardTransaction.update({
        where: { id: idBySwype.get(data.swypeTxnId)! },
        data: {
          type: data.type,
          amountUsd: data.amountUsd,
          feeUsd: data.feeUsd,
          totalUsd: data.totalUsd,
          merchant: data.merchant,
          status: data.status,
          occurredAt: data.occurredAt,
          notes: data.notes,
        },
      });
      updated++;
    } else {
      const created = await tx.userVirtualCardTransaction.create({
        data: { cardId, ...data },
      });
      if (data.swypeTxnId) idBySwype.set(data.swypeTxnId, created.id);
      added++;
    }
  }

  return { added, updated };
}

/** Customer: list own virtual cards (balance, status, transactions) */
router.get('/', async (req, res) => {
  try {
    const email = typeof req.query.email === 'string' ? req.query.email.trim() : '';
    if (!email) return res.status(400).json({ error: 'email required' });

    const user = await resolveUserByEmail(email);
    if (!user) return res.status(404).json({ error: 'User not found' });

    await backfillVirtualCardsForUser(user.id);

    const cards = await prisma.userVirtualCard.findMany({
      where: { userId: user.id },
      orderBy: [{ order: { createdAt: 'desc' } }, { createdAt: 'desc' }],
      include: {
        order: { select: { id: true, createdAt: true } },
        orderItem: { select: { image: true, giftCardCodes: true } },
        transactions: { orderBy: { occurredAt: 'desc' }, take: 500 },
      },
    });

    return res.json({ cards: cards.map(serializeCard) });
  } catch (e: unknown) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to load cards' });
  }
});

/** Admin: users waiting for card refresh (from Swype) */
router.get('/admin/refresh-requests', basicAdminAuth, async (_req, res) => {
  try {
    const cards = await prisma.userVirtualCard.findMany({
      where: { updateRequestedAt: { not: null } },
      orderBy: { updateRequestedAt: 'desc' },
      take: 100,
      include: {
        order: { select: { id: true, createdAt: true } },
        user: { select: { id: true, email: true, name: true } },
        transactions: { orderBy: { occurredAt: 'desc' }, take: 10 },
        _count: { select: { transactions: true } },
      },
    });

    const requests = cards
      .filter((c) => isAwaitingUserRefresh(c))
      .map((c) => ({
        ...serializeCard(c),
        user: c.user,
        adminNotes: c.adminNotes,
        transactionCount: c._count.transactions,
        awaitingUserRefresh: true,
      }));

    return res.json({ requests });
  } catch (e: unknown) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to load requests' });
  }
});

/** Admin: recently fulfilled card updates */
router.get('/admin/fulfilled-history', basicAdminAuth, async (_req, res) => {
  try {
    const cards = await prisma.userVirtualCard.findMany({
      where: { lastSyncedAt: { not: null } },
      orderBy: { lastSyncedAt: 'desc' },
      take: 80,
      include: {
        order: { select: { id: true, createdAt: true } },
        user: { select: { id: true, email: true, name: true } },
        transactions: { orderBy: { occurredAt: 'desc' }, take: 5 },
        _count: { select: { transactions: true } },
      },
    });

    const history = cards
      .filter((c) => !isAwaitingUserRefresh(c))
      .map((c) => ({
        ...serializeCard(c),
        user: c.user,
        adminNotes: c.adminNotes,
        transactionCount: c._count.transactions,
        fulfilledAt: c.lastSyncedAt,
      }));

    return res.json({ history });
  } catch (e: unknown) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to load history' });
  }
});

/** Admin: list cards (optional email filter) — must be registered before /admin/:id */
router.get('/admin/list', basicAdminAuth, async (req, res) => {
  try {
    const email = typeof req.query.email === 'string' ? req.query.email.trim() : '';
    const where = email
      ? {
          user: { email: { equals: normEmail(email), mode: 'insensitive' as const } },
        }
      : {};

    const cards = await prisma.userVirtualCard.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: 200,
      include: {
        order: { select: { id: true, createdAt: true } },
        orderItem: { select: { image: true, giftCardCodes: true } },
        user: { select: { id: true, email: true, name: true } },
        transactions: { orderBy: { occurredAt: 'desc' }, take: 10 },
        _count: { select: { transactions: true } },
      },
    });

    return res.json({
      cards: cards.map((c) => ({
        ...serializeCard(c),
        user: c.user,
        adminNotes: c.adminNotes,
        transactionCount: c._count.transactions,
        orderItemId: c.orderItemId,
        awaitingUserRefresh: isAwaitingUserRefresh(c),
      })),
    });
  } catch (e: unknown) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to list cards' });
  }
});

/** Admin: full card detail for update form */
router.get('/admin/:id', basicAdminAuth, async (req, res) => {
  const reserved = ['list', 'pending-orders', 'refresh-requests', 'fulfilled-history'];
  if (reserved.includes(req.params.id)) {
    return res.status(404).json({ error: 'Not found' });
  }
  try {
    const card = await prisma.userVirtualCard.findUnique({
      where: { id: req.params.id },
      include: {
        order: { select: { id: true, createdAt: true } },
        orderItem: { select: { image: true, giftCardCodes: true } },
        user: { select: { id: true, email: true, name: true } },
        transactions: { orderBy: { occurredAt: 'desc' }, take: 200 },
        _count: { select: { transactions: true } },
      },
    });
    if (!card) return res.status(404).json({ error: 'Card not found' });
    return res.json({
      card: {
        ...serializeCard(card),
        user: card.user,
        adminNotes: card.adminNotes,
        transactionCount: card._count.transactions,
        awaitingUserRefresh: isAwaitingUserRefresh(card),
      },
    });
  } catch (e: unknown) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to load card' });
  }
});

/** Admin: send card update to user (no user notification — they poll / refresh) */
router.post('/admin/:id/send-update', basicAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body ?? {};
    const transactions = Array.isArray(body.transactions) ? body.transactions : [];

    const existing = await prisma.userVirtualCard.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Card not found' });

    const balanceUsd = Number(body.balanceUsd);
    const totalFeesUsd = Number(body.totalFeesUsd);
    const totalSpendingsUsd = Number(body.totalSpendingsUsd);
    const preservedCardValue =
      existing.cardValueUsd > 0
        ? existing.cardValueUsd
        : existing.initialBalanceUsd ?? existing.cardValueUsd ?? 0;

    const mergeStats = await prisma.$transaction(async (tx) => {
      const stats = await mergeCardTransactions(tx, id, transactions);

      const txnCount = await tx.userVirtualCardTransaction.count({ where: { cardId: id } });
      const syncBalance = Number.isFinite(balanceUsd) ? balanceUsd : existing.balanceUsd;
      const syncNote = `Last sync ${new Date().toLocaleString('en-US')}: balance $${syncBalance.toFixed(2)}, ${txnCount} transaction(s) on card${
        stats.added > 0 || stats.updated > 0
          ? ` (+${stats.added} new, ${stats.updated} updated)`
          : ' (balance only)'
      }`;

      await tx.userVirtualCard.update({
        where: { id },
        data: {
          cardLast4:
            typeof body.cardLast4 === 'string' && body.cardLast4.trim()
              ? body.cardLast4.trim().slice(-4)
              : existing.cardLast4,
          cardType: 'TConnect',
          balanceUsd: syncBalance,
          cardValueUsd: preservedCardValue,
          totalFeesUsd: Number.isFinite(totalFeesUsd) ? totalFeesUsd : existing.totalFeesUsd,
          totalSpendingsUsd: Number.isFinite(totalSpendingsUsd)
            ? totalSpendingsUsd
            : existing.totalSpendingsUsd,
          status:
            typeof body.status === 'string' &&
            VIRTUAL_CARD_STATUSES.includes(body.status as (typeof VIRTUAL_CARD_STATUSES)[number])
              ? body.status
              : existing.status || 'active',
          lastSyncedAt: new Date(),
          updateRequestedAt: null,
          adminNotes: syncNote,
        },
      });

      return stats;
    });

    const card = await prisma.userVirtualCard.findUnique({
      where: { id },
      include: {
        order: { select: { id: true, createdAt: true } },
        orderItem: { select: { image: true, giftCardCodes: true } },
        user: { select: { id: true, email: true, name: true } },
        transactions: { orderBy: { occurredAt: 'desc' }, take: 200 },
        _count: { select: { transactions: true } },
      },
    });

    return res.json({
      ok: true,
      mergeStats,
      card: card
        ? {
            ...serializeCard(card),
            user: card.user,
            adminNotes: card.adminNotes,
            transactionCount: card._count.transactions,
          }
        : null,
    });
  } catch (e: unknown) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Send update failed' });
  }
});

/** Admin: virtual card orders awaiting My Cards setup */
router.get('/admin/pending-orders', basicAdminAuth, async (_req, res) => {
  try {
    const orders = await prisma.order.findMany({
      where: {
        status: { in: ['approved', 'fulfilled', 'done'] },
        items: {
          some: {
            OR: [
              { type: 'virtual-card' },
              {
                AND: [
                  { type: { in: ['giftcard', 'gift-card'] } },
                  { name: { contains: 'virtual card', mode: 'insensitive' } },
                ],
              },
            ],
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        user: { select: { id: true, email: true, name: true } },
        items: true,
      },
    });

    const existing = await prisma.userVirtualCard.findMany({
      where: { orderId: { in: orders.map((o) => o.id) } },
      select: { orderId: true, orderItemId: true },
    });
    const linked = new Set(existing.map((e) => `${e.orderId}:${e.orderItemId ?? ''}`));

    const pending: Array<{
      orderId: string;
      orderItemId: string;
      userEmail: string;
      userName: string;
      userId: string;
      itemName: string;
      quantity: number;
      priceUsd: number;
      createdAt: Date;
    }> = [];

    for (const order of orders) {
      for (const item of order.items) {
        const t = String(item.type || '').toLowerCase();
        const name = String(item.name || '').toLowerCase();
        const isVirtual =
          t === 'virtual-card' ||
          ((t === 'giftcard' || t === 'gift-card') && name.includes('virtual card'));
        if (!isVirtual) continue;
        const key = `${order.id}:${item.id}`;
        if (linked.has(key)) continue;
        pending.push({
          orderId: order.id,
          orderItemId: item.id,
          userEmail: order.user.email,
          userName: order.user.name,
          userId: order.user.id,
          itemName: item.name,
          quantity: item.quantity,
          priceUsd: item.priceUsd,
          createdAt: order.createdAt,
        });
      }
    }

    return res.json({ pending });
  } catch (e: unknown) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to load pending orders' });
  }
});

/** Admin: create card for user (from Swype dashboard data) */
router.post('/admin', basicAdminAuth, async (req, res) => {
  try {
    const {
      userEmail,
      userId,
      orderId,
      orderItemId,
      label,
      cardLast4,
      balanceUsd,
      initialBalanceUsd,
      status,
      swypeCardId,
      activationUrl,
      userNotes,
      adminNotes,
    } = req.body ?? {};

    let targetUserId = typeof userId === 'string' ? userId.trim() : '';
    if (!targetUserId && typeof userEmail === 'string' && userEmail.trim()) {
      const u = await resolveUserByEmail(userEmail);
      if (!u) return res.status(404).json({ error: 'User not found' });
      targetUserId = u.id;
    }
    if (!targetUserId) return res.status(400).json({ error: 'userEmail or userId required' });
    if (!label || typeof label !== 'string' || !label.trim()) {
      return res.status(400).json({ error: 'label required' });
    }

    const cardStatus = typeof status === 'string' && VIRTUAL_CARD_STATUSES.includes(status as (typeof VIRTUAL_CARD_STATUSES)[number])
      ? status
      : 'pending';

    const bal = Number(balanceUsd);
    const initBal = initialBalanceUsd != null ? Number(initialBalanceUsd) : null;

    const card = await prisma.userVirtualCard.create({
      data: {
        userId: targetUserId,
        orderId: typeof orderId === 'string' && orderId.trim() ? orderId.trim() : null,
        orderItemId: typeof orderItemId === 'string' && orderItemId.trim() ? orderItemId.trim() : null,
        label: label.trim(),
        cardLast4: typeof cardLast4 === 'string' && cardLast4.trim() ? cardLast4.trim().slice(-4) : null,
        balanceUsd: Number.isFinite(bal) ? bal : 0,
        initialBalanceUsd: initBal != null && Number.isFinite(initBal) ? initBal : null,
        status: cardStatus,
        swypeCardId: typeof swypeCardId === 'string' && swypeCardId.trim() ? swypeCardId.trim() : null,
        activationUrl: typeof activationUrl === 'string' && activationUrl.trim() ? activationUrl.trim() : null,
        userNotes: typeof userNotes === 'string' && userNotes.trim() ? userNotes.trim() : null,
        adminNotes: typeof adminNotes === 'string' && adminNotes.trim() ? adminNotes.trim() : null,
        lastSyncedAt: new Date(),
      },
      include: { transactions: true, user: { select: { id: true, email: true, name: true } } },
    });

    return res.status(201).json({
      card: { ...serializeCard(card), user: card.user, adminNotes: card.adminNotes, orderItemId: card.orderItemId },
    });
  } catch (e: unknown) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to create card' });
  }
});

/** Admin: update card snapshot from Swype */
router.patch('/admin/:id', basicAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body ?? {};
    const data: Record<string, unknown> = { lastSyncedAt: new Date(), updateRequestedAt: null };

    if (typeof body.label === 'string' && body.label.trim()) data.label = body.label.trim();
    if (body.cardLast4 !== undefined) {
      data.cardLast4 =
        typeof body.cardLast4 === 'string' && body.cardLast4.trim()
          ? body.cardLast4.trim().slice(-4)
          : null;
    }
    if (body.balanceUsd !== undefined) {
      const bal = Number(body.balanceUsd);
      if (Number.isFinite(bal)) data.balanceUsd = bal;
    }
    if (body.initialBalanceUsd !== undefined) {
      const init = Number(body.initialBalanceUsd);
      data.initialBalanceUsd = Number.isFinite(init) ? init : null;
    }
    if (typeof body.status === 'string' && VIRTUAL_CARD_STATUSES.includes(body.status as (typeof VIRTUAL_CARD_STATUSES)[number])) {
      data.status = body.status;
    }
    if (body.swypeCardId !== undefined) {
      data.swypeCardId =
        typeof body.swypeCardId === 'string' && body.swypeCardId.trim() ? body.swypeCardId.trim() : null;
    }
    if (body.activationUrl !== undefined) {
      data.activationUrl =
        typeof body.activationUrl === 'string' && body.activationUrl.trim() ? body.activationUrl.trim() : null;
    }
    if (body.userNotes !== undefined) {
      data.userNotes = typeof body.userNotes === 'string' && body.userNotes.trim() ? body.userNotes.trim() : null;
    }
    if (body.adminNotes !== undefined) {
      data.adminNotes = typeof body.adminNotes === 'string' && body.adminNotes.trim() ? body.adminNotes.trim() : null;
    }

    const card = await prisma.userVirtualCard.update({
      where: { id },
      data,
      include: {
        orderItem: { select: { image: true, giftCardCodes: true } },
        transactions: { orderBy: { occurredAt: 'desc' }, take: 500 },
        user: { select: { id: true, email: true, name: true } },
      },
    });

    return res.json({
      card: { ...serializeCard(card), user: card.user, adminNotes: card.adminNotes, orderItemId: card.orderItemId },
    });
  } catch (e: unknown) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to update card' });
  }
});

/** Admin: add transaction from Swype history */
router.post('/admin/:id/transactions', basicAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { type, amountUsd, merchant, status, occurredAt, swypeTxnId, notes } = req.body ?? {};

    const amt = Number(amountUsd);
    if (!Number.isFinite(amt) || amt === 0) {
      return res.status(400).json({ error: 'amountUsd required (non-zero number)' });
    }

    const occurred = occurredAt ? new Date(occurredAt) : new Date();
    if (Number.isNaN(occurred.getTime())) {
      return res.status(400).json({ error: 'Invalid occurredAt' });
    }

    const txn = await prisma.userVirtualCardTransaction.create({
      data: {
        cardId: id,
        type: typeof type === 'string' && type.trim() ? type.trim() : 'other',
        amountUsd: amt,
        merchant: typeof merchant === 'string' && merchant.trim() ? merchant.trim() : null,
        status: typeof status === 'string' && status.trim() ? status.trim() : 'completed',
        occurredAt: occurred,
        swypeTxnId: typeof swypeTxnId === 'string' && swypeTxnId.trim() ? swypeTxnId.trim() : null,
        notes: typeof notes === 'string' && notes.trim() ? notes.trim() : null,
      },
    });

    const card = await prisma.userVirtualCard.update({
      where: { id },
      data: { lastSyncedAt: new Date(), updateRequestedAt: null },
    });

    return res.status(201).json({ transaction: txn });
  } catch (e: unknown) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to add transaction' });
  }
});

/** Admin: delete a transaction */
router.delete('/admin/:cardId/transactions/:txnId', basicAdminAuth, async (req, res) => {
  try {
    const { cardId, txnId } = req.params;
    const txn = await prisma.userVirtualCardTransaction.findFirst({
      where: { id: txnId, cardId },
    });
    if (!txn) return res.status(404).json({ error: 'Transaction not found' });

    await prisma.userVirtualCardTransaction.delete({ where: { id: txnId } });
    await prisma.userVirtualCard.update({
      where: { id: cardId },
      data: { lastSyncedAt: new Date(), updateRequestedAt: null },
    });

    return res.json({ ok: true });
  } catch (e: unknown) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to delete transaction' });
  }
});

/** Admin: provision My Cards rows for an order (backfill) */
router.post('/admin/provision-order/:orderId', basicAdminAuth, async (req, res) => {
  try {
    const activate = req.body?.activate === true;
    const cards = await provisionVirtualCardsForOrder(req.params.orderId, { activate });
    return res.json({ ok: true, count: cards.length, cards });
  } catch (e: unknown) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Provision failed' });
  }
});

/** Customer: poll single card sync status */
router.get('/:id', async (req, res) => {
  try {
    const email = typeof req.query.email === 'string' ? req.query.email.trim() : '';
    if (!email) return res.status(400).json({ error: 'email required' });

    const user = await resolveUserByEmail(email);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const card = await prisma.userVirtualCard.findFirst({
      where: { id: req.params.id, userId: user.id },
      include: {
        order: { select: { id: true, createdAt: true } },
        orderItem: { select: { image: true, giftCardCodes: true } },
        transactions: { orderBy: { occurredAt: 'desc' }, take: 500 },
      },
    });
    if (!card) return res.status(404).json({ error: 'Card not found' });

    const awaitingUpdate = Boolean(
      card.updateRequestedAt &&
        (!card.lastSyncedAt || card.lastSyncedAt < card.updateRequestedAt)
    );

    return res.json({ card: serializeCard(card), awaitingUpdate });
  } catch (e: unknown) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to load card' });
  }
});

/** Customer: request admin to refresh card from Swype */
router.post('/:id/request-update', async (req, res) => {
  try {
    const email =
      typeof req.body?.email === 'string'
        ? req.body.email.trim()
        : typeof req.query.email === 'string'
          ? req.query.email.trim()
          : '';
    if (!email) return res.status(400).json({ error: 'email required' });

    const user = await resolveUserByEmail(email);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const existing = await prisma.userVirtualCard.findFirst({
      where: { id: req.params.id, userId: user.id },
    });
    if (!existing) return res.status(404).json({ error: 'Card not found' });

    const now = new Date();
    const card = await prisma.userVirtualCard.update({
      where: { id: existing.id },
      data: { updateRequestedAt: now },
      include: {
        order: { select: { id: true, createdAt: true } },
        orderItem: { select: { image: true, giftCardCodes: true } },
        transactions: { orderBy: { occurredAt: 'desc' }, take: 500 },
      },
    });

    const orderRef = card.orderId ? card.orderId.slice(0, 8).toUpperCase() : null;
    try {
      await prisma.notification.create({
        data: {
          userId: null,
          type: 'virtual_card_update_request',
          title: 'Card refresh requested',
          message: `${user.name || user.email} requested an update on "${card.label}"${orderRef ? ` (Order #${orderRef})` : ''}.`,
          link: `/admin/cards?cardId=${card.id}`,
        },
      });
      await sendAdminCardRefreshRequestEmail({
        cardId: card.id,
        customerName: user.name || user.email,
        customerEmail: user.email,
        cardLabel: card.label,
        orderNumber: orderRef,
      });
    } catch {
      /* ignore */
    }

    return res.json({
      ok: true,
      card: serializeCard(card),
      awaitingUpdate: true,
    });
  } catch (e: unknown) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Request failed' });
  }
});

export default router;
