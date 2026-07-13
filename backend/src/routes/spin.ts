import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { basicAdminAuth } from '../lib/adminAuth';
import {
  createSpinPrizeOrder,
  spinProductDetailKind,
  type SpinDetailKind,
} from '../lib/spinFulfillment';
import { describeSpinPrize, normalizeWheelLetter, spinProductPrizeUsd } from '../lib/spinPrizeDisplay';
import { createUserNotification } from '../lib/userNotifications';
import type { UserNotificationPayload } from '../lib/userNotifications';

function parsePrizeAmountUsd(raw: unknown): number | null {
  if (raw === undefined || raw === null || raw === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100) / 100;
}

const MIN_WHEEL_SECTORS = 3;
const MAX_WHEEL_SECTORS = 24;

function wheelConfigOk(prizes: { rewardType: string; label?: string }[]): boolean {
  if (prizes.length < MIN_WHEEL_SECTORS || prizes.length > MAX_WHEEL_SECTORS) return false;
  for (const p of prizes) {
    if (String(p.rewardType).trim() !== 'no_win' && !normalizeWheelLetter(String(p.label || ''))) {
      return false;
    }
  }
  return true;
}

function wheelConfigMessage(prizes: { rewardType: string; label?: string }[]): string | null {
  if (wheelConfigOk(prizes)) return null;
  if (prizes.length < MIN_WHEEL_SECTORS) {
    return `Add at least ${MIN_WHEEL_SECTORS} active slices in Admin (currently ${prizes.length}).`;
  }
  if (prizes.length > MAX_WHEEL_SECTORS) {
    return `Maximum ${MAX_WHEEL_SECTORS} active slices.`;
  }
  return 'Each prize slice needs a letter (A–Z). No-win slices are green with no letter.';
}

const router = Router();

function formatSpinRouteError(err: unknown): string {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2021' || err.code === 'P2010' || err.code === 'P1001') {
      return (
        'Spin tables are missing on this database (or the DB is unreachable). Run `npx prisma db push` from the project root, or apply your SQL migration in Neon, then restart the API.'
      );
    }
  }
  return err instanceof Error ? err.message : String(err);
}

const DAY_MS = 24 * 60 * 60 * 1000;
const SPIN_TYPE = 'spin_attempt';
/** @deprecated legacy — older grants used this type for each spin credit */
const SPIN_GRANT_TYPE = 'spin_grant';
/** User-facing notification when admin grants bonus spins */
const SPIN_BONUS_NOTIFY = 'spin_bonus';
const MAX_SPINS_PER_DAY = 1;
const MAX_ADMIN_GRANT_SPINS = 5;
const WHEEL_SECTOR_COUNT = 9; // default template size only

/** 9 sectors: 2× green no-win (no letter) + 7 prize sectors (letters B–I). */
const STANDARD_NINE_WHEEL = [
  { label: '', rewardType: 'no_win', points: 0, weight: 18, sortOrder: 0 },
  { label: 'B', rewardType: 'points', points: 25, weight: 14, sortOrder: 1 },
  { label: 'C', rewardType: 'points', points: 50, weight: 12, sortOrder: 2 },
  { label: 'D', rewardType: 'points', points: 100, weight: 10, sortOrder: 3 },
  { label: '', rewardType: 'no_win', points: 0, weight: 18, sortOrder: 4 },
  { label: 'F', rewardType: 'points', points: 200, weight: 8, sortOrder: 5 },
  { label: 'G', rewardType: 'points', points: 500, weight: 5, sortOrder: 6 },
  { label: 'H', rewardType: 'points', points: 25, weight: 8, sortOrder: 7 },
  { label: 'I', rewardType: 'points', points: 100, weight: 7, sortOrder: 8 },
] as const;

async function createStandardNineWheel() {
  await prisma.spinPrize.createMany({
    data: STANDARD_NINE_WHEEL.map((row) => ({ ...row, active: true })),
  });
}

async function applyNineSectorTemplate() {
  await prisma.spinPrize.deleteMany();
  await createStandardNineWheel();
}

