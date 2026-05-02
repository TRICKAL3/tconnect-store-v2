import { PrismaClient } from '@prisma/client';

// Env must be loaded via `import '../loadEnv'` (or `./loadEnv` from index) before this module imports.

/**
 * Resolve `@prisma/client` from `backend/node_modules` when the API runs with `npm --prefix backend`.
 */
export const prisma = new PrismaClient({
  datasources: {
    db: { url: process.env.DATABASE_URL },
  },
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});

/** Stale installs often skip `postinstall`; then `userCartSnapshot` is undefined and routes throw "reading 'findMany'". */
const cartDelegate = (prisma as unknown as Record<string, { findMany?: unknown } | undefined>).userCartSnapshot;
if (!cartDelegate || typeof cartDelegate.findMany !== 'function') {
  throw new Error(
    '[Prisma] Client is stale: missing model UserCartSnapshot. From the folder that contains package.json:\n' +
      '  1) Stop the API (and any other Node processes using this repo).\n' +
      '  2) npx prisma generate\n' +
      '  3) npx prisma db push\n' +
      'If step 2 fails with EPERM on Windows, disable locking on the folder or retry after closing the IDE terminals.'
  );
}


