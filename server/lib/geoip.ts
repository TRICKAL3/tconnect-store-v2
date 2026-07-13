import type { Request } from 'express';

export type LoginLocation = {
  country: string | null;
  city: string | null;
  region: string | null;
  ip: string | null;
};

function headerValue(req: Request, name: string): string | null {
  const raw = req.headers[name.toLowerCase()];
  if (typeof raw === 'string' && raw.trim()) return raw.trim();
  if (Array.isArray(raw) && raw[0]?.trim()) return raw[0].trim();
  return null;
}

function countryCodeToName(code: string): string {
  const upper = code.trim().toUpperCase();
  try {
    const name = new Intl.DisplayNames(['en'], { type: 'region' }).of(upper);
    return name || upper;
  } catch {
    return upper;
  }
}

export function clientIp(req: Request): string | null {
  const forwarded = req.headers['x-forwarded-for'];
  const raw =
    (typeof forwarded === 'string' ? forwarded.split(',')[0] : Array.isArray(forwarded) ? forwarded[0] : null) ||
    headerValue(req, 'x-real-ip') ||
    headerValue(req, 'x-vercel-forwarded-for')?.split(',')[0] ||
    req.socket?.remoteAddress ||
    null;
  if (!raw) return null;
  const ip = raw.trim();
  if (!ip || ip === '::1' || ip === '127.0.0.1' || ip.startsWith('10.') || ip.startsWith('192.168.')) {
    return null;
  }
  return ip;
}

/** Vercel injects geo headers on every request — most reliable on production. */
function locationFromVercelHeaders(req: Request): LoginLocation | null {
  const countryCode = headerValue(req, 'x-vercel-ip-country');
  const city = headerValue(req, 'x-vercel-ip-city');
  const region = headerValue(req, 'x-vercel-ip-country-region');
  const ip = clientIp(req);

  if (!countryCode && !city && !region) return null;

  return {
    country: countryCode ? countryCodeToName(countryCode) : null,
    city: city || null,
    region: region || null,
    ip,
  };
}

async function locationFromIpWhoIs(ip: string): Promise<LoginLocation | null> {
  try {
    const res = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      success?: boolean;
      country?: string;
      city?: string;
      region?: string;
    };
    if (!data.success) return null;
    return {
      country: data.country || null,
      city: data.city || null,
      region: data.region || null,
      ip,
    };
  } catch {
    return null;
  }
}

/** Resolve approximate login location from Vercel headers, then IP lookup. */
export async function resolveLoginLocation(req: Request): Promise<LoginLocation> {
  const fromVercel = locationFromVercelHeaders(req);
  if (fromVercel?.country || fromVercel?.city) {
    return fromVercel;
  }

  const ip = clientIp(req);
  if (ip) {
    const fromIp = await locationFromIpWhoIs(ip);
    if (fromIp?.country || fromIp?.city) {
      return fromIp;
    }
    return { country: null, city: null, region: null, ip };
  }

  return { country: null, city: null, region: null, ip: null };
}

export function mergeLocation(
  primary: LoginLocation,
  fallback?: Partial<LoginLocation> | null
): LoginLocation {
  return {
    country: primary.country || fallback?.country || null,
    city: primary.city || fallback?.city || null,
    region: primary.region || fallback?.region || null,
    ip: primary.ip || fallback?.ip || null,
  };
}
