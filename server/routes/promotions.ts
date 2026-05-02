import { Router } from 'express';
import { basicAdminAuth } from '../lib/adminAuth';
import { prisma } from '../lib/prisma';

type PromotionType =
  | 'order_percent'
  | 'order_fixed'
  | 'category_percent'
  | 'category_fixed'
  | 'product_percent'
  | 'product_fixed'
  | 'buy_x_get_y';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    const promotions = await prisma.promotion.findMany({
      where: {
        active: true,
      },
      orderBy: { priority: 'desc' },
    });
    res.json(promotions);
  } catch (error: any) {
    console.error('Failed to load active promotions:', error);
    res.status(500).json({ error: 'Failed to load promotions' });
  }
});

router.get('/all', basicAdminAuth, async (_req, res) => {
  try {
    const promotions = await prisma.promotion.findMany({ orderBy: { priority: 'desc' } });
    res.json(promotions);
  } catch (error: any) {
    console.error('Failed to load promotions:', error);
    res.status(500).json({ error: 'Failed to load promotions' });
  }
});

router.post('/', basicAdminAuth, async (req, res) => {
  try {
    const body = req.body || {};
    if (!body.name || !body.type) return res.status(400).json({ error: 'name and type are required' });
    const record = await prisma.promotion.create({
      data: {
        name: String(body.name),
        description: body.description ? String(body.description) : undefined,
        type: String(body.type),
        active: body.active !== false,
        code: body.code ? String(body.code) : undefined,
        startsAt: body.startsAt ? new Date(String(body.startsAt)) : undefined,
        endsAt: body.endsAt ? new Date(String(body.endsAt)) : undefined,
        minOrderUsd: Number(body.minOrderUsd) || undefined,
        discountPercent: Number(body.discountPercent) || undefined,
        discountUsd: Number(body.discountUsd) || undefined,
        maxDiscountUsd: Number(body.maxDiscountUsd) || undefined,
        appliesToCategory: body.appliesToCategory ? String(body.appliesToCategory) : undefined,
        appliesToProductId: body.appliesToProductId ? String(body.appliesToProductId) : undefined,
        appliesToProductType: body.appliesToProductType ? String(body.appliesToProductType) : undefined,
        buyQuantity: Number(body.buyQuantity) || undefined,
        getQuantity: Number(body.getQuantity) || undefined,
        stackable: Boolean(body.stackable),
        priority: Number(body.priority) || 0,
      },
    });
    res.status(201).json(record);
  } catch (error: any) {
    console.error('Failed to create promotion:', error);
    res.status(500).json({ error: 'Failed to create promotion' });
  }
});

router.put('/:id', basicAdminAuth, async (req, res) => {
  try {
    const body = req.body || {};
    const next = await prisma.promotion.update({
      where: { id: req.params.id },
      data: {
        ...(body.name !== undefined ? { name: String(body.name) } : {}),
        ...(body.description !== undefined ? { description: body.description ? String(body.description) : null } : {}),
        ...(body.type !== undefined ? { type: String(body.type) } : {}),
        ...(body.active !== undefined ? { active: Boolean(body.active) } : {}),
        ...(body.code !== undefined ? { code: body.code ? String(body.code) : null } : {}),
        ...(body.startsAt !== undefined ? { startsAt: body.startsAt ? new Date(String(body.startsAt)) : null } : {}),
        ...(body.endsAt !== undefined ? { endsAt: body.endsAt ? new Date(String(body.endsAt)) : null } : {}),
        ...(body.minOrderUsd !== undefined ? { minOrderUsd: body.minOrderUsd === '' ? null : Number(body.minOrderUsd) || null } : {}),
        ...(body.discountPercent !== undefined ? { discountPercent: body.discountPercent === '' ? null : Number(body.discountPercent) || null } : {}),
        ...(body.discountUsd !== undefined ? { discountUsd: body.discountUsd === '' ? null : Number(body.discountUsd) || null } : {}),
        ...(body.maxDiscountUsd !== undefined ? { maxDiscountUsd: body.maxDiscountUsd === '' ? null : Number(body.maxDiscountUsd) || null } : {}),
        ...(body.appliesToCategory !== undefined ? { appliesToCategory: body.appliesToCategory ? String(body.appliesToCategory) : null } : {}),
        ...(body.appliesToProductId !== undefined ? { appliesToProductId: body.appliesToProductId ? String(body.appliesToProductId) : null } : {}),
        ...(body.appliesToProductType !== undefined ? { appliesToProductType: body.appliesToProductType ? String(body.appliesToProductType) : null } : {}),
        ...(body.buyQuantity !== undefined ? { buyQuantity: body.buyQuantity === '' ? null : Number(body.buyQuantity) || null } : {}),
        ...(body.getQuantity !== undefined ? { getQuantity: body.getQuantity === '' ? null : Number(body.getQuantity) || null } : {}),
        ...(body.stackable !== undefined ? { stackable: Boolean(body.stackable) } : {}),
        ...(body.priority !== undefined ? { priority: Number(body.priority) || 0 } : {}),
      },
    });
    res.json(next);
  } catch (error: any) {
    if (error?.code === 'P2025') return res.status(404).json({ error: 'Promotion not found' });
    console.error('Failed to update promotion:', error);
    res.status(500).json({ error: 'Failed to update promotion' });
  }
});

router.delete('/:id', basicAdminAuth, async (req, res) => {
  try {
    await prisma.promotion.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error: any) {
    if (error?.code === 'P2025') return res.status(404).json({ error: 'Promotion not found' });
    console.error('Failed to delete promotion:', error);
    res.status(500).json({ error: 'Failed to delete promotion' });
  }
});

export default router;
