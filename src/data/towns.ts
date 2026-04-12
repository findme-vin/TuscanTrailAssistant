/**
 * Key towns along the Tuscany Trail (454 km loop from Campiglia Marittima).
 * Actual route stats: 282.1 mi (454 km), +5,649 m / -5,653 m elevation.
 * km markers derived from the official 2026 TCX route file.
 *
 * Route direction (clockwise): Campiglia → Follonica → Castiglione Pescaia
 *   → Roccastrada → Montalcino → Siena → Colle Val d'Elsa → Volterra
 *   → Suvereto → Campiglia
 */
import ROUTE_POINTS from '@/data/route.json';
const ROUTE = ROUTE_POINTS as [number, number, number, number][];

export interface TrailTown {
  name: string;
  kmMarker: number;
  coord: { lat: number; lng: number };
  region: string;
  hasAccommodation: boolean;
  notes?: string;
}

export const TRAIL_TOWNS: TrailTown[] = [
  { name: 'Campiglia Marittima', kmMarker: 0,   coord: { lat: 43.0299, lng: 10.6044 }, region: 'Val di Cornia',         hasAccommodation: true,  notes: 'Start / Finish' },
  { name: 'Follonica',           kmMarker: 36,  coord: { lat: 42.9219, lng: 10.7618 }, region: 'Gulf of Follonica',     hasAccommodation: true  },
  { name: 'Castiglione Pescaia', kmMarker: 63,  coord: { lat: 42.7621, lng: 10.8793 }, region: 'Coastal Maremma',       hasAccommodation: true,  notes: 'Beach resort — book early' },
  { name: 'Roccastrada',         kmMarker: 110, coord: { lat: 42.9829, lng: 11.1699 }, region: 'Maremma',               hasAccommodation: true  },
  { name: 'Roccalbegna',         kmMarker: 142, coord: { lat: 42.7884, lng: 11.5076 }, region: 'Maremma',               hasAccommodation: false, notes: 'Small village — limited beds' },
  { name: 'Castel del Piano',    kmMarker: 167, coord: { lat: 42.8909, lng: 11.5346 }, region: 'Monte Amiata',          hasAccommodation: true  },
  { name: 'Montalcino',          kmMarker: 216, coord: { lat: 43.0548, lng: 11.4892 }, region: 'Val d\'Orcia',          hasAccommodation: true,  notes: 'Brunello wine region' },
  { name: 'Asciano',             kmMarker: 233, coord: { lat: 43.2339, lng: 11.5614 }, region: 'Crete Senesi',          hasAccommodation: true  },
  { name: 'Siena',               kmMarker: 261, coord: { lat: 43.3186, lng: 11.3309 }, region: 'Siena',                 hasAccommodation: true,  notes: 'UNESCO city, extensive services' },
  { name: 'Colle di Val d\'Elsa',kmMarker: 291, coord: { lat: 43.4213, lng: 11.1174 }, region: 'Val d\'Elsa',           hasAccommodation: true  },
  { name: 'Volterra',            kmMarker: 342, coord: { lat: 43.4028, lng: 10.8614 }, region: 'Alta Valdera',          hasAccommodation: true,  notes: 'Medieval city, many hotels' },
  { name: 'Massa Marittima',     kmMarker: 405, coord: { lat: 43.0508, lng: 10.8884 }, region: 'Metalliferous Hills',   hasAccommodation: true,  notes: 'Medieval town, great food' },
  { name: 'Castagneto Carducci', kmMarker: 424, coord: { lat: 43.1566, lng: 10.6078 }, region: 'Tuscan Coast',          hasAccommodation: true  },
  { name: 'Sassetta',            kmMarker: 437, coord: { lat: 43.0869, lng: 10.7419 }, region: 'Tuscan Coast Hills',    hasAccommodation: true  },
  { name: 'Suvereto',            kmMarker: 442, coord: { lat: 43.0764, lng: 10.6740 }, region: 'Val di Cornia',         hasAccommodation: true  },
];

const TOTAL_KM = 454;

/**
 * Returns the best overnight town for each day-end km marker.
 * Prefers towns with accommodation that are close to both the ideal split
 * point AND the actual route (penalises towns far off-route).
 */
export function suggestOvernightTowns(totalDays: number): TrailTown[] {
  const suggestions: TrailTown[] = [];
  const kmPerDay = TOTAL_KM / totalDays;
  const usedKm = new Set<number>();

  // Pre-compute each town's distance from the route (km)
  const routeProximity = new Map<number, number>();
  for (const t of TRAIL_TOWNS) {
    let minDist = Infinity;
    for (const [lat, lng] of ROUTE) {
      const dlat = (t.coord.lat - lat) * 111;
      const dlng = (t.coord.lng - lng) * 111 * Math.cos(t.coord.lat * Math.PI / 180);
      const d = Math.sqrt(dlat * dlat + dlng * dlng);
      if (d < minDist) minDist = d;
    }
    routeProximity.set(t.kmMarker, minDist);
  }

  for (let day = 1; day < totalDays; day++) {
    const idealKm = kmPerDay * day;

    const best = TRAIL_TOWNS
      .filter((t) => t.hasAccommodation && t.kmMarker > 0 && t.kmMarker < TOTAL_KM && !usedKm.has(t.kmMarker))
      .sort((a, b) => {
        // Combined score: distance from ideal km + penalty for being far off-route
        const aKmDiff = Math.abs(a.kmMarker - idealKm);
        const bKmDiff = Math.abs(b.kmMarker - idealKm);
        const aProx = routeProximity.get(a.kmMarker) ?? 0;
        const bProx = routeProximity.get(b.kmMarker) ?? 0;
        // Weight off-route distance heavily (3x) so nearby-route towns are preferred
        return (aKmDiff + aProx * 3) - (bKmDiff + bProx * 3);
      })[0];

    if (best) {
      suggestions.push(best);
      usedKm.add(best.kmMarker);
    }
  }

  return suggestions;
}

/**
 * Returns a full day-by-day plan:
 * { dayNumber, from, to, distanceKm }[]
 */
export function buildDayPlan(totalDays: number) {
  const stops = suggestOvernightTowns(totalDays);
  const allPoints = [
    TRAIL_TOWNS[0],
    ...stops,
    { ...TRAIL_TOWNS[0], kmMarker: TOTAL_KM, name: 'Campiglia Marittima (Finish)', notes: 'Finish' },
  ];

  return allPoints.slice(0, -1).map((town, i) => ({
    dayNumber:  i + 1,
    from:       town,
    to:         allPoints[i + 1],
    distanceKm: Math.round(allPoints[i + 1].kmMarker - town.kmMarker),
  }));
}
