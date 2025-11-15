import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { basicAdminAuth } from '../lib/adminAuth';

const router = Router();

// Get all invoices (Admin only)
router.get('/', basicAdminAuth, async (_req: any, res) => {
  try {
    const invoices = await prisma.invoice.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(invoices);
  } catch (error: any) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch invoices' });
  }
});

// Create invoice (Admin only)
router.post('/', basicAdminAuth, async (req: any, res) => {
  try {
    const { customer, email, serviceType, items, totalUsd, totalMwk, notes } = req.body;
    
    if (!customer || !email) {
      return res.status(400).json({ error: 'Customer name and email are required' });
    }
    
    const invoice = await prisma.invoice.create({
      data: {
        customer,
        email,
        serviceType: serviceType || 'giftcard',
        items: typeof items === 'string' ? items : JSON.stringify(items || []),
        totalUsd: totalUsd || 0,
        totalMwk: totalMwk || 0,
        notes: notes || null,
        status: 'pending'
      }
    });
    
    res.json(invoice);
  } catch (error: any) {
    console.error('Error creating invoice:', error);
    res.status(500).json({ error: error.message || 'Failed to create invoice' });
  }
});

// Update invoice (Admin only)
router.patch('/:id', basicAdminAuth, async (req: any, res) => {
  try {
    const invoice = await prisma.invoice.update({
      where: { id: req.params.id },
      data: req.body
    });
    res.json(invoice);
  } catch (error: any) {
    console.error('Error updating invoice:', error);
    res.status(500).json({ error: error.message || 'Failed to update invoice' });
  }
});

export default router;


