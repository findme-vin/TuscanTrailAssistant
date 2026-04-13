/**
 * Web stub for @rnmapbox/maps — swapped in by metro.config.js on web builds.
 * Uses Leaflet (loaded from CDN) to render a real tile map with markers,
 * direction arrows, and optional km markers.
 */
import React, { useEffect, useRef, useState, useContext, createContext } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import ROUTE_POINTS from '@/data/route.json';

// Route data: [lat, lng, distanceKm, elevM][]
const ROUTE = ROUTE_POINTS as [number, number, number, number][];

// ─── Leaflet loader ───────────────────────────────────────────────────────────

type LeafletCtxValue = { L: any; map: any } | null;
const MapCtx = createContext<LeafletCtxValue>(null);

function ensureLeaflet(): Promise<any> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  const win = window as any;
  if (win.__leafletPromise) return win.__leafletPromise;
  win.__leafletPromise = new Promise<any>((resolve) => {
    if (win.L) { resolve(win.L); return; }
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => resolve((window as any).L);
    document.head.append(link, script);
  });
  return win.__leafletPromise;
}

// ─── Helpers for arrows & km markers ──────────────────────────────────────────

function bearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const dLng = toRad(lng2 - lng1);
  const y = Math.sin(dLng) * Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
            Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Interpolate a point at a given km along the route */
function pointAtKm(km: number): { lat: number; lng: number; bearing: number } | null {
  for (let i = 1; i < ROUTE.length; i++) {
    const [lat0, lng0, d0] = ROUTE[i - 1];
    const [lat1, lng1, d1] = ROUTE[i];
    if (km >= d0 && km <= d1) {
      const t = d1 === d0 ? 0 : (km - d0) / (d1 - d0);
      return {
        lat: lat0 + t * (lat1 - lat0),
        lng: lng0 + t * (lng1 - lng0),
        bearing: bearing(lat0, lng0, lat1, lng1),
      };
    }
  }
  return null;
}

// ─── MapView ─────────────────────────────────────────────────────────────────

type DaySegment = { startKm: number; endKm: number; color: string };

const HOTEL_ROUTE_COLOR = '#E040FB'; // magenta — distinct from day colors

interface HotelRouteInfo {
  from: { lat: number; lng: number };
  to: { lat: number; lng: number };
  name: string;
}

