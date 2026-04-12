// ─── Route ────────────────────────────────────────────────────────────────────

export interface GPXPoint {
  lat: number;
  lng: number;
  elevationM: number;
  cumulativeKm: number;
}

export interface Coord {
  lat: number;
  lng: number;
}

// ─── Stages ───────────────────────────────────────────────────────────────────

export interface Stage {
  dayNumber: number;
  date: Date;
  startKm: number;
  endKm: number;
  distanceKm: number;
  elevationGainM: number;
  difficultyMultiplier: number;
  effectiveKm: number;
  startCoord: Coord;
  endCoord: Coord;
  targetTown: string | null;
}

// ─── Trip ─────────────────────────────────────────────────────────────────────

export interface Trip {
  id: string;
  userId: string;
  title: string;
  startDateTime: Date;
  totalDays: number;
  stages: Stage[];
  createdAt: Date;
}

// ─── Notice Board ─────────────────────────────────────────────────────────────

export type PinCategory = 'water' | 'mud' | 'hazard' | 'info' | 'closed' | 'repair';

export interface NoticePin {
  id: string;
  userId: string;
  displayName: string;
  category: PinCategory;
  message: string;
  coord: Coord;
  kmMarker: number;
  upvotes: number;
  isActive: boolean;
  expiresAt: Date;
  createdAt: Date;
}

// ─── Journal ──────────────────────────────────────────────────────────────────

export interface JournalPhoto {
  id: string;
  userId: string;
  tripId: string;
  imageUrl: string;
  thumbnailUrl: string;
  caption: string;
  kmMarker: number;
  coord: Coord;
  exif: {
    takenAt: Date;
    deviceModel: string | null;
    altitudeM: number | null;
  };
  dayNumber: number;
  createdAt: Date;
}

// ─── Hotels ───────────────────────────────────────────────────────────────────

export type PriceRange = 'budget' | 'mid' | 'luxury';

export interface Hotel {
  id: string;
  name: string;
  town: string;
  coord: Coord;
  kmMarker: number;
  stars: number;
  priceRange: PriceRange;
  phone: string | null;
  bookingUrl: string | null;
  amenities: string[];
  distanceFromTrailM: number;
}
