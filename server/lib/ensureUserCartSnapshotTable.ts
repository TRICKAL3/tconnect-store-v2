import type { PrismaClient } from '@prisma/client';

let shared: Promise<void> | undefined;

/** Postgres: ensure `public.user_cart_snapshots` exists for this DATABASE_URL */
export function ensureUserCartSnapshotTable(prisma: PrismaClient): Promise<void> {
  const url = process.env.DATABASE_URL || '';

  if (url.startsWith('file:')) {
    console.warn('[cart] user_cart_snapshots: skipped (SQLite). Use Postgres.');
    shared = Promise.resolve();
    return shared;
  }

  if (!shared) {
    shared = runEnsures(prisma).catch((err: unknown) => {
      shared = undefined;
      throw err;
    });
  }
  return shared;
}

async function runEnsures(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe(`
CREATE TABLE IF NOT EXISTS public.user_cart_snapshots (
  id         TEXT NOT NULL PRIMARY KEY,
  user_id    TEXT NOT NULL UNIQUE,
  items_json TEXT NOT NULL,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`);

  await prisma.$executeRawUnsafe(`
ALTER TABLE public.user_cart_snapshots DROP CONSTRAINT IF EXISTS user_cart_snapshots_user_id_fkey;
`);

  try {
    await prisma.$executeRawUnsafe(`
ALTER TABLE public.user_cart_snapshots
  ADD CONSTRAINT user_cart_snapshots_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES public."User"(id)
  ON UPDATE CASCADE
  ON DELETE CASCADE;
`);
  } catch {
    console.warn('[cart] user_cart_snapshots: FK reconcile skipped if already OK.');
  }

  console.log('[cart] user_cart_snapshots table ready');
}