async function loadActivePrizes() {
  return prisma.spinPrize.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    include: {
      product: { select: { id: true, name: true, type: true, category: true, priceUsd: true, image: true } },
    },
  });
}

async function activePrizeCount(excludeId?: string): Promise<number> {
  return prisma.spinPrize.count({
    where: {
      active: true,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  });
}

type PrizeRow = Awaited<ReturnType<typeof loadActivePrizes>>[number];

function pickPrize(prizes: PrizeRow[]): PrizeRow {
  const total = prizes.reduce((sum, r) => sum + Math.max(0, r.weight), 0);
  if (total <= 0) return prizes[0];
  let n = Math.random() * total;
  for (const r of prizes) {
    n -= Math.max(0, r.weight);
    if (n <= 0) return r;
  }
  return prizes[prizes.length - 1];
}

async function bonusSpinsGrantedToday(userId: string, dayStart: Date): Promise<number> {
  let fromLog = 0;
  const agg = await prisma.spinGrantLog.aggregate({
    where: { userId, createdAt: { gte: dayStart } },
    _sum: { spins: true },
  });
  fromLog = agg._sum.spins ?? 0;

  /** Legacy: count old per-notification grants as individual credits */
  const legacy = await prisma.notification.count({
    where: {
      userId,
      type: SPIN_GRANT_TYPE,
      createdAt: { gte: dayStart },
    },
  });

  return fromLog + legacy;
}

async function resolveUserByEmail(emailRaw: unknown) {
  const email = typeof emailRaw === 'string' ? emailRaw.trim() : '';
  if (!email) return null;
  return prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    select: { id: true, email: true, pointsBalance: true },
  });
}

/** Public wheel config for the storefront */
router.get('/wheel', async (_req, res) => {
  try {
    const prizes = await loadActivePrizes();
    const slices = prizes.map((p, slotIndex) => {
      const isNoWin = String(p.rewardType).trim() === 'no_win';
      const letter = isNoWin ? '' : normalizeWheelLetter(p.label);
      return {
        id: p.id,
        slotIndex,
        letter,
        label: letter,
        showLetter: !isNoWin,
        description: describeSpinPrize(p),
        rewardType: p.rewardType,
        points: p.points,
        productId: p.productId,
        productName: p.product?.name ?? null,
        prizeAmountUsd: spinProductPrizeUsd(p),
      };
    });
    return res.json({
      slices,
      sectorCount: prizes.length,
      minSectors: MIN_WHEEL_SECTORS,
      maxSectors: MAX_WHEEL_SECTORS,
      complete: wheelConfigOk(prizes),
      configMessage: wheelConfigMessage(prizes),
    });
  } catch (e: unknown) {
    return res.status(500).json({ error: formatSpinRouteError(e) || 'Failed to load wheel' });
  }
});

/** Replace wheel with standard 9 sectors (2 green no-win + red/black prizes). */
router.post('/admin/apply-nine-wheel', basicAdminAuth, async (_req, res) => {
  try {
    await applyNineSectorTemplate();
    const prizes = await loadActivePrizes();
    return res.json({ ok: true, count: prizes.length });
  } catch (e: unknown) {
    return res.status(500).json({ error: formatSpinRouteError(e) || 'Failed to apply wheel template' });
  }
});

router.get('/status', async (req, res) => {
  try {
    const user = await resolveUserByEmail(req.query.email);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const tomorrowStart = new Date(dayStart.getTime() + DAY_MS);

    const spinsUsedToday = await prisma.notification.count({
      where: {
        userId: user.id,
        type: SPIN_TYPE,
        createdAt: { gte: dayStart },
      },
    });
    const grantedBonus = await bonusSpinsGrantedToday(user.id, dayStart);
    const effectiveMaxSpins = MAX_SPINS_PER_DAY + grantedBonus;
    const canSpin = spinsUsedToday < effectiveMaxSpins;
    const nextAt = canSpin ? null : tomorrowStart;
    return res.json({
      canSpin,
      pointsBalance: user.pointsBalance || 0,
      spinsUsedToday,
      spinsRemainingToday: Math.max(0, effectiveMaxSpins - spinsUsedToday),
      maxSpinsPerDay: effectiveMaxSpins,
      baseSpinsPerDay: MAX_SPINS_PER_DAY,
      grantedSpinsToday: grantedBonus,
      nextSpinAt: nextAt,
    });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Failed to load spin status' });
  }
});

