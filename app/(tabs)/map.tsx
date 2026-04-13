/**
 * MAIN MAP VIEW
 * ─────────────
 * UI Blueprint:
 *
 *  ┌─────────────────────────────────┐
 *  │  [SAT] [OUT] [DRK]   [⊕ locate] │  ← style switcher + re-center (top-right)
 *  │                                  │
 *  │   ·─────────────────·            │
 *  │  /  Mapbox Outdoors  \           │  ← full-bleed map
 *  │ |  GPX route (neon    |          │
 *  │ |  green polyline)    |          │
 *  │ |  📍 hotel pins      |          │
 *  │ |  ⚠️  alert pins     |          │
 *  │  \___________________/           │
 *  │                                  │
 *  │ ╔══════════════════════════════╗ │
 *  │ ║  DAY 3 · 82 km · +1 240 m   ║ │  ← bottom sheet — current stage
 *  │ ║  Campiglia → Massa Marittima ║ │     swipe up for hotels list
 *  │ ╚══════════════════════════════╝ │
 *  └─────────────────────────────────┘
 */
import React, { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Camera, MapView, UserLocation, ShapeSource, LineLayer, MarkerView } from '@/mocks/rnmapbox-maps.web';
import { DEFAULT_CAMERA, MapStyles } from '@/lib/mapbox';

type StyleKey = keyof typeof MapStyles;

export default function MapScreen() {
  const cameraRef = useRef<any>(null);
  const [activeStyle, setActiveStyle] = useState<StyleKey>('OUTDOOR');

  // TODO: load from trip store / React Query
  const currentStage = null;
  const noticePins:   any[] = [];
  const hotelPins:    any[] = [];

  return (
    <View style={StyleSheet.absoluteFillObject}>
      <MapView
        style={StyleSheet.absoluteFillObject}
        styleURL={MapStyles[activeStyle]}
        logoEnabled={false}
        attributionEnabled={false}
        compassEnabled
      >
        <Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: DEFAULT_CAMERA.centerCoordinate,
            zoomLevel: DEFAULT_CAMERA.zoomLevel,
          }}
        />

        <UserLocation visible animated />

        {/* TODO: <ShapeSource id="route" shape={routeGeoJSON}>
              <LineLayer id="route-line" style={{ lineColor:'#39FF14', lineWidth:4 }} />
            </ShapeSource> */}

        {/* TODO: hotel + notice pins via MarkerView */}
      </MapView>

      {/* ── Map style switcher ── */}
      <SafeAreaView edges={['top']} pointerEvents="box-none" style={styles.controls}>
        <View style={styles.stylePicker}>
          {(['OUTDOOR', 'SATELLITE', 'DARK'] as StyleKey[]).map((s) => (
            <TouchableOpacity
              key={s}
              style={[styles.styleBtn, activeStyle === s && styles.styleBtnActive]}
              onPress={() => setActiveStyle(s)}
            >
              <Text style={[styles.styleTxt, activeStyle === s && styles.styleTxtActive]}>
                {s === 'OUTDOOR' ? 'OUT' : s === 'SATELLITE' ? 'SAT' : 'DRK'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.locateBtn} onPress={() => { /* TODO: fly to user location */ }}>
          <Text style={styles.locateIcon}>⊕</Text>
        </TouchableOpacity>
      </SafeAreaView>

      {/* ── Current stage bottom chip ── */}
      {currentStage ? (
        <View style={styles.stageChip}>
          {/* TODO: render current stage info */}
        </View>
      ) : (
        <View style={styles.stageChip}>
          <Text style={styles.chipLabel}>No trip planned yet</Text>
          <Text style={styles.chipSub}>Go to Plan to create your itinerary</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  controls:      { position: 'absolute', top: 0, right: 0, left: 0, padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  stylePicker:   { flexDirection: 'row', backgroundColor: '#0D1B0F', borderRadius: 10, borderWidth: 1, borderColor: '#1E3322', overflow: 'hidden' },
  styleBtn:      { paddingHorizontal: 12, paddingVertical: 8 },
  styleBtnActive:{ backgroundColor: '#39FF14' },
  styleTxt:      { color: '#9CA3AF', fontSize: 11, fontWeight: '700' },
  styleTxtActive:{ color: '#0D1B0F' },
  locateBtn:     { width: 44, height: 44, borderRadius: 22, backgroundColor: '#142016', borderWidth: 1, borderColor: '#1E3322', alignItems: 'center', justifyContent: 'center' },
  locateIcon:    { color: '#39FF14', fontSize: 22, fontWeight: '700' },
  stageChip:     { position: 'absolute', bottom: 90, left: 16, right: 16, backgroundColor: '#142016', borderRadius: 16, borderWidth: 1, borderColor: '#1E3322', padding: 16 },
  chipLabel:     { color: '#F5F5F5', fontWeight: '700', fontSize: 15 },
  chipSub:       { color: '#6B7280', fontSize: 12, marginTop: 4 },
});
