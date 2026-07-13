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

/** Stale installs skip `postinstall` / fail `generate` on Windows (EPERM) — delegates are then missing at runtime. */
const p = prisma as unknown as Record<string, { findMany?: unknown } | undefined>;
const requiredDelegates = [
  'userCartSnapshot',
  'spinPrize',
  'spinGrantLog',
  'spinProductWin',
] as const;
for (const name of requiredDelegates) {
  const d = p[name];
  if (!d || typeof d.findMany !== 'function') {
    throw new Error(
      `[Prisma] Client is stale or incomplete: missing model delegate "${name}".\n` +
        'In the backend folder (stop the API first):\n' +
        '  npx prisma generate\n' +
        '  npx prisma db push\n' +
        'If generate fails with EPERM on query_engine-windows.dll.node, close every Node/terminal using this project and retry.'
    );
  }
}