router.post('/play', async (req, res) => {
  try {
    const user = await resolveUserByEmail(req.body?.email);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const tomorrowStart = new Date(dayStart.getTime() + DAY_MS);
    const spinsUsedToday = await prisma.notification.count({
      where: {
        userId: user.id,
        type: SPIN_TYPE,
        createdAt: { gte: dayStart },
      },
    });
    const grantedBonus = await bonusSpinsGrantedToday(user.id, dayStart);
    const effectiveMaxSpins = MAX_SPINS_PER_DAY + grantedBonus;
    if (spinsUsedToday >= effectiveMaxSpins) {
      return res.status(429).json({
        error: `Daily limit reached (${effectiveMaxSpins}/${effectiveMaxSpins})`,
        nextSpinAt: tomorrowStart,
      });
    }

    const prizes = await loadActivePrizes();
    if (!wheelConfigOk(prizes)) {
      return res.status(503).json({
        error: wheelConfigMessage(prizes) || 'Spin wheel is not ready. Admin must add slices.',
      });
    }

    const prize = pickPrize(prizes);
    const prizeDescription = describeSpinPrize(prize);
    const prizeLetter =
      String(prize.rewardType).trim() === 'no_win' ? '' : normalizeWheelLetter(prize.label);
    let nextPoints = user.pointsBalance || 0;
    let userMessage = '';
    let productName: string | null = null;
    let productWinId: string | null = null;
    let needsClaim = false;
    let detailKind: SpinDetailKind | null = null;
    let orderId: string | null = null;
    let spinNotif: Omit<UserNotificationPayload, 'userId'> | null = null;

    await prisma.$transaction(async (tx) => {
      if (prize.rewardType === 'points' && prize.points > 0) {
        const updated = await tx.user.update({
          where: { id: user.id },
          data: { pointsBalance: { increment: prize.points } },
          select: { pointsBalance: true },
        });
        nextPoints = updated.pointsBalance;
        await tx.pointsTransaction.create({
          data: {
            userId: user.id,
            type: 'earned',
            points: prize.points,
            description: `Spin reward: ${prize.label}`,
          },
        });
        userMessage = `You won ${prizeDescription} — added to your account!`;
        spinNotif = {
          type: SPIN_TYPE,
          title: 'Daily Spin Result',
          message: userMessage,
          link: '/spin',
        };
      } else if (prize.rewardType === 'product' && prize.productId) {
        const prod =
          prize.product ||
          (await tx.product.findUnique({
            where: { id: prize.productId },
          }));
        if (!prod) {
          userMessage = 'Prize product missing. Contact support.';
          spinNotif = {
            type: SPIN_TYPE,
            title: 'Daily Spin Result',
            message: userMessage,
            link: '/spin',
          };
          return;
        }
        productName = prod.name;
        const kind = spinProductDetailKind(prod);
        const prizeUsd = spinProductPrizeUsd(prize);
        const win = await tx.spinProductWin.create({
          data: {
            userId: user.id,
            productId: prod.id,
            prizeLabel: prize.label,
            status: 'pending',
            notes: kind
              ? JSON.stringify({
                  awaitingClaim: true,
                  detailKind: kind,
                  prizeAmountUsd: prizeUsd,
                })
              : prizeUsd != null
                ? JSON.stringify({ prizeAmountUsd: prizeUsd })
                : null,
          },
        });
        productWinId = win.id;

        if (kind) {
          needsClaim = true;
          detailKind = kind;
          userMessage =
            kind === 'binance_id'
              ? `You won ${prizeDescription}! Enter your Binance ID to submit your prize to admin.`
              : `You won ${prizeDescription}! Enter your PayPal email to submit your prize to admin.`;
        } else {
          const order = await createSpinPrizeOrder(
            tx,
            user.id,
            prod,
            prize.label,
            { spinProductWinId: win.id },
            prizeUsd
          );
          orderId = order.id;
          await tx.spinProductWin.update({
            where: { id: win.id },
            data: { orderId: order.id },
          });
          userMessage = `You won ${prizeDescription}! Your order was sent to admin for fulfillment.`;
        }

        spinNotif = {
          type: SPIN_TYPE,
          title: 'Daily Spin — Prize Win!',
          message: userMessage,
          link: needsClaim ? '/spin' : '/orders',
        };
      } else {
        userMessage = 'No win this time. Try again next time!';
        spinNotif = {
          type: SPIN_TYPE,
          title: 'Daily Spin Result',
          message: userMessage,
          link: '/spin',
        };
      }
    });

    if (spinNotif) {
      await createUserNotification({ userId: user.id, ...(spinNotif as Omit<UserNotificationPayload, 'userId'>) });
    }

    return res.json({
      rewardId: prize.id,
      rewardLabel: prize.label,
      rewardLetter: prizeLetter,
      prizeDescription,
      rewardType: prize.rewardType,
      pointsWon: prize.rewardType === 'points' ? prize.points : 0,
      productId: prize.rewardType === 'product' ? prize.productId : null,
      productName,
      productWinId,
      needsClaim,
      detailKind,
      orderId,
      pointsBalance: nextPoints,
      spinsUsedToday: spinsUsedToday + 1,
      spinsRemainingToday: Math.max(0, effectiveMaxSpins - (spinsUsedToday + 1)),
      maxSpinsPerDay: effectiveMaxSpins,
      baseSpinsPerDay: MAX_SPINS_PER_DAY,
      grantedSpinsToday: grantedBonus,
      nextSpinAt: spinsUsedToday + 1 >= effectiveMaxSpins ? tomorrowStart : null,
    });
  } catch (e: unknown) {
    return res.status(500).json({ error: formatSpinRouteError(e) || 'Failed to process spin' });
  }
});

