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
import {
  buildNineSliceLayout,
  FIXED_TCONNECT_POINTS,
  N_SLICE_LETTER,
  N_SLICE_POINTS,
  segmentKindFromRow,
  WHEEL_SECTOR_COUNT,
  WHEEL_WEIGHT_NO_WIN_EACH,
  WHEEL_WEIGHT_POINTS_EACH,
  WHEEL_WEIGHT_PRODUCT_EACH,
  type WheelSegmentDraft,
} from '../lib/spinWheelLayout';
import { createUserNotification } from '../lib/userNotifications';
import type { UserNotificationPayload } from '../lib/userNotifications';

function parsePrizeAmountUsd(raw: unknown): number | null {
  if (raw === undefined || raw === null || raw === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100) / 100;
}

function wheelConfigOk(
  prizes: { rewardType: string; points: number; productId: string | null; label?: string }[]
): boolean {
  if (prizes.length !== WHEEL_SECTOR_COUNT) return false;
  const noWin = prizes.filter((p) => String(p.rewardType).trim() === 'no_win');
  const fixed = prizes.filter((p) => segmentKindFromRow(p) === 'points_fixed');
  const custom = prizes.filter((p) => segmentKindFromRow(p) === 'custom');
  if (noWin.length !== 2 || fixed.length !== 5 || custom.length !== 2) return false;
  for (const p of prizes) {
    if (String(p.rewardType).trim() === 'no_win' && String(p.label || '').trim()) return false;
    if (segmentKindFromRow(p) !== 'no_win' && !normalizeWheelLetter(String(p.label || ''))) return false;
  }
  return true;
}

function wheelConfigMessage(
  prizes: { rewardType: string; points: number; productId: string | null; label?: string }[]
): string | null {
  if (wheelConfigOk(prizes)) return null;
  return 'Wheel must have 9 slices: 2 green no-win, 5 fixed point prizes, 2 custom prizes. Use Reshuffle in Admin.';
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
async function findDefaultCustomProducts() {
  const usdt =
    (await prisma.product.findFirst({
      where: {
        inStock: true,
        OR: [
          { name: { contains: 'USDT', mode: 'insensitive' } },
          { name: { contains: 'usdt', mode: 'insensitive' } },
        ],
      },
      orderBy: { createdAt: 'asc' },
    })) ||
    (await prisma.product.findFirst({
      where: { type: 'crypto', inStock: true },
      orderBy: { priceUsd: 'asc' },
    }));

  const virtualCard =
    (await prisma.product.findFirst({
      where: { type: 'virtual-card', inStock: true },
      orderBy: { priceUsd: 'asc' },
    })) ||
    (await prisma.product.findFirst({
      where: {
        inStock: true,
        OR: [
          { name: { contains: 'virtual', mode: 'insensitive' } },
          { category: { contains: 'virtual', mode: 'insensitive' } },
        ],
      },
      orderBy: { priceUsd: 'asc' },
    }));

  return { usdt, virtualCard };
}

async function defaultCustomPrizeInputs(): Promise<
  Array<{ productId: string; prizeAmountUsd: number; letter: string; weight: number }>
> {
  const { usdt, virtualCard } = await findDefaultCustomProducts();
  const out: Array<{ productId: string; prizeAmountUsd: number; letter: string; weight: number }> = [];
  if (usdt) out.push({ productId: usdt.id, prizeAmountUsd: 1, letter: 'X', weight: WHEEL_WEIGHT_PRODUCT_EACH });
  if (virtualCard)
    out.push({ productId: virtualCard.id, prizeAmountUsd: 5, letter: 'Y', weight: WHEEL_WEIGHT_PRODUCT_EACH });
  while (out.length < 2) {
    const any = await prisma.product.findFirst({ where: { inStock: true } });
    if (!any) break;
    out.push({ productId: any.id, prizeAmountUsd: 1, letter: 'Z', weight: WHEEL_WEIGHT_PRODUCT_EACH });
  }
  return out.slice(0, 2);
}

function customInputsFromExisting(
  rows: Array<{
    rewardType: string;
    points: number;
    productId: string | null;
    prizeAmountUsd: number | null;
    label: string;
    weight: number;
  }>
): Array<{ productId: string; prizeAmountUsd: number; letter: string; weight: number }> {
  const custom = rows.filter((r) => segmentKindFromRow(r) === 'custom' && r.productId);
  if (custom.length >= 2) {
    return custom.slice(0, 2).map((r) => ({
      productId: r.productId!,
      prizeAmountUsd: r.prizeAmountUsd != null && r.prizeAmountUsd > 0 ? Number(r.prizeAmountUsd) : 1,
      letter: normalizeWheelLetter(r.label) || 'P',
      weight: r.weight,
    }));
  }
  return [];
}

async function persistWheelLayout(segments: WheelSegmentDraft[]) {
  await prisma.spinPrize.deleteMany();
  await prisma.spinPrize.createMany({
    data: segments.map((s) => ({
      label: s.label,
      rewardType: s.rewardType,
      points: s.points,
      productId: s.productId,
      prizeAmountUsd: s.prizeAmountUsd,
      weight: s.weight,
      sortOrder: s.sortOrder,
      active: true,
    })),
  });
}

async function applyNineSectorTemplate() {
  const existing = await prisma.spinPrize.findMany({ where: { active: true } });
  let custom = customInputsFromExisting(existing);
  if (custom.length < 2) {
    const defaults = await defaultCustomPrizeInputs();
    custom = [...custom, ...defaults].slice(0, 2);
  }
  const layout = buildNineSliceLayout(custom);
  await persistWheelLayout(layout);
}

async function syncWheelWeightsAndNPrize(
  rows: Array<{ id: string; rewardType: string; points: number; productId: string | null; label: string }>
) {
  for (const row of rows) {
    const kind = segmentKindFromRow(row);
    const label = normalizeWheelLetter(row.label);
    if (kind === 'no_win') {
      await prisma.spinPrize.update({
        where: { id: row.id },
        data: { weight: WHEEL_WEIGHT_NO_WIN_EACH, label: '' },
      });
    } else if (kind === 'custom') {
      await prisma.spinPrize.update({
        where: { id: row.id },
        data: { weight: WHEEL_WEIGHT_PRODUCT_EACH },
      });
    } else if (kind === 'points_fixed') {
      await prisma.spinPrize.update({
        where: { id: row.id },
        data: {
          weight: WHEEL_WEIGHT_POINTS_EACH,
          ...(label === N_SLICE_LETTER ? { points: N_SLICE_POINTS } : {}),
        },
      });
    }
  }
}

async function ensureNineSliceWheel() {
  const rows = await prisma.spinPrize.findMany({ where: { active: true } });
  if (!wheelConfigOk(rows)) {
    await applyNineSectorTemplate();
    return;
  }
  await syncWheelWeightsAndNPrize(rows);
}

async function loadActivePrizes() {
  await ensureNineSliceWheel();
  return prisma.spinPrize.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    include: {
      product: { select: { id: true, name: true, type: true, category: true, priceUsd: true, image: true } },
    },
  });
}

