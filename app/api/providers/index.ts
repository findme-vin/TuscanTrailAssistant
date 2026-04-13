/**
 * Hotel provider registry.
 * Set HOTEL_PROVIDER env var to switch between providers.
 * Default: serpapi
 */
import { serpapi } from './serpapi';
import { hotelbeds } from './hotelbeds';
import type { HotelProviderFn } from './types';

const providers: Record<string, HotelProviderFn> = { serpapi, hotelbeds };

export function getProvider(): HotelProviderFn {
  const name = process.env.HOTEL_PROVIDER || 'serpapi';
  return providers[name] ?? providers.serpapi;
}