/** After winning PayPal/USDT product — user submits delivery details; creates admin order. */
router.post('/claim-prize', async (req, res) => {
  try {
    const user = await resolveUserByEmail(req.body?.email);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const winId = String(req.body?.winId || '').trim();
    const paypalEmail = String(req.body?.paypalEmail || '').trim();
    const binanceId = String(req.body?.binanceId || '').trim();
    if (!winId) return res.status(400).json({ error: 'winId required' });

    const win = await prisma.spinProductWin.findUnique({
      where: { id: winId },
      include: { product: true },
    });
    if (!win || win.userId !== user.id) {
      return res.status(404).json({ error: 'Prize win not found' });
    }
    if (win.orderId) {
      return res.json({ ok: true, orderId: win.orderId, message: 'already_claimed' });
    }

    const kind = spinProductDetailKind(win.product);
    if (!kind) {
      return res.status(400).json({ error: 'This prize does not require extra details' });
    }

    let delivery: Record<string, unknown> = { spinProductWinId: win.id };
    if (kind === 'paypal_email') {
      if (!paypalEmail || !paypalEmail.includes('@')) {
        return res.status(400).json({ error: 'Valid PayPal email required' });
      }
      delivery = {
        ...delivery,
        deliveryMethod: 'paypal_email',
        paypalEmail,
        walletEmail: paypalEmail,
      };
    } else {
      if (!binanceId || binanceId.length < 4) {
        return res.status(400).json({ error: 'Valid Binance ID required' });
      }
      delivery = {
        ...delivery,
        deliveryMethod: 'binance_id',
        binanceId,
        coin: 'USDT',
      };
    }

    let claimAmountUsd: number | null = null;
    try {
      const parsed = win.notes ? JSON.parse(win.notes) : null;
      if (parsed?.prizeAmountUsd != null && Number(parsed.prizeAmountUsd) > 0) {
        claimAmountUsd = Number(parsed.prizeAmountUsd);
      }
    } catch {
      claimAmountUsd = null;
    }

    const order = await prisma.$transaction(async (tx) => {
      const created = await createSpinPrizeOrder(
        tx,
        user.id,
        win.product,
        win.prizeLabel,
        delivery,
        claimAmountUsd
      );
      await tx.spinProductWin.update({
        where: { id: win.id },
        data: {
          orderId: created.id,
          notes: JSON.stringify({ claimedAt: new Date().toISOString(), detailKind: kind, ...delivery }),
        },
      });
      return created;
    });

    await createUserNotification({
      userId: user.id,
      type: 'system_announcement',
      title: 'Spin prize submitted',
      message: `Your ${win.product.name} prize was submitted to admin. Track it in Order History.`,
      link: '/orders',
    });

    return res.json({ ok: true, orderId: order.id, productName: win.product.name });
  } catch (e: unknown) {
    return res.status(500).json({ error: formatSpinRouteError(e) || 'Failed to claim prize' });
  }
});