export function MapView({
  style,
  children,
  kmInterval,
  activeSegment,
  daySegments,
  hoverKm,
  hotelRoute,
}: {
  style?: any;
  children?: React.ReactNode;
  kmInterval?: number;
  activeSegment?: DaySegment;
  daySegments?: DaySegment[];
  hoverKm?: number | null;
  hotelRoute?: HotelRouteInfo | null;
  logoEnabled?: boolean;
  attributionEnabled?: boolean;
}) {
  const flat: any = Array.isArray(style) ? Object.assign({}, ...style) : (style ?? {});
  const isEmbedded = !!(flat.height || flat.minHeight || flat.flex);
  const divRef = useRef<any>(null);
  const [ctx, setCtx] = useState<LeafletCtxValue>(null);
  const layersRef = useRef<any[]>([]);
  const activeLayerRef = useRef<any>(null);
  const segmentLayersRef = useRef<any[]>([]);
  const hoverMarkerRef = useRef<any>(null);
  const hoverHighlightRef = useRef<any>(null);
  const defaultViewRef = useRef<{ center: any; zoom: number } | null>(null);

  // Initialize map once
  useEffect(() => {
    if (!isEmbedded) return;
    let map: any;
    ensureLeaflet().then((L) => {
      if (!L || !divRef.current) return;
      map = L.map(divRef.current, {
        center: [43.15, 10.95],
        zoom: 9,
        zoomControl: true,
        attributionControl: false,
        scrollWheelZoom: true,
      });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(map);

      // Fit to route bounds with tighter padding for a more zoomed-in view
      const routeLatLngs = ROUTE.map(([lat, lng]) => [lat, lng] as [number, number]);
      const boundsLine = L.polyline(routeLatLngs, { opacity: 0 }).addTo(map);

      setTimeout(() => {
        map.invalidateSize();
        map.fitBounds(boundsLine.getBounds(), { padding: [10, 10] });
        map.removeLayer(boundsLine);
        // Store default view and lock minimum zoom
        defaultViewRef.current = { center: map.getCenter(), zoom: map.getZoom() };
        map.setMinZoom(map.getZoom());
      }, 100);

      setCtx({ L, map });
    });
    return () => { map?.remove(); setCtx(null); };
  }, [isEmbedded]);

  // Listen for map reset event
  useEffect(() => {
    if (!ctx) return;
    const handler = () => {
      if (defaultViewRef.current) {
        ctx.map.setView(defaultViewRef.current.center, defaultViewRef.current.zoom);
      }
    };
    window.addEventListener('map-reset', handler);
    return () => window.removeEventListener('map-reset', handler);
  }, [ctx]);

  // Day-colored route segments + arrows — re-draw when segments change
  useEffect(() => {
    if (!ctx) return;
    const { L, map } = ctx;

    // Remove old segment layers
    segmentLayersRef.current.forEach((layer) => map.removeLayer(layer));
    segmentLayersRef.current = [];

    const segs = daySegments ?? [];

    if (segs.length === 0) {
      // Fallback: single green route line
      const routeLatLngs = ROUTE.map(([lat, lng]) => [lat, lng] as [number, number]);
      const line = L.polyline(routeLatLngs, {
        color: '#39FF14', weight: 3, opacity: 0.85, dashArray: '6 4',
      }).addTo(map);
      segmentLayersRef.current.push(line);
    } else {
      // Draw each day segment in its color
      // Include one point beyond each boundary so segments connect seamlessly
      for (const seg of segs) {
        const pts: [number, number][] = [];
        let addedBefore = false;
        for (let j = 0; j < ROUTE.length; j++) {
          const [lat, lng, km] = ROUTE[j];
          if (km >= seg.startKm && km <= seg.endKm) {
            // Include the point just before the segment start for smooth join
            if (!addedBefore && j > 0 && seg.startKm > 0) {
              const [pLat, pLng] = ROUTE[j - 1];
              pts.push([pLat, pLng]);
            }
            addedBefore = true;
            pts.push([lat, lng]);
          } else if (km > seg.endKm) {
            // Include first point past the end for smooth join to next segment
            pts.push([lat, lng]);
            break;
          }
        }
        if (pts.length < 2) continue;
        const line = L.polyline(pts, {
          color: seg.color, weight: 3, opacity: 0.85, dashArray: '6 4',
        }).addTo(map);
        segmentLayersRef.current.push(line);
      }
    }

    // Direction arrows every ~30 km, colored by segment
    const ARROW_INTERVAL = 30;
    for (let km = ARROW_INTERVAL; km < 454; km += ARROW_INTERVAL) {
      const pt = pointAtKm(km);
      if (!pt) continue;
      // Find which segment this km belongs to
      let arrowColor = '#39FF14';
      for (const seg of segs) {
        if (km >= seg.startKm && km <= seg.endKm) { arrowColor = seg.color; break; }
      }
      const rot = pt.bearing - 90;
      const html = `<div style="color:${arrowColor};font-size:5px;transform:rotate(${rot}deg);opacity:0.9;text-shadow:0 0 2px #0D1B0F;">▶</div>`;
      const icon = L.divIcon({ html, className: '', iconSize: [5, 5], iconAnchor: [3, 3] });
      const marker = L.marker([pt.lat, pt.lng], { icon, interactive: false }).addTo(map);
      segmentLayersRef.current.push(marker);
    }
  }, [ctx, daySegments]);

  // Km markers layer — re-draw when interval changes
  useEffect(() => {
    if (!ctx) return;
    const { L, map } = ctx;

    // Remove old km markers
    layersRef.current.forEach((m) => map.removeLayer(m));
    layersRef.current = [];

    if (!kmInterval || kmInterval <= 0) return;

    for (let km = kmInterval; km < 454; km += kmInterval) {
      const pt = pointAtKm(km);
      if (!pt) continue;
      const html =
        `<div style="background:rgba(13,27,15,0.85);color:#9CA3AF;font-size:9px;font-weight:700;` +
        `padding:1px 4px;border-radius:3px;border:1px solid #1E3322;white-space:nowrap">${km}</div>`;
      const icon = L.divIcon({ html, className: '', iconAnchor: [0, 0] });
      const marker = L.marker([pt.lat, pt.lng], { icon, interactive: false }).addTo(map);
      layersRef.current.push(marker);
    }
  }, [ctx, kmInterval]);

  // Active segment highlight — re-draw when active day changes
  useEffect(() => {
    if (!ctx) return;
    const { L, map } = ctx;

    // Remove old highlight
    if (activeLayerRef.current) {
      map.removeLayer(activeLayerRef.current);
      activeLayerRef.current = null;
    }

    if (!activeSegment) return;

    const segPoints: [number, number][] = [];
    for (let j = 0; j < ROUTE.length; j++) {
      const [lat, lng, km] = ROUTE[j];
      if (km >= activeSegment.startKm && km <= activeSegment.endKm) {
        if (segPoints.length === 0 && j > 0 && activeSegment.startKm > 0) {
          const [pLat, pLng] = ROUTE[j - 1];
          segPoints.push([pLat, pLng]);
        }
        segPoints.push([lat, lng]);
      } else if (km > activeSegment.endKm) {
        segPoints.push([lat, lng]);
        break;
      }
    }

    if (segPoints.length < 2) return;

    activeLayerRef.current = L.polyline(segPoints, {
      color: activeSegment.color,
      weight: 3,
      opacity: 0.9,
    }).addTo(map);
  }, [ctx, activeSegment?.startKm, activeSegment?.endKm, activeSegment?.color]);

  // Hover highlight — thicken whichever day segment the mouse is over
  useEffect(() => {
    if (!ctx) return;
    const { L, map } = ctx;

    if (hoverHighlightRef.current) {
      map.removeLayer(hoverHighlightRef.current);
      hoverHighlightRef.current = null;
    }

    if (hoverKm == null || !daySegments) return;

    const hoveredSeg = daySegments.find(s => hoverKm >= s.startKm && hoverKm <= s.endKm);
    if (!hoveredSeg) return;

    const pts: [number, number][] = [];
    for (let j = 0; j < ROUTE.length; j++) {
      const [lat, lng, km] = ROUTE[j];
      if (km >= hoveredSeg.startKm && km <= hoveredSeg.endKm) {
        if (pts.length === 0 && j > 0 && hoveredSeg.startKm > 0) {
          const [pLat, pLng] = ROUTE[j - 1];
          pts.push([pLat, pLng]);
        }
        pts.push([lat, lng]);
      } else if (km > hoveredSeg.endKm) {
        pts.push([lat, lng]);
        break;
      }
    }
    if (pts.length < 2) return;

    hoverHighlightRef.current = L.polyline(pts, {
      color: hoveredSeg.color,
      weight: 6,
      opacity: 0.9,
    }).addTo(map);
  }, [ctx, hoverKm, daySegments]);

  // Hover position marker — moves as user hovers over elevation profile
  useEffect(() => {
    if (!ctx) return;
    const { L, map } = ctx;

    // Remove old hover marker
    if (hoverMarkerRef.current) {
      map.removeLayer(hoverMarkerRef.current);
      hoverMarkerRef.current = null;
    }

    if (hoverKm == null) return;

    const pt = pointAtKm(hoverKm);
    if (!pt) return;

    // Find color from daySegments
    let color = '#FFFFFF';
    if (daySegments) {
      for (const seg of daySegments) {
        if (hoverKm >= seg.startKm && hoverKm <= seg.endKm) { color = seg.color; break; }
      }
    }

    const html =
      `<div style="width:14px;height:14px;border-radius:50%;background:${color};` +
      `border:2px solid #FFFFFF;box-shadow:0 0 8px rgba(0,0,0,0.6);"></div>`;
    const icon = L.divIcon({ html, className: '', iconSize: [14, 14], iconAnchor: [7, 7] });
    hoverMarkerRef.current = L.marker([pt.lat, pt.lng], { icon, interactive: false, zIndexOffset: 1000 }).addTo(map);
  }, [ctx, hoverKm, daySegments]);

  // Hotel route — fetch cycling directions from OSRM and draw detour on map
  const hotelRouteLayersRef = useRef<any[]>([]);
  useEffect(() => {
    if (!ctx) return;
    const { L, map } = ctx;

    // Clear previous hotel route layers
    hotelRouteLayersRef.current.forEach((layer) => map.removeLayer(layer));
    hotelRouteLayersRef.current = [];

    if (!hotelRoute) return;

    let cancelled = false;
    const { from, to, name } = hotelRoute;
    const color = HOTEL_ROUTE_COLOR;

    /** Add the route line + markers for a given distance (in meters) */
    const drawRoute = (latLngs: [number, number][], distanceM: number | null) => {
      // Dashed line from town → hotel
      const line = L.polyline(latLngs, {
        color, weight: 4, opacity: 0.9, dashArray: '8 6',
      }).addTo(map);
      hotelRouteLayersRef.current.push(line);

      // Round-trip distance label
      const distLabel = distanceM != null
        ? `${(distanceM * 2 / 1000).toFixed(1)} km round trip`
        : '';

      // Hotel marker pin
      const pinHtml =
        `<div style="background:${color};color:#FFF;font-size:11px;font-weight:800;` +
        `padding:3px 8px;border-radius:6px;box-shadow:0 1px 4px rgba(0,0,0,.5);white-space:nowrap">` +
        `🏨 ${name.length > 22 ? name.slice(0, 20) + '…' : name}</div>`;
      const pinIcon = L.divIcon({ html: pinHtml, className: '', iconAnchor: [0, 0] });
      const pin = L.marker([to.lat, to.lng], { icon: pinIcon, interactive: false, zIndexOffset: 900 }).addTo(map);
      hotelRouteLayersRef.current.push(pin);

      // Distance badge at midpoint of the line
      if (distLabel) {
        const mid = latLngs[Math.floor(latLngs.length / 2)];
        const badgeHtml =
          `<div style="background:rgba(13,27,15,0.9);color:${color};font-size:10px;font-weight:700;` +
          `padding:2px 6px;border-radius:4px;border:1px solid ${color};white-space:nowrap">` +
          `↔ ${distLabel}</div>`;
        const badgeIcon = L.divIcon({ html: badgeHtml, className: '', iconAnchor: [0, 0] });
        const badge = L.marker(mid, { icon: badgeIcon, interactive: false, zIndexOffset: 950 }).addTo(map);
        hotelRouteLayersRef.current.push(badge);
      }
    };

    // Fetch route from OSRM (free, no API key) — use bike profile
    const url = `https://router.project-osrm.org/route/v1/bike/${from.lng},${from.lat};${to.lng},${to.lat}?geometries=geojson&overview=full`;

    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const route = data?.routes?.[0];
        const coords: [number, number][] = route?.geometry?.coordinates ?? [];
        const distanceM: number | null = route?.distance ?? null;

        if (coords.length < 2) {
          drawRoute([[from.lat, from.lng], [to.lat, to.lng]], distanceM);
        } else {
          const latLngs = coords.map(([lng, lat]: [number, number]) => [lat, lng] as [number, number]);
          drawRoute(latLngs, distanceM);
        }
      })
      .catch(() => {
        if (cancelled) return;
        drawRoute([[from.lat, from.lng], [to.lat, to.lng]], null);
      });

    return () => { cancelled = true; };
  }, [ctx, hotelRoute?.from?.lat, hotelRoute?.from?.lng, hotelRoute?.to?.lat, hotelRoute?.to?.lng, hotelRoute?.name]);

  if (!isEmbedded) {
    return (
      <View style={[styles.placeholder, style]}>
        <Text style={styles.emoji}>🗺️</Text>
        <Text style={styles.title}>Map view — native only</Text>
        <Text style={styles.sub}>Open in Expo Go on iOS/Android to see the live Mapbox map.</Text>
      </View>
    );
  }

  return (
    <MapCtx.Provider value={ctx}>
      <View style={[styles.mapContainer, style]}>
        {React.createElement('div', {
          ref: divRef,
          style: { width: '100%', height: '100%' },
        })}
        {children}
      </View>
    </MapCtx.Provider>
  );
}

