import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { basicAdminAuth } from '../lib/adminAuth';

const router = Router();

// Get all invoices (Admin only)
router.get('/', basicAdminAuth, async (_req: any, res) => {
  try {
    const invoices = await prisma.invoice.findMany({ orderBy: { createdAt: 'desc' } });
    
    // Extract currency and rate from notes metadata for payment-transfer invoices
    const invoicesWithMetadata = invoices.map((invoice) => {
      if (invoice.serviceType === 'payment-transfer' && invoice.notes) {
        try {
          // Try to extract metadata from notes
          const metadataMatch = invoice.notes.match(/\[Metadata: ({.*?})\]/);
          if (metadataMatch) {
            const metadata = JSON.parse(metadataMatch[1]);
            return { ...invoice, currency: metadata.currency, rate: metadata.rate };
          }
        } catch (e) {
          // If parsing fails, try to get from items
          try {
            const items = typeof invoice.items === 'string' ? JSON.parse(invoice.items) : invoice.items || [];
            if (items.length > 0 && items[0].currency && items[0].rate) {
              return { ...invoice, currency: items[0].currency, rate: items[0].rate };
            }
          } catch (e2) {
            // Ignore errors
          }
        }
      }
      return invoice;
    });
    
    res.json(invoicesWithMetadata);
  } catch (error: any) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch invoices' });
  }
});

// Create invoice (Admin only)
router.post('/', basicAdminAuth, async (req: any, res) => {
  try {
    const { customer, email, serviceType, items, totalUsd, totalMwk, notes, currency, rate } = req.body;
    
    if (!customer || !email) {
      return res.status(400).json({ error: 'Customer name and email are required' });
    }
    
    // Store currency and rate in items metadata for payment-transfer invoices
    let itemsToStore = items;
    if (serviceType === 'payment-transfer' && currency && rate) {
      // Ensure currency and rate are stored in each item
      itemsToStore = Array.isArray(items) 
        ? items.map((item: any) => ({ ...item, currency, rate }))
        : items;
    }
    
    // Store currency and rate in notes as JSON for easy retrieval (in addition to items)
    let notesToStore = notes || null;
    if (serviceType === 'payment-transfer' && currency && rate) {
      const metadata = { currency, rate };
      notesToStore = notes 
        ? `${notes}\n\n[Metadata: ${JSON.stringify(metadata)}]`
        : `[Metadata: ${JSON.stringify(metadata)}]`;
    }
    
    const invoice = await prisma.invoice.create({
      data: {
        customer,
        email,
        serviceType: serviceType || 'giftcard',
        items: typeof itemsToStore === 'string' ? itemsToStore : JSON.stringify(itemsToStore || []),
        totalUsd: totalUsd || 0,
        totalMwk: totalMwk || 0,
        notes: notesToStore,
        status: 'pending'
      }
    });
    
    // Add currency and rate to response for easy access (even though not in DB schema)
    const invoiceResponse = {
      ...invoice,
      ...(serviceType === 'payment-transfer' && currency && rate ? { currency, rate } : {})
    };
    
    res.json(invoiceResponse);
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

