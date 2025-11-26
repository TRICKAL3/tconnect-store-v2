import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../lib/auth';
import { basicAdminAuth } from '../lib/adminAuth';

const router = Router();

// Get notifications for current user (or admin if userId is null)
// Supports both JWT auth and email query for users, basic auth for admin
router.get('/', async (req: any, res) => {
  try {
    // Check if admin (basic auth)
    const adminHeader = req.headers['x-admin-password'] || 
      (req.headers.authorization?.startsWith('Basic ') ? 
        Buffer.from(req.headers.authorization.replace('Basic ', ''), 'base64').toString('utf8') : null);
    const isAdmin = adminHeader === process.env.ADMIN_PASS;
    
    if (isAdmin) {
      // Admin gets notifications where userId is null
      const notifications = await prisma.notification.findMany({
        where: { userId: null },
        orderBy: { createdAt: 'desc' },
        take: 50
      });
      return res.json(notifications);
    }
    
    // For users: try JWT auth first, then email query
    let userId: string | null = null;
    
    if (req.user?.id) {
      userId = req.user.id;
    } else if (req.query.email) {
      const user = await prisma.user.findUnique({ 
        where: { email: String(req.query.email) } 
      });
      if (user) userId = user.id;
    }
    
    if (!userId) {
      return res.json([]); // Return empty array if no user found
    }
    
    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50
    });
    
    res.json(notifications);
  } catch (error: any) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch notifications' });
  }
});

// Get unread count
router.get('/unread-count', async (req: any, res) => {
  try {
    // Check if admin
    const adminHeader = req.headers['x-admin-password'] || 
      (req.headers.authorization?.startsWith('Basic ') ? 
        Buffer.from(req.headers.authorization.replace('Basic ', ''), 'base64').toString('utf8') : null);
    const isAdmin = adminHeader === process.env.ADMIN_PASS;
    
    if (isAdmin) {
      const count = await prisma.notification.count({
        where: { read: false, userId: null }
      });
      return res.json({ count });
    }
    
    // For users
    let userId: string | null = null;
    if (req.user?.id) {
      userId = req.user.id;
    } else if (req.query.email) {
      const user = await prisma.user.findUnique({ 
        where: { email: String(req.query.email) } 
      });
      if (user) userId = user.id;
    }
    
    if (!userId) {
      return res.json({ count: 0 });
    }
    
    const count = await prisma.notification.count({
      where: { read: false, userId }
    });
    
    res.json({ count });
  } catch (error: any) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch unread count' });
  }
});

// Mark notification as read
router.patch('/:id/read', async (req: any, res) => {
  try {
    const { id } = req.params;
    
    // Check if admin
    const adminHeader = req.headers['x-admin-password'] || 
      (req.headers.authorization?.startsWith('Basic ') ? 
        Buffer.from(req.headers.authorization.replace('Basic ', ''), 'base64').toString('utf8') : null);
    const isAdmin = adminHeader === process.env.ADMIN_PASS;
    
    // Verify notification belongs to user
    const notification = await prisma.notification.findUnique({
      where: { id }
    });
    
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    
    // Check ownership
    if (isAdmin) {
      if (notification.userId !== null) {
        return res.status(403).json({ error: 'Unauthorized' });
      }
    } else {
      let userId: string | null = null;
      if (req.user?.id) {
        userId = req.user.id;
      } else if (req.body.email) {
        const user = await prisma.user.findUnique({ 
          where: { email: String(req.body.email) } 
        });
        if (user) userId = user.id;
      }
      
      if (!userId || notification.userId !== userId) {
        return res.status(403).json({ error: 'Unauthorized' });
      }
    }
    
    const updated = await prisma.notification.update({
      where: { id },
      data: { read: true }
    });
    
    res.json(updated);
  } catch (error: any) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: error.message || 'Failed to mark notification as read' });
  }
});

// Mark all as read
router.patch('/mark-all-read', async (req: any, res) => {
  try {
    // Check if admin
    const adminHeader = req.headers['x-admin-password'] || 
      (req.headers.authorization?.startsWith('Basic ') ? 
        Buffer.from(req.headers.authorization.replace('Basic ', ''), 'base64').toString('utf8') : null);
    const isAdmin = adminHeader === process.env.ADMIN_PASS;
    
    if (isAdmin) {
      await prisma.notification.updateMany({
        where: { read: false, userId: null },
        data: { read: true }
      });
      return res.json({ success: true });
    }
    
    // For users
    let userId: string | null = null;
    if (req.user?.id) {
      userId = req.user.id;
    } else if (req.body.email) {
      const user = await prisma.user.findUnique({ 
        where: { email: String(req.body.email) } 
      });
      if (user) userId = user.id;
    }
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    await prisma.notification.updateMany({
      where: { read: false, userId },
      data: { read: true }
    });
    
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error marking all as read:', error);
    res.status(500).json({ error: error.message || 'Failed to mark all as read' });
  }
});

// Create notification (admin only - for manual notifications)
router.post('/', basicAdminAuth, async (req: any, res) => {
  try {
    const { userId, type, title, message, link } = req.body;
    
    const notification = await prisma.notification.create({
      data: {
        userId: userId || null, // null = admin notification
        type,
        title,
        message,
        link
      }
    });
    
    res.json(notification);
  } catch (error: any) {
    console.error('Error creating notification:', error);
    res.status(500).json({ error: error.message || 'Failed to create notification' });
  }
});

export default router;

