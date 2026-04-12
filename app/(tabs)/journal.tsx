/**
 * PHOTO JOURNAL SCREEN
 * ─────────────────────
 * UI Blueprint:
 *
 *  Timeline view (vertical scroll):
 *
 *  ┌─────────────────────────────────┐
 *  │  📸 Photo Journal          [+]  │  ← header + add button
 *  ├─────────────────────────────────┤
 *  │  ── Day 3 · Massa Marittima ──  │  ← day divider
 *  │  ┌───────────────────────────┐  │
 *  │  │  [Photo thumbnail]  km 82 │  │  ← photo card with km badge
 *  │  │  "Beautiful sunrise..."   │  │
 *  │  │  📍 43.0508, 10.8884      │  │
 *  │  └───────────────────────────┘  │
 *  │  ┌───────────────────────────┐  │
 *  │  │  [Photo thumbnail]  km 90 │  │
 *  │  └───────────────────────────┘  │
 *  │  ── Day 4 · Petriolo ────────   │
 *  └─────────────────────────────────┘
 *
 *  Tapping a photo opens full-screen view + shows km marker on mini-map.
 */
import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import type { JournalPhoto } from '@/types';

export default function JournalScreen() {
  const [photos, setPhotos] = useState<Partial<JournalPhoto>[]>([]);

  async function handleAddPhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera roll access is required to add photos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      exif: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      // TODO: snap to nearest GPX km marker using asset.exif GPS coords
      // TODO: upload to Firebase Storage
      const newPhoto: Partial<JournalPhoto> = {
        id:        String(Date.now()),
        imageUrl:  asset.uri,
        caption:   '',
        kmMarker:  0,   // TODO: derive from EXIF GPS
        dayNumber: 1,   // TODO: derive from photo timestamp vs stage dates
        createdAt: new Date(),
      };
      setPhotos((prev) => [newPhoto, ...prev]);
    }
  }

  async function handleTakePhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera access is required.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ exif: true, quality: 0.8 });
    if (!result.canceled && result.assets[0]) {
      // TODO: same EXIF processing as above
      setPhotos((prev) => [{ id: String(Date.now()), imageUrl: result.assets[0].uri, kmMarker: 0, dayNumber: 1, createdAt: new Date() }, ...prev]);
    }
  }

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.heading}>Photo Journal</Text>
        <View style={styles.addRow}>
          <TouchableOpacity style={styles.addBtn} onPress={handleTakePhoto}>
            <Text style={styles.addTxt}>📷 Camera</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.addBtn} onPress={handleAddPhoto}>
            <Text style={styles.addTxt}>🖼 Library</Text>
          </TouchableOpacity>
        </View>
      </View>

      {photos.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>📷</Text>
          <Text style={styles.emptyTitle}>No photos yet</Text>
          <Text style={styles.emptySub}>Capture moments along the trail — photos are geo-tagged to your km marker automatically.</Text>
        </View>
      ) : (
        <FlatList
          data={photos}
          keyExtractor={(p) => p.id!}
          renderItem={({ item }) => <PhotoCard photo={item} />}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

function PhotoCard({ photo }: { photo: Partial<JournalPhoto> }) {
  return (
    <View style={styles.card}>
      <Image source={{ uri: photo.imageUrl }} style={styles.thumb} resizeMode="cover" />
      <View style={styles.cardInfo}>
        <View style={styles.kmBadge}>
          <Text style={styles.kmTxt}>km {photo.kmMarker ?? '—'}</Text>
        </View>
        <Text style={styles.cardDate}>
          {photo.createdAt?.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen:     { flex: 1, backgroundColor: '#0D1B0F' },
  header:     { padding: 20, paddingBottom: 12 },
  heading:    { color: '#39FF14', fontSize: 26, fontWeight: '800', marginBottom: 12 },
  addRow:     { flexDirection: 'row', gap: 10 },
  addBtn:     { flex: 1, backgroundColor: '#142016', borderRadius: 12, borderWidth: 1, borderColor: '#1E3322', paddingVertical: 12, alignItems: 'center' },
  addTxt:     { color: '#F5F5F5', fontSize: 14, fontWeight: '600' },
  empty:      { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 8 },
  emptyEmoji: { fontSize: 52 },
  emptyTitle: { color: '#F5F5F5', fontSize: 18, fontWeight: '700' },
  emptySub:   { color: '#6B7280', fontSize: 14, textAlign: 'center', lineHeight: 20 },
  card:       { backgroundColor: '#142016', borderRadius: 14, borderWidth: 1, borderColor: '#1E3322', overflow: 'hidden', marginBottom: 12 },
  thumb:      { width: '100%', height: 200 },
  cardInfo:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12 },
  kmBadge:    { backgroundColor: '#0D1B0F', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: '#39FF14' },
  kmTxt:      { color: '#39FF14', fontSize: 13, fontWeight: '700' },
  cardDate:   { color: '#6B7280', fontSize: 12 },
});
