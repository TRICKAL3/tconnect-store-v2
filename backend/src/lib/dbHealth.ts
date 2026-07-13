import { prisma } from './prisma';

export function databaseHostLabel(databaseUrl: string): string {
  if (!databaseUrl) return '(DATABASE_URL missing)';
  if (databaseUrl.startsWith('file:')) return 'SQLite file URL';
  try {
    const normalized = databaseUrl
      .replace(/^postgresql:\/\//i, 'http://')
      .replace(/^postgres:\/\//i, 'http://');
    const u = new URL(normalized);
    return `${u.hostname}${u.port ? `:${u.port}` : ''}`;
  } catch {
    return '(unparseable DATABASE_URL)';
  }
}

export function databaseKind(databaseUrl: string): string {
  if (!databaseUrl) return 'missing';
  if (databaseUrl.startsWith('file:')) return 'SQLite';
  if (databaseUrl.includes('neon.tech')) return 'Neon';
  if (databaseUrl.includes('supabase.co')) return 'Supabase';
  return 'Postgres';
}

/** Health payload so you can confirm the API uses your live Neon DB (same as Vercel). */
export async function getDatabaseHealthPayload() {
  const url = String(process.env.DATABASE_URL || '').trim();
  const host = databaseHostLabel(url);
  const kind = databaseKind(url);

  if (!url) {
    return {
      status: 'error',
      database: { connected: false, kind, host, message: 'DATABASE_URL is not set' },
    };
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
    const [orders, products, users] = await Promise.all([
      prisma.order.count(),
      prisma.product.count(),
      prisma.user.count(),
    ]);
    return {
      status: 'ok',
      database: {
        connected: true,
        kind,
        host,
        orders,
        products,
        users,
      },
      hint:
        kind === 'Neon'
          ? 'This API is using your live Neon database. Admin/shop data should match Neon console.'
          : 'Using Postgres. Set DATABASE_URL in backend/.env to your Neon URL for production data.',
    };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Database connection failed';
    return {
      status: 'error',
      database: { connected: false, kind, host, message },
    };
  }
}