router.post('/admin/grant', basicAdminAuth, async (req, res) => {
  try {
    const targetEmail = String(req.body?.email ?? '').trim();
    const targetUserId = String(req.body?.userId ?? '').trim();
    const spinsRaw = Number(req.body?.spins);
    const spins = Math.floor(spinsRaw);

    if (!Number.isFinite(spins) || spins < 1 || spins > MAX_ADMIN_GRANT_SPINS) {
      return res.status(400).json({ error: `spins must be between 1 and ${MAX_ADMIN_GRANT_SPINS}` });
    }

    let user =
      targetUserId.length > 0
        ? await prisma.user.findUnique({
            where: { id: targetUserId },
            select: { id: true, email: true },
          })
        : null;
    if (!user && targetEmail) {
      user = await prisma.user.findFirst({
        where: { email: { equals: targetEmail, mode: 'insensitive' } },
        select: { id: true, email: true },
      });
    }
    if (!user) return res.status(404).json({ error: 'User not found' });

    const notifData = {
      userId: user.id,
      type: SPIN_BONUS_NOTIFY,
      title: 'Bonus spins added',
      message:
        spins === 1
          ? 'You received 1 bonus spin for today. Open Spin to Win to use it.'
          : `You received ${spins} bonus spins for today. Open Spin to Win to use them.`,
      link: '/spin',
      read: false,
    };
    await prisma.spinGrantLog.create({
      data: { userId: user.id, spins },
    });
    await createUserNotification(notifData);

    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const grantedSpinsToday = await bonusSpinsGrantedToday(user.id, dayStart);

    return res.json({
      ok: true,
      email: user.email,
      grantedNow: spins,
      grantedSpinsToday,
      maxSpinsPerDay: MAX_SPINS_PER_DAY + grantedSpinsToday,
    });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Failed to grant spins' });
  }
});

router.get('/admin/history', basicAdminAuth, async (req, res) => {
  try {
    const limitRaw = Number(req.query.limit);
    const limit = Number.isFinite(limitRaw) ? Math.min(500, Math.max(1, Math.floor(limitRaw))) : 150;

    const rows = await prisma.notification.findMany({
      where: {
        type: { in: [SPIN_TYPE, SPIN_GRANT_TYPE, SPIN_BONUS_NOTIFY] },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        userId: true,
        type: true,
        title: true,
        message: true,
        createdAt: true,
      },
    });

    const userIds = [...new Set(rows.map((r) => r.userId).filter((id): id is string => Boolean(id)))];
    const users =
      userIds.length === 0
        ? []
        : await prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, email: true, name: true },
          });
    const userMap = new Map(users.map((u) => [u.id, u]));

    const items = rows.map((r) => ({
      ...r,
      user: r.userId ? userMap.get(r.userId) ?? null : null,
    }));

    return res.json({ items, limit });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Failed to load spin history' });
  }
});

router.get('/admin/prizes', basicAdminAuth, async (_req, res) => {
  try {
    const prizes = await prisma.spinPrize.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: {
      product: { select: { id: true, name: true, type: true, category: true, priceUsd: true, image: true } },
    },
    });
    return res.json(prizes);
  } catch (e: unknown) {
    return res.status(500).json({ error: formatSpinRouteError(e) || 'Failed to load prizes' });
  }
});