// ─── MarkerView ───────────────────────────────────────────────────────────────

export function MarkerView({
  coordinate,
  children,
  draggable,
  onDragEnd,
}: {
  coordinate?: [number, number];
  children?: React.ReactNode;
  draggable?: boolean;
  onDragEnd?: (coordinate: [number, number]) => void;
}) {
  const ctx = useContext(MapCtx);
  const coordKey = coordinate ? `${coordinate[0]},${coordinate[1]}` : '';

  useEffect(() => {
    if (!ctx || !coordinate) return;
    const { L, map } = ctx;
    const label = extractText(children) ?? '';
    const color = extractColor(children) ?? '#39FF14';

    const cursor = draggable ? 'cursor:grab;' : '';
    const html =
      `<div style="background:${color};color:#0D1B0F;font-size:11px;` +
      `font-weight:800;padding:3px 8px;border-radius:6px;` +
      `box-shadow:0 1px 4px rgba(0,0,0,.5);white-space:nowrap;${cursor}">${label}</div>`;

    const icon = L.divIcon({ html, className: '', iconAnchor: [0, 0] });
    const [lng, lat] = coordinate;
    const marker = L.marker([lat, lng], { icon, draggable: !!draggable }).addTo(map);

    if (draggable && onDragEnd) {
      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        onDragEnd([pos.lng, pos.lat]);
      });
    }

    return () => { marker.remove(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, coordKey]);

  return null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractText(node: React.ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (!React.isValidElement(node)) return '';
  const el = node as React.ReactElement<any>;
  const { children } = el.props;
  if (Array.isArray(children)) return children.map(extractText).join('');
  return extractText(children);
}

function extractColor(node: React.ReactNode): string | null {
  if (!React.isValidElement(node)) return null;
  const el = node as React.ReactElement<any>;
  const style = el.props?.style;
  const flat: any = Array.isArray(style) ? Object.assign({}, ...style) : (style ?? {});
  if (flat.backgroundColor && flat.backgroundColor !== 'transparent') return flat.backgroundColor;
  const { children } = el.props;
  if (Array.isArray(children)) {
    for (const c of children) {
      const col = extractColor(c);
      if (col) return col;
    }
    return null;
  }
  return extractColor(children);
}

// ─── Stubs ───────────────────────────────────────────────────────────────────

export const Camera = React.forwardRef((_p: any, _r: any) => null);
export function UserLocation() { return null; }
export function ShapeSource({ children }: any) { return <>{children}</>; }
export function LineLayer() { return null; }
export function CircleLayer() { return null; }
export function SymbolLayer() { return null; }

const Mapbox = { setAccessToken: () => {}, setTelemetryEnabled: () => {} };
export default Mapbox;

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  mapContainer: { overflow: 'hidden', position: 'relative', width: '100%' },
  placeholder:  { flex: 1, backgroundColor: '#0D1B0F', alignItems: 'center', justifyContent: 'center', gap: 8 },
  emoji:        { fontSize: 48 },
  title:        { color: '#39FF14', fontSize: 18, fontWeight: '700' },
  sub:          { color: '#9CA3AF', fontSize: 13, textAlign: 'center', paddingHorizontal: 32 },
});
