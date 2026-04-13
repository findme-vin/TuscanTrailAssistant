/**
 * SerpApi Google Hotels provider.
 * Uses the Google Hotels engine to search for hotel availability by coordinates.
 * API key is read server-side from SERPAPI_KEY env var.
 */
import type { HotelAvailability } from '@/types';
import type { HotelSearchParams, HotelProviderFn } from './types';

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

/** Parse a price string like "$123", "€89", "US$150" → { amount, currency } */
function parsePrice(raw: string | undefined): { amount: number; currency: string } {
  if (!raw) return { amount: 0, currency: 'USD' };
  const cleaned = raw.replace(/,/g, '');
  const match = cleaned.match(/([\$€£]|US\$|EUR|GBP|USD)?\s*(\d+(?:\.\d+)?)/);
  if (!match) return { amount: 0, currency: 'USD' };

  const symbolMap: Record<string, string> = {
    '$': 'USD', 'US$': 'USD', 'USD': 'USD',
    '€': 'EUR', 'EUR': 'EUR',
    '£': 'GBP', 'GBP': 'GBP',
  };
  return {
    amount: parseFloat(match[2]),
    currency: symbolMap[match[1] ?? ''] ?? 'USD',
  };
}

export const serpapi: HotelProviderFn = async (params: HotelSearchParams): Promise<HotelAvailability[]> => {
  const apiKey = process.env.SERPAPI_KEY ?? '';
  if (!apiKey) {
    throw new Error('[SerpApi] SERPAPI_KEY not configured');
  }

  const maxResults = params.maxResults ?? 5;

  // Google Hotels requires a text query with location name — coordinates alone don't work
  const locationQuery = params.locationName
    ? `hotels near ${params.locationName}, Italy`
    : `hotels near ${params.lat},${params.lng}`;

  const url = new URL('https://serpapi.com/search');
  url.searchParams.set('engine', 'google_hotels');
  url.searchParams.set('q', locationQuery);
  url.searchParams.set('check_in_date', params.checkIn);
  url.searchParams.set('check_out_date', params.checkOut);
  url.searchParams.set('adults', '1');
  url.searchParams.set('currency', 'EUR');
  url.searchParams.set('gl', 'it');
  url.searchParams.set('hl', 'en');
  url.searchParams.set('api_key', apiKey);

  const response = await fetch(url.toString());

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`[SerpApi] HTTP ${response.status}: ${text.slice(0, 200)}`);
  }

  const data = await response.json();
  const properties: any[] = data?.properties ?? [];

  return properties.slice(0, maxResults).map((p: any, i: number) => {
    const { amount, currency } = parsePrice(p.rate_per_night?.lowest);
    return {
      hotelCode: slugify(p.name ?? '') || `serpapi-${i}`,
      name: p.name ?? 'Unknown Hotel',
      stars: p.hotel_class ?? 0,
      minRate: amount,
      currency,
      bookingUrl: p.link ?? '',
      checkIn: params.checkIn,
      checkOut: params.checkOut,
      coord: {
        lat: p.gps_coordinates?.latitude ?? params.lat,
        lng: p.gps_coordinates?.longitude ?? params.lng,
      },
    };
  });
};