router.post('/admin/prizes', basicAdminAuth, async (req, res) => {
  try {
    const { label, rewardType, points, productId, prizeAmountUsd, weight, sortOrder, active } = req.body || {};
    const labelVal = String(label || '').trim();
    const rt = String(rewardType || '').trim();
    if (!['points', 'product', 'no_win'].includes(rt)) return res.status(400).json({ error: 'rewardType must be points, product, or no_win' });

    let letterVal = '';
    const so = Math.floor(Number(sortOrder) || 0);
    if (rt === 'no_win') {
      letterVal = '';
    } else {
      if (!labelVal) return res.status(400).json({ error: 'Wheel letter required (e.g. B, C)' });
      letterVal = normalizeWheelLetter(labelVal);
      if (!letterVal) return res.status(400).json({ error: 'Enter a letter A–Z for this prize slice' });
    }

    let pts = Math.max(0, Math.floor(Number(points) || 0));
    let pid: string | null = productId ? String(productId).trim() : null;
    if (rt === 'points') {
      pid = null;
      if (pts <= 0) return res.status(400).json({ error: 'points required for points prizes' });
    }
    let amountUsd: number | null = null;
    if (rt === 'product') {
      pts = 0;
      if (!pid) return res.status(400).json({ error: 'productId required for product prizes' });
      const p = await prisma.product.findUnique({ where: { id: pid } });
      if (!p) return res.status(404).json({ error: 'Product not found' });
      amountUsd = parsePrizeAmountUsd(prizeAmountUsd);
      if (amountUsd == null) {
        return res.status(400).json({ error: 'Enter prize amount in USD (e.g. 1 for $1 USDT)' });
      }
    }
    if (rt === 'no_win') {
      pts = 0;
      pid = null;
      amountUsd = null;
    }

    const w = Math.max(0, Math.floor(Number(weight) || 10));
    const act = active !== false;

    if (act) {
      const activeCount = await activePrizeCount();
      if (activeCount >= MAX_WHEEL_SECTORS) {
        return res.status(400).json({
          error: `Maximum ${MAX_WHEEL_SECTORS} active slices. Delete one or turn one off.`,
        });
      }
    }

    const created = await prisma.spinPrize.create({
      data: {
        label: letterVal,
        rewardType: rt,
        points: pts,
        productId: pid,
        prizeAmountUsd: amountUsd,
        weight: w,
        sortOrder: so,
        active: act,
      },
      include: {
      product: { select: { id: true, name: true, type: true, category: true, priceUsd: true, image: true } },
    },
    });
    return res.json(created);
  } catch (e: unknown) {
    return res.status(500).json({ error: formatSpinRouteError(e) || 'Failed to create prize' });
  }
});

