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
import notificationsRouter from '../server/routes/notifications';

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
app.use('/notifications', notificationsRouter);

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
    notifications: '/notifications'
  }
}));

// Export for Vercel serverless functions
// Use handler function format for Vercel
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Extract path from Vercel's catch-all route
    // When /api/products is requested, Vercel passes it as req.query.path
    // The rewrite rule "/api/(.*)" -> "/api/[...path]" captures the path after /api/
    
    let path = '/';
    
    // Check if path is in query params (catch-all route)
    if (req.query.path) {
      if (Array.isArray(req.query.path)) {
        path = '/' + req.query.path.join('/');
      } else {
        path = '/' + req.query.path;
      }
    } else if (req.url) {
      // Fallback: extract from URL if query param not available
      // Remove /api prefix if present
      path = req.url.startsWith('/api') ? req.url.slice(4) : req.url;
      // Remove query string if present
      const queryIndex = path.indexOf('?');
      if (queryIndex > -1) {
        path = path.substring(0, queryIndex);
      }
    }
    
    // Ensure path starts with /
    if (!path.startsWith('/')) {
      path = '/' + path;
    }
    
    // Preserve query string if present
    // Vercel already parses query params into req.query, so we need to preserve them
    let originalQuery = '';
    
    // Check if there are query params (excluding 'path' which is the catch-all param)
    const queryKeys = Object.keys(req.query || {}).filter(key => key !== 'path');
    if (queryKeys.length > 0) {
      // Build query string from existing query params
      const queryParts: string[] = [];
      queryKeys.forEach(key => {
        const value = req.query[key];
        if (Array.isArray(value)) {
          value.forEach(v => queryParts.push(`${key}=${encodeURIComponent(String(v))}`));
        } else if (value !== undefined && value !== null) {
          queryParts.push(`${key}=${encodeURIComponent(String(value))}`);
        }
      });
      originalQuery = queryParts.join('&');
    }
    
    const fullPath = originalQuery ? `${path}?${originalQuery}` : path;
    
    // Update the request URL and path to match what Express expects
    // Type assertion needed because Express Request expects string
    (req as any).url = fullPath;
    (req as any).path = path;
    
    console.log('🚀 API Handler called:', {
      method: req.method,
      originalUrl: req.url,
      path: path,
      fullPath: fullPath,
      query: req.query,
      queryPath: req.query.path
    });
    
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
