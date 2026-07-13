import { prisma } from './prisma';
import { createUserNotification } from './userNotifications';

const SPIN_BONUS_NOTIFY = 'spin_bonus';

export const UTILITY_BILL_SPIN_BONUS = 2;

export async function grantBonusSpins(
  userId: string,
  spins: number,
  notification: { title: string; message: string; link?: string },
  idempotencyMessageContains?: string
): Promise<{ granted: boolean }> {
  if (!userId || spins < 1) return { granted: false };

  if (idempotencyMessageContains) {
    const existing = await prisma.notification.findFirst({
      where: {
        userId,
        type: SPIN_BONUS_NOTIFY,
        message: { contains: idempotencyMessageContains },
      },
    });
    if (existing) return { granted: false };
  }

  await prisma.spinGrantLog.create({ data: { userId, spins } });
  await createUserNotification({
    userId,
    type: SPIN_BONUS_NOTIFY,
    title: notification.title,
    message: notification.message,
    link: notification.link ?? '/spin',
    read: false,
  });
  return { granted: true };
}

export async function grantUtilityBillSpinBonus(userId: string, orderId: string): Promise<void> {
  const orderTag = `#${orderId.substring(0, 8)}`;
  await grantBonusSpins(
    userId,
    UTILITY_BILL_SPIN_BONUS,
    {
      title: 'Bonus spins for utility bill',
      message: `You received ${UTILITY_BILL_SPIN_BONUS} bonus spins for paying a utility bill (${orderTag}). Open Spin to Win to use them.`,
      link: '/spin',
    },
    orderTag
  );
}
