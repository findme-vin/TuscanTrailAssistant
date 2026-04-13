/**
 * useHotels — fetches hotel availability for each overnight stop.
 * Results are cached in a ref so re-renders don't re-fetch.
 */
import { useState, useEffect, useRef } from 'react';
import { searchHotelAvailability } from '@/lib/hotelSearch';
import type { HotelAvailability, HotelDayResult } from '@/types';

// ─── Date helpers ─────────────────────────────────────────────────────────────

/**
 * Returns check-in date for a given day number.
 * Day 1 → startDate, Day 2 → startDate + 1, etc.
 * Uses local-time Date construction to avoid UTC midnight DST issues.
 */
export function checkInForDay(startDate: string, dayNumber: number): string {
  const d = new Date(startDate + 'T00:00:00');
  d.setDate(d.getDate() + (dayNumber - 1));
  return d.toISOString().slice(0, 10);
}

export function checkOutForDay(startDate: string, dayNumber: number): string {
  return checkInForDay(startDate, dayNumber + 1);
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

interface DayInfo {
  dayNumber: number;
  to: { name: string; kmMarker: number; coord: { lat: number; lng: number } };
}

export function useHotels(
  dayPlan: DayInfo[],
  startDate: string,
  dayRadii: Record<number, number>,  // per-day radius, keyed by dayNumber
): Record<number, HotelDayResult> {
  const [results, setResults] = useState<Record<number, HotelDayResult>>({});
  const cache = useRef<Map<string, HotelAvailability[]>>(new Map());

  // Stable dependency key — re-fetch only when towns, dates, or radii change
  const depKey = JSON.stringify(
    dayPlan.map((d) => ({
      n: d.dayNumber,
      name: d.to.name,
      km: d.to.kmMarker,
      r: dayRadii[d.dayNumber] ?? 5,
    }))
  ) + `::${startDate}`;

  useEffect(() => {
    const enabled = process.env.EXPO_PUBLIC_HOTEL_SEARCH_ENABLED ?? '';
    if (!enabled) {
      // Hotel search not enabled — stay idle silently
      return;
    }

    let cancelled = false;

    const fetchAll = async () => {
      for (const day of dayPlan) {
        if (cancelled) break;

        // Skip the finish town (no overnight stay needed)
        if (day.to.kmMarker >= 454) continue;

        const radiusKm = dayRadii[day.dayNumber] ?? 5;
        const checkIn  = checkInForDay(startDate, day.dayNumber);
        const checkOut = checkOutForDay(startDate, day.dayNumber);
        const cacheKey = `${day.to.name}::${checkIn}::${radiusKm}`;

        // Cache hit
        if (cache.current.has(cacheKey)) {
          setResults((prev) => ({
            ...prev,
            [day.dayNumber]: { status: 'success', hotels: cache.current.get(cacheKey)! },
          }));
          continue;
        }

        // Set loading
        setResults((prev) => ({
          ...prev,
          [day.dayNumber]: { status: 'loading', hotels: [] },
        }));

        try {
          const hotels = await searchHotelAvailability({
            lat: day.to.coord.lat,
            lng: day.to.coord.lng,
            checkIn,
            checkOut,
            radiusKm,
            maxResults: 5,
            locationName: day.to.name,
          });

          if (cancelled) break;
          cache.current.set(cacheKey, hotels);
          setResults((prev) => ({
            ...prev,
            [day.dayNumber]: { status: 'success', hotels },
          }));
        } catch (e: any) {
          if (cancelled) break;
          setResults((prev) => ({
            ...prev,
            [day.dayNumber]: {
              status: 'error',
              hotels: [],
              error: e.message ?? 'Hotels unavailable',
            },
          }));
        }

        // Small gap between requests to respect rate limits
        await new Promise((r) => setTimeout(r, 200));
      }
    };

    fetchAll();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depKey]);

  return results;
}
