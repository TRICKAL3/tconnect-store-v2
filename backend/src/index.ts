import './loadEnv';
import express from 'express';
import cors from 'cors';
import authRouter from './routes/auth';
import productsRouter from './routes/products';
import ordersRouter from './routes/orders';
import ratesRouter from './routes/rates';
import invoicesRouter from './routes/invoices';
import quotesRouter from './routes/quotes';
import usersRouter from './routes/users';
import slidesRouter from './routes/slides';
import ttOrdersRouter from './routes/ttorders';
import chatsRouter from './routes/chats';
import notificationsRouter from './routes/notifications';
import promotionsRouter from './routes/promotions';
import blogsRouter from './routes/blogs';
import paymentsRouter from './routes/payments';
import cartRouter from './routes/cart';
import { prisma } from './lib/prisma';
import { ensureUserCartSnapshotTable } from './lib/ensureUserCartSnapshotTable';

/** Safe log so you can confirm the API sees the same DB as Supabase (no passwords). */
function databaseHostLabel(databaseUrl: string): string {
  if (!databaseUrl) return '(DATABASE_URL missing)';
  if (databaseUrl.startsWith('file:')) return 'SQLite file URL';
  try {
    const normalized = databaseUrl.replace(/^postgresql:\/\//i, 'http://').replace(/^postgres:\/\//i, 'http://');
    const u = new URL(normalized);
    return `${u.hostname}${u.port ? `:${u.port}` : ''}`;
  } catch {
    return '(unparseable DATABASE_URL)';
  }
}

const app = express();

// CORS configuration - allow all origins for now (can be restricted later)
app.use(cors({
  origin: '*', // Allow all origins
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Admin-Password'],
  credentials: false
}));

app.use(express.json());

// Handle CORS preflight requests
app.options('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Password');
  res.sendStatus(200);
});

// Root route
app.get('/', (_req, res) => res.json({ 
  message: 'TConnect Store API v2.0',
  status: 'running',
  endpoints: {
    health: '/health',
    auth: '/auth',
    products: '/products',
    orders: '/orders',
    rates: '/rates',
    invoices: '/invoices',
    quotes: '/quotes',
    users: '/users',
    slides: '/slides',
    ttorders: '/ttorders',
    chats: '/chats',
    notifications: '/notifications',
    blogs: '/blogs',
    payments: '/payments'
  }
}));

app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/auth', authRouter);
app.use('/products', productsRouter);
app.use('/orders', ordersRouter);
app.use('/rates', ratesRouter);
app.use('/invoices', invoicesRouter);
app.use('/quotes', quotesRouter);
app.use('/users', usersRouter);
app.use('/slides', slidesRouter);
app.use('/ttorders', ttOrdersRouter);
app.use('/chats', chatsRouter);
app.use('/notifications', notificationsRouter);
app.use('/promotions', promotionsRouter);
app.use('/blogs', blogsRouter);
app.use('/payments', paymentsRouter);
app.use('/cart', cartRouter);

// Export for Vercel serverless functions
// Vercel needs the app exported as default
export default app;

// Also export as handler for compatibility
export const handler = app;

// For Vercel, we need to handle the request properly
// The app will be used by @vercel/node automatically

// Local: confirm DB before listening (live Neon = DATABASE_URL in backend/.env).
if (process.env.VERCEL !== '1') {
  const port = Number(process.env.API_PORT || process.env.BACKEND_PORT || process.env.PORT || 4001);

  prisma
    .$connect()
    .then(async () => {
      const url = process.env.DATABASE_URL || '';
      const host = databaseHostLabel(url);
      const kind = url.includes('neon.tech')
        ? 'Neon'
        : url.includes('supabase.co')
          ? 'Supabase'
          : url.startsWith('file:')
            ? 'SQLite'
            : url
              ? 'Postgres'
              : 'unknown';
      console.log(`✅ Database connected — ${kind} @ ${host}`);
      await ensureUserCartSnapshotTable(prisma).catch((err: unknown) =>
        console.warn('[cart] could not prepare user_cart_snapshots yet:', err instanceof Error ? err.message : err)
      );
      app.listen(port, () => {
        console.log(`🚀 API http://localhost:${port} · frontend → REACT_APP_API_BASE=http://127.0.0.1:${port}`);
      });
    })
    .catch((err: Error) => {
      console.error('❌ DATABASE_URL failed — set DATABASE_URL in root .env or backend/.env:', err.message);
      process.exit(1);
    });
}


