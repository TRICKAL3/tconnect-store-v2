import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

export interface JwtUser {
  id: string;
  email: string;
  role: string;
}

export function signToken(payload: JwtUser): string {
  const secret = process.env.JWT_SECRET || 'dev-secret';
  return jwt.sign(payload, secret, { expiresIn: '7d' });
}

export function authMiddleware(req: Request & { user?: JwtUser }, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'Unauthorized' });
  const token = header.replace('Bearer ', '');
  try {
    const secret = process.env.JWT_SECRET || 'dev-secret';
    const decoded = jwt.verify(token, secret) as JwtUser;
    req.user = decoded;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

