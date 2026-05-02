import { Request, Response, NextFunction } from 'express';

/** Same fallback as env example — MUST match storefront admin login. */
export function resolvedAdminPass(): string {
  return process.env.ADMIN_PASS || '09090808pP#';
}

/** True if Basic `password-only` body or raw `x-admin-password` matches server admin secret. */
export function isAdminRequest(req: Pick<Request, 'headers'>): boolean {
  const xh = req.headers['x-admin-password'];
  const fromHeader =
    typeof xh === 'string' ? xh.trim() : Array.isArray(xh) ? String(xh[0] ?? '').trim() : '';
  let fromBasic = '';
  const auth = req.headers.authorization;
  if (typeof auth === 'string' && auth.startsWith('Basic ')) {
    fromBasic = Buffer.from(auth.replace('Basic ', ''), 'base64').toString('utf8').trim();
  }
  const candidate = fromHeader || fromBasic;
  return candidate !== '' && candidate === resolvedAdminPass();
}

export function basicAdminAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Basic ')) return res.status(401).json({ error: 'Unauthorized' });
  const decoded = Buffer.from(header.replace('Basic ', ''), 'base64').toString('utf8');
  const pass = decoded.trim();
  if (pass === resolvedAdminPass()) return next();
  return res.status(401).json({ error: 'Unauthorized' });
}


