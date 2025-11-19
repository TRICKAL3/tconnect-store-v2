import express, { Request, Response } from 'express';
import cors from 'cors';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import authRouter from '../server/routes/auth';
import productsRouter from '../server/routes/products';
import ordersRouter from '../server/routes/orders';
import ratesRouter from '../server/routes/rates';
import invoicesRouter from '../server/routes/invoices';
import quotesRouter from '../server/routes/quotes';
import usersRouter from '../server/routes/users';
import slidesRouter from '../server/routes/slides';
import ttOrdersRouter from '../server/routes/ttorders';
import chatsRouter from '../server/routes/chats';

const app = express();

// CORS configuration - allow all origins
app.use(cors({
  origin: '*',
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

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// API routes
// Add logging middleware to see what routes are being hit
app.use((req, res, next) => {
  console.log(`📡 API Request: ${req.method} ${req.path}`);
  next();
});

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
    chats: '/chats'
  }
}));

// Export for Vercel serverless functions
// Use handler function format for Vercel
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    console.log('🚀 API Handler called:', req.method, req.url);
    return app(req, res);
  } catch (error: any) {
    console.error('❌ Handler error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
