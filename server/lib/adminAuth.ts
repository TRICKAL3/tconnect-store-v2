import { Request, Response, NextFunction } from 'express';

/** Resolved password matches env used across admin routes & notification admin checks. */
export function resolvedAdminPass(): string {
  return process.env.ADMIN_PASS || '09090808pP#';
}

/** Basic password header or Basic auth body matches admin secret (same logic as storefront admin). */
export function isAdminRequest(req: Pick<Request, 'headers'>): boolean {
  const xh = req.headers['x-admin-password'];
  const fromHeader =
    typeof xh === 'string'
      ? xh.trim()
      : Array.isArray(xh)
        ? String(xh[0] ?? '').trim()
        : '';
  let fromBasic = '';
  const auth = req.headers.authorization;
  if (typeof auth === 'string' && auth.startsWith('Basic ')) {
    fromBasic = Buffer.from(auth.replace('Basic ', ''), 'base64').toString('utf8').trim();
  }
  const candidate = fromHeader || fromBasic;
  return candidate !== '' && candidate === resolvedAdminPass();
}

export function basicAdminAuth(req: Request, res: Response, next: NextFunction): void | Response {
  if (isAdminRequest(req)) return next();
  console.log('❌ Admin auth failed — unauthorized');
  return res.status(401).json({ error: 'Unauthorized' });
}
