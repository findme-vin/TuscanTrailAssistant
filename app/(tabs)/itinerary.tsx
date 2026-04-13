/**
 * ITINERARY SCREEN
 * Shows all stages + hotels for each target town.
 */
import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, Linking, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Hotel } from '@/types';

const MOCK_HOTELS: Hotel[] = [
  { id: '1', name: 'Agriturismo Il Poggio', town: 'Massa Marittima', coord: { lat: 43.0508, lng: 10.8884 }, kmMarker: 80, stars: 3, priceRange: 'mid', phone: '+39 0566 901234', bookingUrl: null, amenities: ['bike_storage', 'dinner'], distanceFromTrailM: 250 },
  { id: '2', name: 'Hotel Terme di Petriolo', town: 'Petriolo', coord: { lat: 42.9802, lng: 11.2910 }, kmMarker: 155, stars: 4, priceRange: 'luxury', phone: '+39 0577 751234', bookingUrl: null, amenities: ['bike_storage', 'laundry', 'dinner', 'packed_lunch'], distanceFromTrailM: 100 },
  { id: '3', name: 'Locanda del Mulino', town: 'Abbadia San Salvatore', coord: { lat: 42.8810, lng: 11.6827 }, kmMarker: 230, stars: 2, priceRange: 'budget', phone: '+39 0577 778901', bookingUrl: null, amenities: ['bike_storage'], distanceFromTrailM: 400 },
];

const PRICE_LABEL: Record<string, string> = { budget: '€', mid: '€€', luxury: '€€€' };
const AMENITY_EMOJI: Record<string, string> = { bike_storage: '🚲', laundry: '🧺', dinner: '🍽️', packed_lunch: '🎒' };

function HotelCard({ hotel }: { hotel: Hotel }) {
  return (
    <View style={styles.hotelCard}>
      <View style={styles.hotelRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.hotelName}>{hotel.name}</Text>
          <Text style={styles.hotelTown}>{hotel.town} · km {hotel.kmMarker}</Text>
        </View>
        <View style={styles.priceTag}>
          <Text style={styles.priceTxt}>{PRICE_LABEL[hotel.priceRange]}</Text>
          <Text style={styles.starsTxt}>{'★'.repeat(hotel.stars)}</Text>
        </View>
      </View>
      <View style={styles.amenityRow}>
        {hotel.amenities.map((a) => (
          <Text key={a} style={styles.amenityChip}>{AMENITY_EMOJI[a] ?? '•'} {a.replace('_', ' ')}</Text>
        ))}
      </View>
      {hotel.phone && (
        <TouchableOpacity onPress={() => Linking.openURL(`tel:${hotel.phone}`)}>
          <Text style={styles.phoneLink}>📞 {hotel.phone}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function ItineraryScreen() {
  const [view, setView] = useState<'list' | 'hotels'>('list');

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.heading}>Itinerary</Text>
        <View style={styles.toggle}>
          {(['list', 'hotels'] as const).map((v) => (
            <TouchableOpacity key={v} style={[styles.toggleBtn, view === v && styles.toggleActive]} onPress={() => setView(v)}>
              <Text style={[styles.toggleTxt, view === v && styles.toggleTxtActive]}>{v === 'list' ? '📋 Stages' : '🛏 Hotels'}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {view === 'list' ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>📅</Text>
          <Text style={styles.emptyTitle}>No itinerary yet</Text>
          <Text style={styles.emptySub}>Go to Plan tab to generate your stages</Text>
        </View>
      ) : (
        <FlatList
          data={MOCK_HOTELS}
          keyExtractor={(h) => h.id}
          renderItem={({ item }) => <HotelCard hotel={item} />}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={<Text style={styles.sectionTitle}>Hotels along the route</Text>}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen:         { flex: 1, backgroundColor: '#0D1B0F' },
  header:         { padding: 20, paddingBottom: 8 },
  heading:        { color: '#39FF14', fontSize: 26, fontWeight: '800' },
  toggle:         { flexDirection: 'row', backgroundColor: '#142016', borderRadius: 12, borderWidth: 1, borderColor: '#1E3322', marginTop: 12, overflow: 'hidden' },
  toggleBtn:      { flex: 1, paddingVertical: 10, alignItems: 'center' },
  toggleActive:   { backgroundColor: '#1E3322' },
  toggleTxt:      { color: '#6B7280', fontSize: 13, fontWeight: '600' },
  toggleTxtActive:{ color: '#F5F5F5' },
  sectionTitle:   { color: '#9CA3AF', fontSize: 13, fontWeight: '700', letterSpacing: 0.8, marginBottom: 12 },
  hotelCard:      { backgroundColor: '#142016', borderRadius: 14, borderWidth: 1, borderColor: '#1E3322', padding: 14, marginBottom: 10 },
  hotelRow:       { flexDirection: 'row', marginBottom: 8 },
  hotelName:      { color: '#F5F5F5', fontSize: 15, fontWeight: '700' },
  hotelTown:      { color: '#6B7280', fontSize: 12, marginTop: 2 },
  priceTag:       { alignItems: 'flex-end' },
  priceTxt:       { color: '#FFB800', fontWeight: '700', fontSize: 14 },
  starsTxt:       { color: '#FFB800', fontSize: 11, marginTop: 2 },
  amenityRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  amenityChip:    { backgroundColor: '#0D1B0F', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, color: '#9CA3AF', fontSize: 11 },
  phoneLink:      { color: '#39FF14', fontSize: 13, fontWeight: '600' },
  emptyState:     { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyEmoji:     { fontSize: 52 },
  emptyTitle:     { color: '#F5F5F5', fontSize: 18, fontWeight: '700' },
  emptySub:       { color: '#6B7280', fontSize: 14 },
});
