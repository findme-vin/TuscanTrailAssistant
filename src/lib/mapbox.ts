import { Platform } from 'react-native';

const TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;

export function initMapbox() {
  if (Platform.OS === 'web') return;
  if (!TOKEN) {
    console.warn('[TTP] Missing EXPO_PUBLIC_MAPBOX_TOKEN');
    return;
  }
  const Mapbox = require('@rnmapbox/maps').default;
  Mapbox.setAccessToken(TOKEN);
  Mapbox.setTelemetryEnabled(false);
}

export const MapStyles = {
  OUTDOOR:   'mapbox://styles/mapbox/outdoors-v12',
  SATELLITE: 'mapbox://styles/mapbox/satellite-streets-v12',
  DARK:      'mapbox://styles/mapbox/dark-v11',
} as const;

/** Tuscany Trail start/end — Campiglia Marittima */
export const TRAIL_START: [number, number] = [10.6133, 43.0617];

export const DEFAULT_CAMERA = {
  centerCoordinate: TRAIL_START,
  zoomLevel: 9,
};
