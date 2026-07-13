import type { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { sendUserNotificationEmail } from './email';

/** Rich HTML order emails already cover these types — avoid duplicate mail. */
const SKIP_EMAIL_TYPES = new Set(['order_confirmed', 'order_rejected', 'order_fulfilled']);

export type UserNotificationPayload = {
  userId: string;
  type: string;
  title: string;
  message: string;
  link?: string | null;
  read?: boolean;
};

async function emailForUser(userId: string, payload: Omit<UserNotificationPayload, 'userId'>) {
  if (SKIP_EMAIL_TYPES.has(payload.type)) return;
  if (process.env.USER_EMAIL_NOTIFICATIONS === 'false') return;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true },
  });
  if (!user?.email) return;

  await sendUserNotificationEmail({
    userEmail: user.email,
    userName: user.name,
    title: payload.title,
    message: payload.message,
    link: payload.link,
    type: payload.type,
  });
}

/** In-app notification + email (when SMTP enabled and type is not skipped). */
export async function createUserNotification(
  data: UserNotificationPayload,
  opts?: { tx?: Prisma.TransactionClient }
) {
  const client = opts?.tx ?? prisma;
  const notification = await client.notification.create({
    data: {
      userId: data.userId,
      type: data.type,
      title: data.title,
      message: data.message,
      link: data.link ?? null,
      read: data.read ?? false,
    },
  });

  if (!opts?.tx) {
    await emailForUser(data.userId, data);
  }

  return notification;
}

/** Email only — use after a transaction that already created the in-app row. */
export async function emitUserNotificationEmail(
  userId: string,
  payload: Omit<UserNotificationPayload, 'userId'>
) {
  await emailForUser(userId, payload);
}

/** Broadcast to many users (admin promos, announcements). */
export async function createUserNotificationsBulk(
  userIds: string[],
  payload: Omit<UserNotificationPayload, 'userId' | 'read'>
) {
  if (userIds.length === 0) return { count: 0 };

  await prisma.notification.createMany({
    data: userIds.map((userId) => ({
      userId,
      type: payload.type,
      title: payload.title,
      message: payload.message,
      link: payload.link ?? null,
      read: false,
    })),
  });

  if (!SKIP_EMAIL_TYPES.has(payload.type) && process.env.USER_EMAIL_NOTIFICATIONS !== 'false') {
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { email: true, name: true },
    });
    for (const user of users) {
      if (!user.email) continue;
      await sendUserNotificationEmail({
        userEmail: user.email,
        userName: user.name,
        title: payload.title,
        message: payload.message,
        link: payload.link,
        type: payload.type,
      });
    }
  }

  return { count: userIds.length };
}
