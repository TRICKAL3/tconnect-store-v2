import { PrismaClient } from '@prisma/client';

// Prisma Client singleton for serverless (Vercel)
// Prevents creating multiple connections
const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

const p = prisma as unknown as Record<string, { findMany?: unknown } | undefined>;
for (const name of ['spinPrize', 'spinGrantLog', 'spinProductWin'] as const) {
  const d = p[name];
  if (!d || typeof d.findMany !== 'function') {
    throw new Error(
      `[Prisma] Generated client missing "${name}". From repo root run: npx prisma generate (then redeploy).`
    );
  }
}

