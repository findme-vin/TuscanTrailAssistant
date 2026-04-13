/**
 * HOTELS PROXY API ROUTE
 * Expo API route (server-side) — thin dispatcher that delegates
 * to the configured hotel provider (SerpApi, HotelBeds, etc.).
 * Endpoint: POST /api/hotels
 *
 * Provider is selected via HOTEL_PROVIDER env var (default: serpapi).
 * All secrets stay server-side — never exposed to the browser.
 */
import { getProvider } from './providers';

export async function POST(request: Request): Promise<Response> {
  let params: any;
  try {
    params = await request.json();
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 });
  }

  try {
    const provider = getProvider();
    const hotels = await provider(params);
    return Response.json(hotels);
  } catch (e: any) {
    const message = e?.message ?? 'Hotel search failed';
    console.error('[hotels+api]', message);
    return Response.json({ error: message }, { status: 502 });
  }
}