type PrizeRow = Awaited<ReturnType<typeof loadActivePrizes>>[number];

function mapPrizeForAdmin(p: PrizeRow) {
  const kind = segmentKindFromRow(p);
  return {
    ...p,
    segmentKind: kind,
    editable: kind === 'custom',
    locked: kind !== 'custom',
    fixedPointsValues: kind === 'points_fixed' ? [...FIXED_TCONNECT_POINTS] : undefined,
  };
}

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
      sectorCount: WHEEL_SECTOR_COUNT,
      complete: wheelConfigOk(prizes),
      configMessage: wheelConfigMessage(prizes),
      fixedPoints: [...FIXED_TCONNECT_POINTS],
    });
  } catch (e: unknown) {
    return res.status(500).json({ error: formatSpinRouteError(e) || 'Failed to load wheel' });
  }
});

/** Reshuffle green positions + prize letters; keeps your 2 custom products if set. */
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
      // TS may not narrow spinNotif fully, so cast to object for the spread.
      await createUserNotification({ userId: user.id, ...(spinNotif as Omit<UserNotificationPayload, 'userId'>) });
    }

    const slotIndex = prizes.findIndex((p) => p.id === prize.id);
    return res.json({
      rewardId: prize.id,
      slotIndex: slotIndex >= 0 ? slotIndex : prize.sortOrder,
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
    return res.json(prizes.map((p) => mapPrizeForAdmin(p)));
  } catch (e: unknown) {
    return res.status(500).json({ error: formatSpinRouteError(e) || 'Failed to load prizes' });
  }
});

router.post('/admin/prizes', basicAdminAuth, async (_req, res) => {
  return res.status(400).json({
    error: 'Wheel has a fixed 9-slice layout. Edit the 2 custom prizes only, or use Reshuffle wheel.',
  });
});

router.patch('/admin/prizes/:id', basicAdminAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const { label, rewardType, points, productId, prizeAmountUsd, weight, sortOrder, active } = req.body || {};

    const existing = await prisma.spinPrize.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Prize not found' });

    if (segmentKindFromRow(existing) !== 'custom') {
      return res.status(400).json({
        error: 'Only the 2 custom prize slices can be edited. Green and fixed point slices are locked.',
      });
    }

    const rt = rewardType !== undefined ? String(rewardType).trim() : existing.rewardType;
    if (!['points', 'product'].includes(rt)) {
      return res.status(400).json({ error: 'Custom slices must be Points or Product' });
    }

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
    if (label !== undefined) {
      labelData = normalizeWheelLetter(String(label));
      if (!labelData) return res.status(400).json({ error: 'Custom slice needs a letter (A–Z)' });
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
        active: active !== undefined ? Boolean(active) : undefined,
      },
      include: {
      product: { select: { id: true, name: true, type: true, category: true, priceUsd: true, image: true } },
    },
    });
    return res.json(mapPrizeForAdmin(updated));
  } catch (e: unknown) {
    return res.status(500).json({ error: formatSpinRouteError(e) || 'Failed to update prize' });
  }
});

router.delete('/admin/prizes/:id', basicAdminAuth, async (_req, res) => {
  return res.status(400).json({ error: 'Cannot delete wheel slices. Use Reshuffle wheel.' });
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
