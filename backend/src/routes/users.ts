import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { basicAdminAuth } from '../lib/adminAuth';

const router = Router();

router.get('/', basicAdminAuth, async (_req, res) => {
  const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' }, select: { id: true, email: true, name: true, role: true } });
  res.json(users);
});

router.get('/profile', async (req, res) => {
  const email = (req.query.email as string)?.trim();
  if (!email) return res.status(400).json({ error: 'email required' });
  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    select: { id: true, email: true, name: true, avatarUrl: true, pointsBalance: true },
  });
  if (!user) return res.status(404).json({ error: 'user not found' });
  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    pointsBalance: user.pointsBalance ?? 0,
  });
});

router.patch('/:id', basicAdminAuth, async (req, res) => {
  const user = await prisma.user.update({ where: { id: req.params.id }, data: req.body });
  res.json({ id: user.id, email: user.email, name: user.name, role: user.role });
});

router.post('/upsert', async (req, res) => {
  try {
    console.log('=== UPSERT REQUEST RECEIVED ===');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    console.log('Request headers:', req.headers);
    
    const { email, name, avatarUrl } = req.body || {};
    if (!email) {
      console.error('❌ Upsert user: email required');
      return res.status(400).json({ error: 'email required' });
    }
    
    console.log('📝 Upserting user:', { email, name, avatarUrl });
    
    try {
      const raw = String(email).trim();
      if (!raw) {
        console.error('❌ Upsert user: blank email');
        return res.status(400).json({ error: 'email required' });
      }

      // Case-sensitive unique(email) caused duplicate Users when Firebase casing != DB casing;
      // cart sync rejects wrong userDbId and carts never persist.
      const existing = await prisma.user.findFirst({
        where: { email: { equals: raw, mode: 'insensitive' } },
      });

      let up;
      if (existing) {
        up = await prisma.user.update({
          where: { id: existing.id },
          data: {
            name: name || undefined,
            avatarUrl: avatarUrl || undefined,
          },
        });
      } else {
        up = await prisma.user.create({
          data: {
            email: raw.toLowerCase(),
            name: name || 'User',
            password: null,
            avatarUrl,
          },
        });
      }
      
      console.log('✅ User upserted successfully:', { 
        id: up.id, 
        email: up.email, 
        name: up.name,
        role: up.role 
      });
      res.json({ id: up.id, email: up.email, name: up.name, avatarUrl: up.avatarUrl, role: up.role });
    } catch (dbError: any) {
      console.error('❌ Database error during upsert:', {
        error: dbError.message,
        code: dbError.code,
        meta: dbError.meta,
        stack: dbError.stack
      });
      throw dbError;
    }
  } catch (error: any) {
    console.error('❌ Error upserting user:', {
      error: error.message,
      code: error.code,
      meta: error.meta,
      stack: error.stack
    });
    res.status(500).json({ 
      error: error.message || 'Failed to upsert user',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

router.delete('/:id', basicAdminAuth, async (req, res) => {
  await prisma.user.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

export default router;


