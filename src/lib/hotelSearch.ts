/**
 * HOTEL SEARCH CLIENT
 * Provider-agnostic client that calls the local Expo API route proxy (/api/hotels).
 * The server selects the active provider (SerpApi, HotelBeds, etc.)
 * and returns normalized HotelAvailability[].
 */
import type { HotelAvailability, HotelSearchParams } from '@/types';

export type { HotelSearchParams };

export async function searchHotelAvailability(
  params: HotelSearchParams
): Promise<HotelAvailability[]> {
  const response = await fetch('/api/hotels', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.error ?? `HTTP ${response.status}`);
  }

  const data = await response.json();

  // Server now returns HotelAvailability[] directly
  return Array.isArray(data) ? data : [];
}
