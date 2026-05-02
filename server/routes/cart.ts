import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { basicAdminAuth } from '../lib/adminAuth';
import { ensureUserCartSnapshotTable } from '../lib/ensureUserCartSnapshotTable';

const router = Router();

router.use(async (_req, _res, next) => {
  try {
    await ensureUserCartSnapshotTable(prisma);
    next();
  } catch (err: unknown) {
    next(err instanceof Error ? err : new Error(String(err)));
  }
});

function normEmail(e: string) {
  return e.trim().toLowerCase();
}

async function verifyUser(email: string, userDbId: string) {
  const row = await prisma.user.findUnique({ where: { id: String(userDbId) } });
  if (!row) return null;
  if (normEmail(row.email) !== normEmail(email)) return null;
  return row;
}

router.post('/sync', async (req, res) => {
  try {
    const { email, userDbId, items } = req.body || {};
    if (!email || !userDbId || !Array.isArray(items)) {
      return res.status(400).json({ error: 'email, userDbId, and items[] required' });
    }
    const user = await verifyUser(String(email), String(userDbId));
    if (!user) return res.status(403).json({ error: 'Invalid cart credentials' });

    if (items.length === 0) {
      await prisma.userCartSnapshot.deleteMany({ where: { userId: user.id } });
      return res.json({ ok: true, items: [] });
    }

    const itemsJson = JSON.stringify(items);
    await prisma.userCartSnapshot.upsert({
      where: { userId: user.id },
      create: { userId: user.id, itemsJson },
      update: { itemsJson },
    });
    return res.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'cart sync failed';
    return res.status(500).json({ error: msg });
  }
});

router.post('/load', async (req, res) => {
  try {
    const { email, userDbId } = req.body || {};
    if (!email || !userDbId) return res.status(400).json({ error: 'email and userDbId required' });
    const user = await verifyUser(String(email), String(userDbId));
    if (!user) return res.status(403).json({ error: 'Forbidden' });

    const snap = await prisma.userCartSnapshot.findUnique({ where: { userId: user.id } });
    if (!snap) return res.json({ items: [] });
    try {
      const parsed = JSON.parse(snap.itemsJson);
      return res.json({ items: Array.isArray(parsed) ? parsed : [] });
    } catch {
      return res.json({ items: [] });
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'cart load failed';
    return res.status(500).json({ error: msg });
  }
});

router.post('/clear', async (req, res) => {
  try {
    const { email, userDbId } = req.body || {};
    if (!email || !userDbId) return res.status(400).json({ error: 'email and userDbId required' });
    const user = await verifyUser(String(email), String(userDbId));
    if (!user) return res.status(403).json({ error: 'Forbidden' });
    await prisma.userCartSnapshot.deleteMany({ where: { userId: user.id } });
    return res.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'cart clear failed';
    return res.status(500).json({ error: msg });
  }
});

router.get('/admin/overview', basicAdminAuth, async (_req, res) => {
  try {
    const rows = await prisma.userCartSnapshot.findMany({
      orderBy: { updatedAt: 'desc' },
      include: { user: { select: { email: true, name: true } } },
    });
    const list = rows.map((r) => {
      let items: unknown[] = [];
      try {
        const p = JSON.parse(r.itemsJson);
        if (Array.isArray(p)) items = p;
      } catch {
        /* ignore */
      }
      const lines = items.filter((x): x is Record<string, unknown> => typeof x === 'object' && x !== null);
      const qty = lines.reduce((s, it) => s + (typeof it.quantity === 'number' ? it.quantity : 0), 0);
      return {
        snapshotId: r.id,
        userId: r.userId,
        email: r.user.email,
        name: r.user.name,
        updatedAt: r.updatedAt.toISOString(),
        lineCount: lines.length,
        totalUnits: qty,
        items,
      };
    });
    return res.json(list);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'admin cart list failed';
    return res.status(500).json({ error: msg });
  }
});

export default router;
