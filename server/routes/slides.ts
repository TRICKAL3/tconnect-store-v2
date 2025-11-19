import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { basicAdminAuth } from '../lib/adminAuth';

const router = Router();

// Get all slides (public)
router.get('/', async (_req, res) => {
  const slides = await prisma.slide.findMany({ where: { active: true }, orderBy: { order: 'asc' } });
  res.json(slides);
});

// Admin: Get all slides (including inactive)
router.get('/all', basicAdminAuth, async (_req, res) => {
  const slides = await prisma.slide.findMany({ orderBy: { order: 'asc' } });
  res.json(slides);
});

// Admin: Create slide
router.post('/', basicAdminAuth, async (req: any, res) => {
  const slide = await prisma.slide.create({ data: req.body });
  res.json(slide);
});

// Admin: Update slide
router.put('/:id', basicAdminAuth, async (req: any, res) => {
  const slide = await prisma.slide.update({ where: { id: req.params.id }, data: req.body });
  res.json(slide);
});

// Admin: Delete slide
router.delete('/:id', basicAdminAuth, async (req: any, res) => {
  await prisma.slide.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

export default router;