router.patch('/admin/prizes/:id', basicAdminAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const { label, rewardType, points, productId, prizeAmountUsd, weight, sortOrder, active } = req.body || {};

    const existing = await prisma.spinPrize.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Prize not found' });

    const rt = rewardType !== undefined ? String(rewardType).trim() : existing.rewardType;
    if (!['points', 'product', 'no_win'].includes(rt)) return res.status(400).json({ error: 'invalid rewardType' });

    let pts = existing.points;
    let pid: string | null = existing.productId;
    let amountUsd: number | null =
      existing.prizeAmountUsd != null ? Number(existing.prizeAmountUsd) : null;

    if (rewardType !== undefined || points !== undefined || productId !== undefined) {
      if (rt === 'points') {
        pts = Math.max(0, Math.floor(Number(points !== undefined ? points : existing.points)));
        pid = null;
        amountUsd = null;
        if (pts <= 0) return res.status(400).json({ error: 'points must be positive' });
      } else if (rt === 'product') {
        pts = 0;
        pid = productId !== undefined ? String(productId || '').trim() : existing.productId;
        if (!pid) return res.status(400).json({ error: 'productId required' });
        const p = await prisma.product.findUnique({ where: { id: pid } });
        if (!p) return res.status(404).json({ error: 'Product not found' });
      } else {
        pts = 0;
        pid = null;
        amountUsd = null;
      }
    }

    if (rt === 'product') {
      if (prizeAmountUsd !== undefined) {
        amountUsd = parsePrizeAmountUsd(prizeAmountUsd);
      }
      if (amountUsd == null) {
        return res.status(400).json({ error: 'Enter prize amount in USD (e.g. 1 for $1 USDT)' });
      }
    } else if (rewardType !== undefined) {
      amountUsd = null;
    }

    let labelData: string | undefined;
    if (rt === 'no_win') {
      labelData = '';
    } else if (label !== undefined) {
      labelData = normalizeWheelLetter(String(label));
      if (!labelData) return res.status(400).json({ error: 'Prize slices need a letter (A–Z)' });
    } else if (rewardType !== undefined && rt !== 'no_win' && !normalizeWheelLetter(existing.label)) {
      return res.status(400).json({ error: 'Prize slices need a letter (A–Z)' });
    }

    const updated = await prisma.spinPrize.update({
      where: { id },
      data: {
        label: labelData !== undefined ? labelData : undefined,
        rewardType: rewardType !== undefined ? rt : undefined,
        points: pts,
        productId: pid,
        prizeAmountUsd: rt === 'product' ? amountUsd : rewardType !== undefined ? null : undefined,
        weight: weight !== undefined ? Math.max(0, Math.floor(Number(weight))) : undefined,
        sortOrder: sortOrder !== undefined ? Math.floor(Number(sortOrder)) : undefined,
        active: active !== undefined ? Boolean(active) : undefined,
      },
      include: {
      product: { select: { id: true, name: true, type: true, category: true, priceUsd: true, image: true } },
    },
    });
    return res.json(updated);
  } catch (e: unknown) {
    return res.status(500).json({ error: formatSpinRouteError(e) || 'Failed to update prize' });
  }
});

router.delete('/admin/prizes/:id', basicAdminAuth, async (req, res) => {
  try {
    const existing = await prisma.spinPrize.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Prize not found' });
    await prisma.spinPrize.delete({ where: { id: req.params.id } });
    return res.json({ ok: true });
  } catch (e: unknown) {
    return res.status(500).json({ error: formatSpinRouteError(e) || 'Failed to delete prize' });
  }
});

router.get('/admin/product-wins', basicAdminAuth, async (req, res) => {
  try {
    const status = String(req.query.status || 'pending').trim();
    const take = Math.min(200, Math.max(1, Math.floor(Number(req.query.limit) || 100)));
    const wins = await prisma.spinProductWin.findMany({
      where: status === 'all' ? {} : { status },
      orderBy: { createdAt: 'desc' },
      take,
      include: {
        user: { select: { id: true, email: true, name: true } },
        product: { select: { id: true, name: true, type: true, category: true, priceUsd: true } },
      },
    });
    return res.json(wins);
  } catch (e: unknown) {
    return res.status(500).json({ error: formatSpinRouteError(e) || 'Failed to load product wins' });
  }
});

router.patch('/admin/product-wins/:id', basicAdminAuth, async (req, res) => {
  try {
    const { status, notes } = req.body || {};
    const st = String(status || '').trim();
    if (!['pending', 'fulfilled'].includes(st)) {
      return res.status(400).json({ error: 'status must be pending or fulfilled' });
    }
    const updated = await prisma.spinProductWin.update({
      where: { id: req.params.id },
      data: {
        status: st,
        notes: notes !== undefined ? String(notes) : undefined,
      },
      include: {
        user: { select: { id: true, email: true, name: true } },
        product: { select: { id: true, name: true, type: true, category: true, priceUsd: true } },
      },
    });

    if (st === 'fulfilled' && updated.userId) {
      await createUserNotification({
        userId: updated.userId,
        type: 'system_announcement',
        title: 'Spin prize fulfilled',
        message: `Your spin prize "${updated.prizeLabel}" (${updated.product.name}) is ready. Thank you for playing!`,
        link: '/orders',
      });
    }

    return res.json(updated);
  } catch (e: unknown) {
    return res.status(500).json({ error: formatSpinRouteError(e) || 'Failed to update win' });
  }
});

export default router;
