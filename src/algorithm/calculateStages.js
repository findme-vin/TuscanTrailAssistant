/**
 * calculateStages
 * ───────────────
 * Splits the 445 km Tuscany Trail GPX route into daily riding stages.
 *
 * @param {Date}   startDT   – Rider's planned start date & time
 * @param {number} totalDays – Number of riding days
 * @param {Array}  gpxPoints – Array of { lat, lng, elevationM, cumulativeKm }
 *                             (pre-processed from raw GPX)
 * @returns {Array} stages   – One object per day
 */
export function calculateStages(startDT, totalDays, gpxPoints) {
  if (!gpxPoints?.length || totalDays < 1) return [];

  const TOTAL_KM        = gpxPoints[gpxPoints.length - 1].cumulativeKm;
  const RIDING_START_H  = 7;   // 07:00 — standard daily start
  const RIDING_END_H    = 20;  // 20:00 — cut-off (sunset / fatigue)
  const FULL_DAY_HOURS  = RIDING_END_H - RIDING_START_H; // 13 h

  // ─── 1. Day 1 late-start adjustment ───────────────────────────────────────
  //
  // If the rider departs at 14:00, they only have 6 of 13 available hours.
  // Day 1 gets a proportional fraction of a full day's distance.
  //
  const startHour       = startDT.getHours() + startDT.getMinutes() / 60;
  const day1AvailableH  = Math.max(0, RIDING_END_H - Math.max(startHour, RIDING_START_H));
  const day1Fraction    = day1AvailableH / FULL_DAY_HOURS; // 0.0 – 1.0

  // ─── 2. Base daily distance ────────────────────────────────────────────────
  //
  // After honouring Day 1's short window, the remaining km are split evenly
  // across the remaining days.
  //
  const baseKmPerDay       = TOTAL_KM / totalDays;
  const day1BaseKm         = baseKmPerDay * day1Fraction;
  const remainingKm        = TOTAL_KM - day1BaseKm;
  const remainingDays      = totalDays - 1;
  const standardKmPerDay   = remainingDays > 0 ? remainingKm / remainingDays : 0;

  // ─── 3. Build segment elevation lookup ────────────────────────────────────
  //
  // Pre-compute cumulative elevation gain at every GPX point so we can
  // cheaply query "how much climbing between km A and km B?"
  //
  const elevGainAtKm = buildElevationGainLookup(gpxPoints);

  // ─── 4. Difficulty multiplier ──────────────────────────────────────────────
  //
  // Effective km = actual km × multiplier
  // multiplier   = 1 + (elevationGainM / segmentKm) / 100 × 0.5
  //
  // Derivation: every 100 m/km of climbing adds ~50 % to perceived effort.
  // A flat 80 km stage equals a ~120 km stage at 1 000 m/km gradient average.
  //
  function difficultyMultiplier(segmentKm, elevGainM) {
    if (segmentKm <= 0) return 1;
    const gradientPer100m = elevGainM / segmentKm / 100;
    return 1 + gradientPer100m * 0.5;
  }

  // ─── 5. Slice GPX into daily stages ───────────────────────────────────────
  const stages = [];
  let cursorKm = 0;

  for (let day = 1; day <= totalDays; day++) {
    const targetKm   = day === 1 ? day1BaseKm : standardKmPerDay;
    const stageEndKm = Math.min(cursorKm + targetKm, TOTAL_KM);

    const startPoint = interpolatePoint(gpxPoints, cursorKm);
    const endPoint   = interpolatePoint(gpxPoints, stageEndKm);

    const elevGainM  = (elevGainAtKm(stageEndKm) - elevGainAtKm(cursorKm));
    const segKm      = stageEndKm - cursorKm;
    const multiplier = difficultyMultiplier(segKm, elevGainM);

    const stageDate  = new Date(startDT);
    stageDate.setDate(startDT.getDate() + (day - 1));
    if (day > 1) stageDate.setHours(RIDING_START_H, 0, 0, 0);

    stages.push({
      dayNumber:            day,
      date:                 stageDate,
      startKm:              round2(cursorKm),
      endKm:                round2(stageEndKm),
      distanceKm:           round2(segKm),
      elevationGainM:       Math.round(elevGainM),
      difficultyMultiplier: round2(multiplier),
      effectiveKm:          round2(segKm * multiplier),
      startCoord:           { lat: startPoint.lat, lng: startPoint.lng },
      endCoord:             { lat: endPoint.lat,   lng: endPoint.lng   },
      // Nearest town logic injected separately (see findNearestTown util)
      targetTown:           null,
    });

    cursorKm = stageEndKm;
    if (cursorKm >= TOTAL_KM) break;
  }

  return stages;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns a function elevGainAt(km) that gives cumulative elevation
 * gain in metres from the start of the route to that km marker.
 */
function buildElevationGainLookup(points) {
  let cumGain = 0;
  const table = points.map((pt, i) => {
    if (i > 0) {
      const rise = pt.elevationM - points[i - 1].elevationM;
      if (rise > 0) cumGain += rise;
    }
    return { km: pt.cumulativeKm, gain: cumGain };
  });

  return function elevGainAt(km) {
    // Binary search for closest km entry
    let lo = 0, hi = table.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (table[mid].km < km) lo = mid + 1;
      else hi = mid;
    }
    return table[lo].gain;
  };
}

/**
 * Linear interpolation: given a target cumulative km,
 * returns the interpolated { lat, lng, elevationM }.
 */
function interpolatePoint(points, targetKm) {
  if (targetKm <= 0) return points[0];
  if (targetKm >= points[points.length - 1].cumulativeKm) return points[points.length - 1];

  let lo = 0, hi = points.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (points[mid].cumulativeKm <= targetKm) lo = mid;
    else hi = mid;
  }

  const a = points[lo];
  const b = points[hi];
  const t = (targetKm - a.cumulativeKm) / (b.cumulativeKm - a.cumulativeKm);

  return {
    lat:        a.lat        + t * (b.lat        - a.lat),
    lng:        a.lng        + t * (b.lng        - a.lng),
    elevationM: a.elevationM + t * (b.elevationM - a.elevationM),
    cumulativeKm: targetKm,
  };
}

/** Parse raw GPX XML → array of { lat, lng, elevationM, cumulativeKm } */
export function parseGPX(gpxString) {
  // Works in React Native via a lightweight XML parse
  const trkptRegex = /<trkpt\s+lat="([^"]+)"\s+lon="([^"]+)"[^>]*>[\s\S]*?<ele>([^<]+)<\/ele>/g;
  const points = [];
  let match;
  let cumulativeKm = 0;

  while ((match = trkptRegex.exec(gpxString)) !== null) {
    const lat = parseFloat(match[1]);
    const lng = parseFloat(match[2]);
    const elevationM = parseFloat(match[3]);

    if (points.length > 0) {
      const prev = points[points.length - 1];
      cumulativeKm += haversineKm(prev.lat, prev.lng, lat, lng);
    }

    points.push({ lat, lng, elevationM, cumulativeKm });
  }

  return points;
}

/** Haversine distance in km between two lat/lng pairs */
function haversineKm(lat1, lng1, lat2, lng2) {
  const R  = 6371;
  const dL = toRad(lat2 - lat1);
  const dl = toRad(lng2 - lng1);
  const a  = Math.sin(dL / 2) ** 2
           + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dl / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const toRad   = (deg) => (deg * Math.PI) / 180;
const round2  = (n)   => Math.round(n * 100) / 100;
