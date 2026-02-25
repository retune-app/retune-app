interface GeoResult {
  country: string | null;
  city: string | null;
  timezone: string | null;
}

const geoCache = new Map<string, { result: GeoResult; expires: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000;

export async function getGeoFromIp(ip: string): Promise<GeoResult> {
  const cleanIp = ip.replace("::ffff:", "").split(",")[0].trim();

  if (!cleanIp || cleanIp === "unknown" || cleanIp === "127.0.0.1" || cleanIp === "::1") {
    return { country: null, city: null, timezone: null };
  }

  const cached = geoCache.get(cleanIp);
  if (cached && cached.expires > Date.now()) {
    return cached.result;
  }

  try {
    const response = await fetch(`https://ipwho.is/${cleanIp}`, {
      signal: AbortSignal.timeout(3000),
    });

    if (!response.ok) {
      return { country: null, city: null, timezone: null };
    }

    const data = await response.json();

    if (!data.success) {
      return { country: null, city: null, timezone: null };
    }

    const result: GeoResult = {
      country: data.country || null,
      city: data.city || null,
      timezone: data.timezone?.id || null,
    };

    geoCache.set(cleanIp, { result, expires: Date.now() + CACHE_TTL });

    return result;
  } catch {
    return { country: null, city: null, timezone: null };
  }
}

export function getClientIp(req: any): string {
  return (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || "unknown";
}
