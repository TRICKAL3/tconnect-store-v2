import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { basicAdminAuth, isAdminRequest } from '../lib/adminAuth';
import { createUserNotification, createUserNotificationsBulk } from '../lib/userNotifications';

const router = Router();

/** Matches upsert/profile/cart — Firebase casing must not hide the User row. */
async function resolveUserIdByEmail(emailRaw: unknown): Promise<string | null> {
  if (!emailRaw || typeof emailRaw !== 'string') return null;
  const trimmed = emailRaw.trim();
  if (!trimmed) return null;
  const user = await prisma.user.findFirst({
    where: { email: { equals: trimmed, mode: 'insensitive' } },
    select: { id: true },
  });
  return user?.id ?? null;
}

// Get notifications for current user (or admin if userId is null)
router.get('/', async (req: any, res) => {
  try {
    const isAdmin = isAdminRequest(req);

    if (isAdmin) {
      const notifications = await prisma.notification.findMany({
        where: { userId: null },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
      return res.json(notifications);
    }

    let userId: string | null = null;

    if (req.user?.id) {
      userId = req.user.id;
    } else if (req.query.email) {
      userId = await resolveUserIdByEmail(String(req.query.email));
    }

    if (!userId) {
      return res.json([]);
    }

    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.json(notifications);
  } catch (error: any) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch notifications' });
  }
});

router.get('/unread-count', async (req: any, res) => {
  try {
    const isAdmin = isAdminRequest(req);

    if (isAdmin) {
      const count = await prisma.notification.count({
        where: { read: false, userId: null },
      });
      return res.json({ count });
    }

    let userId: string | null = null;
    if (req.user?.id) {
      userId = req.user.id;
    } else if (req.query.email) {
      userId = await resolveUserIdByEmail(String(req.query.email));
    }

    if (!userId) {
      return res.json({ count: 0 });
    }

    const count = await prisma.notification.count({
      where: { read: false, userId },
    });

    res.json({ count });
  } catch (error: any) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch unread count' });
  }
});

router.patch('/:id/read', async (req: any, res) => {
  try {
    const { id } = req.params;

    const isAdmin = isAdminRequest(req);

    const notification = await prisma.notification.findUnique({
      where: { id },
    });

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    if (isAdmin) {
      if (notification.userId !== null) {
        return res.status(403).json({ error: 'Unauthorized' });
      }
    } else {
      let userId: string | null = null;
      if (req.user?.id) {
        userId = req.user.id;
      } else if (req.body?.email) {
        userId = await resolveUserIdByEmail(String(req.body.email));
      }

      if (!userId || notification.userId !== userId) {
        return res.status(403).json({ error: 'Unauthorized' });
      }
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: { read: true },
    });

    res.json(updated);
  } catch (error: any) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: error.message || 'Failed to mark notification as read' });
  }
});

router.patch('/mark-all-read', async (req: any, res) => {
  try {
    const isAdmin = isAdminRequest(req);

    if (isAdmin) {
      await prisma.notification.updateMany({
        where: { read: false, userId: null },
        data: { read: true },
      });
      return res.json({ success: true });
    }

    let userId: string | null = null;
    if (req.user?.id) {
      userId = req.user.id;
    } else if (req.body?.email) {
      userId = await resolveUserIdByEmail(String(req.body.email));
    }

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await prisma.notification.updateMany({
      where: { read: false, userId },
      data: { read: true },
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error marking all as read:', error);
    res.status(500).json({ error: error.message || 'Failed to mark all as read' });
  }
});

// Create notification (admin) — supports sendToAll, userEmail (case-insensitive), or userId
router.post('/', basicAdminAuth, async (req: any, res) => {
  try {
    const { sendToAll, userId, userEmail, type, title, message, link } = req.body || {};

    if (!type || !title || !message) {
      return res.status(400).json({ error: 'type, title, and message are required' });
    }

    const linkVal = link ?? null;

    if (sendToAll === true || sendToAll === 'true') {
      const users = await prisma.user.findMany({ select: { id: true } });
      if (users.length === 0) {
        return res.json({ success: true, count: 0, message: 'No users in database' });
      }
      const bulk = await createUserNotificationsBulk(
        users.map((u) => u.id),
        {
          type: String(type),
          title: String(title),
          message: String(message),
          link: linkVal,
        }
      );
      return res.json({ success: true, count: bulk.count });
    }

    let targetUserId: string | null = typeof userId === 'string' && userId.trim() ? userId.trim() : null;

    if (!targetUserId && userEmail) {
      targetUserId = await resolveUserIdByEmail(String(userEmail));
      if (!targetUserId) {
        return res.status(404).json({ error: 'No user found with that email' });
      }
    }

    if (!targetUserId) {
      const notification = await prisma.notification.create({
        data: {
          userId: null,
          type: String(type),
          title: String(title),
          message: String(message),
          link: linkVal,
        },
      });
      return res.json(notification);
    }

    const notification = await createUserNotification({
      userId: targetUserId,
      type: String(type),
      title: String(title),
      message: String(message),
      link: linkVal,
    });

    res.json(notification);
  } catch (error: any) {
    console.error('Error creating notification:', error);
    res.status(500).json({ error: error.message || 'Failed to create notification' });
  }
});

export default router;
