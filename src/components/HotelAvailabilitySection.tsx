/**
 * HotelAvailabilitySection
 * Collapsible section shown at the bottom of each day card.
 * Shows up to 3 live hotel options for the overnight stop.
 */
import React from 'react';
import {
  View, Text, TouchableOpacity, ActivityIndicator, Linking, StyleSheet,
} from 'react-native';
import type { HotelAvailability, HotelDayResult } from '@/types';

const RADIUS_OPTIONS = [5, 10, 15];
const HOTEL_ROUTE_COLOR = '#E040FB'; // matches map hotel route color

interface Props {
  result: HotelDayResult;
  checkIn: string;       // YYYY-MM-DD
  color: string;         // Day accent color
  expanded: boolean;
  onToggle: () => void;
  radiusKm: number;
  onRadiusChange: (r: number) => void;
  selectedHotelCode?: string | null;
  onSelectHotel?: (hotel: HotelAvailability | null) => void;
}

export function HotelAvailabilitySection({
  result, checkIn, color, expanded, onToggle, radiusKm, onRadiusChange,
  selectedHotelCode, onSelectHotel,
}: Props) {
  // Format date: "2026-05-20" → "Wednesday May 20"
  const dateLabel = checkIn
    ? new Date(checkIn + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    : '';

  return (
    <View style={styles.container}>
      {/* Divider */}
      <View style={styles.divider} />

      {/* Toggle header */}
      <TouchableOpacity style={styles.toggle} onPress={onToggle} activeOpacity={0.7}>
        <Text style={styles.toggleLabel}>
          🛏  Hotels · {dateLabel}
          {result.status === 'loading' ? '  …' : ''}
          {result.status === 'success' && result.hotels.length > 0
            ? `  (${result.hotels.length})`
            : ''}
        </Text>
        <Text style={[styles.chevron, { color }]}>{expanded ? '▾' : '▸'}</Text>
      </TouchableOpacity>

      {/* Expanded body */}
      {expanded && (
        <View style={styles.body}>
          {/* Radius pills */}
          <View style={styles.radiusRow}>
            <Text style={styles.radiusLabel}>Within:</Text>
            {RADIUS_OPTIONS.map((r) => (
              <TouchableOpacity
                key={r}
                style={[
                  styles.radiusPill,
                  radiusKm === r && { borderColor: color },
                ]}
                onPress={() => onRadiusChange(r)}
                activeOpacity={0.7}
              >
                <Text style={[styles.radiusPillTxt, radiusKm === r && { color }]}>
                  {r} km
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Loading */}
          {result.status === 'loading' && (
            <View style={styles.statusRow}>
              <ActivityIndicator size="small" color={color} />
              <Text style={styles.statusTxt}>Checking availability…</Text>
            </View>
          )}

          {/* Error */}
          {result.status === 'error' && (
            <Text style={styles.errorTxt}>
              {result.error ?? 'Hotels unavailable'}
            </Text>
          )}

          {/* Idle (no key configured) */}
          {result.status === 'idle' && (
            <Text style={styles.idleTxt}>Add HotelBeds API key to enable live availability.</Text>
          )}

          {/* Empty success */}
          {result.status === 'success' && result.hotels.length === 0 && (
            <Text style={styles.emptyTxt}>No hotels found within {radiusKm} km.</Text>
          )}

          {/* Hotel cards */}
          {result.status === 'success' && result.hotels.map((hotel) => (
            <HotelMiniCard
              key={hotel.hotelCode}
              hotel={hotel}
              color={color}
              selected={hotel.hotelCode === selectedHotelCode}
              onSelect={() => {
                if (!onSelectHotel) return;
                onSelectHotel(hotel.hotelCode === selectedHotelCode ? null : hotel);
              }}
            />
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Mini hotel card ──────────────────────────────────────────────────────────

function HotelMiniCard({ hotel, color, selected, onSelect }: {
  hotel: HotelAvailability; color: string; selected?: boolean; onSelect?: () => void;
}) {
  const stars = hotel.stars > 0 ? '★'.repeat(hotel.stars) : '–';
  const price = hotel.minRate > 0
    ? `${hotel.currency === 'EUR' ? '€' : hotel.currency}${hotel.minRate.toFixed(0)} / night`
    : 'Price unavailable';

  return (
    <TouchableOpacity
      style={[
        styles.hotelCard,
        selected && { borderColor: HOTEL_ROUTE_COLOR, backgroundColor: '#1A0D22' },
      ]}
      onPress={onSelect}
      activeOpacity={0.8}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.hotelName} numberOfLines={1}>
          {selected ? <Text style={{ color: HOTEL_ROUTE_COLOR }}>📍 </Text> : null}{hotel.name}
        </Text>
        <View style={styles.hotelMeta}>
          <Text style={styles.hotelStars}>{stars}</Text>
          <Text style={styles.hotelPrice}>{price}</Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.bookBtn}
        onPress={(e) => { e.stopPropagation?.(); Linking.openURL(hotel.bookingUrl); }}
        activeOpacity={0.8}
      >
        <Text style={[styles.bookBtnTxt, { color }]}>Book →</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:      { marginTop: 0 },
  divider:        { height: 1, backgroundColor: '#1E3322', marginHorizontal: 0 },

  toggle:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 9 },
  toggleLabel:    { color: '#9CA3AF', fontSize: 12, fontWeight: '600' },
  chevron:        { fontSize: 14, fontWeight: '700' },

  body:           { paddingHorizontal: 12, paddingBottom: 12, gap: 8 },

  radiusRow:      { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  radiusLabel:    { color: '#6B7280', fontSize: 11 },
  radiusPill:     { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, borderWidth: 1, borderColor: '#1E3322', backgroundColor: '#0D1B0F' },
  radiusPillTxt:  { color: '#6B7280', fontSize: 11, fontWeight: '600' },

  statusRow:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusTxt:      { color: '#6B7280', fontSize: 12 },
  errorTxt:       { color: '#FF6B6B', fontSize: 12 },
  idleTxt:        { color: '#4B5563', fontSize: 11, fontStyle: 'italic' },
  emptyTxt:       { color: '#6B7280', fontSize: 12, fontStyle: 'italic' },

  hotelCard:      { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0A140C', borderRadius: 8, borderWidth: 1, borderColor: '#1E3322', paddingHorizontal: 10, paddingVertical: 8 },
  hotelName:      { color: '#E5E7EB', fontSize: 13, fontWeight: '700' },
  hotelMeta:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  hotelStars:     { color: '#FFB800', fontSize: 11 },
  hotelPrice:     { color: '#9CA3AF', fontSize: 11 },
  bookBtn:        { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, borderWidth: 1, borderColor: '#1E3322', marginLeft: 8 },
  bookBtnTxt:     { fontSize: 12, fontWeight: '700' },
});
