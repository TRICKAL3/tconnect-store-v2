import { Request, Response, NextFunction } from 'express';

const ADMIN_PASS = process.env.ADMIN_PASS || '09090808pP#';

export function basicAdminAuth(req: Request, res: Response, next: NextFunction) {
  const xAdminPass = req.headers['x-admin-password'];
  const authHeader = req.headers.authorization || '';
  
  console.log('🔐 Admin auth check:', {
    hasXAdminPass: !!xAdminPass,
    hasAuthHeader: !!authHeader,
    authHeaderPrefix: authHeader.substring(0, 10)
  });
  
  // Check X-Admin-Password header first
  if (xAdminPass && typeof xAdminPass === 'string' && xAdminPass === ADMIN_PASS) {
    console.log('✅ Admin auth passed via X-Admin-Password');
    return next();
  }
  
  // Check Basic auth
  if (typeof authHeader === 'string' && authHeader.startsWith('Basic ')) {
    try {
      const decoded = Buffer.from(authHeader.replace('Basic ', ''), 'base64').toString('utf8');
      const pass = decoded; // Just password, no username
      if (pass === ADMIN_PASS) {
        console.log('✅ Admin auth passed via Basic auth');
        return next();
      }
      console.log('❌ Admin auth failed - password mismatch');
    } catch (e) {
      console.log('❌ Admin auth failed - decode error:', e);
    }
  }
  
  console.log('❌ Admin auth failed - unauthorized');
  return res.status(401).json({ error: 'Unauthorized' });
}

