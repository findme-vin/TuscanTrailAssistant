/**
 * Hotel provider interface.
 * Each provider implements this function signature to normalize
 * results into HotelAvailability[].
 */
import type { HotelAvailability, HotelSearchParams } from '@/types';

export type { HotelSearchParams };

export type HotelProviderFn = (params: HotelSearchParams) => Promise<HotelAvailability[]>;
