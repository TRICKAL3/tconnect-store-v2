import { getApiBase } from './getApiBase';

type IpWhoResponse = {
  success?: boolean;
  country?: string;
  city?: string;
  region?: string;
};

export type ClientLocationPayload = {
  country: string | null;
  city: string | null;
  region: string | null;
  source: 'gps' | 'ip_approx';
};

const GPS_ATTEMPT_KEY = 'tconnect-gps-location';

async function reverseGeocode(lat: number, lon: number): Promise<ClientLocationPayload | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1`,
      {
        headers: {
          'Accept-Language': 'en',
          'User-Agent': 'TConnectStore/1.0 (contact@tconnect.store)',
        },
        signal: AbortSignal.timeout(8000),
      }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      address?: Record<string, string>;
    };
    const addr = data.address || {};
    const city =
      addr.city || addr.town || addr.village || addr.municipality || addr.county || null;
    const region = addr.state || addr.region || null;
    const country = addr.country || null;
    if (!city && !country) return null;
    return { country, city, region, source: 'gps' };
  } catch {
    return null;
  }
}

/** Browser GPS (accurate city) — only if user allows location permission. */
async function tryGpsLocation(): Promise<ClientLocationPayload | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return null;
  if (localStorage.getItem(GPS_ATTEMPT_KEY) === 'denied') return null;

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        localStorage.setItem(GPS_ATTEMPT_KEY, 'granted');
        const geo = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
        resolve(geo);
      },
      () => {
        localStorage.setItem(GPS_ATTEMPT_KEY, 'denied');
        resolve(null);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 300000 }
    );
  });
}

async function tryIpLocation(): Promise<ClientLocationPayload | null> {
  try {
    const geoRes = await fetch('https://ipwho.is/', { signal: AbortSignal.timeout(6000) });
    if (!geoRes.ok) return null;
    const geo = (await geoRes.json()) as IpWhoResponse;
    if (!geo.success) return null;
    return {
      country: geo.country || null,
      city: geo.city || null,
      region: geo.region || null,
      source: 'ip_approx',
    };
  } catch {
    return null;
  }
}

async function saveLocation(email: string, payload: ClientLocationPayload): Promise<void> {
  await fetch(`${getApiBase()}/users/location`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      country: payload.country,
      city: payload.city,
      region: payload.region,
      source: payload.source,
    }),
  });
}

/**
 * Capture login location: GPS first (accurate city e.g. Mzuzu), then IP fallback.
 * IP-only geolocation in Malawi often shows Lilongwe/Blantyre due to mobile ISP routing.
 */
export async function captureLoginLocation(email: string): Promise<void> {
  const trimmed = email.trim();
  if (!trimmed) return;

  try {
    const gps = await tryGpsLocation();
    if (gps?.city || gps?.country) {
      await saveLocation(trimmed, gps);
      return;
    }

    const ipLoc = await tryIpLocation();
    if (ipLoc?.city || ipLoc?.country) {
      await saveLocation(trimmed, ipLoc);
    }
  } catch {
    /* non-blocking */
  }
}
