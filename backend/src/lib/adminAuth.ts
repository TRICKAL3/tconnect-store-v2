import { Request, Response, NextFunction } from 'express';

const ADMIN_PASS = process.env.ADMIN_PASS || '09090808pP#';

export function basicAdminAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Basic ')) return res.status(401).json({ error: 'Unauthorized' });
  const decoded = Buffer.from(header.replace('Basic ', ''), 'base64').toString('utf8');
  const pass = decoded; // Just password, no username
  if (pass === ADMIN_PASS) return next();
  return res.status(401).json({ error: 'Unauthorized' });
}


