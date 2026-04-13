/**
 * HotelBeds provider.
 * Computes SHA256 signature and calls the HotelBeds availability API.
 * Keys are read server-side from EXPO_PUBLIC_HOTELBEDS_* env vars.
 */
import type { HotelAvailability } from '@/types';
import type { HotelSearchParams, HotelProviderFn } from './types';

const BASE_URL =
  process.env.EXPO_PUBLIC_HOTELBEDS_ENV === 'prod'
    ? 'https://api.hotelbeds.com'
    : 'https://api.test.hotelbeds.com';

function parseCategoryToStars(code: string): number {
  const match = (code ?? '').match(/^(\d)/);
  return match ? Math.min(5, Math.max(1, parseInt(match[1]))) : 0;
}

async function buildSignature(apiKey: string, secret: string): Promise<string> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const raw = apiKey + secret + timestamp;
  const encoded = new TextEncoder().encode(raw);
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const hotelbeds: HotelProviderFn = async (params: HotelSearchParams): Promise<HotelAvailability[]> => {
  const apiKey = process.env.EXPO_PUBLIC_HOTELBEDS_API_KEY ?? '';
  const secret = process.env.EXPO_PUBLIC_HOTELBEDS_SECRET ?? '';

  if (!apiKey || !secret) {
    throw new Error('[HotelBeds] API credentials not configured');
  }

  const maxHotels = params.maxResults ?? 5;

  const body = {
    stay: { checkIn: params.checkIn, checkOut: params.checkOut },
    occupancies: [{ rooms: 1, adults: 1, children: 0 }],
    geolocation: {
      latitude: params.lat,
      longitude: params.lng,
      radius: params.radiusKm ?? 5,
      unit: 'km',
    },
    filter: { maxHotels },
  };

  const signature = await buildSignature(apiKey, secret);

  const response = await fetch(`${BASE_URL}/hotel-api/1.0/hotels`, {
    method: 'POST',
    headers: {
      'Api-key': apiKey,
      'X-Signature': signature,
      'Accept': 'application/json',
      'Accept-Encoding': 'gzip',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`[HotelBeds] HTTP ${response.status}: ${text.slice(0, 200)}`);
  }

  const data = await response.json();
  const hotels: any[] = data?.hotels?.hotels ?? [];

  return hotels.slice(0, maxHotels).map((h: any) => ({
    hotelCode: String(h.code),
    name: h.name ?? 'Unknown Hotel',
    stars: parseCategoryToStars(h.categoryCode ?? ''),
    minRate: parseFloat(h.minRate ?? h.rooms?.[0]?.rates?.[0]?.net ?? '0'),
    currency: h.currency ?? 'EUR',
    bookingUrl: `https://www.hotelbeds.com/hotel/${h.code}`,
    checkIn: params.checkIn,
    checkOut: params.checkOut,
    coord: {
      lat: h.latitude ?? params.lat,
      lng: h.longitude ?? params.lng,
    },
  }));
};
